// ✅ Keyboard Shortcut: Ctrl+H to toggle chat iframe
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'h') {
        e.preventDefault();
        const chatContainer = document.getElementById('live-chat-container');
        const isVisible = chatContainer.style.display !== 'none' &&
            chatContainer.style.width !== '1px';

        if (isVisible) {
            // Hide chat
            chatContainer.style.display = 'none';
            chatContainer.style.width = '1px';
            chatContainer.style.height = '1px';
            chatContainer.style.opacity = '0';
            chatContainer.style.pointerEvents = 'none';
            console.log('🙈 Chat hidden (Ctrl+H)');
        } else {
            // Show chat on right side
            chatContainer.style.display = 'block';
            chatContainer.style.position = 'fixed';
            chatContainer.style.top = '10px';
            chatContainer.style.right = '10px';
            chatContainer.style.width = '350px';
            chatContainer.style.height = '600px';
            chatContainer.style.opacity = '1';
            chatContainer.style.pointerEvents = 'auto';
            chatContainer.style.zIndex = '9999';
            chatContainer.style.border = '2px solid #2ecc71';
            chatContainer.style.borderRadius = '8px';
            chatContainer.style.boxShadow = '0 4px 20px rgba(0,0,0,0.5)';
            console.log('👁️ Chat visible (Ctrl+H)');
        }
    }
});

// ✅ Border Toggle Functionality
window.addEventListener('DOMContentLoaded', () => {
    const borderToggle = document.getElementById('flag-border-toggle');
    if (borderToggle) {
        // Load saved setting
        const savedBorder = localStorage.getItem('flag_border_enabled');
        if (savedBorder !== null) {
            borderToggle.checked = savedBorder === 'true';
        }

        borderToggle.addEventListener('change', () => {
            const enabled = borderToggle.checked;
            localStorage.setItem('flag_border_enabled', enabled);
            console.log('🖼️ Flag border:', enabled ? 'ON' : 'OFF');

            // Apply CSS class to body
            if (enabled) {
                document.body.classList.add('flag-borders-enabled');
            } else {
                document.body.classList.remove('flag-borders-enabled');
            }
        });

        // Apply initial state
        if (borderToggle.checked) {
            document.body.classList.add('flag-borders-enabled');
        }
    }
});
