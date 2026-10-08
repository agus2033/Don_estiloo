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
      export const NOMBRE = "Codigo Barber 1"; // nombre de la barbería
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
export const INSTAGRAM = "codigobarber_1"; // usuario de Instagram (sin @)
export const RESERVAR_URL = "#login"; // destino único y configurable de los botones "Reservar ahora"
export const MAP_IFRAME = "https://www.google.com/maps?q=-25.618,-54.5701752&z=15&output=embed"; // iframe de ubicación
export const CLOUD_NAME = "lvrsdw0h"; // Cloudinary
export const CLOUD_PRESET = "codigo_barber_1"; // Upload Preset unsigned
export const CLOUD_FOLDER = "codigo-barber-1"; // carpeta destino en Cloudinary
export const EMAIL = "hola@codigobarber1.com"; // email de contacto visible en la landing
export const RECAPTCHA_KEY = ""; // clave de sitio reCAPTCHA v3 para App Check (vacío = desactivado)
export const CANCEL_HS = 2; // horas mínimas de anticipación para que el cliente cancele
export const LOGO = "assets/logo.png"; // logo provisorio: reemplazá el archivo assets/logo.svg (o poné "assets/logo.png") por el tuyo
export const OWNER_UID = ADMIN_UID; // único usuario que puede editar los porcentajes de ganancia (el dueño)
export const PD_DEF = 40; // % que se queda el dueño por defecto en cada corte (editable desde Finanzas)
export const GRID = 30; // grilla de horarios en minutos: 30 o 15. Pasá a 15 solo cuando no queden turnos pendientes viejos (ver notas)
export const MP_LINK = ""; // link manual de Mercado Pago para señas (vacío = no se muestra)
