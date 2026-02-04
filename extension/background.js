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

        // Country code replacement (Israel → Palestine)
        const countryReplacement = {
            'il': 'ps',
            '🇮🇱': 'ps',
            'israel': 'ps',
            'Israel': 'ps',
            'ISRAEL': 'ps'
        };

        let finalCountry = country;
        const lowerCountry = country.toLowerCase().trim();

        // Check direct match or lowercase match
        if (countryReplacement[country] || countryReplacement[lowerCountry]) {
            finalCountry = countryReplacement[country] || countryReplacement[lowerCountry];
            console.log(`🔄 Country replaced: ${country} → ${finalCountry}`);
        }

        fetch('http://localhost:3000/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                country: finalCountry,
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
