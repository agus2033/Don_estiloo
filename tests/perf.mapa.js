/* Mide el antes y el después del cambio del mapa sin tocar git.

   Se cambia el `data-src` del iframe por `src` (el estado viejo), se mide, se
   vuelve a `data-src` (el estado nuevo) y se mide. El resto del código queda
   exactamente igual en las dos corridas, así que la diferencia es atribuible
   al mapa y no a otra cosa que se haya movido en el medio.

   Sale con un try/finally para que el archivo quede siempre como estaba, pase
   lo que pase. */

const fs = require("fs");
const { execFileSync } = require("child_process");
const path = require("path");

const F = path.join(__dirname, "..", "src", "main.js");
const original = fs.readFileSync(F, "utf8");
const CON_NUEVO = `data-src="\${esc(MAP_IFRAME)}"`;
const CON_VIEJO = `src="\${esc(MAP_IFRAME)}"`;

if (original.indexOf(CON_NUEVO) < 0) {
  console.log("no se encontró el data-src del mapa: el cambio ya no está como se esperaba");
  process.exit(1);
}

const correr = (etq) => {
  console.log("\n== " + etq + " ==");
  execFileSync(process.execPath, [path.join(__dirname, "perf.js")], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  })
    .split(/\r?\n/)
    .filter((l) =>
      /FCP |LCP |CLS |load |peso de terceros|peticiones al mapa|elemento LCP|recursos/.test(l),
    )
    .forEach((l) => console.log("  " + l.trim()));
};

try {
  /* --- estado viejo: el iframe pide el mapa en la carga --- */
  fs.writeFileSync(F, original.replace(CON_NUEVO, CON_VIEJO), "utf8");
  correr("ANTES (el mapa se pide en la carga)");

  /* --- estado nuevo: el mapa espera a estar cerca de la pantalla --- */
  fs.writeFileSync(F, original, "utf8");
  correr("AHORA (el mapa espera a estar cerca)");
} finally {
  /* Siempre se restaura, aunque una de las dos corridas reviente. */
  fs.writeFileSync(F, original, "utf8");
  const fin = fs.readFileSync(F, "utf8");
  console.log(
    "\nsrc/main.js restaurado: " + (fin === original ? "sí" : "NO, hay que revisarlo"),
  );
}