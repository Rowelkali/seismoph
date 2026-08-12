// SEISMO PH — Unified AI client.
// Three-tier fallback:
//   1. Google Gemini SDK (works on Vercel with GOOGLE_AI_API_KEY)
//   2. Direct Gemini REST API (fallback if SDK has issues)
//   3. z-ai-web-dev-sdk (works in local sandbox only)

import { GoogleGenerativeAI } from "@google/generative-ai";

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

/** Tier 1: Google Gemini via official SDK */
async function generateWithGeminiSDK(
  systemPrompt: string,
  userPrompt: string,
  requestId: string,
): Promise<string> {
  if (!GEMINI_API_KEY) throw new Error("NO_API_KEY");

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const modelNames = [
    "gemini-1.5-flash",
    "gemini-1.5-flash-latest",
    "gemini-1.5-pro",
    "gemini-1.5-pro-latest",
    "gemini-pro",
  ];

  let lastError = "";
  for (const modelName of modelNames) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: systemPrompt,
        generationConfig: { temperature: 0.7, maxOutputTokens: 500 },
      });
      const result = await model.generateContent(userPrompt);
      const text = result.response.text();
      if (!text || text.trim().length === 0) {
        lastError = `${modelName}: empty`;
        continue;
      }
      console.log(`[ai:${requestId}] Gemini SDK ${modelName} success`);
      return text.trim();
    } catch (e: unknown) {
      lastError = `${modelName}: ${String(e).slice(0, 100)}`;
      console.error(`[ai:${requestId}] Gemini SDK ${modelName} failed:`, lastError);
      if (String(e).includes("404") || String(e).includes("not found")) continue;
      if (String(e).includes("location") || String(e).includes("403")) continue;
      continue;
    }
  }
  throw new Error(`Gemini SDK all failed: ${lastError}`);
}

/** Tier 2: Direct Gemini REST API (no SDK, just fetch) */
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
    "gemini-1.5-pro-latest",
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
        const err = await res.text();
        lastError = `${modelName}: ${res.status}`;
        console.error(`[ai:${requestId}] Gemini REST ${modelName} failed: ${res.status}`);
        if (res.status === 404) continue;
        if (res.status === 400 && err.includes("location")) continue;
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

/** Tier 3: z-ai-web-dev-sdk (local sandbox only — needs /etc/.z-ai-config) */
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

/**
 * Generate text with 3-tier fallback + retry + timeout.
 * Tier 1: Gemini SDK → Tier 2: Gemini REST → Tier 3: z-ai (local only)
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
        // Tier 1: Gemini SDK
        try {
          text = await generateWithGeminiSDK(systemPrompt, userPrompt, requestId);
          provider = "gemini-sdk";
        } catch (sdkErr) {
          console.log(`[ai:${requestId}] Gemini SDK failed, trying REST...`);
          // Tier 2: Gemini REST
          try {
            text = await generateWithGeminiREST(systemPrompt, userPrompt, requestId);
            provider = "gemini-rest";
          } catch (restErr) {
            console.log(`[ai:${requestId}] Gemini REST failed, trying z-ai...`);
            // Tier 3: z-ai (local only)
            text = await generateWithZai(systemPrompt, userPrompt, requestId);
            provider = "z-ai";
          }
        }
      } else {
        // No Gemini key — use z-ai directly
        text = await generateWithZai(systemPrompt, userPrompt, requestId);
        provider = "z-ai";
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
