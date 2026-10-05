# Barbería · Turnos y puntos

App web de turnos para la barbería: reservas online, lista de espera, puntos por
cada corte, canjes, agenda por barbero, cobros y dashboard para el dueño.

## Estructura

```
index.html          Página principal
manifest.json       PWA (nombre, colores, iconos)
sw.js               Service worker (offline + aviso de versión nueva)
firestore.rules     Reglas de seguridad de Firestore
src/
  main.js           App completa (UI, vistas y acciones)
  config.js         Editá acá: datos de la barbería, servicios, premios, link MP…
  logic.js          Lógica pura (horarios, duración, grilla) sin DOM ni Firestore
  styles.css        Estilos
  boot.js           Mensaje si la app no carga
assets/             Logo e iconos
tests/
  logic.test.mjs    Pruebas de la lógica de horarios
  run.html          Las mismas en el navegador
```

## Tests

- Lógica: `node tests/logic.test.mjs` (o serví la carpeta y abrí `tests/run.html`).
- Reglas: probálas con el emulador de Firestore o con un proyecto de prueba
  antes de subirlas (`firebase emulators:start --only firestore` /
  `firebase deploy --only firestore:rules`).

## Cambios recientes

- Agenda y turnos por **barbero**: cada uno tiene sus horarios (`config/horario.por`)
  y sus ocupados separados.
- El cliente elige barbero al reservar; el barbero puede **agendar turnos** a
  nombre de clientes (teléfono) desde Agenda.
- Contador de **no presentado** por cliente (clic "Cancelar" → motivo "No se
  presentó") visible en Clientes.
- "Repetir mi último corte" en Inicio.
- **Seña con Mercado Pago**: definí `MP_LINK` en `src/config.js`.
- **Privacidad**: link en el pie + borrado de datos desde la vista Privacidad.
- Menú hamburguesa en celular; header completo en PC con "Más" para el dueño.
