"use client";

import React, { useState, useEffect } from "react";
import { VoiceManager } from "@/services/voiceManager";

export default function Results({ resultsData, onRestart, onGoDashboard }) {
  const [activeTimelineIndex, setActiveTimelineIndex] = useState(0);
  const [expandedReplayIndex, setExpandedReplayIndex] = useState(null);
  const [playingReplayIndex, setPlayingReplayIndex] = useState(null);
  const [pastSessionsAvg, setPastSessionsAvg] = useState(null);
  const [scoreOffset, setScoreOffset] = useState(314.16);
  const [activeRightTab, setActiveRightTab] = useState("timeline"); // "timeline" | "fluency"
  const [mobileTab, setMobileTab] = useState("overview"); // "overview" | "metrics" | "qa" | "plan"
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

  // Cleanup active audio playbacks on unmount
  useEffect(() => {
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
      correctnessSum += emo.correctness || 80;
      confSum += emo.confidence || 80;
      clarSum += emo.clarity || 80;
      depthSum += emo.completeness || 75;
      pressureSum += (100 - (emo.nervousness || 20));
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
      differences += Math.pow((emo.correctness || 80) - avgCorrectness, 2);
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
      
      if (containsDeflection && (emo.correctness || 80) < 68) {
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
        const topicWords = topicText.toLowerCase().split(/\s+/).filter(w => w.length > 3);
        if (topicWords.length > 0) {
          const occurrences = topicWords.reduce((acc, word) => {
            // Escape any special regex characters to prevent SyntaxError
            const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`\\b${escapedWord}\\b`, "g");
            return acc + (cleanAns.match(regex) || []).length;
          }, 0);
          
          if (occurrences >= 3 && (emo.correctness || 80) < 65) {
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
      if (hasAbsolute && (emo.correctness || 80) < 70) {
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
  
  let overallScore = Math.round(
    (subjectUnderstanding * 0.35) + 
    (vocalConfidence * 0.2) + 
    (clarityOfComm * 0.15) + 
    (conceptualDepth * 0.2) + 
    (handlingPressure * 0.1)
  );
  overallScore = totalRounds > 0 ? Math.min(Math.max(overallScore, 40), 99) : 0;
  if (endedEarly && totalRounds > 0) {
    overallScore = Math.round(overallScore * 0.6);
  }

  // Radial score stroke offset animation
  useEffect(() => {
    const offset = 314.16 - (314.16 * overallScore) / 100;
    const timer = setTimeout(() => {
      setScoreOffset(offset);
    }, 150);
    return () => clearTimeout(timer);
  }, [overallScore]);

  // Decryption / Rolling animation for overall score number
  useEffect(() => {
    if (overallScore <= 0) {
      setDisplayedScore(0);
      return;
    }

    const duration = 1200; // Animation duration in ms
    const intervalTime = 30; // Update rate in ms
    const totalSteps = duration / intervalTime;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      if (step >= totalSteps) {
        clearInterval(timer);
        setDisplayedScore(overallScore);
      } else {
        // Fast random rolling sequence to simulate decryption scan
        const randomVal = Math.floor(Math.random() * 90) + 10;
        setDisplayedScore(randomVal);
      }
    }, intervalTime);

    return () => clearInterval(timer);
  }, [overallScore]);

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

  // Fluency & Speech diagnostics dashboard view renderer
  const renderFluencyDiagnostics = () => {
    if (detectedEmotions.length === 0) {
      return (
        <div className="card" style={{ padding: "var(--space-lg)", textAlign: "center", minHeight: "150px", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)" }}>
          <p style={{ margin: 0, fontSize: "0.875rem" }}>
            No speech data available. Answer at least one question during the session to see fluency diagnostics.
          </p>
        </div>
      );
    }
    const averageHesitation = detectedEmotions.length > 0
      ? Math.round(detectedEmotions.reduce((acc, emo) => acc + (emo.hesitation || 15), 0) / totalRounds)
      : 15;
    
    let fluencyBase = 100;
    const fillerRatio = parseFloat(fillerConcentration);
    fluencyBase -= (fillerRatio * 4);
    
    if (avgWpm < 90 || avgWpm > 170) {
      fluencyBase -= 25;
    } else if (avgWpm < 110 || avgWpm > 150) {
      fluencyBase -= 10;
    }
    
    const fluencyScore = Math.min(Math.max(Math.round(fluencyBase), 45), 99);
    
    let fluencyGrade = "C";
    if (fluencyScore >= 95) fluencyGrade = "A+";
    else if (fluencyScore >= 88) fluencyGrade = "A";
    else if (fluencyScore >= 80) fluencyGrade = "B+";
    else if (fluencyScore >= 70) fluencyGrade = "B";
    else if (fluencyScore >= 55) fluencyGrade = "C+";
    
    let pauseDensityDesc = "Moderate (Measured Pacing)";
    if (averageHesitation < 15) {
      pauseDensityDesc = "Sparse (Highly Articulate)";
    } else if (averageHesitation > 30) {
      pauseDensityDesc = "Dense (Frequent Vocal Pauses)";
    }

    const getFillerColor = (count) => {
      if (count === 0) return "hsl(145, 70%, 45%)";
      if (count <= 2) return "hsl(145, 70%, 45%)";
      if (count <= 5) return "hsl(38, 85%, 48%)";
      return "hsl(0, 75%, 50%)";
    };

    const maxFillerVal = Math.max(...Object.values(fillerCounts), 4);

    return (
      <div className="fluency-diagnostics-box" style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
        
        {/* ROW 1: Letter Grade and Speedometer Gauge */}
        <div className="card" style={{ padding: "var(--space-lg)", textAlign: "left" }}>
          <div className="fluency-header-row">
            <div>
              <h3 style={{ fontSize: "1.05rem", fontWeight: "700", margin: 0 }}>Vocal Speedometer & Grade</h3>
              <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", margin: "2px 0 0 0" }}>Analysis of verbal velocity and structural clarity.</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: "0.7rem", fontWeight: "600", textTransform: "uppercase", color: "var(--text-secondary)" }}>Fluency Grade</span>
                <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: "500" }}>Score: {fluencyScore}/100</div>
              </div>
              <div className="letter-grade-circle">{fluencyGrade}</div>
            </div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: "var(--space-lg)" }}>
            {/* Speedometer SVG */}
            <div style={{ width: "200px", display: "flex", flexDirection: "column", alignItems: "center" }}>
              <svg width="200" height="110" viewBox="0 0 200 110" className="speedometer-svg">
                <defs>
                  <linearGradient id="speed-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="hsl(0, 60%, 42%)" />
                    <stop offset="25%" stopColor="hsl(38, 85%, 45%)" />
                    <stop offset="50%" stopColor="var(--color-success)" />
                    <stop offset="75%" stopColor="hsl(38, 85%, 45%)" />
                    <stop offset="100%" stopColor="hsl(0, 60%, 42%)" />
                  </linearGradient>
                </defs>
                <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="var(--bg-primary)" strokeWidth="12" strokeLinecap="round" />
                <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="url(#speed-grad)" strokeWidth="12" strokeLinecap="round" opacity="0.85" />
                
                <line x1="20" y1="100" x2="30" y2="100" stroke="var(--border-color)" strokeWidth="2" />
                <line x1="100" y1="20" x2="100" y2="30" stroke="var(--border-color)" strokeWidth="2" />
                <line x1="180" y1="100" x2="170" y2="100" stroke="var(--border-color)" strokeWidth="2" />

                <g transform="translate(100, 100)">
                  <line x1="0" y1="0" x2="0" y2="-72" stroke="var(--accent-primary)" strokeWidth="3.5" strokeLinecap="round" style={{ transform: `rotate(${needleAngle}deg)`, transformOrigin: "0% 0%", transition: "transform 1.5s cubic-bezier(0.25, 0.8, 0.25, 1)" }} />
                  <circle cx="0" cy="0" r="7" fill="var(--accent-primary)" />
                  <circle cx="0" cy="0" r="3.5" fill="var(--bg-card)" />
                </g>
                <text x="25" y="108" textAnchor="middle" fontSize="8px" fontWeight="600" fill="var(--text-muted)">0 WPM</text>
                <text x="100" y="15" textAnchor="middle" fontSize="8px" fontWeight="600" fill="var(--text-muted)">120</text>
                <text x="175" y="108" textAnchor="middle" fontSize="8px" fontWeight="600" fill="var(--text-muted)">240+</text>
              </svg>
              <div style={{ marginTop: "4px", textAlign: "center" }}>
                <span style={{ fontSize: "0.85rem", fontWeight: "700", color: pacingColor, backgroundColor: pacingBg, padding: "2px 8px", borderRadius: "var(--radius-full)" }}>
                  {avgWpm} WPM ({pacingCategory})
                </span>
              </div>
            </div>

            {/* Scorecard Detailed Grid */}
            <div style={{ flex: 1, minWidth: "180px", display: "flex", flexDirection: "column", gap: "8px" }}>
              <div className="fluency-metric-card" style={{ padding: "8px 12px" }}>
                <span className="fluency-metric-title">Articulation Clarity</span>
                <span className="fluency-metric-value">{clarityOfComm}%</span>
                <span className="fluency-metric-desc">High phonetic structure stability.</span>
              </div>
              <div className="fluency-metric-card" style={{ padding: "8px 12px" }}>
                <span className="fluency-metric-title">Pause Density</span>
                <span className="fluency-metric-value">{averageHesitation}%</span>
                <span className="fluency-metric-desc">{pauseDensityDesc}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ROW 2: Horizontal Filler Words Bar Chart */}
        <div className="card" style={{ padding: "var(--space-lg)", textAlign: "left" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: "1px solid var(--border-color)", paddingBottom: "var(--space-sm)", marginBottom: "var(--space-md)" }}>
            <div>
              <h3 style={{ fontSize: "1.05rem", fontWeight: "700", margin: 0 }}>Lexical Filler Distribution</h3>
              <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", margin: "2px 0 0 0" }}>Real-time occurrence of lexical crutch phrases.</p>
            </div>
            <div style={{ fontSize: "0.85rem", fontWeight: "700", color: parseFloat(fillerConcentration) > 5 ? "var(--color-warning)" : "var(--color-success)" }}>
              Concentration Ratio: {fillerConcentration}%
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {Object.entries(fillerCounts).map(([word, count]) => {
              const fillPercent = Math.min((count / maxFillerVal) * 100, 100);
              const barColor = getFillerColor(count);
              return (
                <div key={word} className="filler-bar-container" style={{ margin: 0 }}>
                  <div className="filler-bar-header">
                    <span className="filler-bar-label">&quot;{word}&quot;</span>
                    <span className="filler-bar-count">
                      {count} {count === 1 ? "occurrence" : "occurrences"}
                    </span>
                  </div>
                  <div className="filler-bar-track">
                    <div 
                      className="filler-bar-fill" 
                      style={{ 
                        width: `${fillPercent}%`, 
                        backgroundColor: barColor 
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <p style={{ margin: "10px 0 0 0", fontSize: "0.75rem", color: "var(--text-secondary)", lineHeight: "1.4" }}>
            {parseFloat(fillerConcentration) > 5
              ? "Tip: Try taking a deliberate 1-second pause when you feel the urge to say a filler word. Silence is more professional."
              : "Excellent work! Your speech contains very few filler words, creating a highly polished academic impression."}
          </p>
        </div>

      </div>
    );
  };

  // Graph math
  const renderGraphTimeline = () => {
    if (totalRounds === 0) {
      return (
        <div className="graph-canvas-box" style={{ 
          width: "100%", 
          height: "180px", 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center", 
          border: "1px dashed var(--border-color)", 
          borderRadius: "var(--radius-md)",
          color: "var(--text-secondary)",
          fontSize: "0.85rem",
          padding: "16px",
          textAlign: "center",
          backgroundColor: "var(--bg-primary)"
        }}>
          No timeline data available. Answer at least one question during the session to display an emotion timeline.
        </div>
      );
    }
    const width = 500;
    const height = 160;
    const paddingX = 40;
    const paddingY = 25;
    const stepX = (width - paddingX * 2) / (totalRounds - 1 || 1);

    const mapY = (val) => {
      // Map score 30-100 to graph limits
      const pct = (val - 30) / 70;
      return height - paddingY - pct * (height - paddingY * 2);
    };

    let confidencePath = "";
    let nervousnessPath = "";
    let hesitationPath = "";
    const nodes = [];

    for (let i = 0; i < totalRounds; i++) {
      const emo = detectedEmotions[i] || { confidence: 80, nervousness: 20, hesitation: 15 };
      const cx = paddingX + i * stepX;
      
      const cyConf = mapY(emo.confidence || 80);
      const cyNerv = mapY(100 - (emo.nervousness || 20)); // Inverse so high value is good/calm
      const cyHes = mapY(100 - (emo.hesitation || 15));

      if (i === 0) {
        confidencePath = `M ${cx} ${cyConf}`;
        nervousnessPath = `M ${cx} ${cyNerv}`;
        hesitationPath = `M ${cx} ${cyHes}`;
      } else {
        confidencePath += ` L ${cx} ${cyConf}`;
        nervousnessPath += ` L ${cx} ${cyNerv}`;
        hesitationPath += ` L ${cx} ${cyHes}`;
      }

      nodes.push({ index: i, cx, cyConf, cyNerv, cyHes, ...emo });
    }

    return (
      <div className="graph-canvas-box" style={{ width: "100%", height: "180px", position: "relative" }}>
        <svg className="graph-svg" viewBox="0 0 500 160" preserveAspectRatio="none" style={{ width: "100%", height: "100%" }}>
          {/* Horizontal Gridlines */}
          <line x1="0" y1={mapY(90)} x2="500" y2={mapY(90)} stroke="var(--border-color)" strokeWidth="1" strokeDasharray="3" />
          <line x1="0" y1={mapY(70)} x2="500" y2={mapY(70)} stroke="var(--border-color)" strokeWidth="1" strokeDasharray="3" />
          <line x1="0" y1={mapY(50)} x2="500" y2={mapY(50)} stroke="var(--border-color)" strokeWidth="1" strokeDasharray="3" />

          {/* Paths */}
          {confidencePath && <path d={confidencePath} fill="none" stroke="hsl(215, 35%, 26%)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
          {nervousnessPath && <path d={nervousnessPath} fill="none" stroke="hsl(38, 85%, 45%)" strokeWidth="1.5" strokeDasharray="4" strokeLinecap="round" strokeLinejoin="round" />}
          {hesitationPath && <path d={hesitationPath} fill="none" stroke="hsl(0, 60%, 42%)" strokeWidth="1.5" strokeDasharray="1 3" strokeLinecap="round" strokeLinejoin="round" />}

          {/* Grid nodes */}
          {nodes.map((node) => (
            <g key={node.index}>
              <circle 
                cx={node.cx} 
                cy={node.cyConf} 
                r={activeTimelineIndex === node.index ? 7 : 4} 
                fill={activeTimelineIndex === node.index ? "hsl(215, 35%, 26%)" : "var(--bg-card)"} 
                stroke="hsl(215, 35%, 26%)" 
                strokeWidth="2" 
                style={{ cursor: "pointer", transition: "var(--transition-smooth)" }}
                onClick={() => setActiveTimelineIndex(node.index)}
              />
              <text x={node.cx} y={height - 5} textAnchor="middle" fontSize="9px" fontWeight="600" fill="var(--text-muted)">
                Q{node.index + 1}
              </text>
            </g>
          ))}
        </svg>
      </div>
    );
  };

  return (
    <section id="results-screen" className="screen active" style={{ position: "relative" }}>
      {/* Inline styles for certificate-grade Print/PDF layout */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body {
            background-color: #ffffff !important;
            color: #111111 !important;
            font-size: 11px !important;
          }
          header, footer, button, .results-header-section div, .btn, .no-print {
            display: none !important;
          }
          main {
            padding: 0 !important;
          }
          .results-container {
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
          }
          .results-grid {
            display: block !important;
          }
          .card {
            border: 1px solid #d3d3d3 !important;
            box-shadow: none !important;
            margin-bottom: var(--space-md) !important;
            page-break-inside: avoid !important;
            background-color: #ffffff !important;
          }
          .graph-canvas-box {
            height: 140px !important;
          }
          .accordion-content {
            display: block !important;
            max-height: none !important;
            padding: var(--space-sm) !important;
          }
          .badge-row {
            margin-top: 4px !important;
          }
        }
      `}} />

      <div className="results-container">
        
        {/* Top Header Card */}
        <div className="results-header-section">
          <div className="results-title-group" style={{ textAlign: "left" }}>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
              <span className="results-subject-tag" id="results-topic-badge">{subjectName}</span>
              {isLastMinute && (
                <span className="results-subject-tag" style={{ backgroundColor: "var(--accent-light)", color: "var(--accent-primary)" }}>
                  Last-Minute Prep
                </span>
              )}
              {isMockExternal && (
                <span className="results-subject-tag" style={{ backgroundColor: "var(--color-error-bg)", color: "var(--color-error)" }}>
                  Mock External Board
                </span>
              )}
            </div>
            <h1 style={{ marginTop: "6px", marginBottom: "0", fontSize: "1.75rem", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{isProfessional ? "Mock Interview Performance Transcript" : "Oral Examination Transcript"}</h1>
            <p style={{ margin: "2px 0 0 0" }}>{isProfessional ? "High-fidelity post-interview evaluation and delivery metrics." : "High-fidelity post-viva cognitive and delivery metrics."}</p>
          </div>
          <div className="no-print" style={{ display: "flex", gap: "var(--space-xs)" }}>
            <button className="btn btn-secondary" onClick={handlePrintReport} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
              </svg>
              Download Report
            </button>
            <button className="btn btn-primary" onClick={onRestart}>Practice Again</button>
            <button className="btn btn-secondary" onClick={onGoDashboard}>Dashboard</button>
          </div>
        </div>
        {/* Mobile Navigation Tabs Strip (Hidden on Desktop via CSS) */}
        <div className="mobile-results-nav no-print">
          <button 
            className={`mobile-results-tab-btn ${mobileTab === 'overview' ? 'active' : ''}`}
            onClick={() => setMobileTab('overview')}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
            Summary
          </button>
          <button 
            className={`mobile-results-tab-btn ${mobileTab === 'metrics' ? 'active' : ''}`}
            onClick={() => setMobileTab('metrics')}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M3 3v18h18" />
              <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" />
            </svg>
            Analytics
          </button>
          <button 
            className={`mobile-results-tab-btn ${mobileTab === 'qa' ? 'active' : ''}`}
            onClick={() => setMobileTab('qa')}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            Q&A Replay
          </button>
          <button 
            className={`mobile-results-tab-btn ${mobileTab === 'plan' ? 'active' : ''}`}
            onClick={() => setMobileTab('plan')}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            Study Plan
          </button>
        </div>

        <div className="results-grid">
          
          {/* LEFT PANEL: Academic Scorecard, Emotion Sliders, Bluffing */}
          <div className="performance-left-panel" style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
            
            <div className={`card scorecard-card ${mobileTab === 'overview' ? '' : 'mobile-hide'}`} style={{ padding: "var(--space-lg)", position: "relative" }}>
              <h3 style={{ fontSize: "1.05rem", fontWeight: "700", borderBottom: "1px solid var(--border-color)", paddingBottom: "var(--space-sm)", marginBottom: "var(--space-md)", textAlign: "left" }}>
                Scorecard Breakdown
              </h3>
              
              <div className="scorecard-radial-row">
                {/* Radial Score Circle */}
                <div className="radial-svg-wrapper" style={{ width: "110px", height: "110px", flexShrink: 0 }}>
                  <svg viewBox="0 0 120 120" style={{ width: "100%", height: "100%" }}>
                    <circle className="radial-svg-circle-bg" cx="60" cy="60" r="50" />
                    <circle 
                      className="radial-svg-circle-fill" 
                      cx="60" 
                      cy="60" 
                      r="50" 
                      strokeDasharray="314.16" 
                      strokeDashoffset={scoreOffset}
                      style={{
                        fill: "none",
                        stroke: "var(--accent-primary)",
                        strokeWidth: 10,
                        strokeLinecap: "round",
                        transform: "rotate(-90deg)",
                        transition: "stroke-dashoffset 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)"
                      }}
                    />
                  </svg>
                  <div className="radial-score-value" style={{ fontSize: "1.6rem", fontWeight: "800", color: "var(--accent-primary)" }}>{displayedScore}%</div>
                </div>

                <div style={{ textAlign: "left", flex: 1 }}>
                  <span style={{ fontSize: "0.8rem", textTransform: "uppercase", fontWeight: "600", color: "var(--text-secondary)", letterSpacing: "0.05em" }}>Overall Standing</span>
                  <h4 style={{ margin: "2px 0", fontSize: "1.15rem", fontWeight: "700", color: "var(--accent-primary)" }}>{gradeLabel}</h4>
                  <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-secondary)", lineHeight: "1.4" }}>{evaluationVerdict}</p>
                </div>
              </div>

              {/* Six detailed score fields */}
              <div className="scorecard-details-grid" style={{ gap: "var(--space-sm)", marginTop: "var(--space-lg)", borderTop: "1px solid var(--border-color)", paddingTop: "var(--space-md)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: "var(--radius-sm)", backgroundColor: "var(--bg-primary)" }}>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{isProfessional ? "Technical/Domain Competence" : "Subject Understanding"}</span>
                  <strong style={{ fontSize: "0.9rem", color: "var(--accent-primary)" }}>{subjectUnderstanding}%</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: "var(--radius-sm)", backgroundColor: "var(--bg-primary)" }}>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{isProfessional ? "Communication Confidence" : "Speaking Confidence"}</span>
                  <strong style={{ fontSize: "0.9rem", color: "var(--accent-primary)" }}>{vocalConfidence}%</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: "var(--radius-sm)", backgroundColor: "var(--bg-primary)" }}>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{isProfessional ? "Clarity & Delivery" : "Speaking Clarity"}</span>
                  <strong style={{ fontSize: "0.9rem", color: "var(--accent-primary)" }}>{clarityOfComm}%</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: "var(--radius-sm)", backgroundColor: "var(--bg-primary)" }}>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{isProfessional ? "Problem-Solving Depth" : "Conceptual Depth"}</span>
                  <strong style={{ fontSize: "0.9rem", color: "var(--accent-primary)" }}>{conceptualDepth}%</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: "var(--radius-sm)", backgroundColor: "var(--bg-primary)" }}>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{isProfessional ? "Stress Tolerance" : "Handling Pressure"}</span>
                  <strong style={{ fontSize: "0.9rem", color: "var(--accent-primary)" }}>{handlingPressure}%</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: "var(--radius-sm)", backgroundColor: "var(--bg-primary)" }}>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{isProfessional ? "Role Consistency" : "Consistency"}</span>
                  <strong style={{ fontSize: "0.9rem", color: "var(--accent-primary)" }}>{consistency}%</strong>
                </div>
              </div>
            </div>

            <div className={`card bluff-card ${mobileTab === 'metrics' ? '' : 'mobile-hide'}`} style={{ padding: "var(--space-md) var(--space-lg)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-color)", paddingBottom: "var(--space-sm)", marginBottom: "var(--space-sm)" }}>
                <span style={{ fontSize: "0.95rem", fontWeight: "700", color: "var(--accent-primary)", display: "flex", alignItems: "center", gap: "6px" }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: "16px", height: "16px", color: bluffProb > 40 ? "var(--color-warning)" : "var(--color-success)" }}>
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                  Bluff Index Analyzer
                </span>
                <span style={{ fontSize: "0.85rem", fontWeight: "700", color: bluffProb > 40 ? "var(--color-warning)" : "var(--color-success)" }}>
                  Probability: {bluffProb}%
                </span>
              </div>
              <div style={{ height: "6px", backgroundColor: "var(--bg-primary)", borderRadius: "var(--radius-full)", position: "relative", marginBottom: "var(--space-sm)" }}>
                <div style={{
                  height: "100%",
                  width: `${bluffProb}%`,
                  borderRadius: "var(--radius-full)",
                  backgroundColor: bluffProb > 60 ? "var(--color-error)" : (bluffProb > 30 ? "var(--color-warning)" : "var(--color-success)"),
                  transition: "width 0.8s ease"
                }}></div>
              </div>
              <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-secondary)", textAlign: "left", lineHeight: "1.4" }}>
                {bluffProb > 40 
                  ? "Note: Lexical metrics indicate confident and structured speaking structure, but with low correlation to specific technical formulas. Recommend reducing generic filler explanations during technical concepts."
                  : "Note: Outstanding logical congruence. The technical accuracy matches speaking volume perfectly, indicating no memorize-bluff attempts."}
              </p>
            </div>

            <div className={`card historical-card ${mobileTab === 'overview' ? '' : 'mobile-hide'}`} style={{ padding: "var(--space-md) var(--space-lg)", textAlign: "left" }}>
              <h3 style={{ fontSize: "0.95rem", fontWeight: "700", borderBottom: "1px solid var(--border-color)", paddingBottom: "var(--space-sm)", marginBottom: "var(--space-sm)" }}>
                Historical Progress Comparison
              </h3>
              {pastSessionsAvg !== null ? (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "6px 0" }}>
                    <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{isProfessional ? "Previous Role Average" : "Previous Subject Average"}</span>
                    <strong style={{ fontSize: "0.85rem", color: "var(--text-primary)" }}>{pastSessionsAvg}%</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "6px 0" }}>
                    <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{isProfessional ? "Current Interview Score" : "Current Viva Score"}</span>
                    <strong style={{ fontSize: "0.85rem", color: "var(--accent-primary)" }}>{overallScore}%</strong>
                  </div>
                  <div style={{
                    marginTop: "var(--space-sm)",
                    padding: "8px 12px",
                    borderRadius: "var(--radius-xs)",
                    backgroundColor: overallScore >= pastSessionsAvg ? "var(--color-success-bg)" : "var(--color-error-bg)",
                    color: overallScore >= pastSessionsAvg ? "var(--color-success)" : "var(--color-error)",
                    fontSize: "0.8rem",
                    fontWeight: "600",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px"
                  }}>
                    {overallScore >= pastSessionsAvg ? (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <polyline points="18 15 12 9 6 15"/>
                        </svg>
                        Performance increase of +{overallScore - pastSessionsAvg}% compared to baseline.
                      </>
                    ) : (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <polyline points="6 9 12 15 18 9"/>
                        </svg>
                        Score is -{pastSessionsAvg - overallScore}% below your historical baseline.
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--text-secondary)" }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: "20px", height: "20px" }}>
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="16" x2="12" y2="12"></line>
                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                  </svg>
                  <span style={{ fontSize: "0.8rem" }}>{isProfessional ? "First session registered for this role. Subsequent practice will unlock delta progress metrics." : "First viva registered for this subject. Subsequent exams will unlock delta progress metrics."}</span>
                </div>
              )}
            </div>

            <div className={`card suggested-revision-card smart-revision-card ${mobileTab === 'plan' ? '' : 'mobile-hide'}`} style={{ padding: "var(--space-lg)" }}>
              <h3 style={{ fontSize: "1.05rem", fontWeight: "700", borderBottom: "1px solid var(--border-color)", paddingBottom: "var(--space-sm)", marginBottom: "var(--space-sm)", textAlign: "left" }}>
                {isProfessional ? "Targeted Development Plan" : "Smart Revision Plan"}
              </h3>
              <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "var(--space-md)", textAlign: "left" }}>
                {isProfessional ? "Prioritized development queue compiled from detected competency gaps." : "Prioritized revision queue compiled from detected conceptual gaps."}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
                {getSuggestedRevisionPills().map((rev, idx) => (
                  <div key={idx} className="suggested-revision-row">
                    <span style={{ fontSize: "0.85rem", fontWeight: "600", color: "var(--accent-primary)" }}>
                      {idx + 1}. {rev.topic}
                    </span>
                    <span style={{ fontSize: "0.75rem", padding: "2px 8px", borderRadius: "var(--radius-full)", backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}>
                      {rev.time}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Hindsight Retrospective Card */}
            <div className={`card hindsight-card ${mobileTab === 'plan' ? '' : 'mobile-hide'}`} style={{ padding: "var(--space-lg)", textAlign: "left", position: "relative", overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border-color)", paddingBottom: "var(--space-sm)", marginBottom: "var(--space-md)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div style={{
                    width: "28px", height: "28px", borderRadius: "50%",
                    background: "linear-gradient(135deg, hsl(258, 80%, 56%), hsl(280, 75%, 50%))",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "0.85rem", flexShrink: 0
                  }}>🔍</div>
                  <h3 style={{ fontSize: "1.05rem", fontWeight: "700", margin: 0 }}>
                    {isProfessional ? "AI Interview Retrospective" : "AI Session Retrospective"}
                  </h3>
                </div>
                {hindsightData && !hindsightData.isLocalFallback && (
                  <span style={{
                    fontSize: "0.65rem", padding: "2px 8px", borderRadius: "var(--radius-full)",
                    background: "linear-gradient(135deg, hsl(258, 80%, 56%), hsl(280, 75%, 50%))",
                    color: "#fff", fontWeight: "700", letterSpacing: "0.05em", textTransform: "uppercase"
                  }}>AI Powered</span>
                )}
              </div>
              <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "var(--space-md)", marginTop: 0 }}>
                {isProfessional
                  ? "Cross-question retrospective analysis of your complete interview session, detecting patterns invisible to per-round scoring."
                  : "Cross-question retrospective analysis of your complete exam session, detecting patterns invisible to per-round scoring."
                }
              </p>

              {hindsightLoading && !hindsightData && (
                <div style={{
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  padding: "var(--space-lg)", gap: "var(--space-sm)"
                }}>
                  <div className="hindsight-loading-spinner" style={{
                    width: "32px", height: "32px", border: "3px solid var(--border-color)",
                    borderTopColor: "hsl(258, 80%, 56%)", borderRadius: "50%",
                    animation: "hindsight-spin 0.8s linear infinite"
                  }}></div>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: "500" }}>
                    Analyzing cross-question patterns...
                  </span>
                </div>
              )}

              {!hindsightLoading && !hindsightData && (
                <div style={{
                  padding: "var(--space-md)", borderRadius: "var(--radius-sm)",
                  backgroundColor: "var(--bg-primary)", border: "1px solid var(--border-color)",
                  fontSize: "0.8rem", color: "var(--text-secondary)", textAlign: "center"
                }}>
                  Hindsight analysis unavailable for this session. Answer at least 2 questions to enable cross-question retrospective.
                </div>
              )}

              {hindsightData && (
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
                  
                  {/* Session Narrative */}
                  {hindsightData.sessionNarrative && (
                    <div style={{
                      padding: "12px var(--space-md)",
                      borderLeft: "4px solid hsl(258, 80%, 56%)",
                      backgroundColor: "hsla(258, 80%, 56%, 0.04)",
                      borderRadius: "0 var(--radius-sm) var(--radius-sm) 0"
                    }}>
                      <span style={{ fontSize: "0.7rem", fontWeight: "700", textTransform: "uppercase", color: "hsl(258, 60%, 45%)", letterSpacing: "0.05em" }}>Performance Arc</span>
                      <p style={{ margin: "4px 0 0 0", fontSize: "0.85rem", color: "var(--text-primary)", lineHeight: "1.5" }}>
                        {hindsightData.sessionNarrative}
                      </p>
                    </div>
                  )}

                  {/* Trajectory Indicator */}
                  {hindsightData.trajectoryPattern && (
                    <div style={{
                      display: "flex", alignItems: "center", gap: "10px",
                      padding: "10px var(--space-md)",
                      borderRadius: "var(--radius-sm)",
                      backgroundColor: "var(--bg-primary)",
                      border: "1px solid var(--border-color)"
                    }}>
                      <div style={{
                        width: "36px", height: "36px", borderRadius: "50%",
                        backgroundColor: hindsightData.trajectoryPattern === "ascending" ? "var(--color-success-bg)" : (hindsightData.trajectoryPattern === "declining" ? "var(--color-error-bg)" : "hsla(38, 85%, 45%, 0.08)"),
                        display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem", flexShrink: 0
                      }}>
                        {hindsightData.trajectoryPattern === "ascending" ? "📈" : (hindsightData.trajectoryPattern === "declining" ? "📉" : "➡️")}
                      </div>
                      <div>
                        <span style={{ fontSize: "0.7rem", fontWeight: "700", textTransform: "uppercase", color: "var(--text-secondary)", letterSpacing: "0.04em" }}>Confidence Trajectory</span>
                        <p style={{ margin: "2px 0 0 0", fontSize: "0.8rem", color: "var(--text-primary)", lineHeight: "1.4" }}>
                          {hindsightData.trajectoryDescription}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Contradictions Detected */}
                  {hindsightData.contradictions && hindsightData.contradictions.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
                      <span style={{ fontSize: "0.7rem", fontWeight: "700", textTransform: "uppercase", color: "var(--color-error)", letterSpacing: "0.05em" }}>⚠️ Contradictions Detected</span>
                      {hindsightData.contradictions.map((c, cIdx) => (
                        <div key={cIdx} style={{
                          padding: "10px var(--space-md)",
                          borderRadius: "var(--radius-sm)",
                          backgroundColor: "var(--color-error-bg)",
                          border: "1px solid hsla(0, 60%, 42%, 0.15)",
                          fontSize: "0.8rem", color: "var(--text-primary)", lineHeight: "1.4"
                        }}>
                          <strong style={{ color: "var(--color-error)", fontSize: "0.75rem" }}>Rounds {c.rounds?.join(" ↔ ") || "—"}</strong>
                          <p style={{ margin: "4px 0 0 0" }}>{c.description}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Bluffing Warning */}
                  {hindsightData.bluffingWarning && (
                    <div style={{
                      padding: "10px var(--space-md)",
                      borderRadius: "var(--radius-sm)",
                      backgroundColor: "hsla(38, 85%, 45%, 0.06)",
                      border: "1px solid hsla(38, 85%, 45%, 0.2)",
                      fontSize: "0.8rem", color: "var(--text-primary)", lineHeight: "1.4"
                    }}>
                      <strong style={{ color: "hsl(38, 85%, 35%)", fontSize: "0.75rem", display: "block", marginBottom: "4px" }}>🎭 Bluffing Pattern Detected</strong>
                      {hindsightData.bluffingWarning}
                    </div>
                  )}

                  {/* Strongest & Weakest Round Evidence */}
                  <div className="hindsight-evidence-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-sm)" }}>
                    {hindsightData.strongestRound && (
                      <div style={{
                        padding: "10px", borderRadius: "var(--radius-sm)",
                        backgroundColor: "var(--color-success-bg)",
                        border: "1px solid rgba(22, 163, 74, 0.15)"
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                          <span style={{ fontSize: "0.95rem" }}>💪</span>
                          <span style={{ fontSize: "0.7rem", fontWeight: "700", textTransform: "uppercase", color: "var(--color-success)", letterSpacing: "0.04em" }}>Strongest</span>
                        </div>
                        <p style={{ margin: 0, fontSize: "0.8rem", fontWeight: "600", color: "var(--text-primary)" }}>
                          Q{hindsightData.strongestRound.round}: {hindsightData.strongestRound.topic}
                        </p>
                        <p style={{ margin: "4px 0 0 0", fontSize: "0.75rem", color: "var(--text-secondary)", lineHeight: "1.35" }}>
                          {hindsightData.strongestRound.evidence}
                        </p>
                      </div>
                    )}
                    {hindsightData.weakestRound && (
                      <div style={{
                        padding: "10px", borderRadius: "var(--radius-sm)",
                        backgroundColor: "var(--color-error-bg)",
                        border: "1px solid hsla(0, 60%, 42%, 0.15)"
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                          <span style={{ fontSize: "0.95rem" }}>🔻</span>
                          <span style={{ fontSize: "0.7rem", fontWeight: "700", textTransform: "uppercase", color: "var(--color-error)", letterSpacing: "0.04em" }}>Weakest</span>
                        </div>
                        <p style={{ margin: 0, fontSize: "0.8rem", fontWeight: "600", color: "var(--text-primary)" }}>
                          Q{hindsightData.weakestRound.round}: {hindsightData.weakestRound.topic}
                        </p>
                        <p style={{ margin: "4px 0 0 0", fontSize: "0.75rem", color: "var(--text-secondary)", lineHeight: "1.35" }}>
                          {hindsightData.weakestRound.evidence}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* AI Recommendations */}
                  {hindsightData.recommendations && hindsightData.recommendations.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
                      <span style={{ fontSize: "0.7rem", fontWeight: "700", textTransform: "uppercase", color: "hsl(258, 60%, 45%)", letterSpacing: "0.05em" }}>💡 AI Recommendations</span>
                      {hindsightData.recommendations.map((rec, rIdx) => (
                        <div key={rIdx} style={{
                          display: "flex", alignItems: "flex-start", gap: "8px",
                          padding: "8px 12px", borderRadius: "var(--radius-sm)",
                          backgroundColor: "var(--bg-primary)", border: "1px solid var(--border-color)",
                          fontSize: "0.8rem", color: "var(--text-primary)", lineHeight: "1.4"
                        }}>
                          <span style={{ color: "hsl(258, 80%, 56%)", fontWeight: "700", flexShrink: 0 }}>{rIdx + 1}.</span>
                          <span>{rec}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* No significant patterns found */}
                  {!hindsightData.contradictions?.length && !hindsightData.bluffingWarning && hindsightData.sessionNarrative && (
                    <div style={{
                      display: "flex", gap: "10px", alignItems: "flex-start",
                      padding: "10px 12px", borderRadius: "var(--radius-sm)",
                      backgroundColor: "var(--color-success-bg)",
                      border: "1px solid rgba(22, 163, 74, 0.2)",
                      color: "var(--color-success)"
                    }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ width: "18px", height: "18px", marginTop: "1px", flexShrink: 0 }}>
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                        <polyline points="22 4 12 14.01 9 11.01"/>
                      </svg>
                      <span style={{ fontSize: "0.8rem", lineHeight: "1.4" }}>
                        <strong>No cross-question contradictions or bluffing patterns detected.</strong> Your answers were internally consistent across all rounds.
                      </span>
                    </div>
                  )}

                </div>
              )}
            </div>

            <div className={`card lexical-card ${mobileTab === 'metrics' ? '' : 'mobile-hide'}`} style={{ padding: "var(--space-lg)", textAlign: "left" }}>
              <h3 style={{ fontSize: "1.05rem", fontWeight: "700", borderBottom: "1px solid var(--border-color)", paddingBottom: "var(--space-sm)", marginBottom: "var(--space-sm)" }}>
                Lexical Range & Vocabulary Maturity
              </h3>
              <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "var(--space-md)" }}>
                Syntactic analysis of speech variety, word complexity, and terminology usage.
              </p>
              
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)", marginBottom: "var(--space-md)" }}>
                <div style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "50%",
                  backgroundColor: "rgba(99, 102, 241, 0.08)",
                  border: "1.5px solid rgba(99, 102, 241, 0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.4rem",
                  color: "#6366f1",
                  flexShrink: 0
                }}>
                  🎓
                </div>
                <div>
                  <span style={{ fontSize: "0.75rem", textTransform: "uppercase", fontWeight: "700", color: "var(--text-secondary)", letterSpacing: "0.05em" }}>Lexical Standing</span>
                  <h4 style={{ margin: "2px 0 0 0", fontSize: "1.1rem", fontWeight: "800", color: "var(--accent-primary)" }}>{maturityLevel}</h4>
                </div>
              </div>

              <div style={{ height: "6px", backgroundColor: "var(--bg-primary)", borderRadius: "var(--radius-full)", position: "relative", marginBottom: "var(--space-sm)" }}>
                <div style={{
                  height: "100%",
                  width: `${lexicalScore}%`,
                  borderRadius: "var(--radius-full)",
                  backgroundColor: "#6366f1",
                  transition: "width 0.8s ease"
                }}></div>
              </div>
              
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: "500", marginBottom: "var(--space-md)" }}>
                <span>Standard Vocabulary</span>
                <span>Principal Level</span>
              </div>

              <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-secondary)", lineHeight: "1.4" }}>
                {maturityDesc}
              </p>
              
              <div className="lexical-stats-grid">
                <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                  Unique Words: <strong style={{ color: "var(--text-primary)" }}>{uniqueWordsCount}</strong>
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                  Advanced Keywords: <strong style={{ color: "var(--text-primary)" }}>{advancedWordsCount}</strong>
                </div>
              </div>
            </div>

            <div className={`card fallacies-card ${mobileTab === 'metrics' ? '' : 'mobile-hide'}`} style={{ padding: "var(--space-lg)", textAlign: "left" }}>
              <h3 style={{ fontSize: "1.05rem", fontWeight: "700", borderBottom: "1px solid var(--border-color)", paddingBottom: "var(--space-sm)", marginBottom: "var(--space-sm)" }}>
                Argumentation & Fallacy Diagnostics
              </h3>
              <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "var(--space-md)" }}>
                Lexical deflection scanning and reasoning pattern checks.
              </p>

              {detectFallacies().length === 0 ? (
                <div style={{
                  display: "flex",
                  gap: "10px",
                  alignItems: "flex-start",
                  padding: "12px",
                  borderRadius: "var(--radius-sm)",
                  backgroundColor: "var(--color-success-bg)",
                  border: "1px solid rgba(22, 163, 74, 0.2)",
                  color: "var(--color-success)"
                }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ width: "20px", height: "20px", marginTop: "2px", flexShrink: 0 }}>
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                  <div style={{ fontSize: "0.8rem", lineHeight: "1.4" }}>
                    <strong>Zero Fallacies Flagged</strong>
                    <p style={{ margin: "2px 0 0 0", color: "var(--text-secondary)" }}>
                      Outstanding logical consistency. You avoided vague qualifier patterns, repetitive circularity, and unqualified absolutes.
                    </p>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
                  {detectFallacies().map((det, dIdx) => (
                    <div key={dIdx} style={{
                      padding: "10px var(--space-md)",
                      border: "1px solid var(--border-color)",
                      borderRadius: "var(--radius-sm)",
                      backgroundColor: "var(--bg-primary)"
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "0.75rem", fontWeight: "700", color: "var(--color-error)", textTransform: "uppercase" }}>
                          🚨 {det.type} • Round {det.round}
                        </span>
                      </div>
                      <h4 style={{ margin: "4px 0 2px 0", fontSize: "0.85rem", fontWeight: "700", color: "var(--text-primary)" }}>
                        Topic: {det.topic}
                      </h4>
                      <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-muted)", fontStyle: "italic" }}>
                        Indicator: {det.marker}
                      </p>
                      <p style={{ margin: "6px 0 0 0", fontSize: "0.78rem", color: "var(--text-secondary)", lineHeight: "1.4", borderTop: "1px dashed var(--border-color)", paddingTop: "4px" }}>
                        <strong>Coach Advice</strong>: {det.fix}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* RIGHT PANEL: Emotion Timelines, Professor Mode Replay, Recommends */}
          <div className="feedback-right-panel" style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
            
            <div className={`no-print toggle-tabs-card ${mobileTab === 'metrics' ? '' : 'mobile-hide'}`} style={{ display: "flex", gap: "8px", borderBottom: "1px solid var(--border-color)", paddingBottom: "12px", marginBottom: "4px" }}>
              <button 
                className={`btn ${activeRightTab === "timeline" ? "btn-primary" : "btn-secondary"}`} 
                onClick={() => setActiveRightTab("timeline")}
                style={{ padding: "8px 16px", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "6px", flex: 1, border: "1px solid var(--border-color)" }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: "15px", height: "15px" }}>
                  <path d="M3 3v18h18M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" />
                </svg>
                Emotion Timeline
              </button>
              <button 
                className={`btn ${activeRightTab === "fluency" ? "btn-primary" : "btn-secondary"}`} 
                onClick={() => setActiveRightTab("fluency")}
                style={{ padding: "8px 16px", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "6px", flex: 1, border: "1px solid var(--border-color)" }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: "15px", height: "15px" }}>
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 6v6l4 2"/>
                </svg>
                Speech & Fluency
              </button>
            </div>

            <div className={`card timeline-card ${mobileTab === 'metrics' ? '' : 'mobile-hide'} ${activeRightTab !== "timeline" ? "screen-hidden" : ""}`} style={{ padding: "var(--space-lg)", textAlign: "left" }}>
              <h3 style={{ fontSize: "1.05rem", fontWeight: "700", borderBottom: "1px solid var(--border-color)", paddingBottom: "var(--space-xs)", marginBottom: "0" }}>
                Emotion Timeline
              </h3>
              <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "var(--space-md)" }}>
                Tracking real-time structural levels of Confidence, Nervousness, and Hesitation across the exam duration.
              </p>
              
              {renderGraphTimeline()}

              {/* Legends */}
              <div style={{ display: "flex", justifyContent: "center", gap: "var(--space-md)", margin: "var(--space-sm) 0", fontSize: "0.75rem", fontWeight: "600" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <span style={{ width: "12px", height: "3px", backgroundColor: "hsl(215, 35%, 26%)" }}></span>
                  <span>Confidence</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <span style={{ width: "12px", height: "3px", borderTop: "2px dashed hsl(38, 85%, 45%)" }}></span>
                  <span>Nervousness</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <span style={{ width: "12px", height: "3px", borderTop: "2px dotted hsl(0, 60%, 42%)" }}></span>
                  <span>Hesitation</span>
                </div>
              </div>

              {/* Selected point commentator card */}
              <div style={{
                marginTop: "var(--space-sm)",
                padding: "12px var(--space-md)",
                borderLeft: "4px solid var(--accent-primary)",
                backgroundColor: "var(--bg-primary)",
                borderRadius: "var(--radius-sm)",
                transition: "var(--transition-smooth)"
              }}>
                <strong style={{ fontSize: "0.8rem", textTransform: "uppercase", color: "var(--accent-primary)" }}>Milestone commentary</strong>
                <p style={{ margin: "2px 0 0 0", fontSize: "0.825rem", color: "var(--text-primary)", lineHeight: "1.45" }}>
                  {getTimelineCommentary(activeTimelineIndex)}
                </p>
              </div>
            </div>

            <div className={`fluency-card-wrapper ${mobileTab === 'metrics' ? '' : 'mobile-hide'} ${activeRightTab !== "fluency" ? "screen-hidden" : ""}`}>
              {renderFluencyDiagnostics()}
            </div>

            <div className={`card replay-card ${mobileTab === 'qa' ? '' : 'mobile-hide'}`} style={{ padding: "var(--space-lg)", textAlign: "left" }}>
              <h3 style={{ fontSize: "1.05rem", fontWeight: "700", borderBottom: "1px solid var(--border-color)", paddingBottom: "var(--space-sm)", marginBottom: "var(--space-md)" }}>
                {isProfessional ? "Interviewer Feedback Replay" : "Professor Mode Replay"}
              </h3>
              
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
                {askedQuestions.length === 0 ? (
                  <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", textAlign: "center", padding: "16px 0", margin: 0 }}>
                    {isProfessional ? "No recorded rounds. Answer at least one question to replay the interviewer's evaluation." : "No recorded rounds. Answer at least one question to replay the examiner's evaluation."}
                  </p>
                ) : (
                  askedQuestions.map((qText, idx) => {
                  const isExpanded = expandedReplayIndex === idx;
                  const emotion = detectedEmotions[idx] || { correctness: 80, confidence: 80 };
                  const answer = answerTranscripts[idx] || "";
                  const qObj = askedQuestionsObjects && askedQuestionsObjects[idx] ? askedQuestionsObjects[idx] : null;
                  const topicText = qObj ? qObj.topic : (isProfessional ? "Competency Skill" : "Syllabus Concept");
                  
                  return (
                    <div key={idx} style={{ border: "1px solid var(--border-color)", borderRadius: "var(--radius-sm)", overflow: "hidden", transition: "var(--transition-smooth)" }}>
                      
                      {/* Accordion trigger row */}
                      <div 
                        onClick={() => setExpandedReplayIndex(isExpanded ? null : idx)}
                        style={{
                          padding: "12px var(--space-md)",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          backgroundColor: isExpanded ? "var(--bg-primary)" : "var(--bg-card)",
                          cursor: "pointer",
                          transition: "var(--transition-smooth)"
                        }}
                      >
                        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontSize: "0.8rem", fontWeight: "700", color: "var(--accent-primary)" }}>Q{idx + 1}</span>
                          <span style={{ fontSize: "0.8rem", color: "var(--text-primary)" }}>Topic: <strong>{topicText}</strong></span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
                          <span style={{
                            fontSize: "0.7rem",
                            padding: "2px 8px",
                            borderRadius: "var(--radius-full)",
                            fontWeight: "600",
                            backgroundColor: emotion.correctness >= 75 ? "var(--color-success-bg)" : "var(--color-error-bg)",
                            color: emotion.correctness >= 75 ? "var(--color-success)" : "var(--color-error)"
                          }}>
                            {emotion.tag || "Correct"}
                          </span>
                          <svg 
                            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" 
                            style={{ transform: isExpanded ? "rotate(180deg)" : "none", transition: "var(--transition-smooth)" }}
                          >
                            <polyline points="6 9 12 15 18 9"/>
                          </svg>
                        </div>
                      </div>

                      {/* Accordion expanded content */}
                      {isExpanded && (
                        <div style={{ padding: "var(--space-md)", borderTop: "1px solid var(--border-color)", backgroundColor: "var(--bg-card)", textAlign: "left" }}>
                          
                          {/* Question row with Replay speaker */}
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-sm)", marginBottom: "var(--space-sm)" }}>
                            <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontStyle: "italic" }}>
                              <strong>{isProfessional ? "Interviewer prompt:" : "Examiner prompt:"}</strong> &quot;{qObj ? qObj.text : qText}&quot;
                            </div>
                            <button 
                              className="btn btn-secondary"
                              onClick={() => handleReplayVoice(qObj ? qObj.speech : qText, idx)}
                              style={{ padding: "4px 8px", fontSize: "0.7rem", flexShrink: 0, cursor: "pointer" }}
                            >
                              {playingReplayIndex === idx ? "Stop Voice" : "Replay Voice"}
                            </button>
                          </div>

                          {/* Student answer transcript */}
                          <div style={{ fontSize: "0.85rem", color: "var(--text-primary)", backgroundColor: "var(--bg-primary)", padding: "10px", borderRadius: "var(--radius-xs)", border: "1px solid var(--border-color)", marginBottom: "var(--space-sm)" }}>
                            <strong>Your Transcript:</strong> &quot;{answer}&quot;
                          </div>

                          {/* Local Audio Recording Replay */}
                          {resultsData.recordedAudios && resultsData.recordedAudios[idx] && (
                            <div className="audio-replay-container" style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "var(--space-sm)",
                              backgroundColor: "var(--bg-primary)",
                              padding: "8px 12px",
                              borderRadius: "var(--radius-xs)",
                              border: "1px solid var(--border-color)",
                              marginBottom: "var(--space-sm)"
                            }}>
                              <span style={{ fontSize: "0.75rem", fontWeight: "600", color: "var(--text-secondary)", flexShrink: 0 }}>
                                Listen back:
                              </span>
                              <audio 
                                src={resultsData.recordedAudios[idx]} 
                                controls 
                                style={{
                                  height: "32px",
                                  flex: 1
                                }}
                              />
                            </div>
                          )}

                          {/* Expected Correct Answer */}
                          <div style={{
                            fontSize: "0.825rem",
                            color: "hsl(145, 60%, 15%)",
                            backgroundColor: "hsla(145, 60%, 45%, 0.07)",
                            padding: "10px 12px",
                            borderRadius: "var(--radius-xs)",
                            border: "1px solid hsla(145, 60%, 45%, 0.15)",
                            marginBottom: "var(--space-sm)",
                            lineHeight: "1.45"
                          }}>
                            <strong style={{ display: "block", color: "hsl(145, 60%, 20%)", marginBottom: "4px", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>{isProfessional ? "Optimal Professional Response:" : "Expected Correct Answer:"}</strong>
                            {emotion.correctAnswer || qObj?.correctAnswer || getExpectedCorrectAnswer(topicText, qObj ? qObj.text : qText, qObj)}
                          </div>

                          {/* Performance tags, WPM pacing */}
                          <div style={{ display: "flex", gap: "var(--space-sm)", flexWrap: "wrap", fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "var(--space-sm)" }}>
                            <span>Lexical correctness: <strong>{emotion.correctness}%</strong></span>
                            <span>•</span>
                            <span>Tempo: <strong>{Math.round(answer.split(/\s+/).length / 0.5)} WPM</strong></span>
                          </div>

                          {/* Confidence coaching tip */}
                          <div style={{
                            padding: "8px 12px",
                            backgroundColor: "var(--accent-light)",
                            color: "var(--accent-primary)",
                            fontSize: "0.775rem",
                            fontWeight: "600",
                            borderRadius: "var(--radius-xs)",
                            border: "1px solid rgba(31, 42, 56, 0.15)"
                          }}>
                            {getConfidenceCoachingTip(emotion, answer, idx)}
                          </div>

                        </div>
                      )}

                    </div>
                  );
                }))}
              </div>
            </div>

          </div>

        </div>

      </div>
    </section>
  );
}
