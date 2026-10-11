/* Mide los tokens del tema claro REALES en el navegador: el bloque de la
   línea ~2350 de styles.css (restos de una landing vieja) vuelve a definir
   --bg/--mut/--brass/… DESPUÉS del bloque canónico de la línea ~24, y como
   tiene la misma especificidad, gana el último. Este script verifica cuál
   gana de verdad y qué contraste queda. */
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
/* Los tokens custom salen de getComputedStyle como "#F5F0E6" (hex de 6),
   no como rgb(). El parse de landing.audit.js sólo handles rgba()/color(),
   así que hay que cubrir hex a mano o los canales salen mal y el ratio es
   basura (NaN o 1.03). */
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
const hex = (rgb) =>
  "#" + rgb.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

/* Tokens tal como los declara cada bloque del CSS.
   CANONICO es el bloque de cabecera de styles.css (el que manda).
   TARDIO es lo que definía el bloque .lnd-* de la landing vieja, ya
   borrado: se conserva acá para que el test avise si vuelve a aparecer. */
const CANONICO = { bg: "#f5f0e6", card: "#ffffff", ink: "#141c26", mut: "#55637a", line: "#dcd4c2", brass: "#7d621b" };
const TARDIO = { bg: "#F5F0E6", mut: "#5B6B7F", line: "#D8DEE8", brass: "#D4A84B", blue: "#2F5C9E" };

(async () => {
  const browser = await chromium.launch();
  let fails = 0;
  const chk = (c, t, e) => {
    console.log(`  ${c ? "OK  " : "FALLA"} ${t}${e ? "  -> " + e : ""}`);
    if (!c) fails++;
  };

  /* --- 1. tokens del panel: oscuro y claro --- */
  for (const theme of ["light", "dark"]) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.addInitScript((t) => localStorage.setItem("theme", t), theme);
    await page.goto("http://127.0.0.1:8765/index.html", { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".lb", { timeout: 20000 });
    await page.waitForTimeout(3000);

    const real = await page.evaluate(() => {
      const cs = getComputedStyle(document.body);
      const g = (k) => cs.getPropertyValue(k).trim();
      return {
        theme: document.body.dataset.theme,
        bg: g("--bg"), card: g("--card"), ink: g("--ink"), mut: g("--mut"),
        line: g("--line"), brass: g("--brass"), brassFill: g("--brassFill"), blue: g("--blue"),
      };
    });

    console.log(`\n=== TOKENS DEL PANEL (${theme}) ===`);
    console.log(JSON.stringify(real));

    const bg = parse(real.bg), card = parse(real.card), ink = parse(real.ink),
      mut = parse(real.mut), brass = parse(real.brass), fill = parse(real.brassFill);
    /* El texto de los botones dorados NO es var(--ink): es #141c26 fijo,
       porque tiene que quedar oscuro encima del dorado en los dos temas.
       Por eso el contraste de la superficie se mide contra ese color y no
       contra --ink (que en oscuro es marfil y daría un falso negativo). */
    const sobreOro = parse("#141c26");

    console.log(`\n--- contraste (${theme}) ---`);
    /* Tinta sobre superficies: el mínimo es 4.5 para texto normal.
       El dorado como texto y el dorado como fondo se miden por separado,
       porque son dos tokens distintos justamente para eso. */
    chk(ratio(ink, bg) >= 4.5, "--ink sobre --bg", ratio(ink, bg).toFixed(2));
    chk(ratio(ink, card) >= 4.5, "--ink sobre --card", ratio(ink, card).toFixed(2));
    chk(ratio(mut, bg) >= 4.5, "--mut sobre --bg", ratio(mut, bg).toFixed(2));
    chk(ratio(mut, card) >= 4.5, "--mut sobre --card", ratio(mut, card).toFixed(2));
    chk(ratio(brass, bg) >= 4.5, "--brass (texto) sobre --bg", ratio(brass, bg).toFixed(2));
    chk(ratio(brass, card) >= 4.5, "--brass (texto) sobre --card", ratio(brass, card).toFixed(2));
    chk(ratio(sobreOro, fill) >= 4.5, "#141c26 sobre --brassFill (superficie)", ratio(sobreOro, fill).toFixed(2));

    /* Y de verdad: los botones dorados que hay en pantalla ahora mismo. */
    const botones = await page.evaluate(() =>
      [...document.querySelectorAll("button, .marca .volver, header nav .on")]
        .map((b) => ({ cs: getComputedStyle(b), t: (b.textContent || "").trim().slice(0, 18) }))
        .filter((b) => /rgb/.test(b.cs.backgroundColor) && b.cs.backgroundColor !== "rgba(0, 0, 0, 0)")
        /* Sin texto no hay contraste que medir: el punto del carrusel
           (.lb-car-punto, 26x4px) es una forma, no una etiqueta. Medirlo
           daba un falso negativo porque su color lo hereda del body. */
        .filter((b) => b.t.length > 0 || b.cs.backgroundImage !== "none")
        .slice(0, 40)
        .map((b) => ({ t: b.t, bg: b.cs.backgroundColor, fg: b.cs.color })),
    );
    const mal = [];
    for (const b of botones) {
      const r = ratio(parse(b.fg), parse(b.bg));
      if (r < 4.5) mal.push(`"${b.t}" ${hex(parse(b.fg))}/${hex(parse(b.bg))}=${r.toFixed(2)}`);
    }
    chk(mal.length === 0, `los ${botones.length} botones con fondo real pasan 4.5:1`, mal.join(" | "));

    /* En claro el bloque tardío de la landing vieja pisaba los tokens del
       panel. Si vuelve a aparecer, --brass tiene que volver a ser el
       canónico, no el #D4A84B de aquél. */
    if (theme === "light") {
      console.log(`\n--- ¿gana el bloque canónico de tokens? (${theme}) ---`);
      const cmp = [
        ["bg", CANONICO.bg], ["mut", CANONICO.mut], ["line", CANONICO.line], ["brass", CANONICO.brass],
      ];
      cmp.forEach(([k, canonico]) => {
        const r = String(real[k] || "").toLowerCase();
        const pisado = TARDIO[k] && r === String(TARDIO[k]).toLowerCase();
        chk(r === String(canonico).toLowerCase(), `--${k} sigue el valor canonico (${canonico})`, `en vivo=${r}${pisado ? "  <-- PISA EL BLOQUE TARDIO" : ""}`);
      });
      /* Y el tardío ya no debe existir en el CSS. */
      const sigue = await page.evaluate(() =>
        [...document.styleSheets].some((sh) => {
          try {
            return [...sh.cssRules].some((r) => r.selectorText === 'body[data-theme="light"]' && /#D4A84B/i.test(r.style.getPropertyValue("--brass")));
          } catch (e) {
            return false;
          }
        }),
      );
      chk(!sigue, "no queda ninguna regla que redefina los tokens del panel", sigue ? "sigue presente" : "");
    }
    await page.close();
  }

  await browser.close();
  console.log(`\n${fails} fallo(s)`);
  process.exit(fails ? 1 : 0);
})();
