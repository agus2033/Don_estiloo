/* ====== Configuración de la barbería (editá solo este archivo) ====== */
      export const firebaseConfig = {
        apiKey: "AIzaSyB2ui0pMSsgbq2bhTFnUHoYcdftTA4Q09M",
        authDomain: "barberia-taccu.firebaseapp.com",
        projectId: "barberia-taccu",
        storageBucket: "barberia-taccu.firebasestorage.app",
        messagingSenderId: "968927411493",
        appId: "1:968927411493:web:cacd75772f2fb791132ecc"
      };
      // ADMIN_UID / OWNER_UID: el dueño es Roman (lo confirmó el 16/10/26: la cuenta
// del dueño y la que figuraba como barbero son la misma persona). O sea que el
// barbero de la barbería ES el dueño: no hay dos personas.
// ==== CAMBIAR QUIEN ES EL DUEÑO ====
//
// El dueño se cambia en DOS lugares y hay que cambiarlo en los dos:
//   1. acá: ADMIN_UID (y OWNER_UID, que es el mismo valor).
//   2. en FIRESTORE_RULES.txt: la función `isOwner()`, que es la que decide
//      qué puede escribir en la base. Esa además hay que PUBLICAR en la
//      consola de Firebase, no alcanza con tocarla en el archivo.
//
// Con uno solo de los dos cambiados pasa algo raro, que es peor que un error:
// si se cambia sólo el de acá, la persona nueva ve el panel de cliente y no
// le salen ni el nombre ni las fotos. Si se cambia sólo el de las reglas, ve
// todo el panel y cada guardar le rebota con permission-denied.
//
// tests/owner.js compara los dos y falla si se separan.
//
// Que el dueño sea además el barbero NO se decide acá: se marca desde el panel,
// con "Yo también soy el barbero". Esa marca es una bandera en la lista de
// barberos, no un permiso, así que no hay nada que cambiar en ningún lado.
export const ADMIN_UID = "LQ7IkEfxEKNXajx4SEs378n390i2"; // Roman, dueño
      export const NOMBRE = "SSJ Barber"; // nombre de la barbería (lote 36: era "Codigo Barber")
// TODO(dueño, 16/10/26): me dijiste "SSJ BARBER" en mayúsculas. Está guardado en
// mixed case, como estaba el nombre anterior. Los lugares que muestran el logo en
// versalita lo pasan a mayúsculas solos por CSS. Si lo querés TODO en mayúscula
// (en el <title> y las metas también), es este único valor.
      export const AUTOR = "Agustín Ibarra"; // nombre que aparece en el pie de la web
      export const S = [
        { n: "Corte (Incluye cejas)", m: 30, p: 15000 },
        { n: "Barba", m: 30, p: 8000 },
        { n: "Corte + barba", m: 60, p: 20000 },
      ]; // m = minutos, p = precio en $ (cambiar por los reales)
      export const PTS = 5,
        PR = [
          { n: "DESCUENTO 20% 🔥", p: 25 },
          { n: "DESCUENTO 50% 🔥", p: 50 },
          { n: "CORTE GRATIS ‼️", p: 100 },
        ];
      export const MC = ["No puedo asistir", "Me surgió un imprevisto", "Me equivoqué de día u hora", "Otro motivo"]; // motivos (cliente)
      export const MB = ["El cliente avisó que no viene", "No se presentó", "Imprevisto del barbero", "Otro motivo"]; // motivos (barbero)
      export const MP = ["Efectivo", "Transferencia"]; // medios de pago
      // ===== Números de contacto (lote 36) =====
// La barbería quedó con UN solo barbero, que además es el dueño: Roman. Se
// borró el número de Yan.
//
// Ojo con el cambio: `WHATSAPP` no es sólo un contacto de la web. Es el número
// al que se manda el aviso de lista de espera cuando se libera un horario, y el
// que aparece en "Avisar por WhatsApp" después de reservar, en el aviso de
// cancelación y en el de que falta confirmar. Con el cambio, todo eso va a
// Roman. Es lo que pidió el dueño, pero conviene que lo sepa: si algún día
// vuelve a haber dos personas, hay que volver a separar el número de avisos del
// número de contacto.
export const WHATSAPP = "5493757699335"; // avisos de lista de espera y de turnos. Código de país, sin + ni espacios.
// Los números a los que se puede escribir desde la web. La lista se dibuja en
// "También podés escribirnos por" y en el pie. Con un solo barbero queda una
// sola pastilla; si se suman más, se agrega una línea más acá.
export const WA_LISTA = [{ n: "Roman", num: "5493757699335" }];
// Los íconos de Instagram y WhatsApp se aplican con CSS mask sobre
// assets/instagram.svg y assets/whatsapp.svg (ver .ic-ig / .ic-wa en
// src/landing.css), no con <img>: así heredan el color del texto y se ven
// igual en modo claro y oscuro. Los PNG de 388 KB y 30 KB ya no se usan.
export const INSTAGRAM = "romanssj"; // usuario de Instagram (sin @). Antes "codigobarber_1".
export const RESERVAR_URL = "#login"; // destino único y configurable de los botones "Reservar ahora"
// ===== SEO local =====
// El dominio con el que se publica. OJO: si esto cambia hay que cambiar, en
// el mismo lote, las cuatro cosas de abajo que lo repiten:
//   index.html   <link rel="canonical">, og:url, twitter:url, el @id y el
//                "url" del JSON-LD, y las metas geo.*
//   robots.txt   la línea Sitemap:
//   sitemap.xml  cada <loc>
// `tests\seo.js` compara las cinco contra este valor y falla si se separan.
// ====== PENDIENTE DEL DUEÑO (lote 36, 16/10/26) ======
// Pediste cambiar la marca a SSJ BARBER "todo, incluido el dominio". El dominio
// nuevo NO se cambia acá a propósito, y hay que entender por qué:
//
// Este valor se repite en cinco lugares del index.html (canonical, og:url,
// twitter:url, el @id y el "url" del JSON-LD) y `tests/seo.js` falla si se
// separan. Si se pone un dominio que todavía no está apuntando a este hosting,
// Google recibe canonical y og:url de una dirección que no existe: deja de
// indexar la que sí funciona, y cuando el dominio nuevo esté listo hay que
// rehacer la month's indexación de cero.
//
// O sea: el nombre de la marca ya cambió a SSJ Barber, pero el dominio sigue
// siendo el viejo a propósito. Pasame el nuevo y se cambian los SEIS lugares en
// el mismo lote.
export const DOMINIO = "https://codigobarber.com.ar"; // TODO: el nuevo, cuando exista
export const CP = "3370"; // código postal (es el de toda la ciudad)
// Coordenadas del local. Tienen que coincidir con MAP_IFRAME y con el "geo"
// del JSON-LD, o Google muestra el negocio en el punto equivocado.
export const LAT = -25.618;
export const LON = -54.5701752;
export const MAP_IFRAME = `https://www.google.com/maps?q=${LAT},${LON}&z=15&output=embed`; // iframe de ubicación
// Horario GENERAL del local (no el de cada barbero), en minutos desde las 00:
// 540 = 09:00. Va en el JSON-LD como openingHoursSpecification y tiene que
// coincidir con lo que esté cargado en config/horario de Firestore.
// TODO: el horario cargado HOY en Firestore es Lun a Jue 09:00-17:00 con pausa
// de 11:30 a 13:30. Si el horario general real es otro, cambialo acá y en el
// index.html (son dos lugares; `tests\seo.js` avisa si no coinciden).
export const HORARIO_GENERAL = { dias: [1, 2, 3, 4, 5, 6], a: 540, c: 1020 };
// Dirección. Las coordenadas de arriba son de Puerto Iguazú y coinciden con
// esta dirección; si la barbería se muda hay que cambiar las dos.
export const BARRIO = "Los Trabajadores";
export const CALLE = "Av. Su Santidad y Papa Francisco";
export const CIUDAD = "Puerto Iguazú";
export const PROVINCIA = "Misiones";
// CLOUD_NAME, CLOUD_PRESET y CLOUD_FOLDER NO se renombran con la marca, aunque
// todavía digan "codigo_barber_1". Son identificadores de recursos que YA
// existen en Cloudinary: cambiar la carpeta de destino manda todas las fotos
// nuevas a una carpeta vacía y rompe los `transform` que las muestran.
// Lote 36: se anotan acá para que quede claro que es a propósito.
export const CLOUD_NAME = "lvrsdw0h"; // Cloudinary
export const CLOUD_PRESET = "codigo_barber_1"; // Upload Preset unsigned
export const CLOUD_FOLDER = "codigo-barber-1"; // carpeta destino en Cloudinary (NO cambiar con la marca)
// ====== Email de contacto ======
//
// Está vacío a propósito hasta que lo pases. Con `EMAIL = ""` la web no
// muestra ninguna dirección: es preferible no mostrar ninguna a mostrar una
// que no existe o que no es de nadie.
//
// Dónde se ve: la sección de contacto de la landing y el aviso de privacy.
// El nombre del dominio (codigobarber.com.ar) sigue igual hasta que compres
// uno nuevo: eso NO tiene nada que ver con el nombre de la marca, que ya es
// SSJ Barber en toda la web.
//
// Para ponerlo: reemplazá "" por tu dirección, sin comillas sueltas y sin
// espacios. Ej: export const EMAIL = "tucorreo@ejemplo.com";
export const EMAIL = ""; // TODO(dueño): poner el email de contacto
export const RECAPTCHA_KEY = ""; // clave de sitio reCAPTCHA v3 para App Check (vacío = desactivado)
export const CANCEL_HS = 2; // horas mínimas de anticipación para que el cliente cancele
      // Logo: el original assets/logo.png pesa 1,6 MB (1254×1254, y además es un
// cuadrado negro sin transparencia, que sobre el header oscuro se ve como un
// rectángulo negro). logo-256.png es el mismo emblema recortado a 256 px:
// 82 KB, sirve para el header de 38 px y para el modal.
// TODO: si conseguís el SVG original del diseñador, replacear esto y sacar el
// recorte circular del CSS (.lb-logo, .wz-logo).
//
// Lote 36: la marca pasó a SSJ Barber y este logo es todavía el de Codigo
// Barber. Sigue el mismo archivo hasta que llegue el nuevo: cambiarlo por un
// nombre adivinado dejaría la web sin logo. Cuando mandes el tuyo, este valor y
// los <link>/<meta> del index.html que lo nombran se cambian en el mismo lote.
export const LOGO = "assets/logo-256.png"; // TODO: el logo de SSJ Barber
export const OWNER_UID = ADMIN_UID; // único usuario que puede editar los porcentajes de ganancia (el dueño)
export const PD_DEF = 40; // % que se queda el dueño por defecto en cada corte (editable desde Finanzas)
export const GRID = 30; // grilla de horarios en minutos: 30 o 15. Pasá a 15 solo cuando no queden turnos pendientes viejos (ver notas)
export const MP_LINK = ""; // link manual de Mercado Pago para señas (vacío = no se muestra)
