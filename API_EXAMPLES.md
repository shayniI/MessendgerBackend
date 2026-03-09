# Примеры использования API

## Аутентификация

### Регистрация
```bash
curl -X POST http://localhost/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "john_doe",
    "email": "john@example.com",
    "password": "securePassword123"
  }'
```

Ответ:
```json
{
  "user": {
    "id": 1,
    "username": "john_doe",
    "email": "john@example.com"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Вход
```bash
curl -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "securePassword123"
  }'
```

## Пользователи

### Получить свой профиль
```bash
curl http://localhost/api/users/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Ответ:
```json
{
  "id": 1,
  "username": "john_doe",
  "email": "john@example.com",
  "avatar": null,
  "status": "online",
  "last_seen": "2024-01-15T10:30:00.000Z"
}
```

### Обновить профиль
```bash
curl -X PUT http://localhost/api/users/me \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "john_updated"
  }'
```

### Поиск пользователей
```bash
curl "http://localhost/api/users/search?q=jane" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Ответ:
```json
[
  {
    "id": 2,
    "username": "jane_smith",
    "email": "jane@example.com",
    "avatar": null,
    "status": "offline"
  }
]
```

### Добавить контакт
```bash
curl -X POST http://localhost/api/users/contacts \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "contactId": 2
  }'
```

### Получить контакты
```bash
curl http://localhost/api/users/contacts \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Чаты

### Создать приватный чат
```bash
curl -X POST http://localhost/api/chats \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Chat with Jane",
    "type": "private",
    "memberIds": [2]
  }'
```

Ответ:
```json
{
  "id": 1,
  "name": "Chat with Jane",
  "type": "private",
  "avatar": null,
  "created_at": "2024-01-15T10:30:00.000Z"
}
```

### Создать групповой чат
```bash
curl -X POST http://localhost/api/chats \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Team Chat",
    "type": "group",
    "memberIds": [2, 3, 4]
  }'
```

### Получить все чаты
```bash
curl http://localhost/api/chats \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Ответ:
```json
[
  {
    "id": 1,
    "name": "Chat with Jane",
    "type": "private",
    "member_count": 2,
    "last_message": "Hello!",
    "created_at": "2024-01-15T10:30:00.000Z"
  }
]
```

### Получить участников чата
```bash
curl http://localhost/api/chats/1/members \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Добавить участника в чат
```bash
curl -X POST http://localhost/api/chats/1/members \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 5
  }'
```

### Покинуть чат
```bash
curl -X DELETE http://localhost/api/chats/1/members/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Сообщения

### Отправить текстовое сообщение
```bash
curl -X POST http://localhost/api/messages \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "chatId": 1,
    "content": "Hello, how are you?",
    "type": "text"
  }'
```

Ответ:
```json
{
  "id": 1,
  "chat_id": 1,
  "user_id": 1,
  "content": "Hello, how are you?",
  "type": "text",
  "file_url": null,
  "reply_to": null,
  "edited": false,
  "created_at": "2024-01-15T10:30:00.000Z"
}
```

### Отправить файл
```bash
curl -X POST http://localhost/api/messages \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "chatId=1" \
  -F "type=image" \
  -F "content=Photo from vacation" \
  -F "file=@/path/to/image.jpg"
```

### Получить сообщения чата
```bash
curl "http://localhost/api/messages/chat/1?limit=50&offset=0" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Ответ:
```json
[
  {
    "id": 1,
    "chat_id": 1,
    "user_id": 1,
    "username": "john_doe",
    "avatar": null,
    "content": "Hello!",
    "type": "text",
    "file_url": null,
    "reply_to": null,
    "edited": false,
    "read_count": 1,
    "created_at": "2024-01-15T10:30:00.000Z"
  }
]
```

### Редактировать сообщение
```bash
curl -X PUT http://localhost/api/messages/1 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Hello, how are you doing?"
  }'
```

### Удалить сообщение
```bash
curl -X DELETE http://localhost/api/messages/1 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Отметить сообщение как прочитанное
```bash
curl -X POST http://localhost/api/messages/1/read \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## WebSocket

### Подключение (JavaScript)
```javascript
const token = localStorage.getItem('auth_token');
const ws = new WebSocket(`ws://localhost/ws?token=${token}`);

ws.onopen = () => {
  console.log('Connected to WebSocket');
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
  
  switch (data.type) {
    case 'new_message':
      handleNewMessage(data.message);
      break;
    case 'user_status':
      handleUserStatus(data.userId, data.status);
      break;
    case 'typing':
      handleTyping(data.userId, data.chatId);
      break;
  }
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

ws.onclose = () => {
  console.log('Disconnected from WebSocket');
  // Переподключение через 3 секунды
  setTimeout(connectWebSocket, 3000);
};
```

### Отправка события "печатает"
```javascript
ws.send(JSON.stringify({
  type: 'typing',
  chatId: 1
}));
```

### Отправка события "прочитано"
```javascript
ws.send(JSON.stringify({
  type: 'read',
  messageId: 123
}));
```

## Примеры ошибок

### 401 Unauthorized
```json
{
  "error": "No token provided"
}
```

### 400 Bad Request
```json
{
  "error": "Invalid email or password"
}
```

### 404 Not Found
```json
{
  "error": "Message not found"
}
```

## Полный пример: Создание чата и отправка сообщения

```bash
#!/bin/bash

# 1. Регистрация
RESPONSE=$(curl -s -X POST http://localhost/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "test_user",
    "email": "test@example.com",
    "password": "password123"
  }')

TOKEN=$(echo $RESPONSE | jq -r '.token')
echo "Token: $TOKEN"

# 2. Поиск пользователя
curl -s "http://localhost/api/users/search?q=jane" \
  -H "Authorization: Bearer $TOKEN" | jq

# 3. Создание чата
CHAT_RESPONSE=$(curl -s -X POST http://localhost/api/chats \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Chat",
    "type": "private",
    "memberIds": [2]
  }')

CHAT_ID=$(echo $CHAT_RESPONSE | jq -r '.id')
echo "Chat ID: $CHAT_ID"

# 4. Отправка сообщения
curl -s -X POST http://localhost/api/messages \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"chatId\": $CHAT_ID,
    \"content\": \"Hello from API!\",
    \"type\": \"text\"
  }" | jq

# 5. Получение сообщений
curl -s "http://localhost/api/messages/chat/$CHAT_ID" \
  -H "Authorization: Bearer $TOKEN" | jq
```

## Тестирование с Postman

1. Импортируйте коллекцию:
   - Создайте новую коллекцию "Messenger API"
   - Добавьте переменную `baseUrl` = `http://localhost/api`
   - Добавьте переменную `token` для хранения JWT

2. Настройте авторизацию:
   - Type: Bearer Token
   - Token: `{{token}}`

3. Создайте запросы из примеров выше

4. Используйте Tests для автоматического сохранения токена:
```javascript
if (pm.response.code === 200) {
  const response = pm.response.json();
  pm.environment.set("token", response.token);
}
```
