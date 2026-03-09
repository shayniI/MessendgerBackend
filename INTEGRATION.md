# Интеграция Frontend и Backend

## Архитектура

```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │
       │ HTTP/WS
       ▼
┌─────────────┐
│    Nginx    │ :80
│  (Reverse   │
│   Proxy)    │
└──────┬──────┘
       │
       ├─────────────┐
       │             │
       ▼             ▼
┌─────────────┐ ┌─────────────┐
│  Frontend   │ │   Backend   │ :3000
│   (Static)  │ │  (Node.js)  │
└─────────────┘ └──────┬──────┘
                       │
                       ▼
                ┌─────────────┐
                │ PostgreSQL  │ :5432
                └─────────────┘
```

## Компоненты

### 1. Nginx (Reverse Proxy)
- Раздает статические файлы Frontend
- Проксирует API запросы на Backend
- Обрабатывает WebSocket соединения
- Раздает загруженные файлы

### 2. Frontend (Vanilla JS)
- `index.html` - Главная страница мессенджера
- `auth.html` - Страница авторизации/регистрации
- `app.js` - Основная логика приложения
- `config.js` - API клиент и конфигурация
- `logout.js` - Функция выхода
- `styles.css` - Стили приложения

### 3. Backend (Node.js + Express)
- REST API для всех операций
- WebSocket сервер для real-time
- Аутентификация через JWT
- Загрузка файлов через Multer
- Работа с PostgreSQL

### 4. PostgreSQL
- Хранение пользователей
- Хранение чатов и сообщений
- Связи между сущностями

## Поток данных

### Регистрация/Вход
1. Пользователь заполняет форму на `auth.html`
2. Frontend отправляет POST на `/api/auth/register` или `/api/auth/login`
3. Backend проверяет данные, создает JWT токен
4. Frontend сохраняет токен в LocalStorage
5. Редирект на `index.html`

### Загрузка чатов
1. Frontend отправляет GET `/api/chats` с JWT токеном
2. Backend возвращает список чатов пользователя
3. Frontend отображает список в боковой панели

### Отправка сообщения
1. Пользователь вводит текст и нажимает "Отправить"
2. Frontend отправляет POST `/api/messages` с данными
3. Backend сохраняет сообщение в БД
4. Backend отправляет уведомление через WebSocket всем участникам чата
5. Frontend получает сообщение через WebSocket и отображает его

### WebSocket соединение
1. После авторизации Frontend подключается к `ws://localhost/ws?token=JWT`
2. Backend проверяет токен и устанавливает соединение
3. Backend обновляет статус пользователя на "online"
4. При получении нового сообщения Backend отправляет его через WebSocket
5. При закрытии соединения статус меняется на "offline"

## Конфигурация

### Frontend (config.js)
```javascript
const API_CONFIG = {
    BASE_URL: window.location.origin,
    API_URL: `${window.location.origin}/api`,
    WS_URL: `ws://${window.location.host}/ws`
};
```

### Nginx (nginx-frontend.conf)
```nginx
location /api/ {
    proxy_pass http://backend:3000/api/;
}

location /ws {
    proxy_pass http://backend:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "Upgrade";
}
```

### Docker Compose
```yaml
nginx:
  volumes:
    - ./Frontend:/usr/share/nginx/html
    - ./nginx-frontend.conf:/etc/nginx/conf.d/default.conf

backend:
  volumes:
    - ./Frontend:/app/Frontend
    - ./uploads:/app/uploads
```

## Безопасность

1. **JWT токены** - Все API запросы требуют валидный токен
2. **CORS** - Backend настроен на прием запросов только с разрешенных доменов
3. **Хеширование паролей** - Используется bcrypt с солью
4. **Валидация данных** - Все входные данные проверяются на сервере
5. **Защита от SQL инъекций** - Используются параметризованные запросы

## Масштабирование

### Горизонтальное
- Можно запустить несколько инстансов Backend
- Nginx будет балансировать нагрузку
- WebSocket требует sticky sessions или Redis pub/sub

### Вертикальное
- Увеличение ресурсов контейнеров
- Оптимизация запросов к БД
- Кеширование через Redis

## Мониторинг

### Логи
```bash
# Backend логи
docker-compose logs -f backend

# Nginx логи
docker-compose logs -f nginx

# PostgreSQL логи
docker-compose logs -f postgres
```

### Метрики
- Количество активных WebSocket соединений
- Время ответа API
- Использование памяти и CPU
- Размер базы данных

## Troubleshooting

### Frontend не загружается
1. Проверьте Nginx: `docker-compose logs nginx`
2. Убедитесь что файлы смонтированы: `docker-compose exec nginx ls /usr/share/nginx/html`

### API не отвечает
1. Проверьте Backend: `docker-compose logs backend`
2. Проверьте подключение к БД: `docker-compose exec backend node -e "require('./src/db').query('SELECT 1')"`

### WebSocket не подключается
1. Проверьте токен в LocalStorage
2. Проверьте Nginx конфигурацию для WebSocket
3. Проверьте логи Backend на ошибки аутентификации

### Файлы не загружаются
1. Проверьте права на папку uploads: `ls -la uploads/`
2. Проверьте монтирование volumes в docker-compose.yml
3. Проверьте Nginx конфигурацию для /uploads/
