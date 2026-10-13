/* Compara las reglas de Firestore: la del repo (la que escribiste) contra la
   que estaba commiteada (la probada), línea por línea, sólo las que mandan.

   Sirve para mezclar sin perder lo tuyo: hay que ver QUÉ cambió, noDiff que no
   funciona en Windows con rutas absolutas.
*/
const fs = require("fs");

const reglas = (f) =>
  fs
    .readFileSync(f, "utf8")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith("//"));

const A = reglas(process.argv[2]); // la del repo
const B = reglas(process.argv[3]); // la commiteada

console.log("la del repo tiene " + A.length + " lineas con contenido");
console.log("la commiteada tiene " + B.length + "\n");

const soloA = A.filter((x) => !B.includes(x));
const soloB = B.filter((x) => !A.includes(x));

console.log("=== SOLO EN LA DEL REPO (lo que escribiste vos) ===");
soloA.forEach((x) => console.log("  " + x.slice(0, 110)));
console.log("\n=== SOLO EN LA COMMITIDA (el endurecimiento que se perdio) ===");
soloB.forEach((x) => console.log("  " + x.slice(0, 110)));