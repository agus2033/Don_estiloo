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
  updatePassword,
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
  /* Necesarios para la pantalla de Mensajes: la lista se pide ordenada
     por fecha y acotada. Sin índice compuesto hace falta, porque no hay
     filtros: un solo orderBy no lo requiere. */
  orderBy,
  limit,
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
  WA_LISTA,
  INSTAGRAM,
  RESERVAR_URL,
  MAP_IFRAME,
  BARRIO,
  CALLE,
  CIUDAD,
  PROVINCIA,
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

  /* `esc()` no alcanza para un href: escapa las comillas y nicely, pero un
     `javascript:alert(...)` no tiene comillas que escapar y sigue siendo un
     href válido que se ejecuta al hacer clic. Las redes del barbero salen de
     `#pfRedes`, que el propio barbero escribe, y antes iban tal cual:
     cualquiera que fuera barbero podía dejar un enlace que, al clickearlo,
     corría código en la web pública. Sólo se aceptan http(s). */
  const urlSegura = (u) => {
    const s = String(u == null ? "" : u).trim();
    return /^https?:\/\//i.test(s) ? esc(s) : "#";
  };
/* Formatea un importe. Antes: "$" + n.toLocaleString("es-AR"). El problema es
   que String.prototype.toLocaleString() devuelve la CADENA TAL CUAL, así que
   si el valor no era un número (por ejemplo el "precio" de un turno escrito a
   mano con HTML adentro) pasaba entero al innerHTML del Dashboard y del
   historial de clientes: XSS almacenado. Ahora convierte a número y, si no
   sale algo numérico, muestra $0 en vez de inyectar nada. */
const $$ = (n) => {
  const v = Number(n);
  return "$" + (Number.isFinite(v) ? v.toLocaleString("es-AR") : "0");
};

/* Cómo se ve un cliente en las listas del panel.
   esc() hace String(s), así que un usuario sin nombre o sin teléfono
   aparecía literalmente como "undefined" en el <option> del selector de
   clientes y en la lista de Clientes. No se inventa nada: si el dato no
   está, se dice que no está. */
const etqUsuario = (u) => {
  const nm = String(u.nm || "").trim();
  const ph = String(u.ph || "").trim();
  if (nm && ph) return nm + " · " + ph;
  if (nm) return nm + " · sin teléfono";
  if (ph) return ph;
  return "Cliente sin nombre ni teléfono";
};
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
  /* Puntos de bienvenida al crear la cuenta. Configurable desde Servicios y
     Premios (el dueño lo pidió); antes eran 20 fijos en el código. */
  PTSRv = 20,
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
/* Reescribe una url de Cloudinary para que sirva la imagen liviana.
   `f_auto` = AVIF/WebP si el navegador lo banca; `q_auto` = la calidad que
   Cloudinary calcula para esa imagen; `w_` = el ancho que de verdad se pinta.

   Con cualquier otra url (una foto a mano, un data:, un "") devuelve la misma
   cosa, así que se puede aplicar sin miedo en cualquier <img>. */
const imgCld = (u, ancho) => {
  const s = String(u || "");
  const m = s.match(/^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/(v\d+)\/(.+)$/);
  if (!m) return s;
  /* OJO con el ORDEN: la transformacion va ANTES de la version, no
     despues. La url cruda es .../upload/v1791822041/codigo-barber-1/... y el
     formato de Cloudinary es .../upload/<transformacion>/<version>/<public_id>.
     Con la version primero daba 404 en TODAS las imagenes y ninguna se veia.
     Comprobado contra el servicio: con el orden viejo, HTTP 404; con este,
     HTTP 200. */
  return `https://res.cloudinary.com/${s.split("/")[3]}/image/upload/f_auto,q_auto,w_${Math.max(200, Number(ancho) || 800)}/${m[1]}/${m[2]}`;
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

/* Loader para las consultas en VIVO (los onSnapshot de `ocupados`).

   Las escrituras ya pasan por `wait()`, que lo muestra y lo apaga solo. Pero
   las lecturas con `onSnapshot` son distintas: no "terminan", se quedan
   escuchando. Si se pusiera el loader en cada llegada, aparecería y
   desaparecería cada vez que alguien reserva en el medio y se leería como un
   parpadeo constante. Por eso estos dos avisos son sólo para la PRIMERA
   respuesta de cada consulta: mientras no hay datos no se muestran huecos
   como si estuvieran libres.

   El mínimo de 420 ms en pantalla evita el otro extremo: con una respuesta
   rápida el loader se vería menos de un cuadro y parecería un fogonazo. */
let ldT0 = 0,
  ldFin = 0;
const ldEspera = (t) => {
  clearTimeout(ldFin);
  ldT0 = Date.now();
  busy(1, t || "Consultando horarios…", 1);
};
const ldListo = () => {
  const queda = 420 - (Date.now() - ldT0);
  clearTimeout(ldFin);
  ldFin = setTimeout(() => busy(0), queda > 0 ? queda : 0);
};

/* Llegaron los datos públicos (servicios, barberos, horario).

   `R()` repinta la página pero NO el modal del asistente (#wzm): sólo lo hace
   `WZ.pintar()`. Con red lenta —o en la primera visita, sin caché— el usuario
   aprieta "Reservar" antes de que lleguen y el paso 2 se le pintaba con la
   lista de barberos vacía y el botón "Siguiente" deshabilitado, porque `sel.b`
   no tenía nada elegido. Como el modal no se volvía a pintar nunca más, el
   asistente quedaba trancado para siempre: sin error y sin salida. */
function datosLlegos() {
  const z = document.getElementById("wzm");
  if (z && !z.hidden) {
    WZ.pintar();
    /* El loader se apaga con los SERVICIOS, que es lo que el primer paso
       necesita para no arrancar vacío. La lista de barberos se repinta igual
       (arriba) y, si viene vacía, el asistente lo dice con su propio cartel:
       dejarlo prendido iba a tapar ese mensaje para siempre. */
    if (S.length) ldListo();
    return;
  }
  R();
}

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
/* Los dos campos de la pantalla de contraseña social (#rpw y #rpw2) no
   están dentro de un <form>, así que su valor hay que llevar al estado a
   mano: sin esto el botón "Guardar y entrar" guardaría "" siempre. El
   Delegado de eventos llama a esto con el valor del input. */
const redPassIn = (k, el) => {
  if (!redPass) return;
  redPass[k] = el.value;
  const l = $("#rpwl");
  if (l) l.innerHTML = pwHtml(redPass.n || "", "");
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
  const m = $("#mo");
  m.hidden = true;
  /* Se vacía el contenido, no sólo se oculta. La ventana de "Editar perfil"
     tiene campos con texto: si quedaran en el documento, el formulario
     seguía ahí (invisible) con lo que se había escrito, y con el teclado se
     podía volver a llegar. `Mok` ya copió el callback a `f` antes de llamar
     acá, así que limpiar no le afecta. */
  m.innerHTML = "";
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
  /* Datos de la pantalla "elegí una contraseña" que aparece después de
     registrarse con Google o Facebook. Ver red(). */
  redPass = null,
  cf = -1,
  sel = { s: 0, d: "", t: "", b: "", pol: 0 },
  navOpen = 0,
  /* Cuántas secciones entran en la barra de celular antes de que el resto
     vaya a la bandeja. La fija el render según el rol y el CSS la usa para
     ocultar las que sobran: así no hay estado que se desincronice al
     cambiar el tamaño de la ventana. */
  claseNav = "nav-todo",
  perfilOpen = 0, // menú que abre la foto del header (los tres roles)
  verWeb = 0, // 1 = viendo la landing con sesión (botón "ver la web")
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
  BARS = [], // barberos publicados para que el cliente elija (config/barberos)
  /* Perfil público de cada barbero, por uid, desde la colección `fotoBarbero`.
     Antes acá sólo vivía la foto; ahora es la ficha completa que el barbero
     carga desde "Editar perfil". Se llama FOTOS por historia: el nombre quedó,
     pero el contenido es el perfil entero. */
  FOTOS = {},
  MSGS = [], // mensajes del formulario de contacto (solo los ve el dueño)
  /* Arma la lista de equipo que ve el cliente.

     `config/barberos` decide QUIÉNES están (eso es del dueño: él agrega y
     quita). Lo que el barbero cargó de sí mismo está en `fotoBarbero/{uid}`, y
     eso se encima por encima: gana lo que él puso, y la foto nunca queda
     vacía si él subió una.

     El `id` NO se puede pisar desde `pub` aunque venga: es la clave con la que
     se lo buscó, y sin él la lista pierde el vínculo con su documento. */
  conFotos = (l) =>
    (Array.isArray(l) ? l : []).map((b) => {
      const pub = (b && b.id && FOTOS[b.id]) || {};
      return {
        ...b,
        ...pub,
        id: b && b.id,
        foto: pub.foto || (b && b.foto) || "",
      };
    }),
  /* Copia de los últimos datos PÚBLICOS recibidos. Va en ESTA declaración
     y no como una línea suelta: fuera de la cadena de `let` sería una
     variable no declarada y en un módulo eso es ReferenceError al cargar
     ("PUB is not defined"), con la landing entera en blanco. */
  PUB = { servicios: null, barberos: null, horario: null };
/* Nombre vigente de un barbero.
   El nombre vive en tres lugares y cada parte de la app leía uno:
     staff/{uid}.n          -> encabezado del panel del barbero
     config/barberos.l[].n  -> landing pública
     config/finanzas.bs[].n -> lista del dueño (Barberos / Finanzas)
   Cuando el barbero se cambia el nombre desde "Mi perfil en la web" solo se
   escribía el segundo, así que el encabezado seguía con el viejo y el panel del
   dueño con el suyo. Acá se lee siempre el nombre publicado y, si todavía no
   hay, se cae al de la lista del dueño. */
const nomBar = (b) => {
  const id = b && b.id;
  const pub = id ? BARS.find((x) => x.id === id) : null;
  return ((pub && pub.n) || (b && b.n) || "Barbero").trim() || "Barbero";
};

let CA = [],
  cx = null,
  rep = 0, // id del turno que se está reprogramando (0 = ninguno)
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
  /* Este texto era una nota de desarrollo pegada en un cartel de persona:
     le decía al dueño que abriera un archivo de reglas. Ahora dice qué pasó y
     qué hacer, sin jerga.
     OJO: "Volvé a intentar" era un consejo inútil cuando el motivo es que las
     reglas de Firestore lo niegan, porque reintentar da exactamente lo mismo.
     Para eso está motivoFirestore() más abajo, que mira el error de verdad. */
  "permission-denied": "No se pudo guardar ese cambio: la base de datos no lo permitió.",
  "auth/network-request-failed":
    "Sin conexión. Revisá tu internet e intentá de nuevo.",
  "auth/too-many-requests":
    "Demasiados intentos. Esperá unos minutos e intentá de nuevo.",
  /* Errores de los botones de Google y Facebook. Con los proveedores sin
     habilitar en la consola salía el "Ocurrió un error" genérico, que no
     dice nada. Ver ACTIVAR_GOOGLE_FACEBOOK.md con el paso a paso. */
  "auth/operation-not-allowed":
    "Ese botón todavía no está habilitado. Hay que activar el proveedor en Firebase Console > Authentication > Sign-in method.",
  "auth/unauthorized-domain":
    "Este dominio no está autorizado. Agregalo en Firebase Console > Authentication > Settings > Authorized domains.",
  "auth/popup-blocked":
    "El navegador bloqueó la ventana de inicio de sesión. Habilitá los popups para este sitio e intentá de nuevo.",
  "auth/popup-closed-by-user":
    /* Ya no se muestra: es una cancelación y se maneja en CANCELADO, sin
       cartel (más abajo). Antes decía "Cerraste la ventana de Google o Facebook
       sin terminar", que además de molestar le decía al usuario que había
       hecho algo mal cuando simplemente cambió de idea. */
    "",
  "auth/account-exists-with-different-credential":
    "Ese correo ya tiene una cuenta hecha con contraseña. Entrá con contraseña, o usá el mismo botón con el que te registraste.",
  unavailable: "Sin conexión con el servidor. Intentá de nuevo en un momento.",
};

/* Cancelaciones: NO son errores y no se avisan.

   Lo pidió el dueño: si alguien aprieta "Cancelar" en la pantalla de permisos
   de Google, o cierra la ventanita de Facebook, no hay nada que informar: la
   persona decidió hacerlo así.

   Antes pasaba esto: `auth/user-cancelled` no estaba en el mapa de arriba, así
   que caía en el cartel genérico "No se pudo completar — Ocurrió un error",
   con el texto de Firebase en crudo adentro. El ingreso había funcionado bien
   y el mensaje le decía que algo había fallado.

   `auth/cancelled-popup-request` también va acá. Estaba aparte con el
   razonamiento de que no es una cancelación sino "se abrió una ventanita antes
   de terminar la anterior". Ese razonamiento viene de leer los internals de
   Firebase, no de algo que se pueda ver: en la pantalla lo que ve la persona es
   un cartel rojo que dice "esperá un segundo e intentá de nuevo", después de
   haber apretado un botón. El dueño lo pidió explícitamente: que ese cartel no
   aparezca. Silencio. */
const CANCELADO = new Set([
  "auth/user-cancelled",
  "auth/user-cancelled-popup",
  "auth/popup-closed-by-user",
  "auth/cancelled-popup-request",
]);
const esCancelacion = (e) => !!(e && CANCELADO.has(e.code));

/* Por qué NO se pudo guardar, en criollo, según lo que el error dice de verdad.

   Esto se agregó después de que el dueño se encontrara con un cartel que decía
   "No se pudo guardar ese cambio. Volvé a intentar" y, en la consola del
   navegador, esto:

       Failed to load resource: net::ERR_BLOCKED_BY_CLIENT
       POST https://firestore.googleapis.com/google.firestore.v1.Firestore/wr…

   ERR_BLOCKED_BY_CLIENT NO lo genera la aplicación ni el servidor: lo genera
   una extensión del navegador o los escudos de Brave/AdBlock. O sea que el
   consejo de "volvé a intentar" era actively inútil: iba a fallar las cinco
   veces.

   Ojo con lo de arriba: si el bloqueo fuera del sitio, no faudrait tocar la
   base. Esta función no promete una causa, promete distinguir las tres que se
   pueden diferenciar desde el error, y en la que no se puede, decirlo. */
function motivoFirestore(e) {
  /* Se junta el mensaje de toda la cadena de causas: el error de red de
     navegadores nuevos viene en e.cause, no en e.message, y por eso antes
     no se veía por ningún lado. */
  const cadena = [];
  for (let x = e, i = 0; x && i < 6; i++) {
    if (x.message) cadena.push(String(x.message));
    if (x.code) cadena.push(String(x.code));
    x = x.cause || x.originalError;
  }
  const txt = cadena.join(" | ");

  if (/ERR_BLOCKED_BY_CLIENT|ERR_BLOCKED_BY_ADMINISTRATOR|ERR_BLOCKED_BY_RESPONSE/i.test(txt))
    return "Alguna extensión del navegador (o los escudos de Brave) está bloqueando las consultas a Firebase. No es un problema del sitio: probá con una ventana de incógnito sin extensiones, o poné este dominio en la lista blanca del bloqueador.";
  if (/Failed to fetch|NetworkError|ERR_INTERNET_DISCONNECTED|ERR_NAME_NOT_RESOLVED|load failed/i.test(txt))
    return "No se pudo llegar a la base de datos. Revisá la conexión a internet e intentá de nuevo.";
  if (e && e.code === "permission-denied")
    return "Las reglas de Firebase no dejaron guardar este dato. Si sos el dueño o el barbero, hay que revisar el archivo FIRESTORE_RULES.txt y publicarlo de nuevo en Firebase Console.";
  if (e && e.code === "unavailable")
    return "Firebase no respondió a tiempo. Es momentsáneo: intentá de nuevo en un momento.";
  if (e && e.code === "deadline-exceeded")
    return "La operación tardó demasiado y se cortó. Intentá de nuevo.";
  return "";
}

/* Aviso concreto cuando lo que falló fue publicar el perfil del barbero en la
   web. El motivo se calcula una vez porque el error ya seGuardó aparte en
   fotoTomar: no se vuelve a pedir. */
let _motivoWeb = "";
const setMotivoWeb = (e) => {
  _motivoWeb = motivoFirestore(e);
};
const porQueWeb = () =>
  _motivoWeb ||
  "Lo más probable es que las reglas de Firebase en la consola estén viejas: hay que pegar el archivo FIRESTORE_RULES.txt actualizado y publicarlo.";

const err = (e) => {
  if (!me && e.code === "permission-denied") return;
  /* Si la persona canceló, se sale en silencio: sin cartel, sin error en
     consola y sin ruido. La pantalla queda como estaba. */
  if (esCancelacion(e)) return;
  const w = [
    "auth/invalid-credential",
    "auth/email-already-in-use",
    "auth/invalid-email",
    "auth/weak-password",
  ].includes(e.code);
  const porQue = motivoFirestore(e);
  M({
    k: w || (porQue && !/no lo permitió/.test(ERR[e.code] || "")) ? "w" : "x",
    h: w ? "Revisá los datos" : porQue ? "No se pudo guardar" : "No se pudo completar",
    b:
      esc(porQue || ERR[e.code] || "Ocurrió un error. Intentá de nuevo.") +
      (porQue ? "" : ` — ${esc(e.message || "")}`.slice(0, 180)),
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
  rep = 0;
  T = [];
  C = [];
  OC = {};
  UA = [];
  /* El tilde de "pol" también se limpia al salir de sesión: si alguien
     aceptó una vez, no tiene que volver a aceptar en el próximo turno, pero
     tampoco debe quedar marcado de antes. */
  sel = { s: 0, d: "", t: "", b: "", pol: 0 };
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
  /* Se reaplican los datos públicos: sus onSnapshot están sobre un doc() y
     no vuelven a dispararse solos porque el documento no cambió, sólo
     cambió la sesión. Sin esto la landing queda sin servicios, sin equipo
     y sin horarios apenas cerrás sesión. */
  if (PUB.servicios) S = PUB.servicios;
  if (PUB.barberos) BARS = PUB.barberos;
  if (PUB.horario) CF = PUB.horario;
  navOpen = 0;
}
function occ() {
  ou && ou();
  OC = {};
  /* La grilla se vacía arriba y abajo se vuelve a pintar: sin este aviso, con
     la red lenta, el que reservaba veía los horarios como libres hasta que
     llegaba la respuesta. */
  ldEspera("Consultando horarios…");
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
      ldListo();
      R();
    },
    (e) => {
      ldListo();
      err(e);
    },
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
      /* Los puntos de bienvenida salen de la configuración (Servicios y
           premios), no de un 20 clavado. */ setDoc(doc(db, "users", id), { nm: me.displayName || "Nuevo cliente", ph: "", pt: PTSRv }).catch(() => {});
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
      /* Puntos de bienvenida. Antes eran 20 clavados en dos lugares (el alta
         de cuenta y el texto del formulario de registro); ahora salen de
         acá, para que el dueño los cambie desde Servicios/Premios y se
         reflejen en todos los paneles. */
      /* Acotado a 20 porque las reglas de Firestore piden `pt <= 20` al crear
         el documento del usuario. El campo del panel acepta 4 dígitos, así
         que un Dueño que escribiera 25 dejaba la cuenta creada en Auth pero
         con el setDoc de `users/{uid}` rechazado: el alta parecía funcionar,
         la promesa no, y el panel se quedaba en "Cargando tu cuenta…" para
         siempre, sin error. Ahora el tope se aplica acá y el dueño se entera
         al guardar. */
      if (d.ptsRegistro !== undefined && +d.ptsRegistro >= 0)
        PTSRv = Math.min(20, Math.max(0, Math.floor(+d.ptsRegistro) || 0));
      if (+d.cancelHs >= 0 && d.cancelHs !== undefined) CHSv = +d.cancelHs;
      if (Array.isArray(d.premios) && d.premios.length)
        PRv = d.premios.map((p) => ({ n: p.n, p: +p.p || 0 }));
      if (isOwner()) {
        const r = {
          costs: PRv.map((p) => p.p),
          pts: PTSv,
          ptsRegistro: PTSRv,
          cancelHs: CHSv,
          grid: GRID,
          premios: PRv.map((p) => ({ n: p.n, p: p.p })),
        };
        if (
          JSON.stringify(d.costs) !== JSON.stringify(r.costs) ||
          d.pts !== r.pts ||
          d.ptsRegistro !== r.ptsRegistro ||
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
          /* OJO: se reparte sobre la ficha existente (spread), no se arma un
             objeto nuevo con id/n/foto. Antes sí se armaba así, y como esto
             corre cada vez que el dueño entra, cada entrada a Finanzas
             borraba deconfig la ficha que el barbero cargó en "Mi perfil en
             la web" (oficio, descripción, WhatsApp, Instagram, redes). */
          const pub = FN.bs.map((b) => {
            const prev = BARS.find((x) => x.id === b.id) || {};
            return {
              ...prev,
              id: b.id,
              /* Antes ponía `n: b.n` (el de la lista del dueño) y eso
                 BORRABA el nombre que el barbero se había puesto en "Mi
                 perfil en la web": cada vez que el dueño entraba al panel, la
                 landing volvía al nombre viejo. Ahora el nombre publicado gana
                 si ya existe; `b.n` sólo se usa para el barbero que recién se
                 agrega y todavía no tiene ficha publicada. */
              n: prev.n || b.n,
              foto: prev.foto || (b.uid === me.uid && SB && SB.foto) || "",
            };
          });
          /* Nunca publicar una lista VACÍA. Este bloque corre cada vez que el
             dueño entra al panel, y `config/finanzas` puede no existir todavía
             (base recién limpiada) o leerse un instante sin datos: en ese
             caso `FN.bs` queda `[]`, `pub` queda `[]` y esta línea BORRABA la
             lista pública de barberos de la web entera. Con el equipo vacío
             de verdad no se escribe nada: la lista vacía en la web tiene que
             venir de que el dueño vació la lista a propósito, desde Finanzas. */
          if (pub.length) setDoc(doc(db, "config", "barberos"), { l: pub }).catch(() => {});
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
/* Datos públicos para la landing (sin login): servicios, barberos, horarios y galería

   OJO con por qué se guarda una copia aparte. Estos onSnapshot están sobre
   un `doc()`, así que sólo se disparan cuando el documento CAMBIA. Al
   cerrar sesión se limpian las variables de panel (BARS, entre otras) y,
   como en Firestore el documento no había cambiado, ningún callback vuelve
   a correr: la landing se quedaba con "Equipo sin cargar" para siempre.
   Guardando lo último recibido, al salir se reaplica y la landing se
   completa sola. (La declaración de PUB está arriba, con el resto del
   estado, porque la función de cierre de sesión la necesita.) */
onSnapshot(doc(db, "config", "servicios"), (x) => {
  PUB.servicios = x.exists() && x.data().l && x.data().l.length ? x.data().l.map(nsv) : S0.map(nsv);
  if (!me) {
    S = PUB.servicios;
    datosLlegos();
  }
});
/* Los mensajes del formulario de la landing. Las reglas sólo dejan leerlos al
   dueño (FIRESTORE_RULES.txt), así que la consulta se abre únicamente con
   sesión de dueño: si se pidieran sin sesión, Firestore la rechazaría y el
   resto de las consultas de la pantalla quedarían colgadas. */
if (isOwner())
  onSnapshot(
    query(collection(db, "mensajes"), orderBy("fecha", "desc"), limit(100)),
    (x) => {
      MSGS = x.docs.map((d) => ({ id: d.id, ...d.data() }));
      R();
    },
    () => {
      MSGS = [];
      R();
    },
  );
onSnapshot(doc(db, "config", "barberos"), (x) => {
  PUB.barberos = x.exists() && x.data().l ? x.data().l : [];
  if (!me) {
    BARS = conFotos(PUB.barberos);
    datosLlegos();
  }
});
/* El perfil público de cada barbero, aparte de la lista de config/barberos. Es
   una consulta propia y no se mezcla con la de la lista: si vinieran en el
   mismo onSnapshot, hasta que llegara el primero de los dos la ficha se
   dibujaría sin foto y después saltaría.

   OJO con lo que se guarda acá: el DOCUMENTO ENTERO, no sólo `d.data().foto`.

   Se guardaba sólo la cadena, y conFotos() espera el objeto completo porque
   ahora el mismo documento lleva también el nombre, el oficio y la
   descripción. Con una cadena, `...pub` en conFotos extiende el string
   carácter por carácter: `pub.foto` queda `undefined`, el merge cae al
   respaldo de la ficha (`foto: ""`) y la tarjeta de la web sigue mostrando
   "[Foto]" aunque el documento esté lleno y las reglas dejen leerlo.

   Pasó porque la prueba del merge (setFotos) pasaba la forma que el
   CONSUMIDOR espera, en vez de la que produce el snapshot. Ver
   tests/landing.barberos, que ahora carga un documento real. */
onSnapshot(
  collection(db, "fotoBarbero"),
  (x) => {
    FOTOS = {};
    x.forEach((d) => {
      if (d.exists() && d.data()) FOTOS[d.id] = d.data();
    });
    if (PUB.barberos) {
      BARS = conFotos(PUB.barberos);
      R();
    }
  },
  /* El manejador de error NO es opcional acá. Esta consulta se abre también
     sin sesión (la landing la necesita), y mientras la colección no esté en
     las reglas publicadas, Firestore contesta permission-denied. Sin este
     segundo argumento el error queda SIN CAPTURAR en la consola del visitante,
     que es exactamente lo quedaban `tests/landing.barberos` y
     `tests/politicas` marcan como falla. Con él, no: la web sigue funcionando
     y sólo no hay fotos hasta que se publiquen las reglas. */
  () => {},
);
onSnapshot(doc(db, "config", "horario"), (x) => {
  PUB.horario = x.exists() ? { ...CFD, ...x.data() } : { ...CFD };
  if (!me) {
    CF = PUB.horario;
    datosLlegos();
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
  /* "ajus" es el Ajustes DEL CLIENTE. El dueño ya tenía "cfg" (#/ajustes),
     así que el cliente no puede usar la misma palabra: si compartieran el
     hash, el cliente caería en la vista de reglas y premios. */
  ajus: "mi-cuenta",
  cfg: "ajustes",
  priv: "privacidad",
  gal: "galeria",
  rev: "resena",
  /* "mens" TIENE que estar en esta tabla. Si se agrega a rtOk y se olvida acá,
     rtPush("mens") arma "#/undefined" y rtView() nunca la encuentra: la sección
     aparece en la barra del dueño y al tocarla no pasa nada. */
  mens: "mensajes",
};
const rtOk = (v) =>
  !!me &&
  !!rd &&
  (isAdm()
    ? isOwner()
      ? ["bar", "cli", "bars", "dash", "fin", "cfg", "priv", "gal", "mens"]
      : ["bar", "cli", "fin", "priv", "gal"]
    : ["home", "res", "tur", "rev", "ajus", "priv"]
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
  /* El menú del perfil se cierra al navegar. Sin esto, entrar a Ajustes
     desde la foto dejaba el dropdown abierto encima de la vista nueva. */
  perfilOpen = 0;
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
  rgPtsRegistro(el) {
    /* El tope de 20 no es un tope arbitrario: lo exigen las reglas de
       Firestore para `users/{uid}.pt`. Si el dueño escribe más, antes se
       guardaba igual y el alta de cuenta nueva quedaba colgada en "Cargando
       tu cuenta…" sin mostrar error. Ahora se recorta en el momento y se le
       avisa, en vez de fallar tres pantallas más abajo. */
    const v = +String(el.value).replace(/\D/g, "") || 0;
    /* 50 y no 20: lo pidió el dueño. Ojo, el tope NO es arbitrario, está atado
       a `pt <= 50` de FIRESTORE_RULES.txt. Si se sube acá y no allá, el panel
       acepta 50, la base rechaza el alta y la cuenta queda creada en Auth pero
       sin documento: el alta "parece" funcionar y no pasa nada. */
    const t = Math.min(50, v);
    if (v !== t) {
      PTSRv = t;
      el.value = t;
      M({
        k: "w",
        h: "Máximo 50 puntos",
        b: "Se guardaron " + t + ".",
      });
    } else PTSRv = t;
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
      ptsRegistro: PTSRv,
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
      /* Sin console.error: el motivo va en el texto de al lado, que es lo que
         lee la persona. En la consola sólo quedaba una copia del error. */
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
  /* La bandeja con las secciones que no entran en la barra de celular. La
     abre el botón de tres rayitas de la barra de abajo. */
  toggleNav() {
    navOpen = navOpen ? 0 : 1;
    mas = 0;
    perfilOpen = 0;
    R();
    if (navOpen) {
      const b = $("#nmenu button");
      if (b) b.focus();
    }
  },
  /* "Canjear puntos" del inicio: los premios están más abajo en la misma
     vista, así que en vez de navegar a otro lado sólo baja hasta ellos. Con
     foco movido, porque si no el scroll lo hace a ciegas y el teclado se
     queda en el botón de arriba. */
  verPremios() {
    const el = document.getElementById("premios");
    if (!el) return;
    el.scrollIntoView({ block: "start", behavior: "smooth" });
    const t = document.querySelector('[data-act="redeem"]:not([disabled])') || document.querySelector('[data-act="redeem"]');
    if (t) {
      t.setAttribute("tabindex", "-1");
      t.focus({ preventScroll: true });
    }
  },
  /* Menú del perfil del cliente: lo abre la foto del encabezado. Es un
     dropdown, no el #nmenu del admin, porque el cliente no tiene
     secciones de configuración para listar. */
  /* La foto del encabezado abre el menú. Un único disparador para los dos
     roles, pero cada uno abre lo suyo: el cliente su #pmenu (Ajustes, Ver
     la web, Cerrar sesión) y el admin el #nmenu de secciones. Antes eran
     dos botones distintos —#hamb para el admin y #perfil para el cliente—
     y el dueño pidió que la foto sea el menú. */
  toggleMebadge() {
    perfilOpen = perfilOpen ? 0 : 1;
    navOpen = 0;
    R();
    /* El foco entra al primer ítem al abrir: si no, el teclado se queda
       en la foto y el menú es inalcanzable sin tabular a ciegas. */
    if (perfilOpen) {
      const b = $("#pmenu button");
      if (b) b.focus();
    }
  },
  /* El barbero editando los datos que salen en su tarjeta de la landing.

     ANTES: el formulario era un `<details>` arriba de todo en la Agenda, y esta
     acción lo desplegaba, lo bajaba hasta el medio de la pantalla y le daba
     foco. El dueño pidió que fuera una ventana emergente y que no se desplegara
     en el dashboard. Ahora es un modal (#mo), el mismo que usan los avisos.

     El barbero no tiene pantalla de Ajustes (`rtOk` no le deja abrir "cfg",
     que es del dueño), así que esta acción es su única entrada al formulario.
     Por eso avisa si no puede abrirla, en vez de no hacer nada. */
  miPerfilWeb() {
    perfilOpen = 0;
    if (abrirPerfil()) return;
    M({
      k: "w",
      h: "No se pudo abrir la edición",
      b: "Cerrá y volvé a abrir el panel, o probá desde el ícono de tu foto, arriba a la derecha.",
    });
  },
  /* Se mantiene el nombre viejo porque hay tests y textos que lo usan, pero
     ahora hace lo mismo que tocar la foto. */
  togglePerfil() {
    this.toggleMebadge();
  },
  cerrarPerfil() {
    if (!perfilOpen) return;
    perfilOpen = 0;
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
    /* Hay que sacar el hash #login: con él puesto, el render vuelve a abrir
       el login en el ciclo siguiente y el botón no hace nada. Por eso esta
       acción estaba escrita pero ningún botón la usaba. */
    if (location.hash === RESERVAR_URL)
      history.replaceState(null, "", location.pathname + location.search);
    R();
  },
  /* Ver la landing sin cerrar sesión. No se toca el hash: la ruta sigue
     apuntando al panel, así que al volver no se pierde el estado. */
  verWebOn() {
    if (!me) return;
    verWeb = 1;
    navOpen = 0;
    if (location.hash === "#login") history.replaceState(null, "", "#/" + RT.res);
    document.body.classList.add("ver-web");
    R();
  },
  verWebOff() {
    verWeb = 0;
    document.body.classList.remove("ver-web");
    R();
  },
  /* Abre las políticas. Guarda el elemento que las abrió para devolvérsele
     el foco al cerrar: si no, el usuario queda perdido en el cuerpo de la
     página y tiene que volver a recorrerla con el teclado para seguir. */
  openPol() {
    const x = $("#po");
    polRetorno = document.activeElement;
    x.innerHTML = polH();
    x.hidden = false;
    document.body.classList.add("no-scroll");
    const c = x.querySelector(".pol-x");
    if (c) c.focus();
  },
  /* Abre el modal de políticas en una sección puntual. El resumen del turno
     necesita llevar al cliente directo a "Datos" (la parte de privacidad) y
     a "Condiciones" (las del servicio), no a la primera solapa. */
  openPolSec(id) {
    ACT.openPol();
    polIrTab(id, false);
  },
  /* Cambia de sección. Las solapas son tabs de verdad (role="tab" +
     aria-selected + aria-controls), así que el foco tiene que poder moverse
     con las flechas, no sólo con el click. */
  polTab(id) {
    polIrTab(id, false);
  },
  cerrarPol() {
    const x = $("#po");
    x.hidden = true;
    x.innerHTML = "";
    document.body.classList.remove("no-scroll");
    /* Devolver el foco al link que abrió el diálogo, con preventScroll para
       no saltar de nuevo al principio de la página. */
    if (polRetorno && polRetorno.focus) {
      try {
        polRetorno.focus({ preventScroll: true });
      } catch (e) {
        polRetorno.focus();
      }
    }
    polRetorno = null;
  },
  pickFoto(cb) {
    const i = document.createElement("input");
    i.type = "file";
    i.accept = "image/*";
    i.onchange = () => i.files && i.files[0] && cb(i.files[0]);
    i.click();
  },
  async subirFoto(f, carpeta) {
    /* `i.accept = "image/*"` es una SUGERENCIA, no una validación: el selector
       de archivos deja escribir otra cosa, y esta función se puede llamar desde
       la consola. Acá se chequea de verdad.
       12 MB es un techo generoso para una foto de celular, y evita que
       cualquiera llene la cuota de Cloudinary con archivos enormes. */
    if (!/^image\//.test(f.type || ""))
      throw Object.assign(new Error("Ese archivo no es una imagen."), { suave: 1 });
    if (f.size > 12 * 1024 * 1024)
      throw Object.assign(
        new Error("La imagen pesa más de 12 MB. Bajala o sacale calidad."),
        { suave: 1 },
      );
    busy(1, "Subiendo imagen…");
    try {
      const toWebp = (file) =>
        new Promise((resolve, reject) => {
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
          /* Antes: img.onerror = () => resolve(file), o sea que si el
             navegador no lograba decodificar el archivo se subía IGUAL y sin
             transformar: un PDF renombrado a .jpg llegaba entero a Cloudinary.
             Ahora se rechaza con error, que es lo que recoge el catch de cada
             pantalla que llama a pickFoto. */
          img.onerror = () =>
            reject(
              Object.assign(new Error("No se pudo abrir el archivo como imagen."), {
                suave: 1,
              }),
            );
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
        /* Sin texto no se inventa una frase: si no escribió nada, se publica
       vacío. Poner "Muy conforme..." inventía una reseña que el cliente
     nunca escribió. */
    texto: revText,
        fecha: serverTimestamp(),
      });
      /* El aviso se pone DESPUÉS de navegar y se pinta una sola vez.
         Antes era msg=...; R(); goNow("home") — y goNow vuelve a llamar a
         R(), que borra `msg` al final de pintarlo. Los dos renders pasan en
         el mismo tick, así que el navegador nunca llegan a mostrar el
         "<p class=msg>": el cliente guardaba la reseña y no veía ninguna
         confirmación. Ahora se replica el patrón del resto de la app:
         preparar, poner el mensaje, y un solo R(). */
      revStep = 1;
      revS = 0;
      revText = "";
      prep("home");
      rtPush("home");
      msg = "¡Gracias! Ya registramos tu reseña.";
      R();
    } catch (e) {
      err(e);
    }
  },
  async fotoTomar() {
    W.pickFoto(async (f) => {
      try {
        busy(1, "Subiendo la foto…", 1);
        const x = await W.subirFoto(f, "perfil");
        /* Se escribe en los tres lugares y se JUENTA EL RESULTADO DE CADA UNO
           por separado, en vez de un Promise.all.

           Con Promise.all, el primer rechazo tumba el resto: como
           `fotoBarbero` daba 403 (la regla usaba diff(resource.data) en un
           create, donde resource es null y la regla truena), ese 403 tumbaba
           también el write a users/ y a staff/. Y el de fotoBarbero estaba
           envuelto en un `.catch(() => {})`, o sea que el error se perdía y
           la app decía "listo" con la foto sin publicar: la tarjeta de la web
           seguía mostrando "[Foto]".

           Ahora se escribe cada uno por su cuenta, se anota el que falló y al
           final se avisa. Si la foto se guardó en el perfil pero NO llegó a la
           web, el cartel dice exactamente eso y por qué. */
        const fallos = [];
        let errorWeb = null;
        const guardar = async (que, fn, esWeb) => {
          try {
            await fn();
          } catch (e) {
            fallos.push(que);
            if (esWeb) errorWeb = e;
          }
        };
        await guardar("perfil", () => setDoc(doc(db, "users", me.uid), { foto: x.url }, { merge: true }));
        if (SB) {
          SB.foto = x.url;
          await guardar("ficha de barbero", () => setDoc(doc(db, "staff", me.uid), { foto: x.url }, { merge: true }));
        }
        await guardar("web", () => setDoc(doc(db, "fotoBarbero", me.uid), { foto: x.url }, { merge: true }), true);

        busy(0);
        FOTOS[me.uid] = { ...(FOTOS[me.uid] || {}), foto: x.url };
        if (!fallos.length) {
          msg = "Listo. Tu foto ya está en todos lados, también en la web.";
          R();
          return;
        }
        setMotivoWeb(errorWeb);
        /* El caso importante es "web": la foto quedó en tu perfil y en tu
           ficha, pero la landing no la muestra. */
        R();
        M({
          k: "w",
          h: fallos.length > 1 ? "La foto se guardó a medias" : "La foto no llegó a la web",
          b:
            (fallos.length > 1 ? "No se pudo guardar en: " + fallos.join(", ") + ".<br>" : "") +
            "Quedó en tu panel, pero los clientes que reserven siguen viendo el cartel [Foto] en la web.<br><br>" +
            porQueWeb(),
        });
      } catch (e) {
        busy(0);
        err(e);
      }
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
  /* `registro` dice desde qué pantalla se apretó el botón. Es lo único
     que separa "crear la cuenta" de "entrar": el pop-up es el mismo.
     Ver el comentario de redPassOk() para por qué hace falta. */
  async red(p, registro) {
    try {
      const prov =
        p === "google"
          ? new GoogleAuthProvider()
          : new FacebookAuthProvider();
      const r = await signInWithPopup(auth, prov);
      /* Si la cuenta quedó sin contraseña, hay que pedir una. Es el
         problema de dejar Facebook sólo en el registro: quien se anotó
         con Facebook no tiene contraseña, así que si el botón no está en
         el ingreso esa persona no vuelve a entrar nunca y pierde sus
         puntos y su historial. */
      const s = await getDoc(doc(db, "users", r.user.uid));
      if (!s.exists())
        await setDoc(doc(db, "users", r.user.uid), {
          nm: r.user.displayName || "Nuevo cliente",
          ph: "",
          /* Los puntos de bienvenida salen de la configuración, no de un 20
             clavado. */
          pt: PTSRv,
        });
      /* El documento se crea ANTES de pedir la contraseña: si la persona
         cierra la pantalla a mitad de camino igual tiene que quedar con
         perfil, puntos e historial. La contraseña es lo último que se
         resuelve, y hay un botón de "ahora no" justamente para eso. */
      if (registro && !r.user.providerData.some((x) => x.providerId === "password")) {
        redPass = { n: "", c: "", red: p };
        tab = "redpass";
        R();
      }
    } catch (e) {
      /* Cancelar no es fallar. Si la persona cerró la pantalla de permisos de
         Google o la ventanita de Facebook, no se muestra NADA: `err()` ya
         devuelve en silencio para esos códigos y acá sólo se repinta, para que
         la pantalla quede como estaba y el botón vuelva a su estado normal. */
      if (!esCancelacion(e)) err(e);
      busy(0);
      R();
    }
  },
  /* Guarda la contraseña de una cuenta creada con Google o Facebook.
     Sin esto esa persona quedaría sin forma de volver a entrar: el pop-up
     social es el único acceso que tiene y el botón no va a estar en el
     ingreso. Ver la nota del dueño en PRODUCT.md. */
  async redPassOk() {
    if (!redPass) return;
    const n = (redPass.n || "").trim();
    const c2 = (redPass.c || "").trim();
    if (n.length < 6)
      return M({
        k: "w",
        h: "Contraseña muy corta",
        b: "La contraseña tiene que tener al menos 6 caracteres.",
      });
    if (n !== c2)
      return M({ k: "w", h: "No coinciden", b: "Las dos contraseñas no son iguales." });
    busy(1, "Guardando…");
    try {
      await updatePassword(auth.currentUser, n);
      redPass = null;
      msg = "Listo. Ya podés entrar con tu correo y esa contraseña.";
    } catch (e) {
      err(e);
    }
    busy(0);
    R();
  },
  redPassNo() {
    redPass = null;
    msg = "Cerrá sesión: si no, no vas a poder volver a entrar.";
    R();
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
        /* Los puntos de bienvenida salen de la configuración, no de un 20
           clavado. */
        pt: PTSRv,
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
        /* Al salir hay que borrar la ruta: si queda (#/dashboard, #/agenda...)
           la barra de direcciones sigue diciendo que estás en un panel que ya
           no existe, el link se comparte roto y al volver a entrar el router
           te manda directo a esa vista. */
        verWeb = 0;
        document.body.classList.remove("ver-web");
        view = "home";
        if (location.hash !== RESERVAR_URL)
          history.replaceState(null, "", location.pathname + location.search);
        rtInit = 0;
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
    /* La casilla de términos va PRIMERO, antes de la verificación de email:
       si falta marcarlo, el cliente tiene que enterarse de eso y no de un
       email sin verificar. El aviso dice exactamente qué marcar. */
    if (!sel.pol)
      return M({
        k: "w",
        h: "Falta aceptar los términos",
        b: "Marcá la casilla de términos y condiciones antes de confirmar el turno.",
      });
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
    /* ---- reprogramar: se actualiza el turno que ya existe ----
       Va ANTES del conteo de turnos activos, a propósito: si fuera después,
       un cliente que ya tiene los 2 cupos no podría reprogramar ninguno,
       que es justo cuando más lo necesita. Tampoco pasa por la rama de
       "activos": reprogramar no crea un turno nuevo, reescribe el mismo,
       y si no el cliente quedaría con el cupo duplicado. */
    if (rep) {
      const t0 = T.find((x) => x.id === rep);
      if (!t0 || t0.st !== "pend") {
        rep = 0;
        return M({ k: "w", h: "No se puede reprogramar", b: "Ese turno ya no está pendiente." });
      }
      const b = writeBatch(db);
      /* Los cupos viejos se borran por clave ("barbero_fecha_hora"). Se
         usan los del propio turno, así funciona aunque el listado `ocupados`
         se haya desincronizado. */
      (t0.bl || []).forEach((x) => b.delete(doc(db, "ocupados", x)));
      const ids2 = bl.map((t) => sel.b + "_" + sel.d + "_" + t.replace(":", ""));
      ids2.forEach((x, i) =>
        b.set(doc(db, "ocupados", x), { uid: t0.uid, d: sel.d, t: bl[i], tu: t0.id, g: GRID, bid: sel.b }),
      );
      b.set(doc(db, "turnos", t0.id), {
        s: sel.s,
        sid: S[sel.s].id,
        d: sel.d,
        t: sel.t,
        bid: sel.b,
        bl: ids2,
        sn: S[sel.s].n,
        sp: S[sel.s].p,
        sm: S[sel.s].tx,
      });
      try {
        await b.commit();
        rep = 0;
        sel.t = "";
        W.goNow("tur");
        msg = "Listo, cambiamos la fecha de tu turno.";
        R();
      } catch (e) {
        err(e);
      }
      return;
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
  /* ---------- reprogramar ----------
     Reusa el asistente de 6 pasos en modo edición: se precarga el turno
     con su servicio, barbero y mes, y al confirmar se ACTUALIZA el turno en
     vez de crear uno nuevo. Es la misma validación de cupos que usa book(),
     así que no hay dos caminos para elegir horario.

     Respeta la MISMA política que cancelar (CHSv horas): si ya no dá
     tiempo, se manda a escribir a la barbería en vez de dejarlo tocar. */
  reprogramar(id) {
    const t0 = T.find((x) => x.id === id);
    if (!t0 || !me) return;
    if (t0.st !== "pend") return;
    if (t0.uid !== me.uid && !isAdm())
      return M({ k: "w", h: "Ese turno no es tuyo", b: "Sólo podés reprogramar tus propios turnos." });
    if (!isAdm() && new Date(t0.d + "T" + t0.t + ":00-03:00") - now() < CHSv * 36e5) {
      const wa =
        WHATSAPP &&
        "https://wa.me/" +
          WHATSAPP +
          "?text=" +
          encodeURIComponent(
            `Hola, soy ${t0.nm || U.nm}. Necesito cambiar la fecha de mi turno del ${fd(t0.d)} a las ${t0.t}.`,
          );
      return M({
        k: "w",
        h: "Ya no podés reprogramar online",
        b: `Faltan menos de ${CHSv} horas para tu turno. Escribile a la barbería para avisar.`,
        ok: wa ? 'Escribir por WhatsApp' : "Entendido",
        no: wa ? "Cerrar" : "",
        fn: wa ? () => open(wa, "_blank", "noopener") : null,
      });
    }
    /* Precarga: el servicio se busca por id (el índice sel.s es frágil si
       el dueño edita el listado de servicios entremedido). */
    const iS = t0.sid ? S.findIndex((x) => x.id === t0.sid) : t0.s;
    sel.s = iS >= 0 ? iS : 0;
    sel.b = t0.bid;
    sel.d = t0.d;
    sel.t = "";
    rep = t0.id;
    WZ.mes = t0.d.slice(0, 7);
    WZ.turno = "";
    prep("res");
    /* Arranca en el día: lo que casi siempre se quiere cambiar, y el
       servicio y el barbero quedan los que ya eran. */
    WZ.paso = 3;
    if (!WZ.unsub) wzOcc();
    rtPush("res");
    WZ.pintar();
    msg = "Elegí el nuevo día y horario.";
    R();
  },
  /* Sale del modo edición sin tocar nada: se vuelve a reservar normal. */
  repSalir() {
    rep = 0;
    prep("tur");
    rtPush("tur");
    R();
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
      /* Sin repintado el canje seguía en pantalla como si estuviera
         disponible: el writeEndian Firestore pero la vista no se enteraba. */
      R();
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
      /* Antes: console.error con un volcado del turno (uid, nombre, barbero,
         fecha, hora,cupos) y después el mismo error pasado a err(). O sea, la
         consola repetía lo que ya se le iba a mostrar a la persona. */
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
  /* Quitar un barbero. Hay dos caminos porque hay dos tipos:
       - CON cuenta (tiene uid): deja de ser barbero, vuelve a cliente y
         se le borra el documento de staff.
       - SIN cuenta (agregado a mano desde "+ Agregar barbero"): no hay
         cuenta que revertir, así que se saca de la lista de equipo. Antes
         estos no tenían botón de quitar y quedaban registrados para
         siempre: no se podían sacar de la web. */
  askQuitBar(uid) {
    /* Busca por uid O por id. Antes era `(uid ? x.uid === uid : x.id === uid)`:
       como al barbero agregado a mano se lo pasa su `id` (no tiene `uid`), la
       condición preguntaba siempre `x.uid === "b1abc..."`, que no lo matchea
       nunca, `b` quedaba indefinido y la función salía sin hacer nada: el
       botón "Quitar" de los barberos cargados a mano no hacía absolutamente
       nada, sin cartel ni error. */
    const b = FN.bs.find((x) => (uid && x.uid === uid) || x.id === uid);
    if (!b) return;
    const conCuenta = !!b.uid;
    M({
      k: "q",
      h: "¿Quitar a " + esc(nomBar(b)) + " como barbero?",
      b: conCuenta
        ? "Vuelve a ser un cliente común y pierde el acceso de barbero. Sus cobros anteriores se conservan."
        : "Se lo saca del equipo y deja de aparecer en la web. No tiene cuenta de barbero, así que no hay nada más que revertir.",
      ok: "Quitar",
      no: "Volver",
      fn: () => W.quitBar(b.uid || b.id),
    });
  },
  async quitBar(id) {
    const b = FN.bs.find((x) => x.uid === id || x.id === id);
    if (!b) return;
    const bt = writeBatch(db);
    bt.set(doc(db, "config", "finanzas"), {
      pd: FN.pd,
      bs: FN.bs.filter((x) => (b.uid ? x.uid !== id : x.id !== id)),
    });
    /* Sólo se toca staff y el rol del usuario si hay cuenta: en el
       barbero manual no existen esos documentos y escribirlos crearía
       basura. */
    if (b.uid) {
      bt.delete(doc(db, "staff", b.uid));
      bt.update(doc(db, "users", b.uid), { rol: "" });
    }
    try {
      await bt.commit();
      msg = b.uid ? "Listo, volvió a la lista de clientes." : "Listo, se lo sacó del equipo.";
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
  /* Guarda nombre y teléfono desde Ajustes del cliente. Usa las MISMAS
     validaciones que el alta (registro): 2 a 40 letras de nombre y 8 a 15
     dígitos de teléfono. Las reglas de /users dejan al cliente editar sólo
     nm y ph, así que es exactamente lo que se puede guardar. */
  async delMsj(id) {
    try {
      await deleteDoc(doc(db, "mensajes", id));
    } catch (e) {
      err(e);
    }
  },
  async guardarPerfilCli() {
    if (!me || !U) return;
    const nm = (($("#ajusNm") || {}).value || "").trim();
    const ph = (($("#ajusPh") || {}).value || "").replace(/\D/g, "");
    if (nm.length < 2 || nm.length > 40)
      return M({ k: "w", h: "Revisá tu nombre", b: "El nombre tiene que tener entre 2 y 40 letras." });
    if (ph.length < 8 || ph.length > 15)
      return M({ k: "w", h: "Revisá tu teléfono", b: "El teléfono tiene que tener entre 8 y 15 dígitos, solo números." });
    try {
      busy(1, "Guardando…", 1);
      await setDoc(doc(db, "users", me.uid), { nm: nm, ph: ph }, { merge: true });
      /* Se actualiza en memoria para que el encabezado y los saludos no
         sigan mostrando el dato viejo hasta el próximo snapshot. */
      U = { ...U, nm: nm, ph: ph };
      busy(0);
      msg = "Tus datos quedaron guardados.";
      R();
    } catch (e) {
      busy(0);
      err(e);
    }
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
  redPassIn,
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
/* "@ck" es el estado marcado de un checkbox. Hace falta porque "@v" devuelve
   el `value`, y el de una casilla es siempre "on" esté marcada o no: con
   "@v" la casilla de términos llegaba siempre como "aceptada". */
const dArgs = (el) =>
  JSON.parse(el.dataset.args || "[]").map((a) =>
    a === "@el" ? el : a === "@v" ? el.value : a === "@o" ? el.open : a === "@ck" ? el.checked : a,
  );
const dRun = (el, k) => {
  const f = ACT[el.dataset[k]];
  if (f) f.apply(W, dArgs(el));
};
document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-act]");
  /* Antes la foto (#mebadge) tenía aquí un caso propio que hacía `return`,
     y por eso nunca llegaba a dRun. Ahora la foto es un <button> con
     data-act="toggleMebadge" como cualquier otro: si el caso especial
     siguiera, abriría y cerraría en el mismo clic. */
  /* Un clic fuera del equipo cierra la ficha abierta. Sin esto, tocar en
     cualquier lado deja un dorso dado vuelta en pantalla sin forma
     obvio de cerrarlo. */
  if (!e.target.closest(".lb-barber") && document.querySelector(".lb-barber--abierta")) lbCierraTodos();
  /* Menú del perfil: se cierra al tocar fuera. La foto ES el disparador,
     así que sin esta guarda el clic se comería a sí mismo. */
  /* El menú de la foto existe ahora para los tres roles (antes sólo para el
     cliente). */
  if (perfilOpen && !e.target.closest("#mebadge,#pmenu")) {
    perfilOpen = 0;
    R();
  }
  if (mas && !e.target.closest('[data-act="toggleMas"],.masm')) {
    mas = 0;
    if (!el) R();
  }
  /* La bandeja la abre el botón de tres rayitas de la barra de abajo, así que
     el cierre tiene que mirar ESE botón. Antes miraba la foto, porque #nmenu
     era el menú del admin. */
  if (navOpen && !e.target.closest('#nmenu,.nav-mas,[data-act="toggleNav"]')) {
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
/* --- Políticas: solapas, foco y teclado -------------------------------
   El modal (#po) vive fuera de #app, así que R() no lo borra: su estado se
   maneja aparte. polRetorno es el elemento que lo abrió, para devolverle el
   foco al cerrar. */
let polRetorno = null;

/* Muestra una sección y deja su solapa activa. `mover` además mueve el foco
   a la solapa (lo usan las flechas del teclado). */
function polIrTab(id, mover) {
  const po = $("#po");
  if (!po || po.hidden) return;
  if (!POL_SECC.some(([s]) => s === id)) return;
  po.querySelectorAll("[data-panel]").forEach((p) => {
    p.hidden = p.dataset.panel !== id;
  });
  po.querySelectorAll(".pol-tab").forEach((t) => {
    /* Se compara contra JSON.stringify, NO contra A(id): el atributo llega
       a dataset ya decodificado (`["datos"]`), mientras A() devuelve el texto
       con entities (`[&quot;datos&quot;]`). Comparar los dos nunca da igual y
       las solapas no cambiaban de sección. */
    const on = t.dataset.args === JSON.stringify([id]);
    t.classList.toggle("on", on);
    t.setAttribute("aria-selected", on ? "true" : "false");
    t.tabIndex = on ? 0 : -1;
    if (on) {
      if (mover) t.focus();
      /* Al cambiar de solapa el scroll arranca arriba: si no, queda
         mostrando la parte de abajo de la sección anterior. */
      const b = po.querySelector(".pol-body");
      if (b) b.scrollTop = 0;
      /* La fila de solapas scrollea en horizontal. Con las flechas se puede
         llegar a una que quedó fuera de la vista y el usuario no ve cuál
         está activa: se trae al centro. block:"nearest" para no tocar el
         scroll vertical de la página. */
      try {
        const r = t.getBoundingClientRect(),
          caja = t.parentElement.getBoundingClientRect();
        if (r.left < caja.left || r.right > caja.right)
          t.scrollIntoView({ inline: "center", block: "nearest" });
      } catch (e) {}
    }
  });
}

/* Elementos focusables del modal, en orden de tabulación. */
const polFocables = (po) =>
  [...po.querySelectorAll("a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex='-1'])")].filter(
    (el) => el.offsetParent !== null && !el.closest("[hidden]") && !el.closest('[aria-hidden="true"]'),
  );

document.addEventListener("keydown", (e) => {
  const po = $("#po");
  if (!po || po.hidden) return;

  if (e.key === "Escape") {
    e.preventDefault();
    ACT.cerrarPol();
    return;
  }

  /* Solapas: ← → saltan de sección y mueven el foco, como manda el patrón
     de tablist. Inicio/Fin van a la primera y a la última. */
  if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
    const t = e.target.closest(".pol-tab");
    if (!t) return;
    e.preventDefault();
    const tabs = [...po.querySelectorAll(".pol-tab")];
    const i = tabs.indexOf(t);
    const sig =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? tabs.length - 1
          : e.key === "ArrowRight"
            ? (i + 1) % tabs.length
            : (i - 1 + tabs.length) % tabs.length;
    /* Se parsea el data-args en vez de recortar el texto: el atributo es
       JSON y recortarlo con slice rompe si algún día lleva otro campo. */
    let destino = "";
    try {
      destino = JSON.parse(tabs[sig].dataset.args)[0] || "";
    } catch (err) {}
    if (destino) polIrTab(destino, true);
    return;
  }

  /* Foco atrapado: Tab cicla dentro del modal mientras esté abierto. Sin
     esto se puede tabular al contenido de la página que queda detrás. */
  if (e.key === "Tab") {
    const f = polFocables(po);
    if (!f.length) return;
    const i = f.indexOf(document.activeElement);
    e.preventDefault();
    f[(i < 0 ? 0 : i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
  }
});
/* Clic en el velo: cierra. Igual que #mo. */
$("#po").addEventListener("click", (e) => {
  if (e.target === e.currentTarget) ACT.cerrarPol();
});
/* Elementos que-actúan-como-botón (role="button" + tabindex="0", como la
   tarjeta de barbero en la landing) no disparan click con Enter ni con
   Espacio: hay que traduzcirlos, o quedan imposibles de abrir sin mouse. */
document.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" && e.key !== " " && e.key !== "Spacebar") return;
  const el = e.target.closest('[role="button"][data-act]');
  if (!el) return;
  e.preventDefault();
  dRun(el, "act");
});
/* Escape cierra la ficha del barbero abierta. Va aparte del listener de
   Enter/Espacio porque la tecla es distinta y el resto del teclado
   (Escape) lo manejan otros bloques. */
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (document.querySelector(".lb-barber--abierta")) lbCierraTodos();
  /* Escape cierra los dos menús del header y devuelve el foco a la foto,
     que es lo que los abre. Sin esto el foco se queda en un botón que ya
     no existe. */
  if (perfilOpen || navOpen) {
    perfilOpen = 0;
    navOpen = 0;
    R();
    const p = $("#mebadge");
    if (p) p.focus();
  }
});
$("#mo").addEventListener("click", (e) => {
  if (e.target === e.currentTarget) Mx();
});

const ST = {
  pend: "Pendiente",
  hecho: "Completado",
  cancel: "Cancelado",
};

/* Secciones del panel del CLIENTE. Un solo origen: alimenta la barra del
   encabezado (escritorio) y la barra inferior (celular), así no pueden
   desincronizarse. "ajus" no va acá a propósito: Ajustes se abre desde la
   foto de perfil, no desde la navegación. */
const SEC_CLI = [
  ["home", "Inicio"],
  ["res", "Reservar"],
  ["tur", "Mis turnos"],
  ["rev", "Reseña"],
];
const lines = () =>
  S.map(
    (s) =>
      `<div class="line">${s.img ? `<img class="mini" src="${imgCld(esc(s.img), 800)}" alt="" loading="lazy" decoding="async">` : ""}<span><b>${esc(s.n)}</b> <small>${esc(s.tx)}</small></span><span class="price">${$$(s.p)}</span></div>`,
  ).join("");
function loginH() {
  const up = tab === "up",
    rec = tab === "rec";
  return `<div class="franja" aria-hidden="true"></div>
<!-- Antes esto era <main class="shell">. Con #app ahora siendo <main>,
      el login se quedaba con DOS landmarks main en la misma pantalla, que es
      peor que ninguno: axe marca "landmark-no-duplicate-main" y
      "landmark-main-is-top-level". El rol lo aporta el <main> de index.html. -->
      <div class="shell">
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
      <h2 class="lab" style="margin-top:22px">Servicios y precios</h2>
      <div class="pricing">${lines()}</div>
    </div>
  </section>
  <section class="panel">
    <div class="marca">
      <span class="sello"><img src="${esc(LOGO)}" alt="" width="48" height="48"></span>
      <b>${esc(NOMBRE)}</b>
      <button type="button" class="volver" data-act="backLanding">← Volver a la web</button>
    </div>
    <div class="tarjeta">
      <!-- La pantalla de contraseña social cuenta como una vista más: sin
               el redPass en la condición, el ingreso quedaba visible debajo y las
               dos se superponían. -->
            <div class="vista" id="ingresar" ${up || rec || redPass ? "hidden" : ""}>
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
        <p class="sub">Reservá tu turno en menos de un minuto · Al registrarte te cargamos ${PTSRv} ${PTSRv === 1 ? "punto" : "puntos"}</p>
        <div class="campo"><label for="nm">Nombre</label><input class="entrada" id="nm" name="nombre" type="text" autocomplete="name" placeholder="Tu nombre"></div>
        <div class="campo"><label for="ph">Teléfono</label><input class="entrada" id="ph" name="telefono" type="tel" autocomplete="tel" inputmode="tel" placeholder="Tu teléfono"></div>
        <div class="campo"><label for="em">Email</label><input class="entrada" id="em" name="email" type="email" autocomplete="email" inputmode="email" placeholder="sofia@correo.com"></div>
        <div class="campo"><label for="pw">Contraseña</label><div class="clave"><input class="entrada" id="pw" name="password" type="password" autocomplete="new-password" placeholder="Tu contraseña" data-in="pwLive"><button type="button" class="ver" data-act="ver" data-args="${A("@el")}">Ver</button></div><ul class="reglas" id="pwl">${pwHtml("", "")}</ul></div>
        <div class="campo"><label for="pw2">Repetí la contraseña</label><div class="clave"><input class="entrada" id="pw2" name="password2" type="password" autocomplete="new-password" placeholder="Repetí la contraseña"><button type="button" class="ver" data-act="ver" data-args="${A("@el")}">Ver</button></div></div>
        <div class="campo"><label style="display:flex;gap:10px;align-items:flex-start;cursor:pointer;line-height:1.4"><input type="checkbox" id="spol" style="width:auto;margin-top:4px;flex:0 0 auto"><span>Leí y acepto las <a href="#" data-act="openPol" style="color:var(--brass);font-weight:700;text-decoration:underline">políticas y privacidad</a> y las condiciones del servicio.</span></label></div>
        <button class="boton primario" data-act="registro">Crear cuenta</button>
        <div class="o" style="margin-top:14px">o continuá con</div>
        <div style="display:flex;gap:10px">
          <button class="boton secundario" type="button" data-act="red" data-args="${A("google", true)}" style="flex:1;display:flex;align-items:center;justify-content:center;gap:8px"><img src="assets/google.png" alt="" width="20" height="20">Google</button>
          <button class="boton secundario" type="button" data-act="red" data-args="${A("facebook", true)}" style="flex:1;display:flex;align-items:center;justify-content:center;gap:8px"><img src="assets/facebook.png" alt="" width="20" height="20">Facebook</button>
        </div>
      </div>
      <div class="vista" id="redpass" ${redPass ? "" : "hidden"}>
        <h1>ELEGÍ UNA CONTRASEÑA</h1>
        <p class="sub">Tu cuenta ya está creada con ${redPass && redPass.red === "facebook" ? "Facebook" : "Google"}. Poné una contraseña para poder entrar después sin usar esa red social.</p>
        <div class="campo"><label for="rpw">Contraseña</label><div class="clave"><input class="entrada" id="rpw" name="password" type="password" autocomplete="new-password" placeholder="Tu contraseña" data-in="redPassIn" data-args="${A("n", "@el")}"><button type="button" class="ver" data-act="ver" data-args="${A("@el")}">Ver</button></div><ul class="reglas" id="rpwl">${pwHtml("", "")}</ul></div>
        <div class="campo"><label for="rpw2">Repetí la contraseña</label><div class="clave"><input class="entrada" id="rpw2" name="password2" type="password" autocomplete="new-password" placeholder="Repetí la contraseña" data-in="redPassIn" data-args="${A("c", "@el")}"><button type="button" class="ver" data-act="ver" data-args="${A("@el")}">Ver</button></div></div>
        <button class="boton primario" data-act="redPassOk">Guardar y entrar</button>
        <p style="margin-top:14px"><small>Si seguís sin poner contraseña vas a poder mirar tu cuenta ahora, pero después no vas a poder volver a entrar.</small></p>
        <button class="enlace" data-act="redPassNo" style="margin-top:8px">Ahora no, gracias</button>
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

/* Cambia el data-src de los iframes de mapa por el src real, cuando el bloque
   entra en pantalla (o ya está, al abrir la página).

   El mapa de Google pesa alrededor de 360 KB y la sección de contacto queda
   varios scrolls más abajo en el celular: pedirlo en la primera carga es
   ancho de banda tirado a la basura para quien nunca llega hasta ahí.

   Una vez puesto el src, el observer se desconecta: el mapa ya está y no
   tiene sentido seguir mirando. */
function lbCargarMapas() {
  const marcos = document.querySelectorAll("iframe[data-src]");
  if (!marcos.length) return;
  const poner = (el) => {
    el.src = el.dataset.src;
    el.removeAttribute("data-src");
  };
  if (!("IntersectionObserver" in window)) {
    /* Sin observer (navegador muy viejo) se cargan todos: peor, pero
       funcional. */
    marcos.forEach(poner);
    return;
  }
  const ob = new IntersectionObserver(
    (entradas) => {
      for (const e of entradas) {
        if (!e.isIntersecting) continue;
        poner(e.target);
        ob.unobserve(e.target);
      }
    },
    /* rootMargin generous: se pide un poco antes de que se vea, para que al
       llegar ya esté, sin esperar. */
    { rootMargin: "300px 0px" },
  );
  marcos.forEach((m) => ob.observe(m));
}

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
      <!-- h2 y no h3: venía justo después del <h1> del héroe, así que un h3
        se saltaba un nivel (axe: heading-order). El comentario va en HTML y no
        en JSX ({/* */}) porque dentro de una plantilla de JavaScript un
        comentario de JSX sale LITERAL en la página. -->
     <h2>Reservá tu turno</h2>
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
  return `<div class="lb-widget lb-wcard">
    <h2>Reservá tu turno</h2>
    <p class="lb-lead">Elegí servicio, barbero, día y horario. Te lleva menos de un minuto.</p>
    <!-- La lista de pasos (1 a 6) es decorativa: el asistente real ya los
         muestra con nombre arriba. En el celular ocupaba dos filas de
         números sueltos que no significaban nada ("no se entiende esos
         números"), así que se oculta en pantallas chicas. -->
    <ol class="wz-pasos lb-wpasos" aria-hidden="true">${WZ_PASOS.map(
      ([n, t]) => `<span class="wz-paso"><b>${n}</b>${t}</span>`,
    ).join("")}</ol>
    <button class="lb-btn lb-btn--pri lb-btn--lg lb-btn--full" type="button" data-act="wzAbrir">Elegir mi turno</button>
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
/* Link de "Cómo llegar". Se arma desde el MISMO MAP_IFRAME del mapa, para
   que no puedan quedar desincronizados: si se cambia la coordenada en
   config.js, cambian los dos. */
const lbMapLink = () => {
  const q = /[?&]q=([^&]+)/.exec(MAP_IFRAME);
  return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(q ? q[1] : NOMBRE);
};

/* Horarios para el bloque de Contacto. Sale de config/horario, incluido
   el descanso (al/ah): si el dueño no cargó ninguno, no se muestra la
   línea en vez de inventar uno. */
/* OJO con el nombre: ya hay un `lbHorarios` más arriba (el que arma las
   franjas de la agenda). Este es el bloque de horarios de la sección de
   Contacto, con el descanso y la pastilla "Cerrado". */
function lbBloqueHorarios() {
  const c = CFB("");
  const CORTO = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const LARGO = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const orden = c.dias.includes(0) || !c.dias.includes(1) ? [0, 1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6, 0];
  /* Días consecutivos como "Lunes a jueves", que es lo que pide el
     mockup, en vez de "Lun, Mar, Mié, Jue". Si no son corridos, se listan. */
  const rangoDias = (dias) => {
    if (dias.length === 1) return LARGO[dias[0]];
    /* Consecutivos con salto de semana: vie(5), sáb(6), dom(0). Comparar
       contra dias[i-1]+1 a secas daba 0 !== 7 y la fila salía
       "viernes, sábado, domingo" en vez de "viernes a domingo". El módulo
       7 es lo que hace que el domingo cierre la semana y no la abra. */
    let corrido = true;
    for (let i = 1; i < dias.length; i++) if (dias[i] !== (dias[i - 1] + 1) % 7) corrido = false;
    return corrido ? LARGO[dias[0]] + " a " + LARGO[dias[dias.length - 1]] : dias.map((d) => LARGO[d]).join(", ");
  };
  /* Se agrupan los días que comparten horario: con Lun/Mar/Mié/Jue igual
     salían cuatro filas idénticas, mucho texto para decir lo mismo. */
  const grupos = [];
  orden.forEach((d) => {
    const abre = c.dias.includes(d);
    const desc = abre && c.al && c.ah ? hm(c.al) + "-" + hm(c.ah) : "";
    const clave = abre ? "abre|" + desc : "cerrado";
    const g = grupos[grupos.length - 1];
    if (g && g.clave === clave) g.dias.push(d);
    else grupos.push({ clave, dias: [d], abre, desc });
  });
  /* El horario de apertura sale SIEMPRE de a/c. Si se usa el descanso
     para el número grande, la fila muestra "11:30 a 13:30 hs" como si
     fuera el horario de atención, que es lo contrario de lo que abre. */
  return grupos
    .map(
      (g) => `<div class="lb-hr${g.abre ? "" : " lb-hr--cerrado"}">
        <div>
          <b>${rangoDias(g.dias)}</b>
          ${g.abre && g.desc ? `<small>Descanso ${g.desc.replace("-", " a ")} hs</small>` : ""}
        </div>
        ${g.abre ? `<strong>${hm(c.a)} a ${hm(c.c)} hs</strong>` : `<span class="lb-hr-cerrado">Cerrado</span>`}
      </div>`,
    )
    .join("");
}

function lbTablaHorarios() {
  const c = CFB("");
  const CORTO = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const LARGO = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  /* Los "días" de la agenda van de lunes a sábado para que la semana
     se lea en orden y no arrancando el domingo. */
  const orden = c.dias.includes(0) || !c.dias.includes(1) ? [0, 1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6, 0];

  /* Se agrupan los días que comparten horario. Antes era una fila por día y
     con Lun/Mar/Mié/Jue igual salían cuatro filas idénticas: mucho texto
     para decir lo mismo. */
  const grupos = [];
  orden.forEach((d) => {
    const abre = c.dias.includes(d);
    const desc = abre && c.al && c.ah ? `${hm(c.al)}–${hm(c.ah)}` : "";
    const clave = abre ? "abre|" + desc : "cerrado";
    const g = grupos[grupos.length - 1];
    if (g && g.clave === clave) g.dias.push(d);
    else grupos.push({ clave, dias: [d], abre, desc });
  });

  const filas = grupos
    .map((g) => {
      const d0 = g.dias[0];
      const hasta = g.dias[g.dias.length - 1];
      const rangoDias =
        g.dias.length === 1
          ? LARGO[d0]
          : g.dias.length === 7
            ? "Todos los días"
            : `${CORTO[d0]} a ${CORTO[hasta]}`;
      if (!g.abre) return `<li class="lb-hg lb-hg--cerrado"><b>${rangoDias}</b><span>Cerrado</span></li>`;
      return `<li class="lb-hg">
        <b>${rangoDias}</b>
        <span class="lb-hg-h">${hm(c.a)}<i>hs</i> a ${hm(c.c)}<i>hs</i></span>
        ${g.desc ? `<small>Descanso ${g.desc.replace("-", " a ")} hs</small>` : ""}
      </li>`;
    })
    .join("");
  return `<ul class="lb-hor">${filas}</ul>`;
}

/* Horario de un barbero en una línea, para la tarjeta: "Lun a Jue · 09:00 a
   17:00 hs". Toma el horario propio si tiene (config/horario -> .por[bid]) y
   si no el general, que es lo mismo que usa la reserva: lo que dice la tarjeta
   es exactamente lo que después bloquea los horarios.
   Devuelve "" si el barbero no tiene ningún día abierto: en ese caso la
   tarjeta no muestra el bloque ATIENDE en vez de mentir con un horario. */
const lbHorarioTxt = (bid) => {
  const c = CFB(bid);
  const CORTO = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  /* Los días van de lunes a sábado para que la semana se lea en orden; sólo
     si el domingo es el único día abierto se pone primero. */
  const orden = c.dias.includes(0) || !c.dias.includes(1) ? [0, 1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6, 0];
  /* Un día puede estar en `dias` y en `libres` (cerrado ese día exacto). */
  const abiertos = orden.filter((d) => c.dias.includes(d) && !c.libres.includes(d));
  if (!abiertos.length) return "";

  let dias;
  if (abiertos.length === 7) dias = "Todos los días";
  else {
    const corrido = abiertos.every((d, i) => i === 0 || d === abiertos[i - 1] + 1);
    dias =
      corrido && abiertos.length > 1
        ? `${CORTO[abiertos[0]]} a ${CORTO[abiertos[abiertos.length - 1]]}`
        : abiertos.map((d) => CORTO[d]).join(", ");
  }

  const horas = `${hm(c.a)} a ${hm(c.c)} hs`;
  /* La pausa al mediodía no se anuncia en el mockup, pero si el barbero la
     tiene cargada el cliente tiene que saberlo antes de venir. Va en otra
     línea: pegada a la principal, en el celu la línea se partía al medio y
     quedaba "Pausa 11:30 a / 13:30". */
  return { dias, horas, pausa: c.al && c.ah ? `Pausa ${hm(c.al)} a ${hm(c.ah)}` : "" };
};

/* Ficha ampliada de un barbero, para el diálogo de la landing.
   Los datos salen de config/barberos porque es lo único legible sin sesión
   (ver comentario de la tarjeta). Todo es opcional: si el barbero no cargó
   nada, la tarjeta ni muestra el botón. */
const lbFichaBarbero = (b) => ({
  n: b.n || "",
  esp: b.esp || b.especialidad || "",
  desc: b.desc || "",
  tel: b.tel || b.whatsapp || "",
  ig: b.ig || "",
  redes: Array.isArray(b.redes) ? b.redes.filter((r) => r && r.url) : [],
});

/* Normaliza un teléfono a formato de wa.me (solo dígitos, con 549). */
const lbTelWa = (t) => {
  const d = String(t || "").replace(/\D/g, "");
  if (!d) return "";
  return d.startsWith("54") ? d : "54" + d.replace(/^0/, "");
};

/* ---------- La tarjeta que se da vuelta ----------
   Dos caras dentro de .lb-barber-int: la de adelante con foto y nombre, la
   de atrás con la ficha. La rotación 180° la hace el CSS; acá sólo se
   cambia la clase y se anima la altura.

   El alto hay que animarlo a mano porque el dorso es más alto que el frente
   y las dos caras están superpuestas (position:absolute): sin esto la
   tarjeta rota se saldría de la grilla y taparía a la de al lado. */
/* El grupo es la zona que GIRA (`.lb-barber-giro`), no la tarjeta entera.
   Con el rediseño la tarjeta se partió en dos: la zona de la foto y el
   nombre gira, y el pie con los dos botones queda fijo. `data-act` y
   `data-args` viven en la zona que gira, así que lbFlip tiene que buscar
   ahí: si el grupo fuera la tarjeta, no encontraría el turno y el giro
   no abriría nada. */
const LB_GRUPO = ".lb-barber-giro";
/* Para el alto y la clase de "abierta" hay que ir a la tarjeta: es la que
   tiene overflow:hidden y la transición de altura. La zona que gira no
   tiene bordered, y animarle el alto a ella no expande la caja visible. */
const lbTarjeta = (giro) => giro.closest(".lb-barber") || giro;

/* Estado de las caras: la oculta queda `inert` para que sus enlaces y
   botones no entren al taborder ni la lea el lector de pantalla. Girada,
   `backface-visibility:hidden` la esconde de la vista pero NO la saca del
   árbol de accesibilidad, así que sin `inert` se podría tabular a un link
   que no se ve. */
function lbCaras(tarjeta, abierta) {
  const frente = tarjeta.querySelector(".lb-barber-frente");
  const atras = tarjeta.querySelector(".lb-barber-atras");
  tarjeta.setAttribute("aria-expanded", abierta ? "true" : "false");
  if (atras) {
    atras.setAttribute("aria-hidden", abierta ? "false" : "true");
    atras.inert = !abierta;
    if (frente) frente.inert = abierta;
  }
}

/* Alto que necesita una cara. Las dos están superpuestas con
   position:absolute, así que scrollHeight ya es su alto real: no hay que
   sacarlas del flujo para medirlas. */
const lbAltoCara = (cara) => (cara ? Math.ceil(cara.getBoundingClientRect().height) : 0);

/* Alto que necesita la TARJETA, que no es el de la cara.

   La tarjeta se compone de la zona que gira (la cara) MÁS el pie con los
   dos botones, y entre los dos hay 2 px de borde (1 arriba, 1 abajo).
   Medir sólo la cara y putearle ese alto a la tarjeta dejaba al pie sin
   lugar: la caja se achicaba 83 px al empezar el giro —justo los botones—
   y a los 620 ms saltaba de golpe al alto real. Eso era lo que se veía
   como "se contrae un poco".

   Ojo: se mide con la cara SIN rotar. Una cara con rotateY(180deg)
   devuelve la caja ya transformada y el número no es de fiar. */
function lbAltoTarjeta(cara) {
  if (!cara) return 0;
  const tarjeta = lbTarjeta(cara.closest(".lb-barber-giro") || cara);
  const pie = tarjeta.querySelector(".lb-barber-pie");
  const pieAlto = pie ? Math.ceil(pie.getBoundingClientRect().height) : 0;
  return lbAltoCara(cara) + pieAlto + 2;
}

/* Alto NATURAL del dorso, con el pie de botones oculto.

   El dorso está en `position:absolute; inset:0`, así que su caja siempre
   mide lo que la tarjeta y no dice nada sobre cuánto contenido tiene: pedirle
   el alto a él es asking al espejo. La única forma de que un `inset:0`
   reporte su alto real es sacarlo del flujo con el frente oculto y el pie
   sin medir, y recién ahí leerlo.

   Hace falta porque, con el dorso nuevo (horario + lista de servicios), en el
   celular el dorso necesita ~640 px y con el pie de dos botones apilados
   (144 px) sólo quedaban 533: el bloque de WhatsApp e Instagram quedaba
   tapado detrás del botón dorado y había que scrollear adentro de la tarjeta.
   While está abierta, el pie se oculta (CSS) y el dorso trae su propio
   "Reservar con X", así que no se pierde ninguna acción. */
function lbAltoDorso(atras, frente) {
  const tarjeta = lbTarjeta(atras.closest(".lb-barber-giro") || atras);
  const pie = tarjeta.querySelector(".lb-barber-pie");
  const antes = {
    alto: tarjeta.style.height,
    pie: pie ? pie.style.display : null,
    pos: atras.style.position,
    rot: atras.style.transform,
    frente: frente ? frente.style.display : null,
  };
  if (frente) frente.style.display = "none";
  atras.style.position = "static";
  atras.style.transform = "none";
  if (pie) pie.style.display = "none";
  tarjeta.style.height = "";
  const h = Math.ceil(atras.getBoundingClientRect().height) + 2;
  tarjeta.style.height = antes.alto;
  atras.style.position = antes.pos;
  atras.style.transform = antes.rot;
  if (frente) frente.style.display = antes.frente;
  if (pie) pie.style.display = antes.pie;
  return h;
}

/* Abre o cierra una tarjeta. */
function lbAbre(giro, abrir) {
  const atras = giro.querySelector(".lb-barber-atras");
  const frente = giro.querySelector(".lb-barber-frente");
  if (!atras || !frente) return;
  /* El alto y la clase van en la TARJETA, no en la zona que gira: la que
     tiene overflow:hidden y la transición es la de afuera. */
  const tarjeta = lbTarjeta(giro);

  /* La tarjeta NO cambia de tamaño al girar: se le da el alto del dorso más
     alto de los dos, así el toque no redimensiona nada bajo el dedo y sólo
     rota. Antes se animaba de frente a dorso y ese cambio de tamaño se leía
     como un tirón. Si algún día el dorso queda más alto que el frente (una
     ficha larga), la tarjeta crece igual, pero nunca se encoge.

     Al ABRIR se mide el dorso solo (sin el pie, que se oculta) porque es el
     que tiene que entrar entero; al CERRAR se mide el frente con su pie, que
     es como se ve la tarjeta en la grilla. */
  const h = abrir ? lbAltoDorso(atras, frente) : lbAltoTarjeta(frente);
  const actual = Math.ceil(tarjeta.getBoundingClientRect().height);
  const cambia = Math.abs(h - actual) > 1;

  /* Reflow antes de cambiar: sin esto el navegador ve "auto" -> "739px"
     como un solo salto y no anima. Sólo hace falta si el alto cambia de
     verdad; si la tarjeta ya mide eso, no se toca el style y la rotación
     corre limpia. */
  if (cambia) {
    tarjeta.style.height = "";
    void tarjeta.offsetHeight;
    tarjeta.style.height = h + "px";
  }

  tarjeta.classList.toggle("lb-barber--abierta", abrir);
  lbCaras(giro, abrir);

  /* Cuando termina la transición se suelta a `auto` para que la tarjeta
     siga acompañando el alto si el texto se reacomoda al cambiar el ancho.
     Se espera al `transitionend` y no a un tiempo fijo: con un timeout la
     suelta caía en el aire y se veía el salto. Si la altura no se animó no
     hay evento al que esperar y no hay nada que soltar. */
  clearTimeout(tarjeta._lbT);
  if (cambia) {
    const suelta = (ev) => {
      if (ev && ev.propertyName !== "height") return;
      tarjeta.removeEventListener("transitionend", suelta);
      clearTimeout(tarjeta._lbT);
      tarjeta._lbT = null;
      /* `auto` da el mismo alto que se acaba de medir; si por lo que sea
         no, se vuelve al número para que la caja no salte. */
      tarjeta.style.height = "";
      if (Math.ceil(tarjeta.getBoundingClientRect().height) < h) {
        tarjeta.style.height = h + "px";
      }
    };
    tarjeta.addEventListener("transitionend", suelta);
    /* Red de seguridad: si la transición no dispara (reduced-motion la deja
       en 0s, o la pestaña está en background) el listener no queda colgado. */
    tarjeta._lbT = setTimeout(() => suelta(null), 700);
  }

  /* El dorso es más alto que el frente: al crecer, la tarjeta puede
     quedarse a medias fuera de pantalla o —peor— quedar con el remate de
     arriba tapado por el header fijo.

     `scrollIntoView({block:"nearest"})` NO sirve para esto: "nearest" mira
     los bordes del viewport, no el header. Como la tarjeta abierta entra
     justa en la ventana, nearest decide que no hay nada que mover y la
     deja con los primeros 100 px debajo del header. Por eso el scroll se
     calcula a mano contra el alto real del header. */
  if (abrir) {
    clearTimeout(tarjeta._lbT2);
    tarjeta._lbT2 = setTimeout(() => {
      tarjeta._lbT2 = null;
      const r = tarjeta.getBoundingClientRect();
      /* Antes: `arriba` se sacaba del borde inferior de ".lb-hd". Ese número
         es una trampa: el header de la landing es sticky Sólo dentro del
         alcance de su padre, así que al scrollear lejos se despega y su
         `bottom` se va en negativo (medido: -2447). Con eso `arriba` daba
         -2435, la comparación `r.top < arriba` nunca se cumplía y el
         scroll no se hacía nunca: al tocar una ficha en el celular la tarjeta
         quedaba con el remate cortado arriba.

         Ahora se mide el header que REALMENTE está tapando: si el <header>
         de la app está pegado arriba, se usa su borde; si no hay ninguno
         pegado, se deja un margen chico y nada más. Un header que no está
         visible no puede tapar nada. */
      const cab = [...document.querySelectorAll("header, .lb-hd")]
        .map((h) => h.getBoundingClientRect())
        .filter((q) => q.top >= -2 && q.bottom > 0 && q.bottom < window.innerHeight * 0.6)
        .sort((a, b) => b.bottom - a.bottom)[0];
      const arriba = (cab ? cab.bottom : 0) + 12;
      const abajo = window.innerHeight - 12;
      /* Prioridad al borde de arriba: lo que se tapa es el remate de la
         foto. Si además no entra por abajo, se prioriza que al menos se vea
         el final (nombre y botón), que es la parte accionable. */
      let delta = 0;
      if (r.top < arriba) delta = r.top - arriba;
      else if (r.bottom > abajo) delta = r.bottom - abajo;
      if (delta) window.scrollBy({ top: delta, behavior: "smooth" });
    }, 460);
  }
}

/* Cierra todas las fichas abiertas. Se usa al tocar otra y antes de
   saltar a reservar, para no dejar ninguna dada vuelta. */
function lbCierraTodos(excepto) {
  /* La clase "abierta" va en la tarjeta, pero el grupo son las zonas que
     giran: se busca por la tarjeta y se pasa el giro a lbAbre. */
  document.querySelectorAll(".lb-barber.lb-barber--abierta").forEach((tarjeta) => {
    const giro = tarjeta.querySelector(LB_GRUPO);
    if (giro && giro !== excepto) lbAbre(giro, false);
  });
}

/* Entrada desde el click o el teclado en la tarjeta. Cierra las demás y
   abre ésta; si ya estaba abierta, la cierra. */
function lbFlip(id) {
  /* Se busca comparando el data-args en vez de por selector de atributo:
     el valor es JSON con comillas escapadas y CSS.escape sobre eso se
     pone frágil. */
  let giro = null;
  for (const t of document.querySelectorAll(LB_GRUPO)) {
    if (t.dataset.args === JSON.stringify([id])) {
      giro = t;
      break;
    }
  }
  if (!giro) return;
  const tarjeta = lbTarjeta(giro);
  const abierta = tarjeta.classList.contains("lb-barber--abierta");
  /* Sólo una ficha abierta: al tocar una nueva, la anterior se da vuelta
     para su lado. */
  lbCierraTodos(giro);
  lbAbre(giro, !abierta);
}

/* Ficha que ve el cliente en la landing.

   ANTES era un `<details class="perfil">` que se abría EN EL DORSO, arriba de
   todo, entre la tarjeta de tu nombre y el título "AGENDA". El dueño pidió que
   sea una ventana emergente: al abrirlo, el formulario se colgaba en medio de
   la pantalla y empujaba la agenda hacia abajo (con el móvil, que es donde
   más se nota), y al guardar había que volver a buscar dónde quedó.

   Ahora es un modal. El bloque inline desaparece de la agenda y los campos
   viven en #mo, el mismo lugar que usan los avisos.

   Se conservan los mismos ids (#pfNombre, #pfEsp, #pfDesc, #pfTel, #pfIg,
   #pfRedes) porque guardarPerfil los lee por id, y el `maxlength` de cada
   campo va en el HTML: el modal se inyecta una sola vez y se relee al abrir.

   La descripción va como CONTENIDO del textarea, no como placeholder: con
   placeholder, abrir y guardar sin tocarla vaciaba el campo en Firestore. */
function perfilH() {
  const f = miFicha();
  const redes = (f.redes || [])
    .map((r) => (r.url ? (r.n || r.url) + " | " + r.url : ""))
    .join("\n");
  return (
    `<div class="mf-campos">` +
    `<div class="cols2">
    <label class="campo"><span class="etq">Nombre</span><input class="entrada" id="pfNombre" value="${esc(f.n || (SB && SB.n) || "")}" maxlength="40"></label>
    <label class="campo"><span class="etq">Oficio / especialidad</span><input class="entrada" id="pfEsp" value="${esc(f.esp || f.especialidad || "")}" placeholder="Barbero, colorista…" maxlength="40"></label>
  </div>
  <label class="campo"><span class="etq">Descripción</span><textarea class="entrada" id="pfDesc" rows="3" maxlength="300" placeholder="Contá tu estilo, tu oficio, qué te gusta hacer.">${esc(f.desc || "")}</textarea></label>
  <div class="cols2">
    <label class="campo"><span class="etq">WhatsApp</span><input class="entrada" id="pfTel" inputmode="tel" value="${esc(f.tel || "")}" placeholder="5493757xxxxxx" maxlength="24"></label>
    <label class="campo"><span class="etq">Instagram</span><input class="entrada" id="pfIg" value="${esc(f.ig || "")}" placeholder="usuario, sin @" maxlength="40"></label>
  </div>
  <label class="campo"><span class="etq">Otra red social</span><textarea class="entrada" id="pfRedes" rows="2" placeholder="una por línea: Nombre | https://…">${esc(redes)}</textarea></label>` +
    `</div>`
  );
}

/* Abre la ventana. Devuelve false si no hay con qué armarla, para que el que
   la llama pueda avisar en vez de no hacer nada (que era lo que pasaba antes). */
function abrirPerfil() {
  if (!me) return false;
  const m = $("#mo");
  if (!m) return false;
  mr = document.activeElement;
  mf = null; /* el modal de perfil no es un aviso: al cerrar no dispara nada */
  m.innerHTML =
    `<div class="mb mb--ancho" role="dialog" aria-modal="true" aria-labelledby="pmh">` +
    `<div class="pole"></div>` +
    `<h2 id="pmh">Editar perfil</h2>` +
    `<p class="mt"><small>Estos datos salen en tu tarjeta del equipo, en la web. Si los dejás vacíos, la tarjeta no muestra el botón de información.</small></p>` +
    perfilH() +
    `<div class="chips">` +
    `<button class="main" data-act="guardarPerfil" type="button">Guardar</button>` +
    `<button data-act="Mx" type="button">Cancelar</button>` +
    `</div></div>`;
  m.hidden = false;
  busy(0);
  /* El foco va al primer campo, no al botón: se abre para escribir. */
  const c = m.querySelector("input, textarea");
  c && c.focus();
  return true;
}

/* Cierra la ventana de "Editar perfil".

   OJO con el nombre: YA EXISTE un `ACT.cerrarPerfil`, que cierra el MENÚ del
   encabezado (el dropdown con "Editar perfil" y "Cambiar foto"). Si este se
   llamara igual, el botón "Cancelar" del modal dispararía el cierre del menú y
   la ventana seguiría abierta, sin guardar nada y sin avisar. */
function cerrarModalPerfil() {
  Mx();
}

/* Los links sociales del header y del pie compacto se fueron: el pie se
   eliminó de la landing y las redes ya están en la sección de Contacto,
   como botones .lb-pill. Con eso la familia .lb-soc* quedó sin uso y se
   borró junto con lbSoc(). Ojo: los iconos van como <img>, nunca como
   mask-image de CSS — los logos reales (Instagram con degradado, WhatsApp
   con su verde) son multicolor y como máscara se vuelven un bloque opaco. */

/* Botón Reservar: si ya hay sesión va directo a reservar; si no, deja el
   hash en #/reservar para que al loguearse el router lo tome solo. */
const lbCta = (clase, txt) =>
  `<button class="lb-btn lb-btn--pri ${clase}" type="button" data-act="lbReservar">${txt || "Reservar ahora"}</button>`;

function landingH() {
  const pb = lbPuntos();
  /* Mirando la web con la sesión abierta: se avisa arriba y se da el botón
     para volver al panel, así no hace falta cerrar sesión. */
  /* Mismo criterio que la insignia del header (mn2), para que no aparezca un
     nombre distinto en los dos lugares. */
const quien = isAdm() ? (SB && SB.n) || "Dueño" : (U && U.nm) || "Cliente";
  const barraWeb = me
    ? `<div class="lb-volver" role="status">
        <span>Viendo la web como <b>${esc(quien)}</b></span>
        <button type="button" data-act="verWebOff">Volver a mi panel</button>
      </div>`
    : "";
  const dTxt = (d) => ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"][d];

  /* ---------- 9. servicios: datos reales, grilla que se acomoda sola ---------- */
  const svcGrid = S.length
    ? S.map(
        (x) => `<article class="lb-sv">
        ${/* La foto de preview la carga el dueño desde Servicios y premios y
             veníaguardada en el dato (`img`), pero la tarjeta no la
             pintaba: por eso "las cargo y no se muestran". */ x.img ? `<img class="lb-sv-img" src="${imgCld(esc(x.img), 800)}" alt="" loading="lazy" decoding="async">` : ""}
        <div class="lb-sv-bd">
        <h3>${esc(x.n)}</h3>
        ${x.tag ? `<p class="lb-sv-desc">${esc(x.tag)}</p>` : ""}
        <div class="lb-sv-ft"><span class="lb-sv-dur">${esc(x.tx)}</span><span class="lb-price">${$$(x.p)}</span></div>
        </div>
      </article>`,
      ).join("")
    : `<p class="lb-empty">Todavía no hay servicios cargados.</p>`;

  const svcList = S.length
    ? S.map(
        (x) => `<div class="lb-sv-row">
        ${x.img ? `<img class="lb-sv-mini" src="${imgCld(esc(x.img), 300)}" alt="" loading="lazy" decoding="async">` : ""}
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
        (g) => `<figure><img src="${imgCld(esc(g.url), 800)}" alt="Trabajo de ${esc(NOMBRE)}" loading="lazy" decoding="async" width="600" height="600"></figure>`,
      ).join("")
    : [1, 2, 3, 4, 5]
        .map(
          (i) => `<figure><div class="lb-gal-ph">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-7 7"/></svg>
        <span>FOTO ${i}</span></div></figure>`,
        )
        .join("");

  /* ---------- 12. equipo ----------
   Los datos de cada barbero salen de config/barberos, que es la única
   colección de perfil que se puede leer SIN sesión (staff/{uid} pide
   sesión). Por eso la ficha —teléfono, Instagram, redes, descripción—
   vive acá y no en el documento de staff.

   La tarjeta es una ficha que se DA VUELTA: al tocarla rota 180° y muestra
   la información atrás. Al tocar otro barbero, el anterior se cierra y
   éste se abre (sólo una a la vez, ver lbFlip).

   Antes sólo era pulsable el que tenía ficha cargada, y como ningún
   barbero la cargaba la función no se veía nunca. Ahora TODA tarjeta se
   da vuelta: el dorso muestra lo que haya y siempre el botón de reservar,
   así sirve aunque la ficha esté vacía. */
  const lbDorso = (b) => {
    const f = lbFichaBarbero(b);
    const nombre = (b.n || "el barbero").trim();
    const primero = nombre.split(" ")[0] || "el barbero";
    const wa = lbTelWa(f.tel);

    /* Los servicios son los de la peluquería, los mismos que muestra la
       sección de servicios y los que cobra la reserva: no hay forma de que un
       barbero diga "yo hago estos dos". Si algún día se agrega eso, este es el
       lugar donde se filtra. */
    const servicios = S.length
      ? S.map(
          (x) => `<li class="lb-bd-sv">
            <span class="lb-bd-sv-t"><b>${esc(x.n)}</b>${
              x.tag || x.tx ? `<small>${esc([x.tag, x.tx].filter(Boolean).join(" · "))}</small>` : ""
            }</span>
            <b class="lb-bd-sv-p">${$$(x.p)}</b>
          </li>`,
        ).join("")
      : '<li class="lb-bd-sv-n">Todavía no hay servicios cargados.</li>';

    const horario = lbHorarioTxt(b.id);

    return `<div class="lb-bd-cab">
        <b class="lb-bd-nom">${esc(nombre)}</b>
        <button class="lb-bd-giro" type="button" data-act="lbFlip" data-args="${A(b.id)}" aria-label="Volver a la foto de ${esc(nombre)}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.5 12a8.5 8.5 0 1 1-2.5-6"/><path d="M20.5 4v5h-5"/></svg>
        </button>
      </div>
      ${f.esp ? `<p class="lb-bd-esp">${esc(f.esp)}</p>` : ""}
      ${f.desc ? `<p class="lb-bd-sobre">Sobre ${esc(primero)}</p><p class="lb-bd-desc">${esc(f.desc)}</p>` : ""}
      ${horario ? `<div class="lb-bd-atiende">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>
        <span><small>Atiende</small><b>${esc(horario.dias)} · ${esc(horario.horas)}</b>${horario.pausa ? `<em>${esc(horario.pausa)}</em>` : ""}</span>
      </div>` : ""}
      <p class="lb-bd-lab">Servicios</p>
      <ul class="lb-bd-svs">${servicios}</ul>
      ${/* WhatsApp e Instagram van como botones con borde, uno al lado del
           otro como en el mockup. Las demás redes que cargue el barbero van
           debajo, en lista, para no romper la grilla de dos. */
        wa || f.ig || f.redes.length
          ? `<div class="lb-bd-redes">${
              wa
                ? `<a class="lb-bd-red" href="https://wa.me/${esc(wa)}" target="_blank" rel="noopener">
                    <img src="assets/whatsapp-96.png" alt="" width="20" height="20"> WhatsApp</a>`
                : ""
            }${
              f.ig
                ? `<a class="lb-bd-red" href="https://www.instagram.com/${esc(f.ig.replace(/^@/, ""))}" target="_blank" rel="noopener">
                    <img src="assets/instagram-96.png" alt="" width="20" height="20"> Instagram</a>`
                : ""
            }${f.redes
              .map(
                (r) => `<a class="lb-bd-red" href="${urlSegura(r.url)}" target="_blank" rel="noopener">
                ${r.ic ? `<img src="${urlSegura(r.ic)}" alt="" width="20" height="20">` : ""} ${esc(r.n || r.url)}</a>`,
              )
              .join("")}</div>`
          : '<p class="lb-bd-vacio">Todavía no cargó su información de contacto.</p>'}`;
  };

  /* ---------- equipo (mockup del dueño) ----------
   La tarjeta se parte en dos: arriba la zona que gira (foto + nombre) y
   abajo el pie con los dos botones, que NO giran.

   Antes era un solo elemento con role="button" que giraba entero, y el
   "Ver información" era un cartelito posicionado sobre la foto. Con el
   mockup hacen falta DOS botones ("Reservar con X" y "Ver información") y
   un botón dentro de otro botón no es HTML válido, así que el pie quedó
   fuera de la zona que gira.

   El disparador del giro es un <div role="button"> y no un <button> a
   propósito: el dorso puede contener enlaces (WhatsApp, Instagram) y
   anidar un <button> real ahí dentro tampoco valdría. El teclado lo
   maneja el listener de Enter/Espacio que ya existía. */
  const equipo = BARS.length
    ? BARS.map((b) => {
        const ficha = lbFichaBarbero(b);
        const nombre = (b.n || "el barbero").split(" ")[0];
        return `<article class="lb-barber">
      <div class="lb-barber-giro" data-act="lbFlip" data-args="${A(b.id)}" tabindex="0" role="button" aria-expanded="false" aria-label="Ver información de ${esc(b.n)}">
        <div class="lb-barber-int">
          <span class="lb-barber-cara lb-barber-frente">
            <span class="lb-barber-ph">${b.foto ? `<img src="${imgCld(esc(b.foto), 800)}" alt="${esc(b.n)}" loading="lazy" decoding="async" width="400" height="400">` : `<span class="lb-barber-falta" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><path d="M20 4 8.5 15.5M14.5 14.5 20 20M8.5 15.5 4 20"/></svg><small>[Foto]</small></span>`}</span>
            <span class="lb-barber-id">
              <b>${esc(b.n)}</b>
              <span class="lb-barber-pill">${esc(ficha.esp || "Barbero")}</span>
              ${ficha.desc ? `<span class="lb-barber-desc">${esc(ficha.desc)}</span>` : ""}
            </span>
          </span>
          <span class="lb-barber-cara lb-barber-atras" aria-hidden="true" inert>
            <div class="lb-bd-cuerpo">${lbDorso(b)}</div>
            <button class="lb-btn lb-btn--pri lb-btn--full lb-bd-res" type="button" data-act="lbReservarBar" data-args="${A(b.id)}">Reservar con ${esc(nombre)}</button>
          </span>
        </div>
      </div>
      <div class="lb-barber-pie">
        <button class="lb-btn lb-btn--pri lb-barber-res" type="button" data-act="lbReservarBar" data-args="${A(b.id)}">Reservar con ${esc(nombre)}</button>
        <button class="lb-btn lb-btn--ghost lb-barber-info" type="button" data-act="lbFlip" data-args="${A(b.id)}">Ver información</button>
      </div>
    </article>`;
      }).join("")
    : `<p class="lb-todo"><b>Equipo sin cargar</b>Cargá los barberos desde el panel de la barbería y aparecen acá solos.</p>`;

  /* Tarjeta de llamado que el mockup pone debajo de la grilla. */
  const ctaEquipo = BARS.length
    ? `<div class="lb-elige">
         <span class="lb-elige-ico" aria-hidden="true">
           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>
         </span>
         <h3>Elegí con quién cortarte</h3>
         <p>Elegís barbero, día y horario en menos de un minuto.</p>
         <button class="lb-btn lb-btn--pri lb-btn--full" type="button" data-act="lbReservar">Reservar ahora</button>
       </div>`
    : "";

  /* ---------- 13. testimonios: carrusel ----------
     En escritorio se ven 3 por vez y en el celomar 1. Antes se veía una sola
     en una caja del ancho de la pantalla: con una reseña corta ("asd") el
     90% de la caja quedaba vacío y el texto perdía importancia. Los
     puntitos tampocoaban: con 12 reseñas eran 12 pastillas iguales y no
    aban en cuál estabas. Ahora va un contador "1–3 de 12". */
  const tsts = TESTS.length
    ? `<div class="lb-car" id="lbcar" role="region" aria-roledescription="carrusel" aria-label="Reseñas de clientes">
        <div class="lb-car-vent">
        <div class="lb-car-viz">
          ${TESTS.map(
            (t, i) => `<div class="lb-tst" role="group" aria-roledescription="diapositiva" aria-label="${i + 1} de ${TESTS.length}" aria-hidden="true">
            <span class="lb-stars" role="img" aria-label="${Math.max(1, Math.min(5, t.estrellas || 5))} de 5 estrellas">${"<svg width='18' height='18' viewBox='0 0 24 24' fill='currentColor' aria-hidden='true'><path d='M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.3 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z'/></svg>".repeat(Math.max(1, Math.min(5, t.estrellas || 5)))}</span>
            <blockquote>“${esc(t.texto || "")}”</blockquote>
            <footer>
              ${/* La foto sí estaba guardada en el documento de la reseña
                   (`revSend` escribe `foto`), pero el carrusel no la
                   pintaba: sólo nombre y texto. Si el cliente no cargó
                   foto, va la inicial. */
                t.foto
                  ? `<img class="lb-tst-av" src="${esc(t.foto)}" alt="" width="30" height="30" loading="lazy" decoding="async">`
                  : `<span class="lb-tst-av lb-tst-av--ini" aria-hidden="true">${esc((t.nm || "?").trim()[0].toUpperCase())}</span>`}
              <cite>${esc(t.nm || "Cliente")}</cite>
            </footer></div>`,
          ).join("")}
        </div>
        </div>
        <div class="lb-car-ctl">
          <button class="lb-car-btn" type="button" data-act="lbCar" data-args="${A(-1)}" aria-label="Reseñas anteriores"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg></button>
          <p class="lb-car-n" aria-live="polite" aria-atomic="true"><span class="lb-car-nr"></span></p>
          <button class="lb-car-btn" type="button" data-act="lbCar" data-args="${A(1)}" aria-label="Reseñas siguientes"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg></button>
        </div>
      </div>`
    : `<p class="lb-todo"><b>Aún no hay reseñas</b>Cargá testimonios reales desde el panel: acá se muestran con su nombre y estrellas.</p>`;

  return `<div class="lb">
  ${barraWeb}
  <div class="lb-stripe" aria-hidden="true"></div>

  <header class="lb-hd">
    <div class="lb-wrap lb-hd-in">
      <a class="lb-brand" href="#inicio"><img src="${LOGO}" alt="" width="54" height="54"><b>${esc(NOMBRE)}</b></a>
      <nav class="lb-nav" aria-label="Principal">
        <a href="#inicio">Inicio</a>
        <a href="#servicios">Servicios</a>
        <a href="#puntos">Puntos</a>
        <a href="#galeria">Galería</a>
        <a href="#equipo">Equipo</a>
        <a href="#testimonios">Reseñas</a>
        <a href="#contacto">Contacto</a>
      </nav>
      <div class="lb-hd-cta">
        ${
          me
            ? `<button class="lb-btn lb-btn--ghost lb-ing" type="button" data-act="verWebOff">Mi panel</button>`
            : `<button class="lb-btn lb-btn--ghost lb-ing" type="button" data-act="goLogin">Ingresar</button>`
        }
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
      <a href="#equipo">Equipo</a>
      <a href="#testimonios">Reseñas</a>
      <a href="#contacto">Contacto</a>
      <button class="lb-panel-btn" type="button" data-act="${me ? "verWebOff" : "goLogin"}">${me ? "Mi panel" : "Ingresar"}</button>
      <!-- Las redes NO van en el menú (lo pidió el dueño): el menú es para
           navegar dentro de la página, y las redes ya están en el pie y en
           la sección de Contacto, que es donde se las busca. -->
      ${lbCta("lb-panel-res")}
    </div>
  </header>

  <!-- 2. HERO -->
  <section id="inicio" class="lb-hero lb-wrap reveal">
    <div class="lb-hero-tx">
      <!-- El eyebrow y la nota de los 20 puntos los sacó el dueño: sobra
           texto de esos que ya dicen los botones.
           El párrafo sí lleva marca y ciudad. El H1 es del dueño y no se toca,
           y sin esto el texto visible de la portada no decía ni "Codigo
           Barber" ni "Puerto Iguazú" hasta llegar al contacto, muy abajo: es lo
           que Google contrasta cuando alguien busca "barbería puerto iguazú". -->
      <h1>Tu turno,<br><em>sin vueltas.</em></h1>
      <p class="lb-lead">${esc(NOMBRE)}, barbería en ${esc(CIUDAD)}. Reservá en cuatro pasos, sumá ${PTSv} puntos por cada corte y canjealos por descuentos y cortes gratis.</p>
      <div class="lb-hero-cta">${lbCta("lb-btn--lg")}</div>
    </div>
    <div class="lb-hero-wd">${lbReservaCard()}</div>
  </section>

  <!-- 3. SERVICIOS -->
  <section id="servicios" class="lb-band-ivory lb-sec reveal">
    <div class="lb-wrap">
      <div class="lb-sec-h">
        <span class="lb-eyebrow">Lo que hacemos</span>
        <h2>Nuestros servicios.</h2>
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
      ${ctaEquipo}
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
      <!-- Columna izquierda: mapa, dirección y horarios.
           Columna derecha: el formulario y las redes.
           La dirección sale de src/config.js (CALLE / BARRIO / CIUDAD /
           PROVINCIA) y las coordenadas de MAP_IFRAME; si la barbería se muda
           hay que cambiar las dos. Los horarios salen de config/horario,
           incluido el descanso (al/ah): no hay un horario escrito en el
           HTML, así que lo que se ve acá es el real. -->
      <div class="lb-cont">
        <div class="lb-cont-col">
          <!-- Orden pedido: dónde estamos, horarios, mapa, cómo llegar. -->
          <div class="lb-card lb-donde">
            <div class="lb-donde-t">
              <span class="lb-donde-ico" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z"/><circle cx="12" cy="10" r="2.6"/></svg>
              </span>
              <div>
                <span class="lb-etq">Dónde estamos</span>
                <b>${esc(CALLE)}</b>
                <span>${esc(BARRIO)}</span>
                <b>${esc(CIUDAD)}, ${esc(PROVINCIA)}</b>
              </div>
            </div>
          </div>

          <div class="lb-card lb-hor">
            <span class="lb-donde-ico lb-etq" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
              Horarios
            </span>
            ${lbBloqueHorarios()}
          </div>

          <div class="lb-map lb-map--top">
            <span class="lb-map-lbl"><b>${esc(NOMBRE)}</b><small>${esc(CALLE)}, ${esc(CIUDAD)}</small></span>
            <a class="lb-map-btn" href="${esc(lbMapLink())}" target="_blank" rel="noopener">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" width="15" height="15"><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z"/><circle cx="12" cy="10" r="2.6"/></svg>
              [MAPA · Google Maps]</a>
            <iframe
              title="Ubicación de ${esc(NOMBRE)}"
              data-src="${esc(MAP_IFRAME)}"
              loading="lazy"
              referrerpolicy="no-referrer-when-downgrade"
              allowfullscreen></iframe>
          </div>

          <!-- "Cómo llegar" va último y como botón suelto, no adentro de la
               tarjeta de dirección: el dueño lo pidió como paso aparte. -->
          <a class="lb-btn lb-btn--ghost lb-llegar lb-llegar--suelto" href="${esc(lbMapLink())}" target="_blank" rel="noopener">Cómo llegar
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" width="17" height="17"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>
        </div>

        <div class="lb-cont-col">
          <form class="lb-card lb-card--form" id="lbForm" novalidate>
            <h3>Dejanos tu mensaje</h3>
            <div class="lb-field" data-f="nombre">
              <label for="cf-name">Nombre</label>
              <input id="cf-name" name="nombre" type="text" autocomplete="name" placeholder="Tu nombre">
              <span class="lb-err" data-e="nombre" aria-live="polite"></span>
            </div>
            <div class="lb-field" data-f="email">
              <label for="cf-email">Email <abbr title="obligatorio">*</abbr></label>
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

          <div class="lb-card lb-tambien">
            <span class="lb-etq">También podés escribirnos por</span>
            <div class="lb-pills">
              ${INSTAGRAM ? `<a class="lb-pill" href="https://www.instagram.com/${esc(INSTAGRAM)}" target="_blank" rel="noopener"><img class="ic-ig" src="assets/instagram-96.png" alt="" width="22" height="22">Instagram</a>` : ""}
              ${WA_LISTA.map(
                (w) => `<a class="lb-pill" href="https://wa.me/${esc(w.num)}" target="_blank" rel="noopener"><img class="ic-wa" src="assets/whatsapp-96.png" alt="" width="22" height="22">WhatsApp ${esc(w.n)}</a>`,
              ).join("")}
            </div>
          </div>
        </div>
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

  <!-- El pie compacto de la landing se fue (lo pidió el dueño): era una
       franja con "© Codigo Barber · Turnos y puntos" y las redes, que
       repetía lo que ya está en la sección de Contacto. Sin él la landing
       cierra con la banda dorada de "Reservar ahora". -->

  <div class="lb-sticky">${lbCta("lb-btn--lg")}</div>
</div>`;
}

/* --- Handlers del widget, del menú y del color del estado del formulario.
       Aditivos: no modifican ningún handler existente. --- */
Object.assign(ACT, {
  /* Da vuelta la tarjeta del barbero. Al tocar uno, se cierra el que
     estuviera abierto: sólo puede haber una ficha abierta, así no quedan
     dos doros dando vueltas al mismo tiempo. Volver a tocarlo lo cierra. */
  lbFlip(id) {
    lbFlip(id);
  },
  /* Reservar eligiendo a ese barbero: lo deja puesto en el widget antes de
     saltar a la agenda, así el cliente no tiene que volver a elegirlo. */
  lbReservarBar(id) {
    if (id && BARS.some((b) => b.id === id)) {
      lbw.b = lbw.b === id ? "" : id;
      lbw.t = "";
    }
    /* El botón vive en el dorso de la tarjeta: se cierra para que el
       usuario vea a dónde lo lleva el widget. */
    lbCierraTodos();
    ACT.lbReservar();
  },
  /* Reservar: con sesión va directo a la agenda; sin sesión deja el hash en
     #/reservar y muestra el login. Al loguearse, el router de la app
     (rtView/rtOk, líneas ~3756) toma ese hash y abre la reserva solo. */
  lbReservar() {
    /* Si veníamos mirando la web con la sesión abierta, hay que apagar el
       modo web: si no, R() seguiría dibujando la landing y el usuario no
       llega nunca al panel. */
    verWeb = 0;
    document.body.classList.remove("ver-web");
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
  /* Avanza o retrocede UNA PÁGINA (no una reseña). Las flechas mandan -1/+1
     como número de página; antes cada flecha movía una sola tarjeta y con
     3 a la vez eso "recortaba" la caja. */
  lbCar(delta) {
    const n = TESTS.length;
    if (!n) return;
    const v = lbCarPorVista(n);
    const pags = Math.ceil(n / v);
    const a = +delta;
    lbCar.pag = a < 0 ? (lbCar.pag - 1 + pags) % pags : a % pags;
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
const lbCar = { pag: 0, n: 0, t: null, pausa: 0 };
const LB_CAR_MS = 5500;
/* Cuántas reseñas se ven a la vez. 3 en escritorio, 1 en el celular. El CSS
   tiene que coincidir con este número (--lb-car-por en landing.css), o la
   caja quedaría con huecos: si el JS cree que entran 3 y el ancho dice 2,
   se ve medio carrusel al aire. */
const lbCarPorVista = (n) => (matchMedia("(min-width: 861px)").matches ? Math.min(3, n) : 1);
const lbCarPinta = () => {
  const viz = document.querySelector(".lb-car-viz");
  if (!viz) return;
  const n = TESTS.length;
  if (!n) return;
  const v = lbCarPorVista(n);
  const pags = Math.max(1, Math.ceil(n / v));
  if (lbCar.pag >= pags) lbCar.pag = 0;
  const desde = lbCar.pag * v;
  /* El desplazamiento va en PÍXELES, no en porcentaje. El track es un
     flex de 12 tarjetas dentro de una caja de overflow:hidden, así que su
     ancho de border-box es el de la caja (~1716px), no el ancho total
     desplazable. En porcentaje, translateX(-25%) movía 429px en vez de
     los ~1770 que corresponden a una página, y el carrusel saltaba a una
     tarjeta a la vez. Medido con DOMMatrix. */
  const anchoCaja = viz.parentElement.clientWidth;
  const hueco = 14;
  viz.style.transform = `translateX(${-(lbCar.pag * (anchoCaja + hueco))}px)`;
  viz.querySelectorAll(".lb-tst").forEach((el, i) => {
    el.setAttribute("aria-hidden", i >= desde && i < desde + v ? "false" : "true");
  });
  const fin = Math.min(desde + v, n);
  const nr = document.querySelector(".lb-car-nr");
  if (nr) nr.textContent = n <= v ? `${n} de ${n}` : `${desde + 1}–${fin} de ${n}`;
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
    lbCar.pag = 0;
    lbCar.n = TESTS.length;
  }
  lbCarPinta();
  /* Con una sola página no hay nada que recorrer: sin este corte quedaba
     un temporizador corriendo que empujaba el contador para siempre. */
  if (TESTS.length <= lbCarPorVista(TESTS.length)) return;

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
    const pags = Math.max(1, Math.ceil(TESTS.length / lbCarPorVista(TESTS.length)));
    lbCar.pag = (lbCar.pag + 1) % pags;
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
  /* El próximo turno es el pendiente más cercano por fecha. Si no hay
     ninguno se muestra un hueco con el botón de reservar, para que la
     tarjeta sea un atajo y no un espacio en blanco. */
  const prox = [...T]
    .filter((t) => t.st === "pend")
    .sort((a, b) => (a.d + a.t).localeCompare(b.d + b.t))[0];
  const s = prox ? sv(prox) : null;
  const nomBar = prox ? bn(prox) : "";
  const nom = esc((U.nm || "").split(" ")[0]).toUpperCase();
  /* Las estrellas del último corte, para la franja de abajo. */
  const estrellas = `<span class="ini-est" role="img" aria-label="${esc(ult ? ult.estrellas || 5 : 0)} de 5 estrellas">` +
    [1, 2, 3, 4, 5].map((i) => (ult && i <= (ult.estrellas || 5) ? "★" : "☆")).join("") +
    `</span>`;

  const tarjetaProx = prox
    ? `<div class="card ini-prox">
      <div class="ini-etq">Próximo turno<span class="ini-badge">Confirmado</span></div>
      <div class="ini-serv"><span class="ini-serv-ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><path d="M20 4L8.5 15.5M14.5 14.5L20 20M8.5 15.5L4 20"/></svg></span><div><b>${esc(s ? s.n : "Turno")}</b><small>${esc(s ? s.tx : "")}</small></div></div>
      <div class="ini-cuadro"><div><small>Día y hora</small><b>${esc(fd(prox.d))} · ${esc(prox.t)}hs</b></div><div><small>Barbero</small><b>${esc(nomBar || "—")}</b></div></div>
      <div class="chips" style="margin-top:12px"><button data-act="reprogramar" data-args="${A(prox.id)}">Reprogramar</button><button data-act="askCancel" data-args="${A(prox.id)}">Cancelar turno</button></div>
      ${/* El formulario de confirmación tiene que estar ACÁ. askCancel
           sólo pone cx = id y repinta: la confirmación se dibuja en línea,
           en la tarjeta del turno. En el Inicio faltaba, así que el botón
           "Cancelar turno" no hacía nada visible: el dueño lo reportó. */ cx === prox.id ? cxForm(prox) : ""}
    </div>`
    : `<div class="card ini-prox">
      <div class="ini-etq">Próximo turno</div>
      <p style="margin:8px 0 14px;color:var(--mut)">No tenés turnos reservados. Sacate uno cuando quieras.</p>
      <button class="main" data-act="go" data-args="${A("res")}">Reservar ahora</button>
    </div>`;

  return (
    `${vn()}` +
    /* ---------- saludo ---------- */
    `<h1 class="ini-hola">Hola, ${esc(nom)}</h1>
     <p style="color:var(--mut);margin:6px 0 22px">Tus turnos, puntos y reseñas en un solo lugar.</p>` +
    /* ---------- puntos + próximo turno ---------- */
    `<div class="ini-par">
      <div class="card ini-pts">
        <div class="ini-etq">Tus puntos</div>
        <div class="ini-num"><b>${U.pt}</b><span>puntos</span></div>
        <p style="margin:8px 0 14px;color:var(--mut)">Canjealos por descuentos o un corte gratis.</p>
        <div class="bar" style="margin:0 0 12px"><i style="width:${pct}%"></i></div>
        <button class="pillb" style="width:100%" data-act="verPremios">Canjear puntos</button>
      </div>
      ${tarjetaProx}
    </div>` +
    /* ---------- tres accesos ---------- */
    `<div class="ini-tri">
      <button class="card ini-acc ini-acc--pri" data-act="go" data-args="${A("res")}">
        <span class="ini-acc-ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg></span>
        <b>Reservar turno</b><small>Elegí servicio y horario en menos de un minuto.</small>
      </button>
      <button class="card ini-acc" data-act="go" data-args="${A("tur")}">
        <span class="ini-acc-ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></span>
        <b>Mis turnos</b><small>Mirá tu historial y repetí tu último corte.</small>
      </button>
      <button class="card ini-acc" data-act="go" data-args="${A("rev")}">
        <span class="ini-acc-ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg></span>
        <b>Mi reseña</b><small>Contanos cómo te fue y ayudá a otros clientes.</small>
      </button>
    </div>` +
    /* ---------- la franja de la reseña ---------- */
    `<div class="card ini-franja">
      <div><b>¿Cómo te fue en tu último corte?</b>${estrellas}</div>
      <button class="pillb" data-act="go" data-args="${A("rev")}">${ult ? "Editar reseña" : "Dejar reseña"}</button>
    </div>` +
    /* ---------- premios y canjes: siguen debajo, no se pierden ---------- */
    `<h2 class="lab" id="premios">Premios</h2><div class="card" style="padding:0">` +
    PRv.map((p, i) => {
      const puede = U.pt >= p.p;
      return `<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;padding:16px 18px;border-bottom:1px solid var(--line)"><div><b>${esc(p.n)}</b><br><small>${p.p} puntos</small></div><button class="pillb" ${puede ? "" : "disabled"} data-act="redeem" data-args="${A(i)}">${cf === i ? "Confirmar canje" : "Canjear"}</button></div>`;
    }).join("") +
    `</div>` +
    (mine.length
      ? `<h2 class="lab">Tu código de canje</h2>` +
        mine
          .map(
            (c) =>
              `<div class="codebox"><div><small>${esc(c.pr)}</small><br><b style="font:700 32px 'Barlow Condensed';color:var(--brass);letter-spacing:.1em">${esc(c.c)}</b></div><small style="color:var(--mut);text-align:right">Mostralo en<br>la barbería</small></div>`,
          )
          .join("")
      : "") +
    (ult ? `<button class="main" data-act="repeat" style="margin-top:20px">Repetir mi último corte</button>` : "")
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
  /* El calendario del asistente se pinta con los datos del mes anterior
     mientras llega el nuevo: el que avanzaba de mes veía todos los días en
     rojo o en verde según el mes viejo. Este aviso tapa eso. */
  ldEspera("Consultando horarios…");
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
      ldListo();
      wzPaint();
    },
    () => ldListo(),
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

/* En el celular NO hay botón de "continuar": al tocar una opción se pasa
   sola al paso siguiente (lo pidió el dueño: "en celular seleccionamos y ya
   pase al siguiente"). Quedan sólo "Atrás" y, en el resumen, "Confirmar
   turno". En escritorio el botón sigue, porque con lista de barberos o de
   servicios conviene poder volver atrás sin perder lo elegido.

   El salto tiene un retardo corto para que se vea qué quedó marcado. El
   token `wzAuto` evita dos cosas: que un timer viejo salte después de que
   el usuario ya cambió de paso, y que dos timers se acumulen si toca
   rápido. */
const wzEsCelular = () => matchMedia("(max-width: 859px)").matches;
let wzAuto = 0;
const wzAvanzaSolo = (desde) => {
  if (!wzEsCelular()) return;
  clearTimeout(wzAuto);
  wzAuto = setTimeout(() => {
    if (WZ.paso !== desde) return; // el usuario ya se movió: no se pisa
    WZ.paso = Math.min(6, desde + 1);
    if (WZ.paso === 3 && !WZ.unsub) wzOcc();
    WZ.pintar();
  }, 280);
};

const wzPie = (siguiente, listo, txt) => `<div class="wz-pie">
  ${WZ.paso > 1 ? `<button class="wz-btn wz-btn--ghost" type="button" data-act="wzBack">← Atrás</button>` : "<span></span>"}
  ${wzEsCelular() ? "" : `<button class="wz-btn wz-btn--pri" type="button" data-act="wzNext" ${listo ? "" : "disabled"}>${txt || siguiente}</button>`}
</div>`;

/* --- 1. servicio --- */
const wzServicio = () =>
  S.length
    ? S.map(
        (x, i) => `<button type="button" class="wz-item wz-item--svc${sel.s === i ? " on" : ""}" aria-pressed="${sel.s === i}" data-act="wzS" data-args="${A(i)}">
      ${/* La foto de preview del servicio, que el dueño carga desde el panel
           y hasta ahora no se veía ni acá ni en la landing. */ x.img ? `<img class="wz-item-img" src="${imgCld(esc(x.img), 200)}" alt="" width="72" height="72" loading="lazy" decoding="async">` : ""}
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
/* Hora de fin: el turno dura lo que dura el servicio, así que mostrando
   hasta qué hora vas a estar ocupado se evita el "yo salía a las 16".
   Si el horario no se puede parsear, no se muestra nada en vez de inventar. */
function wzTermina(hora, durMin) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hora || ""));
  if (!m || !durMin) return "";
  const fin = (+m[1] * 60 + +m[2] + durMin) % 1440;
  return String(Math.floor(fin / 60)).padStart(2, "0") + ":" + String(fin % 60).padStart(2, "0");
}
const wzIco = {
  tijera:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><path d="M20 4 8.5 15.5M14.5 14.5 20 20M8.5 15.5 4 20"/></svg>',
  persona:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="8" r="3.4"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/></svg>',
  cal:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  reloj:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
};

function wzResumen() {
  const s = S[sel.s],
    bar = BARS.find((x) => x.id === sel.b) || {};
  const b = bar.n || "—";
  const termina = wzTermina(sel.t, s.m);
  /* Cada fila lleva a su propio paso: "Cambiar" al lado del dato, para no
     tener que adivinar a qué campo se refiere.

     `foto` es opcional: cuando viene, reemplaza al ícono de la fila, así el
     cliente reconoce el corte y el barbero de un vistazo antes de confirmar.
     Si el barbero no tiene foto (o el servicio no la tiene cargada), la fila
     se cae al ícono de siempre: nunca queda un cuadro vacío. */
  const fila = (ico, etq, val, sub, paso, foto, circular) =>
    `<div class="wz-rf">
      ${
        foto
          ? `<span class="wz-rf-img${circular ? " wz-rf-img--red" : ""}"><img src="${esc(foto)}" alt="" loading="lazy" decoding="async"></span>`
          : `<span class="wz-rf-ico" aria-hidden="true">${ico}</span>`
      }
      <div class="wz-rf-t"><span>${esc(etq)}</span><b>${esc(val)}${sub ? `<small>${esc(sub)}</small>` : ""}</b></div>
      <button type="button" class="wz-rf-c" data-act="wzIr" data-args="${A(paso)}">Cambiar</button>
    </div>`;

  return `<div class="wz-res">
    <h2 class="wz-res-tit">Confirmá tu turno</h2>
    <p class="wz-res-sub">Paso 6 de 6 · Revisá que esté todo bien antes de confirmar.</p>
    <div class="wz-res-cols">
      <div class="wz-res-card">
        ${fila(wzIco.tijera, "Servicio", s.n || "-", s.tx, 1, s.img || "")}
        ${fila(wzIco.persona, "Barbero", b, "", 2, bar.foto || "", true)}
        ${fila(wzIco.cal, "Fecha", fd(sel.d), "", 3)}
        ${fila(wzIco.reloj, "Hora", sel.t ? sel.t + "hs" : "—", termina ? "termina " + termina : "", 5)}
      </div>
      <div class="wz-res-lado">
        <div class="wz-res-precio">
          <span>Precio</span>
          <b class="lb-price">${esc($$(s.p))}</b>
          <small>Se abona en la barbería.</small>
        </div>
        <p class="wz-pol"><span aria-hidden="true">ⓘ</span> Política de cancelación: podés cancelar tu turno hasta ${CHSv} horas antes.</p>
        <label class="wz-tyc${sel.pol ? " on" : ""}" for="wzpk">
          <input type="checkbox" id="wzpk" ${sel.pol ? "checked" : ""} data-ch="wzPol" data-args="${A("@ck")}">
          <span>Leí los <a href="#" data-act="openPolSec" data-args="${A("datos")}">términos y condiciones</a>, la <a href="#" data-act="openPolSec" data-args="${A("uso")}">política de privacidad</a> y las <a href="#" data-act="openPolSec" data-args="${A("condiciones")}">condiciones del servicio</a>.</span>
        </label>
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
        }
      </div>
    </div>
  </div>`;
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
  /* En modo reprogramar el asistente dice "Confirmar turno" como si fuera
     una reserva nueva, y el cliente no entiende si le va a quedar el turno
     anterior. El aviso lo saca de dudas y le da salida. */
  const avisoRep = rep
    ? `<div class="wz-aviso-rep">
         <b>Estás reprogramando un turno</b>
         <span>No se crea uno nuevo: se cambia la fecha y la hora del que ya tenés.</span>
         <button type="button" data-act="repSalir">Salir sin cambiar nada</button>
       </div>`
    : "";
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
    ${avisoRep}
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
  /* Se cancela el salto automático pendiente: si no, el timer se dispara
     con el modal ya cerrado y deja el asistente en un paso distinto al que
     se ve en pantalla. */
  clearTimeout(wzAuto);
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
/* Privacidad: qué guardamos y para qué. El botón de borrar vive ahora en
   Ajustes (ajusH), al final de la lista, como pidió el dueño. Esta vista
   queda como la explicación y sin acción destructiva. */
function privH() {
  return `<h1>Privacidad</h1><div class="card" style="max-width:640px"><p><small>Guardamos tu nombre, teléfono y email solo para gestionar tus turnos y tus puntos.<br><br>No compartimos tus datos con terceros.<br><br>Podés pedir que los borremos cuando quieras, desde <b>Ajustes</b>.</small></p></div>`;
}

/* ---------- Ajustes del cliente ----------
   Es donde se edita el perfil y donde termina —al final de la lista— el
   borrado de la cuenta. Va por un hash propio (#/mi-cuenta) para no
   pisar el #/ajustes del dueño. */
function ajusH() {
  const foto = U.foto
    ? `<img src="${esc(U.foto)}" alt="" width="72" height="72" style="border-radius:50%;object-fit:cover;border:2px solid var(--brass)">`
    : `<span class="aval" style="width:72px;height:72px;font-size:30px">${esc((U.nm || "?")[0].toUpperCase())}</span>`;
  const msj = U.nm ? "" : "<p><small>Cargando tu cuenta…</small></p>";
  return (
    `<h1>Ajustes</h1><p style="color:var(--mut);margin-top:-10px">Tu perfil y tu cuenta.</p>` +
    /* --- Perfil --- */
    `<div class="card" style="margin-bottom:14px"><div class="ajus-fila" style="display:flex;gap:14px;align-items:center">${foto}<div style="flex:1;min-width:0"><b style="display:block">${esc(U.nm || "—")}</b><small style="color:var(--mut)">${esc(U.ph || "sin teléfono")}</small></div><button data-act="fotoTomar" style="flex:0 0 auto">Cambiar foto</button></div>` +
    `<div style="display:grid;gap:10px;margin-top:14px">` +
    `<label class="campo"><span class="etq">Nombre</span><input class="entrada" id="ajusNm" value="${esc(U.nm || "")}" maxlength="40"></label>` +
    `<label class="campo"><span class="etq">Teléfono</span><input class="entrada" id="ajusPh" inputmode="tel" value="${esc(U.ph || "")}" maxlength="30" placeholder="5493757xxxxxx"></label>` +
    `<div><button class="main" data-act="guardarPerfilCli">Guardar cambios</button></div>` +
    `</div></div>` +
    /* --- Datos --- */
    `<div class="card" style="margin-bottom:14px"><b style="display:block;margin-bottom:6px">Tus datos</b>` +
    `<p><small style="color:var(--mut)">Tu email es <b>${esc(me.email || "—")}</b> y no se cambia desde acá: es con el que entrás.</small></p>` +
    `<div><button data-act="go" data-args="${A("priv")}">Ver qué guardamos y por qué</button></div>` +
    `<div style="margin-top:10px"><button data-act="openPol">Políticas y privacidad</button></div>` +
    `</div>` +
    /* --- Eliminar cuenta: SIEMPRE al final --- */
    `<div class="card ajus-peligro" style="border-color:var(--red)"><b style="display:block;margin-bottom:6px">Eliminar cuenta</b>` +
    `<p><small style="color:var(--mut)">Se borran tu nombre, teléfono y puntos, se cancelan tus turnos pendientes y perdés el acceso a esta cuenta. <b>No se puede deshacer.</b></small></p>` +
    `<div><button class="main danger" data-act="borrarAsk">Eliminar mi cuenta</button></div>` +
    `</div>`
  );
}
function galH() {
  return (
    `<h1>Galería</h1><small>Fotos de trabajos que se muestran en la web.</small><div class="card" style="margin-top:10px;max-width:640px"><button class="main" data-act="galUp">+ Subir foto</button><small style="display:block;margin-top:8px">Cualquier barbero o el dueño puede subir; las ves en la sección Galería de la página.</small></div>` +
    (GAL.length
      ? `<div class="lnd-gal" style="margin-top:14px">${GAL.map(
          (g) =>
            `<figure style="position:relative;margin:0"><img src="${imgCld(esc(g.url), 700)}" alt="" loading="lazy" style="width:100%;height:auto;max-height:240px;object-fit:contain;border-radius:10px;display:block;border:1px solid var(--line);background:#10171F"><button data-act="galDel" data-args="${A(g.id, g.ruta || "")}" style="position:absolute;top:6px;right:6px;min-height:0;padding:4px 9px" aria-label="Borrar foto">✕</button></figure>`,
        ).join("")}</div>`
      : "<p><small>Todavía no hay fotos publicadas.</small></p>")
  );
}
/* Etiqueta de cada puntaje. Se muestra debajo de las estrellas para que el
   usuario sepa qué está eligiendo antes de tocar. */
const REV_TXT = ["", "Muy malo", "Malo", "Regular", "Bueno", "Muy bueno"];
const REV_PASOS = ["Calificá", "Contanos", "Revisá"];

function revH() {
  const n = revS || 0;
  const stars = [1, 2, 3, 4, 5]
    .map(
      (i) =>
        `<button type="button" class="rev-estrella${i <= n ? " on" : ""}" aria-label="${i} ${i === 1 ? "estrella" : "estrellas"} — ${REV_TXT[i]}" aria-pressed="${i <= n}" data-act="revStars" data-args="${A(i)}">${i <= n ? "★" : "☆"}</button>`,
    )
    .join("");
  /* Indicador de pasos: el activo en dorado, los ya hechos con un ✓, los
     de adelante apagados. Informativo: el paso se cambia con los botones de
     abajo, no clickeando el número. */
  const paso = (i) =>
    `<li class="rev-paso${revStep === i ? " on" : ""}${revStep > i ? " hecho" : ""}">
       <span class="rev-paso-n" aria-hidden="true">${revStep > i ? "✓" : i}</span>
       <span>${REV_PASOS[i - 1]}</span>
     </li>`;
  const pasos = `<ol class="rev-pasos" aria-label="Pasos de la reseña">${[1, 2, 3]
    .map((i, k) => (k ? '<li class="rev-guion" aria-hidden="true"></li>' : "") + paso(i))
    .join("")}</ol>`;

  /* Vista previa: lo mismo que va a verse en la web, armado con los datos
     que se guardan, para que no haya sorpresa al publicar. */
  const prevEst = `<span class="rev-est" role="img" aria-label="${n} de 5 estrellas">` +
    [1, 2, 3, 4, 5].map((i) => (i <= n ? "★" : "☆")).join("") +
    `</span>`;
  /* La inicial del avatar: siempre en mayúscula. Antes algunas ramas
     hacían .toUpperCase() y otras no, y con nombres en minúscula la ficha
     mostraba "r" en vez de "R" (era el caso de la vista previa). */
  const ini = (U && U.nm && U.nm[0] ? U.nm[0] : "?").toUpperCase();
  const prev = `<div class="rev-prev">
      <h3 class="rev-h3">Así se verá en la web</h3>
      <div class="card rev-ficha">
        <div class="rev-ficha-cab">
          ${U && U.foto
            ? `<img src="${esc(U.foto)}" alt="" width="44" height="44" style="border-radius:50%;object-fit:cover;border:2px solid var(--brass)">`
            : `<span class="aval" style="width:44px;height:44px;font-size:19px">${esc(ini)}</span>`}
          <div style="min-width:0"><b>${esc((U && U.nm) || "Tu nombre")}</b>${prevEst}</div>
        </div>
        ${/* El texto también va en la vista previa: antes sólo mostraba foto,
            nombre y estrellas, que es exactamente lo mismo para cualquier
            reseña. El mockup pide ver "cómo se verá en la web", y lo que
            se publica es el texto. */
          `<blockquote class="rev-ficha-txt">${revText && revText.trim() ? esc(revText) : '<span class="rev-ficha-vacia">Tu reseña va a aparecer acá</span>'}</blockquote>`}
      </div>
      <p style="margin:12px 0 0;color:var(--mut);font-size:14px;line-height:1.45">Se muestra tu foto de perfil, tu nombre, la cantidad de estrellas y lo que escribas.</p>
    </div>`;

  const paneles = [
    `<div class="card rev-panel">
      <h2 style="margin:0 0 16px">¿Cómo calificás tu experiencia?</h2>
      <div class="rev-estrellas" role="group" aria-label="Puntaje de tu experiencia">${stars}</div>
      <p class="rev-hint${n ? "" : " rev-hint--vacio"}">${n ? REV_TXT[n] : "Tocá las estrellas y seguimos"}</p>
      <!-- No hay botón "Siguiente" acá a propósito: al tocar una estrella
           revStars() ya salta al paso 2, así que el botón era inalcanzable
           (el dueño loMarco: "no tiene sentido"). Con teclado tampoco se
           pierde nada: se elige con Enter o Espacio sobre la estrella. -->
      <p class="rev-pie"><small>Tocá una estrella para seguir. Podés volver atrás cuando quieras.</small></p>
    </div>`,
    `<div class="card rev-panel">
      <h2 style="margin:0 0 6px">${revStep > 2 ? "¿Qué nos contás?" : "¿Cómo calificás tu experiencia?"}</h2>
      <p style="color:var(--mut);margin:0 0 14px">Contanos qué te gustó o qué cambiarías. Se publica en la web con tu nombre.</p>
      <textarea id="revText" rows="5" maxlength="600" placeholder="Contanos qué te gustó o qué cambiarías" style="width:100%">${esc(revText)}</textarea>
      <div class="chips" style="margin-top:14px"><button data-act="revBack">Volver</button><button class="main" data-act="revNext">Siguiente</button></div>
    </div>`,
    `<div class="card rev-panel">
      <div style="display:flex;gap:12px;align-items:center;margin-bottom:14px">
        ${U && U.foto
          ? `<img src="${esc(U.foto)}" alt="" width="60" height="60" style="border-radius:50%;object-fit:cover;border:2px solid var(--brass)">`
          : `<span class="aval" style="width:60px;height:60px;font-size:26px">${esc(ini)}</span>`}
        <div><b style="display:block">${esc((U && U.nm) || "Tu nombre")}</b>${prevEst}</div>
      </div>
      <p style="margin:0 0 6px">${revText && revText.trim() ? esc(revText) : '<small style="color:var(--mut)">No escribiste un mensaje.</small>'}</p>
      <small style="color:var(--mut)">${REV_TXT[n] || "Sin calificar"}</small>
      <div class="chips" style="margin-top:18px"><button data-act="revBack">Editar</button><button class="main" data-act="revSend">Guardar reseña</button></div>
    </div>`,
  ];

  /* Orden de las piezas: título, indicador, panel, vista previa.
     En celular caen en una sola columna y queda como en el mockup
     (indicador arriba de la tarjeta). En escritorio las áreas de grilla
     lo parten en dos columnas: título+panel a la izquierda,
     indicador+previa a la derecha. Por eso van como hijos directos y no
     agrupados en dos contenedores: agruparlos fijaba el orden y en el
     celular el indicador quedaba debajo de la tarjeta. */
  return (
    `<div class="rev-todo">` +
    `<h1 class="rev-tit">Tu reseña</h1>` +
    pasos +
    (paneles[revStep - 1] || paneles[0]) +
    prev +
    `</div>`
  );
}
/* Versión y fecha de las políticas. Se muestran en el encabezado del modal
   y en el aviso de cambios: si se tocan, subí la versión. */
const POL_VERSION = "1.0";
const POL_FECHA = "7 de octubre de 2026";
const PAIS = "Argentina";

/* Secciones de las políticas. El mismo contenido se alcanza de dos formas:
   por solapa (celular) o corrido (escritorio). El orden de POL_SECC es el de
   las dos. */
const POL_SECC = [
  ["resumen", "En resumen"],
  ["datos", "Datos"],
  ["uso", "Uso"],
  ["derechos", "Derechos"],
  ["condiciones", "Condiciones"],
  ["cambios", "Cambios"],
];
/* Íconos de línea del mockup, en SVG inline. Se dibujan con currentColor
   para que hereden el dorado del bloque donde caen. */
const POL_ICO = {
  escudo: '<path d="M12 3l7 3v5c0 4.5-3 8.2-7 9.5C8 19.2 5 15.5 5 11V6l7-3z"/><path d="M9 12l2 2 4-4"/>',
  usuario: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6"/>',
  candado: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8.5 10V7.5a3.5 3.5 0 017 0V10"/>',
  tacho: '<path d="M4 7h16M9.5 7V5h5v2M6.5 7l1 13h9l1-13"/>',
  ojo: '<path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="2.6"/>',
  lapiz: '<path d="M4 20h4L20 8l-4-4L4 16v4z"/>',
  refresco: '<path d="M20 12a8 8 0 11-2.3-5.6"/><path d="M20 4v5h-5"/>',
  llave: '<circle cx="8" cy="12" r="3.5"/><path d="M11.5 12H21l-2 3h-2v-3"/>',
};
const polSvg = (k, cls) =>
  `<svg class="${cls || ""}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" width="20" height="20" aria-hidden="true" focusable="false">${POL_ICO[k] || ""}</svg>`;

/* Chip de dato pendiente de cargar. No se inventa: si el dueño no lo puso en
   config.js, se ve la etiqueta con el hueco, no un dato falso. */
const POL_PEND = (t) => `<span class="pol-pend" title="Falta completar en config.js">${esc(t)}</span>`;

function polH() {
  /* Tarjeta de "en resumen": ícono + título + texto. */
  const it = (ic, t, d) => `<div class="pol-card">${polSvg(ic)}<div><h2 class="ft-h">${t}</h2><p>${d}</p></div></div>`;
  /* Sección numerada del documento. */
  const num = (i, t, cuerpo) => `<div class="pol-num"><span class="pol-num-n" aria-hidden="true">${i}</span><h4 id="h-${i}">${t}</h4></div>${cuerpo}`;

  const resumen = `<h3 class="pol-h3">EN RESUMEN</h3>
    <div class="pol-grid">
      ${it("escudo", "No vendemos tus datos", "Solo los usamos para gestionar tus turnos y tus puntos.")}
      ${it("usuario", "Pedimos lo mínimo", "Nombre, teléfono y email. Nada de datos sensibles.")}
      ${it("candado", "Tu contraseña va cifrada", "Nadie del local puede verla.")}
      ${it("tacho", "Borrás tu cuenta cuando quieras", "Desde Privacidad → «Borrar mis datos».")}
    </div>`;

  /* La tabla del mockup: qué dato, para qué y si es obligatorio. Es la forma
     más clara de decir qué pasa si dejás un campo en blanco. */
  const fila = (a, b, c, opt) =>
    `<tr><th scope="row">${a}</th><td>${b}</td><td class="pol-si">${c}</td></tr>`;
  const datos = `<h3 class="pol-h3">PRIVACIDAD</h3>
    ${num(1, "QUIÉN ES RESPONSABLE", `<p>${esc(NOMBRE)} es el responsable de tus datos personales (en la ley, el responsable de la base de datos).</p>
      <ul class="pol-datos-resp">
        <li><span>Titular</span> <span class="pol-val">${POL_PEND("RAZÓN SOCIAL / NOMBRE Y APELLIDO")}</span></li>
        <li><span>Domicilio</span> <span class="pol-val">${POL_PEND("DIRECCIÓN")}, ${esc(PAIS)}</span></li>
        <li><span>Contacto por temas de privacidad</span> <span class="pol-val"><a href="mailto:${esc(EMAIL)}">${esc(EMAIL)}</a></span></li>
      </ul>`)}
    ${num(2, "QUÉ DATOS RECOPILAMOS", `<p>Solo los datos necesarios para que reserves, sumes puntos y para que el local pueda organizarse. <b>No pedimos datos sensibles</b> (salud, origen, religión, ideas políticas ni similares).</p>
      <div class="pol-tbl-wrap"><table class="pol-tbl">
        <thead><tr><th scope="col">Dato</th><th scope="col">Para qué lo usamos</th><th scope="col">¿Es obligatorio?</th></tr></thead>
        <tbody>
          ${fila("Nombre", "Que el barbero sepa quién viene.", "Sí")}
          ${fila("Teléfono", "Contactarte por tu turno y enviarte recordatorios por WhatsApp.", "Sí")}
          ${fila("Email y contraseña", "Crear tu cuenta, verificarte e ingresar. La contraseña se guarda cifrada.", "Sí")}
          ${fila("Turnos", "Fecha, hora, barbero, servicio y estado (pendiente, completado o cancelado).", "Se generan al reservar", 1)}
          ${fila("Puntos y canjes", "Llevar tu saldo y los códigos de premio que ganaste.", "Se generan al usar la app", 1)}
          ${fila("Faltas y cancelaciones", "Organizar la agenda y el tiempo de los demás clientes.", "Se generan al usar la app", 1)}
          ${fila("Cobros", "Registrar el pago en efectivo o transferencia y cuánto. <b>No guardamos números de tarjeta.</b>", "Lo carga el barbero", 1)}
        </tbody>
      </table></div>`)}`;

  const uso = `<h3 class="pol-h3">PRIVACIDAD</h3>
    ${num(3, "PARA QUÉ LOS USAMOS", `<p>Usamos tus datos únicamente para:</p>
      <ul class="pol-ul">
        <li>Crear y proteger tu cuenta.</li>
        <li>Gestionar tus reservas, cancelaciones y reprogramaciones.</li>
        <li>Enviarte recordatorios de turno por WhatsApp y avisarte si se libera un horario que pediste.</li>
        <li>Llevar tus puntos, premios y códigos de canje.</li>
        <li>Que el local lleve su agenda, su caja y sus finanzas.</li>
        <li>Prevenir abuso, por ejemplo reservas que nunca se usan.</li>
      </ul>
      <p>No los usamos para publicidad de terceros ni para tomar decisiones automáticas sobre vos. Los tratamos con tu consentimiento, que das al crear tu cuenta y aceptar estas políticas.</p>`)}
    ${num(4, "CON QUIÉN LOS COMPARTIMOS", `<p>No vendemos ni alquilamos tus datos. Solo se los damos a:</p>
      <ul class="pol-ul">
        <li><b>El equipo del local.</b> Cada barbero ve sus propios turnos y clientes; el dueño ve toda la agenda y las finanzas.</li>
        <li><b>Proveedores tecnológicos</b> que hacen funcionar la app: Google Firebase (cuentas y base de datos) y, si el local activa la seña, Mercado Pago, que procesa el pago bajo sus propios términos.</li>
        <li><b>WhatsApp</b>, al contratar la cuenta para enviarte recordatorios.</li>
        <li><b>Autoridades</b>, sólo a una ley u orden judicial que lo exija.</li>
      </ul>`)}
    ${num(5, "CUÁNTO TIEMPO LOS GUARDAMOS", `<p>Mientras tu cuenta esté activa. Si decidís borrarla, eliminamos tu cuenta, tus turnos y tus puntos. No hay venta atrás. Si una ley nos obliga a conservar algo, guardamos sólo por el plazo que esa ley exija.</p>`)}
    ${num(6, "CÓMO LOS PROTEGEMOS", `<ul class="pol-ul">
        <li>Tu contraseña se guarda <b>cifrada</b>: nosotros ni el local podemos verla.</li>
        <li>La conexión entre tu celular y la app va cifrada (HTTPS).</li>
        <li>Verificamos tu email al crear la cuenta.</li>
        <li>Los accesos son por rol: cada persona del equipo ve <b>sólo lo que le corresponde</b> trabajar.</li>
      </ul>
      <p>Ningún sistema es infalible. Si hubiera un incidente que afecte tus datos, te avisamos y tomamos medidas para reducir el daño.</p>`)}`;

  /* Los plazos de la Ley 25.326 van como chip, no como texto corrido: es lo
     primero que uno mira cuando va a ejercer un derecho. */
  const der = (ic, t, p, d) => `<div class="pol-card">${polSvg(ic)}<div><h2 class="ft-h">${t}</h2><p>${p}</p><span class="pol-dias">${d}</span></div></div>`;
  const derechos = `<h3 class="pol-h3">TUS DERECHOS</h3>
    ${num(7, "TUS DERECHOS", `<p>La Ley 25.326 de Protección de los Datos Personales te da estos derechos. Son gratuitos y tus puntos siguen contando aunque los ejerzas o borres la cuenta.</p>
      <div class="pol-grid pol-grid--4">
        ${der("ojo", "Acceso", "Pedimos saber qué datos tuyos tenemos.", "10 días hábiles")}
        ${der("lapiz", "Rectificación", "Corregimos datos que sean incorrectos.", "5 días hábiles")}
        ${der("refresco", "Actualización", "Ponemos al día los datos de tu cuenta.", "5 días hábiles")}
        ${der("tacho", "Supresión", "Pedimos que se borre tu cuenta y tus datos.", "5 días hábiles")}
      </div>
      <p>Para ejercerlos, escribinos a <a href="mailto:${esc(EMAIL)}">${esc(EMAIL)}</a> desde el email de tu cuenta, o usá <b>Privacidad → «Borrar mis datos»</b> en la app. Si el pedido queda sin resolver, te respondemos por escrito. También podés retirar tu consentimiento en cualquier momento.</p>`)}
    ${num(8, "MENORES DE EDAD", `<p>Si sos menor de 18 años, reservá con autorización de tu madre, padre o tutor, que pueden pedir el acceso o el borrado de tus datos.</p>`)}`;

  const condiciones = `<h3 class="pol-h3">CONDICIONES DEL SERVICIO</h3>
    ${num(9, "TURNOS, CANCELACIONES Y FALTAS", `<p>Podés cancelar o reprogramar desde <b>Mis turnos</b> hasta <b>${CHSv} horas</b> antes. Si no te presentás, avisá.</p>
      <p>Si no te presentás y avisás, se registra una falta. Con faltas repetidas, el local puede pedirte una seña para reservar.</p>`)}
    ${num(10, "PUNTOS Y PREMIOS", `<ul class="pol-ul">
        <li>Ganás <b>${PTSv} puntos</b> por cada corte completado. No se suman por turnos cancelados ni por faltas.</li>
        <li><b>Descuento 20% (25 puntos)</b>, <b>Descuento 50% (50 puntos)</b> y <b>Corte gratis (100 puntos)</b>.</li>
        <li>Al canjear se genera un código (por ejemplo <code>CB-4FK7</code>). Mostralo en la barbería: el barbero lo marca como usado y solo sirve una vez.</li>
        <li>Los puntos no tienen valor en dinero, no se transfieren y no se pierden al borrar tu cuenta.</li>
      </ul>
      <p>El local puede cambiar los premios; los avisos a la app.</p>`)}
    ${num(11, "PAGOS Y PRECIOS", `<p>Los servicios se pagan en el local, <b>en efectivo o transferencia</b>. Los precios están en pesos argentinos y se muestran antes de confirmar tu turno. Se paga con Mercado Pago y queda asociado a sus términos.</p>`)}
    ${num(12, "RECORDATORIOS POR WHATSAPP", `<p>Te escribimos al teléfono que cargas, sólo para hablar de tus turnos. Si no querés recibirlos, avisanos al barbero y los desactivamos.</p>`)}`;

  const cambios = `<h3 class="pol-h3">CAMBIOS</h3>
    ${num(13, "CAMBIOS EN ESTAS POLÍTICAS", `<p>Si las modificamos, te avisamos en la app antes de que apliquen. La fecha de la última actualización figura arriba de esta pantalla.</p>`)}`;

  const cuerpo = { resumen, datos, uso, derechos, condiciones, cambios };
  return `<div class="polbox" role="dialog" aria-modal="true" aria-labelledby="polTt" aria-describedby="polSub">
  <div class="pol-grab" aria-hidden="true"></div>
  <div class="pol-hd">
    <span class="pol-ico">${polSvg("escudo")}</span>
    <div class="pol-hd-tx">
      <h2 id="polTt">POLÍTICAS Y PRIVACIDAD</h2>
      <small id="polSub">Versión ${POL_VERSION} · ${POL_FECHA} · Ley 25.326 de Protección de los Datos Personales</small>
    </div>
    <button class="pol-x" data-act="cerrarPol" aria-label="Cerrar políticas">✕</button>
  </div>
  <div class="pol-tabs" role="tablist" aria-label="Secciones de las políticas">
    ${POL_SECC.map(([id, t], i) => `<button class="pol-tab${i === 0 ? " on" : ""}" id="pol-t-${id}" role="tab" data-act="polTab" data-args="${A(id)}" aria-selected="${i === 0 ? "true" : "false"}" aria-controls="pol-s-${id}" tabindex="${i === 0 ? "0" : "-1"}">${t}</button>`).join("")}
  </div>
  <div class="pol-body">
    ${POL_SECC.map(([id], i) => `<div class="pol-panel" id="pol-s-${id}" data-panel="${id}" role="tabpanel" aria-labelledby="pol-t-${id}" tabindex="0"${i === 0 ? "" : " hidden"}>${cuerpo[id]}</div>`).join("")}
  </div>
  <div class="pol-ft">
    <label class="pol-acepto"><input type="checkbox" id="polOk"><span>Leí y acepto las Políticas y privacidad y las condiciones del servicio.</span></label>
    <div class="pol-ft-btns">
      <button class="pol-b pol-b--ghost" data-act="cerrarPol">Cerrar</button>
      <button class="pol-b pol-b--pri" data-act="cerrarPol">Aceptar y continuar</button>
    </div>
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
    ? `<label>Barbero</label><div class="chips">${FN.bs.map((b) => `<button class="chip ${dbi === b.id ? "on" : ""}" aria-pressed="${!!(dbi === b.id)}" data-act="setDbi" data-args="${A(b.id)}">${esc(nomBar(b))}</button>`).join("")}</div>`
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
  return `<div class="card man"><h2 style="margin-top:0">Agendar turno</h2><small>Turno a nombre de un cliente, cargado desde la barbería.</small><h3>Cliente</h3><select style="width:100%" data-ch="agCh" data-args="${A("u", "@v")}"><option value="" >Cliente nuevo (nombre abajo)</option>${US(UA).map((u) => `<option value="${esc(u.id)}" ${m.u === u.id ? "selected" : ""}>${esc(etqUsuario(u))}</option>`).join("")}</select>${m.u ? "" : `<input id="agnn" placeholder="Nombre del cliente" maxlength="40" value="${esc(m.nm)}" data-in="agInEl" data-args="${A("nm", "@el")}">`}<h3>Servicio</h3><select style="width:100%" data-ch="agCh" data-args="${A("s", "@v")}">${S.map((x, i) => `<option value="${i}" ${m.s === i ? "selected" : ""}>${esc(x.n)} · ${$$(x.p)}</option>`).join("")}</select><h3>Día</h3><select style="width:100%" data-ch="agCh" data-args="${A("d", "@v")}">${daysFor(propio).map((d) => `<option value="${d}" ${m.d === d ? "selected" : ""}>${fd(d)}</option>`).join("")}</select><h3>Hora disponible</h3><select style="width:100%" data-ch="agCh" data-args="${A("t", "@v")}"><option value="">Elegí una hora…</option>${libres.map((t) => `<option value="${t}" ${m.t === t ? "selected" : ""}>${t}</option>`).join("")}</select>${!SB && FN.bs.length ? `<h3>Barbero</h3><div class="chips">${FN.bs.map((b) => `<button class="chip ${propio === b.id ? "on" : ""}" aria-pressed="${propio === b.id}" data-act="agBar" data-args="${A(b.id)}">${esc(b.n)}</button>`).join("")}</div>` : ""}<div class="chips" style="margin-top:16px"><button class="main" style="margin-top:0" data-act="agSave">Agendar</button><button data-act="agX">Cancelar</button></div></div>`;
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
    return `<div class="card" style="margin-bottom:12px"><div class="appt" style="border:0;background:none;padding:0;margin:0"><div style="display:flex;justify-content:space-between;align-items:center"><b style="font:700 34px 'Barlow Condensed'">${esc(t.t)}</b><span class="pill ${t.st === "hecho" ? "st-hecho" : t.st === "cancel" ? "st-cancel" : "st-pend"}">${ST[t.st]}</span></div><small style="color:var(--mut)">${esc(fd(t.d))}</small><br><b>${esc(sv(t).n)}</b><br><small>con ${esc(bn(t) || "—")} · ${esc(sv(t).tx)} · ${$$(pr)}</small></div>${t.st === "pend" && !x ? `<div class="chips" style="margin-top:12px"><button class="pillb" style="flex:1;padding:11px" data-act="reprogramar" data-args="${A(t.id)}">Reprogramar</button><button class="pillb" style="flex:1;padding:11px" data-act="askCancel" data-args="${A(t.id)}">Cancelar</button></div>` : ""}${x ? cxForm(t) : ""}</div>`;
  };
  return (
    `<h1>MIS TURNOS</h1>` +
    `<h2 class="lab">Próximos</h2>` +
    (prox.length ? prox.map(card).join("") : "<p><small>Todavía no reservaste. Tocá “Reservar” para elegir un horario.</small></p>") +
    `<h2 class="lab">Historial</h2>` +
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
            `<div class="row"><div><b>${esc(t.nm)}</b><br><small>${esc(sv(t).n)} · ${esc(t.t)}</small></div>${wal((UA.find((u) => u.id === t.uid) || {}).ph, `Hola ${t.nm}, te recordamos tu turno de mañana a las ${esc(t.t)} en ${NOMBRE}. Si no podés venir, avisanos. ¡Gracias!`)}</div>`,
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
/* Mi ficha dentro de config/barberos (id = uid del barbero). Es la
   misma que lee la landing, así que lo que se carga acá se ve allá.
   `me` puede ser null si se llega a pintar sin sesión: se devuelve vacío
   en vez de reventar, porque esta función se llama desde el render. */
const miFicha = () => (me ? BARS.find((x) => x.id === me.uid) || {} : {});

/* Guarda los datos que el barbero publica sobre sí.

   DÓNDE VIVEN AHORA. Antes iban a `config/barberos`, dentro de la lista `l`, y
   se escribían con un `Promise.all` junto a `staff/{uid}`. Eso fallaba siempre:
   las reglas de Firebase no le dejaban a un barbero escribir su entrada de la
   lista (comprobado con la sesión real del barbero: HTTP 403; el mismo pedido
   con la sesión del dueño daba 200, así que no era el payload sino la regla).
   Como `Promise.all` se cae con el primer rechazo, ese 403 tumbaba también el
   write a `staff`, y el cartel decía "No se pudo completar" sin guardar nada.

   Ahora el perfil va a SU PROPIO documento, `fotoBarbero/{uid}`: se lee sin
   sesión (la landing lo necesita) y lo escribe sólo el propio barbero, y sólo
   esos campos. `config/barberos` vuelve a ser del dueño solamente: él decide
   quién está en el equipo.

   Cada write va por separado y se anota el que falla, por lo mismo que en
   fotoTomar: con Promise.all un solo rechazo esconde a los demás. */
async function guardarPerfil() {
  if (!me) return;
  const id = me.uid;
  const val = (k) => (((($(k) || {}).value) || "").trim());
  const redesTxt = val("#pfRedes");
  /* Una red por línea, "Nombre | https://…". Se parte sólo por el primer
     "|": una URL puede traer otros pipes y no debe comerse el resto. */
  const redes = redesTxt
    ? redesTxt
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => {
          const i = l.indexOf("|");
          const n = (i < 0 ? "" : l.slice(0, i)).trim();
          const u = (i < 0 ? "" : l.slice(i + 1)).trim();
          return { n: n || u, url: u };
        })
        .filter((r) => r.url)
    : [];
  const ficha = miFicha();
  const nueva = {
    ...ficha,
    n: val("#pfNombre") || (SB && SB.n) || "Barbero",
    esp: val("#pfEsp"),
    desc: val("#pfDesc"),
    tel: val("#pfTel"),
    ig: val("#pfIg").replace(/^@/, ""),
    redes,
  };
  /* Se mandan los siete campos siempre, aunque estén vacíos.

     La lista blanca de las reglas es exactamente esos siete y `hasOnly` no
     mira cuáles cambiaron, así que mandar el objeto entero no tiene forma de
     dejar un campo de más. Y mandarlos vacíos también es lo que quiere el
     barbero cuando borra algo de su ficha: si se omitieran, el valor anterior
     quedaría pegado y no se podría limpiar nada. */
  const publico = {
    foto: ficha.foto || (SB && SB.foto) || "",
    n: nueva.n,
    esp: nueva.esp,
    desc: nueva.desc,
    tel: nueva.tel,
    ig: nueva.ig,
    redes,
  };
  try {
    busy(1, "Guardando…", 1);
    const fallos = [];
    let errorWeb = null;
    const guardar = async (que, fn, esWeb) => {
      try {
        await fn();
      } catch (e) {
        fallos.push(que);
        if (esWeb) errorWeb = e;
      }
    };
    await guardar("el perfil en la web", () => setDoc(doc(db, "fotoBarbero", id), publico, { merge: true }), true);
    await guardar("tu nombre en la ficha", () => setDoc(doc(db, "staff", id), { n: nueva.n }, { merge: true }));

    busy(0);
    /* Memoria: para que el encabezado y las listas no sigan mostrando el
       nombre viejo hasta el próximo snapshot. */
    if (SB) SB = { ...SB, n: nueva.n };
    FN = { ...FN, bs: FN.bs.map((b) => (b.id === id ? { ...b, n: nueva.n } : b)) };
    FOTOS[id] = { ...(FOTOS[id] || {}), ...publico };
    BARS = conFotos(PUB.barberos);

    if (!fallos.length) {
      cerrarModalPerfil();
      msg = "Tu perfil se guardó. Ya está visible en la web.";
      R();
      return;
    }
    setMotivoWeb(errorWeb);
    cerrarModalPerfil();
    R();
    M({
      k: "w",
      h: fallos.length > 1 ? "El perfil se guardó a medias" : "El perfil no llegó a la web",
      b:
        "No se pudo guardar en " + fallos.join(" ni ") + ".<br><br>" +
        esc(porQueWeb()) +
        (publico.foto ? "<br><br>Tu foto sí quedó a salvo en el panel." : ""),
    });
  } catch (e) {
    busy(0);
    err(e);
  }
}
/* Se registra en ACT y no sólo en W a propósito: ACT es una COPIA de W
   (Object.assign({}, W, …) en la línea ~2484), así que asignar en W acá no
   llegaría al despachador de data-act y el botón "Guardar perfil" no haría
   nada. Este bloque corre después de esa copia, sobre el objeto vivo. */
Object.assign(ACT, { guardarPerfil });

function barH() {
  const hoy = ymd(),
    barbers = FN.bs.filter((b) => (!SB || isOwner() || b.uid === me.uid) && (!bf || b.id === bf)),
    p = [...T]
      .filter((t) => !ag || t.d === ag)
      .filter((t) => !SB || isOwner() || t.bid === me.uid)
      .sort((a, b) => (a.d + a.t).localeCompare(b.d + b.t));
  const mySBFoto = SB && SB.foto ? SB.foto : "";
  return (
    `<div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:10px 14px;max-width:640px">${mySBFoto ? `<img src="${esc(mySBFoto)}" alt="" width="44" height="44" style="border-radius:50%;object-fit:cover">` : `<span class="aval" style="width:44px;height:44px;font-size:20px;flex:0 0 auto">${esc(((SB && SB.n) || (me && me.displayName) || "?")[0].toUpperCase())}</span>`}<div style="flex:1"><b>${esc((SB && SB.n) || (me && me.displayName) || "Tu barbería")}</b><br><small>Tu foto aparece para los clientes al reservar.</small></div><button data-act="fotoTomar" style="flex:0 0 auto">Cambiar foto</button><button data-act="miPerfilWeb" style="flex:0 0 auto">Editar perfil</button></div>` +
    `<div class="head" style="margin-top:0;flex-wrap:wrap"><div><h1 style="margin-bottom:4px">Agenda</h1><small>${ag ? fd(ag) : "Todos los días"} · ${p.length} ${p.length === 1 ? "turno" : "turnos"}</small></div><div class="chips" style="background:var(--card);border:1px solid var(--line);border-radius:12px;padding:4px">${[["", "Todos"], ...[...new Set([hoy, ...days()])].sort().map((d) => [d, d === hoy ? "Hoy" : fd(d)])].map((a) => `<button class="chip ${ag === a[0] ? "on" : ""}" aria-pressed="${!!(ag === a[0])}" data-act="setAg" data-args="${A(a[0])}" style="border:0">${a[1]}</button>`).join("")}</div><div class="chips"><button data-act="openMan">+ Carga manual</button><button data-act="agOpen">+ Agendar turno</button></div></div>${manH()}${agT ? agH() : ""}<div class="chips" style="margin-bottom:14px">${isOwner() ? [["", "Todos"], ...FN.bs.map((b) => [b.id, nomBar(b)])].map((x) => `<button class="chip ${bf === x[0] ? "on" : ""}" data-act="setBf" data-args="${A(x[0])}">${esc(x[1])}</button>`).join("") : ""}</div>` +
    `<div class="cols3">${barbers
      .concat(
        p.some((t) => !t.bid || !FN.bs.some((b) => b.id === t.bid))
          ? [{ id: "__x", n: "Sin asignar" }]
          : [],
      )
      .map((b) => {
        const tt = p.filter((t) => (b.id === "__x" ? !t.bid || !FN.bs.some((x) => x.id === t.bid) : t.bid === b.id));
        return `<div class="bcol"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><span>${(BARS.find((x) => x.id === b.id) || {}).foto ? `<img src="${esc((BARS.find((x) => x.id === b.id) || {}).foto)}" alt="" width="30" height="30" style="border-radius:50%;object-fit:cover;display:inline-grid;vertical-align:middle;margin-right:8px">` : `<span class="aval" style="width:30px;height:30px;font-size:15px;display:inline-grid;vertical-align:middle;margin-right:8px">${esc(nomBar(b)[0].toUpperCase())}</span>`}<b>${esc(nomBar(b))}</b></span><small>${tt.length} turnos</small></div>` +
          (tt.length
            ? tt
                .map(
                  (t) =>
                    `<div class="appt"><div style="display:flex;justify-content:space-between;align-items:center"><div class="h">${esc(t.t)}</div><span class="pill ${t.st === "hecho" ? "st-hecho" : t.st === "cancel" ? "st-cancel" : "st-pend"}">${ST[t.st]}</span></div><b>${esc(t.nm)}</b><br><small>${esc(sv(t).n)} · ${esc(sv(t).tx)}</small>${t.st === "pend" ? `<div class="chips" style="margin-top:8px"><button data-act="askDone" data-args="${A(t.id)}">Completó</button><button data-act="askCancel" data-args="${A(t.id)}">Cancelar</button></div>` : ""}${dn === t.id ? dnForm(t) : ""}${cx === t.id ? cxForm(t) : ""}</div>`,
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
    `<div class="card" style="margin-bottom:14px"><h2 class="lab" style="margin-top:0">Ventas por día · últimos 7 días</h2><div class="vchart">${dayChart.map((x) => `<div class="col ${x.d === ymd() ? "hoy" : ""}"><small>${$$(x.m)}</small><i style="height:${Math.max(3, Math.round((x.m / maxDay) * 150))}px"></i><small>${["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"][dow(x.d)]}</small></div>`).join("")}</div></div>` +
    `<div class="grid b"><div><h2 style="margin-top:26px">Ventas por servicio</h2>${bars(by, maxBy)}<h2>Medio de pago</h2>${Object.keys(md).length ? medBar() : "<p><small>Todavía no hay cortes en este período.</small></p>"}</div><div><div class="head"><h2>Registro de cortes</h2><button data-act="exportar" ${L.length ? "" : "disabled"}>Descargar CSV</button></div>` +
    (L.length
      ? '<div class="scr">' +
        L.map(
          (t) =>
            `<div class="row"><div><b>${esc(t.nm)}</b><br><small>${esc(t.serv || sv(t).n)} · ${esc(fd(t.d))} · ${esc(t.t)}${t.medio ? " · " + esc(t.medio) : ""}${t.bn ? " · " + esc(t.bn) : ""}${t.man ? " · Manual" : ""}</small></div><div class="rt"><span class="price">${$$(t.precio || 0)}</span>${t.man ? `<button class="x" aria-label="Editar carga" data-act="askEditV" data-args="${A(t.id)}">✎</button>` : ""}</div></div>`,
        ).join("") +
        "</div>"
      : "<p><small>Cuando marques “Completó” en un turno, aparece acá.</small></p>") +
    `</div></div><h2>Cancelaciones</h2>` +
    (CL.length
      ? '<div class="scr">' +
        CL.map(
          (t) =>
            `<div class="row no"><div><b>${esc(t.nm)}</b><br><small>${esc(sv(t).n)} · ${esc(fd(t.d))} · ${esc(t.t)}<br>${quien(t)} · ${esc(t.mot || "Sin motivo registrado")}</small></div></div>`,
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
          return `<div class="card" style="text-align:center">${farmFoto ? `<img src="${imgCld(esc(farmFoto), 200)}" alt="" width="64" height="64" style="border-radius:50%;object-fit:cover;margin:0 auto 12px;display:block">` : `<div class="aval" style="margin:0 auto 12px">${esc(nomBar(b)[0].toUpperCase())}</div>`}<h2 style="margin:0">${esc(nomBar(b))}</h2><small>Dueño ${b.pd}% · Barbero ${100 - b.pd}%</small><div style="margin:12px 0"><span class="pill st-hecho">Activo</span></div><div class="line" style="justify-content:space-around"><span><small>Porcentaje</small><br><b style="color:var(--brass)">${100 - b.pd} %</b></span><span><small>Este mes</small><br><b>${cortes} cortes</b></span></div><div class="chips" style="margin-top:14px"><button style="flex:1" data-act="go" data-args="${A("fin")}">✎ Editar</button>${/* "Quitar" para los dos tipos. Antes sólo se mostraba si el barbero
        tenía cuenta (b.uid), así que a los agregados a mano con "+ Agregar
        barbero" no se los podía sacar nunca: quedaban publicados en la web
        sin salida. */ `<button style="flex:1" data-act="askQuitBar" data-args="${A(b.uid || b.id)}">Quitar</button>`}</div></div>`;
        }).join("") +
        `</div>`
      : "<p><small>Todavía no hay barberos con cuenta. Entrá a Clientes y tocá “Hacer barbero” en alguien que ya se registró.</small></p>")
  );
}
function cliH() {
  const own = isOwner(),
    f = cliQ.trim().toLowerCase(),
    /* El dueño tampoco es un cliente. Estaba en la lista porque el filtro
       sólo miraba el rol y los barberos: el documento del dueño en users/ no
       tiene rol "barbero", así que pasaba. El dueño lo vio aparecer con su
       propio nombre y sus propios puntos. */
    L = UA.filter(
      (u) =>
        !u.borrado &&
        u.rol !== "barbero" &&
        u.id !== OWNER_UID &&
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
                          `<div class="line"><span>${esc(t.serv || sv(t).n)} <small>${esc(fd(t.d))} · ${esc(t.t)}</small></span><b>${$$(t.precio || 0)}</b></div>`,
                      )
                      .join("") +
                    "</div>"
                  : "<small>Todavía no tiene cortes.</small>";
          return `<div class="clin" role="button" style="cursor:pointer;${u.id === cliSel ? "background:#1f2a38;box-shadow:inset 3px 0 var(--brass)" : ""}" data-act="cliSel" data-args="${A(u.id)}"><b>${esc(u.nm || "(sin nombre)")}</b><span>${esc(u.ph || "—")}</span><b style="color:var(--brass)">${u.pt}</b><span style="color:${u.ns > 2 ? "var(--red)" : "inherit"}">${u.ns || 0}</span></div>`;
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
        return `<div class="card"><div style="display:flex;gap:14px;align-items:center;margin-bottom:14px">${selU.foto ? `<img src="${imgCld(esc(selU.foto), 200)}" alt="" width="64" height="64" style="border-radius:50%;object-fit:cover;border:2px solid var(--brass)">` : `<span class="aval">${esc((selU.nm || "?")[0].toUpperCase())}</span>`}<div><b style="font:700 26px 'Barlow Condensed';text-transform:uppercase">${esc(selU.nm)}</b><br><small>${esc(selU.ph || "—")}</small></div></div><div class="grid3"><div class="kv"><small>Puntos</small><b>${selU.pt}</b></div><div class="kv"><small>Cortes</small><b>${(hsel || []).length}</b></div><div class="kv"><small>Faltas</small><b>${selU.ns || 0}</b></div></div><h2 class="lab">Historial</h2>` +
          (!own
            ? `<small>Este detalle lo administra el dueño.</small>`
            : hsel == null
              ? "<small>Cargando historial…</small>"
              : hsel.length
              ? hsel
                  .map(
                    (t) =>
                      `<div class="line"><span><b>${esc(t.serv || sv(t).n)}</b> · ${esc(bn(t) || "—")}<br><small>${esc(fd(t.d))}</small></span><span style="text-align:right"><b>${$$(t.precio || 0)}</b><br><span class="pill st-hecho" style="font-size:11px">Completado</span></span></div>`,
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
    '<h2 class="lab" style="margin-top:0">Gastos</h2>' +
    (GL.length
      ? GL.map(
          (g) =>
            `<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--line)"><div><b>${esc(g.c)}</b><br><small>${fd(g.d)}</small></div><div class="rt"><span style="color:var(--red);font:700 20px 'Barlow Condensed'">− ${$$(g.m)}</span><button class="x" aria-label="Eliminar gasto" data-act="askGDel" data-args="${A(g.id)}">✕</button></div></div>`,
        ).join("")
      : "<p><small>Todavía no hay gastos en este período.</small></p>");
  const gastoForm = `<div class="card" style="margin-top:14px"><input id="gc" placeholder="Concepto (insumos, alquiler…)" maxlength="40" value="${esc(gx.c)}" data-in="gIn" data-args="${A("c", "@el")}"><input id="gm" inputmode="numeric" placeholder="Monto $" maxlength="8" value="${esc(gx.m)}" data-in="gIn" data-args="${A("m", "@el")}"><button class="main" style="margin-top:0" data-act="gAdd">+ Agregar gasto</button></div>`;
  const tablaBarb = `<h2 class="lab" style="margin-top:0">Porcentaje por barbero</h2>` +
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
  /* "Servicios" sola. Antes estaba en un grid de dos columnas junto con los
     premios y las reglas; ahora cada pestaña es una sola cosa. */
  const svcTab = `<div style="max-width:640px">${svH()}</div>`;
  /* "Puntos": los premios y las reglas, que antes compartían columna con los
     servicios. */
  const ptoTab =
    `<div style="max-width:640px"><h2>Premios</h2><div class="card">${PRv.map(
      (p, i) =>
        `<div class="svr"><input id="prn${i}" aria-label="Nombre del premio" placeholder="Nombre" maxlength="30" value="${esc(p.n)}" data-in="rgPrn" data-args="${A(i, "@el")}"><div class="two"><input id="prp${i}" aria-label="Puntos requeridos" inputmode="numeric" placeholder="Puntos" value="${esc(p.p)}" data-in="rgPrp" data-args="${A(i, "@el")}"></div></div>`,
    ).join("")}<small>Editá el nombre y los puntos requeridos de cada premio.</small></div><h2>Reglas de puntos</h2><div class="card"><label>Puntos por corte completado</label><input id="ppts" inputmode="numeric" maxlength="4" value="${esc(PTSv)}" data-in="rgPts" data-args="${A("@el")}"><p><small>Se suman cuando el barbero guarda el cobro.</small></p><label style="margin-top:14px">Puntos de bienvenida al registrarse</label><input id="pptsreg" inputmode="numeric" maxlength="4" value="${esc(PTSRv)}" data-in="rgPtsRegistro" data-args="${A("@el")}"><p><small>Se cargan una sola vez, al crear la cuenta. Aparece en el formulario de registro de la web y en la app.</small></p><h3 style="margin-top:14px">Política de cancelación</h3><label>Cancelar sin cargo hasta (horas antes)</label><input id="pcan" inputmode="numeric" maxlength="3" value="${esc(CHSv)}" data-in="rgCan" data-args="${A("@el")}"></div><button class="main" data-act="rgGuardar">Guardar reglas y premios</button></div>`;
  /* El menú es "horarios - servicios - puntos", como lo pidió el dueño. */
  return `<h1>Ajustes</h1><div class="tabs"><button class="${tab === "hor" ? "on" : ""}" data-act="cfgTab" data-args="${A("hor")}">Horarios</button><button class="${tab === "svc" ? "on" : ""}" data-act="cfgTab" data-args="${A("svc")}">Servicios</button><button class="${tab === "pto" ? "on" : ""}" data-act="cfgTab" data-args="${A("pto")}">Puntos</button></div>` +
    (tab === "svc" ? svcTab : tab === "pto" ? ptoTab : horCard);
}
/* Los mensajes que escribió la gente desde el formulario de la landing.
   No se envía ningún correo: acá están todos, con el nombre, el email y el
   texto tal cual lo mandaron, para poder responder por WhatsApp o por mail. */
function msgH() {
  return (
    `<div class="head" style="margin-top:0"><div><h1 style="margin-bottom:4px">Mensajes</h1><small>${MSGS.length} ${MSGS.length === 1 ? "mensaje" : "mensajes"} sin responder</small></div></div>` +
    (MSGS.length
      ? `<div class="grid">` +
        MSGS.map(
          (m) =>
            `<div class="card"><div style="display:flex;gap:12px;align-items:flex-start;justify-content:space-between"><div style="min-width:0"><b>${esc(m.nombre || "(sin nombre)")}</b><br><a href="mailto:${esc(m.email || "")}" style="color:var(--brass)">${esc(m.email || "—")}</a></div><button data-act="delMsj" data-args="${A(m.id)}" aria-label="Borrar el mensaje de ${esc(m.nombre || "este remitente")}">Borrar</button></div><p style="margin:12px 0 6px;white-space:pre-wrap">${esc(m.mensaje || "")}</p><small>${m.fecha && m.fecha.toDate ? m.fecha.toDate().toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" }) : "sin fecha"}</small></div>`,
        ).join("") +
        `</div>`
      : `<p><small>Todavía no mandó nadie un mensaje desde la web.</small></p>`)
  );
}
function footer() {
  const D = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"],
    dd = [1, 2, 3, 4, 5, 6, 0]
      .filter((d) => CF.dias.includes(d))
      .map((d) => D[d])
      .join(" · ");
  $("#ft").innerHTML =
    `<div class="ft"><div><div class="fb"><img src="${LOGO}" alt="" width="48" height="48"><div><b>${esc(NOMBRE)}</b><small>Turnos online y puntos por cada visita</small></div></div></div><div><h2 class="ft-h">Horarios</h2><p>${dd}</p><p>${hm(CF.a)} a ${hm(CF.c)} hs</p></div><div class="ft-cont"><h2 class="ft-h">Contacto</h2><div class="ft-soc">${WA_LISTA.map(
    (w) =>
      `<p><a href="https://wa.me/${esc(w.num)}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:8px;text-decoration:none"><img class="ic-wa" src="assets/whatsapp-96.png" alt="" width="22" height="22" loading="lazy">WhatsApp ${esc(w.n)} · ${esc(w.num)}</a></p>`,
  ).join("")}<p><a href="https://www.instagram.com/${esc(INSTAGRAM)}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:8px;text-decoration:none"><img class="ic-ig" src="assets/instagram-96.png" alt="" width="22" height="22" loading="lazy">@${esc(INSTAGRAM)}</a></p></div><p>Reservá desde la web, sin llamadas.</p></div></div><div class="fz">© ${new Date().getFullYear()} ${esc(NOMBRE)} · Desarrollado por <b>${esc(AUTOR)}</b> · <a href="#" data-act="openPol" style="color:#cbd3dc">Políticas</a> · <a href="#" data-act="openPol" style="color:#cbd3dc">Privacidad</a></div>`;
}
/* El menú que abre la foto del encabezado, para los tres roles.

   Antes el cliente tenía "Ajustes / Ver la web / Cerrar sesión" y el admin
   tenía las mismas secciones repetidas en `#nmenu`, más dos botones sueltos
   en el encabezado ("Ver la web" y "Cerrar sesión"). Ahora hay UN solo lugar
   para los tres, con lo que pidió el dueño:

     - Editar perfil   (no se muestra al dueño: no tiene ficha pública)
     - Cambiar foto    (usa la misma acción de siempre, `fotoTomar`)
     - Cerrar sesión

   "Editar perfil" apunta a cosas distintas según el rol porque tampoco es la
   misma cosa: el cliente edita su cuenta en Ajustes, y el barbero edita los
   datos que salen en su tarjeta de la landing, que viven en el bloque
   "Mi perfil en la web" del dorso de la ficha. Por eso al barbero lo llevan a
   la web con la tarjeta ya abierta en vez de mandarlo a una pantalla que no
   existe para su rol (`rtOk` no le deja abrir "cfg").

   Va a nivel de módulo y NO dentro de R() a propósito: si estuviera dentro del
   bloque try, `function` sería block-scoped (los módulos son strict mode) y
   desde el render que la llama, que está fuera del try, daría ReferenceError
   con el panel entero a medio pintar. */
function menuPerfil() {
  const items = [];
  if (!isOwner())
    items.push(
      isAdm()
        ? `<button data-act="miPerfilWeb">Editar perfil</button>`
        : `<button data-act="go" data-args="${A("ajus")}">Editar perfil</button>`,
    );
  items.push(
    `<button data-act="fotoTomar">Cambiar foto</button>` +
      `<button class="salir" data-act="salir">Cerrar sesión</button>`,
  );
  return items.join("");
}
function R() {
  let h,
    nv = "",
    nm = "";
  $("#brand").textContent = NOMBRE;
  $("#lg").src = LOGO;
  document.title = NOMBRE;
  const hd0 = document.querySelector("header");
  if (hd0) hd0.style.display = me && !verWeb ? "" : "none";
  const ft0 = $("#ft");
  if (ft0) ft0.style.display = me ? "" : "none";
  const nav0 = $("#nav");
  if (nav0) {
    nav0.style.display = me ? "" : "none";
    if (!me) nav0.innerHTML = "";
  }
  const appE = $("#app");
  if (appE) {
    /* Mirando la web el contenedor va a todo lo ancho, igual que cuando no
       hay sesión: si no, la landing queda metida en el ancho del panel. */
    const ancho = me && !verWeb;
    appE.style.maxWidth = ancho ? "" : "100%";
    appE.style.padding = ancho ? "" : "0";
  }
  /* "Ver la web" tiene sentido siempre que haya sesión: es la forma de
     mirar la landing sin cerrar sesión. Ahora es la casita de la fila derecha
     del header (pedido del dueño), sin el texto al lado. */
  const webB = $("#web");
  if (webB) webB.hidden = !me;
  document.body.classList.toggle("adm", !!(me && isAdm()));
  document.body.classList.toggle("login", !me);
  const mn2 = me ? (isAdm() ? (SB && SB.n) || "Dueño" : (U && U.nm) || "Cliente") : "";
  $("#mebadge").hidden = !me;
  $("#mefn").textContent = mn2;
  /* El header va solo con la foto: el nombre queda como title y aria-label
     del avatar para no perder la informacion. */
  const medE = $("#med");
  if (medE) { medE.title = mn2; medE.setAttribute("aria-label", mn2); }
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
  /* Con sesión se puede mirar la landing sin cerrarla. Se dibuja antes que
     el panel y se esconde el header de la app (index.html), porque si no
     quedarían dos headers apilados. */
  if (me && rd && verWeb) h = landingH();
  else if (!me) h = authH();
  else if (!rd) h = "";
  else if (isAdm()) {
    h =
      (isOwner()
        ? { dash: dashH, cli: cliH, bars: barsH, cfg: cfgH, fin: finH, gal: galH, mens: msgH }
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
            ["mens", "Mensajes"],
          ]
        : [
            ["bar", "Agenda"],
            ["cli", "Clientes"],
            ["fin", "Mis ganancias"],
            ["gal", "Galería"],
          ],
      /* Cuántas entran en la barra de celular antes de necesitar la bandeja.
         El dueño tiene 7 secciones y 3 ranuras: el resto va a la bandeja. El
         barbero tiene 4 justas, así que entra todo y no hay bandeja (antes la
         tenía y repetía las mismas cuatro, como se ve en su captura). */
      CUANTAS = own ? 3 : sec.length,
      bt1 = (a) =>
        `<button class="${view === a[0] ? "on" : ""}"${view === a[0] ? ' aria-current="page"' : ""} data-act="go" data-args="${A(a[0])}">${a[1]}</button>`;
    nv = sec.map(bt1).join("");
    /* El botón de tres rayitas va ÚLTIMO en la barra y sólo si hay algo que
       hide. La clase nav-mas3 dice cuántas se ven en celular; en escritorio
       el CSS no oculta ninguna. */
    const hayBandeja = sec.length > CUANTAS;
    claseNav = hayBandeja ? "nav-mas3" : "nav-todo";
    if (hayBandeja)
      nv +=
        `<button class="nav-mas" data-act="toggleNav" aria-label="Más secciones" aria-expanded="false" aria-controls="nmenu">` +
        `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg><span>Más</span></button>`;
    /* Lo que va en la bandeja del botón de tres rayitas. */
    nm = sec
      .slice(CUANTAS)
      .map(bt1)
      .join("");
  } else if (!U) h = "<p><small>Cargando tu cuenta…</small></p>";
  else {
    h =
      view === "res"
        ? resH()
        : view === "tur"
          ? turH()
          : view === "priv"
            ? privH()
            : view === "ajus"
              ? ajusH()
              : view === "rev"
                ? revH()
                : homeH();
    const ICO = {
      home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>',
      res: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
      tur: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
      rev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>',
    };
    /* La MISMA lista alimenta la barra de arriba (escritorio) y la de
       abajo (celular): un solo origen, así no pueden desincronizarse. La
       barra de abajo es la que se posiciona fija; la de arriba, en línea. */
    nv = SEC_CLI.map(
      (a) =>
        `<button class="${view === a[0] ? "on" : ""}"${view === a[0] ? ' aria-current="page"' : ""} data-act="go" data-args="${A(a[0])}">${ICO[a[0]]}<span>${a[1]}</span></button>`,
    ).join("");
    /* El cliente tiene 4 secciones y 4 ranuras: entran todas y no hace falta
       bandeja. La clase lo deja dicho para el CSS. */
    claseNav = "nav-todo";
  }
  } catch (e) {
    h = `<p class="msg">No se pudo mostrar esta vista: ${esc(e && e.message ? e.message : e)}</p>`;
  }
  const ae = document.activeElement,
    aid = ae && ae.tagName === "INPUT" ? ae.id : "";
  const navE = $("#nav");
  navE.innerHTML = nv;
  navE.className = claseNav;
  /* La bandeja de la barra de celular (la abre el botón de tres rayitas). */
  const nmE = $("#nmenu");
  nmE.innerHTML = nm;
  nmE.hidden = !(navOpen && me && rd);
  /* El menú de la foto. Ahora es el mismo para los tres roles: lo que antes
     estaba partido entre #pmenu (cliente) y #nmenu (admin). */
  const pmE = $("#pmenu");
  const conSesion = !!(me && rd);
  pmE.innerHTML = conSesion ? menuPerfil() : "";
  pmE.hidden = !(perfilOpen && conSesion);
  const mb = $("#mebadge");
  if (mb) mb.setAttribute("aria-expanded", perfilOpen ? "true" : "false");
  /* El botón de tres rayitas lleva el estado de la bandeja. */
  const masB = navE.querySelector(".nav-mas");
  if (masB) masB.setAttribute("aria-expanded", navOpen ? "true" : "false");
  /* Ya no queda el botón suelto de "Cerrar sesión" (#lo): vive en el menú de la
     foto, junto con "Editar perfil" y "Cambiar foto". */
  $("#app").innerHTML = (msg ? `<p class="msg">${esc(msg)}</p>` : "") + h;
  /* El mapa se pide recién cuando su bloque está cerca de la pantalla.
     Tiene que ir ACÁ, después de escribir el innerHTML: antes de esa línea el
     iframe todavía no existe, el observer no encontraba nada y el mapa no
     cargaba nunca ni al scrollear hasta la sección. */
  lbCargarMapas();
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
    /* Se focusan botones Y enlaces: la ficha del barbero muestra links de
       WhatsApp/Instagram/redes, y con sólo botones en el ciclo quedaban
       inalcanzables con el teclado. */
    const b = [
      ...$("#mo").querySelectorAll("button, a[href], input, textarea, select"),
    ].filter((el) => !el.disabled && el.offsetParent !== null),
      i = b.indexOf(document.activeElement);
    if (!b.length) return;
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

/* Gancho para las pruebas de la landing (tests/landing.*.js).
   Sólo se expone en local: en producción no se publica nada, así que no
   queda una puerta abierta en el sitio. Sirve para poblar BARS con datos
   sintéticos y probar la ficha del barbero sin depender de lo que el
   dueño tenga cargado en Firestore, y para leer el estado interno. */
if (["localhost", "127.0.0.1", ""].includes(location.hostname)) {
  window.__test = {
    setBars(l) {
      BARS = Array.isArray(l) ? l : [];
      R();
    },
    /* Estado de la pantalla de contraseña social, para probar los caminos
       sin abrir el pop-up de Google ni de Facebook (que abriría otra
       pestaña y pide una cuenta real). */
    setRedPass(v) {
      redPass = v;
      tab = v ? "redpass" : "in";
      R();
    },
    get redPass() {
      return redPass;
    },
    redPassIn,
    redPassOk: () => ACT.redPassOk(),
    redPassNo: () => ACT.redPassNo(),
    get bars() {
      return BARS;
    },
    /* El merge de la foto del barbero (colección fotoBarbero sobre la ficha
       de config/barberos). Se expone para poder probarlo sin subir una foto de
       verdad: la escritura depende de unas reglas de Firestore que hay que
       publicar en la consola, y hasta que se publiquen no hay forma de tener
       un documento `fotoBarbero` de verdad. Con esto se prueba la mitad del
       camino que sí depende del código. */
    setFotos(m) {
      FOTOS = m || {};
      return conFotos(BARS);
    },
    get fotos() {
      return FOTOS;
    },
    voltear: (id) => ACT.lbFlip(id),
    ficha: (id) => lbFichaBarbero(BARS.find((b) => b.id === id) || {}),
    telWa: lbTelWa,
    parseRedes(txt) {
      return String(txt || "")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => {
          const i = l.indexOf("|");
          const n = (i < 0 ? "" : l.slice(0, i)).trim();
          const u = (i < 0 ? l : l.slice(i + 1)).trim();
          return { n: n || u, url: u };
        })
        .filter((r) => r.url);
    },
    /* Turnos sintéticos EN MEMORIA, para probar reprogramar y cancelar sin
       escribir en Firestore. `setTurnos` reemplaza la lista; nada de lo que
       se haga con estos sale a la base real, así que el test puede
       recorrer la política de las 2 horas y el modo edición sin tocar los
       turnos de los clientes. */
    setTurnos(l) {
      T = Array.isArray(l) ? l : [];
      R();
    },
    get turnos() {
      return T;
    },
    get rep() {
      return rep;
    },
    get sel() {
      return sel;
    },
    get CHSv() {
      return CHSv;
    },
    /* El uid de la sesión, para que los turnos sintéticos del test
       pertenezcan de verdad a quien entra y no reboten contra el
       guardia "ese turno no es tuyo". */
    get uid() {
      return me && me.uid;
    },
    reprogramar: (id) => ACT.reprogramar(id),
    repSalir: () => ACT.repSalir(),
    askCancel: (id) => ACT.askCancel(id),
    /* El manejador de errores, para probar qué cartel aparece con cada código
       de Firebase. `tests/seo2.js` lo usa para verificar que una cancelación
       (`auth/user-cancelled`) NO muestre nada, mientras que un error de verdad
       (`auth/invalid-credential`) sí avisa. Sin este gancho había que abrir un
       pop-up real de Google y esperar a que la persona lo cancele. */
    err,
    esCancelacion,
  };
}

/* ---------- handlers del asistente (compartidos por panel y modal) ---------- */
Object.assign(ACT, {
  wzAbrir() {
    clearTimeout(wzAuto);
    WZ.paso = 1;
    WZ.turno = "";
    sel.t = "";
    WZ.mes = ymd().slice(0, 7);
    const p = document.getElementById("wzm");
    if (p) { p.innerHTML = wzModal(); p.hidden = false; document.body.classList.add("wz-abierto"); }
    /* Si se abre antes de que lleguen los servicios, el asistente se pinta
       con la lista vacía. Se levanta el loader y lo apaga `datosLlegos()` en
       cuanto los datos entran; esa función además repinta el modal. Sin las
       dos cosas, el paso 2 quedaba trancado. */
    if (!S.length) ldEspera("Cargando servicios…");
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
    /* Si había un salto automático pendiente, se cancela: si no, el timer
       se dispararía después de volver atrás y teletransportaría al usuario
       al paso siguiente. */
    clearTimeout(wzAuto);
    WZ.paso = Math.max(1, WZ.paso - 1);
    WZ.pintar();
  },
  /* "Cambiar" de una fila del resumen: salta a ese paso directo. El
     paso 4 (turno mañana/tarde) no aparece en el resumen, así que la fila
     de la hora apunta al 5, que es el horario. */
  wzIr(paso) {
    clearTimeout(wzAuto);
    WZ.paso = Math.max(1, Math.min(5, +paso || 1));
    if (WZ.paso === 3 && !WZ.unsub) wzOcc();
    WZ.pintar();
  },
  /* La casilla de términos. Se pinta desde el estado (sel.pol) y no desde
     el atributo `checked` del input: el asistente se re-pinta entero en
     cada cambio, y si el estado viviera en el DOM el tilde se perdería al
     primer render. */
  wzPol(v) {
    sel.pol = v ? 1 : 0;
    WZ.pintar();
  },
  wzS(i) {
    sel.s = +i;
    sel.t = "";
    WZ.turno = "";
    WZ.pintar();
    wzAvanzaSolo(1);
  },
  wzB(id) {
    sel.b = id;
    sel.d = "";
    sel.t = "";
    WZ.turno = "";
    if (WZ.paso > 2) WZ.paso = 2;
    WZ.pintar();
    wzAvanzaSolo(2);
  },
  wzD(d) {
    sel.d = d;
    sel.t = "";
    WZ.turno = "";
    if (WZ.paso > 3) WZ.paso = 3;
    WZ.pintar();
    wzAvanzaSolo(3);
  },
  wzT(k) {
    WZ.turno = k;
    sel.t = "";
    WZ.pintar();
    wzAvanzaSolo(4);
  },
  wzH(t) {
    /* Tocar el mismo horario lo deselecciona. En ese caso NO se avanza: si
       fuera, el usuario que sólo quería cambiar de horario caería de vuelta
       en el resumen sin querer. */
    const quedaba = sel.t === t;
    sel.t = sel.t === t ? "" : t;
    WZ.pintar();
    if (!quedaba && sel.t) wzAvanzaSolo(5);
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
