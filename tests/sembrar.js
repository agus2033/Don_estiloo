/* Siembra la base de Firestore después de una limpieza.
   ================== OJO: ESCRIBE EN LA BASE REAL ==================

   El dueño borró la base completa el 2026-10-11. Firebase Authentication
   sobrevivió (son dos bases distintas), así que las cuentas de dueño y
   barbero siguen existiendo; lo que falta son los DOCUMENTOS.

   Qué crea:
     config/servicios   los 3 servicios, con id, precio y duración
     config/horario     el horario general (Lun a Sáb 09:00 a 17:00)
     config/reglas      cuántos puntos suma cada corte
     config/finanzas    el reparto de porcentajes y la lista del equipo
     staff/{uid}        el documento que hace que el barbero sea staff
     users/{uid}.rol    "barbero", para que el panel lo reconozca
     config/barberos    lo publica solo el sincronizador del dueño al entrar

   Lo que NO crea, porque no se puede inventar:
     - Fotos de barbero y de servicio: estaban en Cloudinary y las URLs se
       perdieron con la base. Se recargan desde la app (Galería, y "Cambiar
       foto" / Servicios y premios).
     - Galería de trabajos: se recarga desde la app.
     - Reseñas: para el JSON-LD del SEO no se pondrían hasta que sean reales.

   Uso:
     node tests\sembrar.js            (muestra qué haría y pregunta)
     node tests\sembrar.js --si       (escribe sin preguntar)

   Cada login usa un CONTEXTO NUEVO en vez de cerrar sesión: el botón "Cerrar
   sesión" del panel del barbero vive dentro del menú de la foto y no siempre
   está a la vista, yDepender de él dejaba el script a mitad de camino.
*/
const fs = require("fs");
const path = require("path");

const env = {};
fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8")
  .split(/\r?\n/)
  .forEach((l) => {
    const i = l.indexOf("=");
    if (i < 1 || l.trim().startsWith("#")) return;
    const k = l.slice(0, i).trim();
    if (env[k]) return;
    env[k] = l.slice(i + 1).trim();
  });

/* Lo que se siembra. Sale de src/config.js y de lo que el dueño decidió:
   nombre "Roman" y horario Lun a Sáb 09:00-17:00, que es el mismo que dice el
   JSON-LD del SEO, para que Google y la web no se contradigan. */
const SIEMBRA = {
  servicios: [
    { id: "s1", n: "Corte (Incluye cejas)", d: 30, p: 15000 },
    { id: "s2", n: "Barba", d: 30, p: 8000 },
    { id: "s3", n: "Corte + barba", d: 60, p: 20000 },
  ],
  horario: { a: 540, c: 1020, dias: [1, 2, 3, 4, 5, 6], libres: [], al: 0, ah: 0 },
  reglas: { pts: 5 },
  repartoDueño: 40,
  barbero: { n: "Roman" },
};

const escribir = process.argv.includes("--si");

/* Abre un contexto nuevo, entra con esa cuenta y devuelve la página. */
async function entrarCon(browser, email, pass, etiqueta, silencioso) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();
  const errores = [];
  page.on("console", (m) => m.type() === "error" && errores.push(m.text().slice(0, 160)));
  page.on("pageerror", (e) => errores.push(String(e).slice(0, 160)));
  await page.goto("http://127.0.0.1:8765/index.html", { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".lb-wcard", { timeout: 25000 });
  await page.waitForTimeout(900);
  const vis = page.locator('[data-act="goLogin"]:visible');
  if (await vis.count()) await vis.first().click();
  else await page.evaluate(() => { location.hash = "#login"; });
  await page.waitForSelector("#ie", { timeout: 15000 });
  await page.fill("#ie", email);
  await page.fill("#ip", pass);
  await page.click('[data-act="entrar"]');
  await page.waitForTimeout(11000);
  const info = await page.evaluate(() => {
    const m = document.getElementById("mo");
    return {
      uid: window.__test ? window.__test.uid : null,
      hash: location.hash,
      cartel: m && !m.hidden ? m.innerText.replace(/\s+/g, " ").trim().slice(0, 150) : "",
      hayForm: !!document.getElementById("ie"),
    };
  });
  if (!info.uid) {
    /* `silencioso` es para el barbero: que su cuenta no exista es un caso
       esperado y no debe frenar la siembra. Para el dueño sí es un error, y
       por eso se imprime el estado: si el login falló y no se dice por qué,
       parece que el problema es la contraseña cuando puede ser que el
       formulario ni siquiera apareció. */
    if (!silencioso)
      console.log(
        `No entró ${etiqueta}. Revisá ${etiqueta === "dueño" ? "DUENO" : "BARBERO"}_* en .env.local.\n` +
          `     ruta=${info.hash} formulario=${info.hayForm} cartel="${info.cartel}"`,
      );
    await ctx.close();
    return null;
  }
  console.log(`${etiqueta} dentro, uid ${info.uid}`);
  return { ctx, page, uid: info.uid, errores };
}

(async () => {
  if (!escribir) {
    const ok = await new Promise((res) => {
      process.stdin.setEncoding("utf8");
      process.stdout.write(
        "Este script ESCRIBE en la base de datos real de Firebase.\n\n" +
          `  servicios   : ${SIEMBRA.servicios.length} (${SIEMBRA.servicios.map((s) => s.n).join(", ")})\n` +
          "  horario     : Lun a Sáb 09:00 a 17:00\n" +
          `  puntos/corte: ${SIEMBRA.reglas.pts}\n` +
          `  reparto     : dueño ${SIEMBRA.repartoDueño}% / barbero ${100 - SIEMBRA.repartoDueño}%\n` +
          `  barbero     : ${SIEMBRA.barbero.n} (el de la cuenta de prueba)\n\n` +
          "Escribí SI para continuar: ",
      );
      process.stdin.once("data", (d) => res(/^\s*si\b/i.test(d)));
    });
    if (!ok) {
      console.log("Cancelado. No se escribió nada.");
      return;
    }
  }

  const { chromium } = require("../.opencode/skills/playwright-skill/node_modules/playwright/index.js");
  const b = await chromium.launch();
  const errores = [];

  /* 1. El uid del barbero. Todavía NO es staff (no existe staff/{uid}), así
        que cae en el panel de cliente: da igual, sólo se lee el uid. */
  console.log("\n1. Leyendo el uid del barbero");
  /* La cuenta puede NO existir: el dueño borró la del barbero durante la
     limpieza del 2026-10-11 y la de prueba de .env.local da
     `auth/invalid-credential`. Eso no corta la siembra: se siembra todo lo
     demás y el barbero queda para cargar a mano. */
  let uidBarbero = null;
  const sBarbero = await entrarCon(b, env.BARBERO_EMAIL, env.BARBERO_PASSWORD, "barbero", true);
  if (sBarbero) {
    uidBarbero = sBarbero.uid;
    await sBarbero.ctx.close();
  } else {
    console.log(
      "\n   La cuenta del barbero no entra: no existe o le cambiaron la contraseña.\n" +
        "   Se siembra todo lo demás y el barbero queda para cargar a mano.",
    );
  }

  /* 2. El dueño, que es el único que puede escribir `staff` de otro usuario y
        crear `config/finanzas`. */
  console.log("\n2. Entrando como dueño para escribir");
  const sDueño = await entrarCon(b, env.DUENO_EMAIL, env.DUENO_PASSWORD, "dueño");
  if (!sDueño) { await b.close(); return; }
  const uidDueño = sDueño.uid;
  errores.push(...sDueño.errores);

  /* 3. Las escrituras, desde la página y con el MISMO SDK y la misma
        instancia de Firestore que ya tiene la app cargada: import() del
        módulo de gstatic y getApp() en vez de initializeApp(), que tiraría
        "Firebase App named '[DEFAULT]' already exists".

        OJO con `users/{uid}`, que es lo que trabó la primera corrida:

          - La regla de `create` pide `request.auth.uid == uid`, o sea que el
            dueño NO puede crear el documento de otro. Un `setDoc` con merge
            sobre un documento que no existe es un create, y ahí viene el
            "Missing or insufficient permissions" que abortaba TODO el lote.
          - La app sólo crea ese documento si el usuario NO es admin
            (`setup()`: `if (!x.exists() && me && !isAdm())`). O sea que hay
            que dejarlo entrar ANTES de que exista `staff/{uid}`: en ese
            momento todavía no es barbero y la app sola le arma el perfil.
            Por eso el paso 1 (que entra como barbero) tiene que ir primero.

        Así que acá va `update`, que sí lo permite `isBarberoOrOwner()`. */
  console.log("\n3. Escribiendo los documentos");
  const salida = await sDueño.page.evaluate(
    async ({ s, uidB, uidD }) => {
      const F = await import("https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js");
      const A = await import("https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js");
      const db = F.getFirestore(A.getApp());

      /* Si el perfil del barbero no existe todavía, no se puede seguir: sin
         él, el update del rol va a fallar y el lote entero se cae. */
      /* Sólo importa cuando hay uid: sin documento de perfil no hay a quién
         ponerle el rol. */
      const perfil = uidB ? await F.getDoc(F.doc(db, "users", uidB)) : null;
      if (perfil && !perfil.exists()) {
        return { faltaPerfil: true };
      }

      const bs = uidB ? [{ id: uidB, uid: uidB, n: s.barbero.n, pd: s.repartoDueño }] : [];
      const bt = F.writeBatch(db);
      /* merge: true en vez de set a secas: si el dueño ya tenía algo escrito,
         un set pisa campos que este script no está tocando. */
      bt.set(F.doc(db, "config", "servicios"), { l: s.servicios }, { merge: true });
      bt.set(F.doc(db, "config", "horario"), s.horario, { merge: true });
      bt.set(F.doc(db, "config", "reglas"), s.reglas, { merge: true });
      bt.set(F.doc(db, "config", "finanzas"), { pd: s.repartoDueño, bs }, { merge: true });
      /* El documento de staff y el rol sólo si hay uid: sin cuenta no hay
         documento que crear, y el barbero se carga desde "+ Agregar". */
      if (uidB) {
        bt.set(F.doc(db, "staff", uidB), { n: s.barbero.n, pd: s.repartoDueño }, { merge: true });
        /* `update` y no `set`: el documento ya existe (lo creó el propio
           barbero al entrar en el paso 1) y `isBarberoOrOwner()` lo permite. */
        bt.update(F.doc(db, "users", uidB), { rol: "barbero" });
      }
      await bt.commit();
      return { ok: true, conBarbero: !!uidB, nombreEnPerfil: uidB ? (perfil.data() || {}).nm : null };
    },
    { s: SIEMBRA, uidB: uidBarbero, uidD: uidDueño },
  );

  if (salida && salida.faltaPerfil) {
    console.log("\nFALTA EL PERFIL DEL BARBERO: users/" + uidBarbero + " no existe.");
    console.log("Las reglas no dejan que el dueño lo cree por otro, y la app sólo lo");
    console.log("crea si el usuario todavía NO es barbero. Por eso tiene que entrar una");
    console.log("vez ANTES de que exista staff/{uid} (que es justo lo que hizo el paso 1).");
    console.log("Si ya existe staff/ de antes, borralo en la consola y volvé a correr.");
    await b.close();
    return;
  }
  if (!salida || !salida.ok) {
    console.log("No se pudo escribir:", JSON.stringify(salida));
    await b.close();
    return;
  }
  console.log(
    "Documentos escritos." +
      (salida.conBarbero
        ? " El perfil del barbero se llama " + JSON.stringify(salida.nombreEnPerfil) + "."
        : " SIN barbero: falta cargarlo."),
  );

  /* 4. El sincronizador del dueño arma `config/barberos` a partir de
        `config/finanzas` en cuanto lo escucha cambiar, así que se espera. */
  await sDueño.page.waitForTimeout(7000);
  const pub = await sDueño.page.evaluate(() => window.__test.bars.map((x) => ({ id: x.id, n: x.n, foto: !!x.foto })));
  console.log("config/barberos publicado por el sincronizador: " + JSON.stringify(pub));
  await sDueño.ctx.close();

  /* 5. La comprobación que importa: el barbero tiene que caer en SU panel y
        no en el de cliente. Eso es lo que prueba que `staff/{uid}` quedó bien.
        Sin cuenta no hay nada que comprobar. */
  console.log("\n4. Verificando que el barbero entre como barbero");
  if (uidBarbero) {
    const prueba = await entrarCon(b, env.BARBERO_EMAIL, env.BARBERO_PASSWORD, "barbero");
    if (prueba) {
      const hash = await prueba.page.evaluate(() => location.hash);
      console.log(`El barbero cae en ${hash}${hash.indexOf("agenda") >= 0 ? "   OK" : "   FALLA"}`);
      errores.push(...prueba.errores);
      await prueba.ctx.close();
    }
  } else {
    console.log("   sin cuenta del barbero: no hay nada que verificar");
  }

  /* 6. La landing sin sesión: tiene que mostrar el barbero y los servicios. */
  console.log("\n5. La landing sin sesión");
  const anon = await (await b.newContext({ viewport: { width: 1280, height: 1000 } })).newPage();
  await anon.goto("http://127.0.0.1:8765/index.html", { waitUntil: "domcontentloaded" });
  await anon.waitForSelector(".lb-wcard", { timeout: 25000 });
  await anon.waitForTimeout(4000);
  console.log(
    "  " +
      JSON.stringify(
        await anon.evaluate(() => ({
          barberos: document.querySelectorAll(".lb-barber").length,
          nombres: [...document.querySelectorAll(".lb-barber-id b")].map((x) => x.textContent.trim()),
          servicios: document.querySelectorAll(".lb-sv").length,
          galeria: document.querySelectorAll(".lb-gal figure, .lb-galeria figure").length,
        })),
      ),
  );
  await anon.context().close();

  const ruido = errores.filter((x) => !/favicon|Failed to load resource/i.test(x));
  console.log("\nerrores de consola: " + (ruido.length ? JSON.stringify(ruido.slice(0, 4)) : "ninguno"));
  if (!salida.conBarbero) {
    console.log("");
    console.log("FALTA EL BARBERO. Sin al menos uno en la lista el sitio NO puede tomar");
    console.log("turnos: el asistente de reserva se frena en el paso 2 con la lista de");
    console.log("barberos vacía. Se resuelve de una de estas dos formas:");
    console.log("  a) Pasame el mail real del barbero y lo cargo con su cuenta y agenda.");
    console.log("  b) Mientras tanto: dueño > Barberos > + Agregar barbero.");
  }
  if (!salida.conBarbero) {
    console.log("");
    console.log("FALTA EL BARBERO. Sin al menos uno en la lista el sitio NO puede tomar");
    console.log("turnos: el asistente de reserva se frena en el paso 2 con la lista de");
    console.log("barberos vacía. Se resuelve de una de estas dos formas:");
    console.log("  a) Pasame el mail real del barbero y lo cargo con su cuenta y agenda.");
    console.log("  b) Mientras tanto: dueño > Barberos > + Agregar barbero.");
  }
  console.log("\nFALTA recargar a mano, desde la app:");
  console.log("  - la FOTO del barbero   (Mi perfil en la web > Cambiar foto)");
  console.log("  - las fotos de servicio (Ajustes > Servicios y premios)");
  console.log("  - la galería de trabajos (Ajustes > Galería)");
  await b.close();
})();
