# Структура проекта

```
messenger-backend/
│
├── Frontend/                    # Frontend приложение
│   ├── index.html              # Главная страница мессенджера
│   ├── auth.html               # Страница авторизации/регистрации
│   ├── app.js                  # Основная логика приложения
│   ├── config.js               # API клиент и конфигурация
│   ├── logout.js               # Функция выхода из системы
│   └── styles.css              # Стили приложения
│
├── src/                        # Backend приложение
│   ├── middleware/             # Middleware функции
│   │   └── auth.js            # JWT аутентификация
│   │
│   ├── routes/                 # API маршруты
│   │   ├── auth.js            # Регистрация и вход
│   │   ├── users.js           # Управление пользователями
│   │   ├── chats.js           # Управление чатами
│   │   └── messages.js        # Управление сообщениями
│   │
│   ├── db.js                   # Подключение к PostgreSQL
│   └── server.js               # Главный файл сервера (Express + WebSocket)
│
├── uploads/                    # Загруженные файлы
│   ├── avatars/               # Аватары пользователей
│   └── files/                 # Файлы сообщений
│
├── .dockerignore              # Исключения для Docker
├── .env                       # Переменные окружения (создается из .env.example)
├── .env.example               # Пример переменных окружения
├── .gitignore                 # Исключения для Git
├── deploy.sh                  # Скрипт автоматического развертывания
├── docker-compose.yml         # Конфигурация Docker Compose
├── Dockerfile                 # Dockerfile для Backend
├── init.sql                   # SQL скрипт инициализации БД
├── nginx-frontend.conf        # Конфигурация Nginx
├── nginx.conf                 # Альтернативная конфигурация Nginx
├── package.json               # Зависимости Node.js
│
└── Документация/
    ├── README.md              # Главная документация
    ├── QUICKSTART.md          # Быстрый старт
    ├── DEPLOYMENT.md          # Развертывание на VDS
    ├── INTEGRATION.md         # Архитектура и интеграция
    └── PROJECT_STRUCTURE.md   # Этот файл
```

## Описание компонентов

### Frontend
Клиентская часть приложения на чистом JavaScript без фреймворков.

**Основные файлы:**
- `index.html` - Интерфейс мессенджера с чатами, сообщениями, настройками
- `auth.html` - Форма входа и регистрации
- `app.js` - Логика работы с чатами, сообщениями, WebSocket
- `config.js` - API клиент для взаимодействия с Backend
- `styles.css` - Адаптивные стили с поддержкой тем

**Возможности:**
- Регистрация и авторизация
- Список чатов
- Отправка текста, файлов, голоса, видео
- Эмодзи пикер
- Настройки (темы, шрифты, фоны)
- Real-time обновления через WebSocket

### Backend
Серверная часть на Node.js + Express + WebSocket.

**Структура:**
- `server.js` - Главный файл с Express сервером и WebSocket
- `db.js` - Подключение к PostgreSQL через pg
- `middleware/auth.js` - JWT аутентификация для HTTP и WebSocket
- `routes/` - REST API endpoints

**API маршруты:**
- `/api/auth/*` - Регистрация и вход
- `/api/users/*` - Профиль, контакты, поиск
- `/api/chats/*` - Создание и управление чатами
- `/api/messages/*` - Отправка и получение сообщений

**WebSocket:**
- Подключение с JWT токеном
- События: new_message, user_status, typing
- Автоматическое переподключение

### База данных
PostgreSQL с следующими таблицами:

**users** - Пользователи
- id, username, email, password_hash
- avatar, status, last_seen

**chats** - Чаты
- id, name, type (private/group)
- avatar, created_at

**chat_members** - Участники чатов
- id, chat_id, user_id, role
- joined_at

**messages** - Сообщения
- id, chat_id, user_id, content
- type (text/image/file/voice/video)
- file_url, reply_to, edited

**message_reads** - Статусы прочтения
- id, message_id, user_id, read_at

**contacts** - Контакты
- id, user_id, contact_id

### Docker
Три контейнера:

**postgres** - База данных
- Образ: postgres:15-alpine
- Порт: 5432
- Volume: postgres_data

**backend** - Node.js сервер
- Собирается из Dockerfile
- Порт: 3000
- Volumes: uploads, Frontend

**nginx** - Reverse proxy
- Образ: nginx:alpine
- Порт: 80
- Раздает Frontend и проксирует API

### Конфигурация

**.env** - Переменные окружения
```
PORT=3000
DB_HOST=postgres
DB_NAME=messenger
DB_USER=messenger_user
DB_PASSWORD=secure_password
JWT_SECRET=random_secret_key
```

**docker-compose.yml** - Оркестрация контейнеров
- Определяет сервисы
- Настраивает сети
- Монтирует volumes

**nginx-frontend.conf** - Nginx конфигурация
- Раздает статику Frontend
- Проксирует /api/ на Backend
- Обрабатывает WebSocket /ws

## Потоки данных

### Регистрация
```
Browser → Nginx → Backend → PostgreSQL
        ← JWT   ←         ←
```

### Отправка сообщения
```
Browser → Nginx → Backend → PostgreSQL
                    ↓
                WebSocket → All clients
```

### Загрузка файла
```
Browser → Nginx → Backend → uploads/
                    ↓
                PostgreSQL (file_url)
                    ↓
                WebSocket → All clients
```

## Масштабирование

### Горизонтальное
- Несколько инстансов Backend за Nginx
- Redis для WebSocket pub/sub
- Shared storage для uploads

### Вертикальное
- Увеличение ресурсов контейнеров
- Оптимизация запросов к БД
- Кеширование через Redis

## Безопасность

1. **Аутентификация** - JWT токены с истечением
2. **Пароли** - bcrypt хеширование
3. **SQL** - Параметризованные запросы
4. **CORS** - Ограничение доменов
5. **Валидация** - Проверка всех входных данных
6. **HTTPS** - Через Nginx + Let's Encrypt

## Мониторинг

### Логи
```bash
docker-compose logs -f backend
docker-compose logs -f nginx
docker-compose logs -f postgres
```

### Метрики
- Активные WebSocket соединения
- Время ответа API
- Использование CPU/RAM
- Размер БД и uploads

## Разработка

### Локально без Docker
1. Установите PostgreSQL
2. Создайте БД: `psql < init.sql`
3. Запустите Backend: `npm run dev`
4. Откройте Frontend: `npx http-server Frontend`

### С Docker
1. `docker-compose up -d`
2. Изменяйте код
3. `docker-compose restart backend`

### Отладка
- Backend: добавьте `console.log` в код
- Frontend: используйте DevTools браузера
- БД: `docker-compose exec postgres psql -U messenger_user messenger`
