/* La tarjeta del barbero que se da vuelta.

   Cubre: el giro de 180°, que al tocar otra se cierre la anterior, el
   teclado, que la cara oculta quede fuera del taborder (inert) y del lector
   de pantalla, y que el botón "Reservar con…" lleve a la reserva.

   Los datos salen de los reales de Firestore; si ningún barbero cargó
   ficha, se puebla la lista con el gancho local para no dejar el dorso
   sin probar. */
const { chromium } = require("../.opencode/skills/playwright-skill/node_modules/playwright/index.js");
const { HELPERS, FONDO_SRC, src } = require("./color.js");

const SINTETICOS = [
  {
    id: "tb1",
    n: "asda",
    esp: "Barbero",
    desc: "Fade deprecado y profiles a navaja.",
    tel: "3757555555",
    ig: "asda.cuts",
    redes: [{ n: "TikTok", url: "https://tiktok.com/@asda" }],
  },
  { id: "tb2", n: "pablo", esp: "Colorista" },
];

(async () => {
  const browser = await chromium.launch();
  const out = [];
  /* Se imprime en el momento, no al final: si el test revienta a la mitad
     (un locator que no aparece), sin esto se pierde todo lo que pasó
     antes y no se sabe dónde se cortó. */
  const ok = (t, e) => {
    out.push(["OK", t, e || ""]);
    console.log(`  OK    ${t}${e ? "  -> " + e : ""}`);
  };
  const bad = (t, e) => {
    out.push(["FAIL", t, e || ""]);
    console.log(`  FAIL  ${t}${e ? "  -> " + e : ""}`);
  };
  const chk = (c, t, e) => (c ? ok(t, e) : bad(t, e));

  for (const [tema, w] of [
    ["dark", 1440],
    ["light", 1440],
    ["dark", 390],
  ]) {
    const ctx = await browser.newContext({
      viewport: { width: w, height: 900 },
      hasTouch: w <= 900,
      isMobile: w <= 900,
    });
    const page = await ctx.newPage();
    const jsErr = [];
    page.on("pageerror", (e) => jsErr.push(String(e)));
    page.on("console", (m) => m.type() === "error" && jsErr.push(m.text()));
    await page.addInitScript((t) => localStorage.setItem("theme", t), tema);
    await page.goto("http://127.0.0.1:8765/index.html", { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".lb-barber", { timeout: 25000 });
    await page.waitForTimeout(3500);
    const tag = `${tema}/${w}`;

    const base = await page.evaluate(() => {
      /* Los atributos del giro (data-act, tabindex, role, aria-expanded) y
         la `perspective` viven en `.lb-barber-giro`, no en la tarjeta: con
         el rediseño la tarjeta se partió en la zona que gira y el pie con
         los botones. */
      const cs = [...document.querySelectorAll(".lb-barber")].map((c) => {
        const g = c.querySelector(".lb-barber-giro");
        return {
          act: g ? g.dataset.act : null,
          tab: g ? g.getAttribute("tabindex") : null,
          role: g ? g.getAttribute("role") : null,
          exp: g ? g.getAttribute("aria-expanded") : null,
          ctas: c.querySelectorAll(".lb-barber-cta").length,
          atrasInert: c.querySelector(".lb-barber-atras").hasAttribute("inert"),
          atrasHidden: c.querySelector(".lb-barber-atras").getAttribute("aria-hidden"),
          persp: g ? getComputedStyle(g).perspective : "none",
          estiloInt: getComputedStyle(c.querySelector(".lb-barber-int")).transformStyle,
          backface: getComputedStyle(c.querySelector(".lb-barber-frente")).backfaceVisibility,
          pie: [...c.querySelectorAll(".lb-barber-pie .lb-btn")].map((x) => x.textContent.trim()),
        };
      });
      return cs;
    });
    chk(base.length >= 2, `${tag} · hay al menos 2 tarjetas`, `n=${base.length}`);
    chk(
      base.every((c) => c.act === "lbFlip" && c.tab === "0" && c.role === "button" && c.exp === "false"),
      `${tag} · todas son pulsables y arrancan cerradas`,
      JSON.stringify(base[0]),
    );
    chk(
      base.every((c) => c.atrasInert && c.atrasHidden === "true"),
      `${tag} · el dorso arranca oculto para teclado y lector de pantalla`,
      "",
    );
    chk(
      base.every((c) => c.persp !== "none" && c.estiloInt === "preserve-3d" && c.backface === "hidden"),
      `${tag} · el 3D está armado (perspective + preserve-3d + backface)`,
      `${base[0].persp} / ${base[0].estiloInt} / ${base[0].backface}`,
    );

    /* ---------- girar ---------- */
    const antes = await page.evaluate(() => {
      const c = document.querySelectorAll(".lb-barber")[0];
      return {
        rot: getComputedStyle(c.querySelector(".lb-barber-int")).transform,
        alto: Math.round(c.getBoundingClientRect().height),
      };
    });
    await page.locator(".lb-barber-giro").first().click();
    await page.waitForTimeout(750);
    const despues = await page.evaluate(() => {
      const c = document.querySelectorAll(".lb-barber")[0];
      const g = c.querySelector(".lb-barber-giro");
      const int = c.querySelector(".lb-barber-int");
      const atras = c.querySelector(".lb-barber-atras");
      const frente = c.querySelector(".lb-barber-frente");
      const m = new DOMMatrix(getComputedStyle(int).transform);
      return {
        abierta: c.classList.contains("lb-barber--abierta"),
        /* aria-expanded lo lleva la zona que gira, no la tarjeta */
        exp: g ? g.getAttribute("aria-expanded") : null,
        /* El ángulo sale de m11 (= cos θ), NO de atan2(m32, m22): en una
           rotación alrededor de Y la matriz es
             [ cos 0 sin ]
             [ 0   1 0   ]   → m22 SIEMPRE vale 1
             [-sin 0 cos ]
           y atan2(m32, m22) daba 0° con la tarjeta ya girada. */
        grados: Math.round((Math.acos(Math.max(-1, Math.min(1, m.m11))) * 180) / Math.PI),
        atrasVisible: !atras.hasAttribute("inert") && atras.getAttribute("aria-hidden") === "false",
        frenteInert: frente.hasAttribute("inert"),
        alto: Math.round(c.getBoundingClientRect().height),
        dorsoAlto: Math.round(atras.getBoundingClientRect().height),
      };
    });
    chk(despues.abierta && despues.exp === "true", `${tag} · al tocar, la tarjeta queda marcada como abierta`);
    chk(
      Math.abs(despues.grados - 180) < 2 || Math.abs(despues.grados + 180) < 2,
      `${tag} · la tarjeta rotó 180 grados`,
      `${despues.grados}° (antes ${antes.rot})`,
    );
    chk(despues.atrasVisible, `${tag} · el dorso queda accesible (inert fuera, aria-hidden=false)`);
    chk(despues.frenteInert, `${tag} · el frente queda fuera del taborder`);
    chk(despues.alto >= despues.dorsoAlto - 4, `${tag} · la tarjeta creció para contener el dorso`, `tarjeta=${despues.alto} dorso=${despues.dorsoAlto} antes=${antes.alto}`);

    /* ---------- sólo una abierta ---------- */
    const n = await page.evaluate(() => document.querySelectorAll(".lb-barber").length);
    if (n >= 2) {
      await page.locator(".lb-barber-giro").nth(1).click();
      await page.waitForTimeout(800);
      const dos = await page.evaluate(() => {
        const cs = [...document.querySelectorAll(".lb-barber")];
        return {
          abiertas: cs.filter((c) => c.classList.contains("lb-barber--abierta")).length,
          cual: cs.findIndex((c) => c.classList.contains("lb-barber--abierta")),
          primera: getComputedStyle(cs[0].querySelector(".lb-barber-int")).transform,
        };
      });
      chk(dos.abiertas === 1, `${tag} · al tocar otra, sólo queda una abierta`, `abiertas=${dos.abiertas} indice=${dos.cual}`);
      chk(dos.cual === 1, `${tag} · y es la recién tocada`, `indice=${dos.cual}`);
      chk(
        dos.primera === "none" || dos.primera === "matrix3d(1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1)",
        `${tag} · la anterior vuelve a su posición`,
        dos.primera,
      );
    }

    /* ---------- tocar la misma la cierra ---------- */
    await page.locator(".lb-barber-giro").nth(1).click();
    await page.waitForTimeout(750);
    chk(
      await page.evaluate(() => document.querySelectorAll(".lb-barber--abierta").length) === 0,
      `${tag} · tocar la misma tarjeta la cierra`,
    );

    /* ---------- teclado ---------- */
    await page.locator(".lb-barber-giro").first().focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(750);
    chk(
      await page.evaluate(() => document.querySelectorAll(".lb-barber--abierta").length) === 1,
      `${tag} · Enter abre la ficha`,
    );
    await page.keyboard.press("Escape");
    await page.waitForTimeout(750);
    chk(
      await page.evaluate(() => document.querySelectorAll(".lb-barber--abierta").length) === 0,
      `${tag} · Escape cierra la ficha`,
    );

    /* ---------- clic fuera ---------- */
    await page.locator(".lb-barber-giro").first().click();
    await page.waitForTimeout(700);
    chk(
      await page.evaluate(() => document.querySelectorAll(".lb-barber--abierta").length) === 1,
      `${tag} · la ficha quedó abierta antes de probar el clic fuera`,
    );
    /* Se hace clic por coordenadas en la esquina: un locator sobre un
       heading puede quedar tapado por el CTA sticky y fallar en silencio. */
    await page.mouse.click(6, 6);
    await page.waitForTimeout(700);
    chk(
      await page.evaluate(() => document.querySelectorAll(".lb-barber--abierta").length) === 0,
      `${tag} · un clic fuera del equipo cierra la ficha`,
    );

    /* ---------- botón de reservar del pie ----------
       Con el mockup el botón ya no está en el dorso: quedó en el pie,
       siempre visible, para que "Reservar con X" no dependa de girar la
       tarjeta primero. Se comprueba que existe, que dice con quién y que
       es alcanzable con el teclado con la ficha CERRADA. */
    const res = await page.evaluate(() => {
      const b = document.querySelector(".lb-barber-pie [data-act='lbReservarBar']");
      return { hay: !!b, texto: b ? b.textContent.trim() : "", tab: b ? b.tabIndex : -9 };
    });
    chk(res.hay, `${tag} · la tarjeta trae el botón de reservar en el pie`);
    chk(/Reservar con /.test(res.texto), `${tag} · dice con quién`, res.texto);
    chk(res.tab >= 0, `${tag} · es alcanzable con el teclado`, `tabIndex=${res.tab}`);
    /* Los dos botones del pie, como en el mockup */
    const pie = await page.evaluate(() =>
      [...document.querySelector(".lb-barber-pie").querySelectorAll(".lb-btn")].map((x) => x.textContent.trim()),
    );
    chk(pie.length === 2 && /Ver informaci/.test(pie[1]), `${tag} · el pie tiene los dos botones`, pie.join(" | "));

    /* Se abre para medir que la tarjeta abierta sigue en pantalla. */
    await page.locator(".lb-barber-giro").first().click();
    await page.waitForTimeout(750);

    /* ---------- al crecer, la tarjeta sigue en pantalla ---------- */
    const enVista = await page.evaluate(() => {
      const c = document.querySelector(".lb-barber--abierta");
      if (!c) return null;
      const r = c.getBoundingClientRect();
      return { top: Math.round(r.top), bottom: Math.round(r.bottom), alto: Math.round(r.height), win: window.innerHeight };
    });
    chk(
      enVista && enVista.top >= 60 && enVista.bottom <= enVista.win + 4,
      `${tag} · al abrir, la tarjeta entera queda a la vista`,
      JSON.stringify(enVista),
    );
    await page.locator(".lb-barber-pie [data-act='lbReservarBar']").first().click();
    await page.waitForTimeout(800);
    const salto = await page.evaluate(() => ({ hash: location.hash, abiertas: document.querySelectorAll(".lb-barber--abierta").length }));
    chk(/#\/reservar/.test(salto.hash), `${tag} · "Reservar con…" lleva a la reserva`, salto.hash);
    chk(salto.abiertas === 0, `${tag} · y cierra la ficha al saltar`, `${salto.abiertas}`);

    /* ---------- teléfono y redes del dorso ---------- */
    await page.goto("http://127.0.0.1:8765/index.html", { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".lb-barber", { timeout: 25000 });
    await page.waitForTimeout(3000);
    const hayFicha = await page.evaluate(() =>
      (window.__test ? window.__test.bars : []).some((b) => b.tel || b.ig || b.desc || (b.redes || []).length),
    );
    if (!hayFicha) {
      await page.evaluate((bars) => window.__test.setBars(bars), SINTETICOS);
      await page.waitForTimeout(600);
      out.push(["SKIP", `${tag} · sin ficha en Firestore: se prueba con datos sintéticos`, ""]);
      console.log(`  skip  ${tag} · sin ficha en Firestore: se prueba con datos sintéticos`);
    }
    await page.locator(".lb-barber-giro").first().click();
    await page.waitForTimeout(750);
    const dorso = await page.evaluate(() => {
      const d = document.querySelector(".lb-barber--abierta .lb-barber-atras");
      return {
        enlaces: [...d.querySelectorAll("a.lb-bd-red")].map((a) => a.getAttribute("href")),
        wa: (d.querySelector('a[href*="wa.me"]') || {}).getAttribute
          ? d.querySelector('a[href*="wa.me"]').getAttribute("href")
          : null,
        vacio: !!d.querySelector(".lb-bd-vacio"),
        desc: (d.querySelector(".lb-bd-desc") || {}).textContent || "",
        texto: d.innerText.replace(/\n/g, " | ").slice(0, 120),
      };
    });
    chk(
      dorso.enlaces.length > 0 || dorso.vacio,
      `${tag} · el dorso muestra los datos o avisa que no hay`,
      dorso.texto,
    );
    if (dorso.wa) chk(/^https:\/\/wa\.me\/54\d{8,}$/.test(dorso.wa), `${tag} · el WhatsApp del dorso sale con 54`, dorso.wa);
    chk(
      dorso.enlaces.filter((h) => /instagram/.test(h)).every((h) => /^https:\/\/www\.instagram\.com\/@?[A-Za-z0-9._]+$/.test(h)),
      `${tag} · los links de Instagram están bien armados`,
      dorso.enlaces.join(" "),
    );
    chk(dorso.vacio || dorso.desc.length > 0, `${tag} · muestra la descripción`, dorso.desc.slice(0, 40));

    /* ---------- contraste del dorso ---------- */
    const con = await page.evaluate(({ src }) => {
      const { fondo, __P, __comp, __R, __min } = new Function(src + ";return {fondo,__P,__comp,__R,__min};")();
      const mal = [];
      for (const el of document.querySelectorAll(".lb-barber--abierta .lb-barber-atras *")) {
        const cs = getComputedStyle(el);
        const txt = (el.textContent || "").trim();
        if (!txt || el.children.length) continue;
        const bg = fondo(el);
        const r = __R(__comp(__P(cs.color), bg).slice(0, 3), bg.slice(0, 3));
        const min = __min(cs.fontSize, cs.fontWeight);
        if (r < min) mal.push(`${el.className || el.tagName} "${txt.slice(0, 16)}" ${r.toFixed(2)}<${min}`);
      }
      return mal;
    }, { src });
    chk(con.length === 0, `${tag} · el dorso no tiene texto bajo el mínimo`, con.slice(0, 3).join(" | "));

    chk(jsErr.length === 0, `${tag} · sin errores de JS`, jsErr.join(" | "));
    await page.screenshot({ path: `tests/tmp_shots/flip-${tag.replace("/", "-")}.png` });
    await ctx.close();
  }

  /* ---------- reduced-motion: sin giro, pero el dorso sigue entrando ---------- */
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await page.goto("http://127.0.0.1:8765/index.html", { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".lb-barber", { timeout: 25000 });
    await page.waitForTimeout(3000);
    await page.locator(".lb-barber-giro").first().click();
    await page.waitForTimeout(500);
    const rm = await page.evaluate(() => {
      const c = document.querySelector(".lb-barber--abierta");
      if (!c) return { abierta: false };
      const int = c.querySelector(".lb-barber-int");
      return {
        abierta: true,
        mq: matchMedia("(prefers-reduced-motion: reduce)").matches,
        transform: getComputedStyle(int).transform,
        frente: getComputedStyle(c.querySelector(".lb-barber-frente")).display,
        atras: getComputedStyle(c.querySelector(".lb-barber-atras")).position,
        atrasInert: c.querySelector(".lb-barber-atras").hasAttribute("inert"),
        boton: !!c.querySelector("[data-act='lbReservarBar']"),
      };
    });
    chk(rm.abierta && rm.mq, `reduced-motion · la preferencia se detecta`);
    chk(rm.transform === "none", `reduced-motion · la tarjeta NO gira`, rm.transform);
    chk(rm.frente === "none", `reduced-motion · el frente se saca en vez de quedar al revés`, rm.frente);
    chk(rm.atras === "static", `reduced-motion · el dorso pasa al flujo normal`, rm.atras);
    chk(!rm.atrasInert, `reduced-motion · el dorso sigue siendo accesible`);
    chk(rm.boton, `reduced-motion · y conserva el botón de reservar`);
    await ctx.close();
  }

  await browser.close();
  const fails = out.filter((r) => r[0] === "FAIL");
  console.log(`\n${out.length - fails.length}/${out.length} OK · fallaron ${fails.length}`);
  process.exit(fails.length ? 1 : 0);
})().catch((e) => {
  console.log("  CRASH " + String(e).split("\n")[0]);
  process.exit(1);
});
