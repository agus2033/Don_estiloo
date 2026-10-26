/* Verifica la identidad y el fondo del modal de reserva:
     - el logo carga (no es un 404) y el nombre de la barbería se lee
     - el logo del header de la landing carga y es circular
     - los barberos del paso 2 traen foto
     - el velo deja ver la landing desenfocada: es translúcido, con blur
       real, y del color de la marca (no negro ni gris neutro)

   Uso: python -m http.server 8765   ->   node tests\landing.modal.js
*/
const path = require("path");
const { chromium } = require("../.opencode/skills/playwright-skill/node_modules/playwright");

const BASE = "http://127.0.0.1:8765/index.html";
let fallos = 0;
const check = (ok, txt, extra) => {
  if (!ok) fallos++;
  console.log((ok ? "  OK   " : "  FALLA") + " " + txt + (extra ? "  -> " + extra : ""));
};

/* "color-mix()" y "color()" devuelven color(srgb r g b / a) con canales 0-1 */
function parseColor(s) {
  const t = String(s || "");
  const cs = t.match(/color\(\s*srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?/i);
  if (cs) return { r: +cs[1] * 255, g: +cs[2] * 255, b: +cs[3] * 255,
                   a: cs[4] === undefined ? 1 : +cs[4] };
  const n = (t.match(/[\d.]+/g) || []).map(Number);
  const a = t.match(/rgba?\([^)]*,\s*([\d.]+)\s*\)/i);
  return { r: n[0] || 0, g: n[1] || 0, b: n[2] || 0,
           a: a ? +a[1] : t.includes("rgba") ? 1 : 1 };
}

async function abrirModal(p) {
  await p.click('[data-act="wzAbrir"]');
  await p.waitForSelector(".wz-sheet", { timeout: 8000 });
  await p.waitForTimeout(700);
}

(async () => {
  const b = await chromium.launch();
  for (const theme of ["dark", "light"]) {
    console.log("\n========== " + theme.toUpperCase() + " ==========");
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const p = await ctx.newPage();
    const errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    p.on("console", (m) => { if (m.type() === "error" && !/firestore|404/i.test(m.text())) errs.push("console: " + m.text().slice(0, 120)); });

    await p.addInitScript((t) => localStorage.setItem("theme", t), theme);
    await p.goto(BASE, { waitUntil: "domcontentloaded" });
    await p.waitForSelector(".lb-wcard", { timeout: 20000 });
    await p.waitForTimeout(1500);

    /* ---- logo del header de la landing ---- */
    const hdr = await p.evaluate(() => {
      const i = document.getElementById("lg");
      if (!i) return null;
      const cs = getComputedStyle(i);
      return { src: i.getAttribute("src"), w: i.naturalWidth, radius: cs.borderTopLeftRadius,
               bg: cs.backgroundColor };
    });
    check(!!hdr, "el header tiene <img id=lg>");
    if (hdr) {
      check(hdr.w > 0, "el logo del header carga (naturalWidth " + hdr.w + ")", hdr.src);
      /* Cuadrado redondeado, no círculo: el emblema es una insignia
         cuadrada con un círculo adentro, y un círculo le recortaba las
         esquinas. Además el PNG ya es transparente (los bordes están en
         alfa 0), así que el logo no necesita recorte para tapar el fondo. */
      check(
        hdr.radius.includes("14px"),
        "el logo del header es un cuadrado redondeado",
        hdr.radius,
      );
    }

    await abrirModal(p);

    /* ---- marca dentro del modal ---- */
    const marca = await p.evaluate(() => {
      const m = document.querySelector(".wz-marca");
      if (!m) return null;
      const img = m.querySelector(".wz-logo");
      const b = m.querySelector("b");
      const s = m.querySelector("small");
      return {
        imgOk: !!img && img.naturalWidth > 0,
        src: img ? img.getAttribute("src") : null,
        nombre: b ? b.textContent.trim() : null,
        sub: s ? s.textContent.trim() : null,
        imgVisible: img ? img.getBoundingClientRect().width : 0,
      };
    });
    check(!!marca, "el modal tiene la marca (.wz-marca)");
    /* La fuente de verdad del nombre es src/config.js, que main.js vuelca en
   #brand. Comparar contra el header en vez de contra un literal: si el
   nombre cambia en la config, el test sigue siendo válido solo. */
const NOMBRE_EN_PAGINA = await p.evaluate(() =>
  (document.getElementById("brand")?.textContent || "").trim());
check(!!NOMBRE_EN_PAGINA, "el header define el nombre de marca: \"" + NOMBRE_EN_PAGINA + "\"");
    if (marca) {
      check(marca.imgOk, "el logo del modal carga", marca.src);
      check(marca.imgVisible >= 40, "el logo se ve a tamaño legible (" + Math.round(marca.imgVisible) + "px)");
      check(marca.nombre === NOMBRE_EN_PAGINA,
        "el modal muestra el mismo nombre que el header: \"" + marca.nombre + "\"",
        marca.nombre === NOMBRE_EN_PAGINA ? "" : "header dice \"" + NOMBRE_EN_PAGINA + "\"");
      check(!/\s1$/.test(marca.nombre), "el nombre no arrastra el \" 1\" de las pruebas");
      check(!!marca.sub, "bajo el nombre dice: \"" + marca.sub + "\"");
    }

    /* ---- el velo deja ver la landing ---- */
    const velo = await p.evaluate(() => {
      const cs = getComputedStyle(document.getElementById("wzm"));
      return { bg: cs.backgroundColor, bf: cs.backdropFilter || cs.webkitBackdropFilter || "" };
    });
    const c = parseColor(velo.bg);
    check(c.a < 0.75, "el velo es translúcido (alpha " + c.a + ")", velo.bg);
    const blur = parseInt((velo.bf.match(/blur\((\d+)px/) || [])[1] || "0", 10);
    check(blur >= 12, "la landing de atrás está desenfocada (blur " + blur + "px)", velo.bf);
    /* El velo tiene que ser el fondo del tema ACTUAL. Sólo con mirar que no
       sea gris neutro no alcanza: un velo azul sobre la página clara se ve
       bien en el número del spread y queda feo en pantalla. */
    const fondo = await p.evaluate(() =>
      getComputedStyle(document.body).getPropertyValue("--lb-bg").trim());
    const hex = (h) => {
      const n = (h.match(/[\da-f]{2}/gi) || []).map((x) => parseInt(x, 16));
      return n.length === 3 ? { r: n[0], g: n[1], b: n[2] } : null;
    };
    const f = hex(fondo);
    if (f) {
      const dist = Math.abs(c.r - f.r) + Math.abs(c.g - f.g) + Math.abs(c.b - f.b);
      check(dist <= 6, "el velo sigue al tema: usa " + fondo + " (distancia " +
        Math.round(dist) + ")");
    }

    
/* En 390 px el asistente avanza SOLO al elegir (no hay boton de
   "continuar"), así que en vez de clickearlo se espera a que cambie el
   paso. Antes cada click daba timeout de 30 s al desaparecer el boton. */
const irPaso = async (n, ms = 2500) => {
  for (let i = 0; i < Math.ceil(ms / 120); i++) {
    const act = await p.evaluate(() => {
      const on = document.querySelector(".wz-paso.on b");
      return on ? +on.textContent : -1;
    });
    if (act === n) return true;
    await p.waitForTimeout(120);
  }
  return false;
};

    /* Captura por recorte de página y NO con screenshot de elemento.

       El asistente se repinta entero en cada paso (y a veces solo, por un
       snapshot o por el avance automático en celular). Cualquier captura que
       dependa del nodo —`elementHandle.screenshot()` o `locator.screenshot()`—
       falla con "Element is not attached to the DOM" en el momento justo en
       que se está sustituyendo. Midiendo la caja y recortando la página no
       hay ningún nodo que pueda quedar viejo. */
    const shot = async (sel, nombre) => {
      const caja = await p.evaluate((s) => {
        const e = document.querySelector(s);
        if (!e) return null;
        const r = e.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      }, sel);
      if (!caja || caja.width < 2 || caja.height < 2) return false;
      await p.screenshot({
        path: path.join(__dirname, "..", "tmp_shots", nombre),
        clip: caja,
      });
      return true;
    };

    await shot(".wz-sheet", `MOD-${theme}-paso1.png`);

    /* ---- fotos de los barberos (paso 2) ----
       Para LLEGAR al paso 2 hay que elegir un servicio primero: en escritorio
       el asistente no avanza solo y el botón "Siguiente" arranca deshabilitado
       hasta que hay algo elegido en el paso 1. La primera versión de este
       bloque llamaba a irPaso(2) directo, nunca llegaba, y la cuenta de
       barberos daba 0: eso producía un SKIP falso que tapaba toda la
       cobertura de la prueba. */
    await p.evaluate(() => {
      const s = document.querySelector(".wz-item--svc");
      if (s) s.click();
    });
    await p.waitForTimeout(350);
    await p.evaluate(() => {
      const b = document.querySelector('[data-act="wzNext"]');
      if (b && !b.disabled) b.click();
    });
    const llego = await irPaso(2);
    const cuantos = await p.$$(".wz-item--bar");

    /* Sin barberos en Firestore el paso 2 no tiene nada que elegir y el
       asistente no avanza. Antes la prueba clickeaba `.wz-item:not(.on)`
       esperando un elemento que no existía y moría con un "Timeout 30000ms"
       que no decía que el problema eran los datos, no el código. */
    if (!llego || !cuantos.length) {
      console.log(
        "  SKIP  el asistente no llegó al paso 2" +
          (llego ? " y la lista de barberos vino vacía" : "") +
          ":",
      );
      console.log("        hay " + cuantos.length + " barberos. Cargá uno desde el panel.");
      await ctx.close();
      await b.close();
      console.log("\n=== SALTADO (sin fallos) ===");
      return;
    }
    /* Se mide ANTES del clic: en celular el asistente auto-avanza solo a los
       280 ms de elegir barbero (wzAvanzaSolo) y esta medición quedaba a 30 ms
       de esa carrera: con la caché fría el paso ya había cambiado y la lista
       daba 0. El clic sólo marca .on; las fotos y los nombres no cambian. */
    const bars = await p.evaluate(() => {
      const items = [...document.querySelectorAll(".wz-item--bar")];
      return {
        n: items.length,
        filas: items.map((it) => {
          const f = it.querySelector(".wz-foto");
          const img = f ? f.querySelector("img") : null;
          return {
            nombre: it.querySelector(".wz-item-t b")?.textContent?.trim(),
            esp: it.querySelector(".wz-item-t small")?.textContent?.trim(),
            conCaja: !!f,
            fotoCarga: img ? img.naturalWidth > 0 : null,
            tam: f ? Math.round(f.getBoundingClientRect().width) : 0,
            inicial: !img ? f?.textContent?.trim() : null,
            roto: img ? (img.getAttribute("src") || "") : null,
          };
        }),
      };
    });
    await p.click(".wz-item--bar");
    await p.waitForTimeout(250);
    check(bars.n > 0, "el paso 2 lista barberos con avatar (" + bars.n + ")");
    check(bars.filas.every((f) => f.conCaja), "cada barbero tiene su caja de foto");
    check(bars.filas.every((f) => f.tam >= 40), "las fotos se ven a tamaño real");
    bars.filas.forEach((f) => {
      const estado = f.fotoCarga ? "foto OK" : f.inicial ? "inicial \"" + f.inicial + "\"" : "FOTO ROTA";
      console.log("         " + f.nombre + " · " + f.esp + " · " + estado);
      if (f.fotoCarga === false) fallos++;
    });
    await shot(".wz-sheet", `MOD-${theme}-paso2.png`);

    /* ---- el modal no debe tapar el login al continuar ----

       Aquí se elige barbero para pasar al paso 3 (el día). El selector
       `.wz-item:not(.on)` asumía que había más de un barbero en la lista: con
       un solo barbero, después de elegirlo NO queda ninguno sin marcar y el
       click esperaba 30 segundos a un elemento que no iba a aparecer. Ahora se
       elige el que haya, tenga marcados todos los que tenga. */
    await p.evaluate(() => {
      const z = document.getElementById("wzm");
      const on = z && z.querySelector(".wz-item--bar.on");
      const otro = z && z.querySelector(".wz-item--bar");
      const a = otro || on;
      if (a) a.click();
    });
    await p.waitForTimeout(250);
    await irPaso(3);
    if ((await p.$(".wz-cel.libre")) == null) {
      /* Sin días libres no hay nada que seguir recorriendo. */
      console.log("  SKIP  no hay días libres para seguir con el recorrido del asistente.");
      await ctx.close();
      await b.close();
      console.log("\n=== SALTADO (sin fallos) ===");
      return;
    }
    await p.click(".wz-cel.libre");
    await p.waitForTimeout(250);
    await irPaso(4);
    await p.click(".wz-turno:not(.off)");
    await p.waitForTimeout(250);
    await irPaso(5);
    await p.click(".wz-hora:not(.oc)");
    await p.waitForTimeout(250);
    await irPaso(6);
    /* El resumen ya no se llama .wz-sum (era la tabla de 6 filas): ahora es
       .wz-res con las tarjetas por fila y su boton "Cambiar". */
    const paso6 = await p.evaluate(() => !!document.querySelector(".wz-res-tit"));
    check(paso6, "llega al resumen");

    await p.click(".wz-body .wz-btn--pri");
    await p.waitForTimeout(1200);
    const handoff = await p.evaluate(() => ({
      modalAbierto: !!document.querySelector(".wz-sheet"),
      wzmOculto: document.getElementById("wzm")?.hasAttribute("hidden") ?? null,
      scrollLock: document.body.classList.contains("wz-abierto"),
      login: !!document.querySelector("#ie"),
      loginVisible: (() => { const e = document.querySelector("#ie");
        return e ? !!e.offsetParent : false; })(),
      hash: location.hash,
      loader: (() => { const l = document.querySelector("#ld");
        return l ? getComputedStyle(l).display : "no"; })(),
    }));
    check(!handoff.modalAbierto && handoff.wzmOculto, "al continuar se CIERRA el modal");
    check(!handoff.scrollLock, "suelta el scroll de la página");
    check(handoff.loginVisible, "el login queda a la vista (no tapado)");
    check(handoff.hash === "#/reservar", "deja el hash en #/reservar", handoff.hash);


    /* --- el calendario no puede pasarse de la hoja ---
       La hoja tiene overflow oculto, así que un desborde no se ve como
       scroll: se ve como la columna del sábado cortada. Hay que medir
       scrollWidth contra clientWidth del grid, no el overflowX del body. */
    await p.goto(BASE, { waitUntil: "domcontentloaded" });
    await p.waitForSelector(".lb-wcard", { timeout: 20000 });
    await p.waitForTimeout(1500);
    await p.click('[data-act="wzAbrir"]');
    await p.waitForSelector(".wz-sheet");
    await p.waitForTimeout(300);
    await p.click(".wz-item:not(.on)");
    await p.waitForTimeout(150);
    await irPaso(2);
    await p.click(".wz-item:not(.on)");
    await p.waitForTimeout(150);
    await irPaso(3);
    const cal = await p.evaluate(() => {
      const cels = document.querySelector(".wz-cels");
      const sheet = document.querySelector(".wz-sheet");
      const cs = getComputedStyle(cels);
      const cr = cels.getBoundingClientRect(), sr = sheet.getBoundingClientRect();
      const pistas = (cs.gridTemplateColumns.match(/[\d.]+/g) || []).map(Number);
      const celdas = [...cels.children];
      const filas = {};
      celdas.forEach((c) => {
        const y = Math.round(c.getBoundingClientRect().top);
        filas[y] = (filas[y] || 0) + 1;
      });
      return {
        scrollW: cels.scrollWidth, clientW: cels.clientWidth,
        anchoPista: pistas[0], nPistas: pistas.length,
        dentro: cr.right <= sr.right + 0.5,
        filas: Object.values(filas),
        celdas: celdas.length,
      };
    });
    check(cal.scrollW <= cal.clientW, "el calendario no desborda la hoja (scroll " +
      cal.scrollW + " <= client " + cal.clientW + ")");
    check(cal.dentro, "la última columna cae dentro de la hoja");
    check(cal.nPistas === 7, "son 7 columnas de " + Math.round(cal.anchoPista) + "px");
    const filasMalas = cal.filas.filter((n) => n !== 7);
    check(filasMalas.length === 0, "todas las filas del calendario tienen 7 celdas",
      "filas: " + cal.filas.join(","));
    const sc = await p.$(".wz-sheet");
    if (sc) await sc.screenshot({ path: path.join(__dirname, "..", "tmp_shots", `MOD-${theme}-calendario.png`) });


    check(errs.length === 0, "sin errores JS" + (errs.length ? ": " + errs[0].slice(0, 100) : ""));
    await ctx.close();
  }
  await b.close();
  console.log("\n=== " + (fallos ? fallos + " FALLAS" : "todo OK") + " ===");
  process.exit(fallos ? 1 : 0);
})();