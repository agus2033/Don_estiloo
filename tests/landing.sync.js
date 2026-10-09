/* Header en una sola línea, carrusel rotando, galería sin tope,
   horarios desde config, y el login-gate de Reservar ahora. */
const { chromium } = require("../.opencode/skills/playwright-skill/node_modules/playwright/index.js");

(async () => {
  const b = await chromium.launch();
  const out = { header: [], carrusel: {}, galeria: {}, horarios: {}, reserva: {}, errores: [] };

  // ---- header: una sola línea y sin desborde ----
  for (const w of [900, 1024, 1240, 1440, 1920]) {
    const ctx = await b.newContext({ viewport: { width: w, height: 900 } });
    const p = await ctx.newPage();
    p.on("pageerror", (e) => out.errores.push(`[${w}] ${e.message}`));
    await p.goto("http://127.0.0.1:8765/index.html", { waitUntil: "domcontentloaded" });
    await p.waitForSelector(".lb-hd-in");
    await p.waitForTimeout(1200);
    out.header.push(
      await p.evaluate((w) => {
        const hd = document.querySelector(".lb-hd-in").getBoundingClientRect();
        const nav = document.querySelector(".lb-nav");
        const navs = [...document.querySelectorAll(".lb-nav a")].map((a) => a.getBoundingClientRect());
        const tops = [...new Set(navs.map((r) => Math.round(r.top)))];
        const soc = document.querySelector(".lb-hd-soc");
        return {
          w,
          altoHeader: Math.round(hd.height),
          navVisible: getComputedStyle(nav).display !== "none",
          filasNav: tops.length,
          navSeSale: nav.getBoundingClientRect().right > innerWidth,
          redesVisibles: soc ? getComputedStyle(soc).display !== "none" : false,
          cta: [...document.querySelectorAll(".lb-hd-cta .lb-btn")].map(
            (x) => x.textContent.trim(),
          ),
          overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        };
      }, w),
    );
    await ctx.close();
  }

  // ---- carrusel: rota solo ----
  {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "no-preference" });
    const p = await ctx.newPage();
    p.on("pageerror", (e) => out.errores.push(`[car] ${e.message}`));
    await p.goto("http://127.0.0.1:8765/index.html", { waitUntil: "domcontentloaded" });
    await p.waitForSelector(".lb");
    await p.waitForTimeout(1500);
    const hay = await p.$("#lbcar");
    out.carrusel.hayCarrusel = !!hay;
    if (hay) {
      out.carrusel.diapositivas = await p.$$eval("#lbcar .lb-tst", (e) => e.length);
      const leer = () =>
        p.evaluate(() => {
          const v = document.querySelector(".lb-car-viz");
          const on = document.querySelector(".lb-car-punto.on");
          return { t: v.style.transform, punto: on ? [...on.parentElement.children].indexOf(on) : -1 };
        });
      out.carrusel.inicio = await leer();
      await p.waitForTimeout(6500); // > LB_CAR_MS (5500)
      out.carrusel.tras65s = await leer();
      // control manual
      await p.click('.lb-car-btn[aria-label="Reseña siguiente"]');
      await p.waitForTimeout(400);
      out.carrusel.trasClick = await leer();
    }
    await ctx.close();
  }

  // ---- reduced motion: no debe rotar solo ----
  {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
    const p = await ctx.newPage();
    await p.goto("http://127.0.0.1:8765/index.html", { waitUntil: "domcontentloaded" });
    await p.waitForSelector(".lb");
    await p.waitForTimeout(1200);
    if (await p.$("#lbcar")) {
      const a = await p.evaluate(() => document.querySelector(".lb-car-viz").style.transform);
      await p.waitForTimeout(6500);
      const c = await p.evaluate(() => document.querySelector(".lb-car-viz").style.transform);
      out.carrusel.reducedMotionNoRota = a === c;
    }
    await ctx.close();
  }

  // ---- galería: sin tope + imágenes encuadradas ----
  {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
    const p = await ctx.newPage();
    p.on("pageerror", (e) => out.errores.push(`[gal] ${e.message}`));
    await p.goto("http://127.0.0.1:8765/index.html", { waitUntil: "domcontentloaded" });
    await p.waitForSelector(".lb-gal");
    await p.waitForTimeout(1500);
    out.galeria.real = await p.$$eval(".lb-gal figure", (f) => f.length);
    // simulo 37 fotos y reviso encuadre + desborde
    out.galeria.con37 = await p.evaluate(async () => {
      const g = document.querySelector(".lb-gal");
      const tpl = g.querySelector("figure") || document.createElement("figure");
      g.innerHTML = "";
      // mezcla de relaciones de aspecto: cuadrada, apaisada, vertical
      const formas = [
        "https://picsum.photos/seed/a/900/900",
        "https://picsum.photos/seed/b/1600/600",
        "https://picsum.photos/seed/c/600/1200",
        "https://picsum.photos/seed/d/1200/900",
      ];
      for (let i = 0; i < 37; i++) {
        const f = document.createElement("figure");
        f.innerHTML = `<img src="${formas[i % 4]}" alt="" style="visibility:hidden">`;
        g.appendChild(f);
      }
      await new Promise((r) => setTimeout(r, 400));
      const figs = [...g.querySelectorAll("figure")];
      const img = g.querySelector("img");
      const cs = img ? getComputedStyle(img) : null;
      return {
        figuras: figs.length,
        objectFit: cs ? cs.objectFit : null,
        objectPosition: cs ? cs.objectPosition : null,
        galeriaSeSale: g.getBoundingClientRect().right > innerWidth,
        overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        altoGaleria: Math.round(g.getBoundingClientRect().height),
      };
    });
    await ctx.close();
  }

  // ---- horarios desde config/horario ----
  {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
    const p = await ctx.newPage();
    await p.goto("http://127.0.0.1:8765/index.html", { waitUntil: "domcontentloaded" });
    await p.waitForSelector(".lb-hor");
    await p.waitForTimeout(1500);
    out.horarios.filas = await p.$$eval(".lb-hor tr", (rs) =>
      rs.map((r) => [
        r.querySelector("th").textContent.trim(),
        r.querySelector("td").textContent.trim().replace(/\s+/g, " "),
      ]),
    );
    await ctx.close();
  }

  // ---- login gate de "Reservar ahora" (sin sesión) ----
  {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
    const p = await ctx.newPage();
    p.on("pageerror", (e) => out.errores.push(`[res] ${e.message}`));
    await p.goto("http://127.0.0.1:8765/index.html", { waitUntil: "domcontentloaded" });
    await p.waitForSelector(".lb");
    await p.waitForTimeout(1500);
    await p.click('.lb-hd-cta [data-act="lbReservar"]');
    await p.waitForTimeout(700);
    out.reserva.sinSesion = await p.evaluate(() => ({
      hash: location.hash,
      loginVisible: !!document.querySelector("#ingresar") && !document.querySelector("#ingresar").hidden,
      loginH1: (document.querySelector("#ingresar h1") || {}).textContent || null,
    }));
    await ctx.close();
  }

  await b.close();
  console.log(JSON.stringify(out, null, 2));
})();
