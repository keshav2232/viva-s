/**
 * Single source of truth for the headline session score, shared by the results
 * screen and the saved session history so both always show the same number.
 */
const num = (v, fallback) => (Number.isFinite(v) ? v : fallback);

export function computeOverallScore(detectedEmotions, endedEarly = false) {
  const rounds = Array.isArray(detectedEmotions) ? detectedEmotions : [];
  if (rounds.length === 0) return 0;

  const avg = (pick) => rounds.reduce((sum, e) => sum + pick(e || {}), 0) / rounds.length;
  const correctness = avg((e) => num(e.correctness, 80));
  const confidence = avg((e) => num(e.confidence, 80));
  const clarity = avg((e) => num(e.clarity, 80));
  const depth = avg((e) => num(e.completeness, 75));
  const pressure = avg((e) => 100 - num(e.nervousness, 20));

  let score = Math.round(correctness * 0.35 + confidence * 0.2 + clarity * 0.15 + depth * 0.2 + pressure * 0.1);
  score = Math.min(Math.max(score, 40), 99);
  return endedEarly ? Math.round(score * 0.6) : score;
}

/**
 * Dashboard headline stats derived from saved sessions. Used by both guest (local) and
 * signed-in (cloud) paths so the same history always yields the same numbers.
 * `avgConfidence` keeps its historical field name but is the mean session score.
 */
export function computeSessionStats(sessions) {
  const list = (Array.isArray(sessions) ? sessions : []).filter(
    (s) => s && typeof s.score === "number" && Number.isFinite(s.score)
  );
  if (list.length === 0) {
    return { totalVivas: 0, avgConfidence: 0, strongestSubject: "None yet", weakestSubject: "None yet" };
  }

  const bySubject = new Map();
  list.forEach((s) => {
    const name = (typeof s.subject === "string" && s.subject.trim()) || "Untitled session";
    const entry = bySubject.get(name) || { total: 0, count: 0 };
    entry.total += s.score;
    entry.count += 1;
    bySubject.set(name, entry);
  });
  const ranked = [...bySubject.entries()]
    .map(([name, v]) => ({ name, avg: v.total / v.count }))
    .sort((a, b) => b.avg - a.avg || a.name.localeCompare(b.name));

  return {
    totalVivas: list.length,
    avgConfidence: Math.round(list.reduce((sum, s) => sum + s.score, 0) / list.length),
    strongestSubject: ranked[0].name,
    weakestSubject: ranked[ranked.length - 1].name
  };
}
