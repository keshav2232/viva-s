"use client";

import React, { useState, useEffect, useRef } from "react";
import { VoiceManager } from "@/services/voiceManager";
import styles from "./Results.module.css";
import { computeOverallScore } from "@/utils/scoring";

export default function Results({ resultsData, onRestart, onGoDashboard }) {
  const [activeTab, setActiveTab] = useState("overview"); // "overview" | "questions" | "delivery" | "plan"
  const [selected, setSelected] = useState(0);
  const [qFilter, setQFilter] = useState("all"); // "all" | "strong" | "work"
  const [visibleSeries, setVisibleSeries] = useState({ confidence: true, calm: true, fluency: true });
  const [sortLowFirst, setSortLowFirst] = useState(false);
  const [expandedMetric, setExpandedMetric] = useState(null);
  const [showExpected, setShowExpected] = useState(false);
  const [doneDays, setDoneDays] = useState({});
  const [liveMsg, setLiveMsg] = useState("");
  const tabsRef = useRef(null);
  const [playingReplayIndex, setPlayingReplayIndex] = useState(null);
  const [pastSessionsAvg, setPastSessionsAvg] = useState(null);
  const [displayedScore, setDisplayedScore] = useState(0);
  const [hindsightData, setHindsightData] = useState(resultsData.hindsightData || null);
  const [hindsightLoading, setHindsightLoading] = useState(resultsData.hindsightLoading || false);


  const {
    endedEarly,
    askedQuestions,
    askedQuestionsObjects,
    answerTranscripts,
    detectedEmotions,
    weakConcepts,
    confidenceEvolution,
    subjectName,
    isLastMinute,
    isMockExternal,
    examinerPersonality,
    mode
  } = resultsData;

  const isProfessional = mode === "professional";

  // Cleanup active audio playbacks on unmount; open the report from the top
  useEffect(() => {
    window.scrollTo(0, 0);
    return () => {
      VoiceManager.stop();
    };
  }, []);

  // Poll for async hindsight data resolution
  useEffect(() => {
    if (hindsightData || !resultsData.hindsightLoading) {
      // Already resolved or never loading
      if (resultsData.hindsightData && !hindsightData) {
        setHindsightData(resultsData.hindsightData);
        setHindsightLoading(false);
      }
      return;
    }
    const pollInterval = setInterval(() => {
      if (resultsData.hindsightData) {
        setHindsightData(resultsData.hindsightData);
        setHindsightLoading(false);
        clearInterval(pollInterval);
      } else if (!resultsData.hindsightLoading) {
        setHindsightLoading(false);
        clearInterval(pollInterval);
      }
    }, 800);
    return () => clearInterval(pollInterval);
  }, [resultsData, hindsightData]);

  // 1. Calculate Scorecard Averages
  const totalRounds = detectedEmotions.length;

  let subjectUnderstanding = 0;
  let vocalConfidence = 0;
  let clarityOfComm = 0;
  let conceptualDepth = 0;
  let handlingPressure = 0;
  let consistency = 0;

  if (detectedEmotions.length > 0) {
    let correctnessSum = 0, confSum = 0, clarSum = 0, depthSum = 0, pressureSum = 0;
    detectedEmotions.forEach(emo => {
      correctnessSum += emo.correctness ?? 80;
      confSum += emo.confidence ?? 80;
      clarSum += emo.clarity ?? 80;
      depthSum += emo.completeness ?? 75;
      pressureSum += (100 - (emo.nervousness ?? 20));
    });

    subjectUnderstanding = Math.round(correctnessSum / totalRounds);
    vocalConfidence = Math.round(confSum / totalRounds);
    clarityOfComm = Math.round(clarSum / totalRounds);
    conceptualDepth = Math.round(depthSum / totalRounds);
    handlingPressure = Math.round(pressureSum / totalRounds);

    // Consistency is calculated based on correctness variation (higher consistency = smaller differences)
    let differences = 0;
    const avgCorrectness = correctnessSum / totalRounds;
    detectedEmotions.forEach(emo => {
      differences += Math.pow((emo.correctness ?? 80) - avgCorrectness, 2);
    });
    const standardDev = Math.sqrt(differences / totalRounds);
    consistency = Math.round(Math.max(100 - (standardDev * 2.2), 58));
  }

  // Lexical Speech Diagnostics Calculations
  const fillerCounts = { um: 0, ah: 0, like: 0, basically: 0, actually: 0, "you know": 0 };
  let totalWordsCount = 0;
  let totalFillerCount = 0;

  answerTranscripts.forEach(text => {
    const cleanText = (text || "").toLowerCase().replace(/[^\w\s']/g, " ");
    const words = cleanText.split(/\s+/).filter(w => w.length > 0);
    totalWordsCount += words.length;

    words.forEach(w => {
      if (w === "um" || w === "umm") {
        fillerCounts["um"]++;
        totalFillerCount++;
      } else if (w === "ah" || w === "ahh" || w === "uh" || w === "uhm") {
        fillerCounts["ah"]++;
        totalFillerCount++;
      } else if (w === "like") {
        fillerCounts["like"]++;
        totalFillerCount++;
      } else if (w === "basically") {
        fillerCounts["basically"]++;
        totalFillerCount++;
      } else if (w === "actually") {
        fillerCounts["actually"]++;
        totalFillerCount++;
      }
    });

    let youKnowIndex = cleanText.indexOf("you know");
    while (youKnowIndex !== -1) {
      fillerCounts["you know"]++;
      totalFillerCount++;
      youKnowIndex = cleanText.indexOf("you know", youKnowIndex + 8);
    }
  });

  const fillerConcentration = totalWordsCount > 0
    ? ((totalFillerCount / totalWordsCount) * 100).toFixed(1)
    : 0;

  let lexicalScore = 70;
  let uniqueWordsCount = 0;
  let advancedWordsCount = 0;

  if (totalWordsCount > 0) {
    const allWords = answerTranscripts.join(" ").toLowerCase().replace(/[^\w\s']/g, " ").split(/\s+/).filter(w => w.length > 0);
    const uniqueWords = new Set(allWords);
    uniqueWordsCount = uniqueWords.size;

    const commonWords = ["the", "and", "that", "this", "with", "have", "from", "they", "will", "would", "their"];
    advancedWordsCount = allWords.filter(w => w.length > 6 && !commonWords.includes(w)).length;

    const diversityRatio = uniqueWordsCount / (allWords.length || 1);
    const advancedRatio = advancedWordsCount / (allWords.length || 1);

    lexicalScore = Math.min(
      Math.max(
        Math.round((diversityRatio * 60) + (advancedRatio * 180) + (subjectUnderstanding * 0.4)),
        45
      ),
      99
    );
  }

  let maturityLevel = "";
  let maturityDesc = "";
  if (isProfessional) {
    if (lexicalScore >= 88) {
      maturityLevel = "Principal Architect";
      maturityDesc = "Uses precise systems nomenclature, high vocabulary diversity, and highly sophisticated semantic structure.";
    } else if (lexicalScore >= 75) {
      maturityLevel = "Senior Engineer";
      maturityDesc = "Clear, domain-appropriate vocabulary with strong terminology choices and moderate structural variety.";
    } else if (lexicalScore >= 60) {
      maturityLevel = "Associate Engineer";
      maturityDesc = "Competent domain terms but relies on conversational language rather than precise engineering formulas.";
    } else {
      maturityLevel = "Junior Apprentice";
      maturityDesc = "Repetitive phrasing, low terminology variety, and heavy reliance on generic descriptions.";
    }
  } else {
    if (lexicalScore >= 88) {
      maturityLevel = "Graduate Fellow";
      maturityDesc = "Exhibits peerless academic nomenclature, high semantic variety, and strict first-principles phrasing.";
    } else if (lexicalScore >= 75) {
      maturityLevel = "Senior Scholar";
      maturityDesc = "Strong command of course vocabulary, clear conceptual definitions, and rich terminology range.";
    } else if (lexicalScore >= 60) {
      maturityLevel = "Junior Scholar";
      maturityDesc = "Good general understanding but uses layperson descriptions instead of precise textbook phrasing.";
    } else {
      maturityLevel = "Undergraduate Sophomore";
      maturityDesc = "Highly repetitive terminology, conversational structures, and minimal academic vocabulary range.";
    }
  }

  const detectFallacies = () => {
    const detections = [];

    answerTranscripts.forEach((ans, idx) => {
      const qObj = askedQuestionsObjects && askedQuestionsObjects[idx] ? askedQuestionsObjects[idx] : null;
      const topicText = qObj ? qObj.topic : "Syllabus Topic";
      const emo = detectedEmotions[idx] || {};

      const cleanAns = (ans || "").toLowerCase();

      const deflectionPhrases = ["basically", "essentially", "as we know", "it depends", "high level overview", "general explanation"];
      const containsDeflection = deflectionPhrases.some(phrase => cleanAns.includes(phrase));

      if (containsDeflection && (emo.correctness ?? 80) < 68) {
        detections.push({
          round: idx + 1,
          topic: topicText,
          type: "Cognitive Deflection",
          marker: "Used vague qualifier phrase",
          fix: "Avoid buffer phrases like 'essentially' or 'it depends' to stall. Directly present the first-principles formulas or structural patterns first."
        });
        return;
      }

      if (topicText && topicText.length > 3) {
        const cleanTopic = topicText.toLowerCase().replace(/[^\w\s]/g, " ");
        const topicWords = cleanTopic.split(/\s+/).filter(w => w.length > 3);
        if (topicWords.length > 0) {
          const occurrences = topicWords.reduce((acc, word) => {
            // Escape any special regex characters to prevent SyntaxError
            const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`\\b${escapedWord}\\b`, "g");
            return acc + (cleanAns.match(regex) || []).length;
          }, 0);

          if (occurrences >= 3 && (emo.correctness ?? 80) < 65) {
            detections.push({
              round: idx + 1,
              topic: topicText,
              type: "Circular Argumentation",
              marker: `Repeated search terms heavily (${occurrences} times)`,
              fix: "Rather than repeating the question terms, define the underlying variables, mechanical constants, or memory constraints."
            });
            return;
          }
        }
      }

      const hasAbsolute = /\b(always|never|completely|impossible)\b/.test(cleanAns);
      if (hasAbsolute && (emo.correctness ?? 80) < 70) {
        detections.push({
          round: idx + 1,
          topic: topicText,
          type: "Unqualified Absolute",
          marker: "Used absolute boundaries ('always'/'never')",
          fix: "Engineering and physical systems are governed by boundary limits. Frame responses using qualifiers (e.g. 'under transient states' or 'within load capacity')."
        });
      }
    });

    return detections;
  };

  let avgWpm = 0;
  if (detectedEmotions.length > 0) {
    let wpmSum = 0;
    detectedEmotions.forEach((emo, idx) => {
      const answer = answerTranscripts[idx] || "";
      const wordCount = answer.split(/\s+/).filter(w => w.length > 0).length;
      const wpmVal = emo.wpm || Math.round(wordCount / 0.4); // assume 24s answers as fallback
      wpmSum += wpmVal;
    });
    avgWpm = Math.round(wpmSum / totalRounds);
  }

  let pacingCategory = "Optimal Professional";
  let pacingColor = "var(--color-success)";
  let pacingBg = "var(--color-success-bg)";
  if (avgWpm < 90) {
    pacingCategory = "Hesitant & Slow";
    pacingColor = "hsl(0, 60%, 42%)";
    pacingBg = "hsl(0, 50%, 93%)";
  } else if (avgWpm < 110) {
    pacingCategory = "Deliberate & Measured";
    pacingColor = "hsl(38, 85%, 45%)";
    pacingBg = "hsl(38, 70%, 93%)";
  } else if (avgWpm > 170) {
    pacingCategory = "Rushed / Nervous Spike";
    pacingColor = "hsl(0, 60%, 42%)";
    pacingBg = "hsl(0, 50%, 93%)";
  } else if (avgWpm > 150) {
    pacingCategory = "Accelerated Pacing";
    pacingColor = "hsl(38, 85%, 45%)";
    pacingBg = "hsl(38, 70%, 93%)";
  }

  const needleAngle = Math.min(Math.max((avgWpm / 240) * 180 - 90, -90), 90);

  const overallScore = computeOverallScore(detectedEmotions, endedEarly);

  // Smooth count-up for the headline score (instant when the user prefers reduced motion)
  useEffect(() => {
    if (overallScore <= 0) return;
    const reduce = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reduce ? 0 : 1100;
    const start = performance.now();
    let raf;
    const tick = (now) => {
      const t = duration === 0 ? 1 : Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayedScore(Math.round(overallScore * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [overallScore]);
  const shownScore = overallScore > 0 ? displayedScore : 0;

  // Restore / persist the 5-day plan checklist per subject
  const planKey = `vivasim_plan_${subjectName}`;
  useEffect(() => {
    try {
      const saved = localStorage.getItem(planKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        setTimeout(() => setDoneDays(parsed), 0);
      }
    } catch { /* storage unavailable */ }
  }, [planKey]);
  const toggleDay = (day) => {
    setDoneDays((prev) => {
      const next = { ...prev, [day]: !prev[day] };
      try { localStorage.setItem(planKey, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  // Load prior average score for historical growth computation
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("vivasim_sessions");
        if (stored) {
          const parsed = JSON.parse(stored);
          // Filter out this current session to find previous ones
          const past = parsed.filter(p => p.subject === subjectName);
          if (past.length > 0) {
            const sum = past.reduce((acc, curr) => acc + curr.score, 0);
            setTimeout(() => {
              setPastSessionsAvg(Math.round(sum / past.length));
            }, 0);
          }
        }
      } catch (e) {
        console.warn("Failed loading historic sessions averages:", e);
      }
    }
  }, [subjectName]);

  const generate5DayPlan = () => {
    // Collect all concepts that need revision
    const allTopicsToReview = [...new Set([...(weakConcepts || []), ...(revisions || [])])];

    // Default fallback topics if nothing is diagnosed
    const fallbackTopics = isProfessional
      ? ["System design trade-offs", "Data consistency scaling", "API interface design patterns", "STAR response structure review"]
      : (subjectName === "Data Structures"
        ? ["BST insert & delete operations", "Stack overflow checks", "Double hashing probing", "Graph traversal state space"]
        : ["Clapeyron phase transitions", "Exergy entropy degradation calculations", "Maxwell conversions", "Carnot thermal bounds"]);

    // Make sure we have enough topics to distribute
    while (allTopicsToReview.length < 5) {
      const unusedFallback = fallbackTopics.find(t => !allTopicsToReview.includes(t));
      if (unusedFallback) {
        allTopicsToReview.push(unusedFallback);
      } else {
        allTopicsToReview.push(fallbackTopics[allTopicsToReview.length % fallbackTopics.length]);
      }
    }

    // Build the 5 days
    if (isProfessional) {
      return [
        {
          day: 1,
          focus: allTopicsToReview[0] || "Core Domain Concepts",
          actions: ["Define core system patterns", "Identify engineering trade-offs", "Sketch high-level architecture diagram"],
          time: "45 Mins"
        },
        {
          day: 2,
          focus: allTopicsToReview[1] || "System Scaling & Scenarios",
          actions: ["Analyze horizontal vs vertical scaling limits", "Verify distributed system failure modes", "Solve 2 scenario design problems"],
          time: "50 Mins"
        },
        {
          day: 3,
          focus: allTopicsToReview[2] || "Comparative Analysis",
          actions: ["Create comparison table for databases or protocols", "List key advantages & disadvantages", "Use flashcards to self-test domain vocabulary"],
          time: "40 Mins"
        },
        {
          day: 4,
          focus: allTopicsToReview[3] || "Advanced Architectures",
          actions: ["Analyze database locking and index bottlenecks", "Explain queue-based asynchronous limits", "Take a 5-question mock technical drill"],
          time: "60 Mins"
        },
        {
          day: 5,
          focus: allTopicsToReview[4] || "Comprehensive Practice",
          actions: ["Execute a full timed mock interview practice session", "Review remaining diagnostic gaps", "Practice mock STAR answers out loud to a peer/AI"],
          time: "45 Mins"
        }
      ];
    }

    return [
      {
        day: 1,
        focus: allTopicsToReview[0] || "Foundational Definitions",
        actions: ["Define core definitions", "Identify active formulas", "Draw a summary block diagram"],
        time: "45 Mins"
      },
      {
        day: 2,
        focus: allTopicsToReview[1] || "Mathematical Derivations",
        actions: ["Perform textbook derivations", "Verify boundary cases", "Solve at least 2 practice problems"],
        time: "50 Mins"
      },
      {
        day: 3,
        focus: allTopicsToReview[2] || "Comparative Analysis",
        actions: ["Create comparison table for different modes", "List key advantages & disadvantages", "Use Flashcards to self-test"],
        time: "40 Mins"
      },
      {
        day: 4,
        focus: allTopicsToReview[3] || "Advanced Applications",
        actions: ["Analyze stress failure conditions or complexity cases", "Explain real-world scaling limits", "Take a 5-question mock test"],
        time: "60 Mins"
      },
      {
        day: 5,
        focus: allTopicsToReview[4] || "Comprehensive Review",
        actions: ["Execute a full timed VivaSim mock practice exam", "Review remaining weak notes", "Explain concepts out loud to a peer/AI"],
        time: "45 Mins"
      }
    ];
  };

  const handleDownloadSchedule = () => {
    let md = isProfessional ? `# AI Preparation Roadmap: ${subjectName}\n\n` : `# AI Study Plan: ${subjectName}\n\n`;
    md += isProfessional ? `**Prepared For**: Candidate\n` : `**Prepared For**: Student Scholar\n`;
    md += `**Date Generated**: ${new Date().toLocaleDateString()}\n`;
    md += isProfessional ? `**Target Role Improvement Focus**: Based on performance evaluation: **${overallScore}%**\n\n` : `**Target Score Improvement Focus**: Based on performance evaluation: **${overallScore}%**\n\n`;

    md += `## Performance Summary & Diagnosed Gaps\n`;
    md += isProfessional
      ? `* **Diagnosed Weak Competencies**: ${weakConcepts.length > 0 ? weakConcepts.join(", ") : "None detected (Minor polish needed)"}\n`
      : `* **Diagnosed Weak Concepts**: ${weakConcepts.length > 0 ? weakConcepts.join(", ") : "None detected (Minor polish needed)"}\n`;
    md += isProfessional
      ? `* **Recommended Development Areas**: ${revisions.join(", ")}\n\n`
      : `* **Recommended Revision Units**: ${revisions.join(", ")}\n\n`;

    md += isProfessional ? `## 5-Day Targeted Preparation Roadmap\n\n` : `## 5-Day Targeted Study Roadmap\n\n`;
    md += `| Day | Focus Area | Action Items | Time Commitment |\n`;
    md += `| :--- | :--- | :--- | :--- |\n`;

    const planDays = generate5DayPlan();
    planDays.forEach(day => {
      md += `| **Day ${day.day}** | ${day.focus} | ${day.actions.join("; ")} | ${day.time} |\n`;
    });

    md += isProfessional ? `\n## Core Professional Interview Tips\n` : `\n## Core Pedagogical Study Tips\n`;
    md += isProfessional
      ? `1. **STAR Format**: Answer behavioral and technical scenarios by outlining Situation, Task, Action, and Result.\n`
      : `1. **Active Recall**: Don't just re-read. Prompt yourself with "Quick Cram" flashcards or explain the concept aloud.\n`;
    md += isProfessional
      ? `2. **Incremental Feedback**: Take another targeted PrepSim mock interview session after Day 3 to measure progress.\n`
      : `2. **Incremental Feedback**: Take another targeted VivaSim session on this subject after Day 3 to measure progress.\n`;
    md += isProfessional
      ? `3. **Spaced Repetition**: Re-test yourself on Day 5 specifically on the items under the *Weak Competencies* list.\n\n`
      : `3. **Spaced Repetition**: Re-test yourself on Day 5 specifically on the items under the *Weak Concepts* list.\n\n`;
    md += isProfessional
      ? `*Generated automatically by PrepSim. Build professional confidence through high-fidelity simulation.*`
      : `*Generated automatically by VivaSim. Build academic confidence through high-fidelity simulation.*`;

    const blob = new Blob([md], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", isProfessional ? `PrepPlan_${subjectName.replace(/\s+/g, "_")}.md` : `StudyPlan_${subjectName.replace(/\s+/g, "_")}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 2. Bluff Probability Index Calculation
  let bluffCount = 0;
  if (detectedEmotions.length > 0) {
    detectedEmotions.forEach(emo => {
      if (emo.tag === "Bluffing") bluffCount++;
    });
  }
  const bluffProb = Math.min(
    (bluffCount * 25) +
    (clarityOfComm > 70 && subjectUnderstanding < 62 ? 30 : 0) +
    (handlingPressure > 78 && conceptualDepth < 64 ? 12 : 0) +
    (isMockExternal ? 8 : 0),
    95
  );

  // Set Verdict labels
  let gradeLabel = isProfessional ? "Strong Candidate (Good Fit)" : "Upper Second Class Honor";
  let evaluationVerdict = isProfessional
    ? "Competent general performance. Addressed core competencies confidently with minor pauses when pressed on deep technical trade-offs."
    : "Competent general understanding. Handled core subjects confidently with minor pauses when pressed on deep mechanisms.";

  if (totalRounds === 0) {
    gradeLabel = "No Responses Submitted";
    evaluationVerdict = isProfessional
      ? "The mock interview session was terminated before any questions were answered. No metrics or diagnostics could be recorded."
      : "The oral examination was terminated before any questions were answered. No metrics or diagnostics could be recorded.";
  } else if (overallScore >= 80) {
    gradeLabel = isProfessional ? "Recommended Hire" : "First Class Honor (Distinction)";
    evaluationVerdict = isProfessional
      ? `Outstanding interview presentation. You demonstrated excellent technical depth (${clarityOfComm}%), clear engineering trade-offs, structured communication, and successfully handled challenging follow-up questions.`
      : `Outstanding presentation. You answered with strong cognitive clarity (${clarityOfComm}%), solid semantic phrasing, and successfully countered deep cross-examinations.`;
  } else if (overallScore < 65) {
    gradeLabel = isProfessional ? "Needs Role Review" : "Requires Conceptual Review";
    evaluationVerdict = isProfessional
      ? "Your answers lacked structured technical frameworks or STAR methodology highlights. High hesitation or nervousness indicators affected your communication clarity."
      : "Your answers lacked structured academic terminology. High uncertainty or hesitation markers significantly degraded speaking clarity scores.";
  }

  // Branch default strengths/weaknesses if empty
  let strengths = resultsData.dynamicStrengths || [];
  let weaknesses = resultsData.dynamicWeaknesses || [];
  let revisions = resultsData.dynamicRevisions || [];

  if (strengths.length === 0) {
    if (subjectName === "Thermodynamics") {
      strengths = [
        "Excellent logical layout of the Second Law of thermodynamics and entropy limits.",
        "Clear articulation of temperature gradients and heat rejection constraints."
      ];
      weaknesses = [
        "Slight terminology confusion when asked to define phase boundary slope formulas.",
        "Weak exergy boundary separation under open controlling volumes."
      ];
      revisions = ["Carnot parameters", "Clausius inequality integration", "Clapeyron equation derivations"];
    } else {
      strengths = [
        "Maintained reasonable fluency and structure across core subject areas.",
        "Successfully articulated basic definitions under examiner stress."
      ];
      weaknesses = ["No severe conceptual errors detected; minor hesitation under pressure."];
      revisions = ["Fundamental Laws", "System optimization limits"];
    }
  }

  // 3. Estimate Revision Study Times
  const getSuggestedRevisionPills = () => {
    return revisions.map((rev, idx) => {
      // lower scorecard averages yield more suggested time
      let suggestedTime = 30;
      if (subjectUnderstanding < 65) suggestedTime = 60;
      else if (subjectUnderstanding < 78) suggestedTime = 45;

      return {
        topic: rev,
        time: `~${suggestedTime} mins suggested study time`
      };
    });
  };

  // 4. Professor Mode Replay Voice Synthesis
  const handleReplayVoice = (speechText, idx) => {
    if (playingReplayIndex === idx) {
      VoiceManager.stop();
      setPlayingReplayIndex(null);
      return;
    }

    VoiceManager.stop();
    setPlayingReplayIndex(idx);

    VoiceManager.speak(speechText, examinerPersonality || "strict",
      () => setPlayingReplayIndex(idx),
      () => setPlayingReplayIndex(null)
    );
  };

  // 5. Annotative commentary for selected Emotion Timeline point
  const getTimelineCommentary = (idx) => {
    if (detectedEmotions.length === 0) {
      return "No timeline commentary available (session was ended before first question response).";
    }
    const emotion = detectedEmotions[idx];
    const qObj = askedQuestionsObjects && askedQuestionsObjects[idx] ? askedQuestionsObjects[idx] : null;
    const topicText = qObj ? qObj.topic : "Syllabus Concept";

    if (!emotion) return "Loading timeline logs...";

    let commentary = `Round #${idx + 1} (${topicText}): Solid semantic response. Articulated the primary definitions with standard pacing.`;

    if (emotion.tag === "Bluffing") {
      commentary = `Round #${idx + 1} (${topicText}): Significant bluff index flagged. Speak rate was confident, but you substituted precise formulas with general filler prose.`;
    } else if (emotion.nervousness > 45) {
      commentary = `Round #${idx + 1} (${topicText}): The examiner pressed heavily on this topic. You experienced elevated anxiety levels; speaking rate shifted rapidly but logical accuracy remained stable.`;
    } else if (emotion.hesitation > 40) {
      commentary = `Round #${idx + 1} (${topicText}): Long pause blocks and lexical hesitation markers ('umm', 'uh') occurred. Response lacked structural velocity.`;
    } else if (emotion.correctness >= 80) {
      commentary = `Round #${idx + 1} (${topicText}): Outstanding cognitive clarity. Precision phrasing, strict technical nomenclature, and absolute zero vocal hesitation.`;
    }
    return commentary;
  };

  // 6. Confidence Coaching Tips
  const getConfidenceCoachingTip = (emotion, answer, idx) => {
    const WPM = Math.round((answer || "").split(/\s+/).length / 0.5); // assume 30 secs WPM

    if (emotion.tag === "Bluffing") {
      return "Coaching: You spoke with strong confidence but lacked technical formulas. Focus strictly on governing equations rather than descriptive, general paragraphs.";
    } else if (emotion.nervousness > 40 && WPM > 170) {
      return `Coaching: You spoke very rapidly (${WPM} WPM) when experiencing nervousness. Intentionally insert slow, deliberate silence pauses to collect your thoughts.`;
    } else if (emotion.hesitation > 35) {
      return "Coaching: Autonomic speech gaps detected. Take a deep breath before answering and map out three core keywords in your mind before speaking.";
    } else if (emotion.correctness < 65) {
      return "Coaching: Concept gaps detected. Review thermodynamic/algorithmic first-principles before attempting deep real-world applications.";
    }
    return "Coaching: Excellent, balanced pacing and crisp structural delivery. Maintain this exact academic tempo.";
  };

  // 7. Academic Expected Correct Answer Lookup Helper
  const getExpectedCorrectAnswer = (topicText, qText, qObj) => {
    // If the question object already has a pre-generated correctAnswer, use it!
    if (qObj && qObj.correctAnswer) {
      return qObj.correctAnswer;
    }

    const defaultAnswers = {
      // Thermodynamics
      "Carnot thermal boundaries": "The Carnot cycle consists of two isothermal and two adiabatic processes. Reaching 100% thermal efficiency requires the cold sink temperature (T_C) to be absolute zero (0 K), which is physically impossible according to the Third Law of Thermodynamics.",
      "Reversible entropy degradation": "In any real process, some energy is degraded to a lower grade of heat. Mathematically, entropy generation (S_gen) is strictly positive (S_gen > 0) for irreversible processes, representing energy degradation.",
      "Lost exergy work": "Exergy is the maximum useful work potential of a system. Lost exergy work (or exergy destruction) is directly proportional to entropy generation: I = T_0 * S_gen, where T_0 is the environment temperature.",
      "Third law absolute zero": "The Third Law of Thermodynamics states that the entropy of a pure crystalline substance approaches zero as temperature approaches absolute zero. It physically limits the cold sink temperature, preventing 100% Carnot efficiency.",
      "First Law Open Systems": "For open control volumes, the First Law of Thermodynamics accounts for mass transfer: Q_dot - W_dot = sum(m_out * h_out) - sum(m_in * h_in) + dE/dt, accounting for flow enthalpy of mass streams crossing control boundaries.",
      "Flow work enthalpy": "Enthalpy (H = U + PV) represents the total energy of a flowing fluid, combining internal energy (U) and flow work (PV) required to push the mass across control boundaries.",
      "Transient heat transfer": "Transient systems undergo state changes over time (dE/dt != 0). Energy balance models must integrate transient parameters across time steps to track heat and mass accumulation.",
      "Steady-flow energy boundaries": "In steady-flow energy equations (SFEE), states do not vary with time (dE/dt = 0). Energy input (heat, mass flow enthalpy, kinetic, potential) strictly equals energy output.",
      "Clapeyron equations": "The Clapeyron equation describes phase boundary slopes on a P-T diagram: dP/dT = L / (T * delta_v), where L is latent heat and delta_v is the specific volume change during phase transition.",
      "Phase boundary derivations": "Derivations utilize Maxwell relations and Gibbs free energy equality (g_liq = g_vap) along the coexistence line to derive pressure-temperature relationship limits.",
      "Sublimation slopes": "The slope dP/dT is much steeper for sublimation than vaporization because the specific volume of the solid phase is significantly smaller than the liquid phase, leading to a larger change in specific volume delta_v.",
      "Triple point limits": "The triple point represents unique temperature and pressure conditions where solid, liquid, and gas phases coexist in thermodynamic equilibrium (e.g., 273.16 K for water).",

      // Data Structures
      "Arrays & Arraylists": "Arrays are fixed-size contiguous memory blocks offering O(1) random access. ArrayLists are dynamically resizable, using automatic copy-and-reallocate operations when the load capacity is reached.",
      "Stack LIFO boundaries": "A stack is a Last-In, First-Out structure. Key operations are Push and Pop, both operating at O(1) complexity. Stack overflow/underflow boundary checks prevent memory access violations.",
      "Queue FIFO parameters": "A queue is a First-In, First-Out structure. Enqueue adds to the rear, and Dequeue removes from the front, both operating in O(1) time. Circular queues optimize space via modulo indexing.",
      "Linked list traversal": "Linked lists consist of non-contiguous nodes linked by references. Traversal requires linear O(N) pointer-chasing, unlike arrays which support O(1) index-based jumps.",
      "Binary Search Trees": "A BST is a node-based binary tree where left children are smaller and right children are larger. Search, insertion, and deletion operate in O(log N) average time, but degrade to O(N) if unbalanced.",
      "AVL self-balancing logic": "AVL trees are self-balancing BSTs where the balance factor (height(left) - height(right)) of any node must be in {-1, 0, 1}. Violations are corrected using single or double rotations (LL, RR, LR, RL).",
      "Red-black tree margins": "Red-Black trees balance using node color attributes (Red/Black) and 5 strict color rules. They guarantee O(log N) operations with fewer rotations than AVL trees on insertion/deletion.",
      "Graph representations": "Graphs are represented using Adjacency Matrices (O(V^2) space, fast edge lookup) or Adjacency Lists (O(V+E) space, efficient neighbor traversal).",
      "Hash collisions buckets": "Hash collisions occur when distinct keys hash to the same table index. Open addressing (linear/quadratic probing, double hashing) or separate chaining (linked list buckets) resolve collisions.",
      "Probing techniques": "Linear probing checks consecutive slots (i + 1, i + 2), leading to primary clustering. Quadratic probing uses polynomial increments (i + k^2), reducing clustering issues.",
      "Graph BFS queues": "Breadth-First Search explores graph nodes level-by-level using a FIFO Queue to track frontier nodes, operating in O(V + E) time.",
      "DFS recursive stacks": "Depth-First Search explores path branches as deep as possible before backtracking, utilizing a LIFO Stack (explicit or via recursion) to track traversal paths.",

      // Machine Design
      "Static stress limits": "Static design limits ensure materials do not yield or fracture under constant loading. Ductile materials use the Distortion Energy theory (von Mises), while brittle materials use Maximum Normal Stress theory.",
      "Alternating stress fatigue": "Fatigue occurs under cyclic loading at stresses far below static yield limits. Micro-cracks initiate at stress concentrations and propagate until sudden catastrophic failure.",
      "Goodman line diagrams": "The Goodman relation maps safe combinations of mean stress (S_m) and alternating stress (S_a): S_a / S_e + S_m / S_ut = 1, where S_e is endurance limit and S_ut is ultimate tensile strength.",
      "Soderberg yield boundaries": "The Soderberg fatigue model is highly conservative, using yield strength (S_yt) instead of ultimate strength: S_a / S_e + S_m / S_yt = 1.",
      "Torsional stress shafts": "Torsion creates shear stress in a circular shaft: tau = T * r / J, where T is torque, r is radius, and J is polar moment of inertia (J = pi * d^4 / 32).",
      "Stress flow singularties": "Stress concentrations arise at geometric discontinuities (holes, fillets, keyways) where stress flow lines crowd together, raising maximum stress by a factor of K_t.",
      "Fillet radii mitigation": "Increasing the fillet radius creates a gentler transition between shaft diameters, smoothing out the flow lines of stress and lowering the stress concentration factor K_t.",
      "Shaft keys grooves": "Keyways transmit torque between shafts and gears. Because they are sharp internal cutouts, they act as major stress concentration zones, reducing the shaft's fatigue limit.",
      "Sommerfeld lubrication coefficient": "The Sommerfeld number characterizes hydrodynamic journal bearings: S = (r/c)^2 * (mu * N) / P, determining friction coefficient, film thickness, and lubricant flow rate.",
      "Journal bearings eccentrity": "Eccentricity (e) is the radial offset of the shaft center under load. The eccentricity ratio (epsilon = e/c) determines the minimum oil film thickness required to prevent metal-to-metal contact.",
      "Spur root teeth bending": "Gear teeth experience bending stress at the root fillet under tangential tooth loads. It is modeled as a cantilever beam using the Lewis formula.",
      "Lewis stress AGMA values": "The classical Lewis formula (sigma = W_t / (F * m * Y)) is modified by AGMA factors (dynamic, overload, size, distribution factors) to compute precise gear tooth bending fatigue limits."
    };

    const topicClean = (topicText || "").trim();
    // 1. Direct match on exact topic key
    if (defaultAnswers[topicClean]) {
      return defaultAnswers[topicClean];
    }

    // 2. Fuzzy case-insensitive check
    const topicLower = topicClean.toLowerCase();
    for (const [key, value] of Object.entries(defaultAnswers)) {
      if (topicLower.includes(key.toLowerCase()) || key.toLowerCase().includes(topicLower)) {
        return value;
      }
    }

    // 3. Look up based on question content keywords
    const questionLower = (qText || "").toLowerCase();
    if (questionLower.includes("entropy")) {
      return "An expected answer must define entropy as a measure of system molecular disorder or unavailability of thermal energy. Entropy generation is positive for all real processes: S_gen > 0.";
    } else if (questionLower.includes("carnot")) {
      return "A correct answer must outline the Carnot cycle's 4 stages and explain why 100% efficiency is impossible unless the cold sink is at 0 K, violating the Third Law.";
    } else if (questionLower.includes("exergy")) {
      return "A correct answer should define exergy as the maximum theoretical useful work. Exergy is destroyed during irreversible processes due to internal friction or heat transfer across finite temperature differences.";
    } else if (questionLower.includes("clausius")) {
      return "A correct response should explain the Clausius Inequality: cyclic integral of dQ/T <= 0. For real irreversible cycles, it is strictly negative, proving that internal irreversibilities generate entropy.";
    } else if (questionLower.includes("avl") || questionLower.includes("rotation")) {
      return "An expected answer must state that AVL trees maintain a balance factor of -1, 0, or 1 at all nodes. Imbalances caused by insertions/deletions are corrected using single (LL, RR) or double (LR, RL) rotations.";
    } else if (questionLower.includes("hash") || questionLower.includes("collision")) {
      return "A correct response should explain how a hash function maps keys to indices, and describe collision resolution strategies: open addressing (linear/quadratic probing, double hashing) or separate chaining (linked list buckets).";
    } else if (questionLower.includes("goodman") || questionLower.includes("soderberg")) {
      return "An expected answer must define the fatigue stress boundary equations. Goodman uses ultimate tensile strength (S_ut) for alternating stress fatigue, while Soderberg uses yield strength (S_yt), making it more conservative.";
    } else if (questionLower.includes("sommerfeld") || questionLower.includes("bearing")) {
      return "A correct response must outline the Sommerfeld number S = (r/c)^2 * (mu * N) / P and explain how journal eccentricity ratio (epsilon) adjusts oil film thickness to avoid contact.";
    } else if (questionLower.includes("lewis") || questionLower.includes("gear")) {
      return "An expected answer must state that the Lewis formula models a gear tooth as a cantilever beam to compute root bending stress, modified by AGMA overload and dynamic velocity factors.";
    }

    // 4. Default intelligent generic summary
    return `An ideal answer for "${topicClean || "Syllabus Fundamentals"}" should provide a precise definition of the concept, state any relevant equations or governing laws, and explain how the boundary conditions influence the system's performance.`;
  };

  // 8. Custom Print Dialog PDF triggers
  const handlePrintReport = () => {
    window.print();
  };

  // ===========================================================
  //  PRESENTATION LAYER (derived data for the redesigned page)
  // ===========================================================
  const tone = (s) => (s >= 75
    ? { cls: styles.toneGood, label: "Strong", icon: "✓" }
    : s >= 50
      ? { cls: styles.toneMid, label: "Developing", icon: "~" }
      : { cls: styles.toneLow, label: "Needs work", icon: "!" });

  const metrics = [
    { key: "subject", label: isProfessional ? "Technical / domain competence" : "Subject understanding", value: subjectUnderstanding, desc: "How correct and technically accurate your answers were, averaged across every round." },
    { key: "confidence", label: isProfessional ? "Communication confidence" : "Speaking confidence", value: vocalConfidence, desc: "Vocal steadiness and assurance detected while you spoke." },
    { key: "clarity", label: isProfessional ? "Clarity & delivery" : "Speaking clarity", value: clarityOfComm, desc: "How clearly your ideas were structured and articulated." },
    { key: "depth", label: isProfessional ? "Problem-solving depth" : "Conceptual depth", value: conceptualDepth, desc: "How completely each answer covered the concepts an ideal response would include." },
    { key: "pressure", label: isProfessional ? "Stress tolerance" : "Handling pressure", value: handlingPressure, desc: "Calm under follow-up questions. Higher means less nervousness was detected." },
    { key: "consistency", label: isProfessional ? "Role consistency" : "Consistency", value: consistency, desc: "How even your correctness stayed from one question to the next." }
  ];
  const sortedMetrics = sortLowFirst ? [...metrics].sort((a, b) => a.value - b.value) : metrics;
  const hasData = totalRounds > 0;
  const weakestMetric = hasData ? [...metrics].sort((a, b) => a.value - b.value)[0] : null;
  const strongestMetric = hasData ? [...metrics].sort((a, b) => b.value - a.value)[0] : null;
  const overallTone = tone(overallScore);

  const questions = askedQuestions.map((qText, idx) => {
    const emo = detectedEmotions[idx] || {};
    const qObj = askedQuestionsObjects && askedQuestionsObjects[idx] ? askedQuestionsObjects[idx] : null;
    const correctness = emo.correctness !== undefined ? emo.correctness : 80;
    const accuracy = emo.accuracy !== undefined ? emo.accuracy : correctness;
    const completeness = emo.completeness !== undefined ? emo.completeness : Math.max(correctness - 10, 40);
    const clarity = emo.clarity !== undefined ? emo.clarity : 85;
    const topic = qObj ? qObj.topic : (isProfessional ? "Competency skill" : "Syllabus concept");
    return {
      idx, emo, qObj, topic, correctness, accuracy, completeness, clarity,
      text: qObj ? qObj.text : qText,
      speech: qObj ? qObj.speech : qText,
      answer: answerTranscripts[idx] || "",
      tag: emo.tag || (correctness >= 75 ? "Strong" : correctness >= 50 ? "Partially correct" : "Weak"),
      tone: tone(correctness)
    };
  });
  const strongCount = questions.filter((q) => q.correctness >= 75).length;
  const workCount = questions.length - strongCount;
  const visibleQuestions = questions.filter((q) => qFilter === "all" || (qFilter === "strong" ? q.correctness >= 75 : q.correctness < 75));
  const sel = questions[Math.min(selected, Math.max(questions.length - 1, 0))] || null;

  const fallacies = detectFallacies();
  const plan = generate5DayPlan();
  const revisionPills = getSuggestedRevisionPills();
  const doneCount = plan.filter((d) => doneDays[d.day]).length;
  const planPct = Math.round((doneCount / plan.length) * 100);

  // Speech & fluency
  const averageHesitation = hasData
    ? Math.round(detectedEmotions.reduce((acc, emo) => acc + (emo.hesitation ?? 15), 0) / totalRounds)
    : 0;
  let fluencyBase = 100 - parseFloat(fillerConcentration) * 4;
  if (avgWpm < 90 || avgWpm > 170) fluencyBase -= 25;
  else if (avgWpm < 110 || avgWpm > 150) fluencyBase -= 10;
  const fluencyScore = Math.min(Math.max(Math.round(fluencyBase), 45), 99);
  const fluencyGrade = fluencyScore >= 95 ? "A+" : fluencyScore >= 88 ? "A" : fluencyScore >= 80 ? "B+" : fluencyScore >= 70 ? "B" : fluencyScore >= 55 ? "C+" : "C";
  const pauseDensityDesc = averageHesitation < 15 ? "Sparse — highly articulate" : averageHesitation > 30 ? "Dense — frequent vocal pauses" : "Moderate — measured pacing";
  const paceTone = avgWpm < 90 || avgWpm > 170 ? styles.toneLow : (avgWpm < 110 || avgWpm > 150 ? styles.toneMid : styles.toneGood);
  const maxFiller = Math.max(...Object.values(fillerCounts), 4);
  const fillerTone = (c) => (c <= 2 ? styles.toneGood : c <= 5 ? styles.toneMid : styles.toneLow);

  // Timeline chart
  const seriesDefs = [
    { key: "confidence", label: "Confidence", color: "#3e5233", dash: "", get: (e) => e.confidence ?? 80 },
    { key: "calm", label: "Calmness (low nervousness)", color: "#a85d3f", dash: "9 6", get: (e) => 100 - (e.nervousness ?? 20) },
    { key: "fluency", label: "Fluency (few pauses)", color: "#2b6b84", dash: "2 6", get: (e) => 100 - (e.hesitation ?? 15) }
  ];
  const CW = 600, CH = 270, padL = 42, padR = 26, padT = 16, padB = 36;
  const cx = (i) => (totalRounds <= 1 ? (CW + padL - padR) / 2 : padL + (i * (CW - padL - padR)) / (totalRounds - 1));
  const cy = (v) => padT + (1 - Math.min(Math.max(v, 0), 100) / 100) * (CH - padT - padB);
  const colW = totalRounds > 1 ? (CW - padL - padR) / (totalRounds - 1) : 120;

  const toggleSeries = (key) => setVisibleSeries((prev) => {
    const next = { ...prev, [key]: !prev[key] };
    return Object.values(next).some(Boolean) ? next : prev; // always keep at least one line visible
  });

  const goTab = (id) => {
    setActiveTab(id);
    requestAnimationFrame(() => {
      const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      tabsRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    });
  };
  const openQuestion = (idx) => { setSelected(idx); setShowExpected(false); };

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "questions", label: "Questions", count: questions.length },
    { id: "delivery", label: "Delivery" },
    { id: "plan", label: "Study plan", count: `${doneCount}/${plan.length}` }
  ];
  const onTabKey = (e, i) => {
    const keys = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 };
    if (!(e.key in keys)) return;
    e.preventDefault();
    const next = (keys[e.key] + tabs.length) % tabs.length;
    setActiveTab(tabs[next].id);
    document.getElementById(`results-tab-${tabs[next].id}`)?.focus();
  };

  const handleCopySummary = async () => {
    const lines = [
      `${isProfessional ? "PrepSim mock interview" : "PrepSim viva"} — ${subjectName}`,
      `Overall: ${overallScore}% (${gradeLabel})`,
      ...metrics.map((m) => `${m.label}: ${m.value}%`),
      `Average pace: ${avgWpm} WPM · Filler rate: ${fillerConcentration}%`,
      revisions.length ? `Revise next: ${revisions.join(", ")}` : ""
    ].filter(Boolean).join("\n");
    try {
      await navigator.clipboard.writeText(lines);
      setLiveMsg("Summary copied to clipboard.");
    } catch {
      setLiveMsg("Could not copy automatically. Use Download report instead.");
    }
    setTimeout(() => setLiveMsg(""), 4000);
  };

  const trajLabel = hindsightData?.trajectoryPattern === "ascending" ? "Rising" : hindsightData?.trajectoryPattern === "declining" ? "Declining" : "Steady";

  return (
    <section id="results-screen" className={styles.results} aria-labelledby="results-title">
      <a className={styles.skip} href="#results-tabs">Skip to results</a>
      <div className={styles.srOnly} role="status" aria-live="polite">{liveMsg}</div>

      <nav className={styles.nav} aria-label="Report navigation">
        <button className={styles.brand} onClick={onGoDashboard} aria-label="PrepSim — back to dashboard">
          <svg width="28" height="30" viewBox="0 0 30 32" fill="none" aria-hidden="true"><path d="M3 6 15 0l12 6v14l-12 7V14l12-8M3 6v20l12 6v-5M3 6l12 8" stroke="currentColor" strokeWidth="2" /></svg>
          PrepSim<sup>AI</sup>
        </button>
        <span className={styles.navCrumb}>Session report</span>
      </nav>

      <div className={styles.content}>
        {/* ---------- Heading ---------- */}
        <div className={styles.heading}>
          <div>
            <span className={styles.eyebrow}>{isProfessional ? "MOCK INTERVIEW REPORT" : "ORAL EXAMINATION REPORT"} / {subjectName}</span>
            <h1 id="results-title">Here is how you <em>showed up.</em></h1>
            <div className={styles.tags}>
              {endedEarly && <span className={`${styles.tag} ${styles.tagRust}`}>Ended early</span>}
              {isLastMinute && <span className={styles.tag}>Last-minute prep</span>}
              {isMockExternal && <span className={`${styles.tag} ${styles.tagRust}`}>Mock external board</span>}
              <span className={styles.tag}>{totalRounds} {totalRounds === 1 ? "round" : "rounds"} answered</span>
            </div>
            <p style={{ marginTop: 12 }}>{isProfessional ? "A calm, honest read on your delivery and depth. Use it as a guide, not a verdict." : "A calm, honest read on your understanding and delivery. Use it as a guide, not a verdict."}</p>
          </div>
          <div className={styles.actions}>
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={onRestart}>Practice again <span aria-hidden="true">→</span></button>
            <button className={styles.btn} onClick={handleCopySummary}>Copy summary</button>
            <button className={styles.btn} onClick={handlePrintReport}>Print / save PDF</button>
            <button className={styles.btn} onClick={onGoDashboard}>Dashboard</button>
          </div>
        </div>

        {/* ---------- Hero ---------- */}
        <div className={styles.hero}>
          <section className={styles.scoreCard} aria-label="Overall result">
            <div className={styles.ringWrap} role="img" aria-label={`Overall score ${overallScore} out of 100`}>
              <svg viewBox="0 0 120 120" aria-hidden="true">
                <circle className={styles.ringBg} cx="60" cy="60" r="50" />
                <circle className={styles.ringFill} cx="60" cy="60" r="50" strokeDasharray="314.16" strokeDashoffset={314.16 * (1 - shownScore / 100)} style={{ transition: "none" }} />
              </svg>
              <div className={styles.ringText} aria-hidden="true">
                <strong>{shownScore}<small>%</small></strong>
                <span>Overall</span>
              </div>
            </div>
            <div className={styles.verdict}>
              <span className={styles.eyebrow}>OVERALL STANDING</span>
              <h2>{gradeLabel}</h2>
              <p>{evaluationVerdict}</p>
              <div className={styles.verdictMeta}>
                {hasData && <span className={`${styles.pill} ${overallTone.cls}`}><span aria-hidden="true">{overallTone.icon}</span>{overallTone.label} overall</span>}
                {pastSessionsAvg !== null && <span className={styles.pill}>Your {subjectName} average: {pastSessionsAvg}%</span>}
              </div>
            </div>
          </section>

          <aside className={styles.focusCard} aria-label="Suggested next step">
            <span className={styles.eyebrow}>YOUR NEXT STEP</span>
            {hasData ? (
              <>
                <h2>Start with <em>{weakestMetric.label.toLowerCase()}.</em></h2>
                <p>It scored {weakestMetric.value}%, your lowest area. {strongestMetric.label} ({strongestMetric.value}%) is your strongest, so you have something solid to build from.</p>
              </>
            ) : (
              <>
                <h2>Try one <em>full round.</em></h2>
                <p>This session ended before an answer was recorded. Start again and answer even one question to unlock your report.</p>
              </>
            )}
            <button onClick={() => (hasData ? goTab("plan") : onRestart())}>
              {hasData ? "See your 5-day plan" : "Start a new session"} <span aria-hidden="true">→</span>
            </button>
          </aside>
        </div>

        {/* ---------- Key numbers ---------- */}
        <dl className={styles.strip}>
          <div>
            <dt>Questions</dt>
            <dd>{totalRounds}<small>answered</small></dd>
            <span className={styles.stripNote}>{strongCount} strong · {workCount} to revisit</span>
          </div>
          <div>
            <dt>Speaking pace</dt>
            <dd>{avgWpm}<small>WPM</small></dd>
            <span className={styles.stripNote}>{pacingCategory}</span>
          </div>
          <div>
            <dt>Filler words</dt>
            <dd>{fillerConcentration}<small>%</small></dd>
            <span className={styles.stripNote}>{totalFillerCount} in {totalWordsCount} words</span>
          </div>
          <div>
            <dt>Bluff risk</dt>
            <dd>{bluffProb}<small>%</small></dd>
            <span className={styles.stripNote}>{bluffProb > 40 ? "Worth a closer look" : "Answers match confidence"}</span>
          </div>
        </dl>

        {/* ---------- Tabs ---------- */}
        <div id="results-tabs" ref={tabsRef} className={styles.tabs} role="tablist" aria-label="Report sections" style={{ scrollMarginTop: 16 }}>
          {tabs.map((t, i) => (
            <button
              key={t.id}
              id={`results-tab-${t.id}`}
              role="tab"
              aria-selected={activeTab === t.id}
              aria-controls={`results-panel-${t.id}`}
              tabIndex={activeTab === t.id ? 0 : -1}
              className={styles.tab}
              onClick={() => setActiveTab(t.id)}
              onKeyDown={(e) => onTabKey(e, i)}
            >
              {t.label}{t.count !== undefined && <small>{t.count}</small>}
            </button>
          ))}
        </div>

        {/* ======================= OVERVIEW ======================= */}
        <div id="results-panel-overview" role="tabpanel" aria-labelledby="results-tab-overview" hidden={activeTab !== "overview"} className={styles.panel}>
          <div className={styles.grid2}>
            <div className={styles.stack}>
              <section className={styles.card} aria-labelledby="scorecard-h">
                <div className={styles.cardHead}>
                  <div>
                    <span className={styles.eyebrow}>SCORECARD</span>
                    <h2 id="scorecard-h">Six ways your session read</h2>
                  </div>
                  <button className={`${styles.btn} ${styles.btnSmall}`} aria-pressed={sortLowFirst} onClick={() => { setSortLowFirst((v) => !v); setLiveMsg(!sortLowFirst ? "Sorted lowest score first." : "Original order restored."); }}>
                    {sortLowFirst ? "Showing lowest first" : "Sort lowest first"}
                  </button>
                </div>
                {hasData ? (
                  <ul className={styles.metricList}>
                    {sortedMetrics.map((m) => {
                      const t = tone(m.value);
                      const open = expandedMetric === m.key;
                      return (
                        <li key={m.key}>
                          <button className={styles.metricRow} aria-expanded={open} onClick={() => setExpandedMetric(open ? null : m.key)}>
                            <span className={styles.metricTop}>
                              <span>{m.label}</span>
                              <span>{m.value}% <span className={`${styles.toneChip} ${t.cls}`}><span aria-hidden="true">{t.icon} </span>{t.label}</span></span>
                            </span>
                            <Meter value={m.value} label={m.label} toneCls={t.cls} />
                            {open && <p className={styles.metricDesc}>{m.desc}</p>}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className={styles.empty}>No scores yet. Answer at least one question to see your scorecard.</p>
                )}
              </section>

              <div className={styles.twoCol}>
                <section className={styles.card} aria-labelledby="str-h">
                  <span className={styles.eyebrow}>WHAT WORKED</span>
                  <h2 id="str-h" style={{ marginBottom: 14 }}>Strengths</h2>
                  <ul className={`${styles.points} ${styles.toneGood}`}>
                    {strengths.map((s, i) => <li key={i}><span aria-hidden="true">✓</span><span>{s}</span></li>)}
                  </ul>
                </section>
                <section className={styles.card} aria-labelledby="weak-h">
                  <span className={styles.eyebrow}>WHERE TO GROW</span>
                  <h2 id="weak-h" style={{ marginBottom: 14 }}>Focus areas</h2>
                  <ul className={`${styles.points} ${styles.toneMid}`}>
                    {weaknesses.length ? weaknesses.map((s, i) => <li key={i}><span aria-hidden="true">!</span><span>{s}</span></li>) : <li><span aria-hidden="true">✓</span><span>No major weak spots were flagged.</span></li>}
                  </ul>
                </section>
              </div>
            </div>

            <div className={styles.stack}>
              <section className={styles.card} aria-labelledby="bluff-h">
                <span className={styles.eyebrow}>BLUFF INDEX</span>
                <h2 id="bluff-h">Does confidence match substance?</h2>
                <p className={styles.bigNum} style={{ marginTop: 14 }}>{bluffProb}<small>% probability</small></p>
                <Meter value={bluffProb} label="Bluff probability" toneCls={bluffProb > 60 ? styles.toneLow : bluffProb > 30 ? styles.toneMid : styles.toneGood} />
                <div className={styles.meterLabels}><span>Grounded</span><span>Likely bluffing</span></div>
                <p className={styles.note} style={{ marginTop: 12 }}>
                  {bluffProb > 40
                    ? "You sounded sure, but some answers lacked specific formulas or terms. Lead with the precise rule, then explain."
                    : "Your technical accuracy matched how confidently you spoke. No sign of memorise-and-bluff attempts."}
                </p>
              </section>

              <section className={styles.card} aria-labelledby="lex-h">
                <span className={styles.eyebrow}>VOCABULARY</span>
                <h2 id="lex-h">{maturityLevel}</h2>
                <p className={styles.bigNum} style={{ marginTop: 14 }}>{lexicalScore}<small>/100 range</small></p>
                <Meter value={lexicalScore} label="Lexical range" toneCls={tone(lexicalScore).cls} />
                <div className={styles.meterLabels}><span>Everyday words</span><span>Precise terminology</span></div>
                <p className={styles.note} style={{ marginTop: 12 }}>{maturityDesc}</p>
                <div className={styles.chipRow}>
                  <span className={styles.stat}>Unique words <strong>{uniqueWordsCount}</strong></span>
                  <span className={styles.stat}>Advanced terms <strong>{advancedWordsCount}</strong></span>
                </div>
              </section>

              <section className={styles.card} aria-labelledby="fal-h">
                <span className={styles.eyebrow}>REASONING CHECK</span>
                <h2 id="fal-h" style={{ marginBottom: 12 }}>Argument patterns</h2>
                {fallacies.length === 0 ? (
                  <div className={styles.okBox}><span aria-hidden="true">✓</span><span><strong>No reasoning slips flagged.</strong> You avoided stalling phrases, circular answers and unqualified absolutes.</span></div>
                ) : (
                  fallacies.map((d, i) => (
                    <div key={i} className={styles.flag}>
                      <h4>{d.type} · Round {d.round}</h4>
                      <p><strong>Topic:</strong> {d.topic}. {d.marker}.</p>
                      <p><strong>Try instead:</strong> {d.fix}</p>
                    </div>
                  ))
                )}
              </section>
            </div>
          </div>
        </div>

        {/* ======================= QUESTIONS ======================= */}
        <div id="results-panel-questions" role="tabpanel" aria-labelledby="results-tab-questions" hidden={activeTab !== "questions"} className={styles.panel}>
          {questions.length === 0 ? (
            <p className={styles.empty}>{isProfessional ? "No recorded rounds. Answer at least one question to review the interviewer's feedback." : "No recorded rounds. Answer at least one question to review the examiner's feedback."}</p>
          ) : (
            <>
              <section className={styles.card} style={{ marginBottom: 24 }} aria-labelledby="qbars-h">
                <div className={styles.cardHead}>
                  <div>
                    <span className={styles.eyebrow}>ROUND BY ROUND</span>
                    <h2 id="qbars-h">Correctness at a glance</h2>
                    <p className={styles.sub}>Select a bar to open that question below.</p>
                  </div>
                </div>
                <div className={styles.scoreBars}>
                  {questions.map((q) => (
                    <button key={q.idx} className={q.tone.cls} aria-pressed={sel && sel.idx === q.idx} aria-label={`Question ${q.idx + 1}, ${q.topic}: ${q.correctness} percent, ${q.tone.label}`} onClick={() => openQuestion(q.idx)}>
                      <span aria-hidden="true">{q.correctness}</span>
                      <span className={styles.col} style={{ height: `${Math.max(q.correctness, 4)}%` }} />
                    </button>
                  ))}
                </div>
                <div className={styles.scoreLabels} aria-hidden="true">
                  {questions.map((q) => <span key={q.idx}>Q{q.idx + 1}</span>)}
                </div>
              </section>

              <div className={styles.qLayout}>
                <div>
                  <div className={styles.filters} role="group" aria-label="Filter questions">
                    {[["all", `All (${questions.length})`], ["strong", `Strong (${strongCount})`], ["work", `To revisit (${workCount})`]].map(([k, l]) => (
                      <button key={k} aria-pressed={qFilter === k} onClick={() => { setQFilter(k); setLiveMsg(`Showing ${l}.`); }}>{l}</button>
                    ))}
                  </div>
                  <ul className={styles.qList} aria-label="Questions">
                    {visibleQuestions.length === 0 && <li className={styles.empty}>Nothing in this group.</li>}
                    {visibleQuestions.map((q) => (
                      <li key={q.idx}>
                        <button className={`${styles.qItem} ${q.tone.cls}`} aria-current={sel && sel.idx === q.idx ? "true" : undefined} onClick={() => openQuestion(q.idx)}>
                          <span className={styles.qNum}>Q{q.idx + 1}</span>
                          <span className={styles.qTopic}>{q.topic}</span>
                          <span className={styles.qScore}>{q.correctness}%<small><span aria-hidden="true">{q.tone.icon} </span>{q.tone.label}</small></span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>

                {sel && (
                  <article className={`${styles.card} ${styles.qDetail}`} aria-labelledby="qd-title" aria-live="polite">
                    <span className={styles.eyebrow}>QUESTION {sel.idx + 1} OF {questions.length}{sel.qObj?.difficulty ? ` / ${String(sel.qObj.difficulty).toUpperCase()}` : ""}</span>
                    <h3 id="qd-title">{sel.topic}</h3>
                    <div className={styles.verdictMeta} style={{ marginTop: 10 }}>
                      <span className={`${styles.pill} ${sel.tone.cls}`}><span aria-hidden="true">{sel.tone.icon}</span>{sel.correctness}% correct · {sel.tag}</span>
                    </div>

                    <div className={styles.qBlock}>
                      <h4>
                        {isProfessional ? "Interviewer asked" : "Examiner asked"}
                        <button className={`${styles.btn} ${styles.btnSmall}`} aria-pressed={playingReplayIndex === sel.idx} onClick={() => handleReplayVoice(sel.speech, sel.idx)}>
                          {playingReplayIndex === sel.idx ? "■ Stop voice" : "▶ Replay voice"}
                        </button>
                      </h4>
                      <p className={styles.quote}>{sel.text}</p>
                    </div>

                    <div className={styles.qBlock}>
                      <h4>Your answer</h4>
                      <p className={styles.answerBox}>{sel.answer || "No transcript was captured for this round."}</p>
                      {resultsData.recordedAudios && resultsData.recordedAudios[sel.idx] && (
                        <div style={{ marginTop: 10 }}>
                          <audio className={styles.audio} src={resultsData.recordedAudios[sel.idx]} controls aria-label={`Listen back to your answer to question ${sel.idx + 1}`} />
                        </div>
                      )}
                    </div>

                    <div className={styles.qBlock}>
                      <h4>How it scored</h4>
                      <div className={styles.miniBars}>
                        {[["Correctness", sel.correctness], ["Technical accuracy", sel.accuracy], ["Completeness", sel.completeness], ["Articulation & clarity", sel.clarity]].map(([l, v]) => (
                          <div key={l} className={tone(v).cls}>
                            <div><span>{l}</span><strong>{v}%</strong></div>
                            <Meter value={v} label={l} toneCls={tone(v).cls} />
                          </div>
                        ))}
                      </div>
                      <p className={styles.note} style={{ marginTop: 14 }}>
                        <strong>Evaluator note:</strong> {sel.emo.rationale || (sel.correctness >= 75
                          ? `Strong answer. It addressed the core principles of ${sel.topic} accurately.`
                          : sel.correctness >= 50
                            ? "Partly correct. Good direction, but key formulas, edge cases or precise terms were missing."
                            : `The explanation was incomplete and lacked essential details for ${sel.topic}.`)}
                      </p>
                      {Array.isArray(sel.emo.keyStrengths) && sel.emo.keyStrengths.length > 0 && (
                        <div className={`${styles.tagList} ${styles.toneGood}`}><span>Strengths:</span>{sel.emo.keyStrengths.map((s, i) => <span key={i} className={styles.t}>✓ {s}</span>)}</div>
                      )}
                      {Array.isArray(sel.emo.missingConcepts) && sel.emo.missingConcepts.length > 0 && (
                        <div className={`${styles.tagList} ${styles.toneMid}`}><span>Gaps:</span>{sel.emo.missingConcepts.map((s, i) => <span key={i} className={styles.t}>! {s}</span>)}</div>
                      )}
                    </div>

                    <div className={styles.qBlock}>
                      <h4>
                        {isProfessional ? "Optimal professional response" : "Expected answer"}
                        <button className={`${styles.btn} ${styles.btnSmall}`} aria-expanded={showExpected} aria-controls="expected-answer" onClick={() => setShowExpected((v) => !v)}>
                          {showExpected ? "Hide" : "Reveal"}
                        </button>
                      </h4>
                      <div id="expected-answer" className={`${styles.expected} ${styles.expectedWrap}`} hidden={!showExpected}>
                        {sel.emo.correctAnswer || sel.qObj?.correctAnswer || getExpectedCorrectAnswer(sel.topic, sel.text, sel.qObj)}
                      </div>
                      {!showExpected && <p className={styles.sub}>Try recalling the answer first, then reveal it to compare.</p>}
                    </div>

                    <div className={styles.qBlock}>
                      <h4>Coaching tip</h4>
                      <p className={styles.tip}>{getConfidenceCoachingTip(sel.emo, sel.answer, sel.idx).replace(/^Coaching:\s*/, "")}</p>
                    </div>

                    <div className={styles.qNav}>
                      <button className={styles.btn} disabled={sel.idx === 0} onClick={() => openQuestion(sel.idx - 1)}><span aria-hidden="true">←</span> Previous</button>
                      <button className={styles.btn} disabled={sel.idx === questions.length - 1} onClick={() => openQuestion(sel.idx + 1)}>Next <span aria-hidden="true">→</span></button>
                    </div>
                  </article>
                )}
              </div>
            </>
          )}
        </div>

        {/* ======================= DELIVERY ======================= */}
        <div id="results-panel-delivery" role="tabpanel" aria-labelledby="results-tab-delivery" hidden={activeTab !== "delivery"} className={styles.panel}>
          <div className={styles.stack}>
            <section className={styles.card} aria-labelledby="tl-h">
              <div className={styles.cardHead}>
                <div>
                  <span className={styles.eyebrow}>EMOTION TIMELINE</span>
                  <h2 id="tl-h">How you felt, question by question</h2>
                  <p className={styles.sub}>Toggle lines on or off, then pick a question to read what happened.</p>
                </div>
              </div>

              {!hasData ? (
                <p className={styles.empty}>No timeline data. Answer at least one question to chart your confidence, calm and fluency.</p>
              ) : (
                <>
                  <div className={styles.legend} role="group" aria-label="Chart lines">
                    {seriesDefs.map((s) => (
                      <button key={s.key} aria-pressed={visibleSeries[s.key]} onClick={() => toggleSeries(s.key)}>
                        <svg viewBox="0 0 26 10" aria-hidden="true"><line x1="1" y1="5" x2="25" y2="5" stroke={s.color} strokeWidth="3" strokeDasharray={s.dash} strokeLinecap="round" /></svg>
                        {s.label}
                      </button>
                    ))}
                  </div>
                  <div className={styles.chartBox}>
                    <svg viewBox={`0 0 ${CW} ${CH}`} role="group" aria-label={`Line chart of ${totalRounds} rounds. Use the question buttons below the chart for details.`}>
                      {[0, 25, 50, 75, 100].map((v) => (
                        <g key={v}>
                          <line className={styles.gridLine} x1={padL} x2={CW - padR} y1={cy(v)} y2={cy(v)} strokeDasharray={v === 0 ? "" : "3 4"} />
                          <text className={styles.axisText} x={padL - 8} y={cy(v) + 4} textAnchor="end">{v}</text>
                        </g>
                      ))}
                      {sel && <rect x={cx(sel.idx) - Math.min(colW / 2 - 2, 34)} y={padT} width={Math.min(colW - 4, 68)} height={CH - padT - padB} fill="#b56c5022" stroke="#b56c5055" rx="6" />}
                      {seriesDefs.filter((s) => visibleSeries[s.key]).map((s) => {
                        const d = detectedEmotions.map((e, i) => `${i === 0 ? "M" : "L"} ${cx(i)} ${cy(s.get(e))}`).join(" ");
                        return totalRounds > 1 ? (
                          <path key={s.key} d={d} pathLength="1" className={styles.linePath} stroke={s.color} style={s.dash ? { strokeDasharray: s.dash, strokeDashoffset: 0, animation: "none" } : undefined} />
                        ) : null;
                      })}
                      {detectedEmotions.map((e, i) => {
                        const active = sel && sel.idx === i;
                        return (
                          <g
                            key={i}
                            className={styles.node}
                            role="button"
                            tabIndex={0}
                            aria-pressed={active}
                            aria-label={`Question ${i + 1}: ${seriesDefs.map((s) => `${s.label.split(" (")[0]} ${s.get(e)} percent`).join(", ")}`}
                            onClick={() => openQuestion(i)}
                            onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); openQuestion(i); } }}
                          >
                            <rect x={cx(i) - Math.max(colW / 2, 18)} y={padT} width={Math.max(colW, 36)} height={CH - padT - padB} fill="transparent" />
                            {seriesDefs.filter((s) => visibleSeries[s.key]).map((s) => (
                              <circle key={s.key} className={styles.ring} cx={cx(i)} cy={cy(s.get(e))} r={active ? 7 : 5} fill={active ? s.color : "#fffef8"} stroke={s.color} strokeWidth="2.5" />
                            ))}
                            <text className={styles.axisText} x={cx(i)} y={CH - 12} textAnchor="middle" style={active ? { fill: "#9a5a40", fontWeight: 800 } : undefined}>Q{i + 1}</text>
                          </g>
                        );
                      })}
                    </svg>
                  </div>

                  <div className={styles.pickRow} role="group" aria-label="Choose a question">
                    {questions.map((q) => (
                      <button key={q.idx} aria-pressed={sel && sel.idx === q.idx} onClick={() => openQuestion(q.idx)}>Q{q.idx + 1}</button>
                    ))}
                  </div>

                  {sel && (
                    <div className={styles.commentary} aria-live="polite">
                      <strong>Question {sel.idx + 1} · {sel.topic}</strong>
                      {getTimelineCommentary(sel.idx).replace(/^Round #\d+ \([^)]*\):\s*/, "")}
                      <div className={styles.readout}>
                        {seriesDefs.map((s) => <span key={s.key}>{s.label.split(" (")[0]}: <b>{s.get(sel.emo)}%</b></span>)}
                      </div>
                      <button className={`${styles.btn} ${styles.btnSmall}`} style={{ marginTop: 12 }} onClick={() => goTab("questions")}>Open full answer review <span aria-hidden="true">→</span></button>
                    </div>
                  )}

                  <details className={styles.dataTable}>
                    <summary>View chart data as a table</summary>
                    <table>
                      <thead><tr><th scope="col">Question</th>{seriesDefs.map((s) => <th key={s.key} scope="col">{s.label.split(" (")[0]}</th>)}</tr></thead>
                      <tbody>
                        {detectedEmotions.map((e, i) => (
                          <tr key={i}><th scope="row">Q{i + 1}</th>{seriesDefs.map((s) => <td key={s.key}>{s.get(e)}%</td>)}</tr>
                        ))}
                      </tbody>
                    </table>
                  </details>
                </>
              )}
            </section>

            <div className={styles.grid2}>
              <section className={styles.card} aria-labelledby="speech-h">
                <div className={styles.cardHead}>
                  <div>
                    <span className={styles.eyebrow}>SPEECH & FLUENCY</span>
                    <h2 id="speech-h">Your pace and pauses</h2>
                  </div>
                  {hasData && <div className={styles.gradeCircle} role="img" aria-label={`Fluency grade ${fluencyGrade}, score ${fluencyScore} out of 100`}>{fluencyGrade}</div>}
                </div>
                {!hasData ? (
                  <p className={styles.empty}>No speech data yet. Answer a question to see pace and filler diagnostics.</p>
                ) : (
                  <div className={styles.gaugeWrap}>
                    <div>
                      <svg className={styles.gauge} viewBox="0 0 200 120" role="img" aria-label={`Average speaking pace ${avgWpm} words per minute, ${pacingCategory}`}>
                        <defs>
                          <linearGradient id="results-speed-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#9b3a2c" /><stop offset="25%" stopColor="#c08a2e" /><stop offset="50%" stopColor="#4f8a3c" /><stop offset="75%" stopColor="#c08a2e" /><stop offset="100%" stopColor="#9b3a2c" />
                          </linearGradient>
                        </defs>
                        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#e8ecdf" strokeWidth="14" strokeLinecap="round" />
                        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="url(#results-speed-grad)" strokeWidth="14" strokeLinecap="round" />
                        <g className={styles.needle} style={{ transform: `rotate(${needleAngle}deg)` }}>
                          <line x1="100" y1="100" x2="100" y2="34" stroke="#2e392e" strokeWidth="4" strokeLinecap="round" />
                        </g>
                        <circle cx="100" cy="100" r="8" fill="#2e392e" /><circle cx="100" cy="100" r="3.5" fill="#fffef8" />
                        <text x="20" y="116" textAnchor="middle">0</text><text x="100" y="18" textAnchor="middle">120</text><text x="180" y="116" textAnchor="middle">240+</text>
                      </svg>
                    </div>
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <p className={styles.bigNum}>{avgWpm}<small> words / min</small></p>
                      <p className={`${styles.pill} ${paceTone}`} style={{ marginTop: 8 }}>{pacingCategory}</p>
                      <p className={styles.note} style={{ marginTop: 14 }}><strong>Pause density:</strong> {averageHesitation}% — {pauseDensityDesc}.</p>
                      <p className={styles.note}><strong>Articulation clarity:</strong> {clarityOfComm}%.</p>
                    </div>
                  </div>
                )}
              </section>

              <section className={styles.card} aria-labelledby="fill-h">
                <span className={styles.eyebrow}>FILLER WORDS</span>
                <h2 id="fill-h">Crutch phrases</h2>
                <p className={styles.sub}>{fillerConcentration}% of your words were fillers.</p>
                {Object.entries(fillerCounts).map(([word, count]) => (
                  <div key={word} className={`${styles.fillerRow} ${fillerTone(count)}`}>
                    <div><span>&ldquo;{word}&rdquo;</span><span>{count} {count === 1 ? "time" : "times"}</span></div>
                    <Meter value={(count / maxFiller) * 100} label={`${word}, ${count} occurrences`} valueText={`${count} occurrences`} toneCls={fillerTone(count)} />
                  </div>
                ))}
                <p className={styles.note} style={{ marginTop: 14 }}>
                  {parseFloat(fillerConcentration) > 5
                    ? "Try a one-second pause when you feel a filler coming. Silence sounds more confident than “um”."
                    : "Very few fillers. Your delivery sounds polished and deliberate."}
                </p>
              </section>
            </div>

            <section className={styles.card} aria-labelledby="hind-h">
              <div className={styles.cardHead}>
                <div>
                  <span className={styles.eyebrow}>{hindsightData && !hindsightData.isLocalFallback ? "AI RETROSPECTIVE" : "SESSION RETROSPECTIVE"}</span>
                  <h2 id="hind-h">{isProfessional ? "Patterns across your interview" : "Patterns across your session"}</h2>
                  <p className={styles.sub}>Cross-question analysis that single-round scores can&apos;t see.</p>
                </div>
              </div>

              {hindsightLoading && !hindsightData && (
                <div style={{ display: "flex", alignItems: "center", gap: 14 }} role="status">
                  <div className={styles.spinner} aria-hidden="true" />
                  <span className={styles.note}>Analysing patterns across your answers…</span>
                </div>
              )}
              {!hindsightLoading && !hindsightData && (
                <p className={styles.empty}>Retrospective unavailable. Answer at least two questions to enable it.</p>
              )}
              {hindsightData && (
                <div>
                  {hindsightData.sessionNarrative && (
                    <div className={styles.hind}>
                      <span className={styles.eyebrow}>PERFORMANCE ARC</span>
                      <p>{hindsightData.sessionNarrative}</p>
                    </div>
                  )}
                  {hindsightData.trajectoryPattern && (
                    <p className={styles.note} style={{ marginBottom: 12 }}><strong>Confidence trajectory: {trajLabel}.</strong> {hindsightData.trajectoryDescription}</p>
                  )}
                  {hindsightData.contradictions?.length > 0 && (
                    <div className={styles.flag}>
                      <h4>Contradictions between rounds</h4>
                      {hindsightData.contradictions.map((c, i) => <p key={i}><strong>Rounds {c.rounds?.join(" ↔ ") || "—"}:</strong> {c.description}</p>)}
                    </div>
                  )}
                  {hindsightData.bluffingWarning && (
                    <div className={styles.flag}><h4>Bluffing pattern</h4><p>{hindsightData.bluffingWarning}</p></div>
                  )}
                  {(hindsightData.strongestRound || hindsightData.weakestRound) && (
                    <div className={styles.evidence}>
                      {hindsightData.strongestRound && (
                        <div className={styles.toneGood}><strong>✓ Strongest</strong><p><b>Q{hindsightData.strongestRound.round}: {hindsightData.strongestRound.topic}.</b> {hindsightData.strongestRound.evidence}</p></div>
                      )}
                      {hindsightData.weakestRound && (
                        <div className={styles.toneLow}><strong>! Weakest</strong><p><b>Q{hindsightData.weakestRound.round}: {hindsightData.weakestRound.topic}.</b> {hindsightData.weakestRound.evidence}</p></div>
                      )}
                    </div>
                  )}
                  {hindsightData.recommendations?.length > 0 && (
                    <div style={{ marginTop: 16 }}>
                      <span className={styles.eyebrow}>RECOMMENDATIONS</span>
                      <ol className={`${styles.points} ${styles.toneGood}`} style={{ marginTop: 10 }}>
                        {hindsightData.recommendations.map((r, i) => <li key={i}><span aria-hidden="true">{i + 1}</span><span>{r}</span></li>)}
                      </ol>
                    </div>
                  )}
                  {!hindsightData.contradictions?.length && !hindsightData.bluffingWarning && hindsightData.sessionNarrative && (
                    <div className={styles.okBox} style={{ marginTop: 14 }}><span aria-hidden="true">✓</span><span><strong>No contradictions or bluffing patterns.</strong> Your answers stayed consistent across all rounds.</span></div>
                  )}
                </div>
              )}
            </section>
          </div>
        </div>

        {/* ======================= PLAN ======================= */}
        <div id="results-panel-plan" role="tabpanel" aria-labelledby="results-tab-plan" hidden={activeTab !== "plan"} className={styles.panel}>
          <div className={styles.planTop}>
            <section className={styles.card} aria-labelledby="rev-h">
              <div className={styles.cardHead}>
                <div>
                  <span className={styles.eyebrow}>{isProfessional ? "DEVELOPMENT AREAS" : "REVISION UNITS"}</span>
                  <h2 id="rev-h">What to revisit</h2>
                </div>
                <button className={`${styles.btn} ${styles.btnSmall}`} onClick={() => { handleDownloadSchedule(); setLiveMsg("Study plan downloaded."); }}>Download plan (.md)</button>
              </div>
              <ul className={styles.topics}>
                {revisionPills.map((p, i) => <li key={i}>{p.topic}<small>{p.time}</small></li>)}
              </ul>
              {weakConcepts.length > 0 && <p className={styles.note} style={{ marginTop: 14 }}><strong>Flagged during the session:</strong> {weakConcepts.join(", ")}.</p>}
            </section>
            <section className={styles.planProgress} aria-labelledby="prog-h">
              <span className={styles.eyebrow} id="prog-h">PLAN PROGRESS</span>
              <strong>{planPct}%</strong>
              <Meter value={planPct} label="Plan progress" toneCls={styles.toneGood} />
              <p className={styles.note} style={{ marginTop: 10 }}>{doneCount} of {plan.length} days done. {doneCount === plan.length ? "Lovely work — time for another session." : "Tick a day when you finish it."}</p>
            </section>
          </div>

          <ol className={styles.days} aria-label="Five day plan">
            {plan.map((d) => {
              const done = !!doneDays[d.day];
              return (
                <li key={d.day} className={styles.day} data-done={done}>
                  <span className={styles.eyebrow}>DAY {d.day}</span>
                  <h3>{d.focus}</h3>
                  <span className={styles.when}>{d.time}</span>
                  <ul>{d.actions.map((a, i) => <li key={i}>{a}</li>)}</ul>
                  <button className={styles.dayCheck} aria-pressed={done} onClick={() => toggleDay(d.day)}>
                    <span className={styles.box} aria-hidden="true">{done ? "✓" : ""}</span>
                    {done ? "Done" : "Mark day complete"}
                  </button>
                </li>
              );
            })}
          </ol>
        </div>

        <div className={styles.footer}>
          <span>PrepSim / Your session report</span>
          <p>Progress is a practice. Keep showing up.</p>
          <span>AI feedback is guidance, not an official grade.</span>
        </div>
      </div>
    </section>
  );
}

/* Accessible progress bar: meaningful value for assistive tech, animated fill for sighted users. */
function Meter({ value, label, toneCls, valueText }) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setW(value));
    return () => cancelAnimationFrame(id);
  }, [value]);
  return (
    <div className={`${styles.bar} ${toneCls || ""}`} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value)} aria-valuetext={valueText || `${Math.round(value)} percent`}>
      <div className={styles.barFill} style={{ width: `${Math.min(Math.max(w, 0), 100)}%` }} />
    </div>
  );
}
