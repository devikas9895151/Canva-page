const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Use environment variable PORT if available, otherwise default to 4000
const PORT = process.env.PORT || 4000;

const io = new Server(server, {
  cors: { origin: '*' },
});

// Store strokes for all users
let canvasState = {};

// Socket.IO connection
io.on('connection', (socket) => {
  console.log(`[NEW CONNECTION] ${socket.id}`);

  const userId = `User_${Math.random().toString(36).substring(2, 8)}`;
  socket.emit('assignUserId', userId);

  socket.emit('canvasState', canvasState);

  socket.on('stroke', ({ userId, stroke }) => {
    if (!canvasState[userId]) canvasState[userId] = [];
    canvasState[userId].push(stroke);
    socket.broadcast.emit('stroke', { userId, stroke });
  });

  socket.on('requestUndo', ({ userId }) => {
    if (!canvasState[userId] || canvasState[userId].length === 0) {
      socket.emit('undoFailed', 'No strokes found to undo.');
      return;
    }

    const lastStroke = [...canvasState[userId]].reverse().find(s => s.status !== 'undone');
    if (lastStroke) {
      lastStroke.status = 'undone';
      io.emit('canvasOperation', { type: 'undo', strokeId: lastStroke.id, userId });
    } else {
      socket.emit('undoFailed', 'No active stroke found.');
    }
  });

  socket.on('disconnect', () => console.log(`[USER DISCONNECTED] ${socket.id}`));
});

// Serve frontend
app.use(express.static(path.join(__dirname, '../client')));

// Start server
server.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));
