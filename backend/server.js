// backend/server.js
// Servidor limpio para HÁBLAME MVP (sin crashes y con endpoints básicos)

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const OpenAI = require("openai");
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
const app = express();
const PORT = process.env.PORT || 3000;

// ============ MIDDLEWARE ============
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json());

// ============ HELPERS ============
function loadJsonSafe(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch (e) {
    console.warn("⚠️ No pude leer JSON:", filePath, e.message);
    return fallback;
  }
}

// Rutas esperadas (server.js está dentro de /backend)
const CHAR_PATH = path.join(__dirname, "..", "frontend", "characters.json");
const ASSIST_PATH = path.join(__dirname, "..", "frontend", "assistants.json");

// Cargar personajes
let characters = [];
function reloadCharacters() {
  const data = loadJsonSafe(CHAR_PATH, null);
  if (Array.isArray(data)) {
    characters = data;
  } else if (data && Array.isArray(data.characters)) {
    characters = data.characters;
  } else {
    characters = [
      { id: "marco", name: "Marco Aurelio", basePrompt: "Eres Marco Aurelio..." },
      { id: "biblia", name: "Biblia", basePrompt: "Hablas desde una perspectiva bíblica..." },
      { id: "seneca", name: "Séneca", basePrompt: "Eres Séneca..." },
      { id: "sor_juana", name: "Sor Juana", basePrompt: "Eres Sor Juana..." },
    ];
  }
  console.log(`✅ characters cargados: ${characters.length}`);
}
reloadCharacters();

// Cargar asistentes (opcional, solo para endpoint /api/assistants)
let assistants = [];
function reloadAssistants() {
  const data = loadJsonSafe(ASSIST_PATH, null);
  if (Array.isArray(data)) assistants = data;
  else if (data && Array.isArray(data.assistants)) assistants = data.assistants;
  else assistants = [];
  console.log(`✅ assistants cargados: ${assistants.length}`);
}
reloadAssistants();

// ============ CLIENTE OPENAI ============
let openaiClient = null;
if (process.env.OPENAI_API_KEY) {
  openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  console.log("✅ OPENAI_API_KEY detectada en .env");
} else {
  console.warn("⚠️ No se encontró OPENAI_API_KEY en .env. Usaré respuestas de prueba.");
}

// ============ ENDPOINTS ============
app.get("/api/characters", (req, res) => {
  res.json({ characters });
});

app.get("/api/assistants", (req, res) => {
  res.json({ assistants });
});

// ============ CHAT ============
app.post("/api/chat", async (req, res) => {
  try {
    const { message, characterId, language, systemPrompt } = req.body || {};

    if (!message || !String(message).trim()) {
      return res.status(400).json({ error: "El campo 'message' es obligatorio." });
    }

    // 1) Si el frontend manda systemPrompt, se respeta tal cual.
    let systemMessage = (systemPrompt && String(systemPrompt).trim()) || "";

    // 2) Fallback SOLO si NO vino systemPrompt (por si el front falla)
    if (!systemMessage) {
      const userLang = (language || "es").toLowerCase();
      const langInstruction =
        userLang === "es"
          ? "Responde SIEMPRE en español neutro."
          : userLang === "pt"
          ? "Responda SEMPRE em português brasileiro, claro e natural."
          : "Always respond in natural, clear English.";

      let character = characters[0] || null;
      if (characterId) {
        const found = characters.find((c) => c.id === characterId);
        if (found) character = found;
      }

      const basePrompt =
        (character && (character.basePrompt || character.prompt)) ||
        "Eres un acompañante emocional cálido y realista.";

      systemMessage = `${basePrompt}\n${langInstruction}`.trim();
    }

    // Seguridad siempre al final
    systemMessage +=
      "\nHablas dentro del contexto de la app HÁBLAME. No des consejos médicos, legales ni financieros peligrosos.";

    // Sin API key -> respuesta de prueba
    if (!openaiClient) {
      return res.json({
        reply:
          "Respuesta de prueba (sin IA real). Tu mensaje fue: " + JSON.stringify(message),
      });
    }

    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

    const lang = (language || "es").toLowerCase();

const HARD_LANGUAGE_RULE =
  lang === "en"
    ? "IMPORTANT: You MUST answer ONLY in English. Do not use any other language."
    : lang === "pt"
    ? "IMPORTANTE: Você DEVE responder SOMENTE em português. Não use outro idioma."
    : "IMPORTANTE: DEBES responder ÚNICAMENTE en español. No uses ningún otro idioma.";

const completion = await openaiClient.chat.completions.create({
  model,
  messages: [
    {
      role: "system",
      content: HARD_LANGUAGE_RULE
    },
    {
      role: "system",
      content: systemMessage
    },
    {
      role: "user",
      content: message
    }
  ],
});


    const replyText =
      completion.choices?.[0]?.message?.content?.trim() ||
      "No pude generar una respuesta, intenta de nuevo.";

    return res.json({ reply: replyText });
  } catch (err) {
    console.error("❌ Error en /api/chat:", err);
    return res.status(500).json({ error: "Error interno al comunicar con IA." });
  }
});

// ============ ARRANCAR ============
app.listen(PORT, () => {
  console.log(`✅ SERVIDOR HÁBLAME MVP ARRANCÓ en http://localhost:${PORT}`);
});
