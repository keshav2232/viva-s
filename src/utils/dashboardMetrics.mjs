// Dashboard calculations use persisted session records, never seeded mastery data.
export function validScore(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
}
export function sessionTime(session) {
  const value = session?.createdAt ?? session?.date;
  const time = typeof value === "string" || typeof value === "number" ? new Date(value).getTime() : NaN;
  return Number.isFinite(time) ? time : null;
}
export function buildDashboardMetrics(input) {
  const sessions = (Array.isArray(input) ? input : []).filter(s => s && typeof s === "object" && !Array.isArray(s));
  const ordered = sessions.map((session, index) => ({ session, index })).sort((a, b) => {
    const left = sessionTime(a.session), right = sessionTime(b.session);
    if (left === null && right === null) return a.index - b.index;
    if (left === null) return 1;
    if (right === null) return -1;
    return right - left || a.index - b.index;
  }).map(item => item.session);
  const completed = ordered.filter(s => !s.reportData?.endedEarly);
  const scored = completed.filter(s => validScore(s.score));
  const average = list => list.length ? Math.round(list.reduce((sum, s) => sum + s.score, 0) / list.length) : null;
  const groups = new Map();
  completed.forEach(s => {
    const subject = typeof s.subject === "string" && s.subject.trim() ? s.subject.trim() : "Untitled session";
    const mode = s.mode === "professional" ? "professional" : "academic";
    const key = JSON.stringify([mode, subject]);
    if (!groups.has(key)) groups.set(key, { key, subject, mode, sessions: [] });
    groups.get(key).sessions.push(s);
  });
  const areas = [...groups.values()].map(g => ({ ...g, count: g.sessions.length, average: average(g.sessions.filter(s => validScore(s.score))) })).sort((a, b) => b.count - a.count || a.subject.localeCompare(b.subject));
  const ranked = areas.filter(a => a.average !== null).sort((a,b) => a.average - b.average);
  const focus = ranked.length > 1 ? ranked[0] : areas[0] || null;
  const recent = scored.slice(0, 6).reverse();
  return { ordered, completed, scored, average: average(scored), areas, focus, recent,
    change: recent.length > 1 ? recent.at(-1).score - recent.at(-2).score : null,
    academic: completed.filter(s => s.mode !== "professional").length,
    professional: completed.filter(s => s.mode === "professional").length,
  };
}
