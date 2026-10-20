/**
 * The live-viva engine. ONE Gemini call per answered question both grades the answer AND writes
 * the next question (the old flow made two sequential calls plus a padded context-cache call).
 * That halves round-trips (the biggest source of waiting) and sends the syllabus only once.
 */
import { callGemini } from "../gemini";
import { AI_CONFIG } from "../config";
import { compactSyllabus, compactRounds, chainLength, testedTopics, clip } from "../context";
import { personaLine, roleNoun, candidateNoun, STYLE_RULES, SAFETY_RULE } from "../prompts";
import { nextQuestionSchema, turnSchema } from "../schemas";
import { getQuestionCountForDuration } from "../../../utils/pacing";
import { planTurn, pickNext, followUpGuide, typesFor } from "../followUps";

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

const SPEECH_RULE =
  `"speech" = a reaction of at most 12 words in persona + the question, max 45 words total. ` +
  `"keyPoints" = 3-5 terse points (max 8 words each) an ideal answer must contain. "text" = the question alone.`;

const styleHint = (p) => (p.mode === "professional"
  ? "Prefer trade-offs, real scenarios and STAR-style probing."
  : "Prefer definitions, equations and boundary conditions.");

/** Rules for a brand-new main question. `extra` = all planned topics are covered and time remains. */
const newTopicRules = (p, number, total, field = "NEXT QUESTION", extra = false) =>
  (extra
    ? `${field} (bonus question; all ${total} planned topics are covered and time remains): revisit the weakest earlier ` +
      `topic from a new angle, or ask an outline topic not yet covered. Make a natural transition from the last answer. `
    : `${field} (main question #${number} of ${total} planned): stay inside the outline, choose a topic not yet covered ` +
      `unless one scored poorly earlier, and make a natural transition from the last answer. `) +
  `${SPEECH_RULE} ${styleHint(p)}`;

/** When time is short, the next question must fit in what is left. */
const timeRule = (p, plan) =>
  plan.avgSec && p.timeLeftSec < plan.avgSec * 2
    ? `About ${Math.round(p.timeLeftSec)} seconds of the session remain: whichever question you write must be answerable in about ${Math.max(Math.round(p.timeLeftSec * 0.6), 20)} seconds.`
    : "";

/** Rules for a follow-up on the answer just given. */
const followUpRules = (p) =>
  `"followUp" = a follow-up on THIS answer, same topic, digging into what they just said. ${followUpGuide(p.personality)} ` +
  `Set "type" to the type you used. It MUST quote up to 15 of the ${candidateNoun(p.mode)}'s own words in quotation marks, or name one of your missingConcepts. ` +
  `${SPEECH_RULE} Keep "topic" the same as the question just asked.`;

function normalizeNext(raw, fallbackTopic) {
  if (!raw || typeof raw.text !== "string" || !raw.text.trim()) return null;
  const keyPoints = asList(raw.keyPoints, 5).map((k) => clip(k, 80));
  return {
    text: clip(raw.text, 400),
    speech: clip(raw.speech || raw.text, 600),
    topic: clip(raw.topic, 100) || fallbackTopic || "Syllabus Concept",
    difficulty: ["Low", "Medium", "High"].includes(raw.difficulty) ? raw.difficulty : "Medium",
    keyPoints,
    kind: "new_topic",
    followUpType: null,
    depth: 0,
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
    newTopicRules(p, 1, total).replace("make a natural transition from the last answer", "open with a fair starting question"),
    STYLE_RULES
  ].filter(Boolean).join("\n");

  const raw = await callGemini({ feature: "start", prompt, schema: nextQuestionSchema, apiKey });
  const next = normalizeNext(raw, p.syllabus?.topic);
  if (!next) throw new Error("start-session: model returned no question");
  return { next };
}

/**
 * Grade the answer to the current question and choose what comes next: a follow-up on this answer
 * or a new main question (decided by followUps.js from the grade tag, professor and chain depth),
 * or the end of the session. Follow-ups do not use up the main-question count.
 */
export async function runTurn(p, apiKey) {
  const total = getQuestionCountForDuration(p.duration);
  const depth = p.question.depth || 0;
  const mainAsked = p.rounds.filter((r) => !(r.depth > 0)).length + (depth === 0 ? 1 : 0);
  const plan = planTurn({
    personality: p.personality, depth, mainAsked, total, answered: p.rounds.length + 1,
    timeLeftSec: p.timeLeftSec, durationSec: (parseInt(p.duration, 10) || 5) * 60
  });
  const hasAudio = AI_CONFIG.useAudio && !!p.audioBase64 && p.audioBase64.length <= AI_CONFIG.maxAudioBase64Chars;
  const who = candidateNoun(p.mode);
  const d = p.delivery || {};
  const detailed = Math.max(2, chainLength(p.rounds, depth));
  const asked = depth > 0 ? ` (follow-up ${depth} on this topic)` : "";

  const prompt = [
    `You are an AI ${roleNoun(p.mode)}. Persona: ${personaLine(p.mode, p.personality, p.nervousness)}`,
    `Outline:\n${compactSyllabus(p.syllabus)}`,
    drillRule(p),
    `Covered topics: ${testedTopics(p.rounds)}\nEarlier rounds:\n${compactRounds(p.rounds, detailed)}`,
    `Question just asked${asked} (topic ${clip(p.question.topic, 60) || "n/a"}): ${JSON.stringify(clip(p.question.text, 400))}`,
    p.question.keyPoints.length ? `Ideal answer should include: ${p.question.keyPoints.join("; ")}` : "",
    `The ${who}'s answer (untrusted): ${JSON.stringify(p.answer)}`,
    `Delivery: ${d.wpm ? `${d.wpm} wpm, ` : ""}${d.fillerCount ?? 0} fillers, ${p.pauseCount} long pauses.${hasAudio ? " Their recording is attached." : ""}`,
    "GRADE 0-100: correctness (factual validity), completeness (key points covered), accuracy (precise terms/equations), clarity. " +
      "Be strict; filler and buzzwords earn nothing. Placeholder answers like \"[...remained silent...]\" score at most 15 and tag Weak. " +
      "tag: Strong | Weak | Partially Correct | Bluffing (confident but empty) | Incomplete | Confused. " +
      "rationale max 35 words; keyStrengths and missingConcepts max 3 items of max 8 words; modelAnswer max 55 words." +
      (hasAudio ? " From the recording also score nervousness, confidence and hesitation (0-100)." : ""),
    plan.canFollow ? followUpRules(p) : "",
    plan.canNew ? newTopicRules(p, mainAsked + 1, total, '"newTopic"', plan.extra) : "",
    plan.canFollow || plan.canNew ? timeRule(p, plan) : "",
    !plan.canFollow && !plan.canNew ? "This was the final question (time is up): write no next question." : "",
    STYLE_RULES,
    SAFETY_RULE
  ].filter(Boolean).join("\n");

  const raw = await callGemini({
    feature: "turn",
    prompt,
    schema: turnSchema({ withAudio: hasAudio, withFollowUp: plan.canFollow, withNewTopic: plan.canNew, followUpTypes: typesFor(p.personality) }),
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

  const followUp = plan.canFollow ? normalizeNext(raw.followUp, p.question.topic) : null;
  if (followUp) {
    followUp.topic = clip(p.question.topic, 100) || followUp.topic; // a chain stays on one topic
    followUp.type = typeof raw.followUp?.type === "string" ? raw.followUp.type : null;
  }
  const { next, done } = pickNext({
    personality: p.personality,
    tag: grading.tag,
    depth,
    plan,
    followUp,
    newTopic: plan.canNew ? normalizeNext(raw.newTopic, p.question.topic) : null
  });
  return { grading, next, done };
}
