import { callGemini } from "../gemini";
import { cached, hashText } from "../responseCache";
import { AI_CONFIG } from "../config";
import { compactSyllabus, clip } from "../context";
import { flashcardsSchema } from "../schemas";

/** 5 study cards for a syllabus. Cached per outline so reopening setup costs nothing. */
export function runFlashcards(p, apiKey) {
  const outline = compactSyllabus(p.syllabusStructure);
  const key = `cards:${p.mode}:${hashText(outline)}`;
  return cached(key, AI_CONFIG.cacheTtlMs.flashcards, async () => {
    const prompt = p.mode === "professional"
      ? `Write exactly 5 high-yield interview flashcards for this role outline. Each: "question" and "shortAnswer" (max 55 words; trade-offs, architecture choices, STAR highlights).\n${outline}`
      : `Write exactly 5 high-yield study flashcards for this syllabus outline. Each: "question" and "shortAnswer" (max 55 words; include key equations and definitions).\n${outline}`;
    const cards = await callGemini({ feature: "flashcards", prompt, schema: flashcardsSchema, apiKey });
    const list = (Array.isArray(cards) ? cards : []).slice(0, 5)
      .map((c) => ({ question: clip(c?.question, 220), shortAnswer: clip(c?.shortAnswer, 500) }))
      .filter((c) => c.question && c.shortAnswer);
    if (!list.length) throw new Error("flashcards: empty");
    return list;
  });
}
