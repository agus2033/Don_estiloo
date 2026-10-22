/* Lote 45: el toggle claro/oscuro ahora es un SquishSwitch (versión vanilla
   del componente que mandó el dueño). Comprobaciones de CÓDIGO (fs, sin
   navegador):

   1. src/ssw.js existe y es el módulo de la mecánica (drag, flick,
      pointercancel, teclado por click detail===0, aria-checked).
   2. main.js lo monta con el estado de SIEMPRE (localStorage "theme" +
      body[data-theme]), aplicando el tema cacheado ANTES del primer pintado.
   3. index.html conserva el id/aria-label y el ORDEN casita-toggle-foto;
      el texto fijo ☀︎ desapareció (ahora son svg aria-hidden).
   4. styles.css tiene el track/knob/squish y apaga la animación con
      prefers-reduced-motion; el bloque duplicado del #thm viejo ya no está.
   5. landing.css: el track en claro queda marfil (--bg), NO blanco puro.

   Uso:  node tests\lote45.js
   En run.js: fila 'lote45' (después de 'lote42').  */
const fs = require("fs");
const path = require("path");

let okn = 0;
const ok = (cond, msg, extra) => {
  if (cond) {
    okn++;
    console.log("  OK    " + msg);
  } else {
    console.log("  FALLA " + msg + (extra ? "  -> " + extra : ""));
    process.exitCode = 1;
  }
};
const lee = (f) => {
  try {
    return fs.readFileSync(path.join(__dirname, "..", f), "utf8");
  } catch (e) {
    return "";
  }
};

/* ---------- 1. el módulo ssw ---------- */
const ssw = lee("src/ssw.js");
ok(/export function sswMontar/.test(ssw), "existe src/ssw.js con sswMontar exportado");
ok(ssw.length > 0 && /pointerdown/.test(ssw) && /pointermove/.test(ssw) && /pointerup/.test(ssw), "mecánica: pointer down/move/up (drag de verdad)");
ok(/pointercancel/.test(ssw), "mecánica: pointercancel suelta sin cambiar el estado");
ok(/e\.detail !== 0/.test(ssw), "teclado: el flip por teclado entra por click con detail === 0");
ok(/setAttribute\("aria-checked"/.test(ssw), "a11y: el estado pinta aria-checked");
ok(/setPointerCapture/.test(ssw), "drag: captura el puntero (no se escapa del botón)");
ok(/ssw-kn--pre/.test(ssw) && /ssw-kn--voz/.test(ssw), "squish: clases de aplastado y rebote");
ok(/Math\.max\(\s*0/.test(ssw), "drag: el knob no se va del track (clamp)");

/* ---------- 2. montaje en main.js ---------- */
const mj = lee("src/main.js");
ok(/import \{ sswMontar \} from "\.\/ssw\.js";/.test(mj), "main.js importa el módulo");
ok(
  /const cur = localStorage\.getItem\("theme"\);\s*\n\s*if \(cur\) document\.body\.dataset\.theme = cur;/.test(mj),
  "montaje: el tema cacheado se aplica ANTES del primer pintado (sin parpadeo)",
);
ok(/sswMontar\(btn, \{/.test(mj) && /onChange: \(claro\) =>/.test(mj), "montaje: sswMontar con onChange que sincroniza");
ok(/localStorage\.setItem\("theme", claro \? "light" : ""\)/.test(mj), "montaje: persiste 'theme' como siempre");
ok(!/btn\.textContent = cur === "light"/.test(mj), "nada queda del glyph fijo ☀︎ viejo en texto");

/* ---------- 3. markup en index.html ---------- */
const ix = lee("index.html");
ok(
  ix.indexOf('id="web"') < ix.indexOf('id="thm"') && ix.indexOf('id="thm"') < ix.indexOf('id="mebadge"'),
  "orden intacto: casita - toggle - foto (exigido por header.js)",
);
ok(/role="switch" aria-checked="false" aria-label="Cambiar tema claro oscuro"/.test(ix), "markup: role=switch + aria-label intacto");
ok(/span class="ssw-kn"/.test(ix), "markup: el knob está adentro del botón");
ok(/ssw-ico--luna/.test(ix) && /ssw-ico--sol/.test(ix), "markup: sol y luna como svg");
ok(!/>☀/.test(ix), "markup: ya no hay ☀︎ de texto suelto");

/* ---------- 4. CSS ---------- */
const st = lee("src/styles.css");
ok(
  (st.match(/#thm\s*\{/g) || []).length <= 1 && (st.match(/#thm\{/g) || []).length === 0,
  "css: el bloque duplicado del #thm viejo ya no existe",
);
ok(/\.ssw-kn\s*\{[\s\S]{0,400}border-radius: 999px/.test(st), "css: knob pill 26px");
ok(/\.ssw-kn--pre\s*\{/.test(st), "css: clase de squish al apretar");
ok(/\.ssw-kn--voz-fuerte\s*\{/.test(st), "css: rebote fuerte para el flick rápido");
ok(
  /@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\.ssw-kn\s*\{\s*transition: none;/.test(st),
  "css: reduced-motion apaga la animación del switch",
);
const lc = lee("src/landing.css");
ok(
  /body\[data-theme="light"\] #thm\s*\{[\s\S]{0,120}background: var\(--bg\);/.test(lc),
  "landing.css: track claro = marfil (--bg), nunca blanco puro (lo mide landing.tema.js)",
);

console.log("  ---");
console.log("  total: " + okn + " comprobaciones OK");
