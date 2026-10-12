/* Borra los datos que las pruebas dejaron en la base REAL.

   Al reproducir el error de permisos se escribieron cosas de verdad: dos
   documentos sonda y un par de turnos y una venta de prueba. Esto las borra.

   Ojo: la regla de borrado de `activos` es la misma que la de escritura, así
   que si el borrado también fuera a fallar esto lo diría con el motivo, en vez
   de fingir que limpió.

   node tests\limpia.sondas.js
*/
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

const cfg = fs.readFileSync(path.join(__dirname, "..", "src", "config.js"), "utf8");
const API = (cfg.match(/apiKey:\s*"([^"]+)"/) || [])[1];
const PROY = (cfg.match(/projectId:\s*"([^"]+)"/) || [])[1];
const BASE = `https://firestore.googleapis.com/v1/projects/${PROY}/databases/(default)/documents`;

async function token(email, pass) {
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: pass, returnSecureToken: true }),
  });
  const j = await r.json();
  if (!j.idToken) throw new Error("sin token: " + JSON.stringify(j).slice(0, 160));
  return j.idToken;
}

const H = (t) => ({ "Content-Type": "application/json", Authorization: `Bearer ${t}` });

async function borrar(tok, col, id) {
  const r = await fetch(`${BASE}/${col}/${encodeURIComponent(id)}?key=${API}`, {
    method: "DELETE",
    headers: H(tok),
  });
  if (r.ok) return `borrado ${col}/${id}`;
  const j = await r.json().catch(() => ({}));
  return `NO SE PUDO borrar ${col}/${id}: HTTP ${r.status} ${(j.error && j.error.message) || ""}`;
}

async function listar(tok, col) {
  const r = await fetch(`${BASE}/${col}?key=${API}&pageSize=300`, { headers: H(tok) });
  const j = await r.json().catch(() => ({}));
  return j.documents || [];
}

(async () => {
  const tok = await token(env.DUENO_EMAIL, env.DUENO_PASSWORD);
  console.log("dueño con sesión\n");

  /* 1. los documentos sonda, de nombre imposible de confundir. */
  for (const col of ["activos", "ocupados"]) {
    for (const id of ["_prueba_reglas"]) console.log("  " + (await borrar(tok, col, id)));
  }

  /* 2. los turnos y las ventas que crearon las pruebas. */
  const turnos = await listar(tok, "turnos");
  for (const d of turnos) {
    const f = (d.fields || {});
    const nm = (f.nm && f.nm.stringValue) || "";
    if (/Sonda|Prueba/i.test(nm)) console.log("  " + (await borrar(tok, "turnos", d.name.split("/").pop())));
  }
  const ventas = await listar(tok, "ventas");
  for (const d of ventas) {
    const f = (d.fields || {});
    const nm = (f.nm && f.nm.stringValue) || "";
    const srv = (f.serv && f.serv.stringValue) || "";
    if (/Sonda|Prueba/i.test(nm + srv)) console.log("  " + (await borrar(tok, "ventas", d.name.split("/").pop())));
  }

  /* 3. los activos que quedaron de esos turnos. */
  const activos = await listar(tok, "activos");
  for (const d of activos) {
    const id = d.name.split("/").pop();
    const f = d.fields || {};
    const tu = (f.tu && f.tu.stringValue) || "";
    if (/^Sonda/i.test(tu) || /prueba_reglas/.test(id))
      console.log("  " + (await borrar(tok, "activos", id)));
  }

  console.log("\nSi algo salió con NO SE PUDO, borralo desde Firebase > Firestore > datos.");
})();