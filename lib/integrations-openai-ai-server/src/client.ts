import OpenAI from "openai";

type Message =
  | { role: "system" | "user" | "assistant"; content: string }
  | { role: "user"; content: Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string; detail?: string } }> };

interface ChatCompletionOptions {
  model: string;
  messages: Message[];
  max_completion_tokens?: number;
}

interface ChatCompletionResult {
  choices: Array<{ message: { content: string | null; role: string } }>;
}

// Wraps @google/genai to look like openai.chat.completions — zero changes needed elsewhere
async function buildGeminiClient(apiKey: string) {
  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey });

  return {
    chat: {
      completions: {
        create: async (opts: ChatCompletionOptions): Promise<ChatCompletionResult> => {
          const systemParts = (opts.messages as Message[])
            .filter((m) => m.role === "system" && typeof m.content === "string")
            .map((m) => m.content as string)
            .join("\n\n");

          const userMessages = opts.messages.filter((m) => m.role !== "system");

          const contents = userMessages.map((m) => {
            if (typeof m.content === "string") {
              return { role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] };
            }
            // Multi-part (text + images)
            const parts = (m.content as Array<{ type: string; text?: string; image_url?: { url: string } }>).map((c) => {
              if (c.type === "text") return { text: c.text! };
              // image_url: data URI — extract base64
              const url = c.image_url!.url;
              const match = url.match(/^data:([^;]+);base64,(.+)$/);
              if (match) return { inlineData: { mimeType: match[1], data: match[2] } };
              return { text: `[image: ${url}]` };
            });
            return { role: "user", parts };
          });

          const response = await ai.models.generateContent({
            model: opts.model,
            config: {
              ...(systemParts ? { systemInstruction: systemParts } : {}),
              ...(opts.max_completion_tokens ? { maxOutputTokens: opts.max_completion_tokens } : {}),
            },
            contents,
          });

          return {
            choices: [{ message: { content: response.text ?? null, role: "assistant" } }],
          };
        },
      },
    },
  };
}

function buildOpenAIClient(): OpenAI {
  if (process.env.AI_INTEGRATIONS_OPENAI_BASE_URL && process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
    return new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
  }
  if (process.env.OPENAI_API_KEY) {
    return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  throw new Error("No OpenAI-compatible API key found");
}

// Lazy singleton — resolved on first use
let _client: Awaited<ReturnType<typeof buildGeminiClient>> | OpenAI | null = null;

async function getClient() {
  if (_client) return _client;
  if (process.env.GEMINI_API_KEY) {
    _client = await buildGeminiClient(process.env.GEMINI_API_KEY);
  } else {
    _client = buildOpenAIClient();
  }
  return _client;
}

// Drop-in replacement for `openai` — same interface, supports both Gemini and OpenAI
export const openai = new Proxy({} as OpenAI, {
  get(_target, prop) {
    if (prop === "chat") {
      return {
        completions: {
          create: async (opts: ChatCompletionOptions) => {
            const client = await getClient();
            return client.chat.completions.create(opts as Parameters<OpenAI["chat"]["completions"]["create"]>[0]);
          },
        },
      };
    }
    return undefined;
  },
});
