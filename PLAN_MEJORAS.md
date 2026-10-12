# PLAN_MEJORAS.md

Estado al 2026-10-11, después de la auditoría completa. **P0 es lo que hay que hacer antes de publicar.**

---

## P0 — antes de publicar

| # | Qué | Por qué | Cómo se hace | Estado |
|---|---|---|---|---|
| 1 | **Pegar `FIRESTORE_RULES.txt` en Firebase Console → Firestore → Reglas** | El archivo es una copia local. Sin este paso, los arreglos de seguridad existen sólo en el disco: la web sigue con las reglas viejas y un barbero puede quedarse con el 100% de la plata | Pegar el archivo entero y publicar | **PENDIENTE — del dueño** |
| 2 | **Probar las reglas en el Rules Playground** con un usuario de `staff` | Hay que confirmar tres cosas: no puede escribir `config/finanzas`, no puede cambiar su `pd`, y sí puede guardar su perfil en `config/barberos` | Rules Playground, tres pruebas | **PENDIENTE — del dueño** |
| 3 | **App de Facebook en modo Live** | Con la app en desarrollo, cualquiera que no esté en "Roles → Pruebas" ve el muro "App in development" y no puede registrarse | Meta for Developers → Configuración (arriba del todo) | **PENDIENTE — del dueño** |
| 4 | **Agregar `codigobarber.com.ar` en Authentication → Settings → Authorized domains** | Sin eso, el login con Google y Facebook puede fallar en el dominio real | Firebase Console | **PENDIENTE — del dueño** |
| 5 | **Dar de alta la cuenta del barbero** con el mail real | El barbero cargado a mano es ficha pública: aparece en la web pero no entra al panel ni ve su agenda | Pasarme el mail y lo vinculo | **PENDIENTE — del dueño** |

---

## P1 — seguridad, con impacto real

| # | Qué | Por qué | Estado |
|---|---|---|---|
| 6 | Cerrar `ocupados.create` (M-1) | Un cliente puede ocupar horarios de **cualquier** barbero y bloquearle la agenda | Requiere Cloud Function |
| 7 | Cerrar el descuento de puntos de los canjes (M-2) | Un cliente puede crearse un canje gratis: el descuento vive sólo en el cliente | Requiere Cloud Function |
| 8 | Revisar la lectura pública de `ocupados` y `resenas` (M-3) | Se leen sin sesión y exponen el **uid** de cada cliente con fecha, hora y barbero | Reglas + colección resumen |
| 9 | Activar **App Check** y una reCAPTCHA v3 real | `RECAPTCHA_KEY` está vacío: sin esto, `mensajes` es público y sin límite | Firebase Console + clave |

---

## P2 — infraestructura

| # | Qué | Estado |
|---|---|---|
| 10 | **`firestore.rules` + `firebase.json` en el repo y deploy desde CI** | **PENDIENTE.** Hoy las reglas viven en un `.txt` que alguien copia a mano. Es la causa de que dos veces seguidas el repo y la consola puedan no coincidir, y no hay forma de saberlo |
| 11 | Decidir qué hacer con `main.js` (6.400 líneas) | **PENDIENTE.** Es el pendiente de velocidad más grande del proyecto. Cualquier otra persona que lo toque va a tardar mucho en orientarse |
| 12 | Minificar y partir el bundle | Depende de 11. Hoy no hay build |
| 13 | Sacar los 220 `style="…"` a clases | Desbloquea endurecer `style-src` (hoy lleva `'unsafe-inline'` por eso) |

---

## P3 — experiencia

| # | Qué | Estado |
|---|---|---|
| 14 | **Auditoría de accesibilidad con lector de pantalla real** | **PENDIENTE.** Hoy hay 48 comprobaciones propias y 25 de contraste. Eso no es conformidad WCAG 2.2 AA: falta probarlo con gente |
| 15 | Probar en Safari y Firefox | Todo se probó con Chrome |
| 16 | Services para los barberos: hoy son globales | **PENDIENTE.** Un barbero no puede decir qué servicios hace; el dueño tampoco puede declararlo |
| 17 | `aggregateRating` en el JSON-LD | Cuando las reseñas sean reales. No antes: hay 13 reseñas y 10 son de prueba, y Google penaliza los promedios inventados |
| 18 | Quitar las reseñas de prueba de la base | A criterio del dueño |

---

## P4 — despliegue

| # | Qué | Estado |
|---|---|---|
| 19 | Publicar `vercel.json` y `.vercelignore` | **LISTO, falta subirlo.** Las cabeceras y la lista de lo que no se publica quedaron escritas y probadas |
| 20 | Sacar `tmp_pdf/` (76 MB) del disco | `.vercelignore` ya lo excluye del deploy, pero sigue ocupando espacio |

---

## Lo que ya está hecho

- **Seguridad**: XSS almacenado corregido y con prueba que lo demuestra; las reglas de Firestore endurecidas contra la escalada de privilegios, la edición del reparto y el borrado de ventas; validación de la subida de archivos; `javascript:` bloqueado en los enlaces.
- **Rendimiento**: 2,5 MB de assets sin usar fuera de la publicación, 76 MB de temporales excluidos, el mapa espera a que se llegue hasta que se llega a su sección, `CLS` en 0.
- **Diseño**: áreas táctiles y tamaños de texto corregidos en los cuatro anchos y los dos temas.
- **Calidad**: 25 pruebas, 567 comprobaciones, un comando para correr todo, y seis trampas documentadas en `PRUEBAS.md`.
- **Seguridad HTTP**: CSP y cabeceras verificadas **contra la web real**, no asumidas. Ese proceso encontró un bug que habría roto producción.