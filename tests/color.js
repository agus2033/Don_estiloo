/* Parser y cálculo de contraste, compartido por los tests de color.

   Existe porque este parser se reimplementó cuatro veces y falló tres:
   - `rgb()` / `rgba()`: canales 0-255.
   - `color(srgb r g b / a)`: canales 0-1. Leerlos como 0-255 da 0.49 en
     vez de 125 y arruina el ratio (trap de CONTINUAR.md).
   - `#RRGGBB` y `#RGB`: getComputedStyle devuelve HEX para las variables
     custom (`--brass`), no rgb(). Leer los dígitos sueltos daba NaN.

   Exporta:
     P(s)          -> [r,g,b,a] con r,g,b en 0-255 y a en 0-1
     comp(fg,bg)   -> compone un color con alfa sobre otro
     lum(c), ratio(a,b)
     fondoSrc()    -> string con la función de fondo efectivo, para pegar
                      dentro de page.evaluate()
   */
"use strict";

/* Convierte cualquier forma de color que devuelva el navegador a [r,g,b,a]
   con los canales en 0-255 y el alfa en 0-1. */
function P(s) {
  const t = String(s || "").trim();
  if (!t || t === "transparent") return [0, 0, 0, 0];

  /* color(srgb 0.9 0.87 0.80 / 0.5): canales 0-1. */
  const cs = t.match(/color\(\s*srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\s*\)/i);
  if (cs) return [+cs[1] * 255, +cs[2] * 255, +cs[3] * 255, cs[4] === undefined ? 1 : +cs[4]];

  /* #RGB y #RRGGBB */
  const hx = t.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hx) {
    const h = hx[1].length === 3 ? hx[1].split("").map((c) => c + c).join("") : hx[1];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1];
  }

  /* rgb() / rgba() / modern syntax */
  const n = (t.match(/[-\d.]+/g) || [0, 0, 0, 1]).map(Number);
  if (n.length < 3) return [0, 0, 0, 0];
  /* Los porcentajes ("50%") vienen como 50: hay que pasarlos a 0-255. */
  const ch = (v, i) => {
    const esPct = /%/.test(String(t).split(/[\s,/]+/).filter(Boolean)[i] || "");
    return esPct ? (v / 100) * 255 : v;
  };
  const a = n.length > 3 ? (n[3] > 1 ? n[3] / 100 : n[3]) : 1;
  return [ch(n[0], 0), ch(n[1], 1), ch(n[2], 2), a];
}

/* Compone fg (con alfa) sobre bg opaco. */
const comp = (fg, bg) => [0, 1, 2].map((i) => fg[i] * fg[3] + bg[i] * (1 - fg[3]));

function lum([r, g, b]) {
  const f = (v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/* Ratio WCAG. a y b en [r,g,b] (sin alfa). */
function ratio(a, b) {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

const hex = (c) => "#" + c.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

/* Mínimo que corresponde al tamaño del texto. Texto grande pide 3:1. */
const minimo = (fontSize, fontWeight) => {
  const fs = parseFloat(fontSize);
  return fs >= 24 || (fs >= 18.66 && +fontWeight >= 700) ? 3 : 4.5;
};

/* Código para pegar DENTRO de page.evaluate(): no puede usar closures de
   Node, así que va como string con las funciones embebidas. Recorre el DOM
   y devuelve el fondo efectivo de un elemento, componiendo alfa y
   gradientes. Usa los __* que define HELPERS, así que hay que concatenar
   HELPERS + FONDO_SRC (no declarar dos veces los mismos nombres). */
const FONDO_SRC = `
  const fondo = (el) => {
    const capas = [];
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      const cs = getComputedStyle(n);
      /* Un gradient no está en backgroundColor: el cálculo subiría al
         ancestro y mediría el texto contra el color de la página. Se toma
         la parada más oscura como representativa. */
      if (cs.backgroundImage && cs.backgroundImage !== "none") {
        const ps = (cs.backgroundImage.match(/rgba?\\([^)]+\\)/g) || []).map(__P).filter((c) => c[3] > 0);
        if (ps.length) {
          capas.push(ps.reduce((a, b) => (__lum(b) < __lum(a) ? b : a)));
          continue;
        }
      }
      const c = __P(cs.backgroundColor);
      if (c[3] > 0) {
        capas.push(c);
        if (c[3] === 1) break;
      }
    }
    let base = [255, 255, 255, 1];
    for (let i = capas.length - 1; i >= 0; i--) base = __comp(capas[i], base);
    return base;
  };
`;

/* Se emiten las funciones con su NOMBRE REAL, no con el prefijo __.
   Function.prototype.toString() arrastra las referencias internas por el
   nombre original: si se renombra al definir, ratio() sigue buscando
   "lum" y tira ReferenceError. Después se agregan alias __* que es lo que
   usa FONDO_SRC, para no chocar con variables del test que la contiene. */
const HELPERS = `
  const P = ${P.toString()};
  const comp = ${comp.toString()};
  const lum = ${lum.toString()};
  const ratio = ${ratio.toString()};
  const hex = ${hex.toString()};
  const minimo = ${minimo.toString()};
  const __P = P, __comp = comp, __lum = lum, __R = ratio, __hex = hex, __min = minimo;
`;

/* Para usar dentro de page.evaluate:
     page.evaluate(({src}) => { const {fondo} = new Function(src + ";return {fondo};")(); ... }, {src})
   `new Function` y no `eval`: Playwright evalúa dentro de una función, así
   que un eval con `const` no filtra al ámbito y "fondo is not defined". */
const src = HELPERS + FONDO_SRC;

module.exports = { P, comp, lum, ratio, hex, minimo, FONDO_SRC, HELPERS, src };
