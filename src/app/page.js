"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import React, { useState, useEffect, useCallback } from "react";
import Header from "@/components/Header";
import AuthScreen from "@/components/AuthScreen";
import Dashboard from "@/components/Dashboard";
import SetupFlow from "@/components/SetupFlow";
import ActiveViva from "@/components/ActiveViva";
import Results from "@/components/Results";

import { useAuth } from "@/context/AuthContext";
import { INITIAL_STATS, DEFAULT_SESSIONS, EMPTY_STATS } from "@/utils/mockData";
import { SyllabusMasteryService } from "@/services/SyllabusMasteryService";

// Helper function declared outside of component to ensure render purity
function generateSessionId() {
  return `session_${Date.now()}`;
}

export default function Home() {
  const { 
    user, 
    loading: authLoading, 
    stats: cloudStats, 
    sessions: cloudSessions, 
    logout, 
    syncGuestData, 
    addSessionToCloud 
  } = useAuth();

  // App routing states
  const [activeScreen, setActiveScreen] = useState("dashboard"); // "auth-screen" | "dashboard" | "setup" | "active-viva" | "results"
  const [isGuest, setIsGuest] = useState(false);
  const [syncingGuest, setSyncingGuest] = useState(false);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState("");
  const [currentMode, setCurrentMode] = useState("academic");

  // Guest Offline Backup State (mirrors original logic)
  const [guestUserName, setGuestUserName] = useState("Guest Scholar");
  const [sessions, setSessions] = useState([]);
  const [stats, setStats] = useState(EMPTY_STATS);

  // Viva run states
  const [vivaConfig, setVivaConfig] = useState(null);
  const [resultsData, setResultsData] = useState(null);
  const [pausedSession, setPausedSession] = useState(null);
  
  // Local storage migration alert checker
  const [hasLocalGuestData, setHasLocalGuestData] = useState(false);

  // Hydration sync for storage-dependent states on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const activeSession = sessionStorage.getItem("vivasim_active_session") === "true";
      setIsGuest(activeSession);

      const storedUser = localStorage.getItem("vivasim_user");
      if (storedUser) {
        setGuestUserName(storedUser);
      }

      const cachedSessions = localStorage.getItem("vivasim_sessions");
      if (cachedSessions) {
        try {
          setSessions(JSON.parse(cachedSessions));
        } catch (e) {
          console.warn("Invalid cached sessions found, resetting:", e);
          localStorage.removeItem("vivasim_sessions");
        }
      }

      const cachedStats = localStorage.getItem("vivasim_stats");
      if (cachedStats) {
        try {
          setStats(JSON.parse(cachedStats));
        } catch (e) {
          console.warn("Invalid cached stats found, resetting:", e);
          localStorage.removeItem("vivasim_stats");
        }
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

      setHasLocalGuestData(!!localStorage.getItem("vivasim_sessions"));
    }
  }, []);

  const saveToStorage = (newSessions, newStats) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("vivasim_sessions", JSON.stringify(newSessions));
      localStorage.setItem("vivasim_stats", JSON.stringify(newStats));
    }
  };

  // Dynamic state resolvers depending on auth mode
  const activeSessions = user ? cloudSessions : sessions;
  const activeStats = user ? cloudStats : stats;
  const activeUserName = user ? (user.displayName || user.email) : (isGuest ? guestUserName : "Guest Scholar");

  const handleLoginSuccess = (guestName) => {
    if (guestName) {
      // Continuing as Offline Guest
      setIsGuest(true);
      setGuestUserName(guestName);
      if (typeof window !== "undefined") {
        localStorage.setItem("vivasim_user", guestName);
        sessionStorage.setItem("vivasim_active_session", "true");
      }
      setActiveScreen("dashboard");
    } else {
      // Fully logged into Firebase Cloud Auth
      setIsGuest(false);
      setActiveScreen("dashboard");
    }
  };

  const handleLogout = async () => {
    setIsGuest(false);
    setSessions([]);
    setStats(EMPTY_STATS);
    if (typeof window !== "undefined") {
      localStorage.removeItem("vivasim_user");
      localStorage.removeItem("vivasim_sessions");
      localStorage.removeItem("vivasim_stats");
      localStorage.removeItem("vivasim_mastery");
      localStorage.removeItem("vivasim_paused_session");
      sessionStorage.removeItem("vivasim_active_session");
    }
    if (user) {
      await logout();
    }
    setActiveScreen("dashboard");
  };

  const handleMigrateGuestHistory = useCallback(async () => {
    if (!user) return;
    setSyncingGuest(true);
    try {
      await syncGuestData();
      setSessions([]);
      setStats(EMPTY_STATS);
      setSyncSuccessMsg("Success! Offline guest viva sessions successfully migrated to your cloud database.");
      setTimeout(() => setSyncSuccessMsg(""), 6000);
    } catch (err) {
      console.error("Guest migration failed:", err);
    } finally {
      setSyncingGuest(false);
    }
  }, [user, syncGuestData]);

  // Auto-migrate guest data when user is logged in
  useEffect(() => {
    if (user && !syncingGuest && typeof window !== "undefined") {
      const hasGuestData = localStorage.getItem("vivasim_sessions");
      if (hasGuestData) {
        console.log("Auto-migrating guest data to cloud...");
        const timer = setTimeout(() => {
          handleMigrateGuestHistory();
        }, 0);
        return () => clearTimeout(timer);
      }
    }
  }, [user, syncingGuest, handleMigrateGuestHistory]);

  // Auto-detect currentMode from the latest session in the history list
  useEffect(() => {
    if (activeSessions && activeSessions.length > 0) {
      setCurrentMode(activeSessions[0].mode || "academic");
    }
  }, [activeSessions]);

  // Handle guest data deletion on website exit / tab close / fresh visit
  useEffect(() => {
    if (typeof window === "undefined") return;

    const isActiveSession = sessionStorage.getItem("vivasim_active_session") === "true";

    // If this is a fresh entry (not a page refresh) and not logged in, clear guest data
    if (!isActiveSession && !user) {
      localStorage.removeItem("vivasim_user");
      localStorage.removeItem("vivasim_sessions");
      localStorage.removeItem("vivasim_stats");
      localStorage.removeItem("vivasim_mastery");
      localStorage.removeItem("vivasim_paused_session");
    }

    // Set the sessionStorage marker if they are already logged in as a guest
    if (isGuest && !isActiveSession) {
      sessionStorage.setItem("vivasim_active_session", "true");
    }
  }, [user, isGuest]);

  const handleBeginViva = (config) => {
    setVivaConfig(config);
    if (config.mode) {
      setCurrentMode(config.mode);
    }
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
    if (session.mode) {
      setCurrentMode(session.mode);
    }
    if (session.reportData) {
      setResultsData(session.reportData);
    } else {
      // Mock report metrics for historic/preloaded compatibilities
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
            const parsedObj = JSON.parse(paused);
            setPausedSession(parsedObj);
            if (parsedObj.config?.mode) {
              setCurrentMode(parsedObj.config.mode);
            }
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

    if (summary.mode) {
      setCurrentMode(summary.mode);
    }

    const finalScore = calculateFinalScore(summary);

    // Update mastery statistics dynamically using the rolling average formula
    if (vivaConfig?.syllabusStructure) {
      SyllabusMasteryService.updateMastery(
        summary.subjectName,
        vivaConfig.syllabusStructure,
        summary.askedTopics || []
      );
    }
    const sessionDateStr = new Date().toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    });

    const sessionId = generateSessionId();
    const summaryWithId = { ...summary, id: sessionId, sessionId };
    
    const newSession = {
      id: sessionId,
      subject: summary.subjectName,
      duration: vivaConfig.duration,
      personality: getPersonalityName(vivaConfig.personality, summary.mode),
      score: finalScore,
      date: sessionDateStr,
      gradeClass: finalScore >= 80 ? "high" : (finalScore >= 65 ? "med" : "low"),
      reportData: summaryWithId,
      mode: summary.mode
    };

    // Calculate updated aggregate statistics
    const totalAttempted = activeStats.totalVivas + 1;
    let lastConfidence = 84;
    if (summary.sessionConfidenceScores.length > 0) {
      const sum = summary.sessionConfidenceScores.reduce((a, b) => a + b, 0);
      lastConfidence = Math.round(sum / summary.sessionConfidenceScores.length);
    }

    const allConf = activeStats.avgConfidence * activeStats.totalVivas + lastConfidence;
    const avgConf = Math.round(allConf / totalAttempted);
    
    let strongest = activeStats.strongestSubject;
    let weakest = activeStats.weakestSubject;

    // Safe fallbacks to initialize from the first session taken
    if (!strongest || strongest === "None yet" || strongest === "None") {
      strongest = summary.subjectName;
    }
    if (!weakest || weakest === "None yet" || weakest === "None") {
      weakest = summary.subjectName;
    }

    if (finalScore > 86) strongest = summary.subjectName;
    if (finalScore < 72) weakest = summary.subjectName;

    const updatedStats = {
      totalVivas: totalAttempted,
      avgConfidence: avgConf,
      strongestSubject: strongest,
      weakestSubject: weakest
    };

    if (user) {
      // Persist directly to Firebase Firestore Cloud
      addSessionToCloud(newSession, updatedStats);
    } else {
      // Sync and save to local storage for guests
      const updatedSessions = [newSession, ...sessions];
      setSessions(updatedSessions);
      setStats(updatedStats);
      saveToStorage(updatedSessions, updatedStats);
    }

    setResultsData(summaryWithId);
    setActiveScreen("results");
  };

  const calculateFinalScore = (summary) => {
    // 1. If Gemini Hindsight Engine generated an overallFinalScore, use Gemini's holistic score directly
    if (summary.hindsightData && typeof summary.hindsightData.overallFinalScore === "number") {
      let gScore = parseInt(summary.hindsightData.overallFinalScore, 10);
      if (summary.endedEarly) gScore = Math.round(gScore * 0.6);
      return Math.min(Math.max(gScore, 40), 99);
    }

    // 2. Otherwise calculate directly from Gemini's per-round AI evaluation metrics
    if (summary.detectedEmotions && summary.detectedEmotions.length > 0) {
      let validRounds = 0;
      let totalGeminiScore = 0;

      summary.detectedEmotions.forEach(emo => {
        if (emo && !emo.isUngraded) {
          const correctness = emo.correctness ?? 75;
          const accuracy = emo.accuracy ?? 75;
          const completeness = emo.completeness ?? 70;
          const confidence = emo.confidence ?? 75;
          const clarity = emo.clarity ?? 75;
          const nervousness = emo.nervousness ?? 20;
          const hesitation = emo.hesitation ?? 15;

          // Gemini holistic score per round
          const roundGeminiScore = Math.round(
            (correctness * 0.35) + 
            (accuracy * 0.25) + 
            (completeness * 0.15) + 
            (confidence * 0.15) + 
            (clarity * 0.10) - 
            (nervousness * 0.05) - 
            (hesitation * 0.05)
          );
          totalGeminiScore += roundGeminiScore;
          validRounds++;
        }
      });

      if (validRounds > 0) {
        let score = Math.round(totalGeminiScore / validRounds);
        if (summary.endedEarly) score = Math.round(score * 0.6);
        return Math.min(Math.max(score, 40), 99);
      }
    }

    return 75;
  };

  const getPersonalityName = (pType, mode) => {
    const isProfessional = mode === "professional";
    switch(pType) {
      case "friendly": return isProfessional ? "Warm Recruiter" : "Friendly Professor";
      case "strict": return isProfessional ? "Structured EM" : "Strict Professor";
      case "brutal": return isProfessional ? "Bar Raiser EM" : "Brutal External";
      case "terror": return isProfessional ? "Director Bar Raiser" : "Viva Terror";
      default: return isProfessional ? "AI Recruiter" : "AI Examiner";
    }
  };

  // SKELETON LOADER SCREEN (Visible when Firebase is loading auth state)
  if (authLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", justifyContent: "center", alignItems: "center", background: "var(--bg-primary, #FAF9F6)" }}>
        <div style={{ textAlign: "center", animation: "pulse 2s infinite ease-in-out" }}>
          {/* Logo Icon Spinner */}
          <div style={{ display: "flex", justifyContent: "center", gap: "12px", alignItems: "center", marginBottom: "20px" }}>
            <svg className="animate-spin" style={{ width: "46px", height: "46px", color: "#6366f1" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" style={{ opacity: 0.15 }}></circle>
              <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span 
              className="logo-text" 
              style={{ 
                fontSize: "2.25rem", 
                fontWeight: "900", 
                letterSpacing: "-0.5px", 
                background: "linear-gradient(135deg, var(--accent-primary, #1f2a38) 0%, #6366f1 100%)", 
                WebkitBackgroundClip: "text", 
                WebkitTextFillColor: "transparent" 
              }}
            >
              VivaSim
            </span>
          </div>
          <p style={{ color: "var(--text-secondary, #475569)", fontSize: "0.85rem", fontWeight: "700", letterSpacing: "1px", textTransform: "uppercase", marginBottom: "8px" }}>
            Securing academic tunnel... Verifying profile
          </p>
          <div style={{ width: "180px", height: "4px", background: "rgba(31, 42, 56, 0.08)", borderRadius: "10px", margin: "16px auto 0", overflow: "hidden", position: "relative" }}>
            <div style={{ position: "absolute", height: "100%", width: "40%", background: "linear-gradient(90deg, #6366f1, #4f46e5)", borderRadius: "10px", animation: "loadingBar 1.5s infinite ease" }}></div>
          </div>
        </div>
      </div>
    );
  }

  // FORCE AUTH SCREEN IF NOT LOGGED IN & NOT GUEST
  const showAuthScreen = !user && !isGuest;
  if (showAuthScreen) {
    return <AuthScreen onLoginSuccess={handleLoginSuccess} />;
  }

  const showHeader = activeScreen !== "active-viva";

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      {/* Soft Ambient Mesh Gradient Background (Option 1) */}
      <div className="ambient-bg-wrapper">
        <div className="ambient-orb ambient-orb-1" />
        <div className="ambient-orb ambient-orb-2" />
        <div className="ambient-orb ambient-orb-3" />
      </div>

      {/* Header */}
      {showHeader && (
        <Header 
          userName={activeUserName} 
          onNavigate={(scr) => setActiveScreen(scr)} 
          onLogout={handleLogout} 
        />
      )}

      {/* Main Workspace */}
      <main>
        <div className="content-container">
          
          {/* Guest Data Sync Banner */}
          {user && hasLocalGuestData && (
            <div className="guest-sync-banner" style={{ background: "rgba(99, 102, 241, 0.12)", border: "1px solid rgba(99, 102, 241, 0.3)", borderRadius: "14px", padding: "16px var(--space-xl)", margin: "var(--space-md) 0 var(--space-lg)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", animation: "slideIn 0.4s ease" }}>
              <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                <div style={{ background: "var(--primary-color)", borderRadius: "50%", padding: "6px", display: "flex", justifyContent: "center", alignItems: "center", color: "#fff" }}>
                  <svg style={{ width: "20px", height: "20px" }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z"></path>
                  </svg>
                </div>
                <div>
                  <h4 style={{ fontWeight: "700", color: "#fff", fontSize: "0.95rem", margin: 0 }}>
                    {syncingGuest ? "Syncing offline practice sessions..." : "Offline practice sessions detected"}
                  </h4>
                  <p style={{ margin: "2px 0 0", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                    {syncingGuest ? "Please wait while we automatically migrate your offline data to the cloud." : "Merging your guest test histories directly with your cloud profile database..."}
                  </p>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#6366f1", fontSize: "0.85rem", fontWeight: "700" }}>
                <svg className="animate-spin" style={{ width: "20px", height: "20px", color: "#6366f1" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" style={{ opacity: 0.15 }}></circle>
                  <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>{syncingGuest ? "Syncing..." : "Preparing..."}</span>
              </div>
            </div>
          )}

          {/* Sync Success Alert Toast */}
          {syncSuccessMsg && (
            <div className="toast-alert" style={{ background: "rgba(16, 185, 129, 0.15)", border: "1px solid rgba(16, 185, 129, 0.35)", padding: "12px 18px", borderRadius: "10px", color: "#34d399", fontSize: "0.88rem", fontWeight: "600", marginBottom: "var(--space-lg)", display: "flex", gap: "8px", alignItems: "center", animation: "slideIn 0.3s ease" }}>
              <svg style={{ width: "20px", height: "20px", flexShrink: 0 }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <span>{syncSuccessMsg}</span>
            </div>
          )}
          
          {/* Dashboard View */}
          {activeScreen === "dashboard" && (
            <Dashboard 
              userName={activeUserName} 
              stats={activeStats} 
              sessions={activeSessions} 
              onStartNewViva={() => setActiveScreen("setup")} 
              pausedSession={pausedSession}
              onClearPausedSession={handleClearPausedSession}
              onResumePausedSession={handleResumePausedSession}
              onViewReport={handleViewReport}
            />
          )}

          {/* Syllabus Setup View */}
          {activeScreen === "setup" && (
            <SetupFlow 
              onCancel={() => setActiveScreen("dashboard")} 
              onBeginViva={handleBeginViva} 
            />
          )}

          {/* Exam Simulator View */}
          {activeScreen === "active-viva" && (
            <ActiveViva 
              config={vivaConfig} 
              activeUser={activeUserName} 
              onFinishViva={handleFinishViva} 
            />
          )}

          {/* Results Summary View */}
          {activeScreen === "results" && resultsData && (
            <Results 
              resultsData={resultsData} 
              onRestart={() => setActiveScreen("setup")} 
              onGoDashboard={() => setActiveScreen("dashboard")} 
            />
          )}
        </div>
      </main>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid var(--border-color)", padding: "var(--space-lg) 0", fontSize: "0.8rem", color: "var(--text-muted)", textAlign: "center", backgroundColor: "var(--bg-card)" }}>
        <p>© 2026 PrepSim. Engineered as a high-fidelity academic prep tool.</p>
      </footer>
    </div>
  );
}
