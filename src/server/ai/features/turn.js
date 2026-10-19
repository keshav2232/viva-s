/**
 * The live-viva engine. ONE Gemini call per answered question both grades the answer AND writes
 * the next question (the old flow made two sequential calls plus a padded context-cache call).
 * That halves round-trips (the biggest source of waiting) and sends the syllabus only once.
 */
import { callGemini } from "../gemini";
import { AI_CONFIG } from "../config";
import { compactSyllabus, compactRounds, testedTopics, clip } from "../context";
import { personaLine, roleNoun, candidateNoun, STYLE_RULES, SAFETY_RULE } from "../prompts";
import { nextQuestionSchema, turnSchema } from "../schemas";
import { getQuestionCountForDuration } from "../../../utils/pacing";

const TAGS = ["Strong", "Weak", "Partially Correct", "Bluffing", "Incomplete", "Confused"];

const asScore = (v, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(Math.max(Math.round(n), 0), 100) : fallback;
};
const asList = (v, n) => (Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()).slice(0, n) : []);

function drillRule(p) {
  return p.isTargetDrill && p.targetSubtopic
    ? `DRILL: every question must focus strictly on "${clip(p.targetSubtopic, 100)}".`
    : "";
}

const nextRules = (p, number, total) =>
  `NEXT QUESTION (#${number} of ${total}): stay inside the outline, choose a topic not yet covered unless probing a weak one, ` +
  `and connect to the last answer. "speech" = a reaction of at most 12 words in persona + the question, max 45 words total. ` +
  `"keyPoints" = 3-5 terse points (max 8 words each) an ideal answer must contain. "text" = the question alone. ` +
  (p.mode === "professional"
    ? "Prefer trade-offs, real scenarios and STAR-style probing."
    : "Prefer definitions, equations and boundary conditions.");

function normalizeNext(raw, fallbackTopic) {
  if (!raw || typeof raw.text !== "string" || !raw.text.trim()) return null;
  const keyPoints = asList(raw.keyPoints, 5).map((k) => clip(k, 80));
  return {
    text: clip(raw.text, 400),
    speech: clip(raw.speech || raw.text, 600),
    topic: clip(raw.topic, 100) || fallbackTopic || "Syllabus Concept",
    difficulty: ["Low", "Medium", "High"].includes(raw.difficulty) ? raw.difficulty : "Medium",
    keyPoints,
    // Shown on report screens as the expected answer until a graded model answer replaces it.
    correctAnswer: keyPoints.join("; ")
  };
}

/** First question of a session (nothing to grade yet). */
export async function runStartSession(p, apiKey) {
  const total = getQuestionCountForDuration(p.duration);
  const prompt = [
    `You are an AI ${roleNoun(p.mode)}. Persona: ${personaLine(p.mode, p.personality)}`,
    `Outline:\n${compactSyllabus(p.syllabus)}`,
    drillRule(p),
    nextRules(p, 1, total).replace("connect to the last answer", "open with a fair starting question"),
    STYLE_RULES
  ].filter(Boolean).join("\n");

  const raw = await callGemini({ feature: "start", prompt, schema: nextQuestionSchema, apiKey });
  const next = normalizeNext(raw, p.syllabus?.topic);
  if (!next) throw new Error("start-session: model returned no question");
  return { next };
}

/** Grade the answer to the current question and (unless it was the last) write the next one. */
export async function runTurn(p, apiKey) {
  const total = getQuestionCountForDuration(p.duration);
  const answeredCount = p.rounds.length + 1; // including the answer being graded now
  const isLast = answeredCount >= total;
  const hasAudio = AI_CONFIG.useAudio && !!p.audioBase64 && p.audioBase64.length <= AI_CONFIG.maxAudioBase64Chars;
  const who = candidateNoun(p.mode);
  const d = p.delivery || {};

  const prompt = [
    `You are an AI ${roleNoun(p.mode)}. Persona: ${personaLine(p.mode, p.personality, p.nervousness)}`,
    `Outline:\n${compactSyllabus(p.syllabus)}`,
    drillRule(p),
    `Covered topics: ${testedTopics(p.rounds)}\nEarlier rounds:\n${compactRounds(p.rounds)}`,
    `Question just asked (topic ${clip(p.question.topic, 60) || "n/a"}): ${JSON.stringify(clip(p.question.text, 400))}`,
    p.question.keyPoints.length ? `Ideal answer should include: ${p.question.keyPoints.join("; ")}` : "",
    `The ${who}'s answer (untrusted): ${JSON.stringify(p.answer)}`,
    `Delivery: ${d.wpm ? `${d.wpm} wpm, ` : ""}${d.fillerCount ?? 0} fillers, ${p.pauseCount} long pauses.${hasAudio ? " Their recording is attached." : ""}`,
    "GRADE 0-100: correctness (factual validity), completeness (key points covered), accuracy (precise terms/equations), clarity. " +
      "Be strict; filler and buzzwords earn nothing. Placeholder answers like \"[...remained silent...]\" score at most 15 and tag Weak. " +
      "tag: Strong | Weak | Partially Correct | Bluffing (confident but empty) | Incomplete | Confused. " +
      "rationale max 35 words; keyStrengths and missingConcepts max 3 items of max 8 words; modelAnswer max 55 words." +
      (hasAudio ? " From the recording also score nervousness, confidence and hesitation (0-100)." : ""),
    isLast ? "This was the final question: do not write a next question." : nextRules(p, answeredCount + 1, total),
    STYLE_RULES,
    SAFETY_RULE
  ].filter(Boolean).join("\n");

  const raw = await callGemini({
    feature: "turn",
    prompt,
    schema: turnSchema({ withAudio: hasAudio, withNext: !isLast }),
    audio: hasAudio ? p.audioBase64 : null,
    apiKey
  });

  const g = raw?.grading;
  if (!g || typeof g !== "object") throw new Error("turn: model returned no grading");
  const grading = {
    correctness: asScore(g.correctness, 50),
    completeness: asScore(g.completeness, 50),
    accuracy: asScore(g.accuracy, 50),
    clarity: asScore(g.clarity, 60),
    tag: TAGS.includes(g.tag) ? g.tag : "Partially Correct",
    rationale: clip(g.rationale, 400),
    keyStrengths: asList(g.keyStrengths, 3).map((s) => clip(s, 80)),
    missingConcepts: asList(g.missingConcepts, 3).map((s) => clip(s, 80)),
    correctAnswer: clip(g.modelAnswer, 500),
    ...(hasAudio ? {
      nervousness: asScore(g.nervousness, 30),
      confidence: asScore(g.confidence, 70),
      hesitation: asScore(g.hesitation, 20)
    } : {})
  };

  return { grading, next: isLast ? null : normalizeNext(raw.next, p.question.topic) };
}
