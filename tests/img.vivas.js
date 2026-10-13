/* Prueba que las fotos de la landing CARGAN, no que pesan poco.

   El antecedente que obliga a esta prueba: el lote 26iply06 la transformación de
   Cloudinary con la versión antes que la transformación, con lo que TODAS las
   imágenes de la landing daban 404 y no se veía ninguna. Y `tests/perf.movil.js`
   no lo detectó: sumaba bytes, y una imagen rota son 357 bytes. El peso BAJÓ
   32% mientras el sitio se rompía. La medición mentía porque no miraba el
   código de respuesta.

   Esta prueba hace las dos cosas: que la url exista (HTTP 200) y que la
   transformación sirva una imagen de verdad.

   node tests\img.vivas.js
*/
const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..");

/* Se saca la función del código real, no una copia: si `imgCld` cambia, esta
   prueba cambia con ella. */
const src = fs.readFileSync(path.join(RAIZ, "src", "main.js"), "utf8");
const m = src.match(/const imgCld = \(u, ancho\) => \{[\s\S]*?\n\};/);
if (!m) {
  console.log("  FALLA  no encontré imgCld en src/main.js");
  process.exit(1);
}
const imgCld = new Function("return " + m[0].replace(/^const imgCld =/, ""))();

const ACEPTAR = { Accept: "image/avif,image/webp,image/*,*/*" };

let fallos = 0;
const ok = (c, msj, d) => {
  console.log((c ? "  OK    " : "  FALLA ") + msj);
  if (!c) {
    fallos++;
    if (d) console.log("          " + d);
  }
};

(async () => {
  console.log("=== 1. una url real de Cloudinary, transformada ===");
  const REAL =
    "https://res.cloudinary.com/lvrsdw0h/image/upload/v1791822041/codigo-barber-1/servicios/s1/Corte%20degradado%20en%20la%20barber%C3%ADa-mv5gkpji.webp";

  const cruda = await fetch(REAL, { headers: ACEPTAR });
  const bytesCruda = Number(cruda.headers.get("content-length") || 0);
  console.log(`  la original responde ${cruda.status} (${Math.round(bytesCruda / 1024)} KB)`);
  ok(cruda.status === 200, "la url original sigue viva");

  const transformada = imgCld(REAL, 800);
  console.log("  queda: " + transformada.slice(0, 118));
  const tr = await fetch(transformada, { headers: ACEPTAR });
  const bytesTr = Number(tr.headers.get("content-length") || 0);
  const tipo = (tr.headers.get("content-type") || "").split(";")[0];
  console.log(`  la transformada responde ${tr.status} (${Math.round(bytesTr / 1024)} KB, ${tipo})`);

  ok(tr.status === 200, "y la TRANSFORMADA también responde 200", "HTTP " + tr.status);
  ok(/^image\//.test(tipo), "y devuelve una imagen, no un JSON de error", tipo);
  ok(bytesTr > 1000, "y pesa lo que una imagen, no los 357 bytes de un error", bytesTr + " bytes");

  /* La transformación tiene que ir antes que la versión. */
  const orden = transformada.indexOf("/upload/") + "/upload/".length;
  ok(
    transformada.slice(orden).indexOf("f_auto") < transformada.slice(orden).indexOf("/v"),
    "la transformación va ANTES de la versión (el orden inverso daba 404)",
    transformada.slice(orden),
  );

  if (cruda.status === 200 && tr.status === 200) {
    const ahorro = Math.round(((bytesCruda - bytesTr) / bytesCruda) * 100);
    console.log(
      `  ahorro real medido contra Cloudinary: ${ahorro}% (${Math.round(bytesCruda / 1024)} -> ${Math.round(bytesTr / 1024)} KB)`,
    );
  }

  console.log("\n=== 2. las fotos de la landing, todas ===");
  /* Se leen de config.js lo que hay en la base ahora mismo; si no hay ninguna
     guardada, la prueba lo dice en vez de fingir que pasó. */
  const cfg = fs.readFileSync(path.join(RAIZ, "src", "config.js"), "utf8");
  const API = (cfg.match(/apiKey:\s*"([^"]+)"/) || [])[1];
  const PROY = (cfg.match(/projectId:\s*"([^"]+)"/) || [])[1];
  const env = {};
  try {
    fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8")
      .split(/\r?\n/)
      .forEach((l) => {
        const i = l.indexOf("=");
        if (i < 1 || l.trim().startsWith("#")) return;
        const k = l.slice(0, i).trim();
        if (!env[k]) env[k] = l.slice(i + 1).trim();
      });
  } catch {}

  if (API && PROY && env.DUENO_EMAIL) {
    const tk = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: env.DUENO_EMAIL, password: env.DUENO_PASSWORD, returnSecureToken: true }),
      },
    ).then((r) => r.json());
    if (tk.idToken) {
      const leer = async (col) => {
        const r = await fetch(
          `https://firestore.googleapis.com/v1/projects/${PROY}/databases/(default)/documents/${col}?key=${API}`,
          { headers: { Authorization: `Bearer ${tk.idToken}` } },
        );
        const j = await r.json().catch(() => ({}));
        return j.documents || [];
      };
      /* Las fotos de los servicios y de la galería. */
      const docs = [...(await leer("config/servicios")), ...(await leer("galeria"))];
      const urls = [];
      for (const d of docs) {
        const f = (d.fields && d.fields.img && d.fields.img.stringValue) || (d.fields && d.fields.url && d.fields.url.stringValue);
        if (f) urls.push(f);
      }
      console.log(`  hay ${urls.length} fotos cargadas en la base`);
      if (!urls.length) {
        console.log("  SKIP  no hay fotos para comprobar");
      } else {
        let malas = 0;
        for (const u of urls) {
          const t = imgCld(u, 800);
          const r = await fetch(t, { headers: ACEPTAR });
          const b = Number(r.headers.get("content-length") || 0);
          const bien = r.status === 200 && /^image\//.test(r.headers.get("content-type") || "");
          if (!bien) {
            malas++;
            console.log(`  FALLA  ${r.status}  ${u.slice(-58)}`);
          } else {
            console.log(`  OK     ${Math.round(b / 1024).toString().padStart(4)} KB  ${u.slice(-58)}`);
          }
        }
        ok(malas === 0, `las ${urls.length} fotos de la base cargan con la transformación`, malas + " rotas");
      }
    }
  }

  console.log("\n=== 3. lo que imgCld NO debe tocar ===");
  for (const u of ["", "assets/logo-256.png", "data:image/png;base64,AAA", "https://ejemplo.com/foto.jpg", undefined]) {
    const salida = imgCld(u, 800);
    ok(salida === (u === undefined ? "" : u), "no toca: " + JSON.stringify(u), "-> " + JSON.stringify(salida));
  }

  console.log(fallos ? `\nFALLARON ${fallos}` : "\nTODO VERDE");
  process.exit(fallos ? 1 : 0);
})();