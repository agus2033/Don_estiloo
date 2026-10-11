/* Políticas y privacidad: hoja móvil / documento de escritorio, más la
   accesibilidad del modal (foco, Escape, solapas).

   Cubre el requisito de CONTINUAR.md #2 y una regresión que ningún test
   veía: `body.no-scroll` se había quedado sin CSS y los testsumaticos sólo
   miraban que la CLASE estuviera puesta, no que el overflow fuera hidden.
   Acá se mide getComputedStyle. */
const { chromium } = require("../.opencode/skills/playwright-skill/node_modules/playwright/index.js");
const { HELPERS, FONDO_SRC, src } = require("./color.js");

(async () => {
  const browser = await chromium.launch();
  const out = [];
  const ok = (t, e) => out.push(["OK", t, e || ""]);
  const bad = (t, e) => out.push(["FAIL", t, e || ""]);
  const chk = (c, t, e) => (c ? ok(t, e) : bad(t, e));

  for (const [tema, w, h] of [
    ["dark", 390, 844],
    ["light", 390, 844],
    ["dark", 768, 900],
    ["dark", 1440, 900],
  ]) {
    const ctx = await browser.newContext({
      viewport: { width: w, height: h },
      hasTouch: w <= 900,
      isMobile: w <= 900,
    });
    const page = await ctx.newPage();
    const jsErr = [];
    page.on("pageerror", (e) => jsErr.push(String(e)));
    page.on("console", (m) => m.type() === "error" && jsErr.push(m.text()));
    await page.addInitScript((t) => localStorage.setItem("theme", t), tema);
    await page.goto("http://127.0.0.1:8765/index.html", { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".lb-wcard", { timeout: 20000 });
    await page.waitForTimeout(1200);
    const tag = `${tema}/${w}`;

    /* Alto del documento ANTES de abrir: el login de por sí es largo, así
       que comparar contra el viewport daría un falso negativo. Lo que no
       puede pasar es que el modal la alargue. */
    const altoAntes = await page.evaluate(() => document.documentElement.scrollHeight);

    /* Los links de políticas visibles están en el login (main.js ~2638) y en
       la barra del panel (que pide sesión). Sin sesión hay que abrir el
       login con el hash "#login" — no "#/reservar", que el router no
       abre. Es el mismo dance que landing.login.js. */
    const alt = await page.locator('[data-act="openPol"]:visible').count();
    if (!alt) {
      await page.evaluate(() => {
        location.hash = "#login";
      });
      await page.waitForSelector("#ie", { timeout: 15000 });
      await page.waitForTimeout(600);
    }

    /* Trap #9: hay 4 [data-act="openPol"], hay que usar :visible. */
    const link = page.locator('[data-act="openPol"]:visible');
    chk((await link.count()) > 0, `${tag} · hay un link visible a las políticas`);
    await link.first().click();
    await page.waitForSelector("#po:not([hidden]) .polbox", { timeout: 8000 });
    await page.waitForTimeout(400);

    /* ---------- 1. es un overlay, no empuja la página ---------- */
    const geo = await page.evaluate(() => {
      const po = document.querySelector("#po"),
        box = po.querySelector(".polbox"),
        cs = getComputedStyle(po);
      const r = box.getBoundingClientRect();
      const hd = po.querySelector(".pol-hd").getBoundingClientRect();
      const ft = po.querySelector(".pol-ft").getBoundingClientRect();
      const body = po.querySelector(".pol-body");
      const rr = po.getBoundingClientRect();
      return {
        position: cs.position,
        /* El VELO es el que cubre la pantalla; la caja en escritorio es una
           hoja centrada de 1040 px, no el ancho entero. */
        veloCubre: rr.width >= window.innerWidth - 1 && rr.height >= window.innerHeight - 1,
        altoPagina: document.documentElement.scrollHeight,
        clientH: document.documentElement.clientHeight,
        boxBottom: r.bottom,
        hdArriba: hd.top,
        hdVisible: hd.top >= -1 && hd.bottom <= window.innerHeight + 1,
        ftVisible: ft.bottom <= window.innerHeight + 1 && ft.top >= -1,
        ftAbajo: Math.abs(ft.bottom - r.bottom) < 2,
        bodyScroll: body.scrollHeight > body.clientHeight + 2,
        bodyClient: body.clientHeight,
        grab: getComputedStyle(po.querySelector(".pol-grab")).display,
        tabs: [...po.querySelectorAll(".pol-tab")].map((t) => t.textContent.trim()),
        panelsVisibles: [...po.querySelectorAll("[data-panel]")].filter((x) => !x.hidden).length,
      };
    });
    chk(geo.position === "fixed", `${tag} · #po es un overlay fijo`, geo.position);
    chk(geo.veloCubre, `${tag} · el velo cubre toda la pantalla`);
    /* La página de fondo puede ser larga (el login lo es). Lo que no puede
       pasar es que ABRIR el modal la alargue: se compara contra el alto que
       tenía antes. Antes de este CSS, la empujaba de 844 a 2818 px. */
    chk(
      geo.altoPagina <= geo.clientH + 2 || geo.altoPagina <= altoAntes + 2,
      `${tag} · abrir el modal no agranda la página`,
      `antes=${altoAntes} ahora=${geo.altoPagina} (viewport ${geo.clientH})`,
    );
    chk(geo.hdVisible, `${tag} · el encabezado con la ✕ está siempre a la vista`);
    chk(geo.ftVisible, `${tag} · el pie con los botones está siempre a la vista`);
    chk(geo.ftAbajo, `${tag} · el pie queda pegado al borde inferior`);
    chk(geo.tabs.length === 6, `${tag} · las 6 solapas están`, geo.tabs.join("|"));
    chk(geo.panelsVisibles === 1, `${tag} · sólo un panel visible a la vez`, `${geo.panelsVisibles}`);

    /* El tirador es de la hoja móvil: en escritorio sobra. */
    chk(
      w > 900 ? geo.grab === "none" : geo.grab !== "none",
      `${tag} · el tirador ${w > 900 ? "no aparece" : "aparece"} en ${w > 900 ? "escritorio" : "celular"}`,
      geo.grab,
    );

    /* ---------- 2. el scroll es interno ---------- */
    const sc = await page.evaluate(async () => {
      const b = document.querySelector("#po .pol-body");
      const hdAntes = document.querySelector("#po .pol-hd").getBoundingClientRect().top;
      b.scrollTop = 9999;
      await new Promise((r) => setTimeout(r, 120));
      return {
        scrolleo: b.scrollTop,
        hdDespues: document.querySelector("#po .pol-hd").getBoundingClientRect().top,
        hdAntes,
        ventana: window.scrollY,
      };
    });
    if (geo.bodyScroll) {
      chk(sc.scrolleo > 0, `${tag} · el cuerpo scrollea solo`, `scrollTop=${Math.round(sc.scrolleo)}`);
      chk(Math.abs(sc.hdDespues - sc.hdAntes) < 2, `${tag} · el encabezado NO se va al scrollear`, `${sc.hdAntes} -> ${sc.hdDespues}`);
      chk(sc.ventana === 0, `${tag} · la página de atrás no scrollea`, `window.scrollY=${sc.ventana}`);
    } else {
      ok(`${tag} · el cuerpo de esta sección entra entero, no hace falta scrollear`);
    }

    /* ---------- 3. body.no-scroll de verdad ---------- */
    const lock = await page.evaluate(() => ({
      clase: document.body.classList.contains("no-scroll"),
      overflow: getComputedStyle(document.body).overflow,
    }));
    chk(lock.clase && lock.overflow === "hidden", `${tag} · el scroll del body está bloqueado de verdad`, JSON.stringify(lock));

    /* ---------- 4. cambio de solapa ---------- */
    await page.click('.pol-tab[data-args=\'["datos"]\']');
    await page.waitForTimeout(250);
    const datos = await page.evaluate(() => {
      const po = document.querySelector("#po");
      const p = po.querySelector('[data-panel="datos"]');
      const tab = po.querySelector('#pol-t-datos');
      return {
        visible: !p.hidden,
        sel: tab.getAttribute("aria-selected"),
        control: tab.getAttribute("aria-controls"),
        panelId: p.id,
        labelled: p.getAttribute("aria-labelledby"),
        filas: p.querySelectorAll(".pol-tbl tbody tr").length,
        cols: p.querySelectorAll(".pol-tbl thead th").length,
        pendientes: p.querySelectorAll(".pol-pend").length,
        /* La tabla no puede empujar la hoja: tiene que scrollear ella. */
        desborde: p.scrollWidth > p.clientWidth + 2,
      };
    });
    chk(datos.visible && datos.sel === "true", `${tag} · la solapa "Datos" se activa`);
    chk(datos.control === datos.panelId && datos.labelled === "pol-t-datos", `${tag} · aria-controls y aria-labelledby cierran bien`, JSON.stringify([datos.control, datos.panelId, datos.labelled]));
    chk(datos.filas === 7, `${tag} · la tabla de datos tiene las 7 filas`, `${datos.filas}`);
    chk(datos.cols === 3, `${tag} · la tabla tiene 3 columnas (dato / para qué / obligatorio)`, `${datos.cols}`);
    chk(datos.pendientes > 0, `${tag} · los datos sin cargar se marcan como pendientes, no se inventan`, `${datos.pendientes}`);

    /* Solo una sección visible: la anterior se ocultó. */
    chk(
      await page.evaluate(() => [...document.querySelectorAll("#po [data-panel]")].filter((x) => !x.hidden).length === 1),
      `${tag} · al cambiar de solapa se oculta la anterior`,
    );

    /* ---------- 5. flechas mueven el foco entre solapas ---------- */
    await page.focus("#pol-t-datos");
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(200);
    const der = await page.evaluate(() => ({
      foco: document.activeElement.id,
      sel: document.activeElement.getAttribute("aria-selected"),
      panel: document.querySelector('[data-panel="uso"]').hidden === false,
    }));
    chk(der.foco === "pol-t-uso" && der.sel === "true", `${tag} · → salta a la solapa siguiente y la enfoca`, JSON.stringify(der));
    chk(der.panel, `${tag} · y muestra su panel`);

    await page.keyboard.press("ArrowLeft");
    await page.waitForTimeout(200);
    chk(await page.evaluate(() => document.activeElement.id) === "pol-t-datos", `${tag} · ← vuelve a la anterior`);

    await page.keyboard.press("End");
    await page.waitForTimeout(250);
    const fin = await page.evaluate(() => {
      const t = document.querySelector("#pol-t-cambios");
      const r = t.getBoundingClientRect(),
        c = t.parentElement.getBoundingClientRect();
      return {
        foco: t === document.activeElement,
        sel: t.getAttribute("aria-selected"),
        /* La fila de solapas scrollea en horizontal: si la activa quedó
           fuera, no se ve cuál es. */
        visible: r.left >= c.left - 1 && r.right <= c.right + 1,
      };
    });
    chk(fin.foco && fin.sel === "true", `${tag} · End va a la última solapa y la enfoca`, JSON.stringify(fin));
    chk(fin.visible, `${tag} · la última solapa queda a la vista en la fila`, JSON.stringify(fin));

    await page.keyboard.press("Home");
    await page.waitForTimeout(250);
    chk(await page.evaluate(() => document.activeElement.id) === "pol-t-resumen", `${tag} · Home va a la primera`);

    /* ---------- 6. foco atrapado ---------- */
    const cicla = [];
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Tab");
      cicla.push(await page.evaluate(() => {
        const a = document.activeElement;
        return (a.closest("#po") ? "dentro:" : "FUERA:") + (a.tagName + (a.className ? "." + String(a.className).split(" ")[0] : ""));
      }));
    }
    chk(cicla.every((x) => x.startsWith("dentro:")), `${tag} · Tab nunca se sale del modal`, cicla.filter((x) => !x.startsWith("dentro:")).join(" "));

    /* ---------- 7. Escape cierra y devuelve el foco ---------- */
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    const cerrado = await page.evaluate(() => ({
      oculto: document.querySelector("#po").hidden,
      vacio: document.querySelector("#po").innerHTML === "",
      scroll: getComputedStyle(document.body).overflow,
      foco: document.activeElement.dataset ? document.activeElement.dataset.act || document.activeElement.tagName : document.activeElement.tagName,
      y: window.scrollY,
    }));
    chk(cerrado.oculto, `${tag} · Escape cierra`);
    chk(cerrado.vacio, `${tag} · al cerrar se vacía el markup`);
    chk(cerrado.scroll !== "hidden", `${tag} · al cerrar se suelta el scroll del body`, cerrado.scroll);
    chk(cerrado.foco === "openPol", `${tag} · el foco vuelve al link que abrió`, cerrado.foco);
    chk(cerrado.y === 0, `${tag} · volver el foco no salta de scroll`, `scrollY=${cerrado.y}`);

    /* ---------- 8. sin desbordes horizontales ----------
       Va después del cierre a propósito: cerrarPol() vacía el markup, así
       que hay que reabrir. Cada sección se muestra y se mide con scrollWidth
       del cuerpo contra clientWidth, no el overflowX del documento (trap #3:
       .lb tiene overflow-x clip). */
    await link.first().click();
    await page.waitForSelector("#po:not([hidden]) .polbox", { timeout: 8000 });
    await page.waitForTimeout(300);
    const ancho = await page.evaluate(() => {
      const po = document.querySelector("#po");
      const c = po.querySelector(".pol-body");
      const r = {};
      for (const s of ["resumen", "datos", "uso", "derechos", "condiciones", "cambios"]) {
        po.querySelectorAll("[data-panel]").forEach((p) => (p.hidden = p.dataset.panel !== s));
        r[s] = c.scrollWidth > c.clientWidth + 2 ? `${c.scrollWidth}>${c.clientWidth}` : null;
      }
      return r;
    });
    const desborde = Object.entries(ancho).filter(([, v]) => v);
    chk(desborde.length === 0, `${tag} · ninguna sección desborda a lo ancho`, desborde.map(([k, v]) => `${k}:${v}`).join(" "));
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);

    chk(jsErr.length === 0, `${tag} · sin errores de JS`, jsErr.join(" | "));

    /* ---------- 9. contraste de lo que hay dentro del modal ----------
       Hay que reabrir: cerrarPol() vacía el markup de #po, y medir sobre
       un modal vacío daría verde siempre. Los botones con fondo propio son
       los que más se rompen cuando se separó --brass en --brass /
       --brassFill. Mismo criterio que tokens.claro.js: el texto de los
       dorados es #141c26 fijo, no var(--ink) (que en oscuro es marfil y
       daría un falso negativo). */
    await link.first().click();
    await page.waitForSelector("#po:not([hidden]) .polbox", { timeout: 8000 });
    await page.waitForTimeout(350);
    const con = await page.evaluate(({ src }) => {
      /* new Function, no eval: dentro de page.evaluate un eval con const no
         define nada en el ámbito de la función que lo contiene. */
      const { fondo, __P, __comp, __R, __min } = new Function(
        src + ";return {fondo,__P,__comp,__R,__min};",
      )();
      const mal = [];
      for (const el of document.querySelectorAll("#po button, #po a, #po h2, #po h4, #po p, #po .pol-tab")) {
        if (el.closest("[hidden]")) continue;
        const cs = getComputedStyle(el);
        const txt = (el.textContent || "").trim();
        if (!txt) continue;
        const bg = fondo(el);
        const fg = __P(cs.color);
        const r = __R(__comp(fg, bg).slice(0, 3), bg.slice(0, 3));
        const min = __min(cs.fontSize, cs.fontWeight);
        if (r < min) mal.push(`${el.className || el.tagName} "${txt.slice(0, 18)}" ${r.toFixed(2)}<${min}`);
      }
      return mal;
    }, { src });
    chk(con.length === 0, `${tag} · nada dentro del modal queda bajo el mínimo`, con.slice(0, 4).join(" | "));

    await page.screenshot({ path: `tests/tmp_shots/pol-${tag.replace("/", "-")}.png` });
    await ctx.close();
  }

  await browser.close();
  const fails = out.filter((r) => r[0] === "FAIL");
  out.forEach(([k, t, e]) => console.log(`${k === "OK" ? "  OK  " : "  FAIL"} ${t}${e ? "  -> " + e : ""}`));
  console.log(`\n${out.length - fails.length}/${out.length} OK · fallaron ${fails.length}`);
  process.exit(fails.length ? 1 : 0);
})();
