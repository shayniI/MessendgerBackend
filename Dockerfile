FROM node:18-alpine

WORKDIR /app

# Копируем package файлы
COPY package*.json ./

# Устанавливаем зависимости
RUN npm install --production

# Копируем исходный код
COPY src ./src
COPY Frontend ./Frontend

# Создаем директории для загрузок
RUN mkdir -p uploads/avatars uploads/files

EXPOSE 3000

CMD ["npm", "start"]

