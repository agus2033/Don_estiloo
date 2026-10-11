/* Localiza los botones con fondo real cuyo texto no llega a 4.5:1.
   tokens.claro.js los cuenta pero no dice cuál es; este los nomea con su
   selector y su texto para poder arreglarlos. */
const { chromium } = require("../.opencode/skills/playwright-skill/node_modules/playwright/index.js");

const lum = (r, g, b) => {
  const f = (v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => {
  const [x, y] = [lum(...a), lum(...b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};
const parse = (s) => {
  const t = String(s || "").trim();
  const hx = t.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hx) {
    const h = hx[1].length === 3 ? hx[1].split("").map((c) => c + c).join("") : hx[1];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  const cs = t.match(/color\(\s*srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/i);
  if (cs) return [+cs[1] * 255, +cs[2] * 255, +cs[3] * 255];
  const n = (t.match(/[\d.]+/g) || [0, 0, 0]).slice(0, 3).map(Number);
  return n;
};
const hex = (r) => "#" + r.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

(async () => {
  const browser = await chromium.launch();
  for (const theme of ["light", "dark"]) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.addInitScript((t) => localStorage.setItem("theme", t), theme);
    await page.goto("http://127.0.0.1:8765/index.html", { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".lb", { timeout: 20000 });
    await page.waitForTimeout(3000);

    const datos = await page.evaluate(() =>
      [...document.querySelectorAll("button, .marca .volver, header nav .on")]
        .map((b) => {
          const cs = getComputedStyle(b);
          const r = b.getBoundingClientRect();
          return {
            sel: b.tagName.toLowerCase() + (b.id ? "#" + b.id : "") + (b.className && typeof b.className === "string" ? "." + b.className.trim().split(/\s+/).join(".") : ""),
            texto: (b.textContent || "").trim().slice(0, 24),
            bg: cs.backgroundColor, fg: cs.color, fontSize: cs.fontSize, weight: cs.fontWeight,
            area: Math.round(r.width * r.height),
          };
        })
        .filter((b) => /rgb/.test(b.bg) && b.bg !== "rgba(0, 0, 0, 0)")
        /* Sin texto no hay contraste de texto que medir. Los puntos del
           carrusel (26x4px) son formas; su color lo hereda del body y da
           falsos negativos. Los indicadores no textuales se miden contra el
           fondo del contenedor, no contra su propio "color". */
        .filter((b) => b.texto.length > 0),
    );

    console.log(`\n=== ${theme.toUpperCase()} · ${datos.length} con fondo y texto ===`);
    for (const d of datos) {
      const r = ratio(parse(d.fg), parse(d.bg));
      /* Texto grande (>=18.66px bold o >=24px) sólo pide 3:1. */
      const grande = parseFloat(d.fontSize) >= 24 || (parseFloat(d.fontSize) >= 18.66 && +d.weight >= 700);
      const min = grande ? 3 : 4.5;
      const ok = r >= min;
      console.log(`  ${ok ? "OK  " : "FALLA"} ${r.toFixed(2).padStart(5)} (min ${min}) ${hex(parse(d.fg))} sobre ${hex(parse(d.bg))}  ${d.sel.slice(0, 58)}  "${d.texto}"`);
    }
    await page.close();
  }
  await browser.close();
})();
