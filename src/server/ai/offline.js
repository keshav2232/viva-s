/**
 * Offline (no-AI) engine: runs when GEMINI_API_KEY is missing or every model fails.
 * It is deliberately conservative: it estimates vocabulary overlap with built-in reference answers
 * and never awards top marks. Every online action has a matching offline result here.
 */
import { getFallbackSyllabus } from "../../utils/mockData";
import { getQuestionCountForDuration } from "../../utils/pacing";
import { getTargetUnitsForDuration } from "./features/syllabus";
import { DEFAULT_CORRECT_ANSWERS } from "./offlineData";

function getOfflineHierarchy(topic, mode, duration) {
  const syllabus = getFallbackSyllabus(topic, mode === "professional");
  return { topic: syllabus.topic, units: syllabus.units.slice(0, getTargetUnitsForDuration(duration)) };
}

export function offlineAction(payload) {
  const { action, mode } = payload;
  const isProfessional = mode === "professional";
  
  if (action === "hindsight-analyze") {
    // Hindsight gracefully degrades — client-side HindsightEngine has its own local fallback
    return ({ 
      sessionNarrative: null, 
      isOfflineFallback: true 
    });
  }

  if (action === "generate-hint") {
    const { question, answer, topic } = payload;
    if (isProfessional) {
      return ({
        hintText: `Warm hint: Consider how you would approach this from an industry perspective for ${topic || "this topic"}. What design trade-offs matter?`,
        hintSpeech: `No worries, let's look at this simple scenario. Consider how you would approach this from an industry perspective for ${topic || "this topic"}. What design trade-offs/scenarios matter?`
      });
    }
    return ({
      hintText: `Friendly hint: Think about the core principles of ${topic || "this topic"}. How does it relate to its main variables or inputs?`,
      hintSpeech: `Don't worry, let's take a step back. Think about the core principles of ${topic || "this topic"}. How does it relate to its main variables or inputs? Take your time.`
    });
  }

  if (action === "generate-subquestion") {
    const { question, answer, topic } = payload;
    if (isProfessional) {
      return ({
        subQuestionText: `Simpler question: Can you describe the primary purpose of ${topic || "this concept"} in software engineering?`,
        subQuestionSpeech: `Let's make it simpler. Just tell me: can you describe the primary purpose of ${topic || "this concept"} in software engineering?`
      });
    }
    return ({
      subQuestionText: `Simpler question: What is the absolute basic definition of ${topic || "this concept"}?`,
      subQuestionSpeech: `You are taking too long. Let's make it simpler. Just tell me: what is the absolute basic definition of ${topic || "this concept"}?`
    });
  }
  
  if (action === "expand-topic") {
    const topic = payload.topic || "Thermodynamics";
    const result = getOfflineHierarchy(topic, mode, payload.duration);
    return (result);
  }
  
  const offlineQuestion = (payload) => {
    const { syllabus, personality, asked, history, lastTag, isTargetDrill, targetSubtopic } = payload;
    
    // Extract all topics from the syllabus structure
    let allTopics = [];
    try {
      if (syllabus && syllabus.units && syllabus.units.length > 0) {
        syllabus.units.forEach(u => {
          if (u.topics && u.topics.length > 0) {
            u.topics.forEach(t => {
              allTopics.push({ unitName: u.name, topicName: t });
            });
          }
        });
      }
    } catch (e) {
      console.warn("Failed parsing fallback syllabus units:", e);
    }

    if (allTopics.length === 0) {
      allTopics = isProfessional ? [
        { unitName: "Competency 1: Fundamentals", topicName: "Core operational principles" },
        { unitName: "Competency 2: Architectural Analysis", topicName: "Standard trade-off scenarios" },
        { unitName: "Competency 3: Practical Systems", topicName: "Real-world engineering models" }
      ] : [
        { unitName: "Unit 1: Fundamentals", topicName: "Core conceptual principles" },
        { unitName: "Unit 2: Structural Analysis", topicName: "Standard boundary equations" },
        { unitName: "Unit 3: Applied Scenarios", topicName: "Real-world physical models" }
      ];
    }

    // Filter out topics that have already been asked
    const unasked = allTopics.filter(t => !asked.includes(t.topicName));
    const selected = unasked.length > 0 
      ? unasked[Math.floor(Math.random() * unasked.length)]
      : allTopics[Math.floor(Math.random() * allTopics.length)];
    
    const activeSubtopic = (isTargetDrill && targetSubtopic) ? targetSubtopic : selected.topicName;

    // Compile dynamic question templates based on personality
    const questionTemplates = isProfessional ? {
      friendly: [
        `Could you explain the basic principles behind ${activeSubtopic} in your own words?`,
        `Let's look at ${activeSubtopic}. What are the primary concerns or scenarios we need to consider here?`,
        `How would you describe the practical significance of ${activeSubtopic} to a junior engineer?`
      ],
      strict: [
        `State the precise definition and components of ${activeSubtopic}.`,
        `What are the core design trade-offs and performance implications for ${activeSubtopic}?`,
        `Explain the architectural implementation and scaling constraints of ${activeSubtopic} precisely.`
      ],
      brutal: [
        `What represents the ultimate failure point or bottleneck in ${activeSubtopic}, and why?`,
        `Why do standard configurations for ${activeSubtopic} frequently fail in real-world high-traffic scenarios?`,
        `Prove why we cannot achieve zero downtime or complete consistency when dealing with ${activeSubtopic}.`
      ],
      terror: [
        `That sounds like a generic online guide response. Explain exactly how you would debug or scale ${activeSubtopic} from absolute first principles in production.`,
        `Most candidates just memorize definitions. Can you prove to me that you actually understand the performance trade-offs of ${activeSubtopic}?`,
        `Under high write loads, what is the micro-architectural bottleneck inside ${activeSubtopic}, and why does it fail under database locking stress?`
      ]
    } : {
      friendly: [
        `Could you explain the basic principles behind ${activeSubtopic} in your own words?`,
        `Let's look at ${activeSubtopic}. What are the primary concepts we need to consider here?`,
        `How would you describe the physical significance of ${activeSubtopic} to a student?`
      ],
      strict: [
        `State the precise definitions and parameters of ${activeSubtopic}.`,
        `What are the core governing equations and boundary conditions for ${activeSubtopic}?`,
        `Explain the mathematical derivation and physical constraints of ${activeSubtopic} precisely.`
      ],
      brutal: [
        `What represents the ultimate physical or theoretical limit in ${activeSubtopic}, and why?`,
        `Why do design models for ${activeSubtopic} frequently fail in real-world extreme scenarios?`,
        `Prove why we cannot exceed standard theoretical efficiency when dealing with ${activeSubtopic}.`
      ],
      terror: [
        `That sounds like a textbook answer. Explain exactly what happens physically during ${activeSubtopic} from absolute first principles.`,
        `Most students just memorize definitions. Can you prove to me that you actually understand the mathematical boundaries of ${activeSubtopic}?`,
        `Under cyclic loading, what is the micro-structural breakdown inside ${activeSubtopic}, and why does it fail under stress concentration?`
      ]
    };

    const templatesList = questionTemplates[personality] || questionTemplates.friendly;
    const questionText = templatesList[asked.length % templatesList.length];

    // Compile dynamic examiner remark based on last performance tag
    let remarkText = isProfessional ? "Good. Now let's proceed. " : "Good. Now let us proceed. ";
    if (asked.length === 0) {
      remarkText = isProfessional
        ? `Welcome. Let us begin your mock interview on ${payload.topic || "this role"}. `
        : `Welcome. Let us begin your oral examination on ${payload.topic || "this subject"}. `;
    } else {
      const remarksByTag = isProfessional ? {
        Strong: [
          "Excellent response. Your practical clarity is outstanding. Let's go a step deeper. ",
          "Very well articulated. You hit the key architectural trade-offs perfectly. Now let's pivot. ",
          "Highly accurate explanation. Let us stretch this design scenario further. "
        ],
        Weak: [
          "That explanation lacked technical depth. Let us drop back to some fundamental concepts. ",
          "I see. Let's step back to some core basics to clarify your understanding. ",
          "No worries, let us take it step-by-step. Let's look at something simpler. "
        ],
        Bluffing: [
          "You are using a lot of industry buzzwords but missing the actual engineering trade-offs. Let's get highly precise. ",
          "That sounds like a generic response. Let's test your direct hands-on experience. ",
          "Let's cut through the general explanations. Answer this next question strictly with concrete examples. "
        ],
        Incomplete: [
          "That was correct in direction but lacked detailed examples. Let's verify details on this next topic. ",
          "You got the basic concept but missed the structural depth. Let's explore this. "
        ],
        Confused: [
          "You seem to be contradicting yourself. Let's steady your thoughts on this fundamental topic. ",
          "Let us simplify the engineering boundaries so you can structure your explanation. "
        ]
      } : {
        Strong: [
          "Excellent response. Your conceptual clarity is outstanding. Let's go a step deeper. ",
          "Very well articulated. You hit the key technical details perfectly. Now let's pivot. ",
          "Highly accurate explanation. Let us stretch this boundary further. "
        ],
        Weak: [
          "That definition was incomplete. Let us drop back to some fundamental parameters. ",
          "I see. Let's step back to some core basics to clarify your understanding. ",
          "No worries, let us take it step-by-step. Let's look at something simpler. "
        ],
        Bluffing: [
          "You are using a lot of general words but missing the core technical details. Let's get highly precise. ",
          "That sounds like a memorized response. Let's test your fundamental understanding. ",
          "Let's cut through the general explanations. Answer this next question strictly. "
        ],
        Incomplete: [
          "That was correct in direction but lacked detailed explanations. Let's verify details on this next topic. ",
          "You got the basic concept but missed the structural depth. Let's explore this. "
        ],
        Confused: [
          "You seem to be contradicting yourself. Let's steady your thoughts on this fundamental topic. ",
          "Let us simplify the thermodynamic boundaries so you can structure your explanation. "
        ]
      };

      const tagList = remarksByTag[lastTag] || [
        "Good. Now let's progress. ",
        "I see. Let's move to the next unit. ",
        "Understood. Let's proceed. "
      ];
      remarkText = tagList[asked.length % tagList.length];
      const activeSubtopicLower = activeSubtopic.toLowerCase();
      let correctAnswer = isProfessional
        ? `A correct response on "${activeSubtopic}" should explain the underlying engineering principles, state any design trade-offs or behavioral framework details, and outline standard production implementations.`
        : `A correct response on "${activeSubtopic}" should explain the underlying technical principles, state any governing formulas/relationships, and outline how parameters behave under boundary conditions.`;
      for (const [key, val] of Object.entries(DEFAULT_CORRECT_ANSWERS)) {
        if (activeSubtopicLower && (activeSubtopicLower.includes(key.toLowerCase()) || key.toLowerCase().includes(activeSubtopicLower))) {
          correctAnswer = val;
          break;
        }
      }

      return ({
        text: questionText,
        speech: remarkText + questionText,
        topic: activeSubtopic,
        difficulty: asked.length > 2 ? "High" : "Medium",
        correctAnswer: correctAnswer
      });
    }

    const fullSpeech = remarkText + questionText;

    return ({
      text: questionText,
      speech: fullSpeech,
      topic: activeSubtopic,
      difficulty: asked.length > 2 ? "High" : "Medium"
    });
  }

  const offlineGrade = (payload) => {
    const { question, answer } = payload;
    const cleanAnswer = (answer || "").trim();
    const lowerAnswer = cleanAnswer.toLowerCase();
    const wordsCount = lowerAnswer.split(/\s+/).filter(w => w.length > 0).length;
    
    let correctness = 60;
    let accuracy = 55;
    let completeness = 50;
    let tag = "Partially Correct";
    
    if (wordsCount < 6 || lowerAnswer.includes("remained silent") || lowerAnswer.includes("force-submitted")) {
      correctness = 25;
      accuracy = 20;
      completeness = 15;
      tag = "Weak";
    } else if (lowerAnswer.includes("don't know") || lowerAnswer.includes("not sure") || lowerAnswer.includes("skip")) {
      correctness = 20;
      accuracy = 15;
      completeness = 10;
      tag = "Weak";
    } else {
      // Offline heuristic (no AI available). It can only measure vocabulary overlap with the
      // reference answer / question, so it is deliberately conservative: it never rewards
      // padding or repeating the question, and it cannot award top marks.
      const STOP = new Set(["explain", "describe", "define", "state", "between", "difference", "differences", "compare", "which", "about", "their", "there", "where", "would", "should", "could", "these", "those", "other", "using", "under", "while", "work", "works", "does", "what", "when", "your", "have", "with", "from", "that", "this", "into", "also", "mean", "means", "give", "example", "tell", "detail", "briefly", "following"]);
      const toWords = (t) => (t || "").toLowerCase().replace(/[^\w\s]/g, " ").split(/\s+/).filter(w => w.length > 4 && !STOP.has(w));

      let reference = "";
      const qLower = (question || "").toLowerCase();
      for (const [key, val] of Object.entries(DEFAULT_CORRECT_ANSWERS)) {
        if (qLower && (qLower.includes(key.toLowerCase()) || key.toLowerCase().includes(qLower))) { reference = val; break; }
      }
      // Score against the reference answer when we have one. Echoing the question's own words proves nothing,
      // so without a reference the question words are only a weak signal (and capped below).
      const keywords = [...new Set(reference ? toWords(reference) : toWords(question))];
      const answerWords = lowerAnswer.replace(/[^\w\s]/g, " ").split(/\s+/).filter(Boolean);
      const answerSet = new Set(answerWords);
      const uniqueRatio = answerWords.length ? answerSet.size / answerWords.length : 0;
      const matchCount = keywords.filter(kw => answerSet.has(kw) || [...answerSet].some(w => w.length > 5 && (w.startsWith(kw.slice(0, 5)) && kw.length > 5))).length;
      const matchRatio = keywords.length > 0 ? matchCount / keywords.length : 0;

      if (uniqueRatio < 0.45 && wordsCount > 12) {
        // Repetition / padding
        correctness = 30; accuracy = 25; completeness = 25; tag = "Bluffing";
      } else if (matchRatio >= 0.5 && wordsCount >= 25) {
        const cap = reference ? 0 : 12;
        correctness = Math.min(Math.round(66 + matchRatio * 14), 80) - cap;
        accuracy = Math.min(Math.round(62 + matchRatio * 14), 76) - cap;
        completeness = Math.min(Math.round(58 + matchRatio * 14), 74) - cap;
        tag = "Partially Correct";
      } else if (wordsCount > 28 && matchRatio < 0.2) {
        correctness = 40; accuracy = 32; completeness = 38; tag = "Bluffing";
      } else if (wordsCount < 16) {
        correctness = 52; accuracy = 45; completeness = 40; tag = "Incomplete";
      }
    }

    const questionLower = (question || "").toLowerCase();
    let correctAnswer = isProfessional
      ? `A correct response should explain the underlying engineering principles, state any design trade-offs/STAR details, and outline architectural best practices.`
      : `A correct response should explain the underlying technical principles, state any governing formulas/relationships, and outline how parameters behave under boundary conditions.`;
    for (const [key, val] of Object.entries(DEFAULT_CORRECT_ANSWERS)) {
      if (questionLower && (questionLower.includes(key.toLowerCase()) || key.toLowerCase().includes(questionLower))) {
        correctAnswer = val;
        break;
      }
    }
    
    return ({
      correctness,
      completeness,
      accuracy,
      clarity: Math.round(correctness * 0.95),
      tag,
      correctAnswer: correctAnswer
    });
  }

  // --- Combined live-session actions (mirror the online `start-session` / `turn` shapes) ---
  if (action === "start-session") {
    return { next: offlineQuestion({ ...payload, asked: [] }), offline: true };
  }
  if (action === "turn") {
    const grading = offlineGrade({ ...payload, question: payload.question?.text || "" });
    const roundTopics = (payload.rounds || []).map((r) => r.topic).filter(Boolean);
    const asked = [...roundTopics, payload.question?.topic].filter(Boolean);
    const total = getQuestionCountForDuration(payload.duration);
    const isLast = (payload.rounds || []).length + 1 >= total;
    const next = isLast ? null : offlineQuestion({ ...payload, asked, lastTag: grading.tag });
    return { grading: { ...grading, rationale: grading.rationale || "Offline estimate: the AI grader was unavailable." }, next, offline: true };
  }

  if (action === "generate-flashcards") {
    const syllabusStructure = payload.syllabusStructure;
    const topic = (syllabusStructure?.topic || "Custom Syllabus").toLowerCase();
    
    // Curated high-yield mock flashcards for common subjects/roles
    let cards = [];
    if (topic.includes("software engineer") || topic.includes("backend") || topic.includes("developer")) {
      cards = [
        {
          question: "What is the key architectural difference between a Microservice and a Monolith?",
          shortAnswer: "A monolith has all services compiled into a single executable deployed together. Microservices split services into independently deployable, loosely coupled units communicating via network interfaces (APIs, MQ), allowing independent scaling, separate tech stacks, and modular fault tolerance, but introducing higher operations overhead and distributed data challenges."
        },
        {
          question: "Explain SQL indexing, how it speeds up query execution, and the overhead it introduces.",
          shortAnswer: "SQL indexes (typically B-Tree or Hash indexes) speed up query execution from O(N) full-table scans to O(log N) searches by mapping lookup columns to table rows in sorted order. The overhead is that indexes must be updated on every INSERT, UPDATE, or DELETE operation, adding disk write latency and consuming extra storage space."
        },
        {
          question: "What is a cache invalidation strategy, and how does write-through compare to cache-aside?",
          shortAnswer: "Cache invalidation maintains consistency between database and cache. In write-through, data is written to the cache and database simultaneously, guaranteeing consistency but adding write latency. In cache-aside, the application reads from cache first; on a miss, it reads from database, updates cache, and returns. Writes go directly to the database, requiring TTL or explicit eviction to invalidate cache."
        },
        {
          question: "Compare multithreading and asynchronous execution in high-concurrency backend services.",
          shortAnswer: "Multithreading achieves concurrency by running multiple OS threads in parallel (ideal for CPU-bound tasks, but uses more memory and risks deadlocks). Asynchronous execution uses a single thread with a non-blocking event loop (ideal for I/O-bound tasks, using very little memory and avoiding context-switching costs)."
        },
        {
          question: "How does the Saga pattern manage distributed transaction consistency across microservices?",
          shortAnswer: "The Saga pattern coordinates local transactions sequentially. Each service runs its local transaction and publishes an event. If a transaction fails, the Saga orchestrator triggers compensating backward transactions (compensating actions) in preceding services to roll back the overall state and ensure eventual consistency."
        }
      ];
    } else if (topic.includes("product manager") || topic.includes("pm")) {
      cards = [
        {
          question: "What is features prioritization RICE scoring?",
          shortAnswer: "RICE is a prioritization framework evaluating features on Reach (users impacted in a time period), Impact (estimated boost to goal), Confidence (metric certainty from 0-100%), and Effort (person-months). Formula: Score = (Reach * Impact * Confidence) / Effort."
        },
        {
          question: "How do you calculate CAC and LTV, and what is a healthy ratio for B2B SaaS?",
          shortAnswer: "Customer Acquisition Cost (CAC) = total sales & marketing spend / customers acquired. Lifetime Value (LTV) = average revenue per user * gross margin / churn rate. A healthy SaaS ratio is LTV:CAC >= 3:1, indicating sustainable unit economics."
        },
        {
          question: "Explain the MVP concept and the risk of over-building before launch.",
          shortAnswer: "A Minimum Viable Product (MVP) is the simplest version of a product that allows a team to collect the maximum amount of validated learning about customers with the least effort. Over-building increases time-to-market, wastes engineering resources on unproven features, and delays critical feedback loops."
        },
        {
          question: "What is an A/B test and how do you ensure statistical significance?",
          shortAnswer: "An A/B test splits users randomly between control (A) and variant (B) groups to test feature efficacy. You ensure statistical significance by calculating a p-value (typically p < 0.05) using a t-test or chi-square test to verify that observed metric differences are not due to random chance, requiring a pre-calculated sample size."
        },
        {
          question: "How do you diagnose user drop-off in a signup funnel?",
          shortAnswer: "Analyze funnel analytics to identify the step with the highest drop-off rate, run session replays/heuristics to check for UX friction or bugs, and conduct user interviews to understand why users abandon at that specific step."
        }
      ];
    } else if (topic.includes("data scientist") || topic.includes("machine learning") || topic.includes("ml")) {
      cards = [
        {
          question: "Explain the Bias-Variance Trade-off in Machine Learning.",
          shortAnswer: "Bias represents error from erroneous assumptions in the model (leads to underfitting). Variance represents sensitivity to small fluctuations in the training set (leads to overfitting). Optimizing generalization error requires finding the balance point where total error (Bias^2 + Variance + Irreducible Noise) is minimized."
        },
        {
          question: "How do you handle highly imbalanced classes in a classification problem?",
          shortAnswer: "Imbalance can be addressed via resampling (oversampling minority class with SMOTE, undersampling majority class), using appropriate evaluation metrics (Precision, Recall, F1-score, PR-AUC instead of raw accuracy), using cost-sensitive learning algorithms, or ensemble methods like Balanced Random Forests."
        },
        {
          question: "What is the difference between L1 (Lasso) and L2 (Ridge) regularization?",
          shortAnswer: "L1 regularization adds the sum of absolute weights (|w|) as a penalty to the loss function, which drives some weights to exactly zero, performing feature selection. L2 regularization adds the sum of squared weights (w^2), which shrinks weights close to zero but never exactly zero, keeping all features but reducing their individual influence."
        },
        {
          question: "Explain the Vanishing and Exploding Gradient problems in deep neural networks.",
          shortAnswer: "Vanishing gradients occur when backpropagated gradients shrink exponentially in early layers, slowing training. Exploding gradients occur when gradients accumulate and grow exponentially, causing numerical instability. Mitigations include proper weight initialization (He/Glorot), Batch Normalization, residual connections, and gradient clipping."
        },
        {
          question: "Compare Precision and Recall. When is one preferred over the other?",
          shortAnswer: "Precision is True Positives / (True Positives + False Positives) — preferred when false positives are costly (e.g. spam detection). Recall is True Positives / (True Positives + False Negatives) — preferred when false negatives are critical/costly (e.g. cancer diagnosis)."
        }
      ];
    } else if (topic.includes("data") || topic.includes("structure")) {
      cards = [
        {
          question: "What is the key self-balancing rule of an AVL Tree?",
          shortAnswer: "An AVL tree is a self-balancing binary search tree. For every node, the height difference between left and right subtrees (the Balance Factor) must be strictly in {-1, 0, 1}. Balance factors of +2 or -2 trigger rebalancing rotations (LL, RR, LR, RL)."
        },
        {
          question: "Explain the differences between Contiguous Arrays and Dynamic ArrayLists.",
          shortAnswer: "Arrays have a fixed size allocated in a single block of contiguous memory, giving O(1) direct access. ArrayLists are dynamically resizable: when capacity is reached, they automatically allocate a larger array (usually 1.5x to 2x size) and copy all elements over, which is an O(N) operation in the worst case."
        },
        {
          question: "How do Linear Probing and Quadratic Probing resolve Hash Collisions?",
          shortAnswer: "Both are open-addressing collision resolution methods. Linear probing scans slots sequentially (i + 1, i + 2, etc.), which causes Primary Clustering. Quadratic Probing scans using a polynomial function (i + 1^2, i + 2^2, etc.), reducing primary clustering but still susceptible to secondary clustering."
        },
        {
          question: "Compare BFS and DFS in Graph Traversal.",
          shortAnswer: "BFS (Breadth-First Search) explores a graph level-by-level using a FIFO Queue, making it ideal for finding the shortest path in unweighted graphs. DFS (Depth-First Search) explores path branches as deep as possible before backtracking, utilizing a LIFO Stack (or recursion)."
        },
        {
          question: "What is the boundary check for Stack Overflow and Stack Underflow?",
          shortAnswer: "Stack Overflow occurs when pushing an element onto a stack that has reached its maximum size capacity limit. Stack Underflow occurs when popping or peeking an element from a stack that has a top pointer index of -1 (empty)."
        }
      ];
    } else if (topic.includes("thermo")) {
      cards = [
        {
          question: "Why is a 100% efficient Carnot heat engine physically impossible?",
          shortAnswer: "Carnot efficiency is defined as 1 - T_C / T_H. To achieve 100% thermal efficiency, the cold sink temperature (T_C) must be absolute zero (0 K). The Third Law of Thermodynamics states that absolute zero is unattainable in a finite number of steps, preventing 100% efficiency."
        },
        {
          question: "State the Kelvin-Planck and Clausius statements of the Second Law of Thermodynamics.",
          shortAnswer: "Kelvin-Planck states that it is impossible for a device operating in a cycle to receive heat from a single reservoir and produce a net amount of work. Clausius states that it is impossible to construct a device that operates in a cycle and transfers heat from a lower-temperature body to a higher-temperature body without net work input."
        },
        {
          question: "What is Exergy, and how is it related to entropy generation?",
          shortAnswer: "Exergy is the maximum useful work potential of a system relative to an environment baseline. The Gouy-Stodola theorem states that lost exergy (exergy destruction, I) is directly proportional to entropy generation: I = T_0 * S_gen, where T_0 is the dead state temperature."
        },
        {
          question: "What is the physical significance of the Clapeyron Equation?",
          shortAnswer: "The Clapeyron equation relates the slope of phase boundary lines on a P-T diagram to enthalpy change and volume change: dP/dT = L / (T * delta_v). It governs how boiling point/melting point changes with pressure."
        },
        {
          question: "What is the difference between open and closed systems regarding energy balances?",
          shortAnswer: "Closed systems exchange energy (heat/work) but not mass (dE = dQ - dW). Open systems allow mass flow crossing control borders, requiring the inclusion of flow work enthalpy (h = u + Pv) in the energy equations: dE/dt = Q_dot - W_dot + sum(m_in * h_in) - sum(m_out * h_out)."
        }
      ];
    } else if (topic.includes("machine") || topic.includes("design")) {
      cards = [
        {
          question: "How do fatigue limits differ under static versus cyclic stress loading?",
          shortAnswer: "Under static loading, components fail when stress exceeds yield or ultimate tensile strength. Under cyclic loading, components experience fatigue failure at stress levels far below yield strength. Failure occurs due to progressive micro-crack initiation and propagation under fluctuating loads."
        },
        {
          question: "What is the difference between the Goodman and Soderberg fatigue relations?",
          shortAnswer: "Both model fluctuating stresses. The Goodman line plots safe combinations of mean and alternating stress relative to the ultimate strength (S_ut): S_a/S_e + S_m/S_ut = 1. The Soderberg line is more conservative and uses the yield strength (S_yt): S_a/S_e + S_m/S_yt = 1."
        },
        {
          question: "What does the Sommerfeld number characterize in journal bearings?",
          shortAnswer: "The Sommerfeld number (S = (r/c)^2 * (mu * N)/P) is a dimensionless parameter that characterizes lubrication in hydrodynamic journal bearings. It incorporates clearance ratio, viscosity, rotation speed, and unit load, determining load capacity, friction, and minimum oil film thickness."
        },
        {
          question: "How do stress concentration singularities occur at fillet radii, and how do we mitigate them?",
          shortAnswer: "Stress concentrations occur at sharp geometric transitions (holes, notches, steps) where stress flow lines crowd. Fillet radii smooth this transition; increasing the fillet radius mitigates stress crowding, reducing the stress concentration factor K_t."
        },
        {
          question: "What is tooth root bending in spur gears, and how does the Lewis formula address it?",
          shortAnswer: "Tooth root bending represents the bending stress gear teeth experience at their base under tangential loading, modeled as a cantilever beam. The Lewis formula (sigma = W_t / (F * m * Y)) estimates this stress using a gear-specific form factor (Y)."
        }
      ];
    } else {
      // General dynamic flashcards based on the syllabus units/topics
      const units = syllabusStructure?.units || [];
      const topicsList = [];
      units.forEach(u => u.topics.forEach(t => topicsList.push({ unitName: u.name, topic: t })));
      
      const targetList = topicsList.slice(0, 5);
      if (targetList.length === 0) {
        targetList.push({ unitName: isProfessional ? "Competency 1" : "Unit 1", topic: "Core Principles" });
        targetList.push({ unitName: isProfessional ? "Competency 2" : "Unit 2", topic: "Analytical Models" });
        targetList.push({ unitName: isProfessional ? "Competency 3" : "Unit 3", topic: "Applied Problems" });
      }

      cards = targetList.map(item => ({
        question: isProfessional
          ? `Explain the core concepts, design trade-offs, and practical considerations of: "${item.topic}" (${item.unitName}).`
          : `Explain the fundamental concepts, governing parameters, and core principles of: "${item.topic}" (${item.unitName}).`,
        shortAnswer: isProfessional
          ? `A robust review of "${item.topic}" requires understanding its industry standards, typical scaling trade-offs, and how it is implemented in production systems using the STAR format.`
          : `A robust study review of "${item.topic}" requires understanding its basic definitions, physical equations, structural properties, and how it behaves under boundary constraints. Pay attention to how this concept scales under real-world operational loading.`
      }));
    }

    return (cards);
  }

  return null;
}
