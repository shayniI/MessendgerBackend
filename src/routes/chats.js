const express = require('express');
const { authenticate } = require('../middleware/auth');
const db = require('../db');

const router = express.Router();

// Создать чат
router.post('/', authenticate, async (req, res) => {
    try {
        const { name, type, memberIds } = req.body;
        
        const chatResult = await db.query(
            'INSERT INTO chats (name, type) VALUES ($1, $2) RETURNING *',
            [name, type]
        );
        
        const chatId = chatResult.rows[0].id;
        
        // Добавляем создателя как админа
        await db.query(
            'INSERT INTO chat_members (chat_id, user_id, role) VALUES ($1, $2, $3)',
            [chatId, req.user.id, 'admin']
        );
        
        // Добавляем остальных участников
        if (memberIds && memberIds.length > 0) {
            for (const memberId of memberIds) {
                await db.query(
                    'INSERT INTO chat_members (chat_id, user_id) VALUES ($1, $2)',
                    [chatId, memberId]
                );
            }
        }
        
        res.json(chatResult.rows[0]);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Получить все чаты пользователя
router.get('/', authenticate, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT c.*, 
                    (SELECT COUNT(*) FROM chat_members WHERE chat_id = c.id) as member_count,
                    (SELECT content FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message
             FROM chats c
             JOIN chat_members cm ON c.id = cm.chat_id
             WHERE cm.user_id = $1
             ORDER BY c.created_at DESC`,
            [req.user.id]
        );
        res.json(result.rows);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Получить участников чата
router.get('/:chatId/members', authenticate, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT u.id, u.username, u.email, u.avatar, u.status, cm.role
             FROM chat_members cm
             JOIN users u ON cm.user_id = u.id
             WHERE cm.chat_id = $1`,
            [req.params.chatId]
        );
        res.json(result.rows);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Добавить участника
router.post('/:chatId/members', authenticate, async (req, res) => {
    try {
        const { userId } = req.body;
        await db.query(
            'INSERT INTO chat_members (chat_id, user_id) VALUES ($1, $2)',
            [req.params.chatId, userId]
        );
        res.json({ success: true });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Покинуть чат
router.delete('/:chatId/members/me', authenticate, async (req, res) => {
    try {
        await db.query(
            'DELETE FROM chat_members WHERE chat_id = $1 AND user_id = $2',
            [req.params.chatId, req.user.id]
        );
        res.json({ success: true });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;
