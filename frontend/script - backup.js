let characters = [];
let currentCharacterId = null;
let features = {};
let forums = [];
let currentForumId = null;
let myLanguage = 'es';
let currentMode = 'chat'; // 'chat' o 'forum'
let username = 'Tú'; // en el futuro: usuario real

const API_BASE = 'http://localhost:3000';

async function initApp() {
  await loadFeatures();
  await loadLanguages();
  await loadCharacters();
  await loadForums();

  setupTabs();
  setupSend();
}

async function loadCharacters() {
  const res = await fetch(`${API_BASE}/api/characters`);
  const data = await res.json();
  characters = data.characters || [];
  if (characters.length > 0) currentCharacterId = characters[0].id;
  renderCharacterSelector();
}

async function loadFeatures() {
  const res = await fetch(`${API_BASE}/api/features`);
  const data = await res.json();
  features = data.features || {};
  const forumsSection = document.getElementById('forumsSection');
  forumsSection.style.display = features.circles ? 'block' : 'none';
}

async function loadLanguages() {
  const res = await fetch(`${API_BASE}/api/languages`);
  const data = await res.json();
  const select = document.getElementById('languageSelect');
  const def = data.languages?.default || 'es';
  const supported = data.languages?.supported || ['es'];

  myLanguage = def;

  supported.forEach(code => {
    const opt = document.createElement('option');
    opt.value = code;
    opt.textContent = code.toUpperCase();
    select.appendChild(opt);
  });

  select.value = myLanguage;
  select.addEventListener('change', () => {
    myLanguage = select.value;
  });
}

async function loadForums() {
  const res = await fetch(`${API_BASE}/api/forums`);
  const data = await res.json();
  forums = data.forums || [];
  if (forums.length > 0) currentForumId = forums[0].id;
  renderForums();
  if (currentForumId) {
    await loadForumMessages(currentForumId);
  }
}

function renderCharacterSelector() {
  const container = document.getElementById('characterSelector');
  const currentName = document.getElementById('currentCharacterName');
  container.innerHTML = '';

  characters.forEach(char => {
    const btn = document.createElement('button');
    btn.className =
      'chip ' + (char.id === currentCharacterId ? 'chip--active' : '');
    btn.textContent = char.name;
    btn.onclick = () => {
      currentCharacterId = char.id;
      renderCharacterSelector();
      currentName.textContent = char.name;
    };
    container.appendChild(btn);
  });

  if (characters.length > 0) {
    currentName.textContent =
      characters.find(c => c.id === currentCharacterId)?.name || '';
  }
}

function renderForums() {
  const ul = document.getElementById('forumsList');
  ul.innerHTML = '';
  forums.forEach(f => {
    const li = document.createElement('li');
    li.textContent = f.name;
    if (f.id === currentForumId) li.classList.add('active');
    li.onclick = async () => {
      currentForumId = f.id;
      renderForums();
      await loadForumMessages(f.id);
      setMode('forum');
    };
    ul.appendChild(li);
  });
}

function setupTabs() {
  const tabChat = document.getElementById('tabChat');
  const tabForum = document.getElementById('tabForum');

  tabChat.onclick = () => setMode('chat');
  tabForum.onclick = () => setMode('forum');
}

function setMode(mode) {
  currentMode = mode;
  const tabChat = document.getElementById('tabChat');
  const tabForum = document.getElementById('tabForum');
  const title = document.getElementById('chatTitle');
  const chatWindow = document.getElementById('chatWindow');

  chatWindow.innerHTML = '';

  if (mode === 'chat') {
    tabChat.classList.add('tab--active');
    tabForum.classList.remove('tab--active');
    title.textContent = 'Chat con IA';
  } else {
    tabForum.classList.add('tab--active');
    tabChat.classList.remove('tab--active');
    title.textContent = 'Foro';
    if (currentForumId) {
      loadForumMessages(currentForumId);
    }
  }
}

function setupSend() {
  const btn = document.getElementById('sendButton');
  const input = document.getElementById('userInput');

  btn.onclick = sendCurrent;
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') sendCurrent();
  });
}

async function sendCurrent() {
  const input = document.getElementById('userInput');
  const text = input.value.trim();
  if (!text) return;

  if (currentMode === 'chat') {
    await sendToAI(text);
  } else {
    await sendToForum(text);
  }

  input.value = '';
}

async function sendToAI(text) {
  appendMessage(username, text, 'sent');

  const res = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: text,
      characterId: currentCharacterId
    })
  });

  const data = await res.json();
  if (data.reply) {
    appendMessage('HÁBLAME', data.reply, 'received');
  } else if (data.error) {
    appendMessage('Sistema', data.error, 'received');
  }
}

async function sendToForum(text) {
  if (!currentForumId) return;

  const res = await fetch(
    `${API_BASE}/api/forums/${currentForumId}/messages`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: 'user1',
        username,
        language: myLanguage,
        text
      })
    }
  );

  const data = await res.json();
  if (data.error) {
    appendMessage('Sistema', data.error, 'received');
    return;
  }

  // mostramos mi propio mensaje
  appendMessage(username, text, 'sent');
}

async function loadForumMessages(forumId) {
  const res = await fetch(`${API_BASE}/api/forums/${forumId}/messages`);
  const data = await res.json();
  const msgs = data.messages || [];

  const chatWindow = document.getElementById('chatWindow');
  chatWindow.innerHTML = '';

  for (const msg of msgs) {
    const label = msg.username || 'Usuario';
    const direction = msg.username === username ? 'sent' : 'received';
    // por ahora mostramos el original
    appendMessage(label, msg.text_original, direction);
  }
}

function appendMessage(from, text, type) {
  const chatWindow = document.getElementById('chatWindow');
  const wrapper = document.createElement('div');
  wrapper.className =
    'message ' + (type === 'sent' ? 'message--sent' : 'message--received');
  wrapper.innerHTML = `
    <div>${text}</div>
    <div class="message-meta">${from}</div>
  `;
  chatWindow.appendChild(wrapper);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

window.addEventListener('DOMContentLoaded', initApp);
// ================= CHAT CON IA: conexión con backend =================

document.addEventListener('DOMContentLoaded', () => {
  const API_BASE = 'http://localhost:3000';

  // Personaje por defecto (luego lo conectamos al selector real)
  let selectedCharacterId = 'marco';

  // Tu estructura actual:
  const chatWindow = document.getElementById('chatWindow'); // donde van los mensajes
  const userInput = document.getElementById('userInput');   // input de texto
  const sendButton = document.getElementById('sendButton'); // botón enviar

  console.log('chatWindow:', chatWindow);
  console.log('userInput:', userInput);
  console.log('sendButton:', sendButton);

  // Si por algún motivo no encuentra los elementos, salimos
  if (!chatWindow || !userInput || !sendButton) {
    console.warn('No se encontraron elementos del chat en el DOM');
    return;
  }

  // Crear burbujas
  function addBubble(text, who = 'user') {
    const div = document.createElement('div');
    div.classList.add('msg', who === 'user' ? 'msg-user' : 'msg-bot');
    div.textContent = text;
    chatWindow.appendChild(div);
    chatWindow.scrollTop = chatWindow.scrollHeight;
  }

  // Acción del botón
  sendButton.addEventListener('click', async () => {
    const text = userInput.value.trim();
    if (!text) return;

    // burbuja usuario
    addBubble(text, 'user');
    userInput.value = '';

    try {
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          characterId: selectedCharacterId
        })
      });

      const data = await response.json();

      // burbuja bot
      addBubble(data.reply || '(Sin respuesta del servidor)', 'bot');
    } catch (err) {
      console.error(err);
      addBubble('Error conectando con el servidor.', 'bot');
    }
  });
});

