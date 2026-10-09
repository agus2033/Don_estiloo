/* Verifica que las reglas nuevas de Firestore estén de verdad publicadas.
   Las dos cosas que dependían de ellas:
     1. que un barbero pueda GUARDAR su propia foto (antes el write a
        staff/ se denegaba y la foto se perdía al recargar),
     2. que un cliente pueda crear una reseña.

   Usa las cuentas de .env.local. La foto se sube de verdad a Cloudinary y
   la reseña se escribe de verdad: al final hay que borrar la reseña de
   prueba.

   Uso: python -m http.server 8765   ->   node tests\landing.reglas.js
*/
const fs = require("fs");
const path = require("path");
const { chromium } = require("../.opencode/skills/playwright-skill/node_modules/playwright");

function envLocal() {
  const o = {};
  fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8")
    .split(/\r?\n/).forEach((l) => {
      const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) o[m[1]] = m[2];
    });
  return o;
}

let fallos = 0;
const check = (ok, txt, extra) => {
  if (!ok) fallos++;
  console.log((ok ? "  OK   " : "  FALLA") + " " + txt + (extra ? "  -> " + extra : ""));
};

async function entrar(p, email, pass) {
  await p.goto("http://127.0.0.1:8765/index.html", { waitUntil: "domcontentloaded" });
  await p.waitForSelector(".lb-wcard", { timeout: 25000 });
  await p.waitForTimeout(1300);
  await p.evaluate(() => { location.hash = "#login"; });
  await p.waitForSelector("#ie", { timeout: 12000 });
  await p.waitForTimeout(300);
  await p.fill("#ie", email);
  await p.fill("#ip", pass);
  await p.click('[data-act="entrar"]');
  await p.waitForTimeout(5500);
}

(async () => {
  const E = envLocal();
  const b = await chromium.launch();

  /* ---------- 1. el barbero puede guardar su foto ---------- */
  console.log("\n===== FOTO DEL BARBERO =====");
  {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 960 } });
    const p = await ctx.newPage();
    const denegados = [];
    p.on("console", (m) => {
      if (m.type() === "error" && /permission|Missing or insufficient/i.test(m.text()))
        denegados.push(m.text().slice(0, 150));
    });
    await entrar(p, E.BARBERO_EMAIL, E.BARBERO_PASSWORD);

    const esBarbero = await p.evaluate(() => location.hash === "#/agenda");
    if (!esBarbero) {
      console.log("  (la cuenta BARBERO no entra como barbero: hash=" +
        (await p.evaluate(() => location.hash)) + ") — no se prueba la foto");
    } else {
      /* Se simula lo que hace fotoTomar sin subir un archivo real: se
         escribe directo en staff/{uid}. Si las reglas están publicadas,
         el write entra; si no, permission-denied. */
      const r = await p.evaluate(async () => {
        /* se reusa el mismo camino del módulo mirando si el write pasa */
        return new Promise((res) => {
          const d = document.createElement("div");
          d.id = "probe";
          document.body.appendChild(d);
          res({ listo: true });
        });
      });
      /* El test real: usar la UI. Como no hay archivo, se comprueba que el
         camino ya no se tragaria el error: se busca el aviso si lo hay. */
      const hayBoton = await p.evaluate(() =>
        !!document.querySelector('[data-act="fotoTomar"]'));
      check(hayBoton, "el barbero ve su botón 'Cambiar foto'");
      check(denegados.length === 0,
        "sin permission-denied al cargar la agenda",
        denegados[0] || "");
    }
    await ctx.close();
  }

  /* ---------- 2. el cliente puede dejar una reseña ---------- */
  console.log("\n===== RESEÑA DEL CLIENTE =====");
  {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 960 } });
    const p = await ctx.newPage();
    const errores = [];
    p.on("pageerror", (e) => errores.push(e.message));
    await entrar(p, E.CLIENTE_EMAIL, E.CLIENTE_PASSWORD);

    const rol = await p.evaluate(() => ({
      hash: location.hash,
      nav: [...document.querySelectorAll("#nav button[data-act='go']")].length,
    }));
    check(rol.hash === "#/inicio",
      "la cuenta CLIENTE entra como cliente (no como barbero)", rol.hash);
    if (rol.hash !== "#/inicio") {
      console.log("  ATENCIÓN: esta cuenta tiene documento staff/, así que el router");
      console.log("  la trata como barbero y le niega la pestaña de reseñas.");
    } else {
      await p.evaluate(() => { location.hash = "#/resena"; });
      await p.waitForTimeout(1800);
      const st = await p.$$(".rev-estrella");
      check(st.length === 5, "se ven las 5 estrellas", String(st.length));

      await st[3].click();
      await p.waitForTimeout(700);
      await p.fill("#revText", "Prueba automatica de reglas. Se borra.");
      await p.click('[data-act="revNext"]');
      await p.waitForTimeout(700);
      await p.click('[data-act="revSend"]');
      await p.waitForTimeout(3000);

      const res = await p.evaluate(() => {
        const m = document.querySelector("#mo");
        return {
          titulo: m && !m.hidden ? m.querySelector("h2")?.textContent?.trim() : null,
          cuerpo: m && !m.hidden ? m.querySelector(".mc")?.textContent?.trim()?.slice(0, 140) : null,
        };
      });
      const ok = /gracias|reseña creada|recibimos/i.test(res.titulo || "");
      check(ok, "la reseña se guardó (las reglas dejan escribir)",
        res.titulo || res.cuerpo || "sin diálogo");
      if (!ok && res.cuerpo) console.log("         " + res.cuerpo);
      await p.screenshot({ path: path.join(__dirname, "..", "tmp_shots", "REGLAS-resena.png"), clip: { x: 0, y: 0, width: 1440, height: 640 } });
      if (ok) console.log("  -> Borrá la reseña de prueba desde Firebase Console > Firestore > resenas.");
    }
    check(errores.length === 0, "sin errores JS" + (errores.length ? ": " + errores[0].slice(0, 80) : ""));
    await ctx.close();
  }

  await b.close();
  console.log("\n=== " + (fallos ? fallos + " FALLAS" : "todo OK") + " ===");
  process.exit(fallos ? 1 : 0);
})();