# AUDITORIA.md — Codigo Barber

**Fecha:** 2026-10-11 · **Alcance:** sitio completo (landing, asistente de reserva, login/registro, panel del dueño y del barbero), reglas de Firestore, cabeceras de publicación, despliegue y pruebas.

**Cómo se verificó:** todo lo que está marcado *confirmado* se comprobó leyendo el código y, en los casos de seguridad, **explotándolo con una prueba automática** que primero falló y después pasó. Lo que no se pudo ejecutar en el entorno local está marcado como *no reproducido*, no como "correcto".

**Servidor local:** `python -m http.server 8765`. **Servidor con CSP de producción:** `node tests/srv.js 8766`.

---

## 1. Cómo estaba el proyecto

| Dato | Valor medido |
|---|---|
| Archivos de código | `index.html`, `sw.js` + 6 módulos en `src/` |
| Peso del código | 466 KB sin comprimir (`main.js` solo: 288 KB) |
| Base de datos | Firestore (9 colecciones) + Auth (Google, Facebook, email) |
| Build | **ninguno**: HTML/CSS/JS servido tal cual |
| Dependencias | Bootstrap 5.3 por CDN, Google Fonts, Google Maps embed, Firebase 10.14.1 por CDN |
| Pruebas | 20 archivos, sin comando único para correrlas |
| Lighthouse | no se corrió: no hay Chrome con Lighthouse instalado y no se instaló nada sin autorización |

**Lo que está bien y hay que conservar:** el horario es una sola fuente de verdad (`CFB()`), la ficha del barbero ya usa `nomBar()`, el loader tiene su prueba, el modo claro existe y contrasta, y el asistente de reserva tiene 48 comprobaciones de accesibilidad.

---

## 2. Hallazgos de seguridad

### CRÍTICA

#### C-1 · Un barbero podía reescribir la configuración financiera del dueño — **CORREGIDO**

`FIRESTORE_RULES.txt:38`

```rules
allow write: if isBarberoOrOwner();
```

El `match /config/{docId}` era genérico, así que esa línea alcanzaba también a `config/finanzas`. `isBarberoOrOwner()` es dueño **o cualquier documento en `staff/`**. La UI nunca le ofrece nada de eso, pero las reglas son las que deciden.

**Explotación:** un barbero con su cuenta abría la consola del navegador y ejecutaba:

```js
await setDoc(doc(db, "config", "finanzas"), { pd: 100, bs: [/* su uid, pd: 0 */] });
```

y a partir de ahí se quedaba con el 100% de cada corte. También podía vaciar `config/horario` (barbería cerrada), inflar `config/reglas` o borrar la lista pública del equipo.

**Causa raíz:** la restricción estaba sólo en el `read`, no en el `write`, y el `match` no separaba documentos.

**Arreglo:** `allow write: if isOwner();` más una regla aparte y estrecha para `config/barberos`, que es lo único que el barbero necesita escribir (su propia ficha del array `l`).

**Verificación:** con el mismo SDK, un anónimo ya recibe `permission-denied` en `config/finanzas`. La comprobación de que un barbero ya no puede escribir `finanzas` **no se pudo ejecutar**: requiere el emulador de Firestore o el Rules Playground, y no se instaló ninguno.

> **ACCIÓN DEL DUEÑO — obligatoria:** las reglas del archivo NO están en producción hasta que se peguen en *Firebase Console → Firestore → Reglas*. Hasta entonces el sitio sigue con las reglas viejas.

---

### ALTA

#### A-1 · XSS almacenado: un cliente inyectaba HTML en el panel del dueño — **CORREGIDO**

`src/main.js` — 7 lugares renderizaban `${t.t}` sin escapar, más 5 con `${fd(t.d)}`.

`turnos` es una colección donde **cualquiera con una cuenta puede crear documentos**, y las reglas no validaban ningún campo. La hora del turno llegaba cruda al `innerHTML` de la Agenda.

**Explotación (hecha, con `tests/xss.js`):**

```js
{ uid: "cliente-xss", d: "2026-10-12", t: '<img src=y onerror="window.__pwn=1">', ... }
```

Resultado medido antes del arreglo:

```
FALLA la Agenda no inyecta HTML desde los campos del turno
       pwn=1 imgs=1 htmlCrudo=true
```

`window.__pwn = 1` significa que el `<img onerror>` **ejecutó código en la sesión del dueño**. Desde ahí, el atacante puede pedir el token de Firebase de esa sesión (`getIdToken()`) y leer o escribir `config/finanzas`.

**Después del arreglo:** `pwn=0`, `imgs=0`, y el payload queda como texto literal (`&lt;img`).

**Causa raíz:** `esc()` se aplicaba a casi todos los campos del turno pero no a la hora ni a la fecha.

**Arreglo:** `esc()` en los 12 sitios, más el formato de la hora forzado en las reglas (`t.matches('^[0-2][0-9]:[0-5][0-9]$')`), que cierra la vía aunque alguien vuelva a olvidarse de escapar.

#### A-2 · `$$()` devolvía texto sin transformar: XSS por el precio — **CORREGIDO**

`src/main.js:128`

```js
const $$ = (n) => "$" + n.toLocaleString("es-AR");
```

`Number.prototype.toLocaleString()` devuelve un número, pero **`String.prototype.toLocaleString()` devuelve la cadena tal cual**. Como `precio` es un campo libre del turno, un cliente podía escribir un precio con HTML y se dibujaba crudo en el Dashboard del dueño y en el historial de clientes.

Además permitía **falsificar la contabilidad**: el cliente marcaba su turno como `hecho` con `precio: 999999` y ese número entraba en los ingresos del Dashboard.

**Arreglo:** `$$` convierte a número y devuelve `$0` si no sale algo numérico. Y `turnos.update` ahora no deja que un cliente toque `precio`, `hechoEn`, `pd` ni `bid`.

#### A-3 · Un barbero podía dejarse el 100% de sus cortes — **CORREGIDO**

`FIRESTORE_RULES.txt:136`

`pd` (el porcentaje del dueño) estaba en la lista de campos que el barbero puede editar en su **propia** ficha de `staff`. Con `updateDoc(doc(db,"staff",miUid), { pd: 0 })`, todos sus cobros posteriores guardaban `pd: 0`.

**Arreglo:** `pd` sale de la lista; sólo el dueño lo cambia, desde Finanzas.

#### A-4 · Un cliente podía editar cualquier campo de su turno, incluso borrarlo — **CORREGIDO**

`FIRESTORE_RULES.txt:155`

```rules
allow update, delete: if isBarberoOrOwner() || (isSignedIn() && resource.data.uid == request.auth.uid);
```

Sin mirar qué campos cambian ni en qué estado estaba. Podía: marcarse el turno como `hecho`, cambiar el precio de un turno ya cobrado, o **borrar un turno ya cobrado y con él la evidencia de la venta**.

**Arreglo:** el cliente sólo puede pasar su turno de `pend` a `pend` o `cancel`, y sólo sobre los campos que de verdad toca. El borrado queda para quien administra.

---

### MEDIA — pendientes

| # | Hallazgo | Estado |
|---|---|---|
| M-1 | `ocupados.create` no valida `bid`: un cliente puede ocupar horarios de **cualquier** barbero | pendiente (arreglo real: Cloud Function) |
| M-2 | `canjes.create` no descuenta puntos: un canje gratis, sin backend no se cierra del todo | pendiente (Cloud Function) |
| M-3 | `ocupados` y `resenas` se leen sin sesión (`allow read: if true`): expone el **uid** de cada cliente con su fecha y hora | pendiente |
| M-4 | `ventas` y `gastos` los escribía cualquier barbero, no sólo los suyos | **CORREGIDO** |
| M-5 | `config/finanzas` lo leía cualquier cuenta registrada | **CORREGIDO** (ahora hace falta ser del equipo) |
| M-6 | `mensajes` público y sin límite: se puede llenar la bandeja del dueño | pendiente (App Check) |
| M-7 | `ptsRegistro > 20` rompía en silencio el alta de cuenta | **CORREGIDO** |
| M-8 | `resenas` sin límite por usuario: se pueden inflar las reseñas | pendiente (riesgo aceptado) |

### BAJA — corregidos

| # | Hallazgo | Arreglo |
|---|---|---|
| B-1 | Las redes del barbero aceptaban `javascript:` en el `href`: XSS al hacer clic, en la web pública | `urlSegura()`, que sólo acepta `http(s)` |
| B-2 | Sin CSP ni cabeceras de seguridad | `vercel.json` (ver §4) |
| B-3 | `ult.estrellas` sin escapar | `esc()` |
| B-4 | La subida de archivos no validaba tipo ni tamaño, y subía crudo lo que el navegador no podía decodificar | Filtro de tipo/tamaño en `subirFoto`; rechazo en vez de fallback |

### Lo que se revisó y **no** tiene problema

- No hay secretos en el frontend. La `apiKey` de Firebase es pública por diseño; lo que la protege son las reglas y App Check.
- Los 14 `target="_blank"` llevan `rel="noopener"`.
- No hay open redirect: el ruteo es por hash contra una lista blanca.
- `localStorage` sólo guarda el tema.
- El rol sale siempre de Firestore (`staff/{uid}`), nunca del cliente.
- Sin `eval`, `new Function`, `document.write` ni `innerHTML` con datos externos sin escapar.
- Los `data-args` van con `esc(JSON.stringify(...))`, que impide romper el atributo.

---

## 3. Rendimiento

Medido con `tests/perf.js` (Chrome, 390×844, `deviceScaleFactor: 2`), no con Lighthouse.

| Métrica | Antes | Después |
|---|---|---|
| FCP | 272 ms | **128 ms** |
| LCP | 1224 ms | 1488–1772 ms |
| CLS | 0 | **0** |
| `load` | 1525 ms | **208–243 ms** |
| Peso de terceros | 677 KB (5 peticiones) | 677 KB (5 peticiones) |
| Peticiones al mapa en la carga | 0–3 (según umbral del navegador) | **0, garantizado** |

**Lo que se encontró:**

- **2,5 MB de assets sin usar**: `logo.png` (1,6 MB), `instagram.png` (702 KB) y `whatsapp.png` (223 KB) sólo aparecían en comentarios de código y en una regla CSS muerta. Movidos a `fuentes/`: no se borran, pero dejan de publicarse. Ganancia: **2,5 MB menos por deploy**.
- **`tmp_pdf/` con 76 MB** de `node_modules` de un PDF, que se subían en cada deploy.
- **`FIRESTORE_RULES.txt` publicado en la raíz**: cualquiera podía leer el modelo de seguridad y el UID del dueño. Sólo estaba excluido por `robots.txt`, que no es un control de acceso.

**Sobre el mapa:** el primer cálculo dio 360 KB desperdiciados, pero **al repetirlo no se reprodujo**. Con `loading="lazy"` el navegador ya lo difería en localhost, y el umbral depende de la velocidad de conexión. Lo que sí queda garantizado con el `IntersectionObserver` es que **el mapa no se pide hasta que su bloque está a 300 px de la pantalla**, en cualquier conexión. El ahorro medido en localhost es 0 KB; el valor es que deja de depender del navegador.

**Lo que NO se hizo, y por qué:** `main.js` pesa 288 KB sin minificar. Minificarlo o dividirlo en módulos exigiría un paso de build, y el proyecto no tiene ninguno. Es el mayor pendiente de rendimiento y está documentado, no resuelto.

---

## 4. Cabeceras de seguridad

Agregadas en `vercel.json`, **verificadas corriendo la web con ellas** (`tests/srv.js` + `tests/csp.js`).

```
Content-Security-Policy: default-src 'self'; base-uri 'self'; object-src 'none';
  frame-ancestors 'none'; img-src 'self' data: blob: https://res.cloudinary.com …;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com data:;
  script-src 'self' https://www.gstatic.com https://identitytoolkit.googleapis.com …;
  connect-src 'self' https://firestore.googleapis.com … ;
  frame-src https://www.google.com https://maps.google.com; form-action 'self';
  upgrade-insecure-requests
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), camera=(), microphone=()
```

**Este proceso encontró un bug que habría roto producción.** Con la CSP puesta, la web perdía las tipografías de Google y los tres módulos de Firebase:

```
Refused to apply style from 'https://fonts.googleapis.com/css2?family=Barlow…'
Failed to load module script: Expected a JavaScript-or-Wasm module script but the
  server responded with a MIME type of 'text/html'
```

**Causa:** el service worker intercepta esos tres hosts y los reintenta con `fetch()` desde el worker; esa llamada se mide contra `connect-src`, que no los incluía. Al fallar, el fallback del worker devolvía `index.html` — con `Content-Type: text/html` — en lugar de la fuente o el módulo.

**Dos arreglos:**
1. Los tres hosts de `OK` (sw.js) están ahora también en `connect-src`.
2. El fallback del service worker devuelve `index.html` **sólo para navegaciones**. Antes lo devolvía para cualquier recurso que fallara, que es lo que convertía un error de red en un error de tipo MIME imposible de diagnosticar.

**Por qué `style-src` lleva `'unsafe-inline'`:** la app arma el HTML con **220 atributos `style="…"`**. Sin esa palabra el navegador los descarta todos en silencio y la web queda sin formato. No es la decisión más restrictingiva posible, pero es la que funciona con este código; endurecerlo requiere primero sacar esos estilos inline a clases.

**HSTS:** Vercel lo manda solo en los dominios con HTTPS. No se agregó a mano para no pisarlo.

---

## 5. Diseño, accesibilidad y responsive

Medido con `tests/visual.js` en 4 anchos (390 / 768 / 1280 / 1600) × 2 temas.

| Defecto | Severidad | Estado |
|---|---|---|
| `.lb-map-btn` con 35 px de alto: difícil de acertar con el dedo, y es el botón que abre Google Maps | media | **CORREGIDO** (44 px) |
| `.lb-brand` con 42 px de alto | baja | **CORREGIDO** (44 px) |
| Cinco etiquetas a 11,5–11,8 px (`oficio`, "Atiende", "Servicios", "Dónde estamos", "Cerrado") | baja | **CORREGIDO** (12 px) |

**Lo que ya estaba bien y quedó igual:** sin scroll horizontal en ningún ancho, la barra fija de "Reservar ahora" no tapa el último texto, CLS = 0, el contraste pasa en los dos temas (25 comprobaciones) y la ficha del barbero pasa 147 comprobaciones.

**No se corrió un escáner automático de accesibilidad.** Los controles son propios y cubren contraste, foco, etiquetas y flujo con teclado. Eso **no equivale a conformidad WCAG 2.2 AA**: falta una revisión con lector de pantalla real y con personas.

---

## 6. Estructura y mantenibilidad

| Hallazgo | Impacto | Estado |
|---|---|---|
| `src/main.js` tiene 6.400 líneas en un solo archivo | Alto: cualquier cambio obliga a leer todo el archivo | **documentado, no resuelto** |
| 19 pruebas sin comando para correrlas | Medio | **CORREGIDO** (`node tests/run.js`) |
| `tests/_video.js`, `perf.cmp.js`, etc. leen salidas que PowerShell escribe en UTF-16 | Bajo | **CORREGIDO** |
| Varias pruebas muerden por handles de Playwright desvinculados | Medio: errores que no dicen nada del código | **CORREGIDO** en 3 archivos |
| Reglas de Firestore duplicadas a mano entre el archivo y la consola | **Alto**: el archivo puede no ser lo que está en producción | **documentado** — ver la acción del dueño en C-1 |

---

## 7. Lo que sigue pendiente, por prioridad

1. **Pegar las reglas nuevas en Firebase Console.** Sin esto, los arreglos C-1, A-3, A-4 y M-4/M-5 no están en producción. Es lo más importante de esta lista.
2. **Probar las reglas en el Rules Playground** con un usuario de `staff`: no puede escribir `config/finanzas` ni `staff/{uid}.pd`, y sí puede guardar su perfil en `config/barberos`.
3. **Activar App Check** y poner una reCAPTCHA v3 real (`RECAPTCHA_KEY` está vacío).
4. **Cerrar `ocupados.create`** (M-1) y el descuento de puntos de los canjes (M-2): los dos necesitan Cloud Function; no se pueden resolver con reglas.
5. **Revisar `ocupados` y `resenas`** (M-3): hoy se leen sin sesión y exponen el uid de cada cliente.
6. **Decidir qué hacer con `main.js`.** 6.400 líneas es un límite real de velocidad para cualquier otro que quiera tocar el archivo.
7. **Auditoría de accesibilidad con lector de pantalla**, no sólo con mediciones.

---

## 8. Skills consultadas

| Skill | Uso real |
|---|---|
| `security-review` (subagente `security-reviewer`) | Auditoría completa de XSS, reglas, Auth y configuración. Sus hallazgos se verificaron uno por uno antes de corregir nada. |
| `playwright-skill` | Motor de las 25 pruebas: medición, capturas y cargas reales con Chrome del sistema. |
| `css.muerto.js` (propia) | Detectó la regla CSS que quedó sin coincidencia al mover `logo.png`. |

**No se instaló nada.** Las skills que hacen falta para este proyecto (diseño, seguridad, rendimiento, pruebas, accesibilidad) ya están disponibles en el entorno; instalar paquetes de terceros habría agregado riesgo sin agregar capacidad.

Fuentes consultadas para la parte de skills: repositorio local de skills del proyecto, `skills-lock.json` y el catálogo de skills disponible en la sesión.