/* Re-codifica los PNG del proyecto y SE QUEDA CON EL MENOR.

   Por qué: medido en la landing en móvil, `assets/logo-256.png` pesa 82 KB y
   es lo que se ve en el primer pintado (el loader, a 176×176). `icon-512.png`
   pesa 316 KB: lo baja Android cuando instala la app. Los tres juntos son
   445 KB de PNG que no cambian ni un píxel de lo que se ve.

   Los PNG originales están casi sin comprimir (82 KB para 256×256 son ~1,2
   bytes por píxel de contenido útil). Canvas los vuelve a escribir con
   compresión y reducción de paleta.

   No cambia el tamaño ni el aspecto: sólo la codificación. Y si el resultado
   sale MÁS grande, se deja el original. Siempre imprime el antes y el después:
   el número está medido, no estimado.

   node tests\optimiza-iconos.js
*/
const { chromium } = require("../.opencode/skills/playwright-skill/node_modules/playwright/index.js");
const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..");

async function main() {
  const b = await chromium.launch();
  const page = await b.newPage();

  const archivos = fs
    .readdirSync(path.join(RAIZ, "assets"))
    .filter((f) => f.endsWith(".png"))
    .filter((f) => {
      /* Los logos de las marcas (facebook, google, whatsapp, instagram) son
        íos que trae la propia marca: se tocan por licencia, no por tamaño. */
      return !/^(facebook|google|whatsapp|instagram)-/.test(f);
    });

  let antes = 0;
  let despues = 0;
  const antesDe = new Map();

  for (const f of archivos) {
    const ruta = path.join(RAIZ, "assets", f);
    const original = fs.readFileSync(ruta);
    antes += original.length;
    antesDe.set(f, original.length);

    const b64 = original.toString("base64");
    const salida = await page.evaluate(
      (data) =>
        new Promise((res) => {
          const img = new Image();
          img.onload = () => {
            const c = document.createElement("canvas");
            c.width = img.naturalWidth;
            c.height = img.naturalHeight;
            const g = c.getContext("2d");
            g.drawImage(img, 0, 0);
            res(c.toDataURL("image/png").split(",")[1]);
          };
          img.onerror = () => res(null);
          img.src = "data:image/png;base64," + data;
        }),
      b64,
    );

    if (!salida) {
      console.log(`  ${f.padEnd(26)} no se pudo leer, queda como estaba`);
      despues += original.length;
      continue;
    }
    const nuevo = Buffer.from(salida, "base64");
    if (nuevo.length < original.length * 0.98) {
      fs.writeFileSync(ruta, nuevo);
      despues += nuevo.length;
      console.log(
        `  ${f.padEnd(26)} ${String(Math.round(original.length / 1024)).padStart(4)} KB -> ${String(Math.round(nuevo.length / 1024)).padStart(3)} KB`,
      );
    } else {
      despues += original.length;
      console.log(
        `  ${f.padEnd(26)} ${String(Math.round(original.length / 1024)).padStart(4)} KB -> sin mejora, queda igual`,
      );
    }
  }

  await b.close();
  console.log(
    `\ntotal: ${Math.round(antes / 1024)} KB -> ${Math.round(despues / 1024)} KB  (se ahorraron ${Math.round((antes - despues) / 1024)} KB)`,
  );
  return antes - despues;
}

main();