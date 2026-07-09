/**
 * VivaSim - Hindsight Engine Service
 * Post-session retrospective analysis that re-evaluates the entire exam
 * with full context of all questions and answers together.
 * 
 * Runs AFTER the exam ends — zero impact on the live Q&A loop.
 * Gracefully degrades: if API fails, original per-round scores remain untouched.
 */

export const HindsightEngine = {

  /**
   * Performs retrospective analysis on a completed session report.
   * Sends all Q&A rounds to Gemini in a single call for cross-question pattern detection.
   * 
   * @param {object} params - Full session data
   * @param {string} params.subjectName - The exam topic
   * @param {string[]} params.askedQuestions - All question texts
   * @param {object[]} params.askedQuestionsObjects - Full question objects with topic, difficulty
   * @param {string[]} params.answerTranscripts - All student answer texts
   * @param {object[]} params.detectedEmotions - Per-round metrics (correctness, confidence, etc.)
   * @param {string} params.personality - Examiner personality used
   * @param {string} params.mode - "academic" or "professional"
   * @returns {Promise<object|null>} Hindsight analysis or null if unavailable
   */
  async analyze(params) {
    const {
      subjectName,
      askedQuestions,
      askedQuestionsObjects,
      answerTranscripts,
      detectedEmotions,
      personality,
      mode
    } = params;

    // Guard: need at least 2 rounds for cross-question analysis to be meaningful
    if (!askedQuestions || askedQuestions.length < 2 || !answerTranscripts || answerTranscripts.length < 2) {
      console.log("HindsightEngine: Insufficient rounds for retrospective analysis, skipping.");
      return null;
    }

    try {
      const response = await fetch("/api/viva", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "hindsight-analyze",
          subjectName,
          askedQuestions,
          askedQuestionsObjects,
          answerTranscripts,
          detectedEmotions,
          personality,
          mode
        })
      });

      if (!response.ok) {
        console.warn("HindsightEngine: API returned non-OK status, falling back to local analysis.");
        return this.getLocalFallback(askedQuestions, answerTranscripts, detectedEmotions, mode);
      }

      const hindsightData = await response.json();

      // Validate essential fields exist
      if (!hindsightData || !hindsightData.sessionNarrative) {
        console.warn("HindsightEngine: API returned incomplete data, using local fallback.");
        return this.getLocalFallback(askedQuestions, answerTranscripts, detectedEmotions, mode);
      }

      return hindsightData;

    } catch (err) {
      console.warn("HindsightEngine: Network/parse error, using local fallback:", err);
      return this.getLocalFallback(askedQuestions, answerTranscripts, detectedEmotions, mode);
    }
  },

  /**
   * Local rule-based fallback for hindsight analysis when API is unavailable.
   * Uses heuristic cross-question pattern detection from the per-round metrics.
   */
  getLocalFallback(askedQuestions, answerTranscripts, detectedEmotions, mode) {
    const isProfessional = mode === "professional";
    const totalRounds = detectedEmotions.length;
    if (totalRounds === 0) return null;

    // 1. Detect confidence trajectory pattern
    const confidenceValues = detectedEmotions.map(e => e.confidence || 75);
    const firstHalf = confidenceValues.slice(0, Math.ceil(totalRounds / 2));
    const secondHalf = confidenceValues.slice(Math.ceil(totalRounds / 2));
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    let trajectoryPattern = "steady";
    let trajectoryDescription = "";
    if (firstAvg - secondAvg > 12) {
      trajectoryPattern = "declining";
      trajectoryDescription = isProfessional
        ? "Your confidence declined noticeably as the interview progressed, suggesting initial composure gave way under deeper technical probing."
        : "Your confidence declined noticeably as the exam progressed, suggesting initial composure gave way under deeper academic probing.";
    } else if (secondAvg - firstAvg > 12) {
      trajectoryPattern = "ascending";
      trajectoryDescription = isProfessional
        ? "Your confidence grew as the session progressed — you warmed up effectively and delivered stronger answers in later rounds."
        : "Your confidence grew as the exam progressed — you warmed up effectively and delivered stronger answers in later rounds.";
    } else {
      trajectoryDescription = isProfessional
        ? "Your confidence remained stable throughout the interview, indicating consistent composure under professional questioning."
        : "Your confidence remained stable throughout the exam, indicating consistent composure under examiner pressure.";
    }

    // 2. Detect contradiction/inconsistency patterns
    const contradictions = [];
    const correctnessValues = detectedEmotions.map(e => e.correctness || 70);
    
    for (let i = 0; i < totalRounds; i++) {
      for (let j = i + 1; j < totalRounds; j++) {
        // If a strong answer was followed later by a weak answer on related content,
        // that's a potential inconsistency flag
        if (correctnessValues[i] >= 80 && correctnessValues[j] < 55) {
          const topicI = askedQuestionsObjects?.[i]?.topic || `Round ${i + 1}`;
          const topicJ = askedQuestionsObjects?.[j]?.topic || `Round ${j + 1}`;
          contradictions.push({
            rounds: [i + 1, j + 1],
            description: isProfessional
              ? `Strong performance on "${topicI}" (${correctnessValues[i]}%) contrasted with weak response on "${topicJ}" (${correctnessValues[j]}%), suggesting knowledge gaps emerged under deeper probing.`
              : `Strong answer on "${topicI}" (${correctnessValues[i]}%) contrasted with weak response on "${topicJ}" (${correctnessValues[j]}%), suggesting surface-level understanding that broke down under deeper examination.`
          });
        }
      }
    }

    // 3. Detect bluffing patterns (high confidence + low accuracy across multiple rounds)
    const bluffingRounds = [];
    detectedEmotions.forEach((e, idx) => {
      if ((e.confidence || 75) > 70 && (e.correctness || 70) < 55) {
        bluffingRounds.push(idx + 1);
      }
    });

    let bluffingWarning = null;
    if (bluffingRounds.length >= 2) {
      bluffingWarning = isProfessional
        ? `Detected a persistent pattern of high verbal confidence paired with low technical accuracy in rounds ${bluffingRounds.join(" and ")}. This indicates potential over-selling of competence without substantive depth.`
        : `Detected a persistent pattern of high verbal confidence paired with low conceptual accuracy in rounds ${bluffingRounds.join(" and ")}. This indicates potential memorized responses without genuine understanding.`;
    }

    // 4. Generate session narrative arc
    const avgCorrectness = correctnessValues.reduce((a, b) => a + b, 0) / totalRounds;
    let sessionNarrative = "";
    
    if (avgCorrectness >= 78) {
      sessionNarrative = isProfessional
        ? `Overall, a strong interview performance with consistent technical depth. ${trajectoryDescription}`
        : `Overall, a strong exam performance with consistent conceptual clarity. ${trajectoryDescription}`;
    } else if (avgCorrectness >= 60) {
      sessionNarrative = isProfessional
        ? `A moderate interview showing competence in core areas but gaps in advanced technical scenarios. ${trajectoryDescription}`
        : `A moderate exam showing understanding of fundamentals but gaps in advanced conceptual areas. ${trajectoryDescription}`;
    } else {
      sessionNarrative = isProfessional
        ? `The interview revealed significant technical gaps that need focused preparation. ${trajectoryDescription}`
        : `The exam revealed significant conceptual gaps requiring focused revision. ${trajectoryDescription}`;
    }

    // 5. Identify strongest and weakest rounds with evidence
    let strongestRound = null;
    let weakestRound = null;
    let maxCorrectness = -1;
    let minCorrectness = 101;

    detectedEmotions.forEach((e, idx) => {
      const c = e.correctness || 70;
      if (c > maxCorrectness) {
        maxCorrectness = c;
        strongestRound = {
          round: idx + 1,
          topic: askedQuestionsObjects?.[idx]?.topic || `Round ${idx + 1}`,
          score: c,
          evidence: isProfessional
            ? `Demonstrated strongest technical command (${c}% correctness) with clear system design trade-offs.`
            : `Demonstrated strongest conceptual grasp (${c}% correctness) with clear academic terminology.`
        };
      }
      if (c < minCorrectness) {
        minCorrectness = c;
        weakestRound = {
          round: idx + 1,
          topic: askedQuestionsObjects?.[idx]?.topic || `Round ${idx + 1}`,
          score: c,
          evidence: isProfessional
            ? `Showed weakest response (${c}% correctness) — consider reviewing fundamental system patterns.`
            : `Showed weakest response (${c}% correctness) — consider revising core definitions and boundary conditions.`
        };
      }
    });

    return {
      sessionNarrative,
      trajectoryPattern,
      trajectoryDescription,
      contradictions,
      bluffingWarning,
      strongestRound,
      weakestRound,
      adjustedScores: null, // Local fallback doesn't adjust scores
      isLocalFallback: true
    };
  }
};
