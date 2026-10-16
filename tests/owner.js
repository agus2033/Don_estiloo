/* El dueño se cambia en DOS lugares: en `src/config.js` (que decide qué se ve en
   el panel) y en `FIRESTORE_RULES.txt` (que decide qué se puede escribir en la
   base, y además hay que publicarla en la consola de Firebase).

   Con uno solo de los dos cambiados no hay un error limpio: pasa una de estas dos
   cosas, y las dos son confusas para el dueño.

     - Se cambia sólo el de config.js: la persona nueva entra, ve el panel de
       cliente, no le sale el nombre del barbero ni las fotos, y no hay ningún
       mensaje que diga por qué.
     - Se cambia sólo el de las reglas: la persona ve el panel entero de dueño y
       cada guardar rebota con `permission-denied`.

   Esta prueba compara los dos y falla si se separan, para que se vea ANTES de
   publicar.

     node tests\owner.js
*/
const fs = require("fs");
const path = require("path");

const raiz = path.join(__dirname, "..");
const leer = (f) => fs.readFileSync(path.join(raiz, f), "utf8");

let fallos = 0;
const ok = (c, m, d) => {
  console.log((c ? "  OK    " : "  FALLA ") + m);
  if (!c) {
    fallos++;
    if (d) console.log("          " + d);
  }
};

/* Los tres tienen que ser EL MISMO string, con la misma forma. */
const uidConfig = (leer("src/config.js").match(/export const ADMIN_UID = "([^"]+)"/) || [])[1];
const uidOwner = (leer("src/config.js").match(/export const OWNER_UID = ADMIN_UID/) || [])[0];
const uidRegla = (leer("FIRESTORE_RULES.txt").match(/function isOwner\(\)[^\n]*request\.auth\.uid == '([^']+)'/) || [])[1];

console.log("=== los tres lugares donde vive el UID del dueño ===");
console.log("  src/config.js  ADMIN_UID       " + (uidConfig || "(no está)"));
console.log("  src/config.js  OWNER_UID       " + (uidOwner || "(no está)"));
console.log("  FIRESTORE_RULES.txt  isOwner()  " + (uidRegla || "(no está)"));

ok(!!uidConfig, "config.js tiene ADMIN_UID");
ok(!!uidRegla, "FIRESTORE_RULES.txt tiene el UID en isOwner()");
ok(
  !!uidConfig && !!uidRegla && uidConfig === uidRegla,
  "los dos UID son el MISMO",
  "config=" + uidConfig + "  reglas=" + uidRegla,
);
ok(
  !!uidOwner,
  "y OWNER_UID es ADMIN_UID (no hay dos dueños distintos en el código)",
);

/* Los dos tienen que tener la misma forma: los de Firebase son 28 caracteres
   alfanuméricos. Un UID pegado con espacios, o con comillas distintas, rompe en
   silencio: la función de las reglas compila pero nunca da true. */
/* Los dos archivos tienen el texto partido entre líneas con espacios al
   principio: "la consola de\n  Firebase" no encuentra "consola de Firebase".
   Se aplana el espacio antes de buscar, porque lo que importa es que la frase
   esté escrita, no dónde quedó el salto de línea. */
const plano = (s) => s.replace(/\s+/g, " ");
const forma = (u) => !!u && /^[A-Za-z0-9]{28}$/.test(u);
ok(forma(uidConfig), "el UID de config.js tiene la forma de un UID de Firebase", String(uidConfig));
ok(forma(uidRegla), "y el de las reglas también", String(uidRegla));

/* Y tiene que quedar escrito CÓMO se cambia, porque un número suelto en un
   archivo no se entiende a los seis meses. */
const conf = leer("src/config.js");
const regla = leer("FIRESTORE_RULES.txt");
ok(
  /CAMBIAR QUIEN ES EL DUE\u00D1O/i.test(plano(conf)) && plano(conf).indexOf("FIRESTORE_RULES.txt") > 0,
  "config.js dice que hay que cambiarlo también en las reglas",
);
ok(
  /CAMBIAR QUIEN ES EL DUE\u00D1O/i.test(plano(regla)) && plano(regla).indexOf("src/config.js") > 0,
  "y las reglas dicen que hay que cambiarlo también en config.js",
);
ok(
  /PUBLICAR/i.test(plano(conf)) && /consola de firebase/i.test(plano(regla)),
  "los dos avisos dicen que las reglas hay que publicarlas en la consola, no sólo tocarlas",
);

/* El dueño puede ser el barbero, pero eso NO es un permiso: es una bandera en
   la lista de barberos. Si alguien lo cambiara de acá, rompería el modelo. */
ok(
  /ADMIN_UID[\s\S]{0,600}no se decide ac[aá]|NO se decide ac[aá]/.test(conf) ||
    /Que el dueño sea adem[aá]s el barbero NO se decide/.test(conf),
  "config.js aclara que ser barbero NO se decide con el UID",
);
ok(
  !/admin.*barbero.*staff|staff.*admin/gi.test(conf.slice(0, 40)),
  "y el bloque del ADMIN_UID no mezcla el tema del barbero",
);

console.log(fallos ? `\nFALLARON ${fallos}` : "\nTODO VERDE");
process.exit(fallos ? 1 : 0);