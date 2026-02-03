// Flag Battle Chat Reader (Smart Warmup Version)
console.log("✅ Flag Battle Chat Scanner: STARTED");

let seenMessages = new Set();
let isWarmup = true;

// Warmup Phase: Ignore old chats for first 5 seconds
console.log("⏳ Warming up... Ignoring old chats for 5 seconds.");
setTimeout(() => {
    isWarmup = false;
    console.log("🚀 WARMUP DONE: Now listening for NEW comments only!");
}, 5000);

function scanChats() {
    // Select ALL chat messages currently in the DOM
    const chats = document.querySelectorAll('yt-live-chat-text-message-renderer');

    chats.forEach(node => {
        const id = node.id;
        if (seenMessages.has(id)) return;
        seenMessages.add(id);

        // Capture text
        const messageElement = node.querySelector('#message');
        if (!messageElement) return;

        let text = "";
        messageElement.childNodes.forEach(n => {
            if (n.nodeType === 3) text += n.textContent;
            else if (n.tagName === 'IMG') text += n.alt;
        });
        text = text.trim();

        // LOGIC:
        // If it's Warmup phase -> Just mark as seen (Visual: Gray)
        // If it's Live phase -> Send to game (Visual: Green)

        if (isWarmup) {
            // Mark old chats as ignored
            node.style.borderLeft = "4px solid #7f8c8d"; // Gray border
            return;
        }

        if (text) {
            console.log(`🔹 New Chat: ${text}`);

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
