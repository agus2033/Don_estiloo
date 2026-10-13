/* Accesibilidad real, medida con axe-core.

   Por qué no el número de PageSpeed: la API de PageSpeed Insights devuelve
   HTTP 429 ("Quota exceeded") desde la clave compartida, así que no hay forma
   de traer ese informe. Lo que sí hay esaxe-core, que es el MISMO motor que
   usa Lighthouse para la categoría de accesibilidad. Correrlo acá da el
   puntaje propio y, más útil que el puntaje, la lista de Fallos concretos.

   Corre en móvil emulado (390x844) porque es lo que pidió el dueño, y en las
   pantallas que existen de verdad: la landing, el ingreso y el panel.

   node tests\accesibilidad.js
*/
const { chromium } = require("../.opencode/skills/playwright-skill/node_modules/playwright/index.js");
const fs = require("fs");
const path = require("path");

const AXE = "https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.8.4/axe.min.js";
const BASE = "http://127.0.0.1:8765/index.html";

let fallos = 0;
const ok = (c, m, d) => {
  console.log((c ? "  OK    " : "  FALLA ") + m);
  if (!c) {
    fallos++;
    if (d) console.log("          " + d);
  }
};

/* Traducción de los ids de axe a algo entendible y a qué arreglarlo. */
const CONSEJOS = {
  "color-contrast": "el texto no tiene contraste suficiente con el fondo",
  "image-alt": "faltanalt en imágenes",
  "link-name": "enlaces sin texto (o con texto que no se lee)",
  "button-name": "botones sin nombre accesible",
  "aria-hidden-focus": "elementos ocultos para lectores de pantalla que se pueden enfocar",
  "aria-allowed-attr": "atributo ARIA que no corresponde al rol",
  "aria-valid-attr-value": "valor ARIA inválido",
  "target-size": "el área tocable es más chica que 24x24 px",
  "label": "campo de formulario sin etiqueta",
  "duplicate-id": "dos elementos con el mismo id",
  "html-has-lang": "falta el atributo lang",
  "heading-order": "los encabezados se saltan un nivel",
  landmark: "falta un landmark (main, nav, header...)",
  "region": "contenido fuera de cualquier landmark",
  "tabindex": "tabindex positivo (cambia el orden del tabulador)",
  "frame-title": "iframe sin título",
  "select-name": "lista desplegable sin etiqueta",
};

(async () => {
  const b = await chromium.launch();

  const correr = async (nombre, preparar) => {
    const ctx = await b.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".lb-wcard", { timeout: 30000 });
    /* Se desregistra el service worker y se vacían las cachés antes de medir.
       Sin esto, la segunda vuelta de una misma sesión lee `src/main.js` de la
       caché y la auditoría mide el código de la corrida anterior, no el que
       está en el disco. Passó: el axe seguiría reportando un <h3> que en el
       archivo ya era <h2>. */
    await page.evaluate(async () => {
      const rs = await navigator.serviceWorker.getRegistrations();
      for (const r of rs) await r.unregister();
      for (const k of await caches.keys()) await caches.delete(k);
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector(".lb-wcard", { timeout: 30000 });
    await page.waitForTimeout(2500);
    if (preparar) await preparar(page);
    /* El axe se baja de un CDN, y ese CDN se cae. Cuando pasaba, la prueba
       moría con un "Error" a secas en el informe de la suite, sin decir que lo
       que había fallado era bajar la librería y no la accesibilidad: es
       distinto que haya un problema de red a que el sitio tenga
       violaciones. Se reintenta y, si sigue sin bajar, se dice exactamente eso
       en vez de un error genérico. */
    let bajo = false;
    let ultimo = "";
    for (let intento = 1; intento <= 3 && !bajo; intento++) {
      try {
        await page.addScriptTag({ url: AXE });
        await page.waitForFunction(() => !!window.axe, { timeout: 20000 });
        bajo = true;
      } catch (e) {
        ultimo = String(e && e.message ? e.message : e).slice(0, 120);
        console.log(`  (no se pudo bajar axe del CDN, intento ${intento}/3: ${ultimo})`);
        await page.waitForTimeout(3000 * intento);
      }
    }
    if (!bajo) {
      throw new Error(
        "NO SE PUDO BAJAR axe-core del CDN (" +
          AXE +
          "). No es un problema de accesibilidad del sitio, es que la librería " +
          "no llegó. El informe de esta prueba NO es válido en este intento.",
      );
    }
    const r = await page.evaluate(async () => {
      const res = await window.axe.run(document, {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"] },
      });
      return {
        score: 0,
        violaciones: res.violations.map((v) => ({
          id: v.id,
          impacto: v.impact,
          ayuda: v.help,
          nodos: v.nodes.length,
          ejemplo: v.nodes.slice(0, 2).map((n) => n.html.slice(0, 110)),
          objetivo: v.nodes[0] ? v.nodes[0].target.join(" ") : "",
        })),
        pases: res.passes.length,
      };
    });
    console.log(`\n=== ${nombre} ===`);
    if (!r.violaciones.length) {
      console.log("  0 violaciones. (" + r.pases + " reglas pasaron)");
    }
    for (const v of r.violaciones) {
      console.log(`  [${v.impacto || "sin impacto"}] ${v.id} x${v.nodos} — ${v.ayuda}`);
      console.log(`      dónde: ${v.objetivo}`);
      if (CONSEJOS[v.id]) console.log(`      qué es: ${CONSEJOS[v.id]}`);
      v.ejemplo.forEach((e) => console.log(`      ej.: ${e}`));
    }
    await ctx.close();
    return r.violaciones;
  };

  const todas = [];
  todas.push(...(await correr("landing · movil")));
  todas.push(
    ...(await correr("ingreso · movil", async (p) => {
      await p.evaluate(() => {
        location.hash = "#login";
      });
      await p.waitForSelector("#ie", { timeout: 20000 });
      await p.waitForTimeout(800);
    })),
  );
  todas.push(
    ...(await correr("panel del dueño · movil", async (p) => {
      const env = {};
      fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8")
        .split(/\r?\n/)
        .forEach((l) => {
          const i = l.indexOf("=");
          if (i < 1 || l.trim().startsWith("#")) return;
          const k = l.slice(0, i).trim();
          if (!env[k]) env[k] = l.slice(i + 1).trim();
        });
      await p.evaluate(() => {
        location.hash = "#login";
      });
      await p.waitForSelector("#ie", { timeout: 20000 });
      await p.fill("#ie", env.DUENO_EMAIL);
      await p.fill("#ip", env.DUENO_PASSWORD);
      await p.click('[data-act="entrar"]');
      await p.waitForTimeout(14000);
    })),
  );

  await b.close();

  /* Resumen: cuántos elementos tocan cada problema. */
  const por = new Map();
  for (const v of todas) por.set(v.id, (por.get(v.id) || 0) + v.nodos);
  console.log("\n" + "=".repeat(62));
  if (!todas.length) {
    console.log("SIN violaciones de accesibilidad en las tres pantallas.");
  } else {
    console.log("Resumen (elementos afectados):");
    [...por.entries()].sort((a, b) => b[1] - a[1]).forEach(([id, n]) => console.log("  " + String(n).padStart(4) + "  " + id + " — " + (CONSEJOS[id] || "")));
    console.log("\nTotal de elementos con problemas: " + [...por.values()].reduce((a, b) => a + b, 0));
    fallos = por.size;
  }
  process.exit(fallos ? 1 : 0);
})();