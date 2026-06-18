const express = require('express');
const admin = require('firebase-admin');
const router = express.Router();
const db = admin.firestore();

// Register a user
router.post('/register', async (req, res) => {
  try {
    const { name, surname, whatsapp, email, username, password } = req.body;
    if (!username || !password || !email) {
      return res.status(400).json({ error: 'Username, password, and email are required' });
    }
    
    // Quick check if username exists
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('username', '==', username).get();
    if (!snapshot.empty) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    const docRef = await usersRef.add({ 
      name: name || '', 
      surname: surname || '', 
      whatsapp: whatsapp || '', 
      email, 
      username, 
      password, // Note: In production use bcrypt, storing plain text for simple demo
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    res.status(201).json({ id: docRef.id, username, name });
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Error creating user: ' + err.message });
  }
});

// Login a user
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('username', '==', username).where('password', '==', password).get();
    
    if (snapshot.empty) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    
    const userDoc = snapshot.docs[0];
    const userData = userDoc.data();
    
    res.status(200).json({ 
      id: userDoc.id, 
      username: userData.username, 
      name: userData.name 
    });
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Error logging in: ' + err.message });
  }
});

// Get all users
router.get('/', async (req, res) => {
  try {
    const snapshot = await db.collection('users').get();
    const users = snapshot.docs.map(doc => {
      const data = doc.data();
      delete data.password; // Don't expose password
      return { id: doc.id, ...data };
    });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching users' });
  }
});

// Get a single user
router.get('/:id', async (req, res) => {
  try {
    const doc = await db.collection('users').doc(req.params.id).get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }
    const data = doc.data();
    delete data.password;
    res.json({ id: doc.id, ...data });
  } catch (err) {
    res.status(500).json({ error: 'Error fetching user' });
  }
});

// Update a user
router.put('/:id', async (req, res) => {
  try {
    const updateData = req.body;
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No data to update' });
    }
    await db.collection('users').doc(req.params.id).update(updateData);
    res.json({ message: 'User updated' });
  } catch (err) {
    res.status(500).json({ error: 'Error updating user' });
  }
});

// Delete a user
router.delete('/:id', async (req, res) => {
  try {
    await db.collection('users').doc(req.params.id).delete();
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Error deleting user' });
  }
});

module.exports = router;