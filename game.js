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
            positionIterations: 10,
            velocityIterations: 10
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
function queueWinner(code, sourceText, method) {
    const country = ALL_COUNTRIES.find(c => c.code === code);
    if (country) {
        window.winnerQueue.push(code);
        console.log(`✅ Added to queue: ${country.name} (${method}) [Input: "${sourceText}"]`);
        return true;
    }
    return false;
}

window.addWinner = function (inputText) {
    if (!inputText) return false;
    let text = inputText.toLowerCase().trim();

    // 1. TOKEN SEARCH: Look for country names inside the sentence
    // Split by spaces and punctuation
    const words = text.split(/[\s,.!?]+/);

    for (let word of words) {
        // Check Alias Map
        if (countryAliases[word]) {
            return queueWinner(countryAliases[word], inputText, "Alias Match");
        }
        // Check Direct Name/Code Match
        const exactMatch = ALL_COUNTRIES.find(c =>
            c.code === word || c.name.toLowerCase() === word
        );
        if (exactMatch) {
            return queueWinner(exactMatch.code, inputText, "Exact Match");
        }
    }

    // 2. LANGUAGE FALLBACK: If no country named, guess by Script/Language

    // Bengali -> Bangladesh
    if (/[\u0980-\u09FF]/.test(inputText)) {
        return queueWinner('bd', inputText, "Language Detected: Bengali");
    }

    // Cyrillic (Russian/Ukrainian) -> Russia (Default)
    if (/[\u0400-\u04FF]/.test(inputText)) {
        // Could be Ukraine if specifically spelled, but alias map handles that. 
        // Defaulting Cyrillic to Russia for now.
        return queueWinner('ru', inputText, "Script Detected: Cyrillic");
    }

    // Devanagari (Hindi) -> India
    if (/[\u0900-\u097F]/.test(inputText)) {
        return queueWinner('in', inputText, "Script Detected: Hindi");
    }

    // Arabic -> Saudi Arabia (Default)
    if (/[\u0600-\u06FF]/.test(inputText)) {
        return queueWinner('sa', inputText, "Script Detected: Arabic");
    }

    // No match found
    // console.log(`⏩ Ignored: "${inputText}" (No country or recognizable script)`);
    return false;
};

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

        const pool = [...ALL_COUNTRIES];
        // No duplication loop here anymore
        const shuffled = pool.sort(() => Math.random() - 0.5).slice(0, safeCount);

        // Check for Rigged Winner (Live Stream)
        let riggedCode = null;
        if (window.winnerQueue.length > 0) {
            riggedCode = window.winnerQueue.shift();

            // Ensure pending winner is in the game
            const exists = shuffled.find(c => c.code === riggedCode);
            if (!exists) {
                const target = ALL_COUNTRIES.find(c => c.code === riggedCode);
                if (target) {
                    shuffled[shuffled.length - 1] = target; // Force inject into pool
                }
                if (target) {
                    shuffled[shuffled.length - 1] = target; // Force inject into pool
                }
            }
            console.log(`%c [${new Date().toLocaleTimeString()}] 👑 RIGGED ROUND FOR: ${riggedCode} `, 'background: #333; color: #e91e63; font-weight: bold;');
        }

        // Preload all flag images before creating physics bodies
        let loadedCount = 0;
        const flagData = [];

        shuffled.forEach((c, index) => {
            const fixedBase = Math.min(gameW, gameH) * 0.09;
            const flagW = fixedBase * config.scale;
            const flagH = flagW * 0.66;

            const centerX = gameW / 2;
            const centerY = gameH / 2;
            const spawnR = arenaRadius * 0.7;
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
            const img = new Image();
            img.crossOrigin = 'anonymous';

            let retryCount = 0;
            const maxRetries = 3;

            const tryLoad = () => {
                img.onload = () => {
                    loadedCount++;
                    flagCache[c.code] = img; // Store in cache
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
                        console.warn(`Failed to load flag: ${c.code} after ${maxRetries} attempts`);
                        loadedCount++;
                        // Still create body even without image
                        flagData.push({ country: c, img: null, x, y, flagW, flagH });

                        if (loadedCount === shuffled.length) {
                            createFlagBodies(flagData);
                        }
                    }
                };

                img.src = `https://flagcdn.com/w160/${c.code}.png`;
            };

            tryLoad();
        });

        // Function to create physics bodies after images are loaded
        function createFlagBodies(flagData) {
            flagData.forEach(data => {
                const body = Matter.Bodies.rectangle(data.x, data.y, data.flagW, data.flagH, {
                    restitution: config.bounce,
                    friction: 0.0,
                    frictionAir: config.airDrag,
                    density: 0.005,
                    inertia: Infinity, // Prevents rotation
                    angle: 0, // Keep fixed at 0 (or set to Math.random() * Math.PI if you want random initial orientation but fixed afterwards)
                    render: { opacity: 0 }
                });

                body.country = data.country;
                body.img = data.img;
                body.w = data.flagW;
                body.h = data.flagH;
                body.hasShield = false;

                // God Mode (Rigged Winner)
                if (riggedCode && data.country.code === riggedCode) {
                    body.isGod = true;
                    Matter.Body.setDensity(body, 1.0); // 200x density (Unstoppable Tank)
                    body.hasShield = false; // Hidden power (No visual shield)
                }

                Matter.Composite.add(engine.world, body);
                flags.push(body);
            });

            updateCounter();
            document.getElementById('round-counter').innerText = roundNumber;
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
        const gapDeg = 50;
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

            const width = (r * 2 * Math.PI / segments) + 4;

            const renderOptions = {
                strokeStyle: config.glowEffect ? config.arenaColor : 'transparent',
                lineWidth: config.glowEffect ? 3 : 0
            };

            if (currentArenaTexture) {
                renderOptions.sprite = {
                    texture: currentArenaTexture,
                    xScale: width / 160, // Scale to fit segment width
                    yScale: config.thickness / 100 // Scale to fit segment height
                };
            } else {
                renderOptions.fillStyle = config.arenaColor;
            }

            parts.push(Bodies.rectangle(x, y, width, config.thickness, {
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
        // Top wall
        const topWall = Bodies.rectangle(centerX, -50, gameW * 2, 100, {
            isStatic: true,
            render: { fillStyle: 'transparent', opacity: 0 }
        });
        Matter.Composite.add(engine.world, topWall);

        // Left wall
        const leftWall = Bodies.rectangle(-50, centerY, 100, gameH * 2, {
            isStatic: true,
            render: { fillStyle: 'transparent', opacity: 0 }
        });
        Matter.Composite.add(engine.world, leftWall);

        // Right wall
        const rightWall = Bodies.rectangle(gameW + 50, centerY, 100, gameH * 2, {
            isStatic: true,
            render: { fillStyle: 'transparent', opacity: 0 }
        });
        Matter.Composite.add(engine.world, rightWall);

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

            // Graveyard Pull (For normal flags, or fail-safe for God)
            if (dist > arenaRadius + 5) { // Tighter threshold

                // God Mode Fail-safe: If somehow it got out, teleport back
                if (b.isGod) {
                    Matter.Body.setPosition(b, {
                        x: centerX,
                        y: centerY
                    });
                    Matter.Body.setVelocity(b, { x: 0, y: 0 });
                } else {
                    // Normal Flag: Graveyard Logic
                    // 1. Remove Air Resistance
                    if (b.frictionAir > 0) b.frictionAir = 0;
                    b.isSleeping = false;

                    // 2. FORCE Downward Velocity
                    // If moving up or too slow, set fixed downward speed
                    if (b.velocity.y < 2) {
                        Matter.Body.setVelocity(b, {
                            x: b.velocity.x * 0.9, // Dampen X to stop flying sideways
                            y: Math.max(b.velocity.y, 5) // Minimum downfall speed of 5
                        });
                    }

                    // 3. Apply continuously increasing force
                    Matter.Body.applyForce(b, b.position, {
                        x: 0,
                        y: 0.05 * b.mass
                    });

                    // 4. Force Position Update (Unstuck Fix)
                    Matter.Body.setPosition(b, {
                        x: b.position.x,
                        y: b.position.y + 10
                    });
                }
            } else {
                // Restore air drag if inside
                if (b.frictionAir === 0) b.frictionAir = config.airDrag;
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
                distFromCenter > arenaRadius + 300 // Safety: eliminate if too far away anyway
            )) {
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
                ctx.arc(0, 0, Math.max(b.w, b.h) * 0.7, 0, Math.PI * 2);
                ctx.stroke();
            }

            ctx.drawImage(b.img, -b.w / 2, -b.h / 2, b.w, b.h);
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 2;
            ctx.strokeRect(-b.w / 2, -b.h / 2, b.w, b.h);
            ctx.restore();
        });
    } catch (e) {
        console.warn('Render error:', e);
    }
}

// Winner handling
function handleWinner(winner) {
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

        // Update Arena Textures if Enabled
        if (config.winnerBackgroundEnabled) {
            // Update Arena Texture (Border)
            currentArenaTexture = `https://flagcdn.com/w160/${winner.country.code}.png`;

            // Update Winner Background (Rotated 90deg)
            const winnerBg = document.getElementById('winner-bg');
            if (winnerBg) {
                winnerBg.style.backgroundImage = `url(https://flagcdn.com/w1280/${winner.country.code}.png)`;
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
        img.src = `https://flagcdn.com/w640/${winner.country.code}.png`;

        // Special text for shout-out rounds
        if (roundNumber % 3 === 0) {
            txt.innerText = "🎉 SHOUT OUT! 🎉\n" + winner.country.name + " WINS!";
            txt.style.color = '#ffd700'; // Gold color for special rounds
        } else {
            txt.innerText = winner.country.name + " WINS!";
            txt.style.color = '#fff'; // Normal white
        }

        const stats = gameStats[winner.country.code];
        if (stats) {
            statsDiv.innerText = `🏆 Total Wins: ${stats.wins}`;
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
        img.src = `https://flagcdn.com/w80/${country.code}.png`;
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
    const counter = document.getElementById('counter');
    if (counter) {
        counter.innerText = flags.length;
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

    // Flag count
    const countSlider = document.getElementById('count-slider');
    if (countSlider) {
        countSlider.addEventListener('input', (e) => {
            config.flagCount = Math.min(parseInt(e.target.value), MAX_FLAGS);
            document.getElementById('count-val').innerText = config.flagCount;
        });
    }

    // Gravity
    const gravSlider = document.getElementById('grav-slider');
    if (gravSlider) {
        gravSlider.addEventListener('input', (e) => {
            config.gravity = parseFloat(e.target.value);
            document.getElementById('grav-val').innerText = config.gravity;
            if (engine) engine.world.gravity.y = config.gravity;
        });
    }

    // Rotation speed
    const speedSlider = document.getElementById('speed-slider');
    if (speedSlider) {
        speedSlider.addEventListener('input', (e) => {
            let val = parseFloat(e.target.value);
            config.rotationSpeed = val * 0.01;
            document.getElementById('speed-val').innerText = val.toFixed(1);
        });
    }

    // Bounce
    const bounceSlider = document.getElementById('bounce-slider');
    if (bounceSlider) {
        bounceSlider.addEventListener('input', (e) => {
            config.bounce = parseFloat(e.target.value);
            document.getElementById('bounce-val').innerText = config.bounce;
            flags.forEach(f => f.restitution = config.bounce);
        });
    }

    // Wall thickness
    const thickSlider = document.getElementById('thick-slider');
    if (thickSlider) {
        thickSlider.addEventListener('input', (e) => {
            config.thickness = parseInt(e.target.value);
            document.getElementById('thick-val').innerText = config.thickness;
            if (engine && arenaBody) {
                Matter.Composite.remove(engine.world, arenaBody);
                createArena();
            }
        });
    }

    // Flag size
    const sizeSlider = document.getElementById('size-slider');
    if (sizeSlider) {
        sizeSlider.addEventListener('input', (e) => {
            const newScale = parseFloat(e.target.value);
            document.getElementById('size-val').innerText = newScale;
            const ratio = newScale / config.scale;
            config.scale = newScale;

            flags.forEach(f => {
                Matter.Body.scale(f, ratio, ratio);
                f.w = f.w * ratio;
                f.h = f.h * ratio;
            });
        });
    }

    // Air drag
    const dragSlider = document.getElementById('drag-slider');
    if (dragSlider) {
        dragSlider.addEventListener('input', (e) => {
            config.airDrag = parseFloat(e.target.value);
            document.getElementById('drag-val').innerText = config.airDrag.toFixed(3);
            flags.forEach(f => f.frictionAir = config.airDrag);
        });
    }

    // Random force
    const forceSlider = document.getElementById('force-slider');
    if (forceSlider) {
        forceSlider.addEventListener('input', (e) => {
            config.randomForce = parseFloat(e.target.value);
            document.getElementById('force-val').innerText = config.randomForce;
        });
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

setInterval(() => {
    fetch('http://localhost:3000/next')
        .then(res => res.json())
        .then(data => {
            // Connection Success Logic
            if (!bridgeConnected) {
                bridgeConnected = true;
                console.log('%c 🟢 Bridge Connected: LIVE CHAT ACTIVE ', 'background: #2ecc71; color: #000; font-size: 14px; font-weight: bold; border-radius: 4px;');
            }

            if (data.winner) {
                console.log(`%c [${new Date().toLocaleTimeString()}] 👑 Priority Winner Received: ${data.winner.toUpperCase()} `, 'background: #ffd700; color: #000; font-size: 12px;');
                window.addWinner(data.winner);
            }
        })
        .catch(err => {
            // Connection Failure Logic
            if (bridgeConnected) {
                bridgeConnected = false;
                console.log('%c 🔴 Bridge Disconnected: Check node bridge.js ', 'background: #e74c3c; color: #fff; font-size: 14px; font-weight: bold; border-radius: 4px;');
            }
        });
}, 2000);
