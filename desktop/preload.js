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
    }
});
