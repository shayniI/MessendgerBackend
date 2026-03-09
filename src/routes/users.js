const express = require('express');
const multer = require('multer');
const { authenticate } = require('../middleware/auth');
const db = require('../db');

const router = express.Router();
const upload = multer({ dest: 'uploads/avatars/' });

// Получить профиль
router.get('/me', authenticate, async (req, res) => {
    try {
        const result = await db.query(
            'SELECT id, username, email, avatar, status, last_seen FROM users WHERE id = $1',
            [req.user.id]
        );
        res.json(result.rows[0]);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Обновить профиль
router.put('/me', authenticate, upload.single('avatar'), async (req, res) => {
    try {
        const { username } = req.body;
        const avatar = req.file ? `/uploads/avatars/${req.file.filename}` : null;
        
        const updates = [];
        const values = [];
        let paramCount = 1;

        if (username) {
            updates.push(`username = $${paramCount++}`);
            values.push(username);
        }
        if (avatar) {
            updates.push(`avatar = $${paramCount++}`);
            values.push(avatar);
        }

        values.push(req.user.id);
        
        const result = await db.query(
            `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING id, username, email, avatar`,
            values
        );
        
        res.json(result.rows[0]);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Поиск пользователей
router.get('/search', authenticate, async (req, res) => {
    try {
        const { q } = req.query;
        const result = await db.query(
            'SELECT id, username, email, avatar, status FROM users WHERE username ILIKE $1 OR email ILIKE $1 LIMIT 20',
            [`%${q}%`]
        );
        res.json(result.rows);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Добавить контакт
router.post('/contacts', authenticate, async (req, res) => {
    try {
        const { contactId } = req.body;
        await db.query(
            'INSERT INTO contacts (user_id, contact_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [req.user.id, contactId]
        );
        res.json({ success: true });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Получить контакты
router.get('/contacts', authenticate, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT u.id, u.username, u.email, u.avatar, u.status, u.last_seen 
             FROM contacts c 
             JOIN users u ON c.contact_id = u.id 
             WHERE c.user_id = $1`,
            [req.user.id]
        );
        res.json(result.rows);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;
