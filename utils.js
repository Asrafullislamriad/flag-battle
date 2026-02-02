// ============================================
// UTILS.JS - Utility Functions & UI Management
// ============================================

// Color utility function
function lightenColor(color, percent) {
    try {
        const num = parseInt(color.replace("#", ""), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) + amt;
        const G = (num >> 8 & 0x00FF) + amt;
        const B = (num & 0x0000FF) + amt;
        return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
            (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 + (B < 255 ? B < 1 ? 0 : B : 255))
            .toString(16).slice(1);
    } catch (e) {
        console.warn('Color parsing error:', e);
        return color; // Return original color on error
    }
}

// Apply color settings
function applyColors() {
    const gameArea = document.getElementById('game-area');
    if (gameArea) {
        gameArea.style.background =
            `radial-gradient(circle, ${lightenColor(config.bgColor, 20)} 0%, ${config.bgColor} 100%)`;
    }

    if (window.arenaBody && window.arenaBody.parts) {
        window.arenaBody.parts.forEach(part => {
            if (part.render) {
                part.render.fillStyle = config.arenaColor;
            }
        });
    }
}

// Settings modal functions
function openSettings() {
    document.getElementById('settings-modal').style.display = 'block';
}

function closeSettings() {
    saveSettings();
    document.getElementById('settings-modal').style.display = 'none';
}

function setArenaColor(color) {
    config.arenaColor = color;
    document.getElementById('arena-color').value = color;
    applyColors();
}

function setBgColor(color) {
    config.bgColor = color;
    document.getElementById('bg-color').value = color;
    applyColors();
}

function resetSettings() {
    if (confirm('সব সেটিংস ডিফল্টে রিসেট করবেন?')) {
        Object.assign(config, defaultConfig);
        saveSettings();
        applySettings();
        if (window.engine && window.arenaBody) {
            Matter.Composite.remove(window.engine.world, window.arenaBody);
            window.createArena();
        }
    }
}

// Apply settings to UI
function applySettings() {
    const elements = {
        'circle-slider': config.circlePercent * 100,
        'circle-val': Math.round(config.circlePercent * 100),
        'count-slider': config.flagCount,
        'count-val': config.flagCount,
        'grav-slider': config.gravity,
        'grav-val': config.gravity,
        'speed-slider': config.rotationSpeed * 55.56,
        'speed-val': (config.rotationSpeed * 55.56).toFixed(1),
        'bounce-slider': config.bounce,
        'bounce-val': config.bounce,
        'thick-slider': config.thickness,
        'thick-val': config.thickness,
        'size-slider': config.scale,
        'size-val': config.scale,
        'drag-slider': config.airDrag,
        'drag-val': config.airDrag.toFixed(3),
        'force-slider': config.randomForce,
        'force-val': config.randomForce,
        'arena-color': config.arenaColor,
        'bg-color': config.bgColor,
        'game-vol-slider': config.gameVolume * 100,
        'game-vol-val': Math.round(config.gameVolume * 100),
        'music-vol-slider': config.musicVolume * 100,
        'music-vol-val': Math.round(config.musicVolume * 100)
    };

    Object.entries(elements).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) {
            if (element.type === 'range' || element.type === 'color') {
                element.value = value;
            } else {
                element.innerText = value;
            }
        }
    });

    // Checkboxes
    const checkboxes = {
        'powerups-toggle': config.powerupsEnabled,
        'particles-toggle': config.particlesEnabled,
        'sound-toggle': config.soundEnabled,
        'glow-toggle': config.glowEffect,
        'winner-bg-toggle': config.winnerBackgroundEnabled,
        'trails-toggle': config.trailsEffect
    };

    Object.entries(checkboxes).forEach(([id, checked]) => {
        const element = document.getElementById(id);
        if (element) element.checked = checked;
    });

    updateVolumeBars(config.gameVolume * 100, 'game-vol-bars');
    updateVolumeBars(config.musicVolume * 100, 'music-vol-bars');

    const audioPlayer = document.getElementById('bg-music');
    if (audioPlayer && audioPlayer.src) {
        audioPlayer.volume = config.musicVolume;
    }

    applyColors();
}

// Debounce function for resize events
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Safe image loader with fallback
function loadFlagImage(countryCode, onLoad, onError) {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
        if (onLoad) onLoad(img);
    };

    img.onerror = () => {
        console.warn(`Failed to load flag: ${countryCode}`);
        if (onError) onError();
    };

    img.src = `https://flagcdn.com/w160/${countryCode}.png`;

    return img;
}

// Memory cleanup function for long-running streams
function performMemoryCleanup() {
    // Clean up old particles
    if (window.particles && window.particles.length > MAX_PARTICLES) {
        window.particles.splice(0, window.particles.length - MAX_PARTICLES);
    }

    // Force garbage collection hint (browsers may ignore)
    if (window.gc) {
        try {
            window.gc();
        } catch (e) {
            // Ignore - gc() not available in production
        }
    }
}

// Start periodic memory cleanup
setInterval(performMemoryCleanup, MEMORY_CLEANUP_INTERVAL);

// Service Worker for PWA (with error handling)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        const swCode = `
            self.addEventListener('install', (e) => {
                self.skipWaiting();
            });
            self.addEventListener('activate', (e) => {
                self.clients.claim();
            });
            self.addEventListener('fetch', (e) => {
                e.respondWith(fetch(e.request).catch(() => {
                    return new Response('Offline');
                }));
            });
        `;

        try {
            const blob = new Blob([swCode], { type: 'application/javascript' });
            const swUrl = URL.createObjectURL(blob);

            navigator.serviceWorker.register(swUrl).then(() => {
                console.log('PWA Ready!');
            }).catch((e) => {
                console.log('PWA registration failed:', e);
            });
        } catch (e) {
            console.log('Service Worker not supported:', e);
        }
    });
}
