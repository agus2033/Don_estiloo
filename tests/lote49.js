/* Lote 49: el toggle claro/oscuro de la LANDING pasa a ser el MISMO
   SquishSwitch del header de la app (pedido del dueño confirmado: "Sí,
   mismo switch en la landing"). Cambios:
   1. #lbTema: sin data-act (el switch es el dueño del estado), con
      role="switch" + knob (.ssw-kn) que lleva los dos íconos — same de #thm.
   2. styles.css: las reglas del track se comparten #thm, #lbTema.
   3. landing.css: el círculo de 48px y el fade de íconos (.lb-ico-*) se
      fueron; queda el flex + el track marfil en claro (lección del 45).
   4. lbMontarTema(): montaje en cada repintado (el innerHTML reconstruye
      el botón), con guard para llamadas dobles.
   5. ACT.lbTema queda DORMIDO (lote25 corta lbReservar con esa función
      como límite: no puede borrarse).
   La sonda manual de navegador va en tests/lbtema-probe.js (sólo manual:
   compra el clic real del switch contra la base viva).
   Uso:  node tests\lote49.js
   En run.js: fila 'lote49' (después de 'lote48'). */
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

const mj = lee("src/main.js");
const ss = lee("src/styles.css");
const lc = lee("src/landing.css");
const rn = lee("tests/run.js");

/* 1. la plantilla del toggle */
const bloque = (mj.match(/<button class="lb-tema" id="lbTema"[\s\S]*?<\/button>/) || [""])[0];
ok(
  /role="switch" aria-checked="false"/.test(bloque) && !/data-act/.test(bloque),
  "plantilla: #lbTema es un switch sin data-act (el estado lo lleva sswMontar)",
);
ok(/class="ssw-kn"/.test(bloque) && /ssw-ico--luna/.test(bloque) && /ssw-ico--sol/.test(bloque), "plantilla: knob con los dos íconos");
ok(
  /aria-label="Cambiar entre tema claro y oscuro"/.test(bloque),
  "plantilla: el aria-label del toggle queda igual (screen reader estable)",
);

/* 2. las reglas compartidas del track */
const track = (ss.match(/#thm,\n#lbTema \{/) || [""])[0];
ok(!!track, "styles: el track 64x34 se comparte entre #thm y #lbTema");
ok(
  /#thm\[data-on="0"\] \.ssw-ico--sol,\n#lbTema\[data-on="0"\] \.ssw-ico--sol \{/.test(ss),
  "styles: la visibilidad luna/sol por estado también es compartida",
);
ok(
  /#thm:focus-visible,\n#lbTema:focus-visible \{/.test(ss) && /#thm\[data-on="1"\],\n#lbTema\[data-on="1"\] \{/.test(ss),
  "styles: foco visible y borde dorado del estado claro, en ambos switches",
);

/* 3. landing.css: se fue el círculo y el fade; queda el marfil en claro */
const temaBlq = (lc.match(/\.lb-tema \{[\s\S]*?\n\}/) || [""])[0];
ok(
  !/48px/.test(temaBlq) && !/display: grid/.test(temaBlq),
  "landing.css: el círculo de 48px del .lb-tema se fue (el track lo pone styles.css)",
);
ok(!/\blb-ico-(sol|luna)\b/.test(lc), "landing.css: fade de íconos fuera — ahora manda ssw-ico por estado");
ok(
  /body\[data-theme="light"\] \.lb-tema \{\s*\n\s*background: var\(--bg\);/.test(lc),
  "landing.css: en claro el track va marfil, no blanco puro (lección del lote 45)",
);
ok(/\.lb-tema \{\s*\n\s*flex: 0 0 auto;/.test(lc), "landing.css: el toggle sigue sin encoger en la fila del header");

/* 4. el montaje */
ok(
  /function lbMontarTema\(\) \{[\s\S]{0,320}btn\.dataset\.ssw = "1";[\s\S]{0,520}inicial: document\.body\.dataset\.theme === "light",[\s\S]{0,420}localStorage\.setItem\("theme", claro \? "light" : ""\);/.test(mj),
  "lbMontarTema: guard contra doble montaje + contrato de #thm (body[data-theme] + localStorage)",
);
ok(/setupReveal\(\);\s*\n\s*lbMontarTema\(\);\s*\n\s*footer\(\);/.test(mj), "R(): el montaje cuelga del post-pintado, junto al mapa y al reveal");

/* 5. el handler dormido (lote25 lo usa de límite de corte) */
ok(
  /lbTema\(\) \{[\s\S]{0,1000}const next = document\.body\.dataset\.theme === "light" \? "" : "light";/.test(mj),
  "ACT.lbTema dormido pero presente (lote25 lo usa como límite de corte)",
);

/* fila en la suite */
ok(/"lote49"/.test(rn), "run.js: la fila 'lote49' está en la suite");

console.log("  ---\n  total: " + okn + " comprobaciones OK");
