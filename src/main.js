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
  TESTS = x.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => ((b.fecha && b.fecha.toMillis()) || 0) - ((a.fecha && a.fecha.toMillis()) || 0))
    .slice(0, 6);
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
  if (v === "res") resStep = 1;
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
    if (enviarContacto.estado === "enviando") return;
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
    enviarContacto.estado = "enviando";
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
      enviarContacto.estado = "";
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
    try {
      await signInWithEmailAndPassword(
        auth,
        $("#ie").value.trim(),
        $("#ip").value,
      );
    } catch (e) {
      err(e);
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
        ok: wa ? '<img src="assets/whatsapp.png" alt="" width="22" style="vertical-align:-5px;margin-right:6px">Avisar por WhatsApp' : "Listo",
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
        ok: wa ? '<img src="assets/whatsapp.png" alt="" width="22" style="vertical-align:-5px;margin-right:6px">Escribir por WhatsApp' : "Entendido",
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
function landingH() {
  const daysTxt = [1, 2, 3, 4, 5, 6, 0]
      .filter((d) => CF.dias.includes(d))
      .map((d) => ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"][d])
      .join(" · "),
    mapQ = "-25.618,-54.5701752",
    bizCard = `<div class="lnd-biz-card">
        <img class="lnd-biz-ico" src="${LOGO}" alt="" width="120" height="120" style="border-radius:18px"/>
        <h3 style="font-family:'Barlow Condensed',sans-serif;font-size:1.8rem;margin:8px 0 2px">Codigo Barber 1</h3>
        <div style="color:#F5F0E6;font-weight:600">5.0 <span style="color:#D4A84B">★★★★★</span> <small style="color:#9AA6B4;font-weight:400">(100+ visitas)</small></div>
        <a class="lnd-cta" href="${RESERVAR_URL}" style="width:100%;max-width:240px;margin:12px auto 4px">Reservar ahora</a>
        <div style="color:#9AA6B4;font-size:.9rem;margin-top:8px"><b style="color:#F5F0E6">Lun · Mar · Mié · Jue</b><br/>09:00 a 17:00 hs</div>
        <div class="lnd-biz-addr"><span class="lnd-biz-addr-ic">📍</span><div><small>Dirección</small><b>201 Huanukui Rd, Chartwell Mall (ejemplo)</b></div></div>
      </div>`;
  return `<div class="lnd">
  <header class="lnd-hd">
    <a class="lnd-br" href="#inicio"><img src="${LOGO}" alt="" width="54" height="54"><b>${esc(NOMBRE)}</b></a>
    <nav class="lnd-nv" id="lndMenu">
      <a href="#inicio">Inicio</a><a href="#acerca">Acerca de</a><a href="#servicios">Servicios</a><a href="#galeria">Galería</a><a href="#contacto">Contacto</a>
      <a class="lnd-nv-cta" href="${RESERVAR_URL}">Reservar ahora</a>
    </nav>
    <button class="lnd-hamb" id="lndHamb" data-act="toggleLndMenu" aria-label="Abrir menú" aria-expanded="false" aria-controls="lndMenu">
      <span></span><span></span><span></span>
    </button>
    <a class="lnd-nav-cta" href="${RESERVAR_URL}">Reservar ahora</a>
  </header>
  <section id="inicio" class="lnd-hero reveal">
    <div class="lnd-hero-tx">
      <small>BARBERÍA · TURNOS ONLINE</small>
      <h1>Tu turno,<br>sin esperas.</h1>
      <p>Reservá en menos de un minuto y sumá puntos en cada visita.</p>
      <div class="lnd-ctas">
        <a class="lnd-cta big" href="${RESERVAR_URL}">Reservar ahora</a>
      </div>
      <p class="lnd-note"><b>20 puntos</b> de bienvenida<br><small>Canjealo por descuentos o un corte gratis</small></p>
    </div>
    <div class="lnd-hero-img" style="background:linear-gradient(180deg,#192431,#10171F);display:flex;flex-direction:column;justify-content:center;gap:6px">
      <h3 style="font-family:'Barlow Condensed',sans-serif;font-size:1.8rem;margin:0;color:#F5F0E6">20 puntos de bienvenida</h3>
      <p style="margin:0;color:#9AA6B4">Regístrate y canjearlos por descuentos o un corte gratis en tu primera visita.</p>
    </div>
  </section>
  <div class="lnd-split">
    <div class="lnd-main">
  <section class="lnd-sec reveal">
    <small>PASO A PASO</small>
    <h2>CÓMO FUNCIONA</h2>
    <div class="lnd-steps">
      <div class="lnd-step"><b>01</b><h3>Elegí tu servicio</h3><p>Corte, barba o los dos. El precio final se muestra al confirmar.</p></div>
      <div class="lnd-step"><b>02</b><h3>Reservá tu horario</h3><p>Turnos online, sin llamadas. Si no hay lugar ese día, sumate a la lista de espera.</p></div>
      <div class="lnd-step"><b>03</b><h3>Sumá puntos</h3><p>Sumás puntos por cada corte que canjeás por descuentos o un corte gratis.</p></div>
    </div>
  </section>
  <section id="acerca" class="lnd-sec reveal">
    <small>QUIÉNES SOMOS</small>
    <h2>ACERCA DE</h2>
    <div class="lnd-cols">
      <p>En <b>${esc(NOMBRE)}</b> te atendemos con turnos online para que no pierdas tiempo esperando. Los barberos cargan tu perfil. Los clientes suman puntos por cada corte y los canjeás por descuentos o un corte gratis.</p>
      <div class="lnd-about-cards">
        <div class="lnd-mini"><i>🕒</i><div><b>Lista de espera</b><p>Si no hay horario ese día, podés sumarte a la lista: te avisamos apenas se libere uno.</p></div></div>
        <div class="lnd-mini"><i>🔔</i><div><b>Avisos por WhatsApp</b><p>Los barberos te avisan con anticipación para cancelar: así lo harías lo libera.</p></div></div>
      </div>
    </div>
  </section>
  <section id="servicios" class="lnd-sec reveal">
    <small>LO QUE HACEMOS</small>
    <h2>SERVICIOS</h2>
    <p class="lnd-note-right">El precio final se muestra al confirmar.</p>
    <div class="lnd-biz-m">${bizCard}</div>
    <div class="lnd-svs">
      ${S.map(
        (x) => `<div class="lnd-sv">
          <i class="lnd-svc-ico">${x.img ? `<img class="lnd-sv-img" src="${esc(x.img)}" alt="${esc(x.n)}" loading="lazy">` : `<span>✂</span>`}</i>
          <b>${esc(x.n)}</b>
          <small>${esc(x.tx)}${x.p ? "" : ""}</small>
          ${x.tag ? `<em class="lnd-tag">${esc(x.tag)}</em>` : ""}
          <div class="lnd-sv-ft">
            <b class="lnd-price">${$$(x.p)}</b>
            <button class="lnd-rtt" data-act="goLogin">Reservar</button>
          </div>
        </div>`,
      ).join("")}
    </div>
  </section>
  <section class="lnd-sec reveal" id="cta">
    <div class="lnd-cta-card">
      <div>
        <h2>¿LISTO PARA TU PRÓXIMO CORTE?</h2>
        <p>Reservá online y arrancá sumando puntos desde tu primera visita.</p>
      </div>
      <a class="lnd-cta big" href="${RESERVAR_URL}">Reservar ahora</a>
    </div>
  </section>
  <section id="testimonios" class="lnd-sec reveal">
    <small>Reseñas</small>
    <h2>TESTIMONIOS</h2>
    <div class="lnd-g" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px">
      ${TESTS && TESTS.length
        ? TESTS.slice(0,3)
            .map(
              (t) => `
        <article style="background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px;display:flex;gap:10px;align-items:flex-start">
          ${t.foto ? `<img src="${esc(t.foto)}" alt="" width="44" height="44" style="border-radius:50%;object-fit:cover;flex:0 0 auto"/>` : `<div class="aval" style="width:44px;height:44px;font-size:18px;flex:0 0 auto">${esc((t.nm || "?")[0].toUpperCase())}</div>`}
          <div style="flex:1;min-width:0">
            <b>${esc(t.nm || "Cliente")}</b><br/>
            <small style="color:var(--brass)">${"★".repeat(Math.min(5, Math.max(1, t.estrellas || 5)))}${"☆".repeat(5 - Math.min(5, Math.max(1, t.estrellas || 5)))}</small><br/>
            <p style="margin:6px 0 0;color:var(--mut)">${esc(t.texto || "Muy conforme con la atención.")}</p>
          </div>
        </article>`,
            )
            .join("")
        : `<p><small>Todavía no hay testimonios. Cuando un cliente deja una reseña se muestra acá.</small></p>`}
    </div>
  </section>
  <section id="galeria" class="lnd-sec reveal">
    <small>NUESTRO TRABAJO</small>
    <h2>GALERÍA</h2>
    <p class="lnd-note-right">${GAL && GAL.length ? "" : "Todavía no hay fotos publicadas: las 4 fotos placeholders se verán cuando las cargues."}</p>
    <div class="lnd-gal">
      ${GAL && GAL.length
        ? GAL.map((g) => `<img src="${esc(g.url)}" alt="Trabajo de la barbería" loading="lazy">`).join("")
        : [1, 2, 3, 4]
            .map(
              (i) => `<figure class="lnd-ph"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-7 7"/></svg><figcaption>[ FOTO ${i} ]</figcaption></figure>`,
            )
            .join("")}
    </div>
  </section>
  <section id="contacto" class="lnd-sec reveal">
    <small>VISITANOS</small>
    <h2>CONTACTO</h2>
    <div class="lnd-card" style="margin-bottom:24px">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:24px;flex-wrap:wrap">
        <div style="min-effort:0">
          <small>ESCRIBINOS</small>
          <h3 style="margin:6px 0 10px">¿Querés coordinar turno rápido?</h3>
          <p style="margin:0;color:var(--mut)">Reservá desde la web, sin llamadas.</p>
        </div>
        <div class="contact-cta">
          <a class="btn-contact" href="https://wa.me/${esc(WHATSAPP)}" target="_blank" rel="noopener" aria-label="Chatear por WhatsApp"><img src="assets/whatsapp.png" alt="" width="20" height="20"> WhatsApp</a>
          <a class="btn-contact" href="https://www.instagram.com/${esc(INSTAGRAM)}" target="_blank" rel="noopener" aria-label="Instagram"><img src="assets/instagram.png" alt="" width="20" height="20"> Instagram</a>
          <a class="btn-contact" href="mailto:${esc(EMAIL)}" aria-label="Enviar email">✉️ Correo</a>
        </div>
      </div>
    </div>
    <div class="lnd-cols">
      <div class="lnd-card">
        <div class="lnd-map">
          <iframe title="Ubicación" loading="lazy" src="${MAP_IFRAME}" allowfullscreen></iframe>
          <p class="lnd-map-cap"><span>📍 <b>[DIRECCIÓN]</b></span><a href="https://www.google.com/maps/search/?api=1&query=-25.618,-54.5701752" target="_blank" rel="noopener" style="margin-left:auto;color:var(--brass);font-weight:600;text-decoration:none">CÓMO LLEGAR →</a></p>
        </div>
      </div>
      <div class="lnd-card">
        <small>CONSULTAS</small>
        <h2 style="margin-top:4px">DEJANOS TU MENSAJE</h2>
        <p style="color:var(--mut);margin:0 0 16px">Contános qué necesitás y te respondemos por email lo antes posible.</p>
        <div class="lnd-contacto-grid" style="grid-template-columns:1fr;gap:12px;margin-top:0">
          <h3>Nombre</h3><input type="text" id="cf-name" placeholder="Nombre" autocomplete="name">
          <h3>Email <b class="red">*</b></h3><input type="email" id="cf-email" placeholder="Email" autocomplete="email" required>
          <h3>Mensaje</h3><textarea id="cf-msg" rows="5" placeholder="Mensaje"></textarea>
          <button class="lnd-cta big lnd-send" id="cfSend" data-act="enviarContacto">ENVIAR MENSAJE</button>
          <p id="cf-status" role="status" aria-live="polite"></p>
        </div>
      </div>
    </div>
  </section>
    </div>
    <aside class="lnd-side">${bizCard}</aside>
  </div>
  <footer class="lnd-ft">
    <p><b>${esc(NOMBRE)}</b> · Desarrollado por ${esc(AUTOR)}</p>
    <p><a href="#" data-act="openPol">Políticas</a> · <a href="#" data-act="openPol">Privacidad</a></p>
  </footer>
</div>`;
}
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
function resH() {
  const f = slots(),
    s = S[sel.s],
    dows = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"],
    steps = `<div class="stepline"><button class="lnk2 mut" style="margin:0" data-act="resBack">← Atrás</button><small>Paso ${resStep} de 4</small></div><div class="steps">${[1, 2, 3, 4].map((i) => `<i class="${resStep >= i ? "on" : ""}"></i>`).join("")}</div>`;
  const barberName = (BARS.find((b) => b.id === sel.b) || {}).n || "—";
  const dayChips = `<div class="daychips">${days()
    .map(
      (d) =>
        `<button class="daychip ${d === sel.d ? "on" : ""}" data-act="setDay" data-args="${A(d)}"><small>${dows[dow(d)]}</small><br><b>${d.slice(8)}</b></button>`,
    )
    .join("")}</div>`;
  const timeGrid = f.length
    ? `<div class="times">${f
        .map(
          (t) =>
            `<button class="time ${t == sel.t ? "on" : ""}" data-act="selT" data-args="${A(t)}">${t}</button>`,
        )
        .join("")}</div>`
    : `<div class="card"><h2 style="margin-top:0">${fd(sel.d)} · SIN HORARIOS</h2><small>Ya no quedan turnos libres ese día.</small><div style="margin-top:12px">${EW.some((w) => w.d === sel.d && w.bid === sel.b) ? "<small>✓ Estás en la lista de espera de este día.</small>" : `<button class="pillb" style="width:100%;padding:14px" data-act="espera">Avisame si se libera</button>`}</div></div>`;
  let body = "";
  if (resStep === 1)
    body =
      steps +
      `<h1>ELEGÍ TU BARBERO</h1>` +
      (BARS.length
        ? BARS.map(
            (b) =>
              `<button class="barber ${b.id === sel.b ? "on" : ""}" data-act="setBar" data-args="${A(b.id)}"><span class="b">${b.foto ? `<img src="${esc(b.foto)}" alt="" width="100%" height="100%" style="border-radius:50%;object-fit:cover;display:block">` : esc((b.n || "?")[0].toUpperCase())}</span><span><b>${esc(b.n)}</b><br><small>Barbero</small></span></button>`,
          ).join("")
        : "<small>Todavía no hay barberos disponibles.</small>") +
      `<button class="main" style="margin-top:18px" data-act="resNext">Continuar</button>`;
  else if (resStep === 2)
    body =
      steps +
      `<h1>ELEGÍ EL SERVICIO</h1><small style="color:var(--mut)">Con ${esc(barberName)}</small>` +
      S.map(
        (x, i) =>
          `<button class="svc ${i == sel.s ? "on" : ""}" style="width:100%;text-align:left" data-act="selS" data-args="${A(i)}"><div class="r">${x.img ? `<img src="${esc(x.img)}" alt="" width="56" height="56" style="border-radius:10px;object-fit:cover;flex:0 0 auto">` : ""}<span><b>${x.n}</b><br><small>${esc(x.tx)}</small></span><span class="pr">${$$(x.p)}</span></div></button>`,
      ).join("") +
      `<button class="main" style="margin-top:18px" data-act="resNext">Continuar</button>`;
  else if (resStep === 3)
    body =
      steps +
      `<h1>ELEGÍ DÍA Y HORA</h1><small style="color:var(--mut)">${esc(s.n)} · ${esc(s.tx)} · con ${esc(barberName)}</small><div class="lab">Día · Octubre</div>${dayChips}<div class="lab">Hora</div>${timeGrid}<button class="main" style="margin-top:18px" ${sel.t ? "" : "disabled"} data-act="resNext">Continuar al resumen</button>`;
  else
    body =
      steps +
      `<h1>REVISÁ TU TURNO</h1><div class="card"><div class="line"><span style="color:var(--mut)">Barbero</span><b>${esc(barberName)}</b></div><div class="line"><span style="color:var(--mut)">Servicio</span><b>${esc(s.n)}</b></div><div class="line"><span style="color:var(--mut)">Fecha</span><b>${fd(sel.d)}</b></div><div class="line"><span style="color:var(--mut)">Hora</span><b>${sel.t || "—"}</b></div><div class="line"><span style="color:var(--mut)">Duración</span><b>${esc(s.tx)}</b></div><div class="line"><span style="color:var(--brass)">Precio</span><b class="price" style="color:var(--brass)">${$$(s.p)}</b></div></div><p><small>Política de cancelación: podés cancelar tu turno hasta ${CHSv} horas antes.</small></p><button class="main" data-act="askBook">Confirmar turno</button>${MP_LINK ? `<a href="${esc(MP_LINK)}" target="_blank" rel="noopener" class="pillb" style="display:block;text-align:center;width:100%;margin-top:10px;padding:14px;text-decoration:none">Pagar seña con Mercado Pago</a>` : ""}`;
  return `<div style="max-width:560px;margin:0 auto">${body}</div>`;
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
    ? `<a href="https://wa.me/${waNum(p)}?text=${encodeURIComponent(txt)}" target="_blank" rel="noopener" aria-label="Chat de WhatsApp"><img src="assets/whatsapp.png" alt="Chat de WhatsApp" width="34"></a>`
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
          `<div style="margin-top:14px"><a href="https://wa.me/${waNum(selU.ph)}" target="_blank" rel="noopener" aria-label="Chat de WhatsApp"><img src="assets/whatsapp.png" alt="Chat de WhatsApp" width="50"></a>${own && !FN.bs.some((b) => b.uid === selU.id) ? `<button class="pillb" style="width:100%;margin-top:10px;padding:12px" data-act="askBar" data-args="${A(selU.id)}">Hacer barbero</button>` : ""}</div></div>`;
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
    `<div class="ft"><div><div class="fb"><img src="${LOGO}" alt="" width="48" height="48"><div><b>${esc(NOMBRE)}</b><small>Turnos online y puntos por cada visita</small></div></div></div><div><h4>Horarios</h4><p>${dd}</p><p>${hm(CF.a)} a ${hm(CF.c)} hs</p></div><div><h4>Contacto</h4>${WHATSAPP ? `<p><a href="https://wa.me/${esc(WHATSAPP)}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:8px;text-decoration:none"><img src="assets/whatsapp.png" alt="Chat de WhatsApp" width="26">WhatsApp ${esc(WHATSAPP)}</a></p>` : ""}<p><a href="https://www.instagram.com/codigobarber_1" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:8px;text-decoration:none"><img src="assets/instagram.png" alt="Instagram" width="26" height="26" style="border-radius:6px">@codigobarber_1</a></p><p>Reservá desde la web, sin llamadas.</p></div></div><div class="fz">© ${new Date().getFullYear()} ${esc(NOMBRE)} · Desarrollado por <b>${esc(AUTOR)}</b> · <a href="#" data-act="openPol" style="color:#cbd3dc">Políticas</a> · <a href="#" data-act="openPol" style="color:#cbd3dc">Privacidad</a></div>`;
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
