// Snake Game YouTube Chat Bridge
// Connects Snake Game with YouTube Live Chat via Electron IPC

console.log('🐍 Snake Game Bridge loaded');

// Check if running in Electron
const isElectron = typeof window !== 'undefined' && window.process && window.process.type === 'renderer';

if (isElectron) {
    const { ipcRenderer } = require('electron');

    // Listen for YouTube chat messages
    ipcRenderer.on('youtube-chat-message', (event, data) => {
        console.log('📨 Snake Game received chat message:', data);
        handleChatMessage(data);
    });

    console.log('✅ Snake Game IPC listener attached');
} else {
    console.warn('⚠️ Not running in Electron - YouTube chat disabled');
}

// Queue for viewer requests
window.viewerQueue = window.viewerQueue || [];

// Handle incoming chat messages
function handleChatMessage(data) {
    const { username, message, profilePic } = data;

    // Parse message for country code or "me" command
    const msg = message.toLowerCase().trim();

    // Check if message is a spawn request
    if (msg === 'me' || msg === 'mee' || msg === 'meee') {
        // User wants to spawn with their profile
        console.log(`👤 Spawn request from @${username} (profile)`);
        queueViewerRequest({
            username,
            profilePic,
            isProfile: true,
            countryCode: null
        });
    } else {
        // Check if message is a country code
        const countryCode = resolveCountryFromMessage(msg);
        if (countryCode) {
            console.log(`🚩 Spawn request from @${username} (${countryCode})`);
            queueViewerRequest({
                username,
                profilePic,
                isProfile: false,
                countryCode
            });
        }
    }
}

// Resolve country code from message
function resolveCountryFromMessage(msg) {
    // Check if it's a direct country code (2 letters)
    if (msg.length === 2 && /^[a-z]{2}$/.test(msg)) {
        return msg.toUpperCase();
    }

    // Check country aliases
    if (window.COUNTRY_ALIASES && window.COUNTRY_ALIASES[msg]) {
        return window.COUNTRY_ALIASES[msg].toUpperCase();
    }

    // Check full country names
    if (window.ALL_COUNTRIES) {
        const country = window.ALL_COUNTRIES.find(c =>
            c.name.toLowerCase() === msg ||
            c.code.toLowerCase() === msg
        );
        if (country) return country.code.toUpperCase();
    }

    return null;
}

// Queue viewer request
function queueViewerRequest(request) {
    window.viewerQueue.push(request);
    console.log(`📋 Viewer queued: @${request.username} (Queue size: ${window.viewerQueue.length})`);

    // Emit custom event for game to handle
    window.dispatchEvent(new CustomEvent('viewer-spawn-request', { detail: request }));
}

// Export for use in game.js
window.handleChatMessage = handleChatMessage;
window.resolveCountryFromMessage = resolveCountryFromMessage;
