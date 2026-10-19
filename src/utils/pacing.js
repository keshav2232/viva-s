/** Number of questions for a session length (~2 minutes per question incl. feedback), kept in sync client + server. */
export function getQuestionCountForDuration(duration) {
  const mins = parseInt(duration, 10) || 5;
  return Math.min(Math.max(Math.round(mins / 2), 3), 12);
}
