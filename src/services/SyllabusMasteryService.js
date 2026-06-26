/**
 * VivaSim - Syllabus Mastery Tracker Service
 * Manages loading, saving, updating, and initializing syllabus mastery data in localStorage.
 */

export const SyllabusMasteryService = {
  /**
   * Retrieves the user's syllabus mastery database.
   */
  getMasteryData() {
    if (typeof window === "undefined") return {};
    const stored = localStorage.getItem("vivasim_mastery");
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error("Failed parsing mastery data:", e);
      }
    }
    return {};
  },

  /**
   * Overwrites the user's syllabus mastery database.
   */
  saveMasteryData(data) {
    if (typeof window === "undefined") return;
    localStorage.setItem("vivasim_mastery", JSON.stringify(data));
  },

  /**
   * Updates subtopic mastery dynamically following a completed viva session.
   * Uses a rolling average formula favoring the latest performance.
   */
  updateMastery(subjectName, syllabusStructure, askedTopics) {
    if (!syllabusStructure) return this.getMasteryData();
    const data = this.getMasteryData();
    
    if (!data[subjectName]) {
      // Initialize subject structure if not existing
      data[subjectName] = {
        topic: subjectName,
        units: syllabusStructure.units.map(u => ({
          name: u.name,
          topics: [...u.topics]
        })),
        mastery: {}
      };
      
      // Set initial mastery of all topics to 0
      syllabusStructure.units.forEach(u => {
        u.topics.forEach(t => {
          data[subjectName].mastery[t] = 0;
        });
      });
    }

    // Update tested subtopics
    const subjectMastery = data[subjectName].mastery;
    askedTopics.forEach(item => {
      const topicName = item.topic;
      const correctness = item.metrics?.correctness || 0;
      if (topicName && subjectMastery[topicName] !== undefined) {
        const oldScore = subjectMastery[topicName];
        if (oldScore === 0) {
          subjectMastery[topicName] = correctness;
        } else {
          // Dynamic rolling average (30% historical weight, 70% current performance)
          subjectMastery[topicName] = Math.round(oldScore * 0.3 + correctness * 0.7);
        }
      }
    });

    this.saveMasteryData(data);
    return data;
  },

  /**
   * Pre-populates the mastery database with realistic values on first startup
   * if default sessions are present, creating an instantly functional dashboard demo.
   */
  initializeDefaultMastery(defaultSessions) {
    const data = this.getMasteryData();
    if (Object.keys(data).length > 0) return data;
    if (!defaultSessions || defaultSessions.length === 0) return {};

    const thermoSyllabus = {
      topic: "Thermodynamics",
      units: [
        { name: "Unit 1: Fundamental Laws", topics: ["Energy conservation balances", "Kelvin-Planck statements", "Clausius cyclic inequalities", "Second law limitations"] },
        { name: "Unit 2: Ideal Cycles & Entropy", topics: ["Carnot thermal boundaries", "Reversible entropy degradation", "Lost exergy work", "Third law absolute zero"] },
        { name: "Unit 3: Advanced Applications", topics: ["Clapeyron phase slopes", "Maxwell boundary conversions", "Open control masses", "Closed piston borders"] }
      ]
    };

    const dsSyllabus = {
      topic: "Data Structures",
      units: [
        { name: "Unit 1: Linear Data Structures", topics: ["Arrays & Arraylists", "Stack LIFO limits", "Queue FIFO indices", "Linked list traversal"] },
        { name: "Unit 2: Non-Linear Structures", topics: ["Binary Search Trees", "AVL self-balancing balance factor", "Red-black trees", "Graph representations"] },
        { name: "Unit 3: Algorithms & Hashing", topics: ["Hash collisions buckets", "Probing techniques", "Graph BFS queues", "DFS recursive stacks"] }
      ]
    };

    const populate = (syllabus, score) => {
      const subject = syllabus.topic;
      data[subject] = {
        topic: subject,
        units: syllabus.units,
        mastery: {}
      };
      
      syllabus.units.forEach((u, uIdx) => {
        u.topics.forEach((t) => {
          // Add minor realistic deviations
          const deviation = Math.round((Math.random() * 12 - 6));
          // Unit 3 remains unattempted (0%) to encourage user action, others are populated
          const subtopicScore = uIdx === 2 ? 0 : Math.min(Math.max(score + deviation, 40), 98);
          data[subject].mastery[t] = subtopicScore;
        });
      });
    };

    const dsSession = defaultSessions.find(s => s.subject === "Data Structures");
    const thermoSession = defaultSessions.find(s => s.subject === "Thermodynamics");

    populate(dsSyllabus, dsSession ? dsSession.score : 82);
    populate(thermoSyllabus, thermoSession ? thermoSession.score : 78);

    this.saveMasteryData(data);
    return data;
  }
};
