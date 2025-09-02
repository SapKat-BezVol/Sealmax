const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');

const db = new Database('data.sqlite');
db.prepare(`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE,
  password TEXT
)`).run();
db.prepare(`CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  senderId INTEGER,
  recipientId INTEGER,
  text TEXT,
  timestamp INTEGER
)`).run();

const app = express();
app.use(cookieParser());
app.use(express.json());

const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || 'sealmax',
  resave: false,
  saveUninitialized: false
});
app.use(sessionMiddleware);
app.use(express.static('public'));

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}

app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'missing fields' });
  }
  const name = username.trim();
  const nameNorm = name.toLowerCase();
  const existing = db
    .prepare('SELECT 1 FROM users WHERE LOWER(username) = ?')
    .get(nameNorm);
  if (existing) {
    return res.status(400).json({ error: 'user exists' });
  }
  try {
    const hash = bcrypt.hashSync(password, 10);
    const info = db
      .prepare('INSERT INTO users (username, password) VALUES (?, ?)')
      .run(name, hash);
    res.json({ id: info.lastInsertRowid, username: name });
  } catch {
    res.status(500).json({ error: 'registration failed' });
  }
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'missing fields' });
  }
  const user = db
    .prepare('SELECT * FROM users WHERE LOWER(username) = ?')
    .get(username.toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'invalid credentials' });
  }
  req.session.userId = user.id;
  res.json({ id: user.id, username: user.username });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

app.get('/api/me', (req, res) => {
  if (!req.session.userId) {
    return res.json({ id: null });
  }
  const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(req.session.userId);
  res.json(user);
});

app.get('/api/users', requireAuth, (req, res) => {
  const users = db.prepare('SELECT id, username FROM users WHERE id != ?').all(req.session.userId);
  res.json(users);
});

app.get('/api/users/:id', requireAuth, (req, res) => {
  const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'not found' });
  }
  res.json(user);
});

app.get('/api/user/:username', requireAuth, (req, res) => {
  const nameNorm = req.params.username.toLowerCase();
  const user = db.prepare('SELECT id, username FROM users WHERE LOWER(username) = ?').get(nameNorm);
  if (!user) {
    return res.status(404).json({ error: 'not found' });
  }
  res.json(user);
});

app.get('/api/contacts', requireAuth, (req, res) => {
  const list = db.prepare(`
    SELECT DISTINCT u.id, u.username
    FROM users u
    JOIN messages m ON (m.senderId = u.id AND m.recipientId = ?) OR (m.recipientId = u.id AND m.senderId = ?)
    WHERE u.id != ?
  `).all(req.session.userId, req.session.userId, req.session.userId);
  res.json(list);
});

app.get('/api/messages/:id', requireAuth, (req, res) => {
  const cid = parseInt(req.params.id, 10);
  let rows;
  if (cid === 0) {
    rows = db.prepare('SELECT * FROM messages WHERE recipientId = 0 ORDER BY id').all();
  } else {
    rows = db.prepare(`SELECT * FROM messages WHERE (senderId = ? AND recipientId = ?) OR (senderId = ? AND recipientId = ?) ORDER BY id`).all(req.session.userId, cid, cid, req.session.userId);
  }
  res.json(rows);
});

const server = http.createServer(app);
const io = new Server(server);

io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, next);
});

io.on('connection', socket => {
  const userId = socket.request.session.userId;
  if (!userId) {
    return socket.disconnect();
  }
  socket.join(`user_${userId}`);
  const history = db.prepare('SELECT * FROM messages WHERE recipientId = 0 ORDER BY id').all();
  socket.emit('chat history', history);
  socket.on('chat message', data => {
    if (!data || typeof data.text !== 'string') {
      return;
    }
    const recipientId = parseInt(data.recipientId, 10) || 0;
    const text = data.text.trim();
    if (!text) {
      return;
    }
    const timestamp = Date.now();
    const info = db.prepare('INSERT INTO messages (senderId, recipientId, text, timestamp) VALUES (?, ?, ?, ?)').run(userId, recipientId, text, timestamp);
    const msg = { id: info.lastInsertRowid, senderId: userId, recipientId, text, timestamp };
    if (recipientId === 0) {
      io.emit('chat message', msg);
    } else {
      io.to(`user_${recipientId}`).emit('chat message', msg);
      socket.emit('chat message', msg);
    }
  });
});

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

module.exports = server;
