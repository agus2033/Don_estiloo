/* Lote 25: las correcciones que pidió el dueño en un solo archivo.

   node tests\lote25.js
*/
const { chromium } = require("../.opencode/skills/playwright-skill/node_modules/playwright/index.js");
const fs = require("fs");
const path = require("path");

const env = {};
fs
  .readFileSync(path.join(__dirname, "..", ".env.local"), "utf8")
  .split(/\r?\n/)
  .forEach((l) => {
    const i = l.indexOf("=");
    if (i < 1 || l.trim().startsWith("#")) return;
    const k = l.slice(0, i).trim();
    if (!env[k]) env[k] = l.slice(i + 1).trim();
  });

let fallos = 0;
const ok = (c, m, d) => {
  console.log((c ? "  OK    " : "  FALLA ") + m);
  if (!c) {
    fallos++;
    if (d) console.log("          " + d);
  }
};

async function entrar(b, email, pass, ancho = 1400) {
  const ctx = await b.newContext({ viewport: { width: ancho, height: 1000 } });
  const page = await ctx.newPage();
  const jsErr = [];
  page.on("pageerror", (e) => jsErr.push(String(e).slice(0, 110)));
  await page.goto("http://127.0.0.1:8765/index.html", { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".lb-wcard", { timeout: 30000 });
  await page.waitForTimeout(1400);
  await page.evaluate(() => {
    location.hash = "#login";
  });
  await page.waitForSelector("#ie", { timeout: 20000 });
  await page.fill("#ie", email);
  await page.fill("#ip", pass);
  await page.click('[data-act="entrar"]');
  await page.waitForTimeout(14000);
  return { ctx, page, jsErr };
}

(async () => {
  /* ---------- 1. cosas que se comprueban leyendo el código ---------- */
  console.log("=== 1. en el código ===");
  const src = fs.readFileSync(path.join(__dirname, "..", "src", "main.js"), "utf8");
  const reglas = fs.readFileSync(path.join(__dirname, "..", "FIRESTORE_RULES.txt"), "utf8");

  /* Lo que se publica no debe imprimir nada en la consola. Antes quedaban tres
     console.error, y uno volcaba el turno entero (uid, nombre, barbero, fecha,
     hora, cupos) en el navegador de quien lo aborted. */
  const llamadas = src.match(/^\s*console\.\w+\s*\(/gm) || [];
  ok(llamadas.length === 0, "main.js no llama a console.*", JSON.stringify(llamadas));
  ok(!/[\uFFFD]/.test(src), "main.js no tiene caracteres rotos (U+FFFD)");
  for (const [F, t] of [
    ["styles.css", fs.readFileSync(path.join(__dirname, "..", "src", "styles.css"), "utf8")],
    ["landing.css", fs.readFileSync(path.join(__dirname, "..", "src", "landing.css"), "utf8")],
    ["index.html", fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8")],
  ]) {
    ok(!/[\uFFFD]/.test(t), `${F} no tiene caracteres rotos`);
  }

  ok(
    /"auth\/cancelled-popup-request",/.test(
      src.match(/const CANCELADO = new Set\(\[[\s\S]*?\]\)/)[0],
    ),
    "el popup cancelado ya no avisa (está en CANCELADO)",
  );
  ok(!/Esperá un segundo e intentá de nuevo/.test(src), "el cartel de 'esperá un segundo' desapareció");
  ok(!/FIRESTORE_RULES\.txt, el punto 6/.test(src), "el mensaje de permisos ya no manda a leer un archivo");
  ok(/Math\.min\(50, v\)/.test(src), "el tope de puntos del panel es 50");
  ok(/request\.resource\.data\.pt <= 50;/.test(reglas), "el tope de puntos de las reglas es 50");
  ok(/match \/fotoBarbero\/\{uid\}/.test(reglas), "las reglas tienen la colección fotoBarbero");
  ok(!/allow read: if isSignedIn\(\) && \(request\.auth\.uid == uid \|\| isStaff/.test(reglas.split("match /fotoBarbero")[1].split("match /activos")[0]), "fotoBarbero se lee sin sesión");
  ok(/u\.id !== OWNER_UID/.test(src), "el dueño se excluye de la lista de clientes");
  ok(!/data-act="fotoBarbero"/.test(src), "el botón Foto del dueño ya no está");
  ok(!/const negTab/.test(src), "el apartado Negocio ya no existe");
  ok(/Servicios<\/button><button[^>]*>Puntos</.test(src), "el menú de Ajustes es Horarios / Servicios / Puntos");
  ok(/setFotos\(m\)/.test(src), "el merge de fotos es comprobable desde las pruebas");

  /* ---------- 2. el dueño ---------- */
  console.log("\n=== 2. panel del dueño ===");
  const b = await chromium.launch();
  const du = await entrar(b, env.DUENO_EMAIL, env.DUENO_PASSWORD);
  if (!(await du.page.evaluate(() => !!(window.__test && window.__test.uid)))) {
    ok(false, "entró el dueño");
  } else {
    ok(true, "entró el dueño");

    /* --- el dueño no es un cliente --- */
    await du.page.evaluate(() => {
      location.hash = "#/clientes";
    });
    await du.page.waitForTimeout(2200);
    const cli = await du.page.evaluate(() => {
      const filas = [...document.querySelectorAll("#app .clin")].map((x) => x.children[0].textContent.trim());
      return { filas, dice: (document.querySelector("#app small") || {}).textContent || "" };
    });
    ok(
      !cli.filas.some((x) => /due/i.test(x)),
      "en Clientes no aparece el dueño",
      cli.filas.join(" | "),
    );
    ok(cli.filas.length >= 1, "el resto de los clientes sigue estando", cli.filas.join(" | "));

    /* --- Barberos: sin botón Foto --- */
    await du.page.evaluate(() => {
      location.hash = "#/barberos";
    });
    await du.page.waitForTimeout(2200);
    const bar = await du.page.evaluate(() => ({
      botones: [...document.querySelectorAll("#app .card button")].map((x) => x.textContent.trim()),
      fotos: [...document.querySelectorAll("#app .card img")].length,
    }));
    ok(
      !bar.botones.some((x) => /^Foto$/i.test(x)),
      "la tarjeta del barbero no tiene el botón Foto",
      bar.botones.join(" | "),
    );
    ok(bar.botones.length >= 2, "siguen Editar y Quitar", bar.botones.join(" | "));

    /* --- el merge de la foto --- */
    const merge = await du.page.evaluate(() => {
      window.__test.setBars([
        { id: "uid-falso", n: "Prueba", foto: "https://ejemplo/vieja.jpg" },
        { id: "uid-nuevo", n: "Sin foto" },
      ]);
      const conNueva = window.__test.setFotos({ "uid-falso": "https://ejemplo/nueva.jpg" });
      window.__test.setFotos({});
      const conVieja = window.__test.setBars([{ id: "x", n: "y", foto: "vieja" }]);
      const limpio = window.__test.setFotos({});
      return { conNueva, conVieja, limpio };
    });
    ok(
      merge.conNueva[0].foto === "https://ejemplo/nueva.jpg",
      "la foto de fotoBarbero pisa a la de la ficha",
      JSON.stringify(merge.conNueva.map((b) => b.foto)),
    );
    ok(
      merge.conNueva[1].foto === "",
      "un barbero sin foto sigue sin foto",
      JSON.stringify(merge.conNueva.map((b) => b.foto)),
    );
    ok(
      merge.limpio[0].foto === "vieja",
      "si no hay nada en fotoBarbero, se usa la foto de la ficha de respaldo",
      JSON.stringify(merge.limpio.map((b) => b.foto)),
    );

    /* --- Mensajes: la pantalla tiene que ABRIR, no sólo estar en la barra --- */
    /* Esto se agregó después de un despiste: "mens" estaba en rtOk pero no en
       la tabla de rutas RT, así que el botón de la barra llevaba a
       "#/undefined" y no pasaba nada. Contar que la sección existe en la barra
       no dice nada de que abra. */
    await du.page.locator('#nav button:has-text("Mensajes")').click();
    await du.page.waitForTimeout(2200);
    const ms = await du.page.evaluate(() => ({
      hash: location.hash,
      titulo: (document.querySelector("#app h1") || {}).textContent || "",
      cuerpo: document.getElementById("app").innerText.slice(0, 160),
    }));
    ok(ms.hash === "#/mensajes", "el botón Mensajes lleva a #/mensajes", ms.hash);
    ok(/Mensajes/.test(ms.titulo), "y muestra la pantalla de Mensajes", ms.titulo + " | " + ms.cuerpo.slice(0, 60));
    await du.page.evaluate(() => {
      location.hash = "#/clientes";
    });
    await du.page.waitForTimeout(1200);

    /* --- Ajustes --- */
    await du.page.evaluate(() => {
      location.hash = "#/ajustes";
    });
    await du.page.waitForTimeout(2200);
    const aj = await du.page.evaluate(() => ({
      tabs: [...document.querySelectorAll("#app .tabs button")].map((x) => x.textContent.trim()),
      cuerpo: document.getElementById("app").innerText.slice(0, 200),
    }));
    ok(aj.tabs.join("|") === "Horarios|Servicios|Puntos", "las pestañas son Horarios/Servicios/Puntos", aj.tabs.join(" | "));
    ok(!/Negocio/.test(aj.cuerpo), "no aparece el apartado Negocio", aj.cuerpo.slice(0, 80));

    await du.page.locator('#app .tabs button:has-text("Servicios")').click();
    await du.page.waitForTimeout(1400);
    const sv = await du.page.evaluate(() => ({
      /* OJO: los nombres de los servicios viven en el `value` de los inputs, y
         innerText NO incluye el value de un input. Buscarlos en el texto daba
         falso negativo con la pestaña perfectamente bien. */
      titulo: /Servicios y precios/.test(document.getElementById("app").innerText),
      nombres: [...document.querySelectorAll('#app .svr input')].map((x) => x.value).filter(Boolean),
      hayPremio: /Premios/.test(document.getElementById("app").innerText),
    }));
    ok(sv.titulo, "la pestaña Servicios se titula «Servicios y precios»", JSON.stringify(sv).slice(0, 120));
    ok(sv.nombres.length >= 1, "y lista los servicios con su nombre", sv.nombres.join(" | "));
    ok(!sv.hayPremio, "la pestaña Servicios ya no mezcla los premios", JSON.stringify(sv));

    await du.page.locator('#app .tabs button:has-text("Puntos")').click();
    await du.page.waitForTimeout(1400);
    const pt = await du.page.evaluate(() => ({
      hayPremio: /Premios/.test(document.getElementById("app").innerText),
      hayReglas: /Puntos por corte completado/.test(document.getElementById("app").innerText),
      welcome: document.getElementById("pptsreg") ? document.getElementById("pptsreg").value : null,
    }));
    ok(pt.hayPremio && pt.hayReglas, "la pestaña Puntos tiene premios y reglas", JSON.stringify(pt));
    ok(pt.welcome !== null, "el campo de bienvenida sigue ahí", String(pt.welcome));

    ok(du.jsErr.length === 0, "sin errores de JS en el panel del dueño", [...new Set(du.jsErr)].join(" / "));
  }
  await du.ctx.close();

  /* ---------- 3. el barbero ---------- */
  console.log("\n=== 3. panel del barbero ===");
  await new Promise((r) => setTimeout(r, 2500));
  const ba = await entrar(b, env.BARBERO_EMAIL, env.BARBERO_PASSWORD);
  if (!(await ba.page.evaluate(() => !!(window.__test && window.__test.uid)))) {
    ok(false, "entró el barbero");
  } else {
    ok(true, "entró el barbero");
    await ba.page.locator("#mebadge").click();
    await ba.page.waitForTimeout(600);
    await ba.page.locator('#pmenu button:has-text("Editar perfil")').click();
    await ba.page.waitForTimeout(1600);
    const ed = await ba.page.evaluate(() => {
      const d = document.querySelector("details.perfil");
      return {
        existe: !!d,
        abierto: d ? d.open : false,
        enPanel: d ? !!d.closest("#app") : false,
        foco: document.activeElement ? document.activeElement.id || document.activeElement.tagName : null,
      };
    });
    ok(ed.existe, "el bloque «Mi perfil en la web» está en el panel");
    ok(ed.enPanel, "y está dentro del panel, no hay que ir a la web");
    ok(ed.abierto, "«Editar perfil» lo abre", JSON.stringify(ed));
    ok(ed.foco === "pfNombre", "y deja el foco en el primer campo para escribir", String(ed.foco));
    ok(ba.jsErr.length === 0, "sin errores de JS", [...new Set(ba.jsErr)].join(" / "));
  }
  await ba.ctx.close();
  await b.close();

  console.log(fallos ? `\nFALLARON ${fallos}` : "\nTODO VERDE");
  process.exit(fallos ? 1 : 0);
})();