/* Muestrea el loader durante DOS ciclos completos y comprueba que NADA rota.

   El dueño pidió explícitamente "que no gire". Antes el loader tenía
   `ldGiro` (un aro dorado girando) y `ldLatido` (el disco scalando). Los dos
   se fueron, pero quedarse sin la garantía es justo el error que vuelve:
   cualquier `transform: rotate()` que se cuele después rompe lo que el
   dueño pidió sin que nada se note.

   El chequeo mira el `transform` REAL de cada capa en cada cuadro, no el
   texto del CSS: `transform: matrix(...)` con un ángulo distinto de cero es
   una rotación, y eso es lo que se lee acá.

   node tests\loader.giro.js
*/
const { chromium } = require("../.opencode/skills/playwright-skill/node_modules/playwright/index.js");

const DURACION_ANIM = 2000; /* tiene que coincidir con styles.css */
const CICLOS = 2;

(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 640, height: 520 } })).newPage();
  await p.route("**/firestore.googleapis.com/**", (r) => r.abort());
  await p.goto("http://127.0.0.1:8765/index.html", { waitUntil: "domcontentloaded" });
  await p.waitForSelector(".lgc", { timeout: 20000 });
  await p.evaluate(() => {
    document.getElementById("ld").className = "";
  });
  await p.waitForTimeout(300);

  /* Si un `transform` es una matriz con rotación, b y c (o los que
     correspondan) son distintos de cero y el ángulo es atan2(c, a). */
  const rotacionDe = (t) => {
    if (!t || t === "none") return 0;
    const m = t.match(/^matrix\(([^)]+)\)$/);
    if (!m) return null;
    const [a, bb, c, d] = m[1].split(",").map((x) => parseFloat(x));
    return (Math.atan2(c, a) * 180) / Math.PI;
  };

  const capas = [
    [".lgc", "el cuadro"],
    [".lgl", "el escudo de abajo"],
    [".lgc::before", "la capa que se revela"],
    [".lgc::after", "la línea de luz"],
    ["#ldt::before", "el puntito dorado"],
    ["#ld", "el loader entero"],
  ];

  const muestras = await p.evaluate(
    async ({ capas, ms }) => {
      const leer = (sel) => {
        const esPseudo = sel.includes("::");
        const el = esPseudo ? sel.split("::")[0] : sel;
        const nodo = document.querySelector(el);
        if (!nodo) return null;
        return getComputedStyle(nodo, esPseudo ? sel.split("::")[1] : null).transform;
      };
      const out = {};
      for (const [sel] of capas) out[sel] = [];
      const t0 = performance.now();
      while (performance.now() - t0 < ms) {
        for (const [sel] of capas) out[sel].push(leer(sel));
        await new Promise((r) => setTimeout(r, 40));
      }
      return out;
    },
    { capas, ms: DURACION_ANIM * CICLOS + 200 },
  );

  console.log(
    "loader muestreado durante " +
      (DURACION_ANIM * CICLOS) +
      " ms (" +
      CICLOS +
      " ciclos de " +
      DURACION_ANIM +
      " ms)\n",
  );
  console.log("capa                      cuadros  giros distintos  ángulo máximo");
  console.log("-".repeat(68));

  let fallos = 0;
  for (const [sel, etq] of capas) {
    const v = muestras[sel] || [];
    const ang = v.map(rotacionDe).filter((x) => x !== null);
    /* Se ignoran los cuadros donde la capa todavía no existe. */
    const distintos = [...new Set(ang.map((x) => Math.round(x * 100) / 100))];
    const max = ang.length ? Math.max(...ang.map(Math.abs)) : 0;
    const gira = distintos.length > 1 || max > 0.5;
    if (gira) fallos++;
    console.log(
      (etq + " (" + sel + ")").padEnd(26) +
        String(v.length).padStart(6) +
        String(distintos.length).padStart(16) +
        String(max.toFixed(2) + "°").padStart(16) +
        (gira ? "   <-- GIRA" : "   bien"),
    );
  }

  /* Además, ninguna regla del loader puede mencionar rotate. */
  const css = require("fs").readFileSync(
    require("path").join(__dirname, "..", "src", "styles.css"),
    "utf8",
  );
  const conRotate = (css.match(/[^{}]*\brotate\s*\([^)]*\)[^;]*/g) || []).filter(
    (r) => /lgc|lgl|ldt|#ld\b/.test(r),
  );
  console.log("");
  if (conRotate.length) {
    console.log("FALLA  hay reglas del loader con rotate():");
    conRotate.forEach((r) => console.log("         " + r.trim().slice(0, 90)));
    fallos++;
  } else {
    console.log("  OK    ninguna regla del loader menciona rotate()");
  }

  await b.close();
  console.log(fallos ? "\nFALLARON " + fallos : "\nTODO VERDE: el loader no gira en ningún punto");
  process.exit(fallos ? 1 : 0);
})();