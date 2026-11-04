/* Lote 53: PRUEBA PILOTO DE CARGA contra la web de producción.

   Lo que el dueño pidió: "una sobrecarga con mil usuarios y ver si falla".
   Esto es un PILOTO, con reglas para no romper (ni frenar) el servicio:

   - SÓLO LECTURA: nada de logins (el rate limit de Firebase Auth es por IP y
     lo taparía al dueño), nada de turnos/writes en Firestore.
   - Sólo pega HTTPS al dominio del sitio (Vercel). NUNCA a endpoints de
     Firebase o Cloudinary: el piloto mide el borde (HTML + assets fijos).
   - ESCALONADO: olas de 50, 100, 250, 500 y 1000 usuarios virtuales. Si
     aparece un 429, un 5xx, o el percentil 95 del HTML supera 4000 ms, se
     corta la escalera ahí (criterio de aborto).
   - Cada usuario "visitante" hace lo mínimo que hace uno real: pide la
     página y tres assets (logo, manifest, favicon). No ejecuta JS, así que
     NO mide la parte de Firebase/Cloudinary: eso va estimado en el informe
     del lote (§53), no acá.

   Los pedidos salen con un User-Agent identificable: si el dueño ve tráfico
   de "SSJPiloto/1.0", sabe que es esta prueba.

   Uso:  node tests\carga.js
   (MANUAL: tarda vario minutos y le pega a producción; NO va en run.js)
   Sale con código 1 si alguna ola rompió el criterio de aborto. */

const HOST = "www.codigobarber.com.ar";
const UA = "SSJPiloto/1.0 (prueba de carga pedida por el dueño)";

const OLAS = [
  { n: 50 },
  { n: 100 },
  { n: 250 },
  { n: 500 },
  { n: 1000 },
];

/* Assets por visitante (en la vida real el HTML pide ~15 cosas; acá 3 fijas
   para que el conteo de requests sea predecible y comparable entre olas). */
const ASSETS = ["/assets/logo-256.png?v=2", "/manifest.json", "/favicon.ico"];

const https = require("https");
const fs = require("fs");
const path = require("path");
const agent = new https.Agent({ keepAlive: true, maxSockets: 200 });

let okn = 0;
const ok = (cond, msg, extra) => {
  if (cond) {
    okn++;
    console.log("  OK    " + msg);
  } else {
    console.log("  FALLA " + msg + (extra ? "  -> " + extra : ""));
    process.exitCode = 1;
  }
};

/* Un pedido con TTFB y total medidos. Devuelve {ruta, st, ttfb, total,
   bytes, pos}. pos: true/false sólo en el HTML, null en el resto. */
const pedir = (ruta) =>
  new Promise((res) => {
    const t0 = performance.now();
    let ttfb = 0;
    const req = https.request(
      {
        host: HOST,
        path: ruta,
        method: "GET",
        agent,
        headers: { "user-agent": UA, accept: "*/*", "accept-encoding": "identity" },
        timeout: 15000,
      },
      (r) => {
        ttfb = performance.now() - t0;
        let bytes = 0;
        let cuerpo = "";
        const esHtml = r.statusCode === 200 && ruta === "/";
        r.on("data", (c) => {
          bytes += c.length;
          if (esHtml && cuerpo.length < 4096) cuerpo += c.toString("utf8");
        });
        r.on("end", () =>
          res({
            ruta,
            st: r.statusCode,
            ttfb,
            total: performance.now() - t0,
            bytes,
            pos: esHtml ? cuerpo.includes("<title>SSJ Barber") : null,
          }),
        );
      },
    );
    req.on("timeout", () => {
      res({ ruta, st: 0, ttfb: performance.now() - t0, total: performance.now() - t0, bytes: 0, err: "ETIMEDOUT" });
      req.destroy();
    });
    req.on("error", (e) =>
      res({ ruta, st: 0, ttfb: performance.now() - t0, total: performance.now() - t0, bytes: 0, err: e.code || e.message }),
    );
    req.end();
  });

const percentiles = (lista) => {
  const a = lista.slice().sort((x, y) => x - y);
  const q = (p) => (a.length ? Math.round(a[Math.min(a.length - 1, Math.floor(a.length * p))]) : 0);
  return { p50: q(0.5), p95: q(0.95), p99: q(0.99) };
};

/* Una ola: n usuarios arrancando en una rampa (no de golpe). Tiene techo de
   simultáneos para no abrir mil sockets desde una sola máquina: eso es un
   ataque de DDoS, no una prueba de carga. */
const ola = ({ n }) =>
  new Promise(async (resolve) => {
    const rampa = Math.min(45, 10 + n / 25) * 1000; // 50 -> 12 s ... 1000 -> 45 s
    const techo = Math.min(200, n); // sockets simultáneos máximos
    const resultados = [];
    let vivos = 0;
    let terminaron = 0;
    let enEspera = 0;

    const usuario = async () => {
      /* respeta el techo de simultáneos */
      while (vivos >= techo) {
        enEspera++;
        await new Promise((r) => setTimeout(r, 25));
      }
      vivos++;
      resultados.push(await pedir("/"));
      for (const a of ASSETS) {
        await new Promise((r) => setTimeout(r, 120 + Math.floor(Math.random() * 180)));
        resultados.push(await pedir(a));
      }
      vivos--;
      terminaron++;
    };

    for (let i = 0; i < n; i++) {
      /* se dispara y no se espera: los usuarios corren en paralelo */
      usuario().catch((e) =>
        resultados.push({ ruta: "?", st: 0, ttfb: 0, total: 0, bytes: 0, err: String(e) }),
      );
      if ((i + 1) % Math.max(1, Math.round(n / 10)) === 0 || i === n - 1) {
        console.log(
          `        arrancados ${i + 1}/${n} · en vuelo ${vivos} · terminaron ${terminaron} (${Math.round(((i + 1) / n) * 100)}%)`,
        );
      }
      await new Promise((r) => setTimeout(r, rampa / n));
    }
    /* espera a los rezagados (tope 120 s: nadie queda colgado para siempre) */
    const fin = Date.now() + 120000;
    while (terminaron < n && Date.now() < fin) await new Promise((r) => setTimeout(r, 500));

    const html = resultados.filter((r) => r.ruta === "/");
    const otros = resultados.filter((r) => r.ruta !== "/");
    const estados = {};
    resultados.forEach((r) => (estados[r.st] = (estados[r.st] || 0) + 1));
    const errores = {};
    resultados.filter((r) => r.err).forEach((r) => (errores[r.err] = (errores[r.err] || 0) + 1));
    const resumen = {
      n,
      requests: resultados.length,
      estados,
      errores,
      html: {
        ...percentiles(html.map((r) => Math.round(r.ttfb))),
        totalP50: percentiles(html.map((r) => Math.round(r.total))).p50,
        totalP95: percentiles(html.map((r) => Math.round(r.total))).p95,
        tituloOk: html.filter((r) => r.pos === true).length,
        tituloFalso: html.filter((r) => r.pos === false).length,
      },
      assets: percentiles(otros.map((r) => Math.round(r.ttfb))),
      bytes: resultados.reduce((a, r) => a + (r.bytes || 0), 0),
      enEspera,
    };
    resolve(resumen);
  });

const imprimir = (r) => {
  console.log(`  requests: ${r.requests} · estados: ${JSON.stringify(r.estados)}`);
  console.log(
    `  HTML  ttfb p50=${r.html.p50}ms p95=${r.html.p95}ms p99=${r.html.p99}ms · total p50=${r.html.totalP50}ms p95=${r.html.totalP95}ms`,
  );
  console.log(`  assets ttfb p50=${r.assets.p50}ms p95=${r.assets.p95}ms`);
  console.log(
    `  HTML con título SSJ: ${r.html.tituloOk}` +
      (r.html.tituloFalso ? ` · CON CUERPO RARO: ${r.html.tituloFalso}` : "") +
      ` · bajados ${(r.bytes / 1024 / 1024).toFixed(1)} MB`,
  );
  if (JSON.stringify(r.errores) !== "{}") console.log("  ERRORES de red: " + JSON.stringify(r.errores));
  if (r.enEspera > 0) console.log(`  usuarios que esperaron por el techo de sockets: ${r.enEspera}`);
};

(async () => {
  console.log(`Prueba piloto de carga — GET a https://${HOST}/ · User-Agent: ${UA}`);

  /* Pre-vuelo: dos GET normales para confirmar que el sitio está arriba. */
  const base = await pedir("/");
  ok(
    base.st === 200 && base.pos === true,
    "pre-vuelo: la landing responde 200 con el título SSJ",
    JSON.stringify({ st: base.st, ms: Math.round(base.ttfb) }),
  );
  const base2 = await pedir("/");
  ok(base2.st === 200, "pre-vuelo (2do): sigue respondiendo", JSON.stringify({ st: base2.st, ms: Math.round(base2.ttfb) }));

  const salidas = [];
  let aborto = null;
  for (const o of OLAS) {
    console.log(`\n=== OLA: ${o.n} usuarios ===`);
    console.log(
      `      (rampa de arranque: ${Math.min(45, 10 + o.n / 25).toFixed(0)} s · ${o.n * (1 + ASSETS.length)} requests esperados)`,
    );
    const t = Date.now();
    const r = await ola(o);
    console.log(`  duró ${Math.round((Date.now() - t) / 1000)} s`);
    imprimir(r);
    salidas.push(r);

    /* criterios de aborto: avisar y NO probar más en esta corrida */
    const con5xx = Object.entries(r.estados).some(([st, c]) => Number(st) >= 500 && c > 0);
    const con429 = r.estados[429] || 0;
    const pesóHtml = r.html.p95 > 4000;
    if (con5xx || con429 || pesóHtml) {
      aborto = con5xx
        ? "hubo respuestas 5xx"
        : con429
          ? `hubo ${con429} respuestas 429 (Vercel puso freno)`
          : "el p95 del HTML superó 4000 ms";
      process.exitCode = 1;
      console.log(`  >> ABORTO: ${aborto}. No se sube más en esta corrida.`);
      break;
    }
    /* respiro entre olas para no inflar la siguiente */
    console.log("  (respiro 10 s antes de la próxima ola)");
    await new Promise((r2) => setTimeout(r2, 10000));
  }

  fs.writeFileSync(
    path.join(__dirname, "..", "tmp_shots", "carga.json"),
    JSON.stringify(
      { fecha: new Date().toISOString(), host: HOST, pre: { st: base.st, ttfb: Math.round(base.ttfb) }, salidas, aborto },
      null,
      2,
    ),
  );
  console.log("\nDetalle en tmp_shots/carga.json");

  console.log(`\n${process.exitCode ? "HUBO PROBLEMAS" : "LA ESCALERA COMPLETÓ"} (${okn} checks de pre-vuelo)`);
})();
