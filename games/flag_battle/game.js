// ============================================
// GAME.JS - Main Game Logic (Crash-Proof)
// ============================================

let engine, render, runner, arenaBody;
let flags = [];
let powerups = [];
let particles = [];
let isGameOver = false;
let gameW, gameH, arenaRadius;
let roundNumber = 1;
let startTime = 0;
let timerInterval = null;
let powerupSpawnTimeout = null;
let matterLoadRetries = 0;
const MAX_MATTER_RETRIES = 10;
const flagCache = {}; // Memory cache for flag images
let currentArenaTexture = null; // Texture of the current arena owner

// 🆕 HD Flag URL Generator
// Generates high-quality 800px flag URLs from Flagpedia CDN
function getHDFlagUrl(countryCode) {
    // Flagpedia uses lowercase 2-letter codes
    const code = countryCode === 'ad' ? 'ad' : countryCode.toLowerCase();

    // Flagpedia CDN provides flags at multiple sizes
    // Format: https://flagpedia.net/data/flags/w580/xx.png (580px width)
    // We'll use w1160 for ultra HD (1160px width, maintains aspect ratio)
    return `https://flagpedia.net/data/flags/w1160/${code}.png`;
}

// Particle canvas
let particleCanvas, particleCtx;

// Initialize game
function init() {
    // Check if Matter.js is loaded
    if (typeof Matter === 'undefined') {
        matterLoadRetries++;
        if (matterLoadRetries < MAX_MATTER_RETRIES) {
            console.log(`Waiting for Matter.js... (${matterLoadRetries}/${MAX_MATTER_RETRIES})`);
            setTimeout(init, 500);
            return;
        } else {
            alert('Failed to load game engine. Please refresh the page.');
            return;
        }
    }

    try {
        loadStats();
        loadSettings();
        loadDefaultMusic(); // Load default background music

        const gameArea = document.getElementById('game-area');
        gameW = gameArea.clientWidth;
        gameH = gameArea.clientHeight;

        particleCanvas = document.getElementById('particle-canvas');
        particleCtx = particleCanvas.getContext('2d');
        resizeParticleCanvas();

        engine = Matter.Engine.create({
            positionIterations: 50, // Extreme precision to stop tunneling
            velocityIterations: 50
        });
        engine.world.gravity.y = config.gravity;

        render = Matter.Render.create({
            element: gameArea,
            engine: engine,
            options: {
                width: gameW,
                height: gameH,
                wireframes: false,
                background: 'transparent',
                pixelRatio: window.devicePixelRatio || 1
            }
        });

        const minDimension = Math.min(gameW, gameH);
        arenaRadius = (minDimension * 0.45) * (config.circlePercent / 0.44);

        Matter.Events.on(engine, 'beforeUpdate', gameUpdate);
        Matter.Events.on(render, 'afterRender', gameRender);
        Matter.Events.on(engine, 'collisionStart', handleCollisions);

        Matter.Render.run(render);
        runner = Matter.Runner.create();
        Matter.Runner.run(runner, engine);

        // Ensure Game Canvas is above Background but below Particles
        render.canvas.style.position = 'absolute';
        render.canvas.style.top = '0';
        render.canvas.style.left = '0';
        render.canvas.style.zIndex = '2';
        render.canvas.style.pointerEvents = 'none'; // Let clicks pass through if needed

        applyColors();
        startNewRound();

        console.log('Game initialized successfully!');
    } catch (e) {
        console.error('Game initialization error:', e);
        alert('Game initialization failed. Please refresh the page.');
    }
}

// Particle system
function resizeParticleCanvas() {
    if (particleCanvas) {
        particleCanvas.width = gameW;
        particleCanvas.height = gameH;
    }
}

function createParticles(x, y, color, count = 20) {
    if (!config.particlesEnabled) return;

    // Limit total particles for memory safety
    if (particles.length > MAX_PARTICLES - count) {
        particles.splice(0, count);
    }

    for (let i = 0; i < count; i++) {
        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 6,
            vy: (Math.random() - 0.5) * 6 - 2,
            life: 1.0,
            color: color,
            size: Math.random() * 4 + 2
        });
    }
}

// Global Round State
window.isRoundActive = false;

function updateParticles() {
    if (!particleCtx) return;

    try {
        particleCtx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);

        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.15;
            p.life -= 0.02;

            if (p.life <= 0) {
                particles.splice(i, 1);
                continue;
            }

            particleCtx.globalAlpha = p.life;
            particleCtx.fillStyle = p.color;
            particleCtx.beginPath();
            particleCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            particleCtx.fill();
        }
        particleCtx.globalAlpha = 1;
    } catch (e) {
        console.warn('Particle rendering error:', e);
    }
}

// Collision handling
function handleCollisions(event) {
    try {
        event.pairs.forEach(pair => {
            const bodyA = pair.bodyA;
            const bodyB = pair.bodyB;

            if (bodyA.country && bodyB.country) {
                playTone(200 + Math.random() * 100, 0.05, 'square');
            }

            if (bodyA.isPowerup && bodyB.country) {
                applyPowerup(bodyB, bodyA.powerupType);
                removePowerup(bodyA);
            } else if (bodyB.isPowerup && bodyA.country) {
                applyPowerup(bodyA, bodyB.powerupType);
                removePowerup(bodyB);
            }
        });
    } catch (e) {
        console.warn('Collision handling error:', e);
    }
}

// Rigging / Live Stream System
// Rigging / Live Stream System
window.winnerQueue = [];
let sessionStats = {}; // { 'bd': 5, 'in': 3 }

// Update UI
function updateLeaderboardUI() {
    const list = document.getElementById('leaderboard-list');
    if (!list) return;

    // Sort by wins
    const sorted = Object.entries(sessionStats)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3); // Top 3 only

    if (sorted.length === 0) {
        list.innerHTML = '<li class="empty-list">No wins yet</li>';
        return;
    }

    list.innerHTML = '';
    sorted.forEach(([code, wins], index) => {
        const country = ALL_COUNTRIES.find(c => c.code === code);
        const name = country ? country.name : code;

        const li = document.createElement('li');
        li.innerHTML = `
            <div><span class="rank">#${index + 1}</span> <span class="name">${name}</span></div>
            <span class="count">${wins}</span>
        `;
        list.appendChild(li);
    });
}

// Chaos Commands
function triggerShake() {
    console.log("🌪️ EARTHQUAKE!");
    const bodies = Matter.Composite.allBodies(engine.world);
    bodies.forEach(body => {
        if (!body.isStatic) {
            Matter.Body.applyForce(body, body.position, {
                x: (Math.random() - 0.5) * 0.5, // Strong horizontal shake
                y: (Math.random() - 0.5) * 0.5  // Strong vertical shake
            });
        }
    });
}

function resetLeaderboard() {
    console.log("💣 LEADERBOARD NUKE!");
    sessionStats = {};
    updateLeaderboardUI();
    // Visual shake effect on the leaderboard div
    const el = document.getElementById('live-leaderboard');
    if (el) {
        el.style.transform = "scale(1.2) rotate(5deg)";
        el.style.filter = "brightness(2) sepia(1) hue-rotate(-50deg) saturate(5)"; // Red flash
        setTimeout(() => {
            el.style.transform = "scale(1) rotate(0deg)";
            el.style.filter = "none";
        }, 300);
    }
}

// Multi-language Alias Map
const countryAliases = {
    // Bengali
    'বাংলাদেশ': 'bd', 'বাংলা': 'bd', 'bangladesh': 'bd',
    'ভারত': 'in', 'ইন্ডিয়া': 'in', 'হিন্দুস্তান': 'in',
    'পাকিস্তান': 'pk', 'পাক': 'pk',
    'সৌদি': 'sa', 'সৌদি আরব': 'sa',
    'ফিলিস্তিন': 'ps', 'প্যালেস্টাইন': 'ps',
    'ব্রাজিল': 'br', 'আর্জেন্টিনা': 'ar', 'জার্মানি': 'de',
    'রাশিয়া': 'ru', 'ইউক্রেন': 'ua',
    'নেপাল': 'np', 'ভুটান': 'bt',

    // Russian (Cyrillic)
    'россия': 'ru', 'рф': 'ru',
    'украина': 'ua',
    'беларусь': 'by', 'казахстан': 'kz',
    'германия': 'de', 'сша': 'us',

    // Hindi/Urdu
    'भारत': 'in', 'hindustan': 'in',
    'pakistan': 'pk',

    // Common Abbreviations / Nicknames
    'usa': 'us', 'america': 'us', 'murica': 'us',
    'uk': 'gb', 'england': 'gb', 'britain': 'gb',
    'uae': 'ae', 'dubai': 'ae',
    'ksa': 'sa',
    'nz': 'nz',
    'fra': 'fr'
};

// Helper to add valid code to queue
// Helper to add valid code to queue OR spawn dynamically
function queueWinner(requestData, method) {
    let reqCode, reqUser;

    try {
        if (typeof requestData === 'object' && requestData !== null) {
            reqCode = requestData.country;
            reqUser = { name: requestData.username, pic: requestData.profilePic };
        } else {
            reqCode = requestData;
            reqUser = null;
        }

        if (!reqCode || typeof reqCode !== 'string') return false;

        const country = ALL_COUNTRIES.find(c => c.code === reqCode);
        if (!country) return false;

        // DYNAMIC SPAWN LOGIC (Simplified & Forced)
        if (!isGameOver) {
            console.log(`🚀 ATTEMPTING LIVE SPAWN: ${country.name}`); // Debug

            spawnSingleFlag(country, reqUser);

            // Save request for winner screen
            if (window.currentRoundRequests) {
                window.currentRoundRequests.push({ code: reqCode, user: reqUser });
            }
            return true;
        }

        // If Game IS Over
        window.winnerQueue.push(requestData);
        console.log(`✅ Game Over/Inactive. Added to Queue: ${country.name}`);
        return true;

    } catch (e) {
        console.error("QueueWinner Error:", e);
        return false;
    }
}

window.addWinner = function (inputData) {
    let rawText = "";
    let userInfo = null;

    // 1. Extract Text & User Info
    if (typeof inputData === 'object' && inputData !== null && inputData.country) {
        rawText = inputData.country; // The chat message text
        userInfo = {
            username: inputData.username || "Anonymous",
            profilePic: inputData.profilePic || ""
        };
    } else if (typeof inputData === 'string') {
        rawText = inputData;
    } else {
        return false;
    }

    if (!rawText) return false;
    let text = rawText.toLowerCase().trim();

    // Helper Function to Queue Resolved Country with User Info
    const doQueue = (code, method) => {
        if (userInfo) {
            return queueWinner({
                country: code,
                username: userInfo.username,
                profilePic: userInfo.profilePic
            }, method);
        } else {
            return queueWinner(code, method);
        }
    };

    // --- CHAOS COMMANDS ---
    if (text === '!bomb' || text === '!reset') {
        resetLeaderboard();
        return true;
    }
    if (text === '!shake' || text === '!quake') {
        triggerShake();
        return true;
    }

    // 0. FLAG EMOJI SEARCH (Fixed for Surrogate Pairs)
    const flagRegex = /[\uD83C][\uDDE6-\uDDFF][\uD83C][\uDDE6-\uDDFF]/g;
    const foundFlags = rawText.match(flagRegex);

    if (foundFlags) {
        for (const flag of foundFlags) {
            // Convert flag emoji to country code
            const codePoints = [];
            for (let i = 0; i < flag.length; i++) {
                const point = flag.codePointAt(i);
                if (point > 0xFFFF) i++; // Skip low surrogate
                codePoints.push(point);
            }

            if (codePoints.length === 2) {
                const char1 = String.fromCharCode(codePoints[0] - 127397);
                const char2 = String.fromCharCode(codePoints[1] - 127397);
                const code = (char1 + char2).toLowerCase();

                console.log(`🚩 Flag Detected: ${flag} -> Code: ${code}`); // Debug

                if (ALL_COUNTRIES.find(c => c.code === code)) {
                    return doQueue(code, "Emoji");
                }
            }
        }
    }

    // 1. TOKEN SEARCH (Aliases & Exact Match)
    const words = text.split(/[\s,.!?]+/);
    for (let word of words) {
        if (countryAliases[word]) {
            return doQueue(countryAliases[word], "Alias");
        }
        const exactMatch = ALL_COUNTRIES.find(c => c.code === word || c.name.toLowerCase() === word);
        if (exactMatch) {
            return doQueue(exactMatch.code, "Exact");
        }
    }

    // 2. LANGUAGE FALLBACK - REMOVED PER USER REQUEST
    // Instead, treat unknown text as a "Profile Request" if user info exists

    // If no country matched, but we have user info, spawn their profile!
    if (userInfo && userInfo.username) {
        // Create a unique code based on username
        const uniqueCode = 'user_' + userInfo.username.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().substring(0, 10);

        // Queue as a special Profile Request
        return queueWinner({
            country: uniqueCode, // This will be used as ID
            isProfileRequest: true, // Marker
            username: userInfo.username,
            profilePic: userInfo.profilePic || "https://picsum.photos/200" // Fallback or empty
        }, "Profile");
    }

    return false;
};

// Helper to add valid code to queue OR spawn dynamically
function queueWinner(requestData, method) {
    let reqCode, reqUser, isProfile = false;

    try {
        if (typeof requestData === 'object' && requestData !== null) {
            reqCode = requestData.country;
            reqUser = { name: requestData.username, pic: requestData.profilePic };
            isProfile = requestData.isProfileRequest === true;
        } else {
            reqCode = requestData;
            reqUser = null;
        }

        if (!reqCode || typeof reqCode !== 'string') return false;

        let country = ALL_COUNTRIES.find(c => c.code === reqCode);

        // DYNAMIC PROFILE CREATION
        if (!country && isProfile) {
            country = {
                code: reqCode,
                name: reqUser.name,
                isProfile: true,
                flagSrc: reqUser.pic
            };
            console.log(`👤 New Challenger: ${country.name}`);
        }

        if (!country) return false;

        // DYNAMIC SPAWN LOGIC (Simplified & Forced)
        if (!isGameOver) {
            console.log(`🚀 ATTEMPTING LIVE SPAWN: ${country.name}`); // Debug

            spawnSingleFlag(country, reqUser);

            // Save request for winner screen
            if (window.currentRoundRequests) {
                window.currentRoundRequests.push({ code: reqCode, user: reqUser, countryObj: country });
            }
            return true;
        }

        // If Game IS Over
        // Store full country object for profile support
        window.winnerQueue.push(isProfile ? { ...requestData, countryObj: country } : requestData);
        console.log(`✅ Game Over/Inactive. Added to Queue: ${country.name}`);
        return true;

    } catch (e) {
        console.error("QueueWinner Error:", e);
        return false;
    }
}

// Start new round
function startNewRound() {
    window.isRoundActive = false; // Disable vanish check until flags load
    try {
        // Clear previous round
        Matter.Composite.clear(engine.world);
        Matter.Engine.clear(engine);

        flags = [];
        powerups = [];
        particles = [];
        isGameOver = false;

        // Clear powerup timeout
        if (powerupSpawnTimeout) {
            clearTimeout(powerupSpawnTimeout);
            powerupSpawnTimeout = null;
        }

        document.getElementById('graveyard').innerHTML = '';
        document.getElementById('winner-screen').classList.remove('visible');

        createArena();

        // Ensure flag count doesn't exceed maximum
        // Ensure flag count doesn't exceed maximum or total available countries
        let safeCount = Math.min(config.flagCount, MAX_FLAGS);

        // Strict uniqueness check
        if (safeCount > ALL_COUNTRIES.length) {
            safeCount = ALL_COUNTRIES.length;
        }

        // Check for User Requests (Live Stream Priority)
        let uniqueRequests = [];
        let seenCodes = new Set();

        window.winnerQueue.forEach(item => {
            const code = (typeof item === 'object' && item.country) ? item.country : item;
            const user = (typeof item === 'object' && item.username) ? { name: item.username, pic: item.profilePic } : null;

            // Allow duplicates: If 10 people ask for BD, spawn 10 BD flags.
            if (typeof code === 'string') {
                // seenCodes.add(code); // No longer needed
                uniqueRequests.push({ code, user });
            }
        });

        const requestedCodes = uniqueRequests.map(r => r.code);

        // Save for Winner Screen Logic
        window.currentRoundRequests = [...uniqueRequests];

        window.winnerQueue = [];

        console.log(`%c 🎮 Viewer Battle Royale: ${requestedCodes.length} countries queued`, 'color: #ffd700; font-weight: bold;');

        // Pool Construction
        const pool = [];

        // 1. Add Requested Countries (Priority)
        uniqueRequests.forEach(req => {
            // Check if it's a standard country code OR a dynamic profile object
            let country = ALL_COUNTRIES.find(c => c.code === req.code);

            // If not found, check if we saved a dynamic country object (from queueWinner)
            if (!country && window.currentRoundRequests) {
                const savedReq = window.currentRoundRequests.find(r => r.code === req.code);
                if (savedReq && savedReq.countryObj) {
                    country = savedReq.countryObj;
                }
            }

            if (country) {
                // Attach user data to the country object temporarily for this round
                pool.push({ ...country, isUserRequest: true, userData: req.user });
            }
        });

        // 2. Fill remaining slots with Random Countries
        const remainingSlots = Math.max(0, safeCount - pool.length);
        const randomPool = ALL_COUNTRIES.filter(c => !requestedCodes.includes(c.code));
        const shuffledRandom = randomPool.sort(() => Math.random() - 0.5).slice(0, remainingSlots);

        shuffledRandom.forEach(c => {
            pool.push({ ...c, isUserRequest: false });
        });

        // Shuffle the final mix so priority flags aren't always first
        const shuffled = pool.sort(() => Math.random() - 0.5);

        // Preload all flag images before creating physics bodies
        let loadedCount = 0;
        const flagData = [];

        shuffled.forEach((c, index) => {
            const fixedBase = Math.min(gameW, gameH) * 0.09;
            const flagW = fixedBase * config.scale;
            const flagH = flagW * 0.66;

            const centerX = gameW / 2;
            const centerY = gameH / 2;
            const spawnR = arenaRadius * 0.6; // Reduced to keep safe from walls
            const x = centerX + (Math.random() - 0.5) * spawnR;
            const y = centerY + (Math.random() - 0.5) * spawnR;

            // Check cache first
            if (flagCache[c.code]) {
                loadedCount++;
                flagData.push({ country: c, img: flagCache[c.code], x, y, flagW, flagH });

                if (loadedCount === shuffled.length) {
                    createFlagBodies(flagData);
                }
                return;
            }



            // Load image with retry
            // Load image with retry
            const img = new Image();

            // For Profile Pictures (External URLs), we need Anonymous access
            if (c.isProfile) {
                img.crossOrigin = 'anonymous';
                img.src = c.flagSrc;
            } else {
                const filename = c.code === 'ad' ? 'andorra' : c.code;
                img.src = `../assets/flags/${filename}.png`;
            }

            let retryCount = 0;
            const maxRetries = 3;

            const tryLoad = () => {
                img.onload = () => {
                    loadedCount++;
                    // Only cache standard country flags, not dynamic user profiles
                    if (!c.isProfile) {
                        flagCache[c.code] = img;
                    }
                    flagData.push({ country: c, img, x, y, flagW, flagH });

                    // All images loaded - create physics bodies
                    if (loadedCount === shuffled.length) {
                        createFlagBodies(flagData);
                    }
                };

                img.onerror = () => {
                    retryCount++;
                    if (retryCount < maxRetries) {
                        console.log(`Retrying flag ${c.code} (${retryCount}/${maxRetries})`);
                        setTimeout(tryLoad, 500 * retryCount);
                    } else {
                        console.warn(`Failed to load flag: ${c.code}`);
                        loadedCount++;
                        // Fallback for profile pics? Maybe use a default avatar
                        flagData.push({ country: c, img: null, x, y, flagW, flagH });

                        if (loadedCount === shuffled.length) {
                            createFlagBodies(flagData);
                        }
                    }
                };
            };

            tryLoad();
        });

        // Function to create physics bodies after images are loaded
        function createFlagBodies(flagData) {
            flagData.forEach(data => {
                let body;
                if (config.roundFlags) {
                    // Countryball Mode (Circle)
                    const radius = Math.max(data.flagW, data.flagH) / 2;
                    body = Matter.Bodies.circle(data.x, data.y, radius, {
                        restitution: config.bounce,
                        friction: 0.1, // A bit of friction for rolling
                        frictionAir: config.airDrag,
                        density: 0.005,
                        inertia: config.allowRotation ? null : Infinity, // Control rotation
                        render: { opacity: 0, lineWidth: 0 }
                    });
                    body.isCircle = true;
                    body.radius = radius;
                } else {
                    // Standard Flag (Rectangle)
                    body = Matter.Bodies.rectangle(data.x, data.y, data.flagW, data.flagH, {
                        restitution: config.bounce,
                        friction: 0.0,
                        frictionAir: config.airDrag,
                        density: 0.005,
                        inertia: Infinity, // Prevents rotation
                        angle: 0,
                        render: { opacity: 0, lineWidth: 0 }
                    });
                    body.isCircle = false;
                }

                body.country = data.country;
                body.img = data.img;
                body.w = data.flagW;
                body.h = data.flagH;
                body.hasShield = false;

                body.hasShield = false;

                // Priority Flag (Viewer Request)
                if (data.country.isUserRequest) {
                    body.isUserRequest = true;
                    // No border for cleaner look
                    body.render.opacity = 1;
                    // Store user data in body
                    body.userData = data.country.userData;

                    // Preload Profile Pic
                    if (body.userData && body.userData.pic) {
                        const userImg = new Image();
                        userImg.crossOrigin = 'anonymous';
                        userImg.src = body.userData.pic;
                        body.userImg = userImg;
                    }
                }

                Matter.Composite.add(engine.world, body);
                flags.push(body);
            });

            updateCounter();
            const roundEl = document.getElementById('round-counter');
            if (roundEl) roundEl.innerText = roundNumber;
            startTimer();

            if (runner && !runner.enabled) runner.enabled = true;

            if (config.powerupsEnabled) {
                powerupSpawnTimeout = setTimeout(() => spawnPowerup(), 3000);
            }

            // Allow vanish checks now
            setTimeout(() => { window.isRoundActive = true; }, 1000);
        }
    } catch (e) {
        console.error('Round start error:', e);
    }
}

// Timer management
function startTimer() {
    startTime = Date.now();
    if (timerInterval) {
        clearInterval(timerInterval);
    }
    timerInterval = setInterval(() => {
        try {
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            const mins = Math.floor(elapsed / 60);
            const secs = elapsed % 60;
            const timerEl = document.getElementById('timer');
            if (timerEl) {
                timerEl.innerText = `${mins}:${secs.toString().padStart(2, '0')}`;
            }
        } catch (e) {
            console.warn('Timer update error:', e);
        }
    }, 1000);
}

// Create arena
function createArena() {
    try {
        const Bodies = Matter.Bodies;
        const Body = Matter.Body;
        const r = arenaRadius;
        const segments = 80;
        const gapDeg = config.gapSize; // Dynamic gap from settings
        const parts = [];

        let startAngle = Math.PI;
        if (arenaBody) startAngle = arenaBody.angle;

        const centerX = gameW / 2;
        const centerY = gameH / 2;

        for (let i = 0; i < segments; i++) {
            const t = i / (segments - 1);
            const angleDeg = 90 + (gapDeg / 2) + (t * (360 - gapDeg));
            const angleRad = angleDeg * Math.PI / 180;

            const x = centerX + Math.cos(angleRad) * r;
            const y = centerY + Math.sin(angleRad) * r;

            const width = (r * 2 * Math.PI / segments) + 10; // Slight overlap
            const height = config.thickness; // Use user setting again

            const renderOptions = {
                strokeStyle: config.glowEffect ? config.arenaColor : 'transparent',
                lineWidth: config.glowEffect ? 3 : 0
            };

            if (currentArenaTexture) {
                renderOptions.sprite = {
                    texture: currentArenaTexture,
                    xScale: width / 160, // Scale to fit segment width
                    yScale: height / 100 // Scale to fit segment height
                };
            } else {
                renderOptions.fillStyle = config.arenaColor;
            }

            parts.push(Bodies.rectangle(x, y, width, height, {
                isStatic: true,
                angle: angleRad + Math.PI / 2,
                restitution: 1.0,
                friction: 0,
                render: renderOptions
            }));
        }

        arenaBody = Body.create({ parts, isStatic: true });
        Body.setPosition(arenaBody, { x: centerX, y: centerY }); // Explicitly center the arena
        Body.setAngle(arenaBody, startAngle);
        Matter.Composite.add(engine.world, arenaBody);

        // Invisible boundary walls to prevent flags from escaping except through the gap
        // Invisible boundary walls to prevent flags from slipping away sideways
        // Removed Top wall to allow exit through top gap

        // All invisible walls removed for total freedom

        // Bottom wall to prevent flags from falling into graveyard (keeps the gap open)
        const bottomWall = Bodies.rectangle(30, gameH - 50, 70, 130, {
            isStatic: true,
            render: { fillStyle: 'transparent', opacity: 0 }
        });
        Matter.Composite.add(engine.world, bottomWall);
    } catch (e) {
        console.error('Arena creation error:', e);
    }
}

// Powerup system
function spawnPowerup() {
    if (!config.powerupsEnabled || isGameOver) return;

    try {
        // Limit powerups
        if (powerups.length >= MAX_POWERUPS) {
            powerupSpawnTimeout = setTimeout(() => spawnPowerup(), 5000);
            return;
        }

        const types = Object.keys(POWERUP_TYPES);
        const type = types[Math.floor(Math.random() * types.length)];
        const powerupData = POWERUP_TYPES[type];

        const centerX = gameW / 2;
        const centerY = gameH / 2;
        const spawnR = arenaRadius * 0.5;
        const x = centerX + (Math.random() - 0.5) * spawnR;
        const y = centerY + (Math.random() - 0.5) * spawnR;

        const body = Matter.Bodies.circle(x, y, 20, {
            restitution: 0.8,
            friction: 0,
            frictionAir: 0.01,
            density: 0.001,
            isSensor: true,
            render: {
                fillStyle: powerupData.color,
                strokeStyle: '#fff',
                lineWidth: 2
            }
        });

        body.isPowerup = true;
        body.powerupType = type;
        body.powerupData = powerupData;

        Matter.Composite.add(engine.world, body);
        powerups.push(body);

        playTone(600, 0.1, 'sine');

        powerupSpawnTimeout = setTimeout(() => spawnPowerup(), 5000 + Math.random() * 5000);
    } catch (e) {
        console.warn('Powerup spawn error:', e);
    }
}

function removePowerup(powerupBody) {
    try {
        Matter.Composite.remove(engine.world, powerupBody);
        powerups = powerups.filter(p => p !== powerupBody);
    } catch (e) {
        console.warn('Powerup removal error:', e);
    }
}

function applyPowerup(flagBody, type) {
    try {
        const powerupData = POWERUP_TYPES[type];

        const display = document.getElementById('powerup-display');
        if (display) {
            display.innerText = `${powerupData.emoji} ${flagBody.country.name} got ${type}!`;
            display.style.display = 'block';
            setTimeout(() => display.style.display = 'none', 2000);
        }

        playTone(800, 0.15, 'triangle');
        createParticles(flagBody.position.x, flagBody.position.y, powerupData.color, 30);

        switch (type) {
            case 'SPEED':
                Matter.Body.setVelocity(flagBody, {
                    x: flagBody.velocity.x * 2,
                    y: flagBody.velocity.y * 2
                });
                break;

            case 'SHIELD':
                flagBody.hasShield = true;
                setTimeout(() => flagBody.hasShield = false, 8000);
                break;

            case 'GROW':
                Matter.Body.scale(flagBody, 1.5, 1.5);
                flagBody.w *= 1.5;
                flagBody.h *= 1.5;
                break;

            case 'SHRINK':
                Matter.Body.scale(flagBody, 0.7, 0.7);
                flagBody.w *= 0.7;
                flagBody.h *= 0.7;
                break;

            case 'GRAVITY':
                Matter.Body.applyForce(flagBody, flagBody.position, {
                    x: 0,
                    y: -0.05 * flagBody.mass
                });
                break;
        }
    } catch (e) {
        console.warn('Powerup application error:', e);
    }
}

// Game update loop
function gameUpdate() {
    if (isGameOver) return;

    try {
        updateParticles();

        // BATTLE ROYALE LOGIC: Count active filler flags
        const fillerCount = flags.filter(f => !f.isUserRequest).length;

        if (arenaBody) {
            Matter.Body.setAngle(arenaBody, arenaBody.angle + config.rotationSpeed);
        }

        flags.forEach(b => {
            if (Math.random() < config.randomForce) {
                Matter.Body.applyForce(b, b.position, {
                    x: (Math.random() - 0.5) * 0.004 * b.mass,
                    y: (Math.random() - 0.5) * 0.004 * b.mass
                });
            }

            // Graveyard Pull: If outside arena, pull down strongly
            const centerX = gameW / 2;
            const centerY = gameH / 2;
            const dx = b.position.x - centerX;
            const dy = b.position.y - centerY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // INVISIBLE WALL PROTECTION (Viewer Flags Only)
            // If filler flags exist, Viewer Flags CANNOT exit the circle.
            if (b.isUserRequest && fillerCount > 0) {
                if (dist > arenaRadius - b.w) {
                    // Calculate vector towards center
                    const normalX = -dx / dist;
                    const normalY = -dy / dist;

                    // 1. Reverse Velocity (Bounce) if moving outwards
                    const dot = b.velocity.x * normalX + b.velocity.y * normalY;
                    if (dot < 0) {
                        Matter.Body.setVelocity(b, {
                            x: b.velocity.x - 2.0 * dot * normalX,
                            y: b.velocity.y - 2.0 * dot * normalY
                        });

                        // Small push to ensure they don't get stuck
                        Matter.Body.applyForce(b, b.position, {
                            x: normalX * 0.05 * b.mass,
                            y: normalY * 0.05 * b.mass
                        });
                    }
                }
            }

            if (b.isGod) {
                // Invisible Wall Logic: Bounce back if hitting the radius limit
                // This simulates a closed circle for the God flag, even at gaps
                if (dist > arenaRadius - b.w) {
                    // Calculate vector towards center
                    const normalX = -dx / dist;
                    const normalY = -dy / dist;

                    // 1. Reverse Velocity (Bounce)
                    const dot = b.velocity.x * normalX + b.velocity.y * normalY;
                    // Only bounce if moving outwards
                    if (dot < 0) {
                        Matter.Body.setVelocity(b, {
                            x: b.velocity.x - 2.5 * dot * normalX, // 2.5 = High bounce
                            y: b.velocity.y - 2.5 * dot * normalY
                        });
                    }

                    // 2. Push back constant force
                    Matter.Body.applyForce(b, b.position, {
                        x: normalX * 0.05 * b.mass,
                        y: normalY * 0.05 * b.mass
                    });
                }
            }

            // Graveyard Pull REMOVED.
            // Let flags fly free until elimination at extreme bounds.

            // Apply Space Mode Physics everywhere (inside and slightly outside)
            // Restore air drag if inside
            // If Gravity is 0 (Space Mode), force FrictionAir to 0 so they float forever
            if (config.gravity <= 0.1) {
                b.frictionAir = 0;

                // SPEED LIMIT: Dynamic based on Bounce!
                // If bounce is high, user WANTS speed. If low, keep it slow.
                // Base 3 + (Bounce * 8)
                // Example: Bounce 1.0 -> Limit 11
                // Example: Bounce 5.0 -> Limit 43 (Super Fast) -> Capped at 25
                const unlimitedSpeed = 3 + (config.bounce * 8);
                const maxSpeed = Math.min(unlimitedSpeed, 25); // Hard cap to prevent wall tunneling

                if (b.speed > maxSpeed) {
                    Matter.Body.setVelocity(b, {
                        x: b.velocity.x * (maxSpeed / b.speed),
                        y: b.velocity.y * (maxSpeed / b.speed)
                    });
                }
            } else {
                b.frictionAir = config.airDrag;
            }

            if (config.trailsEffect && Math.random() < 0.3) {
                createParticles(b.position.x, b.position.y, config.arenaColor, 2);
            }
        });

        for (let i = flags.length - 1; i >= 0; i--) {
            const b = flags[i];

            // Shield protection
            if (b.hasShield && (b.position.y > gameH || b.position.x < 0 || b.position.x > gameW)) {
                const centerX = gameW / 2;
                const centerY = gameH / 2;
                Matter.Body.setPosition(b, {
                    x: centerX + (Math.random() - 0.5) * 100,
                    y: centerY + (Math.random() - 0.5) * 100
                });
                Matter.Body.setVelocity(b, { x: 0, y: 0 });
                b.hasShield = false;
                createParticles(b.position.x, b.position.y, '#3498db', 40);
                playTone(400, 0.2, 'sawtooth');
                continue;
            }

            // Flag elimination (bounds check + distance check)
            const dx = b.position.x - (gameW / 2);
            const dy = b.position.y - (gameH / 2);
            const distFromCenter = Math.sqrt(dx * dx + dy * dy);

            if (gameH > 100 && (
                b.position.y > gameH + 20 ||
                b.position.x < -50 ||
                b.position.x > gameW + 50 ||
                distFromCenter > arenaRadius + 150 // Safety: eliminate if too far away anyway
            )) {
                // BATTLE ROYALE ELIMINATION:
                // Since Invisible Wall stops Viewer Flags from exiting, 
                // we don't need respawn logic here anymore.
                // If they somehow managed to get this far out (glitch), let them die to prevent bugs.

                // ALSO PROTECT: If multiple Viewer Flags exist and NO fillers, let them fight.
                // But if THIS flag falls, it dies (Fair fight phase).
                // Unless... it's the LAST Viewer flag? No, handleWinner handles the last one.

                addToGraveyard(b.country);
                updateStats(b.country, false);
                createParticles(b.position.x, b.position.y, '#e74c3c', 25);
                playTone(150, 0.3, 'sawtooth');
                Matter.Composite.remove(engine.world, b);
                flags.splice(i, 1);
                updateCounter();
            }
        }

        if (flags.length === 1 && !isGameOver) {
            handleWinner(flags[0]);
        } else if (flags.length === 0 && !isGameOver && roundNumber > 0 && window.isRoundActive) {
            // Auto-recovery: If all flags vanish unexpectedly, restart round
            console.warn('All flags vanished! Restarting round...');
            startNewRound();
        }
    } catch (e) {
        console.warn('Game update error:', e);
    }
}

// Game render loop
function gameRender() {
    try {
        const ctx = render.context;

        powerups.forEach(p => {
            ctx.save();
            ctx.translate(p.position.x, p.position.y);
            ctx.font = 'bold 24px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(p.powerupData.emoji, 0, 0);
            ctx.restore();
        });

        // Ensure flags are drawn brightly
        ctx.globalAlpha = 1;
        ctx.filter = 'none';

        flags.forEach(b => {
            // Safety check for image validity
            if (!b.img) return;
            if (b.img.naturalWidth === 0 || b.img.naturalHeight === 0) return;

            ctx.save();
            ctx.translate(b.position.x, b.position.y);
            ctx.rotate(b.angle);

            if (b.hasShield) {
                ctx.strokeStyle = '#3498db';
                ctx.lineWidth = 4;
                ctx.beginPath();
                const r = b.isCircle ? b.radius : Math.max(b.w, b.h) * 0.7;
                ctx.arc(0, 0, r + 5, 0, Math.PI * 2);
                ctx.stroke();
            }

            if (b.isCircle) {
                // Draw Circular Flag (Countryball style)
                ctx.save();
                ctx.beginPath();
                ctx.arc(0, 0, b.radius, 0, Math.PI * 2);
                ctx.closePath();
                ctx.clip();
                // Draw image centered
                // Scale slightly to cover edges
                const scale = (b.radius * 2) / Math.min(b.w, b.h);
                const drawW = b.w * scale;
                const drawH = b.h * scale;
                ctx.drawImage(b.img, -drawW / 2, -drawH / 2, drawW, drawH);
                ctx.restore();

                // Draw border if enabled
                if (config.flagBorderEnabled) {
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(0, 0, b.radius, 0, Math.PI * 2);
                    ctx.stroke();
                }

                // Eyes? (Optional Countryball feature)
                // drawCountryballEyes(ctx, b.radius);
            } else {
                // Standard Rectangular Flag
                ctx.drawImage(b.img, -b.w / 2, -b.h / 2, b.w, b.h);

                // Draw border if enabled
                if (config.flagBorderEnabled) {
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(-b.w / 2, -b.h / 2, b.w, b.h);
                }
            }

            // Draw User Name (If Viewer Request)
            if (config.showPlayerNames && b.isUserRequest && b.userData && b.userData.name) {
                ctx.save();
                ctx.rotate(-b.angle); // Keep text horizontal
                ctx.font = "bold 14px Arial";
                ctx.fillStyle = "#fff";
                ctx.strokeStyle = "#000";
                ctx.lineWidth = 3;
                ctx.textAlign = "center";

                // Draw Profile Pic (if available) - BUT SKIP if the flag ITSELF is a profile pic
                if (b.userImg && b.userImg.complete && b.userImg.naturalWidth > 0 && !b.country.isProfile) {
                    const size = 24;
                    const py = b.h / 2 + 15;

                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(0, py, size / 2, 0, Math.PI * 2);
                    ctx.closePath();
                    ctx.clip();
                    ctx.drawImage(b.userImg, -size / 2, py - size / 2, size, size);
                    ctx.restore();

                    // Helper: Move text down
                    ctx.translate(0, 25);
                }

                // Draw name below flag
                const name = b.userData.name.length > 10 ? b.userData.name.substring(0, 8) + '..' : b.userData.name;
                ctx.strokeText(name, 0, b.h / 2 + 15);
                ctx.fillText(name, 0, b.h / 2 + 15);
                ctx.restore();
            }

            ctx.restore();
        });
    } catch (e) {
        console.warn('Render error:', e);
    }
}

// Winner handling
function handleWinner(winner) {
    if (isGameOver) return; // Prevent multiple wins/score adds
    try {
        isGameOver = true;
        if (runner) runner.enabled = false;
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
        if (powerupSpawnTimeout) {
            clearTimeout(powerupSpawnTimeout);
            powerupSpawnTimeout = null;
        }

        updateStats(winner.country, true);

        // Update Live Session Leaderboard
        if (winner.country) {
            const code = winner.country.code;
            // Count alive flags of winning country
            const aliveCount = flags.filter(f => f.country && f.country.code === code).length;
            const pointsToAdd = aliveCount > 0 ? aliveCount : 1;

            sessionStats[code] = (sessionStats[code] || 0) + pointsToAdd;
            updateLeaderboardUI();
        }

        // Update Arena Textures if Enabled
        if (config.winnerBackgroundEnabled) {
            // Update Arena Texture (Border)
            const filename = winner.country.code === 'ad' ? 'andorra' : winner.country.code;
            currentArenaTexture = `../assets/flags/${filename}.png`;

            // Update Winner Background (Rotated 90deg)
            const winnerBg = document.getElementById('winner-bg');
            if (winnerBg) {
                // Use profile pic if enabled and available
                if (config.winnerProfileEnabled && winner.country.isProfile && winner.country.flagSrc) {
                    let highResUrl = winner.country.flagSrc;
                    if (highResUrl.includes('.ggpht.com')) {
                        highResUrl = highResUrl.replace(/=s\d+-/, `=s${config.profileSize || 32}-`);
                    }
                    winnerBg.style.backgroundImage = `url(${highResUrl})`;
                } else {
                    const filename = winner.country.code === 'ad' ? 'andorra' : winner.country.code;
                    winnerBg.style.backgroundImage = `url(../assets/flags/${filename}.png)`;
                }
            }
        } else {
            currentArenaTexture = null;
            const winnerBg = document.getElementById('winner-bg');
            if (winnerBg) {
                winnerBg.style.backgroundImage = 'none';
            }
        }

        if (arenaBody && arenaBody.parts) {
            arenaBody.parts.forEach((part, index) => {
                if (index > 0 && part.render) { // Skip parent body
                    if (currentArenaTexture) {
                        part.render.fillStyle = 'transparent';
                        part.render.sprite = {
                            texture: currentArenaTexture,
                            xScale: 25 / 160,
                            yScale: config.thickness / 100
                        };
                    } else {
                        delete part.render.sprite;
                        part.render.fillStyle = config.arenaColor;
                    }
                }
            });
            Matter.Composite.remove(engine.world, arenaBody);
            createArena();
        }

        const screen = document.getElementById('winner-screen');
        const img = document.getElementById('winner-flag-img');
        const txt = document.getElementById('winner-text');
        const statsDiv = document.getElementById('winner-stats');
        const countTxt = document.getElementById('countdown-text');

        img.style.display = 'block';
        countTxt.style.display = 'none';

        // Function to show winner screen after image is loaded
        const showWinnerScreen = () => {
            // Special text for shout-out rounds
            if (roundNumber % 3 === 0) {
                txt.innerText = "🎉 SHOUT OUT! 🎉\n" + winner.country.name + " WINS!";
                txt.style.color = '#ffd700'; // Gold color for special rounds
            } else {
                txt.innerText = winner.country.name + " WINS!";
                txt.style.color = '#fff'; // Normal white
            }

            // Continue with rest of winner screen setup...
            // (Stats, supporters, etc. will be added below)
        };

        if (winner.country.isProfile) {
            // Upgrade YouTube profile pic quality to s800 for high resolution
            let highQualityPic = winner.country.flagSrc;
            console.log('🔍 Original YouTube URL:', highQualityPic);

            if (highQualityPic && highQualityPic.includes('.ggpht.com')) {
                // Replace s32, s48, s64, etc. with configured size
                highQualityPic = highQualityPic.replace(/=s\d+-/, `=s${config.profileSize || 32}-`);
                console.log(`📸 Upgraded to s${config.profileSize || 32}:`, highQualityPic);
            }

            // PRELOAD IMAGE BEFORE SHOWING
            const preloadImg = new Image();
            preloadImg.crossOrigin = 'anonymous';

            preloadImg.onload = () => {
                console.log('✅ High quality image loaded!');
                img.src = highQualityPic;
                img.crossOrigin = 'anonymous';
                showWinnerScreen();
            };

            preloadImg.onerror = () => {
                console.warn('⚠️ Failed to load s800, using original');
                img.src = winner.country.flagSrc; // Fallback to original
                img.crossOrigin = 'anonymous';
                showWinnerScreen();
            };

            // Start preloading
            preloadImg.src = highQualityPic;

            // Timeout fallback (max 2 seconds wait)
            setTimeout(() => {
                if (!img.src) {
                    console.warn('⏱️ Preload timeout, showing anyway');
                    img.src = highQualityPic;
                    img.crossOrigin = 'anonymous';
                    showWinnerScreen();
                }
            }, 2000);

            // 🆕 Update Last Winner Display (YouTube Profile)
            updateLastWinner(winner.country.name, highQualityPic);

        } else {
            // 🆕 LOAD HD FLAG (1160px) for regular country flags
            const filename = winner.country.code === 'ad' ? 'andorra' : winner.country.code;
            const hdFlagUrl = getHDFlagUrl(winner.country.code);

            console.log('📸 Preloading HD flag from Flagpedia...');

            // PRELOAD HD IMAGE BEFORE SHOWING
            const preloadImg = new Image();
            preloadImg.crossOrigin = 'anonymous';

            preloadImg.onload = () => {
                console.log('✅ HD flag loaded!', hdFlagUrl);
                img.src = hdFlagUrl;
                img.crossOrigin = 'anonymous';
                showWinnerScreen();
            };

            preloadImg.onerror = () => {
                console.warn('⚠️ Failed to load HD flag, using local 32px fallback');
                img.src = `../assets/flags/${filename}.png`;
                img.removeAttribute('crossOrigin');
                showWinnerScreen();
            };

            // Start preloading
            preloadImg.src = hdFlagUrl;

            // Timeout fallback (max 3 seconds wait)
            setTimeout(() => {
                if (!img.src) {
                    console.warn('⏱️ HD flag preload timeout, using fallback');
                    img.src = `../assets/flags/${filename}.png`;
                    img.removeAttribute('crossOrigin');
                    showWinnerScreen();
                }
            }, 3000);

            // 🆕 Update Last Winner Display (Country Flag)
            updateLastWinner(winner.country.name, hdFlagUrl);
        }

        // Total Wins hidden as requested
        statsDiv.innerText = "";

        // Populate Supporters List in Winner Screen
        const supportersDiv = document.getElementById('winner-supporters');
        if (supportersDiv) {
            supportersDiv.innerHTML = ''; // Clear content
            supportersDiv.style.display = 'none'; // Default to HIDDEN

            // Check current round requests safely
            if (window.currentRoundRequests && Array.isArray(window.currentRoundRequests) && window.currentRoundRequests.length > 0) {

                // Filter users who requested this winning country
                const supporters = window.currentRoundRequests.filter(req => req.code === winner.country.code && req.user);

                if (supporters.length > 0) {
                    supportersDiv.style.display = 'block'; // Show ONLY if supporters exist

                    // 1. Add Header
                    const header = document.createElement('div');
                    header.innerText = `🏆 SUPPORTERS (${supporters.length})`;
                    header.className = 'supporters-header';
                    // Inline styles for reliability
                    header.style.color = "#ffd700";
                    header.style.fontWeight = "bold";
                    header.style.marginBottom = "10px";
                    header.style.textAlign = "center";
                    header.style.borderBottom = "1px solid rgba(255,255,255,0.2)";
                    header.style.paddingBottom = "5px";
                    header.style.fontSize = "14px";
                    supportersDiv.appendChild(header);

                    // 2. Add Top 8 items
                    const topSupporters = supporters.slice(0, 8);
                    topSupporters.forEach(sup => {
                        const item = document.createElement('div');
                        item.className = 'supporter-item';

                        let avatarUrl = sup.user.pic || '';

                        // Upgrade YouTube profile pic to configured resolution for high quality
                        if (avatarUrl && avatarUrl.includes('yt3.ggpht.com')) {
                            avatarUrl = avatarUrl.replace(/=s\d+-/, `=s${config.profileSize || 32}-`);
                        }

                        const cleanName = String(sup.user.name).replace(/</g, "&lt;").replace(/>/g, "&gt;");
                        const imgSource = avatarUrl ? avatarUrl : `https://ui-avatars.com/api/?name=${encodeURIComponent(cleanName)}&background=random`;

                        item.innerHTML = `
                                <img src="${imgSource}" class="supporter-avatar" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(cleanName)}&background=random'">
                                <span>${cleanName}</span>
                            `;
                        supportersDiv.appendChild(item);
                    });
                }
            }
        }
        screen.classList.add('visible');

        playTone(523, 0.2, 'sine');
        setTimeout(() => playTone(659, 0.2, 'sine'), 200);
        setTimeout(() => playTone(784, 0.3, 'sine'), 400);

        const centerX = gameW / 2;
        const centerY = gameH / 2;
        createParticles(centerX, centerY, '#ffd700', 100);

        // Speech synthesis (with error handling)
        // Shout-out every 3 rounds
        if ('speechSynthesis' in window) {
            try {
                let message = "Winner is " + winner.country.name;

                // Special shout-out every 3 rounds
                if (roundNumber % 3 === 0) {
                    message = "Shout out to " + winner.country.name + " ummma";
                }

                const u = new SpeechSynthesisUtterance(message);
                u.rate = 1.0; // Normal speed
                u.pitch = 1.2; // Slightly higher pitch for excitement
                u.volume = 1.0; // Full volume
                window.speechSynthesis.speak(u);
            } catch (e) {
                console.warn('Speech synthesis error:', e);
            }
        }

        setTimeout(() => {
            img.style.display = 'none';
            txt.innerText = ""; // Cleared text
            statsDiv.innerText = "";
            countTxt.style.display = 'block';

            let count = 2; // Start from 2
            countTxt.innerText = count;

            const timer = setInterval(() => {
                count--;
                playTone(440, 0.1, 'square');
                if (count > 0) {
                    countTxt.innerText = count;
                } else if (count === 0) {
                    countTxt.innerText = "GO!";
                    playTone(880, 0.3, 'square');
                } else {
                    clearInterval(timer);
                    roundNumber++;
                    startNewRound();
                }
            }, 1000);

        }, 4000);
    } catch (e) {
        console.error('Winner handling error:', e);
    }
}

// Graveyard
function addToGraveyard(country) {
    try {
        const gy = document.getElementById('graveyard');
        const img = document.createElement('img');

        if (country.isProfile) {
            img.src = country.flagSrc;
            img.crossOrigin = 'anonymous';
        } else {
            const filename = country.code === 'ad' ? 'andorra' : country.code;
            img.src = `../assets/flags/${filename}.png`;
        }
        img.className = 'dead-flag';
        img.title = country.name;
        img.onerror = () => {
            console.warn(`Graveyard flag failed: ${country.code}`);
            img.style.display = 'none';
        };
        gy.appendChild(img);
        gy.scrollTop = gy.scrollHeight;
    } catch (e) {
        console.warn('Graveyard error:', e);
    }
}

function updateCounter() {
    const el = document.getElementById('counter');
    if (el) {
        el.innerText = flags.length;
        if (flags.length <= 5) el.style.color = '#e74c3c';
        else el.style.color = '#fff';
    }
}


// Dynamic Spawn Function
function spawnSingleFlag(country, userData) {
    const fixedBase = Math.min(gameW, gameH) * 0.09;
    const flagW = fixedBase * config.scale;
    const flagH = flagW * 0.66;
    const centerX = gameW / 2;
    const centerY = gameH / 2;
    // Spawn from top area
    const x = centerX + (Math.random() - 0.5) * (arenaRadius * 0.5);
    const y = centerY - (arenaRadius * 0.6);

    const loadAndCreate = (img) => {
        let body;
        if (config.roundFlags) {
            const radius = Math.max(flagW, flagH) / 2;
            body = Matter.Bodies.circle(x, y, radius, {
                restitution: config.bounce,
                friction: 0.1,
                frictionAir: config.airDrag,
                density: 0.005,
                inertia: config.allowRotation ? null : Infinity, // Control rotation
                render: { opacity: 0, lineWidth: 0 }
            });
            body.isCircle = true;
            body.radius = radius;
        } else {
            body = Matter.Bodies.rectangle(x, y, flagW, flagH, {
                restitution: config.bounce,
                friction: 0.0,
                frictionAir: config.airDrag,
                density: 0.005,
                inertia: Infinity,
                angle: 0,
                render: { opacity: 0, lineWidth: 0 }
            });
            body.isCircle = false;
        }

        body.country = country;
        body.img = img;
        body.w = flagW;
        body.h = flagH;
        body.hasShield = false;

        body.isUserRequest = true;
        if (userData) {
            body.userData = userData;
            if (userData.pic) {
                const i = new Image();
                i.crossOrigin = 'anonymous';
                i.src = userData.pic;
                body.userImg = i;
            }
        }

        Matter.Composite.add(engine.world, body);
        flags.push(body);
        updateCounter();
        createParticles(x, y, '#ffd700', 30);
        playTone(800, 0.15, 'sine');
    };

    if (flagCache[country.code]) {
        loadAndCreate(flagCache[country.code]);
    } else {
        const img = new Image();

        // Handle Profile Pictures vs Standard Flags
        if (country.isProfile) {
            img.crossOrigin = 'anonymous';
            img.src = country.flagSrc;
        } else {
            const filename = country.code === 'ad' ? 'andorra' : country.code;
            img.src = `../assets/flags/${filename}.png`;
        }

        img.onload = () => {
            // Don't cache dynamic profile spawns to avoid bloat/issues
            if (!country.isProfile) {
                flagCache[country.code] = img;
            }
            loadAndCreate(img);
        };

        img.onerror = () => {
            console.warn("Failed to load spawn flag:", country.code);
            // Fallback: spawn without image (just colored body)
            loadAndCreate(null);
        };
    }
}

// Resize handler with debouncing
const handleResize = debounce(() => {
    try {
        const gameArea = document.getElementById('game-area');
        if (render && gameArea) {
            const newW = gameArea.clientWidth;
            const newH = gameArea.clientHeight;

            // Prevent invalid dimensions
            if (newW < 100 || newH < 100) return;

            gameW = newW;
            gameH = newH;
            render.canvas.width = gameW;
            render.canvas.height = gameH;

            const minDimension = Math.min(gameW, gameH);
            arenaRadius = (minDimension * 0.45) * (config.circlePercent / 0.44);

            resizeParticleCanvas();

            if (engine && arenaBody) {
                Matter.Composite.remove(engine.world, arenaBody);
                createArena();
            }
        }
    } catch (e) {
        console.warn('Resize error:', e);
    }
}, 250);

window.addEventListener('resize', handleResize);

// Event listeners for settings
document.addEventListener('DOMContentLoaded', () => {
    // Initialize Toggles from Config
    const rFlags = document.getElementById('round-flags-toggle');
    if (rFlags) rFlags.checked = config.roundFlags;

    const rRot = document.getElementById('rotation-toggle');
    if (rRot) rRot.checked = config.allowRotation;
    // Circle size
    const circleSlider = document.getElementById('circle-slider');
    if (circleSlider) {
        circleSlider.addEventListener('input', (e) => {
            let val = parseInt(e.target.value);
            config.circlePercent = val / 100;
            document.getElementById('circle-val').innerText = val;

            const minDimension = Math.min(gameW, gameH);
            arenaRadius = (minDimension * 0.45) * (config.circlePercent / 0.44);

            if (engine && arenaBody) {
                Matter.Composite.remove(engine.world, arenaBody);
                createArena();
            }
        });
    }

    // --- Settings listeners removed (Moved to utils.js for centralized persistence) ---

    // 🆕 Last Winner Size Slider
    const lastWinnerSizeSlider = document.getElementById('last-winner-size-slider');
    console.log('🔍 Last Winner Size Slider element:', lastWinnerSizeSlider);
    if (lastWinnerSizeSlider) {
        console.log('✅ Attaching event listener to Last Winner size slider');
        lastWinnerSizeSlider.addEventListener('input', (e) => {
            const size = parseInt(e.target.value);
            console.log('🎚️ Slider moved to:', size);
            document.getElementById('last-winner-size-val').innerText = size;
            applyLastWinnerSize(size);
        });
    } else {
        console.error('❌ Last Winner Size Slider not found!');
    }

    // Color pickers
    const arenaColorPicker = document.getElementById('arena-color');
    if (arenaColorPicker) {
        arenaColorPicker.addEventListener('input', (e) => {
            config.arenaColor = e.target.value;
            applyColors();
        });
    }

    const bgColorPicker = document.getElementById('bg-color');
    if (bgColorPicker) {
        bgColorPicker.addEventListener('input', (e) => {
            config.bgColor = e.target.value;
            applyColors();
        });
    }

    // Toggles
    const winnerBgToggle = document.getElementById('winner-bg-toggle');
    if (winnerBgToggle) {
        winnerBgToggle.addEventListener('change', (e) => {
            config.winnerBackgroundEnabled = e.target.checked;

            if (!config.winnerBackgroundEnabled) {
                // Immediate reset if turned off
                currentArenaTexture = null;
                const winnerBg = document.getElementById('winner-bg');
                if (winnerBg) winnerBg.style.backgroundImage = 'none';

                if (arenaBody) {
                    Matter.Composite.remove(engine.world, arenaBody);
                    createArena();
                }
            }
        });
    }

    const glowToggle = document.getElementById('glow-toggle');
    if (glowToggle) {
        glowToggle.addEventListener('change', (e) => {
            config.glowEffect = e.target.checked;
        });
    }

    const rotationToggle = document.getElementById('rotation-toggle');
    if (rotationToggle) {
        rotationToggle.addEventListener('change', (e) => {
            config.allowRotation = e.target.checked;
            // Update existing flags immediately
            flags.forEach(b => {
                if (config.allowRotation && config.roundFlags) {
                    Matter.Body.setInertia(b, b.mass * 10); // Restore rotation (approx)
                    Matter.Body.setAngularVelocity(b, 0); // Reset spin on switch
                } else {
                    Matter.Body.setInertia(b, Infinity); // Stop rotation
                    Matter.Body.setAngularVelocity(b, 0);
                    Matter.Body.setAngle(b, 0); // Reset angle to upright
                }
            });
        });
    }

    const trailsToggle = document.getElementById('trails-toggle');
    if (trailsToggle) {
        trailsToggle.addEventListener('change', (e) => {
            config.trailsEffect = e.target.checked;
        });
    }

    const powerupsToggle = document.getElementById('powerups-toggle');
    if (powerupsToggle) {
        powerupsToggle.addEventListener('change', (e) => {
            config.powerupsEnabled = e.target.checked;
        });
    }

    const particlesToggle = document.getElementById('particles-toggle');
    if (particlesToggle) {
        particlesToggle.addEventListener('change', (e) => {
            config.particlesEnabled = e.target.checked;
        });
    }

    const soundToggle = document.getElementById('sound-toggle');
    if (soundToggle) {
        soundToggle.addEventListener('change', (e) => {
            config.soundEnabled = e.target.checked;
        });
    }

    const roundFlagsToggle = document.getElementById('round-flags-toggle');
    if (roundFlagsToggle) {
        roundFlagsToggle.addEventListener('change', (e) => {
            config.roundFlags = e.target.checked;
            // Immediate effect? No, simpler to require restart or wait for next round.
            // But user might want to see it now.
            // Converting existing bodies is hard. Let's just say "Next Round" or force restart.
            // Let's force a restart for instant gratification.
            if (flags.length > 0) {
                startNewRound();
            }
        });
    }

    // Volume sliders
    const gameVolSlider = document.getElementById('game-vol-slider');
    if (gameVolSlider) {
        gameVolSlider.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            config.gameVolume = val / 100;
            document.getElementById('game-vol-val').innerText = val;
            updateVolumeBars(val, 'game-vol-bars');
            playTone(440, 0.1, 'sine');
        });
    }

    const musicVolSlider = document.getElementById('music-vol-slider');
    if (musicVolSlider) {
        musicVolSlider.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            config.musicVolume = val / 100;
            document.getElementById('music-vol-val').innerText = val;
            updateVolumeBars(val, 'music-vol-bars');

            const audioPlayer = document.getElementById('bg-music');
            if (audioPlayer && audioPlayer.src) {
                audioPlayer.volume = config.musicVolume;
            }
        });
    }
});

// Start game when page loads
window.addEventListener('load', init);

// Expose necessary functions to global scope
window.engine = engine;
window.arenaBody = arenaBody;
window.createArena = createArena;
window.particles = particles;

// Bridge Polling System (Auto-connect to YouTube Chat)
let bridgeConnected = false;

// Check for Test Mode
const urlParams = new URLSearchParams(window.location.search);
const isTestMode = urlParams.has('test');

if (isTestMode) {
    console.log('%c 🧪 TEST MODE ACTIVE: Bridge disconnected', 'background: #e67e22; color: #fff; font-size: 14px; padding: 4px; border-radius: 4px;');
}

/* Legacy Bridge Loop Removed for Embedded Mobile Integration */
