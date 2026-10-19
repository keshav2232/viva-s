/**
 * VivaSim - Answer Evaluation Service
 * Combines server-side Gemini semantic text grading (correctness, accuracy, tags)
 * with client-side lexical-acoustic metrics (speaking rate, hesitation gaps, filler frequencies).
 */

const VALID_TAGS = ["Strong", "Weak", "Partially Correct", "Bluffing", "Incomplete", "Confused"];
const clampScore = (v, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(Math.max(Math.round(n), 0), 100) : fallback;
};

export const AnswerEvaluationService = {
  
  /**
   * Merges the server's grading (content scores, and voice scores when audio was sent) with the
   * browser's own delivery measurements into the metrics object the rest of the app uses.
   * No network here: grading now arrives inside the combined `turn` response.
   */
  buildMetrics(rawGrading, delivery, isHesitationPenalty = false) {
    if (!rawGrading || typeof rawGrading !== "object") throw new Error("Malformed grading payload");

    // Never trust model output shape: clamp every score to 0-100 and whitelist the tag.
    const g = {
      ...rawGrading,
      correctness: clampScore(rawGrading.correctness, 60),
      accuracy: clampScore(rawGrading.accuracy, 60),
      completeness: clampScore(rawGrading.completeness, 60),
      clarity: rawGrading.clarity === undefined ? undefined : clampScore(rawGrading.clarity, 70),
      confidence: rawGrading.confidence === undefined ? undefined : clampScore(rawGrading.confidence, 70),
      nervousness: rawGrading.nervousness === undefined ? undefined : clampScore(rawGrading.nervousness, 30),
      hesitation: rawGrading.hesitation === undefined ? undefined : clampScore(rawGrading.hesitation, 20),
      tag: VALID_TAGS.includes(rawGrading.tag) ? rawGrading.tag : "Partially Correct"
    };

    // Without audio the server returns no voice scores: fall back to the local estimates,
    // nudging confidence by how the content was judged.
    const adjust = g.tag === "Strong" ? 10 : g.tag === "Weak" ? -15 : g.tag === "Bluffing" ? -20 : 0;

    if (isHesitationPenalty) {
      g.correctness = Math.max(Math.round(g.correctness * 0.8), 0);
      g.accuracy = Math.max(Math.round(g.accuracy * 0.8), 0);
      g.tag = "Partially Correct";
    }

    return {
      confidence: g.confidence !== undefined ? g.confidence : Math.min(Math.max(delivery.confidence + adjust, 30), 98),
      clarity: g.clarity !== undefined ? g.clarity : delivery.clarity,
      nervousness: g.nervousness !== undefined ? g.nervousness : delivery.nervousness,
      hesitation: g.hesitation !== undefined ? g.hesitation : delivery.hesitation,
      wpm: delivery.wpm || 120,
      fillerCount: delivery.fillerCount || 0,
      rationale: g.rationale || "Evaluated on factual accuracy, technical completeness and structure.",
      keyStrengths: Array.isArray(g.keyStrengths) ? g.keyStrengths : [],
      missingConcepts: Array.isArray(g.missingConcepts) ? g.missingConcepts : [],
      correctness: g.correctness,
      accuracy: g.accuracy,
      completeness: g.completeness,
      tag: g.tag,
      correctAnswer: g.correctAnswer
    };
  },

  /** Delivery metrics for an answer: local estimates, overridden by the live-tracked ones. */
  buildDelivery(answer, speechDurationMs, pauseCount, liveMetrics) {
    const local = this.calculateLocalDeliveryMetrics(answer, speechDurationMs, pauseCount);
    return liveMetrics ? { ...local, ...liveMetrics } : local;
  },

  /**
   * Computes client-side hesitation and pacing metrics.
   */
  calculateLocalDeliveryMetrics(answerText, speechDurationMs, pauseCount = 0) {
    const textLower = (typeof answerText === "string" ? answerText : "").toLowerCase();
    const words = textLower.split(/\s+/).filter(w => w.length > 0);
    const wordCount = words.length;

    // Hesitation
    const fillers = ["um", "umm", "uhm", "uh", "ah", "ahh", "like", "basically", "actually", "you know", "maybe", "sort of", "kind of"];
    let fillerCount = 0;
    fillers.forEach(f => {
      const matches = textLower.match(new RegExp(`\\b${f}\\b`, 'g'));
      if (matches) fillerCount += matches.length;
    });

    let hesitationScore = Math.min(Math.max((fillerCount * 8) + (pauseCount * 12) + 10, 8), 92);

    // Uncertainty
    const weakTerms = ["i think", "i guess", "not sure", "don't know", "possibly", "probably", "maybe"];
    let weakCount = 0;
    weakTerms.forEach(t => {
      if (textLower.includes(t)) weakCount++;
    });

    // Pacing (WPM)
    const durationMins = (Number(speechDurationMs) || 0) / 1000 / 60;
    const wpm = durationMins > 0 ? Math.round(wordCount / durationMins) : 120;
    
    let wpmDeviation = 0;
    if (wpm < 85) wpmDeviation = (85 - wpm) * 1.5;
    else if (wpm > 175) wpmDeviation = (wpm - 175) * 1.2;

    let nervousnessScore = Math.min(Math.max((weakCount * 15) + wpmDeviation + 15, 10), 90);

    // General density clarity
    let clarityScore = Math.min(Math.max((wordCount > 15 ? 50 : 25) - (weakCount * 8) - (fillerCount * 3) + 40, 20), 98);

    // Base confidence
    let confidenceScore = Math.round(100 - (hesitationScore * 0.4 + nervousnessScore * 0.4 + (100 - clarityScore) * 0.2));
    confidenceScore = Math.min(Math.max(confidenceScore, 35), 98);

    return {
      confidence: confidenceScore,
      clarity: clarityScore,
      nervousness: nervousnessScore,
      hesitation: hesitationScore,
      wpm: wpm,
      fillerCount: fillerCount
    };
  },

  /**
   * Highly responsive fallback metrics in case API key is offline.
   */
  getLocalFallbackMetrics(delivery, answerText, isHesitationPenalty) {
    const isShort = (answerText || "").length < 15;
    let tag = "Partially Correct";
    if (isShort) tag = "Incomplete";

    // Offline we cannot judge correctness, so stay neutral instead of awarding a high grade.
    let correctness = isShort ? 40 : 62;
    let accuracy = isShort ? 40 : 60;

    if (isHesitationPenalty) {
      correctness = Math.max(Math.round(correctness * 0.8), 0);
      accuracy = Math.max(Math.round(accuracy * 0.8), 0);
      tag = "Partially Correct";
    }

    return {
      confidence: delivery.confidence,
      clarity: delivery.clarity,
      nervousness: delivery.nervousness,
      hesitation: delivery.hesitation,
      wpm: delivery.wpm || 120,
      fillerCount: delivery.fillerCount || 0,
      rationale: isShort 
        ? "Response was very brief. Key details and foundational concepts were not fully addressed." 
        : "The AI grader was unavailable, so this round was scored neutrally from delivery metrics only. Content accuracy was not assessed.",
      keyStrengths: [],
      missingConcepts: isShort ? ["Comprehensive explanation", "Precise technical keywords"] : [],
      correctness: correctness,
      accuracy: accuracy,
      completeness: isShort ? 40 : 60,
      tag: tag
    };
  }
};
