const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 4000;

const io = new Server(server, { cors: { origin: '*' } });

// Canvas state and user management
let canvasState = {}; // { userId: [strokes] }
let onlineUsers = {}; // { socketId: { userId, color } }
// Added a redoStack for basic Redo functionality
let redoStack = {};  // { userId: [redoStrokes] }
const colors = ['#e6194b','#3cb44b','#ffe119','#4363d8','#f58231','#911eb4','#46f0f0','#f032e6','#bcf60c','#fabebe'];

io.on('connection', (socket) => {
    console.log(`[NEW CONNECTION] ${socket.id}`);
    
    // Assign userId and color
    const userId = `User_${Math.random().toString(36).substring(2,6)}`;
    const userColor = colors[Math.floor(Math.random()*colors.length)];
    onlineUsers[socket.id] = { userId, color: userColor };
    
    // Initialize stroke and redo stacks for the new user
    if (!canvasState[userId]) canvasState[userId] = [];
    if (!redoStack[userId]) redoStack[userId] = [];

    // ⭐️ FIX: Send an object containing both userId and color
    socket.emit('assignUserId', { userId, color: userColor });
    
    // Send updated user list to everyone
    io.emit('updateUsers', Object.values(onlineUsers));

    // Send current canvas state
    socket.emit('canvasState', canvasState);

    // Handle strokes
    socket.on('stroke', ({ userId, stroke }) => {
        if (!canvasState[userId]) canvasState[userId] = [];
        canvasState[userId].push(stroke);
        // Clear redo stack on a new stroke
        redoStack[userId] = []; 
        socket.broadcast.emit('stroke', { userId, stroke });
    });
    
    // Handle chat messages
    socket.on('chatMessage', (data) => {
        io.emit('chatMessage', data);
    });

    // Undo
    socket.on('requestUndo', ({ userId }) => {
        const userStrokes = canvasState[userId] || [];
        // Find the last active stroke by this user
        const lastStroke = [...userStrokes].reverse().find(s => s.status === 'active' && s.userId === userId);

        if (lastStroke) {
            lastStroke.status = 'undone';
            // Move to redo stack
            redoStack[userId].push(lastStroke); 
            // Broadcast the operation for all clients to hide the stroke
            io.emit('canvasOperation', { type: 'undo', strokeId: lastStroke.id, userId });
        } else {
            socket.emit('undoFailed', 'No active stroke found');
        }
    });

    // Redo
    socket.on('requestRedo', ({ userId }) => {
        const userRedo = redoStack[userId] || [];
        
        if (userRedo.length > 0) {
            const stroke = userRedo.pop();
            stroke.status = 'active';
            // Note: Since the stroke is still in canvasState and just marked 'undone', 
            // we don't need to push it back here, but we need to notify the client to redraw.
            
            // Broadcast the operation with the full stroke object so client can redraw it
            io.emit('canvasOperation', { type: 'redo', stroke, userId });
        } else {
            socket.emit('redoFailed', 'No strokes to redo');
        }
    });

    // Cursor position
    socket.on('cursorMove', pos => {
        const currentUser = onlineUsers[socket.id];
        if (currentUser) {
            socket.broadcast.emit('cursorMove', { userId: currentUser.userId, ...pos });
        }
    });

    socket.on('disconnect', () => {
        delete onlineUsers[socket.id];
        io.emit('updateUsers', Object.values(onlineUsers));
        console.log(`[DISCONNECTED] ${socket.id}`);
    });
});

// Serve frontend
app.use(express.static(path.join(__dirname, '../client')));

// Start server
server.listen(PORT, () => console.log(` Server running at http://localhost:${PORT}`));