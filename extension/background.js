// Background Service Worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'NEW_CHAT') {
        const country = message.country;

        // 1. Update Extensions Stats (For Popup)
        chrome.storage.local.get({ totalCount: 0, recent: [] }, (data) => {
            let newCount = data.totalCount + 1;
            let newRecent = [country, ...data.recent].slice(0, 10); // Keep last 10

            chrome.storage.local.set({
                totalCount: newCount,
                recent: newRecent,
                lastUpdate: Date.now()
            });
        });

        // 2. Send to Local Bridge Server (Game)
        fetch('http://localhost:3000/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                country: country,
                username: message.username,
                profilePic: message.profilePic
            })
        })
            .then(response => {
                console.log(`📡 Sent to Game: ${country}`);
                // We could update 'connectionStatus' in storage here too
                chrome.storage.local.set({ connectionStatus: '🟢 Online' });
            })
            .catch(err => {
                console.warn(`❌ Bridge Error:`, err);
                chrome.storage.local.set({ connectionStatus: '🔴 Offline' });
            });
    }
});
