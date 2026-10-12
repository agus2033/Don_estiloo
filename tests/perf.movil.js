/* Mide la carga de la landing en un móvil emulado y dice QUÉ pesa.

   No inventa un puntaje de Lighthouse ni de PageSpeed: mide bytes y tiempos
   en localhost con Chrome, y los contrasta con lo que el dueño vio en su
   informe (60 de rendimiento en móvil). Sirve para saber dónde mirar.

   node tests\perf.movil.js
*/
const { chromium } = require("../.opencode/skills/playwright-skill/node_modules/playwright/index.js");

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();

  const por = new Map();
  page.on("response", async (r) => {
    try {
      const u = new URL(r.url());
      const b64 = r.headers()["content-length"];
      const body = await r.body().catch(() => null);
      const bytes = body ? body.length : Number(b64 || 0);
      const k = u.origin + u.pathname;
      por.set(k, (por.get(k) || 0) + bytes);
    } catch {}
  });

  const t0 = Date.now();
  await page.goto("http://127.0.0.1:8765/index.html", { waitUntil: "load" });
  const tLoad = Date.now() - t0;

  await page.waitForSelector(".lb-wcard", { timeout: 30000 });
  await page.waitForTimeout(6000);

  const m = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0];
    const paints = performance.getEntriesByType("paint").map((p) => [p.name, Math.round(p.startTime)]);
    /* Los recursos que bloquean el primer pintado. */
    const bloqueo = performance
      .getEntriesByType("resource")
      .filter((r) => ["script", "stylesheet", "link"].includes(r.initiatorType))
      .map((r) => ({ n: r.name.split("/").pop().slice(0, 42), t: Math.round(r.duration), s: r.transferSize }))
      .sort((a, b) => b.s - a.s);
    return {
      domContentLoaded: Math.round(nav.domContentLoadedEventEnd),
      load: Math.round(nav.loadEventEnd),
      firstContentfulPaint: (paints.find((p) => p[0] === "first-contentful-paint") || [])[1],
      firstInputDelayProxy: (paints.find((p) => p[0] === "first-paint") || [])[1],
      nodos: document.querySelectorAll("*").length,
      imgs: document.querySelectorAll("img").length,
      imgsSinAlt: document.querySelectorAll("img:not([alt])").length,
      recursos: bloqueo.slice(0, 14),
      totalRecursos: performance.getEntriesByType("resource").length,
    };
  });

  const filas = [...por.entries()].sort((a, b) => b[1] - a[1]);
  const total = filas.reduce((a, x) => a + x[1], 0);

  console.log("=== tiempos (localhost, móvil emulado) ===");
  console.log(`  load                    ${m.load} ms`);
  console.log(`  DOMContentLoaded       ${m.domContentLoaded} ms`);
  console.log(`  first-contentful-paint ${m.firstContentfulPaint} ms`);
  console.log(`  first-paint            ${m.firstInputDelayProxy} ms`);
  console.log(`  (esperado total, con red de verdad: mucho más)`);
  console.log(`\n=== peso ===`);
  console.log(`  ${m.totalRecursos} recursos, ${(total / 1024).toFixed(0)} KB descargados`);
  console.log(`  ${m.nodos} nodos en el DOM, ${m.imgs} imágenes`);
  console.log("\n  los 12 más pesados:");
  filas.slice(0, 12).forEach(([k, v]) => console.log(`   ${(v / 1024).toFixed(1).padStart(8)} KB  ${k.slice(0, 78)}`));

  console.log("\n=== scripts y hojas de estilo ===");
  m.recursos.forEach((r) => console.log(`   ${String(r.s).padStart(7)} B  ${String(r.t).padStart(5)} ms  ${r.n}`));

  await b.close();
})();