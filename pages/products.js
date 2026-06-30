const express = require('express');
const admin = require('firebase-admin');
const multer = require('multer');
const path = require('path');
const { authenticate } = require('../middleware/auth');
const router = express.Router();
const db = admin.firestore();

// Configure multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '..', 'uploads'));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter for images
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, and WEBP images are allowed'), false);
  }
};

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 3 * 1024 * 1024 }, // 3MB limit per file
  fileFilter: fileFilter
});

const uploadFields = upload.fields([
  { name: 'main_images', maxCount: 4 },
  { name: 'extra_images', maxCount: 4 }
]);
// Upload product images (Protected)
router.post('/upload', authenticate, uploadFields, (req, res) => {
  try {
    const main_images = [];
    if (req.files && req.files['main_images']) {
      req.files['main_images'].forEach(file => {
        main_images.push(`/uploads/${file.filename}`);
      });
    }
    
    const extra_images = [];
    if (req.files && req.files['extra_images']) {
      req.files['extra_images'].forEach(file => {
        extra_images.push(`/uploads/${file.filename}`);
      });
    }

    res.status(200).json({ main_images, extra_images });
  } catch (err) {
    console.error('Upload error:', err);
    if (err instanceof multer.MulterError || err.message.includes('Only JPEG')) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Error uploading files' });
  }
});

// Create a product (Protected)
router.post('/', authenticate, async (req, res) => {
  try {
    const data = req.body;
    if (!data.title || !data.price || !data.category) {
      return res.status(400).json({ error: 'Title, price, and category are required' });
    }
    
    if (data.title.trim().length < 3) {
      return res.status(400).json({ error: 'Title must be at least 3 characters long' });
    }
    
    const priceNum = Number(data.price);
    if (isNaN(priceNum) || priceNum <= 0) {
      return res.status(400).json({ error: 'Price must be a valid number greater than 0' });
    }
    
    const docData = {
      ...data,
      imageUrl: (data.main_images && data.main_images.length > 0) ? data.main_images[0] : (data.imageUrl || ''),
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    const docRef = await db.collection('products').add(docData);
    res.status(201).json({ id: docRef.id });
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Error creating product: ' + err.message });
  }
});

// Get all products
router.get('/', async (req, res) => {
  try {
    const snapshot = await db.collection('products').get();
    const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching products' });
  }
});

// Get a single product
router.get('/:id', async (req, res) => {
  try {
    const doc = await db.collection('products').doc(req.params.id).get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json({ id: doc.id, ...doc.data() });
  } catch (err) {
    res.status(500).json({ error: 'Error fetching product' });
  }
});

// Update a product (Protected: Admin or Owner)
router.put('/:id', authenticate, async (req, res) => {
  try {
    const doc = await db.collection('products').doc(req.params.id).get();
    if (!doc.exists) {
        return res.status(404).json({ error: 'Product not found' });
    }
    
    if (req.user.role !== 'admin' && doc.data().sellerId !== req.user.id) {
        return res.status(403).json({ error: 'Forbidden: You can only update your own products' });
    }

    const updateData = req.body;
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No data to update' });
    }
    await db.collection('products').doc(req.params.id).update({
      ...updateData,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    res.json({ message: 'Product updated' });
  } catch (err) {
    res.status(500).json({ error: 'Error updating product' });
  }
});

// Delete a product (Protected: Admin or Owner)
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const doc = await db.collection('products').doc(req.params.id).get();
    if (!doc.exists) {
        return res.status(404).json({ error: 'Product not found' });
    }

    if (req.user.role !== 'admin' && doc.data().sellerId !== req.user.id) {
        return res.status(403).json({ error: 'Forbidden: You can only delete your own products' });
    }

    await db.collection('products').doc(req.params.id).delete();
    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Error deleting product' });
  }
});

// POST /products/:id/view — Log a product view event (Public)
router.post('/:id/view', async (req, res) => {
  try {
    const productId = req.params.id;
    const now = new Date();
    
    // Add record to views history
    await db.collection('product_views').add({
      productId,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      dateString: now.toISOString().split('T')[0] // yyyy-mm-dd
    });
    
    res.json({ success: true });
  } catch (err) {
    console.error('Error logging view:', err);
    res.status(500).json({ error: 'Failed to log view' });
  }
});

module.exports = router;
