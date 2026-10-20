/**
 * Client side of the live-viva loop. One request per answered question returns BOTH the grading
 * and the next question (see src/server/ai/features/turn.js), so the candidate waits for a single
 * round-trip instead of grade -> pause -> generate.
 */
import { vivaFetch } from "@/utils/apiClient";
import { AnswerEvaluationService } from "@/services/AnswerEvaluationService";
import { QuestionGraphEngine } from "@/services/QuestionGraphEngine";
import { getQuestionCountForDuration } from "@/utils/pacing";

export const TurnService = {
  /**
   * @param {object} p
   * @param {object} p.config            session config (syllabusStructure, personality, mode, duration, drill flags)
   * @param {object} p.question          the question being answered { text, topic, keyPoints }
   * @param {string} p.answer            transcript
   * @param {Array}  p.rounds            compact earlier rounds (SessionContextManager.getRounds)
   * @param {string|null} p.audioBase64  recording, if available
   * @param {number} p.durationMs        speaking time
   * @param {number} p.pauseCount        long pauses
   * @param {object} p.liveMetrics       live delivery estimates from the sidebar
   * @param {number} p.nervousness       latest nervousness (adapts examiner tone)
   * @param {boolean} p.hasPenalty       examiner interrupted this round
   * @param {number} p.timeLeftSec       seconds left on the session clock (the session runs on time)
   * @returns {Promise<{metrics: object, next: object|null, done: boolean, source: "ai"|"offline"}>}
   *   next = a follow-up on this answer (kind "follow_up") or a new main question ("new_topic");
   *   done = the session has no further questions. The server decides both (server/ai/followUps.js).
   */
  async submitTurn(p) {
    const delivery = AnswerEvaluationService.buildDelivery(p.answer, p.durationMs, p.pauseCount, p.liveMetrics);

    try {
      const response = await vivaFetch({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "turn",
          syllabus: p.config.syllabusStructure,
          personality: p.config.personality,
          mode: p.config.mode,
          duration: p.config.duration,
          isTargetDrill: p.config.isTargetDrill || false,
          targetSubtopic: p.config.targetSubtopic || null,
          question: { text: p.question.text, topic: p.question.topic, keyPoints: p.question.keyPoints || [], depth: p.question.depth || 0 },
          answer: p.answer,
          rounds: p.rounds,
          audioBase64: p.audioBase64 || null,
          pauseCount: p.pauseCount,
          delivery: { wpm: delivery.wpm, fillerCount: delivery.fillerCount },
          nervousness: p.nervousness || 0,
          timeLeftSec: Number.isFinite(p.timeLeftSec) ? p.timeLeftSec : undefined
        })
      });
      if (!response.ok) throw new Error(`Turn request failed (${response.status})`);
      const data = await response.json();

      const metrics = AnswerEvaluationService.buildMetrics(data.grading, delivery, p.hasPenalty);
      if (data.offline) {
        metrics.rationale = `${metrics.rationale} (Offline estimate — the AI grader was unavailable.)`;
      }
      const done = !!data.done;
      const next = !done && data.next && data.next.text ? data.next : null;
      return { metrics, next, done, source: data.offline ? "offline" : "ai" };
    } catch (err) {
      console.warn("TurnService: server unreachable, using local grading + question bank:", err);
      const metrics = AnswerEvaluationService.getLocalFallbackMetrics(delivery, p.answer, p.hasPenalty);
      // No follow-ups without the server: next main question until they are used up.
      const depth = p.question.depth || 0;
      const mainAsked = p.rounds.filter((r) => !(r.depth > 0)).length + (depth === 0 ? 1 : 0);
      // Keep going while there is time for another question (35 s, as on the server).
      const done = Number.isFinite(p.timeLeftSec)
        ? p.timeLeftSec < 35
        : mainAsked >= getQuestionCountForDuration(p.config.duration);
      const next = done
        ? null
        : { ...QuestionGraphEngine.getRuleBasedOfflineFallback(mainAsked + 1, p.config.personality, p.question.topic, p.config.syllabusStructure), kind: "new_topic", depth: 0 };
      return { metrics, next, done, source: "offline" };
    }
  }
};
