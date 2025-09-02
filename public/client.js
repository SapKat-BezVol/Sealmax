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
const loginError = document.getElementById('loginError');
const loginBtn = document.getElementById('loginBtn');
const showRegister = document.getElementById('showRegister');
const regUser = document.getElementById('regUser');
const regCustom = document.getElementById('regCustom');
const regPass = document.getElementById('regPass');
const regError = document.getElementById('regError');
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
const unread = new Map();

function renderContacts() {
  contactsUl.innerHTML = '';
  const general = { id: 0, username: 'General' };
  [general, ...contacts.values()].forEach(u => {
    const li = document.createElement('li');
    li.dataset.id = u.id;
    if (u.id === activeId) li.classList.add('active');
    const name = document.createElement('span');
    name.textContent = u.username + (u.customId ? ` (@${u.customId})` : '');
    li.appendChild(name);
    const count = unread.get(u.id);
    if (count) {
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = count;
      li.appendChild(badge);
    }
    li.onclick = () => selectContact(u.id);
    contactsUl.appendChild(li);
  });
}

async function loadContacts() {
  const list = await api('/api/contacts');
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
  li.className = m.senderId === me.id ? 'mine' : 'theirs';
  let prefix = '';
  if (m.recipientId === 0) {
    const sender = m.senderId === me.id ? 'Me' : contacts.get(m.senderId)?.username || `@${m.senderId}`;
    prefix = sender + ': ';
  }
  li.textContent = prefix + m.text;
  messagesUl.appendChild(li);
}

function selectContact(id) {
  activeId = id;
  chatWith.textContent = id === 0 ? 'General' : contacts.get(id)?.username || `@${id}`;
  unread.set(id, 0);
  renderContacts();
  loadMessages(id);
}

loginBtn.onclick = async () => {
  loginError.textContent = '';
  try {
    me = await api('/api/login', 'POST', { username: loginUser.value, password: loginPass.value });
    authBox.style.display = 'none';
    app.style.display = 'flex';
    await loadContacts();
    initSocket();
    selectContact(0);
  } catch (e) {
    let msg;
    try { msg = JSON.parse(e.message).error; } catch { msg = 'Login failed'; }
    loginError.textContent = msg;
  }
};

showRegister.onclick = () => {
  loginError.textContent = '';
  regError.textContent = '';
  authBox.style.display = 'none';
  registerBox.style.display = 'flex';
};

showLogin.onclick = () => {
  regError.textContent = '';
  loginError.textContent = '';
  registerBox.style.display = 'none';
  authBox.style.display = 'flex';
};

regBtn.onclick = async () => {
  regError.textContent = '';
  try {
    await api('/api/register', 'POST', { username: regUser.value, password: regPass.value, customId: regCustom.value });
    registerBox.style.display = 'none';
    authBox.style.display = 'flex';
  } catch (e) {
    let msg;
    try { msg = JSON.parse(e.message).error; } catch { msg = 'Registration failed'; }
    regError.textContent = msg;
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
    } else {
      const otherId = msg.senderId === me.id ? msg.recipientId : msg.senderId;
      unread.set(otherId, (unread.get(otherId) || 0) + 1);
      renderContacts();
    }
    if (!contacts.has(msg.senderId) && msg.senderId !== me.id) {
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
    const handle = contactSearch.value.slice(1).toLowerCase();
    contactSearch.value = '';
    if (handle && ![...contacts.values()].some(u => u.customId === handle)) {
      try {
        const u = await api(`/api/custom/${handle}`);
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
