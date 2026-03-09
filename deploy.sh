#!/bin/bash

# Скрипт быстрого развертывания на VDS

set -e

echo "=== Развертывание Messenger Backend ==="

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
    apt install docker-compose -y
fi

# Создание .env если не существует
if [ ! -f .env ]; then
    echo "Создание .env файла..."
    cp .env.example .env
    
    # Генерация JWT секрета
    JWT_SECRET=$(openssl rand -base64 32)
    sed -i "s/your_jwt_secret_key_change_this/$JWT_SECRET/" .env
    
    echo "⚠️  ВАЖНО: Отредактируйте .env и установите надежный пароль БД!"
    echo "Файл: $(pwd)/.env"
fi

# Создание директорий
mkdir -p uploads/avatars uploads/files

# Запуск
echo "Запуск контейнеров..."
docker-compose down
docker-compose up -d --build

echo ""
echo "✅ Развертывание завершено!"
echo ""
echo "Проверка статуса:"
docker-compose ps
echo ""
echo "Логи:"
echo "  docker-compose logs -f"
echo ""
echo "API доступен на: http://$(hostname -I | awk '{print $1}'):3000"
echo ""
echo "Для остановки: docker-compose down"
