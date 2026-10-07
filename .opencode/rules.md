# Reglas de diseño / UI-UX para Codigo Barber 1

Proyecto: web/app de barbería "Codigo Barber 1" (turnos online + puntos).
Tecnología: HTML/CSS/JS en `index.html` + `src/main.js` + `src/styles.css`, Firebase/Firestore.
Modo oscuro por defecto. Idioma de producto: español rioplatense (voseo).

## Estética
- Dark tech elegante: fondo `#141C26`, alterno `#10171F`, tarjetas `#1F2A38`, bordes `#2E3C4E`.
- Dorado `#D4A84B` solo como acento sólido (CTAs, enlaces de marca, precios). No hay glows neón ni degradados lila/IA.
- Sin negro puro (`#000`) ni blanco puro (`#fff`). Usa marfil `#F5F0E6`, secundarios `#9AA6B4`.
- Una sola familia tipográfica por componente: Barlow Condensed (titulares/números de precio/labels) y Barlow (texto). No mezcles seriffadas gratuitas.
- Botones principales con fondo dorado y texto oscuro sobre el dorado; cards con radio 12-16px; sombras suaves y tintadas, nunca `box-shadow` negro duro.

## Componentes obligatorios
- Header sticky único, 88px desktop / 76px móvil, oscuro, borde inferior `#2E3C4E`, CTA dorado de 54px.
- Menú hamburguesa móvil con `aria-expanded`, `aria-controls`, `aria-label` mutable, ícono→X, panel 100dvh debajo del header, links grandes, scroll lock mientras abierto, cierre por link, Escape y al pasar a >900px.
- Hero con strip de barbero rojo/blanco/azul (detalle de la marca) arriba del card, CTA único "Reservar ahora" y badge de 20 puntos.
- Cards de servicios: grid responsive (3 cols PC, 1 móvil), ícono/miniatura 56px, nombre, duración y precio, CTA "Reservar" por servicio.
- Galería publica desde config/barberos/finanzas/servicios; desde Ajustes/Servicios se puede subir imagen por servicio; barberos/dueños suben foto desde Agenda/Barberos; cliente sube foto desde Inicio.
- Formulario de contacto "Dejanos tu mensaje": fondo alterno #10171F, dos columnas PC (texto izq, formulario der), apilado móvil. Campos Nombre (opcional), Email (obligatorio, asterisco rojo, type=email), Mensaje (textarea ≥150px), ENVIAR MENSAJE dorado 60px ancho completo. Inputs 56px, radio 12, focus dorado + halo, validación y estados `role=status`/``aria-live=polite``, sin dobles envíos, limpia al enviarlo bien.
- Footer: marca, créditos, links Políticas y Privacidad que abren el mismo modal `polH()` (texto versionado/app `Versión 1.0`).

## Animaciones y movimiento
- Animá SOLO `transform` y `opacity`. Nunca `width`/`height`/`padding`. CSS transitions en vez de keyframes en UI dinámica.
- Duraciones: entradas 200-300ms; feedback de botón 100-160ms; drawer/modal 200-500ms; UI general <300ms.
- Easings: usar custom, por ejemplo `cubic-bezier(0.23, 1, 0.32, 1)` para ease-out, `cubic-bezier(0.32, 0.72, 0, 1)` para drawers; nunca `ease-in` para entradas de UI.
- Estados: `:active` con `transform: scale(0.97)`, `:hover` con `transform:translateY(-1px)`; transform-origin coherente con el trigger; popovers se abren desde su botón (no center); modales centrados.
- Nunca animations "por moda" ni infinitas: marquee/parallax solo motivados; máximo una marquesina por página.
- `prefers-reduced-motion: reduce` desactiva transforms/parallax/marquesinas (dejamos transitions de color/opacidad suaves).
- `100dvh` en lugar de `100vh` para hero/paneles; nada de `h-screen`; mobile safe-area.

## Responsive
- Hasta 900px: nav links se ocultan, aparece hamburguesa; panel ocupa `100dvh`.
- Hasta 1000px: hero, "Acerca de", Contacto y formulario en una sola columna; galería a 2 columnas.
- Hasta 640px: márgenes 16px, tarjetas en una columna, botones principales full width.
- Tablas/listas largas: evitar scroll horizontal; usar grid/columnas fluidas y `max-width`.
- Tipografía adaptable con `clamp` en titulares/precios.

## Quality / a11y
- CTA de marca: un único label "Reservar ahora"; no duplicar "Crear cuenta" en la landing.
- "Reservar ahora" siempre apunta a `RESERVAR_URL` en `src/config.js` (hoy `#login`, que abre la pantalla de login del proyecto).
- Contraste mínimo AA en botones/labels/formularios; inputs placeholder legible; `tel`/`email` con validación.
- Sin emojis por defecto; íconos/imagenes como assets en `assets/`.

## Config rápida (TODO del dueño)
En `src/config.js`, buscar la etiqueta de cada item:
- `WHATSAPP`: número con código de país (ej. 54911...)
- `INSTAGRAM`: usuario sin @ (hoy `codigobarber_1`)
- `MAP_IFRAME`: pegar el `src` del iframe de Google Maps
- `RESERVAR_URL`: dónde abren los botones "Reservar ahora"

Reglas Firestore: ver `FIRESTORE_RULES.txt` y configurarlas en el proyecto Firebase `barberia-taccu` (Firestore Database > Reglas > Publicar).
