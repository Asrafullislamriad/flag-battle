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
            // Capture User Details
            const authorName = node.querySelector('#author-name')?.textContent?.trim() || "Anonymous";
            const authorImg = node.querySelector('#img')?.src || "";

            console.log(`🔹 New Chat: ${authorName}: ${text}`);

            // Visual green border
            node.style.borderLeft = "4px solid #2ecc71";

            // Send to background
            chrome.runtime.sendMessage({
                type: 'NEW_CHAT',
                country: text,
                username: authorName,
                profilePic: authorImg
            });
        }
    });
}

// Setup MutationObserver for instant detection
function setupObserver() {
    const chatContainer = document.querySelector('yt-live-chat-item-list-renderer #items');

    if (!chatContainer) {
        console.warn('⚠️ Chat container not found, will retry...');
        setTimeout(setupObserver, 1000);
        return;
    }

    console.log('👁️ MutationObserver active - instant chat detection enabled!');

    const observer = new MutationObserver((mutations) => {
        // Only scan when new nodes are added
        const hasNewMessages = mutations.some(m => m.addedNodes.length > 0);
        if (hasNewMessages) {
            scanChats();
        }
    });

    observer.observe(chatContainer, {
        childList: true,
        subtree: false
    });
}

// Start observer after warmup
setTimeout(() => {
    setupObserver();
}, 5000);
