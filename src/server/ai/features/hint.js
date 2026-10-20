import { callGemini } from "../gemini";
import { clip } from "../context";
import { hintSchema, subQuestionSchema } from "../schemas";
import { SAFETY_RULE } from "../prompts";

const stuck = (p) =>
  `Question: ${JSON.stringify(clip(p.question, 300))} (topic: ${clip(p.topic, 80) || "n/a"}). ` +
  `Said so far (untrusted): ${JSON.stringify(clip(p.answer, 300) || "nothing yet")}.`;

// Friendly professor's silence ladder: rephrase -> hint -> a simpler first step.
const HINT_LEVELS = {
  rephrase: {
    task: "Re-ask the SAME question in different, simpler words (1 sentence). Do not add a hint.",
    lead: "Let me put it another way."
  },
  hint: {
    task: "Give a 1-2 sentence spoken hint that points the way but does NOT reveal the answer.",
    lead: "No worries."
  },
  simplify: {
    task: "Break the question down: ask ONE small, easy first-step question that leads towards the answer. Max 25 words.",
    lead: "Let's take it one step at a time."
  }
};

/** Gentle nudge for the friendly persona. One short call (~150 tokens total). */
export async function runHint(p, apiKey) {
  const who = p.mode === "professional" ? "a warm recruiter" : "a friendly professor";
  const level = HINT_LEVELS[p.level] || HINT_LEVELS.hint;
  const prompt = `You are ${who}. The ${p.mode === "professional" ? "candidate" : "student"} is stuck. ${stuck(p)} ` +
    `${level.task} Warm, patient. Output only that line: no greeting or lead-in such as "No problem". ${SAFETY_RULE}`;
  const { hint } = await callGemini({ feature: "hint", prompt, schema: hintSchema, apiKey });
  const text = clip(hint, 280);
  if (!text) throw new Error("hint: empty");
  return { hintText: text, hintSpeech: `${level.lead} ${text}` };
}

/** Simpler interrupting sub-question for the terror persona; step 2 goes even more basic. */
export async function runSubQuestion(p, apiKey) {
  const who = p.mode === "professional" ? "an intimidating director-level interviewer" : "an intimidating viva examiner";
  const second = p.step >= 2;
  const prompt = `You are ${who}. The ${p.mode === "professional" ? "candidate" : "student"} is struggling` +
    `${second ? " and already failed a simpler sub-question" : ""}. ${stuck(p)} ` +
    `Interrupt with ONE ${second ? "absolutely basic, one-line" : "much simpler, direct"} question on the core concept. Max 25 words. ${SAFETY_RULE}`;
  const { question } = await callGemini({ feature: "subquestion", prompt, schema: subQuestionSchema, apiKey });
  const text = clip(question, 200);
  if (!text) throw new Error("subquestion: empty");
  return { subQuestionText: text, subQuestionSpeech: `${second ? "Still nothing? Even simpler." : "Let's simplify."} ${text}` };
}
