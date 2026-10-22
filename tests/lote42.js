/* Lote 42, 43 y 44: los arreglos y las novedades de la tandas del 21/10/26.
   Son comprobaciones de CÓDIGO (no de pantalla), porque todas las piezas son
   de server state o de reglas, no de CSS visual:

   1. Reglas: "Reprogramar" ya no rebota — el update de un turno pendiente
      acepta las claves del servicio (s/sid/sn/sp/sm) y valida el formato
      de fecha y hora como el create. Con la lista vieja el write entraba
      SIEMPRE con permission-denied (el dueño lo probó publicado).
   2. Reglas: colección "borrados" para el anti-bucle de puntos.
   3. Panel del barbero en Finanzas: el editor de porcentajes sólo lo ve el
      dueño (el comentario lo prometía; el código no lo cumplía).
   4. Registro: nombre obligatorio, teléfono OPCIONAL.
   5. Borrar cuenta: el documento del perfil se BORRA (antes quedaba con
       "borrado: true" ocupando la lista de clientes para siempre) y las
       reseñas quedan con el nombre anonimizado.
   6. Avatar del header: el LOGO de la barbería cuando no hay foto (antes la
      inicial de la cuenta, que el dueño pidió reemplazar).
   7. Botones de las tarjetas de turno: fila .chips.dos, dos columnas
      iguales con el mismo estilo (Inicio y Mis Turnos quedan iguales).
   8. El aviso de permission-denied ya no dice "guardar" siempre: con un
      snapshot de lectura fallado (el caso del barbero al entrar a Agenda
      con reglas viejas) decía una mentira.

   Uso:  node tests\lote42.js
   En run.js: fila 'lote42' (después de 'mapa').
*/
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

/* ---------- 1. reglas: reprogramar ---------- */
const rules = lee("FIRESTORE_RULES.txt");
/* La lista del update pendiente tiene que incluir las claves del servicio.
   No se pega la lista entera hardcodeada: se busca que contenga las CINCO
   claves nuevas dentro del bloque del update de turnos. */
const upd = (rules.match(/match \/turnos\/\{[^]{0,20000}/) || [""])[0];
for (const k of ["'s'", "'sid'", "'sn'", "'sp'", "'sm'"])
  ok(
    upd.includes(k),
    "reglas: update de turnos pendientes acepta la clave " + k,
    "no aparece en el bloque de /turnos",
  );
ok(
  /request\.resource\.data\.t\.matches\('[^]*hasOnly\(\['d', 't', 'bid', 'bl', 'st', 'mot', 'por', 'canEn',\n\s+'s', 'sid', 'sn', 'sp', 'sm'\]/.test(upd) ||
    (upd.includes("t.matches") && upd.includes("'sm']")),
  "reglas: el update pendiente valida el formato de fecha y hora",
);
ok(
  !/hasOnly\(\['d', 't', 'bid', 'bl', 'st', 'mot', 'por', 'canEn'\]\)/.test(rules),
  "reglas: ya no queda la lista VIEJA de claves del update pendiente",
);

/* ---------- 2. reglas: borrados ---------- */
ok(/match \/borrados\/\{id\}/.test(rules), 'reglas: existe /borrados/{id}');
ok(
  /allow get: if isSignedIn\(\);[\s\S]{0,120}allow list: if isOwner\(\);/.test(rules),
  "reglas: borrados se lee por get con sesión, se lista sanción sólo al dueño",
  "el get y el list tienen que quedar en ese orden y sin read=> if isSignedIn() sangriento",
);
ok(
  /allow create: if isSignedIn\(\) && request\.resource\.data\.t is number[\s\S]{0,80}hasOnly\(\['t'\]\)/.test(rules),
  "reglas: el documento de borrados sólo lleva la marca de fecha",
  "con las reglas actuales", );

/* ---------- 3. Finanzas del barbero: editor oculto ---------- */
const mj = lee("src/main.js");
ok(
  /own && fe\s/.test(mj),
  "Finanzas: el editor de porcentajes queda detrás de own (sólo dueño)",
  "con las reglas: barra de UBICACIÓN de own",
);

/* ---------- 4. registro: teléfono opcional ---------- */
ok(/Teléfono \(opcional\)/.test(mj), "registro: la etiqueta del teléfono dice (opcional)");
ok(
  /if \(ph\.length && \(ph\.length < 8 \|\| ph\.length > 15\)\)/.test(mj),
  "registro: el teléfono vacío pasa la validación",
  "sólo se valida si vino algo escrito",
);

/* ---------- 5. borrar cuenta ---------- */
ok(
  /b\.delete\(doc\(db, "users", me\.uid\)\)/.test(mj),
  "borrar cuenta: el documento del perfil se borra de verdad",
  "antes quedaba borrado:true en la lista de clientes de por vida",
);
ok(
  mj.includes('doc(db, "borrados", sh)'),
  "borrar cuenta: queda la marca SHA-256 del email (anti-bucle de puntos)",
);
ok(
  mj.includes('resenas"), where("uid", "==", me.uid)'),
  "borrar cuenta: las reseñas propias se anonimizan",
);
ok(/shaEm = async/.test(mj), "borrar cuenta: existe el helper shaEm de SHA-256");
ok(
  /pt0 = PTSRv[\s\S]{0,600}borrados"/.test(mj) || /borrados", sh\)\);[\s\S]{0,200}pt0 = 0/.test(mj) ||
    /marcada\.exists\(\)\) pt0 = 0/.test(mj),
  "registro: el chequeo de cuenta borrada pone los puntos en 0",
);

/* ---------- 6. avatar con logo ---------- */
ok(
  /medE\.innerHTML = fotoHd[\s\S]{0,400}esc\(LOGO\)/.test(mj),
  "avatar: sin foto de perfil muestra el LOGO, no la inicial",
);

/* ---------- 7. botones iguales en las tarjetas de turno ---------- */
const stl = lee("src/styles.css");
ok(/\.chips\.dos\s*\{/.test(stl), "css: existe .chips.dos (dos columnas iguales)");
const dosFila = (mj.match(/class="chips dos"/g) || []).length;
ok(dosFila >= 2, "botones de turno: inicio y mis turnos usan .chips.dos", dosFila + " filas");

/* ---------- 8. aviso de permission-denied honesto ---------- */
ok(
  /"permission-denied":[\s\S]{0,120}leer ni guardar/.test(mj),
  "aviso: permission-denied menciona leer O guardar (el barbero con reglas viejas falla en LECTURA)",
);
ok(
  /no dejaron leer o guardar/.test(mj),
  "aviso: motivoFirestore cubre el caso de lectura",
);

/* ---------- 9. lote 44: filtros de Mis Turnos (radiogroup + flechas) ---------- */
ok(/tfil = "prox"/.test(mj), "estado tfil inicial en 'prox' (default: próximos)");
ok(
  /\["prox", "pas", "can"\]\.includes\(k\)/.test(mj),
  "acción tFil valida las tres opciones (no acepta cualquier string)",
);
ok(
  /tFil\(k\) \{[\s\S]{0,400}cx = null;/.test(mj),
  "tFil limpia el formulario de cancelación al cambiar de filtro",
  "si no, el formulario de cancelar queda flotando en otra lista",
);
ok(
  /class="seg" role="radiogroup"/.test(mj),
  "markup: el filtro es role=radiogroup (teclado + lectores de pantalla)",
);
ok(
  /role="radio" aria-checked="\$\{tfil === o\[0\]\}"/.test(mj),
  "markup: cada opción es radio con aria-checked dinámico",
);
ok(
  /seg-th" style="transform:translateX\(\$\{i \* 100\}%\)"/.test(mj),
  "markup: el thumb viaja con translateX (nada de recalcular px por página)",
);
ok(
  /ArrowRight[\s\S]{0,300}seg-b/.test(mj),
  "teclado: las flechas mueven el filtro (.click() al botón destino)",
);
const st44 = lee("src/styles.css");
ok(
  /\.seg-th\s*\{[\s\S]{0,800}cubic-bezier/.test(st44),
  "css: el thumb va con bezier tipo resorte (rubber)",
);
ok(
  /@media \(prefers-reduced-motion: reduce\)[\s\S]{0,300}\.seg-th\s*\{\s*transition: none;/.test(st44),
  "css: reduced-motion apaga la animación del thumb",
);
ok(
  /\.seg-b\s*\{[\s\S]{0,300}height: 44px;/.test(st44),
  "css: opciones de filtro de 44px (regla táctil del proyecto)",
);
ok(
  /data-act="tFil"/.test(mj),
  "markup: los botones del filtro disparan data-act=tFil",
);

console.log("  ---");
console.log("  total: " + okn + " comprobaciones OK");
