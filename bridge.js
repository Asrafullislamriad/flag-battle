const http = require('http');

// Queue to store winners from chat
let winnerQueue = [];

const server = http.createServer((req, res) => {
    // Enable CORS (Allows Game and YouTube to connect)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Max-Age', '86400'); // Cache preflight

    // Handle Pre-flight requests
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // Endpoint: YouTube script sends country here
    // POST http://localhost:3000/add
    if (req.url === '/add' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                if (data.country) {
                    // Store full object: { country, username, profilePic }
                    console.log('📥 Chat Winner:', data.country, 'by', data.username);
                    winnerQueue.push(data);
                }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'ok', queueLength: winnerQueue.length }));
            } catch (e) {
                res.writeHead(400);
                res.end('Invalid JSON');
            }
        });
    }
    // Endpoint: Game checks this to see who is next
    // GET http://localhost:3000/next
    else if (req.url === '/next' && req.method === 'GET') {
        const winner = winnerQueue.length > 0 ? winnerQueue[0] : null; // Peek, don't remove yet
        // Only remove if game confirms? No, simplistic: game polls.
        // Better: Game asks "next", we give it. 
        // We really should only pop when the game USES it.
        // Let's assume Game calls this when starting a round.

        // Wait, if game polls every second, we shouldn't pop.
        // We should have a separate 'pop' endpoint or just pop on get?
        // Let's start simple: 'pop' on get. 
        // NOTE: The game should only call this ONCE per round start.

        // But the game handles queue internally locally?
        // No, game should pull from server to fill local queue.

        // Let's make it POP:
        // Return ALL pending winners and clear queue
        const batch = [...winnerQueue];
        winnerQueue = []; // Clear immediately

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ batch: batch }));
    } else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`\n🚀 BRIDGE SERVER RUNNING!`);
    console.log(`👉 Waiting for YouTube comments on port ${PORT}...`);
    console.log(`👉 Keep this window OPEN while streaming.\n`);
});
