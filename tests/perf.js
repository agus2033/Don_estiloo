/* Línea base de rendimiento: Core Web Vitals y recursos, medidos con el
   navegador de verdad. No inventa nada: lee del PerformanceObserver.

   Uso:  node tests\perf.js [url]
*/
const { chromium } = require("../.opencode/skills/playwright-skill/node_modules/playwright/index.js");
const path = require("path");
const fs = require("fs");

const URL = process.argv[2] || "http://127.0.0.1:8765/index.html";

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();

  /* Todo lo que se descarga, con su peso. */
  const recursos = [];
  page.on("response", async (r) => {
    try {
      const h = r.headers();
      const len = Number(h["content-length"] || 0);
      recursos.push({ url: r.url().replace(URL, ""), tipo: r.request().resourceType(), bytes: len, estado: r.status() });
    } catch (e) {}
  });
  const peticiones = [];
  page.on("requestfailed", (r) => peticiones.push({ url: r.url(), error: r.failure() && r.failure().errorText }));
  const errores = [];
  page.on("console", (m) => m.type() === "error" && errores.push(m.text().slice(0, 160)));
  page.on("pageerror", (e) => errores.push("pageerror: " + String(e).slice(0, 160)));

  /* Las métricas de pintura y layout se capturing desde antes de cargar. */
  await page.addInitScript(() => {
    window.__cwv = { lcp: 0, cls: 0, shifts: [] };
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) {
        window.__cwv.lcp = e.startTime;
        window.__cwv.lcpEl = e.element ? e.element.nodeName + "." + (e.element.className || "") : "?";
      }
    }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) {
        if (!e.hadRecentInput) {
          window.__cwv.cls += e.value;
          if (e.value > 0.001)
            window.__cwv.shifts.push({
              v: +e.value.toFixed(4),
              nodos: (e.sources || []).map((s) => (s.node ? s.node.nodeName + "." + (s.node.className || "") : "?")),
            });
        }
      }
    }).observe({ type: "layout-shift", buffered: true });
    /* First Input Delay aproximado: lo más temprano que se registra una
       interacción real. Con INP no hay interacción en una carga limpia, así
       que se mide la latencia del primer evento. */
    window.__inp = 0;
    ["pointerdown", "keydown"].forEach((ev) =>
      addEventListener(ev, (e) => {
        const d = performance.now() - (e.timeStamp || performance.now());
        if (d > window.__inp) window.__inp = d;
      }, { capture: true, passive: true }),
    );
  });

  const t0 = Date.now();
  await page.goto(URL, { waitUntil: "load" });
  const cargaMs = Date.now() - t0;
  await page.waitForSelector(".lb-wcard", { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(4000);

  const m = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0] || {};
    const fcp = performance.getEntriesByName("first-contentful-paint")[0];
    const cls = window.__cwv.cls;
    /* Qué elemento es el LCP. Importa para leer el número: si LCP sube y el
       elemento es el mapa, el problema es el mapa; si es un texto, es otra
       cosa. */
    const lcpEl = window.__cwv.lcpEl;
    /* Los terceros, que son los que se pueden quitar. */
    const res0 = performance.getEntriesByType("resource");
    const terceros = res0.filter((r) => !r.name.includes("127.0.0.1"));
    const propio = res0.filter((r) => r.name.includes("127.0.0.1"));
    /* Peso realmente transferido (lo que dice Resource Timing). */
    const res = performance.getEntriesByType("resource");
    const peso = res.reduce((a, r) => a + (r.transferSize || 0), 0);
    const decodificado = res.reduce((a, r) => a + (r.decodedBodySize || 0), 0);
    const porTipo = {};
    for (const r of res) {
      const t = r.initiatorType || "otra";
      porTipo[t] = (porTipo[t] || 0) + (r.transferSize || 0);
    }
    return {
      fcp: fcp ? Math.round(fcp.startTime) : null,
      lcp: Math.round(window.__cwv.lcp),
      cls: +cls.toFixed(4),
      shifts: window.__cwv.shifts.slice(0, 6),
      inp: Math.round(window.__inp),
      domContentLoaded: Math.round(nav.domContentLoadedEventEnd || 0),
      load: Math.round(nav.loadEventEnd || 0),
      recursos: res.length,
      pesoKB: Math.round(peso / 1024),
      decodificadoKB: Math.round(decodificado / 1024),
      porTipo,
      fuentes: res.filter((r) => r.initiatorType === "css" || /\.woff/.test(r.name)).length,
      nodo: document.querySelectorAll("*").length,
      scripts: document.querySelectorAll("script").length,
      lcpEl: window.__cwv.lcpEl || null,
      terceroKB: Math.round(terceros.reduce((a, r) => a + (r.decodedBodySize || 0), 0) / 1024),
      propioKB: Math.round(propio.reduce((a, r) => a + (r.decodedBodySize || 0), 0) / 1024),
      tercerosN: terceros.length,
      peticionesMaps: res0.filter((r) => /maps|google\.com\/maps/.test(r.name)).length,
    };
  });

  /* Los archivos que más pesan. */
  const pesados = recursos.filter((r) => r.bytes > 0).sort((a, b) => b.bytes - a.bytes).slice(0, 12);

  const kb = (n) => Math.round(n / 1024) + " KB";
  console.log("=== CARGA (" + URL + ") ===");
  console.log("  FCP ................ " + m.fcp + " ms");
  console.log("  LCP ................ " + m.lcp + " ms");
  console.log("  CLS ................ " + m.cls);
  console.log("  INP (1er evento) ... " + m.inp + " ms");
  console.log("  DOMContentLoaded ... " + m.domContentLoaded + " ms");
  console.log("  load ................ " + m.load + " ms   (medido por Playwright: " + cargaMs + " ms)");
  console.log("  recursos ............ " + m.recursos);
  console.log("  peso transferido .... " + kb(m.pesoKB * 1024));
  console.log("  peso descomprimido .. " + kb(m.decodificadoKB * 1024));
  console.log("  nodos DOM ........... " + m.nodo);
  console.log("  <script> ............. " + m.scripts);
  console.log("  elemento LCP ......... " + m.lcpEl);
  console.log("  peso propio .......... " + kb(m.propioKB * 1024));
  console.log("  peso de terceros ..... " + kb(m.terceroKB * 1024) + "  (" + m.tercerosN + " peticiones)");
  console.log("  peticiones al mapa ... " + m.peticionesMaps);
  console.log("\n=== peso por tipo ===");
  for (const [k, v] of Object.entries(m.porTipo).sort((a, b) => b[1] - a[1])) console.log("  " + k.padEnd(14) + kb(v));

  console.log("\n=== archivos más pesados ===");
  for (const r of pesados) console.log("  " + kb(r.bytes).padStart(10) + "  " + r.estado + "  " + r.url.slice(0, 64));

  if (m.shifts.length) {
    console.log("\n=== saltos de layout (CLS) ===");
    for (const s of m.shifts) console.log("  +" + s.v + "  " + s.nodos.slice(0, 2).join(", "));
  }
  if (peticiones.length) {
    console.log("\n=== peticiones fallidas ===");
    for (const p of peticiones.slice(0, 8)) console.log("  " + p.error + "  " + p.url.slice(0, 70));
  }
  if (errores.length) {
    console.log("\n=== errores de consola ===");
    for (const e of errores.slice(0, 8)) console.log("  " + e);
  }

  await b.close();
})();
