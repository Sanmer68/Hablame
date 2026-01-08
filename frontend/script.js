/* =========================
   HÁBLAME — frontend/script.js
   Objetivo:
   - Un solo arranque (sin duplicados)
   - Personajes SIEMPRE cargan antes de render
   - No más “picar y regresar”
   ========================= */

/* ========= CONFIG ========= */
const API_BASE = "https://hablame-backend.onrender.com";
let currentMode = "characters"; // characters | assistants | tools | forums | friends
let currentProfileId = null;
let currentProfileName = "—";
let currentLang = "es";

/* ========= DATA EN MEMORIA ========= */
let characters = [];
let dataLoaded = false;
let loadingPromise = null;

// Chats
const chatsByKey = {};   // runtime
let storedChats = {};    // copia de localStorage

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
  },
};

/* ========= ASISTENTES (ejemplo) ========= */
const ASSISTANTS_DATA = [
  { id: "chef_elena", name: "Chef Elena — Cocina y recetas", system: "Eres Chef Elena. Solo hablas de cocina." },
  { id: "mateo_fitness", name: "Mateo — Fitness", system: "Eres Mateo. Solo hablas de fitness con prudencia." },
  { id: "dinero_gastos", name: "Dinero — Solo gastos", system: "Solo ayudas a registrar gastos, no inversión." },
  { id: "viajes", name: "Viajes", system: "Ayudas a planear viajes." },
  { id: "acompanamiento", name: "Acompañamiento", system: "Acompañas emocionalmente sin juzgar." },
];

/* ========= HERRAMIENTAS (demo) ========= */
const TOOLS_DATA = [
  { id: "respiracion", name: "Respiración 1 minuto", description: "Respira 4-4-6 por 1 minuto." },
  { id: "anclaje", name: "Anclaje 5-4-3-2-1", description: "Ejercicio sensorial para calmar la mente." },
];

/* ================= INICIO ================= */
window.addEventListener("DOMContentLoaded", initApp);

async function initApp() {
  loadLangFromStorage();
  loadChatsFromStorage();
  applyUILanguage();

  setupButtons();
  setupSend();
  setupMobileView();
  setupLanguageSelector();

  // IMPORTANTE: aquí garantizamos carga
  await ensureCharactersLoaded();

  currentMode = "characters";
  renderSidebar();
  selectDefaultProfile(); // elige primer personaje
  renderChatForCurrentProfile();
}

/* ================= SETUP UI ================= */
function setupButtons() {
  const btnPersonajes = document.getElementById("btnPersonajes");
  const btnAsistentes = document.getElementById("btnAsistentes");
  const btnJuegos = document.getElementById("btnJuegos");
  const btnForos = document.getElementById("btnForos");
  const btnAmigos = document.getElementById("btnAmigos");

  // ✅ CLAVE: este click es async y espera carga
  btnPersonajes.addEventListener("click", async () => {
    await ensureCharactersLoaded();
    switchMode("characters");
    // si no hay perfil, elige uno automático
    if (!currentProfileId) selectDefaultProfile();
    renderChatForCurrentProfile();
  });

  btnAsistentes.addEventListener("click", () => {
    switchMode("assistants");
    renderChatForCurrentProfile();
  });

  // Nota: btnJuegos lo usamos como herramientas de calma
  btnJuegos.addEventListener("click", () => {
    switchMode("tools");
    renderChatForCurrentProfile();
  });

  btnForos.addEventListener("click", () => {
    switchMode("forums");
    renderChatForCurrentProfile();
  });

  btnAmigos.addEventListener("click", () => {
    switchMode("friends");
    renderChatForCurrentProfile();
  });
}

function setupSend() {
  const sendBtn = document.getElementById("sendButton");
  const input = document.getElementById("userInput");

  sendBtn.addEventListener("click", async () => {
    const text = input.value.trim();
    if (!text) return;
    await sendToAI(text);
    input.value = "";
  });

  input.addEventListener("keydown", async (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      await sendToAI(text);
      input.value = "";
    }
  });
}

function setupMobileView() {
  const appRoot = document.getElementById("appRoot");
  const backBtn = document.getElementById("backButton");
  if (!backBtn) return;
  backBtn.addEventListener("click", () => appRoot.classList.remove("mobile-chat"));
}

function setupLanguageSelector() {
  const select = document.getElementById("languageSelect");
  if (!select) return;

  select.value = currentLang;
  select.addEventListener("change", () => {
    currentLang = select.value;
    saveLangToStorage();
    applyUILanguage();
    renderSidebar();
    renderChatForCurrentProfile();
  });
}

/* ================= MODOS ================= */
function switchMode(mode) {
  currentMode = mode;
  currentProfileId = null;
  currentProfileName = "—";
  const nameEl = document.getElementById("currentProfileName");
  if (nameEl) nameEl.textContent = "—";

  // tabs active
  document.querySelectorAll(".top-tab").forEach((b) => b.classList.remove("active"));
  if (mode === "characters") document.getElementById("btnPersonajes")?.classList.add("active");
  if (mode === "assistants") document.getElementById("btnAsistentes")?.classList.add("active");
  if (mode === "tools") document.getElementById("btnJuegos")?.classList.add("active");
  if (mode === "forums") document.getElementById("btnForos")?.classList.add("active");
  if (mode === "friends") document.getElementById("btnAmigos")?.classList.add("active");

  clearChat();
  renderSidebar();
}

/* ================= CARGA PERSONAJES ================= */
async function loadCharacters() {
  try {
    const res = await fetch(`${API_BASE}/api/characters`);
    const data = await res.json();
    characters = data.characters || [];
  } catch (err) {
    console.warn("No se pudo cargar /api/characters, usando lista local");
    characters = [
      { id: "marco", name: "Marco Aurelio", system: "Eres Marco Aurelio." },
      { id: "biblia", name: "Biblia", system: "Eres un guía basado en la Biblia." },
      { id: "seneca", name: "Séneca", system: "Eres Séneca." },
      { id: "sor_juana", name: "Sor Juana", system: "Eres Sor Juana Inés." },
    ];
  } finally {
    dataLoaded = true;
  }
}

async function ensureCharactersLoaded() {
  if (dataLoaded && characters.length) return;

  if (!loadingPromise) {
    loadingPromise = (async () => {
      await loadCharacters();
      loadingPromise = null;
    })();
  }
  await loadingPromise;
}

/* ================= RENDER SIDEBAR ================= */
function renderSidebar() {
  const titleEl = document.getElementById("sidebarTitle");
  const listEl = document.getElementById("profileList");
  if (!titleEl || !listEl) return;

  listEl.innerHTML = "";
  const t = UI_TEXT[currentLang] || UI_TEXT.es;

  if (currentMode === "characters") {
    titleEl.textContent = t.sidebarCharacters;
    // ✅ si no están, mostramos “cargando” y salimos
    if (!dataLoaded || !characters.length) {
      const msg = document.createElement("div");
      msg.style.opacity = "0.7";
      msg.textContent = "Cargando...";
      listEl.appendChild(msg);
      return;
    }

    characters.forEach((ch) => {
      const btn = document.createElement("button");
      btn.className = "chip" + (ch.id === currentProfileId ? " chip--active" : "");
      btn.textContent = ch.name;
      btn.onclick = () => selectProfile(ch.id, ch.name);
      listEl.appendChild(btn);
    });
    return;
  }

  if (currentMode === "assistants") {
    titleEl.textContent = t.sidebarAssistants;
    ASSISTANTS_DATA.forEach((as) => {
      const btn = document.createElement("button");
      btn.className = "chip" + (as.id === currentProfileId ? " chip--active" : "");
      btn.textContent = as.name;
      btn.onclick = () => selectProfile(as.id, as.name);
      listEl.appendChild(btn);
    });
    return;
  }

  if (currentMode === "tools") {
    titleEl.textContent = t.sidebarTools;
    TOOLS_DATA.forEach((tool) => {
      const btn = document.createElement("button");
      btn.className = "chip" + (tool.id === currentProfileId ? " chip--active" : "");
      btn.textContent = tool.name;
      btn.onclick = () => selectTool(tool);
      listEl.appendChild(btn);
    });
    return;
  }

  if (currentMode === "forums") {
    titleEl.textContent = t.sidebarForums;
    const li = document.createElement("div");
    li.textContent = t.forumsConstruction;
    listEl.appendChild(li);
    return;
  }

  if (currentMode === "friends") {
    titleEl.textContent = t.sidebarFriends;
    const li = document.createElement("div");
    li.textContent = t.friendsConstruction;
    listEl.appendChild(li);
  }
}

/* ================= PERFIL ACTUAL ================= */
function selectDefaultProfile() {
  if (currentMode === "characters" && characters.length > 0) {
    selectProfile(characters[0].id, characters[0].name);
  }
  if (currentMode === "assistants" && ASSISTANTS_DATA.length > 0) {
    selectProfile(ASSISTANTS_DATA[0].id, ASSISTANTS_DATA[0].name);
  }
}

function selectProfile(id, name) {
  currentProfileId = id;
  currentProfileName = name;
  document.getElementById("currentProfileName").textContent = name;

  renderSidebar();
  renderChatForCurrentProfile();

  if (window.innerWidth <= 768) {
    document.getElementById("appRoot").classList.add("mobile-chat");
  }
}

function selectTool(tool) {
  currentMode = "tools";
  currentProfileId = tool.id;
  currentProfileName = tool.name;
  document.getElementById("currentProfileName").textContent = tool.name;

  renderSidebar();
  clearChat();

  appendMessage(
    "HÁBLAME",
    `${tool.name}\n\n${tool.description}\n\n${(UI_TEXT[currentLang] || UI_TEXT.es).toolsInfo}`,
    "received"
  );

  if (window.innerWidth <= 768) {
    document.getElementById("appRoot").classList.add("mobile-chat");
  }
}

/* ================= CHAT / HISTORIAL ================= */
function getCurrentKey() {
  if (!currentProfileId) return null;
  return `${currentMode}:${currentProfileId}`;
}

function getCurrentChatArray() {
  const key = getCurrentKey();
  if (!key) return [];
  if (!chatsByKey[key]) chatsByKey[key] = storedChats[key] ? [...storedChats[key]] : [];
  return chatsByKey[key];
}

function saveChatsToStorage() {
  try {
    localStorage.setItem("hablame_chats", JSON.stringify(chatsByKey));
  } catch {}
}

function loadChatsFromStorage() {
  try {
    const raw = localStorage.getItem("hablame_chats");
    storedChats = raw ? JSON.parse(raw) : {};
  } catch {
    storedChats = {};
  }
}

/* ================= UI IDIOMA ================= */
function loadLangFromStorage() {
  try {
    const stored = localStorage.getItem("hablame_lang");
    if (stored) currentLang = stored;
  } catch {}
}

function saveLangToStorage() {
  try {
    localStorage.setItem("hablame_lang", currentLang);
  } catch {}
}

function applyUILanguage() {
  const t = UI_TEXT[currentLang] || UI_TEXT.es;

  document.getElementById("btnPersonajes").textContent = t.tabCharacters;
  document.getElementById("btnAsistentes").textContent = t.tabAssistants;
  document.getElementById("btnJuegos").textContent = t.tabTools;
  document.getElementById("btnForos").textContent = t.tabForums;
  document.getElementById("btnAmigos").textContent = t.tabFriends;

  document.getElementById("chatTitle").textContent = t.chatTitle;
  document.getElementById("userInput").placeholder = t.placeholder;
}

/* ================= RENDER CHAT ================= */
function renderChatForCurrentProfile() {
  const t = UI_TEXT[currentLang] || UI_TEXT.es;

  if (!currentProfileId) {
    clearChat();
    appendMessage("HÁBLAME", t.noProfileSelected, "received");
    return;
  }

  clearChat();
  const chat = getCurrentChatArray();
  chat.forEach((m) => appendMessage(m.sender, m.text, m.type, false));
  scrollToBottom();
}

function clearChat() {
  const list = document.getElementById("messages");
  if (list) list.innerHTML = "";
}

function appendMessage(sender, text, type = "received", doScroll = true) {
  const list = document.getElementById("messages");
  if (!list) return;

  const wrap = document.createElement("div");
  wrap.className = "msg " + (type === "sent" ? "msg--sent" : "msg--received");

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;

  wrap.appendChild(bubble);
  list.appendChild(wrap);

  if (doScroll) scrollToBottom();
}

function scrollToBottom() {
  const list = document.getElementById("messages");
  if (!list) return;
  list.scrollTop = list.scrollHeight;
}

/* ================= IA ================= */
function buildSystemPrompt() {
  const key = getCurrentKey();
  let base = "Eres un asistente útil y respetuoso.";
  if (!key) return base;

  if (currentMode === "characters") {
    const ch = characters.find((c) => c.id === currentProfileId);
    if (ch?.system) base = ch.system;
  }
  if (currentMode === "assistants") {
    const as = ASSISTANTS_DATA.find((a) => a.id === currentProfileId);
    if (as?.system) base = as.system;
  }
  if (currentMode === "tools") {
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
  // guarda y pinta usuario
  const chat = getCurrentChatArray();
  chat.push({ sender: "Tú", text: userText, type: "sent" });
  appendMessage("Tú", userText, "sent");
  saveChatsToStorage();

  // placeholder “typing”
  appendMessage("HÁBLAME", "…", "received");

  try {
    const system = buildSystemPrompt();

    const res = await fetch(`${API_BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system,
        message: userText,
        lang: currentLang,
        mode: currentMode,
        profileId: currentProfileId,
      }),
    });

    const data = await res.json();
    const reply = data.reply || data.message || "No pude responder (error).";

    // reemplaza último “…” (simple: borramos y re-render)
    chat.push({ sender: currentProfileName || "HÁBLAME", text: reply, type: "received" });
    saveChatsToStorage();
    renderChatForCurrentProfile();
  } catch (e) {
    chat.push({ sender: "HÁBLAME", text: "Error de conexión. Intenta de nuevo.", type: "received" });
    saveChatsToStorage();
    renderChatForCurrentProfile();
  }
}
