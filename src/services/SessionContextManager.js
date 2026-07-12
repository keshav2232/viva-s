/**
 * VivaSim - Session Context Manager Service
 * Manages in-memory context: tracking asked questions, answer transcripts,
 * active evaluation histories, and compiling weaknesses report parameters.
 *
 * NOTE: recordRoundPending() and updateRoundMetrics() have been removed.
 * The system now uses a single atomic evaluation call, so a round is only
 * recorded once with real data (or with isUngraded:true on failure).
 */

export const SessionContextManager = {
  askedQuestions: [],
  askedQuestionsObjects: [],
  answerTranscripts: [],
  detectedEmotions: [],
  weakConcepts: [],
  confidenceEvolution: [],
  askedTopics: [],

  /**
   * Resets the active session parameters context.
   */
  reset() {
    this.askedQuestions = [];
    this.askedQuestionsObjects = [];
    this.answerTranscripts = [];
    this.detectedEmotions = [];
    this.weakConcepts = [];
    this.confidenceEvolution = [];
    this.askedTopics = [];
  },

  /**
   * Records a completed question-answer round into memory.
   * Called ONCE per round with real Gemini evaluation data (or isUngraded:true).
   */
  recordRound(params) {
    const { questionText, answerText, metrics, questionObj } = params;

    this.askedQuestions.push(questionText);
    this.askedQuestionsObjects.push(questionObj || {
      text: questionText,
      speech: questionText,
      topic: "Syllabus Concept",
      difficulty: "Medium"
    });
    this.answerTranscripts.push(answerText);
    this.detectedEmotions.push(metrics);

    // Confidence evolution uses real confidence from Gemini, or null for ungraded rounds
    this.confidenceEvolution.push(metrics.isUngraded ? null : (metrics.confidence ?? null));

    // Flag weak concepts only for graded rounds with confirmed low scores
    if (!metrics.isUngraded) {
      if ((metrics.clarity !== null && metrics.clarity < 65) || (metrics.accuracy !== null && metrics.accuracy < 60)) {
        const parsedTerms = this.extractTechnicalTerms(answerText);
        parsedTerms.forEach(term => {
          if (!this.weakConcepts.includes(term)) {
            this.weakConcepts.push(term);
          }
        });
      }
    }
  },

  /**
   * Extracts expected keywords from answer text for diagnostic weak-concepts logs.
   */
  extractTechnicalTerms(text) {
    const textLower = text.toLowerCase();
    const coreKeywords = [
      "entropy", "carnot", "clausius", "reversibility", "piston", "exergy",
      "stack", "queue", "avl", "balanced", "collision", "hash", "probing", "bfs", "dfs",
      "goodman", "soderberg", "sommerfeld", "bearing", "fatigue", "concentration", "fillet", "gears"
    ];
    return coreKeywords.filter(keyword => textLower.includes(keyword));
  },

  /**
   * Compiles the final session diagnostic report context.
   * @param {string} subject - The exam subject.
   * @returns {object} Final compiled report card data.
   */
  compileFinalReport(subject) {
    return {
      subjectName: subject,
      askedQuestions: [...this.askedQuestions],
      askedQuestionsObjects: [...this.askedQuestionsObjects],
      answerTranscripts: [...this.answerTranscripts],
      detectedEmotions: [...this.detectedEmotions],
      weakConcepts: [...this.weakConcepts],
      confidenceEvolution: [...this.confidenceEvolution]
    };
  }
};
