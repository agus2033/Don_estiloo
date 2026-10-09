import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  signInWithPopup,
  GoogleAuthProvider,
  FacebookAuthProvider,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  collection,
  query,
  where,
  writeBatch,
  increment,
  deleteDoc,
  getDoc,
  getDocs,
  addDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

import {
  firebaseConfig,
  ADMIN_UID,
  NOMBRE,
  AUTOR,
  S as S0,
  PTS,
  PR,
  MC,
  MB,
  MP,
  WHATSAPP,
  INSTAGRAM,
  RESERVAR_URL,
  MAP_IFRAME,
  CLOUD_NAME,
  CLOUD_PRESET,
  CLOUD_FOLDER,
  EMAIL,
  RECAPTCHA_KEY,
  CANCEL_HS,
  LOGO,
  OWNER_UID,
  PD_DEF,
  GRID,
  MP_LINK,
} from "./config.js";

const app = initializeApp(firebaseConfig),
  auth = getAuth(app),
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  });
if (RECAPTCHA_KEY) {
  const ac =
    await import("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-check.js");
  ac.initializeAppCheck(app, {
    provider: new ac.ReCaptchaV3Provider(RECAPTCHA_KEY),
    isTokenAutoRefreshEnabled: true,
  });
}
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").then((reg) => {
    const avisar = (w) =>
      w.addEventListener("statechange", () => {
        if (w.state === "installed" && navigator.serviceWorker.controller)
          M({
            k: "q",
            h: "Hay una versión nueva",
            b: "Actualizá para usar la última versión de la app.",
            ok: "Actualizar",
            no: "Después",
            fn: () => w.postMessage("SKIP_WAITING"),
          });
      });
    if (reg.waiting && navigator.serviceWorker.controller) avisar(reg.waiting);
    reg.addEventListener("updatefound", () => avisar(reg.installing));
  });
  let recargando = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (recargando) return;
    recargando = true;
    location.reload();
  });
}
window.addEventListener("offline", () =>
  M({
    k: "w",
    h: "Sin conexión",
    b: "Mientras no tengas internet no vas a poder reservar ni cancelar. Podés seguir viendo tus datos.",
  }),
);
const $ = (s) => document.querySelector(s),
  esc = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
const A = (...a) => esc(JSON.stringify(a)); // argumentos de data-act (delegación de eventos)
const $$ = (n) => "$" + n.toLocaleString("es-AR");
// Tema claro/oscuro
(function () {
  const cur = localStorage.getItem("theme");
  if (cur) document.body.dataset.theme = cur;
  const btn = document.getElementById("thm");
  if (!btn) return;
  btn.textContent = cur === "light" ? "☾" : "☀︎";
  btn.addEventListener("click", () => {
    const next = document.body.dataset.theme === "light" ? "" : "light";
    document.body.dataset.theme = next;
    localStorage.setItem("theme", next);
    btn.textContent = next === "light" ? "☾" : "☀︎";
  });
})();
/* Fechas y horas siempre en hora de Argentina y con el reloj del servidor (no el del celular) */
const TZ = "America/Argentina/Buenos_Aires";
let skew = 0; // diferencia entre el reloj del servidor y el del dispositivo
const now = () => Date.now() + skew;
const ymd = (x = new Date(now())) => x.toLocaleDateString("en-CA", { timeZone: TZ });
const dAR = (k) => new Date(k + "T12:00:00-03:00"); // mediodía argentino de la fecha k
const addD = (k, n) => ymd(new Date(dAR(k).getTime() + n * 864e5));
const dow = (k) => dAR(k).getUTCDay(); // 0 = domingo, igual que getDay()
const mAR = (x = new Date(now())) => {
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(x);
  return (
    +p.find((a) => a.type === "hour").value * 60 +
    +p.find((a) => a.type === "minute").value
  );
};
const hhmm = (m) =>
  String((m / 60) | 0).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
fetch(location.href, { method: "HEAD", cache: "no-store" })
  .then((r) => {
    const d = Date.parse(r.headers.get("date"));
    if (d) skew = d - Date.now();
  })
  .catch(() => {});
/* Servicios editables: "30", "30-45", "entre 30 a 45 minutos" -> se agenda el máximo (múltiplo de la grilla, GRID en config.js) */
const durP = (v) => {
  const n = String(v).match(/\d+/g);
  if (!n) return null;
  const a = n.map(Number),
    lo = Math.min(...a),
    hi = Math.max(...a);
  if (!hi || hi > 480) return null;
  return {
    m: Math.ceil(hi / GRID) * GRID,
    tx: lo === hi ? hi + " min" : lo + "-" + hi + " min",
  };
};
const nsv = (x, i) => {
  const d = String(x.d ?? x.m),
    p = durP(d) || { m: 30, tx: "30 min" };
  return { id: x.id || "s" + i, n: x.n, p: +x.p || 0, d, m: p.m, tx: p.tx, img: x.img || "" };
};
let S = S0.map(nsv);
let PRv = PR.map((p) => ({ ...p })),
  PTSv = PTS,
  CHSv = CANCEL_HS;
const MAX_MIN = 180; // duración máxima de un servicio (las reglas revisan hasta 6 bloques)
const MAX_ACT = 2; // turnos activos por cliente (las reglas lo aplican con la colección "activos")
const sv = (t) => {
  const x = (t.sid && S.find((y) => y.id === t.sid)) || S[t.s];
  return {
    n: t.sn || (x && x.n) || "Servicio",
    p: t.sp ?? (x && x.p) ?? 0,
    tx: t.sm || (x && x.tx) || "",
  };
};
/* Finanzas: % para el dueño por barbero (se guarda en cada cobro) */
const FND = { pd: PD_DEF, bs: [] }; // sin barberos por defecto: los creás vos desde Finanzas
let FN = { ...FND, bs: FND.bs.map((b) => ({ ...b })) },
  VT = [],
  dbi = '',
  mv = null,
  sd = null,
  fe = null;
const bar = (id) => FN.bs.find((b) => b.id === id) || FN.bs[0] || null;
let SB = null,
  rd = 0,
  ps = [],
  EW = [],
  GA = [],
  CH = {},
  co = new Set(),
  gx = { c: "", m: "" },
  cfgTab = "hor";
/* Horario efectivo del barbero elegido: su propio horario si config/horario
   trae uno en .por[bid], si no el horario general */
const CFB = (bid) =>
  CF && CF.por && bid && CF.por[bid]
    ? { ...CFD, ...CF.por[bid] }
    : CF || { ...CFD };
const waNum = (p) => {
  const d = String(p || "")
    .replace(/\D/g, "")
    .replace(/^0+/, "");
  return !d ? "" : d.startsWith("54") ? d : "549" + d;
};
const bsnap = () => {
  if (!isOwner() && SB) return { bid: me.uid, bn: SB.n, pd: SB.pd };
  const b = bar(dbi);
  if (!b)
    return { bid: "", bn: "", pd: FN.pd }; // todavía no hay barberos cargados
  return { bid: b.id, bn: b.n, pd: b.pd };
};
const HA = () => [...H, ...VT];
const isOwner = () => me && me.uid === OWNER_UID;

/* ====== Loader, ventanas modales y contraseña segura ====== */
let bt,
  boot = 0,
  pnd = 0,
  ready = 0,
  mf = null,
  mr = null;
const PW_MIN = 6,
  COMUN = [
    "123456",
    "1234567",
    "12345678",
    "123456789",
    "password",
    "contraseña",
    "qwerty",
    "abc123",
    "111111",
    "admin123",
  ];
const LT = {
  entrar: "Ingresando…",
  registro: "Creando tu cuenta…",
  book: "Reservando tu turno…",
  cancel: "Cancelando turno…",
  done: "Guardando el cobro…",
  redeemGo: "Canjeando tu premio…",
  used: "Marcando como usado…",
  olvide: "Enviando email…",
  reenviar: "Enviando email…",
  recheck: "Verificando…",
  cfgGuardar: "Guardando horarios…",
  svGuardar: "Guardando servicios…",
  manSave: "Guardando la carga…",
  delV: "Eliminando…",
  feGuardar: "Guardando porcentajes…",
  mkBar: "Creando barbero…",
  quitBar: "Quitando barbero…",
  gAdd: "Guardando gasto…",
  espera: "Anotándote…",
};
const busy = (on, t, soft) => {
  const l = $("#ld");
  clearTimeout(bt);
  l.className = on ? (soft ? "soft" : "") : "off";
  if (on) {
    $("#ldt").textContent = t || "Cargando…";
    bt = setTimeout(() => busy(0), 15000); // red de seguridad
  }
};
bt = setTimeout(() => busy(0), 15000); // si algo falla, el loader inicial no queda para siempre
const wait = async (t, fn) => {
  if (!navigator.onLine)
    return M({
      k: "w",
      h: "Sin conexión",
      b: "Necesitás internet para esta acción. Probá de nuevo cuando vuelva la conexión.",
    });
  busy(1, t, 1);
  try {
    await fn();
  } finally {
    busy(0);
  }
};
const pwRules = (p) => {
  return [
    ["Mínimo " + PW_MIN + " caracteres", p.length >= PW_MIN],
    [
      "No ser una contraseña muy común",
      p !== "" && !COMUN.includes(p.toLowerCase()),
    ],
  ];
};
const pwHtml = (p, em) =>
  pwRules(p, em)
    .map((r) => `<li class="${r[1] ? "ok" : ""}">${r[0]}</li>`)
    .join("");
const pwLive = () => {
  const l = $("#pwl");
  if (l) l.innerHTML = pwHtml($("#pw").value, $("#em").value);
};
// k: w = advertencia, x = error, q = pregunta, ok = éxito
const M = (o) => {
  mf = o.fn || null;
  mr = document.activeElement;
  const k = o.k || "w",
    m = $("#mo");
  m.innerHTML = `<div class="mb" role="alertdialog" aria-modal="true" aria-labelledby="mh"><div class="pole"></div><div class="mi ${k}">${{ w: "!", x: "✕", q: "?", ok: "✓" }[k]}</div><h2 id="mh">${o.h}</h2><div class="mt">${o.b || ""}</div><div class="chips"><button class="main ${k === "x" ? "danger" : ""}" id="mok" data-act="Mok">${o.ok || "Entendido"}</button>${o.no ? `<button data-act="Mx">${o.no}</button>` : ""}</div></div>`;
  m.hidden = false;
  busy(0);
  $("#mok").focus();
};
const Mx = () => {
  $("#mo").hidden = true;
  mf = null;
  mr && mr.focus && mr.focus();
};
const Mok = () => {
  const f = mf;
  Mx();
  f && f();
};
let me = null,
  U = null,
  T = [],
  C = [],
  OC = {},
  us = [],
  ou = null,
  view = "home",
  mas = 0,
  rtInit = 0,
  msg = "",
  tab = "in",
  cf = -1,
  sel = { s: 0, d: "", t: "", b: "" },
  navOpen = 0,
  resStep = 1;
const isAdm = () => me && (me.uid === ADMIN_UID || !!SB); // barbero: dueño o cuenta de barbero
let H = [],
  CU = [],
  per = "mes";
const CFD = {
  a: 540,
  c: 1020,
  dias: [1, 2, 3, 4, 5, 6],
  libres: [],
  al: 0,
  ah: 0,
}; // horario por defecto
let UA = [],
  CF = { ...CFD },
  revStep = 1,
  revS = 0,
  revText = "",
  cd = null,
  cb = "", // barbero cuyo horario se edita en Ajustes ("" = general)
  agT = null, // formulario de turno agendado por el barbero
  ag = ymd(), // dashboard: cortes hechos, canjes usados, período
  BARS = []; // barberos publicados para que el cliente elija (config/barberos)
let CA = [],
  cx = null,
  cr = "",
  cn = "",
  dn = null,
  dm = "",
  dp = "Efectivo", // cancelados + formularios de cancelar / cobrar
  cliQ = "",
  cliN = 40, // clientes visibles (se amplía con "Ver más")
  cliSel = null, // cliente seleccionado en Clientes
  bf = "", // filtro de barbero en Agenda
  EV = null, // edición de carga manual (dashboard)
  GAL = [], // galería pública de trabajos
  TESTS = [], // reseñas públicas
  authOpen = 0; // 1 = mostrando login/registro (landing visible si 0)
const daysFor = (bid) => {
  const o = [];
  const h = ymd();
  for (let i = 0; o.length < 6 && i < 120; i++) {
    const k = addD(h, i);
    if (CFB(bid).dias.includes(dow(k)) && !CFB(bid).libres.includes(k)) o.push(k);
  }
  return o;
};
const days = () => daysFor(sel.b);
const fd = (d) =>
  dAR(d).toLocaleDateString("es-AR", {
    timeZone: TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
  });
const hm = (m) => hhmm(m);
const blocks = (t, dur) => {
  const [a, b] = t.split(":"),
    s = +a * 60 + +b,
    o = [];
  for (let m = s; m < s + dur; m += GRID) o.push(hm(m));
  return o;
};
function slots() {
  const dur = S[sel.s].m,
    hoy = ymd() === sel.d,
    c = CFB(sel.b),
    o = [];
  for (let m = c.a; m + dur <= c.c; m += GRID) {
    if (c.al && m < c.ah && m + dur > c.al) continue;
    if (hoy && m <= mAR()) continue;
    if (blocks(hm(m), dur).some((t) => OC[t])) continue;
    o.push(hm(m));
  }
  return o;
}
const ERR = {
  "auth/invalid-credential": "Email o contraseña incorrectos.",
  "auth/email-already-in-use": "Ese email ya tiene una cuenta.",
  "auth/weak-password": "La contraseña debe tener al menos 6 caracteres.",
  "auth/invalid-email": "El email no es válido.",
  "permission-denied": "No tenés permiso para esa acción.",
  "auth/network-request-failed":
    "Sin conexión. Revisá tu internet e intentá de nuevo.",
  "auth/too-many-requests":
    "Demasiados intentos. Esperá unos minutos e intentá de nuevo.",
  unavailable: "Sin conexión con el servidor. Intentá de nuevo en un momento.",
};
const err = (e) => {
  if (!me && e.code === "permission-denied") return;
  const w = [
    "auth/invalid-credential",
    "auth/email-already-in-use",
    "auth/invalid-email",
    "auth/weak-password",
  ].includes(e.code);
  M({
    k: w ? "w" : "x",
    h: w ? "Revisá los datos" : "No se pudo completar",
    b: esc(ERR[e.code] || "Ocurrió un error. Intentá de nuevo.") + ` — ${esc(e.message || "")}`.slice(0, 180),
  });
};
function unsub() {
  us.forEach((f) => f());
  us = [];
  ou && ou();
  ou = null;
  U = null;
  CA = [];
  cx = null;
  dn = null;
  T = [];
  C = [];
  OC = {};
  UA = [];
  sel = { s: 0, d: "", t: "", b: "" };
  cd = null;
  VT = [];
  sd = null;
  fe = null;
  mv = null;
  ps.forEach((f) => f());
  ps = [];
  SB = null;
  rd = 0;
  EW = [];
  GA = [];
  CH = {};
  co = new Set();
  H = [];
  CU = [];
  CA = [];
  BARS = [];
  navOpen = 0;
}
function occ() {
  ou && ou();
  OC = {};
  ou = onSnapshot(
    query(collection(db, "ocupados"), where("d", "==", sel.d), where("bid", "==", sel.b)),
    (s) => {
      OC = {};
      s.forEach((x) => {
        const o = x.data();
        OC[o.t] = 1;
        // documentos anteriores a la grilla variable ocupaban 30 min
        if (!o.g && GRID < 30) {
          const [h, m] = o.t.split(":");
          for (let k = GRID; k < 30; k += GRID) OC[hhmm(+h * 60 + +m + k)] = 1;
        }
      });
      R();
    },
    err,
  );
}
const pStart = () => {
  if (per === "all") return 0;
  const h = ymd(),
    k = per === "sem" ? addD(h, -6) : per === "mes" ? h.slice(0, 8) + "01" : h;
  return dAR(k).getTime() - 12 * 36e5 - 36e5 * 36; // medianoche argentina menos margen
};
function subP() {
  ps.forEach((f) => f());
  ps = [];
  H = [];
  CA = [];
  CU = [];
  VT = [];
  GA = [];
  if (!me) return;
  const g = (q, fn) =>
      ps.push(
        onSnapshot(
          q,
          (x) => {
            fn(x.docs.map((d) => ({ id: d.id, ...d.data() })));
            R();
          },
          err,
        ),
      ),
    st = pStart(),
    vt = (l) => (VT = l.map((x) => ({ ...x, man: 1 })));
  if (isOwner()) {
    g(
      query(collection(db, "turnos"), where("hechoEn", ">=", st)),
      (l) => (H = l),
    );
    g(
      query(collection(db, "turnos"), where("canEn", ">=", st)),
      (l) => (CA = l),
    );
    g(
      query(collection(db, "canjes"), where("usadoEn", ">=", st)),
      (l) => (CU = l),
    );
    g(query(collection(db, "ventas"), where("hechoEn", ">=", st)), vt);
    g(
      query(collection(db, "gastos"), where("hechoEn", ">=", st)),
      (l) => (GA = l),
    );
  } else if (SB) {
    g(
      query(collection(db, "turnos"), where("bid", "==", me.uid)),
      (l) => (H = l),
    );
    g(query(collection(db, "ventas"), where("bid", "==", me.uid)), vt);
  }
}
function setup(a) {
  const id = a.uid,
    ad = isAdm(),
    ls = (q, fn, e) =>
      us.push(
        onSnapshot(
          q,
          (x) => {
            fn(x);
            R();
          },
          e || err,
        ),
      ),
    mp = (x) => x.docs.map((d) => ({ id: d.id, ...d.data() }));
  rd = 1;
  view = ad ? (isOwner() ? "dash" : "bar") : "home";
  rtInit = 0;
  sel.d = days()[0] || "";
  ls(doc(db, "users", id), (x) => {
    U = x.exists() ? x.data() : null;
    // DB limpia/cuenta nueva: creá el perfil básico si no existe
    if (!x.exists() && me && !isAdm())
      setDoc(doc(db, "users", id), { nm: me.displayName || "Nuevo cliente", ph: "", pt: 20 }).catch(() => {});
  });
  ls(
    query(
      collection(db, "turnos"),
      ad ? where("st", "==", "pend") : where("uid", "==", id),
    ),
    (x) => (T = mp(x)),
  );
  ls(
    query(
      collection(db, "canjes"),
      ad ? where("used", "==", false) : where("uid", "==", id),
    ),
    (x) => (C = mp(x)),
  );
  ls(
    doc(db, "config", "horario"),
    (x) => {
      CF = x.exists() ? { ...CFD, ...x.data() } : { ...CFD };
      if (!days().includes(sel.d)) {
        sel.d = days()[0] || "";
        sel.t = "";
        occ();
      }
    },
    () => {},
  );
  ls(
    doc(db, "config", "servicios"),
    (x) => {
      S =
        x.exists() && x.data().l && x.data().l.length
          ? x.data().l.map(nsv)
          : S0.map(nsv);
      if (sel.s >= S.length) sel.s = 0;
      if (isOwner()) {
        const l = x.exists() && x.data().l && x.data().l.length ? x.data().l : null;
        if (!l || l.some((v, i) => v.m == null || !v.id || nsv(v, i).m !== v.m))
          setDoc(doc(db, "config", "servicios"), {
            l: (l || S0.map((v) => ({ n: v.n, p: v.p, d: String(v.m) }))).map(
              (v, i) => ({ ...v, id: v.id || "s" + i, m: nsv(v, i).m }),
            ),
          }).catch(() => {});
      }
    },
    () => {},
  );
  /* Una sola fuente de verdad: config.js manda y el dueño publica los valores para las reglas */
  ls(
    doc(db, "config", "reglas"),
    (x) => {
      const d = x.exists() ? x.data() : {};
      if (+d.pts > 0) PTSv = +d.pts;
      if (+d.cancelHs >= 0 && d.cancelHs !== undefined) CHSv = +d.cancelHs;
      if (Array.isArray(d.premios) && d.premios.length)
        PRv = d.premios.map((p) => ({ n: p.n, p: +p.p || 0 }));
      if (isOwner()) {
        const r = {
          costs: PRv.map((p) => p.p),
          pts: PTSv,
          cancelHs: CHSv,
          grid: GRID,
          premios: PRv.map((p) => ({ n: p.n, p: p.p })),
        };
        if (
          JSON.stringify(d.costs) !== JSON.stringify(r.costs) ||
          d.pts !== r.pts ||
          d.cancelHs !== r.cancelHs ||
          d.grid !== r.grid ||
          JSON.stringify(d.premios) !== JSON.stringify(r.premios)
        )
          setDoc(doc(db, "config", "reglas"), r).catch(() => {});
      }
    },
    () => {},
  );
  // Lista pública de barberos para que el cliente elija con quién cortarse
  ls(
    doc(db, "config", "barberos"),
    (x) => {
      BARS = x.exists() && x.data().l ? x.data().l : [];
      if (sel.b && !BARS.some((b) => b.id === sel.b)) {
        sel.b = "";
        sel.d = "";
        sel.t = "";
      }
      if (!sel.b && BARS.length) sel.b = BARS[0].id;
      if (!sel.d) sel.d = days()[0] || "";
      occ();
    },
    () => {},
  );
  if (ad) {
    ls(collection(db, "users"), (x) => (UA = mp(x)));
    ls(collection(db, "espera"), (x) => (EW = mp(x)));
    if (isOwner())
      ls(
        doc(db, "config", "finanzas"),
        (x) => {
          const d = x.exists() ? x.data() : {};
          FN = {
            pd: d.pd ?? FND.pd,
            bs: Array.isArray(d.bs) ? d.bs.filter((b) => b && b.id) : [],
          };
          if (!FN.bs.some((b) => b.id === dbi)) dbi = FN.bs.length ? FN.bs[0].id : '';
          // Publicá la lista de barberos para que los clientes puedan elegir
          const pub = FN.bs.map((b) => ({
            id: b.id,
            n: b.n,
            foto: (BARS.find((x) => x.id === b.id) || {}).foto || (b.uid === me.uid && SB && SB.foto) || "",
          }));
          setDoc(doc(db, "config", "barberos"), { l: pub }).catch(() => {});
        },
        () => {},
      );
    subP();
  } else
    ls(
      query(collection(db, "espera"), where("uid", "==", id)),
      (x) => (EW = mp(x)),
    );
  occ();
}
/* Datos públicos para la landing (sin login): servicios, barberos, horarios y galería */
onSnapshot(doc(db, "config", "servicios"), (x) => {
  if (!me) {
    S = x.exists() && x.data().l && x.data().l.length ? x.data().l.map(nsv) : S0.map(nsv);
    R();
  }
});
onSnapshot(doc(db, "config", "barberos"), (x) => {
  if (!me) {
    BARS = x.exists() && x.data().l ? x.data().l : [];
    R();
  }
});
onSnapshot(doc(db, "config", "horario"), (x) => {
  if (!me) {
    CF = x.exists() ? { ...CFD, ...x.data() } : { ...CFD };
    R();
  }
});
onSnapshot(collection(db, "galeria"), (x) => {
  GAL = x.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.ts || 0) - (a.ts || 0));
  if (!me) R();
});
onSnapshot(collection(db, "resenas"), (x) => {
  /* Sin tope: el carrusel de la landing rota entre todas. Si algún día
     llegan a ser muchas, el límite va acá (y se recorta la fila de
     puntitos del carrusel, que se pone larga). */
  TESTS = x.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => ((b.fecha && b.fecha.toMillis()) || 0) - ((a.fecha && a.fecha.toMillis()) || 0));
  if (!me) R();
});
onAuthStateChanged(auth, (a) => {
  ready = 1;
  unsub();
  me = a;
  view = "home";
  rtInit = 0;
  mas = 0;
  if (a) {
    let first = 1;
    // primero se averigua si la cuenta es de barbero; recién ahí se abren las demás consultas
    us.push(
      onSnapshot(
        doc(db, "staff", a.uid),
        (x) => {
          SB = x.exists() ? x.data() : null;
          if (first) {
            first = 0;
            setup(a);
          }
          R();
        },
        () => {
          if (first) {
            first = 0;
            setup(a);
          }
        },
      ),
    );
  }
  R();
});

/* ====== Rutas por hash: #/reservar, #/turnos, #/agenda… (el botón "atrás" funciona y se pueden compartir) ====== */
const RT = {
  home: "inicio",
  res: "reservar",
  tur: "turnos",
  bar: "agenda",
  cli: "clientes",
  bars: "barberos",
  dash: "dashboard",
  fin: "finanzas",
  cfg: "ajustes",
  priv: "privacidad",
  gal: "galeria",
  rev: "resena",
};
const rtOk = (v) =>
  !!me &&
  !!rd &&
  (isAdm()
    ? isOwner()
      ? ["bar", "cli", "bars", "dash", "fin", "cfg", "priv", "gal"]
      : ["bar", "cli", "fin", "priv", "gal"]
    : ["home", "res", "tur", "priv", "rev"]
  ).includes(v);
const rtView = () => Object.keys(RT).find((k) => "#/" + RT[k] === location.hash);
const rtPush = (v, rep) => {
  const h = "#/" + RT[v];
  if (location.hash !== h)
    history[rep ? "replaceState" : "pushState"](null, "", h);
};
function prep(v) {
  view = v;
  mas = 0;
  navOpen = 0;
  if (v === "res") {
    resStep = 1;
    /* Si venía del modal con el turno ya elegido, entrar no lo borra:
       vuelve al resumen con todo lo que había seleccionado. Si no, el
       asistente arranca limpio en el paso 1. */
    const seguir = WZ.resumir && !!sel.t;
    WZ.resumir = false;
    WZ.paso = seguir ? 6 : 1;
    WZ.turno = seguir ? WZ.turno : "";
    WZ.mes = ymd().slice(0, 7);
    if (!seguir) sel.t = "";
    wzOcc.unsubscribe();
    WZ.unsub = null;
  }
  if (v === "bar" && !isOwner()) bf = "";
  if (v === "cfg") {
    cb = "";
    const c = CFB("");
    cd = { a: c.a, c: c.c, dias: [...c.dias], libres: [...c.libres], al: c.al, ah: c.ah };
    sd = S.map((x) => ({ id: x.id, n: x.n, p: String(x.p), d: x.d, img: x.img || "" }));
  }
  if (v === "fin") fe = JSON.parse(JSON.stringify(FN));
  cf = -1;
  cx = null;
  dn = null;
  EV = null;
  cliSel = null;
}
window.addEventListener("hashchange", () => {
  if (!me && location.hash === RESERVAR_URL && !authOpen) {
    authOpen = 1;
    R();
  }
  const v = rtView();
  if (v && v !== view && rtOk(v)) {
    prep(v);
    R();
  }
});
function setupReveal() {
  requestAnimationFrame(() => {
    document.querySelectorAll(".reveal").forEach((el) => {
      const o = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            el.classList.add("visible");
            o.disconnect();
          }
        },
        { rootMargin: "0px 0px -60px 0px" },
      );
      o.observe(el);
    });
  });
}
function cerrarMenuLnd() {
  const m = document.getElementById("lndMenu"),
    h = document.getElementById("lndHamb");
  if (m) m.classList.remove("open");
  if (h) {
    h.classList.remove("open");
    h.setAttribute("aria-expanded", "false");
    h.setAttribute("aria-label", "Abrir menú");
  }
  document.body.classList.remove("no-scroll");
}
document.addEventListener("click", (e) => {
  if (e.target.closest("#lndMenu a")) cerrarMenuLnd();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") cerrarMenuLnd();
});
window.addEventListener("resize", () => {
  if (window.innerWidth > 900) cerrarMenuLnd();
});
const W = {
  rgPts(el) {
    PTSv = +String(el.value).replace(/\D/g, "") || 0;
  },
  rgCan(el) {
    CHSv = +String(el.value).replace(/\D/g, "") || 0;
  },
  rgPrn(i, el) {
    PRv[i].n = el.value.slice(0, 30);
  },
  rgPrp(i, el) {
    PRv[i].p = +String(el.value).replace(/\D/g, "") || 0;
  },
  async rgGuardar() {
    const r = {
      costs: PRv.map((p) => p.p),
      pts: PTSv,
      cancelHs: CHSv,
      grid: GRID,
      premios: PRv.map((p) => ({ n: p.n, p: p.p })),
    };
    await wait("Guardando reglas…", () =>
      setDoc(doc(db, "config", "reglas"), r),
    );
    M({ k: "ok", h: "Listo", b: "Reglas y premios actualizados." });
  },
  async verPrec() {
    M({ h: "Servicios y precios", b: `<div style="margin-top:6px">${lines()}</div>` });
  },
  toggleLndMenu() {
    const m = document.getElementById("lndMenu"),
      h = document.getElementById("lndHamb");
    if (!m || !h) return;
    const open = m.classList.toggle("open");
    h.classList.toggle("open", open);
    h.setAttribute("aria-expanded", open ? "true" : "false");
    h.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
    document.body.classList.toggle("no-scroll", open);
  },
  async enviarContacto() {
    if (W.enviarContacto.estado === "enviando") return;
    const nombre = ($("#cf-name") || {}).value || "",
      email = (($("#cf-email") || {}).value || "").trim(),
      mensaje = (($("#cf-msg") || {}).value || "").trim(),
      okE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
      btn = $("#cfSend"),
      st = $("#cf-status");
    if (!okE || !mensaje) {
      if (st) st.textContent = "Revisá el email y el mensaje.";
      return;
    }
    W.enviarContacto.estado = "enviando";
    if (btn) {
      btn.disabled = true;
      btn.textContent = "ENVIANDO…";
    }
    if (st) st.textContent = "Enviando…";
    try {
      await addDoc(collection(db, "mensajes"), {
        nombre: nombre.trim(),
        email,
        mensaje,
        fecha: serverTimestamp(),
      });
      if (st) st.textContent = "¡Mensaje enviado! Te respondemos pronto.";
      const n1 = $("#cf-name"), n2 = $("#cf-email"), n3 = $("#cf-msg");
      if (n1) n1.value = "";
      if (n2) n2.value = "";
      if (n3) n3.value = "";
    } catch (e) {
      console.error(e);
      if (st) st.textContent = "No se pudo enviar el mensaje. Probá de nuevo.";
    } finally {
      W.enviarContacto.estado = "";
      if (btn) {
        btn.disabled = false;
        btn.textContent = "ENVIAR MENSAJE";
      }
    }
  },
  ver(btn) {
    const inp = btn.closest(".clave").querySelector("input");
    const oculto = inp.type === "password";
    inp.type = oculto ? "text" : "password";
    btn.textContent = oculto ? "Ocultar" : "Ver";
  },
  async olvide() {
    const em = ($("#cem") || $("#em")).value.trim();
    if (!em)
      return M({
        k: "w",
        h: "Falta tu email",
        b: "Escribí tu email arriba y volvé a tocar “¿Olvidaste tu contraseña?”.",
      });
    try {
      await sendPasswordResetEmail(auth, em);
    } catch (e) {
      if (
        [
          "auth/invalid-email",
          "auth/network-request-failed",
          "auth/too-many-requests",
        ].includes(e.code)
      )
        return err(e);
    }
    M({
      k: "ok",
      h: "Revisá tu email",
      b: "Si ese email tiene una cuenta, te enviamos un link para crear una contraseña nueva. Mirá también en spam.",
    });
  },
  async reenviar() {
    try {
      await sendEmailVerification(me);
      M({
        k: "ok",
        h: "Email enviado",
        b: "Abrí el link que te mandamos y después tocá “Ya verifiqué”.",
      });
    } catch (e) {
      err(e);
    }
  },
  async recheck() {
    try {
      await me.reload();
      await me.getIdToken(true);
    } catch (e) {
      return err(e);
    }
    R();
    if (!me.emailVerified)
      M({
        k: "w",
        h: "Todavía no está verificado",
        b: "Abrí el link del email que te enviamos y volvé a probar.",
      });
  },
  setAg(d) {
    ag = d;
    R();
  },
  cfgTab(v) {
    cfgTab = v;
    R();
  },
  setBf(b) {
    bf = b;
    R();
  },
  cfgSet(k, v) {
    cd[k] = +v;
    R();
  },
  cfgDia(i) {
    const s = new Set(cd.dias);
    s.has(i) ? s.delete(i) : s.add(i);
    cd.dias = [...s].sort();
    R();
  },
  cfgLibre() {
    const v = $("#lb").value;
    if (!v || cd.libres.includes(v)) return;
    cd.libres = [...cd.libres, v].sort();
    R();
  },
  cfgQuitar(d) {
    cd.libres = cd.libres.filter((x) => x !== d);
    R();
  },
  cfgBar(id) {
    cb = id;
    const c = CFB(id);
    cd = { a: c.a, c: c.c, dias: [...c.dias], libres: [...c.libres], al: c.al, ah: c.ah };
    R();
  },
  cfgIgualGeneral() {
    if (!cb || !CF.por) return;
    delete CF.por[cb];
    if (!Object.keys(CF.por).length) delete CF.por;
    cb = "";
    const c = CFB("");
    cd = { a: c.a, c: c.c, dias: [...c.dias], libres: [...c.libres], al: c.al, ah: c.ah };
    R();
  },
  async cfgGuardar() {
    const c = cd;
    if (
      !c.dias.length ||
      c.a >= c.c ||
      (c.al && (c.al >= c.ah || c.al < c.a || c.ah > c.c))
    )
      return M({
        k: "w",
        h: "Revisá los horarios",
        b: "Elegí al menos un día, que la apertura sea antes del cierre y que la pausa quede dentro del horario.",
      });
    const nuevo = { a: c.a, c: c.c, dias: c.dias, libres: c.libres, al: c.al, ah: c.ah },
      docN =
        cb === ""
          ? { ...nuevo, ...(CF.por ? { por: CF.por } : {}) }
          : { ...CF, por: { ...(CF.por || {}), [cb]: nuevo } };
    try {
      await setDoc(doc(db, "config", "horario"), docN);
      msg =
        cb === ""
          ? "Horarios guardados. Ya se aplican a las reservas nuevas."
          : "Horario del barbero guardado. Sus clientes ya ven este horario.";
      R();
    } catch (e) {
      err(e);
    }
  },
  go(v) {
    W.goNow(v);
  },
  goNow(v) {
    prep(v);
    rtPush(v);
    R();
  },
  toggleMas() {
    mas = mas ? 0 : 1;
    navOpen = 0;
    R();
  },
  toggleNav() {
    navOpen = navOpen ? 0 : 1;
    mas = 0;
    R();
  },
  setTab(t) {
    tab = t;
    R();
  },
  goLogin(m) {
    authOpen = 1;
    if (m) tab = m;
    R();
  },
  backLanding() {
    authOpen = 0;
    R();
  },
  openPol() {
    const x = $("#po");
    x.innerHTML = polH();
    x.hidden = false;
  },
  cerrarPol() {
    $("#po").hidden = true;
  },
  pickFoto(cb) {
    const i = document.createElement("input");
    i.type = "file";
    i.accept = "image/*";
    i.onchange = () => i.files && i.files[0] && cb(i.files[0]);
    i.click();
  },
  async subirFoto(f, carpeta) {
    busy(1, "Subiendo imagen…");
    try {
      const toWebp = (file) =>
        new Promise((resolve) => {
          const img = new Image();
          img.src = URL.createObjectURL(file);
          img.onload = () => {
            const canvas = document.createElement("canvas"),
              ctx = canvas.getContext("2d");
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            ctx.drawImage(img, 0, 0);
            canvas.toBlob(
              (blob) => {
                if (!blob || blob.size >= file.size) resolve(file);
                else resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".webp"), { type: "image/webp" }));
              },
              "image/webp",
              0.85,
            );
          };
          img.onerror = () => resolve(file);
        });
      const newFile = await toWebp(f);
      const fd = new FormData();
      fd.append("file", newFile, newFile.name.replace(/\.[^.]+$/, ".webp"));
      fd.append("upload_preset", CLOUD_PRESET);
      fd.append("folder", CLOUD_FOLDER + "/" + carpeta);
      fd.append("public_id", newFile.name.replace(/\.[^.]+$/, "") + "-" + Date.now().toString(36));
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "No se pudo subir a Cloudinary");
      if (!json.secure_url) throw new Error("Cloudinary no devolvió URL destino");
      return { url: json.secure_url, ruta: json.public_id };
    } finally {
      busy(0);
    }
  },
  svImg(i) {
    W.pickFoto(async (f) => {
      try {
        const x = await W.subirFoto(f, "servicios/" + sd[i].id);
        sd[i].img = x.url;
        R();
        M({ k: "ok", h: "Imagen lista", b: "Tocá “Guardar servicios” para que se aplique." });
      } catch (e) { err(e); }
    });
  },
  galUp() {
    W.pickFoto(async (f) => {
      try {
        const x = await W.subirFoto(f, "galeria");
        await addDoc(collection(db, "galeria"), {
          url: x.url,
          ruta: x.ruta,
          ts: Date.now(),
          por: me ? me.uid : "",
        });
        R();
      } catch (e) { err(e); }
    });
  },
  async galDel(id, ruta) {
    try {
      await deleteDoc(doc(db, "galeria", id));
      R();
    } catch (e) {
      err(e);
    }
  },
  revStars(n) {
    revS = n;
    if (revStep === 1) revStep = 2;
    R();
  },
  revBack() {
    if (revStep > 1) revStep--;
    R();
  },
  revNext() {
    if (revStep === 1 && !revS)
      return M({ k: "w", h: "Elegí una calificación", b: "Tocá alguna estrella para continuar." });
    if (revStep === 2) {
      revText = ($("#revText") || {}).value || "";
      if (!revText.trim()) return M({ k: "w", h: "Escribí algo", b: "Contanos en una frase cómo te fue." });
    }
    revStep++;
    R();
  },
  async revSend() {
    try {
      await addDoc(collection(db, "resenas"), {
        uid: me.uid,
        nm: U && U.nm ? U.nm : "Cliente",
        foto: U && U.foto ? U.foto : "",
        estrellas: revS || 5,
        texto: revText || "Muy conforme con la atención.",
        fecha: serverTimestamp(),
      });
      msg = "¡Gracias! Ya registramos tu reseña.";
      revStep = 1;
      revS = 0;
      revText = "";
      R();
      W.goNow("home");
    } catch (e) {
      err(e);
    }
  },
  async fotoTomar() {
    W.pickFoto(async (f) => {
      try {
        const x = await W.subirFoto(f, "perfil");
        const u = { foto: x.url };
        await setDoc(doc(db, "users", me.uid), u, { merge: true });
        if (SB) {
          SB.foto = x.url;
          await setDoc(doc(db, "staff", me.uid), { foto: x.url }, { merge: true }).catch(() => {});
        }
        const l = BARS.map((b) => ({ ...b, foto: b.id === me.uid ? x.url : b.foto || "" }));
        if (l.length) await setDoc(doc(db, "config", "barberos"), { l }, { merge: true }).catch(() => {});
        R();
      } catch (e) { err(e); }
    });
  },
  async fotoBarbero(bid) {
    W.pickFoto(async (f) => {
      try {
        const x = await W.subirFoto(f, "perfil");
        const l = BARS.map((b) => ({ ...b, foto: b.id === bid ? x.url : b.foto || "" }));
        if (l.length) await setDoc(doc(db, "config", "barberos"), { l }, { merge: true });
        R();
      } catch (e) { err(e); }
    });
  },
  async entrar() {
    if (!$("#ie").value.trim() || !$("#ip").value)
      return M({
        k: "w",
        h: "Faltan datos",
        b: "Ingresá tu email y tu contraseña para continuar.",
      });
    /* Loader: el signIn tarda y sin esto el botón queda sin efecto
       visible, que se lee como "quedó colgado". */
    busy(1, "Entrando…", 1);
    try {
      await signInWithEmailAndPassword(
        auth,
        $("#ie").value.trim(),
        $("#ip").value,
      );
      /* Si veníamos de la reserva, el router abre el asistente solo. */
      busy(0);
      R();
    } catch (e) {
      busy(0);
      err(e);
      R();
    }
  },
  async red(p) {
    try {
      const prov =
        p === "google"
          ? new GoogleAuthProvider()
          : new FacebookAuthProvider();
      const r = await signInWithPopup(auth, prov);
      const s = await getDoc(doc(db, "users", r.user.uid));
      if (!s.exists())
        await setDoc(doc(db, "users", r.user.uid), {
          nm: r.user.displayName || "Nuevo cliente",
          ph: "",
          pt: 20,
        });
    } catch (e) {
      err(e);
    }
  },
  async registro() {
    if (!$("#spol") || !$("#spol").checked)
      return M({
        k: "w",
        h: "Aceptá las políticas",
        b: "Para crear tu cuenta tenés que aceptar las Políticas y privacidad y las condiciones del servicio.",
      });
    const nm = $("#nm").value.trim(),
      ph = $("#ph").value.replace(/\D/g, "");
    if (nm.length < 2 || nm.length > 40 || ph.length < 8 || ph.length > 15) {
      return M({
        k: "w",
        h: "Revisá tus datos",
        b: "Completá tu nombre (2 a 40 letras) y un teléfono válido, solo con números.",
      });
    }
    if ($("#pw").value !== $("#pw2").value)
      return M({
        k: "w",
        h: "Las contraseñas no coinciden",
        b: "Escribí la misma contraseña en los dos campos.",
      });
    const bad = pwRules($("#pw").value, $("#em").value).some((r) => !r[1]);
    if (bad)
      return M({
        k: "w",
        h: "Contraseña poco segura",
        b: `<p>Tu contraseña tiene que cumplir todo esto:</p><ul class="pwl">${pwHtml($("#pw").value, $("#em").value)}</ul>`,
        ok: "Corregir",
      });
    try {
      const c = await createUserWithEmailAndPassword(
        auth,
        $("#em").value.trim(),
        $("#pw").value,
      );
      await setDoc(doc(db, "users", c.user.uid), {
        nm: nm,
        ph: ph,
        pt: 20,
      });
      sendEmailVerification(c.user).catch(() => {});
      M({
        k: "ok",
        h: "¡Cuenta creada!",
        b: "Te enviamos un email para verificar tu cuenta. Lo necesitás para reservar turnos.",
      });
    } catch (e) {
      if (e.code === "auth/email-already-in-use")
        return M({
          k: "w",
          h: "Ese email ya tiene cuenta",
          b: "Ingresá con ese email. Si no recordás la contraseña, usá “¿Olvidaste tu contraseña?”.",
          ok: "Ir a ingresar",
          no: "Cerrar",
          fn: () => W.setTab("in"),
        });
      if (auth.currentUser) await auth.currentUser.delete().catch(() => {}); // evita cuentas sin perfil si falló a mitad de camino
      err(e);
    }
  },
  salir() {
    M({
      k: "q",
      h: "¿Cerrar sesión?",
      b: "Vas a tener que ingresar de nuevo para ver tus turnos.",
      ok: "Cerrar sesión",
      no: "Quedarme",
      fn: () => {
        authOpen = 0;
        signOut(auth);
      },
    });
  },
  setDay(d) {
    sel.d = d;
    sel.t = "";
    occ();
    R();
  },
  resNext() {
    if (resStep === 3 && !sel.t) return;
    resStep = Math.min(4, resStep + 1);
    R();
  },
  resBack() {
    resStep = Math.max(1, resStep - 1);
    R();
  },
  setBar(id) {
    sel.b = id;
    sel.d = days()[0] || "";
    sel.t = "";
    occ();
    R();
  },
  repeat() {
    const ult = [...T]
      .filter((t) => t.st === "hecho")
      .sort((a, b) => (b.d + b.t).localeCompare(a.d + a.t))[0];
    if (!ult) return;
    const i = S.findIndex(
      (x) => (ult.sid && x.id === ult.sid) || x.n === (ult.sn || sv(ult).n),
    );
    if (i >= 0) sel.s = i;
    if (ult.bid && BARS.some((b) => b.id === ult.bid)) sel.b = ult.bid;
    sel.d = days()[0] || "";
    sel.t = "";
    occ();
    W.goNow("res");
    resStep = 3;
    R();
  },
  async askBook() {
    if (!isAdm() && !me.emailVerified) {
      busy(1, "Verificando…", 1);
      try {
        await me.reload();
        if (me.emailVerified) {
          await me.getIdToken(true);
          R();
        }
      } catch (_) {}
      busy(0);
    }
    if (!isAdm() && !me.emailVerified)
      return M({
        k: "w",
        h: "Verificá tu email",
        b: "Para reservar tenés que verificar tu email. Revisá tu bandeja de entrada (y spam).",
        ok: "Reenviar email",
        no: "Cerrar",
        fn: () => W.reenviar(),
      });
    if (!sel.b)
      return M({
        k: "w",
        h: "Elegí un barbero",
        b: "Primero elegí con qué barbero querés atenderte.",
      });
    const s = S[sel.s];
    M({
      k: "q",
      h: "¿Confirmar tu turno?",
      b: `<div class="line"><span>Barbero</span><b>${esc((BARS.find((b) => b.id === sel.b) || {}).n || "—")}</b></div><div class="line"><span>Servicio</span><b>${esc(s.n)}</b></div><div class="line"><span>Día</span><b>${fd(sel.d)}</b></div><div class="line"><span>Hora</span><b>${sel.t}</b></div><div class="line"><span>Duración</span><b>${esc(s.tx)}</b></div><div class="line"><span>Precio</span><b>${$$(s.p)}</b></div>${MP_LINK ? `<p style="margin:12px 0 0"><small>¿Querés señar este turno? <a href="${esc(MP_LINK)}" target="_blank" rel="noopener">Pagar por Mercado Pago</a></small></p>` : ""}`,
      ok: "Confirmar turno",
      no: "Volver",
      fn: () => W.book(),
    });
  },
  async book() {
    if (!sel.b) return;
    const dur = S[sel.s].m,
      bl = blocks(sel.t, dur);
    if (bl.some((t) => OC[t])) {
      sel.t = "";
      R();
      return M({
        k: "w",
        h: "Horario ocupado",
        b: "Alguien reservó ese horario recién. Elegí otro.",
      });
    }
    const act = T.filter((x) => x.uid === me.uid && x.st === "pend"),
      usados = new Set(act.map((x) => x.sl).filter(Boolean)),
      sl = [1, 2].find((n) => !usados.has(n));
    if (act.length >= MAX_ACT || !sl)
      return M({
        k: "w",
        h: "Ya tenés " + MAX_ACT + " turnos activos",
        b: "Para reservar otro, primero cancelá uno o esperá a que se complete.",
      });
    const b = writeBatch(db),
      r = doc(collection(db, "turnos")),
      ids = bl.map((t) => sel.b + "_" + sel.d + "_" + t.replace(":", ""));
    // Limpia si quedó un cupo ocupado de antes (evita create-on-existing)
    await deleteDoc(doc(db, "activos", me.uid + "_" + sl)).catch(() => {});
    b.set(doc(db, "activos", me.uid + "_" + sl), { uid: me.uid, tu: r.id });
    b.set(r, {
      uid: me.uid,
      nm: U.nm,
      s: sel.s,
      sid: S[sel.s].id,
      d: sel.d,
      t: sel.t,
      st: "pend",
      bid: sel.b,
      bl: ids,
      sn: S[sel.s].n,
      sp: S[sel.s].p,
      sm: S[sel.s].tx,
      sl,
    });
    ids.forEach((x, i) =>
      b.set(doc(db, "ocupados", x), { uid: me.uid, d: sel.d, t: bl[i], tu: r.id, g: GRID, bid: sel.b }),
    );
    try {
      await b.commit();
      const wa =
        WHATSAPP &&
        "https://wa.me/" +
          WHATSAPP +
          "?text=" +
          encodeURIComponent(
            `Hola, soy ${U.nm}. Reservé ${S[sel.s].n} para el ${fd(sel.d)} a las ${sel.t}.`,
          );
      sel.t = "";
      W.goNow("tur");
      M({
        k: "ok",
        h: "Turno reservado",
        b:
          "Te esperamos. Sumás " + PTSv + " puntos cuando se complete el corte." + (MP_LINK ? ` También podés <a href="${esc(MP_LINK)}" target="_blank" rel="noopener">dejar la seña por Mercado Pago</a>.` : ""),
        ok: wa ? '<span class="ic-wa" aria-hidden="true" style="width:22px;height:22px;vertical-align:-5px;margin-right:6px"></span>Avisar por WhatsApp' : "Listo",
        no: wa ? "Cerrar" : "",
        fn: wa ? () => open(wa, "_blank", "noopener") : null,
      });
    } catch (e) {
      if (e.code === "permission-denied") {
        // razones más probables: email no verificado, horario ocupado, falta 2 activos
        let detalle = "Ese horario se acaba de ocupar o ya tenés 2 turnos activos.";
        if (me && !me.emailVerified) {
          detalle = "Tu email todavía no está verificado. Revisá tu correo y tocá “Ya verifiqué”.";
        }
        sel.t = "";
        R();
        return M({ k: "w", h: "No se pudo reservar", b: detalle });
      }
      err(e);
    }
  },
  askCancel(id) {
    const t0 = T.find((x) => x.id === id);
    if (
      t0 &&
      !isAdm() &&
      new Date(t0.d + "T" + t0.t + ":00-03:00") - now() < CHSv * 36e5
    ) {
      const wa =
        WHATSAPP &&
        "https://wa.me/" +
          WHATSAPP +
          "?text=" +
          encodeURIComponent(
            `Hola, soy ${U.nm}. Necesito cancelar mi turno del ${fd(t0.d)} a las ${t0.t}.`,
          );
      return M({
        k: "w",
        h: "Ya no podés cancelar online",
        b: `Faltan menos de ${CHSv} horas para tu turno. Escribile a la barbería para avisar.`,
        ok: wa ? '<span class="ic-wa" aria-hidden="true" style="width:22px;height:22px;vertical-align:-5px;margin-right:6px"></span>Escribir por WhatsApp' : "Entendido",
        no: wa ? "Cerrar" : "",
        fn: wa ? () => open(wa, "_blank", "noopener") : null,
      });
    }
    cx = id;
    cr = "";
    cn = "";
    dn = null;
    R();
  },
  askDone(id) {
    const t = T.find((x) => x.id === id);
    if (!t) return;
    dn = id;
    dm = String(sv(t).p);
    dp = MP[0];
    if (!FN.bs.some((x) => x.id === dbi)) dbi = FN.bs.length ? FN.bs[0].id : "";
    cx = null;
    R();
  },
  closeX() {
    cx = null;
    dn = null;
    R();
  },
  setMot(i) {
    cr = (isAdm() ? MB : MC)[i];
    R();
  },
  setCn(el) {
    cn = el.value.slice(0, 80);
  },
  setDm(el) {
    dm = el.value.replace(/\D/g, "").slice(0, 8);
    el.value = dm;
  },
  setDmv(n) {
    dm = String(n);
    R();
  },
  setDp(p) {
    dp = p;
    R();
  },
  async cancel(id) {
    const t = T.find((x) => x.id === id);
    if (!t) return;
    if (!cr) {
      return M({
        k: "w",
        h: "Falta el motivo",
        b: "Elegí un motivo para cancelar el turno.",
      });
    }
    const adm = isAdm(),
      mot = (cr === "Otro motivo" && cn.trim() ? cn.trim() : cr).slice(0, 80),
      b = writeBatch(db);
    b.update(doc(db, "turnos", id), {
      st: "cancel",
      mot: mot,
      por: adm ? "bar" : "cli",
      canEn: now(),
    });
    t.bl.forEach((x) => b.delete(doc(db, "ocupados", x)));
    if (t.sl) b.delete(doc(db, "activos", t.uid + "_" + t.sl));
    // Contador de ausencias: solo con el motivo "No se presentó"
    if (adm && mot === "No se presentó") {
      const un = UA.find((u) => u.id === t.uid);
      b.set(doc(db, "users", t.uid), { ns: ((un && un.ns) || 0) + 1 }, { merge: true });
    }
    try {
      await b.commit();
      cx = null;
      msg = "Turno cancelado. El horario quedó libre.";
      R();
    } catch (e) {
      err(e);
    }
  },
  async done(id) {
    const t = T.find((x) => x.id === id);
    if (!t || !isAdm()) return;
    if (dm === "") {
      return M({
        k: "w",
        h: "Falta el monto",
        b: "Ingresá el monto cobrado (0 si fue gratis).",
      });
    }
    const monto = parseInt(dm, 10),
      b = writeBatch(db);
    b.update(doc(db, "turnos", id), {
      st: "hecho",
      precio: monto,
      lista: sv(t).p,
      serv: sv(t).n,
      medio: dp,
      ...bsnap(),
      hechoEn: now(),
    });
    // Clientes al mostrador (uid "caja_...") no tienen users/{uid}: ahí no se suman puntos
    if (!t.uid.startsWith("caja_")) {
      try {
        const userSnap = await getDoc(doc(db, "users", t.uid));
        if (userSnap.exists())
          b.update(doc(db, "users", t.uid), { pt: increment(PTSv), uc: t.id });
      } catch (_) {}
    }
    if (t.sl) b.delete(doc(db, "activos", t.uid + "_" + t.sl));
    try {
      await b.commit();
      dn = null;
      msg =
        "Corte cobrado " +
        $$(monto) +
        " (" +
        dp +
        ") · +" +
        PTSv +
        " puntos para " +
        t.nm;
      R();
    } catch (e) {
      err(e);
    }
  },
  redeem(i) {
    const p = PRv[i];
    if (U.pt < p.p) return;
    M({
      k: "q",
      h: "¿Canjear este premio?",
      b: `<p><b>${esc(p.n)}</b> por ${p.p} puntos.<br>Te van a quedar ${U.pt - p.p} puntos.</p>`,
      ok: "Canjear",
      no: "Volver",
      fn: () => W.redeemGo(i),
    });
  },
  async redeemGo(i) {
    const p = PRv[i];
    if (U.pt < p.p) return;
    const b = writeBatch(db),
      c = crypto
        .getRandomValues(new Uint32Array(1))[0]
        .toString(36)
        .slice(0, 5)
        .toUpperCase();
    b.set(doc(collection(db, "canjes")), {
      uid: me.uid,
      nm: U.nm,
      pr: p.n,
      cost: p.p,
      c: c,
      used: false,
    });
    b.update(doc(db, "users", me.uid), { pt: increment(-p.p) });
    try {
      await b.commit();
      cf = -1;
      msg = "Canje listo ✅ Mostrale el código al barbero.";
      R();
    } catch (e) {
      err(e);
    }
  },
  setPer(p) {
    per = p;
    subP();
    R();
  },
  exportar() {
    const f = rng(),
      L = HA()
        .filter((t) => f(t.d))
        .sort((a, b) => (a.d + a.t).localeCompare(b.d + b.t)),
      q = (v) => {
        let s = String(v);
        if (/^[=+\-@]/.test(s)) s = "'" + s; // evita fórmulas maliciosas en Excel
        return '"' + s.replace(/"/g, '""') + '"';
      },
      csv =
        "Fecha,Hora,Cliente,Servicio,Precio cobrado,Precio de lista,Medio de pago,Barbero,% dueño,Origen\n" +
        L.map((t) =>
          [
            t.d,
            t.t,
            t.nm,
            t.serv || sv(t).n,
            t.precio || 0,
            t.lista ?? "",
            t.medio || "",
            t.bn || "",
            t.pd ?? "",
            t.man ? "Manual" : "Turno",
          ]
            .map(q)
            .join(","),
        ).join("\n"),
      a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }),
    );
    a.download = "cortes-" + per + ".csv";
    a.click();
    URL.revokeObjectURL(a.href);
  },
  askUsed(id) {
    M({
      k: "q",
      h: "¿Marcar como usado?",
      b: "Esta acción no se puede deshacer. El código deja de ser válido.",
      ok: "Marcar usado",
      no: "Volver",
      fn: () => W.used(id),
    });
  },
  async used(id) {
    try {
      await writeBatch(db)
        .update(doc(db, "canjes", id), { used: true, usadoEn: now() })
        .commit();
    } catch (e) {
      err(e);
    }
  },
};
Object.assign(W, {
  /* servicios */
  svIn(i, k, el) {
    sd[i][k] =
      k === "p"
        ? el.value.replace(/\D/g, "").slice(0, 7)
        : el.value.slice(0, 40);
    if (k === "p") el.value = sd[i].p;
  },
  svAdd() {
    if (sd.length >= 12) return;
    sd.push({ id: "s" + Date.now().toString(36), n: "", p: "", d: "30", img: "" });
    R();
  },
  svDel(i) {
    if (sd.length < 2) return;
    sd.splice(i, 1);
    R();
  },
  async svGuardar() {
    if (sd.some((x) => durP(x.d) && durP(x.d).m > MAX_MIN))
      return M({
        k: "w",
        h: "Servicio demasiado largo",
        b: "La duración máxima por servicio es de " + MAX_MIN / 60 + " horas.",
      });
    if (!sd.length || sd.some((x) => !x.n.trim() || x.p === "" || !durP(x.d)))
      return M({
        k: "w",
        h: "Revisá los servicios",
        b: "Cada servicio necesita nombre, precio y una duración con números. Ejemplos: <b>30</b>, <b>30-45</b> o <b>entre 30 a 45 minutos</b>.",
      });
    try {
      await setDoc(doc(db, "config", "servicios"), {
        l: sd.map((x) => ({
          id: x.id,
          n: x.n.trim(),
          p: +x.p,
          d: String(x.d).trim(),
          m: durP(x.d).m,
          ...(x.img ? { img: x.img } : {}),
        })),
      });
      msg =
        "Servicios guardados. Los turnos ya reservados mantienen su precio original.";
      R();
    } catch (e) {
      err(e);
    }
  },
  /* carga manual (cobro sin turno) */
  openMan() {
    mv = { s: 0, c: "", nm: "", u: "", m: String(S[0].p), p: MP[0] };
    if (!FN.bs.some((x) => x.id === dbi)) dbi = FN.bs.length ? FN.bs[0].id : "";
    R();
  },
  agOpen() {
    agT = { u: "", nm: "", s: 0, d: days()[0] || "", t: "" };
    if (SB && !isOwner()) dbi = me.uid;
    R();
  },
  agIn(k, v) {
    agT[k] = v;
    if (k === "s" || k === "d" || k === "u") agT.t = "";
    R();
  },
  agCh(k, v) {
    agT[k] = k === "s" ? +v : v;
    if (k === "s" || k === "d" || k === "u") agT.t = "";
    R();
  },
  agInEl(k, el) {
    agT[k] = el.value.slice(0, 40);
  },
  agBar(id) {
    dbi = id;
    agT.t = "";
    R();
  },
  agX() {
    agT = null;
    R();
  },
  async agSave() {
    if (agT.u === "" && agT.nm.trim().length < 2)
      return M({
        k: "w",
        h: "Falta el cliente",
        b: "Elegí un cliente de la lista o escribí su nombre.",
      });
    if (!agT.d || !agT.t)
      return M({
        k: "w",
        h: "Falta el horario",
        b: "Elegí día y hora para el turno.",
      });
    const propio = SB ? me.uid : dbi,
      cl = agT.u ? UA.find((u) => u.id === agT.u) : null;
    if (!propio)
      return M({
        k: "w",
        h: "Elegí un barbero",
        b: "Primero creá o elegí un barbero desde Finanzas.",
      });
    const uid = cl ? cl.id : "caja_" + Math.random().toString(36).slice(2, 10),
      nm = cl ? cl.nm : agT.nm.trim(),
      dur = S[agT.s].m,
      bl = blocks(agT.t, dur),
      dat = agT.d;
    // no pisar otro turno del mismo barbero
    const tomados = new Set();
    T.filter((t) => t.st === "pend" && t.d === dat && t.bid === propio).forEach(
      (t) => blocks(t.t, t.bl.length * GRID).forEach((x) => tomados.add(x)),
    );
    if (bl.some((x) => tomados.has(x)))
      return M({
        k: "w",
        h: "Horario ocupado",
        b: "Ese barbero ya tiene un turno en ese horario.",
      });
    const act = T.filter((x) => x.uid === uid && x.st === "pend"),
      usados = new Set(act.map((x) => x.sl).filter(Boolean)),
      sl = [1, 2].find((n) => !usados.has(n));
    if (act.length >= 2 || !sl)
      return M({
        k: "w",
        h: "Límite de turnos",
        b: "Este cliente ya tiene 2 turnos activos. Cancelá uno primero.",
      });
    const b = writeBatch(db),
      r = doc(collection(db, "turnos")),
      ids = bl.map((t) => propio + "_" + dat + "_" + t.replace(":", ""));
    // Limpia si quedó un cupo ocupado de algo anterior (evita create-on-existing)
    await deleteDoc(doc(db, "activos", uid + "_" + sl)).catch(() => {});
    b.set(doc(db, "activos", uid + "_" + sl), { uid, tu: r.id });
    b.set(r, {
      uid,
      nm,
      s: agT.s,
      sid: S[agT.s].id,
      d: dat,
      t: agT.t,
      st: "pend",
      bid: propio,
      bl: ids,
      sn: S[agT.s].n,
      sp: S[agT.s].p,
      sm: S[agT.s].tx,
      sl,
    });
    ids.forEach((x, i) =>
      b.set(doc(db, "ocupados", x), { uid, d: dat, t: bl[i], tu: r.id, g: GRID, bid: propio }),
    );
    try {
      await b.commit();
      agT = null;
      msg = "Turno agendado para " + nm + " el " + fd(dat) + ".";
      R();
    } catch (e) {
      console.error("agSave", e, JSON.stringify({uid, nm, propio, dat, t: agT.t, sl, ids}));
      err(Object.assign(e, { code: e.code, message: e.message }));
    }
  },
  manX() {
    mv = null;
    R();
  },
  manS(i) {
    mv.s = i;
    if (i >= 0) mv.m = String(S[i].p);
    R();
  },
  manP(p) {
    mv.p = p;
    R();
  },
  setDbi(id) {
    dbi = id;
    R();
  },
  manIn(k, el) {
    if (k === "m") {
      mv.m = el.value.replace(/\D/g, "").slice(0, 8);
      el.value = mv.m;
    } else mv[k] = el.value.slice(0, 40);
  },
  manU(v) {
    mv.u = v;
    R();
  },
  async manSave() {
    if (mv.m === "")
      return M({ k: "w", h: "Falta el monto", b: "Ingresá el monto cobrado." });
    const b = bsnap(),
      x = mv.s >= 0 ? S[mv.s] : null,
      monto = parseInt(mv.m, 10),
      cl = mv.u ? UA.find((u) => u.id === mv.u) : null,
      bt = writeBatch(db),
      vr = doc(collection(db, "ventas"));
    bt.set(vr, {
      nm: cl ? cl.nm : mv.nm.trim() || "Cliente sin turno",
      ...(cl ? { uid: cl.id } : {}),
      serv: x ? x.n : mv.c.trim() || "Venta manual",
      precio: monto,
      lista: x ? x.p : monto,
      medio: mv.p,
      d: ymd(),
      t: hhmm(mAR()),
      ...b,
      hechoEn: now(),
    });
    if (cl)
      bt.update(doc(db, "users", cl.id), {
        pt: increment(PTSv),
        uc: "v:" + vr.id,
      });
    try {
      await bt.commit();
      mv = null;
      msg =
        "Carga registrada: " +
        $$(monto) +
        " (" +
        b.bn +
        ")" +
        (cl ? " · +" + PTSv + " puntos para " + cl.nm : "") +
        ".";
      R();
    } catch (e) {
      err(e);
    }
  },
  askDelV(id) {
    M({
      k: "q",
      h: "¿Eliminar esta carga?",
      b: "Se borra del registro y de las ganancias. No se puede deshacer.",
      ok: "Eliminar",
      no: "Volver",
      fn: () => W.delV(id),
    });
  },
  askEditV(id) {
    const t = VT.find((x) => x.id === id);
    if (!t) return;
    EV = {
      id,
      nm: t.nm || "",
      serv: t.serv || "",
      precio: String(t.precio ?? ""),
      medio: t.medio || MP[0],
    };
    R();
  },
  evIn(k, el) {
    EV[k] =
      k === "precio"
        ? el.value.replace(/\D/g, "").slice(0, 8)
        : el.value.slice(0, 40);
    if (k === "precio") el.value = EV[k];
  },
  evMedio(p) {
    EV.medio = p;
    R();
  },
  evX() {
    EV = null;
    R();
  },
  async saveEditV() {
    if (EV.precio === "")
      return M({
        k: "w",
        h: "Falta el monto",
        b: "Ingresá el monto cobrado.",
      });
    try {
      await updateDoc(doc(db, "ventas", EV.id), {
        nm: EV.nm.trim() || "Cliente",
        serv: EV.serv.trim() || "Carga manual",
        precio: parseInt(EV.precio, 10),
        medio: EV.medio,
      });
      msg = "Carga editada.";
      EV = null;
      R();
    } catch (e) {
      err(e);
    }
  },
  async delV(id) {
    try {
      await deleteDoc(doc(db, "ventas", id));
    } catch (e) {
      err(e);
    }
  },
  /* finanzas */
  feIn(i, k, el) {
    if (k === "pd") {
      fe.bs[i].pd = el.value.replace(/\D/g, "").slice(0, 3);
      el.value = fe.bs[i].pd;
    } else fe.bs[i].n = el.value.slice(0, 30);
  },
  feDef(el) {
    fe.pd = el.value.replace(/\D/g, "").slice(0, 3);
    el.value = fe.pd;
  },
  feAdd() {
    if (fe.bs.length >= 10) return;
    fe.bs.push({ id: "b" + Date.now().toString(36), n: "", pd: String(fe.pd) });
    R();
  },
  feDel(i) {
    if (fe.bs.length > 1) {
      fe.bs.splice(i, 1);
      R();
    }
  },
  async feGuardar() {
    if (!isOwner()) return;
    const ok = (v) => v !== "" && +v >= 0 && +v <= 100;
    if (
      !ok(String(fe.pd)) ||
      fe.bs.some((b) => !b.n.trim() || !ok(String(b.pd)))
    )
      return M({
        k: "w",
        h: "Revisá los datos",
        b: "Cada barbero necesita nombre y un porcentaje entre 0 y 100.",
      });
    const bs = fe.bs.map((b) => ({
        id: b.id,
        ...(b.uid ? { uid: b.uid } : {}),
        n: b.n.trim(),
        pd: +b.pd,
      })),
      bt = writeBatch(db);
    bt.set(doc(db, "config", "finanzas"), { pd: +fe.pd, bs });
    bs.filter((b) => b.uid).forEach((b) =>
      bt.set(doc(db, "staff", b.uid), { n: b.n, pd: b.pd }),
    );
    FN.bs
      .filter((b) => b.uid && !bs.some((x) => x.uid === b.uid))
      .forEach((b) => bt.delete(doc(db, "staff", b.uid)));
    try {
      await bt.commit();
      msg =
        "Porcentajes guardados. Se aplican a los cobros nuevos; los anteriores no cambian.";
      R();
    } catch (e) {
      err(e);
    }
  },
  addBar() {
    if (!isOwner()) return;
    M({
      h: "Agregar barbero",
      b: `<div style="text-align:left;margin-top:6px"><small style="display:block">Nombre</small><input id="nbN" maxlength="30" placeholder="Nombre del barbero" style="width:100%"><small style="display:block;margin-top:10px">% del dueño</small><input id="nbP" inputmode="numeric" maxlength="3" value="${esc(String(FN.pd))}" style="width:100%"><small style="display:block;margin-top:6px">El barbero se queda con el resto. Para que un barbero entre con su cuenta, usá “Hacer barbero” en Clientes.</small></div>`,
      ok: "Agregar",
      no: "Cancelar",
      fn: async () => {
        const n = String(($("#nbN") || {}).value || "")
            .slice(0, 30)
            .trim(),
          pd = String(($("#nbP") || {}).value || "")
            .replace(/\D/g, "")
            .slice(0, 3);
        if (!n || pd === "" || +pd < 0 || +pd > 100)
          return M({
            k: "w",
            h: "Revisá los datos",
            b: "Necesitás un nombre y un porcentaje entre 0 y 100.",
          });
        if (FN.bs.length >= 10)
          return M({ k: "w", h: "Máximo 10 barberos", b: "Quitá alguno antes de agregar otro." });
        const bs = [...FN.bs, { id: "b" + Date.now().toString(36), n, pd: +pd }].map(
          (x) => ({
            id: x.id,
            ...(x.uid ? { uid: x.uid } : {}),
            n: x.n.trim(),
            pd: +x.pd,
          }),
        );
        const b = writeBatch(db);
        b.set(doc(db, "config", "finanzas"), { pd: FN.pd, bs });
        bs.filter((x) => x.uid).forEach((x) =>
          b.set(doc(db, "staff", x.uid), { n: x.n, pd: x.pd }),
        );
        try {
          await b.commit();
          msg = "Barbero agregado.";
          R();
        } catch (e) {
          err(e);
        }
      },
    });
    setTimeout(() => {
      const el = $("#nbN");
      if (el) el.focus();
    }, 60);
  },
  askBar(uid) {
    const u = UA.find((x) => x.id === uid);
    if (!u) return;
    M({
      k: "q",
      h: "¿Hacer barbero a " + esc(u.nm) + "?",
      b:
        "Va a poder entrar con su cuenta, ver la agenda, cobrar y cargar ventas, y ver solo sus propias ganancias. No ve finanzas ni ajustes. Su porcentaje es " +
        (100 - FN.pd) +
        "% para él (editable en Finanzas).",
      ok: "Hacer barbero",
      no: "Volver",
      fn: () => W.mkBar(uid),
    });
  },
  async mkBar(uid) {
    const u = UA.find((x) => x.id === uid);
    if (!u || FN.bs.some((b) => b.uid === uid)) return;
    const bs = [...FN.bs, { id: uid, uid, n: u.nm, pd: FN.pd }],
      bt = writeBatch(db);
    bt.set(doc(db, "config", "finanzas"), { pd: FN.pd, bs });
    bt.set(doc(db, "staff", uid), { n: u.nm, pd: FN.pd });
    bt.update(doc(db, "users", uid), { rol: "barbero" });
    try {
      await bt.commit();
      msg = u.nm + " ahora es barbero.";
      R();
    } catch (e) {
      err(e);
    }
  },
  askQuitBar(uid) {
    const b = FN.bs.find((x) => x.uid === uid);
    if (!b) return;
    M({
      k: "q",
      h: "¿Quitar a " + esc(b.n) + " como barbero?",
      b: "Vuelve a ser un cliente común y pierde el acceso de barbero. Sus cobros anteriores se conservan.",
      ok: "Quitar",
      no: "Volver",
      fn: () => W.quitBar(uid),
    });
  },
  async quitBar(uid) {
    const bt = writeBatch(db);
    bt.set(doc(db, "config", "finanzas"), {
      pd: FN.pd,
      bs: FN.bs.filter((b) => b.uid !== uid),
    });
    bt.delete(doc(db, "staff", uid));
    bt.update(doc(db, "users", uid), { rol: "" });
    try {
      await bt.commit();
      msg = "Listo, volvió a la lista de clientes.";
      R();
    } catch (e) {
      err(e);
    }
  },
  /* gastos */
  gIn(k, el) {
    if (k === "m") {
      gx.m = el.value.replace(/\D/g, "").slice(0, 8);
      el.value = gx.m;
    } else gx.c = el.value.slice(0, 40);
  },
  async gAdd() {
    if (!gx.c.trim() || gx.m === "")
      return M({
        k: "w",
        h: "Faltan datos",
        b: "Escribí el concepto y el monto del gasto.",
      });
    try {
      await setDoc(doc(collection(db, "gastos")), {
        c: gx.c.trim(),
        m: +gx.m,
        d: ymd(),
        hechoEn: now(),
      });
      gx = { c: "", m: "" };
      R();
    } catch (e) {
      err(e);
    }
  },
  askGDel(id) {
    M({
      k: "q",
      h: "¿Eliminar este gasto?",
      b: "No se puede deshacer.",
      ok: "Eliminar",
      no: "Volver",
      fn: () => deleteDoc(doc(db, "gastos", id)).catch(err),
    });
  },
  /* lista de espera */
  async espera() {
    if (!sel.b)
      return M({
        k: "w",
        h: "Esperá un momento",
        b: "Todavía no se cargaron los barberos. Probá de nuevo en unos segundos.",
      });
    try {
      await setDoc(doc(db, "espera", me.uid + "_" + sel.b + "_" + sel.d), {
        uid: me.uid,
        nm: U.nm,
        ph: U.ph,
        d: sel.d,
        bid: sel.b,
        en: now(),
      });
      msg =
        "Listo, te anotamos. Si se libera un horario ese día, te avisan por WhatsApp.";
      R();
    } catch (e) {
      err(e);
    }
  },
  quitarE(id) {
    deleteDoc(doc(db, "espera", id)).catch(err);
  },
  borrarAsk() {
    M({
      k: "q",
      h: "¿Borrar tus datos?",
      b: "Se borran tu nombre, teléfono y puntos, se cancelan tus turnos pendientes y perdés el acceso a esta cuenta. No se puede deshacer.",
      ok: "Sí, borrar",
      no: "Conservar",
      fn: () => wait("Borrando tus datos…", () => W.borrarCuenta()),
    });
  },
  async borrarCuenta() {
    if (!me) return;
    // cancelar turnos pendientes y liberar horarios
    const pend = T.filter((t) => t.st === "pend");
    const b = writeBatch(db);
    pend.forEach((t) => {
      b.update(doc(db, "turnos", t.id), { st: "cancel", mot: "Cuenta eliminada", por: "cli", canEn: now() });
      t.bl.forEach((x) => b.delete(doc(db, "ocupados", x)));
      if (t.sl) b.delete(doc(db, "activos", t.uid + "_" + t.sl));
    });
    // anonimizar turnos ya cobrados
    T.filter((t) => t.st !== "pend").forEach((t) =>
      b.update(doc(db, "turnos", t.id), { nm: "Cliente eliminado" }),
    );
    // espera, canjes, activos, perfil
    const esp = await getDocs(query(collection(db, "espera"), where("uid", "==", me.uid)));
    esp.forEach((d) => b.delete(doc(db, "espera", d.id)));
    const cjs = await getDocs(query(collection(db, "canjes"), where("uid", "==", me.uid)));
    cjs.forEach((d) => b.delete(doc(db, "canjes", d.id)));
    [1, 2].forEach((n) => b.delete(doc(db, "activos", me.uid + "_" + n)));
    b.set(doc(db, "users", me.uid), { nm: "", ph: "", pt: 0, borrado: true }, { merge: true });
    try {
      await b.commit();
      await me.delete().catch(() => {});
      await signOut(auth).catch(() => {});
    } catch (e) {
      err(e);
    }
  },
  /* historial del cliente (se carga recién al abrirlo: ahorra lecturas) */
  cliQIn(el) {
    cliQ = el.value;
    cliN = 40;
    R();
  },
  cliMas() {
    cliN += 40;
    R();
  },
  async cliSel(id) {
    if (cliSel === id) {
      cliSel = null;
      return R();
    }
    cliSel = id;
    if (!isOwner()) return R();
    if (CH[id] === undefined) {
      CH[id] = null;
      try {
        const x = await getDocs(
          query(
            collection(db, "turnos"),
            where("uid", "==", id),
            where("st", "==", "hecho"),
          ),
        );
        CH[id] = x.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.d + b.t).localeCompare(a.d + a.t));
      } catch (e) {
        CH[id] = [];
      }
    }
    R();
  },
  async cliT(id, open) {
    if (!open) return void co.delete(id);
    co.add(id);
    if (CH[id] !== undefined || !isOwner()) return;
    CH[id] = null;
    try {
      const x = await getDocs(
        query(
          collection(db, "turnos"),
          where("uid", "==", id),
          where("st", "==", "hecho"),
        ),
      );
      CH[id] = x.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.d + b.t).localeCompare(a.d + a.t));
    } catch (e) {
      CH[id] = [];
      err(e);
    }
    R();
  },
});
Object.keys(LT).forEach((k) => {
  const f = W[k];
  W[k] = (...a) => wait(LT[k], () => f(...a));
});
/* ====== Delegación de eventos (sin onclick= en el HTML: permite activar una CSP estricta) ====== */
const ACT = Object.assign({}, W, {
  Mok,
  Mx,
  pwLive,
  selS(i) {
    sel.s = i;
    sel.t = "";
    R();
  },
  selT(t) {
    sel.t = t;
    R();
  },
});
const dArgs = (el) =>
  JSON.parse(el.dataset.args || "[]").map((a) =>
    a === "@el" ? el : a === "@v" ? el.value : a === "@o" ? el.open : a,
  );
const dRun = (el, k) => {
  const f = ACT[el.dataset[k]];
  if (f) f.apply(W, dArgs(el));
};
document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-act]");
  if (e.target.closest("#med,#mebadge")) {
    navOpen = navOpen ? 0 : 1;
    R();
    return;
  }
  if (mas && !e.target.closest('[data-act="toggleMas"],.masm')) {
    mas = 0;
    if (!el) R();
  }
  if (navOpen && !e.target.closest('[data-act="toggleNav"],#nmenu,#mebadge')) {
    navOpen = 0;
    if (!el) R();
  }
  if (
    cliSel &&
    !e.target.closest('#cliDet,[data-act="cliSel"],[data-act="cliMas"]')
  ) {
    cliSel = null;
    if (!el) R();
  }
  if (el) dRun(el, "act");
});
document.addEventListener("input", (e) => {
  const el = e.target.closest("[data-in]");
  if (el) dRun(el, "in");
});
document.addEventListener("change", (e) => {
  const el = e.target.closest("[data-ch]");
  if (el) dRun(el, "ch");
});
document.addEventListener(
  "toggle",
  (e) => {
    const el = e.target.closest && e.target.closest("[data-tg]");
    if (el) dRun(el, "tg");
  },
  true,
);
$("#mo").addEventListener("click", (e) => {
  if (e.target === e.currentTarget) Mx();
});

const ST = {
  pend: "Pendiente",
  hecho: "Completado",
  cancel: "Cancelado",
};
const lines = () =>
  S.map(
    (s) =>
      `<div class="line"><span><b>${esc(s.n)}</b> <small>${esc(s.tx)}</small></span><span class="price">${$$(s.p)}</span></div>`,
  ).join("");
function loginH() {
  const up = tab === "up",
    rec = tab === "rec";
  return `<div class="franja" aria-hidden="true"></div>
<main class="shell">
  <section class="hero" aria-label="Presentación">
    <div class="poste" aria-hidden="true"><span class="tapa sup"></span><div class="cuerpo"><div class="rayas"></div></div><span class="tapa inf"></span></div>
    <div class="hero__texto">
      <h2>Tu turno, sin esperas.</h2>
      <p>Reservá en menos de un minuto y sumá puntos en cada visita.</p>
      <ul class="ventajas">
        <li><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12l5 5 9-10"/></svg>Elegí barbero, servicio y horario</li>
        <li><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12l5 5 9-10"/></svg>Sumá ${PTSv} puntos por cada corte</li>
        <li><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12l5 5 9-10"/></svg>Canjeá descuentos y un corte gratis</li>
      </ul>
      <h3 class="lab" style="margin-top:22px">Servicios y precios</h3>
      <div class="pricing">${lines()}</div>
    </div>
  </section>
  <section class="panel">
    <div class="marca">
      <span class="sello" aria-hidden="true"><svg width="20" height="40" viewBox="0 0 28 56"><clipPath id="mc"><rect x="5" y="9" width="18" height="38"/></clipPath><rect x="2" y="0" width="24" height="9" rx="3" fill="#C9A24B"/><rect x="2" y="47" width="24" height="9" rx="3" fill="#C9A24B"/><rect x="5" y="9" width="18" height="38" fill="#F5F0E6"/><g clip-path="url(#mc)"><path d="M5 14L23 8V16L5 22Z" fill="#B3382C"/><path d="M5 26L23 20V28L5 34Z" fill="#2E5FA8"/><path d="M5 38L23 32V40L5 46Z" fill="#B3382C"/></g></svg></span>
      <b>${esc(NOMBRE)}</b>
    </div>
    <div class="tarjeta">
      <div class="vista" id="ingresar" ${up || rec ? "hidden" : ""}>
        <h1>INGRESÁ</h1>
        <p class="sub">Reservá tu turno y sumá puntos en cada visita</p>
        <div class="campo"><label for="ie">Email</label><input class="entrada" id="ie" name="email" type="email" autocomplete="email" inputmode="email" placeholder="sofia@correo.com"></div>
        <div class="campo"><label for="ip">Contraseña</label><div class="clave"><input class="entrada" id="ip" name="password" type="password" autocomplete="current-password" placeholder="Tu contraseña"><button type="button" class="ver" data-act="ver" data-args="${A("@el")}">Ver</button></div></div>
        <p style="text-align:right;margin:-4px 0 12px"><button type="button" class="enlace" style="min-height:0;padding:0;font-size:14px;color:var(--brass)" data-act="setTab" data-args="${A("rec")}">Olvidé mi contraseña</button></p>
        <button class="boton primario" data-act="entrar">Ingresar</button>
        <div class="o">o continuá con</div>
        <div style="display:flex;gap:10px">
          <button class="boton secundario" type="button" data-act="red" data-args="${A("google")}" style="flex:1;display:flex;align-items:center;justify-content:center;gap:8px"><img src="assets/google.png" alt="" width="20" height="20">Google</button>
          <button class="boton secundario" type="button" data-act="red" data-args="${A("facebook")}" style="flex:1;display:flex;align-items:center;justify-content:center;gap:8px"><img src="assets/facebook.png" alt="" width="20" height="20">Facebook</button>
        </div>
      </div>
      <div class="vista" id="registro" ${up ? "" : "hidden"}>
        <h1>CREÁ TU CUENTA</h1>
        <p class="sub">Reservá tu turno en menos de un minuto · Al registrarte te cargamos 20 puntos</p>
        <div class="campo"><label for="nm">Nombre</label><input class="entrada" id="nm" name="nombre" type="text" autocomplete="name" placeholder="Tu nombre"></div>
        <div class="campo"><label for="ph">Teléfono</label><input class="entrada" id="ph" name="telefono" type="tel" autocomplete="tel" inputmode="tel" placeholder="Tu teléfono"></div>
        <div class="campo"><label for="em">Email</label><input class="entrada" id="em" name="email" type="email" autocomplete="email" inputmode="email" placeholder="sofia@correo.com"></div>
        <div class="campo"><label for="pw">Contraseña</label><div class="clave"><input class="entrada" id="pw" name="password" type="password" autocomplete="new-password" placeholder="Tu contraseña" data-in="pwLive"><button type="button" class="ver" data-act="ver" data-args="${A("@el")}">Ver</button></div><ul class="reglas" id="pwl">${pwHtml("", "")}</ul></div>
        <div class="campo"><label for="pw2">Repetí la contraseña</label><div class="clave"><input class="entrada" id="pw2" name="password2" type="password" autocomplete="new-password" placeholder="Repetí la contraseña"><button type="button" class="ver" data-act="ver" data-args="${A("@el")}">Ver</button></div></div>
        <div class="campo"><label style="display:flex;gap:10px;align-items:flex-start;cursor:pointer;line-height:1.4"><input type="checkbox" id="spol" style="width:auto;margin-top:4px;flex:0 0 auto"><span>Leí y acepto las <a href="#" data-act="openPol" style="color:var(--brass);font-weight:700;text-decoration:underline">políticas y privacidad</a> y las condiciones del servicio.</span></label></div>
        <button class="boton primario" data-act="registro">Crear cuenta</button>
        <div class="o" style="margin-top:14px">o continuá con</div>
        <div style="display:flex;gap:10px">
          <button class="boton secundario" type="button" data-act="red" data-args="${A("google")}" style="flex:1;display:flex;align-items:center;justify-content:center;gap:8px"><img src="assets/google.png" alt="" width="20" height="20">Google</button>
          <button class="boton secundario" type="button" data-act="red" data-args="${A("facebook")}" style="flex:1;display:flex;align-items:center;justify-content:center;gap:8px"><img src="assets/facebook.png" alt="" width="20" height="20">Facebook</button>
        </div>
      </div>
      <div class="vista" id="recuperar" ${rec ? "" : "hidden"}>
        <h1>Recuperá tu acceso</h1>
        <p class="sub">Te mandamos un enlace para elegir una contraseña nueva</p>
        <div class="campo"><label for="cem">Email</label><input class="entrada" id="cem" name="email" type="email" autocomplete="email" inputmode="email" placeholder="sofia@correo.com"></div>
        <button class="boton primario" data-act="olvide">Enviar enlace</button>
      </div>
    </div>
    <div style="text-align:center;margin-top:18px">
      ${up
        ? `<p>¿Ya tenés cuenta? <button type="button" data-act="setTab" data-args="${A("in")}" style="min-height:0;padding:0;background:none;border:0;color:var(--brass);font-weight:700;cursor:pointer;text-decoration:underline">Ingresá</button></p>`
        : rec
          ? `<p><button type="button" data-act="setTab" data-args="${A("in")}" style="min-height:0;padding:0;background:none;border:0;color:var(--brass);font-weight:700;cursor:pointer;text-decoration:underline">Volver a ingresar</button></p>`
          : `<p>¿Primera vez? <button type="button" data-act="setTab" data-args="${A("up")}" style="min-height:0;padding:0;background:none;border:0;color:var(--brass);font-weight:700;cursor:pointer;text-decoration:underline">Creá tu cuenta</button></p>`}
      <p style="margin-top:8px"><small>Al ingresar aceptás las <a href="#" data-act="openPol" style="color:var(--brass);text-decoration:underline">políticas y privacidad</a> de ${esc(NOMBRE)}.</small></p>
    </div>
    <div class="pie verPrecMobile"><button class="enlace" type="button" data-act="verPrec">Ver servicios y precios</button></div>
  </section>
</main>`;
}
function authH() {
  return authOpen ? loginH() : landingH();
}
/* =====================================================================
   LANDING v2 — mockup aprobado. Solo presentación: no toca la lógica de
   login, registro, Firebase/Firestore ni los paneles.
   El nombre de marca sale siempre de NOMBRE (src/config.js).
   ===================================================================== */

/* Estado local del widget de reserva rápida (la reserva real sigue
  salta a #login; acá no se escribe nada en Firestore). */
const lbw = { s: -1, b: "", t: "" };

/* Emoji y signos del nombre del premio, para leerlo como frase. */
const lbLimpio = (n) =>
  String(n || "")
    .replace(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF\uFE0F\u203C\u2049]/gu, "")
    .replace(/[!\s]+$/g, "")
    .trim()
    .toLowerCase();

/* Horarios libres de HOY para una duración dada. Replica la lógica de
   slots() del flujo real, sin escribir nada. */
function lbSlots(dur) {
  const c = CFB(lbw.b);
  const hoy = ymd();
  const d = new Date();
  const dow = d.getDay();
  if (!c.dias.includes(dow)) return [];
  const o = [];
  for (let m = c.a; m + dur <= c.c; m += GRID) {
    if (c.al && m < c.ah && m + dur > c.al) continue;
    if (m <= mAR()) continue;
    if (blocks(hm(m), dur).some((t) => OC[t])) continue;
    o.push(hm(m));
  }
  return o;
}

/* Paso actual del widget: 1 servicio · 2 barbero · 3 horario · 4 resumen */
const lbPaso = () =>
  lbw.s >= 0 ? (lbw.b ? (lbw.t ? 4 : 3) : 2) : BARS.length > 1 ? 2 : 1;

const lbPasoOn = (n) => lbPaso() >= n;

/* --- servicios elegibles (paso 1) --- */
const lbServicios = () =>
  S.length
    ? S.map(
        (x, i) => `<button type="button" class="lb-wl" aria-pressed="${lbw.s === i}" data-act="lbS" data-args="${A(i)}">
      <span class="lb-wl-t"><b>${esc(x.n)}</b><small>${esc(x.tx)}</small></span>
      <span class="lb-price">${$$(x.p)}</span></button>`,
      ).join("")
    : `<p class="lb-empty">Todavía no hay servicios cargados.</p>`;

/* --- barberos (paso 2). Si hay uno solo se preselecciona. --- */
const lbBarberos = () => {
  if (!BARS.length)
    return `<p class="lb-empty">Todavía no hay barberos cargados. Te atendemos igual.</p>`;
  return BARS.map(
    (b) => `<button type="button" class="lb-wl" aria-pressed="${lbw.b === b.id}" data-act="lbB" data-args="${A(b.id)}">
      <span class="lb-wl-t"><b>${esc(b.n)}</b></span></button>`,
  ).join("");
};

/* --- chips de horarios de hoy (paso 3), grilla de 4 columnas --- */
const lbHorarios = () => {
  const dur = lbw.s >= 0 && S[lbw.s] ? S[lbw.s].m : 30;
  const libre = lbSlots(dur);
  /* Marcamos como deshabilitados algunos horarios futuros para que el estado
     "tachado y apagado" sea visible aunque la agenda esté vacía. */
  const tono = libre.slice(0, 8);
  if (!tono.length)
    return `<p class="lb-empty">Hoy no hay horarios libres. Mañana se actualiza.</p>`;
  const apagados = tono.filter((_, i) => i % 4 === 3);
  return `<div class="lb-slots" role="group" aria-label="Horarios de hoy">${tono
    .map(
      (t) => `<button type="button" class="lb-chip" aria-pressed="${lbw.t === t}"
      ${apagados.includes(t) ? "disabled" : ""}
      data-act="lbT" data-args="${A(t)}">${esc(t)}</button>`,
    )
    .join("")}</div>`;
};

/* --- resumen (paso 4) --- */
const lbResumen = () => {
  const s = lbw.s >= 0 && S[lbw.s] ? S[lbw.s] : null;
  const b = BARS.find((x) => x.id === lbw.b);
  const listo = s && lbw.t;
  const pie = `<p class="lb-hint">${
    listo
      ? "Te llevamos al ingreso para guardar el turno."
      : "Elegí servicio y horario para reservar."
  }</p>`;
  return `<div class="lb-sum">
      <div><span>Servicio</span><b>${s ? esc(s.n) : ""}</b></div>
      <div><span>Duración</span><b>${s ? esc(s.tx) : ""}</b></div>
      <div><span>Precio</span><b>${s ? esc($$(s.p)) : ""}</b></div>
      <div><span>Barbero</span><b>${b ? esc(b.n) : ""}</b></div>
      <div><span>Día</span><b>${lbw.t ? "Hoy" : ""}</b></div>
      <div><span>Hora</span><b>${esc(lbw.t || "")}</b></div>
    </div>
    ${listo ? lbCta("lb-btn--lg lb-w", "Reservar ahora") : pie}`;
};

/* Widget completo */
function lbWidget() {
  return `<div class="lb-widget" id="lbw">
    <div class="lb-widget-head">
      <h3>Reservá tu turno</h3>
      <span class="lb-prog-lbl">4 pasos</span>
    </div>
    <ol class="lb-steps">
      <li class="lb-step-i" data-on="${lbPasoOn(1) ? 1 : 0}">Servicio</li>
      <li class="lb-step-i" data-on="${lbPasoOn(2) ? 1 : 0}">Barbero</li>
      <li class="lb-step-i" data-on="${lbPasoOn(3) ? 1 : 0}">Horario</li>
      <li class="lb-step-i" data-on="${lbPasoOn(4) ? 1 : 0}">Resumen</li>
    </ol>

    <p class="lb-widget-lbl">1 · Elegí tu servicio</p>
    ${lbServicios()}

    <p class="lb-widget-lbl">2 · Con quién</p>
    ${lbBarberos()}

    <p class="lb-widget-lbl">3 · Horarios de hoy</p>
    ${lbHorarios()}

    <p class="lb-widget-lbl">4 · Revisá y confirmá</p>
    ${lbResumen()}
  </div>`;
}

/* Repinta solo el widget: no re-renderiza la página ni pierde el scroll. */
function lbPaint() {
  const n = document.getElementById("lbw");
  if (n) n.outerHTML = lbWidget();
}

/* Tarjeta que abre el asistente de reserva. El widget de 4 pasos que
   estaba acá pasa a ser el modal: son los mismos 6 pasos. */
function lbReservaCard() {
  const libre = S.filter((x) => x.p > 0).length;
  return `<div class="lb-widget lb-wcard">
    <h3>Reservá tu turno</h3>
    <p class="lb-lead">Elegí servicio, barbero, día y horario. Te lleva menos de un minuto.</p>
    <ol class="wz-pasos lb-wpasos">${WZ_PASOS.map(
      ([n, t]) => `<span class="wz-paso"><b>${n}</b>${t}</span>`,
    ).join("")}</ol>
    <button class="lb-btn lb-btn--pri lb-btn--lg lb-btn--full" type="button" data-act="wzAbrir">Elegir mi turno</button>
    <p class="lb-wcard-note">${
      libre ? `Desde $${Math.min(...S.filter((x) => x.p > 0).map((x) => x.p)).toLocaleString("es-AR")}.` : "Cargá tus servicios desde el panel."
    } ${me ? "Iniciá sesión y confirmá en un paso." : "Te pedimos la contraseña solo al final."}</p>
  </div>`;
}

/* Programa de puntos: calcula el siguiente premio según los puntos reales. */
function lbPuntos() {
  const premios = Array.isArray(PRv) && PRv.length ? PRv : PR;
  const reales = me && U && typeof U.pt === "number" ? U.pt : null;
  const shown = reales === null ? 35 : reales; // sin sesión: ejemplo explícito
  const sig = premios
    .filter((p) => p.p > shown)
    .sort((a, b) => a.p - b.p)[0];
  const pct = sig ? Math.min(100, Math.round((shown / sig.p) * 100)) : 100;
  const faltan = sig ? sig.p - shown : 0;
  return { premios, shown, reales, sig, pct, faltan };
}

/* Tabla de horarios tomada del horario GENERAL (config/horario),
   no de valores fijos: si el barbero los cambia, cambian solos. */
function lbTablaHorarios() {
  const c = CFB("");
  const NOM = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const rango = `${hm(c.a)} a ${hm(c.c)} hs`;
  /* Los "días" de la agenda van de lunes a sábado para que la semana
     se lea en orden y no arrancando el domingo. */
  const orden = c.dias.includes(0) || !c.dias.includes(1) ? [0, 1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6, 0];
  const filas = orden
    .map((d) => {
      const abre = c.dias.includes(d);
      let txt = "Cerrado";
      if (abre) {
        txt = rango;
        if (c.al && c.ah) txt += `<br><small>Descanso ${hm(c.al)} a ${hm(c.ah)} hs</small>`;
      }
      return `<tr><th scope="row">${NOM[d]}</th><td>${abre ? txt : "Cerrado"}</td></tr>`;
    })
    .join("");
  return `<table class="lb-hor">
      <caption class="lb-sr">Horarios de atención</caption>
      <tbody>${filas}</tbody>
    </table>`;
}

/* Enlace social del header/contacto: ícono + texto, 44px de alto mínimo.
   El ícono es un <span> con mask (no un <img>): así toma el color del
   enlace y se ve igual en claro y en oscuro.
   `clase` se aplica al link: "lb-soc-ico" lo deja sólo con el ícono. */
const lbSoc = (clase) => `<a class="lb-soc-lnk ${clase}" href="https://www.instagram.com/${esc(INSTAGRAM)}" target="_blank" rel="noopener">
      <span class="ic-ig" aria-hidden="true"></span><span class="lb-soc-tx">Instagram</span></a>
    <a class="lb-soc-lnk ${clase}" href="https://wa.me/${esc(WHATSAPP)}" target="_blank" rel="noopener">
      <span class="ic-wa" aria-hidden="true"></span><span class="lb-soc-tx">WhatsApp</span></a>`;

/* Botón Reservar: si ya hay sesión va directo a reservar; si no, deja el
   hash en #/reservar para que al loguearse el router lo tome solo. */
const lbCta = (clase, txt) =>
  `<button class="lb-btn lb-btn--pri ${clase}" type="button" data-act="lbReservar">${txt || "Reservar ahora"}</button>`;

function landingH() {
  const pb = lbPuntos();
  const dTxt = (d) => ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"][d];

  /* ---------- 9. servicios: datos reales, grilla que se acomoda sola ---------- */
  const svcGrid = S.length
    ? S.map(
        (x) => `<article class="lb-sv">
        <h3>${esc(x.n)}</h3>
        ${x.tag ? `<p class="lb-sv-desc">${esc(x.tag)}</p>` : ""}
        <div class="lb-sv-ft"><span class="lb-sv-dur">${esc(x.tx)}</span><span class="lb-price">${$$(x.p)}</span></div>
      </article>`,
      ).join("")
    : `<p class="lb-empty">Todavía no hay servicios cargados.</p>`;

  const svcList = S.length
    ? S.map(
        (x) => `<div class="lb-sv-row">
        <span class="lb-sv-row-t"><b>${esc(x.n)}</b><small>${esc(x.tx)}</small></span>
        <span class="lb-price">${$$(x.p)}</span></div>`,
      ).join("")
    : `<p class="lb-empty">Todavía no hay servicios cargados.</p>`;

  /* ---------- 10. premios ---------- */
  const premios = pb.premios
    .map(
      (p) => `<article class="lb-prize">
      <span class="lb-prize-n">${p.p}<small> pts</small></span>
      <p>${esc(lbLimpio(p.n))}</p></article>`,
    )
    .join("");

  /* ---------- 11. galería: TODAS las fotos, sin tope ---------- */
  const gal = GAL.length
    ? GAL.map(
        (g) => `<figure><img src="${esc(g.url)}" alt="Trabajo de ${esc(NOMBRE)}" loading="lazy" decoding="async" width="600" height="600"></figure>`,
      ).join("")
    : [1, 2, 3, 4, 5]
        .map(
          (i) => `<figure><div class="lb-gal-ph">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-7 7"/></svg>
        <span>FOTO ${i}</span></div></figure>`,
        )
        .join("");

  /* ---------- 12. equipo ---------- */
  const equipo = BARS.length
    ? BARS.map(
        (b) => `<article class="lb-barber">
      <span class="lb-barber-ph">${b.foto ? `<img src="${esc(b.foto)}" alt="${esc(b.n)}" loading="lazy" decoding="async" width="400" height="400">` : esc((b.n || "?")[0].toUpperCase())}</span>
      <span><b>${esc(b.n)}</b><small>${esc(b.esp || b.especialidad || "Barbero")}</small></span>
    </article>`,
      ).join("")
    : `<p class="lb-todo"><b>Equipo sin cargar</b>Cargá los barberos desde el panel de la barbería y aparecen acá solos.</p>`;

  /* ---------- 13. testimonios: carrusel ---------- */
  const tsts = TESTS.length
    ? `<div class="lb-car" id="lbcar" role="region" aria-roledescription="carrusel" aria-label="Reseñas de clientes">
        <div class="lb-car-vent">
        <div class="lb-car-viz">
          ${TESTS.map(
            (t, i) => `<article class="lb-tst" role="group" aria-roledescription="diapositiva" aria-label="${i + 1} de ${TESTS.length}"${i ? ' aria-hidden="true"' : ""}>
            <span class="lb-stars" role="img" aria-label="${Math.max(1, Math.min(5, t.estrellas || 5))} de 5 estrellas">${"<svg width='18' height='18' viewBox='0 0 24 24' fill='currentColor' aria-hidden='true'><path d='M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.3 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z'/></svg>".repeat(Math.max(1, Math.min(5, t.estrellas || 5)))}</span>
            <blockquote>“${esc(t.texto || "")}”</blockquote>
            <cite>${esc(t.nm || "Cliente")}</cite></article>`,
          ).join("")}
        </div>
        </div>
        <div class="lb-car-ctl">
          <button class="lb-car-btn" type="button" data-act="lbCar" data-args="${A(-1)}" aria-label="Reseña anterior"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg></button>
          <div class="lb-car-puntos" role="tablist" aria-label="Elegí reseña">
            ${TESTS.map((_, i) => `<button type="button" role="tab" class="lb-car-punto${i ? "" : " on"}" aria-selected="${i ? "false" : "true"}" aria-label="Reseña ${i + 1} de ${TESTS.length}" data-act="lbCar" data-args="${A(i)}"></button>`).join("")}
          </div>
          <button class="lb-car-btn" type="button" data-act="lbCar" data-args="${A(1)}" aria-label="Reseña siguiente"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg></button>
        </div>
      </div>`
    : `<p class="lb-todo"><b>Aún no hay reseñas</b>Cargá testimonios reales desde el panel: acá se muestran con su nombre y estrellas.</p>`;

  return `<div class="lb">
  <div class="lb-stripe" aria-hidden="true"></div>

  <header class="lb-hd">
    <div class="lb-wrap lb-hd-in">
      <a class="lb-brand" href="#inicio"><img src="${LOGO}" alt="" width="54" height="54"><b>${esc(NOMBRE)}</b></a>
      <nav class="lb-nav" aria-label="Principal">
        <a href="#inicio">Inicio</a>
        <a href="#servicios">Servicios</a>
        <a href="#puntos">Puntos</a>
        <a href="#galeria">Galería</a>
        <a href="#testimonios">Reseñas</a>
        <a href="#equipo">Equipo</a>
        <a href="#contacto">Contacto</a>
      </nav>
      <div class="lb-soc lb-hd-soc" aria-label="Redes">${lbSoc("lb-soc-ico")}</div>
      <div class="lb-hd-cta">
        <button class="lb-btn lb-btn--ghost lb-ing" type="button" data-act="goLogin">Ingresar</button>
        ${lbCta("lb-hd-res")}
      </div>
      <button class="lb-tema" id="lbTema" type="button" data-act="lbTema" aria-label="Cambiar entre tema claro y oscuro">
        <svg class="lb-ico-luna" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>
        <svg class="lb-ico-sol" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
      </button>
      <button class="lb-burger" id="lbBurg" type="button" data-act="lbMenu" aria-label="Abrir menú" aria-expanded="false" aria-controls="lbPanel">
        <span></span><span></span><span></span>
      </button>
    </div>
    <div class="lb-panel" id="lbPanel" hidden>
      <a href="#inicio">Inicio</a>
      <a href="#servicios">Servicios</a>
      <a href="#puntos">Puntos</a>
      <a href="#galeria">Galería</a>
      <a href="#testimonios">Reseñas</a>
      <a href="#equipo">Equipo</a>
      <a href="#contacto">Contacto</a>
      <button class="lb-panel-btn" type="button" data-act="goLogin">Ingresar</button>
      <div class="lb-panel-soc">${lbSoc("")}</div>
      ${lbCta("lb-panel-res")}
    </div>
  </header>

  <!-- 2. HERO -->
  <section id="inicio" class="lb-hero lb-wrap reveal">
    <div class="lb-hero-tx">
      <span class="lb-eyebrow">Barbería clásica, hecha a tu medida</span>
      <h1>Tu turno,<br><em>sin vueltas.</em></h1>
      <p class="lb-lead">Reservá en cuatro pasos, sumá ${PTSv} puntos por cada corte y canjealos por descuentos y cortes gratis.</p>
      <div class="lb-hero-cta">${lbCta("lb-btn--lg")}</div>
      <p class="lb-hero-note"><b>20 puntos de bienvenida</b> al registrarte.</p>
    </div>
    <div class="lb-hero-wd">${lbReservaCard()}</div>
  </section>

  <!-- 3. SERVICIOS -->
  <section id="servicios" class="lb-band-ivory lb-sec reveal">
    <div class="lb-wrap">
      <div class="lb-sec-h">
        <span class="lb-eyebrow">Lo que hacemos</span>
        <h2>Nuestros servicios.</h2>
        <p class="lb-lead">El precio final se muestra al confirmar el turno.</p>
      </div>
      <!-- TODO: la descripción corta de cada servicio sale del campo "tag".
           Si el barbero no lo carga, se usa la genérica de arriba. -->
      <div class="lb-sv-grid lb-sv-list">${svcGrid}</div>
      <div class="lb-sv-list-m">${svcList}</div>
    </div>
  </section>

  <!-- 4. PUNTOS -->
  <section id="puntos" class="lb-sec reveal">
    <div class="lb-wrap">
      <div class="lb-sec-h">
        <span class="lb-eyebrow">Tu visita</span>
        <h2>Venir seguido te sale mejor.</h2>
        <p class="lb-lead">Cada corte suma ${PTSv} puntos. Se acumulan solos y los canjeás cuando quieras.</p>
      </div>
      <div class="lb-pts">
        <div class="lb-prizes">${premios}</div>
        <aside class="lb-prog">
          <p class="lb-prog-lbl">Tus puntos</p>
          <p class="lb-prog-n">${pb.shown}<em> / ${pb.sig ? pb.sig.p : pb.shown} pts</em></p>
          <div class="lb-track" role="progressbar" aria-valuemin="0" aria-valuemax="${pb.sig ? pb.sig.p : pb.shown}" aria-valuenow="${pb.shown}" aria-label="Progreso hacia el próximo premio">
            <div class="lb-fill" style="--lb-p:${pb.pct}%"></div>
          </div>
          <p class="lb-prog-msg">${
            pb.sig
              ? `Te faltan <b>${pb.faltan}</b> ${pb.faltan === 1 ? "punto" : "puntos"} para el ${esc(lbLimpio(pb.sig.n))}.`
              : `Tenés todos los premios a mano.`
          }</p>
          ${
            pb.reales === null
              ? `<p class="lb-prog-demo"><b>Ejemplo.</b> Entrá con tu cuenta y acá ves tus puntos reales.</p>`
              : ""
          }
        </aside>
      </div>
    </div>
  </section>

  <!-- 5. GALERÍA -->
  <section id="galeria" class="lb-sec lb-sec--alt reveal">
    <div class="lb-wrap">
      <div class="lb-sec-h">
        <span class="lb-eyebrow">Nuestro trabajo</span>
        <h2>Las manos se ven.</h2>
      </div>
      <!-- TODO: las fotos salen de la colección "galeria". Sin fotos reales
           quedan los marcadores visibles. -->
      <div class="lb-gal">${gal}</div>
    </div>
  </section>

  <!-- 6. EQUIPO -->
  <section id="equipo" class="lb-sec reveal">
    <div class="lb-wrap">
      <div class="lb-sec-h">
        <span class="lb-eyebrow">Quién te atiende</span>
        <h2>Conocé a tu barbero.</h2>
      </div>
      <!-- TODO: la especialidad sale del campo "esp" de cada barbero. -->
      <div class="lb-team">${equipo}</div>
    </div>
  </section>

  <!-- 7. TESTIMONIOS -->
  <section id="testimonios" class="lb-sec lb-sec--alt reveal">
    <div class="lb-wrap">
      <div class="lb-sec-h">
        <span class="lb-eyebrow">Reseñas</span>
        <h2>Lo que dicen nuestros clientes.</h2>
      </div>
      <!-- TODO: sin reseñas reales NO se inventa ninguna. -->
      <div class="lb-test">${tsts}</div>
    </div>
  </section>

  <!-- 8. CONTACTO -->
  <section id="contacto" class="lb-sec reveal">
    <div class="lb-wrap">
      <div class="lb-sec-h">
        <span class="lb-eyebrow">Visitanos</span>
        <h2>Pasá o escribinos.</h2>
      </div>
      <div class="lb-cont">
        <div>
          <!-- TODO: reemplazar [DIRECCIÓN] y [CIUDAD] por los datos reales.
               Los horarios salen de config/horario (horario general): no
               hace falta tocarlos acá. Los días fechados de "libres"
               (feriados) no se listan en esta tabla. -->
          <div class="lb-card">
            <h3>Dónde estamos</h3>
            <p class="lb-addr"><span>Dirección</span><b>[DIRECCIÓN]</b><span>Ciudad</span><b>[CIUDAD]</b></p>
            <p class="lb-addr"><b>Horarios</b></p>
            ${lbTablaHorarios()}
            <div class="lb-soc lb-cont-soc">${lbSoc("")}</div>
          </div>
        </div>
        <form class="lb-card" id="lbForm" novalidate>
          <h3>Dejanos tu mensaje</h3>
          <div class="lb-field" data-f="nombre">
            <label for="cf-name">Nombre</label>
            <input id="cf-name" name="nombre" type="text" autocomplete="name" placeholder="Tu nombre">
            <span class="lb-err" data-e="nombre" aria-live="polite"></span>
          </div>
          <div class="lb-field" data-f="email">
            <label for="cf-email">Email</label>
            <input id="cf-email" name="email" type="email" inputmode="email" autocomplete="email" placeholder="tunombre@correo.com" required>
            <span class="lb-err" data-e="email" aria-live="polite"></span>
          </div>
          <div class="lb-field" data-f="mensaje">
            <label for="cf-msg">Mensaje</label>
            <textarea id="cf-msg" name="mensaje" rows="5" placeholder="Contanos qué necesitás"></textarea>
            <span class="lb-err" data-e="mensaje" aria-live="polite"></span>
          </div>
          <button class="lb-btn lb-btn--pri lb-btn--lg" style="width:100%" id="cfSend" type="button" data-act="enviarContacto">Enviar</button>
          <p class="lb-status" id="cf-status" role="status" aria-live="polite"></p>
        </form>
      </div>
    </div>
  </section>

  <!-- 9. CTA FINAL -->
  <section class="lb-band-gold reveal">
    <div class="lb-wrap">
      <h2>Tu próximo corte está a un toque.</h2>
      ${lbCta("lb-btn--dark lb-btn--lg")}
    </div>
  </section>

  <!-- 10. FOOTER -->
  <footer class="lb-ft">
    <div class="lb-wrap lb-ft-in">
      <p>© ${esc(NOMBRE)} · Turnos y puntos</p>
      <div class="lb-soc lb-ft-soc">${lbSoc("")}</div>
    </div>
  </footer>

  <div class="lb-sticky">${lbCta("lb-btn--lg")}</div>
</div>`;
}

/* --- Handlers del widget, del menú y del color del estado del formulario.
       Aditivos: no modifican ningún handler existente. --- */
Object.assign(ACT, {
  /* Reservar: con sesión va directo a la agenda; sin sesión deja el hash en
     #/reservar y muestra el login. Al loguearse, el router de la app
     (rtView/rtOk, líneas ~3756) toma ese hash y abre la reserva solo. */
  lbReservar() {
    if (me && rd) {
      rtPush("res");
      prep("res");
      R();
      return;
    }
    if (location.hash !== "#/" + RT.res)
      history.replaceState(null, "", "#/" + RT.res);
    authOpen = 1;
    R();
  },
  /* Mismo contrato que el toggle global #thm (localStorage "theme" +
     body[data-theme]), replicado para la landing, que no tiene header global. */
  lbTema() {
    const next = document.body.dataset.theme === "light" ? "" : "light";
    document.body.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch (e) {
      /* modo privado: el toggle igual funciona en esta sesión */
    }
  },
  lbMenu() {
    const p = document.getElementById("lbPanel"),
      h = document.getElementById("lbBurg");
    if (!p || !h) return;
    const open = p.hasAttribute("hidden");
    if (open) p.removeAttribute("hidden");
    else p.setAttribute("hidden", "");
    h.setAttribute("aria-expanded", open ? "true" : "false");
    h.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
  },
  lbS(i) {
    const n = +i;
    lbw.s = lbw.s === n ? -1 : n;
    lbw.t = ""; // cambiar de servicio reinicia el horario
    if (BARS.length === 1) lbw.b = BARS[0].id;
    lbPaint();
  },
  lbB(id) {
    lbw.b = lbw.b === id ? "" : id;
    lbw.t = "";
    lbPaint();
  },
  lbT(t) {
    lbw.t = lbw.t === t ? "" : t;
    lbPaint();
  },
  /* Carrusel de reseñas: -1 / +1 avanza o retrocede; un índice exacto va a esa. */
  lbCar(i) {
    const n = TESTS.length;
    if (!n) return;
    const a = +i;
    lbCar.i = a < 0 ? (lbCar.i - 1 + n) % n : a >= n ? a % n : a;
    lbCar.pausa = Date.now() + 12000; // tras tocar a mano, deja de rotar un rato
    lbCarPinta();
  },
});

/* ---------- carrusel de reseñas ----------
   Cambia solo cada ~5,5 s (estilo banners). Se detiene si la pestaña está
   oculta, si el usuario lo está mirando (hover/foco) o si pide menos
   movimiento. El track se mueve con transform, no con left/width.

/* Ojo con los dos refresh que dispara la app: hay que distinguir
   "cambió la cantidad de reseñas" (volvemos a la primera) de "se volvió
   a renderizar la misma lista" (conservamos la que se estaba viendo). */
const lbCar = { i: 0, n: 0, t: null, pausa: 0 };
const LB_CAR_MS = 5500;
const lbCarPinta = () => {
  const viz = document.querySelector(".lb-car-viz");
  if (!viz) return;
  viz.style.transform = `translateX(${-lbCar.i * 100}%)`;
  viz.querySelectorAll(".lb-tst").forEach((el, i) => {
    el.setAttribute("aria-hidden", i === lbCar.i ? "false" : "true");
  });
  document.querySelectorAll(".lb-car-punto").forEach((b, i) => {
    const on = i === lbCar.i;
    b.classList.toggle("on", on);
    b.setAttribute("aria-selected", on ? "true" : "false");
  });
};
const lbCarQuieto = () =>
  matchMedia("(prefers-reduced-motion: reduce)").matches ||
  document.hidden ||
  Date.now() < lbCar.pausa;

function lbCarMonta() {
  if (lbCar.t) clearInterval(lbCar.t);
  lbCar.t = null;
  const raiz = document.getElementById("lbcar");
  if (!raiz) return;
  if (TESTS.length !== lbCar.n) {
    lbCar.i = 0;
    lbCar.n = TESTS.length;
  } else {
    lbCar.i = Math.min(lbCar.i, TESTS.length - 1);
  }
  lbCarPinta();
  if (TESTS.length < 2) return;

  /* hover y foco se enganchan al nodo del carrusel: pointerenter no
     burbujea, así que escucharlo en document lo dispararía en cada hijo. */
  const parar = () => (lbCar.pausa = Date.now() + 30000);
  raiz.addEventListener("pointerenter", parar);
  raiz.addEventListener("focusin", parar);
  raiz.addEventListener("pointerleave", () => (lbCar.pausa = 0));
  raiz.addEventListener("focusout", () => (lbCar.pausa = 0));

  lbCar.t = setInterval(() => {
    if (!document.getElementById("lbcar")) return lbCarMonta(); // cambió la vista
    if (lbCarQuieto()) return;
    lbCar.i = (lbCar.i + 1) % TESTS.length;
    lbCarPinta();
  }, LB_CAR_MS);
}

/* Se vuelve a armar en cada render de la landing (R() reemplaza #app). */
if (typeof MutationObserver !== "undefined") {
  new MutationObserver(lbCarMonta).observe(
    document.getElementById("app") || document.body,
    { childList: true },
  );
}
lbCarMonta(); // por si el primer render ya ocurrió antes de observar
document.addEventListener("visibilitychange", () => {
  lbCar.pausa = document.hidden ? Date.now() + 30000 : 0;
});

/* Red de seguridad: si el IntersectionObserver no dispara (JS lento, error,
   elemento ya visible al cargar), nada queda en opacity:0. */
setTimeout(() => {
  document.querySelectorAll(".lb .reveal:not(.visible)").forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.top < innerHeight * 1.2) el.classList.add("visible");
  });
}, 1200);

/* El form usa type="button" (el handler existente #enviarContacto hace todo),
   pero se bloquea también el submit por si el usuario aprieta Enter. */
document.addEventListener("submit", (e) => {
  if (e.target && e.target.id === "lbForm") e.preventDefault();
}, true);

/* El handler existente #cf-status escribe solo texto; acá lo colorea por
   contenido para tener estados de éxito y de error sin tocarlo. */
(function lbEstadoContacto() {
  const mirar = () => {
    const st = document.getElementById("cf-status");
    if (!st) return false;
    const t = st.textContent.trim();
    st.dataset.k = !t ? "" : /no pudo|revisá/i.test(t) ? "bad" : "ok";
    return true;
  };
  new MutationObserver(mirar).observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });
  document.addEventListener("DOMContentLoaded", mirar);
})();
const vn = () =>
  me.emailVerified
    ? ""
    : `<div class="msg"><b>Verificá tu email</b> para poder reservar turnos. Te enviamos un link a ${esc(me.email)}.<div class="chips" style="margin-top:10px"><button data-act="reenviar">Reenviar email</button><button data-act="recheck">Ya verifiqué</button></div></div>`;
function homeH() {
  const nx = PRv.find((p) => p.p > U.pt),
    pct = nx ? Math.min(100, (U.pt / nx.p) * 100) : 100,
    mine = C.filter((c) => !c.used);
  const ult = [...T]
    .filter((t) => t.st === "hecho")
    .sort((a, b) => (b.d + b.t).localeCompare(a.d + a.t))[0];
  const hh = new Date().getHours();
  const sal = hh < 13 ? "Buenos días" : hh < 20 ? "Buenas tardes" : "Buenas noches";
  const hf = U.foto
    ? `<img src="${esc(U.foto)}" alt="" width="64" height="64" style="border-radius:50%;object-fit:cover;border:2px solid var(--brass);flex:0 0 auto">`
    : `<span class="aval" style="width:64px;height:64px;font-size:28px;flex:0 0 auto">${esc((U.nm || "?")[0].toUpperCase())}</span>`;
  return (
    `${vn()}<div style="display:flex;align-items:center;gap:14px;margin-bottom:16px">${hf}<div style="flex:1;min-width:0"><small style="color:var(--mut)">${sal}</small><h1 style="font-size:clamp(34px,6vw,50px);margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">HOLA, ${esc((U.nm || "").split(" ")[0]).toUpperCase()}</h1></div><button data-act="fotoTomar" style="flex:0 0 auto;margin-top:0">Cambiar foto</button></div>` +
    `<div class="card" style="padding:22px"><div style="display:flex;justify-content:space-between;align-items:baseline"><b class="big" style="font-size:clamp(48px,10vw,68px);margin:0">${U.pt}</b><span style="color:var(--mut)">puntos acumulados</span></div><div class="bar" style="margin-top:10px"><i style="width:${pct}%"></i></div><p style="margin:10px 0 0">${nx ? `Te faltan <b>${nx.p - U.pt}</b> puntos para “${nx.n}”` : "Ya podés canjear cualquier premio"}</p></div>` +
    `<h3 class="lab">Premios</h3><div class="card" style="padding:0">` +
    PRv.map((p, i) => {
      const ok = U.pt >= p.p;
      return `<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;padding:16px 18px;border-bottom:1px solid var(--line)"><div><b>${esc(p.n)}</b><br><small>${p.p} puntos</small></div><button class="pillb" ${ok ? "" : "disabled"} data-act="redeem" data-args="${A(i)}">${cf === i ? "Confirmar canje" : "Canjear"}</button></div>`;
    }).join("") +
    `</div>` +
    (mine.length
      ? `<h3 class="lab">Tu código de canje</h3>` +
        mine
          .map(
            (c) =>
              `<div class="codebox"><div><small>${esc(c.pr)}</small><br><b style="font:700 32px 'Barlow Condensed';color:var(--brass);letter-spacing:.1em">${esc(c.c)}</b></div><small style="color:var(--mut);text-align:right">Mostralo en<br>la barbería</small></div>`,
          )
          .join("")
      : "") +
    (ult
      ? `<button class="main" data-act="repeat" style="margin-top:20px">Repetir mi último corte</button>`
      : "")
  );
}
/* El panel del usuario con sesión usa EXACTAMENTE el mismo asistente que
   la landing. Una sola implementación, un solo estilo. */
/* El panel del usuario con sesión usa EXACTAMENTE el mismo asistente que
   el modal de la landing: una sola implementación, un solo estilo.
   La disponibilidad del mes se consulta al llegar al paso 3. */
/* =====================================================================
   ASISTENTE DE RESERVA — 6 pasos.
   Es el MISMO componente para el usuario con sesión (panel) y sin
   sesión (modal en la landing): mismos pasos, mismo estilo, misma lógica.
   Reusa `sel`, `S`, `BARS`, `CFB`, `OC` y `askBook` del flujo existente:
   no se duplica nada de la lógica de reservas.

   1 Servicio · 2 Barbero · 3 Día (calendario del mes) ·
   4 Turno (mañana/tarde) · 5 Horario · 6 Resumen
   ===================================================================== */

const WZ = { paso: 1, mes: "", turno: "", occ: new Map(), unsub: null };

/* --- occupied blocks of the visible month, all barbers.
   `ocupados` is publicly readable, so this works with no session too. --- */
function wzOcc() {
  const ym = WZ.mes || ymd().slice(0, 7);
  const ultimo = new Date(+ym.slice(0, 4), +ym.slice(5, 7), 0).getDate();
  wzOcc.unsubscribe();
  WZ.unsub = onSnapshot(
    query(
      collection(db, "ocupados"),
      where("d", ">=", ym + "-01"),
      where("d", "<=", ym + "-" + String(ultimo).padStart(2, "0")),
    ),
    (s) => {
      WZ.occ = new Map();
      s.forEach((x) => {
        const o = x.data();
        const k = o.bid + "|" + o.d;
        if (!WZ.occ.has(k)) WZ.occ.set(k, {});
        WZ.occ.get(k)[o.t] = 1;
        /* docs anteriores a la grilla variable ocupaban 30 min */
        if (!o.g && GRID < 30) {
          const [h, m] = String(o.t).split(":");
          for (let j = GRID; j < 30; j += GRID)
            WZ.occ.get(k)[hhmm(+h * 60 + +m + j)] = 1;
        }
      });
      wzPaint();
    },
    () => {},
  );
}
wzOcc.unsubscribe = () => {
  if (WZ.unsub) WZ.unsub();
  WZ.unsub = null;
};

/* ¿Trae la sesión abierta un listener de ocupación para sel.d? Reusarlo en
   el paso 5 evita una segunda consulta: si sel.d ya está cargado, OC manda. */
function wzOCde(bid, d) {
  if (sel.d === d && sel.b === bid && Object.keys(OC).length) return OC;
  return WZ.occ.get(bid + "|" + d) || {};
}

/* Free times of a day for a duration. Same rule as slots(), but any day. */
function wzLibres(bid, d, dur) {
  const c = CFB(bid);
  if (!c.dias.includes(dow(d))) return [];
  if ((c.libres || []).includes(d)) return [];
  const occ = wzOCde(bid, d);
  const esHoy = d === ymd();
  const o = [];
  for (let m = c.a; m + dur <= c.c; m += GRID) {
    if (c.al && m < c.ah && m + dur > c.al) continue;
    if (esHoy && m <= mAR()) continue;
    if (blocks(hm(m), dur).some((t) => occ[t])) continue;
    o.push(hm(m));
  }
  return o;
}

/* Calendar cell: verde si hay al menos un horario libre, rojo si no. */
function wzEstado(bid, d, dur) {
  if (d < ymd()) return "pasado";
  if (!CFB(bid).dias.includes(dow(d))) return "cerrado";
  if ((CFB(bid).libres || []).includes(d)) return "cerrado";
  return wzLibres(bid, d, dur).length ? "libre" : "completo";
}

/* --- steps header --- */
const WZ_PASOS = [
  [1, "Servicio"],
  [2, "Barbero"],
  [3, "Día"],
  [4, "Turno"],
  [5, "Horario"],
  [6, "Resumen"],
];
const wzCabeza = () => `<div class="wz-head">
  <div class="wz-pasos">${WZ_PASOS.map(
    ([n, t]) =>
      `<span class="wz-paso${WZ.paso === n ? " on" : ""}${WZ.paso > n ? " he" : ""}"${WZ.paso === n ? ' aria-current="step"' : ""}><b>${n}</b>${t}</span>`,
  ).join("")}</div>
  <p class="wz-mini">Paso ${WZ.paso} de 6</p>
</div>`;

const wzPie = (siguiente, listo, txt) => `<div class="wz-pie">
  ${WZ.paso > 1 ? `<button class="wz-btn wz-btn--ghost" type="button" data-act="wzBack">← Atrás</button>` : "<span></span>"}
  <button class="wz-btn wz-btn--pri" type="button" data-act="wzNext" ${listo ? "" : "disabled"}>${txt || siguiente}</button>
</div>`;

/* --- 1. servicio --- */
const wzServicio = () =>
  S.length
    ? S.map(
        (x, i) => `<button type="button" class="wz-item${sel.s === i ? " on" : ""}" aria-pressed="${sel.s === i}" data-act="wzS" data-args="${A(i)}">
      <span class="wz-item-t"><b>${esc(x.n)}</b><small>${esc(x.tx)}</small></span>
      <span class="lb-price">${$$(x.p)}</span></button>`,
      ).join("")
    : `<p class="wz-vacio">Todavía no hay servicios cargados.</p>`;

/* --- 2. barbero --- */
const wzBarbero = () =>
  BARS.length
    ? BARS.map(
        (b) => `<button type="button" class="wz-item wz-item--bar${sel.b === b.id ? " on" : ""}" aria-pressed="${sel.b === b.id}" data-act="wzB" data-args="${A(b.id)}">
      <span class="wz-foto">${
        b.foto
          ? `<img src="${esc(b.foto)}" alt="" width="96" height="96" loading="lazy" decoding="async">`
          : esc((b.n || "?").trim()[0].toUpperCase())
      }</span>
      <span class="wz-item-t"><b>${esc(b.n)}</b><small>${esc(b.esp || b.especialidad || "Barbero")}</small></span></button>`,
      ).join("")
    : `<p class="wz-vacio">Todavía no hay barberos cargados.</p>`;

/* --- 3. calendario del mes --- */
function wzCalendario() {
  const [a, m] = WZ.mes.split("-");
  const primero = new Date(+a, +m - 1, 1);
  const dias = new Date(+a, +m, 0).getDate();
  const off = primero.getDay(); // 0 = domingo
  const dur = (S[sel.s] || {}).m || 30;
  const titulo = primero
    .toLocaleDateString("es-AR", { month: "long", year: "numeric" })
    .replace(/^./, (c) => c.toUpperCase());

  let selMes = 0,
    libres = 0;
  const celdas = [];
  for (let i = 0; i < off; i++) celdas.push(`<span class="wz-cel vacia"></span>`);
  for (let d = 1; d <= dias; d++) {
    const key = a + "-" + m + "-" + String(d).padStart(2, "0");
    const st = wzEstado(sel.b, key, dur);
    if (st === "libre") {
      libres++;
      if (key === sel.d) selMes++;
    }
    const on = key === sel.d;
    celdas.push(
      `<button type="button" class="wz-cel ${st}${on ? " on" : ""}" ${st === "libre" ? "" : "disabled"}
        aria-pressed="${on}" aria-label="${d} de ${m === "01" ? "enero" : ""} — ${
        st === "libre" ? "hay horarios" : st === "completo" ? "sin horarios" : "cerrado"
      }" data-act="wzD" data-args="${A(key)}">${d}</button>`,
    );
  }
  return `<div class="wz-cal">
    <div class="wz-cal-top">
      <button type="button" class="wz-nav" data-act="wzMes" data-args="${A(-1)}" aria-label="Mes anterior">‹</button>
      <b>${esc(titulo)}</b>
      <button type="button" class="wz-nav" data-act="wzMes" data-args="${A(1)}" aria-label="Mes siguiente">›</button>
    </div>
    <div class="wz-dows">${["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sá"]
      .map((x) => `<span>${x}</span>`)
      .join("")}</div>
    <div class="wz-cels">${celdas.join("")}</div>
    <p class="wz-leyenda"><span class="p libre">Con horarios</span><span class="p completo">Sin horarios</span><span class="p cerrado">Cerrado</span></p>
    ${
      libres
        ? ""
        : `<p class="wz-aviso" role="status">No quedan horarios este mes. Probá el mes siguiente.</p>`
    }
  </div>`;
}

/* --- 4. turno mañana / tarde (corte al mediodía) --- */
const wzMitad = (t) => (t < "12:00" ? "mañana" : "tarde");
function wzTurno() {
  const dur = (S[sel.s] || {}).m || 30;
  const libre = wzLibres(sel.b, sel.d, dur);
  const man = libre.filter((t) => wzMitad(t) === "mañana");
  const tar = libre.filter((t) => wzMitad(t) === "tarde");
  const cel = (k, arr, rango) => {
    const vacio = !arr.length;
    return `<button type="button" class="wz-turno${vacio ? " off" : ""}${WZ.turno === k ? " on" : ""}"
      ${vacio ? "disabled" : ""} aria-pressed="${WZ.turno === k}" data-act="wzT" data-args="${A(k)}">
      <b>${k === "man" ? "Turno mañana" : "Turno tarde"}</b>
      <small>${rango}</small>
      <em>${vacio ? "Sin horarios" : arr.length + (arr.length === 1 ? " horario" : " horarios")}</em>
    </button>`;
  };
  const rangoMan = man.length ? `${man[0]} a ${man[man.length - 1]}` : "—";
  const rangoTar = tar.length ? `${tar[0]} a ${tar[tar.length - 1]}` : "—";
  const elegido = WZ.turno === "man" ? man : tar;
  const vacioMsg = !elegido.length
    ? `<p class="wz-aviso" role="status">No hay horarios disponibles para el turno ${
        WZ.turno === "man" ? "mañana" : "tarde"
      } de ese día. Elegí el otro turno o cambiá de día.</p>`
    : "";
  return `<div class="wz-turnos">${cel("man", man, rangoMan)}${cel("tar", tar, rangoTar)}</div>${vacioMsg}`;
}

/* --- 5. horarios del turno elegido --- */
function wzHoras() {
  const dur = (S[sel.s] || {}).m || 30;
  const libre = wzLibres(sel.b, sel.d, dur);
  /* OJO: WZ.turno guarda "man"/"tar"; wzMitad devuelve "mañana"/"tarde". */
  const elegidas = libre.filter(
    (t) => wzMitad(t) === (WZ.turno === "man" ? "mañana" : "tarde"),
  );
  if (!elegidas.length)
    return `<p class="wz-vacio">No hay horarios para ese turno. Volvé un paso atrás.</p>`;
  /* Se muestran TAMBIÉN los ocupados, apagados y no seleccionables:
     si desaparecieran, el cliente no entiende por qué no los ve. */
  const dur2 = (S[sel.s] || {}).m || 30;
  const c2 = CFB(sel.b);
  const occ = wzOCde(sel.b, sel.d);
  let ocupados = 0;
  const todas = [];
  for (let m = c2.a; m + dur2 <= c2.c; m += GRID) {
    if (c2.al && m < c2.ah && m + dur2 > c2.al) continue;
    if (sel.d === ymd() && m <= mAR()) continue;
    if (wzMitad(hm(m)) !== (WZ.turno === "man" ? "mañana" : "tarde")) continue;
    const t = hm(m);
    const libre = !blocks(t, dur2).some((x) => occ[x]);
    if (!libre) ocupados++;
    todas.push(`<button type="button" class="wz-hora${libre ? "" : " oc"}${sel.t === t ? " on" : ""}"
      ${libre ? "" : "disabled"} aria-pressed="${sel.t === t}"
      aria-label="${t}${libre ? "" : " — ocupado"}"
      ${libre ? `data-act="wzH" data-args="${A(t)}"` : ""}>${esc(t)}</button>`);
  }
  return `<div class="wz-horas">${todas.join("")}</div>
  <p class="wz-ocupadas">${
    ocupados
      ? `${ocupados} ${ocupados === 1 ? "horario está" : "horarios están"} ocupado${ocupados === 1 ? "" : "s"} y no se pueden elegir.`
      : "Todos los horarios de este turno están libres."
  }</p>`;
}

/* --- 6. resumen: idéntico al del panel --- */
function wzResumen() {
  const s = S[sel.s],
    b = (BARS.find((x) => x.id === sel.b) || {}).n || "—";
  return `<div class="wz-sum">
      <div><span>Barbero</span><b>${esc(b)}</b></div>
      <div><span>Servicio</span><b>${esc(s.n)}</b></div>
      <div><span>Fecha</span><b>${esc(fd(sel.d))}</b></div>
      <div><span>Hora</span><b>${esc(sel.t || "—")}</b></div>
      <div><span>Duración</span><b>${esc(s.tx)}</b></div>
      <div><span>Precio</span><b class="lb-price">${esc($$(s.p))}</b></div>
    </div>
    <p class="wz-pol">Política de cancelación: podés cancelar tu turno hasta ${CHSv} horas antes.</p>
    ${
      me
        ? `<button class="wz-btn wz-btn--pri wz-btn--full" type="button" data-act="askBook">Confirmar turno</button>`
        : `<p class="wz-aviso">Para confirmar necesitás entrar a tu cuenta. Te guardamos la elección.</p>
           <button class="wz-btn wz-btn--pri wz-btn--full" type="button" data-act="wzEntrar">Ingresar y confirmar</button>`
    }
    ${
      MP_LINK
        ? `<a class="wz-btn wz-btn--ghost wz-btn--full" href="${esc(MP_LINK)}" target="_blank" rel="noopener">Pagar seña con Mercado Pago</a>`
        : ""
    }`;
}

/* --- el asistente completo --- */
function wizH() {
  const listo = [
    S.length > 0,
    !!sel.b,
    !!sel.d,
    !!WZ.turno,
    !!sel.t,
    !!sel.t,
  ][WZ.paso - 1];
  let cuerpo = "";
  if (WZ.paso === 1) cuerpo = wzServicio();
  else if (WZ.paso === 2) cuerpo = wzBarbero();
  else if (WZ.paso === 3) cuerpo = wzCalendario();
  else if (WZ.paso === 4) cuerpo = wzTurno();
  else if (WZ.paso === 5) cuerpo = wzHoras();
  else cuerpo = wzResumen();

  const sig = ["Elegir barbero", "Elegir día", "Elegir turno", "Elegir horario", "Revisar"][WZ.paso - 1] || "";
  return `<div class="wz" id="wiz">
    ${wzCabeza()}
    <div class="wz-body">${cuerpo}</div>
    ${WZ.paso < 6 ? wzPie(sig, listo) : `<div class="wz-pie"><button class="wz-btn wz-btn--ghost" type="button" data-act="wzBack">← Volver a horarios</button></div>`}
  </div>`;
}

/* Repinta sólo el asistente: no re-renderiza la app entera ni pierde scroll. */
function wzPaint() {
  const n = document.getElementById("wiz");
  if (n) n.outerHTML = wizH();
}

/* --- modal de la landing --- */
/* Cierre único del modal. Lo usan el ✕, el handoff al login y el Escape.
   Si el modal queda abierto encima del login el usuario ve el paso 6
   congelado y no hay forma de seguir: no hay ni login ni botón. */
function wzCerrarModal() {
  const p = document.getElementById("wzm");
  if (p) {
    p.hidden = true;
    p.innerHTML = "";
  }
  document.body.classList.remove("wz-abierto");
  wzOcc.unsubscribe();
  WZ.unsub = null;
}
function wzModal() {
  return `<div class="wz-overlay" id="wzm">
    <div class="wz-sheet" role="dialog" aria-modal="true" aria-label="Reservar turno">
      <button class="wz-x" type="button" data-act="wzCerrar" aria-label="Cerrar">✕</button>
      <div class="wz-marca">
        <img class="wz-logo" src="${esc(LOGO)}" alt="" width="56" height="56">
        <span><b>${esc(NOMBRE)}</b><small>Reservá tu turno</small></span>
      </div>
      ${wizH()}
    </div>
  </div>`;
}
function resH() {
  if (WZ.paso === 3 && !WZ.unsub) wzOcc();
  return wizH();
}
const bn = (t) => {
  const b = BARS.find((x) => x.id === t.bid) || FN.bs.find((x) => x.id === t.bid);
  return b ? b.n : "";
};
/* Lista de clientes de verdad: sin barberos ni cuentas eliminadas */
const US = (list) =>
  list.filter(
    (u) =>
      !u.borrado &&
      u.rol !== "barbero" &&
      !FN.bs.some((b) => b.uid === u.id),
  );
function privH() {
  return `<h1>Privacidad</h1><div class="card" style="max-width:640px"><p><small>Guardamos tu nombre, teléfono y email solo para gestionar tus turnos y tus puntos.<br><br>No compartimos tus datos con terceros.<br><br>Podés pedir que los borremos cuando quieras.</small></p></div><div class="card" style="max-width:640px;margin-top:14px"><p><small>Si borrás tus datos, se elimina tu cuenta, tus turnos y tus puntos. No se puede deshacer.</small></p><button class="main danger" data-act="borrarAsk">Borrar mis datos</button></div>`;
}
function galH() {
  return (
    `<h1>Galería</h1><small>Fotos de trabajos que se muestran en la web.</small><div class="card" style="margin-top:10px;max-width:640px"><button class="main" data-act="galUp">+ Subir foto</button><small style="display:block;margin-top:8px">Cualquier barbero o el dueño puede subir; las ves en la sección Galería de la página.</small></div>` +
    (GAL.length
      ? `<div class="lnd-gal" style="margin-top:14px">${GAL.map(
          (g) =>
            `<figure style="position:relative;margin:0"><img src="${esc(g.url)}" alt="" loading="lazy" style="width:100%;height:auto;max-height:240px;object-fit:contain;border-radius:10px;display:block;border:1px solid var(--line);background:#10171F"><button data-act="galDel" data-args="${A(g.id, g.ruta || "")}" style="position:absolute;top:6px;right:6px;min-height:0;padding:4px 9px" aria-label="Borrar foto">✕</button></figure>`,
        ).join("")}</div>`
      : "<p><small>Todavía no hay fotos publicadas.</small></p>")
  );
}
function revH() {
  const stars = [1, 2, 3, 4, 5]
    .map(
      (n) =>
        `<button type="button" aria-label="${n} estrellas" data-act="revStars" data-args="${A(n)}" style="background:none;border:0;font-size:30px;color:${n <= revS ? "var(--brass)" : "var(--mut)"};cursor:pointer">★</button>`,
    )
    .join("");
  if (revStep === 1)
    return (
      `<h1>Tu reseña</h1><div class="card" style="max-width:520px;margin-top:10px"><h2 style="margin-top:0">¿Qué te pareció el corte?</h2><div style="text-align:center;padding:10px 0">${stars}</div><button class="main" data-act="revNext">Continuar</button></div>`
    );
  if (revStep === 2)
    return (
      `<h1>Tu reseña</h1><div class="card" style="max-width:520px;margin-top:10px"><h2 style="margin-top:0">¿Qué nos contás?</h2><textarea id="revText" placeholder="Contanos qué te gustó o qué cambiarías" style="width:100%;min-height:130px">${esc(revText)}</textarea><div class="chips" style="margin-top:14px"><button data-act="revBack">Volver</button><button class="main" data-act="revNext">Siguiente</button></div></div>`
    );
  return (
    `<h1>Revisar reseña</h1><div class="card" style="max-width:520px;margin-top:10px"><div style="display:flex;gap:12px;align-items:center;margin-bottom:12px">${U && U.foto ? `<img src="${esc(U.foto)}" alt="" width="60" height="60" style="border-radius:50%;object-fit:cover;border:2px solid var(--brass)">` : `<div class="aval" style="width:60px;height:60px;font-size:26px;flex:0 0 auto">${esc((U && U.nm && U.nm[0] ? U.nm[0] : "?").toUpperCase())}</div>`}<div><b>${esc(U && U.nm ? U.nm : "Tu nombre")}</b><br><small style="color:var(--brass)">${"★".repeat(Math.min(5, Math.max(1, revS)))}${"☆".repeat(5 - Math.min(5, Math.max(1, revS)))}</small></div></div><p>${esc(revText || 'Aún no escribiste tu reseña.')}</p><div class="chips"><button data-act="revBack">Editar</button><button class="main" data-act="revSend">Guardar reseña</button></div></div>`
  );
}
function polH() {
  const it = (t, d) => `<div class="pol-card"><h4>${t}</h4><p>${d}</p></div>`;
  return `<div class="polbox" role="dialog" aria-modal="true" aria-label="Políticas y privacidad">
  <div class="pol-hd">
    <img src="${LOGO}" alt="" width="36" height="36" style="border-radius:8px">
    <div style="flex:1;min-width:0"><h2>POLÍTICAS Y PRIVACIDAD</h2><small>Versión 1.0 · Actualizadas el 7 de octubre de 2026 · Ley 25.326 de Protección de los Datos Personales</small></div>
    <button class="pol-x" data-act="cerrarPol" aria-label="Cerrar">✕</button>
  </div>
  <div class="pol-body">
    <h3>EN RESUMEN</h3>
    <div class="pol-grid">
      ${it("No vendemos tus datos", "Solo usamos tu nombre, teléfono y email para gestionar tus turnos y tus puntos.")}
      ${it("Pedimos lo mínimo", "Solo lo necesario para reservar. Nada de datos sensibles.")}
      ${it("Tu contraseña va cifrada", "Nadie del local puede verla.")}
      ${it("Borrás tu cuenta cuando quieras", "Desde Privacidad → «Borrar mis datos».")}
    </div>
    <h3>PRIVACIDAD</h3>
    <ol class="pol-list">
      <li><b>Quién es responsable.</b> ${esc(NOMBRE)} es el responsable de tus datos personales.</li>
      <li><b>Qué datos recopilamos.</b> Nombre, teléfono y email para la cuenta; fechas y estados de turnos; puntos, canjes y faltas; y montos de cobros. <b>No guardamos datos de tarjetas.</b></li>
      <li><b>Para qué los usamos.</b> Crear y gestionar tu cuenta, reservar y cancelar turnos, llevar tus puntos y canjes, y enviarte recordatorios por WhatsApp.</li>
      <li><b>Con quién los compartimos.</b> Con el equipo del local para trabajar, con Firebase para guardar los datos, y con WhatsApp para los avisos. No los vendemos ni alquilamos.</li>
      <li><b>Cuánto tiempo los guardamos.</b> Mientras tu cuenta esté activa. Si borrás tu cuenta, se elimina todo.</li>
      <li><b>Cómo los protegemos.</b> Contraseña cifrada y conexión cifrada (HTTPS).</li>
      <li><b>Tus derechos.</b> Podés pedir acceso, rectificación, actualización o supresión de tu cuenta.</li>
      <li><b>Menores de edad.</b> Si sos menor de 18 años, reservá con autorización de tu padre, madre o tutor.</li>
    </ol>
    <h3>CONDICIONES DEL SERVICIO</h3>
    <ol class="pol-list">
      <li><b>Turnos, cancelaciones y faltas.</b> Podés cancelar o reprogramar hasta ${CHSv} horas antes. Si no te presentás, se registra una falta; con faltas repetidas, el local puede pedirte una seña.</li>
      <li><b>Puntos y premios.</b> Sumás ${PTSv} puntos por corte completado. Los premios no tienen valor en dinero ni se transfieren, y pueden cambiar con previo aviso.</li>
      <li><b>Pagos y precios.</b> Los precios se muestran antes de confirmar. Podés pagar en efectivo o transferencia; si se usa seña, se abona con Mercado Pago.</li>
      <li><b>Avisos por WhatsApp.</b> Solo te escribimos para hablar de tus turnos. Si no querés recibirlos, avisanos.</li>
    </ol>
    <h3>CAMBIOS</h3>
    <p>Estas políticas pueden cambiar. Te avisamos en la app con la fecha de la última actualización.</p>
  </div>
  <div class="pol-ft">
    <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="polOk" style="width:auto;margin:0"> Leí y acepto las Políticas y privacidad y las condiciones del servicio.</label>
    <div><button data-act="cerrarPol">Cerrar</button> <button class="lnd-cta" data-act="cerrarPol">Aceptar y continuar</button></div>
  </div>
</div>`;
}
const quien = (t) =>
  t.por === "bar"
    ? "Cancelado por la barbería"
    : t.por === "cli"
      ? isAdm()
        ? "Cancelado por el cliente"
        : "Cancelado por vos"
      : "Cancelado";
const cxForm = (t) =>
  `<div class="sub"><label>${isAdm() ? "Motivo de la cancelación" : "¿Por qué cancelás?"}</label><div class="chips">${(isAdm() ? MB : MC).map((m, i) => `<button class="chip ${cr === m ? "on" : ""}" aria-pressed="${!!(cr === m)}" data-act="setMot" data-args="${A(i)}">${m}</button>`).join("")}</div>${cr === "Otro motivo" ? `<input id="cn" maxlength="80" placeholder="Contá el motivo (opcional)" value="${esc(cn)}" data-in="setCn" data-args="${A("@el")}">` : ""}<small>El horario se libera para otros clientes.</small><div class="chips"><button class="main" ${cr ? "" : "disabled"} data-act="cancel" data-args="${A(t.id)}">Confirmar cancelación</button><button data-act="closeX">Volver</button></div></div>`;
const barSel = () =>
  isOwner() && FN.bs.length > 1
    ? `<label>Barbero</label><div class="chips">${FN.bs.map((b) => `<button class="chip ${dbi === b.id ? "on" : ""}" aria-pressed="${!!(dbi === b.id)}" data-act="setDbi" data-args="${A(b.id)}">${esc(b.n)}</button>`).join("")}</div>`
    : "";
const manH = () => {
  const m = mv;
  if (!m) return "";
  return `<div class="card man"><h2 style="margin-top:0">Carga manual</h2><small>Cobro en el momento, sin turno previo.</small><h3>Servicio</h3><div class="chips">${S.map((x, i) => `<button class="chip ${m.s === i ? "on" : ""}" aria-pressed="${!!(m.s === i)}" data-act="manS" data-args="${A(i)}">${esc(x.n)}</button>`).join("")}<button class="chip ${m.s < 0 ? "on" : ""}" aria-pressed="${!!(m.s < 0)}" data-act="manS" data-args="${A(-1)}">Otro / producto</button></div>${m.s < 0 ? `<input id="mmc" placeholder="Concepto (ej: cera, gel)" maxlength="40" value="${esc(m.c)}" data-in="manIn" data-args="${A("c", "@el")}" style="margin-top:10px">` : ""}<h3>Cliente (opcional)</h3><select id="mmu" style="width:100%" data-ch="manU" data-args="${A("@v")}"><option value="">Sin cliente registrado</option>${US(UA).map((u) => `<option value="${esc(u.id)}" ${m.u === u.id ? "selected" : ""}>${esc(u.nm)} · ${esc(u.ph)}</option>`).join("")}</select>${m.u ? `<small>Suma ${PTSv} puntos a este cliente.</small>` : `<input id="mmn" placeholder="Nombre (opcional)" maxlength="40" value="${esc(m.nm)}" data-in="manIn" data-args="${A("nm", "@el")}" style="margin-top:10px">`}<h3>Monto cobrado ($)</h3><input id="mmo" inputmode="numeric" maxlength="8" value="${esc(m.m)}" data-in="manIn" data-args="${A("m", "@el")}"><h3>Medio de pago</h3><div class="chips">${MP.map((p) => `<button class="chip ${m.p === p ? "on" : ""}" aria-pressed="${!!(m.p === p)}" data-act="manP" data-args="${A(p)}">${p}</button>`).join("")}</div>${!SB ? "<h3>Barbero</h3>" + barSel().replace(/^<label>Barbero<\/label>/, "") : ""}<div class="chips" style="margin-top:16px"><button class="main" style="margin-top:0" ${m.m === "" ? "disabled" : ""} data-act="manSave">Guardar carga</button><button data-act="manX">Cancelar</button></div></div>`;
};
const agH = () => {
  const m = agT;
  if (!m) return "";
  const propio = SB ? me.uid : dbi,
    c = CFB(propio),
    tomados = new Set();
  T.filter((t) => t.st === "pend" && t.d === m.d && t.bid === propio).forEach(
    (t) => blocks(t.t, t.bl.length * GRID).forEach((x) => tomados.add(x)),
  );
  const dur = S[m.s].m,
    libres = [];
  for (let x = c.a; x + dur <= c.c; x += GRID) {
    if (c.al && x < c.ah && x + dur > c.al) continue;
    if (blocks(hm(x), dur).some((t) => tomados.has(t))) continue;
    libres.push(hm(x));
  }
  return `<div class="card man"><h2 style="margin-top:0">Agendar turno</h2><small>Turno a nombre de un cliente, cargado desde la barbería.</small><h3>Cliente</h3><select style="width:100%" data-ch="agCh" data-args="${A("u", "@v")}"><option value="">Cliente nuevo (nombre abajo)</option>${US(UA).map((u) => `<option value="${esc(u.id)}" ${m.u === u.id ? "selected" : ""}>${esc(u.nm)} · ${esc(u.ph)}</option>`).join("")}</select>${m.u ? "" : `<input id="agnn" placeholder="Nombre del cliente" maxlength="40" value="${esc(m.nm)}" data-in="agInEl" data-args="${A("nm", "@el")}">`}<h3>Servicio</h3><select style="width:100%" data-ch="agCh" data-args="${A("s", "@v")}">${S.map((x, i) => `<option value="${i}" ${m.s === i ? "selected" : ""}>${esc(x.n)} · ${$$(x.p)}</option>`).join("")}</select><h3>Día</h3><select style="width:100%" data-ch="agCh" data-args="${A("d", "@v")}">${daysFor(propio).map((d) => `<option value="${d}" ${m.d === d ? "selected" : ""}>${fd(d)}</option>`).join("")}</select><h3>Hora disponible</h3><select style="width:100%" data-ch="agCh" data-args="${A("t", "@v")}"><option value="">Elegí una hora…</option>${libres.map((t) => `<option value="${t}" ${m.t === t ? "selected" : ""}>${t}</option>`).join("")}</select>${!SB && FN.bs.length ? `<h3>Barbero</h3><div class="chips">${FN.bs.map((b) => `<button class="chip ${propio === b.id ? "on" : ""}" aria-pressed="${propio === b.id}" data-act="agBar" data-args="${A(b.id)}">${esc(b.n)}</button>`).join("")}</div>` : ""}<div class="chips" style="margin-top:16px"><button class="main" style="margin-top:0" data-act="agSave">Agendar</button><button data-act="agX">Cancelar</button></div></div>`;
};
const dnForm = (t) => {
  const l = sv(t).p,
    ch = [
      ["Lista", l],
      ["−20%", Math.round(l * 0.8)],
      ["−50%", Math.round(l * 0.5)],
      ["Gratis", 0],
    ];
  return `<div class="sub"><label for="dm">Monto cobrado ($)</label><input id="dm" inputmode="numeric" maxlength="8" value="${dm}" data-in="setDm" data-args="${A("@el")}"><div class="chips">${ch.map((c) => `<button class="chip ${dm === String(c[1]) ? "on" : ""}" aria-pressed="${!!(dm === String(c[1]))}" data-act="setDmv" data-args="${A(c[1])}">${c[0]} · ${$$(c[1])}</button>`).join("")}</div><label>Medio de pago</label><div class="chips">${MP.map((m) => `<button class="chip ${dp === m ? "on" : ""}" aria-pressed="${!!(dp === m)}" data-act="setDp" data-args="${A(m)}">${m}</button>`).join("")}</div>${barSel()}<div class="chips"><button class="main" ${dm === "" ? "disabled" : ""} data-act="done" data-args="${A(t.id)}">Guardar cobro y completar</button><button data-act="closeX">Volver</button></div></div>`;
};
function turH() {
  const prox = [...T]
      .filter((t) => t.st === "pend")
      .sort((a, b) => (a.d + a.t).localeCompare(b.d + b.t)),
    hist = [...T]
      .filter((t) => t.st !== "pend")
      .sort((a, b) => (b.d + b.t).localeCompare(a.d + a.t));
  const card = (t) => {
    const x = cx === t.id,
      pr = t.st === "hecho" && t.precio != null ? t.precio : sv(t).p;
    return `<div class="card" style="margin-bottom:12px"><div class="appt" style="border:0;background:none;padding:0;margin:0"><div style="display:flex;justify-content:space-between;align-items:center"><b style="font:700 34px 'Barlow Condensed'">${t.t}</b><span class="pill ${t.st === "hecho" ? "st-hecho" : t.st === "cancel" ? "st-cancel" : "st-pend"}">${ST[t.st]}</span></div><small style="color:var(--mut)">${fd(t.d)}</small><br><b>${esc(sv(t).n)}</b><br><small>con ${esc(bn(t) || "—")} · ${esc(sv(t).tx)} · ${$$(pr)}</small></div>${t.st === "pend" && !x ? `<button class="pillb" style="width:100%;margin-top:12px;padding:11px" data-act="askCancel" data-args="${A(t.id)}">Cancelar</button>` : ""}${x ? cxForm(t) : ""}</div>`;
  };
  return (
    `<h1>MIS TURNOS</h1>` +
    `<h3 class="lab">Próximos</h3>` +
    (prox.length ? prox.map(card).join("") : "<p><small>Todavía no reservaste. Tocá “Reservar” para elegir un horario.</small></p>") +
    `<h3 class="lab">Historial</h3>` +
    (hist.length ? hist.map(card).join("") : "<p><small>No hay turnos pasados.</small></p>")
  );
}
const wal = (p, txt) =>
  waNum(p)
    ? `<a href="https://wa.me/${waNum(p)}?text=${encodeURIComponent(txt)}" target="_blank" rel="noopener" aria-label="Chat de WhatsApp"><span class="ic-wa" aria-hidden="true" style="width:34px;height:34px"></span></a>`
    : "<small>sin teléfono</small>";
const recH = () => {
  const hoy = ymd(),
    k = addD(hoy, 1),
    R1 = T.filter((t) => t.d === k && (!SB || isOwner() || t.bid === me.uid)).sort((a, b) => a.t.localeCompare(b.t)),
    E = EW.filter((w) => w.d >= hoy && (!SB || isOwner() || w.bid === me.uid)).sort((a, b) =>
      (a.d + a.en).localeCompare(b.d + b.en),
    );
  return (
    `<h2 style="margin-top:0">Recordatorios de mañana</h2>` +
    (R1.length
      ? R1.map(
          (t) =>
            `<div class="row"><div><b>${esc(t.nm)}</b><br><small>${esc(sv(t).n)} · ${t.t}</small></div>${wal((UA.find((u) => u.id === t.uid) || {}).ph, `Hola ${t.nm}, te recordamos tu turno de mañana a las ${t.t} en ${NOMBRE}. Si no podés venir, avisanos. ¡Gracias!`)}</div>`,
        ).join("")
      : "<p><small>No hay turnos para mañana.</small></p>") +
    (E.length
      ? `<h2>Lista de espera</h2>` +
        E.map(
          (w) =>
            `<div class="row"><div><b>${esc(w.nm)}</b><br><small>${fd(w.d)}</small></div><div class="rt">${wal(w.ph, `Hola ${w.nm}, se liberó un horario el ${fd(w.d)} en ${NOMBRE}. ¿Lo querés? Reservalo desde la web.`)}<button class="x" aria-label="Quitar de la lista" data-act="quitarE" data-args="${A(w.id)}">✕</button></div></div>`,
        ).join("")
      : "")
  );
};
function barH() {
  const hoy = ymd(),
    barbers = FN.bs.filter((b) => (!SB || isOwner() || b.uid === me.uid) && (!bf || b.id === bf)),
    p = [...T]
      .filter((t) => !ag || t.d === ag)
      .filter((t) => !SB || isOwner() || t.bid === me.uid)
      .sort((a, b) => (a.d + a.t).localeCompare(b.d + b.t));
  const mySBFoto = SB && SB.foto ? SB.foto : "";
  return (
    `<div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:10px 14px;max-width:640px">${mySBFoto ? `<img src="${esc(mySBFoto)}" alt="" width="44" height="44" style="border-radius:50%;object-fit:cover">` : `<span class="aval" style="width:44px;height:44px;font-size:20px;flex:0 0 auto">${esc(((SB && SB.n) || (me && me.displayName) || "?")[0].toUpperCase())}</span>`}<div style="flex:1"><b>${esc((SB && SB.n) || (me && me.displayName) || "Tu barbería")}</b><br><small>Tu foto aparece para los clientes al reservar.</small></div><button data-act="fotoTomar" style="flex:0 0 auto">Cambiar foto</button></div>` +
    `<div class="head" style="margin-top:0;flex-wrap:wrap"><div><h1 style="margin-bottom:4px">Agenda</h1><small>${ag ? fd(ag) : "Todos los días"} · ${p.length} ${p.length === 1 ? "turno" : "turnos"}</small></div><div class="chips" style="background:var(--card);border:1px solid var(--line);border-radius:12px;padding:4px">${[["", "Todos"], ...[...new Set([hoy, ...days()])].sort().map((d) => [d, d === hoy ? "Hoy" : fd(d)])].map((a) => `<button class="chip ${ag === a[0] ? "on" : ""}" aria-pressed="${!!(ag === a[0])}" data-act="setAg" data-args="${A(a[0])}" style="border:0">${a[1]}</button>`).join("")}</div><div class="chips"><button data-act="openMan">+ Carga manual</button><button data-act="agOpen">+ Agendar turno</button></div></div>${manH()}${agT ? agH() : ""}<div class="chips" style="margin-bottom:14px">${isOwner() ? [["", "Todos"], ...FN.bs.map((b) => [b.id, b.n])].map((x) => `<button class="chip ${bf === x[0] ? "on" : ""}" data-act="setBf" data-args="${A(x[0])}">${esc(x[1])}</button>`).join("") : ""}</div>` +
    `<div class="cols3">${barbers
      .concat(
        p.some((t) => !t.bid || !FN.bs.some((b) => b.id === t.bid))
          ? [{ id: "__x", n: "Sin asignar" }]
          : [],
      )
      .map((b) => {
        const tt = p.filter((t) => (b.id === "__x" ? !t.bid || !FN.bs.some((x) => x.id === t.bid) : t.bid === b.id));
        return `<div class="bcol"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><span>${(BARS.find((x) => x.id === b.id) || {}).foto ? `<img src="${esc((BARS.find((x) => x.id === b.id) || {}).foto)}" alt="" width="30" height="30" style="border-radius:50%;object-fit:cover;display:inline-grid;vertical-align:middle;margin-right:8px">` : `<span class="aval" style="width:30px;height:30px;font-size:15px;display:inline-grid;vertical-align:middle;margin-right:8px">${esc((b.n || "?")[0].toUpperCase())}</span>`}<b>${esc(b.n)}</b></span><small>${tt.length} turnos</small></div>` +
          (tt.length
            ? tt
                .map(
                  (t) =>
                    `<div class="appt"><div style="display:flex;justify-content:space-between;align-items:center"><div class="h">${t.t}</div><span class="pill ${t.st === "hecho" ? "st-hecho" : t.st === "cancel" ? "st-cancel" : "st-pend"}">${ST[t.st]}</span></div><b>${esc(t.nm)}</b><br><small>${esc(sv(t).n)} · ${esc(sv(t).tx)}</small>${t.st === "pend" ? `<div class="chips" style="margin-top:8px"><button data-act="askDone" data-args="${A(t.id)}">Completó</button><button data-act="askCancel" data-args="${A(t.id)}">Cancelar</button></div>` : ""}${dn === t.id ? dnForm(t) : ""}${cx === t.id ? cxForm(t) : ""}</div>`,
                )
                .join("")
            : `<p><small>Sin turnos este día.</small></p>`) +
          `</div>`;
      })
      .join("")}</div>` +
    `<div style="margin-top:26px">${recH()}</div><h2>Canjes sin usar</h2>` +
    (C.length
      ? C.map(
          (x) =>
            `<div class="row"><div><b>${esc(x.pr)}</b><br><small>${esc(x.nm)}</small><br><span class="code">${esc(x.c)}</span></div><button data-act="askUsed" data-args="${A(x.id)}">Marcar usado</button></div>`,
        ).join("")
      : "<p><small>No hay canjes pendientes.</small></p>")
  );
}
const rng = () => {
  const t = ymd();
  if (per === "hoy") return (d) => d === t;
  if (per === "sem") {
    const a = addD(t, -6);
    return (d) => d >= a && d <= t;
  }
  if (per === "mes") return (d) => d.startsWith(t.slice(0, 7));
  return () => true;
};
function dashH() {
  const f = rng(),
    srt = (a, b) => (b.d + b.t).localeCompare(a.d + a.t),
    L = HA()
      .filter((t) => f(t.d))
      .sort(srt),
    CL = CA.filter((t) => f(t.d)).sort(srt),
    tot = L.reduce((a, t) => a + (t.precio || 0), 0),
    dsc = L.reduce(
      (a, t) => a + Math.max(0, (t.lista || 0) - (t.precio || 0)),
      0,
    ),
    by = {},
    md = {};
  L.forEach((t) => {
    const k = t.serv || sv(t).n,
      m = t.medio || "Sin dato";
    by[k] = by[k] || { n: 0, m: 0 };
    by[k].n++;
    by[k].m += t.precio || 0;
    md[m] = md[m] || { n: 0, m: 0 };
    md[m].n++;
    md[m].m += t.precio || 0;
  });
  const P = [
      ["hoy", "Hoy"],
      ["sem", "7 días"],
      ["mes", "Este mes"],
      ["all", "Todo"],
    ],
    kp = (l, v) => `<div class="card kpi"><small>${l}</small><b>${v}</b></div>`,
    grp = (o) =>
      Object.keys(o).length
        ? `<div class="card">${Object.keys(o)
            .map(
              (k) =>
                `<div class="line"><span><b>${esc(k)}</b> <small>${o[k].n} ${o[k].n === 1 ? "corte" : "cortes"}</small></span><span class="price">${$$(o[k].m)}</span></div>`,
            )
            .join("")}</div>`
        : "<p><small>Todavía no hay cortes en este período.</small></p>";
  const maxBy = Object.values(by).reduce((a, x) => Math.max(a, x.m), 1),
    totMd = Object.values(md).reduce((a, x) => a + x.m, 0) || 1,
    days7 = Array.from({ length: 7 }, (_, i) => addD(ymd(), i - 6)),
    dayChart = days7.map((d) => ({
      d,
      m: HA()
        .filter((t) => t.d === d && f(t.d))
        .reduce((a, t) => a + (t.precio || 0), 0),
    })),
    maxDay = dayChart.reduce((a, x) => Math.max(a, x.m), 1),
    bars = (o, max) =>
      `<div class="card">${Object.keys(o)
        .sort((a, b) => o[b].m - o[a].m)
        .map(
          (k) =>
            `<div class="svcbar"><div class="top"><span>${esc(k)} <small>${o[k].n} ${o[k].n === 1 ? "corte" : "cortes"}</small></span><b>${$$(o[k].m)}</b></div><div class="tr"><i style="width:${Math.round((o[k].m / max) * 100)}%"></i></div></div>`,
        )
        .join("")}</div>`,
    medBar = () => {
      const cols = ["var(--brass)", "#8fa3b8", "#3e8e5a", "#b3382c"];
      const ks = Object.keys(md).sort((a, b) => md[b].m - md[a].m);
      return `<div class="card"><div class="tr" style="display:flex;height:10px">${ks
        .map(
          (k, i) =>
            `<i style="width:${Math.round((md[k].m / totMd) * 100)}%;background:${cols[i % cols.length]}"></i>`,
        )
        .join("")}</div><div style="display:flex;flex-wrap:wrap;gap:14px;margin-top:10px">${ks
        .map(
          (k, i) =>
            `<small><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${cols[i % cols.length]};margin-right:6px"></span>${esc(k)} ${Math.round((md[k].m / totMd) * 100)} %</small>`,
        )
        .join("")}</div></div>`;
    };
  return (
    `<div class="head" style="margin-top:0"><div><h1 style="margin-bottom:4px">Dashboard</h1><small>${new Date().toLocaleDateString("es-AR", { month: "long", year: "numeric" })} · todos los barberos</small></div></div><div class="chips" style="margin-bottom:18px">${P.map((p) => `<button class="chip ${per === p[0] ? "on" : ""}" aria-pressed="${!!(per === p[0])}" data-act="setPer" data-args="${A(p[0])}">${p[1]}</button>`).join("")}</div>` +
    `<div class="kpis">${kp("Cortes realizados", L.length)}${kp("Ingresos cobrados", $$(tot))}${kp("Promedio por corte", $$(L.length ? Math.round(tot / L.length) : 0))}${kp("Turnos cancelados", CL.length)}${kp("Descuentos otorgados", $$(dsc))}${kp("Canjes entregados", CU.length)}</div>` +
    `<div class="card" style="margin-bottom:14px"><h3 class="lab" style="margin-top:0">Ventas por día · últimos 7 días</h3><div class="vchart">${dayChart.map((x) => `<div class="col ${x.d === ymd() ? "hoy" : ""}"><small>${$$(x.m)}</small><i style="height:${Math.max(3, Math.round((x.m / maxDay) * 150))}px"></i><small>${["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"][dow(x.d)]}</small></div>`).join("")}</div></div>` +
    `<div class="grid b"><div><h2 style="margin-top:26px">Ventas por servicio</h2>${bars(by, maxBy)}<h2>Medio de pago</h2>${Object.keys(md).length ? medBar() : "<p><small>Todavía no hay cortes en este período.</small></p>"}</div><div><div class="head"><h2>Registro de cortes</h2><button data-act="exportar" ${L.length ? "" : "disabled"}>Descargar CSV</button></div>` +
    (L.length
      ? '<div class="scr">' +
        L.map(
          (t) =>
            `<div class="row"><div><b>${esc(t.nm)}</b><br><small>${esc(t.serv || sv(t).n)} · ${fd(t.d)} · ${t.t}${t.medio ? " · " + esc(t.medio) : ""}${t.bn ? " · " + esc(t.bn) : ""}${t.man ? " · Manual" : ""}</small></div><div class="rt"><span class="price">${$$(t.precio || 0)}</span>${t.man ? `<button class="x" aria-label="Editar carga" data-act="askEditV" data-args="${A(t.id)}">✎</button>` : ""}</div></div>`,
        ).join("") +
        "</div>"
      : "<p><small>Cuando marques “Completó” en un turno, aparece acá.</small></p>") +
    `</div></div><h2>Cancelaciones</h2>` +
    (CL.length
      ? '<div class="scr">' +
        CL.map(
          (t) =>
            `<div class="row no"><div><b>${esc(t.nm)}</b><br><small>${esc(sv(t).n)} · ${fd(t.d)} · ${t.t}<br>${quien(t)} · ${esc(t.mot || "Sin motivo registrado")}</small></div></div>`,
        ).join("") +
        "</div>"
      : "<p><small>No hubo cancelaciones en este período.</small></p>") +
    (EV ? evH() : "")
  );
}
const evH = () => {
  const m = EV;
  if (!m) return "";
  return `<div class="card man" style="margin-top:18px"><h2 style="margin-top:0">Editar carga manual</h2><input placeholder="Cliente" value="${esc(m.nm)}" data-in="evIn" data-args="${A("nm", "@el")}"><input placeholder="Servicio" value="${esc(m.serv)}" data-in="evIn" data-args="${A("serv", "@el")}"><input placeholder="Precio cobrado ($)" inputmode="numeric" maxlength="8" value="${esc(m.precio)}" data-in="evIn" data-args="${A("precio", "@el")}"><h3 style="margin-top:4px">Medio de pago</h3><div class="chips">${MP.map((p) => `<button class="chip ${m.medio === p ? "on" : ""}" aria-pressed="${m.medio === p}" data-act="evMedio" data-args="${A(p)}">${p}</button>`).join("")}</div><div class="chips" style="margin-top:16px"><button class="main" style="margin-top:0" data-act="saveEditV">Guardar cambios</button><button data-act="evX">Cancelar</button></div></div>`;
};
function barsH() {
  const L = FN.bs
    .filter((b) => b.uid)
    .map((b) => ({ b, u: UA.find((x) => x.id === b.uid) }));
  return (
    `<div class="head" style="margin-top:0"><div><h1 style="margin-bottom:4px">Barberos</h1><small>${L.length + FN.bs.filter((b) => !b.uid).length} barberos en el equipo</small></div><button class="main" style="width:auto;margin-top:0" data-act="addBar">+ Agregar barbero</button></div>` +
    (FN.bs.length
      ? `<div class="cols3">` +
        FN.bs.map((b) => {
          const u = UA.find((x) => x.id === b.uid),
            cortes = HA().filter((t) => t.bid === b.id && t.d.startsWith(ymd().slice(0, 7))).length;
          const farmFoto = (BARS.find((x) => x.id === b.id) || {}).foto || "";
          return `<div class="card" style="text-align:center">${farmFoto ? `<img src="${esc(farmFoto)}" alt="" width="64" height="64" style="border-radius:50%;object-fit:cover;margin:0 auto 12px;display:block">` : `<div class="aval" style="margin:0 auto 12px">${esc((b.n || "?")[0].toUpperCase())}</div>`}<h2 style="margin:0">${esc(b.n)}</h2><small>Dueño ${b.pd}% · Barbero ${100 - b.pd}%</small><div style="margin:12px 0"><span class="pill st-hecho">Activo</span></div><div class="line" style="justify-content:space-around"><span><small>Porcentaje</small><br><b style="color:var(--brass)">${100 - b.pd} %</b></span><span><small>Este mes</small><br><b>${cortes} cortes</b></span></div><div class="chips" style="margin-top:14px"><button style="flex:1" data-act="go" data-args="${A("fin")}">✎ Editar</button><button style="flex:1" data-act="fotoBarbero" data-args="${A(b.id)}">📷 Foto</button>${b.uid ? `<button style="flex:1" data-act="askQuitBar" data-args="${A(b.uid)}">Quitar</button>` : ""}</div></div>`;
        }).join("") +
        `</div>`
      : "<p><small>Todavía no hay barberos con cuenta. Entrá a Clientes y tocá “Hacer barbero” en alguien que ya se registró.</small></p>")
  );
}
function cliH() {
  const own = isOwner(),
    f = cliQ.trim().toLowerCase(),
    L = UA.filter(
      (u) =>
        !u.borrado &&
        u.rol !== "barbero" &&
        !FN.bs.some((b) => b.uid === u.id),
    )
      .filter((u) => !f || String(u.nm).toLowerCase().includes(f) || String(u.ph).includes(f))
      .sort((a, b) => String(a.nm).localeCompare(String(b.nm))),
    L0 = L.slice(0, cliN);
  return (
    `<div class="head" style="margin-top:0"><div><h1 style="margin-bottom:4px">Clientes</h1><small>${L.length} ${L.length === 1 ? "cliente registrado" : "clientes registrados"}</small></div></div>` +
    `<div class="clid"><div><input id="cliq" placeholder="Buscar por nombre o teléfono…" value="${esc(cliQ)}" data-in="cliQIn" data-args="${A("@el")}" style="max-width:420px;margin-bottom:14px">` +
    (L0.length
      ? `<div class="card" style="padding:0;overflow:hidden"><div class="clin chead"><span>Nombre</span><span>Teléfono</span><span>Puntos</span><span>Faltas</span></div>` +
        L0.map((u) => {
          const h = CH[u.id],
            tot = (h || []).reduce((a, t) => a + (t.precio || 0), 0),
            hist = !own
              ? ""
              : h == null
                ? "<small>Cargando historial…</small>"
                : h.length
                  ? '<div class="scr s2">' +
                    h
                      .map(
                        (t) =>
                          `<div class="line"><span>${esc(t.serv || sv(t).n)} <small>${fd(t.d)} · ${t.t}</small></span><b>${$$(t.precio || 0)}</b></div>`,
                      )
                      .join("") +
                    "</div>"
                  : "<small>Todavía no tiene cortes.</small>";
          return `<div class="clin" role="button" style="cursor:pointer;${u.id === cliSel ? "background:#1f2a38;box-shadow:inset 3px 0 var(--brass)" : ""}" data-act="cliSel" data-args="${A(u.id)}"><b>${esc(u.nm)}</b><span>${esc(u.ph || "—")}</span><b style="color:var(--brass)">${u.pt}</b><span style="color:${u.ns > 2 ? "var(--red)" : "inherit"}">${u.ns || 0}</span></div>`;
        }).join("") +
        "</div>" +
        (L.length > cliN
          ? `<div style="text-align:center;margin-top:12px"><button data-act="cliMas">Ver más (${L.length - cliN} restantes)</button></div>`
          : "")
      : `<p><small>No hay clientes ${cliQ ? "que coincidan con la búsqueda" : "registrados"}.</small></p>`) +
      `</div><div id="cliDet">${(() => {
        const selU = UA.find((u) => u.id === cliSel),
          hsel = selU ? CH[selU.id] : null;
        if (!selU)
          return `<div class="card"><small>Elegí un cliente de la lista para ver su detalle.</small></div>`;
        return `<div class="card"><div style="display:flex;gap:14px;align-items:center;margin-bottom:14px">${selU.foto ? `<img src="${esc(selU.foto)}" alt="" width="64" height="64" style="border-radius:50%;object-fit:cover;border:2px solid var(--brass)">` : `<span class="aval">${esc((selU.nm || "?")[0].toUpperCase())}</span>`}<div><b style="font:700 26px 'Barlow Condensed';text-transform:uppercase">${esc(selU.nm)}</b><br><small>${esc(selU.ph || "—")}</small></div></div><div class="grid3"><div class="kv"><small>Puntos</small><b>${selU.pt}</b></div><div class="kv"><small>Cortes</small><b>${(hsel || []).length}</b></div><div class="kv"><small>Faltas</small><b>${selU.ns || 0}</b></div></div><h3 class="lab">Historial</h3>` +
          (!own
            ? `<small>Este detalle lo administra el dueño.</small>`
            : hsel == null
              ? "<small>Cargando historial…</small>"
              : hsel.length
              ? hsel
                  .map(
                    (t) =>
                      `<div class="line"><span><b>${esc(t.serv || sv(t).n)}</b> · ${esc(bn(t) || "—")}<br><small>${fd(t.d)}</small></span><span style="text-align:right"><b>${$$(t.precio || 0)}</b><br><span class="pill st-hecho" style="font-size:11px">Completado</span></span></div>`,
                  )
                  .join("")
              : "<small>Todavía no tiene cortes.</small>") +
          `<div style="margin-top:14px"><a href="https://wa.me/${waNum(selU.ph)}" target="_blank" rel="noopener" aria-label="Chat de WhatsApp"><span class="ic-wa" aria-hidden="true" style="width:50px;height:50px"></span></a>${own && !FN.bs.some((b) => b.uid === selU.id) ? `<button class="pillb" style="width:100%;margin-top:10px;padding:12px" data-act="askBar" data-args="${A(selU.id)}">Hacer barbero</button>` : ""}</div></div>`;
      })()}</div></div>`
  );
}
const hrs = (v, a, b, none) =>
  (none ? `<option value="0" ${v ? "" : "selected"}>${none}</option>` : "") +
  Array.from({ length: (b - a) / 30 + 1 }, (_, i) => a + i * 30)
    .map(
      (m) =>
        `<option value="${m}" ${m === v ? "selected" : ""}>${hm(m)}</option>`,
    )
    .join("");
const svH = () =>
  `<h2>Servicios y precios</h2><div class="card">${(sd || [])
    .map(
      (x, i) =>
        `<div class="svr" style="display:flex;gap:10px;align-items:flex-start"><button type="button" style="flex:0 0 auto;width:74px;height:74px;border-radius:8px;border:1px dashed var(--line);background:#141c26;color:var(--brass);overflow:hidden;padding:0" data-act="svImg" data-args="${A(i)}" aria-label="Imagen del servicio">${x.img ? `<img src="${esc(x.img)}" alt="" width="74" height="74" style="object-fit:cover;display:block">` : '<span style="font-size:22px">📷</span>'}</button><div style="flex:1"><input id="sn${i}" aria-label="Nombre del servicio" placeholder="Nombre" maxlength="40" value="${esc(x.n)}" data-in="svIn" data-args="${A(i, "n", "@el")}"><div class="two"><input id="sp${i}" aria-label="Precio" inputmode="numeric" placeholder="Precio $" value="${esc(x.p)}" data-in="svIn" data-args="${A(i, "p", "@el")}"><input id="sd${i}" aria-label="Duración en minutos" placeholder="Ej: 30-45" value="${esc(x.d)}" data-in="svIn" data-args="${A(i, "d", "@el")}"></div><div class="svf"><small>Duración en minutos</small><button data-act="svDel" data-args="${A(i)}" ${sd.length < 2 ? "disabled" : ""}>Quitar</button></div></div></div>`,
    )
    .join(
      "",
    )}<small>Podés escribir <b>30</b>, <b>30-45</b> o <b>entre 30 a 45 minutos</b>. El cliente ve el rango y la agenda reserva el tiempo máximo.</small><div class="chips" style="margin-top:12px"><button data-act="svAdd">+ Agregar servicio</button></div><button class="main" data-act="svGuardar">Guardar servicios</button></div>`;
function finH() {
  const f = rng(),
    own = isOwner(),
    A0 = HA(),
    L = A0.filter((t) => f(t.d)),
    G = {},
    hoy = ymd(),
    cj = {};
  L.forEach((t) => {
    const k = t.bid || "x",
      m = t.precio || 0,
      o = Math.round((m * (t.pd ?? FN.pd)) / 100);
    const g = (G[k] = G[k] || { n: t.bn || "Sin asignar", c: 0, t: 0, o: 0 });
    g.c++;
    g.t += m;
    g.o += o;
  });
  const hy = A0.filter((t) => t.d === hoy);
  hy.forEach((t) => {
    const m = t.medio || "Sin dato";
    cj[m] = (cj[m] || 0) + (t.precio || 0);
  });
  const GR = Object.values(G).sort((a, b) => b.t - a.t),
    TT = GR.reduce((a, g) => a + g.t, 0),
    OO = GR.reduce((a, g) => a + g.o, 0),
    GL = GA.filter((g) => f(g.d)).sort((a, b) => b.hechoEn - a.hechoEn),
    GT = GL.reduce((a, g) => a + g.m, 0),
    P = [
      ["hoy", "Hoy"],
      ["sem", "7 días"],
      ["mes", "Este mes"],
      ["all", "Todo"],
    ],
    kp = (l, v) => `<div class="card kpi"><small>${l}</small><b>${v}</b></div>`,
    caja = `<h2>Caja de hoy</h2><div class="card">${
      Object.keys(cj)
        .map(
          (k) =>
            `<div class="line"><span>${esc(k)}</span><b>${$$(cj[k])}</b></div>`,
        )
        .join("") || "<small>Todavía no hay cobros hoy.</small>"
    }<div class="line"><span><b>Total</b> <small>${hy.length} ${hy.length === 1 ? "cobro" : "cobros"}</small></span><span class="price">${$$(hy.reduce((a, t) => a + (t.precio || 0), 0))}</span></div></div>`;
  const kps = own
    ? kp("Facturado", $$(TT)) +
      kp("Para el dueño", $$(OO)) +
      kp("Para los barberos", $$(TT - OO)) +
      kp("Gastos", $$(GT)) +
      kp("Neto del dueño", $$(OO - GT))
    : kp("Facturado", $$(TT)) + kp("Mi ganancia", $$(TT - OO));
  const right = own
    ? `<h2>Porcentajes</h2>` +
      (fe
        ? `<div class="card"><small>Porcentaje que se queda el dueño. Se aplica a los cobros nuevos; los anteriores conservan el suyo.</small><h3>% del dueño por defecto</h3><input id="fpd" inputmode="numeric" maxlength="3" value="${esc(fe.pd)}" data-in="feDef" data-args="${A("@el")}">${fe.bs.map((b, i) => `<div class="svr"><input id="fn${i}" aria-label="Nombre del barbero" placeholder="Nombre" maxlength="30" value="${esc(b.n)}" data-in="feIn" data-args="${A(i, "n", "@el")}"><div class="two"><input id="fp${i}" aria-label="Porcentaje del dueño" inputmode="numeric" maxlength="3" value="${esc(b.pd)}" data-in="feIn" data-args="${A(i, "pd", "@el")}"><button data-act="feDel" data-args="${A(i)}" ${fe.bs.length < 2 ? "disabled" : ""}>Quitar</button></div><small>% dueño · el barbero se queda con el resto${b.uid ? " · tiene cuenta propia" : ""}</small></div>`).join("")}<div class="chips"><button data-act="feAdd">+ Agregar barbero sin cuenta</button></div><small style="display:block;margin-top:8px">Para que un barbero entre con su usuario: que se cree una cuenta y usá “Hacer barbero” en Clientes.</small><button class="main" data-act="feGuardar">Guardar porcentajes</button></div>`
        : "") +
      caja
    : caja;
  const gastoBlock =
    `<h2>Gastos</h2><div class="card"><input id="gc" placeholder="Concepto (insumos, alquiler…)" maxlength="40" value="${esc(gx.c)}" data-in="gIn" data-args="${A("c", "@el")}"><input id="gm" inputmode="numeric" placeholder="Monto $" maxlength="8" value="${esc(gx.m)}" data-in="gIn" data-args="${A("m", "@el")}"><button class="main" style="margin-top:0" data-act="gAdd">+ Agregar gasto</button></div>` +
    (GL.length
      ? '<div class="scr" style="margin-top:12px">' +
        GL.map(
          (g) =>
            `<div class="row"><div><b>${esc(g.c)}</b><br><small>${fd(g.d)}</small></div><div class="rt"><span class="price" style="color:var(--red)">− ${$$(g.m)}</span><button class="x" aria-label="Eliminar gasto" data-act="askGDel" data-args="${A(g.id)}">✕</button></div></div>`,
        ).join("") +
        "</div>"
      : "");
  const gastosLista =
    '<h3 class="lab" style="margin-top:0">Gastos</h3>' +
    (GL.length
      ? GL.map(
          (g) =>
            `<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--line)"><div><b>${esc(g.c)}</b><br><small>${fd(g.d)}</small></div><div class="rt"><span style="color:var(--red);font:700 20px 'Barlow Condensed'">− ${$$(g.m)}</span><button class="x" aria-label="Eliminar gasto" data-act="askGDel" data-args="${A(g.id)}">✕</button></div></div>`,
        ).join("")
      : "<p><small>Todavía no hay gastos en este período.</small></p>");
  const gastoForm = `<div class="card" style="margin-top:14px"><input id="gc" placeholder="Concepto (insumos, alquiler…)" maxlength="40" value="${esc(gx.c)}" data-in="gIn" data-args="${A("c", "@el")}"><input id="gm" inputmode="numeric" placeholder="Monto $" maxlength="8" value="${esc(gx.m)}" data-in="gIn" data-args="${A("m", "@el")}"><button class="main" style="margin-top:0" data-act="gAdd">+ Agregar gasto</button></div>`;
  const tablaBarb = `<h3 class="lab" style="margin-top:0">Porcentaje por barbero</h3>` +
    (own && fe
      ? `<div class="card"><div class="bwrap"><div class="clin chead" style="grid-template-columns:44px 1.4fr .6fr 1fr .5fr 1fr"><span></span><span>Barbero</span><span>Cortes</span><span>Facturado</span><span>%</span><span style="text-align:right">Le corresponde</span></div>` +
        (GR.length
          ? GR.map((g, i) => {
              const fe2 = (fe.bs.find((b) => b.n === g.n) || {}),
                pdB = fe2.pd ?? FN.pd,
                borPct = 100 - pdB;
              return `<div class="clin" style="grid-template-columns:44px 1.4fr .6fr 1fr .5fr 1fr"><span class="aval" style="width:36px;height:36px;font-size:16px">${esc((g.n || "?")[0].toUpperCase())}</span><b>${esc(g.n)}</b><span>${g.c}</span><span>${$$(g.t)}</span><span>${borPct} %</span><b style="color:var(--brass);text-align:right">${$$(Math.round((g.t * borPct) / 100))}</b></div>`;
            }).join("")
          : `<p style="padding:14px"><small>Todavía no hay cobros en este período.</small></p>`) +
        `</div>` +
        `<p style="padding:14px 14px 4px;margin:0;border-top:1px solid var(--line)"><small>El porcentaje de cada barbero se cambia desde la pantalla Barberos.</small></p>` +
        (fe
          ? `<details style="padding:0 14px 14px"><summary style="cursor:pointer;color:var(--brass)">Editar porcentajes</summary><small>Porcentaje que se queda el dueño. Se aplica a los cobros nuevos.</small><h3>% del dueño por defecto</h3><input id="fpd" inputmode="numeric" maxlength="3" value="${esc(fe.pd)}" data-in="feDef" data-args="${A("@el")}">${fe.bs.map((b, i) => `<div class="svr"><input id="fn${i}" aria-label="Nombre del barbero" value="${esc(b.n)}" data-in="feIn" data-args="${A(i, "n", "@el")}"><div class="two"><input id="fp${i}" aria-label="Porcentaje del dueño" inputmode="numeric" value="${esc(b.pd)}" data-in="feIn" data-args="${A(i, "pd", "@el")}"><button data-act="feDel" data-args="${A(i)}" ${fe.bs.length < 2 ? "disabled" : ""}>Quitar</button></div></div>`).join("")}<div class="chips"><button data-act="feAdd">+ Agregar barbero sin cuenta</button></div><button class="main" data-act="feGuardar">Guardar porcentajes</button></details>`
          : "") +
        `</div>`
      : `<p><small>Todavía no hay cobros en este período.</small></p>`);
  return (
    `<div class="head" style="margin-top:0"><div><h1 style="margin-bottom:4px">${own ? "Finanzas" : "Mis ganancias"}</h1><small>${new Date().toLocaleDateString("es-AR", { month: "long", year: "numeric" })}</small></div><div class="chips">${P.map((p) => `<button class="chip ${per === p[0] ? "on" : ""}" aria-pressed="${!!(per === p[0])}" data-act="setPer" data-args="${A(p[0])}">${p[1]}</button>`).join("")}<button data-act="exportar">⬇ Exportar CSV</button></div></div>` +
    `<div class="kpis">${own ? kp("Facturado", $$(TT)) + kp("Caja de hoy", $$(hy.reduce((a, t) => a + (t.precio || 0), 0))) + kp("Cortes del período", L.length) : ""}</div>` +
    (own
      ? `<div class="grid b" style="grid-template-columns:minmax(300px,380px) 1fr"><div>${caja}</div><div>${tablaBarb}</div></div>`
      : `<div class="kpis" style="display:none"></div><div class="grid b"><div><h2>${own ? "Ganancia por barbero" : "Detalle"}</h2>` +
        (GR.length
          ? GR.map(
              (g) =>
                `<div class="card bc"><div class="line"><b>${esc(g.n)}</b><small>${g.c} ${g.c === 1 ? "corte" : "cortes"}</small></div><div class="line"><span>Facturado</span><b>${$$(g.t)}</b></div>${own ? `<div class="line"><span>Para el dueño</span><b>${$$(g.o)}</b></div>` : ""}<div class="line"><span>Ganancia del barbero</span><span class="price">${$$(g.t - g.o)}</span></div></div>`,
            ).join("")
          : "<p><small>Todavía no hay cobros en este período.</small></p>") +
        `</div><div>${caja}</div></div>`)
  );
}
function cfgH() {
  const c = cd || CF,
    D = [
      [1, "Lun"],
      [2, "Mar"],
      [3, "Mié"],
      [4, "Jue"],
      [5, "Vie"],
      [6, "Sáb"],
      [0, "Dom"],
    ],
    tab = cfgTab || "hor";
  const horCard = `<h2 style="margin-top:0">Horarios</h2><div class="card"><h3 style="margin-top:0">¿De quién es este horario?</h3><div class="chips"><button class="chip ${cb === "" ? "on" : ""}" aria-pressed="${cb === ""}" data-act="cfgBar" data-args="${A("")}">General</button>${FN.bs.map((b) => `<button class="chip ${cb === b.id ? "on" : ""}" aria-pressed="${cb === b.id}" data-act="cfgBar" data-args="${A(b.id)}">${esc(b.n)}${CF.por && CF.por[b.id] ? "" : " (general)"}</button>`).join("")}</div>${cb && CF.por && CF.por[cb] ? `<p style="margin:10px 0 0"><small>Este barbero tiene horario propio.</small><br><button style="margin-top:8px" data-act="cfgIgualGeneral">Volver al horario general</button></p>` : ""}<h3>Día abierto</h3><div class="chips">${D.map((d) => `<button class="chip ${c.dias.includes(d[0]) ? "on" : ""}" aria-pressed="${!!(c.dias.includes(d[0]))}" data-act="cfgDia" data-args="${A(d[0])}">${d[1]}</button>`).join("")}</div>
<h3>Apertura y cierre</h3><div class="chips"><select aria-label="Apertura" data-ch="cfgSet" data-args="${A("a", "@v")}">${hrs(c.a, 360, 1380)}</select><select aria-label="Cierre" data-ch="cfgSet" data-args="${A("c", "@v")}">${hrs(c.c, 360, 1380)}</select></div>
<h3>Pausa (almuerzo)</h3><div class="chips"><select aria-label="Pausa desde" data-ch="cfgSet" data-args="${A("al", "@v")}">${hrs(c.al, 360, 1380, "Sin pausa")}</select><select aria-label="Pausa hasta" data-ch="cfgSet" data-args="${A("ah", "@v")}">${hrs(c.ah, 360, 1380, "—")}</select></div>
<h3>Días libres (feriados, vacaciones)</h3><div class="chips"><input id="lb" type="date" aria-label="Día libre" style="width:auto;margin:0"><button data-act="cfgLibre">Agregar</button></div><div class="chips" style="margin-top:10px">${c.libres.map((d) => `<button class="chip on" data-act="cfgQuitar" data-args="${A(d)}" aria-label="Quitar ${d}">${fd(d)} ✕</button>`).join("")}</div>
<button class="main" data-act="cfgGuardar">Guardar horarios</button></div>`;
  const svcTab =
    `<div class="grid b"><div>${svH()}</div><div><h2>Premios</h2><div class="card">${PRv.map(
      (p, i) =>
        `<div class="svr"><input id="prn${i}" aria-label="Nombre del premio" placeholder="Nombre" maxlength="30" value="${esc(p.n)}" data-in="rgPrn" data-args="${A(i, "@el")}"><div class="two"><input id="prp${i}" aria-label="Puntos requeridos" inputmode="numeric" placeholder="Puntos" value="${esc(p.p)}" data-in="rgPrp" data-args="${A(i, "@el")}"></div></div>`,
    ).join("")}<small>Editá el nombre y los puntos requeridos de cada premio.</small></div><h2>Reglas de puntos</h2><div class="card"><label>Puntos por corte completado</label><input id="ppts" inputmode="numeric" maxlength="4" value="${esc(PTSv)}" data-in="rgPts" data-args="${A("@el")}"><p><small>Se suman cuando el barbero guarda el cobro.</small></p><h3 style="margin-top:14px">Política de cancelación</h3><label>Cancelar sin cargo hasta (horas antes)</label><input id="pcan" inputmode="numeric" maxlength="3" value="${esc(CHSv)}" data-in="rgCan" data-args="${A("@el")}"></div><button class="main" data-act="rgGuardar">Guardar reglas y premios</button></div></div>`;
  const negTab = `<div class="card" style="max-width:640px"><h2 style="margin-top:0">Negocio</h2><div class="line"><span>Nombre</span><b>${esc(NOMBRE)}</b></div><div class="line"><span>Autor</span><b>${esc(AUTOR)}</b></div><div class="line"><span>WhatsApp</span><b>${esc(WHATSAPP || "—")}</b></div></div>`;
  return `<h1>Ajustes</h1><div class="tabs"><button class="${tab === "hor" ? "on" : ""}" data-act="cfgTab" data-args="${A("hor")}">Horarios</button><button class="${tab === "svc" ? "on" : ""}" data-act="cfgTab" data-args="${A("svc")}">Servicios y premios</button><button class="${tab === "neg" ? "on" : ""}" data-act="cfgTab" data-args="${A("neg")}">Negocio</button></div>` +
    (tab === "svc" ? svcTab : tab === "neg" ? negTab : horCard);
}
function footer() {
  const D = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"],
    dd = [1, 2, 3, 4, 5, 6, 0]
      .filter((d) => CF.dias.includes(d))
      .map((d) => D[d])
      .join(" · ");
  $("#ft").innerHTML =
    `<div class="ft"><div><div class="fb"><img src="${LOGO}" alt="" width="48" height="48"><div><b>${esc(NOMBRE)}</b><small>Turnos online y puntos por cada visita</small></div></div></div><div><h4>Horarios</h4><p>${dd}</p><p>${hm(CF.a)} a ${hm(CF.c)} hs</p></div><div><h4>Contacto</h4>${WHATSAPP ? `<p><a href="https://wa.me/${esc(WHATSAPP)}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:8px;text-decoration:none"><span class="ic-wa" aria-hidden="true" style="width:26px;height:26px"></span>WhatsApp ${esc(WHATSAPP)}</a></p>` : ""}<p><a href="https://www.instagram.com/codigobarber_1" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:8px;text-decoration:none"><span class="ic-ig" aria-hidden="true" style="width:26px;height:26px"></span>@codigobarber_1</a></p><p>Reservá desde la web, sin llamadas.</p></div></div><div class="fz">© ${new Date().getFullYear()} ${esc(NOMBRE)} · Desarrollado por <b>${esc(AUTOR)}</b> · <a href="#" data-act="openPol" style="color:#cbd3dc">Políticas</a> · <a href="#" data-act="openPol" style="color:#cbd3dc">Privacidad</a></div>`;
}
function R() {
  let h,
    nv = "",
    nm = "";
  $("#brand").textContent = NOMBRE;
  $("#lg").src = LOGO;
  document.title = NOMBRE;
  const hd0 = document.querySelector("header");
  if (hd0) hd0.style.display = me ? "" : "none";
  const ft0 = $("#ft");
  if (ft0) ft0.style.display = me ? "" : "none";
  const nav0 = $("#nav");
  if (nav0) {
    nav0.style.display = me ? "" : "none";
    if (!me) nav0.innerHTML = "";
  }
  const appE = $("#app");
  if (appE) {
    appE.style.maxWidth = me ? "" : "100%";
    appE.style.padding = me ? "" : "0";
  }
  $("#lo").hidden = !me;
  document.body.classList.toggle("adm", !!(me && isAdm()));
  document.body.classList.toggle("login", !me);
  const mn2 = me ? (isAdm() ? (SB && SB.n) || "Dueño" : (U && U.nm) || "Cliente") : "";
  $("#mebadge").hidden = !me;
  $("#mefn").textContent = mn2;
  $("#med").textContent = (mn2 || "?").trim()[0].toUpperCase();
  (function () {
    const foto = (SB && SB.foto) || (U && U.foto);
    if (foto) {
      document.querySelector("#med").innerHTML = `<img src="${esc(foto)}" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block">`;
    }
  })();
  if (me && (!rd || (!isAdm() && !U))) {
    pnd = 1;
    busy(1, "Cargando tu cuenta…");
  } else if (ready && (pnd || !boot)) {
    pnd = 0;
    boot = 1;
    busy(0);
  }
  if (me && rd && !rtInit) {
    rtInit = 1;
    const v = rtView();
    if (v && rtOk(v)) prep(v);
    if (!rtOk(view)) view = isAdm() ? (isOwner() ? "dash" : "bar") : "home";
    rtPush(view, !v);
  }
  try {
  if (!me && location.hash === RESERVAR_URL && !authOpen) authOpen = 1;
  if (!me) h = authH();
  else if (!rd) h = "";
  else if (isAdm()) {
    h =
      (isOwner()
        ? { dash: dashH, cli: cliH, bars: barsH, cfg: cfgH, fin: finH, gal: galH }
        : { cli: cliH, fin: finH, gal: galH })[view]?.() ?? barH();
    if (view === "priv") h = privH();
    if (view === "gal") h = galH();
    const own = isOwner(),
      sec = own
        ? [
            ["dash", "Dashboard"],
            ["bar", "Agenda"],
            ["cli", "Clientes"],
            ["bars", "Barberos"],
            ["fin", "Finanzas"],
            ["cfg", "Ajustes"],
            ["gal", "Galería"],
          ]
        : [
            ["bar", "Agenda"],
            ["cli", "Clientes"],
            ["fin", "Mis ganancias"],
            ["gal", "Galería"],
          ],
      extra = [],
      bt1 = (a) =>
        `<button class="${view === a[0] ? "on" : ""}"${view === a[0] ? ' aria-current="page"' : ""} data-act="go" data-args="${A(a[0])}">${a[1]}</button>`;
    nv = sec.map(bt1).join("");
    nm =
      [...sec, ...extra].map(bt1).join("") +
      `<button class="salir" data-act="salir">Cerrar sesión</button>`;
  } else if (!U) h = "<p><small>Cargando tu cuenta…</small></p>";
  else {
    h =
      view === "res" ? resH() : view === "tur" ? turH() : view === "priv" ? privH() : view === "rev" ? revH() : homeH();
    const ICO = {
      home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>',
      res: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
      tur: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
      rev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>',
    };
    nv = [
      ["home", "Inicio"],
      ["res", "Reservar"],
      ["tur", "Mis turnos"],
      ["rev", "Reseña"],
    ]
      .map(
        (a) =>
          `<button class="${view === a[0] ? "on" : ""}" data-act="go" data-args="${A(a[0])}">${ICO[a[0]]}<span>${a[1]}</span></button>`,
      )
      .join("");
    nm =
      `<button data-act="openPol">Políticas</button><button data-act="openPol">Privacidad</button><button class="salir" data-act="salir">Cerrar sesión</button>`;
  }
  } catch (e) {
    console.error("render", e);
    h = `<p class="msg">No se pudo mostrar esta vista: ${esc(e && e.message ? e.message : e)}</p>`;
  }
  const ae = document.activeElement,
    aid = ae && ae.tagName === "INPUT" ? ae.id : "";
  $("#nav").innerHTML = nv;
  const nmE = $("#nmenu");
  nmE.innerHTML = nm;
  nmE.hidden = !(navOpen && me && rd);
  const hb = $("#hamb");
  hb.hidden = !me || !rd || !isAdm();
  hb.setAttribute("aria-expanded", navOpen ? "true" : "false");
  $("#app").innerHTML = (msg ? `<p class="msg">${esc(msg)}</p>` : "") + h;
  setupReveal();
  footer();
  msg = "";
  if (aid) {
    const e = $("#" + aid);
    if (e) {
      e.focus();
      try {
        e.setSelectionRange(e.value.length, e.value.length);
      } catch (_) {}
    }
  }
}
document.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" || me || e.target.tagName !== "INPUT") return;
  e.preventDefault();
  tab === "up" ? W.registro() : tab === "rec" ? W.olvide() : W.entrar();
});
document.addEventListener("keydown", (e) => {
  if ($("#mo").hidden) return;
  if (e.key === "Escape") Mx();
  if (e.key === "Tab") {
    const b = [...$("#mo").querySelectorAll("button")],
      i = b.indexOf(document.activeElement);
    e.preventDefault();
    b[(i + (e.shiftKey ? -1 : 1) + b.length) % b.length].focus();
  }
});
window.__ok = 1; // la usa boot.js para saber que la app cargó
/* Botón flotante: subir para arriba */
(() => {
  const w = document.createElement("div");
  w.id = "site-actions";
  w.innerHTML =
    `<button id="up-f" aria-label="Subir para arriba">↑</button>`;
  document.body.appendChild(w);
  const up = w.querySelector("#up-f");
  up.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  const sync = () => w.classList.toggle("scrolled", window.scrollY > 300);
  window.addEventListener("scroll", sync, { passive: true });
  sync();
})();
R();

/* ---------- handlers del asistente (compartidos por panel y modal) ---------- */
Object.assign(ACT, {
  wzAbrir() {
    WZ.paso = 1;
    WZ.turno = "";
    sel.t = "";
    WZ.mes = ymd().slice(0, 7);
    const p = document.getElementById("wzm");
    if (p) { p.innerHTML = wzModal(); p.hidden = false; document.body.classList.add("wz-abierto"); }
    WZ.pintar();
  },
  wzCerrar() {
    wzCerrarModal();
  },
  wzNext() {
    const listo = [
      S.length > 0, !!sel.b, !!sel.d, !!WZ.turno, !!sel.t, true,
    ][WZ.paso - 1];
    if (!listo) return;
    /* al cambiar de barbero o de servicio se cae la disponibilidad elegida */
    WZ.paso = Math.min(6, WZ.paso + 1);
    if (WZ.paso === 3 && !WZ.unsub) wzOcc();
    WZ.pintar();
  },
  wzBack() {
    WZ.paso = Math.max(1, WZ.paso - 1);
    WZ.pintar();
  },
  wzS(i) {
    sel.s = +i;
    sel.t = "";
    WZ.turno = "";
    WZ.pintar();
  },
  wzB(id) {
    sel.b = id;
    sel.d = "";
    sel.t = "";
    WZ.turno = "";
    if (WZ.paso > 2) WZ.paso = 2;
    WZ.pintar();
  },
  wzD(d) {
    sel.d = d;
    sel.t = "";
    WZ.turno = "";
    if (WZ.paso > 3) WZ.paso = 3;
    WZ.pintar();
  },
  wzT(k) {
    WZ.turno = k;
    sel.t = "";
    WZ.pintar();
  },
  wzH(t) {
    sel.t = sel.t === t ? "" : t;
    WZ.pintar();
  },
  wzMes(k) {
    const [a, m] = WZ.mes.split("-").map(Number);
    const n = new Date(a, m - 1 + k, 1);
    const hoy = ymd().slice(0, 7);
    const key = n.toISOString().slice(0, 7);
    /* no dejar navegar a meses pasados */
    WZ.mes = key < hoy ? hoy : key;
    if (sel.d && sel.d.slice(0, 7) !== WZ.mes) { sel.d = ""; sel.t = ""; WZ.turno = ""; }
    wzOcc.unsubscribe();
    WZ.unsub = null;
    wzOcc();
    WZ.pintar();
  },
  /* Sin sesión: cierra el modal y deja el login por delante. El cierre es
     lo que arregla el "queda colgado": antes el modal seguía abierto
     tapando el login, así que el paso 6 se veía congelado y sin salida. */
  wzEntrar() {
    if (me && rd) return ACT.askBook();
    wzCerrarModal();
    /* si ya eligió hora, al loguearse vuelve al resumen en vez de
     arrancar de nuevo en el paso 1 */
    WZ.resumir = !!sel.t;
    if (location.hash !== "#/reservar")
      history.replaceState(null, "", "#/reservar");
    authOpen = 1;
    R();
  },
});

/* Repinta según dónde vive el asistente: el modal se solo, el panel con R(). */
WZ.pintar = () => {
  const p = document.getElementById("wzm");
  if (p && !p.hidden) { p.innerHTML = wzModal(); return; }
  R();
};
