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
