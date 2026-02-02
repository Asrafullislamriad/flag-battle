function updateUI() {
    chrome.storage.local.get({ totalCount: 0, recent: [], connectionStatus: 'Checking...' }, (data) => {
        // Update Count
        document.getElementById('total').innerText = data.totalCount;

        // Update Status
        const statusEl = document.getElementById('status');
        statusEl.innerText = data.connectionStatus;
        statusEl.style.color = data.connectionStatus.includes('Online') ? '#2ecc71' : '#e74c3c';

        // Update List
        const list = document.getElementById('recentList');
        if (data.recent.length === 0) {
            list.innerHTML = '<li style="color: #666; justify-content: center;">No chats yet</li>';
        } else {
            list.innerHTML = '';
            data.recent.forEach((name, index) => {
                const li = document.createElement('li');
                li.innerHTML = `<span class="index">#${index + 1}</span> ${name}`;
                list.appendChild(li);
            });
        }
    });
}

// Update on load
updateUI();

// Listen for updates from background
chrome.storage.onChanged.addListener((changes, namespace) => {
    updateUI();
});
