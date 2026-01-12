/* =========================
   HÁBLAME — frontend/script.js (REWRITE ESTABLE)
   Objetivos:
   - Un solo arranque (sin duplicados)
   - Personajes cargan ANTES de render (con fallback local)
   - Chat por perfil (mode:id) persistente sin perder historial
   - sendToAI sólido (placeholder “…”, errores, sin variables sueltas)
   ========================= */

/* ========= CONFIG ========= */
const API_BASE = "https://hablame-backend.onrender.com";
const STORAGE = {
  LANG: "hablame_lang",
  CHATS: "hablame_chats",
};

/* ========= ESTADO ========= */
let currentMode = "characters"; // characters | assistants | tools | forums | friends
let currentProfileId = null;
let currentProfileName = "—";
let currentLang = "es";

let characters = [];
let charactersLoaded = false;
let charactersLoadingPromise = null;

// Chats: guardamos TODO por key = `${mode}:${id}`
let storedChats = {}; // lo que viene de localStorage
let chatsByKey = {};  // runtime (copia editable)

/* ========= TEXTOS UI ========= */
const UI_TEXT = {
  es: {
    tabCharacters: "🧠 Personajes",
    tabAssistants: "👥 Asistentes",
    tabTools: "🧘 Herramientas de calma",
    tabForums: "💬 Foro",
    tabFriends: "❤️ Amigos",

    sidebarCharacters: "Personajes",
    sidebarAssistants: "Asistentes",
    sidebarTools: "Herramientas de calma",
    sidebarForums: "Foro",
    sidebarFriends: "Amigos",

    chatTitle: "Chat con IA",
    placeholder: "Escribe un mensaje...",
    noProfileSelected: "Elige primero un personaje o asistente.",
    forumsConstruction: "Los foros están en construcción.",
    friendsConstruction: "La sección de amigos está en construcción.",
    toolsInfo: "Elige una herramienta de calma y escribe para que te guíe.",
    loading: "Cargando...",
    errorConexion: "Error de conexión. Intenta de nuevo.",
  },
  en: {
    tabCharacters: "🧠 Characters",
    tabAssistants: "👥 Assistants",
    tabTools: "🧘 Calm tools",
    tabForums: "💬 Forums",
    tabFriends: "❤️ Friends",

    sidebarCharacters: "Characters",
    sidebarAssistants: "Assistants",
    sidebarTools: "Calm tools",
    sidebarForums: "Forums",
    sidebarFriends: "Friends",

    chatTitle: "AI Chat",
    placeholder: "Type a message...",
    noProfileSelected: "Choose a character or assistant first.",
    forumsConstruction: "Forums are under construction.",
    friendsConstruction: "Friends section is under construction.",
    toolsInfo: "Choose a calm tool and type so it can guide you.",
    loading: "Loading...",
    errorConexion: "Connection error. Try again.",
  },
  pt: {
    tabCharacters: "🧠 Personagens",
    tabAssistants: "👥 Assistentes",
    tabTools: "🧘 Ferramentas de calma",
    tabForums: "💬 Fóruns",
    tabFriends: "❤️ Amigos",

    sidebarCharacters: "Personagens",
    sidebarAssistants: "Assistentes",
    sidebarTools: "Ferramentas de calma",
    sidebarForums: "Fóruns",
    sidebarFriends: "Amigos",

    chatTitle: "Chat com IA",
    placeholder: "Escreva uma mensagem...",
    noProfileSelected: "Escolha primeiro um personagem ou assistente.",
    forumsConstruction: "Os fóruns estão em construção.",
    friendsConstruction: "A seção de amigos está em construção.",
    toolsInfo: "Escolha uma ferramenta de calma e escreva para ela te guiar.",
    loading: "Carregando...",
    errorConexion: "Erro de conexão. Tente novamente.",
  },
};

/* ========= ASISTENTES ========= */
const ASSISTANTS_DATA = [
  { id: "chef_elena", name: "Chef Elena — Cocina y recetas", system: "Eres Chef Elena. Solo hablas de cocina." },
  { id: "mateo_fitness", name: "Mateo — Fitness", system: "Eres Mateo. Solo hablas de fitness con prudencia." },
  { id: "dinero_gastos", name: "Dinero — Solo gastos", system: "Solo ayudas a registrar gastos, no inversión." },
  { id: "viajes", name: "Viajes", system: "Ayudas a planear viajes." },
  { id: "acompanamiento", name: "Acompañamiento", system: "Acompañas emocionalmente sin juzgar." },
];

/* ========= HERRAMIENTAS ========= */
const TOOLS_DATA = [
  { id: "respiracion", name: "Respiración 1 minuto", description: "Respira 4-4-6 por 1 minuto." },
  { id: "anclaje", name: "Anclaje 5-4-3-2-1", description: "Ejercicio sensorial para calmar la mente." },
];

/* ========= DOM HELPERS ========= */
const $ = (id) => document.getElementById(id);
const t = () => UI_TEXT[currentLang] || UI_TEXT.es;

/* ================= INICIO ================= */
window.addEventListener("DOMContentLoaded", () => initApp());

async function initApp() {
  // 1) Carga preferencias
  loadLangFromStorage();
  loadChatsFromStorage();
  applyUILanguage();

  // 2) Setup UI
  setupButtons();
  setupSend();
  setupMobileView();
  setupLanguageSelector();

  // 3) Carga personajes ANTES de render (garantía)
  await ensureCharactersLoaded();

  // 4) Modo inicial
  switchMode("characters", { keepChat: true }); // no borra chat aquí
  selectDefaultProfile(); // si hay personajes, elige el primero

  // 5) Render final
  renderSidebar();
  renderChatForCurrentProfile();
}

/* ================= SETUP UI ================= */
function setupButtons() {
  const btnPersonajes = $("btnPersonajes");
  const btnAsistentes = $("btnAsistentes");
  const btnJuegos = $("btnJuegos");
  const btnForos = $("btnForos");
  const btnAmigos = $("btnAmigos");

  if (btnPersonajes) {
    btnPersonajes.addEventListener("click", async () => {
      await ensureCharactersLoaded();
      switchMode("characters");
      if (!currentProfileId) selectDefaultProfile();
      renderChatForCurrentProfile();
    });
  }

  if (btnAsistentes) {
    btnAsistentes.addEventListener("click", () => {
      switchMode("assistants");
      if (!currentProfileId) selectDefaultProfile();
      renderChatForCurrentProfile();
    });
  }

  if (btnJuegos) {
    btnJuegos.addEventListener("click", () => {
      switchMode("tools");
      renderChatForCurrentProfile();
    });
  }

  if (btnForos) {
    btnForos.addEventListener("click", () => {
      switchMode("forums");
      renderChatForCurrentProfile();
    });
  }

  if (btnAmigos) {
    btnAmigos.addEventListener("click", () => {
      switchMode("friends");
      renderChatForCurrentProfile();
    });
  }
}

function setupSend() {
  const sendBtn = $("sendButton");
  const input = $("userInput");

  if (!sendBtn || !input) return;

  const doSend = async () => {
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    await sendToAI(text);
  };

  sendBtn.addEventListener("click", doSend);

  input.addEventListener("keydown", async (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      await doSend();
    }
  });
}

function setupMobileView() {
  const appRoot = $("appRoot");
  const backBtn = $("backButton");
  if (!appRoot || !backBtn) return;
  backBtn.addEventListener("click", () => appRoot.classList.remove("mobile-chat"));
}

function setupLanguageSelector() {
  const select = $("languageSelect");
  if (!select) return;

  select.value = currentLang;
  select.addEventListener("change", async () => {
    currentLang = select.value;
    saveLangToStorage();
    applyUILanguage();

    // si estás en characters, asegúrate de tener data (por si cambiaste antes de cargar)
    if (currentMode === "characters") await ensureCharactersLoaded();

    renderSidebar();
    renderChatForCurrentProfile();
  });
}

/* ================= MODOS ================= */
function switchMode(mode, opts = {}) {
  const { keepChat = false } = opts;

  currentMode = mode;
  currentProfileId = null;
  currentProfileName = "—";
  const nameEl = $("currentProfileName");
  if (nameEl) nameEl.textContent = "—";

  // tabs active
  document.querySelectorAll(".top-tab").forEach((b) => b.classList.remove("active"));
  if (mode === "characters") $("btnPersonajes")?.classList.add("active");
  if (mode === "assistants") $("btnAsistentes")?.classList.add("active");
  if (mode === "tools") $("btnJuegos")?.classList.add("active");
  if (mode === "forums") $("btnForos")?.classList.add("active");
  if (mode === "friends") $("btnAmigos")?.classList.add("active");

  if (!keepChat) clearChat();
  renderSidebar();
}

/* ================= CARGA PERSONAJES ================= */
async function loadCharacters() {
  try {
    const res = await fetch(`${API_BASE}/api/characters`, { method: "GET" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    characters = Array.isArray(data?.characters) ? data.characters : [];
  } catch (err) {
    console.warn("No se pudo cargar /api/characters, usando lista local", err);
    characters = [
      { id: "marco", name: "Marco Aurelio", system: "Eres Marco Aurelio." },
      { id: "biblia", name: "Biblia", system: "Eres un guía basado en la Biblia." },
      { id: "seneca", name: "Séneca", system: "Eres Séneca." },
      { id: "sor_juana", name: "Sor Juana", system: "Eres Sor Juana Inés." },
    ];
  } finally {
    charactersLoaded = true;
  }
}

async function ensureCharactersLoaded() {
  if (charactersLoaded && characters.length) return;

  if (!charactersLoadingPromise) {
    charactersLoadingPromise = (async () => {
      await loadCharacters();
      charactersLoadingPromise = null;
    })();
  }
  await charactersLoadingPromise;
}

/* ================= RENDER SIDEBAR ================= */
function renderSidebar() {
  const titleEl = $("sidebarTitle");
  const listEl = $("profileList");
  if (!titleEl || !listEl) return;

  listEl.innerHTML = "";

  if (currentMode === "characters") {
    titleEl.textContent = t().sidebarCharacters;

    if (!charactersLoaded) {
      listEl.appendChild(makeMutedText(t().loading));
      return;
    }
    if (!characters.length) {
      listEl.appendChild(makeMutedText("Sin personajes disponibles."));
      return;
    }

    characters.forEach((ch) => {
      listEl.appendChild(makeChip(ch.name, ch.id === currentProfileId, () => selectProfile(ch.id, ch.name)));
    });
    return;
  }

  if (currentMode === "assistants") {
    titleEl.textContent = t().sidebarAssistants;
    ASSISTANTS_DATA.forEach((as) => {
      listEl.appendChild(makeChip(as.name, as.id === currentProfileId, () => selectProfile(as.id, as.name)));
    });
    return;
  }

  if (currentMode === "tools") {
    titleEl.textContent = t().sidebarTools;
    TOOLS_DATA.forEach((tool) => {
      listEl.appendChild(makeChip(tool.name, tool.id === currentProfileId, () => selectTool(tool)));
    });
    return;
  }

  if (currentMode === "forums") {
    titleEl.textContent = t().sidebarForums;
    listEl.appendChild(makeMutedText(t().forumsConstruction));
    return;
  }

  if (currentMode === "friends") {
    titleEl.textContent = t().sidebarFriends;
    listEl.appendChild(makeMutedText(t().friendsConstruction));
    return;
  }
}

function makeChip(label, active, onClick) {
  const btn = document.createElement("button");
  btn.className = "chip" + (active ? " chip--active" : "");
  btn.textContent = label;
  btn.addEventListener("click", onClick);
  return btn;
}

function makeMutedText(text) {
  const div = document.createElement("div");
  div.style.opacity = "0.7";
  div.textContent = text;
  return div;
}

/* ================= PERFIL ACTUAL ================= */
function selectDefaultProfile() {
  if (currentMode === "characters" && characters.length) {
    selectProfile(characters[0].id, characters[0].name);
    return;
  }
  if (currentMode === "assistants" && ASSISTANTS_DATA.length) {
    selectProfile(ASSISTANTS_DATA[0].id, ASSISTANTS_DATA[0].name);
    return;
  }
  if (currentMode === "tools" && TOOLS_DATA.length) {
    selectTool(TOOLS_DATA[0]);
  }
}

function selectProfile(id, name) {
  currentProfileId = id;
  currentProfileName = name;
  $("currentProfileName") && ($("currentProfileName").textContent = name);

  renderSidebar();
  renderChatForCurrentProfile();

  if (window.innerWidth <= 768) $("appRoot")?.classList.add("mobile-chat");
}

function selectTool(tool) {
  currentMode = "tools";
  currentProfileId = tool.id;
  currentProfileName = tool.name;
  $("currentProfileName") && ($("currentProfileName").textContent = tool.name);

  renderSidebar();
  clearChat();

  appendMessage(
    "HÁBLAME",
    `${tool.name}\n\n${tool.description}\n\n${t().toolsInfo}`,
    "received"
  );

  if (window.innerWidth <= 768) $("appRoot")?.classList.add("mobile-chat");
}

/* ================= CHAT / HISTORIAL ================= */
function getCurrentKey() {
  if (!currentProfileId) return null;
  return `${currentMode}:${currentProfileId}`;
}

function getCurrentChatArray() {
  const key = getCurrentKey();
  if (!key) return [];
  if (!chatsByKey[key]) {
    const fromStorage = Array.isArray(storedChats[key]) ? storedChats[key] : [];
    chatsByKey[key] = [...fromStorage];
  }
  return chatsByKey[key];
}

function saveChatsToStorage() {
  try {
    // merge para no perder chats que no se abrieron en esta sesión
    const merged = { ...storedChats, ...chatsByKey };
    localStorage.setItem(STORAGE.CHATS, JSON.stringify(merged));
    storedChats = merged;
  } catch {}
}

function loadChatsFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE.CHATS);
    storedChats = raw ? JSON.parse(raw) : {};
  } catch {
    storedChats = {};
  }
}

/* ================= UI IDIOMA ================= */
function loadLangFromStorage() {
  try {
    const stored = localStorage.getItem(STORAGE.LANG);
    if (stored) currentLang = stored;
  } catch {}
}

function saveLangToStorage() {
  try {
    localStorage.setItem(STORAGE.LANG, currentLang);
  } catch {}
}

function applyUILanguage() {
  const tx = t();

  $("btnPersonajes") && ($("btnPersonajes").textContent = tx.tabCharacters);
  $("btnAsistentes") && ($("btnAsistentes").textContent = tx.tabAssistants);
  $("btnJuegos") && ($("btnJuegos").textContent = tx.tabTools);
  $("btnForos") && ($("btnForos").textContent = tx.tabForums);
  $("btnAmigos") && ($("btnAmigos").textContent = tx.tabFriends);

  $("chatTitle") && ($("chatTitle").textContent = tx.chatTitle);
  $("userInput") && ($("userInput").placeholder = tx.placeholder);
}

/* ================= RENDER CHAT ================= */
function renderChatForCurrentProfile() {
  const tx = t();

  clearChat();

  if (!currentProfileId) {
    appendMessage("HÁBLAME", tx.noProfileSelected, "received");
    return;
  }

  const chat = getCurrentChatArray();
  chat.forEach((m) => appendMessage(m.sender, m.text, m.type, false));
  scrollToBottom();
}

function clearChat() {
  const list = $("messages");
  if (list) list.innerHTML = "";
}

function appendMessage(sender, text, type = "received", doScroll = true) {
  const list = $("messages");
  if (!list) return;

  const wrap = document.createElement("div");
  wrap.className = "msg " + (type === "sent" ? "msg--sent" : "msg--received");

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = String(text ?? "");

  wrap.appendChild(bubble);
  list.appendChild(wrap);

  if (doScroll) scrollToBottom();
}

function scrollToBottom() {
  const list = $("messages");
  if (!list) return;
  list.scrollTop = list.scrollHeight;
}

/* ================= IA ================= */
function buildSystemPrompt() {
  let base = "Eres un asistente útil y respetuoso.";

 if (currentMode === "characters") {
  const ch = characters.find((c) => c.id === currentProfileId);
  if (ch) {
    base =
      ch.system ||
      ch.basePrompt ||
      ch.prompt ||
      "Eres un acompañante emocional cálido y realista.";
  }
}else if (currentMode === "assistants") {
  const as = ASSISTANTS_DATA.find((a) => a.id === currentProfileId);
  if (as) {
    base =
      as.system ||
      as.basePrompt ||
      as.prompt ||
      "Eres un asistente útil y respetuoso.";
  }
} else if (currentMode === "tools") {
  base = "Eres una herramienta de calma. Guías al usuario con pasos cortos.";
}

  const lang = (currentLang || "es").toLowerCase();
  const force =
    lang === "es"
      ? "Responde SIEMPRE en español neutro."
      : lang === "pt"
      ? "Responda SEMPRE em português brasileiro, claro e natural."
      : "Always respond in natural, clear English.";

  const safety =
    "No des consejos médicos, legales ni financieros peligrosos. Si hay crisis o riesgo, recomienda ayuda profesional.";

  return `${base}\n\n${force}\n${safety}`.trim();
}

async function sendToAI(userText) {
  const tx = t();

  // Reglas: solo enviar si hay perfil válido
  if (!currentProfileId) {
    clearChat();
    appendMessage("HÁBLAME", tx.noProfileSelected, "received");
    return;
  }
  if (currentMode === "forums" || currentMode === "friends") {
    // No hay chat real ahí
    renderChatForCurrentProfile();
    return;
  }
  if (currentMode === "tools") {
    // Modo herramientas: responde local (sin backend) o puedes mandarlo al backend si quieres.
    // Aquí lo dejamos simple: guía local.
    const chat = getCurrentChatArray();
    chat.push({ sender: "Tú", text: userText, type: "sent" });
    chat.push({ sender: currentProfileName || "HÁBLAME", text: guideToolResponse(userText), type: "received" });
    saveChatsToStorage();
    renderChatForCurrentProfile();
    return;
  }

  const chat = getCurrentChatArray();

  // 1) Guardar mensaje usuario
  chat.push({ sender: "Tú", text: userText, type: "sent" });

  // 2) Placeholder
  const typingIndex = chat.length;
  chat.push({ sender: currentProfileName || "HÁBLAME", text: "…", type: "received" });

  saveChatsToStorage();
  renderChatForCurrentProfile();

  try {
    const system = buildSystemPrompt();

    const res = await fetch(`${API_BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
  message: userText,
  systemPrompt: system,
  language: currentLang,
  characterId: currentProfileId
}),

    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    const reply = (data && data.reply) ? String(data.reply) : "No recibí respuesta del servidor.";

    // 3) Reemplazar placeholder
    if (chat[typingIndex] && chat[typingIndex].text === "…") {
      chat[typingIndex].text = reply;
      chat[typingIndex].sender = currentProfileName || "HÁBLAME";
    } else {
      chat.push({ sender: currentProfileName || "HÁBLAME", text: reply, type: "received" });
    }

    saveChatsToStorage();
    renderChatForCurrentProfile();
  } catch (e) {
    const msg = tx.errorConexion;

    if (chat[typingIndex] && chat[typingIndex].text === "…") {
      chat[typingIndex].text = msg;
      chat[typingIndex].sender = "HÁBLAME";
    } else {
      chat.push({ sender: "HÁBLAME", text: msg, type: "received" });
    }

    saveChatsToStorage();
    renderChatForCurrentProfile();
  }
}

/* ================= HERRAMIENTAS (RESPUESTA LOCAL) ================= */
function guideToolResponse(userText) {
  const id = currentProfileId;

  if (id === "respiracion") {
    return [
      "Vamos con respiración 4-4-6 por 1 minuto:",
      "1) Inhala 4 segundos.",
      "2) Sostén 4 segundos.",
      "3) Exhala 6 segundos.",
      "Repite 6 veces. Si te mareas, baja el ritmo."
    ].join("\n");
  }

  if (id === "anclaje") {
    return [
      "Anclaje 5-4-3-2-1:",
      "Di (mentalmente o en voz baja):",
      "5 cosas que ves",
      "4 cosas que sientes (tacto)",
      "3 cosas que oyes",
      "2 cosas que hueles",
      "1 cosa que saboreas",
      "Cuando termines, dime cómo te sientes (0–10)."
    ].join("\n");
  }

  // genérico
  return `Ok. Vamos paso a paso.\nDime: ¿qué sientes ahora (0–10) y dónde lo sientes en el cuerpo?`;
}
