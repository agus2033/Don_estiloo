/* Compara dos corridas de tests/perf.js.

   Sirve para no creer que una mejora "se siente más rápida": la comparación
   tiene que estar sobre números medidos, no sobre impresión.

   Uso:  node tests\perf.cmp.js antes.txt despues.txt
*/
const fs = require("fs");

/* OJO: en Windows, `node algo.js *> archivo.txt` con Windows PowerShell 5.1
   escribe el archivo en UTF-16LE, no en UTF-8. Leído como utf8, cada línea
   viene con un \0 entre medio y los patrones no encuentra nada: el cuadro
   salen todos "(sin dato)" sin que se note por qué. */
const leer = (f) => {
  const buf = fs.readFileSync(f);
  const texto =
    buf[0] === 0xff && buf[1] === 0xfe
      ? buf.toString("utf16le")
      : buf.toString("utf8");
  return texto.split(/\r?\n/);
};
const num = (l, k) => {
  const s = l.find((x) => x.includes(k));
  if (!s) return null;
  const m = s.match(/([\d.]+)\s*(ms|KB)?/);
  return m ? parseFloat(m[1]) : null;
};

const a = leer(process.argv[2]);
const b = leer(process.argv[3]);
/* Los rótulos pueden venir como "antes ahora" (un argumento) o como dos
   argumentos. Con un solo argumento, `etq[0]` daba la letra "a" en vez de la
   palabra, que es como se Caravaka la primera versión de este cuadro. */
const ETQ_A = process.argv[4] || "antes";
const ETQ_B = process.argv[5] || "despues";

console.log("métrica            " + ETQ_A.padEnd(12) + ETQ_B.padEnd(12) + "cambio");
console.log("-".repeat(56));

const METRICAS = [
  ["FCP ................", /FCP \.+ (\d+(?:\.\d+)?)/, "ms"],
  ["LCP ................", /LCP \.+ (\d+(?:\.\d+)?)/, "ms"],
  ["CLS ................", /CLS \.+ ([\d.]+)/, ""],
  ["load ...............", /load \.+ (\d+)/, "ms"],
  ["recursos ............", /recursos \.+ (\d+)/, ""],
  ["peso descomprimido ..", /peso descomprimido \.+ (\d+)/, "KB"],
];
const tomar = (l, re) => {
  for (const s of l) {
    const m = s.match(re);
    if (m) return parseFloat(m[1]);
  }
  return null;
};
for (const [etqeta, re] of METRICAS) {
  const x = tomar(a, re),
    y = tomar(b, re);
  if (x == null || y == null) {
    console.log(etqeta + " (sin dato)");
    continue;
  }
  const d = y - x;
  const pct = x ? ((d / x) * 100).toFixed(1) + "%" : "-";
  const flecha = d < 0 ? "mejora" : d > 0 ? "empeora" : "igual";
  console.log(etqeta.padEnd(22) + String(x).padEnd(12) + String(y).padEnd(12) + flecha + " " + pct);
}

/* Los terceros que aparecen o desaparecen. La línea de perf.js tiene la forma
   `     288 KB  200  http://...`: el ancho del número y el del código de
   estado están rellenados con espacios, así que el patrón tiene que tolerar
   cualquier cantidad. */
const terceros = (l) =>
  new Set(
    l
      .filter((s) => /https?:\/\//.test(s) && /\d+\s*KB/.test(s))
      .map((s) => (s.match(/https?:\/\/[^/]+/) || [""])[0]),
  );
const ta = terceros(a),
  tb = terceros(b);
const nuevos = [...tb].filter((x) => !ta.has(x));
const fuera = [...ta].filter((x) => !tb.has(x));

console.log("\nterceros que ya NO se piden en la carga:");
if (fuera.length) fuera.forEach((x) => console.log("  - " + x));
else console.log("  (ninguno)");
console.log("terceros NUEVOS en la carga:");
if (nuevos.length) nuevos.forEach((x) => console.log("  + " + x));
else console.log("  (ninguno)");