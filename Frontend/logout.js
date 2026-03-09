// Добавьте кнопку выхода в настройки
function addLogoutButton() {
    const settingsContent = document.getElementById('mainSettings');
    if (!settingsContent) return;
    
    const logoutSection = document.createElement('div');
    logoutSection.className = 'settings-section';
    logoutSection.innerHTML = `
        <div class="setting-item" id="logoutBtn" style="cursor: pointer;">
            <div class="setting-icon">🚪</div>
            <div class="setting-info">
                <div class="setting-label">Выйти</div>
                <div class="setting-description">Выход из аккаунта</div>
            </div>
            <span class="setting-arrow">›</span>
        </div>
    `;
    
    settingsContent.appendChild(logoutSection);
    
    document.getElementById('logoutBtn').addEventListener('click', () => {
        if (confirm('Вы уверены, что хотите выйти?')) {
            AuthStorage.removeToken();
            AuthStorage.removeUser();
            if (appData.ws) {
                appData.ws.close();
            }
            window.location.href = 'auth.html';
        }
    });
}

// Вызовите эту функцию после инициализации настроек
setTimeout(addLogoutButton, 200);
