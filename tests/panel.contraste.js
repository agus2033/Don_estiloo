/* Recorre el PANEL (no la landing) en modo claro y oscuro y reporta cada
   texto que no llega a 4.5:1 contra su fondo real.

   Éste es el método que sirve para el pendiente #1 de CONTINUAR.md: en vez
   de contar colores crudos en el CSS —que da falsos positivos— se mide lo
   que se ve. Reglas:
     - el fondo se busca subiendo por los ancestros hasta el primero opaco;
     - los textnodes se miden con el color del elemento que los contiene;
     - texto grande (>=24px, o >=18.66px en negrita) sólo pide 3:1.

   Usa las credenciales de .env.local, como landing.login.js. */
const { chromium } = require("../.opencode/skills/playwright-skill/node_modules/playwright/index.js");
const fs = require("fs");
const path = require("path");

function envLocal() {
  const p = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(p)) return {};
  const o = {};
  fs.readFileSync(p, "utf8").split(/\r?\n/).forEach((l) => {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) o[m[1]] = m[2].replace(/^["']|["']$/g, "");
  });
  return o;
}

const parse = (s) => {
  const t = String(s || "").trim();
  const hx = t.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hx) {
    const h = hx[1].length === 3 ? hx[1].split("").map((c) => c + c).join("") : hx[1];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  const cs = t.match(/color\(\s*srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/i);
  if (cs) return [+cs[1] * 255, +cs[2] * 255, +cs[3] * 255];
  const n = (t.match(/[-\d.]+/g) || [0, 0, 0, 1]).map(Number);
  return [n[0], n[1], n[2], n.length > 3 ? n[3] : 1];
};
const lum = ([r, g, b]) => {
  const f = (v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
/* Compone el fondo real: si el ancestro es semitransparente, se mezcla con
   el de abajo. Sin esto, un rgba(0,0,0,.42) midió como si fuera negro. */
const sobre = (fg, bg) => fg.map((c, i) => fg[3] === undefined ? c : c * fg[3] + bg[i] * (1 - fg[3]));
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};
const hex = (r) => "#" + r.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

/* Se ejecuta dentro de la página: no puede usar closures de Node. */
const MEDIR = () => {
  const P = (s) => {
    const t = String(s || "").trim();
    const hx = t.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (hx) {
      const h = hx[1].length === 3 ? hx[1].split("").map((c) => c + c).join("") : hx[1];
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1];
    }
    const cs = t.match(/color\(\s*srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/i);
    if (cs) return [+cs[1] * 255, +cs[2] * 255, +cs[3] * 255, 1];
    const n = (t.match(/[-\d.]+/g) || [0, 0, 0, 1]).map(Number);
    return [n[0], n[1], n[2], n.length > 3 ? n[3] : 1];
  };
  const comp = (fg, bg) => [0, 1, 2].map((i) => fg[i] * fg[3] + bg[i] * (1 - fg[3]));
  const L = ([r, g, b]) => {
    const f = (v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const R = (a, b) => {
    const [x, y] = [L(a), L(b)].sort((m, n) => n - m);
    return (x + 0.05) / (y + 0.05);
  };
  const hx = (c) => "#" + c.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

  const fondoReal = (el) => {
    const capas = [];
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      const cs = getComputedStyle(n);
      /* Un gradient no está en backgroundColor: se queda transparente y el
         cálculo sube al ancestro, midiendo el texto contra el color de la
         página y dando 1:1 (falso negativo). Se toma el último color del
         gradient como representative, que para estos degradados
         (180deg, dos paradas) es el de abajo: el más oscuro. */
      if (cs.backgroundImage && cs.backgroundImage !== "none") {
        const paradas = (cs.backgroundImage.match(/rgba?\([^)]+\)/g) || []).map(P).filter((c) => c[3] > 0);
        if (paradas.length) {
          const oscura = paradas.reduce((a, b) => (L(b) < L(a) ? b : a));
          capas.push(oscura);
          continue;
        }
      }
      const c = P(cs.backgroundColor);
      if (c[3] > 0) {
        capas.push(c);
        if (c[3] === 1) break;
      }
    }
    let base = [255, 255, 255, 1];
    for (let i = capas.length - 1; i >= 0; i--) base = comp(capas[i], base);
    return base;
  };

  const out = [];
  const raiz = document.getElementById("app") || document.body;
  for (const el of raiz.querySelectorAll("*")) {
    /* Sólo hojas de texto propio: si el texto viene de un hijo, lo mide el
       hijo. Evita duplicar el mismo texto 4 veces. */
    const propios = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).filter(Boolean);
    if (!propios.length) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none" || +cs.opacity === 0) continue;
    /* Que el ELEMENTO esté visible no alcanza: si un ancestro tiene
       display:none, el hijo sigue reportando display:inline y se medía
       markup del panel de login que seguía en el DOM después de entrar.
       checkVisibility() sube la cadena de ancestros. */
    if (typeof el.checkVisibility === "function" && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const fg = P(cs.color);
    if (fg[3] === 0) continue;
    const bg = fondoReal(el);
    const cr = R(comp(fg, bg), bg);
    const fs = parseFloat(cs.fontSize);
    const grande = fs >= 24 || (fs >= 18.66 && +cs.fontWeight >= 700);
    const min = grande ? 3 : 4.5;
    if (cr < min) {
      out.push({
        sel: el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (typeof el.className === "string" && el.className.trim() ? "." + el.className.trim().split(/\s+/).slice(0, 3).join(".") : ""),
        texto: propios.join(" ").slice(0, 40),
        fg: hx(fg), bg: hx(bg), r: +cr.toFixed(2), min, fs: cs.fontSize, peso: cs.fontWeight,
      });
    }
  }
  /* Deduplicar por selector+color: el mismo defecto en 8 celdas es uno. */
  const seen = new Set();
  return out.filter((x) => {
    const k = x.sel + "|" + x.fg + "|" + x.bg;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

(async () => {
  const env = envLocal();
  /* Mismos nombres que landing.login.js: <ROL>_EMAIL / <ROL>_PASSWORD. */
  const ROL = {
    cliente: [env.CLIENTE_EMAIL, env.CLIENTE_PASSWORD],
    barbero: [env.BARBERO_EMAIL, env.BARBERO_PASSWORD],
    dueno: [env.DUENO_EMAIL, env.DUENO_PASSWORD],
  };
  if (!ROL.dueno[0] || !ROL.dueno[1]) {
    console.log("Faltan DUENO_EMAIL / DUENO_PASSWORD en .env.local.");
    process.exit(0);
  }
  const browser = await chromium.launch();
  let total = 0;

  for (const [rol, [email, pass]] of Object.entries(ROL)) {
    if (!email || !pass) continue;
    for (const theme of ["light", "dark"]) {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await ctx.newPage();
      await page.addInitScript((t) => localStorage.setItem("theme", t), theme);
      await page.goto("http://127.0.0.1:8765/index.html", { waitUntil: "domcontentloaded" });
      await page.waitForSelector(".lb-wcard", { timeout: 25000 });
      await page.waitForTimeout(1200);
      /* Mismo dance que landing.login.js: hay dos "Ingresar" (header y panel
         móvil cerrado), así que se usa el que está visible y, si no hay
         ninguno, el hash "#login" — no "#/reservar", que el router no
         abre. */
      const visible = page.locator('[data-act="goLogin"]:visible');
      if (await visible.count()) await visible.first().click();
      else await page.evaluate(() => { location.hash = "#login"; });
      await page.waitForSelector("#ie", { timeout: 15000 });
      await page.fill("#ie", email);
      await page.fill("#ip", pass);
      await page.click('[data-act="entrar"]');
      await page.waitForTimeout(5000);

      const fallos = await page.evaluate(MEDIR);
      console.log(`\n=== ${rol} / ${theme} · ${fallos.length} texto(s) bajo el mínimo ===`);
      fallos.forEach((f) => console.log(`  ${String(f.r).padStart(5)} (min ${f.min})  ${f.fg} sobre ${f.bg}  ${f.fs}/${f.peso}  ${f.sel.slice(0, 46)}  "${f.texto}"`));
      total += fallos.length;
      await ctx.close();
    }
  }
  await browser.close();
  console.log(`\n${total} en total`);
})();
