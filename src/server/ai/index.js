/**
 * AI feature registry. Adding a feature = write a `features/x.js`, add one line here, add a
 * budget in config.js and a schema in schemas.js. The route never changes.
 *
 *  action            feature                                   Gemini calls
 *  ----------------  ----------------------------------------  ------------------------------
 *  expand-topic      topic keyword -> outline (cached)          1 (0 on cache hit)
 *  parse-syllabus    pasted notes -> outline (cached)           1 (0 on cache hit)
 *  generate-flashcards  5 study cards (cached)                  1 (0 on cache hit)
 *  start-session     first question                             1
 *  turn              grade answer + write next question         1 per answered question
 *  generate-hint     friendly-persona nudge                     1 (only when stuck)
 *  generate-subquestion  terror-persona interruption            1 (only when stuck)
 *  hindsight-analyze post-session retrospective                 1 per session
 *  synthesize-speech ElevenLabs voice (LRU cached)              0 Gemini
 */
import { runStartSession, runTurn } from "./features/turn";
import { runHint, runSubQuestion } from "./features/hint";
import { runExpandTopic, runParseSyllabus } from "./features/syllabus";
import { runFlashcards } from "./features/flashcards";
import { runHindsight } from "./features/hindsight";
import { offlineAction } from "./offline";

export const FEATURES = {
  "expand-topic": runExpandTopic,
  "parse-syllabus": runParseSyllabus,
  "generate-flashcards": runFlashcards,
  "start-session": runStartSession,
  "turn": runTurn,
  "generate-hint": runHint,
  "generate-subquestion": runSubQuestion,
  "hindsight-analyze": runHindsight
};

/** Run an action online (Gemini); on any failure fall back to the offline engine. */
export async function runAiAction(payload, apiKey) {
  const feature = FEATURES[payload.action];
  if (!feature) return { status: 400, body: { error: "Invalid action type" } };

  if (apiKey) {
    try {
      return { status: 200, body: await feature(payload, apiKey) };
    } catch (err) {
      console.warn(`[ai] ${payload.action} failed online, using offline fallback: ${err.message}`);
    }
  } else {
    console.warn("GEMINI_API_KEY is missing. Using the offline engine.");
  }

  const offline = offlineActionSafe(payload);
  if (offline === null || offline === undefined) {
    return { status: 503, body: { error: "The AI service is temporarily unavailable. Please try again." } };
  }
  return { status: 200, body: offline };
}

function offlineActionSafe(payload) {
  try {
    const result = offlineAction(payload);
    if (result && typeof result === "object" && !Array.isArray(result)) return { ...result, offline: true };
    return result;
  } catch (err) {
    console.error("[ai] offline engine failed:", err);
    return null;
  }
}
