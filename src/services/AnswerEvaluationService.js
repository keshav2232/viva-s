/**
 * VivaSim - Answer Evaluation Service
 * Combines server-side Gemini semantic text grading (correctness, accuracy, tags)
 * with client-side lexical-acoustic metrics (speaking rate, hesitation gaps, filler frequencies).
 */

export const AnswerEvaluationService = {
  
  /**
   * Evaluates the student transcript against asked question and syllabus contexts.
   * @param {object} params - { question, answer, syllabus, speechDurationMs, pauseCount }
   * @returns {Promise<object>} Combined metrics { confidence, clarity, nervousness, hesitation, correctness, accuracy, completeness, tag }
   */
  async evaluateResponse(params) {
    const { question, answer, syllabus, speechDurationMs, pauseCount, liveMetrics } = params;

    // 1. Calculate local acoustic/delivery metrics (prefer live-tracked metrics)
    const delivery = liveMetrics || this.calculateLocalDeliveryMetrics(answer, speechDurationMs, pauseCount);

    try {
      // 2. Call server-side Gemini AI for semantic evaluations
      const response = await fetch("/api/viva", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "evaluate-answer",
          question,
          answer,
          syllabus
        })
      });

      if (!response.ok) throw new Error("Evaluation API request failed");
      const semanticGrading = await response.json();

      // Adjust dynamic nervousness and confidence based on AI grading results
      let confAdjustment = 0;
      if (semanticGrading.tag === "Strong") confAdjustment = 10;
      else if (semanticGrading.tag === "Weak") confAdjustment = -15;
      else if (semanticGrading.tag === "Bluffing") confAdjustment = -20;

      const finalConfidence = Math.min(Math.max(delivery.confidence + confAdjustment, 30), 98);
      const finalClarity = Math.round((delivery.clarity * 0.4) + (semanticGrading.clarity * 0.6));

      return {
        // Combined metrics
        confidence: finalConfidence,
        clarity: finalClarity,
        nervousness: delivery.nervousness,
        hesitation: delivery.hesitation,
        wpm: delivery.wpm || 120,
        fillerCount: delivery.fillerCount || 0,
        
        // Gemini grading outputs
        correctness: semanticGrading.correctness,
        accuracy: semanticGrading.accuracy,
        completeness: semanticGrading.completeness,
        tag: semanticGrading.tag
      };

    } catch (e) {
      console.warn("AnswerEvaluationService API error. Falling back to clean local calculations:", e);
      return this.getLocalFallbackMetrics(delivery, answer);
    }
  },

  /**
   * Computes client-side hesitation and pacing metrics.
   */
  calculateLocalDeliveryMetrics(answerText, speechDurationMs, pauseCount) {
    const textLower = answerText.toLowerCase();
    const words = textLower.split(/\s+/).filter(w => w.length > 0);
    const wordCount = words.length;

    // Hesitation
    const fillers = ["umm", "uhm", "uh", "like", "basically", "actually", "maybe", "sort of", "kind of"];
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
    const durationMins = speechDurationMs / 1000 / 60;
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
  getLocalFallbackMetrics(delivery, answerText) {
    const isShort = answerText.length < 15;
    let tag = "Partially Correct";
    if (isShort) tag = "Incomplete";
    else if (delivery.confidence >= 80) tag = "Strong";
    else if (delivery.confidence < 60) tag = "Weak";

    return {
      confidence: delivery.confidence,
      clarity: delivery.clarity,
      nervousness: delivery.nervousness,
      hesitation: delivery.hesitation,
      wpm: delivery.wpm || 120,
      fillerCount: delivery.fillerCount || 0,
      correctness: isShort ? 55 : 82,
      accuracy: isShort ? 50 : 80,
      completeness: isShort ? 45 : 78,
      tag: tag
    };
  }
};
