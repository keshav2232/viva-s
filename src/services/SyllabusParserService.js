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

  getTargetUnitsForDuration(duration = 5) {
    const mins = parseInt(duration, 10) || 5;
    if (mins <= 5) return 3;
    if (mins <= 10) return 4;
    return 5;
  },

  getDefaultHierarchy(topic, duration = 5) {
    const numUnits = this.getTargetUnitsForDuration(duration);
    const syllabus = getFallbackSyllabus(topic);
    return {
      topic: syllabus.topic,
      units: syllabus.units.slice(0, numUnits)
    };
  }
};
