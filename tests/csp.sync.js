/* La CSP de `vercel.json` y la de `tests/srv.js` tienen que decir EXACTAMENTE
   lo mismo.

   Hay una razón concreta para que sea un archivo duplicado y no una variable:
   el que se sube a producción es `vercel.json` (lo aplica Vercel), pero las
   pruebas corren contra `tests/srv.js`. Si los dos se desincronizan, las
   pruebas dan verde contra una CSP que no es la de producción, que es
   justamente cuando uno cree que está todo bien y no lo está.

   Uso:  node tests\csp.sync.js
*/
const fs = require("fs");
const path = require("path");

let fallos = 0;
const ok = (c, m, d) => {
  console.log((c ? "  OK   " : "  FALLA ") + m);
  if (!c) {
    fallos++;
    if (d) console.log("         " + d);
  }
};

const raiz = path.join(__dirname, "..");
const leer = (f) => fs.readFileSync(path.join(raiz, f), "utf8");

const vercel = JSON.parse(leer("vercel.json"));
const deVercel =
  (vercel.headers || [])
    .flatMap((h) => h.headers || [])
    .find((h) => h.key === "Content-Security-Policy")?.value || "";

const srv = leer("tests/srv.js");
const m = srv.match(/const CSP = \[([\s\S]*?)\]\.join\("; "\);/);
const deServidor = m
  ? m[1]
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.startsWith('"'))
      .map((s) => s.replace(/^"/, "").replace(/",?$/, ""))
      .join("; ")
  : "";

console.log("CSP: vercel.json contra tests/srv.js\n");

/* Se comparan como conjuntos de directivas: el orden no importa, pero SÍ el
   contenido. */
const partes = (s) =>
  s
    .split(";")
    .map((x) => x.trim())
    .filter(Boolean)
    .sort();
const pv = partes(deVercel);
const ps = partes(deServidor);

ok(!!deVercel, "vercel.json trae la CSP");
ok(!!deServidor, "tests/srv.js trae la CSP");
ok(
  pv.join(" | ") === ps.join(" | "),
  "las dos CSP dicen lo mismo",
  "\n         vercel: " + pv.filter((x) => !ps.includes(x)).join("; ") +
    "\n         srv   : " + ps.filter((x) => !pv.includes(x)).join("; "),
);

/* Lo que la app necesita de verdad, para que un descuido未来 se note acá. */
const reglas = partes(deVercel);
const tiene = (nombre, valores) => {
  const r = reglas.find((x) => x.split(/\s+/)[0] === nombre);
  return !!r && valores.every((v) => r.includes(v));
};

ok(tiene("default-src", ["'self'"]), "default-src es 'self'");
ok(tiene("object-src", ["'none'"]), "object-src es 'none' (no hay <object>/<embed>)");
ok(tiene("base-uri", ["'self'"]), "base-uri es 'self' (no se puede redirigir <base>)");
ok(tiene("frame-ancestors", ["'none'"]), "frame-ancestors es 'none' (frena el clickjacking)");
ok(tiene("form-action", ["'self'"]), "form-action es 'self'");

/* La app arma el HTML con 220 atributos style="...", así que 'unsafe-inline' en
   style-src NO es opcional: sin eso el navegador los descarta todos en
   silencio y la web queda sin formato. Si algún día se sacan esos estilos
   inline, hay que sacar también esta palabra. */
ok(
  tiene("style-src", ["'unsafe-inline'"]),
  "style-src permite estilos en línea (los usa la app)",
);
ok(!tiene("script-src", ["'unsafe-inline'"]), "script-src NO permite scripts en línea");
ok(!tiene("script-src", ["'unsafe-eval'"]), "script-src NO permite eval");

/* Los tres hosts que el service worker intercepta (sw.js, lista OK) tienen que
   estar en connect-src: el fetch() del worker se mide contra connect-src, no
   contra script-src ni style-src. Si faltan, la web se queda sin tipografías
   y sin los módulos de Firebase. Esto ya rompió una vez. */
const okSw = ["www.gstatic.com", "fonts.googleapis.com", "fonts.gstatic.com"];
const conSw = okSw.filter((h) => !tiene("connect-src", [h]));
ok(
  conSw.length === 0,
  "connect-src incluye los hosts que intercepta el service worker",
  "faltan: " + conSw.join(", "),
);

/* Lo mínimo que la app habla de verdad. */
ok(tiene("connect-src", ["https://firestore.googleapis.com"]), "connect-src incluye Firestore");
ok(
  tiene("connect-src", ["https://identitytoolkit.googleapis.com", "https://securetoken.googleapis.com"]),
  "connect-src incluye la autenticación de Firebase",
);
ok(tiene("script-src", ["https://www.gstatic.com"]), "script-src incluye los módulos de Firebase");
ok(tiene("frame-src", ["https://www.google.com"]), "frame-src incluye el mapa de Google");
ok(tiene("img-src", ["https://res.cloudinary.com"]), "img-src incluye Cloudinary (las fotos)");
ok(tiene("font-src", ["https://fonts.gstatic.com"]), "font-src incluye las tipografías");

/* Las otras cabeceras. */
const claves = (vercel.headers || []).flatMap((h) => (h.headers || []).map((x) => x.key));
for (const k of [
  "X-Content-Type-Options",
  "X-Frame-Options",
  "Referrer-Policy",
  "Permissions-Policy",
]) {
  ok(claves.includes(k), `vercel.json manda ${k}`);
}
ok(!claves.includes("X-Powered-By"), "no se manda X-Powered-By");

/* El service worker tiene que servirse sin caché, o los usuarios quedan
   pegados a una versión vieja del index para siempre. */
const swR = (vercel.headers || []).find((h) => h.source === "/sw.js");
ok(!!swR && /no-cache|must-revalidate|max-age=0/.test(JSON.stringify(swR.headers)), "sw.js se sirve sin caché");

console.log(fallos ? `\nFALLARON ${fallos}` : "\nTODO VERDE");
process.exit(fallos ? 1 : 0);