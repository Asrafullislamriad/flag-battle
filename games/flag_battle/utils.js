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
    const bgVideo = document.getElementById('bg-video');
    const graveyard = document.getElementById('graveyard');

    if (!gameArea) return;

    // Reset video
    if (bgVideo) {
        bgVideo.style.display = 'none';
        try {
            bgVideo.pause();
        } catch (e) { }
    }

    switch (config.bgType) {
        case 'solid':
            gameArea.style.background = config.bgColor;
            break;
        case 'image':
            if (config.customBgImage) {
                gameArea.style.background = `url(${config.customBgImage}) center/cover no-repeat`;
            } else {
                gameArea.style.background = config.bgColor;
            }
            break;
        case 'video':
            if (config.customBgVideo && bgVideo) {
                if (bgVideo.src !== config.customBgVideo) {
                    bgVideo.src = config.customBgVideo;
                }
                bgVideo.style.display = 'block';
                bgVideo.play().catch(e => console.warn('Video auto-play blocked:', e));
                gameArea.style.background = 'black'; // Fallback under video
            } else {
                gameArea.style.background = config.bgColor;
            }
            break;
        case 'gradient':
        default:
            gameArea.style.background =
                `radial-gradient(circle, ${lightenColor(config.bgColor, 20)} 0%, ${config.bgColor} 100%)`;
            break;
    }

    // 🆕 Sync Graveyard Background
    if (graveyard) {
        if (config.bgType === 'gradient') {
            graveyard.style.background =
                `radial-gradient(circle, ${lightenColor(config.bgColor, 20)} 0%, ${config.bgColor} 100%)`;
        } else {
            // For other types, use solid color for readability
            graveyard.style.background = config.bgColor;
        }
    }

    if (window.arenaBody && window.arenaBody.parts) {
        window.arenaBody.parts.forEach(part => {
            if (part.render) {
                part.render.fillStyle = config.arenaColor;
            }
        });
    }
}

function changeBgType(type) {
    config.bgType = type;
    const select = document.getElementById('bg-type-select');
    if (select) select.value = type;

    // Show/hide controls
    const imgCtrl = document.getElementById('bg-image-control');
    const vidCtrl = document.getElementById('bg-video-control');
    if (imgCtrl) imgCtrl.style.display = type === 'image' ? 'block' : 'none';
    if (vidCtrl) vidCtrl.style.display = type === 'video' ? 'block' : 'none';

    saveSettings();
    applyColors();
}

function handleBgImage(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            alert('Image is too large! Please choose an image under 5MB.');
            return;
        }
        const reader = new FileReader();
        reader.onload = function (e) {
            config.customBgImage = e.target.result;
            saveSettings();
            applyColors();
        };
        reader.readAsDataURL(file);
    }
}

function handleBgVideo(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        if (file.size > 20 * 1024 * 1024) { // 20MB limit
            alert('Video is too large! Please choose a video under 20MB.');
            return;
        }
        const reader = new FileReader();
        reader.onload = function (e) {
            config.customBgVideo = e.target.result;
            saveSettings();
            applyColors();
        };
        reader.readAsDataURL(file);
    }
}

// Settings modal functions
function openSettings() {
    const modal = document.getElementById('settings-modal');
    const backdrop = document.getElementById('settings-backdrop');

    // Show backdrop and modal
    backdrop.style.display = 'block';
    modal.style.display = 'block';

    // Trigger animation after display is set
    setTimeout(() => {
        backdrop.classList.add('show');
        modal.classList.add('show');
    }, 10);
}

function closeSettings() {
    saveSettings();
    const modal = document.getElementById('settings-modal');
    const backdrop = document.getElementById('settings-backdrop');

    // Remove show class to trigger slide-down animation
    backdrop.classList.remove('show');
    modal.classList.remove('show');

    // Hide after animation completes
    setTimeout(() => {
        backdrop.style.display = 'none';
        modal.style.display = 'none';
    }, 300); // Match CSS transition duration
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

// Apply settings to UI (Sync UI with Config)
function applySettings() {
    const elements = {
        'circle-slider': config.circlePercent * 100,
        'circle-val': Math.round(config.circlePercent * 100),
        'count-slider': config.flagCount,
        'count-val': config.flagCount,
        'grav-slider': config.gravity,
        'grav-val': config.gravity,
        'speed-slider': (config.rotationSpeed / 0.01).toFixed(1),
        'speed-val': (config.rotationSpeed / 0.01).toFixed(1),
        'bounce-slider': config.bounce,
        'bounce-val': config.bounce,
        'thick-slider': config.thickness,
        'thick-val': config.thickness,
        'gap-slider': config.gapSize,
        'gap-val': config.gapSize,
        'size-slider': config.scale,
        'size-val': config.scale.toFixed(1),
        'drag-slider': config.airDrag,
        'drag-val': config.airDrag.toFixed(3),
        'force-slider': config.randomForce,
        'force-val': config.randomForce,
        'arena-color': config.arenaColor,
        'bg-color': config.bgColor,
        'profile-size-slider': config.profileSize || 32,
        'profile-size-val': config.profileSize || 32,
        'game-vol-slider': config.gameVolume * 100,
        'game-vol-val': Math.round(config.gameVolume * 100),
        'music-vol-slider': config.musicVolume * 100,
        'music-vol-val': Math.round(config.musicVolume * 100),
        'last-winner-size-slider': parseInt(localStorage.getItem('last_winner_size')) || 150,
        'last-winner-size-val': parseInt(localStorage.getItem('last_winner_size')) || 150
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

    // Checkboxes mapping: ID -> Config Key
    const checkboxMap = {
        'powerups-toggle': 'powerupsEnabled',
        'particles-toggle': 'particlesEnabled',
        'sound-toggle': 'soundEnabled',
        'glow-toggle': 'glowEffect',
        'winner-bg-toggle': 'winnerBackgroundEnabled',
        'winner-profile-toggle': 'winnerProfileEnabled',
        'flag-border-toggle': 'flagBorderEnabled',
        'show-names-toggle': 'showPlayerNames',
        'trails-toggle': 'trailsEffect',
        'round-flags-toggle': 'roundFlagsEnabled',
        'rotation-toggle': 'rotationEnabled'
    };

    Object.entries(checkboxMap).forEach(([id, configKey]) => {
        const element = document.getElementById(id);
        if (element && config[configKey] !== undefined) {
            element.checked = config[configKey];
        }
    });

    const bgSelect = document.getElementById('bg-type-select');
    if (bgSelect) {
        bgSelect.value = config.bgType || 'gradient';
        changeBgType(bgSelect.value);
    }

    updateVolumeBars(config.gameVolume * 100, 'game-vol-bars');
    updateVolumeBars(config.musicVolume * 100, 'music-vol-bars');

    const audioPlayer = document.getElementById('bg-music');
    if (audioPlayer && audioPlayer.src) {
        audioPlayer.volume = config.musicVolume;
    }

    applyColors();
}

// Attach all listeners ONCE (Universal Settings Handler)
function initSettingsListeners() {
    const modal = document.getElementById('settings-modal');
    if (!modal) return;

    // 1. Checkboxes
    const checkboxMap = {
        'powerups-toggle': 'powerupsEnabled',
        'particles-toggle': 'particlesEnabled',
        'sound-toggle': 'soundEnabled',
        'glow-toggle': 'glowEffect',
        'winner-bg-toggle': 'winnerBackgroundEnabled',
        'winner-profile-toggle': 'winnerProfileEnabled',
        'flag-border-toggle': 'flagBorderEnabled',
        'show-names-toggle': 'showPlayerNames',
        'trails-toggle': 'trailsEffect',
        'round-flags-toggle': 'roundFlagsEnabled',
        'rotation-toggle': 'rotationEnabled'
    };

    Object.entries(checkboxMap).forEach(([id, configKey]) => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', (e) => {
                config[configKey] = e.target.checked;
                saveSettings();
                console.log(`⚙️ Setting ${configKey} updated to ${config[configKey]}`);
            });
        }
    });

    // 2. Sliders (Range Inputs)
    const sliders = modal.querySelectorAll('input[type="range"]');
    sliders.forEach(slider => {
        slider.addEventListener('input', (e) => {
            const id = e.target.id;
            const val = parseFloat(e.target.value);
            const displayEl = document.getElementById(id.replace('-slider', '-val'));

            // Update Config based on Slider ID
            switch (id) {
                case 'circle-slider': config.circlePercent = val / 100; if (displayEl) displayEl.innerText = Math.round(val); break;
                case 'count-slider': config.flagCount = val; if (displayEl) displayEl.innerText = val; break;
                case 'grav-slider': config.gravity = val; if (displayEl) displayEl.innerText = val; break;
                case 'speed-slider': config.rotationSpeed = val * 0.01; if (displayEl) displayEl.innerText = val.toFixed(1); break;
                case 'bounce-slider': config.bounce = val; if (displayEl) displayEl.innerText = val; break;
                case 'thick-slider': config.thickness = val; if (displayEl) displayEl.innerText = val; break;
                case 'gap-slider': config.gapSize = val; if (displayEl) displayEl.innerText = val; break;
                case 'size-slider': config.scale = val; if (displayEl) displayEl.innerText = val.toFixed(1); break;
                case 'drag-slider': config.airDrag = val; if (displayEl) displayEl.innerText = val.toFixed(3); break;
                case 'force-slider': config.randomForce = val; if (displayEl) displayEl.innerText = val; break;
                case 'profile-size-slider': config.profileSize = val; if (displayEl) displayEl.innerText = val; break;
                case 'game-vol-slider': config.gameVolume = val / 100; if (displayEl) displayEl.innerText = Math.round(val); updateVolumeBars(val, 'game-vol-bars'); break;
                case 'music-vol-slider': config.musicVolume = val / 100; if (displayEl) displayEl.innerText = Math.round(val); updateVolumeBars(val, 'music-vol-bars'); break;
                case 'last-winner-size-slider': if (displayEl) displayEl.innerText = val; applyLastWinnerSize(val); break;
            }

            // Real-time updates for some settings
            if (id === 'bounce-slider' && window.flags) window.flags.forEach(f => f.restitution = config.bounce);
            if (id === 'drag-slider' && window.flags) window.flags.forEach(f => f.frictionAir = config.airDrag);
            if (id === 'size-slider' && window.flags && window.Matter) {
                const ratio = val / config.scale;
                config.scale = val;
                window.flags.forEach(f => {
                    window.Matter.Body.scale(f, ratio, ratio);
                    if (f.w) f.w *= ratio;
                    if (f.h) f.h *= ratio;
                });
            }
        });

        slider.addEventListener('change', () => {
            saveSettings();
        });
    });

    // 3. Color Inputs
    ['arena-color', 'bg-color'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', (e) => {
                if (id === 'arena-color') config.arenaColor = e.target.value;
                else config.bgColor = e.target.value;
                applyColors();
                saveSettings();
            });
        }
    });

    // 4. Select Inputs
    const bgSelect = document.getElementById('bg-type-select');
    if (bgSelect) {
        bgSelect.addEventListener('change', (e) => {
            config.bgType = e.target.value;
            changeBgType(e.target.value);
            saveSettings();
        });
    }
}

// Boot sequence: Initialization
window.addEventListener('DOMContentLoaded', () => {
    // Add initialization delay to ensure all scripts are loaded
    setTimeout(() => {
        initSettingsListeners();
        console.log('✅ Settings listeners initialized');
    }, 500);
});

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

    img.src = `../../games/assets/flags/${countryCode}.png`;

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
