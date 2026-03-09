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
    typingTimeout: null,
    typingIndicatorTimeout: null,
    reconnectAttempts: 0,
    maxReconnectAttempts: 10
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
        const chats = await API.chats.getAll();
        
        // Сохраняем старые данные для сравнения
        const oldChats = appData.chats;
        appData.chats = chats;
        
        // Проверяем, изменился ли текущий чат
        if (appData.currentChatId) {
            const currentChat = chats.find(c => c.id === appData.currentChatId);
            if (currentChat) {
                // Обновляем заголовок если изменились данные
                const oldChat = oldChats.find(c => c.id === appData.currentChatId);
                if (!oldChat || oldChat.last_message !== currentChat.last_message) {
                    document.getElementById('chatName').textContent = currentChat.name || 'Чат';
                }
            }
        }
        
        renderChatList();
    } catch (error) {
        console.error('Failed to load chats:', error);
        // Не показываем уведомление при фоновом обновлении
    }
}

function connectWebSocket() {
    const token = AuthStorage.getToken();
    if (!token) return;
    
    try {
        console.log('[WebSocket] Connecting...');
        appData.ws = new WebSocket(`${API_CONFIG.WS_URL}?token=${token}`);
        
        appData.ws.onopen = () => {
            console.log('[WebSocket] Connected successfully');
            appData.reconnectAttempts = 0;
            showNotification('Подключено к серверу');
        };
        
        appData.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log('[WebSocket] Received:', data.type, data);
                handleWebSocketMessage(data);
            } catch (error) {
                console.error('[WebSocket] Failed to parse message:', error);
            }
        };
        
        appData.ws.onerror = (error) => {
            console.error('[WebSocket] Error:', error);
        };
        
        appData.ws.onclose = (event) => {
            console.log('[WebSocket] Disconnected:', event.code, event.reason);
            
            if (appData.reconnectAttempts < appData.maxReconnectAttempts) {
                appData.reconnectAttempts++;
                const delay = Math.min(1000 * Math.pow(2, appData.reconnectAttempts), 30000);
                console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${appData.reconnectAttempts})`);
                setTimeout(connectWebSocket, delay);
            } else {
                showNotification('Потеряно соединение с сервером');
            }
        };
    } catch (error) {
        console.error('[WebSocket] Failed to create connection:', error);
    }
}

function handleWebSocketMessage(data) {
    switch (data.type) {
        case 'new_message':
            handleNewMessage(data.message);
            break;
        case 'message_edited':
            handleMessageEdited(data.message);
            break;
        case 'message_deleted':
            handleMessageDeleted(data.messageId);
            break;
        case 'user_status':
            handleUserStatus(data.userId, data.status);
            break;
        case 'typing':
            handleTyping(data.userId, data.chatId);
            break;
    }
}

function handleMessageEdited(message) {
    const chatId = message.chat_id;
    
    if (appData.messages[chatId]) {
        const index = appData.messages[chatId].findIndex(m => m.id === message.id);
        if (index !== -1) {
            appData.messages[chatId][index] = message;
            
            if (appData.currentChatId === chatId) {
                renderMessages();
            }
        }
    }
}

function handleMessageDeleted(messageId) {
    // Находим и удаляем сообщение из всех чатов
    Object.keys(appData.messages).forEach(chatId => {
        const index = appData.messages[chatId].findIndex(m => m.id === messageId);
        if (index !== -1) {
            appData.messages[chatId].splice(index, 1);
            
            if (appData.currentChatId === parseInt(chatId)) {
                renderMessages();
            }
        }
    });
}

function handleNewMessage(message) {
    console.log('[Message] New message received:', message.id, 'for chat', message.chat_id);
    
    const chatId = message.chat_id;
    
    if (!appData.messages[chatId]) {
        appData.messages[chatId] = [];
    }
    
    // Проверяем, не дубликат ли это
    const exists = appData.messages[chatId].find(m => m.id === message.id);
    if (exists) {
        console.log('[Message] Duplicate message ignored:', message.id);
        return;
    }
    
    console.log('[Message] Adding message to chat', chatId);
    appData.messages[chatId].push(message);
    
    if (appData.currentChatId === chatId) {
        console.log('[Message] Rendering messages for current chat');
        // Сохраняем позицию скролла
        const messagesContainer = document.getElementById('messages');
        const wasAtBottom = messagesContainer.scrollHeight - messagesContainer.scrollTop <= messagesContainer.clientHeight + 100;
        
        renderMessages();
        
        // Автоматически отмечаем как прочитанное если это текущий чат
        if (message.user_id !== appData.currentUser.id) {
            API.messages.markRead(message.id).catch(console.error);
        }
        
        // Скроллим вниз только если были внизу
        if (wasAtBottom) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    } else {
        console.log('[Message] Message for different chat, showing notification');
        // Показываем уведомление если сообщение не в текущем чате
        if (message.user_id !== appData.currentUser.id) {
            const chat = appData.chats.find(c => c.id === chatId);
            if (chat) {
                const preview = message.content || 'Медиа';
                showNotification(`${message.username || chat.name}: ${preview.substring(0, 50)}`);
            }
        }
    }
    
    // Обновляем список чатов для отображения последнего сообщения
    loadChats();
}

function handleUserStatus(userId, status) {
    // Обновляем статус в списке чатов
    appData.chats.forEach(chat => {
        if (chat.type === 'private') {
            // Можно добавить логику определения, какой чат относится к этому пользователю
            renderChatList();
        }
    });
    
    // Если это текущий чат, обновляем статус в заголовке
    if (appData.currentChatId) {
        const currentChat = appData.chats.find(c => c.id === appData.currentChatId);
        if (currentChat && currentChat.type === 'private') {
            const statusElement = document.getElementById('chatStatus');
            if (statusElement && !statusElement.textContent.includes('печатает')) {
                statusElement.textContent = status === 'online' ? 'онлайн' : 'офлайн';
            }
        }
    }
}

function handleTyping(userId, chatId) {
    if (appData.currentChatId === chatId && userId !== appData.currentUser.id) {
        const statusElement = document.getElementById('chatStatus');
        const originalStatus = statusElement.textContent;
        
        statusElement.textContent = 'печатает...';
        statusElement.style.color = 'var(--accent-color)';
        
        // Очищаем предыдущий таймер
        if (appData.typingIndicatorTimeout) {
            clearTimeout(appData.typingIndicatorTimeout);
        }
        
        // Возвращаем оригинальный статус через 3 секунды
        appData.typingIndicatorTimeout = setTimeout(() => {
            const chat = appData.chats.find(c => c.id === chatId);
            if (chat && appData.currentChatId === chatId) {
                statusElement.textContent = chat.status || `${chat.member_count || 0} участников`;
                statusElement.style.color = '';
            }
        }, 3000);
    }
}

function setupEventListeners() {
    // Отправка сообщения
    document.getElementById('sendBtn').addEventListener('click', sendMessage);
    document.getElementById('messageInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // Индикатор печатает
    let typingTimer;
    document.getElementById('messageInput').addEventListener('input', () => {
        if (!appData.currentChatId || !appData.ws || appData.ws.readyState !== WebSocket.OPEN) return;
        
        clearTimeout(typingTimer);
        
        // Отправляем событие "печатает"
        appData.ws.send(JSON.stringify({
            type: 'typing',
            chatId: appData.currentChatId
        }));
        
        // Через 3 секунды перестаем "печатать"
        typingTimer = setTimeout(() => {
            // Можно отправить событие "перестал печатать" если нужно
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
    const backBtn = document.getElementById('backToChatsBtn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            document.querySelector('.sidebar').classList.remove('hidden');
            document.querySelector('.chat-area').style.display = 'none';
            setTimeout(() => {
                document.querySelector('.chat-area').style.display = 'flex';
            }, 10);
        });
    }
    
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
    
    if (!chat) return;
    
    document.getElementById('chatName').textContent = chat.name || 'Чат';
    document.getElementById('chatStatus').textContent = chat.status || `${chat.member_count || 0} участников`;
    
    // Загружаем сообщения
    try {
        appData.messages[chatId] = await API.messages.getChat(chatId);
        renderMessages();
        
        // Отмечаем все сообщения как прочитанные
        const unreadMessages = appData.messages[chatId].filter(m => m.user_id !== appData.currentUser.id);
        for (const msg of unreadMessages) {
            API.messages.markRead(msg.id).catch(console.error);
        }
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
    const wasAtBottom = messagesContainer.scrollHeight - messagesContainer.scrollTop <= messagesContainer.clientHeight + 100;
    
    messagesContainer.innerHTML = '';
    
    if (!appData.currentChatId) return;
    
    const messages = appData.messages[appData.currentChatId] || [];
    
    messages.forEach(message => {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message';
        messageDiv.dataset.messageId = message.id;
        
        if (message.user_id === appData.currentUser.id) {
            messageDiv.classList.add('own');
        }
        
        let content = '';
        
        if (message.type === 'text') {
            content = `<div class="message-text">${escapeHtml(message.content)}</div>`;
        } else if (message.type === 'image') {
            content = `<img src="${API_CONFIG.BASE_URL}${message.file_url}" class="message-image" alt="Изображение" loading="lazy">`;
        } else if (message.type === 'voice') {
            const audioId = `audio_${message.id}`;
            content = `
                <div class="voice-message">
                    <button class="play-btn" data-audio-id="${audioId}" onclick="toggleAudioPlayback('${audioId}', '${API_CONFIG.BASE_URL}${message.file_url}')">▶</button>
                    <div class="voice-waveform">
                        <div class="voice-progress" id="progress_${audioId}"></div>
                    </div>
                    <span class="voice-duration" id="duration_${audioId}">0:00</span>
                    <audio id="${audioId}" src="${API_CONFIG.BASE_URL}${message.file_url}" preload="metadata"></audio>
                </div>
            `;
        } else if (message.type === 'video') {
            content = `
                <video class="message-image" controls preload="metadata">
                    <source src="${API_CONFIG.BASE_URL}${message.file_url}" type="video/webm">
                    Ваш браузер не поддерживает видео
                </video>
            `;
        } else if (message.type === 'file') {
            const fileName = message.content || 'Файл';
            content = `
                <div class="file-message">
                    <a href="${API_CONFIG.BASE_URL}${message.file_url}" download="${fileName}" target="_blank">
                        📎 ${escapeHtml(fileName)}
                    </a>
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
    
    // Автоскролл только если пользователь был внизу
    if (wasAtBottom || messages.length === 1) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function sendMessage() {
    const input = document.getElementById('messageInput');
    const text = input.value.trim();
    
    if (!text || !appData.currentChatId) return;
    
    // Очищаем поле сразу для лучшего UX
    input.value = '';
    
    try {
        console.log('[Message] Sending to chat', appData.currentChatId);
        const message = await API.messages.send({
            chatId: appData.currentChatId,
            content: text,
            type: 'text'
        });
        console.log('[Message] Sent successfully:', message.id);
        
        // Сообщение придет через WebSocket и отобразится автоматически
    } catch (error) {
        console.error('[Message] Failed to send:', error);
        showNotification('Ошибка отправки сообщения');
        // Возвращаем текст обратно в поле при ошибке
        input.value = text;
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
    if (!appData.currentChatId) {
        showNotification('Выберите чат');
        return;
    }
    
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,video/*,.pdf,.doc,.docx,.txt,.zip,.rar';
    input.multiple = false;
    
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        // Проверка размера файла (макс 100MB)
        if (file.size > 100 * 1024 * 1024) {
            showNotification('Файл слишком большой (макс 100MB)');
            return;
        }
        
        try {
            let type = 'file';
            if (file.type.startsWith('image/')) type = 'image';
            else if (file.type.startsWith('video/')) type = 'video';
            
            showNotification('Отправка файла...');
            
            await API.messages.send({
                chatId: appData.currentChatId,
                content: file.name,
                type: type,
                file: file
            });
            
            // Сообщение придет через WebSocket
        } catch (error) {
            console.error('Failed to send file:', error);
            showNotification('Ошибка отправки файла');
        }
    };
    
    input.click();
}

// Голосовое сообщение
async function startVoiceRecording() {
    if (!appData.currentChatId) {
        showNotification('Выберите чат');
        return;
    }
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            } 
        });
        
        // Определяем поддерживаемый MIME тип
        let mimeType = 'audio/webm;codecs=opus';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = 'audio/webm';
        }
        if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = 'audio/ogg;codecs=opus';
        }
        
        console.log('[Voice] Using MIME type:', mimeType);
        
        appData.mediaRecorder = new MediaRecorder(stream, { mimeType });
        appData.recordedChunks = [];
        
        appData.mediaRecorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) {
                console.log('[Voice] Chunk received:', e.data.size, 'bytes');
                appData.recordedChunks.push(e.data);
            }
        };
        
        appData.mediaRecorder.onerror = (e) => {
            console.error('[Voice] Recording error:', e);
            showNotification('Ошибка записи голоса');
        };
        
        appData.mediaRecorder.start(100); // Записываем чанки каждые 100ms
        appData.recordingStartTime = Date.now();
        
        console.log('[Voice] Recording started');
        document.getElementById('voiceModal').classList.add('active');
        updateRecordingTime();
    } catch (err) {
        console.error('[Voice] Microphone access error:', err);
        showNotification('Не удалось получить доступ к микрофону. Проверьте разрешения.');
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
    console.log('[Voice] Cancelling recording');
    
    if (appData.mediaRecorder) {
        if (appData.mediaRecorder.state === 'recording') {
            appData.mediaRecorder.stop();
        }
        if (appData.mediaRecorder.stream) {
            appData.mediaRecorder.stream.getTracks().forEach(track => {
                track.stop();
                console.log('[Voice] Track stopped');
            });
        }
        appData.mediaRecorder = null;
    }
    
    document.getElementById('voiceModal').classList.remove('active');
    appData.recordedChunks = [];
}

async function sendVoiceMessage() {
    if (!appData.mediaRecorder) return;
    
    // Останавливаем запись если еще идет
    if (appData.mediaRecorder.state === 'recording') {
        appData.mediaRecorder.stop();
    }
    
    appData.mediaRecorder.onstop = async () => {
        try {
            // Определяем MIME тип
            const mimeType = appData.recordedChunks[0]?.type || 'audio/webm';
            const blob = new Blob(appData.recordedChunks, { type: mimeType });
            
            console.log('[Voice] Blob created:', blob.size, 'bytes, type:', blob.type);
            
            if (blob.size === 0) {
                showNotification('Голосовое сообщение пустое');
                cancelVoiceRecording();
                return;
            }
            
            const file = new File([blob], `voice_${Date.now()}.webm`, { type: mimeType });
            
            showNotification('Отправка голосового сообщения...');
            
            await API.messages.send({
                chatId: appData.currentChatId,
                content: 'Голосовое сообщение',
                type: 'voice',
                file: file
            });
            
            console.log('[Voice] Sent successfully');
            // Сообщение придет через WebSocket
        } catch (error) {
            console.error('[Voice] Failed to send:', error);
            showNotification('Ошибка отправки голосового сообщения');
        }
        
        // Очищаем ресурсы
        if (appData.mediaRecorder && appData.mediaRecorder.stream) {
            appData.mediaRecorder.stream.getTracks().forEach(track => track.stop());
        }
        document.getElementById('voiceModal').classList.remove('active');
        appData.recordedChunks = [];
        appData.mediaRecorder = null;
    };
}

function playAudio(url) {
    const audio = new Audio(url);
    audio.play().catch(err => {
        console.error('Failed to play audio:', err);
        showNotification('Ошибка воспроизведения аудио');
    });
}

// Улучшенное воспроизведение аудио с контролем
function toggleAudioPlayback(audioId, url) {
    const audio = document.getElementById(audioId);
    const button = document.querySelector(`[data-audio-id="${audioId}"]`);
    const progressBar = document.getElementById(`progress_${audioId}`);
    const durationSpan = document.getElementById(`duration_${audioId}`);
    
    if (!audio) {
        console.error('Audio element not found:', audioId);
        return;
    }
    
    // Останавливаем все другие аудио
    document.querySelectorAll('audio').forEach(a => {
        if (a.id !== audioId && !a.paused) {
            a.pause();
            a.currentTime = 0;
            const btn = document.querySelector(`[data-audio-id="${a.id}"]`);
            if (btn) btn.textContent = '▶';
        }
    });
    
    if (audio.paused) {
        audio.play().then(() => {
            button.textContent = '⏸';
        }).catch(err => {
            console.error('Failed to play audio:', err);
            showNotification('Ошибка воспроизведения');
        });
    } else {
        audio.pause();
        button.textContent = '▶';
    }
    
    // Обновление прогресса
    audio.ontimeupdate = () => {
        if (audio.duration) {
            const progress = (audio.currentTime / audio.duration) * 100;
            if (progressBar) progressBar.style.width = `${progress}%`;
            
            const currentMin = Math.floor(audio.currentTime / 60);
            const currentSec = Math.floor(audio.currentTime % 60);
            if (durationSpan) {
                durationSpan.textContent = `${currentMin}:${currentSec.toString().padStart(2, '0')}`;
            }
        }
    };
    
    // Загрузка метаданных
    audio.onloadedmetadata = () => {
        const minutes = Math.floor(audio.duration / 60);
        const seconds = Math.floor(audio.duration % 60);
        if (durationSpan && audio.currentTime === 0) {
            durationSpan.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
    };
    
    // Конец воспроизведения
    audio.onended = () => {
        button.textContent = '▶';
        audio.currentTime = 0;
        if (progressBar) progressBar.style.width = '0%';
        if (durationSpan) {
            const minutes = Math.floor(audio.duration / 60);
            const seconds = Math.floor(audio.duration % 60);
            durationSpan.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
    };
}

// Видео кружок
async function startVideoRecording() {
    if (!appData.currentChatId) {
        showNotification('Выберите чат');
        return;
    }
    
    try {
        appData.videoStream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                width: { ideal: 400 }, 
                height: { ideal: 400 },
                facingMode: 'user'
            }, 
            audio: true 
        });
        
        const videoPreview = document.getElementById('videoPreview');
        videoPreview.srcObject = appData.videoStream;
        
        document.getElementById('videoModal').classList.add('active');
        document.getElementById('sendVideo').style.display = 'none';
        document.getElementById('recordVideo').textContent = '⏺';
        document.getElementById('recordVideo').classList.remove('recording');
    } catch (err) {
        console.error('Camera access error:', err);
        showNotification('Не удалось получить доступ к камере');
    }
}

function toggleVideoRecording() {
    const recordBtn = document.getElementById('recordVideo');
    const sendBtn = document.getElementById('sendVideo');
    
    if (!appData.videoStream) {
        showNotification('Камера не подключена');
        return;
    }
    
    if (!appData.mediaRecorder || appData.mediaRecorder.state === 'inactive') {
        // Начать запись
        try {
            const options = { mimeType: 'video/webm;codecs=vp8,opus' };
            
            // Проверяем поддержку формата
            if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                options.mimeType = 'video/webm';
            }
            
            appData.mediaRecorder = new MediaRecorder(appData.videoStream, options);
            appData.recordedChunks = [];
            
            appData.mediaRecorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) {
                    console.log('[Video] Chunk received:', e.data.size, 'bytes');
                    appData.recordedChunks.push(e.data);
                }
            };
            
            appData.mediaRecorder.onerror = (e) => {
                console.error('[Video] Recording error:', e);
                showNotification('Ошибка записи видео');
            };
            
            appData.mediaRecorder.start(100); // Записываем чанки каждые 100ms
            console.log('[Video] Recording started');
            
            recordBtn.textContent = '⏹';
            recordBtn.classList.add('recording');
            sendBtn.style.display = 'none';
        } catch (err) {
            console.error('[Video] Failed to start recording:', err);
            showNotification('Ошибка начала записи');
        }
    } else {
        // Остановить запись
        console.log('[Video] Stopping recording...');
        appData.mediaRecorder.stop();
        recordBtn.textContent = '⏺';
        recordBtn.classList.remove('recording');
        
        // Показываем кнопку отправки после остановки
        setTimeout(() => {
            if (appData.recordedChunks.length > 0) {
                sendBtn.style.display = 'block';
                console.log('[Video] Recording stopped, chunks:', appData.recordedChunks.length);
            } else {
                showNotification('Нет записанных данных');
            }
        }, 500);
    }
}

function cancelVideoRecording() {
    console.log('[Video] Cancelling recording');
    
    if (appData.mediaRecorder) {
        if (appData.mediaRecorder.state === 'recording') {
            appData.mediaRecorder.stop();
        }
        appData.mediaRecorder = null;
    }
    
    if (appData.videoStream) {
        appData.videoStream.getTracks().forEach(track => {
            track.stop();
            console.log('[Video] Track stopped:', track.kind);
        });
        appData.videoStream = null;
    }
    
    const videoPreview = document.getElementById('videoPreview');
    if (videoPreview) {
        videoPreview.srcObject = null;
    }
    
    document.getElementById('videoModal').classList.remove('active');
    document.getElementById('sendVideo').style.display = 'none';
    document.getElementById('recordVideo').textContent = '⏺';
    document.getElementById('recordVideo').classList.remove('recording');
    
    appData.recordedChunks = [];
}

async function sendVideoMessage() {
    if (!appData.recordedChunks || appData.recordedChunks.length === 0) {
        showNotification('Нет записанного видео');
        return;
    }
    
    console.log('[Video] Preparing to send, chunks:', appData.recordedChunks.length);
    
    try {
        // Определяем MIME тип из первого чанка
        const mimeType = appData.recordedChunks[0].type || 'video/webm';
        const blob = new Blob(appData.recordedChunks, { type: mimeType });
        
        console.log('[Video] Blob created:', blob.size, 'bytes, type:', blob.type);
        
        if (blob.size === 0) {
            showNotification('Видео пустое, попробуйте еще раз');
            cancelVideoRecording();
            return;
        }
        
        const file = new File([blob], `video_${Date.now()}.webm`, { type: mimeType });
        
        showNotification('Отправка видео...');
        
        await API.messages.send({
            chatId: appData.currentChatId,
            content: 'Видео кружок',
            type: 'video',
            file: file
        });
        
        console.log('[Video] Sent successfully');
        // Сообщение придет через WebSocket
    } catch (error) {
        console.error('[Video] Failed to send:', error);
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


// Периодическое обновление списка чатов (каждые 30 секунд)
setInterval(() => {
    if (AuthStorage.getToken() && !document.hidden) {
        loadChats();
    }
}, 30000);

// Обновление при возврате на вкладку
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && AuthStorage.getToken()) {
        loadChats();
        
        // Переподключаем WebSocket если отключен
        if (!appData.ws || appData.ws.readyState !== WebSocket.OPEN) {
            connectWebSocket();
        }
    }
});

// Обработка потери соединения
window.addEventListener('online', () => {
    showNotification('Соединение восстановлено');
    if (AuthStorage.getToken()) {
        loadChats();
        if (!appData.ws || appData.ws.readyState !== WebSocket.OPEN) {
            connectWebSocket();
        }
    }
});

window.addEventListener('offline', () => {
    showNotification('Нет соединения с интернетом');
});

// Предотвращение случайного закрытия при записи
window.addEventListener('beforeunload', (e) => {
    if (appData.mediaRecorder && appData.mediaRecorder.state === 'recording') {
        e.preventDefault();
        e.returnValue = 'Идет запись. Вы уверены, что хотите покинуть страницу?';
        return e.returnValue;
    }
});
