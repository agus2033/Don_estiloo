/* Sonda manual del lote 50: el pulgar de goma en la barra de fichas del
   panel. NO está en run.js: necesita servidor 8765 y las cuentas de
   .env.local.
   Verifica en 1440 (fichas de arriba, anchos DESIGUALES) y en 390 (barra
   fija de abajo, 3 fichas + bandeja):
   - el span .nav-th existe y su rect coincide con el del botón activo;
   - al tocar otra sección, el pulgar VIAJA: sin el innerHTML reconstruido
     no habría animación, así que nvTh le pasa la posición vieja como
     punto de partida — acá se comprueba el DESTINO correcto;
   - el activo escondido (bandeja) apaga el pulgar;
   - los otros botones no tienen fondo: la ficha entera va en el pulgar.
   Uso:  node tests\nv-probe.js   (servidor en 8765 requerido) */
const path = require("path");
const fs = require("fs");
const { chromium } = require("../.opencode/skills/playwright-skill/node_modules/playwright/index.js");

const env = {};
fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8")
  .split(/\r?\n/)
  .forEach((l) => {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2];
  });

(async () => {
  const b = await chromium.launch();
  let malo = 0;
  const chk = (ok, txt, extra) => {
    console.log((ok ? "  OK    " : "  FALLA ") + txt + (ok ? "" : "  -> " + (extra || "")));
    if (!ok) malo++;
  };

  for (const vp of [
    { w: 1440, h: 900, etq: "1440" },
    { w: 390, h: 844, etq: "390" },
  ]) {
    const p = await (await b.newContext({ viewport: { width: vp.w, height: vp.h } })).newPage();
    await p.goto("http://127.0.0.1:8765/index.html", { waitUntil: "domcontentloaded" });
    await p.waitForSelector(".lb-wcard", { timeout: 30000 });
    await p.waitForTimeout(1200);
    const vis = p.locator('[data-act="goLogin"]:visible');
    if (await vis.count()) await vis.first().click();
    else await p.evaluate(() => { location.hash = "#login"; });
    await p.waitForSelector("#ie", { timeout: 20000 });
    await p.fill("#ie", env.DUENO_EMAIL);
    await p.fill("#ip", env.DUENO_PASSWORD);
    await p.click('[data-act="entrar"]');
    await p.waitForTimeout(13000);
    await p.waitForSelector("#nav button", { timeout: 25000 });
    await p.waitForTimeout(600);

    const mide = () =>
      p.evaluate(() => {
        const nav = document.querySelector("#nav"),
          th = nav.querySelector(".nav-th"),
          act = nav.querySelector("button.on");
        const r = (el) => {
          if (!el || !el.getClientRects().length) return null;
          const b = el.getBoundingClientRect(), n = nav.getBoundingClientRect();
          return { x: Math.round(b.left - n.left), y: Math.round(b.top - n.top), w: Math.round(b.width), h: Math.round(b.height) };
        };
        return { th: th ? r(th) : null, act: r(act), thOp: th ? getComputedStyle(th).opacity : "-", cls: nav.className, vis: th ? getComputedStyle(th).visibility : "-" };
      });
    const cerca = (a, z) => Math.abs(a.x - z.x) <= 2 && Math.abs(a.y - z.y) <= 2 && Math.abs(a.w - z.w) <= 2 && Math.abs(a.h - z.h) <= 2;

    let m = await mide();
    chk(!!m.th, vp.etq + ": el .nav-th existe", JSON.stringify(m));
    chk(m.th && m.thOp === "1", vp.etq + ": el pulgar prende con el activo visible", "op=" + m.thOp);
    chk(m.th && m.act && cerca(m.th, m.act), vp.etq + ": el pulgar calza EXACTO sobre la ficha activa", JSON.stringify({ th: m.th, act: m.act }));
    /* anchos DESIGUALES: a 1440 hay 8 fichas flex-none y cada una mide lo
       suyo (Dashboard 101px vs Galería 76px medidos al explorar el terreno).
       Es la razón por la que el pulgar mide botón por botón en vivo y no
       calc(/N) a ciegas. En celular son flex:1 iguales; ahí no corre. */
    const anchos = await p.evaluate(() =>
      [
        ...new Set(
          [...document.querySelectorAll("#nav button")]
            .filter((x) => x.getClientRects().length)
            .map((x) => Math.round(x.getBoundingClientRect().width)),
        ),
      ].length,
    );
    chk(vp.w !== 1440 || anchos >= 3, "1440: anchos de ficha DESIGUALES (nada de calc(/N))", "anchos distintos: " + anchos);
    await p.screenshot({ path: path.join(__dirname, "..", "tmp_shots", "50-goma-" + vp.etq + "-a.png") });

    /* tocar otra sección: el pulgar tiene que aterrizar en la ficha nueva */
    const destino = vp.w === 1440 ? "Agenda" : "Clientes";
    await p.evaluate((d) => {
      const btn = [...document.querySelectorAll("#nav button")].find((x) => (x.textContent || "").trim().startsWith(d));
      if (btn) btn.click();
    }, destino);
    await p.waitForTimeout(650); /* la curva tarda ~300 ms */
    m = await mide();
    const txtAct = await p.evaluate(() => (document.querySelector("#nav button.on") || ({})).textContent.trim().slice(0, 12));
    chk(txtAct.startsWith(destino), vp.etq + ": la ficha activa es " + destino, txtAct);
    chk(m.th && m.act && cerca(m.th, m.act), vp.etq + ": tras el clic el pulgar calza sobre " + destino, JSON.stringify({ th: m.th, act: m.act }));
    await p.screenshot({ path: path.join(__dirname, "..", "tmp_shots", "50-goma-" + vp.etq + "-b.png") });

    /* activo escondido en la bandeja (sólo 390: Mensajes está escondido) */
    if (vp.w === 390) {
      await p.evaluate(() => {
        const mas = document.querySelector("#nav .nav-mas");
        if (mas) mas.click();
      });
      await p.waitForTimeout(400);
      await p.evaluate(() => {
        const it = [...document.querySelectorAll("#nmenu button")].find((x) => (x.textContent || "").includes("Mensajes"));
        if (it) it.click();
      });
      await p.waitForTimeout(650);
      const op = await p.evaluate(() => {
        const th = document.querySelector("#nav .nav-th");
        return th ? getComputedStyle(th).opacity : "sin th";
      });
      chk(op === "0", "390: activo en la BANDEJA (invisible) -> el pulgar se apaga", "op=" + op);
      await p.screenshot({ path: path.join(__dirname, "..", "tmp_shots", "50-goma-390-c.png") });
    }

    /* tema claro. La expectativa es POR SUPERFICIE y sale del CSS viejo:
       - celular: la barra es oscura en los dos temas y el tinte queda en el
         dorado claro #c9a24b al 18% — con el --brass DE CLARO (#7d621b, un
         dorado oscuro) sobre la barra oscura quedaban 2.55:1, ilegible. O
         sea: el computed NO cambia de tema acá, coincide con la fórmula
         light clavada (srgb 0.788/0.635/0.294 = #c9a24b).
       - escritorio: el nav pisa el header, que SÍ cambia con el tema, y el
         tiente baja al 10% — ahí el computed cambia entre temas. */
    const bgDark = await p.evaluate(() => {
      const th = document.querySelector("#nav .nav-th");
      return th ? getComputedStyle(th).backgroundColor : null;
    });
    await p.evaluate(() => {
      const b = document.querySelector("#thm");
      if (b) b.click();
    });
    await p.waitForTimeout(600);
    const bgLight = await p.evaluate(() => {
      const th = document.querySelector("#nav .nav-th");
      return th ? getComputedStyle(th).backgroundColor : null;
    });
    if (vp.w === 1440) {
      chk(
        bgLight && bgDark && bgLight !== bgDark,
        "1440: el tinte del pulgar cambia con el tema (nav sobre header claro)",
        bgDark + " vs " + bgLight,
      );
    } else {
      chk(
        bgLight && bgDark && bgLight === bgDark && bgLight.includes("0.788235 0.635294 0.294118 / 0.18"),
        "390: tinte del pulgar = dorado claro #c9a24b al 18% en los DOS temas (barra siempre oscura)",
        bgDark + " vs " + bgLight,
      );
    }
    await p.screenshot({ path: path.join(__dirname, "..", "tmp_shots", "50-goma-" + vp.etq + "-clara.png") });

    /* sin fondo duro: ningún botón .on lleva background propio */
    const fondos = await p.evaluate(() =>
      [...document.querySelectorAll("#nav button")].filter((x) => {
        const bg = getComputedStyle(x).backgroundColor;
        return bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent";
      }).length,
    );
    chk(fondos === 0, vp.etq + ": ningún botón .on lleva fondo duro (lo pinta el pulgar)", "con fondo: " + fondos);
    await p.close();
  }
  await b.close();
  console.log(malo ? "\n=== " + malo + " FALLAS ===" : "\n=== SONDA OK ===");
  process.exit(malo ? 1 : 0);
})();
