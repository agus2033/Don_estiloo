/* Verifica la identidad y el fondo del modal de reserva:
     - el logo carga (no es un 404) y el nombre de la barbería se lee
     - el logo del header de la landing carga y es circular
     - los barberos del paso 2 traen foto
     - el velo deja ver la landing desenfocada: es translúcido, con blur
       real, y del color de la marca (no negro ni gris neutro)

   Uso: python -m http.server 8765   ->   node tests\landing.modal.js
*/
const path = require("path");
const { chromium } = require("../.opencode/skills/playwright-skill/node_modules/playwright");

const BASE = "http://127.0.0.1:8765/index.html";
let fallos = 0;
const check = (ok, txt, extra) => {
  if (!ok) fallos++;
  console.log((ok ? "  OK   " : "  FALLA") + " " + txt + (extra ? "  -> " + extra : ""));
};

/* "color-mix()" y "color()" devuelven color(srgb r g b / a) con canales 0-1 */
function parseColor(s) {
  const t = String(s || "");
  const cs = t.match(/color\(\s*srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?/i);
  if (cs) return { r: +cs[1] * 255, g: +cs[2] * 255, b: +cs[3] * 255,
                   a: cs[4] === undefined ? 1 : +cs[4] };
  const n = (t.match(/[\d.]+/g) || []).map(Number);
  const a = t.match(/rgba?\([^)]*,\s*([\d.]+)\s*\)/i);
  return { r: n[0] || 0, g: n[1] || 0, b: n[2] || 0,
           a: a ? +a[1] : t.includes("rgba") ? 1 : 1 };
}

async function abrirModal(p) {
  await p.click('[data-act="wzAbrir"]');
  await p.waitForSelector(".wz-sheet", { timeout: 8000 });
  await p.waitForTimeout(700);
}

(async () => {
  const b = await chromium.launch();
  for (const theme of ["dark", "light"]) {
    console.log("\n========== " + theme.toUpperCase() + " ==========");
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const p = await ctx.newPage();
    const errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    p.on("console", (m) => { if (m.type() === "error" && !/firestore|404/i.test(m.text())) errs.push("console: " + m.text().slice(0, 120)); });

    await p.addInitScript((t) => localStorage.setItem("theme", t), theme);
    await p.goto(BASE, { waitUntil: "domcontentloaded" });
    await p.waitForSelector(".lb-wcard", { timeout: 20000 });
    await p.waitForTimeout(1500);

    /* ---- logo del header de la landing ---- */
    const hdr = await p.evaluate(() => {
      const i = document.getElementById("lg");
      if (!i) return null;
      const cs = getComputedStyle(i);
      return { src: i.getAttribute("src"), w: i.naturalWidth, radius: cs.borderTopLeftRadius,
               bg: cs.backgroundColor };
    });
    check(!!hdr, "el header tiene <img id=lg>");
    if (hdr) {
      check(hdr.w > 0, "el logo del header carga (naturalWidth " + hdr.w + ")", hdr.src);
      check(hdr.radius.includes("50%"), "el logo del header es circular", hdr.radius);
    }

    await abrirModal(p);

    /* ---- marca dentro del modal ---- */
    const marca = await p.evaluate(() => {
      const m = document.querySelector(".wz-marca");
      if (!m) return null;
      const img = m.querySelector(".wz-logo");
      const b = m.querySelector("b");
      const s = m.querySelector("small");
      return {
        imgOk: !!img && img.naturalWidth > 0,
        src: img ? img.getAttribute("src") : null,
        nombre: b ? b.textContent.trim() : null,
        sub: s ? s.textContent.trim() : null,
        imgVisible: img ? img.getBoundingClientRect().width : 0,
      };
    });
    check(!!marca, "el modal tiene la marca (.wz-marca)");
    /* La fuente de verdad del nombre es src/config.js, que main.js vuelca en
   #brand. Comparar contra el header en vez de contra un literal: si el
   nombre cambia en la config, el test sigue siendo válido solo. */
const NOMBRE_EN_PAGINA = await p.evaluate(() =>
  (document.getElementById("brand")?.textContent || "").trim());
check(!!NOMBRE_EN_PAGINA, "el header define el nombre de marca: \"" + NOMBRE_EN_PAGINA + "\"");
    if (marca) {
      check(marca.imgOk, "el logo del modal carga", marca.src);
      check(marca.imgVisible >= 40, "el logo se ve a tamaño legible (" + Math.round(marca.imgVisible) + "px)");
      check(marca.nombre === NOMBRE_EN_PAGINA,
        "el modal muestra el mismo nombre que el header: \"" + marca.nombre + "\"",
        marca.nombre === NOMBRE_EN_PAGINA ? "" : "header dice \"" + NOMBRE_EN_PAGINA + "\"");
      check(!/\s1$/.test(marca.nombre), "el nombre no arrastra el \" 1\" de las pruebas");
      check(!!marca.sub, "bajo el nombre dice: \"" + marca.sub + "\"");
    }

    /* ---- el velo deja ver la landing ---- */
    const velo = await p.evaluate(() => {
      const cs = getComputedStyle(document.getElementById("wzm"));
      return { bg: cs.backgroundColor, bf: cs.backdropFilter || cs.webkitBackdropFilter || "" };
    });
    const c = parseColor(velo.bg);
    check(c.a < 0.75, "el velo es translúcido (alpha " + c.a + ")", velo.bg);
    const blur = parseInt((velo.bf.match(/blur\((\d+)px/) || [])[1] || "0", 10);
    check(blur >= 12, "la landing de atrás está desenfocada (blur " + blur + "px)", velo.bf);
    /* El velo tiene que ser el fondo del tema ACTUAL. Sólo con mirar que no
       sea gris neutro no alcanza: un velo azul sobre la página clara se ve
       bien en el número del spread y queda feo en pantalla. */
    const fondo = await p.evaluate(() =>
      getComputedStyle(document.body).getPropertyValue("--lb-bg").trim());
    const hex = (h) => {
      const n = (h.match(/[\da-f]{2}/gi) || []).map((x) => parseInt(x, 16));
      return n.length === 3 ? { r: n[0], g: n[1], b: n[2] } : null;
    };
    const f = hex(fondo);
    if (f) {
      const dist = Math.abs(c.r - f.r) + Math.abs(c.g - f.g) + Math.abs(c.b - f.b);
      check(dist <= 6, "el velo sigue al tema: usa " + fondo + " (distancia " +
        Math.round(dist) + ")");
    }

    let sheet = await p.$(".wz-sheet");
    if (sheet) await sheet.screenshot({ path: path.join(__dirname, "..", "tmp_shots", `MOD-${theme}-paso1.png`) });

    /* ---- fotos de los barberos (paso 2) ---- */
    await p.click(".wz-item:not(.on)");
    await p.waitForTimeout(200);
    await p.click(".wz-pie .wz-btn--pri");
    await p.waitForTimeout(600);

    const bars = await p.evaluate(() => {
      const items = [...document.querySelectorAll(".wz-item--bar")];
      return {
        n: items.length,
        filas: items.map((it) => {
          const f = it.querySelector(".wz-foto");
          const img = f ? f.querySelector("img") : null;
          return {
            nombre: it.querySelector(".wz-item-t b")?.textContent?.trim(),
            esp: it.querySelector(".wz-item-t small")?.textContent?.trim(),
            conCaja: !!f,
            fotoCarga: img ? img.naturalWidth > 0 : null,
            tam: f ? Math.round(f.getBoundingClientRect().width) : 0,
            inicial: !img ? f?.textContent?.trim() : null,
            roto: img ? (img.getAttribute("src") || "") : null,
          };
        }),
      };
    });
    check(bars.n > 0, "el paso 2 lista barberos con avatar (" + bars.n + ")");
    check(bars.filas.every((f) => f.conCaja), "cada barbero tiene su caja de foto");
    check(bars.filas.every((f) => f.tam >= 40), "las fotos se ven a tamaño real");
    bars.filas.forEach((f) => {
      const estado = f.fotoCarga ? "foto OK" : f.inicial ? "inicial \"" + f.inicial + "\"" : "FOTO ROTA";
      console.log("         " + f.nombre + " · " + f.esp + " · " + estado);
      if (f.fotoCarga === false) fallos++;
    });
    if (sheet) sheet = await p.$(".wz-sheet");
    if (sheet) await sheet.screenshot({ path: path.join(__dirname, "..", "tmp_shots", `MOD-${theme}-paso2.png`) });

    /* ---- el modal no debe tapar el login al continuar ---- */
    await p.click(".wz-item:not(.on)");
    await p.waitForTimeout(200);
    await p.click(".wz-pie .wz-btn--pri");
    await p.waitForTimeout(500);
    await p.click(".wz-cel.libre");
    await p.waitForTimeout(250);
    await p.click(".wz-pie .wz-btn--pri");
    await p.waitForTimeout(400);
    await p.click(".wz-turno:not(.off)");
    await p.waitForTimeout(250);
    await p.click(".wz-pie .wz-btn--pri");
    await p.waitForTimeout(400);
    await p.click(".wz-hora:not(.oc)");
    await p.waitForTimeout(250);
    await p.click(".wz-pie .wz-btn--pri");
    await p.waitForTimeout(400);
    const paso6 = await p.evaluate(() => !!document.querySelector(".wz-sum"));
    check(paso6, "llega al resumen");

    await p.click(".wz-body .wz-btn--pri");
    await p.waitForTimeout(1200);
    const handoff = await p.evaluate(() => ({
      modalAbierto: !!document.querySelector(".wz-sheet"),
      wzmOculto: document.getElementById("wzm")?.hasAttribute("hidden") ?? null,
      scrollLock: document.body.classList.contains("wz-abierto"),
      login: !!document.querySelector("#ie"),
      loginVisible: (() => { const e = document.querySelector("#ie");
        return e ? !!e.offsetParent : false; })(),
      hash: location.hash,
      loader: (() => { const l = document.querySelector("#ld");
        return l ? getComputedStyle(l).display : "no"; })(),
    }));
    check(!handoff.modalAbierto && handoff.wzmOculto, "al continuar se CIERRA el modal");
    check(!handoff.scrollLock, "suelta el scroll de la página");
    check(handoff.loginVisible, "el login queda a la vista (no tapado)");
    check(handoff.hash === "#/reservar", "deja el hash en #/reservar", handoff.hash);


    /* --- el calendario no puede pasarse de la hoja ---
       La hoja tiene overflow oculto, así que un desborde no se ve como
       scroll: se ve como la columna del sábado cortada. Hay que medir
       scrollWidth contra clientWidth del grid, no el overflowX del body. */
    await p.goto(BASE, { waitUntil: "domcontentloaded" });
    await p.waitForSelector(".lb-wcard", { timeout: 20000 });
    await p.waitForTimeout(1500);
    await p.click('[data-act="wzAbrir"]');
    await p.waitForSelector(".wz-sheet");
    await p.waitForTimeout(300);
    await p.click(".wz-item:not(.on)");
    await p.waitForTimeout(150);
    await p.click(".wz-pie .wz-btn--pri");
    await p.waitForTimeout(300);
    await p.click(".wz-item:not(.on)");
    await p.waitForTimeout(150);
    await p.click(".wz-pie .wz-btn--pri");
    await p.waitForTimeout(1500);
    const cal = await p.evaluate(() => {
      const cels = document.querySelector(".wz-cels");
      const sheet = document.querySelector(".wz-sheet");
      const cs = getComputedStyle(cels);
      const cr = cels.getBoundingClientRect(), sr = sheet.getBoundingClientRect();
      const pistas = (cs.gridTemplateColumns.match(/[\d.]+/g) || []).map(Number);
      const celdas = [...cels.children];
      const filas = {};
      celdas.forEach((c) => {
        const y = Math.round(c.getBoundingClientRect().top);
        filas[y] = (filas[y] || 0) + 1;
      });
      return {
        scrollW: cels.scrollWidth, clientW: cels.clientWidth,
        anchoPista: pistas[0], nPistas: pistas.length,
        dentro: cr.right <= sr.right + 0.5,
        filas: Object.values(filas),
        celdas: celdas.length,
      };
    });
    check(cal.scrollW <= cal.clientW, "el calendario no desborda la hoja (scroll " +
      cal.scrollW + " <= client " + cal.clientW + ")");
    check(cal.dentro, "la última columna cae dentro de la hoja");
    check(cal.nPistas === 7, "son 7 columnas de " + Math.round(cal.anchoPista) + "px");
    const filasMalas = cal.filas.filter((n) => n !== 7);
    check(filasMalas.length === 0, "todas las filas del calendario tienen 7 celdas",
      "filas: " + cal.filas.join(","));
    const sc = await p.$(".wz-sheet");
    if (sc) await sc.screenshot({ path: path.join(__dirname, "..", "tmp_shots", `MOD-${theme}-calendario.png`) });


    check(errs.length === 0, "sin errores JS" + (errs.length ? ": " + errs[0].slice(0, 100) : ""));
    await ctx.close();
  }
  await b.close();
  console.log("\n=== " + (fallos ? fallos + " FALLAS" : "todo OK") + " ===");
  process.exit(fallos ? 1 : 0);
})();