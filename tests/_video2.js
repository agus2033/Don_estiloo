/* Extrae capturas de un video con el <video> de Chromium (no hay ffmpeg en
   la máquina). Genera una página mínima con el video, la busca a varios
   segundos y saca una foto de cada cuadro.

   Igual que tests/_video.js pero permite elegir UN video por un fragmento del
   nombre, porque hay varios en la misma carpeta y el acento del nombre no
   viaja bien por argv.

   Uso:  node tests\_video2.js "230701" [segundos...]
          node tests\_video2.js "230701"          → 9 cuadros automáticos
*/
const { chromium } = require("../.opencode/skills/playwright-skill/node_modules/playwright/index.js");
const fs = require("fs");
const path = require("path");

const CARPETA = "C:/Users/agus2/Videos/Grabaciones de pantalla";
const frag = process.argv[2];
const segundos = process.argv.slice(3).map(Number);

const archivo = fs
  .readdirSync(CARPETA)
  .filter((f) => f.toLowerCase().endsWith(".mp4"))
  .find((f) => f.indexOf(frag) >= 0);
if (!archivo) {
  console.log('no se encontró ningún mp4 con "' + frag + '"');
  process.exit(1);
}
const ruta = path.join(CARPETA, archivo);
console.log("usando: " + archivo);

(async () => {
  /* El Chromium que trae Playwright NO incluye los códecs propietarios
     (H.264/AAC), así que un .mp4 commonplace se queda en readyState 0 para
     siempre y el script se cuelga. Hay que lanzar el Chrome del sistema. */
  const b = await chromium.launch({ channel: "chrome" });
  const ctx = await b.newContext({ viewport: { width: 900, height: 900 } });
  const p = await ctx.newPage();
  p.on("console", (m) => m.type() === "error" && console.log("consola:", m.text().slice(0, 160)));

  const dir = path.join(__dirname, "tmp_shots");
  fs.mkdirSync(dir, { recursive: true });
  const copia = path.join(dir, "video.mp4");
  fs.copyFileSync(ruta, copia);
  const url = "http://127.0.0.1:8765/tests/tmp_shots/video.mp4";

  await p.goto("http://127.0.0.1:8765/index.html");
  await p.setContent(
    `<body style="margin:0;background:#000">
     <video id="v" src="${url}" style="width:100vw;height:100vh;object-fit:contain" muted playsinline></video>`,
  );

  const dur = await p.evaluate(async () => {
    const v = document.getElementById("v");
    for (let i = 0; i < 120; i++) {
      if (v.readyState >= 1) return v.duration;
      if (v.error) throw new Error("error de video, código " + v.error.code);
      await new Promise((r) => setTimeout(r, 250));
    }
    throw new Error("timeout cargando el video");
  });
  console.log("duracion:", dur.toFixed(1), "s");

  const pasos = segundos.length
    ? segundos
    : Array.from({ length: 9 }, (_, i) => +((dur * (i + 1)) / 10).toFixed(1));

  for (const s of pasos) {
    await p.evaluate(async (seg) => {
      const v = document.getElementById("v");
      v.pause();
      await new Promise((res) => {
        v.onseeked = res;
        v.currentTime = seg;
        setTimeout(res, 3000);
      });
      await new Promise((r) => setTimeout(r, 300));
    }, s);
    const nombre = `tests/tmp_shots/vid-${frag}-${String(s).replace(".", "_")}.png`;
    await p.locator("#v").screenshot({ path: nombre });
    console.log("  " + s + "s -> " + nombre);
  }
  await b.close();
})().catch((e) => {
  console.log("FALLO:", e.message);
  process.exit(1);
});