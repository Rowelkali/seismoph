// SEISMO PH — Unified AI client with retry, timeout, and error logging.
// Uses Google Gemini API (works on Vercel) with z-ai-web-dev-sdk fallback.

const GEMINI_API_KEY = process.env.GOOGLE_AI_API_KEY;

const GEMINI_MODELS = [
  "gemini-2.0-flash-001",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
  "gemini-pro",
];

const MAX_RETRIES = 2;
const REQUEST_TIMEOUT_MS = 25000;
const RETRY_DELAY_MS = 1000;

/** Generate a unique request ID for logging. */
export function generateRequestId(): string {
  const ts = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `ai_${ts}_${rand}`;
}

export interface AiResult {
  text: string;
  requestId: string;
  provider: string;
  durationMs: number;
}

/** Sleep for ms milliseconds. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Generate text using Google Gemini API with retry. */
async function generateWithGemini(
  systemPrompt: string,
  userPrompt: string,
  requestId: string,
): Promise<string> {
  let lastError = "";

  for (const model of GEMINI_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 500 },
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (!res.ok) {
        const err = await res.text();
        lastError = `${model}: ${res.status}`;
        console.error(`[ai:${requestId}] Gemini ${model} failed: ${res.status}`, err.slice(0, 200));
        if (res.status === 404) continue;
        if (res.status === 429) {
          // Rate limited — wait and retry
          await sleep(RETRY_DELAY_MS * 2);
          continue;
        }
        if (res.status === 400 && err.includes("location")) {
          throw new Error(`LOCATION_RESTRICTED`);
        }
        continue;
      }

      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        lastError = `${model}: empty response`;
        continue;
      }
      console.log(`[ai:${requestId}] Gemini ${model} success`);
      return text.trim();
    } catch (e: unknown) {
      lastError = String(e).slice(0, 150);
      if (String(e).includes("LOCATION_RESTRICTED") || String(e).includes("location")) {
        throw new Error("LOCATION_RESTRICTED");
      }
      continue;
    }
  }

  throw new Error(`All Gemini models failed: ${lastError}`);
}

/** Generate text using z-ai-web-dev-sdk. */
async function generateWithZai(
  systemPrompt: string,
  userPrompt: string,
  requestId: string,
): Promise<string> {
  const ZAI = (await import("z-ai-web-dev-sdk")).default;
  const zai = await ZAI.create();
  const completion = await zai.chat.completions.create({
    messages: [
      { role: "assistant", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    thinking: { type: "disabled" },
  });
  const text = completion.choices[0]?.message?.content;
  if (!text) throw new Error("z-ai returned empty response");
  console.log(`[ai:${requestId}] z-ai success`);
  return text.trim();
}

/**
 * Generate text using the best available AI provider with retry + timeout.
 * Returns a structured result with request ID and timing.
 */
export async function generateText(
  systemPrompt: string,
  userPrompt: string,
): Promise<AiResult> {
  const requestId = generateRequestId();
  const startTime = Date.now();
  let lastError = "";

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    try {
      let text: string;
      let provider: string;

      if (GEMINI_API_KEY) {
        try {
          text = await generateWithGemini(systemPrompt, userPrompt, requestId);
          provider = "gemini";
        } catch (e) {
          if (String(e).includes("LOCATION_RESTRICTED")) {
            console.log(`[ai:${requestId}] Gemini location-restricted, using z-ai`);
          } else {
            console.error(`[ai:${requestId}] Gemini attempt ${attempt} failed:`, String(e).slice(0, 120));
          }
          text = await generateWithZai(systemPrompt, userPrompt, requestId);
          provider = "z-ai";
        }
      } else {
        text = await generateWithZai(systemPrompt, userPrompt, requestId);
        provider = "z-ai";
      }

      return {
        text,
        requestId,
        provider,
        durationMs: Date.now() - startTime,
      };
    } catch (e) {
      lastError = String(e).slice(0, 200);
      console.error(`[ai:${requestId}] Attempt ${attempt} failed:`, lastError);
      if (attempt < MAX_RETRIES + 1) {
        await sleep(RETRY_DELAY_MS * attempt);
      }
    }
  }

  const durationMs = Date.now() - startTime;
  console.error(`[ai:${requestId}] All attempts failed after ${durationMs}ms:`, lastError);
  throw new AiError("AI service temporarily unavailable", requestId, durationMs);
}

/** Custom error class that carries the request ID. */
export class AiError extends Error {
  constructor(
    message: string,
    public requestId: string,
    public durationMs: number,
  ) {
    super(message);
    this.name = "AiError";
  }
}
