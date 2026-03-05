/**
 * Encrypted E-Commerce Store - Client Application
 */

let currentCryptoKey = null;
let products = [];
let cart = [];
let lastPayload = null;

const API_URL = import.meta.env.VITE_API_URL;
fetch(`${API_URL}/api/products`);
// ============ INITIALIZATION ============

document.addEventListener('DOMContentLoaded', () => {
    console.log('Encrypted E-Commerce Store initialized');
    loadSavedConfig();
    loadProducts();
    updateCartUI();
});

function loadSavedConfig() {
    const savedUrl = localStorage.getItem('apiUrl');
    const savedKey = localStorage.getItem('masterKey');
    
    if (savedUrl) {
        document.getElementById('apiUrl').value = savedUrl;
    }
    if (savedKey) {
        document.getElementById('masterKey').value = savedKey;
        loadMasterKey(savedKey);
    }
}

function saveConfig() {
    localStorage.setItem('apiUrl', document.getElementById('apiUrl').value);
    localStorage.setItem('masterKey', document.getElementById('masterKey').value);
}

// ============ PRODUCTS MANAGEMENT ============

async function loadProducts() {
    const apiUrl = document.getElementById('apiUrl').value;
    
    try {
        showToast('Loading products...', 'info');
        
        const response = await fetch(`${apiUrl}/api/products`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        products = data.products || [];
        
        renderProducts();
        showToast('✓ Products loaded successfully', 'success');

    } catch (error) {
        showToast(`✗ Failed to load products: ${error.message}`, 'error');
        console.error('Product loading error:', error);
    }
}

function renderProducts() {
    const productsList = document.getElementById('productsList');
    productsList.innerHTML = '';

    products.forEach(product => {
        const productCard = document.createElement('div');
        productCard.className = 'product-card';
        productCard.innerHTML = `
            <div class="product-icon">${product.image}</div>
            <div class="product-info">
                <h3>${product.name}</h3>
                <p class="product-category">${product.category}</p>
                <p class="product-price">฿${product.price.toLocaleString()}</p>
            </div>
            <button class="btn btn-add-cart" onclick="addToCart(${product.id})">
                Add to Cart
            </button>
        `;
        productsList.appendChild(productCard);
    });
}

// ============ CART MANAGEMENT ============

function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const cartItem = cart.find(item => item.id === productId);
    
    if (cartItem) {
        cartItem.quantity++;
    } else {
        cart.push({
            id: product.id,
            name: product.name,
            price: product.price,
            quantity: 1
        });
    }

    updateCartUI();
    showToast(`✓ Added ${product.name} to cart`, 'success');
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    updateCartUI();
}

function updateQuantity(productId, quantity) {
    const item = cart.find(item => item.id === productId);
    if (item) {
        if (quantity <= 0) {
            removeFromCart(productId);
        } else {
            item.quantity = quantity;
            updateCartUI();
        }
    }
}

function updateCartUI() {
    const cartCount = document.getElementById('cartCount');
    const cartItems = document.getElementById('cartItems');
    const cartEmpty = document.getElementById('cartEmpty');
    const checkoutSection = document.getElementById('checkoutSection');
    const checkoutBtn = document.getElementById('checkoutBtn');

    cartCount.textContent = cart.reduce((sum, item) => sum + item.quantity, 0);

    if (cart.length === 0) {
        cartItems.innerHTML = '';
        cartEmpty.classList.remove('hidden');
        checkoutSection.classList.add('hidden');
        checkoutBtn.classList.remove('hidden');
    } else {
        cartEmpty.classList.add('hidden');
        checkoutBtn.classList.remove('hidden');

        cartItems.innerHTML = '';
        cart.forEach(item => {
            const cartItem = document.createElement('div');
            cartItem.className = 'cart-item';
            cartItem.innerHTML = `
                <div class="cart-item-info">
                    <h4>${item.name}</h4>
                    <p class="cart-item-price">฿${item.price.toLocaleString()}</p>
                </div>
                <div class="cart-item-quantity">
                    <button onclick="updateQuantity(${item.id}, ${item.quantity - 1})">−</button>
                    <input type="number" value="${item.quantity}" min="1" onchange="updateQuantity(${item.id}, parseInt(this.value))">
                    <button onclick="updateQuantity(${item.id}, ${item.quantity + 1})">+</button>
                </div>
                <div class="cart-item-subtotal">
                    ฿${(item.price * item.quantity).toLocaleString()}
                </div>
                <button class="btn-remove" onclick="removeFromCart(${item.id})">✕</button>
            `;
            cartItems.appendChild(cartItem);
        });

        updateCartSummary();
    }
}

function updateCartSummary() {
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const shipping = 100;
    const total = subtotal + shipping;

    document.getElementById('subtotal').textContent = `฿${subtotal.toLocaleString()}`;
    document.getElementById('shipping').textContent = `฿${shipping.toLocaleString()}`;
    document.getElementById('total').textContent = `฿${total.toLocaleString()}`;
}

// ============ CHECKOUT & ORDERS ============

function toggleCheckout() {
    const checkoutSection = document.getElementById('checkoutSection');
    const checkoutBtn = document.getElementById('checkoutBtn');

    if (checkoutSection.classList.contains('hidden')) {
        checkoutSection.classList.remove('hidden');
        checkoutBtn.textContent = 'Cancel Checkout';
    } else {
        checkoutSection.classList.add('hidden');
        checkoutBtn.textContent = 'Proceed to Checkout';
    }
}

async function placeOrder() {
    if (!currentCryptoKey) {
        showToast('✗ Master key not loaded. Please configure API first.', 'error');
        return;
    }

    if (cart.length === 0) {
        showToast('✗ Cart is empty', 'error');
        return;
    }

    const customerEmail = document.getElementById('customerEmail').value;
    const shippingAddress = document.getElementById('shippingAddress').value;

    if (!customerEmail || !shippingAddress) {
        showToast('✗ Please fill in email and shipping address', 'error');
        return;
    }

    try {
        showToast('🔒 Encrypting order...', 'info');

        // Create order payload
        const orderData = {
            items: cart.map(item => ({
                id: item.id,
                quantity: item.quantity
            })),
            customerEmail,
            shippingAddress,
            timestamp: new Date().toISOString()
        };

        // Encrypt using AES-256-GCM
        const encrypted = await ClientEncryptionService.encrypt(
            JSON.stringify(orderData),
            currentCryptoKey
        );

        showToast('📡 Sending encrypted order...', 'info');

        // Send to API
        const apiUrl = document.getElementById('apiUrl').value;
        const response = await fetch(`${apiUrl}/api/order`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                iv: encrypted.iv,
                data: encrypted.data,
                tag: encrypted.tag
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const responseData = await response.json();
        
        if (responseData.success && responseData.data) {
            // Decrypt response
            showToast('🔓 Decrypting response...', 'info');
            const decrypted = await ClientEncryptionService.decrypt(
                responseData.data,
                responseData.iv,
                currentCryptoKey,
                responseData.tag
            );

            const decryptedObj = JSON.parse(decrypted);

            // Clear cart and show success
            cart = [];
            updateCartUI();
            toggleCart();
            toggleCheckout();
            
            showToast(`✓ Order placed! Order ID: ${decryptedObj.orderId}`, 'success');
            toggleEncryptionModal();

        } else {
            throw new Error(responseData.error || 'Unknown response error');
        }

    } catch (error) {
        showToast(`✗ Order failed: ${error.message}`, 'error');
        console.error('Order error:', error);
    }
}

// ============ CONNECTION & CONFIG ============

async function testConnection() {
    const apiUrl = document.getElementById('apiUrl').value;
    const masterKey = document.getElementById('masterKey').value;
    const statusDiv = document.getElementById('connectionStatus');
    
    if (!apiUrl) {
        showToast('Please enter API URL', 'error');
        return;
    }

    try {
        showToast('Testing connection...', 'info');
        
        const response = await fetch(`${apiUrl}/api/health`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        
        saveConfig();
        statusDiv.innerHTML = `✓ Connected! Version: ${data.version}`;
        statusDiv.className = 'status-success';
        showToast('✓ Connection test successful', 'success');

        // Load master key if provided
        if (masterKey) {
            await loadMasterKey(masterKey);
        }

        // Load products
        await loadProducts();

    } catch (error) {
        statusDiv.innerHTML = `✗ Connection failed: ${error.message}`;
        statusDiv.className = 'status-error';
        showToast(`✗ Connection failed: ${error.message}`, 'error');
    }
}

async function loadMasterKey(keyBase64) {
    try {
        if (!keyBase64) {
            showToast('Master key is empty', 'warning');
            return;
        }

        currentCryptoKey = await ClientEncryptionService.importKey(keyBase64);
        saveConfig();
        showToast('✓ Master key loaded successfully', 'success');
        
    } catch (error) {
        showToast(`✗ Failed to load master key: ${error.message}`, 'error');
        currentCryptoKey = null;
    }
}

// ============ UI UTILITIES ============

function toggleCart() {
    const cartPanel = document.getElementById('cartPanel');
    cartPanel.classList.toggle('hidden');
}

function toggleConfig() {
    const configPanel = document.getElementById('configPanel');
    configPanel.classList.toggle('hidden');
}

function toggleEncryptionModal() {
    const modal = document.getElementById('encryptionModal');
    modal.classList.toggle('hidden');
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast toast-${type} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
    
    console.log(`[${type}] ${message}`);
}

// Close modals when clicking outside
document.addEventListener('click', (e) => {
    const cartPanel = document.getElementById('cartPanel');
    const configPanel = document.getElementById('configPanel');
    const modal = document.getElementById('encryptionModal');

    if (cartPanel && !cartPanel.contains(e.target) && e.target.id !== 'cartBtn') {
        if (!cartPanel.classList.contains('hidden')) {
            cartPanel.classList.add('hidden');
        }
    }

    if (configPanel && !configPanel.contains(e.target) && e.target.id !== 'configBtn') {
        if (!configPanel.classList.contains('hidden')) {
            configPanel.classList.add('hidden');
        }
    }
});

// ============ GLOBAL FUNCTION EXPORTS ============
// Make all functions accessible from HTML onclick handlers
window.loadSavedConfig = loadSavedConfig;
window.saveConfig = saveConfig;
window.loadProducts = loadProducts;
window.renderProducts = renderProducts;
window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.updateQuantity = updateQuantity;
window.updateCartUI = updateCartUI;
window.updateCartSummary = updateCartSummary;
window.toggleCheckout = toggleCheckout;
window.placeOrder = placeOrder;
window.testConnection = testConnection;
window.loadMasterKey = loadMasterKey;
window.toggleCart = toggleCart;
window.toggleConfig = toggleConfig;
window.toggleEncryptionModal = toggleEncryptionModal;
window.showToast = showToast;
