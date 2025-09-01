function getCookie(name) {
  const value = document.cookie.split('; ').find(row => row.startsWith(name + '='));
  return value ? decodeURIComponent(value.split('=')[1]) : null;
}

function setCookie(name, value, days = 365) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/`;
}

let username = getCookie('username');
if (!username) {
  username = prompt('Enter your name');
  if (!username) username = 'Anonymous';
  setCookie('username', username);
}

function loadMessages() {
  const data = getCookie('messages');
  return data ? JSON.parse(data) : [];
}

function saveMessages(msgs) {
  setCookie('messages', JSON.stringify(msgs));
}

const messages = loadMessages();
const ul = document.getElementById('messages');
messages.forEach(msg => {
  const item = document.createElement('li');
  item.textContent = `${msg.user}: ${msg.text}`;
  ul.appendChild(item);
});

const socket = io();

socket.on('chat history', history => {
  history.forEach(msg => {
    if (!messages.find(m => m.id === msg.id)) {
      const item = document.createElement('li');
      item.textContent = `${msg.user}: ${msg.text}`;
      ul.appendChild(item);
      messages.push(msg);
    }
  });
  saveMessages(messages);
});

socket.on('chat message', msg => {
  const item = document.createElement('li');
  item.textContent = `${msg.user}: ${msg.text}`;
  ul.appendChild(item);
  messages.push(msg);
  saveMessages(messages);
});

const form = document.getElementById('form');
const input = document.getElementById('input');

form.addEventListener('submit', e => {
  e.preventDefault();
  if (input.value) {
    const msg = { id: Date.now(), user: username, text: input.value };
    socket.emit('chat message', msg);
    input.value = '';
  }
});
