import { callGemini } from "../gemini";
import { clip } from "../context";
import { hindsightSchema } from "../schemas";
import { SAFETY_RULE } from "../prompts";

const num = (v) => (Number.isFinite(v) ? Math.round(v) : "?");

/** Post-session retrospective over all rounds: one call per session, from compact round lines. */
export async function runHindsight(p, apiKey) {
  const rounds = p.askedQuestions.map((q, i) => {
    const o = p.askedQuestionsObjects[i] || {};
    const e = p.detectedEmotions[i] || {};
    return `R${i + 1} ${clip(o.topic, 50) || "?"} [${e.tag || "?"}] cor${num(e.correctness)} conf${num(e.confidence)} nerv${num(e.nervousness)} hes${num(e.hesitation)} | Q: ${clip(q, 90)} | A (untrusted): ${JSON.stringify(clip(p.answerTranscripts[i], 220))}`;
  }).join("\n");

  const who = p.mode === "professional" ? "candidate" : "student";
  const prompt = `You review a finished ${p.mode === "professional" ? "mock interview" : "viva"} on ${JSON.stringify(clip(p.subjectName, 100))}. ` +
    `Each round is already scored; find patterns across rounds that single-round scoring misses.\n${rounds}\n` +
    `Return: a 2-3 sentence performance arc; confidence trajectory; contradictions between rounds (rounds + one sentence); ` +
    `bluffingWarning only if high confidence with low accuracy repeats in 2+ rounds, else null; strongest and weakest round with evidence; ` +
    `2-3 actionable ${p.mode === "professional" ? "improvement" : "revision"} tips for the ${who}. Max 30 words per field. ${SAFETY_RULE}`;
  return callGemini({ feature: "hindsight", prompt, schema: hindsightSchema, apiKey });
}
