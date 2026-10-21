/* Corre toda la batería en un comando.

   node tests\run.js            → todas
   node tests\run.js sin-csp    → sólo las que no necesitan el servidor con CSP
   node tests\run.js rapido     — sólo las que no requieren iniciar sesión

   OJO con el orden: las pruebas que inician sesión se pegan entre sí contra el
   rate limit de Firebase Auth (por IP). Entre una y otra hay una espera.
   Si una falla con "auth/too-many-requests" o con un timeout de 30 s al
   esperar un elemento del panel, es eso y no un error del código: conviene
   esperar un minuto y volver a correr esa sola. */

const { execFileSync, spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const ESPERA_LOGIN = 20000; /* ms entre pruebas que usan cuenta */

const TODAS = [
  /* sin red: leen archivos */
  { n: "seo", sesion: false, red: false },
  { n: "seo2", sesion: false, red: false },
  { n: "loader.giro", sesion: false, red: false },
  { n: "favicon", sesion: false, red: false },
  { n: "loader", sesion: false, red: false },
  { n: "css.muerto", sesion: false, red: false },
  { n: "csp.sync", sesion: false, red: false },
  { n: "deploy.carga", sesion: false, red: false },
  { n: "visual", sesion: false, red: false },
  { n: "accesibilidad", sesion: true, red: true },
  { n: "img.vivas", sesion: false, red: true },
  { n: "html.valido", sesion: true, red: false },
      /* Corre contra el servidor LOCAL, no contra el sitio publicado: lo que
         se está midiendo es el código del repo, no si ya se desplegó. Contra
         el sitio en vivo queda como comprobación manual (ver el mensaje). */
      { n: "landing.foto.viva", sesion: false, red: true, arg: "http://127.0.0.1:8765/index.html" },

  /* red, sin cuenta */
  { n: "landing.web", sesion: true, red: false },
  { n: "landing.tema", sesion: true, red: false },
  { n: "landing.audit", sesion: false, red: false },
  { n: "landing.registro", sesion: false, red: false },
  { n: "landing.modal", sesion: false, red: false },
  { n: "landing.header", sesion: false, red: false },
  { n: "landing.barberos", sesion: false, red: false },
  { n: "landing.wizard", sesion: false, red: false },
  { n: "landing.wizard-a11y", sesion: false, red: false },
  { n: "landing.sync", sesion: false, red: false },
  { n: "landing.reglas", sesion: true, red: false },
  { n: "politicas", sesion: false, red: false },
  { n: "botones.contraste", sesion: false, red: false },
  { n: "panel.contraste", sesion: true, red: false },
  { n: "tokens.claro", sesion: false, red: false },
  { n: "panel.quitar", sesion: true, red: false },
  { n: "header", sesion: true, red: false },
  { n: "cuentas", sesion: true, red: false },
  { n: "lote25", sesion: true, red: false },
  /* Los dos UID del dueño (config.js y las reglas de Firestore) tienen que ser
     el mismo. No necesita sesion ni red: es comparar dos archivos. */
  { n: "owner", sesion: false, red: false },

  /* necesitan el servidor con CSP */
  { n: "csp", sesion: false, red: true },
  { n: "csp.popup", sesion: false, red: true },
  { n: "xss", sesion: true, red: false },
  { n: "mapa", sesion: false, red: false },
  { n: "galeria", sesion: false, red: false },
  { n: "perf", sesion: false, red: false },
];

const args = process.argv.slice(2);
const soloRed = args.includes("con-csp");
const rapido = args.includes("rapido");

let lista = TODAS;
if (soloRed) lista = lista.filter((t) => t.red);
if (rapido) lista = lista.filter((t) => !t.sesion);

/* El servidor con CSP hace falta para las pruebas marcadas con red. */
let srv = null;
if (lista.some((t) => t.red)) {
  srv = spawn(process.execPath, [path.join(__dirname, "srv.js"), "8766"], {
    stdio: "ignore",
    detached: false,
  });
  console.log("servidor con CSP en el puerto 8766");
  /* Se espera a que levante. */
  execFileSync(process.execPath, ["-e", `setTimeout(()=>{}, 2500)`]);
}

const res = [];
let ultimaSesion = 0;
for (const t of lista) {
  const falta = fs.existsSync(path.join(__dirname, t.n + ".js"));
  if (!falta) {
    console.log(`\n--- ${t.n}: no está el archivo, se salta`);
    continue;
  }
  if (t.sesion) {
    const desde = Date.now() - ultimaSesion;
    if (ultimaSesion && desde < ESPERA_LOGIN) {
      const espera = ESPERA_LOGIN - desde;
      console.log(`\n(esperando ${Math.round(espera / 1000)} s para no pegarle al rate limit)`);
      execFileSync(process.execPath, ["-e", `setTimeout(()=>{}, ${espera})`]);
    }
  }
  console.log(`\n--- ${t.n}`);
  const salida = [];
  try {
    const r = spawnSyncLog(t.n, salida, t.arg);
    const cod = r;
    const txt = salida.join("\n");
    const ok = (txt.match(/^\s*(OK|CK)\s/gm) || []).length;
    /* Con un espacio después de FALLA: si no, la línea de resumen
       "FALLARON 0 · avisos 0" cuenta como un fallo y el cuadro miente.

       Y OJO con el "FAIL": hay pruebas (politicas, entre otras) que escriben
       "FAIL" en vez de "FALLA". Con este filtro, esas aparecían en el cuadro
       como "ROJO fallas=0" y sin ninguna línea de detalle: el informe decía
       que algo falló pero no qué, que es peor que no informarlo. Se cuentan y
       se muestran las dos escrituras. */
    const fallas = (txt.match(/^\s*(FALLA|FAIL)\s/gm) || []).length;
    const skips = (txt.match(/SKIP|skip/g) || []).length;
    console.log(
      `    ${cod === 0 ? "VERDE" : "ROJO "}  ok=${ok} fallas=${fallas}` +
        (skips ? ` skips=${skips}` : ""),
    );
    if (cod !== 0) {
      console.log(
        txt
          .split(/\r?\n/)
          .filter((l) => /^\s*(FALLA|FAIL)\s|Error|CRASH|Timeout/i.test(l))
          .slice(0, 8)
          .map((l) => "      " + l.trim())
          .join("\n"),
      );
    }
    res.push({ n: t.n, cod, ok, fallas, skips });
  } finally {
    ultimaSesion = Date.now();
  }
}
if (srv) srv.kill();

function spawnSyncLog(nombre, salida, arg) {
  const args = [path.join(__dirname, nombre + ".js")];
  if (arg) args.push(arg);
  const r = require("child_process").spawnSync(process.execPath, args, {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  salida.push(r.stdout || "", r.stderr || "");
  return r.status;
}

console.log("\n" + "=".repeat(58));
console.log("prueba            estado  ok   fallas");
console.log("-".repeat(58));
for (const r of res)
  console.log(
    r.n.padEnd(18) +
      (r.cod === 0 ? " verde " : " ROJO  ") +
      String(r.ok).padStart(4) +
      String(r.fallas).padStart(7),
  );
const malas = res.filter((r) => r.cod !== 0);
const totalOk = res.reduce((a, r) => a + r.ok, 0);
console.log("-".repeat(58));
console.log(
  `${res.length} pruebas · ${totalOk} comprobaciones · ${malas.length} en rojo`,
);
process.exit(malas.length ? 1 : 0);