const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let mainWindow;
let chatWindow;
let currentVideoId = null;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      webSecurity: false, // ✅ CORS bypass
      nodeIntegration: true,
      contextIsolation: false,
      allowRunningInsecureContent: true
    },
    title: 'Flag Battle Desktop',
    icon: path.join(__dirname, 'build', 'icon.png')
  });

  // Load the game from existing folder
  const gamePath = path.join(__dirname, '..', 'games', 'flag_battle', 'index.html');
  mainWindow.loadFile(gamePath);

  mainWindow.webContents.openDevTools(); // For debugging

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
      nodeIntegration: true,
      contextIsolation: false
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
