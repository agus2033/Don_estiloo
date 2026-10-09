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

## Brand Commitments

- Tono: cercano, canchero, voseo rioplatense. Sin clichés machistas ni textos genéricos.
- Identidad visual actual: fondo carbón azul, marfil, dorado, rojo barbero reservado para detalles y acentos.
- Tipografías ya cargadas: `Barlow Condensed` (600/700, mayúsculas) para titulares, botones y precios; `Barlow` (400/500/600) para el resto.
- **Nombre de marca: "Codigo Barber".** Confirmado por el dueño. Vive en un solo lugar:
  - `src/config.js` → `NOMBRE = "Codigo Barber"` (el origen de verdad: header, modal, pie, login, privacidad, `document.title`)
  - `index.html` → `<title>`, `og:site_name` (estáticos: no los reescribe el JS, hay que cambiarlos a mano)
  - `manifest.json` → `name` y `short_name` (estáticos, y ahora sin BOM para que lo parsee cualquier `JSON.parse`)
  - La etiqueta del logo nuevo dice "Codigo Barber"; antes el mockup decía "Don Estilo", nombre que ya no se usa en ningún lado.
  - Instagram `@codigobarber_1` y email `codigobarber1.com` sugieren "Código Barber" sin el sufijo numérico, que parece residuo del scaffold.
  Decisión del owner (2026-10-08): **dejarlo cableado a `NOMBRE` en `src/config.js` y que él lo cambie.** La landing no debe hardcodear el nombre; todo texto de marca sale de `NOMBRE`.

## Evidence on Hand

Contenido real y verificado en el código (fuente de verdad):

- Servicios por defecto (`S` en `src/config.js`): Corte (Incluye cejas) 30 min $15.000 · Barba 30 min $8.000 · Corte + barba 60 min $20.000. Editables por el barbero desde la app.
- Puntos: 20 de bienvenida, `PTS = 5` por corte completado.
- Premios (`PR` en `src/config.js`): Descuento 20% a 25 pts · Descuento 50% a 50 pts · Corte gratis a 100 pts.
- WhatsApp `5493757644751`, Instagram `codigobarber_1`, email `hola@codigobarber1.com`.
- Fichas de barbero (`config/barberos`): nombre, foto, porcentaje. Se publican desde Finanzas.
- Galería: colección `galeria` en Firestore, subida por el barbero.

**Ausencias que el trabajo futuro NO debe inventar:**

- **Testimonios**: no hay reseñas reales cargadas. La colección se lee (`TESTS`) pero está vacía en producción. La landing debe mostrar marcadores visibles con TODO, nunca textos de ejemplo presentados como opiniones de clientes.
- **Fotos de galería**: sin imágenes reales publicadas.
- **Dirección y horarios**: el código actual tiene un placeholder literal `[DIRECCIÓN]` y un mapa de ejemplo (`MAP_IFRAME` con coordenadas de muestra). Reemplazar con datos reales.
- No hay carpeta `referencia/` con capturas del mockup; la descripción textual del prompt es la fuente de verdad visual.

## Product Principles

1. **Reservar es la única acción principal.** Un solo llamado a la acción en toda la landing. Nada de "Crear cuenta" como CTA en la landing: el registro ocurre dentro del flujo de reserva.
2. **El contenido real manda sobre el diseño.** Servicios, barberos, precios, horarios y galería salen de Firestore. Si falta, se muestra un marcador, nunca un relleno inventado.
3. **Los puntos se entienden en un vistazo.** El programa de puntos es un objetivo de producto, no decoración: la tarjeta de progreso tiene que mostrar el balance real del cliente.
4. **Mobile primero de verdad.** 390px es el diseño; 1440px es la adaptación.
5. **Sin ADMIN ni credenciales en el repo.** `src/config.js` expone la `apiKey` de Firebase (pública por diseño, restringida por dominio) y `ADMIN_UID`. No agregar secretos nuevos ni exponerlos en la landing.

## Accessibility & Inclusion

Objetivo: WCAG 2.1 AA en claro y oscuro. Contraste mínimo 4.5:1 en texto de cuerpo y 3:1 en texto grande y bordes de componente. Navegación por teclado en todos los controles, foco visible, `aria-pressed` en chips seleccionables, `aria-expanded` en el menú móvil, `role="status"` + `aria-live="polite"` en los mensajes de estado del formulario. Todo input con `font-size` mínimo 16px para evitar zoom automático en iOS. Respetar `prefers-reduced-motion`.
