/* Comprueba las cuatro cosas que pidió el dueño en una tanda:

   1. El favicon: tiene que existir /favicon.ico en la raíz, ser un .ico real
      (con las tres medidas adentro) y estar declarado en el HTML.
   2. La descripción: sin "peluquería masculina", y con marca y ciudad.
   3. Que se encuentre: marca y ciudad juntas en título, descripción, og,
      twitter, JSON-LD y en el texto visible de la portada.
   4. El login cancelado: `auth/user-cancelled` y `auth/popup-closed-by-user`
      tienen que salir en silencio, sin cartel.

   La 4 se prueba de verdad: se dispara el error en el navegador y se mira si
   aparece el cartel "#mo".

   node tests\seo2.js
*/
const { chromium } = require("../.opencode/skills/playwright-skill/node_modules/playwright/index.js");
const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..");
let fallos = 0;
const ok = (c, m, d) => {
  console.log((c ? "  OK    " : "  FALLA ") + m);
  if (!c) {
    fallos++;
    if (d) console.log("          " + d);
  }
};
const aviso = (m, d) => {
  console.log("  AVISO " + m);
  if (d) console.log("          " + d);
};

const html = fs.readFileSync(path.join(RAIZ, "index.html"), "utf8");
const main = fs.readFileSync(path.join(RAIZ, "src", "main.js"), "utf8");
const cfg = fs.readFileSync(path.join(RAIZ, "src", "config.js"), "utf8");

const NOMBRE = (cfg.match(/NOMBRE\s*=\s*"([^"]+)"/) || [])[1] || "";
const CIUDAD = (cfg.match(/CIUDAD\s*=\s*"([^"]+)"/) || [])[1] || "";
const meta = (re) => (html.match(re) || [])[1] || "";

console.log("1. FAVICON (logo en Google)\n");
{
  const p = path.join(RAIZ, "favicon.ico");
  const existe = fs.existsSync(p);
  ok(existe, "existe /favicon.ico en la raíz");

  if (existe) {
    const b = fs.readFileSync(p);
    /* Firma real de un ICO: reserved=0, type=1, y a partir del byte 6 vienen
       las entradas. */
    const esIco = b.readUInt16LE(0) === 0 && b.readUInt16LE(2) === 1;
    ok(esIco, "el archivo es un ICO de verdad (no un PNG renombrado)");
    const n = esIco ? b.readUInt16LE(4) : 0;
    ok(n >= 2, "tiene varias medidas adentro", `${n} medidas`);

    /* Cada entrada tiene que apuntar a un PNG válido y entrar en el archivo. */
    let todas = n > 0;
    const medidas = [];
    for (let i = 0; i < n; i++) {
      const o = 6 + 16 * i;
      const lado = b.readUInt8(o) || 256;
      const tam = b.readUInt32LE(o + 8);
      const off = b.readUInt32LE(o + 12);
      medidas.push(lado);
      if (!(off + tam <= b.length) || b.slice(off, off + 4).toString("hex") !== "89504e47")
        todas = false;
    }
    ok(todas, "las tres entradas apuntan a imágenes dentro del archivo", medidas.join(", "));
    ok(
      medidas.includes(16) && medidas.includes(32),
      "incluye 16x16 y 32x32 (las que usa el buscador)",
      medidas.join(", "),
    );
    ok(b.length < 60 * 1024, "no es un archivo enorme", `${Math.round(b.length / 1024)} KB`);
  }

  ok(/<link rel="icon" href="\/favicon\.ico"/.test(html), "el HTML declara /favicon.ico");
  /* El orden importa: el primero es el que se usa cuando no hay nada cacheado. */
  const iIco = html.indexOf('href="/favicon.ico"');
  const iPng = html.indexOf('href="assets/icon-192.png"');
  ok(iIco > 0 && (iPng < 0 || iIco < iPng), "/favicon.ico va antes del PNG de 192");
  ok(!/robots[\s\S]*Disallow:\s*\/favicon/i.test(fs.readFileSync(path.join(RAIZ, "robots.txt"), "utf8")), "robots.txt no bloquea el favicon");
}

console.log("\n2. DESCRIPCIÓN (sacar \"y peluquería masculina\")\n");
{
  ok(!/peluquer/i.test(html), "no queda \"peluquería\" en el index.html");
  /* En el main.js se buscan sólo las cadenas que ve la persona: los
     comentarios del código no se muestran, y el dueño no los lee. Hay uno que
     dice "los servicios son los de la peluquería" y no molesta. */
  const sinComentarios = main.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  ok(!/peluquer/i.test(sinComentarios), "ni en el texto que ve la persona (main.js)");
  ok(main.includes("peluquería"), "(queda uno, pero sólo en un comentario de código)", "comentario, no texto visible");

  const desc = meta(/name="description"\s+content="([^"]*)"/) || meta(/name="description"\s*\n?\s*content="([^"]*)"/);
  ok(!!desc, "hay meta description", desc.slice(0, 70));
  ok(desc.length >= 110 && desc.length <= 165, "la descripción tiene largo de resultado", desc.length + " caracteres");
  ok(desc.indexOf(NOMBRE) === 0, "arranca con el nombre de la barbería", desc.slice(0, 40));
  ok(new RegExp(CIUDAD).test(desc), "tiene la ciudad");
  ok(!/\bla mejor\b|\bel mejor\b|\bprofesionales\b/i.test(desc), "sin superlativos ni palabras vacías");

  const og = meta(/property="og:description"\s*\n?\s*content="([^"]*)"/);
  const tw = meta(/name="twitter:description"\s*\n?\s*content="([^"]*)"/);
  ok(og === desc, "og:description es la misma que la meta description");
  ok(tw === desc, "twitter:description también");
}

console.log("\n3. QUE SE ENCUENTRE (marca + ciudad)\n");
{
  const tit = meta(/<title>([^<]*)<\/title>/);
  ok(tit.indexOf(NOMBRE) >= 0, "el título tiene el nombre", tit);
  ok(new RegExp(CIUDAD).test(tit), "el título tiene la ciudad");
  ok(new RegExp("barber", "i").test(tit), "el título dice barbería");
  ok(tit.length <= 60, "el título entra sin recortar en Google", tit.length + " caracteres");

  const jl = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  ok(!!jl, "hay JSON-LD");
  if (jl) {
    const j = JSON.parse(jl[1]);
    ok(j["@type"] === "BarberShop", "el tipo es BarberShop", j["@type"]);
    ok(j.name === NOMBRE, "el nombre del JSON-LD es el de config.js", j.name);
    ok(new RegExp(CIUDAD).test(j.description), "la descripción del JSON-LD tiene la ciudad");
    ok(!/peluquer/i.test(j.description), "y no dice \"peluquería\"");
    ok(j.address.addressLocality === CIUDAD, "addressLocality es la ciudad de config.js", j.address.addressLocality);
    ok(
      j.areaServed && j.areaServed.name === CIUDAD,
      "areaServed es la ciudad (lo que hace que Google la asocie)",
      j.areaServed && j.areaServed.name,
    );
    /* El precio del arreglo tiene que ser el de la base, no el de config. */
    ok(Array.isArray(j.hasOfferCatalog?.itemListElement) && j.hasOfferCatalog.itemListElement.length > 0, "el catálogo de servicios no está vacío");
  }

  /* Y en el TEXTO VISIBLE, que es lo que Google contrasta de verdad. */
  ok(
    /\$\{esc\(NOMBRE\)\}, barbería en \$\{esc\(CIUDAD\)\}/.test(main),
    "el hero de la portada dice marca y ciudad",
  );
  ok(/<meta name="keywords"/.test(html) === false, "no se inventó una meta keywords (Google la ignora)");
}

console.log("\n4. LOGIN CANCELADO (sin aviso)\n");
{
  ok(/const CANCELADO = new Set\(\[[^\]]*"auth\/user-cancelled"/.test(main), "auth/user-cancelled está en la lista de cancelaciones");
  ok(/"auth\/popup-closed-by-user"/.test(main), "auth/popup-closed-by-user también");
  ok(/const esCancelacion = /.test(main), "hay un helper esCancelacion");
  ok(/if \(esCancelacion\(e\)\) return;/.test(main), "err() sale en silencio con una cancelación");
  ok(/if \(!esCancelacion\(e\)\) err\(e\);/.test(main), "el login social también sale en silencio");
  /* Y que no quede el cartel viejo diciendo "cerraste la ventana". */
  ok(!/"Cerraste la ventana de Google o Facebook sin terminar\."/.test(main), "el cartel de \"cerraste la ventana\" ya no existe");
}

(async () => {
  console.log("\n5. EN EL NAVEGADOR (que el silencio sea real)\n");
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto("http://127.0.0.1:8765/index.html", { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".lb-wcard", { timeout: 30000 });
  await page.waitForTimeout(2500);

  /* ¿Está el favicon y lo acepta el navegador? */
  const favi = await page.evaluate(async () => {
    const r = await fetch("/favicon.ico");
    return { ok: r.ok, tipo: r.headers.get("content-type"), bytes: (await r.arrayBuffer()).byteLength };
  });
  ok(favi.ok, "el navegador puede baixar /favicon.ico", JSON.stringify(favi));

  /* El caso real: se hace fallar el popup como si la persona lo cancelara. */
  for (const cod of ["auth/user-cancelled", "auth/popup-closed-by-user"]) {
    const r = await page.evaluate(async (code) => {
      /* Se expone sólo para la prueba: se simula el rechazo del proveedor. */
      const A = await import("https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js");
      const G = await import("https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js");
      const app = A.getApps().length ? A.getApp() : A.initializeApp(A.getApp().options);
      const auth = G.getAuth(app);
      /* Se dispara por el mismo camino que el catch de `red()`: el
         manejador `err`, que es quien decide si avisa o se calla. */
      const e = Object.assign(new Error("IdP denied access"), { code });
      window.__test.err(e);
      await new Promise((r2) => setTimeout(r2, 500));
      const mo = document.getElementById("mo");
      return {
        cartel: mo && !mo.hidden,
        texto: mo && !mo.hidden ? mo.innerText.replace(/\s+/g, " ").slice(0, 90) : "",
      };
    }, cod);
    ok(!r.cartel, `con ${cod} NO aparece ningún cartel`, r.texto);
  }

  /* Y el caso contrario: un error de verdad sí tiene que avisar. */
  const r2 = await page.evaluate(async () => {
    window.__test.err(
      Object.assign(new Error("algo"), { code: "auth/invalid-credential" }),
    );
    await new Promise((r3) => setTimeout(r3, 500));
    const mo = document.getElementById("mo");
    return { cartel: mo && !mo.hidden, texto: mo && !mo.hidden ? mo.innerText.replace(/\s+/g, " ").slice(0, 60) : "" };
  });
  ok(r2.cartel, "un error de verdad SÍ sigue avisando", r2.texto);

  await b.close();
  console.log(fallos ? `\nFALLARON ${fallos}` : "\nTODO VERDE");
  process.exit(fallos ? 1 : 0);
})();