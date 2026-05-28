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

    // Heuristic regex to locate Units / Modules
    const unitRegex = /(?:unit|module|chapter|section)\s*\d+[:.-]?\s*([^\n]+)/gi;
    const units = [];
    
    let match;
    let index = 1;
    
    while ((match = unitRegex.exec(cleaned)) !== null && units.length < 5) {
      const unitName = match[0].trim();
      // Look ahead to capture topics inside this unit
      const startIdx = match.index + match[0].length;
      const endIdx = cleaned.indexOf("Unit", startIdx) === -1 && cleaned.indexOf("Module", startIdx) === -1
        ? cleaned.length 
        : Math.min(
            cleaned.indexOf("Unit", startIdx) === -1 ? cleaned.length : cleaned.indexOf("Unit", startIdx),
            cleaned.indexOf("Module", startIdx) === -1 ? cleaned.length : cleaned.indexOf("Module", startIdx)
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
  async expandTopicTree(topicString) {
    try {
      const response = await fetch("/api/viva", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "expand-topic",
          topic: topicString
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
   * @returns {Promise<object>} Structured units tree.
   */
  async parseSyllabusRemote(rawText) {
    const response = await fetch("/api/viva", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "parse-syllabus",
        text: rawText
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
    
    if (lower.includes("data") || lower.includes("structure")) {
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
          { name: "Unit 3: Bearings & Gears", topics: ["Sommerfeld lubrication coefficient", "Journal bearings eccentrity", "Spur root teeth bending", "Lewis stress AGMA values"] }
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
        { name: "Unit 1: Foundational Principles", topics: [`Introduction to ${topic}`, "Core terminology", "Basic boundary conditions"] },
        { name: "Unit 2: Advanced Conceptual Analysis", topics: ["Secondary parameters", "Detailed mechanical models", "Exemplary calculations"] },
        { name: "Unit 3: Applied Real-world Scenarios", topics: ["System optimization limits", "Practical integration examples", "Analytical evaluations"] }
      ]
    };
  }
};
