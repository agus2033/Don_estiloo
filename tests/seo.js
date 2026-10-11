/* SEO local: que el head, el JSON-LD, robots.txt y sitemap.xml no se separen
   entre sí ni de src/config.js.

   El problema que_previene: el JSON-LD está escrito a mano en index.html
   porque Google tiene que leerlo SIN ejecutar JavaScript, y la web es una
   SPA con todo lo demás saliendo de config.js y de Firestore. Eso deja cinco
   lugares donde vive el mismo dato (dominio, teléfono, calle, coordenadas,
   horario) y ninguno se avisa si el otro cambia. Esta prueba es la que avisa.

   Corre:  node tests\seo.js
*/
const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..");
const leer = (p) => fs.readFileSync(path.join(RAIZ, p), "utf8");

let fallos = 0;
const ok = (c, m) => {
  console.log((c ? "  OK   " : "  FALLA ") + m);
  if (!c) fallos++;
};

const html = leer("index.html");
/* Los comentarios del HTML se sacan para las búsquedas de contenido: varios
   explican por qué NO se puso un dato (el teléfono de ejemplo, el dominio
   viejo) y si no, la prueba los toma como si fueran el dato puesto. */
const sinComentarios = html.replace(/<!--[\s\S]*?-->/g, "");
const cfg = leer("src/config.js");
const robots = leer("robots.txt");
const sitemap = leer("sitemap.xml");

/* ---- datos de src/config.js ---- */
const cfgVal = (k) => {
  const m = cfg.match(new RegExp("export const " + k + "\\s*=\\s*([^;]+);"));
  return m ? m[1].trim() : null;
};
const DOMINIO = (cfgVal("DOMINIO") || "").replace(/"/g, "");
const NOMBRE = (cfgVal("NOMBRE") || "").replace(/"/g, "");
const CALLE = (cfgVal("CALLE") || "").replace(/"/g, "");
const CIUDAD = (cfgVal("CIUDAD") || "").replace(/"/g, "");
const PROVINCIA = (cfgVal("PROVINCIA") || "").replace(/"/g, "");
const CP = (cfgVal("CP") || "").replace(/"/g, "");
const LAT = parseFloat(cfgVal("LAT"));
const LON = parseFloat(cfgVal("LON"));

console.log("config.js:");
console.log(`  dominio=${DOMINIO} nombre="${NOMBRE}"`);
console.log(`  calle="${CALLE}" ${CIUDAD}, ${PROVINCIA} (${CP})`);
console.log(`  geo=${LAT},${LON}`);

/* ---- 1. config.js tiene lo que hace falta ---- */
ok(!!DOMINIO, "config.js declara DOMINIO");
ok(!!NOMBRE, "config.js declara NOMBRE");
ok(!isNaN(LAT) && !isNaN(LON), "config.js declara LAT y LON numéricos");

/* ---- 2. el JSON-LD es JSON válido y es un BarberShop ---- */
const m = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
ok(!!m, "index.html tiene un <script type=\"application/ld+json\">");
let ld = null;
if (m) {
  try {
    ld = JSON.parse(m[1]);
    ok(true, "el JSON-LD es JSON válido");
  } catch (e) {
    ok(false, "el JSON-LD es JSON válido", e.message);
  }
}

if (ld) {
  console.log("\nJSON-LD:");
  ok(ld["@context"] === "https://schema.org", "declara @context de schema.org", ld["@context"]);
  ok(ld["@type"] === "BarberShop", "es de tipo BarberShop", ld["@type"]);

  /* Coherencia con config.js: acá está el corazón de la prueba. */
  ok(ld.url === DOMINIO + "/", "el url del JSON-LD es el dominio de config.js", `${ld.url}`);
  ok(String(ld["@id"]).startsWith(DOMINIO), "el @id arranca con el dominio", ld["@id"]);
  ok(Array.isArray(ld.image) && ld.image[0].startsWith(DOMINIO), "la imagen es del dominio", String(ld.image));
  ok(
    ld.address.streetAddress === CALLE,
    "la calle del JSON-LD es la de config.js (no la ciudad)",
    `"${ld.address.streetAddress}"`,
  );
  ok(ld.address.addressLocality === CIUDAD, "la ciudad coincide", ld.address.addressLocality);
  ok(ld.address.addressRegion === PROVINCIA, "la provincia coincide", ld.address.addressRegion);
  ok(String(ld.address.postalCode) === CP, "el código postal coincide", String(ld.address.postalCode));
  ok(ld.address.addressCountry === "AR", "el país es AR", ld.address.addressCountry);
  ok(ld.geo.latitude === LAT, "la latitud coincide con LAT", `${ld.geo.latitude}`);
  ok(ld.geo.longitude === LON, "la longitud coincide con LON", `${ld.geo.longitude}`);

  /* El error que más caro sale: un teléfono que no existe. */
  const tel = String(ld.telephone || "");
  ok(/^\+\d{10,15}$/.test(tel), "el teléfono tiene formato internacional (+ y 10-15 dígitos)", tel);
  /* Los WhatsApp están en config.js como "5493757699335": 13 dígitos que
     arrancan en 5 (prefijo de Argentina). */
  const numeros = [...new Set((cfg.match(/\b5\d{11,12}\b/g) || []))];
  ok(
    numeros.some((x) => tel === "+" + x),
    "el teléfono es alguno de los números reales de config.js",
    `${tel} vs ${JSON.stringify(numeros)}`,
  );
  /* Y que no quede el de ejemplo que circuló (salvo en un comentario). */
  ok(!/3757000000/.test(sinComentarios), "el teléfono NO es el de ejemplo (3757000000)");

  /* openingHoursSpecification tiene que ser ARREGLO: Schema.org la declara
     como propiedad repetida y Google la lee así. */
  ok(Array.isArray(ld.openingHoursSpecification), "openingHoursSpecification es un arreglo", typeof ld.openingHoursSpecification);
  if (Array.isArray(ld.openingHoursSpecification)) {
    const h = ld.openingHoursSpecification[0] || {};
    ok(/^\d\d:\d\d$/.test(h.opens || ""), "abre con formato hh:mm", h.opens);
    ok(/^\d\d:\d\d$/.test(h.closes || ""), "cierra con formato hh:mm", h.closes);
    ok(Array.isArray(h.dayOfWeek), "dayOfWeek es un arreglo");
  }
  ok(!!ld.priceRange, "declara priceRange", ld.priceRange);
  ok(Array.isArray(ld.sameAs) && ld.sameAs.length > 0, "declara sameAs (redes)", JSON.stringify(ld.sameAs));
  ok(
    !ld.aggregateRating,
    "NO declara aggregateRating (serían reseñas inventadas y Google penaliza)",
  );

  /* El nombre de la marca. Google exige que coincida EXACTAMENTE con el de la
     ficha de Google Maps, y antes de esto estaba escrito de dos formas: el
     SEO decía "Código Barber" (con tilde) y `NOMBRE` decía "Codigo Barber".
     Decisión del dueño (2026-10-11): SIN tilde. */
  ok(ld.name === NOMBRE, "el name del JSON-LD es el NOMBRE de config.js", `"${ld.name}"`);
}

/* ---- 3. el head ---- */
console.log("\nhead:");
const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || "";
ok(!!title, "hay <title>");
ok(title.length >= 30 && title.length <= 65, "el title tiene largo de SEO (30-65)", `${title.length}: "${title}"`);
ok(/Puerto Iguazú/i.test(title), "el title nombra la ciudad", title);
ok(title.indexOf(NOMBRE) === 0, "el title arranca con el NOMBRE de config.js", title);

const desc = (html.match(/<meta\s+name="description"\s+content="([^"]*)"/) || [])[1] || "";
ok(!!desc, "hay meta description");
ok(desc.length >= 70 && desc.length <= 175, "la description tiene largo de SEO (70-175)", `${desc.length}`);
ok(/Reserv/i.test(desc), "la description invita a reservar");
ok(/Puerto Iguazú/i.test(desc), "la description nombra la ciudad");

const canon = (html.match(/<link rel="canonical" href="([^"]*)"/) || [])[1] || "";
ok(canon === DOMINIO + "/", "el canonical es el dominio de config.js", canon);
ok(/<html lang="es-AR"/.test(html), "el html declara lang es-AR");

/* La marca tiene que estar escrita IGUAL en todos lados. Antes de esto el SEO
   decía "Código Barber" y `NOMBRE` decía "Codigo Barber": dos nombres para el
   mismo local, y Google los necesita iguales (y iguales a Google Maps). */
const autor = (html.match(/<meta name="author" content="([^"]*)"/) || [])[1] || "";
ok(autor === NOMBRE, "el meta author es el NOMBRE de config.js", `"${autor}"`);
/* Y que no vuelva la versión con tilde en ninguna parte que Google lea. */
ok(
  !/Código\s+Barber/.test(sinComentarios),
  "no queda la marca con tilde (Código Barber) en ningún lado",
  (sinComentarios.match(/Código\s+Barber.{0,40}/) || [])[0] || "",
);
const man = leer("manifest.json");
const manCorto = (man.match(/"short_name"\s*:\s*"([^"]*)"/) || [])[1] || "";
ok(manCorto === NOMBRE, "el short_name del manifest es el NOMBRE de config.js", `"${manCorto}"`);

/* Las OG: el mismo juego. El `content` puede estar en la línea siguiente
   (el formateador parte los valores largos), así que el patrón tiene que
   tolerar el salto. */
const og = {};
/* El formateador parte los atributos largos y los deja en líneas separadas
   (`<meta` / `property=` / `content=`), así que entre `<meta` y `property` hay
   un salto de línea. Con `<meta property=` a secas la og:description no se
   encontraba nunca y la prueba la daba por faltante. */
for (const mm of sinComentarios.matchAll(/<meta\s+property="og:([^"]+)"\s+content="([^"]*)"/g)) og[mm[1]] = mm[2];
for (const k of ["type", "site_name", "locale", "title", "description", "url", "image"]) {
  ok(!!og[k], `og:${k} está presente`);
}
ok(og.locale === "es_AR", "og:locale es es_AR", og.locale);
ok(og.site_name === NOMBRE, "og:site_name es el NOMBRE de config.js", og.site_name);
ok(og.url === DOMINIO + "/", "og:url es el dominio de config.js", og.url);
ok(String(og.image).startsWith(DOMINIO), "og:image es del dominio", og.image);
ok(/^https:\/\/codigobarber\.com\.ar\/assets\/logo-256\.png$/.test(String(og.image)), "og:image apunta al logo que existe");

/* Ninguna meta repetida: dos <meta property="og:x"> con la misma clave hace
   que la segunda no sirva para nada, en silencio.
   OJO con theme-color: hay DOS a propósito, una por cada modo de color, y se
   distinguen por el atributo `media`. Por eso la clave de agrupado es
   nombre+media y no sólo el nombre: sin eso la prueba siempre falla con un
   theme-color que está bien. */
const conMedia = [...sinComentarios.matchAll(/<meta\s[^>]*>/g)].map((x) => {
  /* Se parsea la etiqueta ENTERA y no un patrón que asuma el orden de los
     atributos: en el archivo, `media` va DESPUÉS de `content`, así que un
     patrón que lo busca antes no lo encuentra nunca y las dos theme-color
     (una por modo de color, que están bien) parecían duplicadas. */
  const nombre = (x[0].match(/(?:property|name)="([^"]+)"/) || [])[1] || "";
  const media = (x[0].match(/media="([^"]*)"/) || [])[1] || "";
  return nombre + "|" + media;
});
const dup = [...new Set(conMedia.filter((k, i) => conMedia.indexOf(k) !== i))];
ok(dup.length === 0, "no hay meta duplicadas", JSON.stringify(dup));
/* Y que sean exactamente dos theme-color, uno por modo. */
const tcs = [...sinComentarios.matchAll(/<meta name="theme-color"[^>]*media="([^"]+)"/g)].map((x) => x[1]);
ok(tcs.length === 2, "hay theme-color para oscuro y para claro", JSON.stringify(tcs));

/* Las metas geo: los dos formatos son distintos y se confunden. */
const pos = (html.match(/<meta name="geo.position" content="([^"]*)"/) || [])[1] || "";
const icbm = (html.match(/<meta name="ICBM" content="([^"]*)"/) || [])[1] || "";
ok(pos === `${LAT};${LON}`, "geo.position usa 'lat;lon' con punto y coma", pos);
ok(icbm === `${LAT}, ${LON}`, "ICBM usa 'lat, lon' con coma", icbm);
ok(/<meta name="geo.region" content="AR-M"/.test(html), "geo.region es AR-M (Misiones)");

/* ---- 4. robots.txt y sitemap.xml ---- */
console.log("\nrobots.txt y sitemap.xml:");
ok(/^User-agent:\s*\*/m.test(robots), "declara User-agent: *");
ok(/^Allow:\s*\/\s*$/m.test(robots), "permite todo con Allow: /");
const lineaSitemap = (robots.match(/^Sitemap:\s*(\S+)/m) || [])[1] || "";
ok(lineaSitemap === DOMINIO + "/sitemap.xml", "la línea Sitemap apunta al dominio correcto", lineaSitemap);
/* FIRESTORE_RULES.txt no tiene que quedar indexado: publica el id del
   proyecto de Firebase y el UID del dueño. */
ok(/^Disallow:\s*\/FIRESTORE_RULES\.txt\s*$/m.test(robots), "no deja indexar FIRESTORE_RULES.txt");
ok(fs.existsSync(path.join(RAIZ, "FIRESTORE_RULES.txt")), "el archivo que se bloquea existe");

ok(/^<\?xml version="1\.0" encoding="UTF-8"\?>/.test(sitemap), "sitemap.xml arranca con la declaración XML");
ok(/xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9"/.test(sitemap), "declara el namespace de sitemap");
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((x) => x[1]);
ok(locs.length > 0, "tiene al menos una URL");
ok(locs.every((x) => x.startsWith(DOMINIO)), "todas las <loc> son del dominio correcto", JSON.stringify(locs));
ok(locs.length === 1, "tiene una sola URL (la web es una SPA con rutas #)", `${locs.length}`);
ok(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/.test(sitemap), "el lastmod tiene formato de fecha");
ok(!/\/index\.html/.test(sitemap), "la URL es la raíz, no index.html");

/* ---- 5. que el sitemap apunte a algo que exista ---- */
ok(fs.existsSync(path.join(RAIZ, "index.html")), "la raíz del sitio existe (index.html)");

/* ---- 6. nada de datos inventados ---- */
/* Se buscan sobre el HTML SIN comentarios: el comentario del JSON-LD explica
   por qué no se puso el teléfono de ejemplo, y ahí la palabra está. */
ok(!/3757000000/.test(sinComentarios), "no quedó el teléfono de ejemplo en el index.html");
ok(!/don-estilo\.vercel\.app/.test(sinComentarios), "no quedó el dominio viejo de Vercel en el index.html");
ok(!/don-estilo\.vercel\.app/.test(robots), "no quedó el dominio viejo en robots.txt");
ok(!/don-estilo\.vercel\.app/.test(sitemap), "no quedó el dominio viejo en sitemap.xml");

/* La marca sin tilde tiene que estar así en TODOS los archivos que se
   publican, no sólo en el index.html: los comentarios de robots.txt y
   sitemap.xml también salen en la web. */
for (const f of ["index.html", "robots.txt", "sitemap.xml", "manifest.json"]) {
  const txt = fs.readFileSync(path.join(RAIZ, f), "utf8");
  ok(
    !/Código\s+Barber/.test(txt.replace(/<!--[\s\S]*?-->/g, "")),
    `${f} no tiene la marca con tilde`,
    (txt.match(/Código\s+Barber.{0,40}/) || [])[0] || "",
  );
}
/* La dirección tiene que ser la de config.js y no un placeholder. */
ok(!/\[DIRECCI/i.test(html), "no quedó el placeholder [DIRECCIÓN] en el JSON-LD");

console.log(fallos ? `\nFALLARON ${fallos}` : "\nTODO VERDE");
process.exit(fallos ? 1 : 0);
