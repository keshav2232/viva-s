import { vivaFetch } from "@/utils/apiClient";
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
   * Evaluates the student transcript against asked question and syllabus contexts.
   * @param {object} params - { question, answer, syllabus, speechDurationMs, pauseCount }
   * @returns {Promise<object>} Combined metrics { confidence, clarity, nervousness, hesitation, correctness, accuracy, completeness, tag }
   */
  async evaluateResponse(params) {
    const { question, syllabus, speechDurationMs, liveMetrics, isHesitationPenalty, mode, audioBase64, cacheId } = params;
    const answer = typeof params.answer === "string" ? params.answer : "";
    const pauseCount = Number.isFinite(params.pauseCount) ? params.pauseCount : 0;

    // 1. Calculate local acoustic/delivery metrics (prefer live-tracked metrics)
    const local = this.calculateLocalDeliveryMetrics(answer, speechDurationMs, pauseCount);
    const delivery = liveMetrics ? { ...local, ...liveMetrics } : local;

    try {
      // 2. Call server-side Gemini AI for semantic evaluations
      const response = await vivaFetch({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "evaluate-answer",
          question,
          answer,
          syllabus,
          mode,
          audioBase64,
          cacheId: cacheId || null,
          speechDurationMs,
          pauseCount,
          delivery
        })
      });

      if (!response.ok) throw new Error("Evaluation API request failed");
      const rawGrading = await response.json();
      if (!rawGrading || typeof rawGrading !== "object" || Array.isArray(rawGrading)) throw new Error("Malformed evaluation payload");

      // Never trust model output shape: clamp every score to 0-100 and whitelist the tag.
      const semanticGrading = {
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

      // Adjust dynamic nervousness and confidence based on AI grading results if Gemini didn't return them directly
      let confAdjustment = 0;
      if (semanticGrading.tag === "Strong") confAdjustment = 10;
      else if (semanticGrading.tag === "Weak") confAdjustment = -15;
      else if (semanticGrading.tag === "Bluffing") confAdjustment = -20;

      const finalConfidence = semanticGrading.confidence !== undefined
        ? semanticGrading.confidence
        : Math.min(Math.max(delivery.confidence + confAdjustment, 30), 98);

      const finalClarity = semanticGrading.clarity !== undefined
        ? semanticGrading.clarity
        : delivery.clarity;

      const finalNervousness = semanticGrading.nervousness !== undefined
        ? semanticGrading.nervousness
        : delivery.nervousness;

      const finalHesitation = semanticGrading.hesitation !== undefined
        ? semanticGrading.hesitation
        : delivery.hesitation;

      if (isHesitationPenalty) {
        semanticGrading.correctness = Math.max(Math.round(semanticGrading.correctness * 0.8), 0);
        semanticGrading.accuracy = Math.max(Math.round(semanticGrading.accuracy * 0.8), 0);
        semanticGrading.tag = "Partially Correct";
      }

      return {
        // Combined metrics
        confidence: finalConfidence,
        clarity: finalClarity,
        nervousness: finalNervousness,
        hesitation: finalHesitation,
        wpm: delivery.wpm || 120,
        fillerCount: delivery.fillerCount || 0,
        
        // Gemini Chain-of-Thought & rubric grading outputs
        rationale: semanticGrading.rationale || "Evaluated response based on factual accuracy, technical completeness, and structural fluency.",
        keyStrengths: Array.isArray(semanticGrading.keyStrengths) ? semanticGrading.keyStrengths : [],
        missingConcepts: Array.isArray(semanticGrading.missingConcepts) ? semanticGrading.missingConcepts : [],
        correctness: semanticGrading.correctness,
        accuracy: semanticGrading.accuracy,
        completeness: semanticGrading.completeness,
        tag: semanticGrading.tag,
        correctAnswer: semanticGrading.correctAnswer
      };

    } catch (e) {
      console.warn("AnswerEvaluationService API error. Falling back to clean local calculations:", e);
      return this.getLocalFallbackMetrics(delivery, answer, isHesitationPenalty);
    }
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
