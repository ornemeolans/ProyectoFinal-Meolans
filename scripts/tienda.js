let productsData = []; // Variable para almacenar los productos cargados
let cart = JSON.parse(localStorage.getItem("cart")) || [];

document.addEventListener("DOMContentLoaded", function () {
    // 1. Cargar productos de forma asíncrona
    fetch('../productos.json')
        .then(response => {
            if (!response.ok) {
                throw new Error('No se pudo cargar productos.json');
            }
            return response.json();
        })
        .then(products => {
            productsData = products; // Almacenar los productos en la variable global
            generateProducts(productsData);
            initializeStockWarnings(productsData);
            updateCart(productsData);
            setupEventListeners(productsData); // Configurar eventos después de cargar
        })
        .catch(error => {
            console.error(error);
            Swal.fire({
                icon: 'error',
                title: 'Error de Carga',
                text: 'No se pudo cargar el catálogo de productos.',
                confirmButtonText: 'Aceptar'
            });
        });
});

function setupEventListeners(products) {
    const searchInput = document.getElementById('search-input');
    const filterButtons = document.querySelectorAll('.filter-btn');

    // Listener para la búsqueda
    searchInput.addEventListener('keyup', () => filterAndSearchProducts(products));

    // Listeners para los filtros de categoría
    filterButtons.forEach(button => {
        button.addEventListener('click', (event) => {
            // Manejo de la clase 'active' para el estilo
            filterButtons.forEach(btn => btn.classList.remove('active'));
            event.target.classList.add('active');
            
            filterAndSearchProducts(products);
        });
    });
}

function filterAndSearchProducts(products) {
    const searchInput = document.getElementById('search-input');
    const searchTerm = searchInput.value.toLowerCase();
    const activeFilter = document.querySelector('.filter-btn.active').getAttribute('data-filter');

    let filteredProducts = products.filter(product => {
        // Filtro por término de búsqueda (nombre)
        const matchesSearch = product.name.toLowerCase().includes(searchTerm);
        
        // Filtro por categoría
        const matchesCategory = activeFilter === 'all' || product.category === activeFilter;

        return matchesSearch && matchesCategory;
    });

    generateProducts(filteredProducts);
    initializeStockWarnings(filteredProducts);
}

function generateProducts(products) {
    const container = document.getElementById("grid");
    if (!container) return; 
    container.innerHTML = "";
    
    // Si no hay productos, mostrar mensaje
    if (products.length === 0) {
        container.innerHTML = '<p class="no-results-msg">No se encontraron productos que coincidan con los filtros.</p>';
        return;
    }

    products.forEach((product, index) => {
        // ... (Tu lógica de generación de HTML de producto)
        const carouselId = `carousel-${product.name.replace(/\s+/g, '')}`;
        const imagesHTML = product.images.map((img, i) => `
            <div class="carousel-item ${i === 0 ? 'active' : ''}">
                <img src="${img}" class="d-block w-100" alt="${product.name}">
            </div>
        `).join('');

        const sliceControlsHTML = product.slicePrice !== null ? `
            <p class="stock-warning-slices" style="display: none; color: red; font-weight: bold;">⚠️ Última porción en stock</p>
            <div class="count-controls">
                <button onclick="decrementSlices(this)">-1</button>
                <p>Porciones: $${product.slicePrice}</p>
                <button onclick="incrementSlices(this)">+1</button>
            </div>
            <div class="slice-count">
                <p>Porciones:</p> <span id="sliceCount">0</span>
            </div>
        ` : '';

        const productHTML = `
            <div class="card-${index + 1}">
                <div id="${carouselId}" class="carousel slide" data-bs-ride="carousel">
                    <div class="carousel-inner">
                        ${imagesHTML}
                    </div>
                    <button class="carousel-control-prev" type="button" data-bs-target="#${carouselId}" data-bs-slide="prev">
                        <span class="carousel-control-prev-icon" aria-hidden="true"></span>
                        <span class="visually-hidden">Previous</span>
                    </button>
                    <button class="carousel-control-next" type="button" data-bs-target="#${carouselId}" data-bs-slide="next">
                        <span class="carousel-control-next-icon" aria-hidden="true"></span>
                        <span class="visually-hidden">Next</span>
                    </button>
                </div>
                <div class="card-body">
                    <h5 class="card-title">${product.name}</h5>
                    <p class="card-text">${product.description}</p>
                    ${sliceControlsHTML}
                    <p class="stock-warning-cakes" style="display: none; color: red; font-weight: bold;">⚠️ Último en stock</p>
                    <div class="count-controls">
                        <button onclick="decrementCakes(this)">-1</button>
                        <p>Entera: $${product.cakePrice}</p>
                        <button onclick="incrementCakes(this)">+1</button>
                    </div>
                    <div class="cake-count">
                        <p>Entera:</p> <span id="cakeCount">0</span>
                    </div>
                    <div class="add-to-cart">
                        <button onclick="addToCart(this)">Agregar al carrito</button>
                    </div>
                </div>
            </div>
        `;
        container.innerHTML += productHTML;
    });
}


function incrementSlices(button) {
    let card = button.closest('.card-body');
    let sliceSpan = card.querySelector('.slice-count span');
    let count = parseInt(sliceSpan.textContent) || 0;
    sliceSpan.textContent = count + 1;
}

function decrementSlices(button) {
    let card = button.closest('.card-body');
    let sliceSpan = card.querySelector('.slice-count span');
    let count = parseInt(sliceSpan.textContent) || 0;
    if (count > 0) {
        sliceSpan.textContent = count - 1;
    }
}

function incrementCakes(button) {
    let card = button.closest('.card-body');
    let cakeSpan = card.querySelector('.cake-count span');
    let count = parseInt(cakeSpan.textContent) || 0;
    cakeSpan.textContent = count + 1;
}

function decrementCakes(button) {
    let card = button.closest('.card-body');
    let cakeSpan = card.querySelector('.cake-count span');
    let count = parseInt(cakeSpan.textContent) || 0;
    if (count > 0) {
        cakeSpan.textContent = count - 1;
    }
}

function addToCart(button) {
    let card = button.closest('.card-body');
    let title = card.querySelector('.card-title').textContent;

    let sliceSpan = card.querySelector('.slice-count span');
    let cakeSpan = card.querySelector('.cake-count span');

    let sliceCount = sliceSpan ? parseInt(sliceSpan.textContent) || 0 : 0;
    let cakeCount = cakeSpan ? parseInt(cakeSpan.textContent) || 0 : 0;

    // Buscar el producto en los datos cargados
    let product = productsData.find(p => p.name === title);
    if (!product) return;

    let slicePrice = product.slicePrice || 0;
    let cakePrice = product.cakePrice || 0;

    let sliceTotal = sliceCount * slicePrice;
    let cakeTotal = cakeCount * cakePrice;

    // Verificar si hay suficiente stock
    if (sliceCount > product.stockSlices) {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: `❌ No hay suficientes porciones de ${title}. Stock disponible: ${product.stockSlices}`,
            confirmButtonText: 'Aceptar',
            customClass: { confirmButton: 'btn btn-primary' }
        });
        return;
    }

    if (cakeCount > product.stockCakes) {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: `❌ No hay suficientes tortas enteras de ${title}. Stock disponible: ${product.stockCakes}`,
            confirmButtonText: 'Aceptar',
            customClass: { confirmButton: 'btn btn-primary' }
        });
        return;
    }

    // Descontar del stock (simulación)
    product.stockSlices -= sliceCount;
    product.stockCakes -= cakeCount;

    // Actualizar visualmente la leyenda de "Última en stock"
    updateStockWarning(card, product);

    // Agregar al carrito si hay stock suficiente
    if (sliceCount > 0 || cakeCount > 0) {
        let existingItem = cart.find(item => item.title === title);

        if (existingItem) {
            existingItem.sliceCount += sliceCount;
            existingItem.cakeCount += cakeCount;
            existingItem.sliceTotal += sliceTotal;
            existingItem.cakeTotal += cakeTotal;
        } else {
            cart.push({
                title,
                sliceCount,
                cakeCount,
                sliceTotal,
                cakeTotal,
                slicePrice: product.slicePrice, // Guardar precio para la eliminación en el carrito
                cakePrice: product.cakePrice // Guardar precio para la eliminación en el carrito
            });
        }

        // Guardar el carrito en localStorage
        localStorage.setItem("cart", JSON.stringify(cart));

        updateCart(productsData);

        // Resetear los contadores
        if (sliceSpan) sliceSpan.textContent = 0;
        if (cakeSpan) cakeSpan.textContent = 0;
    } else {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: '❌ Por favor, selecciona al menos una porción o una torta entera antes de agregar al carrito.',
            confirmButtonText: 'Aceptar',
            customClass: { confirmButton: 'btn btn-primary' }
        });
    }
}

// Función para inicializar warnings
function initializeStockWarnings(products) {
    // Se asegura de que los warnings se inicialicen usando los productos cargados
    document.querySelectorAll('.card-body').forEach(card => {
        let title = card.querySelector('.card-title').textContent;
        let product = products.find(p => p.name === title);
        if (product) {
            updateStockWarning(card, product);
        }
    });
}

// Función para actualizar el carrito (Se llama con productsData)
function updateCart(products) {
    let cartContainer = document.getElementById('cart');
    if (!cartContainer) return; 
    cartContainer.innerHTML = '';

    if (cart.length === 0) {
        cartContainer.innerHTML = '<li>El carrito está vacío</li>';
        updateCartCounter(0); 
        return;
    }

    cart.forEach((item, index) => {
        let listItem = document.createElement('li');
        let text = `${item.title} - `;

        if (item.sliceCount > 0) {
            text += `Porciones: ${item.sliceCount} ($${item.sliceTotal}) `;
            text += `<button class="btn-eliminar" onclick="removeSlices(${index})">Eliminar porciones</button>`;
        }

        if (item.cakeCount > 0) {
            text += `| Enteras: ${item.cakeCount} ($${item.cakeTotal})`;
            text += `<button class="btn-eliminar" onclick="removeCakes(${index})">Eliminar enteras</button>`;
        }

        listItem.innerHTML = text.trim(); 
        cartContainer.appendChild(listItem);
    });

    let totalItems = cart.reduce((total, item) => total + item.sliceCount + item.cakeCount, 0);
    updateCartCounter(totalItems);
}

// Las funciones removeSlices y removeCakes deben acceder a los precios guardados en el item.
// Además, la lógica de stock debería corregir el stock simulado en productsData si se desea un control de stock real. 
// Por simplicidad, y ya que el stock se reinicia al recargar, mantendremos la lógica básica de carrito:

function removeSlices(index) {
    if (cart[index].sliceCount > 0) {
        // Usa el precio guardado en el ítem del carrito
        cart[index].sliceCount--;
        cart[index].sliceTotal -= cart[index].slicePrice;
        
        // Simular devolución de stock (Opcional)
        let product = productsData.find(p => p.name === cart[index].title);
        if(product && product.stockSlices !== undefined) product.stockSlices++;

        if (cart[index].sliceCount === 0 && cart[index].cakeCount === 0) {
            cart.splice(index, 1);
        }
        localStorage.setItem("cart", JSON.stringify(cart));
        updateCart(productsData);
        filterAndSearchProducts(productsData); // Para actualizar el warning de stock en la tienda
    }
}

function removeCakes(index) {
    if (cart[index].cakeCount > 0) {
        // Usa el precio guardado en el ítem del carrito
        cart[index].cakeCount--;
        cart[index].cakeTotal -= cart[index].cakePrice;
        
        // Simular devolución de stock (Opcional)
        let product = productsData.find(p => p.name === cart[index].title);
        if(product && product.stockCakes !== undefined) product.stockCakes++;

        if (cart[index].sliceCount === 0 && cart[index].cakeCount === 0) {
            cart.splice(index, 1);
        }
        localStorage.setItem("cart", JSON.stringify(cart));
        updateCart(productsData);
        filterAndSearchProducts(productsData); // Para actualizar el warning de stock en la tienda
    }
}


function updateCartCounter(totalItems) {
    let cartButton = document.getElementById('cart-button');
    if (cartButton) {
        cartButton.textContent = `🛒 Ver Carrito (${totalItems})`;
    }
}

function updateStockWarning(card, product) {
    let stockWarningSlices = card.querySelector('.stock-warning-slices');
    let stockWarningCakes = card.querySelector('.stock-warning-cakes');

    if (stockWarningSlices && product.stockSlices === 1) {
        stockWarningSlices.style.display = "block";
    } else if (stockWarningSlices) {
        stockWarningSlices.style.display = "none";
    }

    if (stockWarningCakes && product.stockCakes === 1) {
        stockWarningCakes.style.display = "block";
    } else if (stockWarningCakes) {
        stockWarningCakes.style.display = "none";
    }
}

function toggleCart() {
    let cartPanel = document.getElementById('cart-panel');
    if (!cartPanel) return; 
    if (cartPanel.style.right === "0px") {
        cartPanel.style.right = "-350px"; 
    } else {
        cartPanel.style.right = "0px"; 
        updateCart(productsData); 
    }
}

function checkout() {
    if (cart.length === 0) {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Tu carrito está vacío. Agrega productos antes de finalizar la compra.',
            confirmButtonText: 'Aceptar',
            customClass: { confirmButton: 'btn btn-primary' }
        });
        return;
    }

    localStorage.setItem("cart", JSON.stringify(cart));
    window.location.href = "pago.html";
}

// Exponer funciones necesarias para el HTML
window.incrementSlices = incrementSlices;
window.decrementSlices = decrementSlices;
window.incrementCakes = incrementCakes;
window.decrementCakes = decrementCakes;
window.addToCart = addToCart;
window.removeSlices = removeSlices;
window.removeCakes = removeCakes;
window.toggleCart = toggleCart;
window.checkout = checkout;