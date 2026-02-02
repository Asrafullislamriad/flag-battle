// Flag Battle Chat Reader (Interval Version)
console.log("✅ Flag Battle Chat Scanner: STARTED");

let seenMessages = new Set();

function scanChats() {
    // Select ALL chat messages currently in the DOM
    const chats = document.querySelectorAll('yt-live-chat-text-message-renderer');

    chats.forEach(node => {
        const id = node.id;
        if (seenMessages.has(id)) return;
        seenMessages.add(id);

        const messageElement = node.querySelector('#message');
        if (!messageElement) return;

        let text = "";
        messageElement.childNodes.forEach(n => {
            if (n.nodeType === 3) text += n.textContent;
            else if (n.tagName === 'IMG') text += n.alt;
        });

        text = text.trim();
        if (text) {
            console.log(`🔹 Captured: ${text}`);

            // Visual green border
            node.style.borderLeft = "4px solid #2ecc71";

            // Send to background
            chrome.runtime.sendMessage({ type: 'NEW_CHAT', country: text });
        }
    });
}

// Run scanner every 1 second
setInterval(scanChats, 1000);
console.log("👀 Polling for chats every 1s...");
