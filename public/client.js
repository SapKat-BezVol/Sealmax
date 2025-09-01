async function api(path, method = 'GET', body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(path, opts);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

const authBox = document.getElementById('auth');
const registerBox = document.getElementById('register');
const loginUser = document.getElementById('loginUser');
const loginPass = document.getElementById('loginPass');
const loginBtn = document.getElementById('loginBtn');
const showRegister = document.getElementById('showRegister');
const regUser = document.getElementById('regUser');
const regPass = document.getElementById('regPass');
const regBtn = document.getElementById('regBtn');
const showLogin = document.getElementById('showLogin');
const app = document.getElementById('app');
const contactsUl = document.getElementById('contacts');
const contactSearch = document.getElementById('contactSearch');
const messagesUl = document.getElementById('messages');
const form = document.getElementById('form');
const input = document.getElementById('input');
const chatWith = document.getElementById('chatWith');
const logoutBtn = document.getElementById('logoutBtn');

let socket;
let me = null;
let activeId = 0;
const contacts = new Map();

function renderContacts() {
  contactsUl.innerHTML = '';
  const general = { id: 0, username: 'General' };
  [general, ...contacts.values()].forEach(u => {
    const li = document.createElement('li');
    li.textContent = u.username + (u.id ? ` (@${u.id})` : '');
    li.dataset.id = u.id;
    if (u.id === activeId) li.classList.add('active');
    li.onclick = () => selectContact(u.id);
    contactsUl.appendChild(li);
  });
}

async function loadContacts() {
  const list = await api('/api/users');
  list.forEach(u => contacts.set(u.id, u));
  renderContacts();
}

async function loadMessages(id) {
  messagesUl.innerHTML = '';
  const msgs = await api(`/api/messages/${id}`);
  msgs.forEach(renderMessage);
  messagesUl.scrollTop = messagesUl.scrollHeight;
}

function renderMessage(m) {
  const li = document.createElement('li');
  const sender = m.senderId === me.id ? 'Me' : contacts.get(m.senderId)?.username || `@${m.senderId}`;
  li.textContent = `${sender}: ${m.text}`;
  messagesUl.appendChild(li);
}

function selectContact(id) {
  activeId = id;
  chatWith.textContent = id === 0 ? 'General' : contacts.get(id)?.username || `@${id}`;
  renderContacts();
  loadMessages(id);
}

loginBtn.onclick = async () => {
  try {
    me = await api('/api/login', 'POST', { username: loginUser.value, password: loginPass.value });
    authBox.style.display = 'none';
    app.style.display = 'flex';
    await loadContacts();
    initSocket();
    selectContact(0);
  } catch (e) {
    alert('Login failed');
  }
};

showRegister.onclick = () => {
  authBox.style.display = 'none';
  registerBox.style.display = 'flex';
};

showLogin.onclick = () => {
  registerBox.style.display = 'none';
  authBox.style.display = 'flex';
};

regBtn.onclick = async () => {
  try {
    await api('/api/register', 'POST', { username: regUser.value, password: regPass.value });
    registerBox.style.display = 'none';
    authBox.style.display = 'flex';
  } catch (e) {
    alert('Registration failed');
  }
};

async function init() {
  try {
    const user = await api('/api/me');
    if (user.id) {
      me = user;
      authBox.style.display = 'none';
      app.style.display = 'flex';
      await loadContacts();
      initSocket();
      selectContact(0);
    }
  } catch {}
}

function initSocket() {
  socket = io();
  socket.on('chat history', msgs => {
    if (activeId === 0) {
      messagesUl.innerHTML = '';
      msgs.forEach(renderMessage);
      messagesUl.scrollTop = messagesUl.scrollHeight;
    }
  });
  socket.on('chat message', msg => {
    const relevant = msg.recipientId === 0 && activeId === 0 ||
      (msg.senderId === activeId && msg.recipientId === me.id) ||
      (msg.senderId === me.id && msg.recipientId === activeId);
    if (relevant) {
      renderMessage(msg);
      messagesUl.scrollTop = messagesUl.scrollHeight;
    }
    if (!contacts.has(msg.senderId) && msg.senderId !== me.id) {
      // load new contact
      api(`/api/users/${msg.senderId}`).then(u => {
        contacts.set(u.id, u);
        renderContacts();
      }).catch(() => {});
    }
  });
}

form.addEventListener('submit', e => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  socket.emit('chat message', { recipientId: activeId, text });
  input.value = '';
});

contactSearch.addEventListener('keydown', async e => {
  if (e.key === 'Enter') {
    const id = parseInt(contactSearch.value.slice(1), 10);
    contactSearch.value = '';
    if (id && !contacts.has(id)) {
      try {
        const u = await api(`/api/users/${id}`);
        contacts.set(u.id, u);
        renderContacts();
      } catch {}
    }
  }
});

logoutBtn.onclick = async () => {
  await api('/api/logout', 'POST');
  location.reload();
};

init();
