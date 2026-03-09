#!/bin/bash

# Скрипт быстрого развертывания на VDS

set -e

echo "=== Развертывание Messenger (Frontend + Backend) ==="

# Проверка Docker
if ! command -v docker &> /dev/null; then
    echo "Установка Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
fi

# Проверка Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo "Установка Docker Compose..."
    apt install docker-compose -y 2>/dev/null || yum install docker-compose -y 2>/dev/null || true
fi

# Создание .env если не существует
if [ ! -f .env ]; then
    echo "Создание .env файла..."
    cp .env.example .env
    
    # Генерация JWT секрета
    JWT_SECRET=$(openssl rand -base64 32)
    sed -i "s/your_jwt_secret_key_change_this/$JWT_SECRET/" .env
    
    # Генерация пароля БД
    DB_PASSWORD=$(openssl rand -base64 16)
    sed -i "s/messenger_password/$DB_PASSWORD/g" .env
    
    echo "✅ .env файл создан с безопасными паролями"
fi

# Создание директорий
mkdir -p uploads/avatars uploads/files

# Остановка старых контейнеров
echo "Остановка старых контейнеров..."
docker-compose down 2>/dev/null || true

# Запуск
echo "Запуск контейнеров..."
docker-compose up -d --build

# Ожидание запуска
echo "Ожидание запуска сервисов..."
sleep 10

echo ""
echo "✅ Развертывание завершено!"
echo ""
echo "📊 Статус контейнеров:"
docker-compose ps
echo ""
echo "🌐 Приложение доступно на:"
echo "   http://$(hostname -I | awk '{print $1}')"
echo ""
echo "📝 Полезные команды:"
echo "   Логи:        docker-compose logs -f"
echo "   Перезапуск:  docker-compose restart"
echo "   Остановка:   docker-compose down"
echo ""
echo "📖 Документация:"
echo "   README.md - Полная документация"
echo "   QUICKSTART.md - Быстрый старт"
echo "   DEPLOYMENT.md - Развертывание на VDS"
echo ""
