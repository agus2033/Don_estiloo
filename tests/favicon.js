/* Genera /favicon.ico a partir del logo del proyecto.

   POR QUÉ hace falta: no había ningún favicon.ico en la raíz, y esa es la ruta
   que Google (y cualquier navegador) pide primero. El resultado en Google era
   el globo genérico al lado del nombre del sitio.

   El <link rel="icon" href="assets/icon-192.png"> estaba bien y no alcanzaba:
   el favicon que muestra el buscador no sale de ahí.

   Se generan tres medidas en un solo .ico (lo que Windows y los navegadores
   buscan):
     16x16  la de las pestañas
     32x32  la del escritorio
     48x48  la de Windows en la lista de programas

   El logo es un PNG con fondo NEGRO OPACO, así que no hace falta transparency
   ni máscara: se escala tal cual.

   Se usa el <canvas> de Chromium para redimensionar (no hay ImageMagick ni
   ffmpeg en la máquina) y el archivo ICO se arma a mano: es un contenedor
   chico con una cabecera y una entrada por imagen, y desde Windows Vista
   admite PNG adentro, así que no hay que convertir a BMP.

   node tests\favicon.js
*/
const { chromium } = require("../.opencode/skills/playwright-skill/node_modules/playwright/index.js");
const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..");
const FUENTE = "assets/logo-256.png";
const SALIDA = path.join(RAIZ, "favicon.ico");
const MEDIDAS = [16, 32, 48];

(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext()).newPage();

  /* Página en blanco y la imagen como data URL. No se usa index.html porque
     su JavaScript navega (cambia el hash) y eso destruye el contexto de la
     evaluación a mitad del proceso. */
  await p.setContent("<body></body>");
  const dataUrl = "data:image/png;base64," + fs.readFileSync(path.join(RAIZ, FUENTE)).toString("base64");

  /* Se leen los PNG redimensionados, uno por uno, como base64. */
  const imagenes = [];
  for (const lado of MEDIDAS) {
    const b64 = await p.evaluate(
      async ({ src, lado }) => {
        const img = new Image();
        img.src = src;
        await new Promise((r, j) => {
          img.onload = r;
          img.onerror = () => j(new Error("no se pudo cargar el logo"));
        });
        const c = document.createElement("canvas");
        c.width = lado;
        c.height = lado;
        const x = c.getContext("2d");
        x.imageSmoothingEnabled = true;
        x.imageSmoothingQuality = "high";
        /* El logo es cuadrado, así que entra justo. */
        x.drawImage(img, 0, 0, lado, lado);
        return c.toDataURL("image/png").split(",")[1];
      },
      { src: dataUrl, lado },
    );
    imagenes.push({ lado, buf: Buffer.from(b64, "base64") });
    console.log(`  ${lado}x${lado}: ${Math.round(imagenes.at(-1).buf.length / 1024)} KB`);
  }

  await b.close();

  /* --- armar el .ico ---
     Cabecera:  reserved(2)=0 · type(2)=1 (icono) · cantidad(2)
     Por imagen: ancho(1) alto(1) colores(1) reservado(1) planos(2) bits(2)
                 tamaño(4) offset(4)
     Los campos ancho/alto son de 1 byte y guardan 0 para 256; para 16, 32 y 48
     van el número tal cual. */
  const CAB = 6,
    POR = 16;
  const total = CAB + POR * imagenes.length + imagenes.reduce((a, i) => a + i.buf.length, 0);
  const out = Buffer.alloc(total);
  let o = 0;
  out.writeUInt16LE(0, o);
  o += 2;
  out.writeUInt16LE(1, o); /* tipo 1 = icono */
  o += 2;
  out.writeUInt16LE(imagenes.length, o);
  o += 2;

  let datos = CAB + POR * imagenes.length;
  for (const im of imagenes) {
    out.writeUInt8(im.lado, o++); /* ancho  */
    out.writeUInt8(im.lado, o++); /* alto   */
    out.writeUInt8(0, o++); /* colores: 0 = sin paleta propia */
    out.writeUInt8(0, o++); /* reservado */
    out.writeUInt16LE(1, o); /* planos */
    o += 2;
    out.writeUInt16LE(32, o); /* bits por píxel */
    o += 2;
    out.writeUInt32LE(im.buf.length, o);
    o += 4;
    out.writeUInt32LE(datos, o);
    o += 4;
    datos += im.buf.length;
  }
  for (const im of imagenes) {
    im.buf.copy(out, o);
    o += im.buf.length;
  }

  fs.writeFileSync(SALIDA, out);
  console.log(
    "\n  escrito " + path.relative(RAIZ, SALIDA) + ": " + Math.round(out.length / 1024) + " KB, " +
      imagenes.length + " medidas",
  );

  /* Comprobación de que el archivo está bien armado: se vuelve a leer la
     cabecera y se compara con lo que se escribió. */
  const back = fs.readFileSync(SALIDA);
  const n = back.readUInt16LE(4);
  let ok = back.readUInt16LE(0) === 0 && back.readUInt16LE(2) === 1 && n === MEDIDAS.length;
  for (let i = 0; i < n && ok; i++) {
    const p0 = CAB + POR * i;
    const tam = back.readUInt32LE(p0 + 8);
    const off = back.readUInt32LE(p0 + 12);
    /* La firma del PNG: los primeros 8 bytes tienen que ser 89 50 4E 47. */
    ok = off + tam <= back.length && back.slice(off, off + 4).toString("hex") === "89504e47";
  }
  console.log(ok ? "  OK    la cabecera y las 3 entradas del ico están bien" : "  FALLA el .ico quedó mal armado");
  process.exit(ok ? 0 : 1);
})();