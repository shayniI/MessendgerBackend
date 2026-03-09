const jwt = require('jsonwebtoken');
const db = require('../db');

const authenticate = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const result = await db.query('SELECT id, username, email FROM users WHERE id = $1', [decoded.userId]);
        
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'User not found' });
        }

        req.user = result.rows[0];
        next();
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
};

const authenticateWS = async (token) => {
    try {
        if (!token) return null;
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const result = await db.query('SELECT id, username FROM users WHERE id = $1', [decoded.userId]);
        return result.rows[0] || null;
    } catch (error) {
        return null;
    }
};

module.exports = { authenticate, authenticateWS };
