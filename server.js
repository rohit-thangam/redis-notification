const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { createClient } = require('redis');
require('dotenv').config();
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const notificationHistory = [];

// Create Redis client using the direct URL
const client = createClient({
    url: process.env.REDIS_URL
});

// Connect to Redis
client.connect()
    .then(() => console.log('Connected to Redis successfully'))
    .catch(err => console.error('Redis connection error:', err));

// Middleware to parse JSON
app.use(express.json());

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Socket.io connection
io.on('connection', (socket) => {
    console.log('A user connected');
});

// Like notification endpoint
app.post('/notifications/like', async (req, res) => {
    const { userName, postName } = req.body;

    if (!userName || !postName) {
        return res.status(400).send({ error: 'userName and postName are required' });
    }

    try {
        const message = `${userName} liked post ${postName}`;
        io.emit('notification', message);

        // Store the notification in history
        notificationHistory.push(message);

        // Save the like in Redis
        const result = await client.sAdd(`post:${postName}:likes`, userName);
        
        if (result === 0) {
            return res.status(400).send({ error: 'User has already liked this post' });
        }

        res.status(200).send({ message });
    } catch (err) {
        console.error('Error in likeNotification:', err.message);
        res.status(500).send({ error: 'Failed to save like information' });
    }
});

// Follow notification endpoint
app.post('/notifications/follow', async (req, res) => {
    const { followerName, followeeName } = req.body;

    if (!followerName || !followeeName) {
        return res.status(400).send({ error: 'followerName and followeeName are required' });
    }

    try {
        const message = `${followerName} followed ${followeeName}`;
        io.emit('notification', message);

        // Store the notification in history
        notificationHistory.push(message);

        // Save the follow in Redis (optional, if you want to keep track)
        await client.sAdd(`user:${followeeName}:followers`, followerName);

        res.status(200).send({ message });
    } catch (err) {
        console.error('Error in followNotification:', err.message);
        res.status(500).send({ error: 'Failed to save follow information' });
    }
});

// Comment notification endpoint
app.post('/notifications/comment', async (req, res) => {
    const { userName, postName, comment } = req.body;

    if (!userName || !postName || !comment) {
        return res.status(400).send({ error: 'userName, postName, and comment are required' });
    }

    try {
        const message = `${userName} commented on post ${postName}: "${comment}"`;
        io.emit('notification', message);

        // Store the notification in history
        notificationHistory.push(message);

        // Save the comment in Redis (optional)
        await client.lPush(`post:${postName}:comments`, `${userName}: ${comment}`);

        res.status(200).send({ message });
    } catch (err) {
        console.error('Error in commentNotification:', err.message);
        res.status(500).send({ error: 'Failed to save comment information' });
    }
});

// Fetch notification history
app.get('/notifications/history', (req, res) => {
    res.send(notificationHistory);
});

// Clear notification history
app.delete('/notifications', (req, res) => {
    notificationHistory.length = 0; // Clear the array
    res.send({ message: 'Notification history cleared' });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
