const express = require('express');
const admin = require('firebase-admin');
const bcrypt = require('bcryptjs');
const router = express.Router();
const db = admin.firestore();
const rateLimit = require('express-rate-limit');
const { authenticate, generateToken } = require('../middleware/auth');

// Strict rate limiter for auth routes (10 requests per 15 minutes)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login/register attempts, please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Register a user
router.post('/register', authLimiter, async (req, res) => {
  try {
    const { name, surname, whatsapp, email, username, password } = req.body;
    if (!username || !password || !email) {
      return res.status(400).json({ error: 'Username, password, and email are required' });
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({ error: 'Password must be at least 6 characters and contain at least one uppercase letter, one lowercase letter, and one number.' });
    }
    
    // Quick check if username exists
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('username', '==', username).get();
    if (!snapshot.empty) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    // Quick check if email exists
    const emailSnapshot = await usersRef.where('email', '==', email).get();
    if (!emailSnapshot.empty) {
      return res.status(400).json({ error: 'Email already registered' });
    }
    
    // Quick check if whatsapp exists
    if (whatsapp) {
      const phoneSnapshot = await usersRef.where('whatsapp', '==', whatsapp).get();
      if (!phoneSnapshot.empty) {
        return res.status(400).json({ error: 'Phone number already registered' });
      }
    }

    // Hash the password securely using bcryptjs
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const docRef = await usersRef.add({ 
      name: name || '', 
      surname: surname || '', 
      whatsapp: whatsapp || '', 
      email, 
      username, 
      password: hashedPassword,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    const token = generateToken({ id: docRef.id, username, role: 'user' });
    res.status(201).json({ id: docRef.id, username, name, token });
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Error creating user: ' + err.message });
  }
});

// Login a user
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    const usersRef = db.collection('users');
    // First, find the user by username
    const snapshot = await usersRef.where('username', '==', username).get();
    
    if (snapshot.empty) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    
    const userDoc = snapshot.docs[0];
    const userData = userDoc.data();
    
    // Verify password securely using bcryptjs
    const isMatch = await bcrypt.compare(password, userData.password);
    
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    
    const token = generateToken({ id: userDoc.id, username: userData.username, role: 'user' });
    
    res.status(200).json({ 
      id: userDoc.id, 
      username: userData.username, 
      name: userData.name,
      token
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

// Update a user (Protected: User can only update themselves, or Admin)
router.put('/:id', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.id !== req.params.id) {
        return res.status(403).json({ error: 'Forbidden: You can only update your own profile' });
    }
    
    const updateData = req.body;
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No data to update' });
    }

    if (updateData.newPassword) {
        if (!updateData.currentPassword) {
            return res.status(400).json({ error: 'Current password is required to change password' });
        }
        
        const userDoc = await db.collection('users').doc(req.params.id).get();
        if (!userDoc.exists) {
            return res.status(404).json({ error: 'User not found' });
        }
        const userData = userDoc.data();
        
        const isMatch = await bcrypt.compare(updateData.currentPassword, userData.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Incorrect current password' });
        }
        
        // Validate password strength
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/;
        if (!passwordRegex.test(updateData.newPassword)) {
            return res.status(400).json({ error: 'New password must be at least 6 characters and contain at least one uppercase letter, one lowercase letter, and one number.' });
        }
        
        const salt = await bcrypt.genSalt(10);
        updateData.password = await bcrypt.hash(updateData.newPassword, salt);
        
        delete updateData.currentPassword;
        delete updateData.newPassword;
    } else {
        delete updateData.password;
    }
    
    await db.collection('users').doc(req.params.id).update(updateData);
    res.json({ message: 'User updated' });
  } catch (err) {
    res.status(500).json({ error: 'Error updating user' });
  }
});

// Delete a user (Protected)
router.delete('/:id', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.id !== req.params.id) {
        return res.status(403).json({ error: 'Forbidden: You can only delete your own profile' });
    }
    
    await db.collection('users').doc(req.params.id).delete();
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Error deleting user' });
  }
});

// GET /users/:id/views — Get aggregated views for the user's products (Protected)
router.get('/:id/views', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.id !== req.params.id) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    // 1. Get all products owned by this user
    const productsSnapshot = await db.collection('products')
      .where('sellerId', '==', req.params.id)
      .get();
    
    const productIds = productsSnapshot.docs.map(doc => doc.id);
    if (productIds.length === 0) {
      return res.json({});
    }

    // 2. Fetch all views recorded in the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const viewsSnapshot = await db.collection('product_views')
      .where('timestamp', '>=', thirtyDaysAgo)
      .get();

    // 3. Filter views that belong to the user's products and aggregate by yyyy-mm-dd
    const aggregation = {};
    viewsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (productIds.includes(data.productId)) {
        const dateStr = data.dateString; // yyyy-mm-dd
        if (dateStr) {
          aggregation[dateStr] = (aggregation[dateStr] || 0) + 1;
        }
      }
    });

    res.json(aggregation);
  } catch (err) {
    console.error('Error fetching user views:', err);
    res.status(500).json({ error: 'Error fetching views history: ' + err.message });
  }
});

module.exports = router;