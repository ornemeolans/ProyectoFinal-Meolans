// Variable global para productos cargados de forma asíncrona
let productsData = []; 

document.addEventListener("DOMContentLoaded", function () {
    // 1. Cargar productos de forma asíncrona
    fetch('../productos.json')
        .then(response => {
            if (!response.ok) {
                // Mensaje de error amigable para el usuario, si falla la carga.
                throw new Error('No se pudo cargar productos.json. Asegúrate de usar un servidor local.');
            }
            return response.json();
        })
        .then(products => {
            productsData = products; // Almacenar los productos cargados
            initializePageLogic();
        })
        .catch(error => {
            console.error(error);
            Swal.fire({
                icon: 'error',
                title: 'Error de Carga',
                text: 'No se pudo cargar el catálogo de productos. Si estás en local, utiliza Live Server o un servidor web.',
                confirmButtonText: 'Aceptar'
            });
        });
});

function initializePageLogic() {
    const paymentForm = document.getElementById("payment-form");
    const fechaRetiroInput = document.getElementById("fecha-retiro");
    const horaRetiroInput = document.getElementById("hora-retiro"); 
    const sucursal1Radio = document.getElementById("sucursal1");
    const sucursal2Radio = document.getElementById("sucursal2");
    const submitButton = paymentForm ? paymentForm.querySelector('button[type="submit"]') : null;

    if (!paymentForm || !fechaRetiroInput || !horaRetiroInput || !sucursal1Radio || !sucursal2Radio || !submitButton) {
        return;
    }
    
    // Funciones de Persistencia y Resumen
    loadClientData();
    eliminarCarritoSiExpirado();
    mostrarResumenPedido();
    
    // --- Lógica de la Fecha Mínima (48hs a partir de ahora en UTC-3) ---
    const offsetBuenosAires = -180; // UTC-3 en minutos
    const fechaActual = new Date();
    // Ajustar la fecha actual a la zona horaria simulada (Buenos Aires/Córdoba)
    const fechaBuenosAires = new Date(fechaActual.getTime() + (offsetBuenosAires * 60 * 1000) + (fechaActual.getTimezoneOffset() * 60000));
    const fechaMinima = new Date(fechaBuenosAires.getTime() + 48 * 60 * 60 * 1000); 
    
    // Establecer el mínimo del input date.
    fechaRetiroInput.min = fechaMinima.toISOString().split("T")[0];

    // Event listeners para re-validar con cada cambio
    fechaRetiroInput.addEventListener("change", validarRetiro);
    horaRetiroInput.addEventListener("change", validarRetiro);
    sucursal1Radio.addEventListener("change", validarRetiro);
    sucursal2Radio.addEventListener("change", validarRetiro);
    
    // Validar al inicio para desactivar el botón si es necesario
    validarRetiro(); 
    
    paymentForm.addEventListener("submit", function (event) {
        event.preventDefault();

        if (validarRetiro()) {
            saveClientData();
            
            // Obtener los datos del formulario
            const nombre = document.getElementById("nombre").value;
            const apellido = document.getElementById("apellido").value;
            const telefono = document.getElementById("telefono").value;
            const metodoPago = document.querySelector('input[name="payment"]:checked').value;
            const sucursalElement = document.querySelector('input[name="pickup"]:checked');
            const sucursal = sucursalElement.value;
            const sucursalNombre = sucursal === "sucursal1" ? "Take Away (Obispo Salguero 479)" : "The Gula House (25 de Mayo 1332)";
            const fechaRetiro = fechaRetiroInput.value;
            const horaRetiro = horaRetiroInput.value;
            let cart = JSON.parse(localStorage.getItem("cart")) || [];

            // Construir el mensaje de WhatsApp
            let total = 0;
            let mensaje = `¡Nuevo pedido!%0A%0A`;
            mensaje += `*Nombre:* ${nombre} ${apellido}%0A`;
            mensaje += `*Teléfono:* ${telefono}%0A`;
            mensaje += `*Método de pago:* ${metodoPago}%0A`;
            mensaje += `*Sucursal:* ${sucursalNombre}%0A`;
            mensaje += `*Fecha y Hora de Retiro:* ${fechaRetiro} ${horaRetiro}%0A%0A`;
            mensaje += `*Detalles del pedido:*%0A`;

            cart.forEach(item => {
                if (item.sliceCount > 0) {
                    mensaje += `- ${item.title}: ${item.sliceCount} porción(es) ($${item.sliceTotal})%0A`;
                }
                if (item.cakeCount > 0) {
                    mensaje += `- ${item.title}: ${item.cakeCount} torta(s) entera(s) ($${item.cakeTotal})`;
                }
                total += item.sliceTotal + item.cakeTotal;
            });

            mensaje += `%0A*Total:* $${total}`;

            const numeroWhatsApp = sucursal === "sucursal1" ? "3517326453" : "3516431879";

            const urlWhatsApp = `https://wa.me/${numeroWhatsApp}?text=${mensaje}`;
            window.open(urlWhatsApp, "_blank");

            Swal.fire({
                text: "¡Compra confirmada! Serás redirigido a WhatsApp para finalizar.",
                icon: "success",
                buttonsStyling: false,
                confirmButtonText: "Aceptar",
                customClass: { confirmButton: "btn btn-primary" }
            }).then(() => {
                localStorage.removeItem("cart");
                localStorage.removeItem("horaCreacionCarrito");
                window.location.href = "../index.html";
            });
        }
    });

    // --- FUNCIÓN DE VALIDACIÓN COMPLETA Y PRECISA ---
    function validarRetiro() {
        submitButton.disabled = true;

        const sucursalSeleccionada = document.querySelector('input[name="pickup"]:checked');
        const fechaSeleccionadaStr = fechaRetiroInput.value;
        const horaSeleccionadaStr = horaRetiroInput.value;

        // 0. Validación de campos obligatorios
        if (!sucursalSeleccionada || !fechaSeleccionadaStr || !horaSeleccionadaStr) {
            return false;
        }

        const isTakeAway = sucursalSeleccionada.value === "sucursal1";
        const ABRIR = 8;
        const CERRAR = isTakeAway ? 20 : 21; // Take Away cierra a las 20, Gula House a las 21
        const HORARIO_TEXTO = isTakeAway ? 'Lunes a Sábado de 8:00 a 20:00 hs.' : 'Lunes a Domingo de 8:00 a 21:00 hs.';

        // 1. VALIDACIÓN DE HORARIO ACTUAL (¡Tu Requisito: ¿Está abierto ahora?)
        const offsetBuenosAires = -180; // UTC-3 en minutos
        const now = new Date();
        const nowUTC3 = new Date(now.getTime() + (offsetBuenosAires * 60 * 1000) + (now.getTimezoneOffset() * 60000));
        const currentDay = nowUTC3.getDay(); // 0 (Dom) - 6 (Sáb)
        const currentHour = nowUTC3.getHours();
        const currentMinute = nowUTC3.getMinutes();
        const currentTimeInMinutes = currentHour * 60 + currentMinute;
        const closingTimeInMinutes = CERRAR * 60;
        const openingTimeInMinutes = ABRIR * 60;
        
        // Take Away está cerrado los domingos (current day check)
        if (isTakeAway && currentDay === 0) {
             Swal.fire({ 
                title: '¡Local Cerrado! 🚫',
                text: `La sucursal Take Away está cerrada hoy (Domingo). Nuestro horario es: ${HORARIO_TEXTO}`, 
                icon: "error", buttonsStyling: false, 
                confirmButtonText: "Aceptar", 
                customClass: { confirmButton: "btn btn-primary" } 
            });
            return false;
        }

        // Si la hora actual es antes de la apertura o después del cierre (¡Preciso al minuto!)
        if (currentTimeInMinutes < openingTimeInMinutes || currentTimeInMinutes > closingTimeInMinutes) {
            Swal.fire({ 
                title: '¡Local Cerrado! 😔',
                text: `No podemos recibir tu pedido ahora. La sucursal ${isTakeAway ? 'Take Away' : 'The Gula House'} está fuera del horario de atención. Nuestro horario es: ${HORARIO_TEXTO}`, 
                icon: "error", buttonsStyling: false, 
                confirmButtonText: "Aceptar", 
                customClass: { confirmButton: "btn btn-primary" } 
            });
            return false;
        }
        
        // --- Validación de la Fecha y Hora de Retiro (Regla de 48h) ---

        // Crear objeto Date de la hora de retiro seleccionada (UTC-3)
        const fechaHoraSeleccionada = new Date(`${fechaSeleccionadaStr}T${horaSeleccionadaStr}:00-03:00`); 
        const diaSemanaRetiro = fechaHoraSeleccionada.getDay(); // 0 = domingo, 1 = lunes
        const horaRetiro = fechaHoraSeleccionada.getHours();
        const minutosRetiro = fechaHoraSeleccionada.getMinutes();
        const retiroTimeInMinutes = horaRetiro * 60 + minutosRetiro;

        // 2. Validación de 48 horas de anticipación
        const fechaMinimaConfirmacion = new Date(fechaMinima.getTime());
        if (fechaHoraSeleccionada.getTime() < fechaMinimaConfirmacion.getTime()) {
            Swal.fire({ 
                text: "🚫 Debes seleccionar una fecha y hora con al menos 48 horas de anticipación.", 
                icon: "warning", buttonsStyling: false, 
                confirmButtonText: "Aceptar", 
                customClass: { confirmButton: "btn btn-primary" } 
            });
            return false;
        }

        // 3. Validación de DÍA de Retiro (solo para Take Away)
        if (isTakeAway && diaSemanaRetiro === 0) { // Domingo
            Swal.fire({ 
                text: "🚫 La sucursal Take Away no permite retiros los domingos.", 
                icon: "warning", buttonsStyling: false, 
                confirmButtonText: "Aceptar", 
                customClass: { confirmButton: "btn btn-primary" } 
            });
            return false;
        }

        // 4. Validación de HORARIO de Retiro (Precisa al minuto)
        
        // Check si es antes de la apertura (8:00 hs)
        if (retiroTimeInMinutes < openingTimeInMinutes) {
            Swal.fire({ 
                text: `🚫 La hora seleccionada (${horaSeleccionadaStr}) es antes de la apertura. ${isTakeAway ? 'Take Away' : 'The Gula House'} abre a las ${ABRIR}:00 hs.`, 
                icon: "warning", buttonsStyling: false, 
                confirmButtonText: "Aceptar", 
                customClass: { confirmButton: "btn btn-primary" } 
            });
            return false;
        }

        // Check si es después del cierre (20:00:00 hs o 21:00:00 hs - el minuto 01 ya no vale)
        if (retiroTimeInMinutes > closingTimeInMinutes) {
            Swal.fire({ 
                text: `🚫 La hora seleccionada (${horaSeleccionadaStr}) es posterior al cierre. ${isTakeAway ? 'Take Away' : 'The Gula House'} cierra a las ${CERRAR}:00 hs.`, 
                icon: "warning", buttonsStyling: false, 
                confirmButtonText: "Aceptar", 
                customClass: { confirmButton: "btn btn-primary" } 
            });
            return false;
        }
        
        // Si TODAS las validaciones (actuales y futuras) pasan, habilitar el botón
        submitButton.disabled = false;
        return true;
    }
}

//