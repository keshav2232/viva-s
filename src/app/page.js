"use client";

import React, { useState, useEffect } from "react";
import Header from "@/components/Header";
// import AuthScreen from "@/components/AuthScreen";
import Dashboard from "@/components/Dashboard";
import SetupFlow from "@/components/SetupFlow";
import ActiveViva from "@/components/ActiveViva";
import Results from "@/components/Results";

import { INITIAL_STATS, DEFAULT_SESSIONS } from "@/utils/mockData";

export default function Home() {
  const [activeScreen, setActiveScreen] = useState("dashboard"); // "auth-screen" | "dashboard" | "setup" | "active-viva" | "results"
  const [userName, setUserName] = useState("Keshav");
  
  // App aggregates
  const [stats, setStats] = useState(INITIAL_STATS);
  const [sessions, setSessions] = useState(DEFAULT_SESSIONS);
  
  // Viva run states
  const [vivaConfig, setVivaConfig] = useState(null);
  const [resultsData, setResultsData] = useState(null);
  const [pausedSession, setPausedSession] = useState(null);

  // Sync session profiles in local storage if browser environment
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const cachedSessions = localStorage.getItem("vivasim_sessions");
        const cachedStats = localStorage.getItem("vivasim_stats");
        const cachedUser = localStorage.getItem("vivasim_user");
        
        if (cachedSessions) {
          try {
            setSessions(JSON.parse(cachedSessions));
          } catch (e) {
            console.warn("Invalid cached sessions found, resetting:", e);
            localStorage.removeItem("vivasim_sessions");
          }
        }
        if (cachedStats) {
          try {
            setStats(JSON.parse(cachedStats));
          } catch (e) {
            console.warn("Invalid cached stats found, resetting:", e);
            localStorage.removeItem("vivasim_stats");
          }
        }
        if (cachedUser) {
          setUserName(cachedUser);
          setActiveScreen("dashboard");
        }

        const paused = localStorage.getItem("vivasim_paused_session");
        if (paused) {
          try {
            setPausedSession(JSON.parse(paused));
          } catch (e) {
            console.warn("Invalid paused session found, removing:", e);
            localStorage.removeItem("vivasim_paused_session");
          }
        }
      } catch (err) {
        console.error("Local storage synchronization failed:", err);
      }
    }
  }, []);

  const saveToStorage = (newSessions, newStats) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("vivasim_sessions", JSON.stringify(newSessions));
      localStorage.setItem("vivasim_stats", JSON.stringify(newStats));
    }
  };

  const handleLoginSuccess = (name) => {
    setUserName(name);
    if (typeof window !== "undefined") {
      localStorage.setItem("vivasim_user", name);
    }
    setActiveScreen("dashboard");
  };

  const handleLogout = () => {
    setUserName("Keshav");
    if (typeof window !== "undefined") {
      localStorage.removeItem("vivasim_user");
    }
    setActiveScreen("dashboard");
  };

  const handleBeginViva = (config) => {
    setVivaConfig(config);
    setActiveScreen("active-viva");
  };

  const handleClearPausedSession = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("vivasim_paused_session");
    }
    setPausedSession(null);
  };

  const handleResumePausedSession = () => {
    if (typeof window !== "undefined") {
      const paused = localStorage.getItem("vivasim_paused_session");
      if (paused) {
        try {
          const parsed = JSON.parse(paused);
          setVivaConfig({
            ...parsed.config,
            isResume: true,
            resumeState: parsed
          });
          setActiveScreen("active-viva");
          localStorage.removeItem("vivasim_paused_session");
          setPausedSession(null);
        } catch (e) {
          console.error("Failed to resume paused session:", e);
        }
      }
    }
  };

  const handleViewReport = (session) => {
    if (session.reportData) {
      setResultsData(session.reportData);
    } else {
      // Create rich mock evaluation data for historical compatibility with mockData
      const mockScore = session.score || 85;
      const mockData = {
        subjectName: session.subject || "Thermodynamics",
        endedEarly: false,
        isLastMinute: session.duration <= 5,
        isMockExternal: session.personality === "Viva Terror" || session.personality === "Brutal External",
        examinerPersonality: session.personality === "Friendly Professor" ? "friendly" : (session.personality === "Strict Professor" ? "strict" : (session.personality === "Brutal External" ? "brutal" : "terror")),
        askedQuestions: [
          "Explain the foundational equations in your subject.",
          "Describe secondary limitations or variables affecting efficiency.",
          "Explain thermodynamic/computational trade-offs in detailed application contexts.",
          "Under cyclic/extreme loading, state exact fatigue or failure conditions."
        ],
        askedQuestionsObjects: [
          { text: "Explain the foundational equations in your subject.", speech: "Let us begin with the basics. Explain the foundational equations in your subject.", topic: "Fundamentals", difficulty: "Low" },
          { text: "Describe secondary limitations or variables affecting efficiency.", speech: "Understood. Now describe secondary limitations or variables affecting efficiency.", topic: "Secondary Limits", difficulty: "Medium" },
          { text: "Explain thermodynamic/computational trade-offs in detailed application contexts.", speech: "Interesting. Explain thermodynamic or computational trade-offs in detailed application contexts.", topic: "Trade-offs", difficulty: "High" },
          { text: "Under cyclic/extreme loading, state exact fatigue or failure conditions.", speech: "Let's push to the limit. Under cyclic or extreme loading, state exact fatigue or failure conditions.", topic: "Extreme Loading", difficulty: "High" }
        ],
        answerTranscripts: [
          "We define the core relations and boundary parameters representing standard operational volumes.",
          "Yes, we can apply equations to calculate secondary variations and entropy increases under open systems.",
          "We balance space, time complexity, or Alternating fatigue limits against efficiency targets.",
          "We monitor stress flow fillet curve radius concentrations preventing failure."
        ],
        detectedEmotions: [
          { confidence: mockScore + 2, clarity: mockScore - 1, nervousness: 25, hesitation: 15, correctness: mockScore + 3, accuracy: mockScore + 1, completeness: mockScore, tag: "Strong" },
          { confidence: mockScore - 4, clarity: mockScore - 2, nervousness: 35, hesitation: 25, correctness: mockScore - 2, accuracy: mockScore - 5, completeness: mockScore - 3, tag: "Partially Correct" },
          { confidence: mockScore - 1, clarity: mockScore, nervousness: 20, hesitation: 12, correctness: mockScore + 1, accuracy: mockScore + 2, completeness: mockScore, tag: "Strong" },
          { confidence: mockScore - 2, clarity: mockScore + 1, nervousness: 30, hesitation: 18, correctness: mockScore - 1, accuracy: mockScore, completeness: mockScore - 2, tag: "Strong" }
        ],
        confidenceEvolution: [mockScore + 2, mockScore - 4, mockScore - 1, mockScore - 2],
        weakConcepts: session.subject === "Data Structures" ? ["AVL balance factors", "separate chaining"] : ["Entropy Clausius boundaries", "Sommerfeld clearances"]
      };
      setResultsData(mockData);
    }
    setActiveScreen("results");
  };

  const handleFinishViva = (summary) => {
    if (!summary) {
      if (typeof window !== "undefined") {
        const paused = localStorage.getItem("vivasim_paused_session");
        if (paused) {
          try {
            setPausedSession(JSON.parse(paused));
          } catch (e) {
            setPausedSession(null);
          }
        } else {
          setPausedSession(null);
        }
      }
      setActiveScreen("dashboard");
      return;
    }

    const finalScore = calculateFinalScore(summary);
    
    // 1. Compile new session card
    const sessionDateStr = new Date().toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    });

    const newSession = {
      id: `session_${Date.now()}`,
      subject: summary.subjectName,
      duration: vivaConfig.duration,
      personality: getPersonalityName(vivaConfig.personality),
      score: finalScore,
      date: sessionDateStr,
      gradeClass: finalScore >= 80 ? "high" : (finalScore >= 65 ? "med" : "low"),
      reportData: summary // Save the full report card!
    };

    const updatedSessions = [newSession, ...sessions];
    setSessions(updatedSessions);

    // 2. Adjust stats
    const totalAttempted = stats.totalVivas + 1;
    
    // Average confidence overall
    let lastConfidence = 84;
    if (summary.sessionConfidenceScores.length > 0) {
      const sum = summary.sessionConfidenceScores.reduce((a, b) => a + b, 0);
      lastConfidence = Math.round(sum / summary.sessionConfidenceScores.length);
    }

    const allConf = stats.avgConfidence * stats.totalVivas + lastConfidence;
    const avgConf = Math.round(allConf / totalAttempted);
    
    let strongest = stats.strongestSubject;
    let weakest = stats.weakestSubject;

    if (finalScore > 86) strongest = summary.subjectName;
    if (finalScore < 72) weakest = summary.subjectName;

    const updatedStats = {
      totalVivas: totalAttempted,
      avgConfidence: avgConf,
      strongestSubject: strongest,
      weakestSubject: weakest
    };
    
    setStats(updatedStats);

    // Save
    saveToStorage(updatedSessions, updatedStats);

    // Set results data for review
    setResultsData(summary);
    setActiveScreen("results");
  };

  const calculateFinalScore = (summary) => {
    let confidenceAvg = 84;
    let clarityAvg = 82;
    let hesitationAvg = 15;
    let nervousnessAvg = 20;

    if (summary.detectedEmotions.length > 0) {
      let confSum = 0, clarSum = 0, hesSum = 0, nervSum = 0;
      summary.detectedEmotions.forEach(emo => {
        confSum += emo.confidence;
        clarSum += emo.clarity;
        hesSum += emo.hesitation;
        nervSum += emo.nervousness;
      });
      confidenceAvg = Math.round(confSum / summary.detectedEmotions.length);
      clarityAvg = Math.round(clarSum / summary.detectedEmotions.length);
      hesitationAvg = Math.round(hesSum / summary.detectedEmotions.length);
      nervousnessAvg = Math.round(nervSum / summary.detectedEmotions.length);
    }

    let score = Math.round((confidenceAvg * 0.4) + (clarityAvg * 0.6) - (hesitationAvg * 0.1) - (nervousnessAvg * 0.1) + 12);
    score = Math.min(Math.max(score, 40), 99);

    if (summary.endedEarly) {
      score = Math.round(score * 0.6);
    }
    return score;
  };

  const getPersonalityName = (pType) => {
    switch(pType) {
      case "friendly": return "Friendly Professor";
      case "strict": return "Strict Professor";
      case "brutal": return "Brutal External";
      case "terror": return "Viva Terror";
      default: return "AI Examiner";
    }
  };

  // Navigations
  const showHeader = activeScreen !== "active-viva";

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      {/* Dynamic Header */}
      {showHeader && (
        <Header 
          userName={userName} 
          onNavigate={(scr) => setActiveScreen(scr)} 
          onLogout={handleLogout} 
        />
      )}

      {/* Main workspace */}
      <main>
        <div className="content-container">
          {/* {activeScreen === "auth-screen" && (
            <AuthScreen onLoginSuccess={handleLoginSuccess} />
          )} */}
          
          {activeScreen === "dashboard" && (
            <Dashboard 
              userName={userName} 
              stats={stats} 
              sessions={sessions} 
              onStartNewViva={() => setActiveScreen("setup")} 
              pausedSession={pausedSession}
              onClearPausedSession={handleClearPausedSession}
              onResumePausedSession={handleResumePausedSession}
              onViewReport={handleViewReport}
            />
          )}

          {activeScreen === "setup" && (
            <SetupFlow 
              onCancel={() => setActiveScreen("dashboard")} 
              onBeginViva={handleBeginViva} 
            />
          )}

          {activeScreen === "active-viva" && (
            <ActiveViva 
              config={vivaConfig} 
              activeUser={userName} 
              onFinishViva={handleFinishViva} 
            />
          )}

          {activeScreen === "results" && resultsData && (
            <Results 
              resultsData={resultsData} 
              onRestart={() => setActiveScreen("setup")} 
              onGoDashboard={() => setActiveScreen("dashboard")} 
            />
          )}
        </div>
      </main>

      {/* Static Footer */}
      <footer style={{ borderTop: "1px solid var(--border-color)", padding: "var(--space-lg) 0", fontSize: "0.8rem", color: "var(--text-muted)", textAlign: "center", backgroundColor: "var(--bg-card)" }}>
        <p>© 2026 VivaSim. Engineered as a high-fidelity academic prep tool.</p>
      </footer>
    </div>
  );
}
