/* Comprueba si el BARBERO puede guardar un turno desde Agenda. Es la forma
   corta de saber si las reglas de Firestore ya están publicadas en la
   consola: si el turno se crea, están bien; si salta "Missing or insufficient
   permissions", hay que ir a Firebase Console > Reglas y pegar
   FIRESTORE_RULES.txt.

   OJO: este script ESCRIBE un turno de prueba en la base real y después lo
   borra. Usa un cliente que no existe ("PRUEBA DE REGLAS") y una fecha lejana
   para que no moleste a nadie, pero si lo cortás a la mitad queda un turno
   basura en la agenda.

   Uso:  node tests\reglas.turnos.js            (pregunta antes de escribir)
         node tests\reglas.turnos.js --si       (escribe y borra sin preguntar)
*/
const fs = require("fs");
const path = require("path");

function envLocal() {
  const o = {};
  fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8")
    .split(/\r?\n/)
    .forEach((l) => {
      const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) o[m[1]] = m[2];
    });
  return o;
}

const E = envLocal();
const escribir = process.argv.includes("--si");

(async () => {
  if (!escribir) {
    const ok = await new Promise((res) => {
      process.stdin.setEncoding("utf8");
      process.stdout.write(
        "Este script crea un turno de prueba REAL en Firebase y después lo borra.\n" +
        "Si se corta a la mitad queda basura en la agenda.\n\n" +
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
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();
  const errores = [];
  page.on("console", (m) => m.type() === "error" && errores.push(m.text()));

  console.log("Entrando como barbero...");
  await page.goto("http://127.0.0.1:8765/index.html", { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".lb-wcard", { timeout: 25000 });
  await page.waitForTimeout(900);
  const vis = page.locator('[data-act="goLogin"]:visible');
  if (await vis.count()) await vis.first().click();
  else await page.evaluate(() => { location.hash = "#login"; });
  await page.waitForSelector("#ie", { timeout: 15000 });
  await page.fill("#ie", E.BARBERO_EMAIL);
  await page.fill("#ip", E.BARBERO_PASSWORD);
  await page.click('[data-act="entrar"]');
  await page.waitForTimeout(8000);

  const rol = await page.evaluate(() => location.hash);
  console.log("Entró en " + rol);
  if (rol.indexOf("agenda") < 0) {
    console.log("No entró como barbero. Revisá las credenciales de BARBERO_* en .env.local.");
    await browser.close();
    return;
  }

  await page.click("button:has-text('Agendar turno')");
  await page.waitForTimeout(1200);

  /* Cliente nuevo con un nombre imposible: si el turno llegara a existir, se
     reconoce a simple vista y se puede borrar a mano. */
  await page.fill("#agnn", "PRUEBA DE REGLAS");
  await page.waitForTimeout(500);

  const sel = page.locator(".card.man select");
  const n = await sel.count();
  const hora = await sel.nth(n - 1).evaluate((s) => {
    const ok = [...s.options].find((o) => /^\d\d:\d\d$/.test(o.value));
    return ok ? ok.value : "";
  });
  await sel.nth(n - 1).selectOption(hora);
  await page.waitForTimeout(800);
  console.log("Probando guardar a las " + hora + "...");

  await page.click('[data-act="agSave"]');
  await page.waitForTimeout(4000);

  const res = await page.evaluate(() => {
    const m = document.querySelector("#mo");
    const aviso = m && !m.hidden ? m.innerText.replace(/\s+/g, " ").slice(0, 160) : null;
    return { aviso, errores: [...document.querySelectorAll(".chip.on")].length };
  });
  const fallo = errores.find((x) => /permissions/i.test(x));

  if (fallo) {
    console.log("\nFALLO: las reglas de Firestore todavia no dejan guardar el turno.");
    console.log("  -> Firebase Console > Firestore Database > Reglas");
    console.log("  -> Pegar TODO el contenido de FIRESTORE_RULES.txt (empezando por");
    console.log("     la linea 'rules_version' y terminando en la llave final '}' )");
    console.log("  -> Boton PUBLICAR");
    console.log("  -> Volver a correr este script");
  } else {
    console.log("\nOK: el barbero pudo guardar el turno. Las reglas estan publicadas.");
    console.log("El turno de prueba se llama 'PRUEBA DE REGLAS'; borralo de la agenda.");
  }
  if (res.aviso) console.log("\nAviso en pantalla: " + res.aviso);

  await browser.close();
})();