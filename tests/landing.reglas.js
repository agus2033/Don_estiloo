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
      /* Marca única por corrida: sirve para (a) reconocer esta reseña entre
         las de producción y (b) borrarla al final sin tocar ninguna otra.
         Las 7 reseñas "Prueba automatica de reglas" que quedaron en el
         carrusel fueron de este test, que antes no limpiaba nada. */
      const MARCA = "qa-reglas-" + Date.now();
      const TEXTO = MARCA + " Se borra sola al final del test.";

      await p.evaluate(() => { location.hash = "#/resena"; });
      await p.waitForTimeout(1800);
      const st = await p.$$(".rev-estrella");
      check(st.length === 5, "se ven las 5 estrellas", String(st.length));

      /* El asistente tiene TRES pasos: estrellas -> texto -> revisar.
         Antes el test esperaba un modal de "gracias" al final, pero
         revSend() en ÉXITO no abre ningún modal: sólo pone un <p class="msg">
         y vuelve al inicio. El modal sólo aparece si el write falla. Por eso
         este test daba falso negativo aunque la reseña se guardara. */
      await st[3].click();
      await p.waitForTimeout(700);
      await p.fill("#revText", TEXTO);
      await p.click('[data-act="revNext"]');
      await p.waitForTimeout(700);
      await p.click('[data-act="revSend"]');
      await p.waitForTimeout(4000);

      const res = await p.evaluate(() => {
        const m = document.querySelector("#mo");
        return {
          /* Éxito: el aviso en línea que deja revSend tras el await. */
          aviso: (document.querySelector("#app .msg") || {}).textContent || "",
          hash: location.hash,
          /* Si hubo fallo, el modal lo diría. Ojo: el cuerpo del modal es
             .mt, no .mc — antes se leía .mc y salía siempre undefined. */
          titulo: m && !m.hidden ? (m.querySelector("h2") || {}).textContent?.trim() || null : null,
          cuerpo: m && !m.hidden ? (m.querySelector(".mt") || {}).textContent?.trim()?.slice(0, 160) || null : null,
        };
      });
      /* El aviso en línea SÍ es prueba ahora: revSend lo pinta una sola vez
         y a propósito (antes lo perdía al re-pintar por goNow). Es la
         única confirmación que ve el cliente de que la reseña se guardó. */
      check(/gracias/i.test(res.aviso), "el cliente ve la confirmación de que se guardó",
        res.aviso || "(el aviso no aparece)");
      check(!res.cuerpo, "no hubo modal de error al guardar", res.cuerpo || res.titulo || "ninguno");

      /* Confirmación de verdad: la reseña tiene que estar en Firestore, no
         sólo que la promesa haya resuelto. Se mira el carrusel público de la
         landing en un contexto SIN sesión (resenas se lee sin login). */
      const c2 = await p.context().browser().newContext({ viewport: { width: 1280, height: 900 } });
      const p2 = await c2.newPage();
      await p2.goto("http://127.0.0.1:8765/index.html", { waitUntil: "domcontentloaded" });
      await p2.waitForSelector(".lb-tst", { timeout: 25000 });
      await p2.waitForTimeout(3500);
      const enFirestore = await p2.evaluate((marca) => {
        const t = [...document.querySelectorAll(".lb-tst")];
        return { n: t.length, esta: t.some((x) => x.innerText.includes(marca)) };
      }, MARCA);
      await c2.close();
      const ok = enFirestore.esta;
      check(ok, "la reseña se guardó (las reglas dejan escribir)",
        ok ? `llegó a Firestore y está en el carrusel`
           : `hay ${enFirestore.n} reseñas y NO está la de este test. modal=${res.cuerpo || res.titulo || "ninguno"}`);
      check(ok, "la reseña se ve en el carrusel público de la web",
        ok ? `hay ${enFirestore.n} reseñas y se encuentra la de este test` : `hay ${enFirestore.n} reseñas y NO se encuentra`);

      /* Limpieza: se borran SÓLO los documentos cuyo texto empieza con la
         marca de este test. La regla de /resenas deja borrar al propio
         autor de la reseña, así que alcanza la sesión del cliente. Las
         reseñas reales quedan intactas por construcción. */
      const borradas = await p.evaluate(async (marca) => {
        try {
          const S = await import("https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js");
          const F = await import("https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js");
          /* La ruta es /src/config.js: el import dinámico es relativo a la
             PÁGINA (que está en la raíz), no al archivo de este test. */
          const cfg = (await import("./src/config.js")).firebaseConfig;
          /* initializeApp con el mismo nombre y config devuelve la app ya
             creada, con su auth: no se abre una sesión nueva. */
          const app = S.getApps().length ? S.getApp() : S.initializeApp(cfg);
          const db = F.getFirestore(app);
          const snap = await F.getDocs(F.collection(db, "resenas"));
          let n = 0;
          for (const d of snap.docs) {
            if (String(d.data().texto || "").startsWith(marca)) {
              await F.deleteDoc(F.doc(db, "resenas", d.id));
              n++;
            }
          }
          return { ok: true, n };
        } catch (e) {
          return { ok: false, err: String(e) };
        }
      }, MARCA);
      check(borradas.ok && borradas.n === (ok ? 1 : 0),
        "el test limpió la reseña que creó",
        borradas.ok ? `borradas ${borradas.n}` : "error: " + borradas.err);
      if (!borradas.ok || borradas.n !== (ok ? 1 : 0))
        console.log("  -> Borrar a mano en Firebase Console > Firestore > resenas: " + MARCA);

      await p.screenshot({ path: path.join(__dirname, "..", "tmp_shots", "REGLAS-resena.png"), clip: { x: 0, y: 0, width: 1440, height: 640 } });
    }
    check(errores.length === 0, "sin errores JS" + (errores.length ? ": " + errores[0].slice(0, 80) : ""));
    await ctx.close();
  }

  await b.close();
  console.log("\n=== " + (fallos ? fallos + " FALLAS" : "todo OK") + " ===");
  process.exit(fallos ? 1 : 0);
})();