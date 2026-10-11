/* Limpia las reseñas de prueba que dejaron corridas viejas de
   landing.reglas.js y de los diagnósticos.

   POR DEFECTO NO BORRA NADA: lista lo que hay y espera confirmación.
   Recién con --borrar borra, y aun así SÓLO toca documentos cuyo texto
   empieza con una de las marcas de prueba. Las reseñas reales ("Muy bueno
   el corte", "asd") quedan intactas por construcción: no hay forma de que
   coincidan con una marca.

   Uso:
     node tests\resenas.limpiar.js            # lista, no borra
     node tests\resenas.limpiar.js --borrar   # borra las de prueba

   Necesita el servidor en el 8765. No necesita sesión: `resenas` se lee
   sin login, y el borrado se hace con la cuenta de prueba del .env.local
   (las reglas dejan borrar al propio autor de su reseña). Si esa cuenta no
   puede borrar, el script lo dice y hay que hacerlo a mano desde Firebase
   Console. */
const { chromium } = require("../.opencode/skills/playwright-skill/node_modules/playwright/index.js");
const fs = require("fs");
const path = require("path");

/* Prefijos que identifican una reseña de prueba. Cualquier otra cosa se
   considera real y no se toca. */
const MARCAS = ["qa-reglas-", "Diagnostico ", "Prueba automatica de reglas"];

function envLocal() {
  const o = {};
  const p = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(p)) return o;
  fs.readFileSync(p, "utf8").split(/\r?\n/).forEach((l) => {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) o[m[1]] = m[2].replace(/^["']|["']$/g, "");
  });
  return o;
}

const BORRAR = process.argv.includes("--borrar");

(async () => {
  const env = envLocal();
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();

  // Entra con la cuenta de prueba: el borrado de /resenas lo autoriza el
  // propio autor de la reseña.
  await p.goto("http://127.0.0.1:8765/index.html", { waitUntil: "domcontentloaded" });
  await p.waitForSelector(".lb-wcard", { timeout: 25000 });
  await p.waitForTimeout(1200);
  const vis = p.locator('[data-act="goLogin"]:visible');
  if (await vis.count()) await vis.first().click();
  else await p.evaluate(() => { location.hash = "#login"; });
  await p.waitForSelector("#ie", { timeout: 15000 });
  await p.fill("#ie", env.CLIENTE_EMAIL || "");
  await p.fill("#ip", env.CLIENTE_PASSWORD || "");
  await p.click('[data-act="entrar"]');
  await p.waitForTimeout(7000);
  const entro = await p.evaluate(() => !!document.querySelector("#nmenu, #app"));
  if (!entro) {
    console.log("No se pudo iniciar sesión con la cuenta de prueba.");
    console.log("Podés borrarlas a mano: Firebase Console > Firestore > resenas");
    await b.close();
    process.exit(1);
  }

  const r = await p.evaluate(async (marcas) => {
    const S = await import("https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js");
    const F = await import("https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js");
    const cfg = (await import("./src/config.js")).firebaseConfig;
    const app = S.getApps().length ? S.getApp() : S.initializeApp(cfg);
    const db = F.getFirestore(app);
    const snap = await F.getDocs(F.collection(db, "resenas"));
    const prueba = [],
      reales = [];
    for (const d of snap.docs) {
      const t = String(d.data().texto || "");
      (marcas.some((m) => t.startsWith(m)) ? prueba : reales).push({ id: d.id, texto: t, nm: d.data().nm || "" });
    }
    return { total: snap.size, prueba, reales };
  }, MARCAS);

  console.log(`\n=== RESEÑAS: ${r.total} en total ===`);
  console.log(`\nPRUEBA (${r.prueba.length}) — se pueden borrar:`);
  r.prueba.forEach((x) => console.log(`  ${x.id}  "${x.texto.slice(0, 80)}"  — ${x.nm}`));
  console.log(`\nREALES (${r.reales.length}) — NO se tocan:`);
  r.reales.forEach((x) => console.log(`  ${x.id}  "${x.texto.slice(0, 80)}"  — ${x.nm}`));

  if (!BORRAR) {
    console.log(`\nNo se borró nada. Para borrar las ${r.prueba.length} de prueba:`);
    console.log(`  node tests\\resenas.limpiar.js --borrar`);
    await b.close();
    return;
  }
  if (!r.prueba.length) {
    console.log("\nNo hay reseñas de prueba: nada que borrar.");
    await b.close();
    return;
  }

  const res = await p.evaluate(async (marcas) => {
    const S = await import("https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js");
    const F = await import("https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js");
    const cfg = (await import("./src/config.js")).firebaseConfig;
    const app = S.getApps().length ? S.getApp() : S.initializeApp(cfg);
    const db = F.getFirestore(app);
    const snap = await F.getDocs(F.collection(db, "resenas"));
    let ok = 0,
      fallos = 0;
    const errs = [];
    for (const d of snap.docs) {
      const t = String(d.data().texto || "");
      if (!marcas.some((m) => t.startsWith(m))) continue;
      try {
        await F.deleteDoc(F.doc(db, "resenas", d.id));
        ok++;
      } catch (e) {
        fallos++;
        errs.push(d.id + ": " + String(e).slice(0, 90));
      }
    }
    return { ok, fallos, errs };
  }, MARCAS);

  console.log(`\n=== BORRADO ===`);
  console.log(`  borradas: ${res.ok}   fallidas: ${res.fallos}`);
  res.errs.forEach((e) => console.log("  ! " + e));
  if (res.fallos) console.log("  -> Borrar a mano desde Firebase Console > Firestore > resenas.");
  await b.close();
})();
