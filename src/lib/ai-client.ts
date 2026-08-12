// SEISMO PH — AI client.
// Uses z-ai-web-dev-sdk as the PRIMARY provider (works everywhere with .z-ai-config).
// Falls back to Google Gemini if z-ai fails.

const GEMINI_API_KEY = process.env.GOOGLE_AI_API_KEY;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Primary: z-ai-web-dev-sdk (works with .z-ai-config in project root) */
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
  if (!text) throw new Error("z-ai returned empty");
  console.log(`[ai:${requestId}] z-ai success`);
  return text.trim();
}

/** Fallback: Google Gemini REST API */
async function generateWithGeminiREST(
  systemPrompt: string,
  userPrompt: string,
  requestId: string,
): Promise<string> {
  if (!GEMINI_API_KEY) throw new Error("NO_API_KEY");

  const modelNames = [
    "gemini-1.5-flash",
    "gemini-1.5-flash-latest",
    "gemini-1.5-pro",
    "gemini-pro",
  ];

  let lastError = "";
  for (const modelName of modelNames) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 500 },
        }),
        signal: AbortSignal.timeout(25000),
      });

      if (!res.ok) {
        lastError = `${modelName}: ${res.status}`;
        if (res.status === 404) continue;
        continue;
      }

      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) { lastError = `${modelName}: empty`; continue; }
      console.log(`[ai:${requestId}] Gemini REST ${modelName} success`);
      return text.trim();
    } catch (e) {
      lastError = String(e).slice(0, 100);
      continue;
    }
  }
  throw new Error(`Gemini REST all failed: ${lastError}`);
}

/**
 * Generate text. Uses z-ai as primary (works on Vercel with .z-ai-config),
 * Gemini REST as fallback.
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

      // Primary: z-ai (works everywhere with .z-ai-config in project root)
      try {
        text = await generateWithZai(systemPrompt, userPrompt, requestId);
        provider = "z-ai";
      } catch (zaiErr) {
        console.error(`[ai:${requestId}] z-ai attempt ${attempt} failed:`, String(zaiErr).slice(0, 120));
        // Fallback: Gemini REST
        if (GEMINI_API_KEY) {
          text = await generateWithGeminiREST(systemPrompt, userPrompt, requestId);
          provider = "gemini-rest";
        } else {
          throw zaiErr;
        }
      }

      return { text, requestId, provider, durationMs: Date.now() - startTime };
    } catch (e) {
      lastError = String(e).slice(0, 200);
      console.error(`[ai:${requestId}] Attempt ${attempt} fully failed:`, lastError);
      if (attempt < MAX_RETRIES + 1) {
        await sleep(RETRY_DELAY_MS * attempt);
      }
    }
  }

  const durationMs = Date.now() - startTime;
  throw new AiError("AI service temporarily unavailable", requestId, durationMs);
}

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
