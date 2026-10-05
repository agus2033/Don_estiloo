# Barbería · Turnos y puntos — Documentación completa

## 1. Resumen

WebApp progresiva (PWA) para barbería.

- Cliente reserva turno online, suma puntos por cada corte completado y canjea premios.
- Barbero marca cortes completados, cobra, consulta agenda y puede agendar turnos a nombre de clientes.
- Dueño controla finanzas, gastos, clientes, servicios, horarios y barberos.

Firebase project: `barberia-taccu`. Archivos estáticos `index.html` + assets + JS, sin backend propio.

---

## 2. Estructura de carpetas

```
barberia-v3/
├── index.html              Punto de entrada
├── manifest.json           PWA manifest
├── sw.js                   Service Worker
├── firestore.rules         Rules de Firestore
├── README.md               Resumen corto
├── plan/PLAN_TOTAL.md      Este documento
├── assets/
│   ├── logo.svg, icon-192/512/maskable
├── src/
│   ├── main.js             Lógica + vistas principales
│   ├── config.js           Datos de negocio editables
│   ├── logic.js            Auxiliar lógico puro (p. tests)
│   ├── styles.css          CSS
│   └── boot.js             Fallback de carga fallida
└── tests/
   ├── logic.test.mjs
   └── run.html
```

TODO archivo JS está dentro de `src`; los assets están dentro de `assets`.

---

## 3. Cómo funciona todo (paso a paso)

### 3.1 Arranque

1. `index.html` carga `src/main.js` como module y `src/boot.js`.
2. Firebase se inicializa (`initializeApp`, `getAuth`, `initializeFirestore`
   con cache persistente `persistentLocalCache` + multi-tab).
3. `onAuthStateChanged`:
   - usuario: lee `staff/{uid}` para decidir si es staff (`SB`), luego `setup(a)`.
   - no usuario: `unsub()` y vista login.

### 3.2 Setup y listeners

`setup(a)` registra `onSnapshot` para:

- `users/{uid}` datos cliente
- `turnos` (todos los pendientes si es admin, propios cliente en caso contrario)
- `canjes` pendientes o por uid
- `config/horario`, `config/servicios`, `config/reglas`
- `config/barberos` para que el cliente elija barbero
- si admin: `config/finanzas`, `users`, `espera`, `gastos`
- si dueño: listeners por `turnos`(hechoEn), ventas, gastos, canjes usadosii
- `ocupados` según `sel.d` + `sel.b` para marcar slots libre/osupado

Cada `onSnapshot` dispara `R()` para re-render.

### 3.3 Render (`R`)

`R()` mpunta:

-  loader (`#ld`/`busy`)
- `authH()` si no hay sesión
- vista admin (`dashH`, `cliH`, `barsH`, `cfgH`, `finH`) o fallback `barH()`
- vista cliente (`homeH`, `resH`, `turH`, `privH`)
- nav horizontal (PC) / menú hamburguesa (`#nmenu`) en celular
- footer con datos de la barbería

### 3.4 Acciones (`W` y delegación)

Object `W` agrupa acciones: `entrar`, `registro`, `salir`, `askBook`, `book`,
`askCancel`, `cancel`, `askDone`, `done`, `redeem`, `espera`, `agOpen`,
`agSave`, `manSave`, `goto ...` etc. `ACT` mezcla W con pequeños helpers.
El HTML llama acciones vía `data-act`, sin `onclick` inline: permite CSP.

---

## 4. Páginas / funciones por perfil

**Cliente**:

1. **Login / registro**: validación de teléfono, nombre, contraseña con reglas
   (mínimo 6 y no común), email verificado (`sendEmailVerification`).
2. **Inicio**: puntos acumulados, premios con canje, códigos de canjes activos,
   botón "Repetir mi último corte".
3. **Reservar**: selector de barbero(as chips), servicio, día, hora.
   Horarios libres se calculan con:
   - `CFB(sel.b)` horario del barbero elegido (o general si no tiene propio)
   - `OC` ocupados de ese día+bid
   - `days()` días de atención (XXX 6 días forward)
   - ahora en timezone `America/Argentina/Buenos_Aires`
4. **Mis turnos**: lista con estados, razones/motivos de cancelacion, cancel, etc.
5. **Espera**: anotarse cuando un día no tiene slots (id `uid_bid_fecha`).
6. **Privacidad**: lectura, botón "Borrar mis datos" (anonimiza nombre,
   puntos→0, borra espera/canjes, cancela pendientes, marca `borrado`).

**Barbero / Dueño**:

1. **Agenda (barH)**:
   - día seleccionado chips
   - lista de turnos por día (`Pend/Cancel` etc)
   - botón **+ Carga manual** (venta sin turno)
   - botón **+ Agendar turno** (cliente nuevo/registrado, servicio, día, hora, barbero)
   - modo lista de turno: tap en *Completó* abre `dnForm` (precio, lista, descuentos, medio pago, guardar cobro); *Cancelar* abre `cxForm` para motivo y borra ocupados
   - Lista Recordatorios para mañana y Canjes pendientes a marcar como usados
2. **Clientes (cliH)**: búsqueda por nombre/teléfono, socket abrir historial (solo dueño), botón Hacer/Quitar barbero.
3. **Dashboard (dashH)**: kpi, grupo por servicio/medio, registro de cortes, cancelaciones, botones para marcar carga manuales editadas (`askEditV`).
4. **Finanzas (finH)**: kpis facturado/neto, caja hoy, gastos, porcentajes por barbero. Dueño ve todo; barbero ve sólo lo suyo.
5. **Ajustes**: un selector `General/barbero` para horario detalle, día abierto,
   apertura/cierre, pausa, feriados, botones Guardar.
6. **Barberos (barsH)**: listado con doc staff.
7. **Privacidad**: borrado de datos para admin también.

---

## 5. Flujo de reservas financieras

### 5.1 Creación de turno (cliente o barbero)

**Cliente** (`book()`):
- Validación: servicio, día/hora elegido, sin conflitos en `OC`, cupo `sl` listo
- Batch `writeBatch`:
  - set `activos/{uid_sl}`
  - set `turnos/{t}` con uid/nm/s/sid/d/t/st/bl/...
  - set `ocupados/${bid_fecha_HHMM}` por cada bloque
  - lota para elimina stale activos
- Regla valida: keys hasOnly, st==pend, email verificado (rule), date & future,
  array `bl`, no más de 12 bloques, existeActivos

**Barbero/dueño** (`agSave()`):
- Mismo flujo, uid puede ser del cliente (`cl.id`) o `caja_xxx` para ocasionales,
  y bid automático para staff o elegido (`dbi`) para el dueño.
- Crea activos solo si turno se crea, local o con `uid` validado.

### 5.2 Completado y cobro

- Barbero marca `st:'hecho'`, `precio`, `lista`, `serv`, `medio`, `bid/bn/pd`, `hechoEn`
- Batch borra `activos/{uid_sl}` y suma `pt` al doc users.
  - Regla `users` requires `uc` where turnos.st pasó pend→held en batch
- Para clientes `caja_*` sin doc users, se salta porque `docSnap.exists()`d false.

### 5.3 Carga manual

- ventas sin turno `uid`name por owner; dueño puede asignar `bid` para un barbero, barbero siempre su propio.
- Rule: keys allowed: includes `nm/uid/serv/precio/lista/medio/d/t/bid/bn/pd/hechoEn` ; uid del `users`.

### 5.4 Gastos

- Create docs gastos con concepto/monto/day.
- Borrado sólo esAdmin.

### 5.5 Canjes

- Cliente crea doc canjes con cost elegido de `reglas().costs`; rule: pts disminuye exacto (getAfter con-user/link)
- Barbero marca `used`: rule restricc diff keys y ahora() dentro 10min bumper.

---

## 6. Colecciones y campos (claves)

| path | keys utilizados en app/reglas |
|---|---|
| users | nm, ph, pt, ns, borrado, rol |
| turnos | uid,nm,s,sid,d,t,st,bl,sn,sp,sm,sl,bid,st,precio,lista,serv,medio,bn,pd,hechoEn,mot,por,canEn |
| activos | uid, tu |
| ventas | nm,uid?,serv,precio,lista,medio,d,t,bid,bn,pd,hechoEn |
| gastos | c,m,d,hechoEn |
| staff | n,pd |
| espera | uid,nm,ph,d,en,bid |
| ocupados | uid,d,t,tu,g,bid |
| config/servicios | l[{n,p,d,m,id}] |
| config/horario | a,c,dias,libres,al,ah,por? |
| config/reglas | costs,pts,cancelHs,grid |
| config/finanzas | pd,bs[] |
| config/barberos | l[{id,n}] |
| canjes | uid,nm,pr,cost,c,used,usadoEn |

---

## 7. Reglas de Firestore (resumen rápido)

librería `x encode...`

> Cada rule funciona  dif beyond `esAdmin()` (uid fijo). staff login  cosas via `exists(staff/uid)`. maps `esBar` union.

- `users` create: hasOnly nm/ph/pt, pt==0.
- update: esAdmin · barbero sólo suma hasta pts exacto de unidades via lota ligado, · client sólo baja pts (canje) ·ns/staff+1 · dominado a braçadeira
-canjes: create con cost rules, match en rules del batch link con pts, used==false
- `activos` create: keys only uid/tu, doc id correcto (uid)_1|2, existe turn, verifica uid vs auth o esBar
- `ocupados` create: match id regex, keys fields nos a, existencia del turno en lote
-   hola...

###eleven?

Mantener los deploy:

```
firebase deploy --only firestore:rules
```

---

## 8. Tests y checklist

### 8.1 Unit tests

```
node tests/logic.test.mjs
```
 o abre `tests/run.html` sirviendo la carpeta.

### 8.2 Manual checklist

1. facc care los archivos que lees?
2. Corro el server local y autoch checks.
3. Para cada pestaña central prueba outputs o igu...y notes?

--- 9. Mejoras futurosatisfactorias

1.week quotingVentan
2. NotificationsPago online via MP.
3. payments link 8.
4. Portal públic
5. SonfiscForms?)

---

## 10. Versión

Working directory: `barberia-v3`. PWA displayed as `CODIGO BARBER 1`.

`src/main.js` contiene `R()`. Cierran logout via `signOut`. Al cerrar sesión volatile cleanup guarded...
