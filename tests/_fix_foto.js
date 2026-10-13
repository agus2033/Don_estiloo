const fs = require("fs");
const cfg = fs.readFileSync("src/config.js", "utf8");
const API = (cfg.match(/apiKey:\s*"([^"]+)"/) || [])[1];
const PROY = (cfg.match(/projectId:\s*"([^"]+)"/) || [])[1];
const UID = "Px0GbqrFqZVi3W5AKpT579xxkiz2";
const env = {};
fs.readFileSync(".env.local", "utf8").split(/\r?\n/).forEach((l) => {
  const i = l.indexOf("=");
  if (i > 0 && !l.trim().startsWith("#")) { const k = l.slice(0, i).trim(); if (!env[k]) env[k] = l.slice(i + 1).trim(); }
});

(async () => {
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: env.BARBERO_EMAIL, password: env.BARBERO_PASSWORD, returnSecureToken: true }),
  });
  const tok = (await r.json()).idToken;
  const base = `https://firestore.googleapis.com/v1/projects/${PROY}/databases/(default)/documents`;
  const H = { "Content-Type": "application/json", Authorization: "Bearer " + tok };
  const get = async (d) => {
    const r = await fetch(base + "/" + d + "?key=" + API, { headers: H });
    return { s: r.status, j: await r.json().catch(() => ({})) };
  };

  console.log("=== donde esta la foto ahora ===");
  const staff = await get("staff/" + UID);
  const usr = await get("users/" + UID);
  const fb = await get("fotoBarbero/" + UID);
  const f = (x) => (x && x.fields && x.fields.foto ? String(x.fields.foto.stringValue) : "(sin foto)");
  console.log("  staff/" + UID.slice(0, 8) + "        HTTP " + staff.s + "  foto = " + f(staff.j));
  console.log("  users/" + UID.slice(0, 8) + "        HTTP " + usr.s + "  foto = " + f(usr.j));
  console.log("  fotoBarbero/" + UID.slice(0, 8) + "  HTTP " + fb.s + "  foto = " + f(fb.j));

  const buena = f(staff.j) !== "(sin foto)" ? f(staff.j) : f(usr.j);
  const rota = f(fb.j);

  if (buena === "(sin foto)") {
    console.log("\n  No hay foto en ningun lado: no hay nada que restaurar.");
    return;
  }
  if (rota === buena) {
    console.log("\n  La foto de fotoBarbero esta bien. No hay nada que arreglar.");
    return;
  }

  console.log("\n  >>> MI COMPROBACION BORRO LA FOTO DE fotoBarbero (puso cadena vacia).");
  console.log("  >>> La restauro desde staff/, que es donde estaba: " + buena);
  const p = await fetch(base + "/fotoBarbero/" + UID + "?key=" + API + "&updateMask.fieldPaths=foto", {
    method: "PATCH", headers: H,
    body: JSON.stringify({ fields: { foto: { stringValue: buena } } }),
  });
  console.log("  restaurada: HTTP " + p.status);

  const chk = await get("fotoBarbero/" + UID);
  console.log("  verificacion: fotoBarbero.foto = " + f(chk.j));

  /* Y que la URL siga sirviendo una imagen de verdad, no un 404. */
  const img = await fetch(buena, { method: "HEAD" });
  console.log("  la URL responde HTTP " + img.status + "  ·  tipo: " + (img.headers.get("content-type") || "?"));
})();