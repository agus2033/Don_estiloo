/* Tests de la lógica pura de horarios/servicios. Correr con:
   - Node (si está instalado):  node tests/logic.test.mjs
   - Navegador: abrí tests/run.html sirviendo la carpeta (ej. python -m http.server) */
import {
  TZ,
  ymd,
  hm,
  durP,
  nsv,
  blocks,
  freeSlots,
  blOk,
  inPeriodo,
  activo,
  ts,
} from "../src/logic.js";

let ok = 0,
  mal = 0;
const eq = (a, b, nombre) => {
  const j = JSON.stringify(a) === JSON.stringify(b);
  if (j) ok++;
  else {
    mal++;
    console.error("✗ " + nombre + ": esperado", b, "obtenido", a);
  }
};

// durP: duración redondeada a la grilla
eq(durP("30").m, 30, 'durP "30"');
eq(durP("30-45").m, 45, 'durP "30-45" -> 45');
eq(durP("entre 30 a 45 minutos").m, 45, "durP texto libre");
eq(durP("45", 30).m, 60, "durP grilla 30 bloquea 60 para 45");
eq(durP("45", 15).m, 45, "durP grilla 15 aprovecha 45");
eq(durP("abc"), null, "durP inválido");
eq(durP("600"), null, "durP muy largo");

// bloques consecutivos
eq(blocks("10:00", 60), ["10:00", "10:15", "10:30", "10:45"], "blocks 60");
eq(blocks("09:30", 30, 30), ["09:30"], "blocks grilla 30");

// ocupados bloquean
const OC = { "10:00": 1, "10:15": 1 };
eq(
  freeSlots({ a: 600, c: 660, al: 0, ah: 0 }, OC, 30, "2099-01-01", "2000-01-01", 0),
  ["10:30"],
  "freeSlots respeta ocupados (grilla 15)",
);
eq(
  freeSlots({ a: 600, c: 660, al: 0, ah: 0 }, OC, 30, "2099-01-01", "2000-01-01", 0, 30),
  ["10:30"],
  "freeSlots respeta ocupados (grilla 30)",
);

// blOk: el bloque tiene el largo y formato correctos
eq(
  blOk("2026-01-05", "10:00", 30, ["2026-01-05_1000", "2026-01-05_1015"]),
  true,
  "blOk correcto",
);
eq(blOk("2026-01-05", "10:00", 30, ["2026-01-05_1000"]), false, "blOk largo incorrecto");
eq(blOk("2026-01-05", "10:00", 30, ["10:00", "10:15"]), false, "blOk formato inválido");

// reglas de fechas e intervalo genérico
const hoy = ymd();
eq(inPeriodo(hoy, "hoy"), true, 'inPeriodo hoy');
eq(inPeriodo("1999-01-01", "hoy"), false, "inPeriodo distinto");
eq(activo({ st: "pend", d: "2999-01-01" }), true, "activo futuro");
eq(activo({ st: "hecho", d: "2999-01-01" }), false, "no activo si ya se hizo");
eq(ts({ toMillis: () => 1234 }), 1234, "ts toMillis");
eq(ts("5678"), 5678, "ts numérico");

console.log(`OK ${ok} · fallaron ${mal}`);
if (mal) throw new Error(mal + " tests fallaron");
