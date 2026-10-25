/* Lote 50: el pulgar de goma en la barra de fichas del panel (pedido del
   dueño: "que la pestaña activa viaje con goma, como el filtro de Mis
   Turnos"). Cambios:
   1. main.js: R() inyecta UN span .nav-th antes de las fichas (solo si hay
      fichas: el nav vacío se apaga con :empty) y nvTh() lo pinta sobre la
      ficha activa, botón por botón (los anchos de escritorio NO son
      iguales). La posición de la ficha activa VIEJA se mide antes del
      innerHTML y le llega a nvTh() como punto de partida: así el viaje se
      ve aunque la fila se reconstruya entera en cada repintado.
   2. main.js: listener de resize — al cambiar el tamaño (o rotar el celu)
      la fila se recalcula y el pulgar se recalibra sin animación.
   3. styles.css: .nav-th absoluto con la curva del RubberSegment (300ms,
      cubic-bezier(0.23,1,0.32,1), misma del .seg-th del lote 44), +
      .nav-th--pau (primer pintado sin animación, no barre desde 0,0) +
      prefers-reduced-motion.
   4. styles.css: el TINTE de "nav .on" pasa al pulgar en las 4 superficies
      (celular/escritorio × oscuro/claro); el botón queda sin fondo y el
      texto dorado sigue en .on. Los botones van ENCIMA (z-index).
   5. styles.css: el corte de la bandeja pasa de nth-child(n+4) a n+5 — el
      span del pulgar es el primer hijo y sin el ajuste escondía la ficha
      en la cuarta ranura (la sonda del lote lo encontró en vivo).
   Corruptela conocida: el translate ancla en la CAJA DE PADDING del nav y
   los rects miden desde el borde — en celular hay 3px de borde dorado y
   se restan con clientTop/clientLeft (la sonda midió el corrimiento).
   La sonda manual de navegador va en tests/nv-probe.js (sólo manual:
   necesita servidor 8765 y sesión del dueño, y saca capturas).
   Uso:  node tests\lote50.js
   En run.js: fila 'lote50' (después de 'lote49'). */
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
const rn = lee("tests/run.js");

/* ---- 1. la inyección del span en R() ---- */
ok(
  /navE\.innerHTML = nv \? `<span class="nav-th" aria-hidden="true"><\/span>` \+ nv : nv;/.test(mj),
  "R(): el span .nav-th entra sólo si hay fichas (el :empty del nav sobrevive)",
);
ok(/aria-hidden="true"/.test((mj.match(/<span class="nav-th"[^>]*>/) || [""])[0]), "el span es decorativo (aria-hidden)");
ok(/const navAntes = \(\(\) => \{/.test(mj), "R(): mide la ficha activa vieja ANTES del innerHTML");
ok(/nvTh\(navAntes\);/.test(mj), "R(): le pasa el punto de partida a nvTh()");

/* ---- 2. nvTh() ---- */
ok(/function nvTh\(desde\) \{/.test(mj), "nvTh(): existe y acepta punto de partida");
ok(/nav\.querySelector\("button\.on"\)/.test(mj), "nvTh(): busca la ficha activa al vuelo");
ok(/!act \|\| !act\.getClientRects\(\)\.length/.test(mj), "nvTh(): ficha activa escondida (bandeja) apaga el pulgar");
ok(/th\.style\.opacity = "0";/.test(mj), "nvTh(): el apagado es por opacity (el elemento queda en el DOM)");
ok(/nav\.clientTop/.test(mj) && /nav\.clientLeft/.test(mj), "nvTh(): resta el borde del nav (3px de dorado en celular)");
ok(/Math\.round\(r\.width\)/.test(mj) && /Math\.round\(r\.height\)/.test(mj), "nvTh(): mide ancho y alto reales del botón activo");
ok(/nav-th--pau/.test(mj), "nvTh(): el primer pintado va sin animación");
ok(/th\.offsetHeight; \/\* el reflow congela el punto de partida \*\//.test(mj), "nvTh(): reflow entre punto de partida y destino");
ok(/window\.addEventListener\("resize", \(\) => nvTh\(\)\);/.test(mj), "resize recalibra el pulgar");

/* ---- 3. las reglas del pulgar en styles.css ---- */
const th = (ss.match(/\.nav-th \{[\s\S]*?\n\}/) || [""])[0];
ok(/position: absolute/.test(th) && /pointer-events: none/.test(th) && /z-index: 0/.test(th), "styles: .nav-th absoluto, no-interceptable y debajo de los botones");
ok(/opacity: 0/.test(th), "styles: .nav-th arranca apagado (lo prende nvTh)");
ok(
  /transform 300ms cubic-bezier\(0\.23, 1, 0\.32, 1\)/.test(th),
  "styles: la curva de goma es la del .seg-th del lote 44 (300ms)",
);
ok(/\.nav-th--pau \{[\s\S]*?transition: none;/.test(ss), "styles: .nav-th--pau corta la transición");
ok(
  /@media \(prefers-reduced-motion: reduce\) \{\s*\.nav-th \{\s*transition: none;\s*\}\s*\}/.test(ss),
  "styles: prefers-reduced-motion apaga el viaje",
);
ok(
  /nav button \{[\s\S]*?position: relative;\s*z-index: 1;/.test(ss),
  "styles: los botones van encima del pulgar (z-index 1)",
);

/* ---- 4. las 4 superficies del tinte ---- */
/* celular oscuro: el bloque que antes pintaba .on al 18% ahora pinta el pulgar */
ok(
  /nav \.on \{[^}]*box-shadow: none;\s*border-radius: 14px;\s*margin: 6px 8px;\s*min-height: 48px;\s*\}\s*#nav \.nav-th \{[^}]*background: color-mix\(in srgb, var\(--brass\) 18%, transparent\);\s*border-radius: 14px;/.test(ss),
  "celular oscuro: el tinte 18% va en el pulgar, el .on quedó sin fondo",
);
ok(!/nav \.on \{[^}]*background: color-mix\(in srgb, var\(--brass\) 18%/.test(ss), "celular oscuro: el .on ya no lleva background");
/* escritorio oscuro (min-width: 860px) */
ok(
  /#nav \.nav-th \{\s*border-radius: 6px;\s*background: color-mix\(in srgb, var\(--brass\) 16%, var\(--bg\)\);\s*\}/.test(ss),
  "escritorio oscuro: el tinte 16% sobre --bg va en el pulgar (radius 6px)",
);
ok(!/nav \.on \{[^}]*background: color-mix\(in srgb, var\(--brass\) 16%/.test(ss), "escritorio oscuro: el .on ya no lleva background");
/* claro celular: el dorado claro clavado, porque --brass de claro (#7d621b)
   sobre la barra oscura quedaba ilegible */
ok(
  /body\[data-theme="light"\] #nav \.nav-th \{\s*background: color-mix\(in srgb, #c9a24b 18%, transparent\);\s*border-radius: 14px;/.test(ss),
  "claro celular: tinte clavado #c9a24b 18% (la barra es oscura en los dos temas)",
);
/* claro escritorio */
ok(
  /body\[data-theme="light"\] #nav \.nav-th \{\s*background: color-mix\(in srgb, var\(--brass\) 10%, transparent\);\s*border-radius: 6px;/.test(ss),
  "claro escritorio: el tinte 10% va en el pulgar",
);
ok(
  !/body\[data-theme="light"\] header #nav button\.on \{[^}]*background:/.test(ss),
  "claro: los dos .on de la barra ya no llevan background",
);

/* ---- 5. el corte de la bandeja ---- */
ok(
  /#nav\.nav-mas3 > button:not\(\.nav-mas\):nth-child\(n \+ 5\) \{/.test(ss) && !/nth-child\(n \+ 4\)/.test(ss),
  "bandeja: el corte pasa de nth-child(n+4) a n+5 (el pulgar es el primer hijo)",
);

/* ---- 6. paridad con los demás lotes ---- */
ok(/data-act="go"/.test(mj), "las fichas siguen pasando por data-act=go (delegación intacta)");
ok(/\.seg-th \{/.test(ss), "el .seg-th del lote 44 sigue vivo (referencia de la curva)");
ok(/lote49/.test(rn) && /lote50/.test(rn), "run.js tiene la fila lote50 después de lote49");

console.log("  " + okn + " comprobaciones de lote50");
