import OpenAI from "openai";

function buildClient(): OpenAI {
  // Option 1: Groq (fast, free, OpenAI-compatible)
  if (process.env.GROQ_API_KEY) {
    const client = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: "https://api.groq.com/openai/v1",
    });

    // Intercept chat completions to rewrite model names for Groq compatibility
    const originalCreate = client.chat.completions.create.bind(client.chat.completions);
    (client.chat.completions as any).create = function (body: any, options: any) {
      if (body.model === "gpt-4o-mini") {
        body.model = "llama-3.3-70b-versatile";
      } else if (body.model === "gpt-4o") {
        const hasImages = body.messages.some((msg: any) =>
          Array.isArray(msg.content) && msg.content.some((c: any) => c.type === "image_url")
        );
        body.model = hasImages ? "meta-llama/llama-4-scout-17b-16e-instruct" : "llama-3.3-70b-versatile";
      }
      return originalCreate(body, options);
    };

    return client;
  }

  // Option 2: Custom base URL (any OpenAI-compatible provider)
  if (process.env.AI_INTEGRATIONS_OPENAI_BASE_URL && process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
    return new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
  }

  // Option 3: Standard OpenAI
  if (process.env.OPENAI_API_KEY) {
    return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  throw new Error(
    "No AI API key configured. Set GROQ_API_KEY (free at console.groq.com), " +
    "OPENAI_API_KEY, or AI_INTEGRATIONS_OPENAI_API_KEY + AI_INTEGRATIONS_OPENAI_BASE_URL."
  );
}

export const openai = buildClient();
