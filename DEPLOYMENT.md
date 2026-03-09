# Развертывание на VDS REG.RU

## Шаг 1: Подготовка VDS

1. Подключитесь к серверу по SSH:
```bash
ssh root@your_server_ip
```

2. Обновите систему:
```bash
apt update && apt upgrade -y
```

3. Установите Docker:
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
```

4. Установите Docker Compose:
```bash
apt install docker-compose -y
```

5. Установите Git:
```bash
apt install git -y
```

## Шаг 2: Загрузка проекта

### Вариант А: Через Git (рекомендуется)

1. Создайте репозиторий на GitHub/GitLab
2. Загрузите код:
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin your_repo_url
git push -u origin main
```

3. На сервере клонируйте репозиторий:
```bash
cd /opt
git clone your_repo_url messenger
cd messenger
```

### Вариант Б: Через SCP

С вашего компьютера:
```bash
scp -r ./* root@your_server_ip:/opt/messenger/
```

## Шаг 3: Настройка окружения

1. Создайте .env файл:
```bash
cd /opt/messenger
cp .env.example .env
nano .env
```

2. Измените настройки:
```env
PORT=3000
DB_HOST=postgres
DB_PORT=5432
DB_NAME=messenger
DB_USER=messenger_user
DB_PASSWORD=СИЛЬНЫЙ_ПАРОЛЬ_ЗДЕСЬ
JWT_SECRET=СЛУЧАЙНАЯ_СТРОКА_32_СИМВОЛА
```

Для генерации JWT_SECRET:
```bash
openssl rand -base64 32
```

## Шаг 4: Настройка файрвола

```bash
# Разрешаем SSH, HTTP, HTTPS
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3000/tcp
ufw enable
```

## Шаг 5: Запуск приложения

```bash
cd /opt/messenger
docker-compose up -d
```

Проверка статуса:
```bash
docker-compose ps
docker-compose logs -f
```

## Шаг 6: Настройка Nginx (опционально, для домена)

1. Установите Nginx:
```bash
apt install nginx -y
```

2. Создайте конфигурацию:
```bash
nano /etc/nginx/sites-available/messenger
```

Вставьте:
```nginx
server {
    listen 80;
    server_name your_domain.com;

    client_max_body_size 100M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # WebSocket поддержка
    location /ws {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }
}
```

3. Активируйте конфигурацию:
```bash
ln -s /etc/nginx/sites-available/messenger /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

## Шаг 7: SSL сертификат (Let's Encrypt)

```bash
apt install certbot python3-certbot-nginx -y
certbot --nginx -d your_domain.com
```

Автообновление:
```bash
certbot renew --dry-run
```

## Шаг 8: Автозапуск при перезагрузке

Docker Compose автоматически перезапустит контейнеры благодаря `restart: unless-stopped`

Проверка:
```bash
reboot
# После перезагрузки
docker-compose ps
```

## Полезные команды

### Просмотр логов
```bash
docker-compose logs -f backend
docker-compose logs -f postgres
```

### Перезапуск
```bash
docker-compose restart
```

### Остановка
```bash
docker-compose down
```

### Обновление кода
```bash
git pull
docker-compose down
docker-compose up -d --build
```

### Бэкап базы данных
```bash
docker-compose exec postgres pg_dump -U messenger_user messenger > backup.sql
```

### Восстановление базы
```bash
docker-compose exec -T postgres psql -U messenger_user messenger < backup.sql
```

## Проверка работы

1. Откройте браузер и перейдите на:
```
http://your_server_ip
```

2. Зарегистрируйтесь или войдите в систему

3. Проверьте API напрямую (опционально):
```bash
curl http://your_server_ip/api/auth/login
```

## Мониторинг

### Использование ресурсов
```bash
docker stats
```

### Размер логов
```bash
docker-compose logs --tail=100
```

### Очистка старых образов
```bash
docker system prune -a
```

## Безопасность

1. Смените пароль root
2. Создайте отдельного пользователя для SSH
3. Отключите вход root по SSH
4. Используйте SSH ключи вместо паролей
5. Регулярно обновляйте систему
6. Настройте fail2ban для защиты от брутфорса

## Troubleshooting

### Контейнер не запускается
```bash
docker-compose logs backend
```

### База данных недоступна
```bash
docker-compose exec postgres psql -U messenger_user -d messenger
```

### Порт занят
```bash
netstat -tulpn | grep 3000
```

### Нет места на диске
```bash
df -h
docker system df
docker system prune -a
```
