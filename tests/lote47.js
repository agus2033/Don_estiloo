/* Lote 47: las tarjetas de servicios alinean textos entre sí ("alinear los
   textos y que se vean igual", pedido literal del dueño). Cambios:
   1. Las tarjetas sin foto ganan un hueco del MISMO bloque 4/5 (dice
      "Sin foto"): sin eso, la fila tenía títulos empezando a alturas
      distintas y pies a alturas distintas.
   2. El hueco es honesto: no finge imagen, la declara con aria-label.
   La prueba visual del navegador está en tests/sv-paridad.js (fixture con
   landing.css real) y tests/servicios-foto.js (base real, manual).
   Uso:  node tests\lote47.js
   En run.js: fila 'lote47' (después de 'lote46').  */
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

/* el hueco existe: la rama sin img pinta el span de paridad */
ok(
  /lb-sv-img lb-sv-falta" role="img" aria-label="Servicio sin foto"/.test(mj),
  "template: la tarjeta sin foto pinta el hueco de paridad con su aria-label",
);
/* la rama CON imagen quedó igual de siempre (sin width/height attrs: el
   aspect-ratio de CSS es el que manda; un attr height lo pisa) */
ok(
  !/lb-sv-img" src="\$\{imgCld\(esc\(x\.img\), 800\)\}" alt="" loading="lazy" decoding="async" width=/.test(mj),
  "template: la foto real NO lleva attrs de tamaño (pisarían el aspect-ratio)",
);

const lc = lee("src/landing.css");

/* el hueco comparte la caja de imagen y es interactivo-nulo */
ok(
  /\.lb-sv-falta\s*\{[\s\S]{0,400}background: var\(--lb-ivory\);/.test(lc),
  "css: el hueco es marfil (misma familia del bloque ATIENDE de las fichas)",
);
ok(
  /\.lb-sv-falta small\s*\{[\s\S]{0,200}font-size: 0\.8rem;/.test(lc),
  "css: 'Sin foto' a 0.8rem (12.8px), encima del piso de 12px",
);
/* la alineación de la fila la sostiene lo que ya existía: bd flex 1 */
ok(
  /\.lb-sv-bd\s*\{[\s\S]{0,400}flex: 1;/.test(lc),
  "css: el cuerpo de la tarjeta sigue estirando (flex: 1) para clavar el pie",
);

/* ---------- 2. el flake del foco al cerrar el modal de políticas ----------
   En dos corridas de la suite, politicas marcó ROJO en "el foco vuelve al
   link que abrió" (solo corría verde siempre): si la pantalla se repinta
   mientras el modal está abierto, el nodo guardado de openPol queda
   desconectado y focus() a un nodo suelto no hace nada. cerrarPol ahora
   re-busca el link vivo y visible como plan B. */
ok(
  /const guardado = polRetorno;\s*\n\s*polRetorno = null;[\s\S]{0,900}isConnected/.test(mj),
  "cerrarPol: comprueba que el nodo del opener siga vivo (isConnected) antes de darle el foco",
);
ok(
  /querySelectorAll\('\[data-act="openPol"\]'\)/.test(mj),
  "cerrarPol: plan B = re-buscar el link vivo y visible de openPol",
);

console.log("  ---");
console.log("  total: " + okn + " comprobaciones OK");
