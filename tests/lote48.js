/* Lote 48: horarios libres del día en el Inicio del cliente + reserva
   pre-cargada (pedido del dueño: "horarios libres del día en el inicio
   del cliente, que al tocar un horario abra la reserva con día y hora ya
   elegidos, saltando los pasos 3 y 4 pero que pueda volver").
   Cambios cubiertos acá (los visuales van en la sonda manual
   tests/libres-probe.js; el widget del panel necesita sesión de cliente
   que hoy no hay — queda documentado en PRODUCT.md §48):
   1. wzFaltante(desde): primer paso incompleto DESPUÉS del elegido. Es lo
      que reemplaza el "+1 a ciegas" y permite saltar los pasos completos.
   2. lbPrimerPaso delega en wzFaltante(0) — una sola fuente de verdad.
   3. wzVa(destino): repinta en el paso destino y asegura la suscripción
      de ocupados cuando el destino ya mira el calendario (>=3).
   4. wzNext y wzAvanzaSolo aterrizan en wzFaltante, no en paso+1.
   5. wzS ya no borra la hora pre-cargada a ciegas: la conserva si sigue
      entrando con el servicio recién elegido (lo decide wzLibres).
   6. ACT.libreRes(bid, t): el chip del Inicio pre-carga barbero + día
      (hoy) + hora, marca precarga y abre la reserva.
   7. prep("res") honra precarga sin saltar al resumen vacío.
   8. lbAbreReserva ya no pisa WZ.turno cuando la hora pre-cargada existe.
   9. El widget del Inicio (homeLibresH) y su CSS (.ini-lib*) existen; los
      chips miden 44px (piso de toque).
  10. "Atrás" sigue lineal (paso - 1): poder volver por los pasos
      completados es literal del pedido.
   Uso:  node tests\lote48.js
   En run.js: fila 'lote48' (después de 'lote47').  */
const fs = require("fs");
const path = require("path");

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
const lee = (f) => {
  try {
    return fs.readFileSync(path.join(__dirname, "..", f), "utf8");
  } catch (e) {
    return "";
  }
};

const mj = lee("src/main.js");
const cs = lee("src/styles.css");
const rn = lee("tests/run.js");

/* 1. el helper del primer faltante existe y cubre los cinco pasos */
ok(
  /const wzFaltante = \(desde\) => \{[\s\S]{0,700}return 6;/.test(mj),
  "wzFaltante: helper del primer paso incompleto existe",
);
ok(
  /S\.length > 0 && sel\.s >= 0, \/\/ 1 servicio[\s\S]{0,260}!!sel\.t, \/\/ 5 horario/.test(mj),
  "wzFaltante: evalúa los cinco pasos en orden (servicio..horario)",
);

/* 2. lbPrimerPaso es un delegado, no una copia*/
ok(
  /const lbPrimerPaso = \(\) => wzFaltante\(0\);/.test(mj),
  "lbPrimerPaso: delega en wzFaltante(0) — una sola fuente de verdad",
);

/* 3. wzVa: clamp y suscripción temprana de ocupados */
ok(
  /const wzVa = \(destino\) => \{[\s\S]{0,320}WZ\.paso >= 3 && !WZ\.unsub\) wzOcc\(\);[\s\S]{0,90}WZ\.pintar\(\);/.test(mj),
  "wzVa: repinta en el destino y abona occ si el paso ya usa el calendario",
);

/* 4. el avance ya no es +1 a ciegas, en móvil ni en escritorio */
ok(
  /const wzAvanzaSolo = \(desde\) => \{[\s\S]{0,420}wzVa\(wzFaltante\(desde\)\);/.test(mj),
  "wzAvanzaSolo: el auto-avance aterriza en el primer faltante",
);
ok(
  /wzNext\(\) \{[\s\S]{0,700}wzVa\(wzFaltante\(WZ\.paso\)\);/.test(mj),
  "wzNext: el continuar de escritorio aterriza en el primer faltante",
);

/* 5. wzS conserva la hora si sigue entrando con el servicio nuevo */
ok(
  /wzS\(i\) \{[\s\S]{0,700}const horaOk = sel\.t && sel\.b && sel\.d && wzLibres\(sel\.b, sel\.d, dur\)\.includes\(sel\.t\);[\s\S]{0,220}WZ\.turno = wzMitad\(sel\.t\) === "mañana" \? "man" : "tar";/.test(mj),
  "wzS: la hora pre-cargada sobrevive si wzLibres la confirma con el servicio elegido",
);
ok(
  /if \(!horaOk\) \{\s*\n\s*sel\.t = "";\s*\n\s*WZ\.turno = "";\s*\n\s*\}/.test(mj),
  "wzS: si la hora ya no entra, se cae la hora y el turno (sin predicciones)",
);

/* 6. el handler del chip del Inicio */
ok(
  /libreRes\(bid, t\) \{[\s\S]{0,320}sel\.d = ymd\(\);\s*\n\s*sel\.t = String\(t \|\| ""\);/.test(mj),
  "libreRes: el chip pre-carga barbero + día (hoy) + hora",
);
ok(
  /WZ\.precarga = 1;[\s\S]{0,800}if \(!WZ\.unsub\) wzOcc\(\);\s*\n\s*lbAbreReserva\(\);/.test(mj),
  "libreRes: abona los ocupados en el acto y abre la reserva",
);
ok(
  /libreRes\(bid, t\) \{[\s\S]{0,600}rep = 0;/.test(mj),
  "libreRes: apaga un reprogramar a medio terminar (turno nuevo nunca pisa el viejo)",
);
ok(
  /libreRes\(bid, t\) \{[\s\S]{0,400}WZ\.turno = sel\.t \? \(wzMitad\(sel\.t\) === "mañana" \? "man" : "tar"\) : "";/,
  "libreRes: el turno se deduce de la hora (mañana/tarde)",
);

/* 7. prep honra la pre-carga sin volver al resumen vacío */
ok(
  /const precarga = WZ\.precarga && !!sel\.t;/.test(mj),
  "prep: reconoce la pre-carga como estado propio (no es lo mismo que seguir)",
);
ok(
  /WZ\.paso = seguir \? 6 : precarga \? wzFaltante\(0\) : 1;/.test(mj),
  "prep: la pre-carga aterriza en el PRIMER PASO que falta (el servicio), no en el resumen",
);
ok(
  /if \(!seguir && !precarga\) sel\.t = "";/.test(mj),
  "prep: la hora pre-cargada sobrevive la entrada al panel",
);

/* 8. lbAbreReserva ya no pisa el turno que viene de la ficha */
ok(
  /if \(!\(WZ\.precarga && sel\.t\)\) WZ\.turno = "";/.test(mj),
  "lbAbreReserva: conserva WZ.turno de la pre-carga; lo limpia en los demás flujos",
);

/* 9. el widget del Inicio y su CSS */
ok(
  /function homeLibresH\(\) \{[\s\S]{0,180}if \(!S\.length \|\| !BARS\.length\) return "";/.test(mj),
  "homeLibresH: sin datos no pinta nada (no inventa horarios)",
);
ok(
  /const durMin = Math\.min\(\.\.\.S\.map\(\(x\) => x\.m \|\| 30\)\);/.test(mj),
  "homeLibresH: usa el servicio MÁS CORTO para calcular los huecos",
);
ok(
  /\$\{tarjetaProx\}\s*\n\s*<\/div>` \+[\s\S]{0,120}homeLibresH\(\) \+/.test(mj),
  "homeH: la ficha de horarios libres queda después del próximo turno",
);
ok(
  /data-act="libreRes" data-args="\$\{A\(b\.id, t\)\}"/.test(mj),
  "chips: cada hora lleva barbero + hora en data-args (dispatch por delegación)",
);
ok(
  /\.ini-lib-h \{[\s\S]{0,220}min-height: 44px;/.test(cs),
  "CSS: los chips miden 44px de alto (piso de toque)",
);
ok(
  /\.ini-lib-nota \{\s*\n\s*color: var\(--mut\);\s*\n\s*font-size: 12px;/.test(cs),
  "CSS: la nota del servicio más corto queda por debajo del piso de 12px",
);

/* 10. poder volver: Atrás sigue lineal (sin salto al faltante hacia atrás) */
ok(
  /wzBack\(\) \{[\s\S]{0,420}Math\.max\(1, WZ\.paso - 1\)/.test(mj),
  "wzBack: sigue lineal — volver retrocede DE A UN paso por los ya completados",
);

/* fila en la suite */
ok(/"lote48"/.test(rn), "run.js: la fila 'lote48' está en la suite");

console.log("  ---\n  total: " + okn + " comprobaciones OK");
