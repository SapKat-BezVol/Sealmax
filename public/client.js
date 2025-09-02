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
const themeBtn = document.getElementById('themeBtn');

let socket;
let me = null;
let activeId = 0;
const contacts = new Map();
const unread = new Map();

/* ——— UI helpers ——— */
function setBusy(el, busy=true){
  if (!el) return;
  el.setAttribute('aria-busy', busy ? 'true' : 'false');
  if ('disabled' in el) el.disabled = !!busy;
}
function clearAndFocus(el){ el.value=''; el.focus(); }

/* ——— Рендер контактов ——— */
function renderContacts() {
  contactsUl.innerHTML = '';
  const general = { id: 0, username: 'General' };
  [general, ...contacts.values()].forEach(u => {
    const li = document.createElement('li');
    li.dataset.id = u.id;
    if (u.id === activeId) li.classList.add('active');

    const name = document.createElement('span');
    name.textContent = u.username;
    li.appendChild(name);

    const count = unread.get(u.id);
    if (count) {
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = count;
      badge.setAttribute('aria-label', `Непрочитанных: ${count}`);
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

/* ——— Сообщения ——— */
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
    const sender = m.senderId === me.id ? 'Me' : contacts.get(m.senderId)?.username;
    if (sender) prefix = sender + ': ';
  }
  li.textContent = prefix + m.text;
  messagesUl.appendChild(li);
}

function selectContact(id) {
  activeId = id;
  chatWith.textContent = id === 0 ? 'General' : contacts.get(id)?.username || '';
  unread.set(id, 0);
  renderContacts();
  loadMessages(id);
}

/* ——— Авторизация ——— */
loginBtn.onclick = async () => {
  loginError.textContent = '';
  setBusy(loginBtn, true);
  authBox.setAttribute('aria-busy', 'true');
  try {
    me = await api('/api/login', 'POST', { username: loginUser.value.trim(), password: loginPass.value });
    authBox.style.display = 'none';
    app.style.display = 'flex';
    await loadContacts();
    initSocket();
    selectContact(0);
    input.focus();
  } catch (e) {
    let msg;
    try { msg = JSON.parse(e.message).error; } catch { msg = 'Ошибка входа'; }
    loginError.textContent = msg;
  } finally {
    setBusy(loginBtn, false);
    authBox.setAttribute('aria-busy', 'false');
  }
};

/* Enter для логина */
[loginUser, loginPass].forEach(el => {
  el.addEventListener('keydown', ev => {
    if (ev.key === 'Enter') loginBtn.click();
  });
});

showRegister.onclick = () => {
  loginError.textContent = '';
  regError.textContent = '';
  authBox.style.display = 'none';
  registerBox.style.display = 'flex';
  setTimeout(() => regUser.focus(), 0);
};

showLogin.onclick = () => {
  regError.textContent = '';
  loginError.textContent = '';
  registerBox.style.display = 'none';
  authBox.style.display = 'flex';
  setTimeout(() => loginUser.focus(), 0);
};

regBtn.onclick = async () => {
  regError.textContent = '';
  setBusy(regBtn, true);
  registerBox.setAttribute('aria-busy', 'true');
  try {
    await api('/api/register', 'POST', { username: regUser.value.trim(), password: regPass.value });
    registerBox.style.display = 'none';
    authBox.style.display = 'flex';
    clearAndFocus(loginUser);
  } catch (e) {
    let msg;
    try { msg = JSON.parse(e.message).error; } catch { msg = 'Ошибка регистрации'; }
    regError.textContent = msg;
  } finally {
    setBusy(regBtn, false);
    registerBox.setAttribute('aria-busy', 'false');
  }
};

/* Enter для регистрации */
[regUser, regPass].forEach(el => {
  el.addEventListener('keydown', ev => {
    if (ev.key === 'Enter') regBtn.click();
  });
});

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
      input.focus();
    } else {
      loginUser.focus();
    }
  } catch {
    loginUser.focus();
  }
}

/* ——— Socket.io ——— */
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

/* ——— Отправка сообщения ——— */
form.addEventListener('submit', e => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  socket.emit('chat message', { recipientId: activeId, text });
  input.value = '';
  input.focus();
});

/* Поиск по Enter: username */
contactSearch.addEventListener('keydown', async e => {
  if (e.key === 'Enter') {
    const v = contactSearch.value.trim();
    if (!v) return;
    const name = v.startsWith('@') ? v.slice(1).toLowerCase() : v.toLowerCase();
    contactSearch.value = '';
    if (name && ![...contacts.values()].some(u => u.username.toLowerCase() === name)) {
      try {
        const u = await api(`/api/user/${name}`);
        contacts.set(u.id, u);
        renderContacts();
      } catch {/* молча */}
    }
  }
});

function applyTheme() {
  const dark = localStorage.getItem('theme') === 'dark';
  document.documentElement.classList.toggle('dark', dark);
  themeBtn.textContent = dark ? 'Светлая тема' : 'Тёмная тема';
}

themeBtn.onclick = () => {
  const dark = !document.documentElement.classList.contains('dark');
  document.documentElement.classList.toggle('dark', dark);
  localStorage.setItem('theme', dark ? 'dark' : 'light');
  themeBtn.textContent = dark ? 'Светлая тема' : 'Тёмная тема';
};

logoutBtn.onclick = async () => {
  await api('/api/logout', 'POST');
  location.reload();
};

applyTheme();
init();
