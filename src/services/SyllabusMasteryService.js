import { getFallbackSyllabus } from "../utils/mockData";

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
   * Updates mastery score for topics asked in the current session.
   * Decrements mastery slightly on poor performance (e.g. dynamic grades/confidence drops),
   * and increments mastery on high-quality responses (tags A, A+, B).
   */
  updateMastery(subjectName, syllabusStructure, askedTopics) {
    if (!syllabusStructure) return this.getMasteryData();
    const data = this.getMasteryData();

    // Ensure the subject structure is initialized in local storage
    if (!data[subjectName]) {
      data[subjectName] = {
        topic: subjectName,
        units: syllabusStructure.units.map(u => ({
          name: u.name,
          topics: [...u.topics]
        })),
        mastery: {}
      };
      
      syllabusStructure.units.forEach(u => {
        u.topics.forEach(t => {
          data[subjectName].mastery[t] = 0;
        });
      });
    }

    // Process each topic with dynamic feedback adjustments
    askedTopics.forEach(item => {
      const topicName = item.topic;
      const score = item.score || 0;
      
      if (topicName && data[subjectName].mastery[topicName] !== undefined) {
        const current = data[subjectName].mastery[topicName];
        if (score >= 80) {
          // strong answer increases mastery (capped at 100)
          data[subjectName].mastery[topicName] = Math.min(current + Math.round((score - 70) / 3), 100);
        } else if (score < 50) {
          // weak response penalizes topic mastery (minimum 0)
          data[subjectName].mastery[topicName] = Math.max(current - 5, 0);
        } else {
          // mediocre answer provides slight increase
          data[subjectName].mastery[topicName] = Math.min(current + 2, 100);
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

    const getThreeUnits = (subject) => {
      const syl = getFallbackSyllabus(subject);
      return {
        topic: syl.topic,
        units: syl.units.slice(0, 3)
      };
    };

    const thermoSyllabus = getThreeUnits("Thermodynamics");
    const dsSyllabus = getThreeUnits("Data Structures");
    const seSyllabus = getThreeUnits("Software Engineer (Backend)");
    const pmSyllabus = getThreeUnits("Product Manager");
    const dataSciSyllabus = getThreeUnits("Data Scientist");

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
    populate(seSyllabus, 84);
    populate(pmSyllabus, 75);
    populate(dataSciSyllabus, 80);

    this.saveMasteryData(data);
    return data;
  }
};
