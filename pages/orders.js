const express = require('express');
const admin = require('firebase-admin');
const router = express.Router();
const db = admin.firestore();

// Create an order
router.post('/', async (req, res) => {
  try {
    const { buyerId, productId, totalAmount, status } = req.body;
    if (!buyerId || !productId || !totalAmount) {
      return res.status(400).json({ error: 'BuyerId, productId, and totalAmount are required' });
    }
    const docRef = await db.collection('orders').add({ 
      buyerId, 
      productId, 
      totalAmount, 
      status: status || 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp() 
    });
    res.status(201).json({ id: docRef.id });
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Error creating order: ' + err.message });
  }
});

// Get all orders
router.get('/', async (req, res) => {
  try {
    const snapshot = await db.collection('orders').get();
    const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching orders' });
  }
});

// Get a single order
router.get('/:id', async (req, res) => {
  try {
    const doc = await db.collection('orders').doc(req.params.id).get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json({ id: doc.id, ...doc.data() });
  } catch (err) {
    res.status(500).json({ error: 'Error fetching order' });
  }
});

// Update an order
router.put('/:id', async (req, res) => {
  try {
    const updateData = req.body;
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No data to update' });
    }
    await db.collection('orders').doc(req.params.id).update({
      ...updateData,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    res.json({ message: 'Order updated' });
  } catch (err) {
    res.status(500).json({ error: 'Error updating order' });
  }
});

// Delete an order
router.delete('/:id', async (req, res) => {
  try {
    await db.collection('orders').doc(req.params.id).delete();
    res.json({ message: 'Order deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Error deleting order' });
  }
});

module.exports = router;
