Continuamos con **Codigo Barber** (repo: `C:\Users\agus2\OneDrive\Documentos\GitHub\Don_estiloo`).

**Leé `PRODUCT.md` primero**: tiene el schema actual del producto, las decisiones tomadas y la sección "Evidence on Hand" con lo que NO hay que inventar. Después `git log --oneline -8` para ver qué se fue haciendo.

Sitio en vivo: `don-estilo.vercel.app`. Es HTML/CSS/JS estático, sin build. Firebase: proyecto `barberia-taccu`, Cloudinary `lvrsdw0h`.

---

## Cómo levantar y probar

```powershell
python -m http.server 8765          # tiene que quedar corriendo en otra terminal
node tests\logic.test.mjs          # 20 tests puros de lógica de turnos
node tests\landing.audit.js         # contraste AA + worst case sin overflow
node tests\landing.header.js        # nombre de marca por 16 anchos
node tests\landing.modal.js         # identidad y velo del modal de reserva
node tests\landing.tema.js          # modo claro en los tres paneles
node tests\landing.wizard.js        # los 6 pasos del asistente de reserva
node tests\landing.wizard-a11y.js   # contraste del asistente
node tests\landing.web.js           # ida y vuelta panel <-> landing
node tests\landing.login.js         # 3 roles + las 12 rutas de cada uno
node tests\landing.registro.js      # alta de cuenta real (crea una, se borra)
node tests\landing.reglas.js        # foto del barbero + reseña (y limpia lo que crea)
node tests\resenas.listado.js       # qué reseñas hay, agrupadas por texto
node tests\resenas.limpiar.js       # borra las de prueba (dry-run sin --borrar)
node tests\landing.sync.js
node tests\landing.barberos.js      # la tarjeta que se da vuelta (giro, teclado, inert)
node tests\flip.shots.js            # capturas de la tarjeta cerrada y dada vuelta
node tests\politicas.js             # hoja móvil / documento escritorio + a11y del modal
node tests\politicas.shots.js       # capturas de las 6 secciones
node tests\tokens.claro.js          # tokens del panel: cuál gana y su contraste
node tests\panel.contraste.js       # contraste real del panel, 3 roles x 2 temas
node tests\botones.contraste.js     # nombra los botones que no llegan a 4.5:1
node tests\css.muerto.js            # qué reglas del CSSOM no matchean nada
node tests\panel.shell.js           # menú inferior, menú del perfil, Ajustes y borrar cuenta
node tests\panel.turnos.js          # reprogramar y cancelar + la política de 2 h (no escribe en Firestore)
node tests\panel.shots.js           # capturas del panel: escritorio y celular
node tests\landing.shots.js
```

**Los que miden, no miran:** `tokens.claro.js`, `panel.contraste.js`, `botones.contraste.js`, `css.muerto.js` y `politicas.js` recorren el navegador real y dan números. Necesitan el servidor en el 8765; `panel.contraste.js` además lee `.env.local` (mismos roles que `landing.login.js`).

`css.muerto.js` sólo mira la landing. Para el panel hay que cruzarlo con `Select-String` sobre `main.js`, porque muchos selectores compuestos (`body.login .lnd`) no aparecen por el nombre de clase.

**`tests\color.js` es el parser de color compartido.** `P`, `comp`, `lum`, `ratio`, `hex`, `minimo` y `src` (las mismas, como string, para pegar dentro de `page.evaluate`). **Usalo en vez de volver a escribir el parser**: ya se reimplementó cuatro veces y falló tres. Para medir dentro de la página:

```js
page.evaluate(({ src }) => {
  const { fondo, __P, __comp, __R, __min } = new Function(src + ";return {fondo,__P,__comp,__R,__min};")();
  ...
}, { src });
```

`new Function` y **no** `eval`: dentro de `page.evaluate` un `eval` con `const` no define nada en el ámbito de la función que lo contiene y tira `fondo is not defined`. Y definí las funciones con su **nombre real**, no renombradas al prefijo: `ratio.toString()` arrastra la referencia interna a `lum` por su nombre original.

`landing.login.js`, `landing.registro.js`, `landing.web.js` y `landing.reglas.js` leen `.env.local` (está en `.gitignore`). Los roles son `cliente` / `barbero` / `dueno`, con sus vistas y nav esperados ya codificados en el archivo.

Las capturas se escriben en `tmp_shots/`.

---

## Los cuatro pendientes, en orden de valor

### 1. Auditoría del modo claro — el patrón que se repite

**Este es el más importante y es una causa raíz, no un bug suelto.**

Encontré esta clase de problema cuatro veces: **elementos del markup con clases que nunca tuvieron CSS de layout**, que en pantalla se veían bien solo por accidente y se rompen en cuanto se toca el markup.

Casos ya encontrados y arreglados, para que no los repitas:

| Clase | Qué pasaba |
|---|---|
| `.lb-field` | Sin layout. El `<textarea>` de contacto quedaba al lado de la etiqueta (es inline por defecto) y se encogía al ancho por defecto |
| `.lb-addr` | Sin CSS. Las tres líneas de la dirección se corrían: "Francisco**Los** Trabajadores" |
| `.lb-hor` | Era una `<table>` con 7 filas, 4 de ellas idénticas. Ahora es una `<ul>` agrupada por horario |
| `#thm` | Fondo blanco fijo: en modo claro quedaba un cuadrado blanco |
| `.polbox` (todo el modal de políticas) | **Cero CSS.** Salía `position:static` y empujaba la página de 844 a 2818 px, con el texto debajo del pliegue |

**Lo que hay que hacer:** recorrer el modo claro completo mirando no solo si "se ve bien" sino si algo tiene **color hardcodeado** en vez de token. **Ya está hecho con medición, no a ojo** — corré `node tests\panel.contraste.js` y arreglá lo que reporte. Estado actual: **0 textos bajo el mínimo** en los 3 roles x 2 temas.

Bugs reales que salieron de esa medición (ya arreglados):

| Qué | Por qué rompía |
|---|---|
| Bloque `.lnd-*` de `styles.css` (~190 líneas) | De sus 44 clases sólo seguían en uso `.lnd-gal` y `.lnd-cta`. Al final redefinía `body[data-theme="light"]{--brass:#D4A84B...}` **después** del bloque canónico: misma especificidad, ganaba el último, y el dorado claro quedaba en **1.95:1** |
| Un solo token `--brass` para texto y para fondo | requisitos opuestos: legible sobre marfil pide 5.09:1, pero como superficie tiene que dejar leer el `#141c26` de encima (7.76:1). Separado en `--brass` (tinta) y `--brassFill` (superficie), como ya hacía `landing.css` con `--lb-brass` / `--lb-brass-solid` |
| Idem con `--red` | `#b3382c` como texto daba 2.43:1 sobre la tarjeta. Separado en `--red` (tinta, `#e0705c`) y `--redFill` (superficie, `#b3382c`, la que lleva texto blanco) |
| `.boton.primario { color: var(--bg) }` | El fondo es dorado en los dos temas pero `--bg` es navy en oscuro y marfil en claro: el botón quedaba en **2.11:1** en modo claro. Ahora el texto es `#141c26` fijo |
| `.kpis .card.kpi` con degradado duro `#1f2a38 → #1a2431` | No seguía el tema: en claro la tarjeta quedaba oscura con texto claro encima, a 1.01:1. Ahora se deriva con `color-mix` de `--card` y `--bg` |

Queda como deuda menor, sin impacto medido en contraste: `header { box-shadow: 0 4px 18px #0b0f1559 }` y varios `color: #a9b4c4` / `background: #141c26` fijos que son sombras y acentos, no texto sobre superficie. Si algún día molestan, se pasan a token; el test no los marca.

Los tokens claros ya existen: `styles.css` tiene un bloque `body[data-theme="light"]` con `--bg / --card / --ink / --mut / --line / --brass / --red / --green / --warn`, y `landing.css` tiene su juego `--lb-*`. **El objetivo es que no quede ni un color crudo** en estilos interactivos.

Metodología que sirvió: no mirar capturas, **medir**. Sacar `getComputedStyle` de cada elemento y calcular el ratio contra el fondo real. Ojo con esto:

- `backgroundColor` puede ser `rgba(0,0,0,0)` (transparente): hay que **subir por los ancestros** hasta encontrar el primer fondo real. Ya me pasó: `.card.kpi` es transparente y me dio un ratio falso de 1,2 cuando el CSS estaba bien.
- `color-mix()` y `color()` devuelven `color(srgb 0.9 0.87 0.8)` con canales de 0 a 1. Un parser ingenuo lee 0,9 como 0,9/255 y reporta contrastes falsos.
- Si agregás contraste a un test nuevo, reusá el `parse()` de `tests/landing.audit.js`, que ya resuelve las dos cosas.

### 2. Políticas en modal (celular) / página completa (escritorio) — **HECHO**

**Lo que había:** `polH()` existía, `openPol`/`cerrarPol` existían… y **cero CSS**. `.polbox` no tenía ni una regla en `styles.css`: el modal salía con `position:static` y **empujaba la página de 844 a 2818 px**, con todo el texto debajo del pliegue. Inaccesible. Es la quinta vez del patrón de "clase del markup sin CSS".

**Lo que hay ahora** (`src/main.js` `polH()`, CSS al final de `styles.css`):

- **Celular:** hoja desde abajo con tirador, encabezado y pie **fijos**, sólo scrollea `.pol-body`. La ✕ nunca queda fuera de pantalla.
- **Escritorio (≥861px):** hoja a pantalla casi completa, 1040 px, con las 6 solapas de navegación arriba y el pie fijo abajo. El tirador se oculta.
- **6 secciones** con solapas reales (`role="tablist"` + `role="tab"` + `aria-selected` + `aria-controls` + `role="tabpanel"`): En resumen / Datos / Uso / Derechos / Condiciones / Cambios. 13 bloques numerados, como el mockup.
- **Contenido nuevo respecto al texto anterior:** tabla de "qué datos / para qué / si es obligatorio" (7 filas), las 4 tarjetas de derechos **con su plazo** (10 / 5 días hábiles), íconos de línea en SVG, y las 4 de "en resumen".
- **A11y:** foco atrapado dentro del modal, Escape cierra, **el foco vuelve al link que lo abrió** (con `preventScroll`), ← → Home End mueven las solapas y enfocan, la solapa activa se trae al centro de la fila si quedó fuera de vista.

**Lo que NO se inventó:** razón social y domicilio no están en `config.js`, así que salen como chips punteados con la etiqueta del hueco (`.pol-pend`) en vez de un dato falso. El email sí viene de `EMAIL` en `config.js`.

> **El texto legal necesita que lo revise el dueño.** La estructura y los plazos salen del mockup, pero el texto largo lo compuse yo a partir del que ya estaba y de lo legible en la imagen de referencia (que estaba a baja resolución). Las frases de "Tus derechos" y "Con quién los compartimos" son las que más conviene revisar palabra por palabra.

`tests\politicas.js` (132 checks) y `tests\politicas.shots.js` (capturas de las 6 secciones).

### 3. Galería: hover + "ver más"

Hoy la galería **muestra todas las fotos, sin tope** (fue una decisión explícita: no recortar nunca contenido del cliente).

- **Hover** con algo discreto: un velo sutil y/o zoom lento, respetando `prefers-reduced-motion`.
- Si hay **más de 8 fotos**, mostrar 8 y poner un botón **"Ver más"** que lleve a **otra página** con todas.

Para la página nueva hay que decidir la ruta: el router (`RT` en `main.js`) maneja `#/inicio`, `#/servicios`, `#/galeria` etc., pero `galeria` es una vista del panel del barbero, no de la landing. Lo más limpio es un archivo aparte tipo `galeria.html` que lea `galeria` de Firestore, o una ruta nueva en `RT`. **Decidilo y dejalo escrito en `PRODUCT.md`.**

### 4. Las reglas de Firestore — **funcionan. El test mentía.**

**Las reglas publicadas están bien**: un cliente **sí** puede dejar su reseña. Se comprobó mirando el tráfico de red — la escritura va a `documents/resenas/…` y vuelve `200`, sin `PERMISSION_DENIED` — y la reseña aparece en el carrusel público de la landing.

El que estaba roto era `tests\landing.reglas.js`, por cuatro cosas a la vez:

1. **El asistente tiene TRES pasos** (estrellas → texto → revisar) y `revSend` está en el tercero. El test llegaba al segundo y después buscaba el botón, no lo encontraba y daba "sin diálogo". Yo caí en lo mismo con mis sondas: **no se estaba probando nada**.
2. **Esperaba un modal de "gracias" que la app nunca muestra.** En éxito `revSend` no abre ningún modal: pone un `<p class="msg">` y vuelve al inicio. El modal sólo aparece si el write falla.
3. **Leía el cuerpo del modal como `.mc`**, pero `M()` lo escribe en `.mt`. Aunque hubiera habido error, el mensaje salía `undefined`.
4. **No borraba la reseña que creaba.** De ahí las huérfanas.

Ahora el test verifica lo que importa — que la reseña **llegue a Firestore** (mirando el carrusel público en un contexto sin sesión) — y **limpia lo que creó** borrando sólo los documentos cuyo texto empieza con la marca única de la corrida. Las reseñas reales no se tocan por construcción.

### 4b. Un bug real que salió de ahí: el cliente no veía confirmación

`revSend` hacía `msg = …; R(); W.goNow("home")`. Pero `R()` **borra `msg` al final de pintarlo** (línea ~4982) y `goNow` vuelve a llamar a `R()`. Los dos renders pasan en el mismo tick, así que el navegador **nunca llegaba a mostrar el mensaje**: el cliente guardaba su reseña y no veía ninguna confirmación. Ahora se replica el patrón del resto de la app —preparar, poner el mensaje, un solo `R()`— y `landing.reglas.js` lo cubre.

### 4c. Limpiar las reseñas de prueba que quedaron en producción

Hay **12 reseñas: 10 de prueba y 2 reales**. Las 10 se ven en el carrusel de la web.

```
node tests\resenas.limpiar.js            # lista, NO borra
node tests\resenas.limpiar.js --borrar   # borra sólo las de prueba
```

El script clasifica por el prefijo del texto (`qa-reglas-`, `Diagnostico `, `Prueba automatica de reglas`) y las reales quedan intactas. Si preferís hacerlo a mano, son estos IDs:

| ID | Texto |
|---|---|
| `14cw9sLaJdyP3qrX7ejk` | Diagnostico 21:45:23 |
| `5E5yLjI8pQMJF6TVC8tC` | Prueba automatica de reglas |
| `CzOVnZcN3LtYfQdT6QDN` | Prueba automatica de reglas |
| `QWO1DdbSh8nfxFIUac99` | Prueba automatica de reglas |
| `QtM3AWwcPb7qM9Ok3O3r` | Prueba automatica de reglas |
| `XVj1YiwktPlve7KMGotZ` | Prueba automatica de reglas |
| `jRof7AEDoFnD4C5tJNgk` | Prueba automatica de reglas |
| `neGbRozpqGk0QSFEJzdB` | Prueba automatica de reglas |
| `yppNl95dvNLoKivsT2aT` | Prueba automatica de reglas |
| `zkjuSa1sALQIopBj8les` | qa-reglas-1791582451204 |

**Las 2 que hay que conservar:** `IHvda4eBBWXsHhrE56YS` ("asd") y `rEZrVeJ8hwAphQng5U9g` ("Muy bueno el corte").

> `node tests\resenas.listado.js` reimprime el listado en cualquier momento.

---

## 5. Rediseño del panel del cliente - **HECHO**

Adaptación de tres mockups del dueño (`Panel · Inicio@2x.png`, `Panel · Reseña@2x.png`, `Panel · Reseña celular@2x.png`).

**Lo que pidió, y cómo quedó:**

| Pedido | Cómo quedó |
|---|---|
| Menú abajo en el celular | Ya existía como `position: fixed`; se ajustó la sección activa a píldora dorada. En escritorio la barra queda en línea dentro del header. |
| Hamburguesa **en la foto de perfil** | Nuevo `#perfil` (las rayitas) al lado de la foto. Abre `#pmenu`, un dropdown propio **separado del `#nmenu` del admin**: el cliente no tiene secciones de configuración, sólo **Ajustes / Ver la web / Cerrar sesión**. |
| Editar el perfil de cliente | Nueva vista `ajusH()` en `#/mi-cuenta`, con nombre, teléfono y "Guardar cambios" (`guardarPerfilCli`). |
| "Eliminar cuenta" **al final** de Ajustes | Última tarjeta, con borde rojo. El botón es `borrarAsk`, o sea el **mismo modal de aviso** de antes: no se agregó uno nuevo. |
| Diseño de Inicio | `homeH()` reescrito: saludo con subrayado dorado, "Tus puntos" + "Próximo turno" en dos columnas, tres accesos (el primero dorado) y la franja "¿Cómo te fue en tu último corte?". Los premios quedan **abajo**, no se sacaron. |
| Diseño de Reseña | `revH()` reescrito: indicador de 3 pasos, 5 estrellas en cajas con su etiqueta ("Muy bueno"), y **vista previa** de cómo se va a ver en la web. |

**Cuatro decisiones que no son obvias:**

1. **El hash del cliente es `#/mi-cuenta`, no `#/ajustes`.** El dueño ya tenía `cfg: "ajustes"`; si el cliente compartiera la palabra, caería en la vista de reglas y premios.
2. **"Ver la web" y "Cerrar sesión" no se borraron, se movieron.** `#web` y `#lo` siguen en el HTML (el admin los usa) pero para el cliente se ocultan **con CSS** (`body:not(.adm) #web, body:not(.adm) #lo`), no sólo con `hidden`: los dos tienen `display:inline-flex`, y eso le gana al `[hidden]` del navegador.
3. **El `prep()` cierra el menú del perfil.** Sin eso, entrar a Ajustes desde la foto dejaba el dropdown abierto encima de la vista nueva.
4. **La pantalla de Reseña usa `grid-template-areas`, no dos contenedores.** Agrupar título+panel a la izquierda e indicador+previa a la derecha fijaba el orden, y en el celular el indicador quedaba **debajo** de la tarjeta en vez de arriba como en el mockup.

**Dos bugs que salieron al medir, no al mirar:**

- La tarjeta dorada "Reservar turno" salía **oscura con texto oscuro**, ilegible. `.card` está declarado más abajo en `styles.css` y le ganaba a `.ini-acc--pri` por tener la misma especificidad. Se arregló con `.card.ini-acc--pri` (dos clases).
- Al volver los títulos con subrayado dorado (`display:inline-block`) **ítems de grilla**, se blockifican y el `justify-self` por defecto los estira: el texto quedaba centrado y la raya dorada estirada. Llevan `justify-self: start`.

`tests\panel.shell.js` (51 checks) y `tests\panel.shots.js` (capturas escritorio + celular).

### 5b. Un test que mentía: `landing.web.js`

Buscaba el botón `#web` en el header del cliente. Después del rediseño ya no está ahí, así que el test crasheaba con un timeout de 30 s. Se actualizó para verificar que **el cliente llega a "Ver la web" por el menú del perfil** y que **el dueño lo sigue teniendo suelto en el header**. Un test que falla después de un cambio pedido no es un test roto: es un test que hay que actualizar, pero sólo si el cambio fue intencional.

### 5c. Falla de contraste REAL, encontrada y **sin arreglar**: el asistente en modo claro

`landing.wizard-a11y.js` reporta 2 fallos en tema claro, paso 1:

```
.wz-item-t b      1.44:1  (mínimo 4.5)
.wz-item-t small  1.96:1
```

O sea **la lista de servicios del asistente es casi ilegible en modo claro**. **No lo introdujo este trabajo**: el diff de `landing.css` de esta sesión no toca `.wz-item-t`, ni `.wz-item`, ni `--lb-ink`.

Y no cuadra con los números: `.wz-item` usa `background: var(--lb-bg)` y `color: var(--lb-ink)`, y en claro son `#f5f0e6` / `#141c26`, que dan ~14.7:1, no 1.44:1. Con `--lb-mut` (`#55637a`) el cálculo da los 5.36:1 que dice el comentario. **Así que el fallo medido no viene de donde parecería**: hay que abrir el asistente en claro y sacar la cadena real de colores hasta el fondo antes de tocar nada. Es el próximo paso, y no se debe "arreglar" a ciega oscureciendo un token.

### 5d. El bug de contraste del asistente: **RESUELTO** (era CSS filtrado, no tokens)

El punto 5c de arriba ("contraste del asistente en modo claro, 1.44:1 y 1.96:1, sin explicación") quedó resuelto, y **la causa no eran los tokens**. Era esto:

`styles.css` (el CSS del **panel**, que se carga en el mismo documento) tiene

```css
button:hover:not(:disabled) { background: #2a3849; }
```

Un azul oscuro **clavado**, pensado para los botones del panel. Como el asistente de la landing vive en la misma página, esa regla le entraba a sus tarjetas: al pasar el mouse, `.wz-turno` (un `<button>`) se ponía azul noche con el texto casi negro encima. En el celular era peor, porque **`:hover` se queda pegado después de tocar**: la tarjeta quedaba oscura fija.

Cómo se encontró: `landing.wizard-a11y.js`|reportaba 1.44:1, pero `--lb-mut` sobre `--lb-bg` da 5.36:1 — o sea, los números no cuadraban con el CSS. Listingando las reglas del CSSOM que matcheaban el elemento apareció `button:hover` con un fondo que en `--lb-*` no existe. Mismo método que en `.wz-dows`: el número raro es la señal de que hay que ver **qué regla gana de verdad**, no asumir por el nombre de la clase.

**Dos lessons que ya están anotadas como trampas 10h e 10i.**

Además se bajó `opacity` a nada en `.wz-turno.off`: el "apagado" se marca ahora con color y tachado. Con `opacity: .45` el texto quedaba en 2.8:1 en claro, y **no hay opacidad que llegue a 4.5:1** sin que la tarjeta deje de leerse como apagada (a `.85` seguía en 3.93:1).

---

## 6. Lote de cambios del dueño (11 pedidos) - **HECHO**

| # | Pedido | Qué se hizo |
|---|---|---|
| 1 | Arreglar la vista previa de la reseña | Ahora muestra **el texto**, no sólo foto + nombre + estrellas. Contexto: lo único que se publica es el texto, y la vista previa mostraba lo mismo para cualquier reseña. |
| 2 | Achicar el calendario en computadora | El asistente del panel **no tenía ancho máximo**: `.wz-sheet{max-width:520px}` sólo existe en el modal, así que en el panel ocupaba los 1040px y las celdas quedaban de ~140×140. Con `#wiz{max-width:560px}` volvieron a 77×77. |
| 3 | En celular, sacar los botones de "continuar" | `wzEsCelular()` + `wzAvanzaSolo()`: al elegir se pasa solo (280 ms). Quedan "Atrás" y "Confirmar turno". El botón de escritorio **no se quita**. |
| 4 | Reprogramar y cancelar desde los paneles | `reprogramar()` reusa el asistente en **modo edición** (`rep`): abre en el paso 3, avisa "Estás reprogramando un turno" y al confirmar **reescribe el turno**, no crea otro. Misma política de `CHSv` horas que cancelar. |
| 5 | Mejorar el resumen | `.wz-res`: título, 4 tarjetas con icono + **"Cambiar" que va a su propio paso**, precio aparte y política de cancelación en caja propia. |
| 6 | El "Siguiente" de las estrellas no tiene sentido | `revStars()` **ya** saltaba al paso 2, así que el botón era inalcanzable. Se eliminó y en su lugar quedó la explicación. |
| 7 | Arreglar el logo de WhatsApp | `assets/whatsapp.svg` era un SVG de CorelDRAW con `viewBox` de **35900×35900**; a 18 px se leía como un cuadrado blanco. Rehecho en 24×24. El de Instagram tenía el mismo problema (70000×70000). |
| 8 | Sacar el hamburguesa del header | Desaparecen `#hamb` y `#perfil`. **La foto (`#mebadge`) es el botón**, y es el mismo disparador para los dos roles: el cliente abre `#pmenu`, el admin `#nmenu`. |
| 9 | Arreglar dónde se despliega el menú | `position:fixed` con `top/right` fijos lo dejaba flotando a metros de la foto al scrollear. Ahora los dos menús van con `position:absolute` dentro de un wrapper relativo. |
| 10 | La foto del barbero en los servicios | **No era un bug**: la foto carga bien en landing y asistente (1120×1404, `cargo:true`). Lo que pasa es que **sólo `pablo` la tiene**; `asda` cae en la inicial "A". |
| 11 | Arreglar el estilo de las reseñas | 3 por vista en escritorio y contador "1–3 de 12" en vez de 12 puntitos. Ver abajo, que ahí apareció un bug serio. |

### 6b. El bug más grave del lote: los botones del carrusel no se podían tocar

Al cambiar el carrusel a 3 columnas, Playwright dijo "element is outside of the viewport" en el celular. **No era el test**: el botón estaba en `x:939` con un viewport de 390.

```
div.lb-car-ctl   w:1717   ← el control ocupaba 1717px
div#lbcar.lb-car w:1717
div.lb-test      w:350  grid-template-columns: 1717.39px   ← el culpable
```

`.lb-test` es un grid de **una** columna, y un item de grid tiene `min-width:auto`: adopta el min-content de su contenido, que es el track del carrusel (12 tarjetas al 100% = 1717px). **La misma trampa de `1fr` que ya estaba documentada en `.wz-dows`.** Con `minmax(0, 1fr)` el botón volvió a `x:255` y se pudo tocar.

Y como `.lb-test` ya tenía `repeat(3, 1fr)` de cuando las reseñas eran tarjetas sueltas en grilla, en escritorio el carrusel también se estiraba a 1717px: por eso la caja se veía tan vacía en el mockup del dueño.

### 6c. El `translateX` del carrusel no podía ir en porcentaje

`translateX(-25%)` movía **429px** en vez de los ~1770 de una página. El porcentaje del `transform` se mide contra el **ancho de border-box del track**, y como es un flex dentro de una caja con `overflow:hidden`, ese ancho es el de la caja, no el ancho desplazable. Ahora va en píxeles: `-(pag * (anchoCaja + 14))`.

`--lb-car-por` (CSS) tiene que coincidir con `lbCarPorVista()` (JS), o la caja queda con huecos.

### 6d. Sección de Contacto rehecha

Adaptada al mockup: mapa con etiqueta arriba y "Cómo llegar", tarjeta "Dónde estamos" con ícono, bloque de horarios con el descanso y la pastilla "Cerrado", formulario con "Enviar", y "También podés escribirnos por" con pastillas de Instagram y los dos WhatsApp.

- **`lbMapLink()`** arma el link de Google Maps desde el **mismo `MAP_IFRAME`** del mapa, para que no se desincronicen.
- **`lbBloqueHorarios()`** (no `lbHorarios`, que ya existe para la agenda) lee el descanso de los datos (`al`/`ah`). Si el dueño no cargó ninguno, no se muestra la línea en vez de inventarla.
- **Días consecutivos como "Lunes a jueves"**, con módulo 7 para que el domingo cierre la semana y no la abra: sin eso salía "viernes, sábado, domingo".

### 6e. Un bug que salió de hacer `#mebadge` botón

`tokens.claro` pasó a contar **un botón más** en modo claro y falló: `#mebadge` con `color:#e6ebf0` (el color del header **oscuro**) sobre el header **claro** → 1.06:1, el nombre invisible. Le saqué el color fijo para que herede del header, que ya cambia con el tema.

**Un test que pasa a contar un elemento más es una señal, no un ruido**: ahí apareció una regresión real.

### 6f. Sección nueva de tests

- `tests/panel.turnos.js` (33 checks): reprogramar y cancelar, **con turnos sintéticos en memoria** (`window.__test.setTurnos`). No escribe nada en Firestore, así que se puede recorrer la política de las 2 horas sin tocar los turnos de los clientes. Ojo: `T` está atado al snapshot de Firestore, así que inyectar y actuar tienen que ir en el **mismo** `evaluate`.
- `window.__test` ganó `setTurnos`, `turnos`, `rep`, `sel`, `CHSv`, `uid`, `reprogramar`, `repSalir` y `askCancel`.

---

## 7. Segundo lote del dueño (Barberos + varios arreglos) - **HECHO**

| Pedido | Qué se hizo |
|---|---|
| Sección de Barberos según el mockup | Tarjeta partida en dos: la **zona que gira** (foto + nombre) y el **pie con los dos botones**, que no gira. Antes era un solo elemento con `role="button"` que giraba entero y no podía tener dos botones (un `<button>` dentro de otro no es HTML válido). Se agregan la franja de barbería, el placeholder `[Foto]` con tijeras y la tarjeta "Elegí con quién cortarte". |
| Fotos de barbero **sin recortar** | `object-fit: contain` en vez de `cover`. |
| Redes fuera del menú | Se sacaron del panel desplegable de la landing (quedan en el pie y en Contacto). |
| Redes fuera del pie en celular | Se envuelven en `.ft-soc` y se ocultan con media query. |
| Los números 1–6 del celular | `.lb-wpasos` se oculta bajo 640 px: era una lista decorativa de pasos que en pantalla chica salía como seis números sueltos. |
| Comentarios innecesarios | Fuera el eyebrow del hero, la nota "20 puntos de bienvenida" y "El precio final se muestra al confirmar el turno". |
| **Al cerrar sesión no carga el equipo** | Bug real, ver abajo. |
| Fotos en las reseñas | `revSend` **ya guardaba** la foto; el carrusel no la pintaba. Agregada con inicial de respaldo. |
| Orden de Contacto | `dónde estamos → horarios → mapa → cómo llegar`, con el botón de cómo llegar suelto al final. |
| Orden del header | `inicio · servicios · puntos · galería · equipo · reseñas · contacto` (en el nav y en el panel). |
| Logo con marco en todos los paneles | Cuadrado redondeado (14px) con anillo dorado, igual en header del panel, pie, landing y asistente. |
| **"Quitar" en barberos agregados a mano** | No, no estaba bien: el botón sólo salía si el barbero tenía cuenta. Ahora existe para los dos tipos. |
| Puntos de bienvenida configurables | Nuevo `PTSRv` en Servicios y premios. |

### 7b. Bug real: al cerrar sesión la landing se quedaba vacía

`config/servicios`, `config/barberos` y `config/horario` se escuchan con `onSnapshot(doc(db, ...))`. **`doc()` sólo dispara el callback cuando el documento cambia.** Al cerrar sesión se limpian las variables (`BARS = []` entre otras), pero en Firestore esos documentos no habían cambiado, así que ningún callback volvía a correr y la landing quedaba con "Equipo sin cargar" para siempre.

Se guardó la última copia recibida en `PUB` y se reaplica al limpiar. Ojo con declararla: tiene que ir **en la cadena de `let`** del estado, no como línea suelta — si queda afuera es una variable no declarada y en un módulo eso es `ReferenceError` al cargar, con la landing entera en blanco.

### 7c. El giro de la tarjeta de barbero se rompió al reestructurarla

Al partir la tarjeta en dos, `LB_GRUPO` apuntaba a `.lb-barber`, pero `data-args` quedó en `.lb-barber-giro`. `lbFlip` buscaba el turno dentro del grupo y no lo encontraba: **el giro dejaba de funcionar entero**, y con él "sólo una ficha abierta" y el Escape.

Ahora `LB_GRUPO` es la zona que gira, y `lbTarjeta()` sube a la tarjeta para lo que necesita el borde (el alto animado y la clase `lb-barber--abierta`). `landing.barberos.js` pasó de 96 a **99 checks** cubriendo la estructura nueva.

### 7d. El logo ya era transparente

`logo-256.png` tiene los bordes en alfa 0: lo que parecía "un cuadrado blanco" era el **badge claro del propio emblema** sin marco. No se puede borrar ese blanco con un flood fill porque la tipografía del logo también es blanca y desaparecería con él. La solución fue enmarcarlo (cuadrado redondeado + anillo dorado) para que se lea como una decisión.

### 7e. "Quitar barbero" para los agregados a mano

`askQuitBar(uid)` buscaba por `uid`, y los barberos de "+ Agregar barbero" no tienen cuenta. Ahora busca por `uid` **o** por `id`, y `quitBar` sólo borra `staff` y el rol del usuario si hay cuenta (si no, esos documentos no existen y escribirlos sería basura).

### 7f. Puntos de bienvenida: estaban clavados en TRES lugares

`pt: 20` aparecía en el alta por email, en el alta por Google/Facebook y en el "perfil básico" que se crea si el documento no existe. Los tres usan ahora `PTSRv`, que sale de `config/reglas.ptsRegistro` y se edita en **Servicios y premios** (pestaña "Reglas de puntos").

> Con este se trigó `ReferenceError: PUB is not defined` al cargar: la variable había quedado fuera de la cadena de `let`. **Un ReferenceError en un módulo deja la página entera en blanco sin ver ningún error visible en el DOM**, así que si la app no renderiza, primero mirá la consola.

### 7g. `landing.login.js` es flaky por rate-limit de Firebase

Cuando se corren los tests seguidos, `landing.login.js` falla a veces en un rol y después pasa en el mismo código. El síntoma cambia de rol (una vez barbero, otra cliente), y con 30–60 s de espera pasa. **No lo tomes como regresión sin volver a correrlo con más espera.**

**Le pasa igual a `panel.shell.js`**: la pasada de celular puede morirse en el login con un `TimeoutError` sobre `#mebadge hidden`, mientras la de escritorio pasó entera. Es el mismo rate-limit, no una regresión: esperá 50 s y volvé a correr.

---

## 8. Tercer lote: fotos de servicio, tarjeta de barbero y pie de la landing - **HECHO**

Lo que pidió el dueño, en su orden:

1. **Las fotos de los servicios no se veían.** El dueño las sube desde "Servicios y premios" y el dato llegaba bien (`nsv()` mapea `img: x.img || ""`), pero **ninguna tarjeta lo pintaba**. No era un problema de carga ni de CORS: el `img` sencillamente no estaba en el template. Ahora va en tres lugares: `.lb-sv-img` en la grilla de la landing, `.lb-sv-mini` (48 px, al costado) en la lista angosta de celular, y `.wz-item-img` (72 px) en el paso 1 del asistente.
   - Al meter la foto hubo que **sacarle el padding a `.lb-sv` y pasarlo a `.lb-sv-bd`**: si el padding se queda en la tarjeta, la foto sale inset dentro del borde en vez de sangrar de lado a lado.

2. **Se fue el botón "Volver"** del dorso de la tarjeta de barbero (`.lb-barber-cta--atras`). El dorso ya muestra el nombre arriba, así que el "Volver" era redundante.

3. **Se fue la franja roja/blanca/azul** de arriba de la foto (`border-image` con `repeating-linear-gradient`).

### 8a. La foto del barbero: marco 4/5 con `contain` (decisión del dueño)

El dueño vio el problema en una grabación y lo struck como bug. La foto **no se recorta nunca** —es una regla del proyecto—, así que se descartó `object-fit: cover` (cortaba el 17 % de abajo). Quedó un marco fijo **4/5 con `contain`**: la foto va entera y lo que sobra a los costados se ve como franja, con el fondo en `--lb-card` para que se lea como letterbox y no como caja rota.

Las tres alternativas que se midieron sobre la foto real de ASDA (1024×1536):

| Opción | Resultado | Alto de la tarjeta |
|---|---|---|
| Sin marco (`height:auto`) | Foto entera, sin deformar | **853 px** — no entra bajo el header fijo |
| Marco 4/5 con `cover` | Llena el ancho, **recorta 17 % de abajo** | ~830 px |
| **4/5 con `contain` (la elegida)** | Foto entera, franjas a los lados | 853 px |

### 8b. TRAMPA: `max-height` en el padre + `height:100%` en el hijo **recorta la foto**

Para que la tarjeta abierta entre bajo el header fijo (105 px) en una ventana de 900, el marco lleva `max-height: calc(100vh - 300px)` en escritorio.

El primer intento dejó el `img` con `height: 100%`, y **eso rompe**: en cuanto el padre lleva `max-height`, su alto deja de ser un valor definitivo, el porcentaje del hijo no resuelve y cae a `auto`. La img pasaba a medir **571×857 dentro de una caja de 600 con `overflow:hidden`**, o sea que se le recortaban 128 px de arriba y 128 de abajo — justo la cabeza, que era lo único que no podía recortarse.

**La img va `position:absolute; inset:0; width:100%; height:100%`.** Con posicionamiento absoluto los porcentajes sí se resuelven contra la caja y la foto nunca se recorta, se achique la caja o no. Verificalo midiendo que `img` y `.lb-barber-ph` den el mismo alto.

El tope va **sólo en `@media (min-width: 900px)`**: en celular la 4/5 se respeta tal cual, porque el `max-height` de `100vh` en un teléfono chico agrandaría la caja en vez de achicarla.

### 8c. TRAMPA: `scrollIntoView({block:"nearest"})` no esquiva un header sticky

`lbAbre()` ya scrolleaba la tarjeta al abrirla, pero con `block:"nearest"`, que **mira los bordes del viewport, no el header**. Como la tarjeta abierta entraba justa en la ventana, `nearest` decía "no hay nada que mover" y la dejaba con los primeros ~100 px **debajo del header fijo**.

Ahora el scroll se calcula a mano en `lbAbre()`: se lee `getBoundingClientRect().bottom` de `.lb-hd` (el header **real**, no el 68 fijo de antes — en celular son 65 px y en escritorio 105) y se hace `window.scrollBy` con la diferencia. Prioridad al borde de arriba, que es lo que queda tapado; si además no entra por abajo, al menos se garantiza ver el final, que es la parte accionable.

### 8d. Se eliminó el pie compacto de la landing (`.lb-ft`)

Era la franja con "© Codigo Barber · Turnos y puntos" y las redes. La landing ahora cierra con la banda dorada de "Reservar ahora" + el botón sticky.

Al sacarlo se llevó por delante **toda la familia `.lb-soc*`**: el único que la usaba era `lbSoc()`, que **quedó sin llamadas** (las redes de la landing viven en Contacto como `.lb-pill`). Se borraron `lbSoc()` de `main.js` y en `landing.css` `.lb-soc`, `.lb-soc-lnk`, `.lb-soc-ico`, `.lb-soc-tx`, `.lb-hd-soc` y `.lb-panel-soc`.

> **Ojo al borrar CSS muerto: `grep` sobre el nombre de la clase no alcanza.** Al limpiar este bloque borré de más `.lb-hd-cta`, `.lb-panel-btn` y `.lb-panel-res`, que sí se usan (1 producer cada una en `main.js`). El método que sí sirve es contar los **selectores del CSSOM** que matchean 0 elementos y, para cada uno, contar los usos en JS/HTML **antes** de tocarlo. `.lb-soc*` daba 0 en los tres lugares; las otras tres no.

---

## 9. Cuarto lote: giro de la tarjeta, fotos de servicio, agenda del barbero, resumen y tema claro - **HECHO**

### 9a. El giro de la tarjeta se "contraía"

La tarjeta se **achicaba 83 px al empezar el giro** y a los 620 ms saltaba de golpe al tamaño real. Medido cuadro a cuadro: la caja se quedaba en 656 px durante toda la animación y saltaba a 739 al final.

**La causa:** `lbAbre()` le ponía a la TARJETA el alto de la CARA, pero la tarjeta no es la cara: es la cara **más el pie con los dos botones** (655 + 82 + 2 de borde = 739). Con 656, el pie se quedaba sin lugar.

Ahora `lbAltoTarjeta()` mide la tarjeta entera, y la tarjeta toma **el alto del dorso más alto de los dos** (`Math.max`), así que **al girar no cambia de tamaño**: solo rota. Medido: 0 px de oscilación (antes 83).

Dos detalles que importan:
- La suelta del `height` a `auto` ahora espera el **`transitionend`**, no un timeout fijo. Con el timeout caía en el aire y se veía el salto.
- `max(frente, dorso)` cubre el caso inverso: si algún día una ficha larga hace el dorso más alto que el frente, la tarjeta crece, pero **nunca se encoge**.

### 9b. Las fotos de los servicios: se veía el 41 % de la foto

La caja era de `height: 190px` sobre fotos verticales de ~1200×1350. Con `cover` se veía el **41-49 % del alto**: una franja con los ojos y la nariz, sin pelo ni mentón, donde el corte no se reconocía.

Ahora el marco es **4/5**: entra el **100 % del alto** y se recorta como máximo el 17 % del ancho. Es el mismo criterio que el de las fotos de barbero.

### 9c. El barbero no podía agendar turnos (bug de permisos)

`+ Agendar turno` abría bien el formulario, pero al guardar tiraba **`Missing or insufficient permissions`** y el turno no se creaba nunca.

**La causa estaba en las reglas de Firestore**, no en el código. En `/turnos` el `create` exigía `request.resource.data.uid == request.auth.uid`: sólo dejaba crear un turno **a nombre propio**. Cuando el barbero agenda para un cliente, el `uid` del documento es el del **cliente**, así que la condición no se cumplía. Era la única colección que se había quedado sin la rama de staff (`/ocupados`, `/espera` y `/activos` ya la tenían).

`FIRESTORE_RULES.txt` quedó en `rules_version = '2'` (esa línea **sólo admite 1 y 2**: no hay versión 3). **OJO: cambiar el archivo no cambia Firestore.** Hay que copiarlo en *Firebase Console → Firestore Database → Reglas* y publicar, o el barbero sigue sin poder agendar.

De paso, el mensaje de `permission-denied` ahora dice que revise las reglas, y el selector de clientes ya no muestra `undefined · undefined` (`etqUsuario()`).

### 9d. Resumen del turno: fotos y casilla de términos

- La fila de **servicio** y la de **barbero** muestran la foto (38 px, redonda la del barbero) en lugar del ícono. Si no hay foto, cae al ícono de siempre: nunca queda un cuadro vacío.
- La **casilla de términos es obligatoria**. Sin marcar, "Confirmar turno" frena con un aviso que dice qué marcar. Lleva tres links: *términos y condiciones* (solapa "Datos"), *política de privacidad* (solapa "Uso") y *condiciones del servicio* (solapa "Condiciones"), cada uno abriendo la solapa correcta del modal (`openPolSec`).

> **TRAMPA: `data-ch` sin `data-args` llama al handler sin argumentos.** La casilla se guardaba siempre en `false`. Y `@v` no sirve para checkboxes: su `value` es siempre `"on"` esté marcada o no. Hay un token nuevo, **`@ck`**, que devuelve `el.checked`.

### 9e. La barra del cliente en tema claro: texto invisible

En tema claro los botones de la barra de abajo quedaban con `--ink` (#141c26) **sobre el fondo `--navy`, que es el mismo color**: contraste 1:1, no se leía nada.

**La causa:** la barra `#nav` vive **dentro del `<header>`**, y hay una regla `body[data-theme="light"] header button { color: var(--ink) }` pensada para los botones del encabezado. Como `nav button` es un selector mucho más corto, esa regla le ganaba. Es la misma fuga de la trampa 10h.

**Y el mismo `#nav` se usa en los dos tamaños, sin parecerse en nada:**
- en **celular** es la barra fija del fondo, **oscura en los dos temas**;
- en **escritorio** va sobre el header, que **sí cambia con el tema**.

Por eso los colores van **por tamaño**. Y ojo con `--brass`: en claro es un dorado **oscuro** (bueno para escribir sobre el header claro, malo como fondo), así que la sección activa usa dorado **clavado** `#c9a24b` en celular y texto dorado sobre tinte al 10 % en escritorio. Medido, las 4 combinaciones (tema × tamaño) dan entre 5,04 y 17,16:1.

### 9f. Login sin franjas de barbería y headers iguales en celular

Las dos franjas rojo/blanco/azul que quedaban (`.franja` fija arriba y `.tarjeta::before`) se fueron, como pidió el dueño.

Los tres headers de celular ya salen iguales (69 px, logo 38×38, nombre en una línea). Antes barbero y dueño partían "CODIGO / BARBER" en dos líneas porque tienen un botón más y el espacio se achicaba; ahora el nombre no parte y baja de cuerpo si no entra. **El barbero y el dueño mantienen su botón de "ver la web"**: no se sacó, es funcionalidad; la diferencia es de botones, no de diseño.

### 9g. Dos bugs de test que aparecieron de paso

1. **`landing.tema.js` comparaba un fondo translúcido como si fuera opaco.** La píldora dorada es `color-mix(... 18%)` y el parser se comía el alfa, así que daba 1,00 contra el texto. Ahora compone el alfa **sobre el primer fondo opaco que encuentra subiendo por los ancestros** (en escritorio el nav no tiene fondo propio: `nav { background: none }`, hay que llegar al header).
2. **`panel.turnos.js` mezclaba UTC con hora local.** Usaba `toISOString()` para la fecha (UTC) y `getHours()` para la hora (local). Después de las 21:20 en Argentina las dos no son el mismo día, el turno sintético quedaba con fecha de un día y hora de otro y el test **fallaba solo de noche**. Ahora va todo en local.

---

## 10. Quinto lote: el login (tamaño, fotos de servicio y tema claro) - **HECHO**

### 10a. El login se iba de scroll y había queachicar el zoom

El dueño lo vió con el navegador al 80 % para que entrara entero. Medido: en una ventana de 768 px de alto el login ya se pasaba 62 px, y eso con el padding de 64 px y la separación de 72 px **fijas**.

Ahora el armazón se achica con la altura disponible en vez de comer el espacio:

- `.shell`: `padding: clamp(16px, 4vh, 52px) 40px clamp(16px, 3.4vh, 40px)` y `gap: clamp(24px, 4.4vh, 72px)`
- `.poste` (el poste de barbero): `height: clamp(170px, 33vh, 340px)` — era lo que más alto empujaba el panel
- `.hero__texto h2`: `clamp(32px, 4.4vw, clamp(34px, 6.2vh, 64px))`
- `.tarjeta`, `.marca`, `.ventajas`, `.hero`: rellenos y gaps con `clamp()`
- Un bloque `@media (max-height: 830px)` aprieta el ritmo vertical de la tarjeta de ingreso (campos y botón a 46 px en vez de 52, que igual supera el mínimo táctil de 44, sello de 40 px). **Es por altura y no por ancho porque el problema es vertical.**

Medido: entra entero en 1920×1080, 1600×900 y 1440×900. En 1366×768 quedan 5 px de scroll y en 1280×720 unos 50: en una pantalla de 720 px con la barra del navegador el alto real anda por 620, y ahí scrollear es lo normal.

### 10b. El login no mostraba la foto de los servicios

Las fotos estaban cargadas y se veían en la landing, pero la lista de precios del login (`lines()`) no las pintaba. Ahora cada fila lleva una de 42 px (34 px en pantallas bajas).

### 10c. El texto del login en tema claro

**El hallazgo de fondo:** `.hero` pinta `color: #fff` **fijo** pero su fondo es `var(--navy)`, que en claro **sigue siendo oscuro**. Entonces todo lo de adentro tomaba los tokens del tema para los fondos y el color fijo heredado para el texto: `.pricing` sacaba `--card` (blanco) y los nombres de los servicios quedaban **blancos sobre blanco, 1:1**. Eso era lo que faltaba, y por eso tampoco se leía ningún nombre en la captura del dueño.

La solución es **pinar los tokens en `.hero`** (`--ink`, `--mut`, `--line`, `--card` y el `--brass` de marca), no una tanda de overrides sueltos: el panel del hero es oscuro en los dos temas y todo lo que está adentro tiene que comportarse como tal. Los nombres pasaron de 1,00:1 a 12,78:1.

Además, tres textos tenían **el gris del tema oscuro clavado** (#a9b4c4) y en claro quedaban ilegibles:

| Elemento | Antes (claro) | Ahora |
|---|---|---|
| `.vista .sub` (el subtítulo de la tarjeta) | 2,10:1 | 5,92:1 |
| `.o` ("o continuá con") | 2,10:1 | 5,92:1 |
| `.enlace` ("Ver servicios y precios") | 1,85:1 | 5,36:1 |

Los tres pasaron a `var(--mut)`, que ya es temático.

Y un cuarto, **desde `landing.css`**: `body[data-theme="light"] .marca .volver { color: #fff8e6 }` ponía marfil sobre el dorado. El dorado de superficie (`--brassFill`) es **más claro** en tema claro (#d4a84b) que en oscuro (#c9a24b), así que encima va tinta oscura en los dos casos: el override estaba al revés y dejaba el botón en 2,09:1. Se borró; la regla base ya dice `#141c26`, que da 7,76:1.

### 10d. Trampa al medir el fondo de un elemento

Una sonda que busca el color de fondo **mirando sólo `backgroundColor`** miente cuando el bloque se pinta con un gradiente: `.hero` usa `radial-gradient(...)` así que su `backgroundColor` es transparente, la sonda sube al `body` (crema en claro) y reporta falsos fallos en textos que están bien. Hay que mirar `backgroundImage` también.

---

## 11. Sexto lote: el login al 100% y los botones dorados al pasar el mouse - **HECHO**

### 11a. El login segú needing scroll, pero por muy poco

Con los recortes del lote anterior (clamp con vh) el login ya entraba, pero **justo**: en la altura real de un monitor de 1080 con la barra del navegador (945 px) quedaban 945 de contenido en 945 de ventana. Cero margen. Con la ventana 20 px más corta ya había scroll.

> **Para medir si un login "entra", `scrollHeight` no sirve**: `.shell` tiene `min-height: 100svh`, así que `scrollHeight` siempre da igual a la ventana. Lo que hay que medir es **la distancia entre el último elemento y el borde de abajo**.

Los recortes de este lote, todos con `body.login` para no tocar los formularios de los paneles (que tienen sitio de sobra):

- `.entrada` y `.boton`: 52 → 48 px de alto (siguen por encima del mínimo táctil de 44)
- `.campo`: margen inferior 18 → 14
- `.tarjeta`: relleno `clamp(20px, 3.4vh, 36px) 30px clamp(16px, 2.6vh, 26px)`
- `.marca b` 26 → 24 px, `.marca` margen `clamp(10px, 1.8vh, 18px)`
- `.vista h1` 40 → 36 px, `.vista .sub` margen `6px 0 18px`
- `.o` margen 20 → 16

**Aire real que queda abajo:** 174 px en 1080 · 111 px en 945 · 90 px en 900 · 33 px en 768. En 1280×720 quedan 3 px de scroll: con la barra del navegador el alto real de esa pantalla anda por 620, y ahí scrollear es lo normal.

### 11b. Los botones dorados se rompían al pasar el mouse

El test de políticas falló de golpe: **"Aceptar y continuar" estaba en 1,44:1**. Texto `rgb(20,28,38)` sobre fondo `rgb(42,56,73)`. Invisible.

No lo había causado este lote: es la **misma fuga de la trampa 10h**. `button:hover:not(:disabled) { background: #2a3849 }` es global, y `.pol-b--pri` (dorado, texto #141c26) es (0,2,0) contra (0,2,1) de esa regla: **le gana por la columna de elementos**. Sólo se ve si el cursor cae arriba del botón, por eso el test a veces lo pasaba y a veces no.

**El arreglo NO es acotar la regla.** Verifiquéndolo: el login **vive dentro de `#app`** (el login reemplaza el contenido de la app), así que `#app button:hover` sube la especificidad a (1,0,3,1) y ahí no gana ninguna regla de clase. Probé eso y rompí el hover del botón "Volver a la web". Volví a la regla original y protegí los botones dorados uno por uno.

Y ojo con la aritmética de `:hover`: **es una pseudo-CLASE**, cuenta en la columna de clases, no en la de elementos. `.pol-b--pri:hover` es (0,2,0) y NO le gana a (0,2,1). Hacen falta dos clases: `.pol-b.pol-b--pri:hover` = (0,3,0).

Botones protegidos:

| Botón | Con hover |
|---|---|
| `#po .pol-b--pri` ("Aceptar y continuar") | 7,15:1 (era 1,44:1) |
| `#po .pol-b` (secundario) | 4,57:1 con tinte propio |
| `.marca .volver` ("Volver a la web") | 5,44:1 |

**Regla para el futuro: si agregás un botón dorado con texto oscuro, ponele su `:hover` con dos clases.** El comentario en `styles.css` junto a la regla genérica lo dice.

---

## 12. Iconos de redes del dueño y login con Google/Facebook - **HECHO**

### 12a. Los íconos ahora son los PNG del dueño

Los íconos de WhatsApp e Instagram se usan como **`<img>` con los PNG que puso el dueño**
(`assets/whatsapp.png` e `assets/instagram.png`), no como los SVG que habíaamos redibujado.
Están en los 6 lugares: contacto de la landing, pills de contacto, datos del
barbero, pie del panel y login.

**Los originales no se tocan.** Pesan 223 KB y 702 KB (éstos son para imprenta), así
que se generaron dos versiones al 96 px con el canvas del navegador:

| Archivo | Original | Derivado | Se usa |
|---|---|---|---|
| `whatsapp.png` | 4177×4177, 223 KB | `whatsapp-96.png`, 7 KB | 22×22 px |
| `instagram.png` | 2500×2500, 702 KB | `instagram-96.png`, 14 KB | 22×22 px |

925 KB de iconos que se pintan a 22 px se vuelven 21 KB. 96 px es 4x el tamaño
real en pantalla, de sobra para un monitor retina.

> **No hay ImageMagick ni sharp en la máquina.** Para reescalar se usa el canvas
> de Chromium (`new Image()` + `drawImage` + `toDataURL`) sobre una página
> `about:blank`. Ojo: hay que hacerlo en `about:blank` y no sobre la app, porque
> la página redirige y el contexto de ejecución se destruye a mitad del dibujado.

SeLeveró también el bloque de CSS que sobraba: `.ic-ig` / `.ic-wa` tenían
`background-color: currentColor` y cuatro `mask-*`, que eran de cuando los
íconos se pintaban como máscara de CSS. Sobre un `<img>` no hacen nada pero
confunden a quien lea el archivo.

### 12b. Google y Facebook: el código ya estaba, faltaba la consola

Act.red(p) llama a `signInWithPopup` con `GoogleAuthProvider` y
`FacebookAuthProvider`, y al primer ingreso le crea el documento en
`users/{uid}` con los puntos de bienvenida. **No hay que escribir nada.**

Lo que faltaba era la activación en la consola, que pide la cuenta del dueño.
El paso a paso está en **`ACTIVAR_GOOGLE_FACEBOOK.md`**: Google se activa en
Firebase directo; Facebook necesita además crear una app en Meta, agregar la
URI `https://barberia-taccu.firebaseapp.com/__/auth/handler` y pegar el App ID y
el App Secret en Firebase.

Además se agregaron al mapa `ERR` los errores que de verdad se ven con esos
botones, para que no salga el "Ocurió un error" genérico:
`auth/operation-not-allowed` (proveedor sin activar), `auth/unauthorized-domain`
(dominio sin autorizar), `auth/popup-blocked`,
`auth/popup-closed-by-user`, `auth/account-exists-with-different-credential` y
`auth/cancelled-popup-request`.

> **Recordatorio: `localhost` viene autorizado de cualquiera.** Cuando la web se
> suba a un dominio real hay que agregar ese dominio en *Authentication →
> Settings → Authorized domains*, o el botón va a fallar con
> `auth/unauthorized-domain` aunque el proveedor esté habilitado.

---

## 13. Google y Facebook en las dos pantallas - **HECHO**

Pedido del dueño (2026-10-11): **que un cliente pueda entrar con su cuenta de
Google o de Facebook**. Los dos botones van en las dos pantallas.

**Por qué igual se le pide una contraseña al registrarse con una red social.**
Con el botón de Facebook también en el ingreso, nadie queda encerrado: puede
entrar con Facebook cuando quiera. La contraseña que se pide después es **red de
seguridad**: si esa persona pierde el acceso a Google o a Facebook, tiene un
correo y una contraseña para entrar en lugar de quedarse afuera con sus puntos y
su historial. Se puede saltar, con el aviso de qué pasa si se saltea.

### Qué se implementó

- Los dos botones quedan en `#ingresar` y en `#registro`. En el ingreso van sin
  segundo argumento (no se le pide nada a quien ya tenía cuenta); en el registro
  van con `true`, que es lo que dispara la pantalla de contraseña.
- `red(p, registro)` recibe un segundo argumento: si el botón se apretó desde la
  pantalla de **registro** y la cuenta quedó **sin proveedor de tipo `password`**,
  se abre la pantalla `#redpass` ("Elegí una contraseña").
- Esa pantalla valida mínimo de 6 caracteres y que las dos claves coincidan, y guarda
  con `updatePassword(auth.currentUser, n)`.
- El documento en `users/{uid}` (con los puntos de bienvenida) se crea **antes** de
  pedir la clave: si alguien cierra a mitad de camino igual tiene que quedar con
  perfil. El `return` que se había puesto después del pop-up lo hacía al revés y
  dejaba la cuenta sin crear.
- Hay un "Ahora no, gracias" que avisa que sin clave no va a poder volver a entrar.
  No bloquea, pero queda dicho.

### Dos trampas de esta pantalla

1. **Los campos no están dentro de un `<form>`**, así que su valor hay que llevar al
   estado a mano con `data-in="redPassIn"`. Sin eso el botón guardaba cadena vacía
   siempre.
2. **La vista nueva se superponía con el ingreso.** El `hidden` de `#ingresar` decía
   `${up || rec ? "hidden" : ""}` y con `tab = "redpass"` las dos condiciones dan
   falso: el ingreso quedaba visible debajo. Hay que sumar `|| redPass`.

### Para probarla

`window.__test.setRedPass({n:"", c:"", red:"facebook"})` abre la pantalla sin
disparar el pop-up (que abriría otra pestaña y pediría una cuenta real).

---

## 14. El nombre del barbero se guardaba en tres lugares - **HECHO**

El dueño cambió el nombre del barbero en "Mi perfil en la web" y no se verá en
ningún panel: ni en el encabezado del barbero, ni en la lista **Barberos** del
dueño, ni en los chips de la agenda.

### Por qué pasaba

El nombre estaba en tres documentos y cada parte de la app leía uno distinto:

| Dónde | Qué lee de ahí |
|---|---|
| `staff/{uid}.n` | el encabezado del panel del barbero (`SB && SB.n`) |
| `config/barberos.l[].n` | la landing y las tarjetas |
| `config/finanzas.bs[].n` | lista **Barberos** y chips de agenda del dueño |

`guardarPerfil()` escribía **sólo el segundo**. Con eso el encabezado se
quedaba con el nombre viejo para siempre.

Y había un segundo bug, más grave: el sincronizador que corre **cada vez que el
dueño entra al panel** (el `setDoc(config/barberos)` dentro del listener de
`config/finanzas`) armaba la lista con `n: b.n`, o sea el nombre viejo de la
lista del dueño. Cada entrada del dueño **borraba** el nombre que el barbero se
acababa de poner. Por eso el cambio "no se veía": no era que no se guardara,
era que se guardaba y después se deshacía.

### Qué se implementó

1. **`nomBar(b)`** (helper nuevo, arriba de `let CA`): devuelve el nombre
   publicado de un barbero y, si no hay ficha publicada, el de la lista del
   dueño. Se usa en los cuatro lugares que leían el viejo: encabezado de la
   agenda, columna de la agenda, chips de "Agendar turno" y tarjetas de
   **Barberos**, más el texto del cartel de "Quitar".
2. **`guardarPerfil()`** ahora escribe en las dos colecciones con `Promise.all`:
   `config/barberos` (la landing) y `staff/{uid}.n` (el encabezado). Actualiza
   `SB` y `FN` en memoria para que no haya que esperar el snapshot. Las reglas
   ya permitían al barbero actualizar `n` en su propio documento de `staff`.
3. **El sincronizador del dueño** cambió `n: b.n` por `n: prev.n || b.n`: una
   vez que existe ficha publicada, manda esa. `b.n` sólo se usa para el barbero
   que se acaba de agregar.

### La regla que queda

**El nombre canónico es el publicado.** Si un barbero se cambia el nombre en su
ficha, ese nombre manda en todas partes. El dueño puede poner el nombre al
agregar un barbero, pero después de eso manda lo que puso el barbero.

Ojo con la tentación de "que el dueño pueda renombrar desde Finanzas": para eso
haría falta que el barbero pudiera escribir `config/finanzas`, y ese documento
tiene los **porcentajes de reparto**. No se hizo a propósito.

### Para probarla

```
node tests\panel.nombre.js
```

Hace el ciclo completo: el barbero se cambia el nombre, se verifica el
encabezado y la lista, se recarga, entra el dueño (que antes lo pisaba), se
mira la landing sin sesión y al final **devuelve el nombre original**. Son 11
comprobaciones.

Si se corta a la mitad queda `NOMBRE PRUEBA 12345` puesto:

```
node tests\nombre.restaurar.js asda
```

Dos trampas del test, por si lo tocás:

1. **El `<details>` de la ficha arranca cerrado** y Playwright no ve los campos
   de adentro. Hay que abrirlo con `page.click("details.perfil > summary")`,
   no con `details.open = true` desde `evaluate`.
2. **"Cerrar sesión" no cierra nada directo**: abre un cartel de confirmación y
   hay que apretar `#mok` adentro. Y hay **dos** botones con `data-act="salir"`
   (el del panel y el del menú de la foto), así que hay que tomar el `:visible`.
   El dueño además no cae en `#/agenda` sino en `#/dashboard`.

---

## 15. Tarjeta de barbero del mockup + "Quitar" de los cargados a mano - **HECHO**

Dos cosas del dueño: la tarjeta nueva (desktop y celular, los dos PNG) y el
botón "Quitar" de los barberos cargados a mano, que no hacía nada.

### El botón "Quitar" que no hacía nada

`askQuitBar(uid)` buscaba con `(uid ? x.uid === uid : x.id === uid)`. Al
barbero agregado a mano desde "+ Agregar barbero" se lo pasa su **`id`**
(no tiene `uid`), así que la condición terminaba siempre en
`x.uid === "bmv44rw19"`, que no lo matchea con nadie. `b` quedaba
`undefined` y la función salía en el primer `if (!b) return`: sin cartel, sin
error en consola, sin nada. Los barberos con cuenta funcionaban porque a ellos
se les pasa el `uid` de verdad.

Ahora busca por uid **o** por id. `tests/panel.quitar.js` lo cubre sin borrar
nada: abre el cartel de los tres y lo cierra con "Volver".

Ojo al escribir ese test: `data-args` es un JSON con comillas
(`["bmv44rw19"]`) y **no se puede meter en un selector de CSS**. Hay que ir por
posición (`nth`).

### La tarjeta nueva

Dorso, de arriba abajo: franja de barbería, nombre + botón ↻, oficio en
pastilla con borde, "SOBRE {NOMBRE}", descripción, **bloque ATIENDE** con el
horario, **SERVICIOS** con nombre y precio, WhatsApp e Instagram como botones
con borde, y el botón dorado "Reservar con X". Frente: franja, foto, nombre,
pastilla dorada, descripción y los dos botones.

Todo sale de lo que carga el barbero: `lbFichaBarbero(b)` para la ficha y
**`CFB(b.id)` para el horario**, que es el mismo que usa la reserva (el propio
del barbero si tiene uno en `config/horario.por`, si no el general). O sea que
lo que dice la tarjeta es lo mismo que después bloquea los horarios.

#### Tres cosas que hubo que arreglar para que entre

1. **El dorso es más alto que el frente.** La foto 4/5 hace el frente enorme y
   el dorso (con horario y servicios) no entraba. SeJnmidió el pie de dos
   botones mientras la tarjeta está abierta: el dorso ya trae su propio
   "Reservar con X" (como el mockup) y el pie medía 144 px en el celular.
   `lbAltoDorso()` mide el dorso **con el pie oculto y el dorso en el flujo**,
   porque con `position:absolute; inset:0` la caja del dorso siempre mide lo
   que la tarjeta y no dice nada de cuánto contenido tiene.
2. **`.lb-barber-giro` no se estiraba.** Es un ítem flex de `.lb-barber`
   (columna) y sin `flex:1` medía lo que mide el frente. Con la tarjeta estirada
   a 628 el dorso se quedaba en 533 y no podía usar los 95 px de más.
3. **`.lb-barber-int` necesita `height:100%`**, o el `inset:0` del dorso se
   resuelve contra el frente y no contra la tarjeta. Sin esto, en el celular
   el bloque de WhatsApp e Instagram quedaba tapado detrás del botón dorado.

Medido con viewports reales: la tarjeta abierta queda en **700 px en
1440x900** y **628 px en 390x844**, y el cuerpo del dorso **no scrollea** en
ninguno (623/623 y 551/551).

### La franja de barbería: aviso

El mockup trae la franja roja/blanca/azula arriba de las dos caras, y **la
puse**. Ojo que en el LOGIN esa misma franja se pidió quitar (lote 4,
`styles.css` `.franja { display:none }`). Son dos lugares distintos con
decisiones distintas. Si también la querés fuera de la tarjeta, es borrar el
bloque `.lb-franja` de `landing.css` y los dos `<span class="lb-franja">` del
HTML.

### Lo que NO se puede hacer todavía

**Los servicios son globales, no por barbero.** No hay forma de que un barbero
diga "yo hago estos dos": la lista del dorso muestra los mismos servicios para
todos, los mismos que cobra la reserva. Si algún día se quiere, el lugar es
`lbDorso`, filtrando `S`. Requiere un campo nuevo en `config/barberos` y una
pantalla para cargarlo, así que **no se inventó**.

### Para probarla

`landing.barberos.js` grew de 105 a **147 comprobaciones**: la franja de las dos
caras, el bloque ATIENDE con horario en `hh:mm`, la lista de servicios con
nombre y precio, que el botón ↻ sea un `<button>` real con etiqueta, que la
flecha cierre la ficha y que el pie vuelva a verse, y que los botones de redes
digan sólo "WhatsApp"/"Instagram" (antes iban con el número pegado).

Con capturas: `tests/_shot.js <nombre>` saca frente y dorso en escritorio y
celular a `tests/tmp_shots/`.

## 17. SEO local - **HECHO**

Dominio: **codigobarber.com.ar** (lo confirmó el dueño; antes el head apuntaba
a `don-estilo.vercel.app`, que ya no se usa en ningún lado).

### Qué se agregó

- **`<head>`**: title y description con la ciudad, `<link rel="canonical">`,
  `lang="es-AR"`, las seis `og:*` que faltaban (`og:url`, `og:image`,
  `og:image:alt`) con textos que nombran el local y la ciudad, y las metas
  `geo.region` / `geo.placename` / `geo.position` / `ICBM`.
- **JSON-LD `BarberShop`** en el `index.html`: dirección, geo, teléfono,
  horarios, precio, `sameAs` de Instagram y `hasOfferCatalog` con los tres
  servicios y sus precios.
- **`robots.txt`** y **`sitemap.xml`** en la raíz.

### Cuatro correcciones al JSON que pasó el dueño

| Venía | Ahora | Por qué |
|---|---|---|
| `"streetAddress": "Puerto Iguazú"` | `"Av. Su Santidad y Papa Francisco"` | "Puerto Iguazú" es la **ciudad**, no la calle. Con la ciudad en el campo de calle, Google no ubicaba el local en el mapa. La calle real ya estaba en `config.js`. |
| `openingHoursSpecification` como objeto | como **arreglo** | Schema.org la declara como propiedad repetida y Google la lee así. |
| `"image": ".../logo.png"` | `assets/logo-256.png` | No existe un `/logo.png` en la raíz. |
| `"telephone": "+543757000000"` | los dos WhatsApp reales | Ese número no es de nadie. |

### El teléfono: por qué es lo más delicado de todo esto

**NO hay fijo.** El local tiene dos WhatsApp (`5493757699335` de Roman y
`5493757644751` de Yan). Se puso el de Roman como `telephone` y los dos como
`contactPoint`.

Un teléfono inventado en el JSON-LD es lo peor que se puede hacer en SEO local:
Google lo contrasta contra Google Maps y contra las reseñas, y si no coinciden
te desalinea el negocio entero. **Por eso no se inventó uno**, y por eso hay un
`TODO` visible: cuando consigas el fijo, es cambiar **una** línea.

Ojo con un error que se cometió y la prueba cazó: al pasar los números a
formato internacional se les **caía el `9` del móvil argentino**
(`5493757699335` → se puso `+543757699335`). El correcto es `+5493757699335`
(54 país + 9 móvil + 375 área + 7699335). Con el número corto, el "llamar
ahora" de Google marca a otro número o a nadie.

### Horarios: quedó el general, con un aviso

El JSON-LD quedó **lun a sábado de 09:00 a 17:00**, que es el horario general
por defecto del proyecto (`CFD` en `src/config.js` y `HORARIO_GENERAL` que se
agregó).

**Ojo:** el horario que está cargado hoy en Firestore es **lun a jue 09:00–17:00
con pausa de 11:30 a 13:30**. Si el general real es Lun–Sáb, hay que cambiarlo
en `config/horario` de Firestore; si es otro, se cambia `HORARIO_GENERAL` en
`src/config.js` **y** el `opens`/`closes`/`dayOfWeek` del `index.html`, que son
dos lugares distintos.

### aggregateRating: NO va, a propósito

Es el bloque que más rinde en SEO local y no se puso porque **no hay reseñas
reales**: hoy en Firestore hay 13, de las cuales **10 son de prueba**. Poner un
puntaje que no corresponde es penalizado por Google y además es una mentira.
Cuando estén limpias las reseñas, el bloque se arma desde Firestore.

### El problema de fondo: el mismo dato vive en cinco lugares

Como la web es una SPA y Google tiene que leer el JSON-LD **sin ejecutar
JavaScript**, el `index.html` es estático y no puede leer `config.js`. Entonces
el dominio, la calle, las coordenadas, el teléfono y el horario viven en:

1. `src/config.js` (`DOMINIO`, `CP`, `LAT`, `LON`, `CALLE`, `HORARIO_GENERAL`…)
2. `index.html` (canonical, og:url, metas geo, JSON-LD)
3. `robots.txt` (línea `Sitemap:`)
4. `sitemap.xml` (cada `<loc>`)
5. Firestore (`config/horario`, `config/barberos`)

Nada se avisa si uno cambia. **`tests\seo.js` (63 comprobaciones) compara todos
contra `config.js` y falla si se separan.** Es lo mismo que se hizo con el logo
del loader.

### Bugs que aparecieron de paso

- **Había tres `<meta name="theme-color">`**, y el último estaba sin `media`:
  pisaba a los dos buenos y en modo claro la barra del navegador salía azul
  oscuro en vez de marfil. Se fue el que sobra.
- **`FIRESTORE_RULES.txt` queda público en la raíz** y publica el id del
  proyecto de Firebase y el **UID del dueño**. Las reglas siguen protegiendo las
  escrituras, pero es información que no hace falta darle. Se agregó
  `Disallow: /FIRESTORE_RULES.txt` a `robots.txt`. **Lo mejor sería no
  publicarlo**: en Vercel se saca del build, no se renombra.

### La marca: "Codigo Barber", sin tilde (RESUELTO)

El dueño decidió que la marca se escribe **sin tilde**. El SEO decía
"Código Barber" y `NOMBRE` en `config.js` y `manifest.json` decían
"Codigo Barber": dos nombres para el mismo local, y Google los necesita iguales
(y iguales a la ficha de Google Maps).

Se unificó todo a "Codigo Barber" y `tests\seo.js` ahora compara el title, el
`og:site_name`, el `author`, el `name` del JSON-LD y el `short_name` del manifest
contra `NOMBRE` de `config.js`, y falla si aparece la versión con tilde.

Ojo: el reemplazo fue de la cadena completa "Código Barber". Palabras sueltas
como "barbería" o "peluquería" **conservan su tilde**, que en español es lo
correcto y es lo que va en la descripción.

### Lo que sigue pendiente del SEO

- **El sitemap tiene una sola URL** y es lo correcto: las secciones son rutas con
  `#`, que los buscadores no indexan. Poner una por sección sería inventar
  direcciones que devuelven la misma página. Cuando haya páginas de verdad
  (políticas, privacidad como `.html` separadas), se suman.
- **`FIRESTORE_RULES.txt` sigue en la raíz y se publica.** Va con `Disallow` en
  `robots.txt`, pero la forma correcta es sacarlo del build de Vercel.
- **`aggregateRating` sigue sin ponerse** hasta que las reseñas sean reales
  (hoy 13 en Firestore, 10 de prueba).
### Para probarla

```
node tests\seo.js
```

63 comprobaciones: que el JSON-LD sea JSON válido y sea `BarberShop`, que la
dirección del JSON sea la de `config.js` (y no la ciudad), que el teléfono sea
alguno de los reales y **no** el de ejemplo, que `openingHoursSpecification` sea
arreglo, que los largos de title y description estén en rango, que las OG estén
todas, que no haya metas duplicadas, que los dos formatos de coordenadas
(`geo.position` con `;` e `ICBM` con `,`) no estén intercambiados, y que
`robots.txt`, `sitemap.xml` y el canonical apunten al mismo dominio.

Dos trampas de esa prueba, por si la tocás:

- **Los comentarios del HTML se sacan antes de buscar.** Varios explican por
  qué **no** se puso un dato (el teléfono de ejemplo, el dominio viejo) y si no,
  la prueba cree que el dato está puesto.
- **Para ver si hay metas duplicadas hay que parsear la etiqueta entera**, no
  usar un patrón que asuma el orden de los atributos: en el archivo `media` va
  después de `content`, y las dos `theme-color` (una por modo de color) están
  bien y parecían duplicadas.

---

## 16. Loader con el logo y franja fuera de las tarjetas - **HECHO**

### El loader

El poste de barbero con franjas girando (`.bp`, `@keyframes bp`) se fue por el
logo de Codigo Barber. El bloque entero, incluidas las reglas del
`prefers-reduced-motion` que lo apagaban, está borrado: `tests\loader.js` falla
si vuelve a aparecer.

Dos cosas que costaron:

1. **El logo es un PNG con fondo NEGRO OPACO.** Medido con el canvas de
   Chromium: 0% de píxeles transparentes, la esquina es `rgba(0,0,0,255)`. La
   primera versión lo puso sobre un disco marfil y **tapaba el escudo entero**;
   la segunda, sobre el fondo del loader, dejaba ver el cuadrado negro. Lo que
   funciona es el mismo tratamiento que ya usa el header (`.lg`): cuadrado
   redondeado con aro dorado, `object-fit: cover`, y **fondo `#000`**, que es
   exactamente el negro del PNG, así que el borde del cuadrado se funde con la
   imagen y lo único que dibuja la forma es el aro.
2. **El `src` va escrito en `index.html`, no asignado desde JS** como el logo
   del header. El loader se muestra *antes* de que cargue el módulo: si el src
   llegara por JS, el primer segundo se vería un disco vacío. El precio es que
   la ruta está duplicada (`index.html` y `LOGO` en `src/config.js`), y para
   que no se desincronicen sin que nadie se entere, `tests\loader.js` compara
   las dos y falla si no coinciden.

Animación: el disco late suave y un arco dorado gira alrededor (2,1 s y 1,15 s).
Con `prefers-reduced-motion` no hay ninguna de las dos, pero el logo y el texto
siguen ahí. El `role="status"` y el `aria-live="polite"` no se tocaron.

### Las franjas de las tarjetas, afuera

El dueño las vio montadas y las pidió sacar. Se fue el bloque `.lb-franja` de
`landing.css` y los dos `<span class="lb-franja">` del HTML (uno por cara).
`landing.barberos.js` ahora comprueba lo contrario de lo que comprueba antes:
que **no** exista el elemento y que **ningún** elemento de la tarjeta tenga un
`repeating-linear-gradient` (así no vuelve por otro lado).

### Dos cosas que encontré de paso

**`landing.barberos.js` depended de tus datos de trabajo.** Exigía al menos 2
barberos en Firestore y se caía con "n=1" si no los había, sin decir por qué.
Ahora, si hay menos de dos, inyecta tres sintéticos **en memoria**
(`__test.setBars`, no escribe nada) y lo avisa con un `skip`. Sigue midiendo
contra tus datos reales cuando hay dos o más.

**`panel.quitar.js` cerraba el cartel buscando el botón por texto.** Si mañana
"Volver" se llama distinto, el filtro deja de encontrarlo y el `.first()` se
cae en **el botón que confirma**, que borra un barbero de verdad. Ahora aprieta
`#mo [data-act="Mx"]`, que es el cancelar por su acción y no por su palabra, y
además espera 4 s y vuelve a contar en el panel **y en Firestore** antes de dar
por bueno que no se borró nadie (la espera anterior era de 700 ms y `quitBar`
es async: un borrado se seguía sin ver).

### Lo que NO se tocó (avisado, no hecho)

Quedan dos franjas rojas/blancas/azules en la app, en partes que el dueño no
nombró:

- **El poste del login** (`.poste` con `.rayas`, `styles.css` ~2447): sigue
  girando con franjas. En el lote 4 se sacaron la franja de arriba del login
  (`.franja`) y el `::before` de la tarjeta, pero el poste en sí quedó.
- **La franja diagonal de la landing** (`.lb-stripe`, justo abajo del header):
  roja, marfil y azul, 6 px.

Ninguna se toca sin que lo pidas.

---

## 18. Siembra de la base después de la limpieza del dueño - **HECHO**

El 2026-10-11 el dueño borró la base de Firestore **entera**. Firebase
Authentication sobrevivió (son dos bases distintas), así que las dos cuentas
siguen existiendo; lo que faltaba eran los documentos.

Se dejó con `tests\sembrar.js`, que se puede volver a correr las veces que
haga falta. Pregunta antes de escribir, salvo que se le pase `--si`.

### Qué se cargó

| Documento | Contenido |
|---|---|
| `config/servicios` | los 3 servicios con id, precio y duración |
| `config/horario` | Lun a Sáb, 09:00 a 17:00, sin pausa |
| `config/reglas` | 5 puntos por corte |
| `config/finanzas` | reparto 40% dueño / 60% barbero, con el equipo |
| `staff/{uid}` | el documento que hace que el barbero sea barbero |
| `users/{uid}.rol` | `"barbero"` |
| `config/barberos` | lo publica solo el sincronizador del dueño |

Datos que decidió el dueño: nombre **Roman**, horario **Lun a Sáb
09:00-17:00** (el mismo que dice el JSON-LD del SEO, para que Google y la
web no se contradigan) y **un solo barbero**, el de la cuenta.

### Lo que NO se cargó, y por qué

- **Fotos del barbero y de los servicios**: estaban en Cloudinary y las URLs
  se perdieron con la base. No hay forma de recuperarlas desde el repo.
  Se recargan desde la app: *Mi perfil en la web > Cambiar foto* y
  *Ajustes > Servicios y premios*.
- **Galería**: 0 fotos. Se recargan desde *Ajustes > Galería*.
- **Reseñas**: 0. Para el `aggregateRating` del SEO **no se ponen** hasta
  que sean reales.

### La trampa que costó la primera corrida: `users/{uid}`

El primer intento falló entero con **"Missing or insufficient
permissions"**, y no era una regla sin publicar. Eran dos cosas del mismo
problema:

1. La regla de `create` de `users/{uid}` pide `request.auth.uid == uid`.
   O sea que **el dueño no puede crear el documento de otro**, y un
   `setDoc` con `merge` sobre un documento que no existe **es un create**.
   Ahí moría el lote completo, porque el lote se va a la primera falla.
2. La app sólo crea ese documento si el usuario **todavía no es admin**
   (`setup()`: `if (!x.exists() && me && !isAdm())`).

Las dos juntas cierran el círculo: el barbero tiene que entrar **una vez
antes** de que exista `staff/{uid}`: en ese momento todavía no es barbero y
la app le arma el perfil sola. Después el dueño ya puede hacer `update`, que
sí lo permite `isBarberoOrOwner()`.

Por eso `tests\sembrar.js` **arranca entrando como barbero**, y antes de
escribir chequea que `users/{uid}` exista: si no, dice exactamente qué hacer
en vez de fallar con un error de permisos.

### El perfil del barbero quedó con el nombre del email

`users/{uid}.nm` quedó como **"agustin ibarra"** (lo saca de Firebase Auth
automáticamente la primera vez que entra). El nombre que se ve en la web y
en el panel es el de `config/barberos`, que quedó **"Roman"**. Para
cambiar el del perfil: *Ajustes* dentro del panel del barbero.

### Lo que se rompió de paso

`landing.barberos.js` comprobaba que **todos** los botones de redes del dorso
dijieran "WhatsApp" o "Instagram". Con un solo barbero en Firestore el test
mide con los datos sintéticos, que traen un TikTok, y empezó a fallar. La
comprobación ahora exige eso sólo para los dos primeros: las redes extra que
carga el barbero van después, con el nombre que él puso. 153 comprobaciones.

---

## 19. El loader deja de girar y aparece donde faltaba - **HECHO**

### La animación

El dueño vio el loader con el aro dorado girando y pidió dos cosas: **que no
gire** y que **el logo se cargue de arriba hacia abajo** (copió el efecto de
otra app donde una línea de luz baja destapando el ícono).

Se fue el aro girando (`ldGiro`) y el latido del disco (`ldLatido`). Ahora:

- `.lgl` lleva `clip-path: inset(0 0 100% 0)` y la animación `ldBarrido` lo
  lleva a `inset(0 0 0 0)`. El inset inferior es el que manda: 100% = nada
  visible, 0% = todo. Como crece desde abajo, lo primero que aparece es la
  parte de ARRIBA del escudo.
- `.lgc::after` es la línea de luz, con la animación `ldLinea`.
- **Los dos keyframes tienen el MISMO `duration` y la MISMA curva**
  (`1.75s cubic-bezier(0.66, 0, 0.34, 1)`), y los dos terminan al 62% del
  ciclo. Si se le cambia uno de los dos, la línea se desalinea del recorte y
  se nota. Medido con valores puestos a mano: la diferencia entre el borde
  del recorte y la línea va de 0 a 3 px, que es el grosor de la línea misma.
- El barrido se detiene al 62% y queda quieto hasta el ciclo siguiente. Sin
  esa pausa la imagen se reiniciaría de golpe y se lee como un parpadeo.
- Con `prefers-reduced-motion` no hay barrido: el logo se ve entero desde el
  principio y la línea se apaga.

`tests\loader.js` comprueba que el nombre del logo con tilde no aparezca en
ningún archivo publicado y que el corte sea desde abajo. OJO: **el
`clipPath` computado no sirve** para esa comprobación: con la animación
corriendo devuelve el valor interpolado del cuadro en curso, no el de
partida. Hay que leer el CSS fuente.

### Dónde faltaba el loader

Las escrituras ya pasaban por `wait()`, que lo muestra y apaga solo. Los
huecos eran dos, y uno era un bug de verdad:

1. **Las consultas en vivo de `ocupados`** (el calendario del asistente y la
   grilla del panel) no mostraban nada mientras llegaban. Con red lenta, el
   que avanzaba de mes veía todos los días del mes anterior, y el que
   reservaba veía los horarios como libres. Ahora `ldEspera()` / `ldListo()`
   avisan, **pero sólo de la primera respuesta de cada consulta**: como es
     un `onSnapshot` que no "termina", mostrar el loader en cada llegada
     haría parpadear la pantalla cada vez que alguien reserva en el medio.
   El mínimo de 420 ms en pantalla evita el extremo contrario, que es el
     fogonazo con respuesta rápida.
2. **El asistente se quedaba TRANCADO para siempre.** `R()` repinta la
   página pero **no** el modal del asistente: eso lo hace `WZ.pintar()`. Si
   el usuario aprieta "Reservar" antes de que lleguen los servicios y los
   barberos (primera visita, sin caché), el paso 2 se pintaba con la lista
   vacía y el botón "Siguiente" deshabilitado, y **nunca más se repintaba**:
   sin error, sin mensaje, sin salida. Ahora los tres `onSnapshot` públicos
   llaman a `datosLlegos()`, que repinta el modal si está abierto y la página
   si no.

El loader del asistente se apaga con los **servicios**, que es lo que
bloquea el primer paso. Si la lista de barberos viene vacía, lo dice el
propio asistente con su cartel: dejarlo prendido tapaba ese mensaje para
siempre.

### El sincronizador vaciaba la web entera

El bloque que publica `config/barberos` corre **cada vez que el dueño entra
al panel**, y armaba la lista con `FN.bs.map(...)`. Si `config/finanzas` no
existe todavía (base recién limpiada) o se lee un instante sin datos,
`FN.bs` queda `[]`, la lista pública queda `[]` y **la web se queda sin
barberos enteros**. Pasó de verdad: tras la limpieza, varias entradas del
dueño publicaron una lista vacía.

Ahora: `if (pub.length)`. Con el equipo vacío de verdad no se escribe nada;
la lista vacía en la web tiene que venir de que el dueño la vació a
propósito, desde Finanzas.

### Limpieza del 2026-10-11: cuentas de prueba

El dueño borró las cuentas de Firebase del **barbero** y del **cliente** de
prueba (sólo quedó la del dueño). Como consecuencia:

- `tests\sembrar.js` ahora **no corta** si la cuenta del barbero no entra:
  siembra todo lo demás y avisa que falta el barbero. Un uid no se puede
  inventar.
- `tests\agregar-barbero.js` carga un barbero **sin cuenta** desde el
  botón real "+ Agregar barbero", para que el sitio pueda volver a tomar
  turnos. Un barbero sin cuenta es ficha pública: aparece en la web pero no
  entra al panel.
- Las pruebas que necesitan esas cuentas ahora hacen **SKIP** en vez de
  morir con un "Timeout 30000ms" esperando un elemento que no existe.
  Antes el síntoma no decía nada del motivo real y hacía pensar que el
  código estaba roto.

---

## 20. Auditoría integral - **HECHO** (2026-10-11)

Detalle en `AUDITORIA.md`, `PLAN_MEJORAS.md`, `CAMBIOS_REALIZADOS.md` y `PRUEBAS.md`.
Punto de recuperación: commit `3ed5cc0`.

### Seguridad: lo que estaba abierto y se cerró

- **XSS almacenado, confirmado y explotado.** Un cliente podía escribir un
  turno con la hora como `<img onerror=...>` y ese código **corría en el panel
  del dueño**. Medido antes del arreglo: `window.__pwn = 1`. Ahora `pwn = 0` y
  el payload queda como texto. La prueba es `tests/xss.js`; sin ella esto
  parecía un theory.
- **`$$()` no transformaba texto.** `String.prototype.toLocaleString()`
  devuelve la cadena tal cual, así que un `precio` con HTML llegaba crudo al
  Dashboard. Ahora convierte a número.
- **Los enlaces del barbero aceptaban `javascript:`.** `esc()` escapa comillas
  pero no valida el esquema. Nuevo `urlSegura()`.
- **Reglas de Firestore**: un barbero podía escribir `config/finanzas` (o sea
  quedarse con el 100% de cada corte), editarse su propio `pd`, y un cliente
  podía editar cualquier campo de su turno o borrar uno ya cobrado.

> **OJO, lo más importante de esta sesión:** las reglas del archivo **NO**
> están en producción hasta que se peguen en Firebase Console > Firestore >
> Reglas. Y conviene probarlas en el Rules Playground con un usuario de
> `staff` antes de dar por bueno.

### La CSP: un bug que habría roto producción

Al agregar las cabeceras, la web **perdió las tipografías y los tres módulos de
Firebase**. La causa: el service worker intercepta esos hosts y los reintenta
con `fetch()` desde el worker, y esa llamada se mide contra `connect-src`, que
no los tenía. Al fallar, el fallback del worker devolvía `index.html` con
`Content-Type: text/html`, y el navegador decía "Expected a JavaScript module
script…", que no señala la causa.

Dos arreglos: los tres hosts de `OK` (sw.js) están ahora en `connect-src`, y
el fallback devuelve `index.html` **sólo para navegaciones**.

`style-src` lleva `'unsafe-inline'` y no es opcional: la app arma el HTML con
**220 atributos `style="..."`**. Endurecerlo exige sacarlos antes a clases.

**Regla para el futuro:** toda CSP se prueba con la web levantada y las
cabeceras puestas (`node tests\srv.js 8766` + `node tests\csp.js`). Leer el
archivo no dice si algo se rompe: el navegador descarta en silencio.
`tests\csp.sync.js` obliga a que `vercel.json` y `tests\srv.js` digan lo
mismo, porque si no, las pruebas dan verde contra una CSP que no es la real.

### Rendimiento: lo medido y lo que NO se puede afirmar

- **2,5 MB de assets sin usar** (`logo.png`, `instagram.png`, `whatsapp.png`):
  sólo aparecían en comentarios y en una regla CSS muerta. Movidos a
  `fuentes/`: no se borran, salen de la publicación.
- **`tmp_pdf/` con 76 MB** y las pruebas también se subían en cada deploy.
  Ahora hay `.vercelignore`.
- **`FIRESTORE_RULES.txt` estaba publicado en la raíz**: cualquiera podía
  leer el modelo de seguridad y el UID del dueño. Sólo estaba excluido por
  `robots.txt`, que no es control de acceso.
- **El mapa**: se pidió cambiar y se cambió. PERO el ahorro medido en localhost
  es **0 KB**: con `loading="lazy"` el navegador ya lo difería, y mi primera
  medición de 360 KB **no se reprodujo**. Lo que queda garantizado es que el
  mapa no se pide hasta que su bloque está a 300 px de la pantalla, en
  cualquier conexión. La prueba es `tests\mapa.js`, que compara los dos
  estados sin tocar git.
- **`main.js` sigue siendo un archivo de 6.400 líneas.** Es el pendiente de
  velocidad más grande y queda documentado, no escondido.

### Diseño y accesibilidad

Medido en 4 anchos × 2 temas con `tests\visual.js`, no a ojo:

- `.lb-map-btn` medía 35 px de alto (ahora 44). Es el botón que abre Google
  Maps: el que más se toca con el dedo.
- `.lb-brand` 42 px (ahora 44).
- Cinco etiquetas a 11,5-11,8 px (ahora 12).
- Sin scroll horizontal, la barra fija no tapa nada, CLS = 0.

**Esto NO es conformidad WCAG 2.2 AA.** Faltan lector de pantalla real y
gente probándolo.

### Pruebas

`node tests\run.js` corre todo: **25 pruebas, 567 comprobaciones, 0 en rojo**.

Las trampas nuevas, todas en `PRUEBAS.md`:

1. `*> archivo.txt` en PowerShell 5.1 escribe **UTF-16**, no UTF-8. Leído
   como utf8, todo patrón falla y el cuadro sale vacío sin decir por qué.
2. Un SKIP puede ser un fallo disfrazado: la guarda de `landing.modal.js`
   llamaba a `irPaso(2)` sin elegir servicio, nunca llegaba, contaba 0
   barberos y saltaba. La prueba pasaba en verde sin medir nada.
3. En el asistente de reserva **nunca uses handles de Playwright**: el modal
   se repinta entero en cada paso y a veces solo. Click con `p.evaluate` y
   captura con `page.screenshot({ clip })`.

### Lo que quedó pendiente y es del dueño

1. Pegar las reglas en Firebase Console.
2. Probar esas reglas en el Rules Playground con un usuario de `staff`.
3. App de Facebook en modo Live.
4. `codigobarber.com.ar` en Authentication > Authorized domains.
5. El mail real del barbero, para vincularlo con su cuenta y su agenda.

---
### El loader se rediseñó (después del video del dueño)

El dueño grabó la pantalla y pidió mejorar el loader. Al mirarlo con
capturas appeared **un defecto que las pruebas no veían**:

1. **La mitad de abajo quedaba en NEGRO PURO.** El `clip-path` iba
   directo de "nada visible" a "todo visible", así que en el medio había
   un cuadrado vacío que parecía una imagen que no cargó. Eso es lo que
   más se notaba en el video.
2. **La línea de luz se salía 10 px a cada lado** (`left/right: -10px`) y
   no respetaba el redondeo: asomaban dos puntas doradas fuera del marco.
3. **El escudo iba recortado**: con `border-radius: 34px` sobre 168 px, las
   hojas de afeitar de los costados quedaban cortadas.

**El arreglo de fondo: el logo completo queda siempre debajo, apagado,**
**como silueta.** Encima va una segunda capa de la MISMA imagen, con
opacidad normal, que sí se revela de arriba hacia abajo. Nunca hay un
hueco vacío: lo que se "carga" es la iluminación, no la imagen.

- `.lgl` (el `<img>`): escudo entero, `opacity: 0.2`, **sin** `clip-path`.
- `.lgc::before`: la misma imagen como `background-image`, encendida, con el
  `clip-path` animado. Al ser la misma URL no hay una segunda descarga.
- `.lgc::after`: la línea, ahora con `left/right: 14px` (dentro del
  redondeo) y glow más marcado.
- Las dos capas usan el mismo `transform: scale(0.93)`, así que el escudo
  entra entero y no se ve desdoblado.
- Un puntito dorado antes de "Cargando…" que se apaga justo cuando
  termina el barrido. El texto no cambia, porque si cambiara el `aria-live`
  lo leería en loop.
- Cuadro de 168 a 176 px y radio de 34 a 26 px.

**Las tres rutas del logo tienen que coincidir:** el `src` del `<img>` en
`index.html`, `LOGO` en `config.js` y `--ld-logo` en `styles.css`.
`tests/loader.js` (31 comprobaciones) compara las tres.

> **Trampa nueva:** la URL de un CSS externo se resuelve contra la ruta del
> PROPIO CSS, no contra la del documento. Con `url("assets/logo-256.png")`
> dentro de `src/styles.css` se pedía `/src/assets/logo-256.png` y daba 404.
> Va `../assets/…`. Lo detectó la batería, en dos pruebas.

**Verificación en movimiento real** (`tests/_ldmov.js`, que se puede volver
a hacer): la línea recorre de 15 px a 173 px, se queda, se apaga y
reinicia; el desfase máximo con el borde del recorte es de 3,7 px, que es
el grosor de la línea misma.

## 21. Cuatro pedidos del dueño (2026-10-12)

### 1. El logo en Google (el favicon)

En los resultados de Google salía el globo genérico al lado del nombre.

**No había `/favicon.ico` en la raíz.** Ese archivo es el que el buscador pide
primero, y el `<link rel="icon" href="assets/icon-192.png">` que ya estaba
no lo reemplaza. Se generó con `tests/favicon.js`, que redimensiona el logo
con el canvas de Chromium (no hay ImageMagick ni ffmpeg en la máquina) y arma
el `.ico` a mano: cabecera de 6 bytes más 16 por entrada, con el PNG adentro
(Windows Vista en adelante lo acepta). Quedan tres medidas: **16, 32 y 48**, en
8 KB. Va declarado primero en el `<head>`.

> OJO: aunque esté perfecto, Google no lo muestra al instante. El buscador
> tiene su propio caché y puede tardar **varios días**. No es que siga mal.

### 2. Sacar "y peluquería masculina"

Estaba en la meta description y en la descripción del JSON-LD. De paso
salieron los superlativos ("La mejor", "el mejor estilo"): no se pueden
verificar y Google los toma como señal de contenido flojo.

La nueva, con marca y ciudad adelante, sin inventar nada:

> Codigo Barber, barbería en Puerto Iguazú, Misiones. Corte de pelo, perfilado
> de barba y corte + barba. Reservá tu turno online por WhatsApp.

Son los servicios que están cargados de verdad. Mide 140 caracteres, que es
lo que Google muestra sin recortar.

### 3. Que aparezca al buscar "barbería puerto iguazú"

El problema real no eran las metatags (el título ya tenía marca y ciudad):
era que **el texto visible de la portada no decía ninguna de las dos**. El H1
es "Tu turno, sin vueltas", que es del dueño y no se toca, y "Puerto
Iguazú" aparecía recién en la sección de contacto, muy abajo.

Se agregó marca y ciudad al párrafo del hero, que es lo primero que se lee y
lo que Google contrasta:

> Codigo Barber, barbería en Puerto Iguazú. Reservá en cuatro pasos, sumá 5
> puntos por cada corte…

**Lo que NO se hizo, a propósito:**

- `meta keywords`: Google la ignora desde 2009 y hoy es contraproducente.
- `alternateName` con sinónimos ("barbería en Puerto Iguazú", etc.): es
  relleno de palabras clave y Google lo detecta. Perjudica el ranking.
- Repetir la ciudad cada dos líneas: por lo mismo.

Y una advertencia honesta: **el mayor peso en búsquedas como "barbería
PUERTO IGUAZÚ" no lo tiene el sitio, lo tiene el Perfil de Empresa de
Google** (el aviso que sale con el mapa en el primer resultado de la captura
del dueño). Eso es un perfil para dar de alta a mano, con dirección, horarios,
teléfono y fotos, y es lo que Google contrasta con Maps. El código ayuda, pero
no alcanza solo.

### 4. Login cancelado: que no avise

En la captura del dueño salía un cartel rojo: "No se pudo completar —
Ocurrió un error… Firebase: IdP denied access… (`auth/user-cancelled`)".

**`auth/user-cancelled` no estaba en el mapa de errores**, así que caía en el
mensaje genérico, con el texto crudo de Firebase adentro. Y el ingreso en
realidad había funcionado: la persona había apretado "Cancelar" en la
pantalla de permisos de Google.

Ahora hay un `Set` con los códigos que son cancelaciones y NO errores:

- `auth/user-cancelled` (apretó Cancelar en la pantalla de permisos)
- `auth/user-cancelled-popup`
- `auth/popup-closed-by-user` (cerró la ventanita de Facebook)

`err()` sale en silencio con esos, y el `catch` del login social repinta la
pantalla sin mostrar nada. Se borró además el texto "Cerraste la ventana de
Google o Facebook sin terminar", que además de molestar le decía al usuario
que había hecho algo mal.

**`auth/cancelled-popup-request` NO entra en la lista a propósito:** esa no es
una cancelación de la persona, es que se abrió una ventanita antes de
terminar la anterior, y ahí sí conviene pedirle que espere un segundo.

### 5. El loader no gira (verificado, no supuesto)

El video que mandó el dueño era una vista estática del panel: **el loader no
aparecía en ningún cuadro**. Así que en vez de suponer, se midió:
`tests/loader.giro.js` muestrea el `transform` REAL de cada capa (el cuadro,
el escudo de abajo, la capa que se revela, la línea, el puntito y el loader
entero) durante dos ciclos completos de 2 s.

> 97 muestras por capa · 1 ángulo distinto por capa · **0,00° máximo**

Y además comprueba que ninguna regla del CSS del loader mencione `rotate()`.

> **Si el dueño vio girar algo, fue en la web publicada**, que todavía tiene
> el versión vieja (`ldGiro`, el aro dorado girando): el arreglo del loader está
> en el repositorio pero **nunca se subió**. Por eso, en `PLAN_MEJORAS.md`
> está publishing `vercel.json` como pendiente: hasta que no se despliegue, lo
> que se ve en `codigobarber.com.ar` es la versión anterior.

---

## Lo que ya está hecho y NO hay que romper
---

## Lo que ya está hecho y NO hay que romper

- **Asistente de reserva de 6 pasos** (servicio → barbero → día con calendario del mes → turno mañana/tarde → horario → resumen). Es **un solo componente** que usan la landing (modal) y el panel del cliente (`resH()` devuelve `wizH()`). El calendario calcula disponibilidad real leyendo `ocupados`.
- **Ver la web desde el panel**: barra dorada arriba cuando mirás la landing con sesión, y el header de la app se esconde para no quedar dos headers apilados. **El botón cambió de lugar**: para el dueño sigue suelto en el header, para el cliente vive en el menú de la foto (`#pmenu`), igual que "Cerrar sesión". La acción (`verWebOn`) es la misma en los dos casos.
- **Login**: logo real (antes era un SVG inline de una navaja), botón "Volver a la web".
- **Modo claro de los paneles**: estaba roto de raíz, `styles.css` no redefinía los tokens.
- **Perfil del barbero**: la ficha vive en `config/barberos`, NO en `staff/{uid}`, porque **`staff` exige sesión para leerse** y la landing muestra el equipo sin sesión. Foto sí va a `staff`. Se edita desde "Mi perfil en la web" en el panel del barbero. El **nombre** sí va a las dos (`guardarPerfil` escribe `config/barberos` y `staff/{uid}.n`): ver sección 14, el nombre estaba en tres lugares y cada parte leía uno.
- **Tarjeta de barbero que se da vuelta**: al tocarla rota 180° y muestra el dorso con la ficha (oficio, descripción, WhatsApp, Instagram, otras redes y el botón "Reservar con X"). **Al tocar otro barbero se cierra el anterior y se abre el nuevo**: sólo hay una abierta (`lbFlip` / `lbCierraTodos` en `main.js`, CSS al final de la sección 12 de `landing.css`). También se cierra con Escape o con un clic fuera.

**De la tarjeta, dos cosas que conviene no deshacer:**

1. **Todas las tarjetas se dan vuelta, tengan ficha o no.** Antes sólo era pulsable el que había cargado algo, y como ninguno lo había, la función no se veía nunca. El dorso de uno sin ficha avisa "Todavía no cargó su información de contacto" y muestra igual el botón de reservar.
2. **La cara oculta lleva `inert`**, no sólo `backface-visibility:hidden`. Girada, la cara de atrás es invisible pero sigue en el árbol de accesibilidad: sin `inert` se podía tabular a un link de WhatsApp que no se veía. `lbCaras()` lo maneja en los dos sentidos.

Para el 3D hacen falta las cuatro piezas juntas: `perspective` en `.lb-barber` (el contenedor), `transform-style: preserve-3d` en `.lb-barber-int` (la que rota), `backface-visibility: hidden` en las dos caras, y `rotateY(180deg)` en la cara de atrás para que quede mirando al frente al girar.

Con `prefers-reduced-motion: reduce` **no gira**: se oculta el frente y el dorso pasa al flujo normal. El efecto sigue siendo claro porque el contenido es distinto, y el botón de reservar sigue ahí.

**Estado real de los datos (a fecha de hoy):** hay 2 barberos en `config/barberos`; `asda` tiene foto cargada, `julian` no (por eso su tarjeta muestra el placeholder con tijeras y la letra J). **Ninguno cargó todavía la ficha** (teléfono, Instagram, descripción, redes), así que el dorso muestra el aviso de "sin cargar" más el botón de reservar. Para verlo completo hay que llenar "Mi perfil en la web" desde el panel de barbero.

`tests\landing.barberos.js` (96 checks: giro, exclusivity, teclado, inert, Escape, clic fuera, botón del dorso y `prefers-reduced-motion`) y `tests\flip.shots.js` (capturas).

---

## Trampas del proyecto (aprendidas a la costa)

0. **`ACT` es una COPIA de `W`, no una referencia.** `const ACT = Object.assign({}, W, {...})` (~línea 2484) congela los handlers en ese momento. Asignar `W.algo = fn` **después** de esa línea no registra nada y el `data-act` queda muerto sin error. Para handlers nuevos: `Object.assign(ACT, {...})` en un bloque posterior (es lo que hace `guardarPerfil`), o metelos en el `W` original.

0b. **El ciclo de foco del modal (`#mo`) sólo tabulaba `<button>`.** La ficha del barbero mete enlaces (WhatsApp, Instagram) y quedaban inalcanzables con teclado. Ya se corrigió a `button, a[href], input, textarea, select` filtrando por `offsetParent`.

0c. **`elemento` con `role="button"` + `tabindex="0"` no dispara nada con Enter ni Espacio.** Hay que traducir la tecla en un click (hay un listener global con `dRun`). Si no, la tarjeta se ve pulsable y no lo es.

0d. **`setDoc` devuelve promesa: `try { setDoc(...) } catch` NO captura el error.** El `.catch(() => {})` se tragaba el permission-denied y la app mostraba "se guardó" sin guardar. Siempre `await` dentro del `try`.

0e. **`getComputedStyle().getPropertyValue("--x")` devuelve HEX, no `rgb()`.** El `parse()` de `landing.audit.js` sólo entiende `rgba()` y `color()`: con hex leía `#141c26` como los números sueltos `14,26` y daba `NaN` o ratios de 1.03. Todo esto está resuelto en `tests\color.js`: usalo.

0e2. **`color-mix()` devuelve `color(srgb 0.49 0.38 0.10 / 0.12)`**: canales de 0 a 1 y alfa separada. Leído como `rgb()` da un color casi negro y ratios inventados. `tests\color.js` lo maneja.

0i. **`dataset.args` llega DECODIFICADO, `A(id)` no.** `A("datos")` devuelve el texto con entities (`[&quot;datos&quot;]`); el navegador lo convierte a `["datos"]` al leer el atributo. Comparar `t.dataset.args === A(id)` nunca da igual. Compará contra `JSON.stringify([id])` y parseá con `JSON.parse(...)` en vez de recortar con `slice`.

0f. **Medir contraste sobre un `background` que es `gradient` no funciona.** `backgroundColor` queda transparente y el cálculo sube al ancestro: mide el texto contra el color de la página y da 1:1. Hay que leer las paradas de `backgroundImage`. `panel.contraste.js` toma la más oscura.

0g. **Que el elemento sea visible no basta para medirlo.** Si un ancestro tiene `display:none`, el hijo sigue reportando `display:inline`. Medí markup del panel de login que seguía en el DOM después de entrar. Usar `el.checkVisibility({checkOpacity:true, checkVisibilityCSS:true})`.

0h. **`Select-Object -Last N` sobre un proceso Node largo lo mata por SIGPIPE** y el `exit=1` que ves es del pipe cerrado, no del test. Para correr la suite en serio: `node tests\x.js *> $env:TEMP\x.txt` y después leer el archivo.

1. **`src/main.js` y `src/styles.css` son UTF-8 SIN BOM.** El Read los muestra con mojibake, es solo la consola. Editá con los caracteres reales o con Node.

2. **PowerShell mete BOM.** `Set-Content -Encoding UTF8` agrega BOM; si concatenás ese archivo a otro, el BOM queda pegado al primer selector y **toda esa regla CSS queda muerta en silencio** (el CSSOM muestra `\ufeff .clase`). Pasá los temporales por Node, o revisá con un grep de `\uFEFF`.

3. **`.lb` tiene `overflow-x: clip`**: el desborde real no aparece como scroll, aparece como contenido cortado. Medí `getBoundingClientRect()` y `scrollWidth > clientWidth` del contenedor, nunca `overflowX` del documento.

4. **`grid-template-columns: 1fr` es `minmax(auto, 1fr)`** y no baja del `min-content`. Con `aspect-ratio` las celdas se pasan de ancho. Usar `minmax(0, 1fr)`.

5. **Los iconos de redes usan `<img>`, no `mask-image`.** Los `pngwing`/CorelDRAW son multicolor y una máscara usa el canal alfa: el cuadrado con degradado de Instagram se volvía un bloque sólido y el círculo verde de WhatsApp un disco.

6. **`#thm` (tema de la app) vive en el header global, oculto sin sesión.** La landing tiene su propio toggle, `lbTema`. Los dos escriben en el mismo `localStorage.theme`.

7. **El service worker cachea el shell.** Subiste la versión a `barberia-v7` en `sw.js`. Si tocás un archivo del shell sin bumpearla, los clientes siguen viendo la versión vieja. Sin bump hay un aviso de "Actualizar".

8. **Los tests esperan `domcontentloaded`, nunca `networkidle`**: Firestore mantiene la conexión abierta y nunca idlea.

9. **Cuidado con los dos `data-act="goLogin"`**: a 390 px los dos "Ingresar" están ocultos (uno en el header, otro en el panel móvil cerrado). Usá `:visible` o el hash `#login`.

10. **Ojo con el uso de la palabra "wizard" y el acento de `main.js`** si editás templates anidados: los backticks anidados rompen los scripts de reemplazo. Para cambios grandes en templates, escribí el script con la herramienta de escritura, no con heredoc de PowerShell.

10b. **Nunca uses un heredoc de PowerShell para escribir un archivo con acentos.** `Reseña` sale `Reseña` y el script falla en runtime con un error de locator que no dice nada del mojibake. Es la trampa #1 pero aplicada a los **tests**: para cualquier `.js` con texto español, usar la herramienta de escritura, no `Set-Content`.

10c. **Un test que verifica una UI que "no hace nada" puede estar mintiendo.** Las sondas de la reseña siguieron dando "sin diálogo" durante varias vueltas porque el asistente tiene 3 pasos y sólo se recorrían 2. **Antes de diagnosticar la app, comprobá que el test llega hasta el final del flujo** — y verificá contra la BASE (red, base de datos), no contra un elemento de UI que el código nunca muestra.

10d. **`msg` es un aviso de un solo render**: `R()` lo borra al final de pintarlo. Si hacés `msg = …; R(); algoQueTambiénRenderiza();` el mensaje **no llega a verse nunca** (los dos renders caen en el mismo tick y el navegador sólo pinta el último). Hay que poner el mensaje y hacer **un solo** `R()`, como hace el resto de los handlers.

10e. **`hidden` no le gana a una regla de `display`.** `#web` y `#lo` tienen `display:inline-flex` en `styles.css`, así que ponerles `.hidden = true` desde JS **no los oculta**: siguen visibles y en el orden de tabulación. Para esconderlos de verdad hay que pegarle con CSS (`body:not(.adm) #web { display:none !important }`).

10f. **Cuidado con el orden en `styles.css` a igual especificidad.** Una regla nueva definida arriba la pisa cualquier regla vieja más abajo del archivo. `.card` está declarado en la línea ~435 y por eso la tarjeta dorada del Inicio salía oscura: ganaba `.card`, no `.ini-acc--pri`. Para ganarle hay que subir la especificidad (`.card.ini-acc--pri`), no confiar en el orden.

10g. **Un ítem de grilla con `display:inline-block` se blockifica.** Los títulos con subrayado dorado (`.ini-hola`, `.rev-tit`) se estiran al ancho de la columna y el texto queda centrado: hay que ponerles `justify-self: start`.

10h. **`styles.css` (el panel) se carga en la landing y filtra estilos genéricos.** El que más daño hizo: `button:hover:not(:disabled){background:#2a3849}`, un azul oscuro **clavado** que se le aplicaba a las tarjetas del asistente de la landing, dejándolas con texto casi negro encima (2.8:1). En móvil `:hover` se queda pegado después de tocar. Cuando algo se vea raro en la landing, listá **las reglas del CSSOM que matchean el elemento**; no asumas por el nombre de la clase, porque la regla que gana puede venir del otro CSS.

10i. **Un `opacity` sobre un texto nunca se recupera para cumplir AA.** El "apagado" de `.wz-turno.off` bajaba a 2.8:1 con `opacity:.45`, y a `.85` seguía en 3.93:1: bajar la transparencia compone el texto con el fondo, así que no hay valor que llegue a 4.5:1 sin que el elemento deje de leerse como apagado. Marcalo con **color y tachado**, no con transparencia.

---

## Decisiones que ya están tomadas, no las abras

- **Nombre de marca: "Codigo Barber"**, en `NOMBRE` (`src/config.js`). `index.html` y `manifest.json` son estáticos y hay que cambiarlos a mano si cambia.
- **Un solo CTA en la landing**: "Reservar ahora".
- **No inventar** testimonios, dirección, horarios ni datos de barberos. Si falta algo, va con marcador visible + `TODO` en el código.
- **Servicios, barberos, galería y horarios SIEMPRE desde Firestore**, nunca hardcodeados.
- **Días con disponibilidad en verde, sin disponibilidad en rojo, cerrado en gris.**
- **Horarios ocupados se muestran apagados y tachados**, no se esconden.
- **La navegación del panel del cliente tiene un solo origen**: la constante `SEC_CLI` alimenta la barra del header (escritorio) y la de abajo (celular). Si alguna vez se edita una, editá `SEC_CLI`, no el HTML de una.
- **Ajustes del cliente ≠ Ajustes del dueño**: `#/mi-cuenta` (`ajus`) contra `#/ajustes` (`cfg`).

## Cosas que necesitan una decisión tuya

- **Segundo WhatsApp**: están `WA_ROMAN` (`5493757699335`) y `WA_YAN` (`5493757644751`) en `config.js`, con nombre en el contacto y en el pie. Falta decidir si el aviso de lista de espera va a uno o a los dos, y si el número debería ser por barbero.
- **Login con Google y Facebook**: el código está hecho y los dos proveedores se activan en la consola según **`ACTIVAR_GOOGLE_FACEBOOK.md`**. Los dos botones (Google y Facebook) están **en las dos pantallas**: se puede entrar con correo, con Google o con Facebook.
- **Cuentas de prueba que hay que borrar** de Firebase Authentication: `aguscolegio203+qa@gmail.com`, `aguscolegio203+qa+qa-79h0n@gmail.com`, `aguscolegio203+qa-o1fc0@gmail.com`.
- El servicio `as` (23 min, $1.222) es basura de prueba; el dueño dijo que lo borra él.
- **Texto de las políticas**: lo compuse yo desde el mockup de baja resolución. Las secciones **"Tus derechos"** y **"Con quién los compartimos"** las tenés que revisar antes de publicar: son las que más conviene que mires si algo está mal.
- **Contraste del asistente en modo claro** (ver 5c): hay que abrir el asistente en claro y sacar la cadena real de colores. No lo arregles a ciega.
---

## 22. Header y barra de celular: casita - toggle - foto, y bandeja de secciones

### Lo que pidió el dueño (4 capturas)

1. **El cliente**: la foto de perfil (que hace de menú) a la **derecha** del toggle.
2. **El header de escritorio**: "arreglar el diseño, mejorar", con la foto a la derecha del toggle.
3. **Dueño**: barra de abajo con **sólo 3** (Dashboard, Agenda, Clientes) y la cuarta ranura con un botón de **tres rayitas** que abre Barberos, Finanzas, Ajustes y Galería. "Ver la web" no hace falta si está la casita.
4. **Barbero**: barra con las **4** (Agenda, Clientes, Mis ganancias, Galería). Si no entran, la cuarta es el botón de tres rayitas.
5. Los dos: el header en celular **y** en escritorio en el orden **casita - toggle - foto**, y la foto abre un menú desplegable con "Editar perfil" (que no se muestra al dueño), "Cambiar foto" y "Cerrar sesión".

### La estructura nueva

```
logo ................ nav ......................... [casita] [toggle] [foto]
                                       └─ #pmenu (menú de la foto, los 3 roles)
barra de celular (celular):  sección sección sección [☰]   └─ #nmenu (bandeja)
```

Dos menús que antes eran uno solo:

| | antes | ahora |
|---|---|---|
| `#pmenu` | sólo el cliente | los **tres** roles |
| `#nmenu` | el admin, anclado a la foto | la **bandeja**, sale desde abajo |
| `#lo` | botón suelto "Cerrar sesión" en el header | **eliminado** (vive en `#pmenu`) |
| `#web` | botón con texto "Ver la web" | la **casita**, sin texto |

### Las tres decisiones que no son obvias

**a) Cuántas entradas van en la barra se decide con CSS, no con JavaScript.**
Se dibujan **todas** las secciones siempre y las que sobran se ocultan con
`#nav.nav-mas3 > button:not(.nav-mas):nth-child(n+4) { display: none }`. La clase
`nav-mas3` / `nav-todo` la pone el render según el rol.
Si se decidiera en JS mirando el ancho de la ventana, al girar el teléfono
habría que repintar y en escritorio el dueño vería sólo 3. Con CSS no hay estado
que sincronizar.

**b) El corte es a 1060 px, no a 860.**
En escritorio `.hd` está topado en 1040 px: no es que la fila crezca con la
pantalla. Con las 7 secciones del dueño más la marca y los tres controles la
fila medía **1057 px** contra 1040, o sea que **no entraba ni en un monitor de
1280**. Por eso el corte de la bandeja es a 1060 y no al breakpoint del celular.
Medido después de los ajustes:

| ancho | `.hd` | desborde | secciones | bandeja |
|---|---|---|---|---|
| 390 | 390/390 | no | 3 | sí |
| 700 | 700/700 | no | 3 | sí |
| 860 | 860/860 | no | 3 | sí |
| 1000 | 1000/1000 | no | 3 | sí |
| 1059 | 1040/1040 | no | 3 | sí |
| 1060 | 1040/1040 | no | 7 | no |
| 1280 | 1040/1040 | no | 7 | no |

Los 42 px que faltaban salieron de dos ajustes: el padding lateral de los
botones de escritorio de 18 a 15 px (3 px × 2 × 7 = 42) y el `gap` de `.hd` de
20 a 16 px.

**c) El barbero NO tiene bandeja, y antes sí.**
Tenía 4 secciones en 4 ranuras, así que el botón de tres rayitas repetía
exactamente las mismas cuatro: eso es lo que se veía en su captura. Ahora la
bandeja sólo se dibuja si de verdad sobran secciones (`sec.length > CUANTAS`).

### Dos errores reales que hubo que encontrar

**`body.adm nav { display: none }` estaba en el CSS.** El admin no tenía barra
inferior en celular: su navegación salía entera de la foto. Eso dejó de servir
cuando el dueño pidió que el dueño tuviera barra, y fue la razón de que la
primera corrida mostrara "0 secciones visibles" con las 7 secciones en el DOM.
Está en el bloque `@media (max-width: 859px)` que arranca con ese comentario.

**`menuPerfil()` quedó dentro del `try` de `R()`.** Los módulos de JavaScript
son *strict mode*, así que un `function` declarado dentro de un bloque es
**block-scoped**: desde el render que la llama (que está fuera del `try`)
daba `ReferenceError` y el menú salía vacío. Va a nivel de módulo, antes de
`function R()`. La prueba `header` ahora tiene una guarda estática que falla si
alguien la vuelve a meter adentro.

### Lo que NO se pudo verificar

- **El panel del barbero**: su cuenta ya no autentica (el dueño la borró en la
  limpieza de la base), así que `tests/header.js` lo marca **SKIP**. La barra
  del barbero es idéntica a la del cliente en el código (`claseNav = "nav-todo"`,
  las 4 secciones), pero **no se vio en pantalla**.
- **El panel del cliente**: por lo mismo. `tests/panel.shell.js` quedó
  actualizado para la estructura nueva (ya no busca `#lo`, espera "Editar
  perfil" y "Cambiar foto", y que "Ver la web" **no** esté en el menú), pero
  **no se pudo correr**.

Mientras tanto la estructura de esos dos paneles está cubierta por 13
comprobaciones **estáticas** en `tests/header.js` (que leen el código: 4
secciones del cliente, `CUANTAS = own ? 3 : sec.length`, los tres items del
menú, que "Editar perfil" se le esconde al dueño, que no hay `#lo` ni `#hamb`,
y el orden `web → thm → mebadge` en el HTML). No es lo mismo que verlo
funcionando, y no hay que venderlo como si lo fuera.

### Un detalle que se decidió y conviene que sepas

**La casita ahora también se le muestra al cliente.** El dueño la pidió para el
dueño y el barbero; para el cliente no dijo nada, pero su menú tenía "Ver la
web" y si a la vez se sacaba la casita del header y ese item del menú, el
cliente perdía la función. Queda como estaba, pero es una decisión mía, no
pedida: si no la querés en el panel del cliente, decime y la oculto.

---

## 23. La CSP rompía el ingreso con Google y con Facebook (corregido)

### El síntoma

Con cualquiera de los dos botones, el login moría al toque con un cartel rojo
de "No se pudo completar / Intenta de nuevo - Firebase: Error (auth/internal-error)",
y en la consola cuatro errores de "Content Security Policy" bloqueando
`https://apis.google.com/js/api.js`.

### Por qué la console decía una cosa y el cartel otra

`auth/internal-error` es lo que devuelve Firebase cuando **no puede abrir la
ventana emergente**: es genérico y no dice "me bloquearon un script". El
mensaje de "intenta de nuevo" manda al usuario a tocar de nuevo, y a tocar de
nuevo pasa lo mismo. La causa real estaba en la consola, y era mia.

### La causa

La CSP del lote 20 (`vercel.json` y `tests/srv.js`) tenía:

```
script-src 'self' https://www.gstatic.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com
frame-src  https://www.google.com https://maps.google.com
```

Faltaban dos orígenes:

| falta | quién lo pide | qué pasaba |
|---|---|---|
| `script-src https://apis.google.com` | el popup de Google inyecta ahí su `js/api.js` | **la ventana no abría**, y el login moría con `auth/internal-error` |
| `frame-src https://*.firebaseapp.com` | el iframe del popup de Firebase | con el popup abierto, el iframe quedaba bloqueado |

Con comodín en `firebaseapp`, no con el id de este proyecto: así el mismo
`vercel.json` sirve para cualquier proyecto Firebase y nadie queda atado a
`barberia-taccu`.

### Cómo se encontró sin adivinar

Se reprodujo localmente contra `node tests\srv.js 8766` (el servidor que SÍ
manda la CSP), apretando Google y Facebook de verdad y leyendo la consola **de
la ventana emergente**. Iterando: primero apareció `apis.google.com`, después de
arreglarlo el popup abrió y apareció `*.firebaseapp.com`. Recién después de la
segunda corrección, cero violaciones.

**Esto es una trampa nueva y general:** una CSP se prueba yendo a buscar lo que
se bloquea, no leyendo la lista de hosts y pensando "faltará alguno".

### La prueba de regresión: `tests/csp.popup.js` (10 checks)

Además de leer la CSP, aprieta los dos botones y exige:

1. que la ventana emergente **se abra**,
2. que **llegue al dominio del proveedor** (`accounts.google.com` /
   `facebook.com`),
3. que la pantalla **se dibuje** (texto no vacío),
4. **cero** violaciones de CSP en la página y en el popup.

El punto 2 es el que importa: sin él, "cero violaciones" pasaría por verde
aunque el popup no se abriera nunca, que es exactamente el bug que había.

Verificado también a ojo: la pantalla de Google (914 caracteres) y la de
Facebook (560) se dibujan completas, con estilos y sin campos en blanco.

---

## 24. Diez cosas del dueño, en un solo lote

Viene con capturas. Cada punto dice qué se veía, cuál fue la causa y cómo se
comprobó que quedó andando. Donde no se pudo comprobar, está dicho.

### 1. El cartel rojo al apretar Google o Facebook

`auth/cancelled-popup-request` ahora **no avisa**. Estaba aparte, con el
razonamiento de que "no es una cancelación, es que se abrió una ventanita antes
de terminar la anterior". Ese razonamiento salía de leer los internos de
Firebase, no de algo que se pueda ver en la pantalla: lo que ve la persona es un
cartel rojo que dice "esperá un segundo e intentá de nuevo", después de haber
apretado un botón. Va a `CANCELADO` y sale en silencio.

### 2. El rendimiento en móvil

Medido con `tests/perf.movil.js` (Chrome, móvil emulado, 390×844). **No** son
puntajes inventados: son bytes y tiempos de localhost.

| | antes | después |
|---|---|---|
| recursos | 3.983 KB | **2.716 KB** |
| lo más pesado | fotos de Cloudinary (5 × 120-170 KB) | SDK de Firebase |

El arreglo fue `imgCld()`: Cloudinary transforma al servir (`f_auto,q_auto,w_`)
en vez de servir el archivo original. **-32% medido.** No se sube transformada
y se guarda la url transformada a propósito: si mañana cambia el tamaño del
cuadro, el cambio tiene que alcanzar a las fotos de ayer también.

**Lo que NO se hizo, y por qué:**

- **El SDK de Firebase (1,35 MB) se sigue cargando antes del primer pintado.**
  Es lo único grande que queda. Se arreglaría con `import()` dinámico para no
  pedirlo hasta que haga falta, pero `main.js` es un archivo de 6.400 líneas que
  usa Firestore en casi todas las pantallas: cambiar el momento del import es
  tocar ese archivo entero. Es un trabajo aparte, con su propia prueba.
- **Los PNG no se pueden mejorar.** Se probó recodificarlos con canvas
  (`tests/optimiza-iconos.js`): 0 KB de ahorro. El `icon-512.png` pesa 316 KB y
  el `logo-256.png` 82 KB, pero ya están comprimidos. Bajarlos de resolución sí
  los aligeraría, a costa de nitidez.

### 3 y 7. La foto del barbero

El "Cambiar foto" del barbero escribía en `users/`, en `staff/` y después
intentaba `config/barberos`. **Ese último write siempre era denegado**
(`config` es del dueño solo) y el error se tragaba con un `.catch(() => {})`.
La foto se guardaba y la web seguía mostrando el cartel `[Foto]`.

Aparte, aunque pasara, la landing lee la ficha de `config/barberos` y
`staff/{uid}` **no se puede leer sin sesión**: el visitante anónimo nunca la
vería.

Solución: una colección pública y mínima, `fotoBarbero/{uid}`, que se lee sin
sesión y solo escribe el propio barbero, y solo el campo `foto`. La ficha sigue
en `config/barberos`; lo único que sale de la colección nueva es la foto, y la
web la mergea encima (`conFotos`).

**Y el botón "Foto" del dueño desaparece**, como pidió. Que dos personas
editen el mismo rostro es invitación a pisarse.

### 4. "Editar perfil" del barbero

Hacía dos cosas mal, una mía del lote 23:

1. Llamaba `verWebOn()` como si fuera una función. No lo es: es una entrada del
   objeto de acciones. Tiraba `ReferenceError` y no pasaba nada.
2. El diseño entero sobraba. Yo suponía que el barbero tenía que ir a la web a
   voltear su tarjeta, pero **el bloque "Mi perfil en la web" ya está dentro de
   panel**, en su Agenda. Ahora lo abre, lo centra y le deja el foco en el
   primer campo.

### 5. "No tenés permiso para esa acción"

**No se pudo reproducir.** Se probaron, como dueño y apretando el botón de
verdad: carga manual, agendar turno con cliente nuevo, agendar turno con cliente
existente, editar el nombre del barbero. **Ninguno dio permiso denegado.**

Una hipótesis mía que **se-midió-y-resultó-falsa**: pensé que
`match /activos` rompía los `create` por usar `resource.data` en un
`allow read, write`. Se comprobó contra la base real: el dueño **sí** puede
crear en `activos` (HTTP 200). Si se hubiera "arreglado" sin medir, se había
metido un cambio de reglas sin causa.

Lo que sí se cambió es el **texto** del cartel: decía "revisá que las reglas de
Firestore estén publicadas (FIRESTORE_RULES.txt, el punto 6 del comentario de
arriba)". Eso es una nota de desarrollo pegada en un mensaje de persona.

### 6. El dueño aparecía como cliente

El filtro de `cliH` sacaba a los barberos y a los borrados, pero no al dueño:
su documento en `users/` no tiene rol `barbero`, así que pasaba. Ahora se lo
excluye por uid.

### 8. "Máximo 20 puntos"

El tope estaba en **dos** lugares atados entre sí: el panel (`Math.min(20)`) y
la regla de Firestore (`pt <= 20`). Subieron los dos a 50. Si se subiera sólo
el panel, el dueño escribe 50, la base lo rechaza y la cuenta queda creada en
Auth sin documento: el alta parece funcionar y no pasa nada.

### 9. Ajustes: "horarios - servicios - puntos"

- **"Negocio" eliminado.** Mostraba nombre, autor y WhatsApp como texto que no
  se podía editar (eran los valores fijos de `src/config.js`). En una pantalla
  que se llama *Ajustes* eso hace creer que ahí se cambia algo.
- **"Servicios y premios" partido** en "Servicios" y "Puntos". Era un botón
  largo con dos cosas distintas en dos columnas.

### 10. Los mensajes del formulario de contacto

**No se envían a ningún correo.** `enviarContacto` hace un `addDoc` a la
colección `mensajes` de Firestore. El único "correo" del proyecto es la
constante `EMAIL` de `src/config.js` (`hola@codigobarber1.com`), y ése es
**texto que se muestra** en la landing y en las políticas, no una bandeja.

Y había algo peor: las reglas dejan leer `mensajes` sólo al dueño, pero **ninguna
pantalla los mostraba**. Los mensajes entraban a la base y no había forma de
verlos sin abrir la consola de Firebase, mientras el formulario prometía "¡Mensaje
enviado! Te respondemos pronto."

Ahora hay pantalla **Mensajes** en el panel del dueño, con la lista y para
borrar.

## Dos bugs de pruebas que aparecieron de paso

**La casita no se le veía al cliente.** Estaba `body:not(.adm) #web { display:
none !important }` en el CSS, un resto del diseño viejo, y el `!important` le
ganaba a la regla nueva del lote 23. El cliente llevaba desde el lote 23 sin ver
la casita.

No lo detectaron las pruebas porque **`panel.shell.js` contaba que el elemento
existiera, no que se viera**: `#web:not([hidden])` con `.count()` da 1 para un
elemento dibujado en 0×0. Ahora se mide `getBoundingClientRect()`. Y
`landing.web.js` usaba `offsetParent` para preguntar si algo se ve, que no
funciona con elementos posicionados (`<header>` es `position: sticky`).

Es la misma trampa que con `nav` en la barra de celular: **contar no es ver.**

**"Mensajes" no abría.** `mens` estaba en `rtOk` pero no en la tabla de rutas
`RT`, así que el botón armaba `#/undefined`. Ahora hay una prueba que aprieta el
 botón y mira que llegue a `#/mensajes`.

## La meta CSP del HTML

Estaba `<meta http-equiv="Content-Security-Policy" content="script-src ...">` en
`index.html`, **además** de la que manda `vercel.json`. Cuando hay dos, el
navegador aplica la más restrictiva. La del `<meta>` sólo decía `script-src`,
así que hoy no rompía nada, pero es un segundo lugar que actualizar: es
exactamente el tipo de cosa que se desincroniza sin que nadie lo note.

Se eliminó. La CSP vive en `vercel.json` (producción) y `tests/srv.js`
(desarrollo), y `tests/csp.sync.js` verifica que sean idénticas.

## Ojo: los íconos PNG

| archivo | peso | para qué |
|---|---|---|
| `icon-512.png` | 316 KB | cuando Android instala la app |
| `logo-256.png` | 82 KB | el loader, en el primer pintado |
| `icon-192.png` | 47 KB | el ícono de la pestaña, en cada carga |

Ya están comprimidos (probé recodificarlos: 0 KB de ahorro). Si se quisieran
aligerar hay que bajarlos de resolución, y eso es una decisión del dueño, no
mía.

## Dato para que confirme el dueño

`EMAIL` en `src/config.js` es **"hola@codigobarber1.com"**, con un `1` antes
del punto, y el sitio que se está usando es **codigobarber.com.ar**. Puede estar
mal. No se tocó: es información del dueño.

---

## 25. Publicar: limpiar lo que no va, y dos agujeros de seguridad

### El cartel de "Se abrió una ventana antes de terminar la anterior"

Ese texto **no existe más en el código**. Lo que se ve en
`codigobarber.com.ar` es la versión vieja, porque el arreglo del lote 24 todavía
no se desplegó. Para que no quede en el aire la duda de si funciona, ahora hay
una prueba que llama `err()` con ese código y comprueba que **no** aparece
ningún cartel, y al lado que un error de verdad (`auth/wrong-password`) **sí**
aparece.

Escribir esa prueba dio una lección:

- El primer borrador usaba `#mf` para preguntar por el modal. `#mf` no existe:
  el modal es `#mo`. Con un selector que no existe, `querySelector` devuelve
  `null`, `!null.hidden` da error... y el chequeo "no hay cartel" daba **verde
  por falso**. Recién cuando se agregó el caso contrario —"un error de verdad SÍ
  abre cartel"— se descubrió que el selector estaba mal.
- **Una comprobación negativa necesita una positiva que la contradiga.** Si sólo
  preguntás "¿no aparece el cartel?", un selector roto responde lo mismo que un
  sistema que anda bien.

### Los `console.log`

No queda ninguno: **cero llamadas a `console.*` en todo lo que se publica**
(`main.js`, `styles.css`, `landing.css`, `config.js`, `boot.js`, `index.html`,
`sw.js`). Eran tres `console.error`, y los tres ya informaban por otra vía (el
texto del estado, `err(e)` o el mensaje de error de la vista), así que eran
duplicado. Uno volcaba el turno entero —uid, nombre, barbero, fecha, hora,
cupos— en la consola del navegador.

**Lo que NO se tocó y por qué:**

- `window.__test`: sigue, encerrado por `location.hostname`
  (localhost/127.0.0.1). En producción no se activa y son 40 líneas de un
  archivo de 6.500. Sacarlas dejaría sin pruebas la mitad del panel.
- Los comentarios `TODO` de `main.js` y `config.js`: no son trabajo a medias, son
  la nota de "esto sale del campo X" y de "sin reseñas reales no se inventa
  ninguna". Borrarlos perdería el criterio.
- `src/boot.js` mide 0 KB y queda: se carga.

### Dos agujeros que aparecieron revisando qué se publica

**1. `.env.example` tenía las contraseñas reales.** Las tres cuentas de prueba
comparten `Agus203.`, y ese archivo, commiteado desde el 8 de octubre, lo tenía
escrito. No se veía en el sitio publicado (Vercel daba 404 en `.env*`), pero
**queda en el historial de git**, que es lo que importa si el repositorio es
público.

Ahora el archivo está vacío y con la advertencia, se excluye del deploy y se
sacó la excepción de `.gitignore`.

> **Esto no cambia las contraseñas de las cuentas.** Hay que cambiarlas a mano en
> Firebase Console > Authentication, aunque el archivo ya esté limpio.

**2. `ACTIVAR_GOOGLE_FACEBOOK.md` estaba público.** Confirmado con un 200 en
`codigobarber.com.ar/ACTIVAR_GOOGLE_FACEBOOK.md`. No tiene contraseñas, pero es
una guía interna de la consola de Firebase. Ahora está en `.vercelignore`.

Y de paso, `.env.local` (las contraseñas de verdad) **no estaba en
`.vercelignore`**: estaba en `.gitignore`, que no frena a Vercel. Daba 404, pero
por suerte y no por configuración. Se agregó explícitamente.

### `src/logic.js` estaba muerto

No lo referenciaba nadie **salvo la precarga del service worker**. Helpers
duplicados que ya están en `main.js`. Borrado, y saca de `SHELL`.

### `tests/deploy.carga.js`: no desplegar para enterarse

Aplica `.vercelignore` al listado del repo y dice qué se subiría. Resultado
actual: **27 archivos, 1,2 MB**. Y comprueba tres cosas que antes nadie miraba:

1. que no se suba nada indebido (`.env`, reglas de Firestore, pruebas, docs,
   mapas de fuentes),
2. que **todo lo que el service worker precachea exista** y se suba de verdad —
   `src/logic.js` estaba en esa lista siendo un archivo muerto; `install` tiene
   un `catch` por archivo, así que no rompía nada, pero el worker cacheaba un
   shell incompleto,
3. que el shell tenga `index.html`, `main.js` y los dos CSS.

### Un detalle

`sw.js` sigue en `barberia-v7`. Cuando se despliegue, hay que **subir el número
de versión**: si no, los visitantes que ya tienen la versión 7 cacheada no se
ven actualizando.

## Antes de publicar

- [ ] Desplegar (`vercel` desde esta carpeta).
- [ ] **Subir `V` en `sw.js` a `barberia-v8`**, si no los visitantes no ven la
      versión nueva.
- [ ] Pegar `FIRESTORE_RULES.txt` en Firebase Console > Firestore > Reglas
      (trae `fotoBarbero` y el tope de 50).
- [ ] **Cambiar la contraseña de las tres cuentas de prueba.**
- [ ] Verificar que `codigobarber.com.ar/ACTIVAR_GOOGLE_FACEBOOK.md` da 404.

---

## 26. Las fotos no cargaban, y la accesibilidad en el teléfono

### Las fotos: un 404 mío, tapado por una medición que mentía

Todas las imágenes de la landing daban **404**. La causa: la transformación de
Cloudinary quedó con el orden al revés. El formato es

```
.../upload/<transformación>/<versión>/<public_id>
```

y yo había puesto `.../upload/<versión>/<transformación>/<public_id>`. Comprobado
contra el servicio: con el orden viejo HTTP 404, con el correcto HTTP 200.

**Lo más incómodo es cómo se escondió.** El lote 25 ("el rendimiento bajó 32%")
lo MIDIÓ con imágenes rotas: `tests/perf.movil.js` sumaba bytes y no miraba el
código de respuesta, y una imagen rota son 357 bytes. El peso bajó, la
medición quedó mejor, y el sitio se rompió. Cuando una medición mejora y el sitio
no, la medición está mal.

Con el orden bien, el ahorro real medido contra Cloudinary es de **48%**
(95 KB → 49 KB en WebP). El 32% anterior era mentira.

Nueva `tests/img.vivas.js` (18 checks): saca la función `imgCld` del código
real, le pasa las 7 fotos que hay cargadas en la base y exige que cada una
responda **200 y devuelva una imagen**. También comprueba que lo que no es de
Cloudinary no se toque.

### Accesibilidad: de 44 elementos con problemas a 0

No se pudo traer el informe de PageSpeed (la API responde HTTP 429, cuota de la
clave compartida), así que se corrió **axe-core**, que es el mismo motor que usa
Lighthouse para esa categoría. Medido en móvil emulado (390×844):

| pantalla | antes | después |
|---|---|---|
| landing | 39 elementos con problemas | **0 violaciones** |
| ingreso | 4 | **0 violaciones** |
| panel del dueño | 10 | **0 violaciones** |

Lo que se corrigió:

- **`#app` era un `<div>`**: todo el cuerpo de la página quedaba fuera de
  cualquier landmark (37 elementos, el peor problema de los tres). Con
  `<main id="app">` se puede saltar al contenido con el teclado o el lector de
  pantalla. No cambia ni un píxel: `<main>` es `block` como `<div>`.
- **El login tenía su propio `<main class="shell">`**: con el de `#app` quedaban
  **dos** landmarks main en la misma pantalla, que es peor que ninguno. Pasó a
  `<div class="shell">`.
- **La foto del header** llevaba `aria-label` sobre un `<span>` sin rol: es un
  atributo ARIA prohibido. Se le agregó `role="img"`.
- **Encabezados que se saltaban un nivel**: `<h1>` seguido de `<h3>` (el widget
  y la tarjeta de reservar, ahora `<h2>`) y los `<h4>` del pie (ahora
  `<h2 class="ft-h">`, con el CSS actualizado).

Nueva `tests/accesibilidad.js`: corre axe en las tres pantallas, en móvil, y
falla si aparece cualquier violación.

### Un bug de scroll que salió en el camino

`landing.barberos` empezó a fallar en 390 px, siempre igual. No era la prueba:
el cálculo de scroll de la ficha del barbero tomaba el borde inferior de
`.lb-hd` como "dónde termina el header". Pero ese header es `sticky` **sólo
dentro del alcance de su padre**: al scrollear lejos se despega y su `bottom`
se va a **-2447**. Con eso, `arriba` daba -2435, la comparación nunca se
cumplía y **el scroll no se hacía nunca**: al tocar una ficha en el celular la
tarjeta quedaba con el remate cortado arriba.

Ahora se mide el header que **realmente está tapando**; si no hay ninguno
pegado, se deja un margen chico, porque un header que no se ve no puede tapar
nada.

Y la prueba, que pedía `top >= 60` suponiendo un header de 60 px, ahora mide el
header que hay. No se aflojó la comprobación: se corrigió la suposición.

### Dos cosas que se learnieron mirando

**Un comentario JSX dentro de una plantilla sale literal.** Al cambiar un `<h3>`
por `<h2>` se escribió `{/* ... */}` dentro de un `template literal` de
JavaScript, que no es un comentario: es una expresión que vale `undefined`. Va
como `<!-- ... -->`. (En el código hay siete `${/* ... */ expr ? a : b}` que sí
son correctos: ahí el comentario va seguido de la expresión.)

**El service worker servía código viejo a las pruebas.** `tests/accesibilidad.js`
seguía reportando un `<h3>` que en el archivo ya era `<h2>`: el `main.js` salía
de la caché del worker. Ahora la prueba desregistra el worker y vacía las cachés
antes de medir. **Ojo: cualquier prueba que mida algo visual debería hacerlo,
o puede estar midiendo la corrida anterior.**

---

## 28. Se rompio la seccion de servicios, y las reglas de Firestore

### Lo que se rompio (y era mio)

En la landing se veian **las dos listas de servicios a la vez**: la de
escritorio bien, y la de celular sin acotar, con fotos de 1158 y 1438 px de ancho
en vez de 48. Ademas el resto de las secciones quedaban colgando fuera del
contenedor principal.

**Causa: commit `997346b`.** La tarjeta de servicio abria
`<article class="lb-sv">` y cerraba con `</div>`.

El navegador no se queja de un cierre desbalanceado. Lo que hace es cerrar de
mas el contenedor y "colgar" el resto del HTML afuera de `div.lb`. Entonces:

- `div.lb` terminaba despues de la seccion de servicios
- `.lb-sv-list-m` quedaba como hija directa de `<main>`, fuera de `.lb`
- y el selector `.lb .lb-sv-list-m { display: none }` dejaba de alcanzarla,
  asi que se veian las dos listas

Salio de un reemplazo a ciegas: `String.replace` con una cadena cambia **solo
la primera** ocurrencia, y en un archivo de 6.500 lineas la primera no era la que
yo creia.

**Por que rompio recién ahora y no antes:** el bug de estructura estaba desde
hacia rato, pero las fotos devolvian 404 y no se veian. El arreglo de `imgCld`
(que si funcionaba) las trajo de vuelta, y recien ahi se noto el desborde.

En el mismo commit habia otros dos desajustes:

- El carrusel de resenas: al cambiar `<article>` por `<div>` (por
  `role="group"`, que `article` no admite) cambie la apertura y no el cierre.
  Quedo `<div class="lb-tst">` cerrando con `</article>`.
- `<h3 class="lab">` paso a `<h2 class="lab">` en nueve lugares y el cierre se
  quedo en `</h3>`.

Medido despues del arreglo:

| | escritorio | movil |
|---|---|---|
| hijos de `<main>` | `[DIV.lb]` | `[DIV.lb]` |
| imagenes | 373x466 x3 | 48x48 x3 |
| grilla | `grid` | `none` |
| lista de celular | `none` | `block` |

### La guarda que faltaba: tests/html.valido.js

**Por que ninguna prueba lo agarro:** todas miran el DOM ya parseado, y el
parser de HTML *repara* los cierres desbalanceados en silencio. No hay forma de
detectar el error mirando el resultado; hay que mirar la entrada.

La prueba intercepta el setter de `innerHTML` de `#app` **antes** de que corra
la app (`addInitScript`), se queda con la CADENA que genera y valida el balance
de etiquetas de la landing y de las ocho pantallas del panel. Ademas comprueba
que en la landing `#app` tenga una sola raiz `.lb` y que las dos listas de
servicios sigan DENTRO de `.lb`, que es justo lo que se habia roto.

### FIRESTORE_RULES.txt: lo reescribiste y casi se pierde el endurecimiento

El 13/10 a las 01:56 el archivo de reglas fue modificado a mano y quedo con una
version **anterior a la auditoria**: sin `fotoBarbero`, con el tope de puntos en
20, y con los agujeros abiertos de `config`, `ventas`, `gastos`, `turnos` y
el campo `pd` de `staff`.

**Lo importante: las reglas que estan publicadas en Firebase NO son las de ese
archivo.** Se comprobo contra la base real: `fotoBarbero` se lee (HTTP 200) y
`config/finanzas` da 403, dos cosas que solo existen en la version endurecida.
O sea: el archivo y la consola se separaron.

Decidiste mezclar: **tu version como base, con el endurecimiento de vuelta.**

Se hizo mezclando, no reemplazando. De tu version se conserva todo lo que ya
estaba bien (la rama de clientes en `resenas`, la validacion de `mensajes`,
los bloques de `ocupados`/`espera`/`activos`) y se le vuelven a cerrar los
agujeros.

**Verificado: el codigo de las reglas quedo identico linea por linea al que ya
esta publicado y compila** (126 lineas de codigo, cero diferencias). Solo
cambian los comentarios, que ahora explican el porque de cada cierre.

Un detalle que casi se cuela: la primera version de la mezcla traia un bloque
`config/barberos` con `.slice(...).concat(...)` y `.where(...).index` que
yo habia inventado, distinto del publicado y con sintaxis que no se puede
compilar desde aca. Se volvio al que ya se probo y funciona.

### Las pruebas que faltan para que no vuelva a pasar

La app **no falla visible** cuando Firestore deniega un write: el error se traga
con un `.catch`. Por eso la regresion de las reglas paso desapercibida y solo
se vio por el cartel de "Maximo 20 puntos". tests/lote25.js ahora chequea los
ocho cierres, y **se comprobo que muerden**: se debuted cada regla una por una
con un archivo alterado y las ocho lo detectaron.

Dos correcciones sobre la marcha:

- `ventas`: la primera versión del chequeo contaba dos apariciones de
  `resource.data.bid == request.auth.uid`, pero ese texto va **dentro** de
  `request.resource.data.bid` del create. Contaba una de más y seguía dando
  verde con una venta abierta al equipo entero. Ahora se exige que en el bloque
  no aparezca ni un `isBarberoOrOwner()` y que cada linea con `isStaff()`
  lleve además el filtro por `bid`.
- Endurecer de más también rompe: si el `create` de `ventas` pierde la rama
  del barbero, un barbero que cobra un corte no puede registrar la venta y la
  plata se pierde. Ese caso tiene su propio chequeo.

### prueba de accesibilidad: el CDN se cae

`tests/accesibilidad.js` baja `axe-core` de cdnjs. En la suite murió con un
`Error` a secas, sin decir que lo que habia fallado era bajar la libreria y no
la accesibilidad. Ahora reintenta tres veces y, si sigue sin bajar, dice
exactamente que el informe de ese intento no es valido.

Medido por separado, en las tres pantallas y a 390x844:
**0 violaciones** (47 reglas en la landing, 36 en el ingreso, 40 en el panel).

### Estado de la suite

36 pruebas · 832 comprobaciones · 1 en rojo durante la corrida
(`accesibilidad`, por el CDN; pasa sola con 0 violaciones).

## 29 a 32: backfill

**Este archivo se había quedado en el lote 28.** Los lotes 29, 30, 31 y 32
estaban en el historial de git y en `PRODUCT.md`, pero no acá: el que abriera este
archivo para seguir trabajando no se enteraba de cuatro lotes enteros.

Las decisiones de producto de esos cuatro lotes **sí** están en `PRODUCT.md`
(secciones 29, 30, 31 y 32). Acá va lo técnico.

### 29. La foto del barbero llega a la web, y "Editar perfil" guarda y es modal

- La foto del barbero pasó a su propio documento `fotoBarbero/{uid}` (foto, n, esp,
  desc, tel, ig, redes), con lectura pública y escritura sólo del propio. Decisión
  del dueño. Sin `diff(resource.data)`: en el *create* eso no existe y la regla
  tiraba 403.
- `config/barberos` vuelve a ser sólo del dueño, y el barbero **no** se agrega a
  la lista pública.
- `guardarPerfil` y `fotoTomar` dejaron de usar `Promise.all`: cada escritura va
  por separado y si una falla se dice **cuál**, en vez de perder el error de la
  otra.
- `motivoFirestore()` explica `ERR_BLOCKED_BY_CLIENT` (Brave Shields, una
  extensión), red caída y permiso denegado por separado.
- "Editar perfil" pasó a ser un modal (`#mo`, `role="dialog"`), no un `<details>`
  inline. Cancelar usa `data-act="Mx"`. El helper se llama `cerrarModalPerfil`,
  porque `cerrarPerfil` ya lo tenía la acción del menú del encabezado.
- Tope de puntos de bienvenida: 20 → **50**.

### 30. Se saca el botón de Facebook

Del ingreso y del registro. Se fue también el import de `FacebookAuthProvider` y
`red(p, registro)` pasó a `red(registro)`.

**El proveedor sigue habilitado en Firebase** (no se puede desactivar desde el
cliente). El dueño tiene que apagarlo en la consola.

Riesgo sin resolver: **no se pueden listar los usuarios de Firebase Auth** sin
OAuth de administrador, así que no se pudo verificar si quedó alguna cuenta creada
con Facebook. Esa cuenta no tendría contraseña y quedaría bloqueada para siempre.

### 31. Scroll suave, la foto en el panel, los mensajes y el tope de bienvenida

- `html { scroll-behavior: smooth }` + `scroll-margin-top` en `.lb-sec[id]`. El
  override de `prefers-reduced-motion` va en `html`, no en `.lb *`.
- **`BARS` tenía tres asignaciones y dos se saltaban `conFotos`**. El dueño veía
  "R" en vez de la foto, y la foto también desaparecía de la web al volver del
  panel. Las tres pasan por `conFotos` ahora.
- **La consulta de `mensajes` nunca se abría.** Estaba como
  `if (isOwner())` a nivel de módulo, cuando `me` todavía es `null`. Había 3
  mensajes y la pantalla decía 0. Se movió dentro de `setup()`.
- El tope de bienvenida volvió a 50 (el lote 29 lo había dejado en 20).
- `sw.js` v7 → v12 en estos lotes.

### 32. Las políticas leen la configuración

`PTSv`, `PTSRv`, `CHSv`, `PRv` y `lbHorarioTxt("")` salen de la configuración
real. Los premios estaban escritos a mano (25/50/100) contra los reales
(20/40/100): el documento que firma el usuario decía un premio que no existía.
`POL_VERSION` y `POL_FECHA` quedan manuales, y son la versión del **texto**, no de
los datos.

### Un incidente con datos de producción

Una prueba de políticas cambió `config/reglas` a `pts:12, cancelHs:8`. **El script
de restauración falló** (el click a la pestaña tenía `.catch()`, que se tragó el
error, y los `fill` siguientes escribieron sobre nada). Restaurado a mano por la
API de Firestore y **verificado**:

    antes de restaurar: {"pts":12, "cancelHs":8}
    después:           {"pts":5,  "cancelHs":5}

`premios` (20/40/100) y `ptsRegistro` nunca se tocaron.

Otro: un script de diagnóstico escribió `foto: ""` en `fotoBarbero/{barberUid}`.
Para cuando se detectó, el barbero ya había vuelto a guardarla
(`v1791910269`).

## 33. Menos botones de reservar, y el resumen legible en el móvil

Cinco pedidos del dueño. El detalle está en `PRODUCT.md`, sección 33. Lo técnico:

### El bug del resumen

El síntoma era que el valor de cada fila se partía letra por letra en el móvil.

**El primer diagnóstico falló.** Se cambió `overflow-wrap: anywhere` por
`break-word` y no cambió nada: medido, con los dos la celda colapsaba igual. La
propiedad estaba bien, lo que estaba mal era el ancho.

Las dos causas:

- `.wz-res-cols` usaba `minmax(0, 1.25fr)` para la columna izquierda: un piso de
  **cero**. En una ventana de 900px la tarjeta quedaba en 184px y la celda del
  valor en **18px**.
- `.wz-rf-t` era `flex: 1`: se quedaba con lo que sobrara después del ícono (38px)
  y del botón "Cambiar" (`flex: 0 0 auto`). No sobraba nada.

El arreglo:

```css
.wz-res-cols { grid-template-columns: minmax(240px, 1.25fr) minmax(220px, 0.85fr); }
.wz-rf       { flex-wrap: wrap; }
.wz-rf-t     { flex: 1 1 130px; }
```

Con `flex-wrap` + un flex-basis, si el texto no entra con el botón al lado **el
botón baja de renglón**. El texto nunca queda por debajo de su base. No hay que
adivinar un ancho: se acomoda sola en cualquier pantalla.

Medido en la ventana real a 390px (hoja de 358px), las cuatro filas:

| fila | antes | ahora |
|---|---|---|
| SERVICIO | 18px / 8 líneas | 154px / 2 líneas |
| BARBERO | 18px / 5 líneas | 154px / 1 línea |
| FECHA | 18px / 5 líneas | 154px / 1 línea |
| HORA | 18px / 5 líneas | 154px / 2 líneas |

Y con la grilla real a 360, 430, 540, 700 y 900px: todo entra en **una** línea.

### "Reservar con {barbero}" ahora abre la misma ventana

`lbReservarBar(id)` ya no llama a `lbReservar()` (que sacaba al cliente de la web y
lo mandaba a `#/reservar`). Ahora:

- pone `sel.b = id` (**no** `lbw.b`: son dos estados distintos, y con sólo `lbw` la
  ventana se abría en el paso 2 pidiendo barbero),
- arranca en `lbPrimerPaso()`, el primer paso que falte,
- sin sesión abre el modal (`wzModal()`); con sesión va a la pantalla del panel,
  porque ahí el mismo asistente se dibuja como página.

`lbCerrarMenu()` es una función de módulo, no una acción: `lbMenu()` es un
interruptor, así que llamarla para cerrar la habría vuelto a abrir.

El cierre automático del menú va en el listener global de click
(`e.target.closest("#lbPanel")`), no en un `data-act` por link, porque los `<a>`
necesitan su href para el scroll suave y para el teclado.

### Dos cosas que quedaron fuera

`.lb-sticky` (4 reglas) y `.lb-elige` (5 reglas) quedaron sin uso y se borraron.
`tests/css.muerto.js` lo confirma.

### Dos pruebas que mentían

- Una buscaba `minmax(0, 1.25fr)` en todo el archivo CSS y lo encontraba **en el
  comentario que explica el bug**. Ahora busca en el código sin comentarios.
- La siguiente miraba el **primer** bloque `.wz-res-cols` (el base, de una columna)
  en vez del del media query. Con el primero daba **falso constante**: detectaba
  cualquier cosa, que es peor que no comprobar. Ahora mira los dos bloques.

Es la tercera vez en este repo que una afirmación pasa con un selector roto. La
regla que sale de esto: **una comprobación negativa necesita su contrapartida
positiva, y tiene que correr sobre el código sin comentarios.**

`tests/lote25.js`: 85 → 98 comprobaciones. Las 7 nuevas se verificaron una por una
reintroduciendo el bug sobre una copia del archivo: las 7 lo detectan.

`tests/landing.barberos.js` exigía el hash `#/reservar`, que era el comportamiento
viejo. Ahora comprueba las dos formas (ventana sin sesión, pantalla con sesión) y
que la ficha se cierre: 147 → 156.

sw.js v13 -> v14.

Suite: 37 pruebas · 883 comprobaciones · 0 en rojo.

## 34. Los cuatro botones hacen los pasos, y el ingreso se pide al final

Detalle en `PRODUCT.md`, sección 34. Lo técnico:

### `lbAbreReserva()`

Los cuatro botones de reserva de la web pasan por una sola función nueva:

- el del encabezado y el de la banda dorada (`data-act="lbReservar"`)
- el de cada barbero (`data-act="lbReservarBar"`)
- y el "Elegir mi turno" de la tarjeta, que ya llamaba a `wzAbrir`

Sin sesión abre `wzModal()` en `lbPrimerPaso()`. Con sesión va a la pantalla del
panel (`rtPush("res")`), porque ahí el asistente se dibuja como página.

### `turnoEnVuelo`

El bug de fondo: el turno se perdía al registrarse. Eran **tres** bugs, cada uno
por su cuenta. Ver detalle en PRODUCT.md; el resumen:

```js
function unsub(conservarTurno) {
  ...
  if (!conservarTurno) sel = { s: 0, d: "", t: "", b: "", pol: 0 };
}

onAuthStateChanged(auth, (a) => {
  unsub(a ? turnoEnVuelo : 0);   // no `unsub()`
  ...
});

// en setup(), donde antes pisaba el día sin condición:
if (!turnoEnVuelo) sel.d = days()[0] || "";

// en el listener de config/horario: ya no `days().includes(sel.d)` sino
if (sel.d && !diaUsable(sel.d)) { ... }

// y se enciende y apaga junto a WZ.resumir
turnoEnVuelo = WZ.resumir ? 1 : 0;   // en wzEntrar
turnoEnVuelo = 0;                     // en prep(), donde se consume WZ.resumir
```

**`turnoEnVuelo` está en el bloque de estado, no en `WZ`.** `WZ` se declara en la
línea ~5200 y `onAuthStateChanged` corre en la ~1260: leerlo ahí lo metería en la
zona muerta temporal. Con `let turnoEnVuelo = 0` arriba no hay problema.

`diaUsable(d)` reemplaza a `diaReservable(bid, d)`, que se probó y se descartó:
consultar el horario del barbero desde el listener hacía que el día se cayera
solo al registrarse.

### Código muerto que se borró

`lbWidget()`, `lbPaint()`, `lbSlots()`, `lbPaso()`, `lbPasoOn()`, los handlers
`lbS`/`lbB`/`lbT` y `const lbw`. El widget compacto de 4 pasos: no se dibuja desde
que la reserva es el modal de 6 pasos.

Verificado en el navegador antes de borrar: `#lbw` = 0 elementos, `.lb-wl` = 0,
`.lb-chip` = 0.

Su CSS: `.lb-wl` (9 reglas) y `.lb-chip` (8), en `src/landing.css`.

**Al borrar `.lb-wl:hover` se fue la llave de apertura** del bloque
`@media (hover: none)` que la compartía con `.lb-btn:hover`. El CSS quedó
desbalanceado (562 `{` contra 563 `}`).

Se detectó **contando llaves**, no mirando el archivo. Conviene correr ese chequeo
después de borrar reglas que comparten bloque:

```js
const css = fs.readFileSync("src/landing.css", "utf8");
const a = (css.match(/\{/g) || []).length, c = (css.match(/\}/g) || []).length;
console.log(a === c ? "balanceado" : "DESBALANCEADO");
```

### El arnés que verifica que las pruebas muerden

Las 13 comprobaciones nuevas se verificaron una por una reintroduciendo el bug
sobre una copia del archivo.

**El arnés casi repite el error conocido.** Las primeras cinco pruebas usaban
variables calculadas una vez por fuera (`cuerpoLbReservar`, `cuerpoLbAbre`), así
que cuando el ataque cambiaba el código, la prueba seguía mirando el texto
viejo y daba verde con el bug presente. Cinco de trece NO detectaban nada.

Ahora cada prueba recibe `(s, c)` y **deriva** de los archivos lo que necesita
(`cuerpo(s, a, b)`). Esa es la corrección: el arnés también tiene que leer el
archivo mutado, no el texto que tenía antes del ataque.

`tests/lote25.js`: 98 -> 110 comprobaciones. Una de las nuevas mira
`sinComentarios` y no `src`, porque el comentario que explica el borrado del
widget menciona `lbWidget()` y `lbPaint()`.

sw.js v14 -> v15.

Suite: 37 pruebas · 895 comprobaciones · 0 en rojo.

## 35. El resumen se salía de la ventana en escritorio

Detalle en `PRODUCT.md`, sección 35. Lo técnico:

### La causa era del lote 33

`minmax()` tiene **pisos reales**. Si los dos tracks no entran, la grilla **no**
cae a una columna: se desbora. Eso es lo que dice el comentario correcto ahora,
y lo que decía al revés antes.

La cuenta que faltaba, y que ahora está en `tests/lote25.js`:

```js
const pisos = [...bloque.matchAll(/minmax\((\d+)px/g)].map((m) => +m[1]);
const gap = +((bloque.match(/gap:\s*(\d+)px/) || [])[1] || 0);
const padding = +((lc.match(/\.wz-sheet \{[\s\S]*?padding:\s*(\d+)px/) || [])[1] || 0);
const anchos = [...lc.matchAll(/\.wz-sheet \{[\s\S]*?max-width:\s*(\d+)px/g)].map((m) => +m[1]);

const minimo = pisos.reduce((a, b) => a + b, 0) + gap;
ok(anchos.every((w) => w - padding * 2 >= minimo), "...");
```

El `max-width` de `.wz-sheet` y los pisos de `.wz-res-cols` **andan juntos**.
Cambiar uno sin mirar el otro rompe el resumen en escritorio, y el síntoma es
contento cortado, no un error.

### El arreglo

`@media (min-width: 900px) { .wz-sheet { max-width: 720px } }` (era 460px).

### Cómo medir este tipo de bug

No alcanza con ver capturas: hay que preguntar al DOM qué elemento se sale del
borde de su contenedor. El script que lo encontró recorre los hijos de la hoja y
compara cada `getBoundingClientRect()` contra el de la hoja:

```js
sheet.querySelectorAll("*").forEach((el) => {
  const b = el.getBoundingClientRect();
  if (b.right > sr.right + 1) culpables.push(el.className);
});
```

Y el desborde horizontal se ve en dos números, no en uno:
`sheet.scrollWidth > sheet.clientWidth`. Con `scrollWidth` solo no se nota si
nada se sale.

Anchos medidos: 320, 360, 390, 430, 540, 600, 640, 700, 768, 860, 880, 900, 940,
1024, 1100, 1280, 1440, 1600, 1920.

sw.js v15 -> v16.

Suite: 37 pruebas · 897 comprobaciones · 0 en rojo.

## 36. SSJ Barber, un solo barbero que es el dueño

Detalle en `PRODUCT.md`, sección 36. Lo técnico:

### `esElDueño(b)`

Un solo helper decide si una ficha de la lista es la del dueño:

```js
const esElDueño = (b) =>
  !!b && (b.yo === 1 || b.id === OWNER_UID || (!!b.uid && b.uid === OWNER_UID));
```

Dos formas, y el código acepta las dos a propósito: la marca `yo: 1` (la normal,
porque la ficha cargada tiene foto y descripción y cambiarle el `id` las haría
perder) y que el `id` sea el del dueño (lo que deja "Agregarme a mí" cuando la
lista está vacía).

**No se deduce del nombre.** Con dos fichas del mismo nombre —o una ficha vieja
apuntando a una cuenta que ya no usás— el nombre no dice nada.

### `bsnap()` y el 100

```js
return { bid: b.id, bn: b.n, pd: esElDueño(b) ? 100 : b.pd };
```

El 100 va **en el cobro**, no sólo al mostrarlo: cada cobro guarda su `pd`, así
que los viejos conservan el suyo y los nuevos se guardan con 100.

### Por qué NO se usa "Hacer barbero"

Esa acción escribe `staff/{uid}`. Con eso el dueño pasa a tener `SB` cargado, y
`SB` aparece en un montón de ramas escritas para "no soy el dueño":

- `bsnap`: `if (!isOwner() && SB)` → el dueño se excluye a propósito
- la agenda: `T.filter((t) => !SB || isOwner() || ...)` → el dueño tiene que ver todo
- el selector de barbero: `FN.bs.filter((b) => !SB || isOwner() || ...)`
- el pie: `quien = isAdm() ? (SB && SB.n) || "Dueño" : ...`

Por eso la ficha del dueño va **sin `uid`**, como los barberos agregados a mano:
no le crea documento de barbero, y `quitBar` no intenta ni borrarlo ni tocarle el
rol en `users`. Y `mkBar` rechaza al dueño explícitamente, para que no se
duplique en la lista.

### La publicación de la lista no puede perder la ficha

Cada vez que el dueño entra al panel se republica `config/barberos`, y el reparto
se hacía sobre `BARS`:

```js
const prev = BARS.find((x) => x.id === b.id) || {};
```

`BARS` la arman tres listeners (módulo, inicio de sesión, `config/finanzas`) sin
orden garantizado. Si `finanzas` gana la carrera, `BARS` está vacío y cada `prev`
es `{}`: **la lista se reescribía sin foto, oficio, descripción, WhatsApp ni
Instagram**.

Ahora usa `PUB.barberos`, que es "lo último que se publicó" y siempre está al día
(`conFotos` lo usa al cerrar sesión).

### Comprobaciones que miran dónde está el código, no sólo si existe

La primera versión del botón cayó en una variable `right` que se armaba y nunca
se usaba. Dos comprobaciones lo evitan:

- que `data-act="feYo"` esté **dentro** del `<details>` que sí se dibuja;
- que `data-act="feYo"` aparezca **una sola vez** en todo el archivo.

### La tabla de "Porcentaje por barbero"

Buscaba al barbero por nombre (`fe.bs.find(b => b.n === g.n)`) e imponía ese
porcentaje sobre todo su facturado. Ahora usa los propios cobros: `g.o` ya
acumula la parte del dueño de cada uno, la del barbero es `g.t - g.o`, y el
porcentaje sale de ahí. Con el dueño como único barbero da 100% sin ningún caso
especial.

### Leer el estado de Firestore desde el navegador

La API REST **no sirve** para varias de estas colecciones:

- `config/barberos` por REST responde **403**: las reglas dan `get`, no `list`.
- `fotoBarbero` responde **200** al principio y **403** después: es cuota de la API
  key, y a veces hay que reintentar.

La forma que sí funciona es leerlo desde la página, con el gancho de pruebas:

```js
await page.evaluate(() => ({
  fotos: window.__test.fotos,            // la colección fotoBarbero
  bars: window.__test.bars.map((x) => ({ id: x.id, n: x.n, foto: x.foto })),
}));
```

sw.js v16 -> v17.

Suite: 37 pruebas · 844 comprobaciones · 2 en rojo (los dos son datos del dueño:
la foto del barbero y las dos cuentas de prueba; ver `PRODUCT.md`).

## 37. El dueño también es el barbero, y el logo

**Lo que hay que hacer vos, en este orden:**

1. **Entrá en "Editar perfil"** (el ícono de tu foto, arriba a la derecha) y subí
   tu foto. Es lo único que falta para que la tarjeta de la web la muestre.

   Comprobado leyendo los datos: `fotoBarbero/LQ7IkEfxEKNXajx4SEs378n390i2`
   (tu uid) existe pero con el campo `foto` **vacío**. La foto que hay cargada está
   bajo `fotoBarbero/omXpDusSJ6PQ9D8I9JGHgsYvpyJ2`, una cuenta vieja.

   Y la ficha de la lista (`RdQMQ0wSy8SBbaONeRA0JzFLwFR2`) **no es tuya**: la creó
   la cuenta del barbero de prueba, con su propio id y su propio uid. Vos ya la
   marcaste con "Yo también soy el barbero" (`yo: 1`). El código la encuentra igual
   por la tercera puerta, así que no hay que tocar la base: con que subas la foto
   aparece.

2. **El email**, en `src/config.js`:

   ```js
   export const EMAIL = ""; // TODO(dueño): poner el email de contacto
   ```

   Reemplazá `""` por tu dirección y listo. Mientras esté vacío, el aviso de
   privacidad dice "sin definir todavía".

3. **Si querés el nombre todo en mayúscula**, `NOMBRE` en `src/config.js`.

**Si algún día transferís la propiedad a otra cuenta:** hay que cambiar el UID en
**dos** lugares juntos —`ADMIN_UID`/`OWNER_UID` en `src/config.js` y el
`isOwner()` de `FIRESTORE_RULES.txt`— y **publicar** las reglas en la consola de
Firebase. Corré `node tests\owner.js` antes: compara los dos y falla si se separan.

**Nada de esto está en vivo.** Sigue sin desplegar: en `codigobarber.com.ar` está
`sw.js` v11 y acá va v18. Los lotes 29 a 37 son nueve sin publicar.

**Antes de publicar:**

- `FIRESTORE_RULES.txt` tiene que estar **publicado** en la consola de Firebase.
- Cambiar la contraseña de las tres cuentas de prueba y **desactivar el proveedor
  de Facebook** en la consola.
- Crear el perfil de Google Business (sigue sin existir).

**Detalles técnicos del lote:**

- `conFotos` y `miFicha` buscan por `id`, después por `uid`, y —si la ficha es del
  dueño— bajo `OWNER_UID`. Sólo por `id` era la
  razón de que la foto del dueño no se encontrara nunca.
- `marcarYo` guarda `uid: OWNER_UID` además de `yo: 1`, que es lo que habilita esa
  segunda búsqueda.
- `menuPerfil` cambió de `if (!isOwner())` a `if (isOwner()) ... else ...`.
- `yoBarbero` pasó a llamarse `soyBarbero` y marca la ficha existente.
- `EMAIL` vacío pasa por un helper `mailto()`: sin él, las dos apariciones del
  aviso de privacidad generaban un `mailto:` vacío.
- `tests/header.js` afirmaba lo contrario ("el dueño NO ve Editar perfil") y se
  actualizó al contrato nuevo. `tests/owner.js` es nueva y ya está en `run.js`.

**Flake conocido:** corriendo la suite entera, `lote25` a veces falla "entró el
dueño": Firebase limita los intentos de ingreso seguidos y hay pruebas que
entran varias veces. Corrida sola da verde. No es un error del código.

## 38. Los gastos (el alquiler) y un asunto de contraseñas

**El dueño preguntó dónde cargar el alquiler del local. Ya se puede: en
Finanzas, abajo de todo.** Antes estaba escrito pero no se dibujaba, así que no
se podía cargar. Detalle en PRODUCT.md §38.

### Hay que hacer YA: rotar las tres contraseñas

Las contraseñas de las cuentas de prueba (`Agus203.` para las tres) están
**en la historia del repositorio**, en el commit `54c9d20` del 8 de octubre, en
`.env.example`. Ese commit está en `main` **y está pusheado**:

```
  remote  https://github.com/agus2033/Don_estiloo.git
  commit  54c9d20884e638a4e732817cd55910e32f3daff2   (8/10/2026)
  archivo .env.example, con las tres contraseñas
```

Está publicado en GitHub. **Rotá las tres contraseñas**: con eso las viejas
dejan de servir y la exposición deja de importar. Reescribir la historia del
repo es más peligroso que el problema (hay que hacer force-push y todos los que
clonen tienen que volver a hacerlo), así que **la rotación es la solución**.

Ya se había arreglado una vez en el lote 26: `.env.example` volvió a la
plantilla vacía. Volvió a llenarse (esto pasó durante este lote, por un ciclo de
`git stash`) y ya está restaurado a vacío. **Es la segunda vez**: conviene
mirar `.env.example` antes de cada commit.

Y dos cosas más del mismo tema:

- **Desactivar el proveedor de Facebook** en la consola de Firebase.
- El `apiKey` de Firebase está en `src/config.js`, que es lo normal, pero tiene
  que tener la restricción de dominio puesta en la consola: sin ella cualquiera
  puede usarlo.

### La foto del barbero

Ya se ve en la web (nombre publicado: *Juan*). Era el último rojo.

### La cuenta de prueba del barbero ya no es barbero

`BARBERO_EMAIL` entra, pero **no tiene documento `staff`**, así que la app la
trata como cliente y muestra la barra de cliente. Si querés que las pruebas
midan la ficha pública del barbero, esa cuenta tiene que volver a ser barbero
desde el panel. Mientras tanto, la prueba mide su comportamiento de cliente y
lo dice con un AVISO, no con un rojo.

### La barra de cliente va a `#/mi-cuenta`, no a `#/ajustes`

En el mapa de rutas: `ajus: "mi-cuenta"` es el cliente y `cfg: "ajustes"` es el
dueño. Es fácil confundirlos al escribir una prueba.

### Details de este lote, para el que siga

- **Insertar código con `String.replace` es dangerous.** En el texto de
  reemplazo `$$` significa un `$` literal, así que el formateador de dinero
  (`$$`) quedó escrito `$` y el archivo dejó de parsear. Con
  `split`/`splice` sobre un arreglo de líneas no hay nada que escapar. **Y
  revisar siempre con `node --check` después de editar.**
- **`tests/lote25.js` se había duplicado entero** (el contenido dos veces) y con
  un `ñ` convertido en caracteres chinos en un comentario del lote 36. Se volvió
  a `HEAD` y se reescribió la sección. Vale la pena contar `function entrar`
  después de tocar ese archivo: si aparece 2 veces, está duplicado.
- Un patrón de prueba que depende de los finales de línea (`;\n` sobre un
  archivo CRLF) falla sin que cambie nada de lo que se quiere medir — y manda a
  buscar un bug donde no lo hay.
- `__test.rol` nuevo: dice el uid y si la sesión es barbero o dueño. Antes las
  pruebas deducían el rol de que "entrara", y eso es suponer.

**Nada de esto está en vivo.** Sigue sin desplegar: en `codigobarber.com.ar`
está `sw.js` v11 y acá va v19. Los lotes 29 a 38 son **diez** sin publicar.

## 39. La plata de cada individuo: ganancia neta por persona

**Cada gasto es de UNA persona —el dueño o un barbero— y le baja de SU ganancia
neta, no del negocio entero.** El dueño lo pidió así, con tres respuestas:

> *"yo solo quiero que haya en dueño un gasto que seria el alquiler o cualquier
> servicio y se descuente de su ganancia neta. lo mismo sucede si los barberos
> quieren sacar su ganancia neta restando el alquiler u otra cosa, es mas para
> tener un manejo de plata para cada individuo de manera personal"*

- Sobre cómo se reparte con un segundo barbero futuro: *"mantenga la misma
  respuesta queq la anterior"* — el diseño ya nace por persona, no cambia nada.
- Sobre un hipotético porcentaje sobre la neta: *"no lo coloques. me
  arrepiento"* — porcentaje muerto antes de nacer. Tampoco costo por servicio.

Toda la pantalla de Finanzas se reescribió para esto. Detalle del producto (lo
que se ve y por qué) en **PRODUCT.md §39**.

### Cómo quedó, para el que siga

- `gp` / `gsetP`: de quién es el gasto que se está cargando. Arranca en
  `"dueno"` y **no se vuelve a arrancar al guardar** — el alquiler se carga
  cada mes, no hay que reelegir cada vez.
- `gAdd` guarda `para: gp` en el documento. Los gastos viejos del §38, que no
  traen `para`, cuentan como del dueño: los números de antes no se mueven.
- La clave del gasto es la misma clave `bid` que usa `bsnap()` para los cobros:
  cobros y gastos se cruzan sin traducciones de por medio.
- `finH()` reescrita completa (~192 líneas):
  - Dueño: **Facturado · Gastos · Neto del negocio**; barbero: **Facturado ·
    Mis gastos · Mi neto**. Las tres tarjetas salen de la MISMA tabla
    "Ganancia de cada uno" (Persona · Facturado · Gastos · Neto + fila **Total
    del negocio**).
  - El dueño no se cuenta dos veces: su fila toma `t: OO` (su parte de todos
    los cobros) y `esDueElGrupo(k)` (`k === OWNER_UID || (b && esElDueño(b))`)
    tira su grupo del detalle de barberos.
  - Etiqueta del dueño: `etqDueño` sale una sola vez —`"Dueño"` si el nombre es
    literal, si no `nombre + " (dueño)"`— y se usa en tres lugares.
- La base real se quedó como estaba: **cero ventas, cero gastos** (el barrido
  post-pruebas lo confirmó en Todo/Este mes/7 días/Hoy). Las escenas de prueba
  se arman con `window.__test.setVentas(l)` y `window.__test.setFn(l, pd)`,
  que no escriben Firestore.
- `sw.js` → `barberia-v20`.

### Las reglas hay que publicarlas (pendiente del dueño)

`FIRESTORE_RULES.txt` cambió: los gastos ahora los puede **leer** cualquiera
firmado (`allow read: if isSignedIn();`) y **escribir** sólo el dueño. La razón:
el barbero tiene que poder ver los gastos que están a su nombre, pero si
pudiera cargarlos, se inventaría gastos propios para que su ganancia parezca
más chica de lo que es.

**No está publicado en la consola todavía.** Hasta que el dueño pegue las
reglas nuevas en Firebase console, un barbero real recibiría `permission-denied`
en su primera consulta de gastos. La app lo aguanta con un aviso, pero esa rama
**no se verificó en vivo**: la cuenta de prueba de `BARBERO_EMAIL` sigue sin
documento `staff` (la app la trata como cliente; ya lo registró el §38), así
que no hay barbero real con quien mirarla. Cuando se publiquen las reglas: promover esa cuenta desde el
panel y entrar a Finanzas como barbero.

### Las pruebas

- §39 de `tests/lote25.js`: ~35 comprobaciones, incluida una de punta a punta
  contra Firestore (gasto marcado con `para`: carga → verifica → borra).
- §36 y §38 se ajustaron a la pantalla nueva — con sus especificaciones
  renovadas, no debilitadas.
- El incidente de los importes duplicados: corridas de prueba interrumpidas a
  la mitad dejaban gastos de prueba en la base y la pantalla los mostraba
  repetidos. §38 quedó envuelto en `try/finally` con `borrarPruebas()` para que
  la limpieza corra también si algo explota, más un guarda `sucios38` que grita
  si queda basura. `tests/_limpiar.js` es la escoba manual (no corre en
  `run.js`, se invoca a mano cuando hace falta).
- **Suite completa: 38 pruebas · 1018 comprobaciones · 0 en rojo.** Capturas en
  `tmp_shots/39-reparto.png`, `39-final.png`, `39-neto.png`.

### Lo que se rompió esta vez, para reconocerlo rápido

1. `CH is not defined` y `etqDueño is not defined`: dos empalmes de código
   escritos a mano que dejaron una variable sin su declaración y una etiqueta
   sin definir. Después de cada empalme: `node --check` y releer el tramo
   entero.
2. Un `<div>` desbalanceado empujó los botones fuera de su tarjeta. Se arregló
   copiando el bloque entero de `HEAD`, no a mano.
3. El ñ volvió a manglar dos veces — sigue en pie la regla: nada de heredocs de
   PowerShell con acentos; `write`/`edit` y revisar `[\uFFFD\u4e00-\u9fff]`
   después.
4. El parser de importes de las pruebas leía `$180.000` como decimal. Ahora es
   dígitos + `parseInt` + `Math.abs` (el `.` es separador de miles).
5. **La sorpresa grande**: `src/main.js` de la copia de trabajo tenía el mapa
   de la landing con `src=` (carga a pedido perdida — HEAD tenía `data-src=`,
   el empalme de este lote lo pisó sin darse cuenta). El test completo `mapa`
   lo encontró; la suite sola de lote25 no lo miraría nunca. Volver a poner
   `data-src="${esc(MAP_IFRAME)}"` y todo verde. **Lección: antes de commitear,
   SIEMPRE `node tests\run.js` entero (38 pruebas), no sólo `lote25.js`.**

### Qué queda en la fila (en orden)

1. **Publicar las reglas nuevas** de `FIRESTORE_RULES.txt` en la consola de
   Firebase (detalladas arriba) y comprobar Finanzas con un barbero real.
2. Rotar las tres contraseñas de las cuentas de prueba (pendiente del §38,
   sigue igual).
3. Desactivar el proveedor de Facebook en la consola; mirar la restricción de
   dominio del `apiKey`.
4. Google Business Profile.
5. **Desplegar: doce lotes sin publicar (29–39).** En `codigobarber.com.ar`
   está `sw.js` v11; acá va `v20`.
6. Cuando el dueño quiera: dominio nuevo (seis espejos — `tests/seo.js` falla
   si se desalinean) y `EMAIL` real en `src/config.js`.

## 40. El título que Google enseña: "SSJ Barber | Puerto Iguazú"

El dueño vio en Google *"Codigo Barber"* (la marca vieja, con la descripción
vieja) y pidió el título literal *"SSJ Barber | Puerto Iguazu"*. Detalle del
producto en **PRODUCT.md §40**. Resumen para el que siga:

- El `<head>` ya decía SSJ Barber desde el lote 36: lo de Google era la
  **producción vieja** (`codigobarber.com.ar` sigue mostrando una versión con
  más de una docena de lotes retrasados). No había nada que rebrandear: había
  que desplegar de verdad.
- Cambios reales del lote: `<title>`, `og:title` y `twitter:title` pasan a
  `SSJ Barber | Puerto Iguazú` (26 caracteres, sin tocar la descripción ni el
  JSON-LD). Se baja el piso de tamaño del título en `tests/seo.js` de 30 a 25,
  con un comentario que dice por qué.
- **Para el dueño**: se arregla en dos pasos — desplegar y pedir la
  indexación en Search Console (Inspección de URLs → Pedir indexación). No hay
  forma de que Google actualice la fila desde acá.

### El susto de esta corrida, para reconocerlo rápido

La suite completa quedó **roja 29 pruebas con fallas=0**: el servidor python
del 8765 se murió a mitad de la corrida y cada prueba de navegador se rompió
con `net::ERR_CONNECTION_REFUSED` antes de siquiera contar una comprobación.
El diagnóstico rápido: red con ceros y fallas en cero = **error del servidor,
no error de las pruebas**. Se vuelve a levantar con:

```
Start-Process python -ArgumentList "-m","http.server","8765" -WindowStyle Hidden
```

Verificar con `Test-NetConnection -ComputerName 127.0.0.1 -Port 8765` y recién
ahí volver a correr. Con el servidor arriba: **38 pruebas · 1018
comprobaciones · 0 en rojo.**

## 41. Galería sin recortes (masonry) — y una foto-pista que estaba desaparecida

Producto/pantalla en **PRODUCT.md §41**. Lo técnico para el que siga:

- `landing.css`: el bloque GALERÍA dejó de ser grilla. Es **`columns`** (=2
  móvil, 3 en el bloque de escritorio), `break-inside: avoid` por figura,
  `img { width:100%; height:auto }` y **NADA más**: sin `aspect-ratio` fijo y
  sin `object-fit: cover`. Los `figure:first-child { grid-column: span... }`
  del hero grande se fueron (en masonry no existe el span).
- Los marcadores `.lb-gal-ph` toman su cuadrado por su cuenta (`aspect-ratio:
  1/1` en la clase), porque la grilla ya no lo impone.
- `src/main.js`: el `<img>` de la galería perdió `width="600"
  height="600"` (no se conoce la proporción de antemano). Y hay un hook
  nuevo, `__test.setGaleria(l)` (~L7374), el mismo patrón que `setVentas`.
- `run.js`: fila nueva `{ n: "galeria", sesion: false, red: false }`.

### El hallazgo del lote

`CONTINUAR.md` y el inventario decían "Galería: 0 fotos". **No mentían: se
desactualizaron.** La colección `galeria` en Firestore tiene **3 documentos
reales** (cortes de perfil, en Cloudinary `codigo-barber-1/galeria/…`), cargados
desde el panel en algún momento. La landing ya mostraba esas 3 —recortadas por
el `cover` de la grilla— y los "FOTO 1..5" son el escenario cuando aún no hay
nada. Por eso el test quedó hecho **agnóstico**: exige coherencia (o 5
marcadores, o N fotos reales) y el no recorte se comprueba en los dos caminos.
**Lección: antes de programar sobre "la base está vacía", mirar la base.**

### Detalles para el que escriba el próximo test de galería

- `getComputedStyle(el).columnCount` devuelve **STRING** ("2"): hay que
  `Number()` antes de `=== 2`. Me comió cuatro rojos falsos.
- Para fotos sintéticas con proporción conocida: SVG url-encoded como
  `data:image/svg+xml;utf8,` + `encodeURIComponent(...)`. El
  `encodeURIComponent` es lo que hace que `esc()` del HTML no lo rompa (sin
  `<` ni `&` crudos en el atributo).
- La desmesura mostrada-vs-natural se mide con
  `getBoundingClientRect().width/height` contra
  `naturalWidth/naturalHeight` — tolerancia 4 %.
- Contador de comprobaciones: el `run.js` cuenta stdout `OK `/`FALLA ` y el
  color sale del exit code — el final del `finally` (con `process.exitCode`)
  define el color, no el texto.

**15 lotes sin publicar (29–43).** En `codigobarber.com.ar` está `sw.js` v11;
acá va `barberia-v21`. Con la galería ya con contenido real, el despliegue
gana una razón más: la galería ahora está bien, pero nadie la ve. Y con el
42/43 se vuelve **urgente**: las reglas que están publicadas NO permiten
reprogramar (la lista de claves del update no incluía el servicio), y el
trabajo diario del barbero depende de publicar el `FIRESTORE_RULES.txt`
actual.

---

## 42/43. Reprogramar trabado, panel del barbero limpio, cuenta que se borra de verdad

Producto en **PRODUCT.md §42** (reglas + panel + avatar + botones). Acá la
base técnica del par de lotes, que corren en un solo despliegue.

### Reglas de `turnos`: la lista de claves no cubría reprogramar

El update del cliente para un turno pendiente ahora acepta

```
hasOnly(['d','t','bid','bl','st','mot','por','canEn','s','sid','sn','sp','sm'])
```

más el `matches` de formato de `d`/`t` que ya tenía el create. **Trampa que
evitar: si el write de reprogramar algún día suma otra clave, la regla
vuelve a negar todo.** El test `tests/lote42.js` falla si desaparecen las
cinco claves nuevas o si reaparece la lista vieja sin ellas. La rama `nm`
para "borrar tus datos" quedó igual.

### Colección `borrados/` (anti-bucle de puntos)

- **Qué es:** documentos cuyo id es el **SHA-256 del email** (trim +
  minúsculas) y cuyo cuerpo `{ t: <fecha> }`. NO guarda el email: sirve para
  dos caminos, el alta (¿este email ya tuvo una cuenta borrada?) y la baja
  (marcar el email). El hash se hace en el navegador con `crypto.subtle`
  (`shaEm()` en `main.js`, después de `wait()`).
- **Reglas:** `get` con sesión; `list` sólo dueño; `create` con
  `keys hasOnly(['t'])` y `t number`; `update/delete` sólo dueño. Ojo:
  hay que dejar get y list SEPARADOS — si se los uniera en
  `read: isSignedIn()`, cualquier usuario podría listar la colección entera.
- **App:** en `registro()`, después del `createUserWithEmailAndPassword`
  (ahí la sesión YA existe) → `getDoc(borrados/shaEmail)`; si existe,
  `pt0 = 0` en el doc `users`. Fail-open a favor del usuario si
  `crypto.subtle` no existe: la marca no se escribe, el check no corre.
- **Al borrar la cuenta** (`W.borrarCuenta`): el `batch` borra `users/{uid}`
  (antes quedaba con `borrado: true`), cancela pendientes, anonimiza
  historial y va tras `resenas` propias para reescribir `nm`. El
  `setDoc(borrados/sh)` va FUERA del batch, antes de `me.delete()`, porque
  la sesión hace falta viva. Si esa escritura falla, el resto del borrado
  no se revierte (se pierde la marca, nada más — error menor y documentado).

### El drift de cuentas de prueba (21/10/26)

**La cuenta CLIENTE tiene documento `staff/`.** Nadie del suite lo escribió
(los únicos tests que tocan `staff/` son `sembrar.js`, que no corre solo).
Consecuencia: esa cuenta entra como `#/agenda` (barbero), el panel le abre
`permission-denied` en las lecturas (las reglas viejas solo dejan gastos al
dueño), y **`err()` abre el modal que tapa la pantalla**.
`landing.reglas.js` lo detecta por hash y **salta con ATENCIÓN** (el
comprobante de reseña queda sin cubrir), y `landing.web.js` cierra ese
modal con `#mok` antes de seguir. Arreglo del lado del dueño: panel >
Clientes > "Hacer cliente", o borrar `staff/{uid}` a mano. Mientras siga
promovida, la foto del BARBERO tampoco se prueba (la cuenta BARBERO sigue
sin `staff/`, o sea entrando como cliente — las dos están cruzadas con sus
nombres).

### Detalles para el que siga

- `sw.js` va v21 (los lotes 39/40 tocaban index/landing.css, y el 42/43
  toca main.js/styles.css/reglas: hay que desplegar con cache limpia).
- `tests/lote42.js` es del tipo SIN navegador: lee fuentes y reglas con
  `fs`, no abre python ni Playwright. En `run.js` fue entre `galeria` y
  `perf`.
- El modal (#mo) se cierra programáticamente apretando `#mok` ("Entendido";
  visible si `#mo.hidden == false`). El `Mx()` del código vacía el
  contenido además de esconderlo: los tests no lo invocan, hacen el click.
- En `styles.css` la fila es `.chips.dos` (grid de 2 columnas, `.pillb` con
  `min-height: 44px`). Si algún día van TRES botones en fila, no reutilices
  la fila: clase nueva `.chips.tres` o `repeat(auto-fit, minmax(...))`.
- El `shaEm()` requiere `crypto.subtle` (HTTPS + localhost). En `file://`
  no existe: todos los test y producción van por HTTP(S) con dominio.

---

## 44. El filtro de Mis Turnos: radiogroup, no tabs; thumb con translateX

Producto en **PRODUCT.md §44**. Lo técnico para el que siga:

- **Estado:** `tfil = "prox"` vive junto al resto de los flags de pantalla
  (~L654, junto a `bf`). La acción es `W.tFil(k)`: valida
  `["prox","pas","can"].includes(k)`, limpia `cx` (el formulario de
  cancelación) y `R()`. Si algún día se llama tFil con otro valor, se
  ignora en silencio — mejor que pintar una lista vacía sin explicación.
- **turH() setData:** tres listas de memoria sobre el mismo `T`
  (`prox` pend asc / `hech` desc / `canc` desc). NADA de consultas nuevas a
  Firestore: el filtro no debe costar lecturas nuevas, la suscripción de
  turnos no cambia.
- **Markup del control:** `role="radiogroup"` + `role="radio"` +
  `aria-checked` dinámico, `data-act="tFil"` con `data-args="A(k)"`. El
  thumb es un `<span class="seg-th">` ANTES de los botones en el DOM y su
  `transform: translateX(i*100%)` lo pone en la columna `i`. **Trampa que
  ya mordió: `100%` en transform es el ancho del PROPIO elemento**, no del
  track — por eso el thumb tiene `width: calc((100% - 8px) / 3)` (un
  tercio del track sin el padding) y así el translateX vale exactamente
  `i` columnas. Si la cantidad de opciones cambia, el `/3` del CSS se toca.
- **CSS** (en `styles.css`, no en `landing.css`: es pantalla del PANEL):
  `.seg` pisa con `isolation: isolate` y `z-index: -1` en el thumb para que
  pinte detrás de los labels sin tocar cada nombre. Curva
  `cubic-bezier(0.23,1,0.32,1)` (easeOutQuint, el "resorte" del rubber
  original se simplificó a uno — quedó bien y no necesita spring JS).
  `prefers-reduced-motion: reduce` → `transition: none`.
- **Teclado:** listener nuevo en `document` (~L3960, junto al de Enter para
  `role="button"`): flechas → `.focus()` + `.click()` al radio siguiente.
  El click pasa por la delegación normal (`dRun`), así que el test de
  markup no necesita hacer nada raro para cubrirlo.
- **Ojo con los tests de panel:** `panel.turnos.js` (manual, no está en
  run.js) busca `[data-act="reprogramar"]` en `#/turnos`: sigue pasando por
  que el default es `prox` y esa lista tiene los botones. Si algún día el
  default cambia a "pas" o "todos", ese test se rompe — aviso escrito acá
  para que no haya sorpresa.

---

## 45. SquishSwitch: la mecánica vive en `src/ssw.js`, aislada del tema

Producto en **PRODUCT.md §45**. Lo técnico para el que siga:

- **Por qué un archivo aparte:** la mecánica (pointer events, clamp, flick)
  es genérica; el ESTADO es de la app. `sswMontar(btn, { max, inicial,
  onChange })` devuelve `{ estado, max, pinta, set }` y no toca ni
  localStorage ni `body.dataset`: los tests de la mecánica (`tests/
  ssw-visual.js` + `tmp/ssw-probe.html`) importan el módulo REAL en un
  navegador sin bootear Firebase. Si algún día la landing se quiere el
  mismo switch, es `sswMontar` con otro caller.
- **Recorrido en runtime, no a mano:** el máximo del drag sale de medir el
  botón (`clientWidth` − paddings − ancho del knob). El CSS es la verdad de
  los px; cambiar el tamaño del track no desincroniza la física. El
  salvavidas es 30 si medir da 0 (botón oculto al montar).
- **Trampa del flick:** la velocidad se lee en `pointermove` con memoria del
  último punto (`vx = dx/dt`, px/ms). Al soltar: `|vx| > 0.55` → la
  dirección decide; si no, decide la mitad del recorrido. Rebote con
  `ssw-kn--voz` / `--voz-fuerte` (se quitan via setTimeout 180ms).
- **Trampa del teclado (ya mordida):** Enter/Espacio de un `<button>`
  dispara `click` con `detail === 0` y SIN pointer events; el mouse tras el
  drag dispara `click` con `detail >= 1` DESPUÉS de que `pointerup` ya
  decidió. Por eso el flip por click entra sólo con `detail === 0` — de lo
  contrario un toque flippea dos veces.
- **`scale` CSS property, no `transform: scale()`:** el knob usa la property
  CSS moderna `scale: 1.16 0.94` para el squish porque el transform lo lleva
  el translateX a la vez. Navegadores viejos la ignoran y el switch sigue
  funcionando (solo pierde el aplastado).
- **Los tres cambios que prohibieron romper cosas:** (1) header.js exige el
  orden `web-thm-mebadge` por id → el markup conserva ids; (2)
  landing.tema.js mide el `backgroundColor` de `#thm` en claro y NO permite
  blanco puro → el override va con `var(--bg)` marfil; (3) politicas.js
  escanea style/main — quedó verde. Los tres volvieron a correr en la
  suite de este lote.
- El bloque duplicado `#thm{...}` de styles.css (estaba POR DUPLICADO, uno
  en cada sección) se borró: duplicado = un día cambia uno y no el otro.
- **botones.contraste bajó de 24 a 22 checks** en la suite: el toggle viejo
  tenía ☀︎/☾ como TEXTO medible; ahora los íconos son svg aria-hidden, así
  que el auditor no los mide. La suite pasó de 1068 a 1090
  comprobaciones (−2+24 del archivo nuevo), 0 en rojo. Si algún día vuelven
  a ser medibles (texto plano), pensalo dos veces: un texto corrido en el
  knob es otra fuente de contraste que mantener.
- `sw.js` v22. El deploy NO se hizo todavía: cuando el dueño despliegue,
  v21 y v22 van juntos (los lotes 42-45 caben en un solo despliegue).
