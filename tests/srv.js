/* Servidor estático local que manda las MISMAS cabeceras que la de producción
   (vercel.json). Sirve para comprobar, con pruebas reales, que la CSP no rompe
   nada antes de publicarla.

   La CSP no se puede verificar leyendo el archivo: `style-src 'unsafe-inline'`
   hace falta porque la app genera 220 atributos style="..." desde JavaScript, y
   sin esa palabra el navegador los descarta todos en silencio. Sólo ejecutando
   la web con la cabecera puesta se ve si algo se rompió.

   Uso:  node tests\srv.js [puerto]
   Opciones: --sin-csp  para servir sin cabeceras (para comparar)
*/
const http = require("http");
const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..");
const PORT = +(process.argv[2] || 8766);
const SIN_CSP = process.argv.includes("--sin-csp");

const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  // Le dice al navegador que NADIE puede meter esta web en un iframe. Es lo
  // que frena el clickjacking sobre el panel, donde hay botones que mueven
  // plata ("Guardar cobro", "Hacer barbero", "Quitar barbero").
  "frame-ancestors 'none'",
  "img-src 'self' data: blob: https://res.cloudinary.com https://*.googleapis.com https://maps.gstatic.com https://www.google.com",
  // 'unsafe-inline' es obligatorio: el HTML de cada pantalla se arma con 220
  // atributos style="..." y sin esto el navegador los borra todos en silencio.
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  // Firebase se carga desde gstatic; la autenticación habla con
  // identitytoolkit y securetoken.
  "script-src 'self' https://www.gstatic.com https://apis.google.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com",
  // OJO: los tres hosts de `OK` (sw.js) tienen que estar TAMBIÉN en connect-src.
  // El service worker intercepta esos pedidos y los reintenta con fetch() desde
  // el worker, y esa llamada se mide contra connect-src, no contra script-src
  // ni style-src. Sin esto, la página se veía SIN tipografías y los módulos de
  // Firebase no cargaban (probado: "Refused to apply style from
  // fonts.googleapis.com" y "Expected a JavaScript module script but the server
  // responded with a MIME type of text/html").
  "connect-src 'self' https://firestore.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.googleapis.com https://api.cloudinary.com https://accounts.google.com https://www.gstatic.com https://fonts.googleapis.com https://fonts.gstatic.com",
  "frame-src https://www.google.com https://maps.google.com https://*.firebaseapp.com",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join("; ");

const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".mp4": "video/mp4",
};

http
  .createServer((req, res) => {
    let rel = decodeURIComponent(req.url.split("?")[0]);
    if (rel === "/") rel = "/index.html";
    const destino = path.join(RAIZ, path.normalize(rel).replace(/^([/\\])+/, ""));
    /* Nada fuera de la raíz. */
    if (!destino.startsWith(RAIZ)) {
      res.writeHead(403).end("no");
      return;
    }
    fs.readFile(destino, (err, buf) => {
      const ext = path.extname(destino).toLowerCase();
      const h = { "Content-Type": TIPOS[ext] || "application/octet-stream" };
      if (!SIN_CSP) {
        h["Content-Security-Policy"] = CSP;
        h["X-Content-Type-Options"] = "nosniff";
        h["Referrer-Policy"] = "strict-origin-when-cross-origin";
        h["X-Frame-Options"] = "DENY";
        h["Permissions-Policy"] = "geolocation=(), camera=(), microphone=()";
      }
      if (err) {
        res.writeHead(404, h).end("no existe");
        return;
      }
      res.writeHead(200, h).end(buf);
    });
  })
  .listen(PORT, "127.0.0.1", () => {
    console.log(
      "http://127.0.0.1:" + PORT + "/index.html" + (SIN_CSP ? "  (SIN CSP)" : "  (con CSP de producción)"),
    );
  });