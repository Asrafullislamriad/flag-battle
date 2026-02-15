// ============================================
// CONFIG.JS - Game Configuration & Constants
// ============================================

// Game configuration with safe defaults for long-running streams
let config = {
    thickness: 20,
    bounce: 1.2,
    scale: 1.0,
    gravity: 0.0,
    rotationSpeed: 0.018,
    flagCount: 40,
    circlePercent: 0.44,
    powerupsEnabled: false,        // ✅ Default OFF
    particlesEnabled: false,       // ✅ Default OFF
    soundEnabled: false,           // ✅ Default OFF
    arenaColor: '#2ecc71',
    bgColor: '#000000',
    airDrag: 0.02,
    randomForce: 0.1,
    glowEffect: false,             // ✅ Default OFF
    trailsEffect: false,           // ✅ Default OFF
    gameVolume: 0.5,
    winnerBackgroundEnabled: false, // ✅ Default OFF
    winnerProfileEnabled: true,     // 🆕 Show winner profile pic as bg
    bgType: 'gradient',             // 🆕 gradient, solid, image, video
    customBgImage: null,            // 🆕 Base64 image
    customBgVideo: null,            // 🆕 Base64/URL video
    musicVolume: 0.3,
    profileSize: 32,                // 🆕 YouTube profile resolution (s32, s64, etc.)
    flagBorderEnabled: false,       // 🆕 Draw border around flags
    showPlayerNames: true,          // 🆕 Show names/profile pics below flags
    roundFlagsEnabled: false,       // 🆕 Use circular flag shapes
    rotationEnabled: true,          // 🆕 Flag rotation (rolling)
    gapSize: 50 // Degrees
};

const defaultConfig = { ...config };

// Maximum limits to prevent memory issues during long streams
const MAX_PARTICLES = 500;
const MAX_FLAGS = 60; // Reduced from 80 for stability
const MAX_POWERUPS = 5;
const PARTICLE_CLEANUP_INTERVAL = 5000; // Clean up every 5 seconds
const MEMORY_CLEANUP_INTERVAL = 60000; // Full cleanup every minute

// Power-up types
const POWERUP_TYPES = {
    SPEED: { emoji: '⚡', color: '#f39c12', effect: 'speed' },
    SHIELD: { emoji: '🛡️', color: '#3498db', effect: 'shield' },
    GROW: { emoji: '📈', color: '#e74c3c', effect: 'grow' },
    SHRINK: { emoji: '📉', color: '#9b59b6', effect: 'shrink' },
    GRAVITY: { emoji: '🌀', color: '#1abc9c', effect: 'gravity' }
};

// All available countries are now loaded from ../../core/countries.js
// Access via window.ALL_COUNTRIES

// Default background music URL (local file)
const DEFAULT_MUSIC_URL = '../assets/music/1.mp3';

// Stats storage
let gameStats = {};

// Safe localStorage operations with error handling
function safeLocalStorageSet(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (e) {
        console.warn('LocalStorage error:', e.message);
        return false;
    }
}

function safeLocalStorageGet(key) {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : null;
    } catch (e) {
        console.warn('LocalStorage error:', e.message);
        return null;
    }
}

function loadStats() {
    const saved = safeLocalStorageGet('flagBattleStats');
    if (saved) {
        gameStats = saved;
    }
}

function saveStats() {
    safeLocalStorageSet('flagBattleStats', gameStats);
}

function saveSettings() {
    safeLocalStorageSet('flagBattleSettings', config);
}

function loadSettings() {
    const saved = safeLocalStorageGet('flagBattleSettings');
    if (saved) {
        // Safe merge to avoid losing new default keys
        Object.keys(saved).forEach(key => {
            if (config.hasOwnProperty(key)) {
                config[key] = saved[key];
            }
        });
        if (typeof applySettings === 'function') applySettings();
    }
}

function updateStats(country, won) {
    if (!gameStats[country.code]) {
        gameStats[country.code] = { name: country.name, wins: 0, losses: 0 };
    }
    if (won) {
        gameStats[country.code].wins++;
    } else {
        gameStats[country.code].losses++;
    }
    saveStats();
}

function resetStats() {
    if (confirm('সব স্ট্যাটিস্টিক্স মুছে ফেলবেন?')) {
        gameStats = {};
        saveStats();
        renderStatsTable();
    }
}

function renderStatsTable() {
    const tbody = document.getElementById('stats-tbody');
    tbody.innerHTML = '';

    const sorted = Object.entries(gameStats).sort((a, b) => b[1].wins - a[1].wins);

    sorted.forEach(([code, data]) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${data.name}</td>
            <td style="color: #2ecc71; font-weight: bold;">${data.wins}</td>
        `;
        tbody.appendChild(tr);
    });
}

function openStats() {
    renderStatsTable();
    document.getElementById('stats-modal').style.display = 'block';
}

function closeStats() {
    document.getElementById('stats-modal').style.display = 'none';
}

// applySettings removed - now handled in utils.js to avoid duplication

// load/saveAudioSettings removed - simplified to main config persistence

// Load settings on page load
window.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    loadLastWinner();
});

// 🆕 Last Winner Functions
function applyLastWinnerSize(size) {
    console.log('🎯 applyLastWinnerSize called with size:', size);
    const root = document.documentElement;
    root.style.setProperty('--last-winner-size', `${size}px`);
    localStorage.setItem('last_winner_size', size);
    console.log('💾 Last Winner size saved to localStorage:', size);
}

function updateLastWinner(name, imageUrl) {
    const lastWinnerImg = document.getElementById('last-winner-img');
    const lastWinnerName = document.getElementById('last-winner-name');

    if (lastWinnerImg && lastWinnerName) {
        lastWinnerImg.src = imageUrl;
        lastWinnerImg.classList.add('visible');
        lastWinnerName.innerText = name;

        // Save to localStorage
        localStorage.setItem('last_winner_name', name);
        localStorage.setItem('last_winner_image', imageUrl);

        console.log('🏆 Last Winner updated:', name);
    }
}

function loadLastWinner() {
    const savedName = localStorage.getItem('last_winner_name');
    const savedImage = localStorage.getItem('last_winner_image');

    if (savedName && savedImage) {
        updateLastWinner(savedName, savedImage);
    }
}
