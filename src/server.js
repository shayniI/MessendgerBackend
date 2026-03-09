require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const db = require('./db');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const chatRoutes = require('./routes/chats');
const messageRoutes = require('./routes/messages');
const { authenticateWS } = require('./middleware/auth');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/messages', messageRoutes);

// WebSocket connections
const clients = new Map();

wss.on('connection', async (ws, req) => {
    const token = new URL(req.url, 'http://localhost').searchParams.get('token');
    const user = await authenticateWS(token);
    
    if (!user) {
        console.log('[WebSocket] Unauthorized connection attempt');
        ws.close(1008, 'Unauthorized');
        return;
    }

    console.log(`[WebSocket] User ${user.id} (${user.username}) connected`);
    clients.set(user.id, ws);
    
    // Обновляем статус пользователя
    await db.query('UPDATE users SET status = $1, last_seen = NOW() WHERE id = $2', ['online', user.id]);
    
    // Уведомляем всех о статусе
    broadcast({ type: 'user_status', userId: user.id, status: 'online' });

    ws.on('message', async (data) => {
        try {
            const message = JSON.parse(data);
            await handleWebSocketMessage(user.id, message);
        } catch (error) {
            console.error('[WebSocket] Error handling message:', error);
        }
    });

    ws.on('close', async () => {
        console.log(`[WebSocket] User ${user.id} (${user.username}) disconnected`);
        clients.delete(user.id);
        await db.query('UPDATE users SET status = $1, last_seen = NOW() WHERE id = $2', ['offline', user.id]);
        broadcast({ type: 'user_status', userId: user.id, status: 'offline' });
    });
    
    ws.on('error', (error) => {
        console.error(`[WebSocket] Error for user ${user.id}:`, error);
    });
});

async function handleWebSocketMessage(userId, message) {
    switch (message.type) {
        case 'typing':
            notifyChatMembers(message.chatId, { type: 'typing', userId, chatId: message.chatId });
            break;
        case 'read':
            await markAsRead(userId, message.messageId);
            break;
    }
}

function broadcast(data) {
    clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}

async function notifyChatMembers(chatId, data) {
    try {
        const result = await db.query('SELECT user_id FROM chat_members WHERE chat_id = $1', [chatId]);
        
        console.log(`[WebSocket] Notifying ${result.rows.length} members of chat ${chatId} about ${data.type}`);
        
        let sentCount = 0;
        result.rows.forEach(row => {
            const client = clients.get(row.user_id);
            if (client && client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(data));
                sentCount++;
            }
        });
        
        console.log(`[WebSocket] Successfully sent to ${sentCount}/${result.rows.length} members`);
    } catch (error) {
        console.error('[WebSocket] Error notifying chat members:', error);
    }
}

async function markAsRead(userId, messageId) {
    await db.query(
        'INSERT INTO message_reads (message_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [messageId, userId]
    );
}

// Экспорт для использования в других модулях
app.locals.notifyChatMembers = notifyChatMembers;

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════╗
║   Messenger Backend Server Started    ║
╠═══════════════════════════════════════╣
║  HTTP Server: http://localhost:${PORT}   ║
║  WebSocket:   ws://localhost:${PORT}     ║
╚═══════════════════════════════════════╝
    `);
});
