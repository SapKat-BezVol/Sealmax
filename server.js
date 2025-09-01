const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cookieParser = require('cookie-parser');

const app = express();
app.use(cookieParser());
app.use(express.static('public'));

const server = http.createServer(app);
const io = new Server(server);

const history = [];

io.on('connection', (socket) => {
  socket.emit('chat history', history);
  socket.on('chat message', (data) => {
    history.push(data);
    io.emit('chat message', data);
  });
});

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

module.exports = server;
