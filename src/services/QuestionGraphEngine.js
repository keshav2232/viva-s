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
      return this.getRuleBasedOfflineFallback(askedList.length + 1, personality, currentTopic, syllabus);
    }
  },

  /**
   * Offline rule-based branching backup if the Gemini API key is not configured or connection drops.
   */
  getRuleBasedOfflineFallback(qIndex, personality, currentTopic, syllabus) {
    const remarks = {
      friendly: "No worries, let us take it step-by-step. Let's make this simple. ",
      strict: "That was incomplete. Let us drop back to some fundamental concepts. ",
      brutal: "Why should I believe that? Let us examine the limits. ",
      terror: "That sounds like a memorized response. Explain what actually happens at the boundary. "
    };

    const remark = remarks[personality] || "Good. Now let us progress. ";
    const subject = (syllabus?.topic || "").toLowerCase();

    let questions = [];
    if (subject.includes("software") || subject.includes("backend") || subject.includes("developer") || subject.includes("engineer")) {
      questions = [
        {
          text: "What are the core trade-offs between monolithic and microservices architectures, and when would you divide system domains?",
          topic: "Monolith vs Microservices",
          correctAnswer: "Monoliths are simple to build and deploy, but hard to scale and slow to build as they grow. Microservices scale independently and allow separate tech stacks, but introduce network latency, operational complexity, and distributed database consistency challenges."
        },
        {
          text: "How does database indexing work, and what are the associated write performance trade-offs?",
          topic: "SQL Indexing Performance",
          correctAnswer: "Database indexes (like B-Trees) speed up read queries from O(N) to O(log N) by maintaining a sorted reference tree. The trade-off is that every INSERT, UPDATE, or DELETE requires updating the index, which degrades write throughput."
        },
        {
          text: "What is cache invalidation, and how does write-through compare to cache-aside?",
          topic: "Cache Invalidation Strategies",
          correctAnswer: "Cache invalidation ensures cached data matches the database. In write-through, data is written to the cache and DB concurrently (guaranteeing consistency but adding latency). In cache-aside, the application queries the cache first, updates it on a miss, and writes go directly to the DB."
        },
        {
          text: "Explain the Saga pattern and how it maintains eventual consistency in distributed microservices.",
          topic: "Distributed Transaction Sagas",
          correctAnswer: "The Saga pattern manages distributed transactions using a sequence of local transactions. Each transaction updates database state in a single service and triggers the next step. If a step fails, compensation transactions are executed in reverse order to roll back changes."
        }
      ];
    } else if (subject.includes("product") || subject.includes("pm")) {
      questions = [
        {
          text: "What frameworks do you use for prioritizing product features when resources are limited?",
          topic: "Feature Prioritization Frameworks",
          correctAnswer: "Common frameworks include RICE (Reach, Impact, Confidence, Effort), MoSCoW (Must have, Should have, Could have, Won't have), and the Kano Model (comparing satisfaction vs functionality) to balance value against engineering cost."
        },
        {
          text: "Explain the difference between A/B testing and multivariate testing, and how you choose between them.",
          topic: "A/B Testing Significance",
          correctAnswer: "A/B testing compares two versions (A and B) of a page or feature to measure which performs better. Multivariate testing compares multiple design elements simultaneously to see which combination yields the highest conversion."
        },
        {
          text: "What are CAC and LTV, and what is a healthy ratio for a SaaS business?",
          topic: "Customer Acquisition & Lifetime Value",
          correctAnswer: "CAC is Customer Acquisition Cost. LTV is Lifetime Value. A healthy LTV:CAC ratio is generally 3:1 or higher, indicating that the value a customer brings is three times the cost to acquire them."
        },
        {
          text: "How do you design a user retention loop to increase stickiness?",
          topic: "Retention Loop Design",
          correctAnswer: "A retention loop consists of a trigger (internal/external), an action, a variable reward, and investment, which prompts the user to return to the app naturally."
        }
      ];
    } else if (subject.includes("data scientist") || subject.includes("machine learning") || subject.includes("ml")) {
      questions = [
        {
          text: "What is the difference between supervised and unsupervised learning, and how do you choose between them?",
          topic: "Supervised vs Unsupervised Models",
          correctAnswer: "Supervised learning trains models on labeled data (e.g. classification or regression). Unsupervised learning finds hidden patterns or structures in unlabeled data (e.g. clustering or dimension reduction)."
        },
        {
          text: "Explain the bias-variance trade-off in machine learning.",
          topic: "Bias-Variance Trade-off",
          correctAnswer: "Bias is error from erroneous assumptions (causing underfitting). Variance is error from sensitivity to small fluctuations in training data (causing overfitting). The trade-off is finding the sweet spot that minimizes total error."
        },
        {
          text: "What is regularization, and how do L1 and L2 regularization differ?",
          topic: "Regularization L1/L2/Dropout",
          correctAnswer: "Regularization adds a penalty to the loss function to prevent overfitting. L1 (Lasso) adds absolute coefficient values, prompting coefficients to shrink to zero (acting as feature selector). L2 (Ridge) adds squared coefficient values, keeping coefficients small but non-zero."
        },
        {
          text: "How does the self-attention mechanism work in Transformers?",
          topic: "Transformer Self-Attention",
          correctAnswer: "Self-attention dynamically calculates a weight distribution for each word in a sequence relative to all other words, allowing the model to capture long-range dependencies and context regardless of distance."
        }
      ];
    } else if (subject.includes("data") || subject.includes("structure")) {
      questions = [
        {
          text: "Can you explain the difference between a stack and a queue, and their respective operational time complexities?",
          topic: "Linear Data Structures",
          correctAnswer: "A stack is a Last-In-First-Out (LIFO) data structure where insertion and deletion happen at the top in O(1) time. A queue is a First-In-First-Out (FIFO) data structure where elements are inserted at the rear and removed from the front, also in O(1) time."
        },
        {
          text: "What is the key difference between a Binary Search Tree (BST) and an AVL Tree?",
          topic: "Binary Search Trees",
          correctAnswer: "A BST is a node-based binary tree where left children are smaller and right children are larger, but it can become unbalanced (degrading to O(N)). An AVL tree is a self-balancing BST where height difference between left and right subtrees is at most 1, guaranteeing O(log N) operations."
        },
        {
          text: "Explain how hash collisions are resolved using separate chaining vs open addressing.",
          topic: "Hash collisions buckets",
          correctAnswer: "Separate chaining stores colliding elements in a linked list or bucket at the hash index. Open addressing finds another open slot in the hash table using probing techniques (linear, quadratic, or double hashing)."
        },
        {
          text: "Describe how a Trie data structure works and its primary advantage.",
          topic: "Trie prefix searches",
          correctAnswer: "A Trie (prefix tree) is a tree-like structure where nodes represent characters of keys. Its primary advantage is O(L) lookup time where L is the key length, making it extremely fast for prefix searches and autocompletion."
        }
      ];
    } else if (subject.includes("machine") || subject.includes("design")) {
      questions = [
        {
          text: "What is the difference between the Soderberg and Goodman fatigue failure theories?",
          topic: "Static stress limits",
          correctAnswer: "Goodman uses ultimate tensile strength (S_ut) for alternating stress fatigue, while Soderberg uses yield strength (S_yt), making it more conservative and safer for ductile materials."
        },
        {
          text: "How is the Sommerfeld number used in journal bearing design?",
          topic: "Sommerfeld lubrication coefficient",
          correctAnswer: "The Sommerfeld number is a dimensionless parameter S = (r/c)^2 * (mu * N) / P that encapsulates lubrication factors. It is used to determine minimum oil film thickness and journal eccentricity ratio to avoid surface contact."
        },
        {
          text: "What does the Lewis formula calculate in gear design?",
          topic: "Spur root teeth bending",
          correctAnswer: "The Lewis formula models a gear tooth as a cantilever beam to calculate root bending stress: sigma = W_t / (F * m * Y). It is used to size gears to resist bending fatigue at the tooth root."
        },
        {
          text: "Explain the difference between uniform wear and uniform pressure assumptions in clutches.",
          topic: "Uniform wear clutch torque",
          correctAnswer: "Uniform pressure assumes contact pressure is constant (used for new clutches). Uniform wear assumes wear rate is constant (P * r = constant), which is more realistic for worn clutches and yields a lower, conservative torque capacity."
        }
      ];
    } else {
      // Default to thermodynamics questions
      questions = [
        {
          text: "Can you explain the basic physical differences between open, closed, and isolated systems, and provide a real-world example of each?",
          topic: "Thermodynamic Systems",
          correctAnswer: "An open system can exchange both mass and energy with its surroundings (e.g., an open beaker or piston with valves). A closed system can exchange energy (heat and work) but not mass (e.g., a sealed cylinder). An isolated system exchanges neither mass nor energy (e.g., an idealized vacuum flask)."
        },
        {
          text: "What is the physical meaning of the Clausius Inequality, and how does it prove cyclic irreversibility?",
          topic: "Clausius Inequality",
          correctAnswer: "The Clausius Inequality states that the cyclic integral of dQ/T <= 0. For a reversible cycle, it equals zero. For an irreversible cycle, it is strictly less than zero. This proves cyclic irreversibility because real cycles always generate positive internal entropy, leading to wasted potential work."
        },
        {
          text: "What is the Carnot Cycle, and why can its thermal efficiency never reach 100% physically?",
          topic: "Carnot Cycle",
          correctAnswer: "The Carnot Cycle consists of two reversible isothermal processes and two reversible adiabatic processes. Its efficiency is eta = 1 - T_C / T_H. For eta to reach 100% (or 1.0), T_C (the cold reservoir) must be absolute zero (0 K), which is physically impossible to achieve under the Third Law of Thermodynamics."
        },
        {
          text: "How does the concept of entropy mathematically relate to the availability of work, and exergy destruction?",
          topic: "Entropy & Exergy",
          correctAnswer: "By the Gouy-Stodola Theorem, exergy destruction (X_destroyed, or lost work capability) is directly proportional to entropy generation (S_gen): X_destroyed = T_0 * S_gen, where T_0 is the dead state environment temperature. Higher entropy generation represents greater degradation of energy grade and irreversible loss of useful work capacity."
        }
      ];
    }

    // Dynamic extraction if custom syllabus has units/topics but doesn't match standard keywords
    if (syllabus && syllabus.units && syllabus.units.length > 0 && questions.length === 0) {
      const allTopics = [];
      syllabus.units.forEach(unit => {
        if (unit.topics) {
          unit.topics.forEach(t => {
            allTopics.push({ unitName: unit.name, topic: t });
          });
        }
      });

      if (allTopics.length > 0) {
        const selectedIdx = (qIndex - 1) % allTopics.length;
        const selected = allTopics[selectedIdx];
        const isProfessional = (syllabus.units[0].name || "").toLowerCase().includes("competency");

        return {
          text: isProfessional
            ? `Can you explain the core concepts and design considerations involved in "${selected.topic}"?`
            : `Can you explain the fundamental principles and governing constraints of "${selected.topic}"?`,
          speech: remark + (isProfessional
            ? `Can you explain the core concepts and design considerations involved in "${selected.topic}"?`
            : `Can you explain the fundamental principles and governing constraints of "${selected.topic}"?`),
          topic: selected.topic,
          difficulty: qIndex > 2 ? "High" : "Medium",
          correctAnswer: isProfessional
            ? `A correct response should explain the underlying engineering principles, design trade-offs, and standard implementations for "${selected.topic}".`
            : `A correct response should explain the underlying technical principles, governing formulas/equations, and behavior under boundary conditions for "${selected.topic}".`
        };
      }
    }

    const qIdx = (qIndex - 1) % questions.length;
    const selectedQ = questions[qIdx];

    return {
      text: selectedQ.text,
      speech: remark + selectedQ.text,
      topic: selectedQ.topic,
      difficulty: qIndex > 2 ? "High" : "Medium",
      correctAnswer: selectedQ.correctAnswer
    };
  }
};
