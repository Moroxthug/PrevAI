import OpenAI from "openai";

// Supports three configurations (in priority order):
// 1. Custom base URL + key (e.g. Groq, Together AI):
//    AI_INTEGRATIONS_OPENAI_BASE_URL + AI_INTEGRATIONS_OPENAI_API_KEY
// 2. Google Gemini (free tier, vision-capable):
//    GEMINI_API_KEY
// 3. Standard OpenAI:
//    OPENAI_API_KEY

function buildClient(): OpenAI {
  // Option 1: explicit custom base URL (Groq, Together, etc.)
  if (process.env.AI_INTEGRATIONS_OPENAI_BASE_URL && process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
    return new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
  }

  // Option 2: Google Gemini via OpenAI-compatible endpoint (free tier)
  if (process.env.GEMINI_API_KEY) {
    return new OpenAI({
      apiKey: process.env.GEMINI_API_KEY,
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    });
  }

  // Option 3: Standard OpenAI
  if (process.env.OPENAI_API_KEY) {
    return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  throw new Error(
    "No AI API key configured. Set GEMINI_API_KEY (free), OPENAI_API_KEY, " +
    "or AI_INTEGRATIONS_OPENAI_API_KEY + AI_INTEGRATIONS_OPENAI_BASE_URL."
  );
}

export const openai = buildClient();
