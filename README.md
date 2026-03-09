# Backend для мессенджера

Полнофункциональный backend для мессенджера с поддержкой real-time коммуникации через WebSocket.

## Возможности

- Регистрация и авторизация пользователей (JWT)
- Приватные и групповые чаты
- Отправка текстовых сообщений, файлов, изображений
- Real-time уведомления через WebSocket
- Статусы пользователей (online/offline)
- Индикатор "печатает..."
- Статусы прочтения сообщений
- Редактирование и удаление сообщений
- Ответы на сообщения
- Управление контактами
- Поиск пользователей
- Загрузка аватаров

## Технологии

- Node.js + Express
- PostgreSQL
- WebSocket (ws)
- JWT аутентификация
- Docker + Docker Compose

## Установка и запуск

1. Клонируйте репозиторий
2. Скопируйте `.env.example` в `.env` и настройте переменные окружения
3. Запустите Docker Compose:

```bash
docker-compose up -d
```

Backend будет доступен на `http://localhost:3000`

## API Endpoints

### Аутентификация
- `POST /api/auth/register` - Регистрация
- `POST /api/auth/login` - Вход

### Пользователи
- `GET /api/users/me` - Получить профиль
- `PUT /api/users/me` - Обновить профиль
- `GET /api/users/search?q=query` - Поиск пользователей
- `POST /api/users/contacts` - Добавить контакт
- `GET /api/users/contacts` - Получить контакты

### Чаты
- `POST /api/chats` - Создать чат
- `GET /api/chats` - Получить все чаты
- `GET /api/chats/:chatId/members` - Получить участников
- `POST /api/chats/:chatId/members` - Добавить участника
- `DELETE /api/chats/:chatId/members/me` - Покинуть чат

### Сообщения
- `POST /api/messages` - Отправить сообщение
- `GET /api/messages/chat/:chatId` - Получить сообщения чата
- `PUT /api/messages/:messageId` - Редактировать сообщение
- `DELETE /api/messages/:messageId` - Удалить сообщение
- `POST /api/messages/:messageId/read` - Отметить как прочитанное

## WebSocket

Подключение: `ws://localhost:3000?token=YOUR_JWT_TOKEN`

События:
- `user_status` - Изменение статуса пользователя
- `new_message` - Новое сообщение
- `typing` - Пользователь печатает

## База данных

Схема включает таблицы:
- `users` - Пользователи
- `chats` - Чаты
- `chat_members` - Участники чатов
- `messages` - Сообщения
- `message_reads` - Статусы прочтения
- `contacts` - Контакты

## Разработка

Для локальной разработки:

```bash
npm install
npm run dev
```

## Остановка

```bash
docker-compose down
```

Для удаления данных:

```bash
docker-compose down -v
```
