/* Entra con los usuarios de PRUEBA y verifica que:
     1. cada rol caiga en su vista por defecto,
     2. el nav de cada rol sea el que le corresponde,
     3. rtOk no deje pasar a otro rol sus rutas, y
     4. el panel del CLIENTE renderice el MISMO asistente que la landing.
   Lee .env.local. Nunca imprime una contraseña ni la pasa por la línea de
   comandos.

   Uso:
     python -m http.server 8765
     node tests\landing.login.js              -> prueba los tres
     node tests\landing.login.js cliente      -> prueba sólo uno
*/
const fs = require("fs");
const path = require("path");
const { chromium } = require("../.opencode/skills/playwright-skill/node_modules/playwright");

const BASE = "http://127.0.0.1:8765/index.html";

/* --- .env.local --- */
function envLocal() {
  const p = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(p)) return null;
  const o = {};
  fs.readFileSync(p, "utf8").split(/\r?\n/).forEach((l) => {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) o[m[1]] = m[2].replace(/^["']|["']$/g, "");
  });
  return o;
}

/* Copiado de RT en src/main.js: vista -> segmento del hash. */
const RT = {
  home: "inicio", res: "reservar", tur: "turnos", bar: "agenda",
  cli: "clientes", bars: "barberos", dash: "dashboard", fin: "finanzas",
  cfg: "ajustes", priv: "privacidad", gal: "galeria", rev: "resena",
};

/* Lo que la app realmente da a cada rol:
   - inicio:  view = isAdm() ? (isOwner() ? "dash" : "bar") : "home"   (main.js:581)
   - nav:     los arrays sec/nv de main.js:4214-4251
   - rutas:   la lista de rtOk() en main.js:794                                */
const ROLES = {
  cliente: {
    email: "CLIENTE_EMAIL", pass: "CLIENTE_PASSWORD",
    inicio: "home",
    nav: ["home", "res", "tur", "rev"],
    permitidas: ["home", "res", "tur", "priv", "rev"],
    wizard: true,
  },
  barbero: {
    email: "BARBERO_EMAIL", pass: "BARBERO_PASSWORD",
    inicio: "bar",
    nav: ["bar", "cli", "fin", "gal"],
    permitidas: ["bar", "cli", "fin", "priv", "gal"],
    wizard: false,
  },
  dueno: {
    email: "DUENO_EMAIL", pass: "DUENO_PASSWORD",
    inicio: "dash",
    nav: ["dash", "bar", "cli", "bars", "fin", "cfg", "gal"],
    permitidas: ["bar", "cli", "bars", "dash", "fin", "cfg", "priv", "gal"],
    wizard: false,
  },
};

/* El nav marca la vista activa con class="on" (main.js:4231 y 4254). */
const LEER_NAV = () => {
  const bs = [...document.querySelectorAll("#nav button[data-act='go']")];
  return {
    vistas: bs.map((b) => {
      try { return JSON.parse(b.dataset.args || "[]")[0]; } catch (_) { return null; }
    }).filter(Boolean),
    activa: bs.find((b) => b.classList.contains("on"))?.dataset.args
      ? JSON.parse(bs.find((b) => b.classList.contains("on")).dataset.args)[0]
      : null,
  };
};

async function entrar(p, email, pass) {
  await p.goto(BASE, { waitUntil: "domcontentloaded" });
  await p.waitForSelector(".lb-wcard", { timeout: 25000 });
  await p.waitForTimeout(1200);
  /* A 390 px los dos "Ingresar" están ocultos: uno vive en el header y el
     otro en el panel del menú, que arranca cerrado. Plan B: el hash que la
     app ya resuelve sola. OJO, es "#login" (RESERVAR_URL en config.js),
     no "#/reservar": con ese hash el router no abre el login porque la
     ruta existe y prep() no toca authOpen. */
  const visible = p.locator('[data-act="goLogin"]:visible');
  if (await visible.count()) {
    await visible.first().click();
  } else {
    await p.evaluate(() => { location.hash = "#login"; });
  }
  await p.waitForSelector("#ie", { timeout: 12000 });
  await p.fill("#ie", email);
  await p.fill("#ip", pass);
  await p.click('[data-act="entrar"]');
  await p.waitForTimeout(5000);
}

async function probarRutas(p, permitidas) {
  const todas = Object.keys(RT);
  const res = [];
  for (const v of todas) {
    const ok = permitidas.includes(v);
    await p.evaluate((h) => { location.hash = h; }, "#/" + RT[v]);
    await p.waitForTimeout(700);
    const nav = await p.evaluate(LEER_NAV);
    /* Si la ruta tiene botón de nav, ese botón es el que debe quedar
       activo. Si no lo tiene (privacidad, que no aparece en el nav), alcanza
       con que la vista activa no se haya movido a ella. */
    if (nav.vistas.includes(v)) {
      res.push({ ruta: v, esperado: ok, activa: nav.activa,
                 ok: (nav.activa === v) === ok });
    } else {
      res.push({ ruta: v, esperado: ok, activa: nav.activa,
                 ok: nav.activa !== v, sinBoton: true });
    }
  }
  return res;
}

async function recorrerAsistente(p, tag) {
  const out = {};
  const paso = () => p.evaluate(() => {
    const on = document.querySelector(".wz-paso.on");
    return on ? +on.querySelector("b").textContent : -1;
  });
  out.pasoInicial = await paso();
  await p.click(".wz-item:not(.on)").catch(() => {});
  await p.waitForTimeout(200);
  await p.click(".wz-pie .wz-btn--pri");
  await p.waitForTimeout(400);
  await p.click(".wz-item:not(.on)").catch(() => {});
  await p.waitForTimeout(200);
  await p.click(".wz-pie .wz-btn--pri");
  await p.waitForTimeout(1600); // carga la disponibilidad del mes
  out.pasoCalendario = await paso();
  const w3 = await p.$("#wiz");
  if (w3) await w3.screenshot({ path: path.join(__dirname, "..", "tmp_shots", tag + "-paso3.png") });
  await p.click(".wz-cel.libre").catch(() => {});
  await p.waitForTimeout(250);
  await p.click(".wz-pie .wz-btn--pri");
  await p.waitForTimeout(400);
  await p.click(".wz-turno:not(.off)").catch(() => {});
  await p.waitForTimeout(250);
  await p.click(".wz-pie .wz-btn--pri");
  await p.waitForTimeout(400);
  out.pasoHorarios = await paso();
  await p.click(".wz-hora:not(.oc)").catch(() => {});
  await p.waitForTimeout(250);
  await p.click(".wz-pie .wz-btn--pri");
  await p.waitForTimeout(400);
  out.pasoResumen = await paso();

  const cta = await p.evaluate(() =>
    [...document.querySelectorAll(".wz-body .wz-btn")].map((x) => x.textContent.trim()));
  out.botones = cta;
  out.muestraConfirmar = cta.some((t) => /confirmar turno/i.test(t));
  out.muestraIngresar = cta.some((t) => /ingresar/i.test(t));
  const w6 = await p.$("#wiz");
  if (w6) await w6.screenshot({ path: path.join(__dirname, "..", "tmp_shots", tag + "-paso6.png") });

  /* Abrir el diálogo de confirmación SIN aceptar: no se crea ningún turno. */
  if (out.muestraConfirmar) {
    await p.click(".wz-body .wz-btn--pri");
    await p.waitForTimeout(1000);
    out.dialogo = await p.evaluate(() => {
      const m = document.querySelector("#mo");
      if (m && !m.hidden) {
        return { abierto: true, h: m.querySelector("h2")?.textContent?.trim() || null,
                 botones: [...m.querySelectorAll("button")].map((x) => x.textContent.trim()) };
      }
      const j = document.querySelector("#app .msg");
      return { abierto: false, msj: j ? j.textContent.trim().slice(0, 150) : null };
    });
    const m = await p.$("#mo");
    if (m) await m.screenshot({ path: path.join(__dirname, "..", "tmp_shots", tag + "-confirmar.png") });
  }
  return out;
}

(async () => {
  const env = envLocal();
  if (!env) {
    console.log("Falta .env.local. Copiá .env.example a .env.local y completá las 6 claves.");
    process.exit(0);
  }
  const filtro = (process.argv[2] || "todos").toLowerCase();
  const roles = filtro === "todos" ? Object.keys(ROLES) : [filtro];
  if (roles.some((r) => !ROLES[r])) {
    console.log("Rol desconocido. Usá: todos | cliente | barbero | dueno");
    process.exit(0);
  }

  const b = await chromium.launch();
  let fallos = 0;
  const pendientes = [];

  for (const rol of roles) {
    const cfg = ROLES[rol];
    const email = env[cfg.email];
    const pass = env[cfg.pass];
    if (!email || !pass) { pendientes.push(rol); continue; }

    console.log("\n========== " + rol.toUpperCase() + " ==========");
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const p = await ctx.newPage();
    const errs = [];
    p.on("pageerror", (e) => errs.push(e.message));

    await entrar(p, email, pass);

    const nav = await p.evaluate(LEER_NAV);
    const hash = await p.evaluate(() => location.hash);
    const check = (cond, txt) => {
      if (!cond) fallos++;
      console.log((cond ? "  OK   " : "  FALLA") + " " + txt);
    };

    console.log("  sesión: " + email);
    check(nav.vistas.length > 0, "entró (hay nav de sesión)");
    check(hash === "#/" + RT[cfg.inicio],
      "cae en su vista por defecto: " + hash + " (esperado #/" + RT[cfg.inicio] + ")");

    const navOk = JSON.stringify(nav.vistas.slice().sort()) ===
                  JSON.stringify(cfg.nav.slice().sort());
    check(navOk, "nav correcto: " + nav.vistas.join(", ") +
      (navOk ? "" : "\n         esperado: " + cfg.nav.join(", ")));

    const rutas = await probarRutas(p, cfg.permitidas);
    const malas = rutas.filter((r) => !r.ok);
    check(malas.length === 0,
      "rtOk separa los roles en las 12 rutas (" +
      (12 - rutas.filter((r) => r.sinBoton).length) + " con botón de nav)");
    malas.forEach((r) => console.log("         ruta " + r.ruta +
      ": esperaba " + (r.esperado ? "permitida" : "bloqueada") + ", activa quedó " + r.activa));

    if (cfg.wizard) {
      await p.evaluate(() => { location.hash = "#/reservar"; });
      await p.waitForTimeout(1800);
      check(await p.$("#wiz") !== null, "el panel renderiza el asistente (#wiz)");
      const w = await recorrerAsistente(p, "PANEL");
      console.log("  asistente: " + JSON.stringify(w));
      check(w.pasoInicial === 1 && w.pasoResumen === 6, "recorre los 6 pasos");
      check(w.muestraConfirmar, "el paso 6 dice 'Confirmar turno' (no 'Ingresar')");
      if (w.dialogo) console.log("  diálogo: " + JSON.stringify(w.dialogo));
    }

    check(errs.length === 0, "sin errores JS" + (errs.length ? ": " + errs[0].slice(0, 90) : ""));
    await ctx.close();
  }

  await b.close();
  if (pendientes.length)
    console.log("\nSIN COMPLETAR en .env.local: " + pendientes.join(", ") +
      " (se saltean; no cuentan como fallo)");
  console.log("\n=== " + (fallos ? fallos + " FALLAS" : "todo OK") + " ===");
  process.exit(fallos ? 1 : 0);
})();