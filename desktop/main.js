const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
let chatWindow;
let currentVideoId = null;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      webSecurity: false, // ✅ CORS bypass
      nodeIntegration: false, // Disabled for security with contextIsolation
      contextIsolation: true, // ✅ Required for contextBridge
      allowRunningInsecureContent: true,
      preload: path.join(__dirname, 'preload.js')
    },
    title: 'Flag Battle Desktop',
    icon: path.join(__dirname, 'build', 'icon.png')
  });

  // Load the game
  // Development (npm start): Load from local files
  // Production (installed app): Load from GitHub Pages
  const isDev = !app.isPackaged;

  if (isDev) {
    // Development mode - local files
    const gamePath = path.join(__dirname, '..', 'games', 'flag_battle', 'index.html');
    console.log('🔧 Development mode - Loading game from:', gamePath);
    mainWindow.loadFile(gamePath);
  } else {
    // Production mode - GitHub Pages
    const gameUrl = 'https://asrafullislamriad.github.io/flag-battle/games/flag_battle/';
    console.log('🚀 Production mode - Loading game from:', gameUrl);
    mainWindow.loadURL(gameUrl);
  }

  mainWindow.webContents.openDevTools(); // For debugging

  // Inject recording/streaming overlay on all pages
  mainWindow.webContents.on('did-finish-load', () => {
    injectOverlay();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (chatWindow) chatWindow.close();
  });

  console.log('✅ Main window created');
}

function createChatWindow(videoId) {
  if (chatWindow) {
    chatWindow.close();
  }

  chatWindow = new BrowserWindow({
    width: 400,
    height: 700,
    x: 1200, // Position on right side
    y: 50,
    show: false, // ✅ HIDDEN by default
    title: '📺 YouTube Live Chat',
    webPreferences: {
      webSecurity: false, // ✅ CORS bypass
      nodeIntegration: true, // Required for chat scraping
      contextIsolation: false // Required with nodeIntegration
    }
  });

  const chatUrl = `https://www.youtube.com/live_chat?is_popout=1&v=${videoId}`;
  chatWindow.loadURL(chatUrl);

  console.log(`✅ Chat window created for video: ${videoId}`);

  // Start scraping after page loads
  chatWindow.webContents.on('did-finish-load', () => {
    console.log('🔍 Chat page loaded, starting scraper...');

    // Open DevTools for debugging (optional - remove in production)
    // chatWindow.webContents.openDevTools();

    // Auto-switch to Live chat - SIMPLIFIED APPROACH
    setTimeout(() => {
      chatWindow.webContents.executeJavaScript(`
        console.log('🔄 Starting auto-switch to Live chat...');
        
        // Find all buttons in header
        const allButtons = document.querySelectorAll('yt-live-chat-header-renderer button');
        console.log('Found ' + allButtons.length + ' buttons in header');
        
        // Click the first button (should be Top chat/Live chat dropdown)
        if (allButtons.length > 0) {
          allButtons[0].click();
          console.log('📋 Clicked first button (dropdown)');
          
          // Wait 1 second for menu
          setTimeout(() => {
            // Find all menu items
            const menuItems = document.querySelectorAll('tp-yt-paper-listbox > *');
            console.log('Found ' + menuItems.length + ' menu items');
            
            // Click second item (Live chat is usually second)
            if (menuItems.length >= 2) {
              menuItems[1].click();
              console.log('✅ Clicked second menu item (Live chat)');
            } else {
              console.log('⚠️ Not enough menu items found');
            }
          }, 1000);
        } else {
          console.log('⚠️ No buttons found in header');
        }
      `);
    }, 5000); // Wait 5 seconds for full page load

    startChatScraping();
  });

  currentVideoId = videoId;
}

function startChatScraping() {
  setInterval(() => {
    if (!chatWindow || chatWindow.isDestroyed()) return;

    chatWindow.webContents.executeJavaScript(`
      (function() {
        const messages = document.querySelectorAll('yt-live-chat-text-message-renderer');
        
        if (messages.length > 0) {
          const lastMsg = messages[messages.length - 1];
          
          if (!lastMsg.hasAttribute('data-scraped')) {
            lastMsg.setAttribute('data-scraped', 'true');
            
            const user = lastMsg.querySelector('#author-name')?.innerText || '';
            const messageEl = lastMsg.querySelector('#message');
            
            let comment = '';
            if (messageEl) {
              messageEl.childNodes.forEach(node => {
                if (node.nodeType === Node.TEXT_NODE) {
                  comment += node.textContent;
                } else if (node.tagName === 'IMG') {
                  comment += node.alt || '';
                }
              });
            }
            
            const imgEl = lastMsg.querySelector('#img');
            const pic = imgEl ? imgEl.src : '';
            
            if (user && comment) {
              return { user, comment, pic };
            }
          }
        }
        return null;
      })();
    `).then(data => {
      if (data) {
        console.log(`📤 Chat: [${data.user}]: ${data.comment}`);

        // Send to main window
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.executeJavaScript(`
            if (typeof window.addWinner === 'function') {
              window.addWinner({
                country: "${data.comment.replace(/"/g, '\\"')}",
                username: "${data.user.replace(/"/g, '\\"')}",
                profilePic: "${data.pic}"
              });
              console.log('🚀 Flag spawned: ${data.comment}');
            } else {
              console.error('❌ window.addWinner not found');
            }
          `);
        }
      }
    }).catch(err => {
      console.error('❌ Scraping error:', err.message);
    });
  }, 500);
}

// IPC Handlers
ipcMain.on('connect-youtube', (event, videoId) => {
  console.log('📺 Connecting to YouTube:', videoId);
  createChatWindow(videoId);
  event.reply('youtube-connected', videoId);
});

ipcMain.on('disconnect-youtube', () => {
  if (chatWindow) {
    chatWindow.close();
    chatWindow = null;
  }
  currentVideoId = null;
  console.log('🔌 YouTube disconnected');
});

// Toggle chat window visibility
ipcMain.on('toggle-chat-window', () => {
  if (chatWindow && !chatWindow.isDestroyed()) {
    if (chatWindow.isVisible()) {
      chatWindow.hide();
      console.log('🙈 Chat window hidden');
    } else {
      chatWindow.show();
      console.log('👁️ Chat window visible');
    }
  } else {
    console.log('❌ No chat window to toggle');
  }
});


const streamer = require('./streaming/streamer');

// Streaming IPC Handlers
// Streaming IPC Handlers
ipcMain.on('start-stream', (event, arg) => {
  console.log('🎥 Requesting start stream...');

  let key = arg;
  let options = {};

  // Handle object payload
  if (typeof arg === 'object') {
    key = arg.key;
    options = { bitrate: arg.bitrate };
  }

  streamer.startStream(key, options,
    (msg) => event.reply('stream-status', { status: 'active', message: msg }),
    (err) => event.reply('stream-status', { status: 'error', message: err })
  );
});

ipcMain.on('stream-data', (event, buffer) => {
  streamer.writeToStream(Buffer.from(buffer));
});

ipcMain.on('stop-stream', (event) => {
  console.log('🛑 Requesting stop stream...');
  streamer.stopStream();
  event.reply('stream-status', { status: 'stopped', message: 'Stream stopped' });
});

// Simple recording state
let isRecording = false;

// Toggle recording handler
ipcMain.on('toggle-recording', async (event) => {
  if (!isRecording) {
    // Start recording - handled in renderer
    isRecording = true;
    console.log('🎥 Recording started');
    event.reply('recording-state-changed', { recording: true });
  } else {
    // Stop recording
    isRecording = false;
    console.log('⏹️ Recording stopped');
    event.reply('recording-state-changed', { recording: false });
  }
});

// Save recorded video
ipcMain.on('save-recording', (event, videoBlob) => {
  const { dialog } = require('electron');
  const fs = require('fs');

  dialog.showSaveDialog(mainWindow, {
    defaultPath: `recording-${Date.now()}.webm`,
    filters: [{ name: 'Videos', extensions: ['webm'] }]
  }).then(result => {
    if (!result.canceled && result.filePath) {
      // Convert base64 to buffer and save
      const base64Data = videoBlob.replace(/^data:video\/webm;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      fs.writeFileSync(result.filePath, buffer);
      console.log('✅ Recording saved:', result.filePath);
    }
  });
});

// Simple inline overlay injection - NO external files!
function injectOverlay() {
  mainWindow.webContents.executeJavaScript(`
    (function() {
      // Recording state
      let mediaRecorder = null;
      let recordedChunks = [];
      let stream = null;
      
      // Simple floating record button
      const btn = document.createElement('div');
      btn.id = 'electron-record-btn';
      btn.innerHTML = '🎥';
      btn.style.cssText = 'position:fixed;bottom:20px;right:20px;width:60px;height:60px;background:linear-gradient(135deg,#e74c3c,#c0392b);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:28px;cursor:pointer;z-index:999999;box-shadow:0 4px 20px rgba(231,76,60,0.5);transition:transform 0.2s;';
      
      btn.onclick = async function() {
        if (!mediaRecorder || mediaRecorder.state === 'inactive') {
          // Start recording
          try {
            stream = await navigator.mediaDevices.getDisplayMedia({
              video: { mediaSource: 'screen' },
              audio: false
            });
            
            recordedChunks = [];
            mediaRecorder = new MediaRecorder(stream, {
              mimeType: 'video/webm;codecs=vp9'
            });
            
            mediaRecorder.ondataavailable = (e) => {
              if (e.data.size > 0) {
                recordedChunks.push(e.data);
              }
            };
            
            mediaRecorder.onstop = () => {
              const blob = new Blob(recordedChunks, { type: 'video/webm' });
              const reader = new FileReader();
              reader.onloadend = () => {
                if (window.electronAPI && window.electronAPI.saveRecording) {
                  window.electronAPI.saveRecording(reader.result);
                }
              };
              reader.readAsDataURL(blob);
              
              // Stop all tracks
              stream.getTracks().forEach(track => track.stop());
            };
            
            mediaRecorder.start();
            
            // Update button
            btn.innerHTML = '⏹️';
            btn.style.background = 'linear-gradient(135deg, #27ae60, #229954)';
            console.log('✅ Recording started');
            
          } catch (error) {
            console.error('❌ Failed to start recording:', error);
            alert('Failed to start recording. Please try again.');
          }
        } else {
          // Stop recording
          mediaRecorder.stop();
          
          // Update button
          btn.innerHTML = '🎥';
          btn.style.background = 'linear-gradient(135deg, #e74c3c, #c0392b)';
          console.log('⏹️ Recording stopped');
        }
      };
      
      btn.onmouseenter = function() { this.style.transform = 'scale(1.1)'; };
      btn.onmouseleave = function() { this.style.transform = 'scale(1)'; };
      
      document.body.appendChild(btn);
      console.log('✅ Simple record button added');
    })();
  `).catch(err => console.error('Failed to inject button:', err));
}

// App lifecycle
app.whenReady().then(() => {
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

console.log('🚀 Electron app started');
