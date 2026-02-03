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
    img.crossOrigin = "Anonymous";
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
const COUNTRY_ALIASES = {
    'uk': 'gb', 'united kingdom': 'gb', 'england': 'gb',
    'usa': 'us', 'america': 'us', 'united states': 'us',
    'uae': 'ae', 'dubai': 'ae',
    'korea': 'kr', 'south korea': 'kr',
    'russia': 'ru', 'vietnam': 'vn', 'turkey': 'tr'
};
function resolveCountryCode(code) {
    if (!code) return 'un';
    code = code.toLowerCase().trim();
    return COUNTRY_ALIASES[code] || code;
}

// --- Audio & TTS ---
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();
let audioUnlocked = false;

window.addEventListener('click', () => {
    if (audioCtx.state === 'suspended') {
        audioCtx.resume().then(() => {
            audioUnlocked = true;
        });
    } else {
        audioUnlocked = true;
    }
}, { once: true });

function playSpawnSound() {
    if (!audioUnlocked || audioCtx.state === 'suspended') return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.1);
}

function playEliminationSound() {
    if (!audioUnlocked || audioCtx.state === 'suspended') return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(400, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.3);
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
    constructor(countryCode, username, profilePic) {
        this.id = Math.random().toString(36).substr(2, 9);
        this.country = resolveCountryCode(countryCode);
        this.username = username || countryCode;
        this.profilePic = profilePic;
        this.parts = [];
        this.constraints = [];
        this.isDead = false;
        this.kills = 0; // Track Kills

        // --- SIZING ---
        const manualMode = parseInt(localStorage.getItem('snakeScaleMode') || '0');
        const sizes = getSnakeSizes(manualMode, snakes.length);
        this.headSize = sizes.head;
        this.bodySize = sizes.body;

        // Spawn
        const margin = 150;
        const x = margin + Math.random() * (width - margin * 2);
        const y = margin + Math.random() * (height - margin * 2);
        this.direction = Vector.normalise({
            x: (Math.random() - 0.5),
            y: (Math.random() - 0.5)
        });

        this.createSnake(x, y);
    }

    createSnake(startX, startY) {
        const collisionGroup = Body.nextGroup(true);
        this.headUrl = this.profilePic || `https://flagcdn.com/w80/${this.country}.png`;
        this.flagUrl = `https://flagcdn.com/w80/${this.country}.png`;
        getCachedImage(this.headUrl);
        getCachedImage(this.flagUrl);

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
Events.on(render, 'afterRender', () => {
    const ctx = render.context;
    snakes.forEach(snake => {
        if (snake.isDead) return;
        for (let i = snake.parts.length - 1; i >= 0; i--) {
            const part = snake.parts[i];
            const isHead = (i === 0);
            const size = isHead ? snake.headSize : snake.bodySize;
            const imgUrl = isHead ? snake.headUrl : snake.flagUrl;

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
function spawnSnake(data) {
    let country = 'un';
    let user = 'Player';
    let pic = null;

    // Handle various data formats
    if (typeof data === 'string') {
        country = data;
    } else if (typeof data === 'object') {
        country = data.country || data.code || 'un';
        user = data.username || data.nickname || data.user || 'Player';
        pic = data.profilePic || data.profilePictureUrl || data.avatar || null;
    }

    // Validate Country Code
    if (!country || country.length > 3) country = 'un'; // Simple check

    // Check for duplicates/spam if needed? For now, allow all.

    // Play sound on spawn
    playSpawnSound();

    const s = new Snake(country, user, pic);
    snakes.push(s);
    return s;
}

// --- EXTERNAL CONNECTIONS (For Extension) ---
// 1. Expose to Window (Direct Call)
window.spawnSnake = spawnSnake;

// 2. Listen for 'message' events (postMessage from Content Script)
window.addEventListener('message', (event) => {
    // Security check: Accept messages from same window or extension
    // Adjust logic based on how extension sends data. 
    // Usually it sends { action: 'spawn', country: 'us', ... }

    const d = event.data;
    if (!d) return;

    // specific format check
    if (d.action === 'spawn' || d.type === 'spawn') {
        spawnSnake(d);
    }
    // Direct object check { country: 'us', username: '...' }
    else if (d.country && d.username) {
        spawnSnake(d);
    }
});

// 3. Listen for Custom DOM Events
window.addEventListener('spawnSnakeEvent', (e) => {
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
    spawnSnake({ country: randomCountry, username: `Bot ${randomId}` });
}
const botInterval = setInterval(() => { if (snakes.length < 10) spawnBot(); }, 2000);

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

// --- Settings Logic ---
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeSettings = document.getElementById('close-settings');
const sizeSlider = document.getElementById('size-slider');
const sizeVal = document.getElementById('size-val');
const speedSlider = document.getElementById('speed-slider');
const speedVal = document.getElementById('speed-val');

// UI Customization Elements
const uiScaleSlider = document.getElementById('ui-scale-slider');
const uiOpacitySlider = document.getElementById('ui-opacity-slider');
const uiPosSlider = document.getElementById('ui-pos-slider');
const uiScaleVal = document.getElementById('ui-scale-val');
const uiOpacityVal = document.getElementById('ui-opacity-val');
const uiPosVal = document.getElementById('ui-pos-val');
const bottomPanels = document.getElementById('bottom-panels');


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

    // Maintain centering while applying scale and vertical offset
    bottomPanels.style.transform = `translateX(-50%) scale(${s}) translateY(-${p}px)`;
    bottomPanels.style.opacity = o;

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
let timeLeft = 30;
const timerEl = document.getElementById('game-timer');
const winnerModal = document.getElementById('winner-modal');
const listSoldiers = document.getElementById('list-soldiers');
const listCountries = document.getElementById('list-countries');

const gameLoop = setInterval(() => {
    timeLeft--;
    if (timerEl) timerEl.innerText = timeLeft;

    // --- 1. Update Left Panel: TOP SOLDIERS (Live Kills) ---
    if (listSoldiers) {
        const sortedLive = [...snakes].sort((a, b) => b.kills - a.kills);
        const top7Live = sortedLive.slice(0, 7); // Get Top 7
        let html1 = '';

        // Always render 7 slots (fill 4-7 with placeholders if needed)
        for (let i = 0; i < 7; i++) {
            const s = top7Live[i];
            const rank = i + 1;
            const isGold = rank === 1 ? 'gold' : '';

            if (s) {
                html1 += `
                <div class="list-item ${isGold}">
                    <span class="rank-idx">${rank}</span>
                    <div class="li-content">
                        <img src="${s.headUrl}" class="li-flag">
                        <span class="li-name">${s.username}</span>
                    </div>
                    <span class="li-score">${s.kills}</span>
                </div>`;
            } else {
                // Empty Slot
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
                const flag = `https://flagcdn.com/w80/${code}.png`;
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
        document.getElementById('winner-flag').src = `https://flagcdn.com/w160/${champion.country}.png`;
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

    // Auto Restart
    setTimeout(() => {
        location.reload();
    }, 6000);
}
