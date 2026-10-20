/**
 * Central AI configuration: models, per-feature token/time budgets, and switches.
 * Every Gemini call in the app goes through callGemini() using one of these budgets, so
 * token spend is controlled in exactly one place.
 */
export const AI_CONFIG = {
  // Fastest/cheapest first. Later entries are only used when the earlier one errors or times out.
  models: ["gemini-2.5-flash-lite", "gemini-3.1-flash-lite", "gemini-2.5-flash"],

  // Sending the answer recording costs ~32 input tokens per second of audio. It is what lets the
  // grader judge delivery (nervousness/confidence). Set AI_USE_AUDIO=false to grade text only and
  // rely on the browser's own delivery metrics.
  useAudio: process.env.AI_USE_AUDIO !== "false",
  maxAudioBase64Chars: 3_000_000, // ~2.2 MB (about 90 s of speech); longer clips are sent as text only

  // maxOut = hard cap on output tokens, timeoutMs = per-model timeout, temp = sampling temperature.
  features: {
    start:        { maxOut: 380,  timeoutMs: 7000, temp: 0.7 },
    turn:         { maxOut: 1300, timeoutMs: 10000, temp: 0.4 }, // grade + up to two candidate questions (typical ~450 out)
    hint:         { maxOut: 140,  timeoutMs: 6000, temp: 0.7 },
    subquestion:  { maxOut: 140,  timeoutMs: 6000, temp: 0.7 },
    topic:        { maxOut: 700,  timeoutMs: 8000, temp: 0.3 },
    syllabus:     { maxOut: 900,  timeoutMs: 9000, temp: 0.2 },
    flashcards:   { maxOut: 1300, timeoutMs: 10000, temp: 0.4 },
    hindsight:    { maxOut: 750,  timeoutMs: 10000, temp: 0.3 }
  },

  // Server-side result cache for deterministic, repeatable requests (zero tokens on a hit).
  cacheTtlMs: { topic: 6 * 60 * 60_000, syllabus: 60 * 60_000, flashcards: 60 * 60_000 }
};
