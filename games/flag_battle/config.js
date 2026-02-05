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
    musicVolume: 0.3,
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

// Update UI elements based on loaded config
function applySettings() {
    // Helper to safely set value if element exists
    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) {
            el.value = val;
            // Also update the text display next to slider if exists
            // ID pattern: [name]-slider -> [name]-val
            const displayId = id.replace('slider', 'val').replace('input', 'val');
            const displayEl = document.getElementById(displayId);
            if (displayEl) {
                // Formatting specific values
                if (id === 'circle-slider') displayEl.innerText = Math.round(val);
                else if (id === 'size-slider') displayEl.innerText = val.toFixed(1);
                else if (id === 'drag-slider') displayEl.innerText = val.toFixed(3);
                else if (id === 'speed-slider') displayEl.innerText = (val * 100).toFixed(1); // Approximate conversion back
                else displayEl.innerText = val;
            }
        }
    };

    const setCheck = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.checked = val;
    };

    setVal('circle-slider', config.circlePercent * 100);
    setVal('count-slider', config.flagCount);
    setVal('grav-slider', config.gravity);
    // Speed slider logic in game.js multiplies by 0.01, so we reverse it roughly for display
    // But simplified: just set value directly if we stored the raw slider value. 
    // Actually config stores the *result*, so we need to reverse calc or just set slider to match visual.
    // Let's just trust the config matches the slider ranges roughly.

    // Explicit mappings
    if (document.getElementById('speed-slider')) document.getElementById('speed-slider').value = config.rotationSpeed / 0.01;
    if (document.getElementById('speed-val')) document.getElementById('speed-val').innerText = (config.rotationSpeed / 0.01).toFixed(1);

    setVal('bounce-slider', config.bounce);
    setVal('thick-slider', config.thickness);
    setVal('gap-slider', config.gapSize);
    setVal('size-slider', config.scale);
    setVal('drag-slider', config.airDrag);
    setVal('force-slider', config.randomForce);

    setVal('game-vol-slider', config.gameVolume * 100);
    setVal('music-vol-slider', config.musicVolume * 100);

    setCheck('powerups-toggle', config.powerupsEnabled);
    setCheck('winner-bg-toggle', config.winnerBackgroundEnabled);
    setCheck('particles-toggle', config.particlesEnabled);
    setCheck('sound-toggle', config.soundEnabled);
    setCheck('glow-toggle', config.glowEffect);
    setCheck('trails-toggle', config.trailsEffect);

    // Apply colors
    if (document.getElementById('arena-color')) document.getElementById('arena-color').value = config.arenaColor;
    if (document.getElementById('bg-color')) document.getElementById('bg-color').value = config.bgColor;
}
