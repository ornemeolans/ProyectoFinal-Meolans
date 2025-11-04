// Variable global para productos cargados de forma asíncrona
let productsData = []; 

// --- I. FUNCIONES AUXILIARES DE UTILIDAD (Definición prioritaria) ---

function saveClientData() {
    // Guarda los datos del cliente en localStorage
    const nombreInput = document.getElementById("nombre");
    const apellidoInput = document.getElementById("apellido");
    const telefonoInput = document.getElementById("telefono");
    
    if (nombreInput) localStorage.setItem("nombre", nombreInput.value);
    if (apellidoInput) localStorage.setItem("apellido", apellidoInput.value);
    if (telefonoInput) localStorage.setItem("telefono", telefonoInput.value);
}

function loadClientData() {
    // Carga los datos del cliente desde localStorage al formulario
    const nombreInput = document.getElementById("nombre");
    const apellidoInput = document.getElementById("apellido");
    const telefonoInput = document.getElementById("telefono");

    if (nombreInput && localStorage.getItem("nombre")) {
        nombreInput.value = localStorage.getItem("nombre");
    }
    if (apellidoInput && localStorage.getItem("apellido")) {
        apellidoInput.value = localStorage.getItem("apellido");
    }
    if (telefonoInput && localStorage.getItem("telefono")) {
        telefonoInput.value = localStorage.getItem("telefono");
    }
}

function eliminarCarritoSiExpirado() {
    const carrito = JSON.parse(localStorage.getItem("cart")) || [];
    const horaCreacionCarrito = localStorage.getItem("horaCreacionCarrito");

    if (carrito.length > 0 && horaCreacionCarrito) {
        const horaActual = new Date().getTime();
        const tiempoTranscurrido = horaActual - parseInt(horaCreacionCarrito, 10);

        if (tiempoTranscurrido > 3 * 60 * 60 * 1000) { // 3 horas
            localStorage.removeItem("cart");
            localStorage.removeItem("horaCreacionCarrito");
        }
    } else if (carrito.length > 0 && !horaCreacionCarrito) {
        localStorage.setItem("horaCreacionCarrito", new Date().getTime().toString());
    }
}

function getMinPickupDate() {
    const offsetBuenosAires = -180; // UTC-3 en minutos
    const fechaActual = new Date();
    // Ajustar la fecha actual a la zona horaria simulada (UTC-3)
    const fechaBuenosAires = new Date(fechaActual.getTime() + (offsetBuenosAires * 60 * 1000) + (fechaActual.getTimezoneOffset() * 60000));
    return new Date(fechaBuenosAires.getTime() + 48 * 60 * 60 * 1000); 
}

function mostrarResumenPedido() {
    const cart = JSON.parse(localStorage.getItem("cart")) || [];
    const orderSummary = document.getElementById("order-summary");
    const orderSummaryMobile = document.getElementById("order-summary-mobile");
    const totalPedidoMobile = document.getElementById("total-pedido-mobile");
    const totalPedidoPanel = document.getElementById("total-pedido-panel");
    const totalPrice = document.getElementById("total-price");

    // Verificar si los elementos del DOM y los datos están listos
    if (!orderSummary || !orderSummaryMobile || !totalPedidoMobile || !totalPedidoPanel || !totalPrice || productsData.length === 0) {
        return;
    }

    orderSummary.innerHTML = "";
    orderSummaryMobile.innerHTML = "";
    let total = 0;

    if (cart.length === 0) {
        orderSummary.innerHTML = "<li>No hay productos en el carrito.</li>";
        orderSummaryMobile.innerHTML = "<li>No hay productos en el carrito.</li>";
    } else {
        cart.forEach(item => {
            const product = productsData.find(p => p.name === item.title);

            // Función para construir el list item
            const baseItem = (isMobile) => {
                const li = document.createElement("li");
                li.className = "list-group-item";
                if (product && product.images && product.images.length > 0) {
                    const img = document.createElement("img");
                    img.src = product.images[0];
                    img.alt = item.title;
                    img.style.width = isMobile ? "80px" : "100px";
                    img.style.height = "auto";
                    img.style.marginRight = "10px";
                    li.appendChild(img);
                }
                let itemText = `${item.title} - `;
                if (item.sliceCount > 0) {
                    itemText += `${item.sliceCount} porción(es) ($${item.sliceTotal}) `;
                }
                if (item.cakeCount > 0) {
                    itemText += `${item.cakeCount} torta(s) entera(s) ($${item.cakeTotal})`;
                }
                li.appendChild(document.createTextNode(itemText));
                return li;
            };

            orderSummary.appendChild(baseItem(false));
            orderSummaryMobile.appendChild(baseItem(true));

            total += item.sliceTotal + item.cakeTotal;
        });
    }

    totalPedidoMobile.textContent = total;
    totalPedidoPanel.textContent = total;
    totalPrice.textContent = total;
}

function validarRetiro() {
    const paymentForm = document.getElementById("payment-form");
    const fechaRetiroInput = document.getElementById("fecha-retiro");
    const horaRetiroInput = document.getElementById("hora-retiro"); 
    const submitButton = paymentForm ? paymentForm.querySelector('button[type="submit"]') : null;

    if (!submitButton) return false;

    const sucursalSeleccionada = document.querySelector('input[name="pickup"]:checked');
    const fechaRetiroValue = fechaRetiroInput.value;
    const horaRetiroValue = horaRetiroInput.value;
    const fechaMinima = getMinPickupDate();

    // 0. Validación de campos obligatorios
    if (!sucursalSeleccionada || !fechaRetiroValue || !horaRetiroValue) {
        submitButton.disabled = true;
        return false;
    }

    const isTakeAway = sucursalSeleccionada.value === "sucursal1";
    const ABRIR = 8;
    const CERRAR = isTakeAway ? 20 : 21; 
    const HORARIO_TEXTO = isTakeAway ? 'Lunes a Sábado de 8:00 a 20:00 hs.' : 'Lunes a Domingo de 8:00 a 21:00 hs.';

    // --- 1. VALIDACIÓN DE HORARIO ACTUAL (¿El local está abierto AHORA para recibir el pedido?) ---
    const offsetBuenosAires = -180; // UTC-3 en minutos
    const now = new Date();
    // Hora actual en UTC-3
    const nowUTC3 = new Date(now.getTime() + (offsetBuenosAires * 60 * 1000) + (now.getTimezoneOffset() * 60000)); 
    const currentDay = nowUTC3.getDay(); 
    const currentHour = nowUTC3.getHours();
    const currentMinute = nowUTC3.getMinutes();
    const currentTimeInMinutes = currentHour * 60 + currentMinute;
    const closingTimeInMinutes = CERRAR * 60;
    const openingTimeInMinutes = ABRIR * 60;
    
    // a) Take Away cerrado los domingos (current day check)
    if (isTakeAway && currentDay === 0) {
        Swal.fire({ 
            title: '¡Local Cerrado! 🚫',
            text: `La sucursal Take Away está cerrada hoy (Domingo). No podemos procesar pedidos ahora. Nuestro horario es: ${HORARIO_TEXTO}`, 
            icon: "error", buttonsStyling: false, 
            confirmButtonText: "Aceptar", 
            customClass: { confirmButton: "btn btn-primary" } 
        });
        submitButton.disabled = true;
        return false;
    }

    // b) Hora actual fuera del rango (preciso al minuto)
    if (currentTimeInMinutes < openingTimeInMinutes || currentTimeInMinutes > closingTimeInMinutes) {
        Swal.fire({ 
            title: '¡Local Cerrado! 😔',
            text: `No podemos recibir tu pedido ahora. La sucursal ${isTakeAway ? 'Take Away' : 'The Gula House'} está fuera del horario de atención. Nuestro horario es: ${HORARIO_TEXTO}`, 
            icon: "error", buttonsStyling: false, 
            confirmButtonText: "Aceptar", 
            customClass: { confirmButton: "btn btn-primary" } 
        });
        submitButton.disabled = true;
        return false;
    }
    
    // --- 2. VALIDACIÓN DE FECHA Y HORA DE RETIRO (Reglas de negocio 48h y horario de sucursal) ---

    // Crear objeto Date de la hora de retiro seleccionada (UTC-3)
    const fechaHoraSeleccionada = new Date(`${fechaRetiroValue}T${horaRetiroValue}:00-03:00`); 
    const diaSemanaRetiro = fechaHoraSeleccionada.getDay(); // 0 = domingo, 1 = lunes
    const horaRetiro = fechaHoraSeleccionada.getHours();
    const minutosRetiro = fechaHoraSeleccionada.getMinutes();
    const retiroTimeInMinutes = horaRetiro * 60 + minutosRetiro;

    // a) Validación de 48 horas de anticipación
    const fechaMinimaConfirmacion = new Date(fechaMinima.getTime());
    if (fechaHoraSeleccionada.getTime() < fechaMinimaConfirmacion.getTime()) {
        Swal.fire({ 
            text: "🚫 Debes seleccionar una fecha y hora con al menos 48 horas de anticipación.", 
            icon: "warning", buttonsStyling: false, 
            confirmButtonText: "Aceptar", 
            customClass: { confirmButton: "btn btn-primary" } 
        });
        submitButton.disabled = true;
        return false;
    }

    // b) Validación de DÍA de Retiro (solo para Take Away)
    if (isTakeAway && diaSemanaRetiro === 0) { // Domingo
        Swal.fire({ 
            text: "🚫 La sucursal Take Away no permite retiros los domingos.", 
            icon: "warning", buttonsStyling: false, 
            confirmButtonText: "Aceptar", 
            customClass: { confirmButton: "btn btn-primary" } 
        });
        submitButton.disabled = true;
        return false;
    }

    // c) Validación de HORARIO de Retiro (Precisa al minuto)
    if (retiroTimeInMinutes < openingTimeInMinutes) {
        Swal.fire({ 
            text: `🚫 La hora seleccionada (${horaRetiroValue}) es antes de la apertura. ${isTakeAway ? 'Take Away' : 'The Gula House'} abre a las ${ABRIR}:00 hs.`, 
            icon: "warning", buttonsStyling: false, 
            confirmButtonText: "Aceptar", 
            customClass: { confirmButton: "btn btn-primary" } 
        });
        submitButton.disabled = true;
        return false;
    }

    if (retiroTimeInMinutes > closingTimeInMinutes) {
        Swal.fire({ 
            text: `🚫 La hora seleccionada (${horaRetiroValue}) es posterior al cierre. ${isTakeAway ? 'Take Away' : 'The Gula House'} cierra a las ${CERRAR}:00 hs.`, 
            icon: "warning", buttonsStyling: false, 
            confirmButtonText: "Aceptar", 
            customClass: { confirmButton: "btn btn-primary" } 
        });
        submitButton.disabled = true;
        return false;
    }
    
    // Si TODAS las validaciones (actuales y futuras) pasan
    submitButton.disabled = false;
    return true;
}

// --- II. LÓGICA PRINCIPAL (Define la función que orquesta todo) ---

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
    
    // 1. Ejecutar funciones auxiliares
    loadClientData();
    eliminarCarritoSiExpirado();
    mostrarResumenPedido(); // Este es el que ahora debería funcionar
    
    // 2. Establecer el mínimo del input date.
    const fechaMinima = getMinPickupDate();
    fechaRetiroInput.min = fechaMinima.toISOString().split("T")[0];

    // 3. Event listeners para re-validar con cada cambio
    fechaRetiroInput.addEventListener("change", validarRetiro);
    horaRetiroInput.addEventListener("change", validarRetiro);
    sucursal1Radio.addEventListener("change", validarRetiro);
    sucursal2Radio.addEventListener("change", validarRetiro);
    
    // 4. Validar al inicio para desactivar el botón si es necesario
    validarRetiro(); 
    
    // 5. Listener para el envío del formulario
    paymentForm.addEventListener("submit", function (event) {
        event.preventDefault();

        if (validarRetiro()) {
            saveClientData();
            
            // Lógica de creación del mensaje de WhatsApp y redirección...
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
}

// Lógica de toggle para móvil
document.addEventListener("DOMContentLoaded", function () {
    const toggleOrderSummaryButton = document.getElementById("toggle-order-summary");
    const orderSummaryPanel = document.getElementById("order-summary-panel");

    if (!toggleOrderSummaryButton || !orderSummaryPanel) {
        return;
    }

    orderSummaryPanel.classList.remove("active");
    orderSummaryPanel.style.display = "none";

    toggleOrderSummaryButton.addEventListener("click", function () {
        if (orderSummaryPanel.classList.contains("active")) {
            orderSummaryPanel.classList.remove("active");
            orderSummaryPanel.style.display = "none";
        } else {
            orderSummaryPanel.classList.add("active");
            orderSummaryPanel.style.display = "block";
            mostrarResumenPedido();
        }
    });

    function checkScreenSize() {
        if (window.innerWidth <= 767) {
            toggleOrderSummaryButton.style.display = "block";
        } else {
            toggleOrderSummaryButton.style.display = "none";
        }
    }
    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);
});

// --- III. PUNTO DE ENTRADA DE LA APLICACIÓN (Llamada asíncrona) ---

document.addEventListener("DOMContentLoaded", function () {
    // 1. Cargar productos de forma asíncrona
    fetch('../productos.json')
        .then(response => {
            if (!response.ok) {
                throw new Error('No se pudo cargar productos.json. Asegúrate de usar un servidor local.');
            }
            return response.json();
        })
        .then(products => {
            productsData = products; // Almacenar los productos cargados
            initializePageLogic(); // Llamar a la lógica principal AHORA que todo está definido
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

window.mostrarResumenPedido = mostrarResumenPedido;