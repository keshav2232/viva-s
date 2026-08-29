/**
 * VivaSim - Session Context Manager Service
 * Manages in-memory context: tracking asked questions, answer transcripts,
 * active evaluation histories, and compiling weaknesses report parameters.
 */

export const SessionContextManager = {
  askedQuestions: [],
  askedQuestionsObjects: [],
  answerTranscripts: [],
  detectedEmotions: [],
  weakConcepts: [],
  confidenceEvolution: [],

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
  },

  /**
   * Records a completed question-answer round into memory.
   */
  recordRound(params) {
    const { questionText, answerText, metrics, questionObj } = params;
    
    this.askedQuestions.push(questionText);
    this.askedQuestionsObjects.push(questionObj || { text: questionText, speech: questionText, topic: "Syllabus Concept", difficulty: "Medium" });
    this.answerTranscripts.push(answerText);
    this.detectedEmotions.push(metrics);
    this.confidenceEvolution.push(metrics.confidence);

    // If clarity or technical accuracy are low, flag expected keywords as weak concepts
    if (metrics.clarity < 65 || metrics.accuracy < 60) {
      const parsedTerms = this.extractTechnicalTerms(answerText);
      parsedTerms.forEach(term => {
        if (!this.weakConcepts.includes(term)) {
          this.weakConcepts.push(term);
        }
      });
    }
  },

  /**
   * Records a pending question-answer round into memory with placeholder metrics.
   */
  recordRoundPending(questionText, answerText, questionObj) {
    this.askedQuestions.push(questionText);
    this.askedQuestionsObjects.push(questionObj || { text: questionText, speech: questionText, topic: "Syllabus Concept", difficulty: "Medium" });
    this.answerTranscripts.push(answerText);
    
    // Push placeholder metrics so indices and lengths stay aligned
    const placeholderMetrics = {
      confidence: 70,
      clarity: 70,
      nervousness: 30,
      hesitation: 20,
      wpm: 120,
      fillerCount: 0,
      correctness: 70,
      accuracy: 70,
      completeness: 70,
      tag: "Evaluating...",
      correctAnswer: "Loading evaluation..."
    };
    this.detectedEmotions.push(placeholderMetrics);
    this.confidenceEvolution.push(placeholderMetrics.confidence);
  },

  /**
   * Updates a specific round's metrics once resolved.
   */
  updateRoundMetrics(index, metrics) {
    if (this.detectedEmotions[index]) {
      this.detectedEmotions[index] = metrics;
      this.confidenceEvolution[index] = metrics.confidence;

      // If clarity or technical accuracy are low, flag expected keywords as weak concepts
      if (metrics.clarity < 65 || metrics.accuracy < 60) {
        const parsedTerms = this.extractTechnicalTerms(this.answerTranscripts[index] || "");
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
