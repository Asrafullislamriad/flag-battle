// Global Recording/Streaming Overlay Logic

let isRecording = false;
let isStreaming = false;
let recordingStartTime = null;
let statsInterval = null;

// Initialize overlay
function initOverlay() {
    const btn = document.getElementById('recording-overlay-btn');
    const panel = document.getElementById('recording-overlay-panel');

    // Toggle panel
    btn.addEventListener('click', () => {
        panel.classList.toggle('show');
    });

    // Close panel when clicking outside
    document.addEventListener('click', (e) => {
        if (!btn.contains(e.target) && !panel.contains(e.target)) {
            panel.classList.remove('show');
        }
    });

    // FPS slider
    const fpsSlider = document.getElementById('overlay-fps');
    const fpsValue = document.getElementById('overlay-fps-value');
    fpsSlider.addEventListener('input', () => {
        fpsValue.textContent = fpsSlider.value;
    });

    // Bitrate slider
    const bitrateSlider = document.getElementById('overlay-bitrate');
    const bitrateValue = document.getElementById('overlay-bitrate-value');
    bitrateSlider.addEventListener('input', () => {
        bitrateValue.textContent = bitrateSlider.value;
    });

    // Start Recording button
    document.getElementById('overlay-start-record').addEventListener('click', startRecording);

    // Start Streaming button
    document.getElementById('overlay-start-stream').addEventListener('click', startStreaming);

    // Stop button
    document.getElementById('overlay-stop-all').addEventListener('click', stopAll);

    // Choose save path
    document.getElementById('overlay-choose-path').addEventListener('click', chooseSavePath);
}

// Get current settings
function getSettings() {
    const resolution = document.getElementById('overlay-resolution').value;
    const [width, height] = resolution.split('x').map(Number);

    return {
        width,
        height,
        fps: parseInt(document.getElementById('overlay-fps').value),
        bitrate: parseInt(document.getElementById('overlay-bitrate').value) * 1000, // Convert to bps
        aspectRatio: document.getElementById('overlay-aspect-ratio').value,
        savePath: document.getElementById('overlay-save-path').value || null
    };
}

// Start Recording
async function startRecording() {
    if (isRecording || isStreaming) return;

    try {
        const settings = getSettings();

        // Call Electron API to start recording
        if (window.electronAPI && window.electronAPI.startRecording) {
            await window.electronAPI.startRecording(settings);

            isRecording = true;
            recordingStartTime = Date.now();

            // Update UI
            updateUIState('recording');
            showStats();
            startStatsUpdate();

            console.log('✅ Recording started');
        } else {
            alert('Recording API not available. Please restart the app.');
        }
    } catch (error) {
        console.error('❌ Failed to start recording:', error);
        alert('Failed to start recording: ' + error.message);
    }
}

// Start Streaming
async function startStreaming() {
    if (isRecording || isStreaming) return;

    const streamKey = document.getElementById('overlay-stream-key').value.trim();
    if (!streamKey) {
        alert('Please enter your YouTube stream key');
        return;
    }

    try {
        const settings = getSettings();
        settings.streamKey = streamKey;

        // Call Electron API to start streaming
        if (window.electronAPI && window.electronAPI.startStreaming) {
            await window.electronAPI.startStreaming(settings);

            isStreaming = true;
            recordingStartTime = Date.now();

            // Update UI
            updateUIState('streaming');
            showStats();
            startStatsUpdate();

            console.log('✅ Streaming started');
        } else {
            alert('Streaming API not available. Please restart the app.');
        }
    } catch (error) {
        console.error('❌ Failed to start streaming:', error);
        alert('Failed to start streaming: ' + error.message);
    }
}

// Stop All
async function stopAll() {
    try {
        if (isRecording && window.electronAPI && window.electronAPI.stopRecording) {
            await window.electronAPI.stopRecording();
            console.log('✅ Recording stopped');
        }

        if (isStreaming && window.electronAPI && window.electronAPI.stopStreaming) {
            await window.electronAPI.stopStreaming();
            console.log('✅ Streaming stopped');
        }

        isRecording = false;
        isStreaming = false;
        recordingStartTime = null;

        // Update UI
        updateUIState('idle');
        hideStats();
        stopStatsUpdate();

    } catch (error) {
        console.error('❌ Failed to stop:', error);
        alert('Failed to stop: ' + error.message);
    }
}

// Choose save path
async function chooseSavePath() {
    if (window.electronAPI && window.electronAPI.chooseSavePath) {
        const path = await window.electronAPI.chooseSavePath();
        if (path) {
            document.getElementById('overlay-save-path').value = path;
        }
    }
}

// Update UI state
function updateUIState(state) {
    const btn = document.getElementById('recording-overlay-btn');
    const recordBtn = document.getElementById('overlay-start-record');
    const streamBtn = document.getElementById('overlay-start-stream');
    const stopBtn = document.getElementById('overlay-stop-all');

    btn.className = '';

    if (state === 'recording') {
        btn.classList.add('recording');
        btn.textContent = '⏺️';
        recordBtn.style.display = 'none';
        streamBtn.style.display = 'none';
        stopBtn.style.display = 'block';
    } else if (state === 'streaming') {
        btn.classList.add('streaming');
        btn.textContent = '🔴';
        recordBtn.style.display = 'none';
        streamBtn.style.display = 'none';
        stopBtn.style.display = 'block';
    } else {
        btn.textContent = '🎥';
        recordBtn.style.display = 'block';
        streamBtn.style.display = 'block';
        stopBtn.style.display = 'none';
    }
}

// Show stats
function showStats() {
    document.getElementById('overlay-stats').style.display = 'block';
}

// Hide stats
function hideStats() {
    document.getElementById('overlay-stats').style.display = 'none';
}

// Start stats update
function startStatsUpdate() {
    statsInterval = setInterval(updateStats, 1000);
}

// Stop stats update
function stopStatsUpdate() {
    if (statsInterval) {
        clearInterval(statsInterval);
        statsInterval = null;
    }
}

// Update stats
function updateStats() {
    if (!recordingStartTime) return;

    const duration = Date.now() - recordingStartTime;
    const hours = Math.floor(duration / 3600000);
    const minutes = Math.floor((duration % 3600000) / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);

    const durationStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    document.getElementById('overlay-status').textContent = isRecording ? 'Recording' : 'Streaming';
    document.getElementById('overlay-duration').textContent = durationStr;

    // Estimate file size (rough calculation)
    const bitrate = parseInt(document.getElementById('overlay-bitrate').value);
    const fileSizeMB = ((bitrate * duration) / 8000000).toFixed(2);
    document.getElementById('overlay-filesize').textContent = fileSizeMB + ' MB';

    // FPS (would need actual measurement from capture)
    const targetFPS = document.getElementById('overlay-fps').value;
    document.getElementById('overlay-current-fps').textContent = targetFPS;
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initOverlay);
} else {
    initOverlay();
}
