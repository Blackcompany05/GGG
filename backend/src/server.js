require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const EncryptionService = require('./encryption');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize encryption service
const encryptionService = new EncryptionService(process.env.MASTER_KEY);

// ============ MIDDLEWARE ============

// Security headers
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:8080',
    'http://localhost',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:8080',
    'http://127.0.0.1',
    /^http:\/\/127\.0\.0\.1:\d+$/, // Allow any port on 127.0.0.1
    /^http:\/\/localhost:\d+$/ // Allow any port on localhost
  ],
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-App-Version']
}));

// Body parser
app.use(express.json({ limit: '10mb' }));

// Logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// ============ ROUTES ============

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.API_VERSION || '1.0.0'
  });
});

// ============ E-COMMERCE ENDPOINTS ============

// Sample product database
const products = [
  { id: 1, name: 'Laptop Dell XPS 13', price: 45000, image: '💻', category: 'Electronics' },
  { id: 2, name: 'iPhone 15 Pro', price: 35000, image: '📱', category: 'Electronics' },
  { id: 3, name: 'Wireless Headphones', price: 5000, image: '🎧', category: 'Accessories' },
  { id: 4, name: 'Smart Watch', price: 8000, image: '⌚', category: 'Wearables' },
  { id: 5, name: 'USB-C Cable', price: 500, image: '🔌', category: 'Accessories' },
  { id: 6, name: '4K Webcam', price: 3000, image: '📷', category: 'Electronics' }
];

/**
 * Get all products
 */
app.get('/api/products', (req, res) => {
  res.json({
    success: true,
    products: products,
    timestamp: new Date().toISOString()
  });
});

/**
 * Get single product by ID
 */
app.get('/api/products/:id', (req, res) => {
  const product = products.find(p => p.id === parseInt(req.params.id));
  
  if (!product) {
    return res.status(404).json({
      error: 'Product not found',
      timestamp: new Date().toISOString()
    });
  }
  
  res.json({
    success: true,
    product: product,
    timestamp: new Date().toISOString()
  });
});

/**
 * Place encrypted order
 * Payload: { items: [{id, quantity}], customerEmail, shippingAddress }
 */
app.post('/api/order', (req, res) => {
  try {
    const { iv, data, tag } = req.body;

    if (!iv || !data || !tag) {
      return res.status(400).json({
        error: 'Missing required fields: iv, data, tag',
        timestamp: new Date().toISOString()
      });
    }

    // Decrypt the order data
    const decryptedData = encryptionService.decrypt(data, iv, tag);
    
    let order;
    try {
      order = JSON.parse(decryptedData);
    } catch (e) {
      return res.status(400).json({
        error: 'Invalid JSON in decrypted payload',
        timestamp: new Date().toISOString()
      });
    }

    // Validate order structure
    if (!order.items || !Array.isArray(order.items) || order.items.length === 0) {
      return res.status(400).json({
        error: 'Invalid order: items array is required',
        timestamp: new Date().toISOString()
      });
    }

    if (!order.customerEmail || !order.shippingAddress) {
      return res.status(400).json({
        error: 'Invalid order: customerEmail and shippingAddress are required',
        timestamp: new Date().toISOString()
      });
    }

    // Calculate total
    let total = 0;
    const orderItems = order.items.map(item => {
      const product = products.find(p => p.id === item.id);
      if (!product) {
        throw new Error(`Product ${item.id} not found`);
      }
      const subtotal = product.price * item.quantity;
      total += subtotal;
      return {
        id: product.id,
        name: product.name,
        price: product.price,
        quantity: item.quantity,
        subtotal: subtotal
      };
    });

    // Create order response
    const orderId = 'ORD-' + Date.now();
    const responseData = {
      orderId: orderId,
      status: 'success',
      items: orderItems,
      total: total,
      customerEmail: order.customerEmail,
      shippingAddress: order.shippingAddress,
      estimatedDelivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      timestamp: new Date().toISOString(),
      message: 'Order placed successfully'
    };

    console.log('✓ Order received:', {
      orderId: orderId,
      itemsCount: orderItems.length,
      total: total,
      customer: order.customerEmail,
      timestamp: new Date().toISOString()
    });

    // Encrypt response
    const encryptedResponse = encryptionService.encrypt(JSON.stringify(responseData));

    res.status(200).json({
      success: true,
      iv: encryptedResponse.iv,
      data: encryptedResponse.data,
      tag: encryptedResponse.tag,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error processing order:', error);
    
    res.status(500).json({
      error: 'Order processing failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Encrypted transaction endpoint
 * Receives encrypted data and processes it
 */
app.post('/api/v1/transaction', (req, res) => {
  try {
    const { iv, data, tag } = req.body;

    // Validate inputs
    if (!iv || !data || !tag) {
      return res.status(400).json({
        error: 'Missing required fields: iv, data, tag',
        timestamp: new Date().toISOString()
      });
    }

    // Decrypt the data
    const decryptedData = encryptionService.decrypt(data, iv, tag);
    
    // Parse JSON payload
    let transaction;
    try {
      transaction = JSON.parse(decryptedData);
    } catch (e) {
      return res.status(400).json({
        error: 'Invalid JSON in decrypted payload',
        timestamp: new Date().toISOString()
      });
    }

    // Validate transaction structure
    if (!transaction.accountId || !transaction.amount || !transaction.type) {
      return res.status(400).json({
        error: 'Invalid transaction: missing accountId, amount, or type',
        timestamp: new Date().toISOString()
      });
    }

    // Log transaction (in production, save to database)
    console.log('✓ Transaction received:', {
      accountId: transaction.accountId,
      amount: transaction.amount,
      type: transaction.type,
      timestamp: new Date().toISOString()
    });

    // Process transaction and return encrypted response
    const responseData = {
      transactionId: 'TXN-' + Date.now(),
      status: 'success',
      amount: transaction.amount,
      timestamp: new Date().toISOString(),
      message: 'Transaction processed successfully'
    };

    // Encrypt response
    const encryptedResponse = encryptionService.encrypt(JSON.stringify(responseData));

    res.status(200).json({
      success: true,
      iv: encryptedResponse.iv,
      data: encryptedResponse.data,
      tag: encryptedResponse.tag,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error processing transaction:', error);
    
    res.status(500).json({
      error: 'Transaction processing failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Echo endpoint for testing encryption/decryption
 */
app.post('/api/v1/echo', (req, res) => {
  try {
    const { iv, data, tag } = req.body;

    if (!iv || !data || !tag) {
      return res.status(400).json({
        error: 'Missing required fields: iv, data, tag'
      });
    }

    // Decrypt
    const decrypted = encryptionService.decrypt(data, iv, tag);
    
    // Re-encrypt and return
    const encrypted = encryptionService.encrypt(decrypted);

    res.json({
      received: decrypted,
      iv: encrypted.iv,
      data: encrypted.data,
      tag: encrypted.tag
    });

  } catch (error) {
    res.status(400).json({
      error: 'Encryption/Decryption error',
      message: error.message
    });
  }
});

// ============ 404 HANDLER ============

app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.path,
    method: req.method
  });
});

// ============ ERROR HANDLER ============

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred'
  });
});

// ============ START SERVER ============

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║ Encrypted Transaction API Server       ║
║ Version: ${process.env.API_VERSION || '1.0.0'}                          ║
║ Running on: http://localhost:${PORT}     ║
╚════════════════════════════════════════╝

API Endpoints:
  GET  /api/health
  POST /api/v1/transaction
  POST /api/v1/echo (for testing)

Make sure MASTER_KEY is set in .env file!
  `);
});

module.exports = app;
