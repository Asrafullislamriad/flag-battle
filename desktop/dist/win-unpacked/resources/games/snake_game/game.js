// Snake Battle Game Script

// --- Matter.js Aliases ---
const Engine = Matter.Engine,
    Render = Matter.Render,
    Runner = Matter.Runner,
    Bodies = Matter.Bodies,
    Composite = Matter.Composite,
    Constraint = Matter.Constraint,
    Events = Matter.Events,
    Vector = Matter.Vector,
    Body = Matter.Body;

// --- Config ---
const CONFIG = {
    pollingInterval: 500, // ms
    headSize: 20,      // Fallback
    bodySize: 14,
    snakeSpeed: 4,     // Default
    snakeLength: 7,    // Default segments
};

// --- Helper: Get Sizes based on Mode ---
function getSnakeSizes(mode, population) {
    if (mode === 1) return { head: 10, body: 6 };  // Tiny
    if (mode === 2) return { head: 14, body: 10 }; // Small
    if (mode === 3) return { head: 18, body: 14 }; // Medium
    if (mode === 4) return { head: 24, body: 18 }; // Large

    // Auto (0)
    if (population > 15) return { head: 14, body: 10 };
    if (population > 8) return { head: 18, body: 14 };
    return { head: 24, body: 18 };
}

// --- Image Cache & Optimization ---
const imgCache = {};
const circularCache = {}; // Pre-rendered sprites
const SPRITE_RES = 64;

function getCachedImage(url) {
    if (imgCache[url]) return imgCache[url];
    const img = new Image();
    img.src = url;
    imgCache[url] = img;
    return img;
}

function getCircularSprite(url) {
    if (circularCache[url]) return circularCache[url];
    const img = getCachedImage(url);
    if (!img.complete || img.naturalHeight === 0) return null;

    const cvs = document.createElement('canvas');
    cvs.width = SPRITE_RES;
    cvs.height = SPRITE_RES;
    const ctx = cvs.getContext('2d');
    const center = SPRITE_RES / 2;
    const radius = SPRITE_RES / 2 - 2;

    ctx.fillStyle = '#1e1e1e';
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.save();
    ctx.clip();
    const scale = Math.max(SPRITE_RES / img.width, SPRITE_RES / img.height) * 1.2;
    const w = img.width * scale;
    const h = img.height * scale;
    ctx.drawImage(img, center - w / 2, center - h / 2, w, h);
    ctx.restore();
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    circularCache[url] = cvs;
    return cvs;
}

// --- Country Alias Map ---
// --- Shared Country Alias Map ---
// Populate aliases from window.ALL_COUNTRIES if available
const COUNTRY_ALIASES = {};
if (window.ALL_COUNTRIES) {
    window.ALL_COUNTRIES.forEach(c => {
        COUNTRY_ALIASES[c.name.toLowerCase()] = c.code;
    });
}
// Add common manual aliases
Object.assign(COUNTRY_ALIASES, {
    'uk': 'gb', 'england': 'gb', 'america': 'us', 'united states': 'us',
    'korea': 'kr', 'saudi': 'sa', 'dubai': 'ae'
});

function resolveCountryCode(code) {
    if (!code) return 'bd';
    const str = String(code).trim();

    // Extract emoji flag (🇧🇩 → 'bd')
    const emojiMatch = str.match(/[\u{1F1E6}-\u{1F1FF}]{2}/u);
    if (emojiMatch) {
        const codePoints = [...emojiMatch[0]].map(c => c.codePointAt(0) - 0x1F1E6 + 65);
        return String.fromCharCode(...codePoints).toLowerCase();
    }

    const lower = str.toLowerCase();
    // Check exact match in shared list via aliases
    if (COUNTRY_ALIASES[lower]) return COUNTRY_ALIASES[lower];

    // Return 2-letter code if valid, otherwise fallback
    return (lower.length === 2 ? lower : lower.substring(0, 2));
}

// --- Audio & TTS ---
const AudioContext = window.AudioContext || window.webkitAudioContext;
window.audioCtx = new AudioContext();
const audioCtx = window.audioCtx;
let audioUnlocked = false;

// Background Music
const bgMusic = new Audio('../assets/music/1.mp3');
bgMusic.loop = true;
bgMusic.volume = 0.5; // Default 50%

// Volume settings
let musicVolume = 0.5;
let sfxVolume = 1.0;

// Unlock audio on first user interaction
function unlockAudio() {
    if (audioUnlocked) return;
    audioCtx.resume().then(() => {
        audioUnlocked = true;
        console.log('🔊 Audio Unlocked');
        // Start background music after unlock
        bgMusic.play().catch(e => console.warn('Music autoplay blocked:', e));
    });
}

// Auto-unlock on any interaction
document.addEventListener('click', unlockAudio, { once: false });
document.addEventListener('keydown', unlockAudio, { once: false });
document.addEventListener('touchstart', unlockAudio, { once: false });

// Try to unlock immediately
setTimeout(() => {
    if (!audioUnlocked) {
        audioCtx.resume().then(() => {
            audioUnlocked = true;
            console.log('🔊 Audio Auto-Unlocked');
            bgMusic.play().catch(e => console.warn('Music autoplay blocked:', e));
        }).catch(() => {
            console.log('⚠️ Audio needs user interaction');
        });
    }
}, 100);

function playTone(freq, duration, volume = 0.15) {
    if (!audioUnlocked) {
        unlockAudio();
        return;
    }
    try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(volume * sfxVolume, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    } catch (e) {
        console.warn('Audio error:', e);
    }
}

function playSpawnSound() {
    console.log('🔊 Playing spawn sound...');
    playTone(440, 0.1);
    setTimeout(() => playTone(550, 0.1), 100);
}

function playEliminationSound() {
    playTone(200, 0.2);
    setTimeout(() => playTone(150, 0.3), 150);
}

function speakWinner(text) {
    if ('speechSynthesis' in window) {
        const msg = new SpeechSynthesisUtterance(text);
        msg.rate = 1;
        msg.pitch = 1;
        window.speechSynthesis.speak(msg);
    }
}

// --- Snake Class ---
class Snake {
    constructor(countryCode, username, profilePic, isBot = false) {
        this.id = Math.random().toString(36).substr(2, 9);
        this.country = resolveCountryCode(countryCode);
        this.username = username || countryCode;
        this.profilePic = profilePic;
        this.isBot = isBot; // Track if this is a bot
        this.parts = [];
        this.constraints = [];
        this.isDead = false;
        this.kills = 0; // Track Kills

        // --- SIZING ---
        const manualMode = parseInt(localStorage.getItem('snakeScaleMode') || '0');
        const sizes = getSnakeSizes(manualMode, snakes.length);
        this.headSize = sizes.head;
        this.bodySize = sizes.body;

        // Spawn Position
        const margin = 150;
        const x = margin + Math.random() * (width - margin * 2);
        const y = margin + Math.random() * (height - margin * 2);

        console.log(`%c 📍 SPAWN COORDS: [${Math.round(x)}, ${Math.round(y)}] for ${this.country}`, "color: #fab1a0");

        if (isNaN(x) || isNaN(y)) {
            console.error("❌ SPAWN FAILED: Invalid Coordinates");
            return;
        }

        this.direction = Vector.normalise({
            x: (Math.random() - 0.5),
            y: (Math.random() - 0.5)
        });

        this.createSnake(x, y);
    }

    createSnake(startX, startY) {
        const collisionGroup = Body.nextGroup(true);

        // Fix "ad" (Andorra) blocked by ad-blockers -> use "andorra"
        const filename = this.country === 'ad' ? 'andorra' : this.country;

        // Head: Use profile pic if available, otherwise flag (LOCAL)
        this.headUrl = this.profilePic || `../assets/flags/${filename}.png`;

        // Body: Use flag (LOCAL)
        this.flagUrl = `../assets/flags/${filename}.png`;

        // Trigger loads
        getCachedImage(this.headUrl);
        getCachedImage(this.flagUrl);

        console.log(`%c 🔧 CREATING BODIES for ${this.country}...`, "color: #dfe6e9");

        // HEAD
        this.head = Bodies.circle(startX, startY, this.headSize, {
            frictionAir: 0,
            friction: 0,
            restitution: 1.0,
            inertia: Infinity,
            label: 'head',
            snakeId: this.id,
            collisionFilter: { group: collisionGroup },
            render: { visible: false }
        });
        this.parts.push(this.head);

        // BODY
        let prevBody = this.head;
        for (let i = 0; i < CONFIG.snakeLength; i++) {
            const bodyPart = Bodies.circle(
                startX - (i + 1) * 10,
                startY,
                this.bodySize,
                {
                    frictionAir: 0.1,
                    restitution: 0.8,
                    label: 'body',
                    snakeId: this.id,
                    collisionFilter: { group: collisionGroup },
                    render: { visible: false }
                }
            );
            this.parts.push(bodyPart);

            const constraint = Constraint.create({
                bodyA: prevBody,
                bodyB: bodyPart,
                stiffness: 0.6,
                damping: 0.1,
                length: this.bodySize * 1.8,
                render: { visible: false }
            });
            this.constraints.push(constraint);
            prevBody = bodyPart;
        }
        Composite.add(world, [...this.parts, ...this.constraints]);
    }

    kill() {
        if (this.isDead) return;
        this.isDead = true;
        playEliminationSound();
        Composite.remove(world, [...this.parts, ...this.constraints]);
        snakes = snakes.filter(s => s.id !== this.id);
        // Notification removed
    }

    cutTail(hitBodyPart) {
        const index = this.parts.indexOf(hitBodyPart);
        if (index <= 0) return;
        const deadParts = this.parts.slice(index);
        const deadConstraints = this.constraints.slice(index - 1);
        Composite.remove(world, [...deadParts, ...deadConstraints]);
        this.parts = this.parts.slice(0, index);
        this.constraints = this.constraints.slice(0, index - 1);

        // Strict Elimination
        if (this.parts.length <= 2) this.kill();
    }

    update() {
        if (this.isDead) return;
        const pos = this.head.position;
        const buffer = this.headSize;

        // Bounce
        if (pos.x < buffer) this.direction.x = Math.abs(this.direction.x);
        else if (pos.x > width - buffer) this.direction.x = -Math.abs(this.direction.x);
        if (pos.y < buffer) this.direction.y = Math.abs(this.direction.y);
        else if (pos.y > height - buffer) this.direction.y = -Math.abs(this.direction.y);

        // Move
        Body.setVelocity(this.head, {
            x: this.direction.x * CONFIG.snakeSpeed,
            y: this.direction.y * CONFIG.snakeSpeed
        });
        Body.setAngle(this.head, 0);
    }
}

// --- Engine ---
const engine = Engine.create();
const world = engine.world;
engine.gravity.y = 0;
engine.gravity.x = 0;
let snakes = [];
let width = window.innerWidth;
let height = window.innerHeight;

const render = Render.create({
    element: document.body,
    engine: engine,
    options: {
        width: width, height: height,
        wireframes: false, background: 'transparent',
        pixelRatio: window.devicePixelRatio
    }
});

// Set canvas z-index to appear above bottom panels
render.canvas.style.position = 'absolute';
render.canvas.style.top = '0';
render.canvas.style.left = '0';
render.canvas.style.zIndex = '10'; // Above panels (z-index: 0)
render.canvas.style.pointerEvents = 'none'; // Allow clicks to pass through to UI elements

Render.run(render);
const runner = Runner.create();
Runner.run(runner, engine);

// --- Walls ---
const wallThickness = 100;
const walls = [
    Bodies.rectangle(width / 2, -wallThickness / 2, width, wallThickness, { isStatic: true, label: 'wall' }),
    Bodies.rectangle(width / 2, height + wallThickness / 2, width, wallThickness, { isStatic: true, label: 'wall' }),
    Bodies.rectangle(width + wallThickness / 2, height / 2, wallThickness, height, { isStatic: true, label: 'wall' }),
    Bodies.rectangle(-wallThickness / 2, height / 2, wallThickness, height, { isStatic: true, label: 'wall' })
];
Composite.add(world, walls);

// --- Render Loop (Optimized) ---
let frameCount = 0;
Events.on(render, 'afterRender', () => {
    frameCount++;
    if (frameCount % 600 === 0) { // Log every ~10 seconds
        console.log(`%c 🎨 RENDER LOOP ACTIVE: ${snakes.length} snakes visible`, "color: #55efc4");
    }

    const ctx = render.context;
    snakes.forEach(snake => {
        if (snake.isDead) return;
        for (let i = snake.parts.length - 1; i >= 0; i--) {
            const part = snake.parts[i];
            const isHead = (i === 0);
            const size = isHead ? snake.headSize : snake.bodySize;
            let imgUrl = isHead ? snake.headUrl : snake.flagUrl;

            // Fallback: If body flag fails and profile pic exists, use it
            if (!isHead && snake.profilePic) {
                const flagSprite = getCircularSprite(snake.flagUrl);
                if (!flagSprite) {
                    imgUrl = snake.profilePic; // Use profile pic for body if flag failed
                }
            }

            // Get Pre-rendered Sprite
            const sprite = getCircularSprite(imgUrl);

            ctx.save();
            ctx.translate(part.position.x | 0, part.position.y | 0);

            if (sprite) {
                // Optimized Draw
                ctx.drawImage(sprite, -size, -size, size * 2, size * 2);
            } else {
                ctx.beginPath();
                ctx.arc(0, 0, size, 0, 2 * Math.PI);
                ctx.fillStyle = isHead ? '#e67e22' : '#ecf0f1';
                ctx.fill();
                ctx.lineWidth = 2;
                ctx.strokeStyle = '#fff';
                ctx.stroke();
            }
            ctx.restore();
        }
        // Name
        const pos = snake.head.position;
        ctx.font = "bold 12px 'Outfit', sans-serif";
        ctx.textAlign = "center";
        ctx.fillStyle = "white";
        ctx.strokeStyle = "black";
        ctx.lineWidth = 3;
        ctx.strokeText(snake.username, pos.x, pos.y - (snake.headSize + 10));
        ctx.fillText(snake.username, pos.x, pos.y - (snake.headSize + 10));
    });
});

// --- Collisions (Kill Credit) ---
Events.on(engine, 'collisionStart', (event) => {
    event.pairs.forEach((pair) => {
        const bodyA = pair.bodyA;
        const bodyB = pair.bodyB;
        if (!bodyA.label || !bodyB.label) return;
        const snakeA = snakes.find(s => s.id === bodyA.snakeId);
        const snakeB = snakes.find(s => s.id === bodyB.snakeId);
        if (!snakeA || !snakeB || snakeA === snakeB) return;

        if (bodyA.label === 'head' && bodyB.label === 'head') {
            snakeA.kill(); snakeB.kill();
        } else if (bodyA.label === 'head' && bodyB.label === 'body') {
            snakeB.cutTail(bodyB);
            snakeA.kills++;
        } else if (bodyA.label === 'body' && bodyB.label === 'head') {
            snakeA.cutTail(bodyA);
            snakeB.kills++;
        }
    });
});

// --- Loop ---
Events.on(engine, 'beforeUpdate', () => {
    snakes.forEach(s => s.update());
});

// --- Spawn Logic ---
function spawnSnake(data, isBot = false) {
    console.log('📥 spawnSnake called with:', data, 'isBot:', isBot);

    let country = 'un';
    let user = 'Player';
    let pic = null;

    // Handle various data formats
    if (typeof data === 'string') {
        country = data;
    } else if (typeof data === 'object') {
        // Try to extract emoji from comment/message first (like Flag Battle)
        const comment = data.comment || data.message || data.text || '';
        const emojiMatch = String(comment).match(/[\u{1F1E6}-\u{1F1FF}]{2}/u);

        if (emojiMatch) {
            // Extract country code from emoji flag
            const codePoints = [...emojiMatch[0]].map(c => c.codePointAt(0) - 0x1F1E6 + 65);
            country = String.fromCharCode(...codePoints).toLowerCase();
            console.log(`   🚩 Emoji from comment: ${emojiMatch[0]} → ${country}`);
        } else {
            // Fallback to country field
            country = data.country || data.code || 'bd';
        }

        user = data.username || data.nickname || data.user || 'Player';
        pic = data.profilePic || data.profilePictureUrl || data.avatar || null;
    }

    // Validate & resolve country code
    country = resolveCountryCode(country);

    // Only log and sound for real players
    if (!isBot) {
        lastRealPlayerSpawnTime = Date.now(); // Track real player spawn time
        console.log(`%c 🚀 ATTEMPTING LIVE SPAWN: ${country} (%c${user}%c)`, "color: #00d2d3; font-weight:bold;", "color: #f39c12", "color: #00d2d3");
        console.log(`   📊 Spawn Data:`, { country, user, pic });
        playSpawnSound();
    }

    const s = new Snake(country, user, pic, isBot);
    snakes.push(s);

    // Save stats immediately for this spawn
    const soldierKey = `${user}_${country}`;
    if (!persistentStats.soldiers[soldierKey]) {
        persistentStats.soldiers[soldierKey] = {
            username: user,
            country: country,
            spawns: 0,
            profilePic: pic
        };
    }
    persistentStats.soldiers[soldierKey].spawns += 1;
    savePersistentStats(persistentStats);

    return s;
}

// --- EXTERNAL CONNECTIONS (For Extension) ---
console.log("%c 🐍 SNAKE BATTLE ENGINE READY ", "background: #2ecc71; color: black; font-size: 12px; font-weight: bold;");

// 1. Expose function aliases (Extensions might look for these)
window.spawnSnake = spawnSnake;

// 2. Helper to clear persistent stats (for testing)
window.clearStats = function () {
    localStorage.removeItem('snakeGameStats');
    persistentStats = { soldiers: {}, countries: {} };
    console.log('🗑️ Persistent stats cleared!');
    location.reload();
};
console.log("%c 💡 TIP: Type clearStats() in console to reset leaderboard", "color: #95a5a6; font-style: italic;");
window.addPlayer = spawnSnake; // Common alias
window.spawn = spawnSnake;     // Common alias
window.f_spawn = spawnSnake;

// 2. Listen for 'message' events (Broad Catch)
window.addEventListener('message', (event) => {
    // Filter out React/internal noise, but KEEP everything else for debug
    if (event.data?.source === 'react-devtools') return;

    // LOG EVERYTHING to see what the extension is sending!
    console.log("📨 RAW MSG:", event.data);

    const d = event.data;
    if (!d) return;

    // CASE A: Batch Array 
    if (Array.isArray(d)) {
        console.log(`%c 📦 Batch Received: ${d.length} items`, "background: #3498db; color: white; padding: 2px 5px; border-radius: 3px;");
        d.forEach(item => spawnSnake(item));
        return;
    }

    // CASE B: Object with 'list' or 'users'
    if (d.list && Array.isArray(d.list)) {
        console.log(`%c 📦 Named Batch Received: ${d.list.length} items`, "background: #3498db; color: white");
        d.list.forEach(item => spawnSnake(item));
        return;
    }

    // CASE C: Single Item (Action/Type based)
    if (d.action === 'spawn' || d.type === 'spawn' || d.event === 'gift' || d.event === 'comment') {
        spawnSnake(d);
    }
    // CASE D: Direct Object { country: '...' }
    else if (d.country || d.code || d.uniqueId) {
        spawnSnake(d);
    }
});

// 3. Custom Event
window.addEventListener('spawnSnakeEvent', (e) => {
    console.log("%c ⚡ CUSTOM EVENT TRIGGERED", "color: #e74c3c", e.detail);
    if (e.detail) spawnSnake(e.detail);
});

function logKill(msg) {
    // Kill Feed Logic kept for reference but not called for eliminations
    const feed = document.getElementById('kill-feed');
    if (feed) {
        const div = document.createElement('div');
        div.className = 'kill-msg';
        div.innerText = msg;
        feed.appendChild(div);
        setTimeout(() => div.remove(), 3000);
    }
}

// --- Bots ---
const BOT_COUNTRIES = ['us', 'gb', 'ca', 'de', 'fr', 'it', 'es', 'br', 'ar', 'jp', 'kr', 'in', 'bd', 'pk', 'sa', 'ae', 'tr', 'ru', 'cn', 'au'];

function spawnBot() {
    const randomCountry = BOT_COUNTRIES[Math.floor(Math.random() * BOT_COUNTRIES.length)];
    const randomId = Math.floor(Math.random() * 999);
    spawnSnake({ country: randomCountry, username: `Bot ${randomId}` }, true); // Pass isBot=true
}

// --- Persistent Stats System ---
let lastRealPlayerSpawnTime = 0;

// Load persistent stats from localStorage
function loadPersistentStats() {
    const saved = localStorage.getItem('snakeGameStats');
    return saved ? JSON.parse(saved) : { soldiers: {}, countries: {} };
}

// Save persistent stats to localStorage
function savePersistentStats(stats) {
    localStorage.setItem('snakeGameStats', JSON.stringify(stats));
}

let persistentStats = loadPersistentStats();

// Update persistent stats after round
function updatePersistentStats() {
    snakes.forEach(snake => {
        // Track ALL snakes (dead or alive, bot or real)

        // Update soldier stats (by username) - Track SPAWN COUNT
        const soldierKey = `${snake.username}_${snake.country}`;
        if (!persistentStats.soldiers[soldierKey]) {
            persistentStats.soldiers[soldierKey] = {
                username: snake.username,
                country: snake.country,
                spawns: 0,
                profilePic: snake.profilePic
            };
        }
        persistentStats.soldiers[soldierKey].spawns += 1; // Count each spawn

        // Update country stats
        if (!persistentStats.countries[snake.country]) {
            persistentStats.countries[snake.country] = { wins: 0 };
        }
        persistentStats.countries[snake.country].wins += 1;
    });

    savePersistentStats(persistentStats);
    console.log('💾 Persistent stats saved:', persistentStats);
}

// Duplicate timer logic removed (handled by gameLoop)

// Smart Bot Spawning with Last 5 Second Detection
const botInterval = setInterval(() => {
    const realPlayers = snakes.filter(s => !s.isBot && !s.isDead);
    const totalSnakes = snakes.filter(s => !s.isDead).length;

    // Check if we're in last 5 seconds AND real user spawned recently
    const timeSinceLastRealSpawn = Date.now() - lastRealPlayerSpawnTime;
    const inLastFiveSeconds = timeLeft <= 5;
    const recentRealActivity = timeSinceLastRealSpawn < 5000; // 5 seconds

    // Don't spawn bots if in last 5 seconds AND real user spawned recently
    if (inLastFiveSeconds && recentRealActivity) {
        console.log(`🚫 Bot spawn paused (Last 5s + Real user active)`);
        return;
    }

    // Spawn bots only if:
    // 1. Less than 3 real players AND
    // 2. Total snakes < 10
    if (realPlayers.length < 3 && totalSnakes < 10) {
        spawnBot();
    }
}, 2000);

// --- Resize ---
window.addEventListener('resize', () => {
    width = window.innerWidth;
    height = window.innerHeight;
    render.canvas.width = width;
    render.canvas.height = height;
    Body.setPosition(walls[0], { x: width / 2, y: -50 });
    Body.setPosition(walls[1], { x: width / 2, y: height + 50 });
    Body.setPosition(walls[2], { x: width + 50, y: height / 2 });
    Body.setPosition(walls[3], { x: -50, y: height / 2 });
});

// --- Settings Panel Logic ---
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeSettings = document.getElementById('close-settings');
const speedSlider = document.getElementById('speed-slider');
const speedVal = document.getElementById('speed-val');
const sizeSlider = document.getElementById('size-slider');
const sizeVal = document.getElementById('size-val');
const uiScaleSlider = document.getElementById('ui-scale-slider');
const uiOpacitySlider = document.getElementById('ui-opacity-slider');
const uiPosSlider = document.getElementById('ui-pos-slider');
const uiScaleVal = document.getElementById('ui-scale-val');
const uiOpacityVal = document.getElementById('ui-opacity-val');
const uiPosVal = document.getElementById('ui-pos-val');
const bottomPanels = document.getElementById('bottom-panels');

// Audio sliders
const musicVolSlider = document.getElementById('music-vol-slider');
const musicVolVal = document.getElementById('music-vol-val');
const sfxVolSlider = document.getElementById('sfx-vol-slider');
const sfxVolVal = document.getElementById('sfx-vol-val');

// Load saved volumes
const savedMusicVol = localStorage.getItem('musicVolume') || '50';
const savedSfxVol = localStorage.getItem('sfxVolume') || '100';

if (musicVolSlider) {
    musicVolSlider.value = savedMusicVol;
    musicVolume = parseInt(savedMusicVol) / 100;
    bgMusic.volume = musicVolume;
    if (musicVolVal) musicVolVal.innerText = `${savedMusicVol}%`;

    musicVolSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        musicVolume = val / 100;
        bgMusic.volume = musicVolume;
        if (musicVolVal) musicVolVal.innerText = `${val}%`;
        localStorage.setItem('musicVolume', val);
    });
}

if (sfxVolSlider) {
    sfxVolSlider.value = savedSfxVol;
    sfxVolume = parseInt(savedSfxVol) / 100;
    if (sfxVolVal) sfxVolVal.innerText = `${savedSfxVol}%`;

    sfxVolSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        sfxVolume = val / 100;
        if (sfxVolVal) sfxVolVal.innerText = `${val}%`;
        localStorage.setItem('sfxVolume', val);
    });
}

if (settingsBtn) settingsBtn.addEventListener('click', () => settingsModal.style.display = 'flex');
if (closeSettings) closeSettings.addEventListener('click', () => settingsModal.style.display = 'none');

const savedSpeed = localStorage.getItem('snakeSpeed');
if (savedSpeed) CONFIG.snakeSpeed = parseInt(savedSpeed);

const savedMode = localStorage.getItem('snakeScaleMode') || '0';

// Snake Specs
if (speedSlider) {
    speedSlider.value = CONFIG.snakeSpeed;
    if (speedVal) speedVal.innerText = CONFIG.snakeSpeed;
    speedSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        CONFIG.snakeSpeed = val;
        if (speedVal) speedVal.innerText = val;
        localStorage.setItem('snakeSpeed', val);
    });
}
if (sizeSlider) {
    sizeSlider.value = savedMode;
    updateSizeLabel(savedMode);
    sizeSlider.addEventListener('input', (e) => {
        const mode = parseInt(e.target.value);
        localStorage.setItem('snakeScaleMode', mode);
        updateSizeLabel(mode);
        snakes.forEach(snake => {
            const newSizes = getSnakeSizes(mode, snakes.length);
            const scaleHead = newSizes.head / snake.headSize;
            const scaleBody = newSizes.body / snake.bodySize;
            if (scaleHead !== 1 || scaleBody !== 1) {
                Body.scale(snake.head, scaleHead, scaleHead);
                snake.parts.forEach((part, i) => {
                    if (i === 0) return;
                    Body.scale(part, scaleBody, scaleBody);
                });
                snake.constraints.forEach(c => {
                    c.length = newSizes.body * 1.8;
                });
                snake.headSize = newSizes.head;
                snake.bodySize = newSizes.body;
            }
        });
    });
}

function updateSizeLabel(val) {
    const labels = ['Auto', 'Tiny', 'Small', 'Medium', 'Large'];
    if (sizeVal) sizeVal.innerText = labels[val] || 'Auto';
}

// UI Customization Logic
function updateUICardStyle() {
    if (!bottomPanels) return;
    const s = uiScaleSlider.value;
    const o = uiOpacitySlider.value;
    const p = uiPosSlider.value;

    // Apply scale and position to container (NOT opacity)
    bottomPanels.style.transform = `translateX(-50%) scale(${s}) translateY(-${p}px)`;

    // Apply opacity to individual panels (so snakes aren't affected)
    const panels = bottomPanels.querySelectorAll('.panel');
    panels.forEach(panel => {
        panel.style.opacity = o;
    });

    // Update labels
    if (uiScaleVal) uiScaleVal.innerText = `${s}x`;
    if (uiOpacityVal) uiOpacityVal.innerText = `${Math.round(o * 100)}%`;
    if (uiPosVal) uiPosVal.innerText = `${p}px`;

    // Save to LocalStorage (Optional, good UX)
    localStorage.setItem('uiSettings', JSON.stringify({ s, o, p }));
}

// Init UI Settings
const savedUI = JSON.parse(localStorage.getItem('uiSettings') || '{"s":1,"o":1,"p":0}');
if (uiScaleSlider) {
    uiScaleSlider.value = savedUI.s;
    uiOpacitySlider.value = savedUI.o;
    uiPosSlider.value = savedUI.p;

    uiScaleSlider.addEventListener('input', updateUICardStyle);
    uiOpacitySlider.addEventListener('input', updateUICardStyle);
    uiPosSlider.addEventListener('input', updateUICardStyle);

    // Apply initial
    updateUICardStyle();
}

if (settingsBtn) settingsBtn.addEventListener('click', () => settingsModal.style.display = 'block');
if (closeSettings) closeSettings.addEventListener('click', () => settingsModal.style.display = 'none');


// --- MATCH TIMER & LIST LOGIC ---
let timeLeft = 60; // Changed from 30 to 60 seconds
const timerEl = document.getElementById('game-timer');
const winnerModal = document.getElementById('winner-modal');
const listSoldiers = document.getElementById('list-soldiers');
const listCountries = document.getElementById('list-countries');

const gameLoop = setInterval(() => {
    timeLeft--;
    if (timerEl) timerEl.innerText = timeLeft;

    // --- 1. Update Left Panel: TOP SOLDIERS (Total Spawn Count - Persistent) ---
    if (listSoldiers) {
        // Get persistent stats and sort by spawn count
        const soldierEntries = Object.values(persistentStats.soldiers);

        // Check if we have any soldiers data
        if (soldierEntries.length === 0) {
            // Show empty state
            let html1 = '';
            for (let i = 0; i < 7; i++) {
                const rank = i + 1;
                html1 += `
                <div class="list-item">
                    <span class="rank-idx">${rank}</span>
                    <div class="li-content" style="opacity:0.3;">
                        <div class="li-flag" style="background:#333; border:none;"></div>
                        <span class="li-name">...</span>
                    </div>
                    <span class="li-score" style="opacity:0.3;">-</span>
                </div>`;
            }
            listSoldiers.innerHTML = html1;
        } else {
            // Show actual data
            const sortedSoldiers = soldierEntries.sort((a, b) => b.spawns - a.spawns);
            const top7Soldiers = sortedSoldiers.slice(0, 7);
            let html1 = '';

            for (let i = 0; i < 7; i++) {
                const soldier = top7Soldiers[i];
                const rank = i + 1;
                const isGold = rank === 1 ? 'gold' : '';

                if (soldier) {
                    const flagUrl = soldier.profilePic || `../assets/flags/${soldier.country}.png`;
                    html1 += `
                    <div class="list-item ${isGold}">
                        <span class="rank-idx">${rank}</span>
                        <div class="li-content">
                            <img src="${flagUrl}" class="li-flag">
                            <span class="li-name">${soldier.username}</span>
                        </div>
                        <span class="li-score">${soldier.spawns}</span>
                    </div>`;
                } else {
                    html1 += `
                    <div class="list-item">
                        <span class="rank-idx">${rank}</span>
                        <div class="li-content" style="opacity:0.3;">
                            <div class="li-flag" style="background:#333; border:none;"></div>
                            <span class="li-name">...</span>
                        </div>
                        <span class="li-score" style="opacity:0.3;">-</span>
                    </div>`;
                }
            }
            listSoldiers.innerHTML = html1;
        }
    }

    // --- 2. Update Right Panel: COUNTRY RANKING (Total Wins) ---
    if (listCountries) {
        const storedWins = JSON.parse(localStorage.getItem('snakeBattleWins') || '{}');
        const winEntries = Object.entries(storedWins).sort((a, b) => b[1] - a[1]);
        const top7Wins = winEntries.slice(0, 7);
        let html2 = '';

        for (let i = 0; i < 7; i++) {
            const entry = top7Wins[i];
            const rank = i + 1;
            const isGold = rank === 1 ? 'gold' : '';

            if (entry) {
                const [code, count] = entry;
                const flag = `../assets/flags/${code}.png`;
                html2 += `
                <div class="list-item ${isGold}">
                    <span class="rank-idx">${rank}</span>
                    <div class="li-content">
                        <img src="${flag}" class="li-flag">
                        <span class="li-name">${code.toUpperCase()}</span>
                    </div>
                    <span class="li-score">${count}</span>
                </div>`;
            } else {
                html2 += `
                <div class="list-item">
                    <span class="rank-idx">${rank}</span>
                    <div class="li-content" style="opacity:0.3;">
                        <div class="li-flag" style="background:#333; border:none;"></div>
                        <span class="li-name">...</span>
                    </div>
                    <span class="li-score" style="opacity:0.3;">-</span>
                </div>`;
            }
        }
        listCountries.innerHTML = html2;
    }

    if (timeLeft <= 0) {
        // Save persistent stats before ending round
        updatePersistentStats();

        clearInterval(gameLoop);
        clearInterval(botInterval);
        findAndDeclareChampion();
    }
}, 1000);

function findAndDeclareChampion() {
    if (snakes.length === 0) {
        setTimeout(() => location.reload(), 2000);
        return;
    }

    const sortedSnakes = [...snakes].sort((a, b) => b.kills - a.kills);
    const champion = sortedSnakes[0];

    // Track Wins
    const wins = JSON.parse(localStorage.getItem('snakeBattleWins') || '{}');
    const winKey = champion.country;
    wins[winKey] = (wins[winKey] || 0) + 1;
    localStorage.setItem('snakeBattleWins', JSON.stringify(wins));

    // Show Modal (Heroes Style)
    if (winnerModal) {
        winnerModal.style.display = 'block';

        // Populate Data
        document.getElementById('winner-flag').src = `../assets/flags/${champion.country}.png`;
        document.getElementById('winner-country-code').innerText = champion.country.toUpperCase();
        document.getElementById('winner-score').innerText = `${champion.kills} pts`; // Updated to "pts"

        document.getElementById('winner-avatar').src = champion.headUrl;
        document.getElementById('winner-name').innerText = champion.username;

        // Reset Progress Animation
        const fill = document.querySelector('.progress-fill');
        if (fill) {
            fill.style.animation = 'none';
            fill.offsetHeight;
            fill.style.animation = 'loadNext 6s linear forwards';
        }
    }

    const speechText = `Congratulations ${champion.username}! You are the champion!`;
    speakWinner(speechText);

    // Auto Restart (Soft)
    setTimeout(() => {
        softRestartGame();
    }, 6000);
}

function softRestartGame() {
    console.log("🔄 Soft Restarting Game...");

    // 1. Reset Game State
    timeLeft = 60;
    if (timerEl) timerEl.innerText = timeLeft;

    // 2. Clear Snakes & Physics Bodies
    snakes.forEach(s => {
        // Remove parts from world
        Composite.remove(world, [...s.parts, ...s.constraints]);
    });
    snakes = []; // Clear array

    // 3. Hide Winner Modal
    if (winnerModal) winnerModal.style.display = 'none';

    // 4. Restart Intervals
    startBotSpawner();
    startMatchTimer();
}

// ============================================
// BRIDGE POLLING SYSTEM (Extension Connection)
// ============================================
let bridgeConnected = false;

const urlParams = new URLSearchParams(window.location.search);
const isTestMode = urlParams.has('test');

if (isTestMode) {
    console.log('%c 🧪 TEST MODE ACTIVE: Bridge disconnected', 'background: #e67e22; color: #fff; font-size: 14px; padding: 4px; border-radius: 4px;');
}

setInterval(() => {
    if (isTestMode) return; // Don't poll in test mode

    fetch('http://localhost:3000/next')
        .then(res => res.json())
        .then(data => {
            // Connection Success
            if (!bridgeConnected) {
                bridgeConnected = true;
                console.log('%c [FLOW BRIDGE] Bridge script loaded', 'background: #2ecc71; color: #000; font-size: 14px; font-weight: bold;');
            }

            // Handle Batch Data
            if (data.batch && Array.isArray(data.batch)) {
                if (data.batch.length > 0) {
                    console.log(`%c [${new Date().toLocaleTimeString()}] 📦 Batch Received: ${data.batch.length} items`, 'background: #3498db; color: #fff; font-size: 12px;');
                    data.batch.forEach((item, index) => {
                        const logName = (typeof item === 'object' && item.country) ? item.country : String(item);
                        console.log(`   -> [${index + 1}/${data.batch.length}] Processing: ${String(logName).toUpperCase()}`);
                        spawnSnake(item);
                    });
                }
            }
            // Handle Single Item (Legacy)
            else if (data.winner || data.player) {
                const player = data.winner || data.player;
                const logName = (typeof player === 'object' && player.country) ? player.country : player;
                console.log(`%c [${new Date().toLocaleTimeString()}] 🚀 ATTEMPTING LIVE SPAWN: ${String(logName).toUpperCase()}`, 'background: #00d2d3; color: #000; font-size: 12px;');
                spawnSnake(player);
            }
        })
        .catch(err => {
            // Connection Failure (Silent)
            if (bridgeConnected) {
                bridgeConnected = false;
                console.log('%c 🔴 Bridge Disconnected: Check node bridge.js', 'background: #e74c3c; color: #fff; font-size: 14px; font-weight: bold;');
            }
        });
}, 500); // Poll every 0.5s
