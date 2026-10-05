/* Lógica pura de horarios, duración y rangos. Sin DOM ni Firestore:
   se puede probar en Node (node tests/logic.test.mjs) o en el navegador
   (tests/run.html). */
export const TZ = "America/Argentina/Buenos_Aires";

/* Fecha local de AR como "AAAA-MM-DD" sin depender del reloj del dispositivo */
export const ymd = (d = new Date()) =>
  d.toLocaleDateString("en-CA", { timeZone: TZ });

export const hm = (m) =>
  String(Math.floor(m / 60)).padStart(2, "0") +
  ":" +
  String(m % 60).padStart(2, "0");

/* Servicios editables: "30", "30-45", "entre 30 a 45 minutos" -> se agenda
   el máximo redondeado a la grilla de 15 minutos */
export const durP = (v, g = 15) => {
  const n = String(v).match(/\d+/g);
  if (!n) return null;
  const a = n.map(Number),
    lo = Math.min(...a),
    hi = Math.max(...a);
  if (!hi || hi > 480) return null;
  return {
    m: Math.ceil(hi / g) * g,
    tx: lo === hi ? hi + " min" : lo + "-" + hi + " min",
  };
};

export const nsv = (x, g = 15) => {
  const d = String(x.d ?? x.m),
    p = durP(d, g) || { m: 30, tx: "30 min" };
  return {
    id:
      x.id ||
      x.n
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, ""),
    n: x.n,
    p: +x.p || 0,
    d,
    m: p.m,
    tx: p.tx,
  };
};

/* Bloques de 15 min que ocupa un turno empezando a la hora t por `dur` minutos */
export const blocks = (t, dur, g = 15) => {
  const [a, b] = t.split(":"),
    s = +a * 60 + +b,
    o = [];
  for (let m = s; m < s + dur; m += g) o.push(hm(m));
  return o;
};

/* Horarios libres de un día. nowMin: minutos desde medianoche (hora actual),
   solo aplica si el día elegido es hoy */
export function freeSlots(CF, OC, dur, dia, hoy, nowMin, g = 15) {
  const o = [];
  for (let m = CF.a; m + dur <= CF.c; m += g) {
    if (CF.al && m < CF.ah && m + dur > CF.al) continue;
    if (dia === hoy && m <= nowMin) continue;
    if (blocks(hm(m), dur, g).some((t) => OC[t])) continue;
    o.push(hm(m));
  }
  return o;
}

/* Un turno ocupa exactamente los bloques que dura su servicio */
export function blOk(d, t, dur, bl, g = 15) {
  const esps = blocks(t, dur, g);
  return (
    Array.isArray(bl) &&
    bl.length === esps.length &&
    bl.every((x, i) => x === d + "_" + esps[i].replace(":", ""))
  );
}

/* Inicio del período en milisegundos (para Timestamp.fromMillis) */
export function pStartMs(per, ahora = new Date()) {
  if (per === "all") return 0;
  const n = new Date(ahora);
  n.setHours(0, 0, 0, 0);
  if (per === "sem") n.setDate(n.getDate() - 6);
  else if (per === "mes") n.setDate(1);
  return n.getTime();
}

/* Filtro de fechas ("AAAA-MM-DD") según el período */
export function inPeriodo(d, per, hoy = ymd()) {
  if (per === "all") return true;
  if (per === "hoy") return d === hoy;
  if (per === "sem") {
    const a = new Date();
    a.setDate(a.getDate() - 6);
    const ka = ymd(a);
    return d >= ka && d <= hoy;
  }
  if (per === "mes") return d.startsWith(hoy.slice(0, 7));
  return true;
}

/* ¿Un turno cuenta como "activo"? (pendiente y hoy o futuro) */
export const activo = (t, hoy = ymd()) => t.st === "pend" && t.d >= hoy;

export const ts = (x) => (x && x.toMillis ? x.toMillis() : +x || 0);
