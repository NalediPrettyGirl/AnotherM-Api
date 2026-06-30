const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'e72d2cac68efaafd99d229857b4607cb63db5b978960f91cd3fc4ee2513e3adb';

const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    const token = authHeader.split(' ')[1];
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; // Contains id, username, and role
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
    }
};

const generateToken = (payload) => {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
};

module.exports = { authenticate, generateToken, JWT_SECRET };
