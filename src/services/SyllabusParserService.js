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
  parseSyllabus(rawText, fallbackTopic = "Thermodynamics") {
    const cleaned = this.cleanRawText(rawText);
    
    // Attempt to derive a clean topic name from first line if fallbackTopic is generic
    let derivedTopic = fallbackTopic;
    if (fallbackTopic === "Custom Syllabus Practice" && cleaned) {
      const firstLine = cleaned.split("\n")[0].replace(/[#*_-]/g, "").trim();
      if (firstLine && firstLine.length > 3 && firstLine.length < 60) {
        derivedTopic = firstLine;
      }
    }

    // Heuristic regex to locate Units / Modules / Competencies / Responsibilities
    const unitRegex = /(?:unit|module|chapter|section|competency|responsibility|requirement|domain|area)\s*\d*[:.-]?\s*([^\n]+)/gi;
    const units = [];
    
    let match;
    let index = 1;
    
    while ((match = unitRegex.exec(cleaned)) !== null && units.length < 5) {
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
      return this.getDefaultHierarchy(derivedTopic);
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
  async expandTopicTree(topicString, mode = "academic") {
    try {
      const response = await fetch("/api/viva", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "expand-topic",
          topic: topicString,
          mode: mode
        })
      });

      if (!response.ok) throw new Error("API expansion request failed");
      const data = await response.json();
      return data;
    } catch (e) {
      console.warn("Topic expansion endpoint error, falling back to static schema:", e);
      return this.getDefaultHierarchy(topicString);
    }
  },

  /**
   * Requests the server-side Gemini API route to parse raw syllabus text using LLM.
   * @param {string} rawText - Cleaned text.
   * @param {string} mode - "academic" | "professional"
   * @returns {Promise<object>} Structured units tree.
   */
  async parseSyllabusRemote(rawText, mode = "academic") {
    const response = await fetch("/api/viva", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "parse-syllabus",
        text: rawText,
        mode: mode
      })
    });

    if (!response.ok) throw new Error("API syllabus parsing failed");
    const data = await response.json();
    return data;
  },

  /**
   * Mapped fallback default structures for robust execution.
   */
  getDefaultHierarchy(topic) {
    const lower = topic.toLowerCase();
    
    if (lower.includes("software engineer") || lower.includes("backend") || lower.includes("developer")) {
      return {
        topic: "Software Engineer (Backend)",
        units: [
          { name: "Competency 1: System Design & Architecture", topics: ["Microservices vs Monoliths", "Scalability & Load Balancing", "Database Replication & Caching", "Message Queuing & Eventual Consistency"] },
          { name: "Competency 2: Algorithms & Concurrency", topics: ["High-Concurrency Execution", "Thread Pool Deadlocks", "Data Structures Complexity", "Asynchronous Processing Loops"] },
          { name: "Competency 3: Databases & Integrity", topics: ["SQL Indexing Performance", "NoSQL vs Relational Storage", "Distributed Transaction Sagas", "Cache Invalidation Strategies"] }
        ]
      };
    } else if (lower.includes("product manager") || lower.includes("pm")) {
      return {
        topic: "Product Manager",
        units: [
          { name: "Competency 1: Product Strategy & Prioritization", topics: ["Feature Prioritization Frameworks", "MVP Scope Definition", "Market Opportunity Analysis", "Go-To-Market Plans"] },
          { name: "Competency 2: Execution Analytics & Funnels", topics: ["A/B Testing Significance", "Funnel Conversion Optimization", "Onboarding Drop-off Diagnostics", "Retention Loop Design"] },
          { name: "Competency 3: Business & Product Metrics", topics: ["Customer Acquisition Cost", "Customer Lifetime Value", "North Star Metrics", "Churn Rate Analysis"] }
        ]
      };
    } else if (lower.includes("data scientist") || lower.includes("machine learning") || lower.includes("ml")) {
      return {
        topic: "Data Scientist",
        units: [
          { name: "Competency 1: ML Model Fundamentals", topics: ["Supervised vs Unsupervised Models", "Bias-Variance Trade-off", "Regularization L1/L2/Dropout", "Model Overfitting Diagnostics"] },
          { name: "Competency 2: Data Engineering & Quality", topics: ["Feature Engineering Pipelines", "Imbalanced Class Strategies", "Outlier & Missing Data Handling", "Dimensionality Reduction PCA"] },
          { name: "Competency 3: Advanced Deep Learning", topics: ["Gradient Vanishing/Explosion", "Residual Connection Functions", "Precision vs Recall Balance", "Evaluation Metrics F1-score"] }
        ]
      };
    } else if (lower.includes("data") || lower.includes("structure")) {
      return {
        topic: "Data Structures",
        units: [
          { name: "Unit 1: Linear Data Structures", topics: ["Arrays & Arraylists", "Stack LIFO limits", "Queue FIFO indices", "Linked list traversal"] },
          { name: "Unit 2: Non-Linear Structures", topics: ["Binary Search Trees", "AVL self-balancing balance factor", "Red-black trees", "Graph representations"] },
          { name: "Unit 3: Algorithms & Hashing", topics: ["Hash collisions buckets", "Probing techniques", "Graph BFS queues", "DFS recursive stacks"] }
        ]
      };
    } else if (lower.includes("machine") || lower.includes("design")) {
      return {
        topic: "Machine Design",
        units: [
          { name: "Unit 1: Structural Static & Fatigue Loading", topics: ["Static stress limits", "Alternating stress fatigue", "Goodman line diagrams", "Soderberg yield boundaries"] },
          { name: "Unit 2: Shafts & stress Concentrations", topics: ["Torsional stress shafts", "Stress flow singularties", "Fillet radii mitigation", "Shaft keys grooves"] },
          { name: "Unit 3: Bearings & Gears", topics: ["Sommerfeld lubrication coefficient", "Journal bearings eccentricity", "Spur root teeth bending", "Lewis stress AGMA values"] }
        ]
      };
    } else if (lower.includes("thermodynamics")) {
      return {
        topic: "Thermodynamics",
        units: [
          { name: "Unit 1: Fundamental Laws", topics: ["Energy conservation balances", "Kelvin-Planck statements", "Clausius cyclic inequalities", "Second law limitations"] },
          { name: "Unit 2: Ideal Cycles & Entropy", topics: ["Carnot thermal boundaries", "Reversible entropy degradation", "Lost exergy work", "Third law absolute zero"] },
          { name: "Unit 3: Advanced Applications", topics: ["Clapeyron phase slopes", "Maxwell boundary conversions", "Open control masses", "Closed piston borders"] }
        ]
      };
    }

    // Generic fallback expansion
    return {
      topic: topic,
      units: [
        { name: "Competency 1: Foundational Principles", topics: [`Introduction to ${topic}`, "Core terminology", "Basic boundary conditions"] },
        { name: "Competency 2: Advanced Conceptual Analysis", topics: ["Secondary parameters", "Detailed mechanical models", "Exemplary calculations"] },
        { name: "Competency 3: Applied Real-world Scenarios", topics: ["System optimization limits", "Practical integration examples", "Analytical evaluations"] }
      ]
    };
  }
};
