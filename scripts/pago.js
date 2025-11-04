let productsData = []; // Variable global para productos

document.addEventListener("DOMContentLoaded", function () {
    // 1. Cargar productos de forma asíncrona
    fetch('../productos.json')
        .then(response => response.json())
        .then(products => {
            productsData = products;
            
            // 2. Ejecutar la lógica de la página
            initializePageLogic();
        })
        .catch(error => {
            console.error('Error al cargar productos:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error de Carga',
                text: 'No se pudo cargar el catálogo. Por favor, recarga la página.',
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
    const submitButton = paymentForm.querySelector('button[type="submit"]');

    if (!paymentForm || !fechaRetiroInput || !horaRetiroInput || !sucursal1Radio || !sucursal2Radio || !submitButton) {
        return;
    }
    
    // Funciones de utilidad para Persistencia y Resumen
    loadClientData();
    eliminarCarritoSiExpirado();
    mostrarResumenPedido();
    
    // Configurar la fecha mínima de retiro (48hs a partir de ahora en Buenos Aires)
    const offsetBuenosAires = -180; // UTC-3 en minutos
    const fechaActual = new Date();
    // Ajustar la fecha actual a la zona horaria simulada (Buenos Aires)
    const fechaBuenosAires = new Date(fechaActual.getTime() + (offsetBuenosAires + fechaActual.getTimezoneOffset()) * 60000);
    const fechaMinima = new Date(fechaBuenosAires.getTime() + 48 * 60 * 60 * 1000); 
    // Establecer el mínimo del input date en UTC (solo la fecha)
    fechaRetiroInput.min = fechaMinima.toISOString().split("T")[0];

    // Event listeners para validación
    fechaRetiroInput.addEventListener("change", validarRetiro);
    horaRetiroInput.addEventListener("change", validarRetiro);
    sucursal1Radio.addEventListener("change", validarRetiro);
    sucursal2Radio.addEventListener("change", validarRetiro);
    
    // Validar al inicio
    validarRetiro(); 
    
    paymentForm.addEventListener("submit", function (event) {
        event.preventDefault();

        if (validarRetiro()) {
            // Guardar datos del cliente para la próxima visita
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
            let mensaje = `¡Nuevo pedido!%0A%0A`;
            mensaje += `*Nombre:* ${nombre} ${apellido}%0A`;
            mensaje += `*Teléfono:* ${telefono}%0A`;
            mensaje += `*Método de pago:* ${metodoPago}%0A`;
            mensaje += `*Sucursal:* ${sucursalNombre}%0A`;
            mensaje += `*Fecha y Hora de Retiro:* ${fechaRetiro} ${horaRetiro}%0A%0A`;
            mensaje += `*Detalles del pedido:*%0A`;

            let total = 0;
            cart.forEach(item => {
                if (item.sliceCount > 0) {
                    mensaje += `- ${item.title}: ${item.sliceCount} porción(es) ($${item.sliceTotal})%0A`;
                }
                if (item.cakeCount > 0) {
                    mensaje += `- ${item.title}: ${item.cakeCount} torta(s) entera(s) ($${item.cakeTotal})%0A`;
                }
                total += item.sliceTotal + item.cakeTotal;
            });

            mensaje += `%0A*Total:* $${total}`;

            // Determinar el número de WhatsApp según la sucursal
            const numeroWhatsApp = sucursal === "sucursal1" ? "3517326453" : "3516431879";

            // Abrir WhatsApp con el mensaje predefinido
            const urlWhatsApp = `https://wa.me/${numeroWhatsApp}?text=${mensaje}`;
            window.open(urlWhatsApp, "_blank");

            // Mostrar la alerta de confirmación
            Swal.fire({
                text: "¡Compra confirmada! Serás redirigido a WhatsApp para finalizar.",
                icon: "success",
                buttonsStyling: false,
                confirmButtonText: "Aceptar",
                customClass: { confirmButton: "btn btn-primary" }
            }).then(() => {
                // Limpiar el carrito y redirigir al usuario
                localStorage.removeItem("cart");
                localStorage.removeItem("horaCreacionCarrito");
                window.location.href = "../index.html";
            });
        }
    });

    function validarRetiro() {
        // Deshabilitar el botón por defecto
        submitButton.disabled = true;

        const fechaSeleccionadaStr = fechaRetiroInput.value;
        const horaSeleccionadaStr = horaRetiroInput.value;
        
        if (!fechaSeleccionadaStr || !horaSeleccionadaStr) {
            return false;
        }

        const fechaHoraSeleccionada = new Date(`${fechaSeleccionadaStr}T${horaSeleccionadaStr}:00-03:00`); 
        const diaSemana = fechaHoraSeleccionada.getDay(); // 0 = domingo, 1 = lunes

        // --- Configuración de Horarios y Fechas ---
        const ABRIR_TAKE_AWAY = 8; // 8:00 hs
        const CERRAR_TAKE_AWAY = 20; // 20:00 hs
        const ABRIR_GULA = 8; // 8:00 hs
        const CERRAR_GULA = 21; // 21:00 hs
        
        const offsetBuenosAires = -180; // UTC-3 en minutos
        const fechaActual = new Date();
        const fechaBuenosAires = new Date(fechaActual.getTime() + (offsetBuenosAires + fechaActual.getTimezoneOffset()) * 60000);
        const fechaMinima = new Date(fechaBuenosAires.getTime() + 48 * 60 * 60 * 1000);

        // --- Validación de Sucursal y Horarios ---
        const hora = fechaHoraSeleccionada.getHours();
        const horaMinimaRetiro = fechaMinima.getHours();
        const fechaMinimaStr = fechaMinima.toISOString().split("T")[0];
        const fechaSeleccionadaSoloFechaStr = fechaSeleccionadaStr;
        
        const isTakeAway = sucursal1Radio.checked;

        // 1. Validar Día y Horario por Sucursal
        if (isTakeAway) {
            // Take Away: Lunes a Sábado (1-6), 8:00 a 20:00
            if (diaSemana === 0) { // Domingo
                Swal.fire({ text: "🚫 Los domingos la sucursal Take Away se encuentra cerrada. Selecciona The Gula House.", icon: "warning", buttonsStyling: false, confirmButtonText: "Aceptar", customClass: { confirmButton: "btn btn-primary" } });
                return false;
            }
            if (hora < ABRIR_TAKE_AWAY || hora > CERRAR_TAKE_AWAY) {
                 Swal.fire({ text: `🚫 Horario de retiro para Take Away debe ser entre ${ABRIR_TAKE_AWAY}:00 y ${CERRAR_TAKE_AWAY}:00 hs.`, icon: "warning", buttonsStyling: false, confirmButtonText: "Aceptar", customClass: { confirmButton: "btn btn-primary" } });
                return false;
            }
        } else {
            // The Gula House: Todos los días (0-6), 8:00 a 21:00
            if (hora < ABRIR_GULA || hora > CERRAR_GULA) {
                Swal.fire({ text: `🚫 Horario de retiro para The Gula House debe ser entre ${ABRIR_GULA}:00 y ${CERRAR_GULA}:00 hs.`, icon: "warning", buttonsStyling: false, confirmButtonText: "Aceptar", customClass: { confirmButton: "btn btn-primary" } });
                return false;
            }
        }
        
        // 2. Validación de 48 horas de anticipación
        if (fechaHoraSeleccionada < fechaMinima) {
            Swal.fire({ text: "🚫 Debes seleccionar una fecha y hora con al menos 48 horas de anticipación.", icon: "warning", buttonsStyling: false, confirmButtonText: "Aceptar", customClass: { confirmButton: "btn btn-primary" } });
            return false;
        }

        // Si todas las validaciones pasan, habilitar el botón de confirmar
        submitButton.disabled = false;
        return true;
    }
}

// Función para guardar los datos del cliente
function saveClientData() {
    localStorage.setItem("nombre", document.getElementById("nombre").value);
    localStorage.setItem("apellido", document.getElementById("apellido").value);
    localStorage.setItem("telefono", document.getElementById("telefono").value);
}

// Función para precargar los datos del cliente
function loadClientData() {
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

// Lógica de carrito y resumen (ajustada para usar productsData)

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
        // Si hay carrito pero no hay hora, establecerla
        localStorage.setItem("horaCreacionCarrito", new Date().getTime().toString());
    }
}


function mostrarResumenPedido() {
    const cart = JSON.parse(localStorage.getItem("cart")) || [];
    const orderSummary = document.getElementById("order-summary");
    const orderSummaryMobile = document.getElementById("order-summary-mobile");
    const totalPedidoMobile = document.getElementById("total-pedido-mobile");
    const totalPedidoPanel = document.getElementById("total-pedido-panel");
    const totalPrice = document.getElementById("total-price");

    if (!orderSummary || !orderSummaryMobile || !totalPedidoMobile || !totalPedidoPanel || !totalPrice) {
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
            // Busca el producto en los datos cargados globalmente
            const product = productsData.find(p => p.name === item.title);

            // Código para construir el list item (Escritorio)
            const listItem = document.createElement("li");
            listItem.className = "list-group-item";
            if (product && product.images && product.images.length > 0) {
                const img = document.createElement("img");
                img.src = product.images[0];
                img.alt = item.title;
                img.style.width = "100px";
                img.style.height = "auto";
                img.style.marginRight = "10px";
                listItem.appendChild(img);
            }

            let itemText = `${item.title} - `;
            if (item.sliceCount > 0) {
                itemText += `${item.sliceCount} porción(es) ($${item.sliceTotal}) `;
            }
            if (item.cakeCount > 0) {
                itemText += `${item.cakeCount} torta(s) entera(s) ($${item.cakeTotal})`;
            }
            listItem.appendChild(document.createTextNode(itemText));
            orderSummary.appendChild(listItem);

            // Código para construir el list item (Móvil)
            const listItemMobile = document.createElement("li");
            listItemMobile.className = "list-group-item";
            if (product && product.images && product.images.length > 0) {
                const imgMobile = document.createElement("img");
                imgMobile.src = product.images[0];
                imgMobile.alt = item.title;
                imgMobile.style.width = "80px"; 
                imgMobile.style.height = "auto";
                imgMobile.style.marginRight = "10px";
                listItemMobile.appendChild(imgMobile);
            }
            let itemTextMobile = `${item.title} - `;
            if (item.sliceCount > 0) {
                itemTextMobile += `${item.sliceCount} porción(es) ($${item.sliceTotal}) `;
            }
            if (item.cakeCount > 0) {
                itemTextMobile += `${item.cakeCount} torta(s) entera(s) ($${item.cakeTotal})`;
            }
            listItemMobile.appendChild(document.createTextNode(itemTextMobile));
            orderSummaryMobile.appendChild(listItemMobile);

            total += item.sliceTotal + item.cakeTotal;
        });
    }

    totalPedidoMobile.textContent = total;
    totalPedidoPanel.textContent = total;
    totalPrice.textContent = total;
}

// El resto de la lógica para el botón desplegable en móvil (toggleOrderSummaryButton)
// se mantiene igual.

window.mostrarResumenPedido = mostrarResumenPedido; // Necesario para que el DOM lo vea

// Lógica de toggle para móvil
document.addEventListener("DOMContentLoaded", function () {
    const toggleOrderSummaryButton = document.getElementById("toggle-order-summary");
    const orderSummaryPanel = document.getElementById("order-summary-panel");

    if (!toggleOrderSummaryButton || !orderSummaryPanel) {
        return;
    }

    // Asegurar que el panel inicia oculto
    orderSummaryPanel.classList.remove("active");
    orderSummaryPanel.style.display = "none"; 

    toggleOrderSummaryButton.addEventListener("click", function () {
        if (orderSummaryPanel.classList.contains("active")) {
            orderSummaryPanel.classList.remove("active");
            orderSummaryPanel.style.display = "none"; 
        } else {
            orderSummaryPanel.classList.add("active");
            orderSummaryPanel.style.display = "block"; 
        }

        mostrarResumenPedido();
    });
    
    // Función de ajuste de pantalla para mostrar/ocultar el botón móvil
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