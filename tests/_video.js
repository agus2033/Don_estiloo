/* Extrae capturas de un video con el <video> de Chromium (no hay ffmpeg
   en la máquina). Genera una página mínima con el video, la busca a varios
   segundos y saca una foto de cada cuadro.

   Uso:  node tests\_video.js "<carpeta>" [segundos...]
 *
 * OJO: se pasa la CARPETA, no el archivo. Los nombres tienen acentos
 * ("Grabaci\u00f3n") y si la ruta viene por argv desde PowerShell el acento
 * llega como U+FFFD y el video da ERR_FILE_NOT_FOUND. Leyendo el nombre
 * desde disco con fs no hay intermediario que lo arruine.            */
const { chromium } = require("../.opencode/skills/playwright-skill/node_modules/playwright/index.js");
const fs = require("fs");
const path = require("path");

const carpeta = process.argv[2];
const segundos = process.argv.slice(3).map(Number);

/* Si es un archivo se usa; si es una carpeta, el mp4 m\u00e1s reciente. */
let ruta = carpeta;
if (fs.existsSync(carpeta) && fs.statSync(carpeta).isDirectory()) {
  const mp4 = fs
    .readdirSync(carpeta)
    .filter((f) => f.toLowerCase().endsWith(".mp4"))
    .map((f) => ({ f, t: fs.statSync(path.join(carpeta, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t)[0];
  if (!mp4) {
    console.log("no hay mp4 en " + carpeta);
    process.exit(1);
  }
  ruta = path.join(carpeta, mp4.f);
  console.log("usando: " + mp4.f);
}

(async () => {
  /* OJO con el navegador: el Chromium que trae Playwright NO incluye los
   códecs propietarios (H.264/AAC), así que un .mp4 commonplace se queda
   en readyState 0 para siempre y el script se cuelga esperando metadata.
   Hay que lanzar el Chrome del sistema con `channel: "chrome"`. */
const b = await chromium.launch({ channel: "chrome" });
  const ctx = await b.newContext({ viewport: { width: 900, height: 900 } });
  const p = await ctx.newPage();
  p.on("console", (m) => m.type() === "error" && console.log("consola:", m.text()));

  /* El video se copia al repo con un nombre ASCII y se carga por http://,
   no por file://. Chromium bloquea que una página file:// cargue otro
   recurso file:// ("Not allowed to load local resource"), y adem\u00e1s el
   nombre original tiene acentos que no viajan bien por la l\u00ednea de
   comandos. As\u00ed se evita el problema entero de los dos lados. */
  const dir = path.join(__dirname, "tmp_shots");
  fs.mkdirSync(dir, { recursive: true });
  const copia = path.join(dir, "video.mp4");
  fs.copyFileSync(ruta, copia);
  const url = "http://127.0.0.1:8765/tests/tmp_shots/video.mp4";

  /* Se navega a una página que EXISTE antes de setContent: /tests/ da 404 y
     dejar el documento en ese estado hace que el <video> nunca arranque. */
  await p.goto("http://127.0.0.1:8765/index.html");
  await p.setContent(
    `<body style="margin:0;background:#000">
     <video id="v" src="${url}" style="width:100vw;height:100vh;object-fit:contain" muted playsinline></video>`,
  );

  /* Sondeo en vez de esperar el evento: el <video> arranca a cargar apenas
     se inserta en el DOM, así que `onloadedmetadata` puede haber disparado
     antes de que se enganche el handler y la promesa no resuelve nunca.
     readyState >= 1 significa que ya hay metadata. */
  const dur = await p.evaluate(async () => {
    const v = document.getElementById("v");
    for (let i = 0; i < 120; i++) {
      if (v.readyState >= 1) return v.duration;
      if (v.error) throw new Error("error de video, código " + v.error.code);
      await new Promise((r) => setTimeout(r, 250));
    }
    throw new Error("timeout cargando el video (readyState=" + v.readyState + ")");
  });
  console.log("duracion:", dur.toFixed(1), "s");

  const marca = path.basename(ruta).replace(/\.mp4$/i, "").slice(0, 20);
  const pasos = segundos.length ? segundos : Array.from({ length: 9 }, (_, i) => +((dur * (i + 1)) / 10).toFixed(1));

  for (const s of pasos) {
    await p.evaluate(async (seg) => {
      const v = document.getElementById("v");
      v.pause();
      await new Promise((res) => {
        v.onseeked = res;
        v.currentTime = seg;
        setTimeout(res, 3000);
      });
      await new Promise((r) => setTimeout(r, 350));
    }, s);
    const nombre = `tests/tmp_shots/vid-${marca}-${String(s).replace(".", "_")}.png`;
    await p.locator("#v").screenshot({ path: nombre });
    console.log("  " + s + "s -> " + nombre);
  }
  await b.close();
})().catch((e) => {
  console.log("FALLO:", e.message);
  process.exit(1);
});