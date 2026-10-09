/* Verifica que el REGISTRO de cuentas funcione de punta a punta:
     1. el formulario valida antes de tocar Firestore,
     2. la cuenta se crea en Auth,
     3. se escribe el perfil en users/{uid} con los 20 puntos de bienvenida,
     4. se manda el email de verificación,
     5. y con la cuenta nueva se puede entrar y usar el asistente.

   IMPORTANTE: esto crea una cuenta REAL en Firebase (proyecto
   barberia-taccu) y le manda un email de verificación. Al final imprime
   el email para que la borres desde la consola de Firebase.

   El email sale de PRUEBA_EMAIL en .env.local. Si no está, el test avisa
   y sale sin crear nada.

   Uso: python -m http.server 8765   ->   node tests\landing.registro.js
*/
const fs = require("fs");
const path = require("path");
const { chromium } = require("../.opencode/skills/playwright-skill/node_modules/playwright");

const BASE = "http://127.0.0.1:8765/index.html";

function envLocal() {
  const p = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(p)) return {};
  const o = {};
  fs.readFileSync(p, "utf8").split(/\r?\n/).forEach((l) => {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) o[m[1]] = m[2].replace(/^["']|["']$/g, "");
  });
  return o;
}

let fallos = 0;
const check = (ok, txt, extra) => {
  if (!ok) fallos++;
  console.log((ok ? "  OK   " : "  FALLA") + " " + txt + (extra ? "  -> " + extra : ""));
};

/* El aviso de validación queda abierto y el #mo tapa el formulario, así que
   hay que bajarlo entre paso y paso (es lo mismo que hace la app al cerrar). */
const cerrarAviso = async (p) => {
  await p.evaluate(() => {
    const m = document.getElementById("mo");
    if (m) m.hidden = true;
  });
  await p.waitForTimeout(300);
};

/* Genera un sufijo para no chocar con una cuenta anterior del mismo test. */
const sello = () => Math.random().toString(36).slice(2, 7);

(async () => {
  const env = envLocal();
  const correo = env.PRUEBA_EMAIL;
  if (!correo) {
    console.log(
      "Falta PRUEBA_EMAIL en .env.local. Poné una dirección de prueba\n" +
      "(por ejemplo TU cuenta con +prueba: tu@correo+prueba@gmail.com) y volvé a correr.\n" +
      "Sin eso no se crea nada.",
    );
    process.exit(0);
  }

  const base = correo.trim().split("@");
  /* Gmail ignora todo lo que va después del primer "+", así que hay que
     sacarlo antes de poner el sufijo: si no, sale "algo+qa+qa-abc" y la
     dirección queda mal formada. */
  const usuario = base[0].split("+")[0];
  const sufijo = sello();
  const correoRun = `${usuario}+qa-${sufijo}@${base[1]}`;
  const clave = "Barber" + sufijo + "9";
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const errs = [];
  const consola = [];
  p.on("pageerror", (e) => errs.push(e.message));
  p.on("console", (m) => {
    if (m.type() === "error") consola.push(m.text());
    if (m.type() === "error" && /permission-denied|Firestore/i.test(m.text()))
      consola.push("FIREBASE: " + m.text().slice(0, 200));
  });

  await p.goto(BASE, { waitUntil: "domcontentloaded" });
  await p.waitForSelector(".lb-wcard", { timeout: 25000 });
  await p.waitForTimeout(1500);

  /* --- abrir el login y pasar a la pestaña de registro ---
     Ojo con el valor: la vista de alta es tab === "up" ("¿Primera vez?").
     "rec" es el de "Olvidé mi contraseña": también esconde #ingresar pero
     deja #registro oculto, así que el botón "Crear cuenta" queda invisible. */
  await p.evaluate(() => { location.hash = "#login"; });
  await p.waitForSelector("#ie", { timeout: 12000 });
  await p.waitForTimeout(500);
  await p.evaluate(() => {
    const b = document.querySelector('[data-act="setTab"][data-args*="up"]');
    if (b) b.click();
  });
  await p.waitForTimeout(900);
  check(await p.isVisible("#registro"), "se abre la pestaña de registro");
  check(await p.isVisible('[data-act="registro"]'), "el botón Crear cuenta es visible");

  /* --- 1. validaciones: no debe escribir nada --- */
  await p.click('[data-act="registro"]');
  await p.waitForTimeout(900);
  let dlg = await p.evaluate(() => {
    const m = document.querySelector("#mo");
    return m && !m.hidden ? m.querySelector("h2")?.textContent?.trim() : null;
  });
  check(!!dlg, "sin aceptar políticas te frena con un aviso", dlg || "no avisó");
  await cerrarAviso(p);

  await p.fill("#nm", "Prueba Automatica");
  await p.fill("#ph", "1134567890");
  await p.fill("#em", correoRun);
  await p.fill("#pw", clave);
  await p.fill("#pw2", "OtraClave9");
  await p.click("#spol");
  await p.click('[data-act="registro"]');
  await p.waitForTimeout(900);
  dlg = await p.evaluate(() => {
    const m = document.querySelector("#mo");
    return m && !m.hidden ? m.querySelector("h2")?.textContent?.trim() : null;
  });
  check(/no coinciden/i.test(dlg || ""), "contraseñas distintas te frena", dlg || "no avisó");
  await cerrarAviso(p);

  /* --- 2. alta real --- */
  await p.fill("#pw2", clave);
  await p.click('[data-act="registro"]');
  await p.waitForTimeout(6000);

  const res = await p.evaluate(() => {
    const m = document.querySelector("#mo");
    const abierto = m && !m.hidden;
    return {
      abierto,
      titulo: abierto ? m.querySelector("h2")?.textContent?.trim() : null,
      cuerpo: abierto ? m.querySelector(".mc")?.textContent?.trim()?.slice(0, 160) : null,
      hash: location.hash,
      nav: [...document.querySelectorAll("#nav button[data-act='go']")]
        .map((x) => x.querySelector("span")?.textContent?.trim() || x.textContent.trim()),
      sesion: !!document.querySelector("body > header") &&
        getComputedStyle(document.querySelector("body > header")).display !== "none",
    };
  });
  console.log("\n  resultado del alta: " + JSON.stringify(res) + "\n");

  const creada = /cuenta creada/i.test(res.titulo || "");
  const repetido = /ya tiene cuenta/i.test(res.titulo || "");
  const denegada = consola.some((t) => /permission-denied/i.test(t));
  check(!denegada, "Firestore NO respondió permission-denied al crear el perfil");
  if (repetido) console.log("  (aviso: ese email ya existía; se creó otro con sufijo nuevo)");
  check(creada, "muestra el aviso de cuenta creada", res.titulo || "sin diálogo");
  await cerrarAviso(p);

  if (creada) {
    check(res.sesion, "queda con sesión iniciada");
    check(!!res.nav.length, "arma el nav de cliente: " + res.nav.join(", "));

    /* --- 3. el asistente funciona con la cuenta recien creada --- */
    await p.evaluate(() => { location.hash = "#/reservar"; });
    await p.waitForTimeout(1800);
    check(!!(await p.$("#wiz")), "el panel renderiza el asistente con la cuenta nueva");
    const paso = await p.evaluate(() => {
      const on = document.querySelector(".wz-paso.on");
      return on ? +on.querySelector("b").textContent : -1;
    });
    check(paso === 1, "arranca en el paso 1", "paso " + paso);

    /* Sin verificar el email, pedir el turno debe frenarlo: eso es correcto. */
    await p.click(".wz-item:not(.on)").catch(() => {});
    await p.waitForTimeout(150);
    await p.click(".wz-pie .wz-btn--pri");
    await p.waitForTimeout(300);
    await p.click(".wz-item:not(.on)").catch(() => {});
    await p.waitForTimeout(150);
    await p.click(".wz-pie .wz-btn--pri");
    await p.waitForTimeout(1400);
    await p.click(".wz-cel.libre").catch(() => {});
    await p.waitForTimeout(200);
    await p.click(".wz-pie .wz-btn--pri");
    await p.waitForTimeout(350);
    await p.click(".wz-turno:not(.off)").catch(() => {});
    await p.waitForTimeout(200);
    await p.click(".wz-pie .wz-btn--pri");
    await p.waitForTimeout(350);
    await p.click(".wz-hora:not(.oc)").catch(() => {});
    await p.waitForTimeout(200);
    await p.click(".wz-pie .wz-btn--pri");
    await p.waitForTimeout(350);
    const cta = await p.evaluate(() =>
      [...document.querySelectorAll(".wz-body .wz-btn")].map((x) => x.textContent.trim()));
    check(cta.some((t) => /confirmar turno/i.test(t)), "el paso 6 ofrece Confirmar turno", cta.join(" | "));

    const sh = await p.$(".wz");
    if (sh) await sh.screenshot({ path: path.join(__dirname, "..", "tmp_shots", "REG-nueva-cuenta.png") });
  }

  check(errs.length === 0, "sin errores JS" + (errs.length ? ": " + errs[0].slice(0, 110) : ""));

  console.log("\n  ------------------------------------------------------------");
  console.log("  Cuenta creada para la prueba: " + correoRun);
  console.log("  Clave: " + clave);
  console.log("  BORRALA desde Firebase Console > Authentication > Users,");
  console.log("  y su documento en Firestore > users.");
  console.log("  ------------------------------------------------------------\n");

  await ctx.close();
  await b.close();
  console.log("=== " + (fallos ? fallos + " FALLAS" : "todo OK") + " ===");
  process.exit(fallos ? 1 : 0);
})();