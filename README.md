# Backend для мессенджера

Полнофункциональный мессенджер с современным интерфейсом и real-time коммуникацией.

![Status](https://img.shields.io/badge/status-ready-brightgreen)
![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## 🚀 Быстрый старт

```bash
cp .env.example .env
docker-compose up -d
```

Откройте `http://localhost` в браузере.

📖 Подробнее: [QUICKSTART.md](QUICKSTART.md)

## ✨ Возможности

### Backend
- Регистрация и авторизация пользователей (JWT)
- Приватные и групповые чаты
- Отправка текстовых сообщений, файлов, изображений, голосовых и видео сообщений
- Real-time уведомления через WebSocket
- Статусы пользователей (online/offline)
- Индикатор "печатает..."
- Статусы прочтения сообщений
- Редактирование и удаление сообщений
- Ответы на сообщения
- Управление контактами
- Поиск пользователей
- Загрузка аватаров

### Frontend
- Современный адаптивный интерфейс
- Темная/светлая/цветные темы оформления
- Настройка размера шрифта
- Выбор фона чата
- Эмодзи пикер
- Запись голосовых сообщений
- Запись видео кружков
- Прикрепление файлов и изображений
- Настройки уведомлений
- Управление конфиденциальностью
- Полная интеграция с backend через REST API и WebSocket

## 📚 Документация

- [QUICKSTART.md](QUICKSTART.md) - Быстрый старт за 3 минуты
- [FEATURES.md](FEATURES.md) - Полный список функций и инструкции
- [REALTIME_TEST.md](REALTIME_TEST.md) - Тестирование real-time функций
- [MEDIA_TEST.md](MEDIA_TEST.md) - Тестирование голоса и видео
- [DEPLOYMENT.md](DEPLOYMENT.md) - Развертывание на VDS
- [INTEGRATION.md](INTEGRATION.md) - Архитектура и интеграция
- [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) - Структура проекта
- [API_EXAMPLES.md](API_EXAMPLES.md) - Примеры использования API
- [README.md](README.md) - Полная документация (этот файл)

## 🛠 Технологии

### Backend
- Node.js + Express
- PostgreSQL
- WebSocket (ws)
- JWT аутентификация
- Multer (загрузка файлов)
- bcrypt (хеширование паролей)

### Frontend
- Vanilla JavaScript (без фреймворков)
- HTML5 + CSS3
- WebSocket API
- MediaRecorder API (голос/видео)
- LocalStorage (настройки)

### Infrastructure
- Docker + Docker Compose
- Nginx (reverse proxy + статика)
- Multi-container architecture

## Установка и запуск

1. Клонируйте репозиторий
2. Скопируйте `.env.example` в `.env` и настройте переменные окружения:

```bash
cp .env.example .env
# Отредактируйте .env и установите надежные пароли
```

3. Запустите Docker Compose:

```bash
docker-compose up -d
```

Приложение будет доступно на:
- Frontend: `http://localhost`
- Backend API: `http://localhost/api`
- WebSocket: `ws://localhost/ws`

## Первый запуск

1. Откройте браузер и перейдите на `http://localhost`
2. Нажмите "Зарегистрироваться"
3. Заполните форму регистрации
4. После входа вы попадете в мессенджер
5. Нажмите "+" чтобы создать новый чат
6. Введите email другого пользователя для поиска

## API Endpoints

### Аутентификация
- `POST /api/auth/register` - Регистрация (username, email, password)
- `POST /api/auth/login` - Вход (email, password)

### Пользователи (требуется авторизация)
- `GET /api/users/me` - Получить профиль
- `PUT /api/users/me` - Обновить профиль (username, avatar)
- `GET /api/users/search?q=query` - Поиск пользователей
- `POST /api/users/contacts` - Добавить контакт (contactId)
- `GET /api/users/contacts` - Получить контакты

### Чаты (требуется авторизация)
- `POST /api/chats` - Создать чат (name, type, memberIds)
- `GET /api/chats` - Получить все чаты
- `GET /api/chats/:chatId/members` - Получить участников
- `POST /api/chats/:chatId/members` - Добавить участника (userId)
- `DELETE /api/chats/:chatId/members/me` - Покинуть чат

### Сообщения (требуется авторизация)
- `POST /api/messages` - Отправить сообщение (chatId, content, type, file, replyTo)
- `GET /api/messages/chat/:chatId` - Получить сообщения чата (limit, offset)
- `PUT /api/messages/:messageId` - Редактировать сообщение (content)
- `DELETE /api/messages/:messageId` - Удалить сообщение
- `POST /api/messages/:messageId/read` - Отметить как прочитанное

## WebSocket

Подключение: `ws://localhost/ws?token=YOUR_JWT_TOKEN`

События от клиента:
```json
{
  "type": "typing",
  "chatId": 1
}
```

События от сервера:
```json
{
  "type": "new_message",
  "message": { ... }
}

{
  "type": "user_status",
  "userId": 1,
  "status": "online"
}

{
  "type": "typing",
  "userId": 1,
  "chatId": 1
}
```

## База данных

Схема включает таблицы:
- `users` - Пользователи
- `chats` - Чаты
- `chat_members` - Участники чатов
- `messages` - Сообщения
- `message_reads` - Статусы прочтения
- `contacts` - Контакты

## Разработка

Для локальной разработки без Docker:

1. Установите зависимости:
```bash
npm install
```

2. Запустите PostgreSQL локально или через Docker:
```bash
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=password postgres:15
```

3. Создайте базу данных и таблицы:
```bash
psql -h localhost -U postgres < init.sql
```

4. Запустите Backend:
```bash
npm run dev
```

5. Откройте Frontend в браузере:
```bash
# Используйте любой локальный сервер, например:
npx http-server Frontend -p 8080
```

6. Обновите `Frontend/config.js` для локальной разработки:
```javascript
const API_CONFIG = {
    BASE_URL: 'http://localhost:3000',
    API_URL: 'http://localhost:3000/api',
    WS_URL: 'ws://localhost:3000'
};
```

## 📄 Лицензия

MIT License - см. [LICENSE](LICENSE) для деталей

---

Создано с ❤️ для изучения и разработки
