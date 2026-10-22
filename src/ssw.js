/* SquishSwitch (lote 45): el toggle claro/oscuro del header, en versión
   vanilla del componente que mandó el dueño (React/motion).

   Mecánica en cuatro partes:

     1. CLICK SIN ARRASTRE = cambia. Como el botón de siempre.
     2. ARRASTRE: el dedo mueve el knob de punta a punta; si al soltar
        quedó más allá de la mitad, el estado cambia; si volvió para
        atrás, spring al origen SIN cambiar el estado (toque en falso
        cancelado, igual que el original).
     3. SQUISH: al apretar el knob se achata a lo ancho (la clase
        ssw-kn--pre) y al soltar con velocidad (flick) rebota
        (ssw-kn--voz). Nada de física en JS: clases + una transición con
        overshoot, que prefers-reduced-motion puede apagar desde el CSS.
     4. TECLADO: sigue siendo un <button>, así que Enter y Espacio
        cambian solos y el foco es visible.

   Contrato con la app (lo define quien lo monta):
     - El botón MANTIENE su id y su aria-label: los tests de header exigen
       el orden web-thm-foto por id, y landing.tema lo aprieta.
     - role="switch" + aria-checked. El dueño de la verdad del estado ES
       el caller, vía pinta(estado): el módulo no toca localStorage ni
       body.dataset — eso sigue en main.js, como siempre.
     - onChange(nuevo) avisa el estado propuesto (true = knob a la
       derecha). El caller sincroniza su mundo y puede re-pintar.

   Uso:  sswMontar(btn, { max, inicial, onChange })
   Los px viven en el CSS (--ssw-*); acá solo la mecánica. */

export function sswMontar(btn, opciones) {
  const op = opciones || {};
  const kn = btn.querySelector(".ssw-kn");
  if (!kn) return null;
  /* el recorrido sale de la GEOMETRÍA REAL del botón (padding/borde/knob),
     no de un número a mano: si un día cambia el tamaño del track en CSS,
     la física no se desincroniza. Con op.max se fuerza a mano; el 30 es el
     salvavidas si medir da 0 (botón oculto al montar). */
  const mide = () => {
    if (op.max != null) return op.max;
    const cs = getComputedStyle(btn),
      contenido =
        btn.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const viaja = contenido - kn.offsetWidth;
    return viaja > 0 ? viaja : 30;
  };
  const max = mide(); /* constantes en pantalla: no hace falta re-medir */
  let estado = !!op.inicial; /* true = knob a la derecha */
  let pres = null; /* { id, x0, vx, lx, lt } */
  let arrastro = false;

  const mueve = (x) => {
    kn.style.transform = "translateX(" + Math.max(0, Math.min(max, x)) + "px)";
  };
  const rebota = (fuerte) => {
    kn.classList.add("ssw-kn--voz");
    if (fuerte) kn.classList.add("ssw-kn--voz-fuerte");
    clearTimeout(rebota.t);
    rebota.t = setTimeout(() => kn.classList.remove("ssw-kn--voz", "ssw-kn--voz-fuerte"), 180);
  };
  const sueltaVisual = () => {
    if (pres && pres.id != null) {
      try {
        btn.releasePointerCapture(pres.id);
      } catch (e) {
        /* el captura ya se soltó solo (pointerup lo hace) */
      }
    }
    btn.classList.remove("ssw--pre");
    kn.classList.remove("ssw-kn--pau", "ssw-kn--pre");
  };

  btn.addEventListener("pointerdown", (e) => {
    if (e.button) return; /* solo el botón primario */
    pres = { id: e.pointerId, x0: e.clientX, vx: 0, lx: e.clientX, lt: Date.now() };
    arrastro = false;
    try {
      btn.setPointerCapture(e.pointerId);
    } catch (e2) {
      /* sin capture el drag se corta al salir del botón: aceptable */
    }
    btn.classList.add("ssw--pre");
    kn.classList.add("ssw-kn--pau", "ssw-kn--pre");
  });

  btn.addEventListener("pointermove", (e) => {
    if (!pres || e.pointerId !== pres.id) return;
    if (Math.abs(e.clientX - pres.x0) > 4) arrastro = true;
    const t = Date.now(),
      dt = Math.max(1, t - pres.lt);
    pres.vx = (e.clientX - pres.lx) / dt; /* px/ms, con signo */
    pres.lx = e.clientX;
    pres.lt = t;
    mueve((estado ? max : 0) + (e.clientX - pres.x0));
  });

  const decide = (e) => {
    if (!pres || e.pointerId !== pres.id) return;
    const estadoViejo = estado;
    if (!arrastro) {
      estado = !estado; /* click limpio: flip */
    } else {
      const rapido = Math.abs(pres.vx) > 0.55; /* px/ms = flick */
      if (rapido) {
        /* el flick manda: la dirección del dedo decide */
        estado = pres.vx > 0;
      } else {
        estado = pos() > max / 2;
      }
      if (estado !== estadoViejo) rebota(Math.abs(pres.vx) > 1.1);
    }
    pres = null;
    pinta();
    if (estado !== estadoViejo && op.onChange) op.onChange(estado);
  };
  btn.addEventListener("pointerup", decide);
  /* TECLADO: Enter/Espacio de un <button> llegan como "click" sin pointer
     events (detail === 0). El click que dispara el mouse DESPUÉS del
     pointerup NO entra por acá: la decisión ya la tomó decide, y voltear
     dos veces sería un bug (un toque cambiaría dos estados). */
  btn.addEventListener("click", (e) => {
    if (e.detail !== 0) return;
    estado = !estado;
    pinta();
    if (op.onChange) op.onChange(estado);
  });
  btn.addEventListener("pointercancel", () => {
    /* el dedo se fue (llamada entrante, scroll de la página): sin flip */
    pres = null;
    sueltaVisual();
    mueve(estado ? max : 0);
  });

  /* la posición la lleva el transform (el box del knob no la refleja
     durante el drag), así que se lee del propio estilo */
  function pos() {
    const m = /translateX\(([\d.]+)px\)/.exec(kn.style.transform || "");
    return m ? +m[1] : 0;
  }

  function pinta() {
    btn.setAttribute("aria-checked", estado ? "true" : "false");
    btn.dataset.on = estado ? "1" : "0";
    mueve(estado ? max : 0);
  }

  /* primer pintado sin animación: si el theme cacheado difiere, al refrescar
     no se ve el knob viajar */
  kn.classList.add("ssw-kn--pau");
  pinta();
  requestAnimationFrame(() => kn.classList.remove("ssw-kn--pau"));

  /* API para tests y para el caller */
  return {
    get estado() {
      return estado;
    },
    get max() {
      return max;
    },
    pinta,
    /* atajo: setState directo (los tests lo usan en vez de simular poderes) */
    set(v) {
      estado = !!v;
      pinta();
    },
  };
}
