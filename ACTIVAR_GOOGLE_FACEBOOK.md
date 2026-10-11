# Activar el inicio de sesión con Google y con Facebook

Los botones del login **ya estan programados**. No falta código: el código llama a
`signInWithPopup` con los dos proveedores y, si la persona no existe todavía, le
crea su documento en `users/{uid}` con los puntos de bienvenida
(`config/reglas.ptsRegistro`).

Lo que falta es **activar los dos proveedores en la consola de Firebase**. Eso
lo hacés vos, porque requiere entrar con tu cuenta.

Proyecto: **`barberia-taccu`**

---

## Parte 1 — Google (15 minutos, sin salir de Firebase)

1. Abrí <https://console.firebase.google.com/project/barberia-taccu/authentication/providers>
2. En la lista de proveedores, tocá **Google**.
3. Activá el interruptor **Habilitado**.
4. En **Correo electrónico de soporte** elegí una casilla tuya (es obligatorio;
   Google no deja guardar el proveedor sin esto).
5. Tocá **Guardar**.

Listo. Google ya funciona. Para probarlo: `python -m http.server 8765`, abrí
<http://127.0.0.1:8765> y tocá "Ingresar" → **Google**.

> Ojo: `localhost` ya está autorizado de fábrica. **Cuando subas la web a un
> dominio real**, volvé a *Authentication → Settings → Authorized domains* y
> agregá ese dominio, o el botón va a fallar con
> `auth/unauthorized-domain`.

---

## Parte 2 — Facebook (30 minutos, hay que crear una app primero)

Facebook **no** se activa directo en Firebase: primero hay que crear una app en
Meta y_peer las dos claves.

### 2.1 Crear la app en Meta

1. Abrí <https://developers.facebook.com/apps> e iniciá sesión con tu cuenta.
2. **Crear app** → elegí el tipo **Otros** → **Next**.
3. Poné cualquier nombre (ej. `Codigo Barber`) y el correo de la empresa.
   **Next**.
4. Cuando aparezca el panel de la app, abajo a la izquierda tocá
   **Facebook Login**.

### 2.2 Configurar Facebook Login

1. En **Configuración → Básico**:
   - Poné el dominio de la app: `barberia-taccu.firebaseapp.com`
   - En **URI de redireccionamiento válidos** agregá exactamente:

     ```
     https://barberia-taccu.firebaseapp.com/__/auth/handler
     ```

   - Activá **Inicio de sesión de cliente OAuth** en **Sí**.
   - **Guardar cambios**. Te va a pedir confirmación.
2. Abajo aparece el **App ID** y el **App Secret**. Anotalos (o dejalos a la
   vista, los vas a pegar en el paso siguiente).

### 2.3 Pegar las claves en Firebase

1. Volvé a <https://console.firebase.google.com/project/barberia-taccu/authentication/providers>
2. Tocá **Facebook**.
3. Activá **Habilitado**.
4. Pegá el **App ID** y el **App Secret** del punto 2.2.
5. Tocá **Guardar**.

### 2.4 (Recomendado) Ponerle un correo de contacto

Facebook *manda* usuarios a una página de "App in development" si la app está en
modo prueba. Para que no les pase a tus clientes:

1. En Meta, abajo a la izquierda: **App Review → App Settings → Basic**.
2. Agregá un correo de contacto y la **URL de política de privacidad**.
3. Poné el interruptor **Live** (arriba a la derecha).

Sin esto el login funciona, pero **sólo para las cuentas que hayas cargado a
mano** en *Roles → Pruebas*.

---

## Cómo saber si algo falló

Los botones muestran el motivo en un cartelito. Los mensajes están mapeados uno
por uno en `src/main.js` (bloque `ERR`), así que no sale el "Ocurrió un error"
genérico:

| Si pasa esto | Es que... |
|---|---|
| "Ese botón todavía no está habilitado" | falta activar el proveedor en Firebase |
| "Este dominio no está autorizado" | falta agregar el dominio en *Authorized domains* |
| "El navegador bloqueó la ventana" | hay que permitir popups para el sitio |
| "Ese correo ya tiene una cuenta hecha con contraseña" | esa persona se registró antes con email; tiene que entrar con contraseña |

---

## Dónde aparece cada botón

En las **dos** pantallas: Ingreso y Crear cuenta.

Al registrarse con Google o con Facebook se le pide después una **contraseña**
(con un botón para saltárselo). Sirve de red de seguridad: si después esa persona
pierde el acceso a la red social, puede entrar con su correo y esa contraseña en
lugar de quedarse afuera.

Al **ingresar** no se pide contraseña: si la cuenta ya existe, se entra y listo.
