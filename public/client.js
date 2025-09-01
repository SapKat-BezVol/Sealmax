function getCookie(name) {
  const value = document.cookie.split('; ').find(row => row.startsWith(name + '='));
  return value ? decodeURIComponent(value.split('=')[1]) : null;
}

function setCookie(name, value, days = 365) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/`;
}

const usernameDisplay = document.getElementById('usernameDisplay');
const changeNameBtn = document.getElementById('changeNameBtn');
const nameModal = document.getElementById('nameModal');
const nameInput = document.getElementById('nameInput');
const saveName = document.getElementById('saveName');

let username = getCookie('username') || '';

function updateUsername(newName) {
  username = newName || 'Anonymous';
  setCookie('username', username);
  usernameDisplay.textContent = username;
}

if (!username) {
  nameModal.style.display = 'flex';
} else {
  usernameDisplay.textContent = username;
}

changeNameBtn.addEventListener('click', () => {
  nameInput.value = username;
  nameModal.style.display = 'flex';
});

saveName.addEventListener('click', () => {
  updateUsername(nameInput.value.trim());
  nameModal.style.display = 'none';
});

function loadMessages() {
  const data = localStorage.getItem('messages');
  return data ? JSON.parse(data) : [];
}

function saveMessages(msgs) {
  localStorage.setItem('messages', JSON.stringify(msgs));
}

let lastReadId = parseInt(localStorage.getItem('lastReadId') || '0', 10);
const messages = loadMessages();
const ul = document.getElementById('messages');

function renderMessage(msg, markUnread) {
  const item = document.createElement('li');
  item.textContent = `${msg.user}: ${msg.text}`;
  if (markUnread && msg.id > lastReadId) {
    item.classList.add('unread');
  }
  ul.appendChild(item);
}

messages.forEach(msg => {
  renderMessage(msg, msg.id > lastReadId);
});
if (messages.length) {
  lastReadId = messages[messages.length - 1].id;
}

const socket = io();

socket.on('chat history', history => {
  history.forEach(msg => {
    if (!messages.find(m => m.id === msg.id)) {
      renderMessage(msg, msg.id > lastReadId);
      messages.push(msg);
    }
  });
  if (messages.length) {
    lastReadId = messages[messages.length - 1].id;
  }
  saveMessages(messages);
});

socket.on('chat message', msg => {
  const hidden = document.hidden;
  renderMessage(msg, hidden);
  messages.push(msg);
  saveMessages(messages);
  if (!hidden) {
    lastReadId = msg.id;
  }
});

const form = document.getElementById('form');
const input = document.getElementById('input');

form.addEventListener('submit', e => {
  e.preventDefault();
  if (input.value) {
    const msg = { id: Date.now(), user: username || 'Anonymous', text: input.value };
    socket.emit('chat message', msg);
    input.value = '';
  }
});

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    lastReadId = messages.length ? messages[messages.length - 1].id : lastReadId;
    setTimeout(() => {
      document.querySelectorAll('.unread').forEach(item => item.classList.remove('unread'));
    }, 1000);
  }
});

window.addEventListener('beforeunload', () => {
  if (messages.length) {
    localStorage.setItem('lastReadId', messages[messages.length - 1].id);
  }
});
