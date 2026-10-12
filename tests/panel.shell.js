/* Verifica el shell del panel del CLIENTE tras el rediseño:
   - la barra inferior (celular) / de arriba (escritorio) con las 4 secciones
   - el menú del perfil lo abre la foto y contiene Ajustes / Ver la web /
     Cerrar sesión
   - Ajustes edita el perfil y termina con "Eliminar cuenta"
   - eliminar cuenta pide confirmación antes de borrar
   - los botones sueltos del header no están para el cliente */
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
  const browser = await chromium.launch();
  const out = [];
  const chk = (c, t, e) => {
    out.push([c ? "OK" : "FAIL", t, e || ""]);
    console.log(`${c ? "  OK  " : "  FAIL"} ${t}${e ? "  -> " + e : ""}`);
  };

  for (const [w, h, tag] of [[1440, 900, "1440"], [390, 844, "390"]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: w <= 900, hasTouch: w <= 900 });
    const page = await ctx.newPage();
    const jsErr = [];
    page.on("pageerror", (e) => jsErr.push(String(e)));
    page.on("console", (m) => m.type() === "error" && jsErr.push(m.text()));
    await page.goto("http://127.0.0.1:8765/index.html", { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".lb-wcard", { timeout: 25000 });
    await page.waitForTimeout(1200);
    const vis = page.locator('[data-act="goLogin"]:visible');
    if (await vis.count()) await vis.first().click();
    else await page.evaluate(() => { location.hash = "#login"; });
    await page.waitForSelector("#ie", { timeout: 15000 });
    await page.fill("#ie", env.CLIENTE_EMAIL);
    await page.fill("#ip", env.CLIENTE_PASSWORD);
    await page.click('[data-act="entrar"]');
    await page.waitForTimeout(7000);

    /* ---------- 1. navegación ---------- */
    const nav = await page.evaluate(() => {
      const n = document.querySelector("#nav");
      const cs = getComputedStyle(n);
      return {
        cs: n ? cs.position : null,
        items: [...n.querySelectorAll("button")].map((b) => b.textContent.trim()),
        activa: (n.querySelector("button.on") || {}).textContent?.trim() || null,
        aria: !!n.querySelector('button[aria-current="page"]'),
      };
    });
    chk(nav.items.length === 4, `${tag} · la navegación tiene las 4 secciones`, nav.items.join("|"));
    chk(
      w > 900 ? nav.cs === "relative" : nav.cs === "fixed",
      `${tag} · la navegación va ${w > 900 ? "en el encabezado" : "fija abajo (celular)"}`,
      nav.cs,
    );
    if (w <= 900) {
      const abajo = await page.evaluate(() => {
        const r = document.querySelector("#nav").getBoundingClientRect();
        return { bottom: Math.round(r.bottom), win: window.innerHeight, alto: Math.round(r.height) };
      });
      chk(
        Math.abs(abajo.bottom - abajo.win) < 3 && abajo.alto >= 44,
        `${tag} · la barra inferior está pegada abajo y es tocable`,
        JSON.stringify(abajo),
      );
    }

    /* ---------- 2. menú del perfil ---------- */
    chk(await page.locator("#mebadge:not([hidden])").count() > 0, `${tag} · la foto del perfil está`);
    /* "Cerrar sesión" ya no existe como botón suelto (vive en el menú de la
       foto) y "Ver la web" es ahora la casita de la fila derecha.

       OJO con contar en vez de mirar: esta comprobación antes era
       `#web:not([hidden])` con `.count()`, y daba verde aunque la casita
       estuviera dibujada en 0x0. Pasó months así: había un
       `body:not(.adm) #web { display:none !important }` en el CSS que la
       borraba, y el elemento existía igual. Ahora se mide el tamaño de
       verdad. */
    chk(await page.locator("#lo").count() === 0, `${tag} · no queda el botón suelto de "Cerrar sesión"`);
    const casita = await page.evaluate(() => {
      const v = document.querySelector("#web");
      if (!v) return { existe: false };
      const r = v.getBoundingClientRect();
      return { existe: true, w: Math.round(r.width), h: Math.round(r.height), oculto: v.hidden };
    });
    chk(
      casita.existe && !casita.oculto && casita.w >= 40 && casita.h >= 40,
      `${tag} · la casita ("Ver la web") está SE VISTA en el header`,
      JSON.stringify(casita),
    );

    await page.click("#mebadge");
    await page.waitForTimeout(500);
    const pm = await page.evaluate(() => {
      const m = document.querySelector("#pmenu");
      return {
        visible: !m.hidden,
        items: [...m.querySelectorAll("button")].map((b) => b.textContent.trim()),
        foco: document.activeElement ? document.activeElement.textContent.trim().slice(0, 20) : null,
        expandida: document.querySelector("#mebadge").getAttribute("aria-expanded"),
        dentro: (() => { const r = m.getBoundingClientRect(); return r.top >= 0 && r.bottom <= window.innerHeight + 1 && r.left >= 0 && r.right <= window.innerWidth + 1; })(),
        /* Anclaje: el menú tiene que quedar pegado a la foto, no flotando
           en una esquina de la ventana. Antes era position:fixed con
           top/right fijos y se despegaba al scrollear. */
        anclado: (() => {
          const mr = m.getBoundingClientRect();
          const br = document.querySelector("#mebadge").getBoundingClientRect();
          const hr = document.querySelector("header").getBoundingClientRect();
          return {
            dx: Math.round(mr.right - br.right),
            dy: Math.round(mr.top - br.bottom),
            /* Clearance con el header: si el menú arranca por arriba del
               borde inferior del header, se ve montado sobre él. */
            conHeader: Math.round(mr.top - hr.bottom),
          };
        })(),
        posMenu: getComputedStyle(m).position,
        hayHamb: !!document.querySelector("#hamb"),
      };
    });
    chk(pm.visible, `${tag} · el menú del perfil abre`);
    chk(pm.expandida === "true", `${tag} · aria-expanded pasa a true`, pm.expandida);
    chk(
      pm.items.some((x) => /Editar perfil/.test(x)) &&
        pm.items.some((x) => /Cambiar foto/.test(x)) &&
        pm.items.some((x) => /Cerrar sesi/.test(x)),
      `${tag} · contiene Editar perfil, Cambiar foto y Cerrar sesión`,
      pm.items.join("|"),
    );
    /* "Ver la web" ya no está en el menú: es la casita del encabezado. */
    chk(!pm.items.some((x) => /Ver la web/.test(x)), `${tag} · "Ver la web" ya no está repetido en el menú`, pm.items.join("|"));
    chk(pm.foco && /Editar perfil/.test(pm.foco), `${tag} · el foco entra al menú`, String(pm.foco));
    chk(pm.dentro, `${tag} · el menú no se sale de la pantalla`);
    chk(!pm.hayHamb, `${tag} · ya no hay botón de hamburguesa en el header`);
    chk(
      pm.posMenu === "absolute" && Math.abs(pm.anclado.dx) <= 2 && pm.anclado.dy > 0 && pm.anclado.dy <= 40,
      `${tag} · el menú se despliega pegado a la foto`,
      `${pm.posMenu} dx=${pm.anclado.dx} dy=${pm.anclado.dy}`,
    );
    chk(pm.anclado.conHeader >= 0, `${tag} · el menú no se monta sobre el header`, `conHeader=${pm.anclado.conHeader}px`);

    /* Escape lo cierra y devuelve el foco a la foto. */
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    const esc = await page.evaluate(() => ({
      oculto: document.querySelector("#pmenu").hidden,
      foco: document.activeElement ? document.activeElement.id : null,
    }));
    chk(esc.oculto, `${tag} · Escape cierra el menú del perfil`);
    chk(esc.foco === "mebadge", `${tag} · y el foco vuelve a la foto`, String(esc.foco));

    /* ---------- 3. Ajustes ---------- */
    await page.click("#mebadge");
    await page.waitForTimeout(400);
    await page.click('#pmenu button[data-args=\'["ajus"]\']');
    await page.waitForTimeout(1800);
    const aj = await page.evaluate(() => {
      const app = document.querySelector("#app");
      const t = app.innerText;
      const cards = [...app.querySelectorAll(".card")];
      const ultima = cards[cards.length - 1];
      return {
        hash: location.hash,
        titulo: (app.querySelector("h1") || {}).textContent || "",
        nombre: !!document.querySelector("#ajusNm"),
        tel: !!document.querySelector("#ajusPh"),
        guardar: !!app.querySelector('[data-act="guardarPerfilCli"]'),
        ultimoTexto: ultima ? ultima.innerText.replace(/\n/g, " | ").slice(0, 90) : "",
        ultimoTieneBorrar: ultima ? !!ultima.querySelector('[data-act="borrarAsk"]') : false,
       cantidadBorrar: app.querySelectorAll('[data-act="borrarAsk"]').length,
        menuAbierto: !document.querySelector("#pmenu").hidden,
      };
    });
    chk(aj.hash === "#/mi-cuenta", `${tag} · Ajustes tiene su propia ruta`, aj.hash);
    chk(/Ajustes/i.test(aj.titulo), `${tag} · el título dice Ajustes`, aj.titulo);
    chk(aj.nombre && aj.tel && aj.guardar, `${tag} · se puede editar nombre, teléfono y guardar`, JSON.stringify([aj.nombre, aj.tel, aj.guardar]));
    chk(aj.cantidadBorrar === 1, `${tag} · hay un solo botón de eliminar`, `${aj.cantidadBorrar}`);
    chk(aj.ultimoTieneBorrar, `${tag} · "Eliminar cuenta" está en la ÚLTIMA tarjeta`, aj.ultimoTexto);
    chk(!aj.menuAbierto, `${tag} · el menú del perfil se cerró al entrar a Ajustes`);

    /* ---------- 4. confirmar antes de borrar ---------- */
    await page.click('[data-act="borrarAsk"]');
    await page.waitForTimeout(600);
    const ask = await page.evaluate(() => {
      const m = document.querySelector("#mo");
      return {
        visible: !m.hidden,
        titulo: (m.querySelector("h2") || {}).textContent || "",
        cuerpo: (m.querySelector(".mt") || {}).textContent || "",
        botones: [...m.querySelectorAll("button")].map((b) => b.textContent.trim()),
        rol: m.querySelector(".mb") ? m.querySelector(".mb").getAttribute("role") : null,
      };
    });
    chk(ask.visible, `${tag} · aparece un aviso antes de eliminar`);
    chk(/borrar|eliminar/i.test(ask.titulo), `${tag} · el aviso pregunta por borrar/eliminar`, ask.titulo);
    chk(ask.botones.length === 2, `${tag} · con dos salidas: confirmar y conservar`, ask.botones.join("|"));
    chk(/Conservar|Volver|Cancelar/i.test(ask.botones[1] || ""), `${tag} · la segunda es la que cancela`, ask.botones.join("|"));
    chk(ask.rol === "alertdialog", `${tag} · es un diálogo modal`, String(ask.rol));

    /* Cancelar no borra nada y devuelve al panel. */
    await page.click("#mo [data-act='Mx']");
    await page.waitForTimeout(500);
    const sigue = await page.evaluate(() => ({
      hash: location.hash,
      modal: document.querySelector("#mo").hidden,
      sesion: !!document.querySelector("#mebadge:not([hidden])"),
    }));
    chk(sigue.sesion && sigue.modal, `${tag} · cancelar no borra nada y mantiene la sesión`, JSON.stringify(sigue));

    chk(jsErr.length === 0, `${tag} · sin errores de JS`, jsErr.join(" | "));
    await ctx.close();
  }

  await browser.close();
  const fails = out.filter((r) => r[0] === "FAIL");
  console.log(`\n${out.length - fails.length}/${out.length} OK · fallaron ${fails.length}`);
  process.exit(fails.length ? 1 : 0);
})();