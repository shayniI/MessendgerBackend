// Конфигурация API
const API_CONFIG = {
    BASE_URL: window.location.origin,
    API_URL: `${window.location.origin}/api`,
    WS_URL: `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`
};

// Хранилище токена
const AuthStorage = {
    getToken: () => localStorage.getItem('auth_token'),
    setToken: (token) => localStorage.setItem('auth_token', token),
    removeToken: () => localStorage.removeItem('auth_token'),
    getUser: () => {
        const user = localStorage.getItem('auth_user');
        return user ? JSON.parse(user) : null;
    },
    setUser: (user) => localStorage.setItem('auth_user', JSON.stringify(user)),
    removeUser: () => localStorage.removeItem('auth_user')
};

// API клиент
const API = {
    async request(endpoint, options = {}) {
        const token = AuthStorage.getToken();
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };
        
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`${API_CONFIG.API_URL}${endpoint}`, {
            ...options,
            headers
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Network error' }));
            throw new Error(error.error || 'Request failed');
        }

        return response.json();
    },

    // Auth
    auth: {
        register: (data) => API.request('/auth/register', {
            method: 'POST',
            body: JSON.stringify(data)
        }),
        login: (data) => API.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify(data)
        })
    },

    // Users
    users: {
        getMe: () => API.request('/users/me'),
        updateMe: (data) => API.request('/users/me', {
            method: 'PUT',
            body: JSON.stringify(data)
        }),
        search: (query) => API.request(`/users/search?q=${encodeURIComponent(query)}`),
        getContacts: () => API.request('/users/contacts'),
        addContact: (contactId) => API.request('/users/contacts', {
            method: 'POST',
            body: JSON.stringify({ contactId })
        })
    },

    // Chats
    chats: {
        getAll: () => API.request('/chats'),
        create: (data) => API.request('/chats', {
            method: 'POST',
            body: JSON.stringify(data)
        }),
        getMembers: (chatId) => API.request(`/chats/${chatId}/members`),
        addMember: (chatId, userId) => API.request(`/chats/${chatId}/members`, {
            method: 'POST',
            body: JSON.stringify({ userId })
        }),
        leave: (chatId) => API.request(`/chats/${chatId}/members/me`, {
            method: 'DELETE'
        })
    },

    // Messages
    messages: {
        getChat: (chatId, limit = 50, offset = 0) => 
            API.request(`/messages/chat/${chatId}?limit=${limit}&offset=${offset}`),
        send: async (data) => {
            if (data.file) {
                const formData = new FormData();
                formData.append('chatId', data.chatId);
                formData.append('type', data.type);
                if (data.content) formData.append('content', data.content);
                if (data.file) formData.append('file', data.file);
                if (data.replyTo) formData.append('replyTo', data.replyTo);

                const token = AuthStorage.getToken();
                const response = await fetch(`${API_CONFIG.API_URL}/messages`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    },
                    body: formData
                });

                if (!response.ok) throw new Error('Failed to send message');
                return response.json();
            }

            return API.request('/messages', {
                method: 'POST',
                body: JSON.stringify(data)
            });
        },
        update: (messageId, content) => API.request(`/messages/${messageId}`, {
            method: 'PUT',
            body: JSON.stringify({ content })
        }),
        delete: (messageId) => API.request(`/messages/${messageId}`, {
            method: 'DELETE'
        }),
        markRead: (messageId) => API.request(`/messages/${messageId}/read`, {
            method: 'POST'
        })
    }
};
