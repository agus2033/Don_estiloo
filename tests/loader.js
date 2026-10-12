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
      /* Capa de ABAJO: el escudo entero, apagado. Nunca se mueve ni se recorta. */
      opacidad: c && c.querySelector(".lgl") ? getComputedStyle(c.querySelector(".lgl")).opacity : null,
      recorteAbajo: c && c.querySelector(".lgl")
        ? getComputedStyle(c.querySelector(".lgl")).clipPath
        : null,
      /* Capa de ARRIBA: la que se revela. Es un pseudo-elemento. */
      anim: c ? getComputedStyle(c.querySelector(".lgc"), "::before").animationName : null,
      /* La línea. */
      anillo: c ? getComputedStyle(c.querySelector(".lgc"), "::after").animationName : null,
      lineaIzq: c ? getComputedStyle(c.querySelector(".lgc"), "::after").left : null,
      lineaDer: c ? getComputedStyle(c.querySelector(".lgc"), "::after").right : null,
      transform: c && c.querySelector(".lgc") ? getComputedStyle(c.querySelector(".lgc")).transform : null,
    };
  });
  ok(ld.existe, "el loader está en pantalla");
  ok(ld.cargo, "el logo se descargó y se ve", `natural=${ld.natural} ${ld.ancho}x${ld.alto}px`);
  ok(ld.ancho > 80 && ld.alto > 80, "el logo tiene tamaño real, no collapsed", `${ld.ancho}x${ld.alto}`);
  ok(!!ld.texto, "dice algo abajo", ld.texto);
  ok(ld.role === "status" && ld.live === "polite", "anuncia el estado a lectores de pantalla", `${ld.role}/${ld.live}`);

  /* El dueño pidió que NO gire y que el logo se revele de arriba hacia abajo.
     Antes eran `ldLatido` (el disco latía) y `ldGiro` (un aro girando); los
     dos tienen que estar ausentes. */
  ok(ld.anim === "ldBarrido", "la capa de arriba se destapa con el barrido", ld.anim);
  ok(ld.anillo === "ldLinea", "la línea de luz baja con la línea", ld.anillo);
  ok(ld.transform === "none", "nada gira: el disco no tiene transform", ld.transform);

  /* --- lo que arregla el cuadrado negro --- */
  /* La capa de abajo tiene que estar APAGADA: si queda en opacidad 1 no se
     nota la diferencia entre las dos capas y el barrido no se entiende. */
  const opa = parseFloat(ld.opacidad);
  ok(
    opa > 0 && opa < 0.5,
    "el escudo de abajo está apagado (silueta, no imagen rota)",
    "opacity=" + ld.opacidad,
  );
  /* Y lo más importante: NO puede estar recortada. Si la capa de abajo tuviera
     un clip-path, la mitad de abajo volvería a quedar en negro y se repetiría
     exactamente el defecto que el dueño mandó arreglar. */
  ok(
    !ld.recorteAbajo || ld.recorteAbajo === "none",
    "el escudo de abajo NO está recortado (es el hueco que se había arreglado)",
    ld.recorteAbajo,
  );

  /* --- la línea no se sale del cuadro --- */
  const li = parseFloat(ld.lineaIzq),
    ldDer = parseFloat(ld.lineaDer);
  ok(
    Number.isFinite(li) && Number.isFinite(ldDer) && li > 0 && ldDer > 0,
    "la línea va DENTRO del redondeo, no se sale por los lados",
    "left=" + ld.lineaIzq + " right=" + ld.lineaDer,
  );
  /* El barrido tiene que ser un recorte desde abajo (inset inferior 100%),
     que es lo que hace que lo primero que aparezca sea la parte de arriba.

     NO se puede mirar `getComputedStyle().clipPath` con la animación corriendo:
     devuelve el valor interpolado del cuadro en curso, no el de partida, y
     por eso la comprobación va contra el CSS fuente, que es lo que además hay
     que revisar cuando se cambia la animación. */
  const reglaBr = (css.match(/\.lgc::before\s*\{([^}]*)\}/) || [])[1] || "";
  ok(
    /clip-path:\s*inset\([^)]*100%/.test(reglaBr),
    "la capa de arriba arranca oculta desde abajo (inset inferior 100%)",
    reglaBr.replace(/\s+/g, " ").trim().slice(0, 90),
  );
  /* Y la de abajo, sin clip-path: es la que hace de silueta. */
  const reglaLgl = (css.match(/\.lgl\s*\{([^}]*)\}/) || [])[1] || "";
  ok(!/clip-path/.test(reglaLgl), "el escudo de abajo no lleva clip-path", reglaLgl.slice(0, 70));
  /* La capa de arriba tiene que ser el MISMO archivo que la de abajo: al ser
     la misma URL, la descarga es una sola. */
  const deCss = (css.match(/--ld-logo:\s*url\(["']?([^"')]+)/) || [])[1] || "";
  ok(!!deCss, "el CSS declara --ld-logo", deCss);
  /* El CSS lleva "../" porque sus URL se resuelven contra la ruta del propio
     archivo (src/styles.css), no contra la del documento. Se comparan sin
     ese prefijo: lo que importa es que apunten al mismo PNG. */
  const limpio = (u) => String(u).replace(/^(\.\.\/)+/, "");
  ok(
    limpio(deCss) === limpio(delCfg),
    "las dos capas usan el mismo archivo (nada de una segunda descarga)",
    deCss + " vs " + delCfg,
  );
  ok(
    /background:\s*var\(--ld-logo\)/.test(reglaBr),
    "la capa de arriba se arma con esa variable",
    reglaBr.replace(/\s+/g, " ").trim().slice(0, 80),
  );
  const kfBarrido = (css.match(/@keyframes ldBarrido\s*\{([\s\S]*?)\n\}/) || [])[1] || "";
  ok(
    /0%\s*\{[^}]*100%/.test(kfBarrido),
    "el keyframe arranca en 100% (nada visible)",
    kfBarrido.replace(/\s+/g, " ").trim().slice(0, 70),
  );
  ok(
    /100%\s*\{[^}]*inset\([^)]*0[^)]*\)/.test(kfBarrido),
    "y termina en 0% (logo entero)",
    kfBarrido.replace(/\s+/g, " ").trim().slice(0, 90),
  );
  /* Ni el disco ni la imagen pueden tener rotación en ninguna regla. */
  const cssTxt = css;
  ok(
    !/\.(lgc|lgl)[^{]*\{[^}]*rotate/.test(cssTxt),
    "ninguna regla del loader rota (no hay rotate)",
  );
  ok(!/ldGiro|ldLatido/.test(cssTxt), "no quedaron las animaciones viejas (giro/latido)");

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
    const img = document.querySelector(".lgl");
    return c && img
      ? {
          disco: getComputedStyle(c).animationName,
          logo: getComputedStyle(img).animationName,
          recorte: getComputedStyle(img).clipPath,
          alto: c.offsetHeight,
        }
      : { disco: "sin disco", alto: 0 };
  });
  ok(rm.logo === "none", "con reducir movimiento el logo no se barre", rm.logo);
  ok(rm.recorte === "none", "y se ve entero desde el principio", rm.recorte);
  ok(rm.alto > 80, "pero el logo sigue mostrándose", `${rm.alto}px`);

  console.log(fallos ? "\nFALLARON " + fallos : "\nTODO VERDE");
  await b.close();
  process.exit(fallos ? 1 : 0);
})();
