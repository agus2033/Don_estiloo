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
