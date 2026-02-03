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

// All available countries (Expanded World List)
const ALL_COUNTRIES = [
    // Asia
    { code: 'bd', name: 'Bangladesh' }, { code: 'in', name: 'India' }, { code: 'pk', name: 'Pakistan' },
    { code: 'np', name: 'Nepal' }, { code: 'bt', name: 'Bhutan' }, { code: 'lk', name: 'Sri Lanka' },
    { code: 'cn', name: 'China' }, { code: 'jp', name: 'Japan' }, { code: 'kr', name: 'South Korea' },
    { code: 'id', name: 'Indonesia' }, { code: 'my', name: 'Malaysia' }, { code: 'ph', name: 'Philippines' },
    { code: 'th', name: 'Thailand' }, { code: 'vn', name: 'Vietnam' }, { code: 'sg', name: 'Singapore' },
    { code: 'tw', name: 'Taiwan' }, { code: 'hk', name: 'Hong Kong' }, { code: 'mm', name: 'Myanmar' },
    { code: 'kh', name: 'Cambodia' }, { code: 'la', name: 'Laos' }, { code: 'af', name: 'Afghanistan' },
    { code: 'ir', name: 'Iran' }, { code: 'iq', name: 'Iraq' }, { code: 'sa', name: 'Saudi Arabia' },
    { code: 'ae', name: 'UAE' }, { code: 'qa', name: 'Qatar' }, { code: 'kw', name: 'Kuwait' },
    { code: 'om', name: 'Oman' }, { code: 'bh', name: 'Bahrain' }, { code: 'lb', name: 'Lebanon' },
    { code: 'jo', name: 'Jordan' }, { code: 'sy', name: 'Syria' }, { code: 'ye', name: 'Yemen' },
    { code: 'ps', name: 'Palestine' }, { code: 'tr', name: 'Turkey' },
    { code: 'az', name: 'Azerbaijan' }, { code: 'kz', name: 'Kazakhstan' }, { code: 'uz', name: 'Uzbekistan' },

    // Europe
    { code: 'gb', name: 'UK' }, { code: 'fr', name: 'France' }, { code: 'de', name: 'Germany' },
    { code: 'it', name: 'Italy' }, { code: 'es', name: 'Spain' }, { code: 'pt', name: 'Portugal' },
    { code: 'nl', name: 'Netherlands' }, { code: 'be', name: 'Belgium' }, { code: 'ch', name: 'Switzerland' },
    { code: 'at', name: 'Austria' }, { code: 'dk', name: 'Denmark' }, { code: 'no', name: 'Norway' },
    { code: 'se', name: 'Sweden' }, { code: 'fi', name: 'Finland' }, { code: 'is', name: 'Iceland' },
    { code: 'ie', name: 'Ireland' }, { code: 'pl', name: 'Poland' }, { code: 'ua', name: 'Ukraine' },
    { code: 'ru', name: 'Russia' }, { code: 'by', name: 'Belarus' }, { code: 'ro', name: 'Romania' },
    { code: 'bg', name: 'Bulgaria' }, { code: 'gr', name: 'Greece' }, { code: 'hu', name: 'Hungary' },
    { code: 'cz', name: 'Czech Republic' }, { code: 'sk', name: 'Slovakia' }, { code: 'hr', name: 'Croatia' },
    { code: 'rs', name: 'Serbia' }, { code: 'ba', name: 'Bosnia' }, { code: 'al', name: 'Albania' },

    // North & South America
    { code: 'us', name: 'USA' }, { code: 'ca', name: 'Canada' }, { code: 'mx', name: 'Mexico' },
    { code: 'br', name: 'Brazil' }, { code: 'ar', name: 'Argentina' }, { code: 'co', name: 'Colombia' },
    { code: 'pe', name: 'Peru' }, { code: 'cl', name: 'Chile' }, { code: 've', name: 'Venezuela' },
    { code: 'ec', name: 'Ecuador' }, { code: 'uy', name: 'Uruguay' }, { code: 'py', name: 'Paraguay' },
    { code: 'bo', name: 'Bolivia' }, { code: 'cu', name: 'Cuba' }, { code: 'jm', name: 'Jamaica' },
    { code: 'do', name: 'Dominican Rep' }, { code: 'ht', name: 'Haiti' }, { code: 'cr', name: 'Costa Rica' },
    { code: 'pa', name: 'Panama' },

    // Africa
    { code: 'eg', name: 'Egypt' }, { code: 'za', name: 'South Africa' }, { code: 'ng', name: 'Nigeria' },
    { code: 'ke', name: 'Kenya' }, { code: 'gh', name: 'Ghana' }, { code: 'ma', name: 'Morocco' },
    { code: 'dz', name: 'Algeria' }, { code: 'tn', name: 'Tunisia' }, { code: 'et', name: 'Ethiopia' },
    { code: 'tz', name: 'Tanzania' }, { code: 'ug', name: 'Uganda' }, { code: 'sd', name: 'Sudan' },
    { code: 'sn', name: 'Senegal' }, { code: 'cm', name: 'Cameroon' }, { code: 'ci', name: 'Ivory Coast' },
    { code: 'zw', name: 'Zimbabwe' },

    // Oceania
    { code: 'au', name: 'Australia' }, { code: 'nz', name: 'New Zealand' }, { code: 'fj', name: 'Fiji' },
    { code: 'pg', name: 'Papua New Guinea' }
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
