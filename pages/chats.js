const express = require('express');
const admin = require('firebase-admin');
const router = express.Router();
const db = admin.firestore();

// Create or update a chat thread
router.post('/', async (req, res) => {
  try {
    const { id, productId, productTitle, productImage, sellerId, buyerName, buyerEmail, buyerPhone, messages } = req.body;
    
    if (!id || !productId) {
      return res.status(400).json({ error: 'Chat id and productId are required' });
    }
    
    const docRef = db.collection('chats').doc(id);
    await docRef.set({
      id,
      productId,
      productTitle: productTitle || '',
      productImage: productImage || '',
      sellerId: sellerId || '',
      buyerName: buyerName || '',
      buyerEmail: buyerEmail || '',
      buyerPhone: buyerPhone || '',
      messages: messages || [],
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Error saving chat: ' + err.message });
  }
});

// Get all chats
router.get('/', async (req, res) => {
  try {
    const snapshot = await db.collection('chats').get();
    const chats = snapshot.docs.map(doc => doc.data());
    res.json(chats);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching chats' });
  }
});

// Get a single chat thread
router.get('/:id', async (req, res) => {
  try {
    const doc = await db.collection('chats').doc(req.params.id).get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'Chat not found' });
    }
    res.json(doc.data());
  } catch (err) {
    res.status(500).json({ error: 'Error fetching chat thread' });
  }
});

module.exports = router;
