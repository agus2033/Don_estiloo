/* Lote 46: el header del asistente (Stepper del dueño adaptado).
   Comprobaciones de código (fs, sin navegador):

   1. El paso YA PASADO muestra un check dorado en vez del número
      (.wz-paso.he b). El paso ACTIVO conserva su número: los tests y las
      matrices de panel lo leen (.wz-paso.on b).
   2. Sin animaciones de entrada en el header: se repinta en cada
      selección dentro del paso y una keyframe se re-ejecutaría en cada
      repintado (los checks "saltarían" al tocar un día).
   3. El mini de celular nombra el paso (títulos ocultos en ese ancho).
   4. El markup del header no cambió de otra cosa: dos classes de estado
      ("on", "he") y aria-current="step" intactos.

   Uso:  node tests\lote46.js
   En run.js: fila 'lote46' (después de 'lote45').  */
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

/* el check: condicional en el template del número */
ok(
  /<b>\$\{WZ\.paso > n \? "✓" : n\}<\/b>/.test(mj),
  "stepper: el número muta en check ('✓') cuando el paso ya pasó",
);
/* el check NO reemplaza al paso activo (los tests leen .wz-paso.on b) */
ok(
  /class="wz-paso\$\{WZ\.paso === n \? " on" : ""\}\$\{WZ\.paso > n \? " he" : ""\}"/.test(mj),
  "stepper: las clases on/he quedan como estaban",
);
ok(/aria-current="step"/.test(mj), "stepper: aria-current=step se mantiene");

/* mini de celular con nombre del paso actual */
ok(
  /<p class="wz-mini">Paso \$\{WZ\.paso\} de 6 · \$\{WZ_PASOS\[WZ\.paso - 1\]\[1\]\}<\/p>/.test(mj),
  "mini: en celular el texto nombra el paso actual (los títulos están ocultos ahí)",
);

/* css del check y su razón */
const lc = lee("src/landing.css");
ok(
  /\.wz-paso\.he b\s*\{\s*color: var\(--lb-brass\);/.test(lc),
  "css: el check del paso pasado va dorado",
);
ok(
  /SIN animación de entrada/.test(lc) && /re-ejecuta/.test(lc),
  "css: el comentario explica por qué el check no entra animado",
);
/* el pop animado NO debe haberse agregado por accidente */
ok(
  !/@keyframes wzPop/.test(lc),
  "css: no quedó una keyframe de pop que se repita en cada repintado",
);

/* estado total: 6 pasos con nombre (no cambió la lista) */
ok(
  /WZ_PASOS = \[\s*\[1, "Servicio"\],\s*\[2, "Barbero"\],\s*\[3, "Día"\],\s*\[4, "Turno"\],\s*\[5, "Horario"\],\s*\[6, "Resumen"\],\s*\]/.test(mj),
  "lista de pasos intacta (6, con sus nombres)",
);

console.log("  ---");
console.log("  total: " + okn + " comprobaciones OK");
