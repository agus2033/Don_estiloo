# CAMBIOS_REALIZADOS.md — 2026-10-11

Todo lo que se tocó en esta sesión, con el motivo y la prueba que lo respalda. Lo que no se cambió también está, con el motivo.

Punto de recuperación previo: commit `3ed5cc0` ("11 commit"). Si algo sale mal, `git reset --hard 3ed5cc0` deja el proyecto como estaba antes de esta auditoría.

---

## Archivos modificados

### `src/main.js` — seguridad, validaciones y rendimiento

| Cambio | Motivo | Prueba |
|---|---|---|
| `esc()` en los 7 `${t.t}` y los 5 `${fd(t.d)}` | XSS almacenado confirmado: la hora y la fecha del turno se dibujaban crudas en el panel del dueño | `tests/xss.js` (fallaba con `pwn=1`, ahora `pwn=0`) |
| `$$()` convierte a número y devuelve `$0` si no es numérico | `String.prototype.toLocaleString()` devuelve la cadena sin tocar: un `precio` con HTML pasaba entero al Dashboard | `tests/xss.js` |
| `urlSegura()` para las redes del barbero | `esc()` no alcanza en un `href`: `javascript:…` no tiene comillas que escapar y se ejecuta al hacer clic | `tests/xss.js` |
| `esc()` en `ult.estrellas` | Va dentro de un `aria-label`, sin escapar | revisión manual |
| `subirFoto()` filtra por tipo y por tamaño (12 MB) | `accept="image/*"` es una sugerencia, no una validación | revisión manual |
| El archivo que el navegador no puede decodificar **se rechaza** en vez de subirse crudo | Un PDF renombrado a `.jpg` llegaba entero a Cloudinary | revisión manual |
| `PTSRv` acotado a 0–20, con aviso al guardar | Las reglas piden `pt <= 20`; con 25 el alta de cuenta quedaba colgada en "Cargando tu cuenta…" sin error | `tests/landing.registro` |
| `lbCargarMapas()` + `IntersectionObserver` | El mapa se pide recién cuando su bloque está a 300 px de la pantalla | `tests/mapa.js` |

### `src/landing.css` — táctiles y legibilidad

| Cambio | Antes | Después |
|---|---|---|
| `.lb-map-btn` | 35 px de alto | 44 px (mínimo para el dedo) |
| `.lb-brand img` | 42 × 42 px | 44 × 44 px |
| `.lb-barber-pill`, `.lb-bd-lab`, `.lb-bd-atiende small`, `.lb-etq`, `.lb-hr-cerrado`, `.lb-hr small` | 11,5 y 11,8 px | 12 px |

Medido en 4 anchos × 2 temas. CLS después de los cambios: **0**.

### `src/styles.css`

- Fuera la regla `img[src*="assets/logo.png"]{border-radius:18px}`: no agarraba ninguna imagen (el logo en pantalla es `logo-256.png`). Lo detectó `css.muerto.js`.

### `sw.js`

El fallback de red devolvía `index.html` para **cualquier** recurso que fallara. Con la CSP activada, los módulos de Firebase y las tipografías de Google recibían `index.html` con `Content-Type: text/html`, y el error que aparecía ("Expected a JavaScript module script…") no señalaba la causa. Ahora `index.html` se devuelve **sólo para navegaciones**; para el resto, el error dice qué falló.

### `FIRESTORE_RULES.txt`

| Regla | Antes | Después |
|---|---|---|
| `config` lectura | `docId != 'finanzas' \|\| isSignedIn()` | `… \|\| isStaff() \|\| isOwner()` |
| `config` escritura | `isBarberoOrOwner()` | `isOwner()` |
| `config/barberos` | (genérica) | regla aparte: el barbero sólo puede tocar su propio objeto del array |
| `staff` auto-edición | `['n','foto','pd','tel','ig','desc']` | `['n','foto','tel','ig','desc']` — **`pd` fuera** |
| `turnos.create` | sin validación de campos | la hora tiene que tener forma de hora, y la fecha de fecha |
| `turnos.update` (cliente) | cualquier campo, cualquier estado | sólo pendiente → pendiente/cancel, y sólo los campos que toca |
| `turnos.delete` | cliente sobre su turno | sólo quien administra |
| `ventas` / `gastos` | `isBarberoOrOwner()` | el dueño conserva los suyos; el barbero, sólo los propios |

**Dos regresiones se detectaron leyendo el código antes de dar por buena la regla**, y se corrigieron: exigir `bid == request.auth.uid` rompía los cobros del dueño (`bsnap()` devuelve el id del barbero, no su uid) y los gastos del dueño (que ni siquiera llevan `bid`); y dejar `nm` fuera de la lista rompía "borrar tus datos", porque anonimiza los turnos ya cobrados.

### Archivos nuevos

| Archivo | Para qué |
|---|---|
| `vercel.json` | Cabeceras de seguridad y de caché |
| `.vercelignore` | Deja de subir 76 MB de PDF temporales, las pruebas, los .md de trabajo y las reglas de Firestore |
| `tests/xss.js` | Demuestra y vigila el XSS almacenado |
| `tests/csp.js` | Levanta la web con la CSP de producción y anota lo que el navegador bloquea |
| `tests/csp.sync.js` | Obliga a que `vercel.json` y `tests/srv.js` digan lo mismo |
| `tests/srv.js` | Servidor local con las cabeceras reales |
| `tests/visual.js` | Defectos visuales medidos en 4 anchos × 2 temas |
| `tests/perf.js` | Core Web Vitals y peso por tipo de recurso |
| `tests/perf.cmp.js` | Compara dos corridas de rendimiento |
| `tests/perf.mapa.js` | Mide el antes y el después del cambio del mapa sin tocar git |
| `tests/mapa.js` | Comprueba que el mapa no se pide hasta llegar a la sección |
| `tests/run.js` | Corre toda la batería en un comando, esperando entre pruebas que inician sesión |

### Archivos modificados (pruebas)

| Archivo | Cambio |
|---|---|
| `tests/loader.js` | Verifica el barrido de arriba hacia abajo en vez del giro y el latido |
| `tests/landing.modal.js` | La guarda de salto era un **salto falso**: llamaba a `irPaso(2)` sin elegir servicio, nunca llegaba y daba 0 barberos. Ahora elige servicio y barbero. Las capturas ya no usan handles (se desvinculaban) |
| `tests/landing.wizard.js` | Igual: los clics y las capturas pasaron a ejecutarse dentro de la página |
| `tests/panel.quitar.js` | Skip honesto cuando no hay barberos |
| `tests/sembrar.js` | El barbero es opcional: si su cuenta no existe, siembra el resto y avisa |
| `tests/landing.web.js`, `landing.tema.js`, `landing.reglas.js` | Skip honesto cuando la cuenta de prueba no entra |

### Archivos movidos

`assets/logo.png`, `assets/instagram.png` y `assets/whatsapp.png` → `fuentes/`.

**No se borró nada**: siguen en git, fuera de la carpeta que se publica. Son los originales que el dueño CBA tener; los que se usan son las versiones de 96 px y el `logo-256.png`.

### Rediseño del loader (después del video del dueño)

El dueño grabó la pantalla pidiendo una mejora. Al capturar el loader cuadro por cuadro apareció un defecto que las pruebas no veían: **la mitad de abajo quedaba en negro puro**, porque el `clip-path` iba directo de "nada visible" a "todo visible". Parecía una imagen rota, no un revelado.

**Qué cambió:**

| Antes | Ahora |
|---|---|
| Una imagen con `clip-path` animado | Dos capas de la misma imagen |
| Mitad de abajo en negro (hueco) | El escudo entero, apagado, siempre debajo |
| Línea saliéndose 10 px por lado | Línea dentro del redondeo (`14px`) |
| Escudo recortado por el radio | `scale(0.93)` y radio de 26 px |
| 168 px | 176 px |
| Sin marca de final | Puntito dorado que se apaga al terminar el barrido |

**No es una segunda descarga:** la capa de arriba es un `background-image` con la misma URL que el `<img>`.

**Archivos:** `src/styles.css` (bloque del loader), `index.html` (medidas y comentario), `tests/loader.js` (11 comprobaciones nuevas: que las tres rutas del logo coincidan, que la capa de abajo esté apagada y **no** recortada, y que la línea no se salga).

**Una trampa que salió en el camino:** dentro de `src/styles.css`, `url("assets/logo-256.png")` se resuelve como `/src/assets/logo-256.png` y da 404, porque las URL de un CSS externo son relativas al CSS, no al documento. Va `../assets/…`. Lo detectaron `landing.barberos` y `politicas`.
### Favicon, SEO y cancelación del login (12-10)

| Qué | Antes | Ahora |
|---|---|---|
| Favicon | no existía `/favicon.ico` | ICO de 16/32/48 px, 8 KB, generado con `tests/favicon.js` |
| `meta description` | "La mejor barbería y peluquería masculina…" | marca + ciudad + servicios reales, 140 caracteres |
| Descripción del JSON-LD | "Barbería y peluquería masculina…" | "Barbería en Puerto Iguazú…" |
| Texto visible del hero | no decía marca ni ciudad | "Codigo Barber, barbería en Puerto Iguazú…" |
| Login cancelado | cartel rojo con el texto crudo de Firebase | silencio |
| Loader | "que no gire" sin garantía | `tests/loader.giro.js`: 0,00° en 97 muestras por capa |

**Pruebas nuevas:** `tests/seo2.js` (43 comprobaciones), `tests/loader.giro.js`, `tests/favicon.js`. Las tres están en `tests/run.js`.

**Dos cosas que no se hicieron a propósito:** `meta keywords` (Google la ignora) y `alternateName` con sinónimos (relleno de palabras clave, Google lo detecta y perjudica).

**Y una advertencia:** el mayor peso en "barbería puerto iguazú" lo tiene el **Perfil de Empresa de Google**, que es un alta a mano fuera del código.
---

## Lo que NO se cambió, y por qué

| No se cambió | Motivo |
|---|---|
| `src/main.js` sigue siendo un archivo de 6.400 líneas | Dividirlo exige decidir el orden de los módulos, y un error de orden rompe la web en tiempo de ejecución. Es el pendiente más grande y queda documentado, no escondido. |
| `style-src 'unsafe-inline'` | La app genera 220 atributos `style=`. Endurecerlo requiere sacarlos antes a clases. |
| El límite de 2 turnos activos vive sólo en el cliente | Las reglas no pueden contar; necesita Cloud Function. |
| El descuento de puntos de los canjes vive sólo en el cliente | Sin operación atómica, un cliente puede crearse un canje gratis. Idem Cloud Function. |
| No se instaló el emulador de Firestore ni Lighthouse | Habría agregado dependencias; la verificación se hizo con el navegador y con las reglas de producción servidas localmente. |

---

## Verificación

```
25 pruebas · 567 comprobaciones · 0 en rojo
```

Corrida completa con `node tests/run.js`. Las pruebas que necesitan una cuenta que no existe (el barbero y el cliente de prueba se borraron en la limpieza) imprimen **SKIP** con el motivo, en vez de morirse con un timeout que no dice nada.

**Sin verificar explícitamente:**
- Las reglas nuevas contra Firestore real: hacen falta el Rules Playground o el emulador.
- Un lector de pantalla real para la accesibilidad.
- Cualquier medición de campo: todo lo medido es de laboratorio, en localhost.
---

## Lote 23 — Header del panel y barra de secciones

### `index.html`
- Se reordena `.hd` a `logo | nav | [casita] [toggle] [foto]`. El nuevo
  wrapper `.hd-der` agrupa los tres controles de la derecha.
- `#web` queda sólo con el ícono de la casita (se le saca el `<span>Ver la web`),
  y se mueve antes de `#thm`.
- **Se elimina `#lo`** (el botón suelto de "Cerrar sesión"): pasa al menú de la foto.
- `#nmenu` sale de `.mewrap` y queda como hermano de `.hd` dentro del `<header>`:
  ya no es el menú de la foto sino la bandeja de la barra.

### `src/main.js`
- Nueva `claseNav` (`"nav-mas3"` / `"nav-todo"`): le dice al CSS cuántas
  secciones entran en la barra.
- `CUANTAS = own ? 3 : sec.length`: el dueño muestra 3, el barbero muestra todas.
- El botón `.nav-mas` (tres rayitas) se agrega a la barra sólo si de verdad
  sobran secciones, y abre `#nmenu`.
- Nueva `menuPerfil()` a **nivel de módulo** (antes de `function R()`): el menú
  de la foto, unificado para los tres roles. Va fuera del `try` de `R()` a
  propósito: ahí dentro sería block-scoped y el render la vería como
  `undefined` (menú vacío).
- Nueva `miPerfilWeb()`: el barbero editando los datos que salen en su tarjeta
  del landing. Va a la web y le da vuelta a su propia ficha, que es donde vive
  el bloque "Mi perfil en la web" (no tiene pantalla de Ajustes: `rtOk` no le
  deja abrir `cfg`).
- `toggleMebadge()` abre siempre `#pmenu` (antes bifurcaba por rol).
- `toggleNav()` abre la bandeja `#nmenu` (antes el menú del admin).
- El cierre por clic fuera de la bandeja mira `.nav-mas` en vez de `#mebadge`.
- **Se borra `$("#lo").hidden = !me`**: `#lo` ya no existe y la línea tiraba
  `TypeError` en cada render, dejando el panel a medio pintar.

### `src/styles.css`
- **Se borra `body.adm nav { display: none }`** (celular). Era la razón de que el
  admin no tuviera barra inferior: su navegación salía entera de la foto.
- Nuevo bloque de la fila derecha: `.hd-der`, casita y toggle como cuadrados de
  42 px, y `.logo { margin-right: 0 }` para que el margen lo ponga `.hd-der`.
- La bandeja se oculta por `nth-child` según la clase de `#nav`:
  `#nav.nav-mas3 > button:not(.nav-mas):nth-child(n+4)` con corte en **1060 px**.
- `#nmenu` deja de ser el panel anclado a la foto y pasa a ser una hoja que
  sube desde abajo, con `bottom: calc(60px + safe-area)` para **no tapar** el
  botón que la abrió. Entre 860 y 1059 px sube como panel desde la esquina.
- `.hd` de `gap: 20px` a 16 px, y los botones de escritorio de `padding: 6px
  18px` a `6px 15px`: son los 50 px que faltaban para que las 7 secciones del
  dueño entren en 1040 px.

### Pruebas
- **Nueva `tests/header.js`**: 13 comprobaciones estáticas sobre el código (no
  necesitan cuenta) + 19 medidas en navegador del dueño en 390 y 1280 px: orden
  de la fila, que la fila no desborde, 3 secciones + bandeja, el contenido de la
  bandeja, y el contenido del menú de la foto.
- `tests/panel.shell.js` actualizado: ya no busca `#lo`, espera "Editar
  perfil" / "Cambiar foto" / "Cerrar sesión", y que "Ver la web" **no** esté en
  el menú. **No se pudo correr** (la cuenta de cliente no autentica).
- `tests/run.js`: se agrega `header`.

### Lote 24 — La CSP rompía el login con Google y Facebook

- `vercel.json` + `tests/srv.js` (CSP): `script-src` suma
  `https://apis.google.com` y `frame-src` suma `https://*.firebaseapp.com`.
  Es la corrección mínima: son los dos orígenes que faltaban, comprobados
  reproduciendo el fallo en local contra el servidor con CSP.
- Nueva `tests/csp.popup.js`, 10 checks: aprieta Google y Facebook de verdad y
  exige que la ventana emergente abra, llegue al dominio del proveedor, se
  dibuje, y que no haya ninguna violación de CSP.
- `tests/run.js`: se agrega `csp.popup`.
- `src/main.js`, `index.html` y `src/styles.css`: **sin cambios**. El código
  del login estaba bien.

Por qué no lo detectaron las pruebas anteriores: `tests/csp.js` comparaba la
cabecera con lo esperado, o sea que daba verde porque la CSP era *exactamente*
la que se había escrito. Nadie la había probado con un login real.

### Lote 25 — Diez cosas del dueño

**`src/main.js`**
- `auth/cancelled-popup-request` entra en `CANCELADO`: no avisa.
- `menuPerfil` sin cambios; `miPerfilWeb` reescrita (abría el bloque de la
  Agenda y dejaba el foco en `#pfNombre`; antes llamaba `verWebOn()` como si
  fuera función y tiraba ReferenceError).
- Nueva colección `fotoBarbero/{uid}`: `fotoTomar` escribe ahí en vez de intentar
  `config/barberos`, que siempre era denegado en silencio. Se escucha con
  `onSnapshot` y se mergea con `conFotos()`.
- El `onSnapshot` de `fotoBarbero` lleva **manejador de error**: sin él, mientras
  las reglas no estén publicadas, cada visitante anónimo deja un
  `permission-denied` sin capturar en la consola.
- `cliH` excluye al dueño (`u.id !== OWNER_UID`).
- `rgPtsRegistro`: el tope pasa de 20 a 50.
- Se borra la acción `fotoBarbero` (el botón del dueño).
- Ajustes: se borra `negTab` y `svcTab` se parte en `svcTab` + `ptoTab`. El menú
  queda Horarios / Servicios / Puntos.
- Pantalla **Mensajes** para el dueño (`msgH`), con `MSGS`, la suscripción
  `orderBy("fecha","desc").limit(100)`, la acción `delMsj`, y `mens` en `RT` y en
  `rtOk`. Imports `orderBy` y `limit` agregados.
- `window.__test.setFotos()` para poder probar el merge sin subir una foto de
  verdad (la escritura depende de unas reglas que hay que publicar).

**`FIRESTORE_RULES.txt`**
- `pt <= 20` -> `pt <= 50`.
- Nueva `match /fotoBarbero/{uid}`: lectura pública, escritura sólo del propio
  uid y sólo del campo `foto`.

**`src/styles.css`**
- **Se borra `body:not(.adm) #web { display:none !important }`.** Esa regla, con
  su `!important`, le ganaba a la fila nueva y el cliente no veía la casita.
- `.hd` y `#app` de 1040 a 1160 px: con 8 secciones del dueño la fila pedía
  1097 px.
- El corte de la bandeja pasa de 1060 a 1160 px, por lo mismo.

**`index.html`**
- **Se borra el `<meta http-equiv="Content-Security-Policy">`.** Con dos CSP el
  navegador aplica la más restrictiva; la del `<meta>` sólo tenía `script-src`.
  Ahora hay una sola fuente: `vercel.json`.

**Pruebas**
- Nuevas: `tests/cuentas.js` (las tres cuentas entran), `tests/lote25.js` (34
  checks), `tests/perf.movil.js`, `tests/optimiza-iconos.js`,
  `tests/limpia.sondas.js`.
- `tests/panel.shell.js`: la casita ahora se mide por `getBoundingClientRect()`
  y no por `count()`.
- `tests/landing.web.js`: idem, en vez de `offsetParent`.
- `tests/header.js`: la bandeja del dueño tiene 5 secciones (agregó Mensajes).
- `tests/run.js`: `cuentas` y `lote25`.

**Borradas**: `tests/sonda.reglas.js` y `tests/sonda.escrituras.js`. Escribían
datos de verdad en Firestore; no conviene dejarlas en el repo como si fueran
herramientas.
