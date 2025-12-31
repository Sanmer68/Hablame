/* =========================================================
   HÁBLAME — Frontend script (clean MVP)
   - Loads characters/assistants once (with fallback)
   - Switch tabs without "double click" bug
   - Chat history per profile (localStorage)
   - Language ES/EN/PT
   ========================================================= */

(() => {
  // -----------------------------
  // CONFIG
  // -----------------------------
  const API_BASE = ""; // "" = same domain. If needed: "https://tu-backend.com"
  const LS_KEY = "hablame_chats_v1";
  const LS_LANG = "hablame_lang_v1";
  const USERNAME = "Tú";

  // -----------------------------
  // STATE
  // -----------------------------
  const state = {
    mode: "characters", // characters | assistants | tools | forums | friends
    lang: localStorage.getItem(LS_LANG) || "es",
    characters: [],
    assistants: [],
    loaded: {
      characters: false,
      assistants: false,
    },
    currentProfile: null, // { type, id, name, system }
    chats: loadAllChats(),
    isSending: false,
  };

  // -----------------------------
  // DOM (IDs must match your HTML)
  // -----------------------------
  const dom = {
    // top tabs
    btnPersonajes: document.getElementById("btnPersonajes"),
    btnAsistentes: document.getElementById("btnAsistentes"),
    btnJuegos: document.getElementById("btnJuegos"),
    btnForos: document.getElementById("btnForos"),
    btnAmigos: document.getElementById("btnAmigos"),

    // language selector (if exists)
    langSelect: document.getElementById("langSelect") || document.getElementById("languageSelect"),

    // left list + title area
    listTitle: document.getElementById("listTitle"),
    listContainer: document.getElementById("profilesList") || document.getElementById("sidebarList"),

    // chat area
    screenTitle: document.getElementById("screenTitle"),
    screenSubtitle: document.getElementById("screenSubtitle"),
    messages: document.getElementById("messages") || document.getElementById("chatMessages"),
    input: document.getElementById("userInput"),
    sendBtn: document.getElementById("sendButton"),

    // optional back button on mobile
    backBtn: document.getElementById("btnBack") || document.getElementById("backButton"),
  };

  // If your HTML uses different IDs, tell me and I te lo ajusto exacto.
  // For now, script tries common IDs.

  // -----------------------------
  // FALLBACK DATA (if API fails)
  // -----------------------------
  const FALLBACK_CHARACTERS = [
    { id: "marco", name: "Marco Aurelio", system: "Eres Marco Aurelio. Responde con calma, claridad y reflexión práctica." },
    { id: "biblia", name: "Biblia", system: "Eres un guía basado en enseñanzas bíblicas. Responde con compasión y prudencia." },
    { id: "seneca", name: "Séneca", system: "Eres Séneca. Responde estoicamente, directo y con enfoque en virtud." },
    { id: "sor_juana", name: "Sor Juana", system: "Eres Sor Juana Inés. Responde con inteligencia, firmeza y sensibilidad." },
  ];

  const FALLBACK_ASSISTANTS = [
    { id: "chef_elena", name: "Chef Elena – Cocina", system: "Solo hablas de cocina, recetas y nutrición básica. Si preguntan otra cosa, redirige a cocina." },
    { id: "dinero_gastos", name: "Dinero – Solo gastos", system: "Solo ayudas a registrar gastos, categorías y resúmenes. No das consejos de inversión." },
    { id: "viajes", name: "Viajes", system: "Ayudas a planear viajes (itinerarios, presupuesto y tips)."},
    { id: "acompanamiento", name: "Acompañamiento", system: "Acompañas emocionalmente sin juzgar, con preguntas claras y calma." },
    { id: "fitness", name: "Mateo en movimiento – Fitness", system: "Solo das rutinas y consejos de ejercicio seguro. Recomiendas consultar médico si hay dolor/condición." },
  ];

  // -----------------------------
  // INIT
  // -----------------------------
  document.addEventListener("DOMContentLoaded", init);

  function init() {
    // language
    syncLangUI();

    // buttons
    setupButtons();

    // send
    setupSend();

    // initial load + render
    boot().catch(console.error);
  }

  async function boot() {
    await ensureCharactersLoaded();
    // if there's a last profile saved, you could restore here. For now keep simple.
    if (!state.currentProfile) {
      state.currentProfile = { type: "character", ...state.characters[0] };
    }
    renderAll();
  }

  // -----------------------------
  // BUTTONS / NAV
  // -----------------------------
  function setupButtons() {
    if (dom.btnPersonajes) {
      dom.btnPersonajes.addEventListener("click", async () => {
        await ensureCharactersLoaded();
        setMode("characters");
      });
    }

    if (dom.btnAsistentes) {
      dom.btnAsistentes.addEventListener("click", async () => {
        await ensureAssistantsLoaded();
        setMode("assistants");
      });
    }

    if (dom.btnJuegos) dom.btnJuegos.addEventListener("click", () => setMode("tools"));
    if (dom.btnForos) dom.btnForos.addEventListener("click", () => setMode("forums"));
    if (dom.btnAmigos) dom.btnAmigos.addEventListener("click", () => setMode("friends"));

    if (dom.langSelect) {
      dom.langSelect.value = state.lang;
      dom.langSelect.addEventListener("change", () => {
        const v = dom.langSelect.value;
        if (!["es", "en", "pt"].includes(v)) return;
        state.lang = v;
        localStorage.setItem(LS_LANG, v);
        renderHeader();
        renderMessages();
      });
    }

    if (dom.backBtn) {
      dom.backBtn.addEventListener("click", () => {
        // optional: go back to list on mobile (depends on your CSS)
        document.body.classList.remove("chat-open");
      });
    }
  }

  function setMode(mode) {
    state.mode = mode;
    highlightTopTabs();
    renderList();
    renderHeader();
    renderMessages();
  }

  function highlightTopTabs() {
    const map = {
      characters: dom.btnPersonajes,
      assistants: dom.btnAsistentes,
      tools: dom.btnJuegos,
      forums: dom.btnForos,
      friends: dom.btnAmigos,
    };
    Object.values(map).forEach((btn) => btn && btn.classList.remove("active"));
    const b = map[state.mode];
    if (b) b.classList.add("active");
  }

  // -----------------------------
  // LOADERS
  // -----------------------------
  async function ensureCharactersLoaded() {
    if (state.loaded.characters) return;
    state.characters = await fetchList("/api/characters", "characters", FALLBACK_CHARACTERS);
    state.loaded.characters = true;
  }

  async function ensureAssistantsLoaded() {
    if (state.loaded.assistants) return;
    state.assistants = await fetchList("/api/assistants", "assistants", FALLBACK_ASSISTANTS);
    state.loaded.assistants = true;
  }

  async function fetchList(path, key, fallback) {
    try {
      const res = await fetch(`${API_BASE}${path}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      // expects {characters:[...]} or {assistants:[...]} or direct array
      const list = Array.isArray(data) ? data : (data[key] || []);
      if (!Array.isArray(list) || list.length === 0) return fallback;
      return list.map(normalizeProfile);
    } catch (e) {
      console.warn(`No se pudo cargar ${path}, usando fallback`, e);
      return fallback.map(normalizeProfile);
    }
  }

  function normalizeProfile(p) {
    return {
      id: String(p.id || "").trim(),
      name: String(p.name || "").trim(),
      system: String(p.system || "").trim(),
    };
  }

  // -----------------------------
  // RENDER
  // -----------------------------
  function renderAll() {
    highlightTopTabs();
    renderList();
    renderHeader();
    renderMessages();
    syncLangUI();
  }

  function renderHeader() {
    const p = state.currentProfile;
    if (!dom.screenTitle) return;

    dom.screenTitle.textContent = "Chat con IA";

    if (dom.screenSubtitle) {
      if (!p) {
        dom.screenSubtitle.textContent = "";
      } else {
        const label = p.type === "assistant" ? "Asistente" : "Personaje";
        dom.screenSubtitle.textContent = `${label}: ${p.name}`;
      }
    }
  }

  function renderList() {
    // Update list title
    if (dom.listTitle) {
      if (state.mode === "characters") dom.listTitle.textContent = "Personajes";
      else if (state.mode === "assistants") dom.listTitle.textContent = "Asistentes";
      else if (state.mode === "tools") dom.listTitle.textContent = "Herramientas de calma";
      else if (state.mode === "forums") dom.listTitle.textContent = "Foros";
      else if (state.mode === "friends") dom.listTitle.textContent = "Amigos";
    }

    if (!dom.listContainer) return;

    // Clear
    dom.listContainer.innerHTML = "";

    if (state.mode === "characters") {
      buildList(state.characters, "character");
      return;
    }

    if (state.mode === "assistants") {
      buildList(state.assistants, "assistant");
      return;
    }

    // Other tabs (placeholder)
    const li = document.createElement("div");
    li.className = "list-item placeholder";
    li.textContent = "En construcción 🙂";
    dom.listContainer.appendChild(li);
  }

  function buildList(items, type) {
    if (!items || items.length === 0) return;

    items.forEach((item) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "list-item";

      const active = state.currentProfile && state.currentProfile.id === item.id && state.currentProfile.type === type;
      if (active) btn.classList.add("active");

      btn.textContent = item.name;

      btn.addEventListener("click", () => {
        state.currentProfile = { type, ...item };
        renderHeader();
        renderMessages();

        // optional: on mobile show chat
        document.body.classList.add("chat-open");
      });

      dom.listContainer.appendChild(btn);
    });
  }

  function renderMessages() {
    if (!dom.messages) return;

    dom.messages.innerHTML = "";

    const p = state.currentProfile;
    if (!p) return;

    const chatKey = getChatKey(p);
    const msgs = state.chats[chatKey] || [];

    msgs.forEach((m) => {
      dom.messages.appendChild(renderBubble(m.role, m.text));
    });

    scrollToBottom();
  }

  function renderBubble(role, text) {
    const wrap = document.createElement("div");
    wrap.className = `msg ${role === "user" ? "user" : "assistant"}`;

    const bubble = document.createElement("div");
    bubble.className = "bubble";
    bubble.textContent = text;

    wrap.appendChild(bubble);
    return wrap;
  }

  function scrollToBottom() {
    if (!dom.messages) return;
    // delay to ensure layout
    setTimeout(() => {
      dom.messages.scrollTop = dom.messages.scrollHeight;
    }, 0);
  }

  function syncLangUI() {
    if (dom.langSelect) {
      dom.langSelect.value = state.lang;
    }
  }

  // -----------------------------
  // SEND MESSAGE
  // -----------------------------
  function setupSend() {
    if (!dom.sendBtn || !dom.input) return;

    dom.sendBtn.addEventListener("click", () => handleSend());

    dom.input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });
  }

  async function handleSend() {
    if (state.isSending) return;
    const p = state.currentProfile;
    if (!p) return;

    const text = (dom.input?.value || "").trim();
    if (!text) return;

    // UI: append user message
    pushMessage(p, "user", text);
    dom.input.value = "";
    renderMessages();

    state.isSending = true;
    setSendDisabled(true);

    try {
      const reply = await askAI({
        profile: p,
        userText: text,
        lang: state.lang,
        history: getHistoryForRequest(p, 12),
      });

      pushMessage(p, "assistant", reply);
      renderMessages();
    } catch (err) {
      console.warn(err);
      pushMessage(p, "assistant", "⚠️ Hubo un problema al responder. Intenta de nuevo.");
      renderMessages();
    } finally {
      state.isSending = false;
      setSendDisabled(false);
    }
  }

  function setSendDisabled(disabled) {
    if (dom.sendBtn) dom.sendBtn.disabled = disabled;
    if (dom.input) dom.input.disabled = disabled;
  }

  function getHistoryForRequest(profile, maxPairs = 10) {
    const chatKey = getChatKey(profile);
    const msgs = state.chats[chatKey] || [];
    // take last N messages
    return msgs.slice(Math.max(0, msgs.length - maxPairs * 2));
  }

  function pushMessage(profile, role, text) {
    const chatKey = getChatKey(profile);
    if (!state.chats[chatKey]) state.chats[chatKey] = [];
    state.chats[chatKey].push({ role, text, ts: Date.now() });

    saveAllChats(state.chats);
  }

  function getChatKey(profile) {
    // separate chats by type + id + lang (optional)
    // If you want SAME chat across languages, remove `:${state.lang}`
    return `${profile.type}:${profile.id}:${state.lang}`;
  }

  // -----------------------------
  // API CALL
  // -----------------------------
  async function askAI({ profile, userText, lang, history }) {
    // Payload expected by your backend:
    // { profile: {...}, message, lang, history }
    const payload = {
      profile: {
        type: profile.type,
        id: profile.id,
        name: profile.name,
        system: profile.system,
      },
      message: userText,
      lang,
      history,
    };

    const res = await fetch(`${API_BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const t = await safeText(res);
      throw new Error(`API chat failed: ${res.status} ${t}`);
    }

    const data = await res.json();
    // accepts {reply:"..."} or {text:"..."} or string
    if (typeof data === "string") return data;
    return data.reply || data.text || "…";
  }

  async function safeText(res) {
    try {
      return await res.text();
    } catch {
      return "";
    }
  }

  // -----------------------------
  // LOCAL STORAGE
  // -----------------------------
  function loadAllChats() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  function saveAllChats(chats) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(chats));
    } catch (e) {
      console.warn("No se pudo guardar chats", e);
    }
  }
})();
