// SEISMO PH — Unified AI client using Google Generative AI SDK.
// Uses the official @google/generative-ai package for reliable model access.

import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_API_KEY = process.env.GOOGLE_AI_API_KEY;

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Generate text using Google Gemini via the official SDK. */
async function generateWithGemini(
  systemPrompt: string,
  userPrompt: string,
  requestId: string,
): Promise<string> {
  if (!GEMINI_API_KEY) throw new Error("NO_API_KEY");

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

  // Try multiple model names — Google frequently renames/deprecates models.
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
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 500,
        },
      });

      const result = await model.generateContent(userPrompt);
      const text = result.response.text();

      if (!text || text.trim().length === 0) {
        lastError = `${modelName}: empty response`;
        continue;
      }

      console.log(`[ai:${requestId}] Gemini ${modelName} success`);
      return text.trim();
    } catch (e: unknown) {
      lastError = `${modelName}: ${String(e).slice(0, 120)}`;
      console.error(`[ai:${requestId}] Gemini ${modelName} failed:`, lastError);
      // If it's a not-found error, try next model
      if (String(e).includes("404") || String(e).includes("not found")) continue;
      // If it's a location error, don't try more models
      if (String(e).includes("location") || String(e).includes("403")) {
        throw new Error("LOCATION_RESTRICTED");
      }
      continue;
    }
  }

  throw new Error(`All Gemini models failed: ${lastError}`);
}

/** Generate text using z-ai-web-dev-sdk (local sandbox fallback). */
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
 * Generate text with retry, timeout, and proper error handling.
 * Returns structured result with request ID and timing.
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

      // Try Gemini first if API key is set
      if (GEMINI_API_KEY) {
        try {
          text = await generateWithGemini(systemPrompt, userPrompt, requestId);
          provider = "gemini";
        } catch (e) {
          const errStr = String(e);
          if (errStr.includes("LOCATION_RESTRICTED")) {
            console.log(`[ai:${requestId}] Gemini location-restricted, using z-ai`);
          } else {
            console.error(`[ai:${requestId}] Gemini attempt ${attempt} failed:`, errStr.slice(0, 120));
          }
          // Fallback to z-ai
          text = await generateWithZai(systemPrompt, userPrompt, requestId);
          provider = "z-ai";
        }
      } else {
        // No Gemini key — use z-ai directly
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
