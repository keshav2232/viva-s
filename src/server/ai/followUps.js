/**
 * Follow-up policy: WHAT the examiner does after an answer is decided here, in code, from the grade
 * tag x professor x chain depth. The model only writes the wording: each turn asks it for a
 * follow-up candidate and/or a new-topic candidate, and pickNext() chooses between them.
 *
 * A "chain" is one main question plus the follow-ups on it. depth 0 = main question, 1.. = follow-ups.
 * Follow-ups do not use up the session's main-question count; each professor has a depth limit.
 */

export const MAX_DEPTH = { friendly: 1, strict: 2, brutal: 2, terror: 3 };

/** Plain-language meaning of each follow-up type (sent to the model only for the types in use). */
export const FOLLOW_UP_TYPES = {
  apply: "ask them to apply the idea to a concrete real example",
  clarify: "ask for the specific concept they missed, naming it",
  precision: "demand the exact definition, equation, units or conditions for what they said",
  simplify: "ask a simpler, more basic question that rebuilds the idea step by step",
  challenge: "challenge their claim, even if correct (\"Are you sure? What if...\"), to test conviction",
  counter_example: "give a counter-example or edge case that tests whether their answer really holds",
  deepen: "drill one level deeper into the exact gap in their answer",
  expose: "expose a bluff: ask for one concrete example, number or derivation that proves they understand"
};

// kind "follow_up" | "new_topic". once = only as the first follow-up of a chain (depth 0 -> 1).
const F = (type, once = false) => ({ kind: "follow_up", type, once });
const NEW = { kind: "new_topic" };

export const POLICY = {
  friendly: {
    Strong: NEW,
    "Partially Correct": F("clarify"),
    Incomplete: F("clarify"),
    Weak: F("simplify"),
    Confused: F("simplify"),
    Bluffing: F("apply")
  },
  strict: {
    Strong: F("precision", true),
    "Partially Correct": F("clarify"),
    Incomplete: F("clarify"),
    Weak: F("simplify"),
    Confused: F("simplify"),
    Bluffing: F("precision")
  },
  brutal: {
    Strong: F("challenge", true),
    "Partially Correct": F("deepen"),
    Incomplete: F("deepen"),
    Weak: NEW, // moves on with a cutting remark
    Confused: NEW,
    Bluffing: F("expose")
  },
  terror: {
    Strong: F("counter_example"),
    "Partially Correct": F("deepen"),
    Incomplete: F("deepen"),
    Weak: F("simplify"),
    Confused: F("simplify"),
    Bluffing: F("expose")
  }
};

const personaKey = (personality) => (POLICY[personality] ? personality : "friendly");

/** What the policy wants for this tag at this depth. */
export function wanted(personality, tag, depth) {
  const rule = POLICY[personaKey(personality)][tag] || NEW;
  if (rule.kind === "follow_up" && rule.once && depth > 0) return NEW;
  return rule;
}

// Time budget. The session runs until the clock is nearly out, not until a fixed question count:
// `total` (from the duration) is only the number of main topics we plan to cover.
export const MIN_END_SEC = 35; // never start a question with less than this left
const END_FRACTION = 0.45; // ...or with less than 45% of an average question's time left (a short
// final question is asked; if the clock still runs out mid-answer, that answer is graded anyway)
const MAX_ANSWERS = 40; // absolute safety cap per session

/** Average seconds one question has taken so far (intro included), or null when unknown. */
export function averageTurnSec({ durationSec, timeLeftSec, answered }) {
  if (!Number.isFinite(timeLeftSec) || !durationSec || !answered) return null;
  return Math.max((durationSec - timeLeftSec) / answered, 20);
}

/**
 * Which candidates the model should write for this turn.
 * @param {{personality:string, depth:number, mainAsked:number, total:number, answered:number,
 *          timeLeftSec?:number, durationSec?:number}} s
 * @returns {{canFollow:boolean, canNew:boolean, extra:boolean, avgSec:number|null}}
 *   extra = the planned topics are all covered and time remains (new questions are bonus ones).
 */
export function planTurn(s) {
  const maxDepth = MAX_DEPTH[personaKey(s.personality)];
  const stop = { canFollow: false, canNew: false, extra: false, avgSec: null };
  if (s.answered >= MAX_ANSWERS) return stop;

  const avgSec = averageTurnSec(s);
  if (avgSec === null) {
    // Time unknown (older client): fall back to the planned count.
    const canFollow = s.depth < maxDepth;
    const canNew = s.mainAsked < s.total;
    if (s.answered >= s.total * (maxDepth + 1) || (!canFollow && !canNew)) return stop;
    return { canFollow, canNew, extra: false, avgSec: null };
  }

  // Not enough time for another question: end the session.
  const endAt = Math.max(MIN_END_SEC, avgSec * END_FRACTION);
  if (s.timeLeftSec < endAt) return stop;

  // Spread follow-ups fairly: the current topic gets its fair share of the time that is left
  // (counting what it has already used), so early topics cannot eat the time of later planned ones.
  // Once every planned topic is covered, all remaining time is available for digging deeper.
  const topicsLeft = Math.max(s.total - s.mainAsked, 0);
  const usedOnTopic = (s.depth + 1) * avgSec;
  const fairShare = (s.timeLeftSec + usedOnTopic - endAt) / (topicsLeft + 1);
  const roomForFollowUp = usedOnTopic + avgSec <= fairShare * 1.15;
  return { canFollow: s.depth < maxDepth && roomForFollowUp, canNew: true, extra: topicsLeft === 0, avgSec };
}

/** Follow-up types this professor can use (the model must label its follow-up with one of them). */
export function typesFor(personality) {
  const rows = Object.values(POLICY[personaKey(personality)]);
  return [...new Set([...rows.filter((r) => r.kind === "follow_up").map((r) => r.type), "deepen"])];
}

/** The tag -> type lines for this professor, for the follow-up candidate's instructions. */
export function followUpGuide(personality) {
  const rows = POLICY[personaKey(personality)];
  const types = new Set();
  const lines = Object.entries(rows)
    .filter(([, r]) => r.kind === "follow_up")
    .map(([tag, r]) => { types.add(r.type); return `${tag} -> ${r.type}`; });
  const defs = [...types].map((t) => `${t} = ${FOLLOW_UP_TYPES[t]}`).join("; ");
  return `Pick its type from YOUR tag: ${lines.join(", ")} (any other tag -> deepen). Types: ${defs}.`;
}

/**
 * Choose the next question from the candidates the model wrote.
 * @returns {{next: object|null, done: boolean}}
 */
export function pickNext({ personality, tag, depth, plan, followUp, newTopic }) {
  const want = wanted(personality, tag, depth);
  if (want.kind === "follow_up" && plan.canFollow && followUp) {
    // Label with the type the model actually wrote (if it is one this professor uses), so the
    // on-screen label always matches the wording; the follow-up-or-not decision stays with the policy.
    const type = typesFor(personality).includes(followUp.type) ? followUp.type : want.type;
    return { next: { ...followUp, kind: "follow_up", followUpType: type, depth: depth + 1 }, done: false };
  }
  if (plan.canNew && newTopic) {
    return { next: { ...newTopic, kind: "new_topic", followUpType: null, depth: 0 }, done: false };
  }
  // Nothing allowed is left (time or topics used up and no follow-up wanted or possible): end.
  return { next: null, done: true };
}
