/* Reprogramar y cancelar: que existan, que respeten la política de las 2
   horas y que reprogramar NO cree un turno nuevo.

   Todo corre con turnos SINTÉTICOS en memoria (window.__test.setTurnos):
   nada se escribe en Firestore, así que no se tocan los turnos reales de
   los clientes. Por eso este test puede abrir y cerrar el asistente de
   programmaticamente sin dejar basura en producción. */
const { chromium } = require("../.opencode/skills/playwright-skill/node_modules/playwright/index.js");
const fs = require("fs");
const path = require("path");

function envLocal() {
  const o = {};
  fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8").split(/\r?\n/).forEach((l) => {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) o[m[1]] = m[2].replace(/^["']|["']$/g, "");
  });
  return o;
}

(async () => {
  const env = envLocal();
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(String(e)));
  const out = [];
  const chk = (c, t, e) => {
    out.push([c, t]);
    console.log(`${c ? "  OK  " : "  FAIL"} ${t}${e ? "  -> " + e : ""}`);
  };

  await p.goto("http://127.0.0.1:8765/index.html", { waitUntil: "domcontentloaded" });
  await p.waitForSelector(".lb-wcard", { timeout: 25000 });
  await p.waitForTimeout(1000);
  const vis = p.locator('[data-act="goLogin"]:visible');
  if (await vis.count()) await vis.first().click();
  await p.waitForSelector("#ie", { timeout: 15000 });
  await p.fill("#ie", env.CLIENTE_EMAIL);
  await p.fill("#ip", env.CLIENTE_PASSWORD);
  await p.click('[data-act="entrar"]');
  await p.waitForTimeout(7000);

  const CHSv = await p.evaluate(() => window.__test.CHSv);
  chk(CHSv > 0, `la política está cargada desde Firestore (${CHSv} h)`, String(CHSv));

  /* ---------- 1. un turno lejano se puede reprogramar ---------- */
  const lejos = await p.evaluate(() => {
    const f = new Date(Date.now() + 9 * 864e5);
    const d = f.toISOString().slice(0, 10);
    window.__test.setTurnos([
      { id: "TESTLEJOS", uid: window.__test.uid, d, t: "10:00", st: "pend", bid: "", s: 0, sid: "", nm: "Sintetico", bl: [] },
    ]);
    return window.__test.turnos[0];
  });
  chk(!!lejos, "se inyectó el turno sintético", lejos && lejos.d);

  await p.evaluate(() => { location.hash = "#/inicio"; });
  await p.waitForTimeout(2000);
  await p.evaluate((id) => window.__test.reprogramar(id), "TESTLEJOS");
  await p.waitForTimeout(2200);
  const ed = await p.evaluate(() => ({
    hash: location.hash,
    paso: (document.querySelector(".wz-paso.on b") || {}).textContent,
    aviso: !!document.querySelector(".wz-aviso-rep"),
    avisoTxt: (document.querySelector(".wz-aviso-rep b") || {}).textContent,
    haySalir: !!document.querySelector('.wz-aviso-rep [data-act="repSalir"]'),
    rep: window.__test.rep,
    mes: document.querySelector(".wz-cal-top b")?.textContent || null,
  }));
  chk(ed.hash === "#/reservar", "Reprogramar abre el asistente en #/reservar", ed.hash);
  chk(ed.paso === "3", "arranca en el paso 3 (día)", ed.paso);
  chk(ed.aviso, "avisa que se está reprogramando", ed.avisoTxt);
  chk(ed.haySalir, "ofrece salir sin cambiar nada");
  chk(ed.rep === "TESTLEJOS", "guarda el id del turno que se reprograma", ed.rep);
  chk(!!ed.mes, "precarga el mes del turno", ed.mes);

  /* Salir sin tocar nada: se vuelve al panel y no queda colgado el modo edición */
  await p.evaluate(() => window.__test.repSalir());
  await p.waitForTimeout(1800);
  const sal = await p.evaluate(() => ({
    hash: location.hash, rep: window.__test.rep, aviso: !!document.querySelector(".wz-aviso-rep"),
  }));
  chk(sal.hash === "#/turnos", "salir vuelve a Mis turnos", sal.hash);
  chk(sal.rep === 0, "salir limpia el modo edición", String(sal.rep));
  chk(!sal.aviso, "el aviso desaparece");

  /* ---------- 2. la política de 2 horas frena la reprogramación ---------- */
  const cerca = await p.evaluate(() => {
    /* Una hora desde ahora. OJO con mezclar zonas: toISOString() devuelve
       la fecha en UTC y getHours() la hora local. Despues de las 21:20
       (Argentina es UTC-3) las dos ya no son el mismo dia y el turno
       injectable quedaba con la fecha de un dia y la hora de otro, asi que
       la app no lo veia "dentro de las 2 h" y el test fallaba solo de noche.
       Aca va todo en local, de punta a punta. */
    const f = new Date(Date.now() + 36e5);
    const d = f.getFullYear() + "-" + String(f.getMonth() + 1).padStart(2, "0") + "-" + String(f.getDate()).padStart(2, "0");
    const t = String(f.getHours()).padStart(2, "0") + ":" + String(f.getMinutes()).padStart(2, "0");
    window.__test.setTurnos([{ id: "TESTCERCA", uid: window.__test.uid, d, t, st: "pend", bid: "", s: 0, sid: "", nm: "S", bl: [] }]);
    return { d, t };
  });
  chk(!!cerca.t, "se inyectó un turno dentro de las " + CHSv + " h", `${cerca.d} ${cerca.t}`);
  await p.evaluate((id) => window.__test.reprogramar(id), "TESTCERCA");
  await p.waitForTimeout(1500);
  const bloq = await p.evaluate(() => {
    const m = document.querySelector("#mo");
    return {
      abierto: m && !m.hidden,
      titulo: (m?.querySelector("h2") || {}).textContent || "",
      cuerpo: (m?.querySelector(".mt") || {}).textContent || "",
      botones: [...(m?.querySelectorAll("button") || [])].map((x) => x.textContent.trim()),
      abrioAsistente: !!document.querySelector("#wiz"),
      rep: window.__test.rep,
    };
  });
  chk(bloq.abierto, "con menos de " + CHSv + " h aparece un aviso");
  chk(/no podés reprogramar/i.test(bloq.titulo), "el aviso dice que ya no se puede online", bloq.titulo);
  chk(/horas antes|barbería/i.test(bloq.cuerpo), "el aviso manda a hablar con la barbería", bloq.cuerpo.slice(0, 70));
  chk(!bloq.abrioAsistente, "no abre el asistente cuando la política lo impide");
  chk(bloq.rep === 0, "no queda en modo edición", String(bloq.rep));

  await p.click("#mo [data-act='Mx']");
  await p.waitForTimeout(600);

  /* ---------- 3. la misma política aplica a cancelar ---------- */
  await p.evaluate((id) => window.__test.askCancel(id), "TESTCERCA");
  await p.waitForTimeout(1200);
  const canc = await p.evaluate(() => {
    const m = document.querySelector("#mo");
    return { abierto: m && !m.hidden, titulo: (m?.querySelector("h2") || {}).textContent || "" };
  });
  chk(canc.abierto, "cancelar dentro de la ventana también avisa");
  chk(/no podés cancelar/i.test(canc.titulo), "el aviso de cancelar existe", canc.titulo);
  /* Se cierra el modal a mano y se COMPRUEBA que quedó cerrado: el
     camino "con tiempo" de askCancel no abre un modal nuevo, reutiliza el
     formulario de confirmación que se pinta en R(). Si el modal anterior
     seguía abierto, el de ahora se apilaría detrás y el test leería el
     título viejo. */
  await p.evaluate(() => {
    const b = document.querySelector("#mo [data-act='Mx']");
    if (b) b.click();
  });
  await p.waitForTimeout(900);
  chk(await p.evaluate(() => document.querySelector("#mo").hidden), "el modal anterior quedó cerrado");

  /* ---------- 4. con tiempo de sobra, cancelar sí pide confirmación ----------
     OJO: la confirmación NO es un modal. `askCancel` sólo pone `cx = id` y
     repinta, y el formulario se dibuja EN LÍNEA dentro de la tarjeta del
     turno (`cxForm`). Por eso el botón del Inicio necesita ese formulario
     propio: sin él el botón no hacía nada visible.

     Inyectar y actuar van en el MISMO evaluate: T está atado al snapshot
     de Firestore de "turnos", así que entre dos llamadas separadas el
     snapshot real pisa la lista sintética. */
  await p.evaluate(() => {
    window.__test.setTurnos([
      { id: "TESTOK", uid: window.__test.uid, d: "2030-05-01", t: "10:00", st: "pend", bid: "", s: 0, sid: "", nm: "S", bl: [] },
    ]);
  });
  await p.evaluate((id) => {
    window.__test.setTurnos([
      { id: "TESTOK", uid: window.__test.uid, d: "2030-05-01", t: "10:00", st: "pend", bid: "", s: 0, sid: "", nm: "S", bl: [] },
    ]);
    window.__test.askCancel("TESTOK");
  });
  await p.waitForTimeout(1400);
  const ok = await p.evaluate(() => {
    const app = document.querySelector("#app");
    const form = app.querySelector('[data-act="cancel"]');
    const volver = app.querySelector('[data-act="closeX"]');
    const motivos = app.querySelectorAll('[data-act="setMot"]');
    return {
      hayForm: !!form,
      confirmar: form ? form.textContent.trim() : null,
      confirmarActivo: form ? !form.disabled : null,
      volver: !!volver,
      motivos: motivos.length,
    };
  });
  chk(ok.hayForm, "con tiempo, cancelar pide confirmación (formulario en línea)");
  chk(ok.motivos > 0, "pide el motivo antes de cancelar", `${ok.motivos} motivos`);
  chk(/confirmar/i.test(ok.confirmar || ""), "el botón dice Confirmar cancelación", ok.confirmar);
  chk(ok.confirmarActivo === false, "no se puede confirmar sin motivo", String(ok.confirmarActivo));
  chk(ok.volver, "ofrece volver sin cancelar");

  /* Se elige un motivo y se vuelve atrás: no se toca nada */
  await p.evaluate(() => {
    const b = document.querySelector('#app [data-act="setMot"]');
    if (b) b.click();
  });
  await p.waitForTimeout(700);
  const conMotivo = await p.evaluate(() => {
    const f = document.querySelector('#app [data-act="cancel"]');
    return f ? !f.disabled : null;
  });
  chk(conMotivo === true, "con motivo, el botón se habilita", String(conMotivo));
  await p.evaluate(() => {
    const b = document.querySelector('#app [data-act="closeX"]');
    if (b) b.click();
  });
  await p.waitForTimeout(700);
  chk(await p.evaluate(() => !document.querySelector('#app [data-act="cancel"]')), "volver cierra la confirmación sin cancelar");

  /* ---------- 5. los botones existen donde el dueño los pidió ---------- */
  const botones = await p.evaluate(() => {
    window.__test.setTurnos([{ id: "TESTOK2", uid: window.__test.uid, d: "2030-05-01", t: "10:00", st: "pend", bid: "", s: 0, sid: "", nm: "S", bl: [] }]);
    location.hash = "#/inicio";
    return true;
  });
  await p.waitForTimeout(2000);
  const ini = await p.evaluate(() => {
    const app = document.querySelector("#app");
    return {
      reprogramar: !!app.querySelector('[data-act="reprogramar"]'),
      cancelar: !!app.querySelector('[data-act="askCancel"]'),
      proxima: !!app.querySelector(".ini-prox"),
    };
  });
  chk(ini.proxima, "la tarjeta de próximo turno aparece con el turno pendiente");
  chk(ini.reprogramar, "el Inicio tiene botón Reprogramar");
  chk(ini.cancelar, "el Inicio tiene botón Cancelar turno");

  await p.evaluate(() => { location.hash = "#/turnos"; });
  await p.waitForTimeout(2000);
  const tur = await p.evaluate(() => {
    const app = document.querySelector("#app");
    return {
      reprogramar: !!app.querySelector('[data-act="reprogramar"]'),
      cancelar: !!app.querySelector('[data-act="askCancel"]'),
    };
  });
  chk(tur.reprogramar, "Mis turnos también tiene Reprogramar");
  chk(tur.cancelar, "Mis turnos también tiene Cancelar");

  chk(errs.length === 0, "sin errores de JS", errs.slice(0, 2).join(" | "));

  await b.close();
  const fails = out.filter((r) => !r[0]);
  console.log(`\n${out.length - fails.length}/${out.length} OK · fallaron ${fails.length}`);
  process.exit(fails.length ? 1 : 0);
})();