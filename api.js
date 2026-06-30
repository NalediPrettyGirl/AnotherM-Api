const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const path = require('path');

let serviceAccount;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} else {
  serviceAccount = require('./ServiceKeyAccount.json');
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Set up Express app
const app = express();
const port = process.env.PORT || 3000;

const rateLimit = require('express-rate-limit');

// Global rate limiter (100 requests per 15 mins per IP)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 100,
  message: { error: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware to parse JSON bodies
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use(cors());

const sanitize = require('./middleware/sanitize');
const helmet = require('helmet');

app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(sanitize);

// Apply global limiter to all requests
app.use(globalLimiter);

// Serve static HTML files
app.use(express.static(path.join(__dirname, '..')));

// Serve uploaded images statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Import and mount API modules
const userApi = require('./pages/user');
const productsApi = require('./pages/products');
const categoriesApi = require('./pages/categories');
const ordersApi = require('./pages/orders');
const chatsApi = require('./pages/chats');
const checkoutApi = require('./pages/checkout');
const adminAuthApi = require('./pages/adminAuth');

app.use('/users', userApi);
app.use('/products', productsApi);
app.use('/categories', categoriesApi);
app.use('/orders', ordersApi);
app.use('/chats', chatsApi);
app.use('/checkout', checkoutApi);
app.use('/admin', adminAuthApi);

// Start the server
app.listen(port, () => {console.log(`Server running at http://localhost:${port}`)});


