// SEISMO PH — Unified AI client.
// Uses Google Gemini API (works on Vercel) with z-ai-web-dev-sdk fallback
// (works in local sandbox where Google API may be location-restricted).

const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_API_KEY = process.env.GOOGLE_AI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export interface AiMessage {
  role: "user" | "model";
  text: string;
}

/** Generate text using Google Gemini API (REST, no SDK needed). */
async function generateWithGemini(systemPrompt: string, userPrompt: string): Promise<string> {
  const res = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 500,
      },
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error: ${res.status} ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned empty response");
  return text.trim();
}

/** Generate text using z-ai-web-dev-sdk (local sandbox fallback). */
async function generateWithZai(systemPrompt: string, userPrompt: string): Promise<string> {
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
  return text.trim();
}

/**
 * Generate text using the best available AI provider.
 * Tries Google Gemini first (for Vercel production), falls back to
 * z-ai-web-dev-sdk (for local sandbox where Gemini may be location-restricted).
 */
export async function generateText(systemPrompt: string, userPrompt: string): Promise<string> {
  // Try Google Gemini first if API key is configured
  if (GEMINI_API_KEY) {
    try {
      return await generateWithGemini(systemPrompt, userPrompt);
    } catch (e) {
      console.error("[ai] Gemini failed, falling back to z-ai:", String(e).slice(0, 100));
    }
  }

  // Fallback to z-ai-web-dev-sdk
  return await generateWithZai(systemPrompt, userPrompt);
}
