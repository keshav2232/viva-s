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
    const { syllabus, personality, duration, askedList, answersList, lastEvaluationTag, currentTopic, nervousness, isTargetDrill, targetSubtopic, mode } = params;

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
          nervousness: nervousness || 0,
          isTargetDrill,
          targetSubtopic,
          mode
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
    let correctAnswer = "An open system can exchange both mass and energy with its surroundings (e.g., an open beaker or piston with valves). A closed system can exchange energy (heat and work) but not mass (e.g., a sealed cylinder). An isolated system exchanges neither mass nor energy (e.g., an idealized vacuum flask).";

    if (qIndex === 2) {
      nextText = "What is the physical meaning of the Clausius Inequality, and how does it prove cyclic irreversibility?";
      topic = "Clausius Inequality";
      correctAnswer = "The Clausius Inequality states that the cyclic integral of dQ/T <= 0. For a reversible cycle, it equals zero. For an irreversible cycle, it is strictly less than zero. This proves cyclic irreversibility because real cycles always generate positive internal entropy, leading to wasted potential work.";
    } else if (qIndex === 3) {
      nextText = "What is the Carnot Cycle, and why can its thermal efficiency never reach 100% physically?";
      topic = "Carnot Cycle";
      correctAnswer = "The Carnot Cycle consists of two reversible isothermal processes and two reversible adiabatic processes. Its efficiency is eta = 1 - T_C / T_H. For eta to reach 100% (or 1.0), T_C (the cold reservoir) must be absolute zero (0 K), which is physically impossible to achieve under the Third Law of Thermodynamics.";
    } else if (qIndex === 4) {
      nextText = "How does the concept of entropy mathematically relate to the availability of work, and exergy destruction?";
      topic = "Entropy & Exergy";
      correctAnswer = "By the Gouy-Stodola Theorem, exergy destruction (X_destroyed, or lost work capability) is directly proportional to entropy generation (S_gen): X_destroyed = T_0 * S_gen, where T_0 is the dead state environment temperature. Higher entropy generation represents greater degradation of energy grade and irreversible loss of useful work capacity.";
    }

    const remark = remarks[personality] || "Good. Now let us progress. ";

    return {
      text: nextText,
      speech: remark + nextText,
      topic: topic,
      difficulty: qIndex > 2 ? "High" : "Medium",
      correctAnswer: correctAnswer
    };
  }
};
