/* Comprueba el comportamiento del mapa, que es lo que cambió.

   La medición de peso total no servía para probar este cambio: con
   `loading="lazy"` el navegador a veces pide el mapa pronto y a veces no,
   según el umbral y la velocidad, así que el número de KB fluctúa entre
   corridas sin que cambie el código. Lo que sí es estable y lo que importa es
   la PREGUNTA: ¿se pide el mapa antes de que el usuario llegue a la sección?

   Se mide en tres momentos:
     1. recién cargar, sin scrollear;
     2. después de 6 segundos quieto;
     3. después de scrollear hasta la sección.

   Se corre dos veces, en los dos estados del iframe, y se imprime el cuadro.

   Uso:  node tests\mapa.js
*/
const { chromium } = require("../.opencode/skills/playwright-skill/node_modules/playwright/index.js");
const fs = require("fs");
const path = require("path");

const MAIN = path.join(__dirname, "..", "src", "main.js");
const original = fs.readFileSync(MAIN, "utf8");
const NUEVO = 'data-src="${esc(MAP_IFRAME)}"';
const VIEJO = 'src="${esc(MAP_IFRAME)}"';

const estado = async (page) => {
  const s = await page.evaluate(() => {
    const f = document.querySelector(".lb-map iframe");
    return {
      tieneSrc: !!f && !!f.getAttribute("src"),
      tieneData: !!f && !!f.getAttribute("data-src"),
      pedido: performance
        .getEntriesByType("resource")
        .filter((r) => /maps\.googleapis|google\.com\/maps/.test(r.name)).length,
    };
  });
  return s;
};

const correr = async (b, etq) => {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto("http://127.0.0.1:8765/index.html", { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".lb-wcard", { timeout: 30000 });
  await page.waitForTimeout(700);

  const t0 = await estado(page);
  await page.waitForTimeout(6000);
  const t6 = await estado(page);

  /* Scrollear hasta la sección: ahí el mapa tiene que aparecer SÍ O SÍ. */
  await page.evaluate(() => {
    const m = document.querySelector(".lb-map");
    if (m) m.scrollIntoView({ block: "center" });
  });
  await page.waitForTimeout(3000);
  const tScroll = await estado(page);

  console.log("\n== " + etq + " ==");
  console.log("  al cargar .............. src=" + t0.tieneSrc + "  peticiones al mapa=" + t0.pedido);
  console.log("  a los 6 s quieto ...... src=" + t6.tieneSrc + "  peticiones al mapa=" + t6.pedido);
  console.log(
    "  tras scrollear ........ src=" +
      tScroll.tieneSrc +
      "  peticiones al mapa=" +
      tScroll.pedido,
  );
  await ctx.close();
  return { t0, t6, tScroll };
};

(async () => {
  const b = await chromium.launch();
  try {
    fs.writeFileSync(MAIN, original.replace(NUEVO, VIEJO), "utf8");
    await correr(b, "ANTES (el iframe trae src y loading=lazy)");
    fs.writeFileSync(MAIN, original, "utf8");
    const nuevo = await correr(b, "AHORA (el iframe trae data-src y un observer)");
    console.log("\n" + "-".repeat(58));
    const ok = nuevo.t6.pedido === 0 && nuevo.tScroll.tieneSrc;
    console.log(
      ok
        ? "OK   quieto NO se pide el mapa; al llegar a la sección, sí se ve"
        : "FALLA quieto se piden " + nuevo.t6.pedido + " y al llegar tiene src=" + nuevo.tScroll.tieneSrc,
    );
    process.exitCode = ok ? 0 : 1;
  } finally {
    fs.writeFileSync(MAIN, original, "utf8");
    await b.close();
    console.log("src/main.js restaurado: " + (fs.readFileSync(MAIN, "utf8") === original ? "sí" : "NO"));
  }
})();