# PRUEBAS.md — 2026-10-11

Cómo se prueba el proyecto, qué corre cada cosa y qué **no** está cubierto.

---

## Comando único

```powershell
# servidor normal, para la mayoría
python -m http.server 8765

# servidor con las cabeceras de producción (lo usan csp y visual)
node tests\srv.js 8766

# toda la batería
node tests\run.js
```

`tests\run.js` espera 20 s entre pruebas que inician sesión, porque Firebase Auth limita los ingresos por IP y si no, fallan por un motivo que no tiene nada que ver con el código.

Opciones: `node tests\run.js rapido` (sólo las que no necesitan cuenta) y `node tests\run.js con-csp` (levanta el servidor con cabeceras).

---

## Estado de la última corrida

```
25 pruebas · 567 comprobaciones · 0 en rojo
```

| Prueba | Comprobaciones | Qué cubre |
|---|---|---|
| `seo` | 80 | title, description, canonical, OG, Twitter, metas geo, JSON-LD `BarberShop`, robots y sitemap, y que la marca sea "Codigo Barber" sin tilde en los ocho lugares |
| `politicas` | 132 | textos legales, términos, privacidad y cookies |
| `landing.barberos` | 147 | la ficha del barbero: frente, dorso, giro, horarios, servicios con precio, fotos sin recorte |
| `landing.modal` | 52 | el asistente de reserva completo, de los 6 pasos, en oscuro y claro |
| `botones.contraste` | 25 | contraste de todos los botones en los dos temas |
| `visual` | 26 | 4 anchos × 2 temas: scroll horizontal, barra fija, áreas táctiles, texto chico |
| `csp.sync` | 24 | que `vercel.json` y `tests/srv.js` digan la misma CSP, y que no les falte ningún dominio que la app use |
| `loader` | 24 | el logo del loader, que se destape de arriba hacia abajo y que no gire |
| `tokens.claro` | 21 | los tokens del modo claro |
| `landing.header` | 16 | encabezado, marca y navegación |
| `panel.quitar` | 6 | el botón "Quitar" de un barbero cargado a mano |
| `csp` | 5 | la web levantada con la CSP de producción, anotando lo que el navegador bloquea |
| `xss` | 5 | XSS almacenado: la hora, el precio y las redes del barbero |
| `mapa` | 1 | que el mapa no se pida hasta llegar a su sección |
| `landing.web` | 3 | login, marca y logo |
| `landing.wizard` | — | recorrido de los 6 pasos en celular (avanza solo al elegir) |
| `landing.wizard-a11y` | — | 48 muestras de accesibilidad del asistente |
| `landing.tema`, `landing.audit`, `landing.registro`, `landing.sync`, `landing.reglas`, `panel.contraste` | — | según la cuenta que haya en `.env.local` |
| `css.muerto` | — | reglas CSS que no matchean nada |
| `perf` | — | Core Web Vitals y peso por tipo de recurso |

---

## Pruebas que se escribieron para demostrar un arreglo

### `tests/xss.js` — el XSS almacenado

Inyecta un turno con la hora como `<img src=y onerror="window.__pwn=1">` y comprueba si **el navegador lo ejecuta**. No alcanza con mirar el HTML: lo que importa es si `window.__pwn` queda en 1, porque eso significa que el código corrió con los permisos de esa sesión.

**Antes del arreglo:**
```
FALLA la Agenda no inyecta HTML desde los campos del turno
       pwn=1 imgs=1 htmlCrudo=true
```

**Después:**
```
OK   la Agenda no inyecta HTML desde los campos del turno
       (el payload quedó como texto: &lt;img …)
OK   el Dashboard no inyecta HTML desde el precio
OK   la lista de clientes no inyecta HTML
```

Un detalle del detector: al principio daba falso positivo, porque el texto escapado sigue teniendo adentro la palabra `onerror`. Ahora busca `<img src=x…onerror` **sin** escapar, o sea `<img` y no `&lt;img`.

### `tests/csp.js` y `tests/srv.js` — la CSP

El servidor local manda **exactamente** las cabeceras de `vercel.json`. Sin esto no habría forma de saber si la CSP rompe algo, y rompería: `style-src` sin `'unsafe-inline'` descarta los 220 atributos `style` que la app genera desde JavaScript, y el navegador no tira ningún error, sólo deja la página sin formato.

Este proceso encontró un bug real: con la CSP, la web perdía las tipografías y los módulos de Firebase. Ver `AUDITORIA.md` §4.

### `tests/visual.js` — defectos medidos, no opinados

Cuatro anchos (390 / 768 / 1280 / 1600) por dos temas, midiendo: contenido tapado por la barra fija, scroll horizontal, áreas táctiles bajo 44 px y texto bajo 12 px. Encontró los seis defectos que se corrigieron.

### `tests/mapa.js` y `tests/perf.mapa.js`

`perf.mapa.js` cambia el iframe entre los dos estados (con `src` y con `data-src`) y mide los dos, restaurando el archivo al final con `try/finally`. Sirve para comparar sin tocar git.

`mapa.js` mide lo que de verdad importa, que no es el peso: **si el mapa se pide antes de que el usuario llegue a la sección**.

```
== ANTES (el iframe trae src y loading=lazy) ==
  a los 6 s quieto ...... src=true  peticiones al mapa=0
  tras scrollear ........ src=true  peticiones al mapa=1

== AHORA (el iframe trae data-src y un observer) ==
  a los 6 s quieto ...... src=false  peticiones al mapa=0
  tras scrollear ........ src=true  peticiones al mapa=1
```

### `tests/csp.sync.js` — las dos CSP no pueden desincronizarse

Hay dos copias de la CSP: la que sube a producción (`vercel.json`) y la que se usa para probar (`tests/srv.js`). Si se desincronizan, las pruebas dan verde contra una CSP que no es la real, que es justo cuando uno cree que está bien y no lo está. Esta prueba compara las dos y además verifica que no falte ningún dominio que la app use de verdad.

---

## Trampas que costaron tiempo (para no repetirlas)

1. **Las salidas de PowerShell se guardan en UTF-16, no en UTF-8.** `node algo.js *> archivo.txt` en Windows PowerShell 5.1 escribe UTF-16LE; leído como `utf8` cada línea viene con un `\0` en el medio y los patrones no encuentran nada. El síntoma es un cuadro de resultados con todos los "(sin dato)" y ninguna pista de por qué. `tests/perf.cmp.js` lo detecta y lo explica.

2. **Un heredoc de PowerShell arruina los acentos.** Vuelven como U+FFFD. Hay que escribir los archivos con la herramienta de edición, nunca con `@'...'@ | Set-Content`.

3. **Playwright se come los handles en el asistente de reserva.** `WZ.pintar()` reemplaza el `innerHTML` del modal entero en cada paso, y a veces se repinta solo (por un snapshot o por el avance automático en celular). Un `const h = await p.$(sel)` queda desvinculado y el click falla con "Element is not attached to the DOM", que no dice nada del código. La solución es hacer el click dentro de la página (`p.evaluate`) y capturar midiendo la caja y recortando.

4. **Un SKIP puede ser un fallo disfrazado.** La guarda que agregué en `landing.modal.js` llamaba a `irPaso(2)` sin elegir servicio primero; nunca llegaba al paso 2, contaba 0 barberos y saltaba. La prueba pasaba en verde y no medía nada. Ahora la guarda elige servicio y barbero, y dice cuántos barberos vio.

5. **Los `sleep` no arreglan un rate limit.** Firebase Auth limita por IP: con muchos ingresos seguidos, `entrar` falla aunque las credenciales estén bien. La batería espera 20 s entre pruebas que usan cuenta.

6. **`element.screenshot()` no sirve para contenido que se repinta.** Se captura midiendo la caja y usando `page.screenshot({ clip })`.

7. **Cambiar un archivo de CSS con un patrón que tiene acentos falla en silencio.** Si el `oldString` no coincide, el editor avisa; pero un script propio con `.replace()` sólo avisa si lo mirás. Por eso los parches por script **imprimen cuántos bloques cambiaron** y hay que leer ese número.

---

## Lo que NO está probado

| Qué | Por qué no |
|---|---|
| Las reglas de Firestore nuevas contra la base real | Hace falta el Rules Playground o el emulador. Ninguno de los dos se instaló sin autorización. |
| Lighthouse | No hay Chrome con Lighthouse en la máquina. Lo medido es con `PerformanceObserver`, que es la misma fuente que usa Lighthouse para LCP y CLS, pero no incluye las auditorías de accesibilidad ni de SEO. |
| Lector de pantalla | No hay ninguno disponible. Las comprobaciones de accesibilidad son propias y miden contraste, foco, etiquetas y flujo con teclado. **No equivalen a conformidad WCAG 2.2 AA.** |
| Navegadores que no sean Chrome | Todo se probó con Chrome del sistema. Safari y Firefox quedan sin verificar, y en particular `clip-path` (el barrido del loader) y `IntersectionObserver` (el mapa) están soportados en todos los navegadores actuales, pero no se midieron acá. |
| Carga con conexión lenta de verdad | Se simuló con 700 ms de retardo en `tests/carga.js`, no con un throttling real de DevTools. |
| Firebase Auth con Facebook y Google | Requiere apps configuradas en Meta y Google; la de Facebook tiene que estar en modo Live. |
| Pruebas con dos o más barberos reales | La base tiene uno solo. `landing.barberos` inyecta tres sintéticos en memoria y lo dice. |

---

## Comandos sueltos útiles

```powershell
# estado crudo de los datos (sólo lee)
node tests\_probe.js

# ver la base: sembrar todo
node tests\sembrar.js --si          # escribe en PRODUCCIÓN, pide confirmación

# agregar un barbero sin cuenta, desde el botón real del panel
node tests\agregar-barbero.js "Roman" 60

# capturas para mirar a ojo
node tests\visual.js

# comparar dos corridas de rendimiento
node tests\perf.js *> antes.txt
# ... cambiar algo ...
node tests\perf.js *> despues.txt
node tests\perf.cmp.js antes.txt despues.txt antes despues
```
---

## `tests/header.js` — el orden del header y la barra de secciones

Corre con `node tests\header.js`. Sale sola en `node tests\run.js`.

Son dos mitades.

### 1. Estructura, sin navegador ni cuenta (13 checks)

Las cuentas de cliente y barbero ya no autentican, así que sus paneles no se
pueden abrir. Lo que sí se puede fijar es que los bloques de código que arman
esas barras sigan como deben:

- el cliente tiene 4 secciones (`SEC_CLI`)
- el dueño muestra 3 (`CUANTAS = own ? 3 : sec.length`)
- la clase de la barra sale de si hay bandeja
- el cliente marca `nav-todo` (sin bandeja)
- `menuPerfil` existe **a nivel de módulo**, y una guarda extra verifica que no
  haya vuelto adentro de `R()` (dentro del `try` sería block-scoped)
- el menú tiene "Cambiar foto" y "Cerrar sesión", y "Editar perfil" se le
  esconde al dueño
- en `index.html` no queda `#lo` ni `#hamb`, y el orden es `web → thm → mebadge`

> Ojo con los regex acá: `CUANTAS` **no** es un `const CUANTAS =`, es una pieza
> del `const` encadenado que arma `sec`. Un `const CUANTAS` no encuentra nada y
> la guarda pasa por verde sin comprobar nada (ya pasó una vez).

### 2. El dueño, en navegador (19 checks, 2 SKIP)

Entra con la cuenta del dueño y mide a 390 y a 1280 px:

- el orden de la fila es casita - toggle - foto (compara `getBoundingClientRect().left`)
- no queda el botón suelto de "Cerrar sesión"
- **la fila no desborda**: `scrollWidth <= clientWidth` de `.hd`
- a 390: la barra marca `nav-mas3`, se ven 3 secciones, el botón de tres rayitas
  está, la bandeja abre y tiene exactamente Barberos / Finanzas / Ajustes / Galería
- el menú de la foto abre y trae Cambiar foto + Cerrar sesión, y **no** trae
  Editar perfil (que es lo correcto para el dueño)
- deja capturas en `tmp_shots/header/`

**SKIP**: los dos del barbero, porque su cuenta no autentica. La barra del
barbero es idéntica a la del cliente en el código, pero **no se vio en
pantalla**.

### Dos trampas que se documentaron en este archivo

- **No contar visibles con `offsetParent`.** La barra de celular es
  `position: fixed`, y en un elemento con posicionamiento fijo `offsetParent`
  devuelve `null` aunque esté dibujado. La primera corrida dio "0 secciones
  visibles" en una barra con 7. Hay que usar `getBoundingClientRect()`.
- **Los SKIP hay que leerlos.** Los dos SKIP del barbero son la única cobertura
  que hay de ese panel, y son la mitad de lo que pidió el dueño.
Las 13 estructurales no necesitan cuenta ni red: leen el código y el HTML. Las
19 del dueño necesitan la sesión del dueño y el servidor en el 8765.
