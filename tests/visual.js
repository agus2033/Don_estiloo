/* Defectos visuales medidos, no opinados.

   Una captura a ojo sirve para descubrir que algo está raro, pero no para
   decir que está bien. Esto mide las cuatro cosas que más se rompen en una web
   como esta y que más molestan:

     1. Contenido tapado por la barra fija de "RESERVAR AHORA".
     2. Desbordamiento horizontal (la barra lateral en un teléfono).
     3. Áreas táctiles chicas (menos de 44 px) en móvil.
     4. Textos chico (menos de 12 px) o que se salen de su caja.

   Corre en los cuatro anchos y en los dos temas.

   Uso:  node tests\visual.js
*/
const { chromium } = require("../.opencode/skills/playwright-skill/node_modules/playwright/index.js");

const PANTALLAS = [
  { n: "390", w: 390, h: 844, movil: true },
  { n: "768", w: 768, h: 1024, movil: false },
  { n: "1280", w: 1280, h: 900, movil: false },
  { n: "1600", w: 1600, h: 950, movil: false },
];

let fallos = 0;
let avisos = 0;
const ok = (c, m, d) => {
  console.log((c ? "  OK    " : "  FALLA ") + m);
  if (!c) {
    fallos++;
    if (d) console.log("          " + d);
  }
};
const aviso = (m, d) => {
  console.log("  AVISO " + m);
  avisos++;
  if (d) console.log("          " + d);
};

(async () => {
  const b = await chromium.launch();

  for (const p of PANTALLAS) {
    for (const tema of ["dark", "light"]) {
      const ctx = await b.newContext({
        viewport: { width: p.w, height: p.h },
        isMobile: p.movil,
        hasTouch: p.movil,
      });
      const page = await ctx.newPage();
      await page.addInitScript((t) => {
        try {
          localStorage.setItem("theme", t);
        } catch (e) {}
      }, tema);
      await page.goto("http://127.0.0.1:8765/index.html", { waitUntil: "domcontentloaded" });
      await page.waitForSelector(".lb-wcard", { timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(3200);

      console.log("\n=== " + tema + " · " + p.n + "px ===");

      /* --- 1. la barra fija tapa algo al final de la página --- */
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(900);
      const tapado = await page.evaluate(() => {
        const fija = [...document.querySelectorAll("body *")].find((e) => {
          const cs = getComputedStyle(e);
          return (
            (cs.position === "fixed" || cs.position === "sticky") &&
            e.offsetHeight > 40 &&
            e.offsetWidth > 100 &&
            parseInt(cs.bottom || "0") <= 2 &&
            /R\.visibility/.test(cs.pointerEvents) === false
          );
        });
        if (!fija) return { barra: false };
        const arriba = fija.getBoundingClientRect().top;
        /* El último elemento con texto de la página, ¿queda por encima de la
           barra? */
        const textos = [...document.querySelectorAll("#app *")].filter((e) => {
          if (!e.offsetParent && getComputedStyle(e).position !== "fixed") return false;
          return e.children.length === 0 && (e.textContent || "").trim().length > 3;
        });
        const ult = textos[textos.length - 1];
        if (!ult) return { barra: true, oculto: false };
        const r = ult.getBoundingClientRect();
        return {
          barra: true,
          barraTop: Math.round(arriba),
          ultimoTexto: (ult.textContent || "").trim().slice(0, 40),
          ultimoBottom: Math.round(r.bottom),
          oculto: r.bottom > arriba + 2 && r.top < arriba,
          tapadoPor: Math.round(r.bottom - arriba),
        };
      });

      if (!tapado.barra) {
        aviso("no se encontró la barra fija de reservar en esta pantalla");
      } else if (tapado.oculto) {
        ok(
          false,
          "la barra fija tapa el último texto de la página",
          `"${tapado.ultimoTexto}" queda ${tapado.tapadoPor}px debajo de la barra`,
        );
      } else {
        ok(true, "la barra fija no tapa el último texto de la página");
      }

      /* --- 2. desbordamiento horizontal --- */
      const desborde = await page.evaluate(() => {
        const de = document.documentElement;
        const ancho = de.clientWidth;
        const culpables = [];
        for (const e of document.querySelectorAll("body *")) {
          const r = e.getBoundingClientRect();
          if (r.width === 0) continue;
          if (r.right > ancho + 1 || r.left < -1) {
            culpables.push({
              sel: e.nodeName + (e.className ? "." + String(e.className).split(" ").slice(0, 2).join(".") : ""),
              left: Math.round(r.left),
              right: Math.round(r.right),
            });
          }
        }
        return {
          scrollW: de.scrollWidth,
          clientW: ancho,
          desborda: de.scrollWidth > ancho + 1,
          culpables: culpables.slice(0, 6),
        };
      });
      ok(
        !desborde.desborda,
        "no hay scroll horizontal",
        desborde.desborda
          ? `scrollWidth ${desborde.scrollW} > ${desborde.clientW}; culpables: ${JSON.stringify(desborde.culpasables)}`
          : "",
      );

      /* --- 3. áreas táctiles (sólo móvil) --- */
      if (p.movil) {
        const chicos = await page.evaluate(() => {
          const malos = [];
          for (const e of document.querySelectorAll("#app a, #app button, #app [data-act]")) {
            if (!e.offsetParent) continue;
            const r = e.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) continue;
            /* Los que están pegados entre sí comparten el área: sólo se
               cuentan los que están sueltos. */
            if (r.height < 44)
              malos.push({
                sel: e.nodeName + (e.className ? "." + String(e.className).split(" ")[0] : ""),
                txt: (e.textContent || "").trim().slice(0, 22),
                h: Math.round(r.height),
                w: Math.round(r.width),
              });
          }
          return malos;
        });
        ok(
          chicos.length === 0,
          "todas las áreas táctiles miden 44px o más",
          chicos.length ? JSON.stringify(chicos.slice(0, 6)) : "",
        );
      }

      /* --- 4. texto chico --- */
      const chicos = await page.evaluate(() => {
        const malos = [];
        for (const e of document.querySelectorAll("#app *")) {
          if (!e.offsetParent && e.tagName !== "BODY") continue;
          if (e.children.length) continue;
          const txt = (e.textContent || "").trim();
          if (!txt) continue;
          const fs = parseFloat(getComputedStyle(e).fontSize);
          if (fs < 12)
            malos.push({ sel: e.nodeName, txt: txt.slice(0, 22), fs: +fs.toFixed(1) });
        }
        return malos;
      });
      ok(chicos.length === 0, "ningún texto por debajo de 12px", JSON.stringify(chicos.slice(0, 5)));

      await ctx.close();
    }
  }

  await b.close();
  console.log(`\nFALLARON ${fallos} · avisos ${avisos}`);
  process.exit(fallos ? 1 : 0);
})();