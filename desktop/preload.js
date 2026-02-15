const { contextBridge, ipcRenderer, desktopCapturer } = require('electron');

// Expose Electron APIs to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
    // Desktop Capturer for streaming
    getDesktopSources: async () => {
        return await desktopCapturer.getSources({ types: ['window', 'screen'] });
    },

    // YouTube Live Chat Integration
    connectYouTube: (videoId) => {
        ipcRenderer.send('connect-youtube', videoId);
    },

    disconnectYouTube: () => {
        ipcRenderer.send('disconnect-youtube');
    },

    toggleChatWindow: () => {
        ipcRenderer.send('toggle-chat-window');
    },

    onYouTubeConnected: (callback) => {
        ipcRenderer.on('youtube-connected', (event, videoId) => callback(videoId));
    },

    // Streaming
    startStream: (key, options) => {
        ipcRenderer.send('start-stream', { key, ...options });
    },

    streamData: (buffer) => {
        ipcRenderer.send('stream-data', buffer);
    },

    stopStream: () => {
        ipcRenderer.send('stop-stream');
    },

    onStreamStatus: (callback) => {
        ipcRenderer.on('stream-status', (event, data) => callback(data));
    },

    // Recording & Streaming (for overlay)
    startRecording: async (settings) => {
        return new Promise((resolve, reject) => {
            ipcRenderer.send('start-recording', settings);
            ipcRenderer.once('recording-started', (event, data) => {
                if (data.success) resolve(data);
                else reject(new Error(data.error));
            });
        });
    },

    stopRecording: async () => {
        return new Promise((resolve) => {
            ipcRenderer.send('stop-recording');
            ipcRenderer.once('recording-stopped', (event, data) => resolve(data));
        });
    },

    startStreaming: async (settings) => {
        return new Promise((resolve, reject) => {
            ipcRenderer.send('start-streaming', settings);
            ipcRenderer.once('streaming-started', (event, data) => {
                if (data.success) resolve(data);
                else reject(new Error(data.error));
            });
        });
    },

    stopStreaming: async () => {
        return new Promise((resolve) => {
            ipcRenderer.send('stop-streaming');
            ipcRenderer.once('streaming-stopped', (event, data) => resolve(data));
        });
    },

    chooseSavePath: async () => {
        return new Promise((resolve) => {
            ipcRenderer.send('choose-save-path');
            ipcRenderer.once('save-path-chosen', (event, path) => resolve(path));
        });
    },

    // Save recording
    saveRecording: (videoBlob) => {
        ipcRenderer.send('save-recording', videoBlob);
    },

    // Simple toggle recording
    toggleRecording: () => {
        ipcRenderer.send('toggle-recording');
    }
});
