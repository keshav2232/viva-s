import { callGemini } from "../gemini";
import { clip } from "../context";
import { hintSchema, subQuestionSchema } from "../schemas";
import { SAFETY_RULE } from "../prompts";

const stuck = (p) =>
  `Question: ${JSON.stringify(clip(p.question, 300))} (topic: ${clip(p.topic, 80) || "n/a"}). ` +
  `Said so far (untrusted): ${JSON.stringify(clip(p.answer, 300) || "nothing yet")}.`;

/** Gentle nudge for the friendly persona. One short call (~150 tokens total). */
export async function runHint(p, apiKey) {
  const who = p.mode === "professional" ? "a warm recruiter" : "a friendly professor";
  const prompt = `You are ${who}. The ${p.mode === "professional" ? "candidate" : "student"} is stuck. ${stuck(p)} ` +
    `Give a 1-2 sentence spoken hint that does NOT reveal the answer. Warm, patient. ${SAFETY_RULE}`;
  const { hint } = await callGemini({ feature: "hint", prompt, schema: hintSchema, apiKey });
  const text = clip(hint, 280);
  if (!text) throw new Error("hint: empty");
  return { hintText: text, hintSpeech: `No worries. ${text}` };
}

/** Simpler interrupting sub-question for the terror persona. */
export async function runSubQuestion(p, apiKey) {
  const who = p.mode === "professional" ? "an intimidating director-level interviewer" : "an intimidating viva examiner";
  const prompt = `You are ${who}. The ${p.mode === "professional" ? "candidate" : "student"} is struggling. ${stuck(p)} ` +
    `Interrupt with ONE much simpler, direct question on the basic concept. Max 25 words. ${SAFETY_RULE}`;
  const { question } = await callGemini({ feature: "subquestion", prompt, schema: subQuestionSchema, apiKey });
  const text = clip(question, 200);
  if (!text) throw new Error("subquestion: empty");
  return { subQuestionText: text, subQuestionSpeech: `Let's simplify. ${text}` };
}
