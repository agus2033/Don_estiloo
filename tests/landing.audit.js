/* AA + casos extremos: nombres larguísimos, 12 servicios, lista de turnos
   vacía, galería sin fotos, puntos 0 y 9999. */
const { chromium } = require("../.opencode/skills/playwright-skill/node_modules/playwright/index.js");
const fs = require("fs");

const lum = (r, g, b) => {
  const f = (v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => {
  const [x, y] = [lum(...a), lum(...b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};
const parse = (s) => {
  const t = String(s || "");
  /* color-mix() y color() devuelven "color(srgb 0.9 0.87 0.80)": los
     canales van de 0 a 1, no de 0 a 255. Sin esto la auditoría reporta
     contrastes falsos. */
  const cs = t.match(/color\(\s*srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/i);
  if (cs) return [+cs[1] * 255, +cs[2] * 255, +cs[3] * 255];
  const n = (t.match(/[\d.]+/g) || [0, 0, 0]).slice(0, 3).map(Number);
  return n;
};

(async () => {
  const browser = await chromium.launch();
  const out = { contraste: [], worst: [], errores: [] };

  // ---------- 1. contraste AA en ambos modos ----------
  for (const theme of ["dark", "light"]) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.addInitScript((t) => localStorage.setItem("theme", t), theme);
    await page.goto("http://127.0.0.1:8765/index.html", { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".lb");
    await page.waitForTimeout(2000);

    const samples = await page.evaluate(() => {
      const sels = [
        [".lb-lead", "texto secundario"],
        [".lb-eyebrow", "eyebrow dorado"],
        [".lb-hero-note", "nota hero"],
        [".lb-widget-lbl", "label widget"],
        [".lb-wl-t small", "duracion servicio"],
        [".lb-price", "precio"],
        [".lb-sum span", "resumen label"],
        [".lb-sum b", "resumen valor"],
        [".lb-prog-lbl", "tus puntos"],
        [".lb-prog-msg", "mensaje progreso"],
        [".lb-prog-demo", "aviso ejemplo"],
        [".lb-barber small", "especialidad"],
        [".lb-tst blockquote", "cita"],
        [".lb-tst cite", "autor cita"],
        [".lb-hor th", "horario dia"],
        [".lb-hor td", "horario hora"],
        [".lb-field label", "label form"],
        [".lb-ft p", "footer"],
        [".lb-btn--pri", "boton primario"],
        [".lb-sv p", "descripcion servicio"],
        [".lb-sv-dur", "duracion tarjeta"],
        [".lb-wcard-note", "nota tarjeta hero"],
        [".wz-mini", "paso actual"],
        [".wz-paso.on", "paso activo"],
        [".wz-item-t b", "item servicio"],
        [".wz-item-t small", "item duracion"],
        [".wz-aviso", "aviso"],
        [".wz-vacio", "vacio"],
        [".wz-ocupadas", "nota ocupados"],
        [".wz-cal-top b", "titulo mes"],
        [".wz-dows span", "dia semana"],
        [".wz-leyenda .p", "leyenda"],
        [".wz-cel.libre", "celdia libre"],
        [".wz-cel.cerrado", "celdia cerrado"],
        [".wz-turno b", "turno"],
        [".wz-turno small", "turno rango"],
        [".wz-turno em", "turno cantidad"],
        [".wz-hora", "hora"],
        [".wz-hora.oc", "hora ocupada"],
        [".wz-sum span", "resumen label"],
        [".wz-sum b", "resumen valor"],
        [".wz-pol", "politica"],
        [".wz-btn--ghost", "boton atras"],
        [".wz-paso", "paso inactivo"],
      ];
      const bgOf = (el) => {
        let n = el;
        while (n && n !== document.documentElement) {
          const b = getComputedStyle(n).backgroundColor;
          if (b && b !== "rgba(0, 0, 0, 0)" && b !== "transparent") return b;
          n = n.parentElement;
        }
        return getComputedStyle(document.body).backgroundColor;
      };
      return sels
        .map(([sel, name]) => {
          const el = document.querySelector(sel);
          if (!el) return null;
          const cs = getComputedStyle(el);
          return {
            name,
            size: parseFloat(cs.fontSize),
            weight: cs.fontWeight,
            fg: cs.color,
            bg: bgOf(el),
          };
        })
        .filter(Boolean);
    });

    for (const s of samples) {
      const r = ratio(parse(s.fg), parse(s.bg));
      const grande = s.size >= 24 || (s.size >= 18.66 && Number(s.weight) >= 700);
      const min = grande ? 3 : 4.5;
      out.contraste.push({
        tema: theme,
        el: s.name,
        ratio: +r.toFixed(2),
        min,
        ok: r >= min,
        grande,
      });
    }
    await ctx.close();
  }

  // ---------- 2. casos extremos ----------
  for (const w of [390, 1440]) {
    const ctx = await browser.newContext({
      viewport: { width: w, height: 844 },
      deviceScaleFactor: 2,
    });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => out.errores.push(`[${w}] ${e.message}`));
    await page.goto("http://127.0.0.1:8765/index.html", { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".lb");
    await page.waitForTimeout(1800);

    await page.evaluate(() => {
      const LARGO =
        "Corte y barba completo con lavado, peinado y perfilado de cejas al detalle";
      // 12 servicios con nombres larguísimos
      const cont = document.querySelector(".lb-sv-list-m");
      if (cont) {
        const tpl = cont.firstElementChild;
        if (tpl) {
          cont.innerHTML = "";
          for (let i = 0; i < 12; i++) {
            const c = tpl.cloneNode(true);
            c.querySelector("b").textContent = LARGO + " " + (i + 1);
            c.querySelector("small").textContent = i % 3 ? "entre 45 a 90 minutos" : "30 min";
            c.querySelector(".lb-price").textContent = "$" + (999999 + i * 77777).toLocaleString("es-AR");
            cont.appendChild(c);
          }
        }
      }
      // grilla de escritorio: 12 tarjetas
      const grid = document.querySelector(".lb-sv-grid");
      if (grid) {
        grid.innerHTML = "";
        for (let i = 0; i < 12; i++)
          grid.insertAdjacentHTML(
            "beforeend",
            `<article class="lb-sv"><h3>${LARGO} ${i + 1}</h3><p>Descripción corta de prueba para verificar el alto de la tarjeta.</p><div class="lb-sv-ft"><span class="lb-sv-dur">entre 45 a 90 minutos</span><span class="lb-price">$${(999999 + i * 77777).toLocaleString("es-AR")}</span></div></article>`,
          );
      }
      // turnos vacíos
      document.querySelectorAll(".lb-empty").forEach((e) => (e.textContent = "Hoy no hay horarios libres."));
      // galería sin fotos
      const gal = document.querySelector(".lb-gal");
      if (gal) gal.innerHTML = "";
      // equipo vacío
      const team = document.querySelector(".lb-team");
      if (team) team.innerHTML = "";
      // puntos 0
      const n = document.querySelector(".lb-prog-n");
      if (n) n.innerHTML = '0<em> / 25 pts</em>';
      const f = document.querySelector(".lb-fill");
      if (f) f.style.setProperty("--lb-p", "0%");
      const m = document.querySelector(".lb-prog-msg");
      if (m) m.textContent = "Te faltan 25 puntos para el descuento 20%.";
      // nombre larguísimo en el header
      const b = document.querySelector(".lb-brand b");
      if (b) b.textContent = "CODIGO BARBER 1 SOCIEDAD DE RESPONSABILIDAD LIMITADA";
    });
    await page.waitForTimeout(600);

    const res = await page.evaluate(() => {
      const doc = document.documentElement;
      const desbordes = [];
      document.querySelectorAll(".lb *").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && (r.right > innerWidth + 1 || r.left < -1))
          desbordes.push({
            sel: el.tagName + "." + String(el.className).split(" ")[0],
            left: Math.round(r.left),
            right: Math.round(r.right),
          });
      });
      // texto cortado (scrollWidth > clientWidth con overflow hidden)
      const cortados = [];
      document.querySelectorAll(".lb b, .lb h1, .lb h2, .lb h3, .lb span").forEach((el) => {
        const cs = getComputedStyle(el);
        if (
          el.scrollWidth > el.clientWidth + 1 &&
          (cs.overflow === "hidden" || cs.textOverflow === "ellipsis")
        )
          cortados.push(el.tagName + "." + String(el.className).split(" ")[0] + " :: " + el.textContent.slice(0, 40));
      });
      return {
        scrollW: doc.scrollWidth,
        clientW: doc.clientWidth,
        overflowX: doc.scrollWidth > doc.clientWidth + 1,
        desbordes: desbordes.slice(0, 8),
        cortados: cortados.slice(0, 8),
      };
    });
    out.worst.push({ ancho: w, ...res });
    await page.screenshot({ path: `../tmp_shots/WORST-${w}.png`, fullPage: true });
    await ctx.close();
  }

  // puntos 9999
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.goto("http://127.0.0.1:8765/index.html", { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".lb");
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      const n = document.querySelector(".lb-prog-n");
      if (n) n.innerHTML = '9999<em> / 100 pts</em>';
      const f = document.querySelector(".lb-fill");
      if (f) f.style.setProperty("--lb-p", "100%");
      const m = document.querySelector(".lb-prog-msg");
      if (m) m.textContent = "Tenés todos los premios a mano.";
    });
    await page.waitForTimeout(400);
    const el = await page.$("#puntos");
    if (el) await el.screenshot({ path: "../tmp_shots/WORST-puntos9999.png" });
    const ov = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    out.worst.push({ ancho: 390, puntos9999OverflowX: ov });
    await ctx.close();
  }

  await browser.close();

  const fallos = out.contraste.filter((c) => !c.ok);
  console.log("=== CONTRASTE: " + out.contraste.length + " muestras, " + fallos.length + " fallos ===");
  fallos.forEach((f) => console.log("  FALLA " + f.tema + " " + f.el + " " + f.ratio + ":1 (min " + f.min + ")"));
  console.log("=== WORST CASE ===");
  console.log(JSON.stringify(out.worst, null, 2));
  console.log("errores:", JSON.stringify(out.errores));
  fs.writeFileSync("../tmp_shots/audit.json", JSON.stringify(out, null, 2));
})();
