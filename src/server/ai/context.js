/**
 * Context compaction. Prompts get the *minimum* the model needs: a plain-text outline instead of
 * pretty JSON, and short per-round lines instead of full transcripts. This is the main source of
 * input-token savings versus the old design (which re-sent the whole syllabus + every answer
 * several times per question, plus a padded cache).
 */
export const clip = (text, max) => {
  const t = typeof text === "string" ? text.replace(/\s+/g, " ").trim() : "";
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
};

const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);

export function normalizeSyllabus(s) {
  if (!isObj(s)) return { topic: "General Practice", units: [] };
  const units = (Array.isArray(s.units) ? s.units : []).slice(0, 8).map((u) => ({
    name: clip(u?.name, 100),
    topics: (Array.isArray(u?.topics) ? u.topics : []).slice(0, 8).map((t) => clip(t, 100)).filter(Boolean)
  })).filter((u) => u.name || u.topics.length);
  return { topic: clip(s.topic, 120) || "General Practice", units };
}

/** "Thermodynamics\n- Unit 1: Laws: first law; entropy; …" (about 3-5x smaller than JSON.stringify). */
export function compactSyllabus(syllabus) {
  const s = normalizeSyllabus(syllabus);
  const body = s.units.map((u) => `- ${u.name}: ${u.topics.join("; ")}`).join("\n");
  return clip(`${s.topic}\n${body}`.trim(), 1800).replace(/…$/, "");
}

/**
 * Rolling history: only the last `detailed` rounds include answer text (clipped); older rounds are
 * one terse line of topic/tag/score. Keeps prompt size flat no matter how long the session runs.
 */
export function compactRounds(rounds, detailed = 2) {
  const list = Array.isArray(rounds) ? rounds : [];
  if (!list.length) return "none yet";
  return list.map((r, i) => {
    const label = r.depth > 0 ? ` (follow-up ${r.depth})` : "";
    const head = `${i + 1}. ${clip(r.topic, 60) || "topic"}${label} [${r.tag || "?"} ${Number.isFinite(r.score) ? r.score : "?"}]`;
    if (i < list.length - detailed) return head;
    return `${head} Q: ${clip(r.q, 110)} A: ${clip(r.a, 200)}`;
  }).join("\n");
}

/**
 * Number of trailing rounds that belong to the chain the current question continues. When the
 * current question is a follow-up, its whole chain (main question + earlier follow-ups) must be
 * visible in full, not just the last two rounds.
 */
export function chainLength(rounds, currentDepth) {
  const list = Array.isArray(rounds) ? rounds : [];
  if (!(currentDepth > 0)) return 0;
  let n = 0;
  for (let i = list.length - 1; i >= 0; i--) {
    n++;
    if (!(list[i].depth > 0)) break; // reached the chain's main question
  }
  return n;
}

export const testedTopics = (rounds) =>
  [...new Set((Array.isArray(rounds) ? rounds : []).map((r) => clip(r.topic, 60)).filter(Boolean))].join("; ") || "none";
