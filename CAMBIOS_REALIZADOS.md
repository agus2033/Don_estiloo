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