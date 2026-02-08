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

// Playlist Configuration
// Storing enabled state in object
const PLAYLIST = [
    { src: '../assets/music/1.mp3', name: 'Track 1', enabled: true },
    { src: '../assets/music/2.mp3', name: 'Track 2', enabled: true },
    { src: '../assets/music/3.mp3', name: 'Track 3', enabled: true },
    { src: '../assets/music/4.mp3', name: 'Track 4', enabled: true }
];
let currentTrackIndex = 0;

// Render Playlist UI in Settings
function renderPlaylistUI() {
    const container = document.getElementById('playlist-container');
    if (!container) return;

    container.innerHTML = ''; // Clear existing

    PLAYLIST.forEach((track, index) => {
        const div = document.createElement('div');
        div.className = 'playlist-item';
        div.innerHTML = `
            <span>${track.name}</span>
            <label class="playlist-toggle">
                <input type="checkbox" ${track.enabled ? 'checked' : ''} onchange="toggleTrack(${index}, this.checked)">
                <span class="playlist-slider"></span>
            </label>
        `;
        container.appendChild(div);
    });
}

// Toggle Track State
window.toggleTrack = function (index, isChecked) {
    if (index >= 0 && index < PLAYLIST.length) {
        PLAYLIST[index].enabled = isChecked;

        // Save playlist state to localStorage
        savePlaylistState();
        console.log(`💾 Track ${index} (${PLAYLIST[index].name}) set to: ${isChecked}`);

        // If current track is disabled, skip to next enabled
        if (!isChecked && currentTrackIndex === index) {
            playNextTrack();
        }
    }
};

// Load and play background music from playlist
function loadDefaultMusic() {
    // Load saved playlist state first
    loadPlaylistState();

    renderPlaylistUI(); // Initialize UI

    const audioPlayer = document.getElementById('bg-music');

    // Set initial track
    playTrack(currentTrackIndex);

    // Listen for track end to play next
    audioPlayer.addEventListener('ended', playNextTrack);
}

function playTrack(index) {
    const audioPlayer = document.getElementById('bg-music');

    // Safety check
    if (index >= PLAYLIST.length) index = 0;

    // Check if enabled
    if (!PLAYLIST[index].enabled) {
        // Find next enabled track
        playNextTrack();
        return;
    }

    currentTrackIndex = index;
    audioPlayer.src = PLAYLIST[currentTrackIndex].src;
    audioPlayer.loop = false;
    audioPlayer.volume = config.musicVolume;

    audioPlayer.play().then(() => {
        console.log(`🎵 Now Playing: ${PLAYLIST[currentTrackIndex].name}`);
    }).catch(() => {
        console.log('Background music will start after user interaction');
    });
}

function playNextTrack() {
    let nextIndex = currentTrackIndex;
    let attempts = 0;
    let found = false;

    // Look for next enabled track
    do {
        nextIndex++;
        if (nextIndex >= PLAYLIST.length) nextIndex = 0;
        attempts++;

        if (PLAYLIST[nextIndex].enabled) {
            found = true;
            break;
        }
    } while (attempts < PLAYLIST.length);

    if (found) {
        playTrack(nextIndex);
    } else {
        console.log('⛔ All tracks disabled');
        const audioPlayer = document.getElementById('bg-music');
        audioPlayer.pause();
    }
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

// Save playlist state to localStorage
function savePlaylistState() {
    const playlistState = PLAYLIST.map(track => ({
        name: track.name,
        enabled: track.enabled
    }));
    localStorage.setItem('playlist_state', JSON.stringify(playlistState));
    console.log('💾 Playlist state saved:', playlistState);
}

// Load playlist state from localStorage
function loadPlaylistState() {
    const savedState = localStorage.getItem('playlist_state');

    if (savedState) {
        try {
            const playlistState = JSON.parse(savedState);

            // Apply saved state to PLAYLIST
            playlistState.forEach((savedTrack, index) => {
                if (index < PLAYLIST.length && savedTrack.name === PLAYLIST[index].name) {
                    PLAYLIST[index].enabled = savedTrack.enabled;
                }
            });

            console.log('📌 Playlist state loaded:', playlistState);
        } catch (e) {
            console.error('❌ Error loading playlist state:', e);
        }
    }
}
