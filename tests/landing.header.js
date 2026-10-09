/* Regresión del nombre de la barbería en el header.

   El nombre estaba recortado con ellipsis ("CODIGO BA...") en toda la banda
   de 1280 a 1639 px: el header mide 1240 px ahí, y con 7 links de nav más
   los botones no sobraba lugar. Se recortaba porque .lb-brand era el único
   ítem flexible de la fila y .lb-brand b llevaba overflow:hidden.

   La fila del header no tiene overflow visible, así que esto no se ve como
   scroll: se ve como un nombre cortado. Hay que medir scrollWidth contra
   clientWidth del <b>, no el overflowX del documento.

   Uso: python -m http.server 8765   ->   node tests\landing.header.js
*/
const path = require("path");
const { chromium } = require("../.opencode/skills/playwright-skill/node_modules/playwright");

const BASE = "http://127.0.0.1:8765/index.html";
/* Toda la banda donde el header cambia de ancho: móvil, tablet, la franja
   de 1280-1639 con la nav completa, y el header ancho de 1640 en adelante. */
const ANCHOS = [320, 360, 390, 480, 640, 768, 1024, 1280, 1366, 1440, 1536, 1560, 1639, 1640, 1920];
let fallos = 0;

(async () => {
  const b = await chromium.launch();
  console.log("nombre del header por ancho\n");
  for (const w of ANCHOS) {
    const ctx = await b.newContext({ viewport: { width: w, height: 900 } });
    const p = await ctx.newPage();
    await p.goto(BASE, { waitUntil: "domcontentloaded" });
    await p.waitForSelector(".lb-brand", { timeout: 20000 });
    await p.waitForTimeout(1300);

    const r = await p.evaluate(() => {
      const br = document.querySelector(".lb-brand");
      const bo = br.querySelector("b");
      const inner = br.closest(".lb-hd-in");
      const hd = document.querySelector(".lb-hd");
      const nav = document.querySelector(".lb-nav");
      const links = [...(nav?.querySelectorAll("a") || [])];
      const navR = nav?.getBoundingClientRect();
      const ultimo = links[links.length - 1]?.getBoundingClientRect();
      return {
        texto: bo.textContent.trim(),
        completa: bo.scrollWidth <= bo.clientWidth + 1,
        bClient: bo.clientWidth,
        bNecesario: bo.scrollWidth,
        hdDesborde: hd ? hd.scrollWidth > hd.clientWidth + 1 : false,
        navSePasa: navR && ultimo ? ultimo.right > navR.right + 1 : false,
        navLinks: links.length,
        cs: getComputedStyle(bo).textOverflow,
        aire: inner
          ? Math.round(inner.clientWidth -
              [...inner.children].reduce((a, c) => a + c.getBoundingClientRect().width, 0))
          : null,
      };
    });

    /* text-overflow: ellipsis está declarado por debajo de 1280 px como
       último recurso. No es un defecto si el nombre entra entero: sólo
       importa que no se corte de verdad. */
    const malo = !r.completa || r.hdDesborde || r.navSePasa;
    if (malo) fallos++;
    console.log(
      (malo ? "  FALLA" : "  OK   ") +
        String(w).padStart(5) +
        '  "' + r.texto + '"' +
        "  ancho " + r.bClient + "/" + r.bNecesario +
        "  nav " + r.navLinks + " links" +
        "  aire " + r.aire + "px" +
        "  ellipsis=" + r.cs +
        (r.hdDesborde ? "  DESBORDE" : "") +
        (r.navSePasa ? "  NAV-SE-PASA" : ""),
    );

    if (w === 1440) {
      const hd = await p.$(".lb-hd");
      if (hd) await hd.screenshot({ path: path.join(__dirname, "..", "tmp_shots", "HD-1440.png") });
    }
    if (w === 390) {
      const hd = await p.$(".lb-hd");
      if (hd) await hd.screenshot({ path: path.join(__dirname, "..", "tmp_shots", "HD-390.png") });
    }
    await ctx.close();
  }

  /* Y en el móvil, que no se rompa ni por el nombre ni por el header. */
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  await p.goto(BASE, { waitUntil: "domcontentloaded" });
  await p.waitForSelector(".lb-brand", { timeout: 20000 });
  await p.waitForTimeout(1300);
  const movil = await p.evaluate(() => {
    const bo = document.querySelector(".lb-brand b");
    return {
      texto: bo.textContent.trim(),
      completa: bo.scrollWidth <= bo.clientWidth + 1,
      overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    };
  });
  if (!movil.completa) fallos++;
  console.log("\n  " + (movil.completa ? "OK   " : "FALLA") + "   390  \"" + movil.texto +
    "\"  nombre completo=" + movil.completa + "  scroll horizontal=" + movil.overflowX);
  await ctx.close();

  await b.close();
  console.log("\n=== " + (fallos ? fallos + " FALLAS" : "todo OK") + " ===");
  process.exit(fallos ? 1 : 0);
})();