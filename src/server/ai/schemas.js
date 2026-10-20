/**
 * Gemini responseSchema definitions. With a schema the model is *forced* to return this shape,
 * so prompts no longer need to spell out example JSON (saves input tokens and removes parse errors).
 */
const S = { type: "STRING" };
const N = { type: "INTEGER" };
const list = (items) => ({ type: "ARRAY", items });

const TAGS = ["Strong", "Weak", "Partially Correct", "Bluffing", "Incomplete", "Confused"];

export const nextQuestionSchema = {
  type: "OBJECT",
  properties: {
    text: S,
    speech: S,
    topic: S,
    difficulty: { type: "STRING", enum: ["Low", "Medium", "High"] },
    keyPoints: list(S)
  },
  required: ["text", "speech", "topic", "difficulty", "keyPoints"]
};

export const gradingProperties = (withAudio) => ({
  correctness: N, completeness: N, accuracy: N, clarity: N,
  tag: { type: "STRING", enum: TAGS },
  rationale: S,
  keyStrengths: list(S),
  missingConcepts: list(S),
  modelAnswer: S,
  ...(withAudio ? { nervousness: N, confidence: N, hesitation: N } : {})
});

/**
 * One turn = the grade, then up to two candidate next questions (a follow-up on this answer and a
 * new topic). Code picks one from the tag (see followUps.js). Grading is generated first so the
 * candidates can build on it.
 */
const followUpSchema = (types) => ({
  ...nextQuestionSchema,
  properties: { ...nextQuestionSchema.properties, type: { type: "STRING", enum: types } },
  required: [...nextQuestionSchema.required, "type"]
});

export const turnSchema = ({ withAudio, withFollowUp, withNewTopic, followUpTypes = ["deepen"] }) => ({
  type: "OBJECT",
  properties: {
    grading: {
      type: "OBJECT",
      properties: gradingProperties(withAudio),
      required: ["correctness", "completeness", "accuracy", "clarity", "tag", "rationale", "keyStrengths", "missingConcepts", "modelAnswer", ...(withAudio ? ["nervousness", "confidence", "hesitation"] : [])]
    },
    ...(withFollowUp ? { followUp: followUpSchema(followUpTypes) } : {}),
    ...(withNewTopic ? { newTopic: nextQuestionSchema } : {})
  },
  propertyOrdering: ["grading", ...(withFollowUp ? ["followUp"] : []), ...(withNewTopic ? ["newTopic"] : [])],
  required: ["grading", ...(withFollowUp ? ["followUp"] : []), ...(withNewTopic ? ["newTopic"] : [])]
});

export const hintSchema = { type: "OBJECT", properties: { hint: S }, required: ["hint"] };
export const subQuestionSchema = { type: "OBJECT", properties: { question: S }, required: ["question"] };

export const syllabusSchema = {
  type: "OBJECT",
  properties: {
    topic: S,
    units: list({ type: "OBJECT", properties: { name: S, topics: list(S) }, required: ["name", "topics"] })
  },
  required: ["topic", "units"]
};

export const flashcardsSchema = list({
  type: "OBJECT",
  properties: { question: S, shortAnswer: S },
  required: ["question", "shortAnswer"]
});

export const hindsightSchema = {
  type: "OBJECT",
  properties: {
    sessionNarrative: S,
    trajectoryPattern: { type: "STRING", enum: ["ascending", "declining", "steady"] },
    trajectoryDescription: S,
    contradictions: list({ type: "OBJECT", properties: { rounds: list(N), description: S }, required: ["rounds", "description"] }),
    bluffingWarning: { type: "STRING", nullable: true },
    strongestRound: { type: "OBJECT", properties: { round: N, topic: S, score: N, evidence: S }, required: ["round", "topic", "evidence"] },
    weakestRound: { type: "OBJECT", properties: { round: N, topic: S, score: N, evidence: S }, required: ["round", "topic", "evidence"] },
    recommendations: list(S)
  },
  required: ["sessionNarrative", "trajectoryPattern", "trajectoryDescription", "contradictions", "strongestRound", "weakestRound", "recommendations"]
};
