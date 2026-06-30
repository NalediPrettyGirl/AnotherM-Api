const express = require('express');
const admin = require('firebase-admin');
const bcrypt = require('bcryptjs');
const { generateToken } = require('../middleware/auth');
const router = express.Router();
const db = admin.firestore();

// POST /admin/login — verify admin credentials from Firestore
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const snapshot = await db.collection('admins')
      .where('username', '==', username)
      .get();

    if (snapshot.empty) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const adminDoc = snapshot.docs[0];
    const adminData = adminDoc.data();

    const isMatch = await bcrypt.compare(password, adminData.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Update last login timestamp
    await adminDoc.ref.update({ lastLogin: admin.firestore.FieldValue.serverTimestamp() });

    const token = generateToken({ id: adminDoc.id, username: adminData.username, role: 'admin' });

    res.status(200).json({
      success: true,
      id: adminDoc.id,
      username: adminData.username,
      displayName: adminData.displayName || adminData.username,
      token
    });
  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).json({ error: 'Login failed: ' + err.message });
  }
});

// POST /admin/setup — create the very first admin account (only works if no admins exist)
router.post('/setup', async (req, res) => {
  try {
    const { username, password, displayName, setupKey } = req.body;

    // Require a setup key to prevent abuse
    const validSetupKey = process.env.ADMIN_SETUP_KEY || 'setup-anothermoment-2024';
    if (setupKey !== validSetupKey) {
      return res.status(403).json({ error: 'Invalid setup key' });
    }

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({ error: 'Password must be at least 6 characters and contain at least one uppercase letter, one lowercase letter, and one number.' });
    }

    // Only allow setup if no admins exist yet
    const existing = await db.collection('admins').get();
    if (!existing.empty) {
      return res.status(409).json({ error: 'Admin account already exists. Use the login endpoint.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const docRef = await db.collection('admins').add({
      username,
      password: hashedPassword,
      displayName: displayName || username,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastLogin: null
    });

    const token = generateToken({ id: docRef.id, username, role: 'admin' });

    res.status(201).json({ success: true, id: docRef.id, message: 'Admin account created successfully.', token });
  } catch (err) {
    console.error('Admin setup error:', err);
    res.status(500).json({ error: 'Setup failed: ' + err.message });
  }
});

// POST /admin/change-password — update admin password
router.post('/change-password', async (req, res) => {
  try {
    const { username, currentPassword, newPassword } = req.body;
    if (!username || !currentPassword || !newPassword) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({ error: 'New password must be at least 6 characters and contain at least one uppercase letter, one lowercase letter, and one number.' });
    }

    const snapshot = await db.collection('admins')
      .where('username', '==', username)
      .get();

    if (snapshot.empty) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    const adminDoc = snapshot.docs[0];
    const isMatch = await bcrypt.compare(currentPassword, adminDoc.data().password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedNewPassword = await bcrypt.hash(newPassword, salt);

    await adminDoc.ref.update({
      password: hashedNewPassword,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(200).json({ success: true, message: 'Password updated successfully.' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Failed to change password: ' + err.message });
  }
});

module.exports = router;
