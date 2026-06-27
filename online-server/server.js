import { Server } from 'socket.io';
import http from 'http';
import cors from 'cors';

const PORT = process.env.PORT || 7861;

// Create HTTP server
const server = http.createServer();

// Setup Socket.io
const io = new Server(server, {
  cors: {
    origin: '*', // Allow all origins for development, restrict in production
    methods: ['GET', 'POST']
  }
});

// Track online users - separate registered and guests
const onlineUsers = {
  registered: new Set(),
  guests: new Set()
};

io.on('connection', (socket) => {
  console.log(`New user connected: ${socket.id}`);
  
  // Listen for user identification
  socket.on('identify-user', (isRegistered) => {
    // Remove from previous status if exists
    onlineUsers.registered.delete(socket.id);
    onlineUsers.guests.delete(socket.id);
    
    // Add to appropriate set
    if (isRegistered) {
      onlineUsers.registered.add(socket.id);
    } else {
      onlineUsers.guests.add(socket.id);
    }
    
    // Emit updated counts
    io.emit('online-count', {
      total: onlineUsers.registered.size + onlineUsers.guests.size,
      registered: onlineUsers.registered.size,
      guests: onlineUsers.guests.size
    });
  });
  
  // Emit initial counts when a user connects
  socket.emit('online-count', {
    total: onlineUsers.registered.size + onlineUsers.guests.size,
    registered: onlineUsers.registered.size,
    guests: onlineUsers.guests.size
  });
  
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    
    // Remove from both sets to be safe
    onlineUsers.registered.delete(socket.id);
    onlineUsers.guests.delete(socket.id);
    
    // Emit updated counts
    io.emit('online-count', {
      total: onlineUsers.registered.size + onlineUsers.guests.size,
      registered: onlineUsers.registered.size,
      guests: onlineUsers.guests.size
    });
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Online Users Server running on port ${PORT}`);
  console.log(`Connected users: 0 (0 registered, 0 guests)`);
});
