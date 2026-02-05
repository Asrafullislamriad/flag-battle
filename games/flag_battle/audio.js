// ============================================
// AUDIO.JS - Audio Management System
// ============================================

let audioContext = null;
let audioContextInitialized = false;

// Initialize audio context on user interaction
function initAudioContext() {
    if (!audioContextInitialized) {
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            audioContextInitialized = true;

            // Resume context if suspended
            if (audioContext.state === 'suspended') {
                audioContext.resume();
            }
        } catch (e) {
            console.warn('AudioContext initialization failed:', e);
            audioContextInitialized = false;
        }
    }
}

// Safe tone player with error handling
function playTone(freq, duration, type = 'sine') {
    if (!config.soundEnabled) return;

    try {
        if (!audioContext || audioContext.state === 'suspended') {
            initAudioContext();
        }

        if (!audioContext) return;

        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.frequency.value = freq;
        osc.type = type;
        gain.gain.setValueAtTime(0.1 * config.gameVolume, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01 * config.gameVolume, audioContext.currentTime + duration);
        osc.start();
        osc.stop(audioContext.currentTime + duration);
    } catch (e) {
        console.warn('Audio playback error:', e);
    }
}

// Load default background music
function loadDefaultMusic() {
    const audioPlayer = document.getElementById('bg-music');

    // Set default music
    audioPlayer.src = DEFAULT_MUSIC_URL;
    audioPlayer.loop = true;
    audioPlayer.volume = config.musicVolume;

    // Try to play (will fail without user interaction, that's okay)
    audioPlayer.play().catch(() => {
        console.log('Background music will start after user interaction');
    });
}

// Handle custom music upload
document.addEventListener('DOMContentLoaded', () => {
    const songInput = document.getElementById('song-input');
    if (songInput) {
        songInput.addEventListener('change', function (e) {
            const file = e.target.files[0];
            if (file) {
                try {
                    const audioUrl = URL.createObjectURL(file);
                    const audioPlayer = document.getElementById('bg-music');
                    audioPlayer.src = audioUrl;
                    audioPlayer.loop = true;
                    audioPlayer.volume = config.musicVolume;
                    audioPlayer.play().then(() => {
                        document.querySelector('.file-upload').innerText = "🔊 বাজছে: " + file.name.substring(0, 15) + "...";
                        document.querySelector('.file-upload').style.background = "rgba(46, 204, 113, 0.5)";
                    }).catch(e => {
                        console.warn('Music playback error:', e);
                    });
                } catch (e) {
                    console.warn('Music file error:', e);
                }
            }
        });
    }
});

// Volume bar visualization
function updateVolumeBars(value, elementId) {
    const element = document.getElementById(elementId);
    if (!element) return;

    const bars = Math.round(value / 20);
    const fullBar = '█';
    const emptyBar = '░';
    let display = '';
    for (let i = 0; i < 5; i++) {
        display += i < bars ? fullBar : emptyBar;
    }
    element.innerText = display;
}

// Start music on user interaction
function startMusicOnClick() {
    const audioPlayer = document.getElementById('bg-music');
    if (audioPlayer && audioPlayer.paused) {
        audioPlayer.play().catch(e => {
            console.warn('Music play failed:', e);
        });
    }
}

// Combined initialization on first user interaction
function initializeOnUserAction() {
    initAudioContext();
    startMusicOnClick();

    // Hide music hint
    const hint = document.getElementById('music-start-hint');
    if (hint) {
        hint.style.display = 'none';
    }
}

// Initialize audio and music on first user click
document.addEventListener('click', initializeOnUserAction, { once: true });
document.addEventListener('touchstart', initializeOnUserAction, { once: true });
