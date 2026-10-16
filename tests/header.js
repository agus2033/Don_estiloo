/* Captura los TRES paneles (cliente, dueño, barbero) con el header nuevo, en
   celular y en escritorio, y mide el orden de la fila derecha.

   El orden es lo que pidió el dueño: casita, toggle, foto. Y la barra de
   celular tiene que mostrar 3 secciones más el botón de tres rayitas en el
   dueño, y todas en el barbero y el cliente.

   node tests\header.js
*/
const { chromium } = require("../.opencode/skills/playwright-skill/node_modules/playwright/index.js");
const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "..", "tmp_shots", "header");

let fallos = 0;
const ok = (c, m, d) => {
  console.log((c ? "  OK    " : "  FALLA ") + m);
  if (!c) {
    fallos++;
    if (d) console.log("          " + d);
  }
};

/* ---------- 1. Lo que se puede comprobar sin cuenta ----------

   Las cuentas de cliente y barbero ya no autentican (el dueño las borró al
   limpiar la base), así que sus paneles no se pueden abrir en el navegador y
   abajo salen como SKIP. Lo que SÍ se puede fijar es la estructura: que la
   rama del cliente siga armando las 4 secciones sin bandeja, que el dueño
   siga con 3, y qué items lleva el menú de la foto según el rol. Si alguien
   toca esos bloques, esto se avisa aunque no haya con quién probarlo. */
{
  const src = fs.readFileSync(path.join(__dirname, "..", "src", "main.js"), "utf8");
  console.log("=== estructura (sin navegador) ===");

  const secCli = src.match(/const SEC_CLI = \[([\s\S]*?)\];/);
  const nCli = secCli ? (secCli[1].match(/\["/g) || []).length : 0;
  ok(nCli === 4, "el cliente tiene 4 secciones", String(nCli));

  /* Ojo: `CUANTAS` no es un `const CUANTAS =`, es una pieza del `const` encadenado
     que arma `sec`. Un regex con "const CUANTAS =" no encuentra nada y la guarda
     pasa por verde sin comprobar nada. */
  ok(/\bCUANTAS = own \? 3 : sec\.length/.test(src), "el dueño muestra 3 secciones en la barra");
  ok(/claseNav = hayBandeja \? "nav-mas3" : "nav-todo"/.test(src), "la clase de la barra depende de si hay bandeja");
  ok(/claseNav = "nav-todo";/.test(src), "el cliente marca la barra como nav-todo (sin bandeja)");

  /* El menú de la foto. Antes "Editar perfil" salía con `if (!isOwner())`: el
     dueño NO lo tenía, y era el único que no podía tener ficha pública de barbero
     (foto, oficio, descripción). El dueño lo pidió —él es el barbero— así que
     ahora lo tiene, y además un botón para colocarse como tal. El barbero que no
     es dueño lo sigue teniendo. */
  const mp = src.match(/function menuPerfil\(\) \{([\s\S]*?)\n\}/);
  ok(!!mp, "menuPerfil existe a nivel de módulo (no dentro del try)");
  ok(
    !!mp && !/\n\s{2}function menuPerfil/.test(src),
    "menuPerfil no quedó dentro de R(): dentro del try sería block-scoped",
  );
  if (mp) {
    ok(
      /if \(isOwner\(\)\) \{[\s\S]{0,300}data-act="miPerfilWeb"/.test(mp[1]),
      'el dueño SÍ ve "Editar perfil" (su ficha pública de barbero)',
    );
    ok(
      /\}\s*else\s+items\.push\([\s\S]{0,160}miPerfilWeb/.test(mp[1]),
      "y el barbero que no es dueño lo tiene en la otra rama",
    );
    ok(
      /data-act="soyBarbero"/.test(mp[1]),
      "el dueño tiene además el botón de colocarse como barbero",
    );
    ok(/data-act="fotoTomar">Cambiar foto/.test(mp[1]), 'el menú tiene "Cambiar foto"');
    ok(/data-act="salir">Cerrar sesi/.test(mp[1]), 'el menú tiene "Cerrar sesión"');
    ok(/isAdm\(\)/.test(mp[1]), "el item Editar perfil distingue barbero de cliente");
  }

  /* La bandeja y el menú de la foto son dos elementos distintos. */
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  ok(!/id="lo"/.test(html), "ya no existe el botón suelto #lo en el HTML");
  ok(!/id="hamb"/.test(html), "no hay ningún control #hamb");
  const orden = [...html.matchAll(/id="(web|thm|mebadge)"/g)].map((x) => x[1]);
  ok(
    orden.join(",") === "web,thm,mebadge",
    "el HTML pone casita, toggle y foto en ese orden",
    orden.join(" -> "),
  );
  console.log("");
}

const env = {};
fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8")
  .split(/\r?\n/)
  .forEach((l) => {
    const i = l.indexOf("=");
    if (i < 1 || l.trim().startsWith("#")) return;
    const k = l.slice(0, i).trim();
    if (env[k]) return;
    env[k] = l.slice(i + 1).trim();
  });

/* Se mide sin necesidad de entrar: alcanza con falsear la sesión es complicado,
   así que se entra con la cuenta que haya y se mide sobre eso. */
const entrar = async (page, email, pass) => {
  await page.goto("http://127.0.0.1:8765/index.html", { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".lb-wcard", { timeout: 30000 });
  await page.waitForTimeout(1200);
  const vis = page.locator('[data-act="goLogin"]:visible');
  if (await vis.count()) await vis.first().click();
  else await page.evaluate(() => { location.hash = "#login"; });
  await page.waitForSelector("#ie", { timeout: 20000 });
  await page.fill("#ie", email);
  await page.fill("#ip", pass);
  await page.click('[data-act="entrar"]');
  await page.waitForTimeout(13000);
  return page.evaluate(() => (window.__test ? window.__test.uid : null));
};

(async () => {
  fs.mkdirSync(DIR, { recursive: true });
  const b = await chromium.launch();

  const ROLES = [
    { etq: "dueño", email: env.DUENO_EMAIL, pass: env.DUENO_PASSWORD },
    { etq: "barbero", email: env.BARBERO_EMAIL, pass: env.BARBERO_PASSWORD },
  ];

  for (const rol of ROLES) {
    for (const p of [
      { n: "390", w: 390, h: 844 },
      { n: "1280", w: 1280, h: 900 },
    ]) {
      console.log(`\n=== ${rol.etq} · ${p.n}px ===`);
      const ctx = await b.newContext({
        viewport: { width: p.w, height: p.h },
        isMobile: p.n === "390",
        hasTouch: p.n === "390",
      });
      const page = await ctx.newPage();
      const uid = await entrar(page, rol.email, rol.pass);
      if (!uid) {
        console.log("  SKIP  no entró la cuenta de " + rol.etq);
        await ctx.close();
        continue;
      }

      const m = await page.evaluate(() => {
        const q = (s) => document.querySelector(s);
        const caja = (s) => {
          const e = q(s);
          return e && e.offsetParent !== null ? e.getBoundingClientRect() : null;
        };
        const nav = q("#nav");
        const botones = [...nav.querySelectorAll("button")];
        /* OJO: no se puede usar `offsetParent` para contar visibles. La barra
           de celular es `position: fixed`, y en un elemento con posicionamiento
           fijo `offsetParent` devuelve null aunque esté dibujado: el primer
           conteo dio 0 secciones visibles en una barra con 4. */
        const visibles = botones.filter((x) => {
          const r = x.getBoundingClientRect();
          return r.height > 0 && r.width > 0;
        });
        const hd = document.querySelector("header .hd");
        return {
          orden: ["#web", "#thm", "#mebadge"]
            .map((s) => {
              const e = q(s);
              return { s, x: e ? Math.round(e.getBoundingClientRect().left) : null };
            })
            .filter((x) => x.x !== null),
          hayWeb: !!caja("#web"),
          hayThm: !!caja("#thm"),
          hayFoto: !!caja("#mebadge"),
          hayCerrarSuelto: !!q("#lo"),
          navClase: nav.className,
          seccionesVisibles: visibles.filter((x) => !x.classList.contains("nav-mas")).length,
          hayMas: visibles.some((x) => x.classList.contains("nav-mas")),
          hdDesborde: hd ? Math.round(hd.scrollWidth) > Math.round(hd.clientWidth) : null,
        };
      });

      const ordenOk =
        m.orden.length === 3 && m.orden[0].s === "#web" && m.orden[1].s === "#thm" && m.orden[2].s === "#mebadge" &&
        m.orden[0].x < m.orden[1].x && m.orden[1].x < m.orden[2].x;
      ok(ordenOk, "el orden es casita - toggle - foto", JSON.stringify(m.orden));
      ok(m.hayWeb && m.hayThm && m.hayFoto, "están los tres");
      ok(!m.hayCerrarSuelto, "ya no está el botón suelto de Cerrar sesión");
      ok(!m.hdDesborde, "el header no desborda");

      if (p.n === "390") {
        if (rol.etq === "dueño") {
          ok(m.navClase === "nav-mas3", "la barra del dueño marca 3 + bandeja", m.navClase);
          ok(m.seccionesVisibles === 3, "se ven 3 secciones", String(m.seccionesVisibles));
          ok(m.hayMas, "el botón de tres rayitas está");
          /* Y la bandeja tiene que abrir con las otras 4. */
          await page.locator(".nav-mas").click();
          await page.waitForTimeout(600);
          const b2 = await page.evaluate(() => {
            const n = document.getElementById("nmenu");
            return {
              abierta: n && !n.hidden,
              items: n ? [...n.querySelectorAll("button")].map((x) => x.textContent.trim()) : [],
            };
          });
          ok(b2.abierta, "la bandeja abre");
          ok(
            b2.items.join(",") === "Barberos,Finanzas,Ajustes,Galería,Mensajes",
            "la bandeja tiene las 5 que sobran",
            b2.items.join(", "),
          );
          await page.screenshot({ path: path.join(DIR, `dueño-390-bandeja.png`) });
        } else {
          ok(m.navClase === "nav-todo", "la barra del barbero muestra todas", m.navClase);
          ok(m.seccionesVisibles === 4, "se ven 4 secciones", String(m.seccionesVisibles));
          ok(!m.hayMas, "el barbero NO tiene botón de tres rayitas");
        }
      }

      /* El popup cancelado NO debe abrir ningún cartel.
       El dueño lo vio en producción con el texto "Se abrió una ventana antes de
       terminar la anterior... (auth/cancelled-popup-request)". Se comprueba
      Se llama a err() a mano con ese código y mirando si aparece el modal: es la
       misma función que dispara el catch del login, así que lo que se mide acá
       es exactamente lo que se veía en pantalla. */
    const cancelado = await page.evaluate(() => {
      window.__test.err({ code: "auth/cancelled-popup-request", message: "Firebase: Error (auth/cancelled-popup-request)." });
      window.__test.err({ code: "auth/user-cancelled", message: "Firebase: Error (auth/user-cancelled)." });
      window.__test.err({ code: "auth/popup-closed-by-user", message: "Firebase: Error (auth/popup-closed-by-user)." });
      return new Promise((r) =>
        setTimeout(() => {
          const m = document.querySelector("#mo");
          const v = m && !m.hidden ? (m.innerText || "").replace(/\s+/g, " ").slice(0, 200) : null;
          r(v);
        }, 900),
      );
    });
    ok(!cancelado, "el popup cancelado no abre ningún cartel", String(cancelado));

    /* Y un error de VERDAD sí tiene que avisar, o si no el cartel quedó inútil. */
    const real = await page.evaluate(() => {
      window.__test.err({ code: "auth/wrong-password", message: "Firebase: Error (auth/wrong-password)." });
      return new Promise((r) =>
        setTimeout(() => {
          const m = document.querySelector("#mo");
          r(m && !m.hidden ? (m.innerText || "").replace(/\s+/g, " ").slice(0, 200) : null);
        }, 900),
      );
    });
    ok(!!real, "un error que SÍ es error abre cartel igual", String(real));
    /* Este cartel queda abierto y #mo se lleva los clics, así que hay que
       cerrarlo antes de seguir probando. */
    await page.locator("#mok").click();
    await page.waitForTimeout(500);

    /* El menú de la foto, en todos los casos. */
      await page.locator("#mebadge").click();
      await page.waitForTimeout(600);
      const pm = await page.evaluate(() => {
        const n = document.getElementById("pmenu");
        return n && !n.hidden ? [...n.querySelectorAll("button")].map((x) => x.textContent.trim()) : [];
      });
      ok(pm.length >= 2, "el menú de la foto abre con contenido", JSON.stringify(pm));
      ok(
        pm.indexOf("Cambiar foto") >= 0 && pm.indexOf("Cerrar sesión") >= 0,
        "tiene Cambiar foto y Cerrar sesión",
        JSON.stringify(pm),
      );
      /* Los tres roles lo tienen. El dueño también: es el barbero (lote 37), y
         si no lo tuviera no podría cargar su foto, que es justo lo que pidió. */
      ok(pm.indexOf("Editar perfil") >= 0, "tiene Editar perfil", JSON.stringify(pm));
      if (rol.etq === "dueño")
        ok(
          pm.indexOf("Yo también soy el barbero") >= 0 || pm.indexOf("Ya soy el barbero") >= 0,
          "y además el botón de colocarse como barbero",
          JSON.stringify(pm),
        );

      await page.screenshot({ path: path.join(DIR, `${rol.etq}-${p.n}-menu.png`) });
      await page.keyboard.press("Escape");
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(DIR, `${rol.etq}-${p.n}.png`) });
      console.log("  capturas en " + path.relative(path.join(__dirname, ".."), DIR));

      await ctx.close();
    }
  }

  await b.close();
  console.log(fallos ? `\nFALLARON ${fallos}` : "\nTODO VERDE");
  process.exit(fallos ? 1 : 0);
})();