/**
 * VivaSim - Question Graph Engine
 * Manages dynamic branching, contextual memories, and pacing selections.
 * Enforces anti-hallucination guardrails and is duration-aware.
 */

export const QuestionGraphEngine = {
  
  /**
   * Generates the next question by compiling the session memory and requesting the API route.
   * @param {object} params - { syllabus, personality, duration, askedList, answersList, lastEvaluationTag, currentTopic }
   * @returns {Promise<object>} The next question node { text, speech, topic, difficulty }
   */
  async generateNextQuestion(params) {
    const { syllabus, personality, duration, askedList, answersList, lastEvaluationTag, currentTopic, nervousness } = params;

    try {
      const response = await fetch("/api/viva", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate-question",
          syllabus,
          personality,
          duration,
          asked: askedList,
          history: answersList,
          lastTag: lastEvaluationTag,
          activeTopic: currentTopic,
          nervousness: nervousness || 0
        })
      });

      if (!response.ok) throw new Error("Question generation API call failed");
      const questionNode = await response.json();
      return questionNode;
    } catch (e) {
      console.warn("QuestionGraphEngine API error. Falling back to rule-based offline generation:", e);
      return this.getRuleBasedOfflineFallback(askedList.length + 1, personality, currentTopic);
    }
  },

  /**
   * Offline rule-based branching backup if the Gemini API key is not configured or connection drops.
   */
  getRuleBasedOfflineFallback(qIndex, personality, currentTopic) {
    const remarks = {
      friendly: "No worries, let us take it step-by-step. Let's make this simple. ",
      strict: "That was incomplete. Let us drop back to some fundamental concepts. ",
      brutal: "Why should I believe that? Let us examine the thermodynamic limits. ",
      terror: "That sounds like a memorized response. Explain what actually happens at the boundary. "
    };

    let nextText = "Can you explain the basic physical differences between open, closed, and isolated systems, and provide a real-world example of each?";
    let topic = "Thermodynamic Systems";

    if (qIndex === 2) {
      nextText = "What is the physical meaning of the Clausius Inequality, and how does it prove cyclic irreversibility?";
      topic = "Clausius Inequality";
    } else if (qIndex === 3) {
      nextText = "What is the Carnot Cycle, and why can its thermal efficiency never reach 100% physically?";
      topic = "Carnot Cycle";
    } else if (qIndex === 4) {
      nextText = "How does the concept of entropy mathematically relate to the availability of work, and exergy destruction?";
      topic = "Entropy & Exergy";
    }

    const remark = remarks[personality] || "Good. Now let us progress. ";

    return {
      text: nextText,
      speech: remark + nextText,
      topic: topic,
      difficulty: qIndex > 2 ? "High" : "Medium"
    };
  }
};
