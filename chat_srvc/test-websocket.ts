import { io } from 'socket.io-client';

const socket = io('https://localhost:3001', {
    rejectUnauthorized: false,
    secure: true,
});

socket.on('connect', () => {
    console.log('Connected to server:', socket.id);
    socket.emit('join_room', 'test-room');
    socket.emit('send_message', { roomId: 'test-room', content: 'Hello World' });
});

socket.on('receive_message', (data) => {
    console.log('Received message:', data);
    socket.disconnect();
});

socket.on('disconnect', () => {
    console.log('Disconnected');
});

socket.on('connect_error', (err) => {
    console.error('Connection error:', err);
});
