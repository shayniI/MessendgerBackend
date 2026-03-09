# Быстрый старт

## Локальный запуск (за 3 минуты)

### 1. Подготовка
```bash
# Клонируйте или скачайте проект
cd messenger-backend

# Создайте .env файл
cp .env.example .env
```

### 2. Запуск
```bash
docker-compose up -d
```

### 3. Готово!
Откройте браузер: `http://localhost`

## Развертывание на VDS

### Быстрый способ
```bash
# На сервере
cd /opt
git clone your_repo messenger
cd messenger

# Автоматическая установка
chmod +x deploy.sh
./deploy.sh
```

### Ручной способ
```bash
# Установите Docker
curl -fsSL https://get.docker.com | sh

# Установите Docker Compose
apt install docker-compose -y

# Запустите
docker-compose up -d
```

## Первые шаги

1. **Регистрация**
   - Откройте `http://localhost` или `http://your_server_ip`
   - Нажмите "Зарегистрироваться"
   - Введите имя, email, пароль

2. **Создание чата**
   - Нажмите кнопку "+" в верхнем правом углу
   - Введите email другого пользователя
   - Начните общение

3. **Отправка сообщений**
   - Текст: просто введите и нажмите Enter
   - Эмодзи: нажмите 😊
   - Файлы: нажмите 📎
   - Голос: нажмите 🎤
   - Видео: нажмите 🎥

4. **Настройки**
   - Нажмите ⚙️ в верхнем правом углу
   - Измените тему, размер шрифта, фон
   - Настройте уведомления

## Полезные команды

```bash
# Просмотр логов
docker-compose logs -f

# Перезапуск
docker-compose restart

# Остановка
docker-compose down

# Обновление
git pull
docker-compose up -d --build

# Бэкап БД
docker-compose exec postgres pg_dump -U messenger_user messenger > backup.sql
```

## Проблемы?

### Порт 80 занят
Измените в `docker-compose.yml`:
```yaml
nginx:
  ports:
    - "8080:80"  # Вместо 80:80
```

### Не подключается к БД
```bash
# Проверьте статус
docker-compose ps

# Пересоздайте контейнеры
docker-compose down -v
docker-compose up -d
```

### Frontend не загружается
```bash
# Проверьте Nginx
docker-compose logs nginx

# Перезапустите
docker-compose restart nginx
```

## Что дальше?

- Прочитайте [README.md](README.md) для полной документации
- Изучите [INTEGRATION.md](INTEGRATION.md) для понимания архитектуры
- Следуйте [DEPLOYMENT.md](DEPLOYMENT.md) для production развертывания

## Поддержка

Если возникли проблемы:
1. Проверьте логи: `docker-compose logs`
2. Убедитесь что все контейнеры запущены: `docker-compose ps`
3. Проверьте .env файл на правильность настроек
