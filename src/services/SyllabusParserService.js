/**
 * VivaSim - Syllabus Ingestion & Hierarchy Parser Service
 * Cleans course text documents and calls Gemini endpoints to expand input keywords.
 */

export const SyllabusParserService = {
  
  /**
   * Cleans raw text of redundant spaces and page numbers.
   */
  cleanRawText(text) {
    if (!text) return "";
    return text
      .replace(/\r\n/g, "\n")
      .replace(/\n\s*\n/g, "\n")
      .replace(/[ \t]+/g, " ")
      .trim();
  },

  /**
   * Parses structured outlines from a syllabus text stream using a client-side layout heuristic.
   * Falls back to a default mapped tree if text lacks clear modules.
   * @param {string} rawText - Cleaned text file.
   * @param {string} fallbackTopic - Mapped defaults.
   * @returns {object} Structured syllabus tree.
   */
  parseSyllabus(rawText, fallbackTopic = "Thermodynamics", duration = 5) {
    const cleaned = this.cleanRawText(rawText);
    
    // Attempt to derive a clean topic name from first line if fallbackTopic is generic
    let derivedTopic = fallbackTopic;
    if (fallbackTopic === "Custom Syllabus Practice" && cleaned) {
      const firstLine = cleaned.split("\n")[0].replace(/[#*_-]/g, "").trim();
      if (firstLine && firstLine.length > 3 && firstLine.length < 60) {
        derivedTopic = firstLine;
      }
    }

    const maxUnits = this.getTargetUnitsForDuration(duration);

    // Heuristic regex to locate Units / Modules / Competencies / Responsibilities
    const unitRegex = /(?:unit|module|chapter|section|competency|responsibility|requirement|domain|area)\s*\d*[:.-]?\s*([^\n]+)/gi;
    const units = [];
    
    let match;
    let index = 1;
    
    while ((match = unitRegex.exec(cleaned)) !== null && units.length < maxUnits) {
      const unitName = match[0].trim();
      // Look ahead to capture topics inside this unit
      const startIdx = match.index + match[0].length;
      const endIdx = cleaned.indexOf("Unit", startIdx) === -1 && cleaned.indexOf("Module", startIdx) === -1 && cleaned.indexOf("Competency", startIdx) === -1 && cleaned.indexOf("Responsibility", startIdx) === -1
        ? cleaned.length 
        : Math.min(
            cleaned.indexOf("Unit", startIdx) === -1 ? cleaned.length : cleaned.indexOf("Unit", startIdx),
            cleaned.indexOf("Module", startIdx) === -1 ? cleaned.length : cleaned.indexOf("Module", startIdx),
            cleaned.indexOf("Competency", startIdx) === -1 ? cleaned.length : cleaned.indexOf("Competency", startIdx),
            cleaned.indexOf("Responsibility", startIdx) === -1 ? cleaned.length : cleaned.indexOf("Responsibility", startIdx)
          );
      
      const chunk = cleaned.substring(startIdx, endIdx).trim();
      const subtopics = chunk
        .split(/[;\n,-]+/)
        .map(t => t.trim())
        .filter(t => t.length > 5 && t.length < 60);

      units.push({
        name: unitName,
        topics: subtopics.slice(0, 4) // cap at 4 topics for brevity
      });
      index++;
    }

    // Default heuristics if document parsing finds no explicit units
    if (units.length === 0) {
      return this.getDefaultHierarchy(derivedTopic, duration);
    }

    return {
      topic: derivedTopic,
      units: units
    };
  },

  /**
   * Requests the server-side Gemini API route to expand a single topic string into an expanded tree.
   * @param {string} topicString - e.g. "Marketing Management"
   * @returns {Promise<object>} Structured unit-topic JSON tree.
   */
  async expandTopicTree(topicString, mode = "academic", duration = 5) {
    try {
      const response = await fetch("/api/viva", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "expand-topic",
          topic: topicString,
          mode: mode,
          duration: duration
        })
      });

      if (!response.ok) throw new Error("API expansion request failed");
      const data = await response.json();
      return data;
    } catch (e) {
      console.warn("Topic expansion endpoint error, falling back to static schema:", e);
      return this.getDefaultHierarchy(topicString, duration);
    }
  },

  /**
   * Requests the server-side Gemini API route to parse raw syllabus text using LLM.
   * @param {string} rawText - Cleaned text.
   * @param {string} mode - "academic" | "professional"
   * @returns {Promise<object>} Structured units tree.
   */
  async parseSyllabusRemote(rawText, mode = "academic", duration = 5) {
    const response = await fetch("/api/viva", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "parse-syllabus",
        text: rawText,
        mode: mode,
        duration: duration
      })
    });

    if (!response.ok) throw new Error("API syllabus parsing failed");
    const data = await response.json();
    return data;
  },

  getTargetUnitsForDuration(duration) {
    const mins = parseInt(duration, 10) || 5;
    if (mins <= 5) return 2;   // 2 units
    if (mins <= 10) return 3;  // 3 units
    if (mins <= 15) return 4;  // 4 units
    return 5;                  // 5 units (20+ mins)
  },

  /**
   * Mapped fallback default structures for robust execution.
   */
  getDefaultHierarchy(topic, duration = 5) {
    const lower = topic.toLowerCase();
    const numUnits = this.getTargetUnitsForDuration(duration);
    let allUnits = [];
    let mappedTopic = topic;
    
    if (lower.includes("software engineer") || lower.includes("backend") || lower.includes("developer")) {
      mappedTopic = "Software Engineer (Backend)";
      allUnits = [
        { name: "Competency 1: System Design & Architecture", topics: ["Microservices vs Monoliths", "Scalability & Load Balancing", "Database Replication & Caching", "Message Queuing & Eventual Consistency"] },
        { name: "Competency 2: Algorithms & Concurrency", topics: ["High-Concurrency Execution", "Thread Pool Deadlocks", "Data Structures Complexity", "Asynchronous Processing Loops"] },
        { name: "Competency 3: Databases & Integrity", topics: ["SQL Indexing Performance", "NoSQL vs Relational Storage", "Distributed Transaction Sagas", "Cache Invalidation Strategies"] },
        { name: "Competency 4: Testing & CI/CD Pipelines", topics: ["Unit and Integration Testing", "Automated Build Workflows", "Containerization & Docker", "Blue-Green Deployments"] },
        { name: "Competency 5: API Security & Protocols", topics: ["OAuth2 & JWT Authentication", "Rate Limiting & Throttling", "HTTPS & TLS Handshakes", "CORS & Security Headers"] }
      ];
    } else if (lower.includes("product manager") || lower.includes("pm")) {
      mappedTopic = "Product Manager";
      allUnits = [
        { name: "Competency 1: Product Strategy & Prioritization", topics: ["Feature Prioritization Frameworks", "MVP Scope Definition", "Market Opportunity Analysis", "Go-To-Market Plans"] },
        { name: "Competency 2: Execution Analytics & Funnels", topics: ["A/B Testing Significance", "Funnel Conversion Optimization", "Onboarding Drop-off Diagnostics", "Retention Loop Design"] },
        { name: "Competency 3: Business & Product Metrics", topics: ["Customer Acquisition Cost", "Customer Lifetime Value", "North Star Metrics", "Churn Rate Analysis"] },
        { name: "Competency 4: User Research & Personas", topics: ["Qualitative Interview Techniques", "User Journey Mapping", "Usability Test Feedback", "Persona Segmentation Design"] },
        { name: "Competency 5: Roadmap & Stakeholder Alignment", topics: ["Quarterly OKR Planning", "Cross-Functional Cooperation", "Feature Defending Arguments", "Product Lifecycle Management"] }
      ];
    } else if (lower.includes("data scientist") || lower.includes("machine learning") || lower.includes("ml")) {
      mappedTopic = "Data Scientist";
      allUnits = [
        { name: "Competency 1: ML Model Fundamentals", topics: ["Supervised vs Unsupervised Models", "Bias-Variance Trade-off", "Regularization L1/L2/Dropout", "Model Overfitting Diagnostics"] },
        { name: "Competency 2: Data Engineering & Quality", topics: ["Feature Engineering Pipelines", "Imbalanced Class Strategies", "Outlier & Missing Data Handling", "Dimensionality Reduction PCA"] },
        { name: "Competency 3: Advanced Deep Learning", topics: ["Gradient Vanishing/Explosion", "Residual Connection Functions", "Precision vs Recall Balance", "Evaluation Metrics F1-score"] },
        { name: "Competency 4: Natural Language Processing", topics: ["Tokenization & Embeddings", "Transformer Self-Attention", "Large Language Model Tuning", "Text Classification Models"] },
        { name: "Competency 5: Model Deployment & MLOps", topics: ["Real-time Inference APIs", "Model Drift & Monitoring", "Batch Prediction Pipelines", "A/B Testing ML Models"] }
      ];
    } else if (lower.includes("data") || lower.includes("structure")) {
      mappedTopic = "Data Structures";
      allUnits = [
        { name: "Unit 1: Linear Data Structures", topics: ["Arrays & Arraylists", "Stack LIFO limits", "Queue FIFO indices", "Linked list traversal"] },
        { name: "Unit 2: Non-Linear Structures", topics: ["Binary Search Trees", "AVL self-balancing balance factor", "Red-black trees", "Graph representations"] },
        { name: "Unit 3: Algorithms & Hashing", topics: ["Hash collisions buckets", "Probing techniques", "Graph BFS queues", "DFS recursive stacks"] },
        { name: "Unit 4: Advanced Trees & Tries", topics: ["B-Trees & B+ Trees", "Trie prefix searches", "Segment tree range queries", "Heap priority queues"] },
        { name: "Unit 5: Dynamic Programming", topics: ["Memoization vs Tabulation", "Knapsack optimization", "Longest common subsequence", "State transition matrices"] }
      ];
    } else if (lower.includes("machine") || lower.includes("design")) {
      mappedTopic = "Machine Design";
      allUnits = [
        { name: "Unit 1: Structural Static & Fatigue Loading", topics: ["Static stress limits", "Alternating stress fatigue", "Goodman line diagrams", "Soderberg yield boundaries"] },
        { name: "Unit 2: Shafts & stress Concentrations", topics: ["Torsional stress shafts", "Stress flow singularties", "Fillet radii mitigation", "Shaft keys grooves"] },
        { name: "Unit 3: Bearings & Gears", topics: ["Sommerfeld lubrication coefficient", "Journal bearings eccentricity", "Spur root teeth bending", "Lewis stress AGMA values"] },
        { name: "Unit 4: Fasteners & Welded Joints", topics: ["Threaded bolt preloads", "Welded joint throat stresses", "Riveted connection shears", "Eccentric loading limits"] },
        { name: "Unit 5: Springs & Clutches", topics: ["Helical spring deflection", "Belleville spring stacks", "Uniform wear clutch torque", "Uniform pressure brake capacity"] }
      ];
    } else if (lower.includes("thermodynamics") || lower.includes("thermo")) {
      mappedTopic = "Thermodynamics";
      allUnits = [
        { name: "Unit 1: Fundamental Laws", topics: ["Energy conservation balances", "Kelvin-Planck statements", "Clausius cyclic inequalities", "Second law limitations"] },
        { name: "Unit 2: Ideal Cycles & Entropy", topics: ["Carnot thermal boundaries", "Reversible entropy degradation", "Lost exergy work", "Third law absolute zero"] },
        { name: "Unit 3: Advanced Applications", topics: ["Clapeyron phase slopes", "Maxwell boundary conversions", "Open control masses", "Closed piston borders"] },
        { name: "Unit 4: Gas Power & Refrigeration", topics: ["Otto and Diesel air standards", "Rankine steam regenerations", "Brayton gas turbine stages", "Vapor compression COP values"] },
        { name: "Unit 5: Chemical & Phase Equilibrium", topics: ["Gibbs phase rule components", "Chemical potential gradients", "Fugacity activity coefficients", "Combustion stoichiometry balances"] }
      ];
    } else {
      const formalSubject = topic.charAt(0).toUpperCase() + topic.slice(1);
      mappedTopic = formalSubject;
      allUnits = [
        { name: "Competency 1: Foundational Principles", topics: [`Introduction to ${formalSubject}`, "Core terminology", "Basic boundary conditions"] },
        { name: "Competency 2: Advanced Conceptual Analysis", topics: ["Secondary parameters", "Detailed mechanical models", "Exemplary calculations"] },
        { name: "Competency 3: Applied Real-world Scenarios", topics: ["System optimization limits", "Practical integration examples", "Analytical evaluations"] },
        { name: "Competency 4: Edge Cases & Diagnostics", topics: ["Failure mode diagnostics", "System bottlenecks", "Scalability limitations"] },
        { name: "Competency 5: Future Outlook & Standards", topics: ["Emerging methodologies", "Alternative architectures", "Industry standards"] }
      ];
    }

    return {
      topic: mappedTopic,
      units: allUnits.slice(0, numUnits)
    };
  }
};
