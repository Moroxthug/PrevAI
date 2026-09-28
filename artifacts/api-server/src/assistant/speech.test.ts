import { afterEach, describe, expect, it, vi } from "vitest";
import { ASSISTANT_SPEECH_MAX_CHARS, SentenceChunker, estimateSpeechSeconds, spokenText } from "@workspace/config";

// APP-8e: si comincia a parlare alla prima frase finita, non alla fine della risposta.

const feed = (chunks: string[]) => {
  const c = new SentenceChunker();
  const out: string[][] = chunks.map((d) => c.push(d));
  return { steps: out, rest: c.flush() };
};

describe("SentenceChunker", () => {
  it("gives the first sentence as soon as it is finished", () => {
    const { steps, rest } = feed(["Il cantiere Rossi è nel bud", "get. Mancano ", "4.200 € da incassare."]);
    expect(steps[0]).toEqual([]);
    expect(steps[1]).toEqual(["Il cantiere Rossi è nel budget."]);
    expect(steps[2]).toEqual([]);
    expect(rest).toEqual(["Mancano 4.200 € da incassare."]);
  });

  it("does not cut on thousands, decimals or abbreviations", () => {
    const { steps, rest } = feed(["Fattura n. 3 del sig. Rossi: 1.250,50 € per 12 mq. di posa. Fatto."]);
    expect(steps[0]).toEqual(["Fattura n. 3 del sig. Rossi: 1.250,50 € per 12 mq. di posa."]);
    expect(rest).toEqual(["Fatto."]);
  });

  it("reads bullets one per line, without markdown", () => {
    const { steps, rest } = feed(["Ecco cosa serve oggi:\n- **Rossi**: manca il SAL\n- Bianchi: fattura da mandare\n"]);
    expect(steps[0]).toEqual(["Ecco cosa serve oggi:", "Rossi: manca il SAL", "Bianchi: fattura da mandare"]);
    expect(rest).toEqual([]);
  });

  it("keeps very short pieces for the next one", () => {
    const { steps, rest } = feed(["Sì. Lo preparo adesso. "]);
    expect(steps[0]).toEqual(["Sì. Lo preparo adesso."]);
    expect(rest).toEqual([]);
  });

  it("splits a sentence longer than the maximum", () => {
    const long = `${"parola ".repeat(200).trim()}.`;
    const { rest } = feed([long]);
    expect(rest.length).toBeGreaterThan(1);
    for (const r of rest) expect(r.length).toBeLessThanOrEqual(ASSISTANT_SPEECH_MAX_CHARS);
    expect(rest.join(" ")).toBe(long);
  });
});

describe("spokenText / estimateSpeechSeconds", () => {
  it("drops links and markup", () => {
    expect(spokenText("Vedi [la fattura](https://prevai.it/x) e https://prevai.it/y **ora**")).toBe("Vedi la fattura e ora");
  });
  it("estimates about 14 characters a second", () => {
    expect(estimateSpeechSeconds("a".repeat(140))).toBe(10);
    expect(estimateSpeechSeconds("a".repeat(140), 2)).toBe(5);
    expect(estimateSpeechSeconds("")).toBe(1);
  });
});

const recorded: unknown[] = [];
vi.mock("../lib/usage.js", () => ({ recordUsageEvent: async (e: unknown) => { recorded.push(e); } }));

describe("speech provider (D17 open)", () => {
  afterEach(() => { delete process.env.ASSISTANT_TTS_OPENAI_KEY; vi.unstubAllGlobals(); recorded.length = 0; });

  it("is the browser's voice without the provider key", async () => {
    const { speechProvider } = await import("./speech.js");
    expect(speechProvider()).toBe("browser");
    process.env.ASSISTANT_TTS_OPENAI_KEY = "sk-test";
    expect(speechProvider()).toBe("openai");
  });

  it("asks the provider for mp3 with the key only on the server, and counts the seconds", async () => {
    process.env.ASSISTANT_TTS_OPENAI_KEY = "sk-test";
    const fetchMock = vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { synthesize } = await import("./speech.js");
    const audio = await synthesize("org-1", "a".repeat(140), 1);
    expect([...audio]).toEqual([1, 2, 3]);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/audio/speech");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk-test");
    expect(JSON.parse(String(init.body))).toMatchObject({ model: "gpt-4o-mini-tts", response_format: "mp3", speed: 1 });
    expect(recorded).toEqual([expect.objectContaining({ userId: "org-1", kind: "ai_speech", quantity: 10 })]);
  });

  it("fails without counting when the provider refuses", async () => {
    process.env.ASSISTANT_TTS_OPENAI_KEY = "sk-test";
    vi.stubGlobal("fetch", vi.fn(async () => new Response("quota", { status: 429 })));
    const { synthesize } = await import("./speech.js");
    await expect(synthesize("org-1", "Ciao", 1)).rejects.toThrow("TTS 429");
    expect(recorded).toEqual([]);
  });
});
