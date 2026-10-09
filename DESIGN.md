# Design System (estado actual)

## Tokens
- `--bg`: `#141c26`
- `--card`: `#1f2a38`
- `--ink`: `#f5f0e6`
- `--mut`: `#9aa7b4`
- `--line`: `#334257`
- `--navy`: `#141c26`
- `--brass`: `#c9a24b`
- `--red`: `#b3382c`
- `--blue`: `#8fa3b8`
- `--rad`: `14px`
- `--sh`: sombra suave de tarjetas

## Tipografías
- `Barlow Condensed` para titulares y precios.
- `Barlow` para UI y texto.

## Componentes
- Header sticky 88px (76px mobile), fondo `#141C26`, borde `#2E3C4E`.
- Logo 54px desktop, 46px mobile, marca dorada con letter-spacing amplio.
- Links 1.2rem, peso 500, `white-space: nowrap`, underline dorado al hover.
- Botón principal: dorado, alto 54px, padding `0 30px`, texto 1.1rem.
- Hero: two columns desktop, stack mobile.
- Servicios, galería, testimonios, contacto en grid responsive.
- Formularios: inputs de 56px, textarea 150px, botón 60px uppercase.

## Animación
- `.reveal` con IntersectionObserver.
- Hover de tarjetas con `translateY(-4px)`.
- Botones con `active scale(.97)`.
- `.soc` despliega número/handle de derecha a izquierda.

## Restricciones
- `100dvh` en vez de `100vh`.
- Sin scroll horizontal.
- Menú hamburguesa con cierre por link, Escape y resize >900px.
