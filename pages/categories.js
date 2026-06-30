const express = require('express');
const admin = require('firebase-admin');
const router = express.Router();
const db = admin.firestore();
const { authenticate } = require('../middleware/auth');

// Create a category (Admin only)
router.post('/', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    const { name, description, imageUrl } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    const docRef = await db.collection('categories').add({ 
      name, 
      description: description || '',
      imageUrl: imageUrl || '',
      createdAt: admin.firestore.FieldValue.serverTimestamp() 
    });
    res.status(201).json({ id: docRef.id });
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Error creating category: ' + err.message });
  }
});

// Get all categories
router.get('/', async (req, res) => {
  try {
    const snapshot = await db.collection('categories').get();
    const categories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching categories' });
  }
});

// Get a single category
router.get('/:id', async (req, res) => {
  try {
    const doc = await db.collection('categories').doc(req.params.id).get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'Category not found' });
    }
    res.json({ id: doc.id, ...doc.data() });
  } catch (err) {
    res.status(500).json({ error: 'Error fetching category' });
  }
});

// Update a category (Admin only)
router.put('/:id', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    const updateData = req.body;
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No data to update' });
    }
    await db.collection('categories').doc(req.params.id).update({
      ...updateData,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    res.json({ message: 'Category updated' });
  } catch (err) {
    res.status(500).json({ error: 'Error updating category' });
  }
});

// Delete a category (Admin only)
router.delete('/:id', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    await db.collection('categories').doc(req.params.id).delete();
    res.json({ message: 'Category deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Error deleting category' });
  }
});

module.exports = router;
