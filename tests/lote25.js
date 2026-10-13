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
  ok(bGastos !== null && /allow read, create, update, delete: if isOwner\(\);/.test(bGastos), "gastos: los carga sólo el dueño");

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
    ok(false, "entró el barbero");
  } else {
    ok(true, "entró el barbero");
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
  }
  await ba.ctx.close();
  await b.close();

  console.log(fallos ? `\nFALLARON ${fallos}` : "\nTODO VERDE");
  process.exit(fallos ? 1 : 0);
})();