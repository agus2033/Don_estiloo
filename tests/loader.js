/* Loader de arranque: el logo de Codigo Barber en lugar del poste de barbero.

   Comprueba tres cosas que se rompen fácil:
     1. Que el logo esté y sea visible (si el src no carga, el disco queda
        vacío y no se ve nada: es el fallo más probable).
     2. Que la ruta del `src` del HTML sea la misma que `LOGO` de
        src/config.js. El src está escrito a mano en index.html a propósito
        (el loader se ve antes de que cargue el módulo), así que la única
        forma de que se desincronicen es que alguien cambie uno de los dos.
     3. Que el loader se vaya solo y que el texto siga anunciándose para
        lectores de pantalla.
*/
const { chromium } = require("../.opencode/skills/playwright-skill/node_modules/playwright/index.js");
const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..");
let fallos = 0;
const ok = (c, m) => {
  console.log((c ? "  OK   " : "  FALLA ") + m);
  if (!c) fallos++;
};

(async () => {
  /* --- 1. la ruta del HTML contra la de config.js, sin navegador --- */
  const html = fs.readFileSync(path.join(RAIZ, "index.html"), "utf8");
  const cfg = fs.readFileSync(path.join(RAIZ, "src", "config.js"), "utf8");
  const delHtml = (html.match(/class="lgl"[^>]*src="([^"]+)"/) || [])[1];
  const delCfg = (cfg.match(/export const LOGO = "([^"]+)"/) || [])[1];
  ok(!!delHtml, "el loader declara el logo en index.html");
  ok(!!delCfg, "config.js declara LOGO");
  ok(delHtml === delCfg, "las dos rutas coinciden", `${delHtml} vs ${delCfg}`);
  ok(
    fs.existsSync(path.join(RAIZ, delHtml || "")),
    "el archivo del logo existe",
    delHtml || "(sin ruta)",
  );

  /* --- 2. el poste viejo no debe quedar ---
     Las expresiones van ancladas al principio de línea porque el comentario
     que explica la baja menciona los nombres de las reglas que se fueron
     (`.bp, .bp i, @keyframes bp`) y una búsqueda suelta lo tomaría como si
     siguieran ahí. */
  const css = fs.readFileSync(path.join(RAIZ, "src", "styles.css"), "utf8");
  ok(!/^\s*\.bp[\s,{]/m.test(css), "ya no están las reglas del poste de barbero (.bp)");
  ok(!/^\s*@keyframes\s+bp\s*\{/m.test(css), "ya no está la animación del poste");
  ok(!/^\s*\.bp\s+[a-z]/m.test(css), "ni sus estados (hijos, antes, etc.)");

  /* --- 3. en el navegador --- */
  const b = await chromium.launch();

  /* 3a. con la red a Firestore cortado, el loader se queda en pantalla y se
     lo puede medir. */
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  await p.route("**/firestore.googleapis.com/**", (r) => r.abort());
  p.goto("http://127.0.0.1:8765/index.html", { waitUntil: "domcontentloaded" }).catch(() => {});
  await p.waitForTimeout(2500);

  const ld = await p.evaluate(() => {
    const c = document.getElementById("ld");
    const img = c && c.querySelector(".lgl");
    const cs = c ? getComputedStyle(c) : null;
    return {
      existe: !!c,
      oculto: c ? c.classList.contains("off") : null,
      cargo: img ? img.complete && img.naturalWidth > 0 : false,
      natural: img ? img.naturalWidth + "x" + img.naturalHeight : null,
      src: img ? img.getAttribute("src") : null,
      alto: img ? img.offsetHeight : 0,
      ancho: img ? img.offsetWidth : 0,
      texto: (document.getElementById("ldt") || {}).textContent || "",
      fondo: cs ? cs.backgroundColor : null,
      role: c ? c.getAttribute("role") : null,
      live: c ? c.getAttribute("aria-live") : null,
      anim: c && c.querySelector(".lgc") ? getComputedStyle(c.querySelector(".lgc")).animationName : null,
      anillo: c && c.querySelector(".lgc")
        ? getComputedStyle(c.querySelector(".lgc"), "::after").animationName
        : null,
    };
  });
  ok(ld.existe, "el loader está en pantalla");
  ok(ld.cargo, "el logo se descargó y se ve", `natural=${ld.natural} ${ld.ancho}x${ld.alto}px`);
  ok(ld.ancho > 80 && ld.alto > 80, "el logo tiene tamaño real, no collapsed", `${ld.ancho}x${ld.alto}`);
  ok(!!ld.texto, "dice algo abajo", ld.texto);
  ok(ld.role === "status" && ld.live === "polite", "anuncia el estado a lectores de pantalla", `${ld.role}/${ld.live}`);
  ok(ld.anim === "ldLatido", "el disco late", ld.anim);
  ok(ld.anillo === "ldGiro", "el anillo dorado gira", ld.anillo);

  await p.screenshot({ path: path.join(__dirname, "tmp_shots", "loader-logo.png") });
  await ctx.close();

  /* 3b. con la red normal, el loader tiene que irse solo. */
  const p2 = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await p2.goto("http://127.0.0.1:8765/index.html", { waitUntil: "domcontentloaded" });
  await p2.waitForSelector(".lb-wcard", { timeout: 25000 });
  await p2.waitForTimeout(2500);
  ok(
    await p2.evaluate(() => document.getElementById("ld").classList.contains("off")),
    "el loader se oculta solo cuando la app ya está",
  );

  /* 3c. prefers-reduced-motion: sin animación pero el logo sigue ahí. */
  const ctx3 = await b.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
  const p3 = await ctx3.newPage();
  await p3.route("**/firestore.googleapis.com/**", (r) => r.abort());
  p3.goto("http://127.0.0.1:8765/index.html", { waitUntil: "domcontentloaded" }).catch(() => {});
  await p3.waitForTimeout(2000);
  const rm = await p3.evaluate(() => {
    const c = document.querySelector(".lgc");
    return c
      ? { anim: getComputedStyle(c).animationName, alto: c.offsetHeight }
      : { anim: "sin disco", alto: 0 };
  });
  ok(rm.anim === "none", "con reducir movimiento el disco no late", rm.anim);
  ok(rm.alto > 80, "pero el logo sigue mostrándose", `${rm.alto}px`);

  console.log(fallos ? "\nFALLARON " + fallos : "\nTODO VERDE");
  await b.close();
  process.exit(fallos ? 1 : 0);
})();
