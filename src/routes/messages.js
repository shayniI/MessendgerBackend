const express = require('express');
const multer = require('multer');
const { authenticate } = require('../middleware/auth');
const db = require('../db');

const router = express.Router();
const upload = multer({ dest: 'uploads/files/' });

// Отправить сообщение
router.post('/', authenticate, upload.single('file'), async (req, res) => {
    try {
        const { chatId, content, type, replyTo } = req.body;
        const fileUrl = req.file ? `/uploads/files/${req.file.filename}` : null;
        
        const result = await db.query(
            'INSERT INTO messages (chat_id, user_id, content, type, file_url, reply_to) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [chatId, req.user.id, content, type || 'text', fileUrl, replyTo || null]
        );
        
        const message = result.rows[0];
        
        // Уведомляем участников чата через WebSocket
        if (req.app.locals.notifyChatMembers) {
            req.app.locals.notifyChatMembers(chatId, {
                type: 'new_message',
                message
            });
        }
        
        res.json(message);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Получить сообщения чата
router.get('/chat/:chatId', authenticate, async (req, res) => {
    try {
        const { limit = 50, offset = 0 } = req.query;
        
        const result = await db.query(
            `SELECT m.*, u.username, u.avatar,
                    (SELECT COUNT(*) FROM message_reads WHERE message_id = m.id) as read_count
             FROM messages m
             JOIN users u ON m.user_id = u.id
             WHERE m.chat_id = $1
             ORDER BY m.created_at DESC
             LIMIT $2 OFFSET $3`,
            [req.params.chatId, limit, offset]
        );
        
        res.json(result.rows.reverse());
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Редактировать сообщение
router.put('/:messageId', authenticate, async (req, res) => {
    try {
        const { content } = req.body;
        
        const result = await db.query(
            'UPDATE messages SET content = $1, edited = true WHERE id = $2 AND user_id = $3 RETURNING *',
            [content, req.params.messageId, req.user.id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Message not found' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Удалить сообщение
router.delete('/:messageId', authenticate, async (req, res) => {
    try {
        await db.query(
            'DELETE FROM messages WHERE id = $1 AND user_id = $2',
            [req.params.messageId, req.user.id]
        );
        res.json({ success: true });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Отметить как прочитанное
router.post('/:messageId/read', authenticate, async (req, res) => {
    try {
        await db.query(
            'INSERT INTO message_reads (message_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [req.params.messageId, req.user.id]
        );
        res.json({ success: true });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;
