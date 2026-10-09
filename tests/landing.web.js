const path=require("path");
const fs=require("fs");
const { chromium } = require("../.opencode/skills/playwright-skill/node_modules/playwright");

/* Verifica el camino de ida y vuelta entre el panel y la landing:
     1. el login muestra el logo real y tiene botón para volver a la web,
     2. el panel tiene "Ver la web" y no obliga a cerrar sesión,
     3. viendo la web se avisa arriba y se puede volver al panel,
     4. no quedan dos headers apilados,
     5. con sesión el botón dice "Mi panel", no "Ingresar",
     6. "Reservar ahora" desde la web lleva al panel y no se queda trabado.

   Corre para cliente y dueño. Uso: python -m http.server 8765
*/
function env(){const o={};fs.readFileSync(path.join(__dirname,"..",".env.local"),"utf8").split(/\r?\n/).forEach(l=>{const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);if(m)o[m[1]]=m[2];});return o;}
(async () => {
  const E=env(); let fail=0;
  const ck=(o,t,x)=>{if(!o)fail++;console.log((o?"  OK   ":"  FALLA")+" "+t+(x?"  -> "+x:""));};
  const b=await chromium.launch();
  for (const rol of ["cliente","dueno"]) {
    console.log("\n===== "+rol.toUpperCase()+" =====");
    const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2});
    const p=await ctx.newPage();
    const errs=[]; p.on("pageerror",e=>errs.push(e.message));
    await p.goto("http://127.0.0.1:8765/index.html",{waitUntil:"domcontentloaded"});
    await p.waitForSelector(".lb-wcard"); await p.waitForTimeout(1400);
    await p.evaluate(()=>{location.hash="#login";});
    await p.waitForSelector("#ie"); await p.waitForTimeout(400);
    // logo del login
    const sello=await p.evaluate(()=>{const i=document.querySelector(".sello img");
      return i?{src:i.getAttribute("src").split("/").pop(),w:i.naturalWidth,r:getComputedStyle(i).borderTopLeftRadius}:null;});
    ck(!!sello,"el login muestra el logo real",sello?sello.src+" "+sello.w+"px "+sello.r:"falta");
    // boton volver a la web
    const vol=await p.evaluate(()=>{const v=document.querySelector('[data-act="backLanding"]');
      return v?{t:v.textContent.trim(),vis:!!v.offsetParent}:null;});
    ck(vol&&vol.vis,"el login tiene botón para volver a la web",vol?vol.t:"falta");
    await p.click('[data-act="backLanding"]'); await p.waitForTimeout(900);
    ck(await p.isVisible(".lb-hd"),"vuelve a la landing",null);
    // entrar
    await p.evaluate(()=>{location.hash="#login";});
    await p.waitForSelector("#ie",{timeout:8000});
    await p.fill("#ie", rol==="dueno"?E.DUENO_EMAIL:E.CLIENTE_EMAIL);
    await p.fill("#ip", rol==="dueno"?E.DUENO_PASSWORD:E.CLIENTE_PASSWORD);
    await p.click('[data-act="entrar"]'); await p.waitForTimeout(5000);
    ck(await p.evaluate(()=>{const h=document.querySelector("body > header");
      return !!h&&getComputedStyle(h).display!=="none";}),"entra y aparece el header de la app");
    const wb=await p.evaluate(()=>{const v=document.querySelector("#web");
      return v?{vis:!v.hidden&&!!v.offsetParent,t:v.textContent.trim()}:null;});
    ck(wb&&wb.vis,"el panel tiene el botón 'Ver la web'",wb?wb.t:"falta");
    // ir a la web
    await p.click("#web"); await p.waitForTimeout(1600);
    const enWeb=await p.evaluate(()=>({
      landing:!!document.querySelector(".lb-hd"),
      barra:!!document.querySelector(".lb-volver"),
      barraTxt:(document.querySelector(".lb-volver")?.textContent||"").trim(),
      hdApp:(()=>{const h=document.querySelector("body > header");
        return h?getComputedStyle(h).display:"-";})(),
      miPanel:[...document.querySelectorAll('.lb-ing')].map(x=>x.textContent.trim()),
      hash:location.hash,
    }));
    ck(enWeb.landing,"muestra la landing con sesión abierta");
    ck(enWeb.barra,"avisa arriba que estás mirando la web",enWeb.barraTxt);
    ck(enWeb.hdApp==="none","el header de la app se esconde (no hay dos headers)");
    ck(enWeb.miPanel.some(t=>/mi panel/i.test(t)),"el botón dice 'Mi panel', no 'Ingresar'",enWeb.miPanel.join("|"));
    await p.screenshot({path:path.join(__dirname,"..","tmp_shots","WEB-"+rol+".png"),fullPage:false});
    // volver al panel
    await p.click(".lb-volver button"); await p.waitForTimeout(1400);
    const deVuelta=await p.evaluate(()=>({
      landing:!!document.querySelector(".lb-hd"),
      panel:!!document.querySelector("#nav button[data-act='go']"),
      hdApp:(()=>{const h=document.querySelector("body > header");
        return h?getComputedStyle(h).display:"-";})(),
      nav:[...document.querySelectorAll("#nav button[data-act='go']")].length,
    }));
    ck(!deVuelta.landing,"ya no muestra la landing");
    ck(deVuelta.hdApp!=="none","vuelve el header de la app");
    ck(deVuelta.panel,"vuelve al panel con su nav",deVuelta.nav+" botones");
    // CTA Reservar ahora desde la landing con sesion
    await p.locator("#web").click(); await p.waitForTimeout(1200);
    await p.locator('[data-act="lbReservar"]:visible').first().click(); await p.waitForTimeout(1800);
    const res=await p.evaluate(()=>({
      landing:!!document.querySelector(".lb-hd"),
      hash:location.hash, wiz:!!document.querySelector("#wiz"),
    }));
    ck(!res.landing && res.hash==="#/reservar","'Reservar ahora' desde la web lleva al panel",res.hash);
    ck(errs.length===0,"sin errores JS",errs[0]?errs[0].slice(0,90):"");
    await ctx.close();
  }
  await b.close();
  console.log("\n=== "+(fail?fail+" FALLAS":"todo OK")+" ===");
  process.exit(fail?1:0);
})();
