/* Aviso si la app no logra cargar (va fuera de barber.js a propósito) */
setTimeout(function () {
  if (!window.__ok)
    document.getElementById("ldt").textContent =
      "No se pudo cargar la app. Revisá tu conexión o abrila desde un servidor web (no con doble clic).";
}, 8000);
