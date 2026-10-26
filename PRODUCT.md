# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Static HTML/CSS + JavaScript ES modules, sin build step. Firebase v10 (Auth + Firestore + Cloudinary para imágenes). Se sirve como estático (Vercel, hoy en `don-estilo.vercel.app`). Tests de lógica pura en Node (`tests/logic.test.mjs`) sin dependencias.

## Users

Hombres de 18 a 45 años que reservan turnos desde el celular. Entran desde la landing sin sesión, eligen servicio, barbero y horario, y se registran o ingresan para confirmar.

Segundo usuario: el barbero (dueño o cuenta con rol `barbero`), que administra agenda, servicios, barberos, galería y finanzas desde el mismo build.

## Product Purpose

Reservar un turno de barbería en menos de 30 segundos, sin llamadas ni esperas. El objetivo secundario es que el cliente entienda y use el programa de puntos: cada corte suma 5 puntos y se canjean por descuentos o cortes gratis.

Éxito = el usuario completa una reserva sin ayuda en menos de 30 segundos, y vuelve al menos una vez para canjear puntos.

## Positioning

Turnos online + programa de puntos acumulativo en una barbería de barrio. La combinación "reservá el turno y sumá puntos que después se canjean" es el mecanismo; los competidores locales suelen ofrecer solo turnos o solo fidelización.

## Operating Context

- La landing es la puerta de entrada sin sesión. El login/registro vive detrás de `#login` (`RESERVAR_URL` en `src/config.js`).
- El barbero edita servicios (`config/servicios`), barberos (`config/barberos`), galería (colección `galeria`) y testimonios desde paneles. La landing renderiza siempre desde esas mismas fuentes: nunca hardcodear la lista.
- Cada turno bloquea bloques de 15 minutos (`GRID` en `src/config.js`) y la duración se agenda al múltiplo superior del rango declarado por el barbero (`durP`/`nsv` en `src/logic.js`).
- Imágenes: Cloudinary con preset unsigned (`CLOUD_NAME`, `CLOUD_PRESET`, `CLOUD_FOLDER`).
- Contacto: WhatsApp + Instagram + email de `src/config.js`.

## Capabilities and Constraints

- Modo claro y oscuro, con toggle persistido en `localStorage` bajo la clave `theme` y aplicado vía `document.body.dataset.theme`.
- Mobile first. Sin scroll horizontal. Respetar safe-area y `prefers-reduced-motion`.
- Turnos online con lista de espera; cancelación con `CANCEL_HS` horas de anticipación.
- Los servicios NO son una lista fija de tres: se renderizan dinámicamente desde `S` (populate de `config/servicios`) para que el barbero pueda agregar, quitar y editar. La grilla se acomoda sola.
- Los puntos del cliente salen del perfil real (`U.pt`). Sin sesión se muestra un ejemplo, no un valor inventado por cliente.
- Solo el dueño (`OWNER_UID`) edita porcentajes de ganancia.
- Ver `FIRESTORE_RULES.txt` para el modelo de permisos.

### Fotos de servicio (agregado 2026-10-10)

El dueño sube una **foto de preview por servicio** desde "Servicios y premios", y se guarda en el mismo documento del servicio (`img`). Se muestra en los tres lugares donde el cliente elige servicio: la grilla de la landing, la lista angosta de celular y el paso 1 del asistente de reserva.

**La foto es opcional.** Un servicio sin foto se ve igual de bien que uno con foto: la tarjeta queda sin la banda de imagen y conserva el borde dorado de arriba. Nunca se pone una imagen de placeholder ni un marco vacío.

**Las fotos de barbero nunca se recortan.** Es una regla del proyecto, no una preferencia estética: el dueño vio una versión que cortaba y la marcó como bug. El marco es 4/5 con `object-fit: contain`, así que lo que sobra a los costados se ve como franja del color de la tarjeta. En pantallas de poca altura la caja se achica (nunca la foto) y aparecen más franjas laterales antes que dejar la tarjeta fuera de pantalla. Ver `CONTINUAR.md` §8a y §8b.

### Estructura de la landing (2026-10-10)

La landing cierra con la banda dorada de "Reservar ahora" y el botón sticky. **No hay pie propio**: se eliminó la franja con "© Codigo Barber · Turnos y puntos" y las redes, porque repetía lo que ya está en la sección de Contacto. Los datos legales (políticas, privacidad) siguen accesibles desde el modal.

### Confirmación de un turno (2026-10-10)

Antes de confirmar, el cliente ve **la foto del servicio y la del barbero** en el resumen, no sólo un ícono. Si el servicio o el barbero no tienen foto cargada, la fila muestra el ícono de siempre: **nunca hay un cuadro vacío ni una imagen de relleno**.

**Aceptar los términos es obligatorio para reservar.** El paso 6 tiene una casilla que dice "Leí los términos y condiciones, la política de privacidad y las condiciones del servicio", con un link a cada uno que abre el modal en la solapa que corresponde. Sin marcar, el botón "Confirmar turno" no deja confirmar y avisa qué falta. El estado se reinicia al cerrar sesión.

### Google y Facebook: las dos formas de entrar

En las dos pantallas (Ingreso y Crear cuenta) están los dos botones:

| | Google | Facebook |
|---|---|---|
| Pantalla de **Ingresá** | Sí | Sí |
| Pantalla de **Creá tu cuenta** | Sí | Sí |

Un cliente puede entrar con su correo y contraseña, pero también puede entrar
con su cuenta de Google o de Facebook, y esas cuentas quedan habilitadas para
siempre.

**Al registrarse con una red social se le pide igual una contraseña** (solo en
esa pantalla; al ingresar no se pide nada). Es una red de seguridad: si después
esa persona pierde el acceso a Google o a Facebook, entra con su correo y esa
contraseña en lugar de perder sus puntos, su historial y sus turnos. Hay un
botón para saltárselo, con el aviso de qué pasa si lo hace.
### La tarjeta del barbero muestra su horario real (2026-10-11)

El dorso de la tarjeta tiene un bloque **ATIENDE** con el horario de ese barbero
—"Lun a Jue · 09:00 a 17:00 hs"— y la lista de servicios con precio. La regla
que lo sostiene:

- **Lo que dice la tarjeta es lo que bloquea la reserva.** El horario sale de
  `CFB(bid)`: el propio del barbero si cargó uno en *Ajustes → Horarios*
  (`config/horario.por[bid]`), si no el general de la peluquería. No es una
  descripción escrita a mano: es el mismo dato que después calcula los horarios
  disponibles.
- Si el barbero no tiene ningún día abierto, el bloque **no se muestra**: es
  preferible que falte a que prometa un horario que no existe.
- La pausa al mediodía se muestra aparte, en línea propia y más apagada, sólo
  si el barbero la cargó.

**Lo que todavía no se puede**: los servicios son **globales**, no por barbero.
No hay forma de que un barbero declare "yo hago estos dos"; la lista del dorso
muestra los mismos para todos. Hace falta un campo en `config/barberos` y una
pantalla para cargarlo, así que no se inventó.

### La franja de barbería fuera de la tarjeta (2026-10-11)

El dueño pidió la franja roja/blanca/azula arriba de las dos caras en el mockup
nuevo, y dos días después la pidió quitar al verla montada. **Las dos señales
valen**: la tarjeta ya no tiene franja. No es una contradicción con el login,
donde también se sacó: es la misma decisión aplicada a los dos lugares.

Lo que **queda con franjas** y está pendiente de que el dueño se exprese:

- el poste del login (`.poste` con `.rayas`), que gira con rojo/blanco/azul;
- la franja diagonal de la landing (`.lb-stripe`), de 6 px bajo el header.

### SEO local: el dato del negocio vive en cinco lugares (2026-10-11)

Dominio **codigobarber.com.ar**. La web tiene un `BarberShop` en JSON-LD,
metas OG completas, `canonical`, `robots.txt` y `sitemap.xml`. Tres decisiones
que no son obvias:

- **El teléfono es el dato más delicado de todo el SEO local.** El local no
  tiene fijo: hay dos WhatsApp. Se usa el principal como `telephone` y los dos
  como `contactPoint`. **Nunca se inventa un número**, porque Google lo
  contrasta contra Maps y contra las reseñas y un desajuste hunde el
  posicionamiento local.
- **`aggregateRating` no está, a propósito.** Es el bloque que más rinde y
  exige reseñas reales y públicas. Hoy hay 13 en Firestore de las cuales 10 son
  de prueba. Poner un puntaje inventado es penalizado y además es una mentira.
- **No hay `aggregateRating` pero sí `hasOfferCatalog`**, con los servicios y
  precios reales: eso sí se sostiene con los datos que ya están cargados.

Como la web es una SPA y Google tiene que leer el JSON-LD sin ejecutar
JavaScript, el `index.html` es estático y no puede leer `config.js`. El dominio,
la dirección, las coordenadas, el teléfono y el horario quedan repetidos en
`config.js`, `index.html`, `robots.txt`, `sitemap.xml` y Firestore. **`tests\seo.js`
compara los cinco contra `config.js` y falla si se separan.** Si cambia el
dominio, hay que cambiar los cinco en el mismo lote.

### El nombre de la marca es "Codigo Barber", SIN tilde (2026-10-11)

Había dos escrituras: el SEO decia "Código Barber" (con tilde) y `NOMBRE` en
`config.js` y `manifest.json` decian "Codigo Barber". Google exige que el nombre
del negocio coincida **exactamente** con el de la ficha de Google Maps, así que
no puede haber dos.

**Decisión del dueño: "Codigo Barber", sin tilde.** Ahora el title, las OG, el
`author`, el `name` del JSON-LD y el `manifest.json` usan la misma cadena.

`tests\seo.js` lo verifica: compara esos cinco lugares contra `NOMBRE` de
`config.js` y además falla si aparece alguna vez "Código Barber" con tilde. Si
algún día se cambia la marca, se cambia `NOMBRE` en `config.js` y la prueba avisa
dónde falta actualizar.
### Loader con el logo, no un poste (2026-10-11)

La pantalla de carga muestra el escudo de Codigo Barber sobre un cuadrado
redondeado con aro dorado —el mismo tratamiento que el logo del header— con un
latido suave y un arco dorado girando. Antes era un poste de barbero con franjas
girando.

Dos restricciones que vienen del material, no de una preferencia:

- **El PNG del logo es negro opaco, no transparente** (medido: 0% de píxeles con
  alfa). Por eso va sobre su propio cuadrado negro y no sobre un disco claro.
- **La ruta del `src` está escrita en `index.html`**, no asignada desde el
  módulo, porque el loader aparece antes de que el JS corra. El riesgo de que
  se desincronice de `LOGO` en `config.js` está cubierto por una prueba que
  compara las dos.

### Quitar un barbero agregado a mano (2026-10-11)

"+ Agregar barbero" crea un barbero **sin cuenta**: no tiene documento en
`staff` ni rol, es sólo una fila en `config/finanzas.bs`. Quitarlo no es
"degradarlo a cliente" sino sacarlo de la lista. El botón existe desde el lote
7 pero no hacía nada: buscaba el barbero por `uid` y un barbero sin cuenta sólo
tiene `id`. Ahora busca por cualquiera de los dos.

### El nombre del barbero vive en un solo lugar (2026-10-11)

El nombre de un barbero estaba guardado **tres veces** en Firestore y cada parte de la app leía una distinta:

| Dónde | Quién lo lee |
|---|---|
| `staff/{uid}.n` | el encabezado del panel del barbero |
| `config/barberos.l[].n` | la landing pública |
| `config/finanzas.bs[].n` | la lista **Barberos** y los chips de la agenda, en el panel del dueño |

Consecuencia real que reportó el dueño: se cambiaba el nombre en "Mi perfil en la web", la landing lo cambiaba, y **el panel seguía mostrando el nombre viejo**. Peor: cada vez que el dueño entraba al panel, su sincronización reescribía la lista pública con el nombre viejo y el cambio del barbero se perdía para siempre.

Regla que queda:

- **El nombre canónico es el publicado** (`config/barberos`). Si un barbero se cambia el nombre en su ficha, ese nombre manda en todas partes.
- El barbero **no** necesita permiso de edición de porcentajes: guardar la ficha escribe su nombre en `staff/{uid}` y en la lista pública, nada más.
- El dueño puede poner el nombre al **agregar** un barbero, pero una vez que la ficha existe manda lo que el barbero haya puesto.

### El barbero puede cargar turnos desde Agenda (2026-10-10)

Cargar un turno a nombre de un cliente desde el panel es una operación **normal del negocio**, no una excepción: el barbero lo hace cuando alguien llega sin haber reservado. Por eso las reglas de Firestore tienen que permitirlo (punto 6 del comentario de `FIRESTORE_RULES.txt`). Si algún día el barbero vuelve a ver "no tenés permiso", lo primero que hay que revisar es que las reglas de la consola estén publicadas, no el código.

### Identidad visual del panel (2026-10-10)

- **Las franjas de barbería (rojo/blanco/azul) están eliminadas de todo el producto.** Quedaban tres: la de la foto de los barberos en la landing (ya fuera en el lote anterior), la fija arriba del login y la de la tarjeta de ingreso. La marca se apoya en el dorado y el carbón azul, no en las rayas.
- **El header de celular es el mismo en los tres paneles** (cliente, barbero y dueño): misma altura, mismo logo, nombre de marca siempre en una línea. El barbero y el dueño tienen un botón extra ("ver la web") porque lo necesitan; eso es función, no una diferencia de diseño.

## Brand Commitments

- Tono: cercano, canchero, voseo rioplatense. Sin clichés machistas ni textos genéricos.
- Identidad visual actual: fondo carbón azul, marfil, dorado, rojo barbero reservado para detalles y acentos.
- Tipografías ya cargadas: `Barlow Condensed` (600/700, mayúsculas) para titulares, botones y precios; `Barlow` (400/500/600) para el resto.
- **Nombre de marca: "Codigo Barber".** Confirmado por el dueño. Vive en un solo lugar:
  - `src/config.js` → `NOMBRE = "Codigo Barber"` (el origen de verdad: header, modal, pie, login, privacidad, `document.title`)
  - `index.html` → `<title>`, `og:site_name` (estáticos: no los reescribe el JS, hay que cambiarlos a mano)
  - `manifest.json` → `name` y `short_name` (estáticos, y ahora sin BOM para que lo parsee cualquier `JSON.parse`)
  - La etiqueta del logo nuevo dice "Codigo Barber"; antes el mockup decía "Don Estilo", nombre que ya no se usa en ningún lado.
  - Instagram `@codigobarber_1` y email `codigobarber1.com` sugieren "Codigo Barber" sin el sufijo numérico, que parece residuo del scaffold.
  Decisión del owner (2026-10-08): **dejarlo cableado a `NOMBRE` en `src/config.js` y que él lo cambie.** La landing no debe hardcodear el nombre; todo texto de marca sale de `NOMBRE`.

## Evidence on Hand

Contenido real y verificado en el código (fuente de verdad):

- Servicios por defecto (`S` en `src/config.js`): Corte (Incluye cejas) 30 min $15.000 · Barba 30 min $8.000 · Corte + barba 60 min $20.000. Editables por el barbero desde la app. **Los tres tienen foto de preview cargada** (Cloudinary), que es lo que se ve en la landing.
- Puntos: 5 por corte completado (`PTS`), y **20 de bienvenida** en el registro. El valor de bienvenida **no está hardcodeado**: vive en `config/reglas.ptsRegistro` y se edita desde "Servicios y premios" (`PTSRv`).
- Premios (`PR` en `src/config.js`): Descuento 20% a 25 pts · Descuento 50% a 50 pts · Corte gratis a 100 pts.
- WhatsApp `5493757644751`, Instagram `codigobarber_1`, email `hola@codigobarber1.com`. Hay un segundo WhatsApp (`WA_ROMAN` / `WA_YAN`) cuya asignación sigue sin definirse.
- Fichas de barbero (`config/barberos`): nombre, foto, porcentaje, más oficio/descripción/redes. Se publican desde Finanzas y "Mi perfil en la web".
- Galería: colección `galeria` en Firestore, subida por el barbero.
- Barberos cargados: 2. `asda` **con** foto, `julian` **sin** foto (por eso su tarjeta muestra el placeholder). Ninguno de los dos tiene ficha cargada todavía, así que el dorso de la tarjeta muestra el aviso de "sin cargar".

**Ausencias que el trabajo futuro NO debe inventar:**

- **Testimonios**: hay reseñas en producción pero **ninguna es real**. De 13 documentos, 2 están escritas a mano y 10 son de pruebas automatizadas (`"Prueba automatica de reglas. Se borra."`). La landing nunca debe inventar una opinión; si hace falta contenido para maquetar, va con marcador visible + TODO.
- **Fotos de galería**: sin imágenes reales publicadas.
- **Dirección y horarios**: el código actual tiene un placeholder literal `[DIRECCIÓN]` y un mapa de ejemplo (`MAP_IFRAME` con coordenadas de muestra). Reemplazar con datos reales.
- No hay carpeta `referencia/` con capturas del mockup; la descripción textual del prompt es la fuente de verdad visual.

### La base se puede volver a sembrar (2026-10-11)

El dueño borró la base entera. `tests/sembrar.js` la reconstruct y se puede
volver a correr. La regla que salió de eso:

- **Firebase Authentication y Firestore son dos bases distintas.** Al borrar
  Firestore no se cae ninguna cuenta: sobreviven dueño y barbero. Por eso
  una limpieza de Firestore no obliga a volver a crear usuarios.
- **El documento `users/{uid}` lo crea el propio usuario, y sólo si todavía
  no es barbero.** Ni el dueño puede crearlo por otro (las reglas piden
  `request.auth.uid == uid`). Por eso el orden importa: el barbero tiene que
  entrar una vez **antes** de que exista su documento de `staff`.
- **Lo que no se puede sembrar son las imágenes.** Las fotos vivían en
  Cloudinary con URLs que se perdieron con la base. Se recargan desde la app.

Un negocio recién sembrado no tiene fotos, ni galería, ni reseñas. Eso está
bien: son datos del negocio, no del software. Lo único que no se inventa es
el nombre del barbero, el horario y los precios, que salen de `config.js` y
de lo que el dueño decide.

## Product Principles
1. **Reservar es la única acción principal.** Un solo llamado a la acción en toda la landing. Nada de "Crear cuenta" como CTA en la landing: el registro ocurre dentro del flujo de reserva.
2. **El contenido real manda sobre el diseño.** Servicios, barberos, precios, horarios y galería salen de Firestore. Si falta, se muestra un marcador, nunca un relleno inventado.
3. **Los puntos se entienden en un vistazo.** El programa de puntos es un objetivo de producto, no decoración: la tarjeta de progreso tiene que mostrar el balance real del cliente.
4. **Mobile primero de verdad.** 390px es el diseño; 1440px es la adaptación.
5. **Sin ADMIN ni credenciales en el repo.** `src/config.js` expone la `apiKey` de Firebase (pública por diseño, restringida por dominio) y `ADMIN_UID`. No agregar secretos nuevos ni exponerlos en la landing.

## Accessibility & Inclusion

Objetivo: WCAG 2.1 AA en claro y oscuro. Contraste mínimo 4.5:1 en texto de cuerpo y 3:1 en texto grande y bordes de componente. Navegación por teclado en todos los controles, foco visible, `aria-pressed` en chips seleccionables, `aria-expanded` en el menú móvil, `role="status"` + `aria-live="polite"` en los mensajes de estado del formulario. Todo input con `font-size` mínimo 16px para evitar zoom automático en iOS. Respetar `prefers-reduced-motion`.

## Decisiones de la auditoría (2026-10-11)

Cada punto es una decisión de producto, no una nota técnica. El detalle técnico está en `AUDITORIA.md`.

### Los datos que escriben los usuarios se escapan siempre

Se confirmó que un cliente podía inyectar HTML en el panel del dueño a través de la hora del turno, y que el código corría con los permisos de esa sesión. La decisión no es "parchar dos campos": es que **ningún dato que venga de Firestore se dibuja sin pasar por `esc()`**, y que las reglas de la base le exijan **formato** a los campos que luego se dibujan (la hora tiene que parecer una hora). Así, aunque alguien olvide escapar, el dato que llega no puede ser marcado.

Consecuencia aceptada: `esc()` es obligatorio en cada `innerHTML` nuevo. Se prefirió eso a una lista de campos permitidos, porque la lista se desactualiza sola.

### Las reglas de la base son la frontera real, no la interfaz

El dueño no puede tocar la configuración financiera: hoy se lo llama `config/finanzas`, y en el código aparece como un documento más de `config`. La separación real es por **qué se escribe**, no por dónde: el barbero puede tocar su propia ficha, el dueño puede tocar todo, el cliente sólo lo suyo.

Esto significa que **ocultar un botón no es una medida de seguridad**. Nunca se oculta un control que las reglas no impidan.

### Las reglas se publican a mano, y eso es un riesgo asumido

Hoy viven en `FIRESTORE_RULES.txt`, que el dueño copia a la consola de Firebase. Es un punto de desincronización real: el archivo puede no ser lo que está en producción, y no hay forma de enterarse salvo que alguien mire. Está anotado como P2 en `PLAN_MEJORAS.md`: lo sano es `firestore.rules` + `firebase.json` en el repo y deploy desde CI, que además deja registro de qué se publicó y cuándo.

### `style-src` con `'unsafe-inline'` es una deuda, no una decisión

La app genera 220 atributos `style="…"`. Sin `'unsafe-inline'` el navegador los descarta **en silencio**: no hay error, la página queda sin formato y parece un problema de diseño. Se aceptó `'unsafe-inline'` para poder publicar la CSP hoy, y quedó anotado que endurecerlo exige antes sacar esos estilos a clases.

Lo que NO se aceptó fue no medir: la CSP se prueba levantando la web con las cabeceras reales. Ese proceso encontró que con la CSP puesta la web perdía tipografías y módulos de Firebase, por el service worker. Sin esa verificación se habría publicado una web rota.

### El mapa se pide cuando se llega, no antes

Son unos 360 KB de terceros que se piden en la sección de contacto, varios scrolls más abajo en un celular. Se decide que el recurso se pida cerca de la pantalla. **Importante ser honesto con la medición:** en local el ahorro medido es 0 KB, porque `loading="lazy"` ya lo difería. Lo que se gana es determinismo: no depende del umbral del navegador ni de la velocidad de la conexión.

Se dejó siempre el botón "[MAPA · Google Maps]", que abre Maps en otra pestaña: nadie pierde el acceso por no tener el iframe embebido.

### No se inventa nada, ni siquiera en un placeholder

Cuando falta un dato —el nombre real del barbero, su foto, una dirección— se muestra un marcador visible o se avisa. No se rellena con un nombre plausible. Cuando en la limpieza no quedó ningún barbero y la web no podía tomar turnos, se preguntó en vez de fabricar uno, y se cargó con el botón real del panel en lugar de escribir a mano en la base.

### Mínimo de 44 px y mínimo de 12 px

Se fijan como regla, no como excepción: todo lo que responde al toque mide 44 px o más de alto, y ningún texto baja de 12 px. El segundo no lo exige WCAG (que no fija mínimo), pero a 11,5 px en un teléfono con mayúsculas y espaciado abierto se lee justo.

### Lo que no se va a prometer

El sitio **no** es AA en accesibilidad: hay 48 comprobaciones propias y 25 de contraste, y eso es un buen piso, no una certificación. Tampoco se midió con Lighthouse (no está instalado) ni en Safari o Firefox (todo se probó con Chrome). `AUDITORIA.md` §7 lista lo pendiente con esa honestidad.

---

## Header y navegación del panel (lote 23)

### El orden del header es `casita - toggle - foto`, en celular y en escritorio

Es lo único que no se negocia: es lo que pidió el dueño en las dos capturas, y
va igual en los tres roles. La foto queda a la derecha porque es la que abre
el menú de tu perfil, y un menú que se abre desde el borde es el que el pulgar
encuentra.

### La navegación tiene una sola regla: la fila no se desborda nunca

Cada rol dibuja todas sus secciones y el CSS oculta las que no entran. El corte
está en **1060 px**, no en 860, porque en escritorio la fila está topada en
1040 px y con el dueño no entraba ni a 1280 de ancho. Al que entre, le sale un
botón de tres rayitas con el resto.

Consecuencia buscada: el barbero y el cliente, que entran justos, **nunca**
ven el botón de tres rayitas. Antes el barbero lo tenía y repetía las mismas
cuatro secciones.

### El menú de la foto es el mismo para los tres roles, y tiene tres cosas

Editar perfil (el dueño no lo ve, no tiene ficha pública), Cambiar foto y
Cerrar sesión. "Editar perfil" apunta a distinto lugar según el rol porque no
es lo mismo: el cliente edita su cuenta, el barbero edita los datos que salen
en su tarjeta de la web, que viven en la ficha del landing.

Los botones sueltos del header ("Ver la web" con texto y "Cerrar sesión") se
eliminaron: la casita reemplaza al primero y el segundo vive en el menú. Una
fila de controles con dos botones de texto era lo que apretó el header.

### Lo que queda como decisión abierta

La **casita en el panel del cliente** no la pidió el dueño: se le dejó para no
perderle el "Ver la web" que tenía en su menú. Si sobra, se oculta con una
línea de CSS.

## Lote 24 — La CSP rompía el login con Google y Facebook

**Origen del bug:** este repo. La CSP del lote 20 quedó incompleta.

- `vercel.json` y `tests/srv.js`: `+ https://apis.google.com` en `script-src`
  y `+ https://*.firebaseapp.com` en `frame-src`. Con comodín, no con el id del
  proyecto. **Los dos archivos tienen que quedar idénticos** (`tests/csp.sync.js`
  lo verifica).
- Nueva `tests/csp.popup.js` (10 checks) ysumada al runner.

Con esto queda: **30 pruebas, 661 comprobaciones, 0 en rojo.**

Sin cambiar: el código del login (`red()`) estaba bien. No hizo falta tocarlo.

## Lote 25 — Diez cosas del dueño

| qué pidió | estado |
|---|---|
| borrar el cartel de popup cancelado | hecho, en silencio |
| rendimiento en móvil | 3.983 KB -> 2.716 KB medido (-32%) |
| que la foto del barbero se vea, y sacar "Foto" del dueño | hecho (colección `fotoBarbero`) |
| "Editar perfil" del barbero | hecho (abría el bloque y le daba el foco) |
| el error de permisos | **no se pudo reproducir**; se mejoró el texto |
| el dueño como cliente | hecho |
| máximo 50 puntos | hecho, en el panel **y** en las reglas |
| Ajustes: horarios / servicios / puntos | hecho, "Negocio" eliminado |
| a qué correo van los mensajes | no va a ningún correo; se agregó la pantalla |

**Suite: 32 pruebas, 748 comprobaciones, 0 en rojo.** Con las tres cuentas
funcionando por primera vez, `panel.shell.js` pasó a 59/59 y se destrabaron las
pruebas que estaban en SKIP.

### Dos decisiones de producto

**La foto la sube cada barbero, no el dueño.** El botón del dueño se eliminó: dos
personas editando el mismo rostro termina en que una pise a la otra.

**Los mensajes del formulario no se envían a ningún correo.** Se guardan en
Firestore y hasta ahora **nadie los veía**: la pantalla "Mensajes" del dueño es
nueva. El `EMAIL` de `config.js` es sólo texto que se muestra en la web.

---

## 29. La foto del barbero no llegaba a la web, y "Editar perfil" no guardaba

Tres cosas que el dueño reportó en la misma tanda. Las tres venían de la misma
raíz: **el barbero no tenía ningún camino de escritura que las reglas dejaran
pasar**.

### Lo que se comprobó, no lo que se suponer

Antes de tocar nada se midió contra la base real, con la sesión real del
barbero:

| prueba | resultado |
|---|---|
| `fotoBarbero/{uid}` existía | **404**, no existía |
| el `setDoc` que hace la app | **403** "Missing or insufficient permissions" |
| escribir `config/barberos` desde el barbero (idempotente, dato intacto) | **403** |
| lo mismo desde la sesión del dueño | **200** |
| `staff/{uid}` | **existe**, con nombre y foto |
| `config/barberos` | existe, con `foto: ""` |

O sea: la foto estaba guardada (en `staff` y en `users`) y el panel la
mostraba, pero **no había ningún documento público que la tuviera**. Por eso la
tarjeta de la web decía "[Foto]".

### Las dos causas

**1. La regla de `fotoBarbero` era imposible de satisfacer.** Tenía:

    allow create, update: if ... request.resource.data
                             .diff(resource.data)
                             .affectedKeys().hasOnly(['foto']);

En un **create** el documento todavía no existe, así que `resource` es `null`
y `resource.data` hace **truenar** la regla. Firestore falla cerrada y
deniega. Como además el código envolvía ese write en un `.catch(() => {})`, el
error se perdía y la app decía "listo" con la foto sin publicar.

**2. La rama de `config/barberos` para barberos nunca daba `true`.** La
condición era "todo lo que no es mío tiene que quedar igual", hecha con
`where(b, b.id != request.auth.uid)`. Con la sesión real daba 403 siempre.

Y como `guardarPerfil()` usaba un `Promise.all` entre `config/barberos` y
`staff`, ese 403 tumbaba también el write a `staff`: **"Editar perfil" no
guardaba nada** y mostraba el cartel de "No se pudo completar".

### La decisión: el perfil del barbero va en su propio documento

El perfil público (foto, nombre, oficio, descripción, WhatsApp, Instagram,
redes) vive en `fotoBarbero/{uid}`. Se lee sin sesión y lo escribe sólo el
propio barbero, y sólo esos siete campos.

- `config/barberos` vuelve a ser **del dueño solamente**: él decide quién está en
  el equipo y en qué orden.
- La regla nueva es simple y **no menciona `resource`**, así que no hay forma de
  que truene en un create.
- La foto y los datos van en el **mismo documento**: cargar la foto actualiza
  todo de una, y por eso aparece en la web, en el panel y en las tarjetas sin
  ningún paso extra.

**Lo que NO cambia:** si el barbero no está en la lista `config/barberos`, no
aparece en la web. Sigue siendo el dueño quien decide quién está en el equipo.
Lo que cambia es que, una vez que está en la lista, **todo lo que el barbero
carga sobre sí mismo se publica sin que el dueño tenga que hacer nada**.

### "Editar perfil" pasó a ser una ventana emergente

Antes era un `<details>` que se abría **en el dashboard**, entre la tarjeta del
nombre y el título "AGENDA": el formulario se colgaba en medio de la pantalla y
empujaba la agenda hacia abajo. Ahora es un modal, el mismo que usan los avisos,
con el foco en el primer campo y cierre por Cancelar o Escape.

El bloque inline desaparece de la agenda. La tarjeta con el nombre y el botón
"Cambiar foto" **se queda**: es el resumen, y "Editar perfil" también está en el
menú del ícono de la foto.

### Los errores ahora dicen la causa

El cartel decía "No se pudo guardar ese cambio. Volvé a intentar". Con las reglas
de Firestore denegando el write, eso era un consejo inútil: iba a fallar igual
las cinco veces.

Se agregó `motivoFirestore(e)`, que recorre la cadena de causas del error
(incluyendo `e.cause`, que es donde el navegador nuevo deja el detalle de red) y
distingue tres casos:

- **`ERR_BLOCKED_BY_CLIENT`**: lo genera una extensión o los escudos de Brave,
  **no el sitio**. Dice que pruebe incógnito sin extensiones.
- **fallo de red**: revisar la conexión.
- **`permission-denied`**: las reglas no dejaron guardar, hay que republicar
  `FIRESTORE_RULES.txt`.

Y con eso se destapó que en la captura del dueño había un `ERR_BLOCKED_BY_CLIENT`
contra `firestore.googleapis.com`: **tenía Brave bloqueando Firebase**, no era un
fallo del código.

### Dos correcciones en el camino

- `Promise.all` en `fotoTomar` y en `guardarPerfil`: un solo write rechazado
  tumbaba los demás y sólo se veía un error. Ahora cada write va por separado, se
  anotan los que fallan y el cartel nombra **cuáles** y por qué.
- El runner de pruebas contaba sólo `FALLA`, pero `politicas` imprime `FAIL`:
  cuando algo fallaba ahí, el cuadro decía **"ROJO fallas=0"** sin ninguna línea
  de detalle. Ahora cuenta las dos escrituras y las muestra.

---

## 30. Se saca el botón de Facebook

**Lo pidió el dueño.** El ingreso offering tenía Google y Facebook en las dos
pantallas; ahora queda **sólo Google**.

### Qué se sacó

- El botón de Facebook en **Ingreso** y en **Crear cuenta**.
- El import de `FacebookAuthProvider`.
- El `red(p, registro)` que elegía proveedor según el argumento: ahora es
  `red(registro)` y entra siempre con Google. El botón de Google tenía
  `data-args="${A("google")}"` con **dos** argumentos que ya no se usan, así que
  el segundo es el que llega como `registro`. Quedaba implícito y depende de
  un detalle de `data-args` que no se ve leyendo el botón.
- El texto de "elegí una contraseña", que decía "Tu cuenta ya está creada con
  Google o Facebook".

### Lo que **no** se tocó, y por qué

- **La pantalla de "elegí una contraseña" sigue existiendo.** Es de Google, no
  de Facebook: alguien que se registra con Google puede no tener contraseña. Si
  esa persona clickea "Ahora no, gracias", su cuenta queda sin forma de volver a
  entrar. Es el riesgo real de este diseño y está anotado en
  `ACTIVAR_GOOGLE_FACEBOOK.md`.
- **El botón de Google sigue también en el Ingreso**, por lo mismo. Sacarlo de
  ahí requiere avisar antes.
- **La CSP no mentionaba Facebook**, así que no hay nada que sacar de `vercel.json`.
- **El proveedor de Facebook sigue activo en Firebase.** Desde el cliente no se
  puede desactivar, y mientras esté activo no molesta (nadie llega al pop-up
  porque el botón no está). Desactivarlo es un paso manual en Firebase Console >
  Authentication > Sign-in method, y conviene hacerlo para no dejar una puerta
  abierta que nadie usa.

### El riesgo que no se pudo verificar

**No se pudo comprobar si hay cuentas creadas con Facebook.** La API de
Firebase Auth para listar usuarios necesita credenciales de administrador, y
desde el código no se tiene.

Si alguien se registró con Facebook, esa persona tiene una cuenta **sin
contraseña**, y el pop-up de Facebook era la única forma de entrar. Al sacar el
botón, se queda afuera para siempre: no puede entrar con email porque nunca se
le pidió una contraseña.

**Cómo revisarlo:** Firebase Console > Authentication > Users, y filtrar por
proveedor. Si aparece alguna cuenta de Facebook, hay que pedirle a esa persona
que setting una contraseña desde la consola, o directamente crearle una cuenta
con email.

El barbero no está en ese caso: su cuenta (`Px0Gbqr…`) tiene contraseña y entra
con email.

### `assets/facebook.png`

Quedó el archivo (21,7 KB) sin ninguna referencia: ya no se pide en ninguna
pantalla. **No se borró** porque es del dueño y volver a usarlo sería trivial si
algún día hace falta; queda como resto sin usar.

### Pruebas

`tests/lote25.js` (73 comprobaciones) ahora se asegura de que el botón no
vuelva. Las comprobaciones miran **el HTML que se dibuja**, no el texto del
archivo: en `src/main.js` quedan comentarios que explican la decisión y tienen
la palabra "Facebook", así que buscar la palabra en el fuente daría verde con
el botón puesto.

`tests/csp.popup.js` saca la entrada de Facebook de `PROVEEDORES`: el pop-up ya
no existe y no hay nada que medir.

`tests/seo2.js` tenía una comprobación que buscaba la cadena exacta
`"Cerraste la ventana de Google o Facebook sin terminar."`. Era una comprobación
vacía por dos motivos: la cadena ya no existe, y la frase **sobrevive en un
comentario** que explica por qué se borró. Ahora limpia los comentarios antes
de buscar, y agrega el positivo (que el texto de ese error sea la cadena
vacía), que es lo que de verdad prueba que la cancelación se ignora.

Medido en el navegador, a 390 px: en Ingreso y en Registro quedan un solo botón
por pantalla, los dos de Google; `<img src="facebook.png">` = 0 en las dos; el
único logo que se pide es `assets/google.png`.

---

## 31. Scroll suave, la foto en el panel del dueño, y los mensajes

Cuatro cosas del dueño. Tres eran bugs y una es una decisión.

### 1. El menú baja de un salto

El dueño pidió que tocar un link del menú baje despacio. Hacían falta **dos**
cosas, y con la segunda es fácil olvidarse:

1. `scroll-behavior: smooth` en el elemento que **scrollea**, que en la landing es
   la raíz del documento, no `.lb`.
2. `scroll-margin-top` en las secciones, porque el encabezado es `position:
   sticky` y mide 105 px: sin el margen, al terminar el scroll el título queda
   tapado y parece un error de maquetado.

Y el apagado por `prefers-reduced-motion` tiene que estar en `html`. El que ya
estaba iba sobre `.lb *`, y **nunca hizo efecto**: `scroll-behavior` se lee en el
elemento que scrollea, no en sus descendientes.

Medido en las seis secciones del menú, a 1280×900: el `h2` queda entre Y=193 y
Y=212, con la barra terminando en Y=105. Ninguna tapada. Con
`prefers-reduced-motion`, `scroll-behavior` computado = `auto`.

### 2. La foto del barbero no le aparecía al dueño

El mismo dato, la misma base, dos resultados distintos: **en la web se veía, en
el panel no**.

Motivo: `BARS` se asignaba en **tres** lugares y sólo uno pasaba por `conFotos`.
Los otros dos la pisaban con la lista cruda de `config/barberos`, que viene con
`foto: ""`, y como corrían después ganaban:

| lugar | ¿usaba `conFotos`? |
|---|---|
| el listener de módulo (el de la landing) | sí |
| el listener de `setup()`, que es el que se registra **con sesión** | **no** |
| el que reaplica los datos al cambiar de sesión | **no** |

Sin sesión sólo corre el primero, y por eso la web andaba. Con sesión corren los
tres y gana el crudo: la tarjeta del dueño mostraba la inicial "R".

Y el caso raro que reportó el dueño —"cuando vuelvo a la web tampoco aparece"— tiene
la misma causa: `verWebOn()` no cierra los listeners del panel, así que al volver
a la web el listener crudo seguía vivo y seguía ganando.

Las **tres** asignaciones pasan ahora por `conFotos`. Medido con sesión: la
tarjeta del dueño trae `<img>` cargada, y la tarjeta de la web muestra la foto al
volver del panel.

### 3. "Mandé un mensaje y no se cargó"

**El mensaje sí estaba.** Comprobado contra Firestore: había 3. La pantalla decía
"Todavía no mandó nadie un mensaje desde la web".

La consulta estaba a nivel de módulo, detrás de un `if (isOwner())`:

```js
if (isOwner())            // ← se evalúa UNA vez, al cargar el módulo
  onSnapshot(             //    cuando `me` todavía es null
    query(collection(db, "mensajes"), …),
```

`isOwner()` daba `false`, la consulta **nunca se abría** y no había reintento.
El mismo patrón que en el punto 2: una condición que se evalúa una sola vez y
mata una suscripción para siempre.

Ahora se abre dentro de `setup()`, donde ya se sabe quién es el dueño, y con
`ls()` para que se baje al cerrar sesión.

Medido: "3 mensajes sin responder", con los tres nombres y correos reales.

### 4. El tope de los puntos de bienvenida seguía en 20

No lo reportó nadie: apareció revisando el punto 3, que está a veinte líneas del
código que lo acota.

`PTSRv = Math.min(20, …)`, con un comentario que decía "acotado a 20 porque las
reglas piden `pt <= 20`". Pero las reglas piden **50** desde el lote 25 y el panel
lo muestra como 50.

O sea: el dueño escribía 40 puntos de bienvenida, el guardado daba bien, y a cada
persona nueva se le daban **20**. Sin error, sin aviso, y el panel diciendo otra
cosa. Ahora es 50 y el comentario dice por qué.

### Por qué ninguna prueba lo agarró

Las tres veces el patrón fue el mismo: **una comprobación mira un lugar del
código y el bug está en otro.**

- La foto: `setFotos` pasaba a mano la forma que el *consumidor* espera.
- Los mensajes: `if (isOwner())` da `true` si lo probás en un archivo donde `me`
  ya está cargado.
- Los puntos: la prueba del lote 25 miraba el panel (`Math.min(50, v)`), no el
  lugar donde se recortan.

### Las pruebas nuevas

`tests/lote25.js` (82 comprobaciones, era 73):

- **todas** las asignaciones de `BARS` pasan por `conFotos`. Mira las ocho, no
  una: el bug estaba en las dos que nadie mira.
- La consulta de `mensajes` está dentro de `setup()`, y hay exactamente **una**
  en el archivo (se cuenta `query(collection(…`, no `mensajes` a secas, que
  también aparece en el `addDoc` del formulario y en el `deleteDoc` del botón).
- El tope de bienvenida es 50 y no queda el de 20.
- La raíz scrollea suave, las secciones tienen `scroll-margin-top`, y
  `prefers-reduced-motion` lo apaga en `html`.

**Se comprobó que muerden**: se reintrodujo cada bug sobre una copia del archivo
y las siete comprobaciones lo detectaron.

### Lo que NO es código

Que la barbería no aparezca en Google (la cuarta captura) no se arregla desde
aquí: es el **Perfil de Negocio de Google**, que hay que crear a mano. El sitio
tiene sus datos estructurados y su SEO local listo, pero Google no muestra un
sitio en el mapa local sin ese perfil.

## 32. Las políticas leen los datos de la configuración en vez de escribirlos

Lo pidió el dueño: que cuando cambie los puntos, las horas de cancelar, etc., el
documento de políticas, condiciones y privacidad se actualice solo.

LO QUE HABÍA

En la sección "PUNTOS Y PREMIOS" los premios estaban escritos a mano:

  Descuento 20% (25 puntos), Descuento 50% (50 puntos) y Corte gratis
  (100 puntos).

Los reales, en Firestore, eran 20, 40 y 100.

O sea que el documento —que es un contrato con la persona que se registra— decía
un premio que no existía, con un precio que no era el. Y no se notaba: los puntos
por corte y las horas de cancelación SÍ salían de la configuración. Dos de cada
tres estaban bien, y el que estaba mal era justamente el más invisible.

LO QUE AHORA SE LEE DE LA CONFIGURACIÓN

| en las políticas | de dónde sale |
|---|---|
| puntos por corte | `PTSv` |
| puntos de bienvenida | `PTSRv` |
| horas para cancelar sin cargo | `CHSv` |
| premios y sus puntos | `PRv` |
| horario del local | `lbHorarioTxt("")` |

Los dos primeros ya salían de la configuración; los premios, los de bienvenida y
el horario, no.

Ayudantes nuevos, para que todo se lea igual:

- `polPuntos(n)` — "1 punto" / "5 puntos", con el singular bien puesto.
- `polLista(arr)` — "A", "A y B", "A, B y C". La conjunción antes del último es
  lo que hace que una lista de premios se lea como enumerada en español.

**Si no hay premios cargados, el documento lo dice** ("Por el momento no hay
premios canjeables cargados") en vez de mostrar la lista de antes. Un documento
que promete algo que no existe es peor que uno que avisa que no hay.

### Probado de punta a punta

Con la configuración real, cambiando los valores **desde el panel del dueño**
(sin tocar una línea de código) y mirando el modal después:

| | antes | después de cambiar | |
|---|---|---|---|
| puntos por corte | 5 | 12 | **"Ganás 12 puntos por cada corte completado"** |
| horas de cancelar | 5 h | 8 h | **"hasta 8 horas antes"** |
| premios | 20 / 40 / 100 | sin tocar | quedaron iguales |

Y al volver a la configuración original, el documento volvió a decir 5 y 5.

### Sobre la versión del documento

`POL_VERSION` y `POL_FECHA` siguen a mano, y el comentario ahora aclara **qué** es
la versión: es la versión del **texto**, no de los datos. Cambiar los puntos o los
premios no obliga a subirla, porque el documento no se editó. Se sube cuando
cambia una redacción, se agrega o saca una sección, o se cambia qué datos se
piden: ahí sí cambian los términos que la persona aceptó.

### Las pruebas

`tests/lote25.js` (85 comprobaciones, era 82):

- No hay **ningún** número de puntos u horas escrito a mano dentro de `polH()`.
- Las cinco cosas salen de la configuración.
- Si no hay premios, el documento lo dice.

**Se comprobó que muerden:** se reintrodujeron los seis bugs (premios a mano,
puntos clavados, bienvenida clavada, horas clavadas, horario borrado, aviso de
"no hay premios" borrado) y las siete comprobaciones los detectaron.

Y se corrigió una debilidad de la propia comprobación: buscaba sobre el texto
entero de `polH()`, que incluye comentarios que nombran cada fuente. Borrar el
código dejando el comentario daba verde — el mismo problema de una afirmación que
pasa con un selector roto, que ya mordió una vez en este repo. Ahora los chequeos
corren sobre el bloque **sin comentarios**, y eso también se verificó.

### Un error mío, en esta corrida

Para probar que los valores se movían solos tuve que cambiar los puntos de
verdade en la base: 5 → 12 y 5 h → 8 h. **El script que tenía que restaurarlos
falló** y los datos quedaron cambiados. Los restauré a mano por la API de
Firestore y lo verifiqué:

  antes de restaurar: {"pts":12, "cancelHs":8}
  después:           {"pts":5,  "cancelHs":5}
  RESTAURADO CORRECTAMENTE: true

Los premios (20/40/100) y los 20 puntos de bienvenida no se tocaron en ningún
momento.

Causa del fallo: el script intentaba volver a Ajustes escribiendo el hash, pero
estaba en la web y el router no navegaba; el click a la pestaña tenía `.catch()`,
que se tragó el error, y los `fill` siguientes escribieron sobre nada.

sw.js v12 -> v13.

Suite: 37 pruebas, 871 comprobaciones, 0 en rojo.

## 33. Menos botones de reservar, todos al mismo lugar, y el resumen legible en el móvil

Cinco pedidos del dueño en una tanda, con capturas. Uno era un bug de layout, tres
eran quitar cosas y uno era un comportamiento.

### El resumen se partía letra por letra

En el móvil el valor de cada fila del resumen salía partido en ocho renglones, un
carácter por renglón: `B a r b a 3 0 m i n`, `R o m a n`, `1 1 : 3`.

**El primer diagnóstico fue incorrecto.** El sospechoso obvio era
`overflow-wrap: anywhere`, que además de romper la palabra le avisa a flexbox que
el ancho mínimo de la caja es de **un carácter**. Se cambió a `break-word` y no
cambió nada: medido, con cualquiera de los dos la celda colapsaba igual.

La causa era el ancho, en dos lugares:

| dónde | antes | por qué colapsaba |
|---|---|---|
| `.wz-res-cols` | `minmax(0, 1.25fr)` | piso de **cero**: la columna izquierda se podía estrujar hasta 18px |
| `.wz-rf-t` | `flex: 1` | se quedaba con lo que sobrara después del ícono (38px) y del botón "Cambiar", que es `flex: 0 0 auto` |

**El arreglo no es un ancho, es que la fila se acomode sola:**

- `minmax(240px, 1.25fr)`: la columna tiene piso en píxeles. Si no entra, la grilla
  desborda a una sola columna (que es lo que hace `auto`), nunca se estruja.
- `.wz-rf-t { flex: 1 1 130px }` + `.wz-rf { flex-wrap: wrap }`: si el texto no
  entra con el botón al lado, **el botón baja de renglón**. El texto nunca queda
  por debajo de su base y el botón nunca desaparece.

Es la forma de que el problema no vuelva a aparecer a ninguna pantalla, sin tener
que adivinar un ancho exacto.

Medido en la ventana real del asistente a 390px (hoja de 358px):

| fila | antes | ahora |
|---|---|---|
| SERVICIO | 18px / 8 líneas | 154px / 2 líneas |
| BARBERO | 18px / 5 líneas | 154px / 1 línea |
| FECHA | 18px / 5 líneas | 154px / 1 línea |
| HORA | 18px / 5 líneas | 154px / 2 líneas |

Y con la grilla real a cinco anchos (360, 430, 540, 700, 900): todas las filas
entran en **una** línea. Antes, a 700px ya iban a dos y a 900px a ocho.

### "Reservar con {barbero}" abre la misma ventana

Antes ese botón dejaba el barbero puesto y llamaba a `lbReservar()`, que sacaba al
cliente de la web y lo mandaba a la pantalla del panel (`#/reservar`). El botón de
la tarjeta y el del encabezado acababan en **pantallas distintas**: dos botones,
dos caminos.

Ahora los dos abren la misma ventana de seis pasos, con ese barbero ya elegido. Y
arranca en el **primer paso que falte**, no en el 1: si el cliente ya eligió
servicio y día, no lo tira atrás.

Un detalle que hacía falta: el asistente usa `sel` y el widget de la landing usa
`lbw`. Son dos estados distintos. Sin copiar el barbero de uno al otro, la ventana
se abría en el paso 2 pidiendo barbero —justo el que el cliente acababa de tocar.

Con sesión sigue yendo a la pantalla del panel, porque ahí el mismo asistente se
dibuja como página y no como ventana.

### Se sacan dos botones

- **La barra fija de "Reservar ahora".** Tapaba el contenido de abajo de todo: en
  el móvil caía sobre el título de "Lo que dicen nuestros clientes" y sobre el
  botón de esa sección, y quedaban dos "Reservar ahora" pegados.
- **La tarjeta "Elegí con quién cortarte".** Era un cuarto botón de reservar para
  lo mismo. Cuatro botones iguales cargan la pantalla y hacen que ninguno parezca
  el principal. La grilla de barberos que estaba arriba no se toca.

En la landing quedan **2** botones de reservar: el del encabezado y el del título
de la sección de reseñas.

### El menú móvil se cierra solo

Los links de la bandeja son `<a href="#seccion">`: cambiaban el hash y la página
bajaba, pero la bandeja seguía abierta tapando media pantalla.

Se delega en el listener global de click en lugar de poner un `data-act` en cada
link, porque los `<a>` necesitan su href para el scroll suave y para el teclado:
cambiarles el comportamiento rompe la navegación sin JavaScript.

### Una prueba que daba falso constante

Una comprobación nueva buscaba `minmax(0, 1.25fr)` en todo el archivo de CSS y lo
encontraba **en el comentario que explica el bug**. La siguiente miraba el
*primer* bloque `.wz-res-cols` (el base, de una columna) en vez del del media query:
con el primero daba falso constante y "detectaba" cualquier cosa, que es peor que
no comprobar.

Es la tercera vez en este repo que una afirmación pasa con un selector roto. Las
dos están arregladas: se busca en el código (sin comentarios) y se miran los dos
bloques.

sw.js v13 -> v14.

Suite: 37 pruebas, 883 comprobaciones, 0 en rojo.

## 34. Los cuatro botones hacen los pasos, y el ingreso se pide al final

### Qué hacía cada botón

El dueño mandó dos capturas: el "RESERVAR AHORA" del hero y el de la banda
dorada, y pidió que hicieran los pasos y obriguen a ingresar para reservar.

Antes de tocar nada, el estado real de los cuatro botones de la web:

| botón | qué hacía |
|---|---|
| "Elegir mi turno" (la tarjeta) | abría la ventana de 6 pasos |
| "Reservar con Roman" (cada barbero) | mandaba al panel, `#/reservar` |
| "Reservar ahora" (encabezado) | mandaba al login de una |
| "Reservar ahora" (banda dorada) | mandaba al login de una |

Cuatro botones, cuatro caminos para la misma tarea.

Y el del login de una era el peor de todos: **el cliente se registraba antes de
saber si había horarios**. Armaba la cuenta y recién ahí se enteraba de que ese
día no había ningún turno libre. Con el orden nuevo hace el turno primero, y la
cuenta se crea para confirmarlo.

### Ahora

Los cuatro pasan por `lbAbreReserva()`, una sola función.

**Sin sesión**: la ventana de los seis pasos. El resumen (paso 6) dice
**"Ingresar y confirmar"**, no "Confirmar".

**Con sesión**: la pantalla del panel, porque ahí el mismo asistente se dibuja
como página y no como ventana.

### El bug de fondo: el turno se perdía al registrarse

Al probar el viaje entero —elegir sin sesión, registrarse, confirmar— apareció
que volvía al **paso 1**, con el servicio, el barbero, el día y la hora en cero.

No era un bug: eran **tres**, y cada uno rompía por su cuenta.

**1. `unsub()` borraba la selección entera.** Corre en cada cambio de sesión, y
ponía `sel` en cero. Ahora conserva la selección cuando hay un turno a medio
confirmar.

**2. `setup()` pisaba el día sin condición.** La línea era
`sel.d = days()[0] || ""`, sin preguntar nada. Al registrarse le reponía el primer
día libre encima del que había tocado: **del 17 de octubre al 14**.

**3. El listener de `config/horario` caía el día si no estaba entre los SEIS
próximos días con turno libre.** El calendario del asistente deja reservar
cualquier día del mes, así que las dos reglas se contradecían y esta ganaba sin
que nadie lo viera.

> Sobre el 3 hubo un intento que se descartó y queda escrito por qué. Se probó
> usar el horario del barbero (`diaReservable`). Al registrarse, el listener se
> vuelve a disparar en un instante en que el horario puede no ser el mismo con el
> que el cliente miró el calendario, y el día se caía solo (medido: del 17 al 14).
> Ahora sólo se caen los días **pasados** y lo que no sea una fecha
> (`diaUsable`). Si el dueño cierra un día que alguien ya había elegido, el
> asistente se frena solo en el paso 5: `wzLibres` devuelve cero horarios y no
> hay forma de llegar al resumen. Perderle el turno al cliente es peor que un
> día cerrado que lo frena con un mensaje.

La bandera `turnoEnVuelo` vive en el bloque de estado y **no** en `WZ` a
propósito: `WZ` está declarado 4000 líneas más abajo y `onAuthStateChanged` corre
antes, así que leerlo ahí lo metería en zona muerta temporal.

### Verificado de punta a punta en el navegador

Sin sesión, en el resumen:

    botón: INGRESAR Y CONFIRMAR
    filas: Corte (Incluye cejas) 30 min / Roman / sáb, 17 oct / 09:00hs

Tras registrarse:

    paso 6
    botón: CONFIRMAR TURNO      (ya no pide ingresar otra vez)
    filas: las cuatro idénticas  ok

Al cerrar sesión: la selección se limpia y no queda nada colgado.

### Código muerto que apareció

`lbWidget()`, `lbPaint()`, `lbSlots()`, `lbPaso()`, `lbPasoOn()`, los handlers
`lbS`/`lbB`/`lbT` y el estado `lbw`: el widget compacto de **4 pasos**. No se
dibuja desde que la reserva pasó a ser el modal de 6 pasos — verificado en el
navegador, `#lbw` es 0 elementos — y sus funciones sólo se llamaban entre sí.

Con su CSS: `.lb-wl` (9 reglas) y `.lb-chip` (8).

Al borrar `.lb-wl:hover` se fue por el camino la llave de apertura del bloque
`@media (hover: none)` que lo compartía con `.lb-btn:hover`, y el CSS quedó
desbalanceado. Se detectó **contando llaves**, no mirando: ahora `{` = 562 y `}`
= 562.

sw.js v14 -> v15.

Suite: 37 pruebas, 895 comprobaciones, 0 en rojo.

## 35. En escritorio el resumen se salía de la ventana

### El bug era del lote 33

El dueño mandó una captura de la ventana de resumen en computadora: el precio, la
casilla de los términos y el botón **"Ingresar y confirmar"** quedaban cortados,
con barra horizontal abajo.

Al arreglar el texto partido del móvil (lote 33) puse en la grilla del resumen:

```css
grid-template-columns: minmax(240px, 1.25fr) minmax(220px, 0.85fr);
```

y escribí en el comentario que *"si no entra, la grilla desborda a una sola
columna (que es lo que hace `auto`)"*.

**Eso es falso.** Con `minmax()` los pisos son reales: si los dos no entran, la
grilla no cae a una columna — se desbora hacia la derecha y el contenido se sale
de la hoja. Lo medido en el navegador, elemento por elemento:

| ventana | hoja | grilla | desborde |
|---|---|---|---|
| 1920 px | 460 px | 478 px | **11 elementos fuera** |
| 1280 px | 460 px | 478 px | **11 elementos fuera** |
| 900 px | 460 px | 478 px | **11 elementos fuera** |
| 860 px | 520 px | 478 px | ok |
| 390 px | 358 px | una columna | ok |

El botón final quedaba con 37 px afuera de la hoja.

### El arreglo

Ensanchar la hoja en escritorio: `max-width: 460px` → `720px` (de 900 px en
adelante). En la captura del dueño la ventana ocupaba 460 px en el medio de una
pantalla de 1900: había espacio de sobra.

```
240 (izquierda) + 18 (gap) + 220 (derecha) = 478px de grilla
720 (hoja) − 18 − 18 (padding)               = 684px disponibles
```

De paso el calendario se ve **mejor** que antes: las celdas pasaron de 130 px a
77 px justas y el mes entero entra sin recorte, que era el motivo original de
achicar la hoja.

### Medido en 19 anchos

320, 360, 390, 430, 540, 600, 640, 700, 768, 860, 880, 900, 940, 1024, 1100,
1280, 1440, 1600 y 1920 px: sin desborde horizontal, cero elementos fuera de la
hoja, botón final entero y texto de la política completo. **0 con problema.**

### La prueba que faltaba

Había una comprobación de que la grilla tuviera pisos en píxeles, pero **ninguna de
que esos pisos entraran en la hoja**. Eran dos números sin relación entre sí, y
yo cambié uno sin mirar el otro. Esa es exactamente la clase de error que la
prueba tenía que impedir.

Ahora hay dos que hacen la cuenta con los números del archivo:

```
pisos [240,220] + gap 18 = 478   ·   hojas [520,720] − 40 = [480,680]
```

Se verificó que muerden, reintroduciendo el bug y tres variantes (hoja a 460 px,
piso izquierdo a 300 px, piso derecho a 260 px, hoja base a 380 px): las cuatro
las detectan.

sw.js v15 -> v16.

Suite: 37 pruebas, 897 comprobaciones, 0 en rojo.

## 36. SSJ Barber, un solo barbero que es el dueño

Cuatro pedidos en un lote: cambiar la marca, dejar un solo barbero que además es
el dueño (pudiendo agregar más después), la división, y borrar el WhatsApp de Yan.

### Lo que NO se cambió, y por qué

| dato | estado | por qué |
|---|---|---|
| **dominio** | sigue `codigobarber.com.ar` | se repite en 6 lugares; si se pone uno que no existe, Google deja de indexar el que sí funciona |
| **email** | sigue `hola@codigobarber1.com` | no pasó el nuevo, y el anterior ya estaba marcado como dudoso |
| **logo** | sigue el de Codigo Barber | el nuevo llega después; adivinar el nombre dejaría la web sin logo |
| **Cloudinary** | sigue `codigo_barber_1` | son recursos que YA existen; cambiar la carpeta manda las fotos nuevas a una vacía |

El dominio y el email quedan con un TODO grande en `config.js` que explica qué
falta y qué hay que tocar junto cuando lleguen.

### Lo que sí cambió de la marca

`NOMBRE` = **SSJ Barber**, y con él: `<title>`, las 3 descripciones, `author`,
`og:site_name`, `og:title`, `og:image:alt`, `twitter:title`, el `name` del
JSON-LD, `manifest.json` (los dos campos, porque `short_name` es el que muestra el
ícono en la pantalla de inicio del celular), los encabezados de `robots.txt` y
`sitemap.xml`, y el Instagram: `codigobarber_1` → **`romanssj`**.

Se guardó en *mixed case*, como estaba antes. Si lo querés todo en mayúscula
(inclusive en el `<title>` y las metas) es una línea.

### El WhatsApp de Yan

Se borró `WA_YAN` y `WA_LISTA` quedó con un solo número.

> **Ojo con lo que ese número era.** `WHATSAPP` no era sólo un contacto de la web:
> es al que se manda el **aviso de lista de espera** cuando se libera un horario,
> y el del botón "Avisar por WhatsApp" después de reservar, el del aviso de
> cancelación y el del email sin confirmar. Con el cambio, **todo eso va a
> Roman**. Si algún día vuelve a haber dos personas, hay que volver a separar el
> número de avisos del número de contacto.

### El dueño como único barbero

Confirmaste que tu cuenta y la que figuraba como barbero son la misma persona. No
hay dos personas: hay una.

**El camino descartado:** usar la acción que ya existía, "Hacer barbero" desde
Clientes. Escribe `staff/{uid}`, y con eso el dueño pasa a tener ficha de
barbero, lo que dispara ramas del panel escritas para "no soy el dueño" (`bsnap`,
la agenda, el selector de barbero, el pie).

**Lo que quedó, en dos caminos:**

1. **El botón "Soy yo"**, al lado de cada ficha. Marca esa ficha con `yo: 1` y no
   cambia nada más: la foto, el oficio, la descripción y las redes siguen ahí.
   Es el camino normal, porque la ficha que ya está cargada ("Roman Ayala") lo
   tiene todo y cambiarle el id lo haría perder — la foto se busca por
   `fotoBarbero/{id}`.
2. **"Agregarme a mí"**, que sale sólo si no hay ninguna ficha marcada. Para
   cuando la lista está vacía.

**El reparto:** cuando la ficha que cobra es la tuya, `bsnap()` devuelve 100 y eso
se guarda **en el cobro**, no sólo al mostrarlo. Los cobros viejos conservan su
porcentaje; los nuevos se guardan con 100. Si mañana entra otro barbero, el
campo sigue editable como siempre.

Cuando **todos** los barberos de la lista sos vos, Finanzas deja de mostrar
"Para el dueño / Para los barberos" (que serían 100% y 0%) y muestra *Facturado*,
*Gastos* y *Neto tuyo*. En cuanto entre otro, el reparto vuelve solo.

### Dos errores míos dentro de este lote

**El botón se puso primero en código muerto.** Lo coloqué en una variable `right`
que se armaba y nunca se usaba: no se veía en ninguna pantalla. Ahora hay dos
comprobaciones: una exige que el botón esté **en el `<details>` que sí se dibuja**,
y otra que aparezca **una sola vez** en todo el archivo — si aparece dos, es que
se copió al lado muerto.

**La tabla "Porcentaje por barbero" buscaba al barbero por nombre**
(`fe.bs.find(b => b.n === g.n)`). Con dos barberos del mismo nombre tomaba el
primero; ese porcentaje se imponía sobre **todo** el facturado del barbero aunque
cada cobro traiga el suyo; y con vos como único barbero daba **0% y $0**, al
revés de lo que pasa. Ahora el reparto sale de los cobros.

### Un bug latente que salió en el camino

Cada vez que entrás al panel se **republica** la lista pública de barberos, y el
reparto se hacía sobre `BARS` (la lista ya combinada con las fotos).

`BARS` la arman tres listeners distintos: uno a nivel de módulo, otro al iniciar
sesión y otro con `config/finanzas`. Este último no tiene orden garantizado con
los otros: si gana la carrera, `BARS` está **vacío** al publicar, y con `BARS`
vacío cada `prev` era `{}` — la lista se reescribía **sin foto, sin oficio, sin
descripción, sin WhatsApp y sin Instagram**.

Ahora reparte sobre `PUB.barberos`, que es justamente "lo último que se publicó".

### Pruebas

`tests/lote25.js`: 110 → 126 comprobaciones. Las 15 nuevas se verificaron una por
una reintroduciendo cada bug: las 15 lo detectan.

> **Actualizado en el lote 37.** Los dos rojos de acá ya no son los mismos: las tres
> cuentas de prueba **ahora entran**, y la foto se encuentra con una tercera puerta
> en la búsqueda (ver §37). El id de la lista pública tampoco es el de acá: pasó a
> ser el de la cuenta del barbero. Este párrafo queda como estaba en su momento.

Suite: 37 pruebas, 844 comprobaciones, **2 en rojo**. Los dos rojos son datos
tuyos, no código:

- **La foto del barbero no aparece** en la tarjeta de la web. La foto está en
  `fotoBarbero/{omXpDusSJ6PQ9D8I9JGHgsYvpyJ2}`, pero la entrada de la lista
  pública es `Ni5wOQLghvPLZc2Er2sOQARmhnq1`: son ids distintos, así que no se
  cruzan. Y la entrada quedó con **tres campos solamente** (`id`, `n`, `foto`
  vacío): sin oficio, sin descripción, sin redes.
- **Las dos cuentas de prueba no entran** (la del barbero y la del cliente) con
  `auth/invalid-credential`. Comprobado contra el commit anterior: fallan
  idéntico, así que no lo causó este lote.

sw.js v16 -> v17.

## 37. El dueño es el dueño Y el barbero, y el logo nuevo

Cinco pedidos del dueño: que pueda tener todas las funciones de siempre, que
pueda colocarse como barbero con un botón que funcione, que el barbero pueda ser
el dueño, que el dominio siga siendo el de ahora, y el logo.

### El botón "Yo también soy el barbero"

Antes el dueño **no tenía "Editar perfil"** en su menú. La condición era
`if (!isOwner())`, así que el único que podía tener ficha pública de barbero —
foto, oficio, descripción— era cualquiera menos él.

Ahora el menú del dueño tiene:

- **Editar perfil** — su ficha pública, el mismo modal que usa el barbero.
- **Yo también soy el barbero** (o *Ya soy el barbero* si ya lo está).

El botón **marca la ficha que ya está en el equipo**, no agrega una segunda: si
no lo hiciera, tu nombre aparecería dos veces en la web. Y al terminar abre
directo el perfil, que es el paso que de verdad falta.

> El botón ya lo apretaste: la lista quedó con tu `uid` y tu porcentaje en 100.
> Lo que falta es la foto (abajo).

### Por qué no se veía tu foto

La foto de una ficha se buscaba **solo por `id`**. La foto de un barbero vive en
`fotoBarbero/{uid}`, así que con la búsqueda por id sola **era imposible que
apareciera**, por más que estuviera cargada.

Después hay un segundo motivo, que es el que está en tus datos ahora. La ficha de
la lista **no la creaste vos: la creó la cuenta del barbero**, que escribe su
propio `id` y su propio `uid`:

| documento | clave | contenido |
|---|---|---|
| `config/barberos.l[0]` | `RdQMQ0wSy8SBbaONeRA0JzFLwFR2` | Agustin — el id **y** el uid de la cuenta del barbero |
| `config/finanzas.bs[0]` | `RdQMQ0wSy8SBbaONeRA0JzFLwFR2` | `yo: 1` (ya la marcaste como tuya), `uid` = el del barbero |
| `fotoBarbero/LQ7Ik…` | **tu uid** | el campo `foto` está **vacío** |
| `fotoBarbero/omXpDusSJ…` | una cuenta vieja | la foto que hay cargada |

O sea: la ficha tiene `uid`, y la foto que vos subirías está bajo **otro**. Por
eso buscar por `uid` tampoco alcanzaba.

La búsqueda tiene **tres puertas**, en este orden:

1. `FOTOS[b.id]`
2. `FOTOS[b.uid]`
3. `FOTOS[OWNER_UID]`, **sólo si la ficha es tuya** (`yo: 1`, o el id/uid es el tuyo)

La tercera es la que lo arregla, y no hace falta tocar nada en la base. El
formulario de perfil (`miFicha`) la tiene también, para que abras **la ficha que
marcaste** y no una en blanco.

Comprobado de punta a punta: con la ficha real de la base y una foto que sí existe
en Cloudinary, la tarjeta la muestra a 800×600 y desaparece el cartel `[Foto]`.

**Lo que falta es que la cargues vos.** Entrá en **Editar perfil** y subí la foto:
se guarda bajo tu uid y la tercera puerta la encuentra.

### Transferir la propiedad: el UID, en dos lugares

Es exactamente lo que pediste —se cambia el UID y cambia el dueño— pero el UID
está en **dos** archivos, y con uno solo de los dos cambiados no hay un error
limpio:

| si cambias... | qué pasa |
|---|---|
| sólo `config.js` | la persona ve el panel de cliente, no le salen ni el nombre ni las fotos, sin ningún mensaje que diga por qué |
| sólo `FIRESTORE_RULES.txt` | ve todo el panel y cada guardar rebota con `permission-denied` |

Los dos archivos tienen ahora arriba un bloque que lo dice, y **`tests/owner.js`**
compara los dos UID y falla si se separan. Las reglas además hay que **publicarlas
en la consola de Firebase**: tocar el archivo no alcanza.

> Que el barbero sea el dueño **no** se decide con el UID: se marca desde el panel.
> Es una bandera en la lista de barberos, no un permiso, así que transferir la
> propiedad no toca quién es el barbero.

### El dueño conserva todo lo demás

`rtOk` ya le daba al dueño **todas** las vistas del barbero más las suyas
(dashboard, barberos, ajustes, mensajes). Hay una comprobación que lo verifica y
que fallaría si alguna vez el dueño pierde una que tiene el barbero.

### El logo

Entró el emblema que mandaste (`Emblema SSJ Barber en blanco y negro.png`,
1254×1254, 1,68 MB, **sin canal alfa**: las esquinas son negro opaco). Se
generaron los seis tamaños que el sitio usa:

| archivo | lado | dónde se ve |
|---|---|---|
| `assets/logo-256.png` | 256 | header (38 px), modal (56 px), loader, `og:image` |
| `assets/icon-192.png` | 192 | ícono de la app |
| `assets/icon-512.png` | 512 | ícono grande |
| `assets/icon-maskable-512.png` | 512 | ícono adaptativo de Android (con la zona segura) |
| `assets/apple-touch-icon.png` | 180 | pantalla de inicio del iPhone |
| `favicon.ico` | 32 | ícono del navegador |

Se miró cómo queda a 38 px, que es como aparece en el header: se lee como emblema,
que es lo que tiene que ser a ese tamaño. El texto "SSJ BARBER" de adentro no
se lee a 38 px, y no tiene que leerse: el nombre de la marca está al lado, en
dorado.

### El email, en un apartado para completarlo después

`EMAIL` quedó **vacío**, con el apartado al lado explicando dónde se ve y cómo se
carga. Antes seguía `hola@codigobarber1.com`, que además ya estaba marcado como
dudoso (el dominio de la web es `codigobarber.com.ar`, no `codigobarber1.com`).

Con el valor vacío, las dos apariciones del aviso de privacidad habrían renderizado
un `<a href="mailto:">` vacío, que no abre nada y parece un error. Ahora muestran
"sin definir todavía".

### El dominio y la marca

El dominio sigue siendo `codigobarber.com.ar`, como pediste, hasta que compres
otro. **No tiene nada que ver con el nombre de la marca**: la web, las etiquetas,
el título, el manifiesto y las redes ya dicen SSJ Barber.

### Pruebas

`tests/owner.js` (nueva, 12 comprobaciones) + 15 en `tests/lote25.js`. Cada una se
verificó **reintroduciendo el bug**: se rompe el código a mano y se comprueba que la
comprobación se pone roja. Dos no mordían y se corrigieron.

### Las cuentas de prueba

Las tres entran ahora: dueño `LQ7Ik…`, barbero `RdQMQ0w…` y cliente `Tw6nKfw…`.
En el lote 32 fallaban dos con `auth/invalid-credential`; ahora no.

**Conviene rotar las tres contraseñas de todas formas**: están en `.env.local`, en
un archivo del repositorio.

**38 pruebas · 948 comprobaciones (en esa corrida).** En rojo queda `landing.foto.viva`, que es el
dato tuyo: la foto todavía no la subiste.

## 38. El alquiler se puede cargar: los gastos existían pero no se veían

Pregunta del dueño: *"¿dónde registro el gasto del alquiler del local? El dueño
es de la barbería pero no del espacio"*. Contestando: en **Finanzas**, y ahora
sí se puede.

### Qué pasaba

El sistema de gastos estaba **escrito entero y no dibujado**. La acción `gAdd`
guardaba bien contra Firestore y las reglas dejaban pasar sólo al dueño, pero en
la pantalla de Finanzas no había nada que la alcanzara. Cuatro variables
definidas y nunca usadas:

| bloque | qué era |
|---|---|
| `gastoBlock` | el formulario y la lista, enteros |
| `gastosLista` | una segunda copia de la lista |
| `gastoForm` | una tercera copia del formulario |
| `kps` | las tarjetas de *Gastos* y *Neto* |

Lo que se veía eran tres tarjetas fijas (*Facturado*, *Caja de hoy*, *Cortes del
período*). **Ni los gastos ni el neto aparecían**, aunque estuvieran calculados.

Es el error que ya apareció dos veces en este archivo: algo escrito que nunca se
pinta. Por eso ahora hay una comprobación que verifica que `gastosH` esté en el
HTML que se devuelve, y otras tres que fallan si vuelve a quedar alguna de las
cuatro copias muertas.

### Dónde quedó

Abajo de todo, a lo ancho, y sólo para el dueño (los gastos son del negocio y
las reglas no dejan escribir a un barbero). Se ve así:

- **Facturado** · **Gastos** · **Neto tuyo** (o *Para el dueño / Para los
  barberos / Neto del dueño* cuando hay más de un barbero).
- Un campo de concepto, uno de monto y el botón **+ Agregar gasto**.
- La lista de los gastos del período, con su fecha y su botón de borrar.

El concepto del gasto **es del negocio, no del barbero**: el alquiler lo paga la
barbería, no el que corta, así que no se reparte con los cobros y baja del total
facturado entero. Que el dueño sea también el barbero no cambia eso.

### El signo de los números negativos

`$$` ponía el peso antes del signo, así que el neto se veía **`$-180.000`**. No
se había notado porque la tarjeta del neto nunca llegó a pintarse; al
conectarla apareció el caso negativo que el formateador nunca había tenido que
mostrar. Y no es un caso raro: el neto es *facturado menos gastos*, así que da
negativo cada vez que los gastos del mes superan lo facturado, que al empezar es
casi siempre. Ahora es **`-$180.000`**.

Comprobado cargando un gasto de verdad de punta a punta y después borrándolo:
con $180.000 de gastos y $0 facturado, *Gastos $180.000* y *Neto tuyo −$180.000*.

### Un barbero que llega por un enlace viejo

Las reglas ya bloqueaban que un barbero cargara gastos, así que no era un
agujero: era un `permission-denied` técnico sin decir qué hacer. Ahora `gAdd` y
`askGDel` avisan con una frase.

### La foto del barbero: ya está

La tarjeta de la web **ya muestra la foto** (nombre publicado: *Juan*). Se
verificó contra el sitio real: la imagen se descarga de verdad y se pinta con
tamaño. Era el último rojo que quedaba.

### Pruebas

30 comprobaciones nuevas en `tests/lote25.js` (§38), más los arreglos de tres
comprobaciones que estaban rotas:

- **El patrón del `mailto`** buscaba `;\n` y `src/main.js` tiene finales de línea
  CRLF, así que el recorte no quitaba nada y la comprobación se ponía roja por el
  `mailto` que está *dentro* del helper, que es justo donde tiene que estar. Se
  pasó a `;\r?\n`.
- **La rama del dueño** buscaba `"own\n      ?"` con seis espacios y la sangría
  real son diez. Ahora se compara contra la rama del cliente en vez de contra
  una cantidad de espacios.
- **El bloque del barbero** daba por hecho que *entró* significa *entró como
  barbero*. La cuenta de prueba de `.env.local` entra, pero hoy **no tiene
  documento `staff`**, así que la app la trata como cliente: cinco rojos y un
  crash por una suposición que el código nunca hizo. Ahora se mide el rol real
  (`window.__test.rol`) y se mide lo que ese rol hace de verdad —que también
  vale: para un cliente, *Editar perfil* lleva a `#/mi-cuenta* y **no** muestra la
  ficha del barbero—. Si esa cuenta vuelve a ser barbero, entra por la otra rama.

**38 pruebas · 978 comprobaciones · 0 en rojo.**

## 39. La plata de cada uno: cada gasto es de UNA persona

El §38 dijo que los gastos eran *"del negocio, no del barbero"*. El dueño lo
pensó mejor y lo corrigió:

> *"yo solo quiero que haya en dueño un gasto que seria el alquiler o cualquier
> servicio y se descuente de su ganancia neta. lo mismo sucede si los barberos
> quieren sacar su ganancia neta restando el alquiler u otra cosa, es mas para
> tener un manejo de plata para cada individuo de manera personal"*

Los gastos los carga el dueño igual que antes (desde Finanzas, con las mismas
reglas de escritura), pero **cada gasto lleva a quién le corresponde** —el dueño
o un barbero— y **le baja de SU ganancia neta**, no del total del negocio. Para
el alquiler del local con un barbero futuro sigue valiendo lo mismo: se pregunta
de nuevo con la misma respuesta, y respondió *"mantenga la misma respuesta queq
la anterior"*, así que nada cambia cuando entren más barberos.

### Qué cambió

- En el formulario de gastos aparece **de quién es el gasto** (dueño o barbero).
  Arranca marcando al dueño —el gasto casi siempre es suyo y equivocarse de
  más es más fácil que de menos— y **no se vuelve a arrancar** al guardar: el
  alquiler se vuelve a cargar cada mes y no hay motivo para reelegirlo cada vez.
- La tabla "Porcentaje por barbero" (que mezclaba `0 %` y `$0` con los
  recortes del propio dueño, claridad cero) se reemplazó por **"Ganancia de
  cada uno"**: una fila por persona con **Persona · Facturado · Gastos · Neto**,
  y abajo la fila **Total del negocio**. El dueño sale etiquetado como *dueño*
  para distinguirse de la lista de barberos cuando el nombre es igual.
- Al dueño **no se lo cuenta dos veces**: su fila lleva su parte de todos los
  cobros, y los barberos no repiten los cobros que son suyos como si fueran
  del grupo.
- Las tarjetas cambian según quién mira. El dueño: **Facturado · Gastos · Neto
  del negocio**. Un barbero: **Facturado · Mis gastos · Mi neto**. El form de
  gastos es sólo del dueño; la lista de gastos del período la ven los dos.
- Si un gasto no trae a quién le corresponde (los viejos del §38), cuenta como
  del dueño: los números de antes no se mueven.

### Lo que NO se calcula

Pregunté si había que computar un porcentaje sobre la ganancia neta: *"no lo
coloques. me arrepiento"*. No hay porcentaje y no hay costo por servicio: cobra
lo facturado, la plata que se gasta se marca a nombre de alguien, y a cada uno
se le muestra su neto.

### Comprobado en vivo (con datos de prueba, sin tocar lo real)

En la sesión del dueño, con cobros y gastos armados para el ensayo (que no
dejan nada en Firestore, hay hooks para eso):

| | Facturado | Gastos | Neto |
|---|---|---|---|
| Dueño | $25.000 | $180.000 | **−$155.000** |
| Barbero (prueba) | $10.000 | $25.000 | **−$15.000** |
| Total del negocio | $35.000 | $205.000 | **−$170.000** |

Las tres sumas dan. Etiquetas *Juan (tú)* / *Juan (dueño)* correctas, lista de
gastos con nombre, botones **Guardar porcentajes** y **+ Agregar barbero**
verificados adentro de su tarjeta. Capturas en `tmp_shots/39-reparto.png`,
`39-final.png` y `39-neto.png`.

El gasto de verdad cargado y luego borrado también se comprobó contra
Firestore (§39 de `tests/lote25.js`), y la base quedó con cero gastos de prueba
en todos los períodos.

### Pruebas

35 comprobaciones nuevas en `tests/lote25.js` (§39), más los reajustes de §36 y
§38 para la pantalla nueva. Y una cosa más: la suite completa (38 pruebas, no
sólo la de este lote) encontró un despiste —el mapa de la landing había perdido
su carga a pedido (`data-src` había quedado `src`)— que la prueba de este lote
sola no veía. Está reparado. **38 pruebas · 1018 comprobaciones · 0 en rojo.**

## 40. El título de Google: "SSJ Barber | Puerto Iguazú"

El dueño vio en Google su barbería anunciada como **"Codigo Barber"** en el
título, con la descripción terminando en *"Reservá tu turno online en Codigo…"*
y pidió: *"quiero que aparezca como titulo SSJ Barber | Puerto Iguazu"*.

### La primera mitad ya estaba hecha

El `<head>` local ya se había rebrandeado en el lote 36: título, descripción,
og/twitter y el JSON-LD decían todo SSJ Barber, y había una comprobación de que
**no queda la marca con tilde** en ningún archivo. Lo que Google mostraba era
**la versión vieja desplegada**: en `codigobarber.com.ar` no llega nada nuevo
desde hace una docena de versiones. La página real ya tiene la cabeza nueva;
lo que Google enseña es su copia de la web como estaba publicada, con la marca
vieja. Se corrige al desplegar.

### Lo que cambió de verdad

- El `<title>` pasa a ser **exactamente** lo que pidió: `SSJ Barber | Puerto
  Iguazú` (26 caracteres). Con el acento: la ciudad se escribe *Iguazú* y así
  la trae la descripción y el JSON-LD; sin acento se desalinea el resto del
  texto.
- `og:title` y `twitter:title` van detrás —eran "SSJ Barber - Barbería en Puerto
  Iguazú"—. Google a veces toma el de Open Graph y a veces el del `<title>`:
  si dicen cosas distintas discute quién gana. Igual entra en todas las
  tarjetas al compartir en WhatsApp.
- La descripción queda como estaba: menciona *Barbería* (palabra clave que ya
  no entra al título) con "Reservá tu turno online por WhatsApp". El snippet
  viejo de Google ("…en Codigo …") también se compone al desplegar.

### El test

`tests/seo.js` pedía título de 30 a 65 caracteres: el nuevo tiene 26 y quedaba
rojo. El piso bajó a 25, con un comentario que documenta por qué (decisión del
dueño). Google no trunca los títulos cortos: los muestra completos — la palabra
`Barbería` que sobró del título queda en la descripción, que es la que Google
pinta debajo. **38 pruebas · 1018 comprobaciones · 0 en rojo.**

### Para que se vea en Google NO basta con cambiar el archivo

1. Hay que **desplegar** (los doce lotes pendientes).
2. Google vuelve a leer la página en una visita (reindexación): de horas a
   días. Para apurarlo, desde la Search Console del dominio:
   **URL inspection → Pedir indexación** con la raíz del sitio.

## 41. La galería muestra tus fotos sin recortar nada

El dueño pidió ocuparse del punto 3.1: la galería de "cortes hechos". Resultado:
**la galería ya tiene tres fotos reales** (subidas a Cloudinary en su momento y
guardadas en Firestore; "0 fotos" en `CONTINUAR.md` quedó viejo). Son cortes
degradados de perfil, HTTP 200, WebP vía Cloudinary con `f_auto,q_auto,w_800`.

### Lo que cambió

- **El recorte se fue.** La grilla usaba `aspect-ratio` fijos (1/1 la común,
  16/10 la primera, 2×2 en escritorio) con `object-fit: cover`: eso es una caja
  que tira lo que sobra — en fotos de trabajo, tirar partes del corte. La
  regla del dueño es que **las fotos no se recortan**. Ahora la galería es
  **masonry en columnas** (2 en mobile, 3 en escritorio): cada foto entra a su
  proporción NATURAL, sin `cover` ni alturas fijas, y `break-inside: avoid`
  por figura. El vertical queda vertical y el apaisado apaisado.
- El `<img>` de la galería perdió los `width="600" height="600"`: adjudicaban
  un cuadrado que las fotos no tienen.
- Los **marcadores "FOTO 1..5" quedan y quedan cuadrados**: la decisión del
  principio 2 (*"si falta, se muestra un marcador, nunca un relleno
  inventado"*) sigue en pie, y con la base vacía se ven en su caja 1/1.
- `window.__test.setGaleria(l)`: el mismo patrón que `setVentas` — escena con
  fotos sintéticas (data: URL de SVG con proporción conocida) sin tocar
  Firestore ni Cloudinary. Sólo en local, como todos los hooks.

### Pruebas

`tests/galeria.js` (nuevo, 17 comprobaciones, en `run.js` al lado de `mapa`):

- **La prueba clave:** proporción MOSTRADA contra proporción NATURAL del
  archivo, foto por foto. Si difiere, hubo recorte o deformación. Vale para
  las sintéticas (2:1 apaisada, 2:3 vertical, 1:1 cuadrada) **y para las de
  verdad** del dueño: ninguna da diferencia > 4 %.
- La base puede estar vacía (5 marcadores) o tener fotos (N figuras): el test
  no exige alguno de los dos, exige que **no quede un estado mezclado**.
- columnCount 2 (mobile) y 3 (escritorio), carga `lazy`, `alt` presente,
  `object-fit` ≠ `cover`, y con la lista vacía por hook vuelven los
  marcadores.

Capturas con las fotos reales: `tmp_shots/41-gal-movil.png` y
`41-gal-desk.png`. **39 pruebas · 1035 comprobaciones · 0 en rojo.** El lote
quedó en el repo pero **no llegó a production** (se despliega con el 42/43,
abajo).

### Lo que queda del dueño (no del código)

- Subir más fotos desde el panel (**después de desplegar**: el panel de la web
  vieja no tiene la pantalla de Galería). La sección crece sola: entra la
  cantidad de fotos que suba, no hay tope.
- Las leyendas de las fotos (hoy el `alt` es genérico: "Trabajo de SSJ
  Barber"). Si algún día quiere una nota corta por foto, el documento puede
  crecer sin tocar código.

## 42. "No se pudo guardar" en reprogramar y en la agenda del barbero

El dueño probó en el sitio publicado y mandó pantalla: **"no me deja
reprogramar el turno" y "cada vez que ingresa el barbero le salta eso"**
(misma fila de reglas, dos síntomas). Se diagnosticaron las tres causas raíz
y queda un solo punto en la lista del dueño: **publicar las reglas**.

### Causa 1: las reglas no permitían cambiar el servicio al reprogramar

`Reprogramar` reusa el asistente y al confirmar hace **un solo update** del
turno con día, hora, barbero **y el servicio por si lo cambió**
(`s, sid, sn, sp, sm`). La regla de `turnos` para un update del cliente
sólo aceptaba `['d','t','bid','bl','st','mot','por','canEn']`: las claves del
servicio nunca entraban, y el write **denegaba siempre** con
permission-denied. No dependía de quién lo tocara: era del update en sí.
La lista pasó a incluir las cinco claves (y entró la misma validación de
formato de fecha/hora que tiene el create, así el update tampoco recibe
HTML). El riesgo de abrir `sp` queda comentado en las reglas: es cosmético,
porque el cobro lo carga el barbero con su propio precio.

### Causa 2: el barbero con reglas viejas falla en LECTURA, pero el aviso decía "guardar"

Con las reglas viejas publicadas, apenas entra el barbero la app tiene un
snapshot de `gastos`/`ventas` que la base le niega, y `err()` abría un cartel
que decía **"no dejaron guardar"**: una mentira, porque era la *lectura* la
que fallaba. El aviso de `permission-denied` ahora dice **"leer o guardar"**
en los dos textos (`ERR` y `motivoFirestore()`): el dueño entiende que la
salida es publicar reglas, no reintentar.

### Causa 3: el barbero veía el editor de porcentajes que le estaba vedado

En Finanzas, la tarjeta "Ganancia" le agregaba el `<details>` de
"Editar porcentajes" a **todos los que abren la pantalla**, aunque el
comentario de la línea decía *"Sólo lo ve el dueño"*. El barbero veía
"% del dueño por defecto", la marca SOS VOS y "+ Agregar barbero sin
cuenta" que no puede tocar (y que las reglas le niegan en cualquier
guardar). Ahora el gate del código (`own && fe`) cumple lo que el comentario
decía.

### Lo demás que va en el mismo lote

- **Avatar del header sin foto:** mostraba la inicial de la cuenta ("el
  signo" que señalaba el dueño). Ahora cae el **logo de la barbería**
  (`LOGO` de config.js, el mismo de la landing). Con foto sigue la foto.
- **Botones de las tarjetas de turno alineados y iguales** (Inicio y Mis
  Turnos): fila nueva `.chips.dos` en `styles.css` — dos columnas iguales,
  mismo estilo y mínimo táctil de 44 px, en vez de un botón con
  `flex:1;padding:11px` inline y otro suelto.
- **Alineado de textos del paso 1:** revisado en código: `.wz-item` es flex
  con `justify-content: space-between` y `text-align: left`, y las tres
  tarjetas comparten la misma clase. La pantalla desalineada que mandó el
  dueño es la **producción vieja (sw v11)**; si después de desplegar v21
  sigue viéndose raro, es un defecto nuevo y se labura por separado.

### Reglas y estado de la base al 21/10/26 (importante)

`FIRESTORE_RULES.txt` ahora incluye también la colección **`borrados/`** (va
con el lote 43) y las claves de reprogramar — **el archivo sigue SIN
publicarse**; publicarlo resuelve las pantallas del dueño a la vez:

- reprogramar vuelve a funcionar,
- el barbero deja de recibir permission-denied al leer gastos,
- y las cuentas del equipo quedan coherentes (ver ATENCIÓN abajo).

DERIVA detectada por el propio suite: **la cuenta CLIENTE de las pruebas
tiene documento `staff/`** (alguien la promovió a barbero desde el panel; el
suite no escribe `staff/`). `tests/landing.reglas.js` lo detecta y **salta
con ATENCIÓN** en vez de marcar rojo, imprimiendo la instrucción para
devolverla: panel > Clientes > "Hacer cliente", o borrar `staff/{uid}` en
Firebase Console. Mientras siga así, esa pantalla del suite corre con
cobertura reducida: la reseña no se puede probar con la cuenta como barbero.

### Pruebas

`tests/lote42.js` (nuevo, **23 comprobaciones**, archivo → sin navegador):
valida todo lo de arriba leyendo los fuentes y las reglas. `run.js` lo lista
junto a `galeria`. Cuando se commiteó el 42/43 la suite quedó en **40 pruebas ·
1051 comprobaciones · 0 en rojo** (`landing.reglas` con ATENCIÓN y salto por la
deriva de la cuenta CLIENTE, ver arriba). `sw.js` sube a `barberia-v21` para el
despliegue.

## 44. Mis Turnos con filtros: Próximos, Pasados y Cancelados

El dueño pidió (punto 5 de la tanda): **"aplicar filtros (proximos, pasados,
cancelado)"** en Mis Turnos. Hasta hoy la pantalla mostraba dos listas fijas
una debajo de la otra ("Próximos" y "Historial" mezclados los cobros con los
cancelados). Ahora la pantalla abre con **Próximos** y arriba hay un control de
tres filas de una sola: **Próximos · Pasados · Cancelados**, estilo *rubber
segment* (el que mandó el dueño adaptado a CSS/JS vanilla — mismo idioma
visual que pidió para los menús).

### Cómo queda

- **Próximos** = pendientes, ordenados de la fecha más cercana a la más lejana
  (igual que antes). Acá están los botones Reprogramar / Cancelar.
- **Pasados** = cobrados (`st: "hecho"`), el más nuevo arriba.
- **Cancelados** = sus propios turnos cancelados (el más nuevo arriba).
- Si la lista queda vacía, cada filtro tiene **su mensaje propio** ("Que se
  quede así" para cancelados) en vez del en blanco de antes.
- El filtro **no toca la base ni suma lecturas**: mismo `T` de siempre,
  filtrado en memoria. Y al cambiar de filtro se cierra el formulario de
  cancelación si quedó abierto, para que un formulario no quede flotando en
  una lista que ya no lo muestra.

### El control (y lo a11y)

Grilla de 3 columnas iguales con una ficha (thumb) que se desliza con
`translateX` y curva tipo resorte; `prefers-reduced-motion` la apaga. En
HTML es **`role="radiogroup"` con `role="radio"` + `aria-checked`**, y las
**flechas ←→ mueven y siguen el foco** (un radiogroup de verdad, no tres
pestañas). Botones de 44px: vale la regla táctil del proyecto.

### Pruebas

Los checks del filtro entraron en `tests/lote42.js` (**34 en total**, archivo →
sin navegador). Al commitear el lote: **40 pruebas · 1068 comprobaciones ·
0 en rojo** (una corrida previa de la suite marcó un ROJO en `accesibilidad`
que no era un check fallado sino un crasheo del proceso; la prueba suelta y la
corrida final pasan 0 violaciones). Pendiente lotes siguientes de la misma
tanda: el toggle-*squish* del tema, las fichas *flip* de barberos y el
*stepper* del asistente.

## 45. El toggle de tema es un SquishSwitch (y de paso, funciona con el dedo)

Punto de la tanda: adaptar el **SquishSwitch** que mandó el dueño (React +
motion) a vanilla. Hasta hoy el toggle del header era un botón cuadrado de
42px con un ☀︎/☾ de texto. Ahora es una **píldora de 64×34 con un knob dorado
de 26px** que:

- **cambia con un toque** (igual que siempre),
- **se puede arrastrar**: el knob sigue al dedo de punta a punta; si el
  arrastre no supera la mitad del recorrido, **vuelve sin cambiar** (el toque
  en falso no altera el tema), y si un **flick rápido** pasa por ahí, la
  velocidad decide la dirección,
- se **aplasta al apretar** y **rebota al soltar** — el efecto chicle del
  componente original, hecho con clases CSS + una transición con overshoot
  (nada de física en JS).

### Los detalles que importan

- **Sigue siendo el botón `#thm` de siempre**: mismo id, mismo aria-label
  "Cambiar tema claro oscuro", mismo lugar en el orden **casita - toggle -
  foto**. Nada de los tests ni nada del dueño se rompe por el cambio de
  forma.
- **a11y honesto**: `role="switch"` + `aria-checked` que pinta el módulo.
  Teclado: Enter y Espacio cambian (es un `<button>`). Foco visible.
- **El estado sigue viviendo donde siempre**: `body[data-theme]` +
  `localStorage "theme"`, aplicado **antes del primer pintado** (sin
  parpadeo al refrescar). El módulo de la mecánica no toca storage ni base —
  solo la física.
- En tema claro el track queda **marfil (no blanco puro)** y el knob va
  oscuro, para contraste; en oscuro knob dorado con luna.
- `prefers-reduced-motion` apaga el squash y el spring: el estado cambia,
  sin animación.

### Pruebas

`tests/lote45.js` (**24 checks**, archivo → sin navegador). Además:
`tests/ssw-visual.js` (manual, con `tmp/ssw-probe.html`) prueba la mecánica
REAL contra el módulo importado en un navegador: knob arranca izq., click
corto = flip, drag completo = flip, drag corto con vuelta atrás = sin cambio,
flick rápido = cambia, Enter y Espacio flipean — **10/10**, capturas
`tmp_shots/45-ssw-*.png`. La mecánica viaja en `src/ssw.js` para que la
landing pueda montar el mismo componente más adelante sin duplicar nada.
`sw.js` v22 (cambió main/index).

## 46. El asistente de reserva con el Stepper: el paso pasado se vuelve check

Otro componente de la tanda del dueño: el **Stepper**. Aplicado al header
del asistente de reserva (los 6 pasos: Servicio, Barbero, Día, Turno,
Horario, Resumen):

- El paso **ya recorrido** muestra **✓ dorado** en vez del número. La fila
  de progreso que ya existía (el borde superior de cada paso) sigue ahí para
  que se lea de un tirón hasta dónde se llegó.
- El paso **activo** conserva su número grande. **Esto sí importa**: varios
  tests (landing.barberos, landing.login, landing.modal, landing.registro)
  leen `.wz-paso.on b` esperando el número, y ahí sigue estando.
- En celular, donde la fila no muestra los títulos, la línea "Paso 6 de 6"
  ahora dice de qué paso se trata: **"Paso 6 de 6 · Resumen"** (antes solo
  ponía el número, sin contexto).
- **Sin animación de entrada en el header**, y es a propósito: el asistente
  repinta el header en cada selección (tocar un día, un horario), y una
  animación CSS se re-ejecutaría en cada repintado — los checks "saltarían"
  a cada rato. El estado habla solo.

### Pruebas

`tests/lote46.js` (**8 checks**, archivo → sin navegador). El recorrido
completo del asistente siguió pasando: `landing.wizard` corre los 6 pasos en
celular → EXIT 0 (la captura `tmp_shots/WZ-6-resumen.png` muestra los cinco
checks + el 6 activo), `landing.audit` EXIT 0. La fila nueva entra a `run.js`
después de `lote45`. `sw.js` sigue v22 (los lotes 44-46 comparten
despliegue).

## 47. Tarjetas de servicios alineadas: hueco honesto para las sin foto

Punto literal de la tanda: **"alinear los textos y que se vean igual"** sobre
las tarjetas de servicios de la landing. El descuadre no era de estilos: era
**estructural**. Los servicios de la base pueden tener foto o no (el campo
`img` es opcional), y las tarjetas sin foto sencillamente **no tenían el
bloque de la imagen**: los títulos arrancaban a alturas distintas y en una
fila quedaban pies (duración/precio) a alturas distintas.

### Cómo quedó

- Las tarjetas sin foto muestran un **hueco del mismo bloque 4/5** que la
  foto (mismo alto en cualquier ancho de tarjeta), en marfil, con una
  mini-tijera y el rótulo **"Sin foto"**. Es un placeholder honesto:
  declara que no hay imagen en vez de fingir una.
- Con el bloque igualado, lo que ya existía hace el resto: el cuerpo de la
  tarjeta es `flex: 1` y clava el pie (duración a la izquierda, precio a la
  derecha) al fondo → **títulos y pies de la fila quedan a la misma altura**,
  tenga o no foto el servicio y tenga o no descripción.
- La lista apilada de celular no cambia (filas de a una por servicio).

### Pruebas

`tests/lote47.js` (**7 checks**, archivo → sin navegador). Prueba visual con
fixture (`tmp/sv-probe.html` + landing.css real): `tests/sv-paridad.js`
(medidas de tops/pies iguales — **4/4**, captura `tmp_shots/47-paridad.png`).
Con la base real: `tests/servicios-foto.js` mide GRID en 1440 (3 servicios,
todos con foto: tops/pies iguales) y filas en 390; capturas
`tmp_shots/47-servicios-*.png`. `sw.js` sigue v22.

### Y un seguro extra para un flake de la suite

Dos corridas de la suite marcaron ROJO en `politicas` —
"dark/390 · el foco vuelve al link que abrió" — mientras la prueba sola
pasaba siempre 4/4. El mecanismo: si mientras el modal de políticas está
abierto la pantalla de ingreso se repinta (la verificación de sesión lo
hace), el **link que lo abrió queda reemplazado en el DOM**, y `focus()` a
un nodo desconectado no hace nada: el foco caía al BODY como si nadie
hubiera guardado el retorno. El código era correcto en el caso feliz y
frágil en el de la carrera. Ahora `cerrarPol` mira si el nodo guardado
**sigue vivo** (`isConnected`) antes de darle el foco y, si no lo está,
re-busca el link de `openPol` que siga **visible** como plan B. Los dos
checks nuevos de `lote47.js` sostienen ese seguro.

## 48. Horarios libres de hoy en el Inicio: tocá una hora y la reserva viene servida

Lo pedido: "en el inicio del cliente, horarios libres del día; al tocar un
horario, que abra la reserva con día y hora ya elegidos, saltando los pasos
3 y 4, pero que pueda volver".

- El Inicio del cliente gana una ficha **"Hoy · horarios libres"**, después
  del próximo turno: una fila por barbero (foto o inicial + nombre) y al
  lado los **chips de horas libres de HOY** — hasta 6 por barbero y un
  chip `+N` con el resto.
- Los horarios se calculan con el **servicio más corto** cargado (la nota
  al pie lo dice sin rodeos: "si elegís uno más largo, el asistente
  re-revisa la hora"). Honestidad por escrito: la ficha muestra dónde
  entra ALGO; la grilla del asistente es la que confirma el exacto.
- Tocar un chip abre la reserva con **barbero, día (hoy), hora y turno ya
  cargados** — el único paso que falta es el 1 (servicio). Al elegirlo, el
  asistente salta directo al **resumen** si la hora sigue entrando, o a la
  grilla real si no. Los saltos son adelante; **"Atrás" sigue pasando por
  cada paso de a uno**, con todo lo pre-cargado visible y marcado.
- La hora pre-cargada **no sobrevive a ciegas**: si el servicio elegido es
  más largo y la hora ya no entra, se cae sola y el asistente aterriza en
  el paso donde corresponda (turno u horario). El muro final sigue siendo
  la verificación al confirmar ("Horario ocupado —elegí otro"), que ya
  existía y se eleva igual.
- `+N` pre-carga barbero y día pero SIN hora: directo a la grilla real.
- Si hoy no queda ningún hueco (cerrado, completo o pasó la hora), la
  ficha lo dice y propone "Reservar otro día". Sin servicios o barberos
  cargados, no pinta nada: nada inventado.
- Chips de **44px de alto** (piso de toque del proyecto). El resto del
  asistente no cambia: en el flujo normal el "primer paso faltante" ES el
  siguiente (+1 de siempre); los saltos sólo aparecen cuando hay pre-carga.

### Pruebas

`tests/lote48.js` (**24 checks**, sin navegador): el helper del primer
faltante, el delegado `lbPrimerPaso`, `wzNext`/auto-avance aterrizando en
él, la hora pre-cargada que sobrevive o se cae según la grilla real, el
chip `libreRes`, `prep` honrando la pre-carga sin resumen vacío,
`lbAbreReserva` sin pisar el turno, el widget y sus 44px, y "Atrás"
lineal. Sonda manual con base real: `tests/libres-probe.js` (**9/9**,
captura `tmp_shots/48-libres-probe.png`) — con `09:00` libre de hoy: al
resumen directo, "Cambiar" a la grilla con la hora marcada; con `07:37`
fuera de grilla: aterriza en el 4 y Atrás muestra el calendario con HOY.

**Falta ver la ficha en pantalla**: el camino anónimo (modal) usa
exactamente el mismo código, ya probado; el camino del panel necesita una
cuenta de cliente desbloqueada (el doc de rol sigue en `staff/` hasta que
lo arregles — ver Pendientes). Cuando esté, miralo en el celu: es la
pieza más nueva del Inicio.

## 49. El toggle de tema de la landing es el mismo SquishSwitch de la app

Lo pediste al confirmar la tanda: el interruptor de goma de la cabecera
del panel también en la luna/sol de la esquina de la landing.

- Misma pieza, mismos gestos: clic limpio, arrastre de punta a punta con
  solta-a-la-mitad, chicle al apretar, rebote si va rápido, y teclado
  (Enter/Espacio) intacto por ser un botón.
- El estado sigue siendo el de siempre: el tema claro se guarda en el
  navegador y queda al recargar. Los íconos (luna en oscuro, sol en
  claro) ahora viajan con el knob, como en la app.
- El viejo círculo de 48px con los íconos desvanecidos se fue de una vez:
  no quedan dos toggles distintos en el proyecto.
- En claro el nuevo track va marfil (el tono del resto de la página) y no
  blanco puro — la misma lección del interruptor de la app.

### Pruebas

`tests/lote49.js` (**14 checks**) + sonda manual con base viva
`tests/lbtema-probe.js` (**7/7**, capturas `tmp_shots/49-tema-*.png`):
monta, cambia una sola vez por clic (el mouse no duplica el estado), el
knob y el aria-checked acompañan, y queda guardado al recargar. El
encabezado de la app no cambio ni un botón de orden (header.js sigue
verde); `ACT.lbTema` quedó dormido a propósito — lo usa el lote 25 como
límite de corte.

## 50. La pestaña activa del panel viaja con goma

Lo pediste al cerrar la tanda: la ficha dorada de la barra (arriba en
escritorio, abajo en celular) no cambia de golpe, se desliza de sección a
sección con la misma goma del filtro de Mis Turnos (lote 44).

- La ficha activa ya no es un fondo quieto de cada botón: es UNA sola
  píldora que viaja. Al tocar otra sección arranca donde estaba, se estira
  y cae en la nueva con la curva de goma (300 ms).
- Funciona igual en los tres roles y en los dos temas. En escritorio las
  fichas NO miden lo mismo (Dashboard 101 px, Galería 76 px): la píldora
  mide el botón real en cada momento en vez de repartir por cantidad.
- Si la sección activa vive en la bandeja de tres rayitas (el caso
  Mensajes en celular), la píldora se apaga: no queda marcada ninguna
  ficha visible, igual que antes.
- Con "reducir movimiento" del sistema no viaja: aparece directo en su
  lugar.
- Dos trampas que la sonda en vivo encontró y quedan documentadas: el
  borde dorado de 3 px de la barra de celular corría la píldora hacia
  abajo (se descuenta el borde al medir), y el nuevo elemento es el primer
  hijo de la barra, así que el corte de la bandeja pasó de esconder desde
  la cuarta ficha a esconder desde la quinta — sin eso Mensajes se comía a
  Clientes.

### Pruebas

`tests/lote50.js` (**30 checks**) + sonda manual con sesión del dueño
`tests/nv-probe.js` (**17/17**, capturas `tmp_shots/50-goma-*.png`): la
píldora calza exacta sobre la activa en 1440 y en 390, aterriza en la
sección nueva tras el clic, se apaga con el activo en la bandeja y cambia
de tono con el tema (dorado claro fijo en celular, donde la barra es
oscura en los dos temas; sobre el header claro en escritorio). `header.js`
sigue verde: la barra sigue siendo 3 fichas + tres rayitas en celular.

## 51. El título de Google dice "Barbería en Puerto Iguazú"

Volviste sobre el lote 40: el título que Google enseña ahora es
**SSJ Barber | Barbería en Puerto Iguazú** (40 caracteres, entra completo
sin recortar). En el lote 40 se había dejado corto —"SSJ Barber | Puerto
Iguazú"— y la palabra "Barbería" vivía sólo en la description; pediste
que el título también la diga.

- El cambio va en las cuatro superficies que tienen que coincidir: el
  `<title>`, `og:title` (lo que se ve al compartir por WhatsApp),
  `twitter:title` y la pestaña MIENTRAS se usa la app. Esta última es la
  que estaba rota de fondo: la app pisaba el título con "SSJ Barber"
  pelado en cada repintado (`document.title = NOMBRE`), así que el título
  largo del HTML duraba hasta el primer cambio de pantalla. Ahora el
  título sale de un solo lugar (`TITULO` en `src/config.js`) y las cuatro
  superficies dicen exactamente lo mismo.
- La marca no se toca: sigue "SSJ Barber", sin tilde, y el JSON-LD sigue
  con `name: "SSJ Barber"` (el nombre del negocio, no el título de la
  pestaña).
- La description no cambió.

### Pruebas

`seo.js` (80 checks) y `seo2.js` (44) siguen en verde con el título
nuevo: largo dentro del rango, nombra la ciudad, arranca con la marca y
dice "barbería". El comentario de `seo.js` que documentaba la decisión
corta del lote 40 quedó actualizado para que no mienta. `lote51.js`
(23 checks) vigila que las cuatro superficies digan lo mismo y que
ninguna vuelva a pisar el título con el nombre pelado.

## 52. La foto que Google enseña: ya no queda la vieja

Volvió a pasar lo del lote 51, pero con la foto: el título nuevo se
mostró en el resultado y **la imagen seguía siendo el logo viejo
("CODIGO Barber")**. La causa no es el sitio — el `logo-256.png` reemplazó
sus bytes por el logo SSJ Barber el 16/10 (lote 37); se bajó la foto que
sirve la web y es exactamente la del repo — sino que Google guarda la foto
de un resultado **por URL**: si la URL no cambia, sigue mostrando la copia
vieja que ya tiene, aunque el sitio sirva otros bytes. El texto se
actualiza solo en cada recrawl, la imagen no.

- Arreglo: `?v=2` en las cuatro URLs del logo que leen los buscadores:
  `og:image`, `twitter:image`, el `image` y el `logo` del JSON-LD.
  URL nueva = Google tiene que pedirla de nuevo y va a bajar la foto
  SSJ Barber. El archivo es el mismo (el servidor ignora el query); cuando
  se cambie el logo de nuevo, se sube a `v=3` en las cuatro.
- Lo que NO se toca a propósito: los links de icono y el `LOGO` de
  `config.js` (muestran el logo en la app, no cuentan en el índice de
  fotos de Google).

### Pruebas

`lote52.js` (16 checks) vigila las cuatro URLs versionadas, que no quede
ninguna pelada en el head y que la prueba de `seo.js` pida la versión.
`seo.js` (80) y `seo2.js` (44) en verde.

### Notas de la suite (no son de la foto)

La corrida completa dejó dos rojos que eran de las pruebas, no del sitio:

- `landing.modal` listaba 0 barberos en el primer pase: medía a los 250 ms
  y el asistente auto-avanza a los 280 ms de elegir barbero — una carrera
  con 30 ms de margen. Mide antes del clic y quedó verde.
- `lote25` contaba "$35.000 de facturado y punto": el dueño facturó
  $15.000 reales ese día y el panel los mezcla con los de prueba. Ahora
  mide lo real antes de inyectar y pide el DELTA (+$35.000 / +$25.000 /
  +$10.000).
