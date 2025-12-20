// ================= CONFIG ==========================
const API_BASE = "https://hablame.onrender.com/api"

// ================= ESTADO ==========================
let currentMode = "characters"; // characters | assistants | tools | forums | friends
let currentProfileId = null;
let currentProfileName = "—";
let currentLang = "es";
let username = "Tú";

let characters = [];
const chatsByKey = {}; // memoria en runtime
let storedChats = {};  // copia de localStorage

// ================= DATA: ASISTENTES ===============
const ASSISTANTS_DATA = [
  {
    id: "chef_elena",
    name: "Chef Elena — Cocina y recetas",
    system:
      "Eres Chef Elena. Solo hablas de cocina. Puedes dar recetas, ingredientes, calorías, proteínas, colesterol, tips de preparación. Si te preguntan algo fuera de cocina responde: 'Mi especialidad es la comida, pregúntame algo para cocinar'.",
  },
  {
    id: "mateo_fitness",
    name: "Mateo en Movimiento — Ejercicio en casa",
    system:
      "Eres Mateo en Movimiento. Solo hablas de ejercicio, rutinas, bajar de peso y subir masa muscular. Siempre adviertes: 'Hazlo con moderación y consulta a tu médico para cambios fuertes'. Si preguntan algo fuera del fitness responde: 'Mi área es el ejercicio y el movimiento'.",
  },
  {
    id: "juan_escucha",
    name: "Juan Escucha — Apoyo emocional básico",
    system:
      "Eres Juan Escucha. Solo brindas apoyo emocional básico. No das diagnósticos, medicinas ni instrucciones peligrosas. Si detectas ideas de suicidio, daño o algo ilegal responde: 'Busca ayuda profesional de inmediato o marca al servicio de emergencias de tu país'.",
  },
  {
    id: "finanzas_luis",
    name: "Hablemos de Dinero — Ahorro y control de gastos",
    system:
      "Eres un asistente de finanzas personales. Ayudas a ahorrar, crear presupuestos, entender gastos y organizar deudas. No recomiendas inversiones específicas ni productos financieros concretos. Puedes mencionar sectores generales, pero siempre con lenguaje prudente.",
  },
  {
    id: "filias_viajes",
    name: "Viajando con Filias — Ideas para viajar",
    system:
      "Eres Filias. Asesoras sobre lugares para viajar, clima, actividades y costos aproximados. No recomiendas hoteles ni restaurantes específicos.",
  },
];

// ================= DATA: HERRAMIENTAS =============
const TOOLS_DATA = [
  {
    id: "breathing_478",
    name: "Respiración 4–7–8",
    description: "Ejercicio rápido para bajar ansiedad.",
  },
  {
    id: "grounding_5",
    name: "5 sentidos (grounding)",
    description: "Para regresar al presente cuando la mente se acelera.",
  },
  {
    id: "mini_meditation",
    name: "Mini meditación 2 minutos",
    description: "Pausa corta para bajar revoluciones.",
  },
];

// Prompts IA para herramientas (identidad propia)
const TOOLS_AI_PROMPTS = {
  breathing_478:
    "Eres una herramienta de calma. Guías respiración 4-7-8 paso a paso. Frases cortas, tono tranquilo. Pides confirmación con 'listo' para avanzar. Nada de filosofía.",
  grounding_5:
    "Eres una herramienta de calma. Guías grounding de 5 sentidos paso a paso. Tono calmado, frases cortas. Vas uno por uno (5 cosas que ves, 4 que tocas, etc.).",
  mini_meditation:
    "Eres una herramienta de calma. Guías una mini meditación de 2 minutos. Tono suave, instrucciones simples. Indicas pausas y respiración. Sin filosofía.",
};

// ================= TEXTOS UI =======================
const UI_TEXT = {
  es: {
    tabCharacters: "🧠 Personajes",
    tabAssistants: "👥 Asistentes",
    tabTools: "🧘 Herramientas de calma",
    tabForums: "💬 Foros",
    tabFriends: "❤️ Amigos",

    sidebarCharacters: "Personajes",
    sidebarAssistants: "Asistentes",
    sidebarTools: "Herramientas de calma",
    sidebarForums: "Foros",
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

// ================= INICIO ==========================
window.addEventListener("DOMContentLoaded", initApp);

async function initApp() {
  loadLangFromStorage();
  loadChatsFromStorage();
  applyUILanguage();

  setupButtons();
  setupSend();
  setupMobileView();
  setupLanguageSelector();

  await loadCharacters();
  currentMode = "characters";
  renderSidebar();
  selectDefaultProfile();
  renderChatForCurrentProfile();
}

// ================= SETUP UI ========================
function setupButtons() {
  document.getElementById("btnPersonajes").addEventListener("click", () => switchMode("characters"));
  document.getElementById("btnAsistentes").addEventListener("click", () => switchMode("assistants"));
  document.getElementById("btnJuegos").addEventListener("click", () => switchMode("tools")); // 👈 ahora es herramientas
  document.getElementById("btnForos").addEventListener("click", () => switchMode("forums"));
  document.getElementById("btnAmigos").addEventListener("click", () => switchMode("friends"));
}

function setupSend() {
  const sendBtn = document.getElementById("sendButton");
  const input = document.getElementById("userInput");

  sendBtn.addEventListener("click", () => {
    const text = input.value.trim();
    if (!text) return;
    sendToAI(text);
    input.value = "";
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      sendToAI(text);
      input.value = "";
    }
  });
}

function setupMobileView() {
  const appRoot = document.getElementById("appRoot");
  const backBtn = document.getElementById("backButton");
  backBtn.addEventListener("click", () => appRoot.classList.remove("mobile-chat"));
}

function setupLanguageSelector() {
  const select = document.getElementById("languageSelect");
  select.value = currentLang;
  select.addEventListener("change", () => {
    currentLang = select.value;
    saveLangToStorage();
    applyUILanguage();
    // mantiene el chat actual, solo cambia UI y el idioma de respuesta a partir de ahora
    renderChatForCurrentProfile();
  });
}

// ================= MODOS ===========================
function switchMode(mode) {
  currentMode = mode;
  currentProfileId = null;
  currentProfileName = "—";
  document.getElementById("currentProfileName").textContent = "—";

  // tabs active
  document.querySelectorAll(".top-tab").forEach((b) => b.classList.remove("active"));
  if (mode === "characters") document.getElementById("btnPersonajes").classList.add("active");
  if (mode === "assistants") document.getElementById("btnAsistentes").classList.add("active");
  if (mode === "tools") document.getElementById("btnJuegos").classList.add("active");
  if (mode === "forums") document.getElementById("btnForos").classList.add("active");
  if (mode === "friends") document.getElementById("btnAmigos").classList.add("active");

  clearChat();
  renderSidebar();
  renderChatForCurrentProfile();
}

// ================= CARGA PERSONAJES ================
async function loadCharacters() {
  try {
    const res = await fetch(`${API_BASE}/api/characters`);
    const data = await res.json();
    characters = data.characters || [];
  } catch (err) {
    console.warn("No se pudo cargar /api/characters, usando lista local");
    characters = [
      { id: "marco", name: "Marco Aurelio", system: "Eres Marco Aurelio..." },
      { id: "biblia", name: "Biblia", system: "Eres un guía basado en textos bíblicos..." },
      { id: "seneca", name: "Séneca", system: "Eres Séneca..." },
      { id: "sor_juana", name: "Sor Juana", system: "Eres Sor Juana Inés de la Cruz..." },
    ];
  }
}

// ================= RENDER SIDEBAR ==================
function renderSidebar() {
  const titleEl = document.getElementById("sidebarTitle");
  const listEl = document.getElementById("profileList");
  if (!titleEl || !listEl) return;

  listEl.innerHTML = "";

  const t = UI_TEXT[currentLang];

  if (currentMode === "characters") {
    titleEl.textContent = t.sidebarCharacters;
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
    li.textContent = "Foro general (demo)";
    listEl.appendChild(li);
    return;
  }

  if (currentMode === "friends") {
    titleEl.textContent = t.sidebarFriends;
    const li = document.createElement("div");
    li.textContent = "Mi lista de amigos (próximamente)";
    listEl.appendChild(li);
  }
}

// ================= PERFIL ACTUAL ===================
function selectDefaultProfile() {
  if (currentMode === "characters" && characters.length > 0) {
    selectProfile(characters[0].id, characters[0].name);
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
  currentMode = "tools"; // clave: herramientas no son personajes
  currentProfileId = tool.id;
  currentProfileName = tool.name;
  document.getElementById("currentProfileName").textContent = tool.name;

  renderSidebar();
  clearChat();
  appendMessage(
    "HÁBLAME",
    `${tool.name}\n\n${tool.description}\n\n${UI_TEXT[currentLang].toolsInfo}`,
    "received"
  );

  if (window.innerWidth <= 768) {
    document.getElementById("appRoot").classList.add("mobile-chat");
  }
}

// ================= CHAT / HISTORIAL =================
function getCurrentKey() {
  if (!currentProfileId) return null;
  // Nota: NO incluimos idioma para no “romper” historial al cambiar idioma.
  return `${currentMode}:${currentProfileId}`;
}

function getCurrentChatArray() {
  const key = getCurrentKey();
  if (!key) return [];
  if (!chatsByKey[key]) {
    chatsByKey[key] = storedChats[key] ? [...storedChats[key]] : [];
  }
  return chatsByKey[key];
}

function saveChatsToStorage() {
  const all = { ...storedChats, ...chatsByKey };
  localStorage.setItem("hablame_chats_v1", JSON.stringify(all));
}

function loadChatsFromStorage() {
  try {
    storedChats = JSON.parse(localStorage.getItem("hablame_chats_v1")) || {};
  } catch {
    storedChats = {};
  }
}

function pushMessageToHistory(sender, text) {
  const key = getCurrentKey();
  if (!key) return;
  const arr = getCurrentChatArray();
  arr.push({ sender, text });
  chatsByKey[key] = arr;
  saveChatsToStorage();
}

function renderChatForCurrentProfile() {
  clearChat();
  const msgs = getCurrentChatArray();
  msgs.forEach((m) => {
    appendMessage(m.sender, m.text, m.sender === username ? "sent" : "received");
  });

  if (!currentProfileId) {
    if (currentMode === "forums") {
      appendMessage("Sistema", UI_TEXT[currentLang].forumsConstruction, "received");
    } else if (currentMode === "friends") {
      appendMessage("Sistema", UI_TEXT[currentLang].friendsConstruction, "received");
    } else if (currentMode === "tools") {
      appendMessage("HÁBLAME", UI_TEXT[currentLang].toolsInfo, "received");
    }
  }
}

// ================= MENSAJES UI ======================
function clearChat() {
  const chatWindow = document.getElementById("chatWindow");
  if (chatWindow) chatWindow.innerHTML = "";
}

function appendMessage(sender, text, type) {
  const chatWindow = document.getElementById("chatWindow");
  if (!chatWindow) return;

  const wrapper = document.createElement("div");
  wrapper.className = "message " + (type === "sent" ? "message--sent" : "message--received");
  wrapper.textContent = text;
  chatWindow.appendChild(wrapper);

  chatWindow.scrollTop = chatWindow.scrollHeight;
}

// ================= ENVÍO A IA =======================
async function sendToAI(text) {
  // Foros / Amigos por ahora (demo)
  if (currentMode === "forums" || currentMode === "friends") {
    appendMessage(username, text, "sent");
    pushMessageToHistory(username, text);

    const auto = currentMode === "forums" ? "Foro (demo)" : "Amigos (demo)";
    const msg = "Esta sección está en construcción.";
    appendMessage(auto, msg, "received");
    pushMessageToHistory(auto, msg);
    return;
  }

  // En tools se permite sin “perfil seleccionado” (la herramienta es el perfil)
  if (!currentProfileId && (currentMode === "characters" || currentMode === "assistants")) {
    appendMessage("Sistema", UI_TEXT[currentLang].noProfileSelected, "received");
    return;
  }

  appendMessage(username, text, "sent");
  pushMessageToHistory(username, text);

  try {
    const systemInstruction = getSystemInstruction();

    const body = {
      message: text,
      characterId: currentProfileId,
      mode: currentMode,          // characters | assistants | tools
      language: currentLang,      // es | en | pt
      systemPrompt: systemInstruction, // 👈 esto arregla “Marco en todo”
    };

    const res = await fetch(`${API_BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    const reply = data.reply || "Lo siento, no pude generar una respuesta ahora.";
    appendMessage("HÁBLAME", reply, "received");
    pushMessageToHistory("HÁBLAME", reply);
  } catch (err) {
    console.error(err);
    appendMessage("Sistema", "Error conectando con el servidor.", "received");
    pushMessageToHistory("Sistema", "Error conectando con el servidor.");
  }
}

// ================= SYSTEM SEGÚN PERFIL ==============
function getSystemInstruction() {
  let base = "";

  if (currentMode === "assistants") {
    const a = ASSISTANTS_DATA.find((x) => x.id === currentProfileId);
    base = a?.system || "";
  } else if (currentMode === "characters") {
    const ch = (characters || []).find((x) => x.id === currentProfileId);
    // soporta system o basePrompt o prompt
    base = ch?.system || ch?.basePrompt || ch?.prompt || "";
  } else if (currentMode === "tools") {
    base = TOOLS_AI_PROMPTS[currentProfileId] || "Eres una herramienta de calma.";
  }

  // fuerza idioma SIEMPRE
  const lang = (currentLang || "es").toLowerCase();
  const force =
    lang === "es"
      ? "Responde SIEMPRE en español neutro."
      : lang === "pt"
      ? "Responda SEMPRE em português brasileiro, claro e natural."
      : "Always respond in natural, clear English.";

  // seguridad siempre
  const safety =
    "No des consejos médicos, legales ni financieros peligrosos. Si hay crisis o riesgo, recomienda ayuda profesional.";

  return `${base}\n\n${force}\n${safety}`.trim();
}

// ================= IDIOMA ALMACENADO ===============
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
  const t = UI_TEXT[currentLang];

  // botones tabs
  document.getElementById("btnPersonajes").textContent = t.tabCharacters;
  document.getElementById("btnAsistentes").textContent = t.tabAssistants;
  document.getElementById("btnJuegos").textContent = t.tabTools;
  document.getElementById("btnForos").textContent = t.tabForums;
  document.getElementById("btnAmigos").textContent = t.tabFriends;

  // títulos
  document.getElementById("chatTitle").textContent = t.chatTitle;
  document.getElementById("userInput").placeholder = t.placeholder;

  renderSidebar();
}
