/* ====== Configuración de la barbería (editá solo este archivo) ====== */
      export const firebaseConfig = {
        apiKey: "AIzaSyB2ui0pMSsgbq2bhTFnUHoYcdftTA4Q09M",
        authDomain: "barberia-taccu.firebaseapp.com",
        projectId: "barberia-taccu",
        storageBucket: "barberia-taccu.firebasestorage.app",
        messagingSenderId: "968927411493",
        appId: "1:968927411493:web:cacd75772f2fb791132ecc"
      };
      export const ADMIN_UID = "LQ7IkEfxEKNXajx4SEs378n390i2";
      export const NOMBRE = "Codigo Barber"; // nombre de la barbería
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
      export const WHATSAPP = "5493757644751"; // número con código de país, sin + ni espacios. Ej: "5491122334455"
// Los dos números del local, con nombre para poder distinguirlos. El primero
// de la lista es al que se le manda el aviso de lista de espera (WHATSAPP).
export const WA_ROMAN = { n: "Roman", num: "5493757699335" };
export const WA_YAN = { n: "Yan", num: "5493757644751" };
export const WA_LISTA = [WA_ROMAN, WA_YAN];
// Los íconos de Instagram y WhatsApp se aplican con CSS mask sobre
// assets/instagram.svg y assets/whatsapp.svg (ver .ic-ig / .ic-wa en
// src/landing.css), no con <img>: así heredan el color del texto y se ven
// igual en modo claro y oscuro. Los PNG de 388 KB y 30 KB ya no se usan.
export const INSTAGRAM = "codigobarber_1"; // usuario de Instagram (sin @)
export const RESERVAR_URL = "#login"; // destino único y configurable de los botones "Reservar ahora"
// ===== SEO local =====
// El dominio con el que se publica. OJO: si esto cambia hay que cambiar, en
// el mismo lote, las cuatro cosas de abajo que lo repiten:
//   index.html   <link rel="canonical">, og:url, twitter:url, el @id y el
//                "url" del JSON-LD, y las metas geo.*
//   robots.txt   la línea Sitemap:
//   sitemap.xml  cada <loc>
// `tests\seo.js` compara las cinco contra este valor y falla si se separan.
export const DOMINIO = "https://codigobarber.com.ar";
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
export const CLOUD_NAME = "lvrsdw0h"; // Cloudinary
export const CLOUD_PRESET = "codigo_barber_1"; // Upload Preset unsigned
export const CLOUD_FOLDER = "codigo-barber-1"; // carpeta destino en Cloudinary
export const EMAIL = "hola@codigobarber1.com"; // email de contacto visible en la landing
export const RECAPTCHA_KEY = ""; // clave de sitio reCAPTCHA v3 para App Check (vacío = desactivado)
export const CANCEL_HS = 2; // horas mínimas de anticipación para que el cliente cancele
      // Logo: el original assets/logo.png pesa 1,6 MB (1254×1254, y además es un
// cuadrado negro sin transparencia, que sobre el header oscuro se ve como un
// rectángulo negro). logo-256.png es el mismo emblema recortado a 256 px:
// 82 KB, sirve para el header de 38 px y para el modal.
// TODO: si conseguís el SVG original del diseñador, replacear esto y sacar el
// recorte circular del CSS (.lb-logo, .wz-logo).
export const LOGO = "assets/logo-256.png";
export const OWNER_UID = ADMIN_UID; // único usuario que puede editar los porcentajes de ganancia (el dueño)
export const PD_DEF = 40; // % que se queda el dueño por defecto en cada corte (editable desde Finanzas)
export const GRID = 30; // grilla de horarios en minutos: 30 o 15. Pasá a 15 solo cuando no queden turnos pendientes viejos (ver notas)
export const MP_LINK = ""; // link manual de Mercado Pago para señas (vacío = no se muestra)
