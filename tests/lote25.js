/* Lote 25: las correcciones que pidió el dueño en un solo archivo.

   node tests\lote25.js
*/
const { chromium } = require("../.opencode/skills/playwright-skill/node_modules/playwright/index.js");
const fs = require("fs");
const path = require("path");

const env = {};
fs
  .readFileSync(path.join(__dirname, "..", ".env.local"), "utf8")
  .split(/\r?\n/)
  .forEach((l) => {
    const i = l.indexOf("=");
    if (i < 1 || l.trim().startsWith("#")) return;
    const k = l.slice(0, i).trim();
    if (!env[k]) env[k] = l.slice(i + 1).trim();
  });

let fallos = 0;
const ok = (c, m, d) => {
  console.log((c ? "  OK    " : "  FALLA ") + m);
  if (!c) {
    fallos++;
    if (d) console.log("          " + d);
  }
};

async function entrar(b, email, pass, ancho = 1400) {
  const ctx = await b.newContext({ viewport: { width: ancho, height: 1000 } });
  const page = await ctx.newPage();
  const jsErr = [];
  page.on("pageerror", (e) => jsErr.push(String(e).slice(0, 110)));
  await page.goto("http://127.0.0.1:8765/index.html", { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".lb-wcard", { timeout: 30000 });
  await page.waitForTimeout(1400);
  await page.evaluate(() => {
    location.hash = "#login";
  });
  await page.waitForSelector("#ie", { timeout: 20000 });
  await page.fill("#ie", email);
  await page.fill("#ip", pass);
  await page.click('[data-act="entrar"]');
  await page.waitForTimeout(14000);
  return { ctx, page, jsErr };
}

(async () => {
  /* ---------- 1. cosas que se comprueban leyendo el código ---------- */
  console.log("=== 1. en el código ===");
  const src = fs.readFileSync(path.join(__dirname, "..", "src", "main.js"), "utf8");
  const reglas = fs.readFileSync(path.join(__dirname, "..", "FIRESTORE_RULES.txt"), "utf8");

  /* El código de main.js SIN comentarios, para las comprobaciones negativas.
     Repetido tres veces en este archivo y por lo mismo: un comentario que nombra
     el símbolo que se está buscando cuenta como código, y la comprobación pasa
     con el símbolo borrado. */
  const sinComentarios = src.replace(/\/\*[\s\S]*?\*\//g, "");
  const cuerpo = (ini, fin) => src.slice(src.indexOf(ini), src.indexOf(fin));
  const cuerpoLbReservar = cuerpo("\n  lbReservar() {", "\n  lbTema() {");
  const cuerpoLbReservarBar = cuerpo("\n  lbReservarBar(id) {", "\n  lbReservar() {");
  const cuerpoLbAbre = cuerpo("function lbAbreReserva()", "\n/* --- Handlers del widget");

  /* Lo que se publica no debe imprimir nada en la consola. Antes quedaban tres
     console.error, y uno volcaba el turno entero (uid, nombre, barbero, fecha,
     hora, cupos) en el navegador de quien lo aborted. */
  const llamadas = src.match(/^\s*console\.\w+\s*\(/gm) || [];
  ok(llamadas.length === 0, "main.js no llama a console.*", JSON.stringify(llamadas));
  ok(!/[\uFFFD]/.test(src), "main.js no tiene caracteres rotos (U+FFFD)");
  for (const [F, t] of [
    ["styles.css", fs.readFileSync(path.join(__dirname, "..", "src", "styles.css"), "utf8")],
    ["landing.css", fs.readFileSync(path.join(__dirname, "..", "src", "landing.css"), "utf8")],
    ["index.html", fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8")],
  ]) {
    ok(!/[\uFFFD]/.test(t), `${F} no tiene caracteres rotos`);
  }

  ok(
    /"auth\/cancelled-popup-request",/.test(
      src.match(/const CANCELADO = new Set\(\[[\s\S]*?\]\)/)[0],
    ),
    "el popup cancelado ya no avisa (está en CANCELADO)",
  );
  ok(!/Esperá un segundo e intentá de nuevo/.test(src), "el cartel de 'esperá un segundo' desapareció");
  ok(!/FIRESTORE_RULES\.txt, el punto 6/.test(src), "el mensaje de permisos ya no manda a leer un archivo");
  ok(/Math\.min\(50, v\)/.test(src), "el tope de puntos del panel es 50");
  /* OJO con la forma de estos chequeos. Antes se leía
     `reglas.split("match /fotoBarbero")[1].split("match /activos")[0]` y si la
     primera vuelta no encontraba nada, `[1]` era `undefined` y la prueba
     MORÍA con "Cannot read properties of undefined" en vez de decir que la
     regla no está. Ahora se comprueba la existencia primero. */
  const hayFotoBarbero = /match \/fotoBarbero\/\{uid\}/.test(reglas);
  ok(hayFotoBarbero, "las reglas tienen la colección fotoBarbero");
  if (hayFotoBarbero) {
    const bloque = reglas.split("match /fotoBarbero")[1].split("match /activos")[0];
    ok(/allow read: if true/.test(bloque), "y se lee sin sesión (la landing la necesita)");
  }
  ok(/request\.resource\.data\.pt <= 50;/.test(reglas), "el tope de puntos de las reglas es 50");

  /* ---------- los agujeros que la auditoría cerró ----------
     El 13/10 el archivo de reglas fue reescrito a mano y quedó con una versión
     anterior a la auditoría: sin fotoBarbero, con el tope en 20 y con los
     agujeros abiertos. Como la app NO falla visible cuando un write se deniega
     (el error se traga con un .catch), nadie se enteró salvo por el cartel de
     "Máximo 20 puntos". Estos chequeos existen para que la regresión no pueda
     volver a colarse en silencio.

     Se comparan las reglas sin comentarios, porque los comentarios se reescriben
     seguido y no deben poder cambiar el veredicto. */
  const codigo = (t) =>
    t
      .split(/\r?\n/)
      .map((s) => s.replace(/\/\/.*$/, "").trim())
      .filter(Boolean)
      .join("\n");
  const cod = codigo(reglas);
  const bloque = (etq) => {
    const i = cod.indexOf("match " + etq + " {");
    if (i < 0) return null;
    const j = cod.indexOf("match /", i + 1);
    return j < 0 ? cod.slice(i) : cod.slice(i, j);
  };
  const bConfig = bloque("/config/{docId}");
  const bBarberos = bloque("/config/barberos");
  const bFoto = bloque("/fotoBarbero/{uid}");
  const bStaff = bloque("/staff/{uid}");
  const bTurnos = bloque("/turnos/{id}");
  const bVentas = bloque("/ventas/{id}");
  const bGastos = bloque("/gastos/{id}");

  ok(bConfig !== null && /allow write: if isOwner\(\);/.test(bConfig), "config: escribir es sólo del dueño (un barbero no puede reescribir precios ni horarios)");
  ok(bConfig !== null && /docId != 'finanzas' \|\| isStaff\(\) \|\| isOwner\(\)/.test(bConfig), "config/finanzas pide ser del equipo, no sólo estar registrado");
  ok(bStaff !== null && /hasOnly\(\['n', 'foto', 'tel', 'ig', 'desc'\]\)/.test(bStaff), "un barbero sólo toca su ficha y sin el campo pd (el porcentaje del dueño)");
  ok(bTurnos !== null && /t\.matches\(/.test(bTurnos) && /d\.matches\(/.test(bTurnos), "turnos: el alta valida el formato de fecha y hora (cierra el HTML inyectado)");
  ok(bTurnos !== null && /allow delete: if isBarberoOrOwner\(\);/.test(bTurnos), "turnos: borrar es del equipo (el cliente no borra un turno cobrado)");
  ok(bTurnos !== null && /resource\.data\.st in \['pend', 'cancel'\]/.test(bTurnos), "turnos: el cliente no puede marcarse el turno como hecho ni ponerle el precio");
  /* Ojo con contar. La comprobación anterior buscaba dos apariciones de
     "resource.data.bid == request.auth.uid", pero ese texto va DENTRO de
     "request.resource.data.bid" del create: contaba una de más y seguía
     dando verde con una venta abierta al equipo entero. Ahora se exige que en
     el bloque no aparezca ni un "isBarberoOrOwner()" y que cada línea con
     isStaff() lleve además el filtro por bid. */
  ok(
    bVentas !== null &&
      !/isBarberoOrOwner\(\)/.test(bVentas) &&
      bVentas
        .split("\n")
        .filter((s) => /isStaff\(\)/.test(s))
        .every((s) => /bid == request\.auth\.uid/.test(s)) &&
      (bVentas.match(/^\s*allow /gm) || []).length === 3,
    "ventas: un barbero sólo toca las suyas, no las del dueño",
    bVentas,
  );
  /* Escritura sólo del dueño. La LECTURA se abrió en el lote 39, para que cada
   barbero pueda ver los gastos que están a su nombre y restárselos de su
   ganancia: son los mismos números que el dueño ve, así que no hay nada que un
   barbero pueda ver de más. */
ok(
  bGastos !== null && /allow create, update, delete: if isOwner\(\);/.test(bGastos),
  "gastos: sólo el dueño los carga",
  bGastos,
);
ok(
  bGastos !== null && /allow read: if isSignedIn\(\);/.test(bGastos),
  "pero cualquier barbero con sesión puede verlos",
  bGastos,
);

  /* ---------- fotoBarbero: el perfil público del barbero ----------
     Esta regla tenía el bug que hacía que la foto nunca llegara a la web. Vale
     la pena dejar escrito por qué los dos chequeos siguientes miran lo que
     miran.

     El bug era `request.resource.data.diff(resource.data)` en un `create`. En
     un create el documento no existe, así que `resource` es null y la regla
     TRUENA: Firestore falla cerrada y deniega. Comprobado contra las reglas
     publicadas: el documento daba 404 y el setDoc de la app devolvía 403. */
  ok(
    bFoto !== null && !/diff\(\s*resource\.data\s*\)/.test(bFoto),
    "fotoBarbero: la regla NO usa diff(resource.data), que truena en un create",
    bFoto,
  );
  ok(
    bFoto !== null && /allow read: if true;/.test(bFoto),
    "fotoBarbero se lee sin sesión (la landing la necesita)",
  );
  ok(
    bFoto !== null &&
      /allow create, update:[\s\S]*hasOnly\(([\s\S]*?)\)/.test(bFoto) &&
      /'foto'/.test(bFoto) &&
      /'n'/.test(bFoto) &&
      /'desc'/.test(bFoto),
    "fotoBarbero acepta el perfil entero (foto, nombre, descripción, …) y no sólo la foto",
    bFoto,
  );

  /* config/barberos vuelve a ser del dueño solo. El barbero ya no escribe
     adentro de la lista: la regla con `where(b, b.id != auth.uid)` daba 403 en
     producción y hacía fallar "Editar perfil" entero. */
  ok(bBarberos !== null && /allow write: if isOwner\(\);/.test(bBarberos), "config/barberos: la lista del equipo la escribe sólo el dueño", bBarberos);
  ok(!/where\(/.test(cod), "ninguna regla depende de where() sobre la lista: esa construcción nunca evaluó true en producción");

  /* Y el código tiene que guardar el perfil del barbero en SU documento, no
     en la lista: si vuelve a escribir en config/barberos, "Editar perfil"
     vuelve a fallar aunque las reglas estén bien. */
  /* OJO: el chequeo va ACOTADO al cuerpo de guardarPerfil y no a todo el
     archivo. El dueño sí tiene que escribir `config/barberos` — es su pantalla
     de Barberos, la que decide quién está en el equipo—, y ese write es
     correcto. Lo que no puede volver a pasar es que lo haga el BARBERO. */
  const cuerpoGuardarPerfil = src.slice(src.indexOf("async function guardarPerfil"), src.indexOf("Object.assign(ACT, { guardarPerfil })"));
  ok(
    /setDoc\(doc\(db, "fotoBarbero", id\), publico/.test(cuerpoGuardarPerfil),
    "guardarPerfil escribe el perfil del barbero en fotoBarbero/{uid}",
  );
  ok(
    !/setDoc\(doc\(db, "config", "barberos"\)/.test(cuerpoGuardarPerfil),
    "y ya no intenta escribir la lista config/barberos (esa la maneja el dueño)",
  );
  ok(
    !/setDoc\(doc\(db, "fotoBarbero", me\.uid\)[^;]*\.catch\(\(\) => \{\}\)/.test(src),
    "la foto ya no se guarda con un .catch que se traga el error",
  );

  /* ---------- el contrato entre quien llena FOTOS y quien la lee ----------
     Este es el bug que casi se va sin ver. conFotos() espera que FOTOS[b.id]
     sea el DOCUMENTO ENTERO, porque ahora ese documento lleva también el
     nombre, el oficio y la descripción. Pero el snapshot se había quedado
     guardando `d.data().foto`, que es una CADENA.

     Al extender una cadena con `...pub` se parten los caracteres, `pub.foto`
     queda `undefined`, el merge cae al respaldo `foto: ""` y la tarjeta de la
     web muestra "[Foto]" aunque el documento esté lleno y las reglas dejen
     leerlo. O sea: la base de datos estaba bien, las reglas estaban bien, y
     aun así no se veía nada.

     La prueba del merge (setFotos) pasaba a mano la forma que el CONSUMIDOR
     espera, así que se comprobaba a sí misma. Estos dos chequeos atan las dos
     puntas; lo que de verdad lo atrapa es tests/landing.foto.viva.js, que
     carga un documento real de Firestore y mira lo que ve un visitante. */
  const snapFoto = src.slice(
    src.indexOf('collection(db, "fotoBarbero")'),
    src.indexOf('onSnapshot(doc(db, "config", "horario")'),
  );
  ok(
    /FOTOS\[d\.id\] = d\.data\(\);/.test(snapFoto),
    "el snapshot guarda el documento entero en FOTOS, no sólo d.data().foto",
    snapFoto.slice(0, 200),
  );
  ok(
    !/FOTOS\[d\.id\] = d\.data\(\)\.foto;/.test(src),
    "y en ningún lado se guarda la cadena suelta",
  );
  /* Y al revés de la anterior: endurecer de más también rompe. Si el create de
     ventas pierde la rama del barbero, un barbero que cobra un corte en la
     barbería no puede registrar la venta y la plata se pierde. */
  ok(
    bVentas !== null &&
      bVentas
        .split("\n")
        .filter((s) => /allow create/.test(s))
        .some((s) => /isStaff\(\)/.test(s)),
    "ventas: el barbero todavía puede registrar un cobro",
    bVentas,
  );
  ok(!/allow read, write: if isBarberoOrOwner\(\);\s*\n\s*\}\s*\n\s*match \/gastos/.test(cod), "no quedó un 'read, write: if isBarberoOrOwner()' sin filtrar antes de gastos");

  ok(/u\.id !== OWNER_UID/.test(src), "el dueño se excluye de la lista de clientes");
  ok(!/data-act="fotoBarbero"/.test(src), "el botón Foto del dueño ya no está");
  ok(!/const negTab/.test(src), "el apartado Negocio ya no existe");
  ok(/Servicios<\/button><button[^>]*>Puntos</.test(src), "el menú de Ajustes es Horarios / Servicios / Puntos");
  ok(/setFotos\(m\)/.test(src), "el merge de fotos es comprobable desde las pruebas");

  /* ---------- el botón de Facebook no tiene que volver ----------
     El dueño lo sacó (PRODUCT.md). Estas comprobaciones miran el HTML que se
     dibuja, no el texto del archivo: en el código quedan comentarios que
     explican la decisión y tienen la palabra "Facebook", así que buscar la
     palabra en el fuente daría verde con el botón puesto. */
  ok(!/data-act="red" data-args="\$\{A\("facebook/.test(src), "no hay ningún botón de Facebook en ninguna pantalla", (src.match(/data-act="red"[^>]*/g) || []).join(" | "));
  ok(!/FacebookAuthProvider/.test(src), "y no se importa el proveedor de Facebook");
  const botonesRed = src.match(/data-act="red"[^>]*/g) || [];
  ok(botonesRed.length === 2, "quedan los dos botones de Google (ingreso y registro), y sólo esos", String(botonesRed.length));
  ok(
    botonesRed.every((b) => /google/i.test(b)),
    "y los dos son de Google, ninguno de otra red",
    botonesRed.join(" | "),
  );
  ok(
    /async red\(registro\)/.test(src) && !/new FacebookAuthProvider\(\)/.test(src),
    "red() ya no elige proveedor: entra siempre con Google",
  );
  ok(
    !/assets\/facebook\.png/.test(src),
    "y el ícono de Facebook ya no se referencia en ninguna pantalla",
  );

  /* ---------- BARS SIEMPRE tiene que pasar por conFotos ----------
     La foto del barbero llegaba a la web y no al panel, con el mismo dato en la
     misma base. Motivo: había TRES lugares que asignaban `BARS`, y sólo uno
     usaba `conFotos`. Los otros dos la pisaban con la lista cruda de
     `config/barberos`, que viene con `foto: ""`, y como corrían después ganaban.

     - el listener de módulo (el de la landing): sí usaba conFotos
     - el listener de setup(), que es el que se registra con sesión: NO
     - el que reaplica los datos al cambiar de sesión: NO

     Con sesión, la foto desaparecía del panel del dueño (la tarjeta mostraba la
     inicial "R"). Y al volver a la web desde el panel los dos listeners siguen
     vivos, así que el crudo seguía ganando y la foto tampoco aparecía en la
     landing: exactamente lo que reportó el dueño.

     La comprobación mira TODAS las asignaciones, no una en particular: el bug
     estaba justamente en las dos que nadie mira. */
  const asignBARS = [...src.matchAll(/BARS\s*=[^=]/g)].map((m) =>
    src.slice(Math.max(0, m.index - 220), m.index + 100),
  );
  const crudas = asignBARS.filter((c) => !/BARS = \[\]|Array\.isArray\(l\)|conFotos\(/.test(c));
  ok(
    crudas.length === 0,
    `las ${asignBARS.length} asignaciones de BARS pasan todas por conFotos`,
    crudas.map((c) => "-> " + c.trim().slice(-100)).join("   ||   "),
  );
  ok(
    asignBARS.filter((c) => /conFotos\(/.test(c)).length >= 4,
    "y hay al menos cuatro: la de módulo, la de fotoBarbero, la de setup() y la del cambio de sesión",
    String(asignBARS.filter((c) => /conFotos\(/.test(c)).length),
  );

  /* ---------- la consulta de mensajes tiene que estar dentro de setup() ----------
     Estaba a nivel de módulo, detrás de un `if (isOwner())`. Eso se evaluaba una
     sola vez, cuando el módulo termina de cargar y `me` todavía es `null`: la
     consulta NUNCA se abría, y no había reintento.

     El efecto: la pantalla decía siempre "Todavía no mandó nadie un mensaje",
     con la base llena. Comprobado contra Firestore: había 3 mensajes y la
     pantalla mostraba 0. */
  const cuerpoSetup = src.slice(
    src.indexOf("function setup(a)"),
    src.indexOf('onSnapshot(doc(db, "config", "servicios")'),
  );
  ok(cuerpoSetup.includes('collection(db, "mensajes")'), "la consulta de `mensajes` se abre dentro de setup(), donde ya se sabe quién es el dueño");
  /* Ojo con el alcance: `mensajes` también aparece en el `addDoc` del formulario
     de contacto y en el `deleteDoc` del botón de borrar. Lo que se cuenta es la
     CONSULTA (`query(collection(...`), que es la que abre el listener: si
     aparece dos veces, una de las dos está en el lugar donde no se abre. */
  const consultasMensajes = src.match(/query\(\s*collection\(db, "mensajes"\)/g) || [];
  ok(consultasMensajes.length === 1, "y hay exactamente UNA consulta a `mensajes` en todo el archivo", consultasMensajes.length + " consultas");

  /* ---------- el tope de los puntos de bienvenida ----------
     Estaba en 20, que era el de una versión vieja de las reglas. Las reglas hoy
     piden `pt <= 50` y el panel lo muestra como 50, así que los puntos de
     bienvenida se recortaban en silencio: el dueño escribía 40, el guardado daba
     bien, y a cada persona nueva se le daban 20. Sin error y sin aviso. */
  ok(/PTSRv = Math\.min\(50,/.test(src), "los puntos de bienvenida se acotan a 50, como las reglas", (src.match(/PTSRv = Math\.min\(\d+,[^)]*\)/) || [])[0]);
  ok(!/PTSRv = Math\.min\(20,/.test(src), "y no queda el tope viejo de 20");

  /* ---------- el scroll de las secciones ----------
     El dueño pidió que bajar a una sección no sea un salto. Hacían falta DOS
     cosas, y con la segunda es fácil olvidarse: el comportamiento suave va en el
     elemento que SCROLLEA (la raíz del documento, no `.lb`), y además hace
     falta `scroll-margin-top`, porque el encabezado es `sticky` y sin ese margen
     el título de la sección queda tapado.

     Y el apagado por `prefers-reduced-motion` tiene que estar en `html`: puesto
     sobre `.lb *` no hace nada, porque `scroll-behavior` se lee en el elemento
     que scrollea. */
  const lc = fs.readFileSync(path.join(__dirname, "..", "src", "landing.css"), "utf8");
  ok(/^html\s*\{\s*scroll-behavior:\s*smooth/m.test(lc), "la raíz scrollea suave");
  ok(/scroll-margin-top:/.test(lc), "y las secciones tienen scroll-margin-top para que el encabezado fijo no las tape");
  ok(
    /@media \(prefers-reduced-motion: reduce\)[\s\S]*?html\s*\{[\s\S]*?scroll-behavior:\s*auto/.test(lc),
    "con prefers-reduced-motion vuelve a ser instantáneo, y el apagado está en `html`",
  );

  /* ---------- las políticas leen los datos, no los escriben ----------
     El dueño pidió que los puntos, las horas de cancelar y los premios cambien
     solos cuando los cambia desde su panel.

     Antes la sección de puntos tenía los premios escritos a mano: "Descuento 20%
     (25 puntos), Descuento 50% (50 puntos) y Corte gratis (100 puntos)". Los
     reales eran 20, 40 y 100. O sea que el documento —que es un contrato— decía
     un premio que no existía, con un precio que no era el. Y no se notaba,
     porque los puntos por corte y las horas SÍ salían de la configuración: dos
     de cada tres estaban bien, y el que estaba mal era el menos visible.

     Estas comprobaciones buscan números con unidad ESCRITOS a mano dentro de
     polH(). Si vuelve a aparecer "25 puntos" o "5 horas" en el texto, el bug
     volvió. */
  const pol = src.slice(src.indexOf("function polH()"), src.indexOf("const cuerpo = { resumen"));
  /* Se buscan sobre el CÓDIGO, no sobre el texto entero. El bloque de polH()
     lleva comentarios que nombran cada fuente, y si se buscara en todo el
     archivo, borrar el código y dejar el comentario daría verde: es el mismo
     problema de una afirmación que pasa con un selector roto, que ya mordió una
     vez en este repo. Los comentarios también traen números de ejemplo ("25
     puntos"), que no son un error. */
  const polCodigo = pol.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  const aMano = [...new Set(polCodigo.match(/\b\d+\s*(puntos|horas|hora|%)\b/g) || [])];
  ok(aMano.length === 0, "en las políticas no hay ningún número de puntos u horas escrito a mano", JSON.stringify(aMano));
  const debeLeer = [
    ["los puntos por corte", /polPuntos\(PTSv\)/],
    ["los puntos de bienvenida", /polPuntos\(PTSRv\)/],
    ["las horas de cancelar", /\$\{CHSv\}/],
    ["los premios", /polLista\(premios\)/],
    ["el horario del local", /lbHorarioTxt\(""\)/],
  ];
  /* Ojo con comparar con `re.source`: eso devuelve el patrón CON los paréntesis
     escapados ("polPuntos\\(PTSv\\)"), que no aparece literalmente en el
     archivo, y la comprobación daba verde sin encontrar nada. */
  const faltan = debeLeer.filter(([, re]) => !re.test(polCodigo)).map(([q]) => q);
  ok(faltan.length === 0, "y las cinco cosas que cambia el dueño salen de la configuración", faltan.join(", "));
  /* Un premio vacío no puede dejar una lista vieja: si el dueño no cargó
     premios, el documento lo dice. */
  ok(
    /premios\.length[\s\S]{0,120}Por el momento no hay premios/.test(pol),
    "si no hay premios cargados, lo dice en vez de mostrar la lista de antes",
  );

  /* ---------- menos botones, todos abriendo lo mismo ----------
     El dueño pidió quitar la barra fija de "Reservar ahora" y la tarjeta "Elegí
     con quién cortarte": eran dos botones más para lo mismo, y quedaban pegados
     al de la sección de reseñas tapando el contenido.

     Y pidió que "Reservar con {barbero}" fuera el MISMO proceso que el otro
     botón. Antes llamaba a lbReservar(), que sacaba al cliente de la web y lo
     mandaba a la pantalla del panel: dos botones, dos caminos. Ahora abre la
     misma ventana de seis pasos con ese barbero puesto. */
  ok(!/lb-sticky/.test(src), "la barra fija de reservar ya no se dibuja", (src.match(/lb-sticky[^\n]{0,60}/g) || []).join(" | "));
  ok(!/\.lb-sticky/.test(lc), "y su CSS también está borrado");
  ok(!/lb-elige/.test(src), "la tarjeta «Elegí con quién cortarte» ya no se dibuja");
  ok(!/\.lb-elige/.test(lc), "y su CSS también está borrado");
  const lbReservarBar = src.slice(src.indexOf("lbReservarBar(id)"), src.indexOf("lbReservar() {"));
  ok(!/\bACT\.lbReservar\(\)/.test(lbReservarBar), "«Reservar con X» ya no manda al panel: usa la misma ventana", lbReservarBar.slice(0, 120));
  ok(
    /wzModal\(\)/.test(cuerpoLbAbre) &&
      /sel\.b = elegido && sel\.b === id \? "" : id;/.test(lbReservarBar),
    "abre la ventana de reserva con ese barbero ya elegido (y lo puede sacar con el mismo botón)",
    cuerpoLbAbre.slice(0, 110),
  );
  /* `lbPrimerPaso` lo llama la función compartida (lote 34), no el botón: los
     cuatro botones de reserva arrancan en el primer paso que falte. */
  ok(
    /lbPrimerPaso/.test(cuerpoLbAbre),
    "y arranca en el primer paso que falta, no en el 1",
    cuerpoLbAbre.slice(0, 110),
  );
  /* Ojo: que `lbPrimerPaso` esté fuera del `Object.assign(ACT, …)` ya lo
   garantiza el parser — si estuviera dentro del objeto, `node --check`
   fallaría y el archivo ni siquiera cargaría. Lo que sí importa acá es que
   devuelva el paso 6 cuando ya está todo elegido, y no un número fijo.

   Lote 48: la fuente de verdad se mudó a `wzFaltante(desde)` — es lo que
   permite saltar pasos completos con la pre-carga del Inicio. `lbPrimerPaso`
   sigue siendo LA consulta "desde el principio", ahora via delegado. */
  const cuerpoPrimerPaso = (src.match(/const lbPrimerPaso = \(\) => wzFaltante\(0\);/) || [""])[0];
  const cuerpoFaltante = (src.match(/const wzFaltante = \(desde\) => \{[\s\S]*?\n\};/) || [""])[0];
  ok(
    !!cuerpoPrimerPaso &&
      /S\.length > 0 && sel\.s >= 0, \/\/ 1 servicio/.test(cuerpoFaltante) &&
      /return 6;/.test(cuerpoFaltante),
    "y lbPrimerPaso (via wzFaltante) devuelve el 6 con todo elegido y el 1 sin servicio",
    (cuerpoPrimerPaso || cuerpoFaltante).slice(0, 90),
  );
  ok(
    /function lbCerrarMenu\(\)/.test(src) && /e\.target\.closest\("#lbPanel"\)\)\s*lbCerrarMenu\(\)/.test(src),
    "el menú móvil se cierra solo al tocar algo de la bandeja",
  );

  /* ---------- el resumen no se parte letra por letra ----------
     En el móvil el valor de cada fila salía partido en ocho renglones, un
     carácter por renglón: "B a r b a 3 0 m i n".

     La causa NO era el `overflow-wrap` (medido: con `anywhere` y con
     `break-word` la celda colapsaba igual). Era el ancho:

     - `.wz-res-cols` tenía `minmax(0, 1.25fr)` para la columna de la izquierda,
       que puede llegar a CERO. En una ventana de 900px la tarjeta quedó en
       184px y la celda del valor en 18px.
     - dentro de la fila, `.wz-rf-t` era `flex: 1`: se quedaba con lo que
       sobrara después del ícono y del botón "Cambiar", que es `flex: 0 0 auto`.

     El arreglo es que la fila se acomode sola en vez de depender del ancho:
     con `flex-wrap` y un flex-basis el botón baja de renglón antes de que el
     texto se estruje. */
  const filaRf = (lc.match(/\.wz-rf \{[\s\S]*?\}/) || [""])[0];
  ok(/flex-wrap:\s*wrap/.test(filaRf), "la fila del resumen tiene flex-wrap: wrap, para que el botón baje antes de estrujar el texto", filaRf);
  const tRf = (lc.match(/\.wz-rf-t \{[\s\S]*?\}/) || [""])[0];
  ok(
    /flex:\s*1 1 \d+px/.test(tRf) && !/flex:\s*1;/.test(tRf),
    "y el texto tiene un flex-basis en píxeles, no `flex: 1` a secas",
    tRf,
  );
  /* Y acá va sobre el CÓDIGO, no sobre todo el archivo: el comentario que explica
     el bug menciona `minmax(0, 1.25fr)` a propósito, y buscarlo en el archivo
     entero lo encontraba y daba falso negativo. Es el mismo tropiezo de antes,
     dos veces en el mismo lote.

     Y se miran TODOS los bloques `.wz-res-cols`, no el primero: hay dos (el
     base, que es de una columna, y el del media query, que es el de dos). Con el
     primero la comprobación daba falso constante y "detectaba" cualquier cosa,
     que es peor que no comprobar. */
  const lcCodigo = lc.replace(/\/\*[\s\S]*?\*\//g, "");
  const bloquesCols = lcCodigo.match(/\.wz-res-cols \{[\s\S]*?\}/g) || [];
  ok(
    bloquesCols.length >= 2,
    "la grilla del resumen tiene un bloque base y uno de dos columnas",
    bloquesCols.length + " bloques",
  );
  ok(
    bloquesCols.every((b) => !/minmax\(0,\s*1\.25fr\)/.test(b)) &&
      bloquesCols.some((b) => /grid-template-columns:\s*minmax\(\d+px/.test(b)),
    "y en el de dos columnas la izquierda tiene piso en píxeles, no `minmax(0, …)`",
    bloquesCols.map((b) => b.slice(0, 90)).join(" || "),
  );

  /* ---------- los pisos de la grilla tienen que ENTRAR en la hoja ----------
     Este es el bug que reportó el dueño en escritorio: en la ventana de
     resumen el precio, la casilla de los términos y el botón "Ingresar y
     confirmar" quedaban cortados, con barra horizontal.

     La causa fue mía, del lote 33: puse `minmax(240px, …) minmax(220px, …)` y
     escribí que si no entraban la grilla caía a una columna. **Eso es falso.**
     Con `minmax()` los pisos son reales: si los dos no entran, la grilla se
     desborda y el contenido se sale de la hoja.

     El arreglo fue ensanchar la hoja en escritorio (460 → 720px), así que la
     cuenta quedó:

         240 (izquierda) + 18 (gap) + 220 (derecha) = 478px de grilla
         720 (hoja) − 18 − 18 (padding)               = 684px disponibles

     Estas dos comprobaciones hacen esa cuenta con los números del archivo, para
     que cambiar cualquiera de los dos números sin el otro salte en rojo. */
  const bloqueDosColumnas = bloquesCols.find((b) => /grid-template-columns:\s*minmax\(\d+px/.test(b)) || "";
  const pisos = [...bloqueDosColumnas.matchAll(/minmax\((\d+)px/g)].map((m) => +m[1]);
  const gapCols = +((bloqueDosColumnas.match(/gap:\s*(\d+)px/) || [])[1] || 0);
  const paddingHoja = +((lcCodigo.match(/\.wz-sheet \{[\s\S]*?padding:\s*(\d+)px/) || [])[1] || 0);
  const anchosHoja = [...lcCodigo.matchAll(/\.wz-sheet \{[\s\S]*?max-width:\s*(\d+)px/g)].map((m) => +m[1]);
  const anchoHojaBase = +(lcCodigo.match(/\.wz-sheet \{[\s\S]*?max-width:\s*(\d+)px/) || [])[1];

  ok(
    pisos.length === 2 && gapCols > 0,
    "el resumen tiene dos columnas con piso en píxeles y gap, y se pueden sumar",
    "pisos " + JSON.stringify(pisos) + " gap " + gapCols,
  );
  const anchoMinimoGrilla = pisos.reduce((a, b) => a + b, 0) + gapCols;
  ok(
    anchosHoja.length >= 2 && anchosHoja.every((w) => w - paddingHoja * 2 >= anchoMinimoGrilla),
    "y en TODOS los anchos de la hoja la grilla del resumen entra entera",
    "la grilla necesita " + anchoMinimoGrilla + "px; los max-width son " +
      JSON.stringify(anchosHoja) + " con padding " + paddingHoja * 2 + " (interior " +
      JSON.stringify(anchosHoja.map((w) => w - paddingHoja * 2)) + ")",
  );

  /* ---------- 2. el dueño ---------- */
  console.log("\n=== 2. panel del dueño ===");
  const b = await chromium.launch();
  const du = await entrar(b, env.DUENO_EMAIL, env.DUENO_PASSWORD);
  if (!(await du.page.evaluate(() => !!(window.__test && window.__test.uid)))) {
    ok(false, "entró el dueño");
  } else {
    ok(true, "entró el dueño");

    /* --- el dueño no es un cliente --- */
    await du.page.evaluate(() => {
      location.hash = "#/clientes";
    });
    await du.page.waitForTimeout(2200);
    const cli = await du.page.evaluate(() => {
      const filas = [...document.querySelectorAll("#app .clin")].map((x) => x.children[0].textContent.trim());
      return { filas, dice: (document.querySelector("#app small") || {}).textContent || "" };
    });
    ok(
      !cli.filas.some((x) => /due/i.test(x)),
      "en Clientes no aparece el dueño",
      cli.filas.join(" | "),
    );
    ok(cli.filas.length >= 1, "el resto de los clientes sigue estando", cli.filas.join(" | "));

    /* --- Barberos: sin botón Foto --- */
    await du.page.evaluate(() => {
      location.hash = "#/barberos";
    });
    await du.page.waitForTimeout(2200);
    const bar = await du.page.evaluate(() => ({
      botones: [...document.querySelectorAll("#app .card button")].map((x) => x.textContent.trim()),
      fotos: [...document.querySelectorAll("#app .card img")].length,
    }));
    ok(
      !bar.botones.some((x) => /^Foto$/i.test(x)),
      "la tarjeta del barbero no tiene el botón Foto",
      bar.botones.join(" | "),
    );
    ok(bar.botones.length >= 2, "siguen Editar y Quitar", bar.botones.join(" | "));

    /* --- el merge de la foto --- */
    const merge = await du.page.evaluate(() => {
      window.__test.setBars([
        { id: "uid-falso", n: "Prueba", foto: "https://ejemplo/vieja.jpg", desc: "la vieja" },
        { id: "uid-nuevo", n: "Sin foto" },
      ]);
      /* FOTOS guarda el PERFIL entero del barbero, no sólo la foto: es el mismo
         documento fotoBarbero/{uid} del que escribe "Editar perfil". Antes el
         test pasaba un mapa de strings porque eso era lo que había; con la
         forma nueva, extender un string con `...pub` lo partiría en
         caracteres sueltos. */
      const conNueva = window.__test.setFotos({
        "uid-falso": { foto: "https://ejemplo/nueva.jpg", n: "Nombre Nuevo", desc: "la nueva" },
      });
      window.__test.setFotos({});
      const conVieja = window.__test.setBars([{ id: "x", n: "y", foto: "vieja" }]);
      const limpio = window.__test.setFotos({});
      return { conNueva, conVieja, limpio };
    });
    ok(
      merge.conNueva[0].foto === "https://ejemplo/nueva.jpg",
      "la foto de fotoBarbero pisa a la de la ficha",
      JSON.stringify(merge.conNueva.map((b) => b.foto)),
    );
    ok(
      merge.conNueva[0].n === "Nombre Nuevo" && merge.conNueva[0].desc === "la nueva",
      "y también el nombre y la descripción: el perfil entero va en un solo documento",
      JSON.stringify(merge.conNueva[0]),
    );
    ok(
      merge.conNueva[0].id === "uid-falso",
      "pero el id NO se pisa: es la clave con la que se buscó la entrada",
      JSON.stringify(merge.conNueva[0]),
    );
    ok(
      merge.conNueva[1].foto === "",
      "un barbero sin foto sigue sin foto",
      JSON.stringify(merge.conNueva.map((b) => b.foto)),
    );
    ok(
      merge.limpio[0].foto === "vieja",
      "si no hay nada en fotoBarbero, se usa la foto de la ficha de respaldo",
      JSON.stringify(merge.limpio.map((b) => b.foto)),
    );

    /* --- Mensajes: la pantalla tiene que ABRIR, no sólo estar en la barra --- */
    /* Esto se agregó después de un despiste: "mens" estaba en rtOk pero no en
       la tabla de rutas RT, así que el botón de la barra llevaba a
       "#/undefined" y no pasaba nada. Contar que la sección existe en la barra
       no dice nada de que abra. */
    await du.page.locator('#nav button:has-text("Mensajes")').click();
    await du.page.waitForTimeout(2200);
    const ms = await du.page.evaluate(() => ({
      hash: location.hash,
      titulo: (document.querySelector("#app h1") || {}).textContent || "",
      cuerpo: document.getElementById("app").innerText.slice(0, 160),
    }));
    ok(ms.hash === "#/mensajes", "el botón Mensajes lleva a #/mensajes", ms.hash);
    ok(/Mensajes/.test(ms.titulo), "y muestra la pantalla de Mensajes", ms.titulo + " | " + ms.cuerpo.slice(0, 60));
    await du.page.evaluate(() => {
      location.hash = "#/clientes";
    });
    await du.page.waitForTimeout(1200);

    /* --- Ajustes --- */
    await du.page.evaluate(() => {
      location.hash = "#/ajustes";
    });
    await du.page.waitForTimeout(2200);
    const aj = await du.page.evaluate(() => ({
      tabs: [...document.querySelectorAll("#app .tabs button")].map((x) => x.textContent.trim()),
      cuerpo: document.getElementById("app").innerText.slice(0, 200),
    }));
    ok(aj.tabs.join("|") === "Horarios|Servicios|Puntos", "las pestañas son Horarios/Servicios/Puntos", aj.tabs.join(" | "));
    ok(!/Negocio/.test(aj.cuerpo), "no aparece el apartado Negocio", aj.cuerpo.slice(0, 80));

    await du.page.locator('#app .tabs button:has-text("Servicios")').click();
    await du.page.waitForTimeout(1400);
    const sv = await du.page.evaluate(() => ({
      /* OJO: los nombres de los servicios viven en el `value` de los inputs, y
         innerText NO incluye el value de un input. Buscarlos en el texto daba
         falso negativo con la pestaña perfectamente bien. */
      titulo: /Servicios y precios/.test(document.getElementById("app").innerText),
      nombres: [...document.querySelectorAll('#app .svr input')].map((x) => x.value).filter(Boolean),
      hayPremio: /Premios/.test(document.getElementById("app").innerText),
    }));
    ok(sv.titulo, "la pestaña Servicios se titula «Servicios y precios»", JSON.stringify(sv).slice(0, 120));
    ok(sv.nombres.length >= 1, "y lista los servicios con su nombre", sv.nombres.join(" | "));
    ok(!sv.hayPremio, "la pestaña Servicios ya no mezcla los premios", JSON.stringify(sv));

    await du.page.locator('#app .tabs button:has-text("Puntos")').click();
    await du.page.waitForTimeout(1400);
    const pt = await du.page.evaluate(() => ({
      hayPremio: /Premios/.test(document.getElementById("app").innerText),
      hayReglas: /Puntos por corte completado/.test(document.getElementById("app").innerText),
      welcome: document.getElementById("pptsreg") ? document.getElementById("pptsreg").value : null,
    }));
    ok(pt.hayPremio && pt.hayReglas, "la pestaña Puntos tiene premios y reglas", JSON.stringify(pt));
    ok(pt.welcome !== null, "el campo de bienvenida sigue ahí", String(pt.welcome));

    ok(du.jsErr.length === 0, "sin errores de JS en el panel del dueño", [...new Set(du.jsErr)].join(" / "));
  }
  await du.ctx.close();

  /* ---------- 3. el barbero ---------- */
  console.log("\n=== 3. panel del barbero ===");
  await new Promise((r) => setTimeout(r, 2500));
  const ba = await entrar(b, env.BARBERO_EMAIL, env.BARBERO_PASSWORD);
  if (!(await ba.page.evaluate(() => !!(window.__test && window.__test.uid)))) {
    /* Ojo: esto NO es una regresión del código. Se comprobó contra el commit
       anterior (269c4f1) y el mismo login falla idéntico, con
       `auth/invalid-credential`: la cuenta de prueba del barbero de `.env.local`
       tiene credenciales viejas, o el dueño la borró de la consola de Firebase.

       Se avisa en vez de marcar FALLA porque la prueba no está midiendo el
       código: si algún día vuelve a entrar sola, el resto del bloque corre de
       nuevo y mide lo que tiene que medir. Un rojo permanente por una
       contraseña vieja esconde los errores de verdad. */
    const porQue = await ba.page.evaluate(() => {
      const m = document.getElementById("mo");
      return m && !m.hidden ? m.innerText.replace(/\s+/g, " ").slice(0, 120) : "(sin aviso en pantalla)";
    });
    console.log(
      "  AVISO  la cuenta de prueba del barbero no entra (credenciales de .env.local viejas\n" +
        "         o cuenta borrada en Firebase): " + porQue,
    );
  } else if (await ba.page.evaluate(() => window.__test.rol.adm)) {
    /* Entró Y tiene panel de barbero: se puede medir la ficha pública. */
    ok(true, "entró el barbero con su panel");
    await ba.page.locator("#mebadge").click();
    await ba.page.waitForTimeout(600);
    await ba.page.locator('#pmenu button:has-text("Editar perfil")').click();
    await ba.page.waitForTimeout(1600);
    const ed = await ba.page.evaluate(() => {
      const mo = document.getElementById("mo");
      const d = mo ? mo.querySelector("#pfNombre") : null;
      return {
        modalAbierto: !!mo && !mo.hidden,
        hayCampos: !!d,
        /* El pedido del dueño: que sea una ventana emergente y NO se despliegue
           en el dashboard. O sea, el formulario no puede estar en #app. */
        enElDashboard: !!(d && d.closest("#app")),
        enElModal: !!(d && d.closest("#mo")),
        hayTitulo: !!(mo && mo.querySelector("#pmh")),
        foco: document.activeElement ? document.activeElement.id || document.activeElement.tagName : null,
      };
    });
    ok(ed.modalAbierto, "«Editar perfil» abre una ventana emergente");
    ok(ed.hayCampos, "con los campos del perfil adentro");
    ok(ed.enElModal, "los campos viven en la ventana, no en el dashboard");
    ok(!ed.enElDashboard, "y NO hay un <details> desplegado en el dashboard", JSON.stringify(ed));
    ok(ed.hayTitulo, "con su título (dialog aria-labelledby tiene a qué apuntar)");
    ok(ed.foco === "pfNombre", "y deja el foco en el primer campo para escribir", String(ed.foco));

    /* Cancelar tiene que cerrar SIN guardar, y tiene que ser la acción Mx y no
       `cerrarPerfil`: ese nombre ya lo usa el menú del encabezado, y si los
       dos se confundieran el Cancelar cerraría el menú y dejaría el formulario
       abierto. */
    await ba.page.fill("#pfNombre", "PRUEBA QUE NO DEBE GUARDARSE");
    await ba.page.locator('#mo button:has-text("Cancelar")').click();
    await ba.page.waitForTimeout(700);
    const despues = await ba.page.evaluate(() => {
      const mo = document.getElementById("mo");
      return { oculto: !mo || mo.hidden, quedaCampo: !!document.querySelector("#pfNombre") };
    });
    ok(despues.oculto, "el botón Cancelar cierra la ventana", JSON.stringify(despues));
    ok(!despues.quedaCampo, "y el formulario sale del documento");
    ok(ba.jsErr.length === 0, "sin errores de JS", [...new Set(ba.jsErr)].join(" / "));
  } else {
    /* Entró, pero como CLIENTE: no tiene documento `staff`, así que la app le
       muestra la barra de cliente y su "Editar perfil" va a Ajustes, no a la
       ficha pública del barbero.

       Antes esta rama no existía: el bloque daba por hecho que entrar significaba
       ser barbero, buscaba el botón, lo apretaba y se quedaba esperando un
       formulario que no correspondía a ese rol. Cinco rojos y un crash, por una
       suposición que el código nunca hizo.

       Se mide lo que ese rol hace de verdad, que también vale: para un cliente,
       "Editar perfil" tiene que llevar a Ajustes y NO abrir la ficha del
       barbero. Si algún día la cuenta vuelve a ser barbero, entra por la rama
       de arriba y se mide la ficha. */
    const rolB = await ba.page.evaluate(() => window.__test.rol);
    console.log(
      "  AVISO  la cuenta de prueba del barbero (" + env.BARBERO_EMAIL + ") entra, pero\n" +
        "         como CLIENTE (uid " + rolB.uid + ", sin documento staff). Se mide su\n" +
        "         comportamiento de cliente. Para medir la ficha pública del barbero,\n" +
        "         esa cuenta tiene que volver a ser barbero en el panel.",
    );
    ok(!rolB.dueno, "entra como cliente, no como dueño");
    await ba.page.locator("#mebadge").click();
    await ba.page.waitForTimeout(800);
    const cli = await ba.page.evaluate(() => ({
      barra: [...document.querySelectorAll("#nav button, #nav a")].map((x) => x.innerText.trim()),
      menu: [...document.querySelectorAll("#pmenu button")].map((x) => x.innerText.trim()),
    }));
    ok(
      cli.barra.length > 0 && cli.barra.length < 8,
      "y ve la barra de cliente, no la de dueño",
      JSON.stringify(cli.barra),
    );
    ok(
      cli.menu.some((m) => /Editar perfil/.test(m)),
      "su menú tiene \"Editar perfil\"",
      JSON.stringify(cli.menu),
    );
    await ba.page.locator('#pmenu button:has-text("Editar perfil")').click();
    await ba.page.waitForTimeout(1800);
    const aCli = await ba.page.evaluate(() => {
      const mo = document.getElementById("mo");
      return {
        hash: location.hash,
        modalAbierto: !!mo && !mo.hidden,
        hayFicha: !!document.querySelector("#pfNombre"),
        estaEnSuCuenta: location.hash === "#/mi-cuenta",
      };
    });
    /* La vista de ajustes del cliente se llama "mi-cuenta" en el mapa de rutas
       (`RT.ajus`), no "ajustes": esa es la del dueño (`RT.cfg`). */
    ok(
      aCli.hash === "#/mi-cuenta",
      "y \"Editar perfil\" lo lleva a su cuenta (RT.ajus = mi-cuenta)",
      JSON.stringify(aCli),
    );
    ok(
      !aCli.hayFicha,
      "no le muestra la ficha pública de barbero (no es su rol)",
      JSON.stringify(aCli),
    );
    ok(ba.jsErr.length === 0, "sin errores de JS", [...new Set(ba.jsErr)].join(" / "));
  }
  /* ---------- los cuatro botones hacen los pasos y el ingreso va al final ----------
     El dueño pidió que "Reservar ahora" (el del encabezado y el de la banda
     dorada) también haga los pasos y pida ingresar, como el botón del barbero. */
  {
    console.log("\n--- los cuatro botones de reserva ---");
    ok(
      /function lbAbreReserva\(\)/.test(src) && /lbAbreReserva\(\);/.test(cuerpoLbReservar),
      '«Reservar ahora» pasa por la misma función que abre la ventana',
      cuerpoLbReservar.slice(0, 110),
    );
    ok(
      !/#\/reservar/.test(cuerpoLbReservar) && !/authOpen = 1/.test(cuerpoLbReservar),
      "y ya no manda al login de una",
      cuerpoLbReservar.slice(0, 110),
    );
    ok(
      /lbAbreReserva\(\);/.test(cuerpoLbReservarBar) && /if \(me && rd\)/.test(cuerpoLbAbre),
      "con sesión sigue yendo a la pantalla del panel",
      cuerpoLbAbre.slice(0, 110),
    );
    ok(/turnoEnVuelo/.test(cuerpoLbAbre) === false, "«Elegir mi turno» no cambia: ya abría la ventana");
    /* El widget compacto de 4 pasos ya no se dibuja desde que la reserva es el
       modal de 6 pasos. Verificado en el navegador: #lbw = 0. */
    /* Sobre el código SIN comentarios: queda un comentario que menciona
       `lbWidget()`/`lbPaint()` para explicar qué se borró, y buscarlo en `src`
       lo encontraría. */
    ok(!/lbWidget|lbPaint|lbSlots|lbPasoOn/.test(sinComentarios), "el widget viejo de 4 pasos se borró entero");
    ok(!/\blbw\b/.test(sinComentarios), "y su estado `lbw` también (le quedan sólo comentarios)");
    ok(!/\.lb-wl\b/.test(lcCodigo) && !/\.lb-chip\b/.test(lcCodigo), "con su CSS (.lb-wl y .lb-chip)");
  }

  /* ---------- el turno no se pierde al registrarse ----------
     Este es el bug de fondo del pedido. El cliente elige servicio, barbero, día y
     hora SIN sesión; el resumen ofrece "Ingresar y confirmar"; se registra y tiene
     que volver al resumen con todo lo que eligió.

     Se rompía en tres lugares distintos, y cada uno lo rompía por su cuenta:

     1. `unsub()` — que corre en cada cambio de sesión — ponía `sel` en cero.
     2. `setup()` repía el día por defecto, sin condición.
     3. el listener de `config/horario` caía el día si no estaba entre los SEIS
        próximos días con turno libre, y el calendario deja reservar todo el mes. */
  console.log("\n--- el turno sobrevive al ingreso ---");
  ok(
    /function unsub\(conservarTurno\)/.test(src) && /if \(!conservarTurno\) sel = \{/.test(src),
    "unsub() conserva la selección si hay un turno en vuelo",
    (src.match(/function unsub\([^)]*\)[\s\S]{0,900}/) || [""])[0].slice(0, 120),
  );
  ok(
    /unsub\(a \? turnoEnVuelo : 0\)/.test(src),
    "y se le pasa la bandera desde onAuthStateChanged",
  );
  ok(
    /if \(!turnoEnVuelo\) sel\.d = days\(\)\[0\] \|\| "";/.test(src),
    "setup() no pisa el día elegido cuando hay un turno en vuelo",
  );
  ok(
    /if \(sel\.d && !diaUsable\(sel\.d\)\)/.test(src) && !/days\(\)\.includes\(sel\.d\)/.test(sinComentarios),
    "y el listener del horario ya no exige que el día esté entre los 6 próximos",
  );
  ok(
    /const diaUsable = \(d\) =>/.test(src) && /turnoEnVuelo = 0/.test(src) && /turnoEnVuelo = 1/.test(src.replace(/turnoEnVuelo = WZ\.resumir \? 1 : 0/, "turnoEnVuelo = 1")),
    "la bandera se enciende y se apaga en los dos momentos justos",
  );

  /* ---------- 36. SSJ Barber, un solo barbero que es el dueño ----------
     Cambió la marca (de "Codigo Barber" a "SSJ Barber"), se borró el número de
     WhatsApp de Yan, y el dueño pasó a ser el único barbero de la barbería. */
  console.log("\n--- 36. la marca nueva ---");
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const manifiesto = fs.readFileSync(path.join(__dirname, "..", "manifest.json"), "utf8");
  const robots = fs.readFileSync(path.join(__dirname, "..", "robots.txt"), "utf8");
  const mapa = fs.readFileSync(path.join(__dirname, "..", "sitemap.xml"), "utf8");
  const conf = fs.readFileSync(path.join(__dirname, "..", "src", "config.js"), "utf8");

  ok(
    !/Codigo Barber|Código Barber/i.test(html + manifiesto + robots + mapa),
    "no queda ni una mención de la marca vieja en index, manifest, robots ni sitemap",
    [html, manifiesto, robots, mapa]
      .map((t, i) => ["index", "manifest", "robots", "sitemap"][i] + ": " + ((t.match(/C[oó]digo Barber/gi) || []).length))
      .join(" · "),
  );
  ok(
    /export const NOMBRE = "SSJ Barber"/.test(conf) && /<title>SSJ Barber \| /.test(html),
    "NOMBRE y el <title> son los nuevos",
  );
  ok(
    JSON.parse(manifiesto).name.indexOf("SSJ") === 0 && JSON.parse(manifiesto).short_name === "SSJ Barber",
    "el manifest dice SSJ en los dos campos (el del ícono del celular es short_name)",
    JSON.stringify(JSON.parse(manifiesto).name) + " / " + JSON.stringify(JSON.parse(manifiesto).short_name),
  );
  ok(/robots\.txt de SSJ Barber/.test(robots) && /sitemap\.xml de SSJ Barber/.test(mapa), "los encabezados de robots y sitemap también");

  /* El dominio NO se cambió a propósito (canonicals rotos si el dominio nuevo
     no existe todavía). Lo que se comprueba es que quede DOCUMENTADO el porqué,
     porque un TODO sin explicación se lee como un olvido. */
  ok(
    /TODO[\s\S]{0,700}DOMINIO|cambiar el dominio|cambio de dominio/i.test(conf) &&
      /codigobarber\.com\.ar/.test(conf),
    "el dominio sigue siendo el viejo, pero con el porqué anotado",
    (conf.slice(conf.indexOf("DOMINIO") - 420, conf.indexOf("DOMINIO") + 40) || "").replace(/\s+/g, " ").slice(0, 110),
  );
  ok(
    /LOGO = "assets\/logo-256\.png"; \/\/ TODO/.test(conf) && /hasta que llegue el nuevo/.test(conf),
    "y el logo sigue siendo el viejo, con el mismo aviso (viene el nuevo)",
  );
  ok(
    /CLOUD_NAME = "lvrsdw0h"/.test(conf) && /CLOUD_PRESET = "codigo_barber_1"/.test(conf),
    "los identificadores de Cloudinary NO se renombraron (son recursos que ya existen)",
  );

  /* ---------- 36. Y un solo contacto: Roman ---------- */
  console.log("\n--- 36. un solo contacto ---");
  const confCodigo = conf.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  ok(!/WA_YAN|\bYan\b/.test(sinComentarios + confCodigo), "no queda Yan en ninguna parte del código", (confCodigo.match(/Yan[^\n]{0,40}/) || []).join(""));
  const listaWa = (conf.match(/export const WA_LISTA = \[([\s\S]*?)\];/) || [])[1] || "";
  ok(
    (listaWa.match(/\{/g) || []).length === 1,
    "WA_LISTA tiene un solo número",
    listaWa.trim(),
  );
  const numWa = (conf.match(/export const WHATSAPP = "(\d+)"/) || [])[1];
  const numRoman = (conf.match(/WA_LISTA = \[\{ n: "Roman", num: "(\d+)" \}\]/) || [])[1];
  ok(
    !!numWa && numWa === numRoman && numWa === "5493757699335",
    "y es el de Roman: el de lista de espera, el aviso y el contacto son el mismo",
    "WHATSAPP=" + numWa + "  lista=" + numRoman,
  );

  /* ---------- 36. el dueño es el único barbero ---------- */
  console.log("\n--- 36. el dueño es el barbero ---");
  ok(
    /const esElDueño = \(b\) =>/.test(sinComentarios) && /b\.yo === 1/.test(sinComentarios),
    "hay UN helper que decide si una ficha es la del dueño",
  );
  ok(
    /pd: esElDueño\(b\) \? 100 : b\.pd/.test(sinComentarios),
    "el reparto guarda 100% cuando cobra la ficha del dueño",
  );
  ok(
    /pd: esElDueño\(b\) \? 100 : \+b\.pd/.test(sinComentarios),
    "y también al guardar la lista, por si alguien edita el campo a mano",
  );
  ok(
    /data-act="feYo"/.test(src) && /marcarYo/.test(src),
    "hay un botón para marcar la ficha como tuya",
  );
  /* El error de este lote: la primera versión del botón quedó en una variable
     (`right`) que NUNCA se usa, y no se veía en ninguna pantalla. Se comprueba
     que el botón esté en el `<details>` que sí se dibuja, y que esté una sola
     vez en el archivo: si aparece dos, es que se copió al lado muerto. */
  const bloqueDetalles = (src.match(/<details[^`]*?Editar porcentajes[\s\S]*?<\/details>/) || [""])[0];
  ok(
    /data-act="feYo"/.test(bloqueDetalles),
    "el botón «Soy yo» está en el bloque que se ve, no en código muerto",
    "el <details>|match tiene " + bloqueDetalles.length + " caracteres",
  );
  ok(
    (src.match(/data-act="feYo"/g) || []).length === 1,
    "y aparece una sola vez en todo el archivo",
    (src.match(/data-act="feYo"/g) || []).length + " veces",
  );
  ok(
    !/(?<![A-Za-z0-9_$])const right =/.test(sinComentarios),
    "y el bloque muerto `right` (donde había quedado la primera versión) está borrado",
  );
  ok(
    /!fe\.bs\.some\(\(b\) => esElDueño\(b\)\)/.test(sinComentarios) && /data-act="soyBarbero"/.test(src),
    "si no hay ninguna ficha marcada como tuya, sale «Yo también soy el barbero»",
  );
  /* `cuerpoMkBar` y no el archivo entero: `esElDueño` también menciona
     OWNER_UID, así que buscando en todo el main.js el guarda de mkBar se
     encontraría siempre y la comprobación daría verde con el guarda borrado.

     Se recorta a mano y no con el helper `cuerpo()`: ese toma los dos extremos
     y lee siempre de `src`, así que no sirve para leer de `sinComentarios`. */
  const cuerpoMkBar = sinComentarios.slice(
    sinComentarios.indexOf("async mkBar(uid) {"),
    sinComentarios.indexOf("  askQuitBar(uid) {"),
  );
  ok(cuerpoMkBar.length > 100, "se pudo recortar la función mkBar", cuerpoMkBar.length + " caracteres");
  ok(
    /if \(uid === OWNER_UID\)/.test(cuerpoMkBar) && /ya sos el /.test(cuerpoMkBar),
    "y «Hacer barbero» rechaza tu propia cuenta, para no duplicarte en la lista",
  );
  /* El reparto tiene que salir de los PROPIOS cobros, no de buscar al barbero por
     nombre. Antes la tabla sacaba un porcentaje (`borPct`) y con el dueño como único
     barbero mostraba 0 % y $0 al lado de sus propios cortes, porque su dinero estaba
     en la parte del dueño.

     Ahora (lote 39) la tabla muestra el neto de cada persona y no lleva porcentaje:
     el del dueño es `OO`, la parte que se quedó de todos los cobros, y el de cada
     barbero es `t - o`. Lo que no puede volver es el emparejamiento por nombre. */
  ok(
    !/fe\.bs\.find\(\(b\) => b\.n ===/.test(sinComentarios) && /t: x\.t - x\.o/.test(sinComentarios),
    "el reparto de la tabla sale de los cobros, no de buscar al barbero por nombre",
  );
  ok(
    !/borPct/.test(sinComentarios),
  "y ya no hay porcentaje por barbero en la tabla, que con el dueño solo daba 0 %",
);

  /* ---------- 36. la publicación de la lista no puede perder la ficha ----------
     La foto del barbero, el oficio, la descripción y sus redes viven en la lista
     PÚBLICA (`config/barberos`). El dueño la republica cada vez que entra al
     panel, y el reparto se hacía sobre `BARS`, que es la lista combinada con las
     fotos.

     `BARS` la arman listeners distintos: uno a nivel de módulo, otro al iniciar
     sesión y otro con `config/finanzas`. Este último no tiene orden garantizado
     con los otros: si gana la carrera, `BARS` está vacío y la republicación
     escribía la lista sin foto ni descripción, y la tarjeta del barbero quedaba
     en blanco en la web. */
  ok(
    /yaPublicados\.find\(\(x\) => x\.id === b\.id\)/.test(sinComentarios),
    "la republicación reparte sobre la lista ya publicada, no sobre BARS",
    (sinComentarios.match(/const prev = [^;]{0,90}/) || [""])[0],
  );
  ok(
    /Array\.isArray\(PUB\.barberos\) \? PUB\.barberos : \[\]/.test(sinComentarios),
    "y si tampoco hay lista publicada, usa una vacía en vez de romper",
  );
  ok(/if \(pub\.length\)/.test(sinComentarios), "sigue sin publicar una lista vacía");

/* ---------- 37. el dueño es el dueño Y el barbero ---------- */
  /* Recorta entre dos marcas, sobre el texto que se le pase. El helper `cuerpo`
     de arriba lee siempre de `src`, y para buscar en el código sin comentarios
     hace falta esto. Un recorte que devuelve "" no es un bug del código: es
     una comprobación que no encontró lo que buscaba, y hay que verlo antes de
     cambiar el código. */
  const trozo = (de, desde, hasta) => de.slice(de.indexOf(desde), de.indexOf(hasta, de.indexOf(desde)));
console.log("\n--- 37. el dueño también es el barbero ---");

/* El dueño NO tenía "Editar perfil" en su menú: la condición era
   `if (!isOwner())`. Es decir, el único que podía tener foto y perfil público de
   barbero era... cualquiera menos él. */
const cuerpoMenu = trozo(sinComentarios, "function menuPerfil()", "function R()");
ok(
  /if \(isOwner\(\)\) \{[\s\S]{0,300}data-act="miPerfilWeb"/.test(cuerpoMenu),
  "el dueño tiene \"Editar perfil\" (su ficha pública de barbero)",
  cuerpoMenu.slice(0, 110),
);
ok(
  /data-act="soyBarbero"/.test(cuerpoMenu),
  "y el botón de colocarse como barbero",
);
ok(
  /Ya soy el barbero/.test(cuerpoMenu) && /Yo también soy el barbero/.test(cuerpoMenu),
  "el botón cambia de texto según esté o no en el equipo",
);
ok(
  /\} else\s+items\.push\([\s\S]{0,160}miPerfilWeb/.test(cuerpoMenu),
  "y el barbero que no es dueño lo sigue teniendo",
);

/* El botón tiene que hacer algo: marca la ficha existente en vez de agregar una
   segunda, y al terminar abre el perfil, que es el paso que falta para que la
   foto aparezca. */
const cuerpoSoyBarbero = trozo(sinComentarios, "  soyBarbero() {", "  async gAdd(");
ok(cuerpoSoyBarbero.length > 400, "se pudo recortar la acción soyBarbero()", cuerpoSoyBarbero.length + " caracteres");
ok(
  /FN\.bs\.find\(\(b\) => !esElDueño\(b\)\)/.test(cuerpoSoyBarbero) && /FN\.bs\.map\(/.test(cuerpoSoyBarbero),
  "marca la ficha que YA está en el equipo, en vez de agregar una segunda",
);
ok(
  /\[...FN\.bs, \{ id: OWNER_UID/.test(cuerpoSoyBarbero),
  "y si la lista está vacía, crea una con el UID del dueño",
);
ok(
  /abrirPerfil\(\);/.test(cuerpoSoyBarbero),
  "y al terminar abre el perfil: sin foto, la tarjeta sale con \"[Foto]\"",
);
ok(
  /\(U && U\.nm\)/.test(cuerpoSoyBarbero) && /Falta tu nombre/.test(cuerpoSoyBarbero),
  "el nombre sale de SU perfil; si no lo tiene, avisa en vez de inventar uno",
);

/* `marcarYo` tiene que guardar el uid además de la marca: es lo que hace que la
   foto se encuentre, porque la ficha del dueño en la lista quedó con un id
   autogenerado que no es su uid. */
const cuerpoMarcarYo = trozo(sinComentarios, "  async marcarYo(id, yo) {", "  soyBarbero() {");
ok(
  /\{ \.\.\.b, yo: 1, uid: OWNER_UID \}/.test(cuerpoMarcarYo),
  "marcar guarda también el uid del dueño",
  cuerpoMarcarYo.slice(0, 110),
);

/* La foto se busca por id y, si no está, por uid. Sólo por id era el motivo de
   que la foto no apareciera nunca. */
ok(
  /FOTOS\[b\.id\]\) \|\|/.test(sinComentarios) && /b && b\.uid && FOTOS\[b\.uid\]/.test(sinComentarios),
  "la foto de la tarjeta se busca por id y también por uid",
);
ok(
  /esElDueño\(b\) && FOTOS\[OWNER_UID\]/.test(sinComentarios),
  "y si la ficha es del dueño, también bajo el uid DEL DUEÑO",
  "sin esta puerta la foto que sube el dueño no se encuentra nunca: la ficha la",
  "crea la cuenta del barbero, así que su uid es el de ese barbero, no el del dueño",
);

/* Y el orden importa: si la ficha tiene su propia foto, esa gana. La del dueño
   es el último recurso, no el primero. */
ok(
  sinComentarios.indexOf("FOTOS[b.id]") < sinComentarios.indexOf("FOTOS[b.uid]") &&
    sinComentarios.indexOf("FOTOS[b.uid]") < sinComentarios.indexOf("FOTOS[OWNER_UID]"),
  "el orden es: id, después uid, y el del dueño sólo si no apareceu ninguna",
);
ok(
  /x\.id === me\.uid \|\| \(x\.uid && x\.uid === me\.uid\)/.test(sinComentarios),
  "y el formulario de perfil abre con los datos cargados aunque el id sea otro",
);
ok(
  /isOwner\(\) && esElDueño\(x\)/.test(sinComentarios),
  "y el dueño edita la ficha que él marcó, que es la que importa",
);

/* Que el dueño siga teniendo TODO lo de dueño. */
const cuerpoRtOk = trozo(sinComentarios, "const rtOk = (v) =>", "const rtView");
const vistasDueño = (cuerpoRtOk.match(/\[\s*"bar"[^\]]*\]/) || [""])[0];
const lista = (vistasDueño.match(/"[a-z]+"/g) || []).map((x) => x.replace(/"/g, ""));
const listaBarbero = ((cuerpoRtOk.match(/:\s*\["bar"[^\]]*\]/) || [""])[0].match(/"[a-z]+"/g) || []).map((x) => x.replace(/"/g, ""));
ok(
  listaBarbero.every((v) => lista.includes(v)),
  "el dueño tiene TODAS las vistas que tiene un barbero",
  "dueño=" + JSON.stringify(lista) + "  barbero=" + JSON.stringify(listaBarbero),
);
ok(
  ["dash", "bars", "cfg", "mens"].every((v) => lista.includes(v)),
  "y además las suyas propias: dashboard, barberos, ajustes y mensajes",
  JSON.stringify(lista),
);

/* El email vacío no puede romper el aviso de privacidad. */
ok(
  /const mailto = \(\) =>/.test(sinComentarios) && /sin definir todavía/.test(sinComentarios),
  "el email vacío se muestra como \"(sin definir todavía)\" en vez de un mailto roto",
);
/* El patrón acaba en `;\r?\n` y no en `;\n`.

   `src/main.js` tiene finales de línea CRLF, así que `;\n` no aparecía nunca y el
   recorte del helper no quitaba nada: la comprobación se ponía roja por el mailto
   que está DENTRO del helper, que es justo donde tiene que estar. Un patrón que
   depende de cómo están guardados los finales de línea falla sin que cambie nada
   de lo que se quiere medir — y es peor cuando falla, porque manda a buscar un
   bug donde no lo hay. */
const mailtoFuera = sinComentarios.replace(/const mailto[\s\S]*?;\r?\n/, "");
ok(
  !/mailto:\$\{esc\(EMAIL\)\}/.test(mailtoFuera),
  "y no queda ningún mailto con EMAIL directo fuera del helper",
  "quedan " + (mailtoFuera.match(/mailto:\$\{esc\(EMAIL\)\}/g) || []).length + " fuera del helper",
);
ok(
  /export const EMAIL = "";/.test(conf) && /TODO\(dueño\): poner el email/.test(conf),
  "el email quedó vacío, esperando que lo pase, con el apartado al lado",
);
/* ---------- 38. los gastos: el alquiler se puede cargar ---------- */
console.log("\n--- 38. los gastos: el alquiler ---");

/* El bloque de gastos estaba escrito y NO se dibujaba. La acción gAdd guardaba
   bien contra Firestore, pero no había forma de llegar a ella: la pantalla de
   Finanzas no tenía ni el formulario, ni la lista, ni los números de Gastos y
   Neto. Eran cuatro variables definidas y sin usar, y el alquiler —la razón de
   existir de esta pantalla para un dueño que alquila el local— no se podía
   cargar. */
/* `cuerpoFin39` es el recorte de `finH` que usan las secciones 38 y 39. Se define
   acá, en la 38, porque va antes: usarlo sin declarar daba "Cannot access before
   initialization" y la prueba se caía entera ahí. */
const cuerpoFin39 = trozo(sinComentarios, "function finH()", "function cfgH()");
const cuerpoFin = cuerpoFin39;

ok(/const formGastos =/.test(cuerpoFin), "el bloque de gastos está escrito");
ok(
  /\$\{formGastos\}/.test(cuerpoFin),
  "y SE DIBUJA: aparece en el HTML que se pinta",
  cuerpoFin.slice(-200),
);

/* Dibujarse tiene que ser dentro de la rama del dueño: los gastos son del
   negocio y las reglas no dejan escribir a un barbero.

   Se compara con la rama del cliente en vez de con una cantidad de espacios: la
   primera versión buscaba la cadena exacta "own\n      ?" y devolvió -1 porque
   la sangría es de diez. Un patrón que depende del formato falla sin que cambie
   nada de lo que se quiere medir. */
const iOwner38 = cuerpoFin.indexOf("formGastos = own");
const iGast38 = cuerpoFin.indexOf("Gastos</h2>");
ok(
  iOwner38 >= 0 && iGast38 > iOwner38,
  "y el formulario es sólo del dueño: la lista de gastos es para los dos",
  "formGastos=" + iOwner38 + "  pintado=" + iGast38,
);

/* Los tres nombres viejos. Que no quede ninguno es lo que de verdad importa: si
   queda uno definido y sin usar, el próximo lote vuelve a pintar el equivocado.
   Ya pasó dos veces en este archivo. */
["gastoBlock", "gastosLista", "gastoForm"].forEach((v) => {
  ok(
    !new RegExp("const " + v + " =").test(sinComentarios),
    "no queda la copia muerta " + v,
    "definida y nunca usada: el error que ya pasó dos veces acá",
  );
});

/* El formulario tiene las dos cosas que hacen falta: qué se gastó y cuánto. */
ok(
  /id="gc"[^>]*Concepto \(alquiler/.test(cuerpoFin),
  "el campo del concepto menciona el alquiler",
);
ok(/id="gm"/.test(cuerpoFin), "y está el campo del monto");
ok(/data-act="gAdd"/.test(cuerpoFin), "con su botón");

/* Con la lista vacía, después del botón no decía nada: no se distinguía "falta
   cargar uno" de "no se está mostrando nada". */
ok(
  /Todavía no hay gastos en este período/.test(cuerpoFin),
  "y si no hay gastos, lo dice en vez de dejar un hueco en blanco",
);
ok(/data-act="askGDel"/.test(cuerpoFin), "cada gasto se puede borrar desde la lista");

/* Las tarjetas de arriba estaban fijas en tres (Facturado / Caja de hoy / Cortes
   del período) y kpis quedaba sin usar. Ahora salen de kpis, que además del
   dueño tiene su rama para el barbero. */
ok(
  /<div class="kpis">\$\{kpis\}<\/div>/.test(sinComentarios),
  "las tarjetas de arriba usan kpis",
);
ok(!/kp\("Caja de hoy"/.test(cuerpoFin), "y se fue la lista fija de tres tarjetas");
ok(/kp\("Gastos", \$\$\(GT\)\)/.test(cuerpoFin), "con el total de gastos a la vista");
ok(
  /kp\("Neto del negocio", \$\$\(NETO_TOTAL\)\)/.test(cuerpoFin),
  "y con lo que queda después de restarlos",
);
ok(
  /kp\("Mi neto", \$\$\(filas\[0\]\.neto\)\)/.test(cuerpoFin),
  "y el barbero ve el suyo, no el del negocio",
);

/* El signo negativo. El formateador de dinero ($$) ponía el peso antes del signo,
   y el neto es facturado menos gastos: da negativo apenas el alquiler pesa más que
   lo facturado, que al empezar es casi siempre. No se notaba antes porque esa
   tarjeta nunca llegó a pintarse. */
const cuerpoDinero = trozo(sinComentarios, "const $$ = (n) => {", "\n\n");
ok(
  /const neg = v < 0/.test(cuerpoDinero) && /\(neg \? "-" : ""\) \+ "\$"/.test(cuerpoDinero),
  "el signo negativo va antes del peso: -$180.000 y no $-180.000",
  cuerpoDinero.slice(0, 140),
);
ok(
  /!Number\.isFinite\(v\)\) return "\$0"/.test(cuerpoDinero),
  "y un valor que no es número sigue dando $0",
);

/* Escritura sólo del dueño; la lectura se abrió en el lote 39 para que cada
   barbero vea los gastos que están a su nombre y se los reste de su ganancia.
   La guarda del cliente no es por seguridad: es para que un barbero reciba una
   frase y no un permission-denied. */
ok(
  /match \/gastos\/\{id\}/.test(reglas) && /allow create, update, delete: if isOwner\(\)/.test(reglas),
  "las reglas dejan ESCRIBIR los gastos sólo al dueño",
);
ok(
  /allow read: if isSignedIn\(\)/.test(reglas),
  "pero leerlos puede cualquier barbero, para ver los suyos",
);
const cuerpoGAdd = trozo(sinComentarios, "  async gAdd() {", "  askGDel(id) {");
ok(
  /if \(!isOwner\(\)\)/.test(cuerpoGAdd),
  "y el cliente avisa, en vez de dejar que rebote el permiso",
);
ok(/Los gastos los carga el due/.test(cuerpoGAdd), "con un mensaje que dice qué hacer");
ok(
  /if \(!isOwner\(\)\)/.test(trozo(sinComentarios, "  askGDel(id) {", "  /* lista de espera */")),
  "y lo mismo al borrar",
);

/* Borra los gastos de prueba de esta pantalla, y los cuenta. Va en el `finally`
   de las comprobaciones: si una falla o la prueba se cae, el borrado tiene que
   pasar igual. */
const borrarPruebas = async () => {
  for (let n = await p38.evaluate(() => document.querySelectorAll('[data-act="askGDel"]').length); n > 0; n--) {
    await p38.evaluate(() => {
      const x = [...document.querySelectorAll('[data-act="askGDel"]')];
      if (x.length) x[0].click();
    });
    await p38.waitForTimeout(1300);
    await p38.evaluate(() => {
      const x = [...document.querySelectorAll('#mo button')].find((y) => /Eliminar/i.test(y.innerText));
      if (x) x.click();
    });
    await p38.waitForTimeout(3000);
  }
  return p38.evaluate(() => document.querySelectorAll('.scr .row').length);
};

/* ---------- en la pantalla ---------- */
const { ctx: c38, page: p38, jsErr: e38 } = await entrar(b, env.DUENO_EMAIL, env.DUENO_PASSWORD);
await p38.evaluate(() => {
  location.hash = "#/finanzas";
});
await p38.waitForTimeout(3000);

/* Si quedara un gasto de una corrida anterior, todo lo de abajo mediría el doble
   y daría rojo por un gasto bien cargado. Mejor verlo claro que acordar. */
const sucios38 = await p38.evaluate(() => [...document.querySelectorAll(".scr .row")].length);
ok(sucios38 === 0, "no quedó ningún gasto de una corrida anterior", sucios38 + " gastos; si hay, es que una prueba se cayó antes de borrar");
if (sucios38) await borrarPruebas();
try {

const fx = await p38.evaluate(() => ({
  concepto: !!document.querySelector("#gc"),
  monto: !!document.querySelector("#gm"),
  boton: !!document.querySelector('[data-act="gAdd"]'),
  tarjetas: [...document.querySelectorAll(".kpi")].map((k) => k.innerText.replace(/\s+/g, " ").trim()),
  altoBoton: (() => {
    const b = document.querySelector('[data-act="gAdd"]');
    return b ? Math.round(b.getBoundingClientRect().height) : 0;
  })(),
  desborda: document.documentElement.scrollWidth > window.innerWidth + 1,
}));
ok(fx.concepto && fx.monto && fx.boton, "en pantalla están los dos campos y el botón");
ok(fx.tarjetas.some((t) => /GASTOS/i.test(t)), "y las tarjetas muestran los GASTOS", JSON.stringify(fx.tarjetas));
ok(fx.tarjetas.some((t) => /NETO/i.test(t)), "y el neto", JSON.stringify(fx.tarjetas));
ok(fx.altoBoton >= 44, "el botón es tocable (mínimo 44 px)", fx.altoBoton + " px");
ok(!fx.desborda, "y la pantalla no desborda de lado");

/* El signo: se carga un gasto y se mira cómo queda el neto. El dato es
   inventado a propósito, así que se borra al final: queda comprobado que el
   camino entero anda, no que el alquiler sea ese número. */
await p38.fill("#gc", "Alquiler del local (prueba 38)");
await p38.fill("#gm", "180000");
await p38.click('[data-act="gAdd"]');
await p38.waitForTimeout(4000);

const fx2 = await p38.evaluate(() => ({
  aparece: document.body.innerText.indexOf("prueba 38") >= 0,
  tarjetas: [...document.querySelectorAll(".kpi")].map((k) => k.innerText.replace(/\s+/g, " ").trim()),
  monto: /180\.000/.test(document.body.innerText),
}));
ok(fx2.aparece, "un gasto cargado aparece en la lista");
ok(fx2.monto, "con su monto");
ok(
  fx2.tarjetas.some((t) => /-\$/.test(t)),
  "y el neto negativo se escribe con el signo adelante del peso",
  JSON.stringify(fx2.tarjetas),
);
ok(
  !fx2.tarjetas.some((t) => /\$\s*-/.test(t)),
  "no queda ningún $-180.000",
  JSON.stringify(fx2.tarjetas),
);

/* El borrado lo hace borrarPruebas() en el finally de más abajo, y se comprueba
   ahí. Quedaba después de las comprobaciones y no pasaba si una fallaba. */
/* Los errores se juntan acá y no adentro de `page.evaluate`: esa función corre en
   el navegador y `e38` vive en Node, así que la referencia lanzaba ReferenceError
   en vez de medir lo que se le pedía. */
const errores38 = [...new Set(e38)];
ok(
  errores38.length === 0,
  "sin errores de JS en todo el camino",
  errores38.join(" | "),
);
/* El contexto se cierra en el `finally`, después de borrar. */

} finally {
  /* Va en el finally y no al final: si una comprobación falla o la prueba se cae,
     los gastos de prueba tienen que borrarse igual. Ya se llegaron a ver $180.000
     y $25.000 duplicados en la base del dueño por una corrida cortada, y las
     comprobaciones de arriba leían el doble y daban rojo por un gasto bien
     cargado. */
  const quedan38 = await borrarPruebas();
  ok(quedan38 === 0, "los gastos de prueba se borran y no quedan en la base", quedan38 + " gastos");
  await c38.close();
}

/* ---------- 39. cada gasto es de alguien, y se descuenta de SU neto ---------- */
console.log("\n--- 39. el gasto es de una persona ---");

/* El dueño lo pidió así: el alquiler es un gasto DE ÉL, porque alquila el local
   aunque sea el dueño de la barbería. Y lo mismo para cada barbero: cada uno
   descuenta lo que gasta de SU ganancia, para llevar el dinero de cada uno por
   separado. El porcentaje de la ganancia neta no lo pidió y se dejó de lado. */
/* `cuerpoFin39` ya está declarado arriba, en la sección 38, que va antes. */

ok(/para: gp,/.test(sinComentarios), "el gasto se guarda con de quién es");
ok(/gp = "dueno"/.test(sinComentarios), "y por defecto es del dueño");
ok(/^ {2}gsetP\(k\) \{$/m.test(sinComentarios), "hay una acción para cambiarlo");
ok(/data-act="gsetP"/.test(cuerpoFin39), "y un botón por persona en la pantalla");
ok(/¿De quién es el gasto\?/.test(cuerpoFin39), "que pregunta de quién es");

/* El gasto sin `para` —los que había cargados antes— es del dueño. Es lo mismo
   que si fuera explícito, y deja los números viejos como estaban. */
ok(
  /esDelDueño = \(g\) => !g\.para \|\| g\.para === "dueno"/.test(cuerpoFin39),
  "un gasto sin etiqueta cuenta como del dueño (los viejos siguen siendo suyos)",
);

/* La clave es la misma que usa el cobro, así los dos se cruzan sin traducir
   nombres. */
ok(
  /gstDe = \(k\) => GL\.filter\(\(g\) => !esDelDueño\(g\) && g\.para === k\)/.test(cuerpoFin39),
  "los gastos de un barbero se buscan por su misma clave que usa el cobro",
);

/* El dueño NO es una fila más de la tabla: su dinero es `OO`, la parte que se
   quedó de todos los cobros. Si además aparece como barbero y se lo sumara otra
   vez, se le contaría dos veces. */
ok(
  /\[{ n: etqDueño, c: L\.length, t: OO, g: gstDueño \}\]\.concat\(/m.test(cuerpoFin39),
  "el dueño es una fila sola, con su parte de todos los cobros",
);
ok(
  /esDueElGrupo = \(k\) => \{[\s\S]{0,120}k === OWNER_UID \|\|/.test(cuerpoFin39),
  "y si aparece como barbero no se lo vuelve a sumar",
);
ok(
  /GR\.filter\(\(x\) => !esDueElGrupo\(x\.k\)\)\.map/.test(cuerpoFin39),
  "los barberos que NO son él van aparte",
);

/* La tabla: cada persona con facturado, gastos y neto, y una fila de total. */
ok(/Ganancia de cada uno/.test(cuerpoFin39), "la tabla se llama 'Ganancia de cada uno'");
ok(/Total del negocio/.test(cuerpoFin39), "con una fila de total");
ok(
  !/Porcentaje por barbero/.test(sinComentarios),
  "y se fue la tabla de porcentajes, que con el dueño como único barbero decía '0 %' y '$0' al lado de sus propios cortes",
);

/* Los números tienen que sumar: la suma de los netos es el neto del negocio. */
ok(
  /NETO_TOTAL = filas\.reduce\(\(a, x\) => a \+ x\.neto, 0\)/.test(cuerpoFin39),
  "el total se calcula sumando los netos de cada uno, no por otra cuenta",
);
ok(/filas\.forEach\(\(x\) => \(x\.neto = x\.t - x\.g\)\)/.test(cuerpoFin39), "y el neto de cada uno es su facturado menos lo suyo");

/* El editor de porcentajes es un control que ya funcionaba. Al reescribir la
   pantalla quedó con un `</div>` de más y "Guardar porcentajes" se fue fuera de
   la tarjeta: hay que comprobar que sigue adentro. */
ok(
  /Guardar porcentajes<\/button><\/details>`\s*\r?\n\s*: ""\) \+\s*\r?\n\s*`<\/div>`/.test(cuerpoFin39),
  "el editor de porcentajes sigue dentro de la tarjeta",
);
ok(
  !/Marcarme como el dueño/.test(sinComentarios),
  "y con las etiquetas que tenía (no las que se me inventaron)",
);

/* Un barbero puede VER sus gastos (para restárselos) pero no escribirlos. */
const iRamaB = cuerpoFin39.indexOf("const mias");
ok(iRamaB > 0, "la vista del barbero busca los gastos que son suyos");
ok(
  /FN\.bs\.filter\(\(b\) => b\.id === me\.uid \|\| \(b\.uid && b\.uid === me\.uid\)\)/.test(cuerpoFin39),
  "sumando todas sus claves, no sólo una",
);
ok(
  /formGastos = own[\s\S]{0,80}selectorPersona/.test(cuerpoFin39),
  "y el formulario para cargar es sólo del dueño",
);

/* Las reglas: leer sí, escribir no. */
ok(
  /match \/gastos\/\{id\} \{\s*\r?\n\s*allow read: if isSignedIn\(\);\s*\r?\n\s*allow create, update, delete: if isOwner\(\);/.test(reglas),
  "las reglas dejan LEER los gastos a cualquier barbero y escribirlos sólo al dueño",
);

/* Y que el barbero traiga la consulta: si no, no ve nada aunque las reglas lo dejen. */
const cuerpoCarga = trozo(sinComentarios, "if (ad) {", "} else if (SB) {");
const hayQueryBarbero =
  /query\(collection\(db, "gastos"\), where\("hechoEn", ">=", st\)\),\s*\r?\n\s*\(l\) => \(GA = l\),\s*\r?\n\s*\);/.test(
    sinComentarios.slice(sinComentarios.indexOf("} else if (SB) {"), sinComentarios.indexOf("function setup(")),
  );
ok(hayQueryBarbero, "y el barbero consulta los gastos en su rama, no sólo el dueño");

/* ---------- la aritmética, con dos personas ---------- */
const DUE39 = "LQ7IkEfxEKNXajx4SEs378n390i2";
const OTRO39 = "BdXQ0wSy8SBbaONeRA0JzFLwFR2";
const HOY39 = new Date().toLocaleDateString("sv-SE");
const { ctx: c39, page: p39, jsErr: e39 } = await entrar(b, env.DUENO_EMAIL, env.DUENO_PASSWORD);
await p39.evaluate(() => {
  location.hash = "#/finanzas";
});
await p39.waitForTimeout(2500);

/* La lista y los cobros van por memoria: en la base hay una sola ficha (la del
   dueño), y agregar un barbero de verdad dejaría rastro. Lo que se prueba es la
   aritmética, no la base. */
await p39.evaluate(
  ({ DUE39, OTRO39 }) =>
    window.__test.setFn(
      [{ id: DUE39, n: "Juan", pd: 100, yo: 1 }, { id: OTRO39, n: "Barbero", pd: 50 }],
      50,
    ),
  { DUE39, OTRO39 },
);
await p39.waitForTimeout(1400);
await p39.waitForTimeout(1400);

/* Se anota cuánto vendió HOY la base de verdad ANTES de inyectar: el panel
   mezcla los cobros reales del día con los de prueba (van por el mismo uid
   y la misma fecha). La cuenta no es "$35.000 y punto" sino "lo que ya había
   más $35.000". Antes el número redondo salía siempre porque ningún día había
   ventas reales del dueño; el 25/10 el dueño facturó de verdad y la prueba
   daba rojo por datos reales, no por un bug. */
const medir39 = () =>
  p39.evaluate(() => {
    const entero = (s) => {
      const t = String(s).replace(/\u2212/g, "-").replace(/[^0-9-]/g, "");
      return t === "" || t === "-" ? 0 : parseInt(t, 10) || 0;
    };
    const kpi = (re) => {
      const x = [...document.querySelectorAll(".kpi")]
        .map((k) => k.innerText.replace(/\s+/g, " ").trim())
        .find((y) => re.test(y));
      if (!x) return 0;
      const m = x.match(/(-?[0-9][0-9.]*)/);
      return m ? entero(m[1]) : 0;
    };
    const fila = (re) => {
      const x = [...document.querySelectorAll(".clin:not(.chead)")]
        .map((f) => f.innerText.replace(/\s+/g, " ").trim())
        .find((y) => re.test(y));
      if (!x) return 0;
      const m = x.match(/(-?[0-9][0-9.]*)/);
      return m ? entero(m[1]) : 0;
    };
    return {
      tarjetas: [...document.querySelectorAll(".kpi")].map((k) => k.innerText.replace(/\s+/g, " ").trim()),
      filas: [...document.querySelectorAll(".clin:not(.chead)")].map((x) => x.innerText.replace(/\s+/g, " ").trim()),
      facturado: kpi(/^FACTURADO/),
      juan: fila(/^Juan/),
      bar: fila(/^Barbero/),
    };
  });
const real39 = await medir39();

await p39.evaluate(
  ({ OTRO39, DUE39, HOY39 }) =>
    window.__test.setVentas([
      { bid: OTRO39, bn: "Barbero", pd: 50, precio: 10000, serv: "Corte", lista: 10000, medio: "Efectivo", d: HOY39, t: "10:00", hechoEn: 1 },
      { bid: OTRO39, bn: "Barbero", pd: 50, precio: 10000, serv: "Corte", lista: 10000, medio: "Efectivo", d: HOY39, t: "11:00", hechoEn: 2 },
      { bid: DUE39, bn: "Juan", pd: 100, precio: 15000, serv: "Corte", lista: 15000, medio: "Efectivo", d: HOY39, t: "12:00", hechoEn: 3 },
    ]),
  { OTRO39, DUE39, HOY39 },
);
await p39.waitForTimeout(1800);

const antes39 = await medir39();
const sube39 = (cam, cuantito) => antes39[cam] - real39[cam] === cuantito;
ok(
  sube39("facturado", 35000),
  "con los cobros de prueba, lo facturado SUBE $35.000 (lo real del día va aparte)",
  `antes: ${real39.facturado} ($${real39.facturado.toLocaleString("es-AR")}), después: ${antes39.facturado} ($${antes39.facturado.toLocaleString("es-AR")}); tarjetas ${JSON.stringify(antes39.tarjetas)}`,
);
ok(
  sube39("juan", 25000),
  "el dueño suma $25.000: lo suyo ($15.000) más la mitad de lo del barbero ($10.000)",
  `antes: ${real39.juan}, después: ${antes39.juan}; filas ${JSON.stringify(antes39.filas)}`,
);
ok(
  sube39("bar", 10000),
  "y el barbero suma $10.000: la mitad de sus $20.000",
  `antes: ${real39.bar}, después: ${antes39.bar}; filas ${JSON.stringify(antes39.filas)}`,
);

/* Un gasto de cada uno, que es lo que hace falta para que el reparto se vea. */
await p39.fill("#gc", "Alquiler (prueba 39)");
await p39.fill("#gm", "180000");
await p39.click('[data-act="gAdd"]');
await p39.waitForTimeout(4000);
await p39.evaluate((k) => {
  const x = [...document.querySelectorAll('[data-act="gsetP"]')].find((y) => y.dataset.args.indexOf(k) >= 0);
  if (x) x.click();
}, OTRO39);
await p39.waitForTimeout(1500);
await p39.fill("#gc", "Insumos (prueba 39)");
await p39.fill("#gm", "25000");
await p39.click('[data-act="gAdd"]');
await p39.waitForTimeout(4000);

const conGastos = await p39.evaluate(() => {
  /* La columna de gastos se muestra con "− $X": es una cantidad, no un número
     con signo. Por eso se lee el valor absoluto, y no como lo pinta el texto. */
  /* Los puntos son de MILES, no decimales: $180.000 son ciento ochenta mil, no
     ciento ochenta. La primera versión usaba parseFloat y leía 180, así que
     comparaba 180 contra 180.000 y daba rojo por un gasto bien cargado. */
  const entero = (s) => {
    const t = String(s).replace(/\u2212/g, "-").replace(/[^0-9-]/g, "");
    return t === "" || t === "-" ? 0 : parseInt(t, 10) || 0;
  };
  const filas = [...document.querySelectorAll(".clin:not(.chead)")].map((f) => {
    const c = f.children;
    return {
      n: (c[0] ? c[0].innerText : "").trim(),
      t: entero(c[1] ? c[1].innerText : ""),
      g: Math.abs(entero(c[2] ? c[2].innerText : "")),
      neto: entero(c[3] ? c[3].innerText : ""),
    };
  });
  const total = filas.find((x) => /Total/.test(x.n)) || null;
  const p = filas.filter((x) => x !== total);
  return {
    filas, total,
    cadaUna: p.every((x) => x.t - x.g === x.neto),
    falla: p.filter((x) => x.t - x.g !== x.neto).map((x) => x.n + ": " + x.t + " - " + x.g + " = " + (x.t - x.g) + ", dice " + x.neto),
    sumaNeto: p.reduce((a, x) => a + x.neto, 0),
    totalNeto: total && total.neto,
    sumaGast: p.reduce((a, x) => a + x.g, 0),
    totalGast: total && total.g,
    sumaFact: p.reduce((a, x) => a + x.t, 0),
    totalFact: total && total.t,
  };
});
conGastos.filas.forEach((x) => console.log("        " + JSON.stringify(x)));
ok(conGastos.cadaUna, "cada fila: facturado menos SUS gastos da su neto", conGastos.falla.join("; "));
ok(
  conGastos.sumaNeto === conGastos.totalNeto && conGastos.totalNeto !== null,
  "y la suma de los netos es el total del negocio",
  conGastos.sumaNeto + " vs " + conGastos.totalNeto,
);
ok(
  conGastos.sumaGast === conGastos.totalGast,
  "los gastos también suman",
  conGastos.sumaGast + " vs " + conGastos.totalGast,
);
ok(
  conGastos.sumaFact === conGastos.totalFact,
  "y lo facturado también",
  conGastos.sumaFact + " vs " + conGastos.totalFact,
);

/* El alquiler le sale al dueño y los insumos al barbero: el gasto se descuenta
   de la persona que lo tiene a su nombre, no del negocio entero. */
const duenho = conGastos.filas.find((x) => /due/iu.test(x.n)),
  bar39 = conGastos.filas.find((x) => /^Barbero/i.test(x.n));
ok(
  duenho && duenho.g === 180000,
  "el alquiler se le descuenta al dueño",
  JSON.stringify(conGastos.filas),
);
ok(
  bar39 && bar39.g === 25000,
  "y los insumos se le descuentan al barbero",
  JSON.stringify(conGastos.filas),
);
/* El editor de porcentajes es un control que ya funcionaba y que al reescribir la
   pantalla quedó con un `</div>` de más: "Guardar porcentajes" y "+ Agregar
   barbero" se fueron fuera de la tarjeta. El HTML compila igual, así que sólo se
   ve mirando dónde está el botón. */
const editor = await p39.evaluate(() => {
  const dentro = (el) => {
    let n = el;
    while (n && n !== document.body) {
      if (n.classList && n.classList.contains("card")) return true;
      n = n.parentElement;
    }
    return false;
  };
  const g = [...document.querySelectorAll('[data-act="feGuardar"]')][0];
  const a = [...document.querySelectorAll('[data-act="feAdd"]')][0];
  return { guardar: g ? dentro(g) : null, agregar: a ? dentro(a) : null };
});
ok(editor.guardar === true, "'Guardar porcentajes' quedó dentro de la tarjeta", JSON.stringify(editor));
ok(editor.agregar === true, "y '+ Agregar barbero' también");

/* ---------- limpiar ----------
   Esto va PRIMERO entre lo que falta: borra los gastos de prueba. Si el bloque no
   está, la prueba deja $180.000 + $25.000 inventados en la base del dueño, que es
   justo lo que no hay que hacer. Por eso va antes de cualquier otra cosa. */
for (let n = await p39.evaluate(() => document.querySelectorAll('[data-act="askGDel"]').length); n > 0; n--) {
  await p39.evaluate(() => {
    const x = [...document.querySelectorAll('[data-act="askGDel"]')];
    if (x.length) x[0].click();
  });
  await p39.waitForTimeout(1300);
  await p39.evaluate(() => {
    const x = [...document.querySelectorAll("#mo button")].find((y) => /Eliminar/i.test(y.innerText));
    if (x) x.click();
  });
  await p39.waitForTimeout(3000);
}
ok(
  !(await p39.evaluate(() => document.querySelectorAll(".scr .row").length)),
  "los gastos de prueba se borran y no quedan en la base",
);
const errores39 = [...new Set(e39)];
ok(errores39.length === 0, "sin errores de JS en todo el camino", errores39.join(" | "));
await c39.close();

  await ba.ctx.close();
  await b.close();

  console.log(fallos ? `\nFALLARON ${fallos}` : "\nTODO VERDE");
  process.exit(fallos ? 1 : 0);
})();