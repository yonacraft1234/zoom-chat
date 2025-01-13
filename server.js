const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public', {
    setHeaders: (res, path, stat) => {
        console.log(`[DEBUG] Serving file: ${path}`);
    }
}));

// Handle favicon.ico requests to avoid 404 error
app.get('/favicon.ico', (req, res) => res.status(204).end());

const roomUsers = {};

io.on('connection', (socket) => {
    console.log(`[DEBUG] User connected: ${socket.id}`);

    socket.on('join-room', ({ room, username }) => {
        socket.join(room);
        console.log(`[DEBUG] User ${username} (${socket.id}) joined room: ${room}`);

        if (!roomUsers[room]) {
            roomUsers[room] = [];
        }
        roomUsers[room].push(socket.id);

        // Notify others in the room
        socket.to(room).emit('user-joined', { id: socket.id, username });
    });

    socket.on('signal', (data) => {
        console.log(`[DEBUG] Signal from ${socket.id} to ${data.to}:`, data.signal);
        io.to(data.to).emit('signal', {
            from: socket.id,
            signal: data.signal,
        });
    });

    socket.on('disconnect', () => {
        console.log(`[DEBUG] User disconnected: ${socket.id}`);
        for (const room in roomUsers) {
            if (roomUsers[room].includes(socket.id)) {
                roomUsers[room] = roomUsers[room].filter((id) => id !== socket.id);
                socket.to(room).emit('user-disconnected', { id: socket.id });
            }
        }
    });
});

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`[DEBUG] Server running on port ${PORT}.`);
});
