/* Contraste AA del asistente con el modal abierto, en los pasos que
   tienen color de estado (3 calendario, 4 turno, 5 horarios). */
const path = require("path");
const { chromium } = require("../.opencode/skills/playwright-skill/node_modules/playwright");

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
  const t = String(s || "");
  /* color-mix() y color() devuelven "color(srgb 0.9 0.87 0.80)": los
     canales van de 0 a 1, no de 0 a 255. Sin esto la auditoría reporta
     contrastes falsos. */
  const cs = t.match(/color\(\s*srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/i);
  if (cs) return [+cs[1] * 255, +cs[2] * 255, +cs[3] * 255];
  const n = (t.match(/[\d.]+/g) || [0, 0, 0]).slice(0, 3).map(Number);
  return n;
};

(async () => {
  const b = await chromium.launch();
  const fallos = [];
  let total = 0;

  for (const theme of ["dark", "light"]) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    const p = await ctx.newPage();
    await p.addInitScript((t) => localStorage.setItem("theme", t), theme);
    await p.goto("http://127.0.0.1:8765/index.html", { waitUntil: "domcontentloaded" });
    await p.waitForSelector(".lb-wcard");
    await p.waitForTimeout(1400);
    await p.click('[data-act="wzAbrir"]');
    await p.waitForTimeout(400);

    const sels = {
      1: [".wz-item-t b", ".wz-item-t small", ".lb-price", ".wz-mini", ".wz-btn--pri", ".wz-btn--ghost", ".wz-x"],
      2: [".wz-item-t b", ".wz-btn--pri"],
      3: [".wz-cal-top b", ".wz-nav", ".wz-dows span", ".wz-cel.libre", ".wz-cel.cerrado", ".wz-leyenda .p"],
      4: [".wz-turno b", ".wz-turno small", ".wz-turno em"],
      5: [".wz-hora", ".wz-hora.oc", ".wz-ocupadas"],
      6: [".wz-sum span", ".wz-sum b", ".wz-pol", ".wz-aviso", ".wz-btn--pri"],
    };

    for (const paso of [1, 2, 3, 4, 5, 6]) {
      // avanzar explícitamente hasta el paso pedido
      const next = async () => {
        await p.click(".wz-pie .wz-btn--pri");
        await p.waitForTimeout(400);
      };
      if (paso === 2) {
        await p.click(".wz-item:not(.on)");
        await p.waitForTimeout(150);
        await next();
      }
      if (paso === 3) {
        await p.click(".wz-item:not(.on)");
        await p.waitForTimeout(150);
        await next();
        await p.waitForTimeout(1000); // carga la disponibilidad del mes
      }
      if (paso === 4) {
        await p.click(".wz-cel.libre");
        await p.waitForTimeout(200);
        await next();
      }
      if (paso === 5) {
        await p.click(".wz-turno:not(.off)");
        await p.waitForTimeout(200);
        await next();
      }
      if (paso === 6) {
        await p.click(".wz-hora:not(.oc)");
        await p.waitForTimeout(200);
        await next();
      }
      const muestras = await p.evaluate((sels) => {
        const bgOf = (el) => {
          let n = el;
          while (n && n !== document.documentElement) {
            const b = getComputedStyle(n).backgroundColor;
            if (b && b !== "rgba(0, 0, 0, 0)" && b !== "transparent") return b;
            n = n.parentElement;
          }
          return getComputedStyle(document.body).backgroundColor;
        };
        return sels
          .map((s) => {
            const el = document.querySelector(s);
            if (!el) return null;
            const cs = getComputedStyle(el);
            return { sel: s, size: parseFloat(cs.fontSize), weight: cs.fontWeight, fg: cs.color, bg: bgOf(el) };
          })
          .filter(Boolean);
      }, sels[paso]);

      for (const m of muestras) {
        total++;
        const grande = m.size >= 24 || (m.size >= 18.66 && Number(m.weight) >= 700);
        const min = grande ? 3 : 4.5;
        const r = ratio(parse(m.fg), parse(m.bg));
        if (r < min) fallos.push({ theme, paso, sel: m.sel, r: +r.toFixed(2), min });
      }
      if (paso === 1 && theme === "dark") {
        const w = await p.$(".wz-sheet");
        await w.screenshot({ path: path.join(__dirname, "..", "tmp_shots", "WZ-AUDIT-paso1.png") });
      }
      if (paso === 5 && theme === "light") {
        const w = await p.$(".wz-sheet");
        await w.screenshot({ path: path.join(__dirname, "..", "tmp_shots", "WZ-AUDIT-paso5-light.png") });
      }
    }
    await ctx.close();
  }
  await b.close();
  console.log(`=== ASISTENTE: ${total} muestras, ${fallos.length} fallos ===`);
  fallos.forEach((f) => console.log("  FALLA", JSON.stringify(f)));
})();
