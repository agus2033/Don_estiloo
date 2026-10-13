/* El HTML que genera la app tiene que estar balanceado.

   Por qué esta prueba existe: el lote 27 abrió `<article class="lb-sv">` y lo
   cerró con `</div>`. El navegador NO se queja: lo que hace es cerrar de más el
   contenedor y "colgar" el resto del HTML afuera de `div.lb`. El sitio siguió
   "funcionando", los tests siguieron dando verde —porque todos miran el DOM ya
   parseado, y el parser de HTML repara los cierres desbalanceados en silencio—
   y el síntoma real fue que en la sección de servicios se veían las dos
   listas, una de ellas con fotos de 1438 px de ancho.

   O sea: ningún test existente podía detectarlo, porque todos leen el
   resultado del parser. Esta prueba mira la CADENA ANTES del parseo.

   node tests\html.valido.js
*/
const { chromium } = require("../.opencode/skills/playwright-skill/node_modules/playwright/index.js");
const fs = require("fs");
const path = require("path");

const BASE = "http://127.0.0.1:8765/index.html";
const BASE2 = process.argv[2] || "http://127.0.0.1:8765/index.html";

let fallos = 0;
const ok = (c, m, d) => {
  console.log((c ? "  OK    " : "  FALLA ") + m);
  if (!c) {
    fallos++;
    if (d) console.log("          " + d);
  }
};

/* Se intercepta el setter de innerHTML ANTES de que corra la app, para quedarse
   con la cadena que genera, que es la que hay que validar. El DOM que sale
   después ya viene reparado y no sirve para nada. */
const ESPIA = () => {
  window.__htmlCrudo = [];
  const desc = Object.getOwnPropertyDescriptor(Element.prototype, "innerHTML");
  Object.defineProperty(Element.prototype, "innerHTML", {
    configurable: true,
    enumerable: desc.enumerable,
    get: desc.get,
    set(v) {
      if (this.id === "app" && typeof v === "string" && v.length > 200) window.__htmlCrudo.push(v);
      return desc.set.call(this, v);
    },
  });
};

/* Balance de etiquetas sobre la cadena cruda. Se ignoran las que no tienen
   cierre (void) y el contenido de <script> y <style>. */
const CHEQUEO = (html) => {
  const limpio = html.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, "");
  const sinVoid = limpio.replace(/<(area|base|br|col|embed|hr|img|input|link|meta|source|track|wbr)\b[^>]*>/gi, "");
  const pila = [];
  const problemas = [];
  const re = /<(\/?)([a-z][a-z0-9]*)\b[^>]*?(\/?)>/gi;
  let m;
  while ((m = re.exec(sinVoid))) {
    const cierra = m[1] === "/";
    const tag = m[2].toLowerCase();
    const auto = m[3] === "/";
    if (auto) continue;
    if (!cierra) {
      pila.push(tag);
    } else {
      if (!pila.length) {
        problemas.push("cierre sobrante </" + tag + ">");
      } else if (pila[pila.length - 1] === tag) {
        pila.pop();
      } else {
        const abierto = pila[pila.length - 1];
        problemas.push("se esperaba </" + abierto + "> pero llegó </" + tag + ">");
        const i = pila.lastIndexOf(tag);
        if (i >= 0) pila.length = i;
        else pila.pop();
      }
    }
  }
  if (pila.length) problemas.push("quedan sin cerrar: " + pila.join(", "));
  return problemas;
};

(async () => {
  const env = {};
  fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8")
    .split(/\r?\n/)
    .forEach((l) => {
      const i = l.indexOf("=");
      if (i < 1 || l.trim().startsWith("#")) return;
      const k = l.slice(0, i).trim();
      if (!env[k]) env[k] = l.slice(i + 1).trim();
    });

  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(ESPIA);
  const page = await ctx.newPage();
  await page.goto(BASE2, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".lb-wcard", { timeout: 30000 });
  await page.evaluate(async () => {
    const rs = await navigator.serviceWorker.getRegistrations();
    for (const r of rs) await r.unregister();
    for (const k of await caches.keys()) await caches.delete(k);
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector(".lb-wcard", { timeout: 30000 });
  await page.waitForTimeout(3500);

  const medir = async (etq) => {
    const crudos = await page.evaluate(() => window.__htmlCrudo || []);
    const html = crudos[crudos.length - 1] || "";
    const probs = html ? CHEQUEO(html) : ["no se capturó ningún HTML"];
    ok(probs.length === 0, `${etq}: el HTML generado está balanceado`, probs.slice(0, 3).join(" | ") + " (" + html.length + " bytes)");
    return html;
  };

  console.log("=== landing ===");
  await medir("landing");

  /* Ahora las pantallas del panel, que también generan HTML. */
  await page.evaluate(() => {
    location.hash = "#login";
  });
  await page.waitForSelector("#ie", { timeout: 20000 });
  await page.fill("#ie", env.DUENO_EMAIL);
  await page.fill("#ip", env.DUENO_PASSWORD);
  await page.click('[data-act="entrar"]');
  await page.waitForTimeout(15000);

  const VISTAS = [
    ["dash", "dashboard"],
    ["bar", "agenda"],
    ["cli", "clientes"],
    ["bars", "barberos"],
    ["fin", "finanzas"],
    ["cfg", "ajustes"],
    ["gal", "galería"],
    ["mens", "mensajes"],
  ];
  console.log("\n=== panel del dueño ===");
  for (const [v, etq] of VISTAS) {
    await page.evaluate((x) => {
      location.hash = "#/" + x;
    }, v);
    await page.waitForTimeout(1800);
    await medir(etq);
  }

  /* Y la estructura de #app con la LANDING puesta, que es donde se rompió:
     la landing tiene una sola raíz (`.lb`) y nada puede quedar colgando al
     lado. Con el `</div>` de más en la tarjeta de servicio, el parser cortaba
     `.lb` antes de tiempo y las secciones de abajo quedaban como hermanas
     sueltas dentro de <main>. */
  console.log("\n=== estructura de #app con la landing ===");
  /* Hay que volver a la WEB, no sólo cambiar el hash: con sesión, "#/inicio" es
     el inicio del cliente del panel. La casita del encabezado es la que llama
     a verWebOn. */
  const hayCasita = await page.locator("#web:not([hidden])").count();
  if (hayCasita) {
    await page.locator("#web").click();
  } else {
    await page.evaluate(() => {
      location.hash = "#/inicio";
    });
  }
  await page.waitForTimeout(2600);
  const estruc = await page.evaluate(() => {
    const app = document.getElementById("app");
    const kids = [...app.children].map((c) => c.tagName + "." + String(c.className || "").split(" ")[0]);
    return {
      kids,
      mains: document.querySelectorAll("main").length,
      /* La lista de servicios para celular tiene que seguir DENTRO de `.lb`: si
         queda afuera, el selector `.lb .lb-sv-list-m` deja de alcanzarla y se
         muestran las dos listas a la vez. */
      listaDentro: !!app.querySelector(".lb .lb-sv-list-m"),
      grillaDentro: !!app.querySelector(".lb .lb-sv-list"),
    };
  });
  ok(estruc.mains === 1, "el documento tiene UN solo <main>", "hay " + estruc.mains);
  ok(
    estruc.kids.length === 1 && estruc.kids[0].startsWith("DIV.lb"),
    "en la landing, #app tiene una sola raíz .lb y nada colgando al lado",
    estruc.kids.join(" | "),
  );
  ok(estruc.listaDentro, "la lista de servicios para celular sigue DENTRO de .lb");
  ok(estruc.grillaDentro, "y la grilla de escritorio también");

  await b.close();
  console.log(fallos ? `\nFALLARON ${fallos}` : "\nTODO VERDE");
  process.exit(fallos ? 1 : 0);
})();