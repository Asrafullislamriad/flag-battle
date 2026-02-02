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
    powerupsEnabled: true,
    particlesEnabled: true,
    soundEnabled: true,
    arenaColor: '#2ecc71',
    bgColor: '#000000',
    airDrag: 0.02,
    randomForce: 0.1,
    glowEffect: true,
    trailsEffect: true,
    gameVolume: 0.5,
    winnerBackgroundEnabled: true,
    musicVolume: 0.3
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

// All available countries
const ALL_COUNTRIES = [
    { code: 'bd', name: 'Bangladesh' }, { code: 'us', name: 'USA' }, { code: 'gb', name: 'UK' },
    { code: 'ca', name: 'Canada' }, { code: 'fr', name: 'France' }, { code: 'de', name: 'Germany' },
    { code: 'jp', name: 'Japan' }, { code: 'cn', name: 'China' }, { code: 'br', name: 'Brazil' },
    { code: 'in', name: 'India' }, { code: 'au', name: 'Australia' }, { code: 'ar', name: 'Argentina' },
    { code: 'sa', name: 'Saudi Arabia' }, { code: 'pk', name: 'Pakistan' }, { code: 'tr', name: 'Turkey' },
    { code: 'kr', name: 'South Korea' }, { code: 'id', name: 'Indonesia' }, { code: 'pt', name: 'Portugal' },
    { code: 'ru', name: 'Russia' }, { code: 'mx', name: 'Mexico' }, { code: 'es', name: 'Spain' },
    { code: 'ng', name: 'Nigeria' }, { code: 'vn', name: 'Vietnam' }, { code: 'th', name: 'Thailand' },
    { code: 'my', name: 'Malaysia' }, { code: 'ph', name: 'Philippines' }, { code: 'it', name: 'Italy' },
    { code: 'za', name: 'South Africa' }, { code: 'eg', name: 'Egypt' }, { code: 'se', name: 'Sweden' },
    { code: 'no', name: 'Norway' }, { code: 'fi', name: 'Finland' }, { code: 'dk', name: 'Denmark' },
    { code: 'nz', name: 'New Zealand' }, { code: 'gr', name: 'Greece' }, { code: 'pl', name: 'Poland' },
    { code: 'ua', name: 'Ukraine' }, { code: 'co', name: 'Colombia' }, { code: 'pe', name: 'Peru' },
    { code: 'cl', name: 'Chile' }, { code: 'ir', name: 'Iran' }, { code: 'iq', name: 'Iraq' },
    { code: 'ae', name: 'UAE' }, { code: 'sg', name: 'Singapore' }, { code: 'nl', name: 'Netherlands' },
    { code: 'be', name: 'Belgium' }, { code: 'ch', name: 'Switzerland' }, { code: 'at', name: 'Austria' }
];

// Default background music URL (local file)
const DEFAULT_MUSIC_URL = 'default music.mp3';

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
        Object.assign(config, saved);
        applySettings();
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
