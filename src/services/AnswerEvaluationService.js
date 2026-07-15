/**
 * VivaSim - Answer Evaluation Service
 * Gemini is the single source of truth for ALL metrics.
 * Audio recording is always sent when available (oral mode).
 * Local math is only used for WPM (timing fact, not AI judgment).
 * Offline/API-failure → returns isUngraded:true (never inflated scores).
 */

export const AnswerEvaluationService = {

  /**
   * Evaluates the student answer using Gemini as the sole scoring authority.
   * Audio blob is passed directly to Gemini for acoustic + semantic analysis.
   * @param {object} params - { question, answer, syllabus, speechDurationMs, pauseCount, liveMetrics, isHesitationPenalty, mode, audioBlob }
   * @returns {Promise<object>} Full metrics from Gemini. isUngraded=true if evaluation failed.
   */
  async evaluateResponse(params) {
    const {
      question,
      answer,
      syllabus,
      speechDurationMs,
      pauseCount,
      mode,
      audioBlob    // Blob object (oral) or null (keyboard fallback)
    } = params;

    // WPM is a timing fact — calculate locally from real duration
    const wpm = this.calculateWpm(answer, speechDurationMs);

    // Convert audioBlob to base64 if present
    let audioBase64 = null;
    if (audioBlob && audioBlob.size > 100) {
      try {
        audioBase64 = await this.blobToBase64(audioBlob);
      } catch (encErr) {
        console.warn("AnswerEvaluationService: Failed to encode audio blob:", encErr);
      }
    }

    try {
      const response = await fetch("/api/viva", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "evaluate-answer",
          question,
          answer,
          syllabus,
          mode,
          audioBase64
        })
      });

      if (!response.ok) throw new Error(`Evaluation API returned ${response.status}`);
      const geminiResult = await response.json();

      // Validate that we got real scores back (not a broken response)
      if (geminiResult.correctness === undefined || geminiResult.correctness === null) {
        throw new Error("Gemini returned incomplete evaluation data");
      }

      return {
        // Content scores — entirely from Gemini
        correctness: geminiResult.correctness,
        completeness: geminiResult.completeness,
        accuracy: geminiResult.accuracy,
        tag: geminiResult.tag,
        correctAnswer: geminiResult.correctAnswer || null,
        starSegments: geminiResult.starSegments || null,

        // Delivery scores — from Gemini (audio mode) or null (text mode)
        clarity: geminiResult.clarity ?? null,
        confidence: geminiResult.confidence ?? null,
        nervousness: geminiResult.nervousness ?? null,
        hesitation: geminiResult.hesitation ?? null,

        // Timing fact — calculated locally from real duration
        wpm: wpm,
        fillerCount: this.countFillers(answer),

        // Metadata
        gradingSource: geminiResult.gradingSource || (audioBase64 ? "audio+text" : "text-only"),
        isUngraded: false
      };

    } catch (e) {
      console.warn("AnswerEvaluationService: Gemini evaluation failed. Marking round as Ungraded:", e.message);
      // Honest fallback — never inflate scores
      return this.getUngradedMetrics(answer, speechDurationMs);
    }
  },

  /**
   * Returned when Gemini evaluation fails.
   * Marks the round as ungraded rather than assigning fake high scores.
   */
  getUngradedMetrics(answerText, speechDurationMs) {
    const isSilent = !answerText || answerText.length < 10
      || answerText.includes("remained silent")
      || answerText.includes("no substantive answer");

    return {
      correctness: isSilent ? 0 : null,
      completeness: isSilent ? 0 : null,
      accuracy: isSilent ? 0 : null,
      clarity: null,
      confidence: null,
      nervousness: null,
      hesitation: null,
      wpm: this.calculateWpm(answerText, speechDurationMs),
      fillerCount: this.countFillers(answerText),
      tag: isSilent ? "Weak" : "Ungraded",
      correctAnswer: null,
      starSegments: null,
      gradingSource: "offline",
      isUngraded: true
    };
  },

  /**
   * Calculates WPM from real timing data. Never guesses a duration.
   * Returns null if duration is unknown (avoids the 24s assumption bug).
   */
  calculateWpm(answerText, speechDurationMs) {
    if (!speechDurationMs || speechDurationMs < 1000) return null;
    const words = (answerText || "").split(/\s+/).filter(w => w.length > 0);
    const durationMins = speechDurationMs / 1000 / 60;
    return durationMins > 0 ? Math.round(words.length / durationMins) : null;
  },

  /**
   * Counts lexical filler words in the transcript.
   * Used for the filler distribution chart in Results.jsx.
   * "actually" and "like" removed — too many false positives in technical speech.
   */
  countFillers(answerText) {
    const text = (answerText || "").toLowerCase();
    const fillers = ["um", "umm", "uhm", "uh", "ah", "ahh", "basically", "you know", "maybe", "sort of", "kind of"];
    let count = 0;
    fillers.forEach(f => {
      const matches = text.match(new RegExp(`\\b${f}\\b`, "g"));
      if (matches) count += matches.length;
    });
    return count;
  },

  /**
   * Converts a Blob to a base64 string.
   */
  blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
};
