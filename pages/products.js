const express = require('express');
const admin = require('firebase-admin');
const router = express.Router();
const db = admin.firestore();

// Create a product
router.post('/', async (req, res) => {
  try {
    const data = req.body;
    if (!data.title || !data.price || !data.category) {
      return res.status(400).json({ error: 'Title, price, and category are required' });
    }
    
    const docData = {
      ...data,
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

// Update a product
router.put('/:id', async (req, res) => {
  try {
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

// Delete a product
router.delete('/:id', async (req, res) => {
  try {
    await db.collection('products').doc(req.params.id).delete();
    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Error deleting product' });
  }
});

module.exports = router;
