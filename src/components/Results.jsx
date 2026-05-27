"use client";

import React, { useState, useEffect } from "react";
import { VoiceManager } from "@/services/voiceManager";

export default function Results({ resultsData, onRestart, onGoDashboard }) {
  const [activeTimelineIndex, setActiveTimelineIndex] = useState(0);
  const [expandedReplayIndex, setExpandedReplayIndex] = useState(null);
  const [playingReplayIndex, setPlayingReplayIndex] = useState(null);
  const [pastSessionsAvg, setPastSessionsAvg] = useState(null);
  const [scoreOffset, setScoreOffset] = useState(314.16);

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
    examinerPersonality
  } = resultsData;

  // Cleanup active audio playbacks on unmount
  useEffect(() => {
    return () => {
      VoiceManager.stop();
    };
  }, []);

  // 1. Calculate Scorecard Averages
  const totalRounds = detectedEmotions.length || 4;
  
  let subjectUnderstanding = 80;
  let vocalConfidence = 84;
  let clarityOfComm = 82;
  let conceptualDepth = 75;
  let handlingPressure = 85;
  let consistency = 80;

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
  
  let overallScore = Math.round(
    (subjectUnderstanding * 0.35) + 
    (vocalConfidence * 0.2) + 
    (clarityOfComm * 0.15) + 
    (conceptualDepth * 0.2) + 
    (handlingPressure * 0.1)
  );
  overallScore = Math.min(Math.max(overallScore, 40), 99);
  if (endedEarly) {
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
            setPastSessionsAvg(Math.round(sum / past.length));
          }
        }
      } catch (e) {
        console.warn("Failed loading historic sessions averages:", e);
      }
    }
  }, [subjectName]);

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
  let gradeLabel = "Upper Second Class Honor";
  let evaluationVerdict = "Competent general understanding. Handled core subjects confidently with minor pauses when pressed on deep mechanisms.";

  if (overallScore >= 80) {
    gradeLabel = "First Class Honor (Distinction)";
    evaluationVerdict = `Outstanding presentation. You answered with strong cognitive clarity (${clarityOfComm}%), solid semantic phrasing, and successfully countered deep cross-examinations.`;
  } else if (overallScore < 65) {
    gradeLabel = "Requires Conceptual Review";
    evaluationVerdict = "Your answers lacked structured academic terminology. High uncertainty or hesitation markers significantly degraded speaking clarity scores.";
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

  // 7. Most Likely Real Viva Questions Generator
  const getMostLikelyVivaQuestions = () => {
    if (subjectName === "Thermodynamics") {
      return [
        "Prove why the entropy of an isolated thermal system must always increase using the Clausius boundary relation.",
        "Derive the phase-boundary sublimation slope equation using Clapeyron parameters.",
        "Formulate how open-system exergy analysis differs from closed volume exergy constraints under transient parameters."
      ];
    } else if (subjectName === "Data Structures") {
      return [
        "Demonstrate the exact rotation adjustments required for a double Right-Left (RL) self-balancing AVL step.",
        "Compare search and load factor efficiency in Linear Probing Hash collisions versus Separate Chaining under high loads.",
        "Formulate a queue-based Breadth-First Search space limit, and state why DFS utilizes recursive stack memory."
      ];
    } else {
      return [
        "State Goodman and Soderberg alternating fatigue stress formulas, and explain why their safety factors differ.",
        "Calculate oil clearance variables within the Sommerfeld lubrication formula under high journal shaft eccentricity.",
        "Derive the tooth-bending stress boundaries using standard Lewis stress AGMA parameters."
      ];
    }
  };

  // 8. Custom Print Dialog PDF triggers
  const handlePrintReport = () => {
    window.print();
  };

  // Graph math
  const renderGraphTimeline = () => {
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
            <h1 style={{ marginTop: "6px", marginBottom: "0", fontSize: "1.75rem", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Oral Examination Transcript</h1>
            <p style={{ margin: "2px 0 0 0" }}>High-fidelity post-viva cognitive and delivery metrics.</p>
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

        <div className="results-grid" style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: "var(--space-lg)", marginTop: "var(--space-md)" }}>
          
          {/* LEFT PANEL: Academic Scorecard, Emotion Sliders, Bluffing */}
          <div className="performance-left-panel" style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
            
            {/* Scorecard breakdown */}
            <div className="card" style={{ padding: "var(--space-lg)", position: "relative" }}>
              <h3 style={{ fontSize: "1.05rem", fontWeight: "700", borderBottom: "1px solid var(--border-color)", paddingBottom: "var(--space-sm)", marginBottom: "var(--space-md)", textAlign: "left" }}>
                Scorecard Breakdown
              </h3>
              
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-lg)" }}>
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
                        transformOrigin: "50% 50%",
                        transition: "stroke-dashoffset 0.8s ease"
                      }}
                    />
                  </svg>
                  <div className="radial-score-value" style={{ fontSize: "1.6rem", fontWeight: "800", color: "var(--accent-primary)" }}>{overallScore}%</div>
                </div>

                <div style={{ textAlign: "left", flex: 1 }}>
                  <span style={{ fontSize: "0.8rem", textTransform: "uppercase", fontWeight: "600", color: "var(--text-secondary)", letterSpacing: "0.05em" }}>Overall Standing</span>
                  <h4 style={{ margin: "2px 0", fontSize: "1.15rem", fontWeight: "700", color: "var(--accent-primary)" }}>{gradeLabel}</h4>
                  <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-secondary)", lineHeight: "1.4" }}>{evaluationVerdict}</p>
                </div>
              </div>

              {/* Six detailed score fields */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-sm)", marginTop: "var(--space-lg)", borderTop: "1px solid var(--border-color)", paddingTop: "var(--space-md)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: "var(--radius-sm)", backgroundColor: "var(--bg-primary)" }}>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Subject Understanding</span>
                  <strong style={{ fontSize: "0.9rem", color: "var(--accent-primary)" }}>{subjectUnderstanding}%</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: "var(--radius-sm)", backgroundColor: "var(--bg-primary)" }}>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Speaking Confidence</span>
                  <strong style={{ fontSize: "0.9rem", color: "var(--accent-primary)" }}>{vocalConfidence}%</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: "var(--radius-sm)", backgroundColor: "var(--bg-primary)" }}>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Speaking Clarity</span>
                  <strong style={{ fontSize: "0.9rem", color: "var(--accent-primary)" }}>{clarityOfComm}%</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: "var(--radius-sm)", backgroundColor: "var(--bg-primary)" }}>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Conceptual Depth</span>
                  <strong style={{ fontSize: "0.9rem", color: "var(--accent-primary)" }}>{conceptualDepth}%</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: "var(--radius-sm)", backgroundColor: "var(--bg-primary)" }}>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Handling Pressure</span>
                  <strong style={{ fontSize: "0.9rem", color: "var(--accent-primary)" }}>{handlingPressure}%</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: "var(--radius-sm)", backgroundColor: "var(--bg-primary)" }}>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Consistency</span>
                  <strong style={{ fontSize: "0.9rem", color: "var(--accent-primary)" }}>{consistency}%</strong>
                </div>
              </div>
            </div>

            {/* Bluff Probability index */}
            <div className="card" style={{ padding: "var(--space-md) var(--space-lg)" }}>
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

            {/* Historical Growth Tracker */}
            <div className="card" style={{ padding: "var(--space-md) var(--space-lg)", textAlign: "left" }}>
              <h3 style={{ fontSize: "0.95rem", fontWeight: "700", borderBottom: "1px solid var(--border-color)", paddingBottom: "var(--space-sm)", marginBottom: "var(--space-sm)" }}>
                Historical Progress Comparison
              </h3>
              {pastSessionsAvg !== null ? (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "6px 0" }}>
                    <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Previous Subject Average</span>
                    <strong style={{ fontSize: "0.85rem", color: "var(--text-primary)" }}>{pastSessionsAvg}%</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "6px 0" }}>
                    <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Current Viva Score</span>
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
                  <span style={{ fontSize: "0.8rem" }}>First viva registered for this subject. Subsequent exams will unlock delta progress metrics.</span>
                </div>
              )}
            </div>

            {/* Smart Revision planner */}
            <div className="card suggested-revision-card" style={{ padding: "var(--space-lg)" }}>
              <h3 style={{ fontSize: "1.05rem", fontWeight: "700", borderBottom: "1px solid var(--border-color)", paddingBottom: "var(--space-sm)", marginBottom: "var(--space-sm)", textAlign: "left" }}>
                Smart Revision Plan
              </h3>
              <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "var(--space-md)", textAlign: "left" }}>
                Prioritized revision queue compiled from detected conceptual gaps.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
                {getSuggestedRevisionPills().map((rev, idx) => (
                  <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px var(--space-md)", border: "1px solid var(--border-color)", borderRadius: "var(--radius-sm)", backgroundColor: "var(--bg-primary)" }}>
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

          </div>

          {/* RIGHT PANEL: Emotion Timelines, Professor Mode Replay, Recommends */}
          <div className="feedback-right-panel" style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
            
            {/* TIMELINE PROGRESSION CHART */}
            <div className="card timeline-card" style={{ padding: "var(--space-lg)", textAlign: "left" }}>
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

            {/* PROFESSOR MODE REPLAY */}
            <div className="card" style={{ padding: "var(--space-lg)", textAlign: "left" }}>
              <h3 style={{ fontSize: "1.05rem", fontWeight: "700", borderBottom: "1px solid var(--border-color)", paddingBottom: "var(--space-sm)", marginBottom: "var(--space-md)" }}>
                Professor Mode Replay
              </h3>
              
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
                {askedQuestions.map((qText, idx) => {
                  const isExpanded = expandedReplayIndex === idx;
                  const emotion = detectedEmotions[idx] || { correctness: 80, confidence: 80 };
                  const answer = answerTranscripts[idx] || "";
                  const qObj = askedQuestionsObjects && askedQuestionsObjects[idx] ? askedQuestionsObjects[idx] : null;
                  const topicText = qObj ? qObj.topic : "Syllabus Concept";
                  
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
                              <strong>Examiner prompt:</strong> "{qObj ? qObj.text : qText}"
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
                            <strong>Your Transcript:</strong> "{answer}"
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
                })}
              </div>
            </div>

            {/* MOST LIKELY REAL VIVA QUESTIONS */}
            <div className="card" style={{ padding: "var(--space-lg)", textAlign: "left" }}>
              <h3 style={{ fontSize: "1.05rem", fontWeight: "700", borderBottom: "1px solid var(--border-color)", paddingBottom: "var(--space-sm)", marginBottom: "var(--space-sm)" }}>
                Most Likely External Board Questions
              </h3>
              <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "var(--space-md)" }}>
                Highly strategic questions recommended to prepare you for physical university exams in weak zones.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
                {getMostLikelyVivaQuestions().map((q, idx) => (
                  <div key={idx} style={{ padding: "10px", border: "1px solid var(--border-color)", borderRadius: "var(--radius-sm)", fontSize: "0.8rem", color: "var(--text-primary)", backgroundColor: "var(--bg-primary)" }}>
                    <strong>{idx + 1}.</strong> {q}
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>

      </div>
    </section>
  );
}
