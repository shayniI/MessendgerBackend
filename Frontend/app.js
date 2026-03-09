// Данные приложения
const appData = {
    currentUser: null,
    currentChatId: null,
    chats: [],
    messages: {},
    mediaRecorder: null,
    recordedChunks: [],
    recordingStartTime: null,
    videoStream: null,
    ws: null,
    typingTimeout: null
};

// Эмодзи
const emojis = ['😊', '😂', '❤️', '👍', '🎉', '🔥', '✨', '💯', '🙌', '👏', '😍', '🥰', '😎', '🤔', '😢', '😭', '😡', '🤗', '😴', '🤩', '😜', '🙃', '😇', '🤪', '😱', '🥳', '🤯', '😬', '🙄', '😏', '🤭', '🤫'];

// Инициализация
document.addEventListener('DOMContentLoaded', async () => {
    // Проверка авторизации
    if (!AuthStorage.getToken()) {
        window.location.href = 'auth.html';
        return;
    }

    try {
        await initializeApp();
        setupEventListeners();
        connectWebSocket();
    } catch (error) {
        console.error('Initialization error:', error);
        if (error.message.includes('token') || error.message.includes('Unauthorized')) {
            AuthStorage.removeToken();
            AuthStorage.removeUser();
            window.location.href = 'auth.html';
        }
    }
});

async function initializeApp() {
    renderEmojiPicker();
    
    // Загружаем данные пользователя
    const user = await API.users.getMe();
    appData.currentUser = user;
    document.getElementById('profileName').textContent = user.username;
    document.getElementById('profilePhone').textContent = user.email;
    
    // Загружаем чаты
    await loadChats();
    
    // Инициализируем настройки
    setTimeout(() => {
        if (typeof updateSettingsUI === 'function') {
            updateSettingsUI();
        }
    }, 100);
}

async function loadChats() {
    try {
        appData.chats = await API.chats.getAll();
        renderChatList();
    } catch (error) {
        console.error('Failed to load chats:', error);
        showNotification('Ошибка загрузки чатов');
    }
}

function connectWebSocket() {
    const token = AuthStorage.getToken();
    appData.ws = new WebSocket(`${API_CONFIG.WS_URL}?token=${token}`);
    
    appData.ws.onopen = () => {
        console.log('WebSocket connected');
    };
    
    appData.ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
    };
    
    appData.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
    };
    
    appData.ws.onclose = () => {
        console.log('WebSocket disconnected, reconnecting...');
        setTimeout(connectWebSocket, 3000);
    };
}

function handleWebSocketMessage(data) {
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
}

function handleNewMessage(message) {
    const chatId = message.chat_id;
    
    if (!appData.messages[chatId]) {
        appData.messages[chatId] = [];
    }
    
    appData.messages[chatId].push(message);
    
    if (appData.currentChatId === chatId) {
        renderMessages();
        API.messages.markRead(message.id).catch(console.error);
    }
    
    loadChats();
}

function handleUserStatus(userId, status) {
    appData.chats.forEach(chat => {
        if (chat.type === 'private') {
            // Обновляем статус в UI
            renderChatList();
        }
    });
}

function handleTyping(userId, chatId) {
    if (appData.currentChatId === chatId) {
        const chat = appData.chats.find(c => c.id === chatId);
        if (chat) {
            document.getElementById('chatStatus').textContent = 'печатает...';
            setTimeout(() => {
                document.getElementById('chatStatus').textContent = chat.status || '';
            }, 3000);
        }
    }
}

function setupEventListeners() {
    // Отправка сообщения
    document.getElementById('sendBtn').addEventListener('click', sendMessage);
    document.getElementById('messageInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
    
    // Индикатор печатает
    document.getElementById('messageInput').addEventListener('input', () => {
        if (appData.typingTimeout) clearTimeout(appData.typingTimeout);
        
        if (appData.ws && appData.ws.readyState === WebSocket.OPEN && appData.currentChatId) {
            appData.ws.send(JSON.stringify({
                type: 'typing',
                chatId: appData.currentChatId
            }));
        }
        
        appData.typingTimeout = setTimeout(() => {
            // Перестал печатать
        }, 3000);
    });
    
    // Эмодзи
    document.getElementById('emojiBtn').addEventListener('click', toggleEmojiPicker);
    
    // Прикрепление файлов
    document.getElementById('attachBtn').addEventListener('click', attachFile);
    
    // Голосовое сообщение
    document.getElementById('voiceBtn').addEventListener('click', startVoiceRecording);
    document.getElementById('cancelVoice').addEventListener('click', cancelVoiceRecording);
    document.getElementById('sendVoice').addEventListener('click', sendVoiceMessage);
    
    // Видео кружок
    document.getElementById('videoBtn').addEventListener('click', startVideoRecording);
    document.getElementById('cancelVideo').addEventListener('click', cancelVideoRecording);
    document.getElementById('recordVideo').addEventListener('click', toggleVideoRecording);
    document.getElementById('sendVideo').addEventListener('click', sendVideoMessage);
    
    // Новый чат
    document.getElementById('newChatBtn').addEventListener('click', createNewChat);
    
    // Кнопка возврата к чатам (мобильная версия)
    document.getElementById('backToChatsBtn').addEventListener('click', () => {
        document.querySelector('.sidebar').classList.remove('hidden');
    });
    
    // Настройки
    document.getElementById('settingsBtn').addEventListener('click', openSettings);
    document.getElementById('backBtn').addEventListener('click', closeSettings);
    
    // Обработчики настроек
    setupSettingsHandlers();
    
    // Закрытие эмодзи при клике вне
    document.addEventListener('click', (e) => {
        const emojiPicker = document.getElementById('emojiPicker');
        const emojiBtn = document.getElementById('emojiBtn');
        if (!emojiPicker.contains(e.target) && e.target !== emojiBtn) {
            emojiPicker.classList.remove('active');
        }
    });
}

function renderChatList() {
    const chatList = document.getElementById('chatList');
    chatList.innerHTML = '';
    
    appData.chats.forEach(chat => {
        const chatItem = document.createElement('div');
        chatItem.className = 'chat-item';
        if (chat.id === appData.currentChatId) {
            chatItem.classList.add('active');
        }
        
        const preview = chat.last_message || 'Нет сообщений';
        
        chatItem.innerHTML = `
            <div class="chat-item-name">${escapeHtml(chat.name || 'Чат')}</div>
            <div class="chat-item-preview">${escapeHtml(preview)}</div>
        `;
        
        chatItem.addEventListener('click', () => selectChat(chat.id));
        chatList.appendChild(chatItem);
    });
}

async function selectChat(chatId) {
    appData.currentChatId = chatId;
    const chat = appData.chats.find(c => c.id === chatId);
    
    document.getElementById('chatName').textContent = chat.name;
    document.getElementById('chatStatus').textContent = chat.status || `${chat.member_count} участников`;
    
    // Загружаем сообщения
    try {
        appData.messages[chatId] = await API.messages.getChat(chatId);
        renderMessages();
    } catch (error) {
        console.error('Failed to load messages:', error);
        showNotification('Ошибка загрузки сообщений');
    }
    
    renderChatList();
    
    // Скрываем боковую панель на мобильных устройствах
    if (window.innerWidth <= 768) {
        document.querySelector('.sidebar').classList.add('hidden');
    }
}

function renderMessages() {
    const messagesContainer = document.getElementById('messages');
    messagesContainer.innerHTML = '';
    
    if (!appData.currentChatId) return;
    
    const messages = appData.messages[appData.currentChatId] || [];
    
    messages.forEach(message => {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message';
        if (message.user_id === appData.currentUser.id) {
            messageDiv.classList.add('own');
        }
        
        let content = '';
        
        if (message.type === 'text') {
            content = `<div class="message-text">${escapeHtml(message.content)}</div>`;
        } else if (message.type === 'image') {
            content = `<img src="${API_CONFIG.BASE_URL}${message.file_url}" class="message-image" alt="Изображение">`;
        } else if (message.type === 'voice') {
            content = `
                <div class="voice-message">
                    <button class="play-btn" onclick="playAudio('${API_CONFIG.BASE_URL}${message.file_url}')">▶</button>
                    <span class="voice-duration">0:00</span>
                </div>
            `;
        } else if (message.type === 'video') {
            content = `
                <video class="message-image" controls>
                    <source src="${API_CONFIG.BASE_URL}${message.file_url}" type="video/webm">
                </video>
            `;
        } else if (message.type === 'file') {
            content = `
                <div class="file-message">
                    <a href="${API_CONFIG.BASE_URL}${message.file_url}" download>📎 ${message.content || 'Файл'}</a>
                </div>
            `;
        }
        
        const time = new Date(message.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        
        messageDiv.innerHTML = `
            <div class="message-content">
                ${content}
                <div class="message-time">${time}</div>
            </div>
        `;
        
        messagesContainer.appendChild(messageDiv);
    });
    
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function sendMessage() {
    const input = document.getElementById('messageInput');
    const text = input.value.trim();
    
    if (!text || !appData.currentChatId) return;
    
    try {
        const message = await API.messages.send({
            chatId: appData.currentChatId,
            content: text,
            type: 'text'
        });
        
        input.value = '';
        
        // Сообщение придет через WebSocket
    } catch (error) {
        console.error('Failed to send message:', error);
        showNotification('Ошибка отправки сообщения');
    }
    
    // Отправляем событие "печатает"
    if (appData.ws && appData.ws.readyState === WebSocket.OPEN) {
        appData.ws.send(JSON.stringify({
            type: 'typing',
            chatId: appData.currentChatId
        }));
    }
}

function getCurrentTime() {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
}

// Эмодзи
function renderEmojiPicker() {
    const emojiPicker = document.getElementById('emojiPicker');
    emojis.forEach(emoji => {
        const emojiItem = document.createElement('span');
        emojiItem.className = 'emoji-item';
        emojiItem.textContent = emoji;
        emojiItem.addEventListener('click', () => insertEmoji(emoji));
        emojiPicker.appendChild(emojiItem);
    });
}

function toggleEmojiPicker() {
    const emojiPicker = document.getElementById('emojiPicker');
    emojiPicker.classList.toggle('active');
}

function insertEmoji(emoji) {
    const input = document.getElementById('messageInput');
    input.value += emoji;
    input.focus();
}

// Прикрепление файлов
function attachFile() {
    if (!appData.currentChatId) return;
    
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,video/*,.pdf,.doc,.docx,.txt';
    
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        try {
            let type = 'file';
            if (file.type.startsWith('image/')) type = 'image';
            else if (file.type.startsWith('video/')) type = 'video';
            
            await API.messages.send({
                chatId: appData.currentChatId,
                content: file.name,
                type: type,
                file: file
            });
            
            showNotification('Файл отправлен');
        } catch (error) {
            console.error('Failed to send file:', error);
            showNotification('Ошибка отправки файла');
        }
    };
    
    input.click();
}

// Голосовое сообщение
async function startVoiceRecording() {
    if (!appData.currentChatId) return;
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        appData.mediaRecorder = new MediaRecorder(stream);
        appData.recordedChunks = [];
        
        appData.mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                appData.recordedChunks.push(e.data);
            }
        };
        
        appData.mediaRecorder.start();
        appData.recordingStartTime = Date.now();
        
        document.getElementById('voiceModal').classList.add('active');
        updateRecordingTime();
    } catch (err) {
        alert('Не удалось получить доступ к микрофону');
    }
}

function updateRecordingTime() {
    if (!appData.mediaRecorder || appData.mediaRecorder.state !== 'recording') return;
    
    const elapsed = Math.floor((Date.now() - appData.recordingStartTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    
    document.getElementById('recordingTime').textContent = 
        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    setTimeout(updateRecordingTime, 1000);
}

function cancelVoiceRecording() {
    if (appData.mediaRecorder) {
        appData.mediaRecorder.stop();
        appData.mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
    document.getElementById('voiceModal').classList.remove('active');
    appData.recordedChunks = [];
}

async function sendVoiceMessage() {
    if (!appData.mediaRecorder) return;
    
    appData.mediaRecorder.stop();
    
    appData.mediaRecorder.onstop = async () => {
        const blob = new Blob(appData.recordedChunks, { type: 'audio/webm' });
        const file = new File([blob], 'voice.webm', { type: 'audio/webm' });
        
        try {
            await API.messages.send({
                chatId: appData.currentChatId,
                content: 'Голосовое сообщение',
                type: 'voice',
                file: file
            });
            
            showNotification('Голосовое сообщение отправлено');
        } catch (error) {
            console.error('Failed to send voice:', error);
            showNotification('Ошибка отправки голосового сообщения');
        }
        
        appData.mediaRecorder.stream.getTracks().forEach(track => track.stop());
        document.getElementById('voiceModal').classList.remove('active');
    };
}

function playAudio(url) {
    const audio = new Audio(url);
    audio.play();
}

// Видео кружок
async function startVideoRecording() {
    if (!appData.currentChatId) return;
    
    try {
        appData.videoStream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: 400, height: 400 }, 
            audio: true 
        });
        
        const videoPreview = document.getElementById('videoPreview');
        videoPreview.srcObject = appData.videoStream;
        
        document.getElementById('videoModal').classList.add('active');
    } catch (err) {
        alert('Не удалось получить доступ к камере');
    }
}

function toggleVideoRecording() {
    const recordBtn = document.getElementById('recordVideo');
    const sendBtn = document.getElementById('sendVideo');
    
    if (!appData.mediaRecorder || appData.mediaRecorder.state === 'inactive') {
        // Начать запись
        appData.mediaRecorder = new MediaRecorder(appData.videoStream);
        appData.recordedChunks = [];
        
        appData.mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                appData.recordedChunks.push(e.data);
            }
        };
        
        appData.mediaRecorder.start();
        recordBtn.textContent = '⏹';
        recordBtn.classList.add('recording');
    } else {
        // Остановить запись
        appData.mediaRecorder.stop();
        recordBtn.textContent = '⏺';
        recordBtn.classList.remove('recording');
        sendBtn.style.display = 'block';
    }
}

function cancelVideoRecording() {
    if (appData.mediaRecorder && appData.mediaRecorder.state === 'recording') {
        appData.mediaRecorder.stop();
    }
    
    if (appData.videoStream) {
        appData.videoStream.getTracks().forEach(track => track.stop());
    }
    
    document.getElementById('videoModal').classList.remove('active');
    document.getElementById('sendVideo').style.display = 'none';
    document.getElementById('recordVideo').textContent = '⏺';
    appData.recordedChunks = [];
}

async function sendVideoMessage() {
    if (!appData.recordedChunks.length) return;
    
    const blob = new Blob(appData.recordedChunks, { type: 'video/webm' });
    const file = new File([blob], 'video.webm', { type: 'video/webm' });
    
    try {
        await API.messages.send({
            chatId: appData.currentChatId,
            content: 'Видео кружок',
            type: 'video',
            file: file
        });
        
        showNotification('Видео отправлено');
    } catch (error) {
        console.error('Failed to send video:', error);
        showNotification('Ошибка отправки видео');
    }
    
    cancelVideoRecording();
}

// Новый чат
async function createNewChat() {
    const query = prompt('Введите email или имя пользователя для поиска:');
    if (!query) return;
    
    try {
        const users = await API.users.search(query);
        
        if (users.length === 0) {
            showNotification('Пользователи не найдены');
            return;
        }
        
        // Берем первого найденного пользователя
        const user = users[0];
        
        // Создаем приватный чат
        const chat = await API.chats.create({
            name: user.username,
            type: 'private',
            memberIds: [user.id]
        });
        
        await loadChats();
        selectChat(chat.id);
        showNotification(`Чат с ${user.username} создан`);
    } catch (error) {
        console.error('Failed to create chat:', error);
        showNotification('Ошибка создания чата');
    }
}


// Настройки
const settingsState = {
    currentSubmenu: null,
    theme: 'dark',
    fontSize: 'medium',
    wallpaper: 'default'
};

function openSettings() {
    document.getElementById('settingsPanel').classList.add('active');
    showMainSettings();
}

function closeSettings() {
    if (settingsState.currentSubmenu) {
        showMainSettings();
    } else {
        document.getElementById('settingsPanel').classList.remove('active');
    }
}

function showMainSettings() {
    const mainSettings = document.getElementById('mainSettings');
    const themeSubmenu = document.getElementById('themeSubmenu');
    const fontSizeSubmenu = document.getElementById('fontSizeSubmenu');
    const wallpaperSubmenu = document.getElementById('wallpaperSubmenu');
    
    if (mainSettings) mainSettings.style.display = 'block';
    if (themeSubmenu) themeSubmenu.classList.remove('active');
    if (fontSizeSubmenu) fontSizeSubmenu.classList.remove('active');
    if (wallpaperSubmenu) wallpaperSubmenu.classList.remove('active');
    
    document.getElementById('settingsTitle').textContent = 'Настройки';
    settingsState.currentSubmenu = null;
}

function showSubmenu(submenuId, title) {
    const mainSettings = document.getElementById('mainSettings');
    const submenu = document.getElementById(submenuId);
    
    if (mainSettings) mainSettings.style.display = 'none';
    if (submenu) submenu.classList.add('active');
    
    document.getElementById('settingsTitle').textContent = title;
    settingsState.currentSubmenu = submenuId;
}

function setupSettingsHandlers() {
    // Редактирование профиля
    document.getElementById('editProfileBtn').addEventListener('click', async (e) => {
        e.stopPropagation();
        const name = prompt('Введите ваше имя:', document.getElementById('profileName').textContent);
        if (name) {
            try {
                await API.users.updateMe({ username: name });
                document.getElementById('profileName').textContent = name;
                appData.currentUser.username = name;
                showNotification('Профиль обновлен');
            } catch (error) {
                console.error('Failed to update profile:', error);
                showNotification('Ошибка обновления профиля');
            }
        }
    });
    
    // Уведомления
    document.getElementById('notificationsToggle').addEventListener('change', (e) => {
        if (e.target.checked) {
            showNotification('Уведомления включены');
        } else {
            showNotification('Уведомления отключены');
        }
    });
    
    // Звук
    document.getElementById('soundToggle').addEventListener('change', (e) => {
        if (e.target.checked) {
            showNotification('Звук включен');
        } else {
            showNotification('Звук отключен');
        }
    });
    
    // Автозагрузка
    document.getElementById('autoDownloadToggle').addEventListener('change', (e) => {
        if (e.target.checked) {
            showNotification('Автозагрузка включена');
        } else {
            showNotification('Автозагрузка отключена');
        }
    });
    
    // Отчеты о прочтении
    document.getElementById('readReceiptsToggle').addEventListener('change', (e) => {
        if (e.target.checked) {
            showNotification('Отчеты о прочтении включены');
        } else {
            showNotification('Отчеты о прочтении отключены');
        }
    });
    
    // Последнее посещение
    document.getElementById('lastSeenSetting').addEventListener('click', () => {
        const options = ['Все', 'Мои контакты', 'Никто'];
        const current = document.querySelector('#lastSeenSetting .setting-description').textContent;
        const currentIndex = options.indexOf(current);
        const nextIndex = (currentIndex + 1) % options.length;
        document.querySelector('#lastSeenSetting .setting-description').textContent = options[nextIndex];
        showNotification(`Последнее посещение: ${options[nextIndex]}`);
    });
    
    // Тема
    document.getElementById('themeSetting').addEventListener('click', () => {
        showSubmenu('themeSubmenu', 'Тема оформления');
    });
    
    // Размер шрифта
    document.getElementById('fontSizeSetting').addEventListener('click', () => {
        showSubmenu('fontSizeSubmenu', 'Размер шрифта');
    });
    
    // Фон чата
    document.getElementById('wallpaperSetting').addEventListener('click', () => {
        showSubmenu('wallpaperSubmenu', 'Фон чата');
    });
    
    // Использование памяти
    document.getElementById('storageSetting').addEventListener('click', () => {
        showNotification('Анализ памяти (в разработке)');
    });
    
    // Очистка кэша
    document.getElementById('clearCacheSetting').addEventListener('click', () => {
        if (confirm('Очистить кэш приложения?')) {
            showNotification('Кэш очищен');
            document.querySelector('#storageSetting .setting-description').textContent = '0 МБ';
        }
    });
    
    // Заблокированные
    document.getElementById('blockListSetting').addEventListener('click', () => {
        showNotification('Список заблокированных (в разработке)');
    });
    
    // Обработчики выбора темы
    document.querySelectorAll('.theme-option').forEach(option => {
        option.addEventListener('click', function() {
            const theme = this.getAttribute('data-theme');
            applyTheme(theme);
        });
    });
    
    // Обработчики выбора размера шрифта
    document.querySelectorAll('.font-size-option').forEach(option => {
        option.addEventListener('click', function() {
            const size = this.getAttribute('data-size');
            applyFontSize(size);
        });
    });
    
    // Обработчики выбора обоев
    document.querySelectorAll('.wallpaper-option').forEach(option => {
        option.addEventListener('click', function() {
            const wallpaper = this.getAttribute('data-wallpaper');
            applyWallpaper(wallpaper);
        });
    });
    
    // Инициализация текущих настроек
    updateSettingsUI();
}

function showNotification(message) {
    // Создаем временное уведомление
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: var(--bg-tertiary);
        color: var(--text-primary);
        padding: 16px 24px;
        border-radius: 12px;
        border: 2px solid var(--border-color);
        box-shadow: 0 8px 24px rgba(0,0,0,0.4);
        z-index: 10000;
        animation: slideIn 0.3s ease;
        font-size: 14px;
        font-weight: 500;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 2000);
}

// Добавляем анимации для уведомлений
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

function applyTheme(theme) {
    // Удаляем все классы тем
    document.body.classList.remove('theme-dark', 'theme-light', 'theme-blue', 'theme-purple');
    
    // Добавляем новый класс темы
    if (theme !== 'dark') {
        document.body.classList.add(`theme-${theme}`);
    }
    
    settingsState.theme = theme;
    
    // Обновляем UI
    document.querySelectorAll('.theme-option').forEach(opt => {
        opt.classList.remove('active');
    });
    document.querySelector(`.theme-option[data-theme="${theme}"]`).classList.add('active');
    
    // Обновляем описание в главном меню
    const themeNames = {
        'dark': 'Темная',
        'light': 'Светлая',
        'blue': 'Синяя',
        'purple': 'Фиолетовая'
    };
    document.querySelector('#themeSetting .setting-description').textContent = themeNames[theme];
    
    showNotification(`Тема изменена: ${themeNames[theme]}`);
    
    // Сохраняем в localStorage
    localStorage.setItem('theme', theme);
}

function applyFontSize(size) {
    // Удаляем все классы размеров
    document.body.classList.remove('font-small', 'font-medium', 'font-large', 'font-xlarge');
    
    // Добавляем новый класс размера
    document.body.classList.add(`font-${size}`);
    
    settingsState.fontSize = size;
    
    // Обновляем UI
    document.querySelectorAll('.font-size-option').forEach(opt => {
        opt.classList.remove('active');
    });
    document.querySelector(`.font-size-option[data-size="${size}"]`).classList.add('active');
    
    // Обновляем описание в главном меню
    const sizeNames = {
        'small': 'Маленький',
        'medium': 'Средний',
        'large': 'Большой',
        'xlarge': 'Очень большой'
    };
    document.querySelector('#fontSizeSetting .setting-description').textContent = sizeNames[size];
    
    showNotification(`Размер шрифта: ${sizeNames[size]}`);
    
    // Сохраняем в localStorage
    localStorage.setItem('fontSize', size);
}

function applyWallpaper(wallpaper) {
    const messagesContainer = document.getElementById('messages');
    
    // Сбрасываем стили
    messagesContainer.style.background = '';
    messagesContainer.style.backgroundImage = '';
    
    // Применяем новый фон
    const wallpapers = {
        'default': '#0f0f0f',
        'gradient1': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        'gradient2': 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        'gradient3': 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
        'gradient4': 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
        'gradient5': 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
        'pattern1': '#1a1a1a url(\'data:image/svg+xml,<svg width="60" height="60" xmlns="http://www.w3.org/2000/svg"><path d="M0 0h60v60H0z" fill="%231a1a1a"/><circle cx="30" cy="30" r="2" fill="%23333"/></svg>\')',
        'dark': '#000000'
    };
    
    if (wallpaper === 'default') {
        messagesContainer.style.background = wallpapers[wallpaper];
    } else if (wallpaper === 'pattern1') {
        messagesContainer.style.background = wallpapers[wallpaper];
    } else {
        messagesContainer.style.background = wallpapers[wallpaper];
    }
    
    settingsState.wallpaper = wallpaper;
    
    // Обновляем UI
    document.querySelectorAll('.wallpaper-option').forEach(opt => {
        opt.classList.remove('active');
    });
    document.querySelector(`.wallpaper-option[data-wallpaper="${wallpaper}"]`).classList.add('active');
    
    // Обновляем описание в главном меню
    const wallpaperNames = {
        'default': 'По умолчанию',
        'gradient1': 'Фиолетовый градиент',
        'gradient2': 'Розовый градиент',
        'gradient3': 'Голубой градиент',
        'gradient4': 'Зеленый градиент',
        'gradient5': 'Закатный градиент',
        'pattern1': 'Точки',
        'dark': 'Черный'
    };
    document.querySelector('#wallpaperSetting .setting-description').textContent = wallpaperNames[wallpaper];
    
    showNotification(`Фон изменен: ${wallpaperNames[wallpaper]}`);
    
    // Сохраняем в localStorage
    localStorage.setItem('wallpaper', wallpaper);
}

function updateSettingsUI() {
    // Загружаем сохраненные настройки
    const savedTheme = localStorage.getItem('theme') || 'dark';
    const savedFontSize = localStorage.getItem('fontSize') || 'medium';
    const savedWallpaper = localStorage.getItem('wallpaper') || 'default';
    
    // Применяем настройки
    applyTheme(savedTheme);
    applyFontSize(savedFontSize);
    applyWallpaper(savedWallpaper);
}
