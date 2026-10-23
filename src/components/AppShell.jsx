"use client";
import Brand from "./Brand";

import React, { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { ROUTES, matchRoute, pathFor, titleFor } from "@/app/routes";
import shell from "./AppShell.module.css";
import Header from "@/components/Header";
import AuthScreen from "@/components/AuthScreen";
import Dashboard from "@/components/Dashboard";
import dashboardStyles from "@/components/Dashboard.module.css";
import resultsStyles from "@/components/Results.module.css";
import SetupFlow from "@/components/SetupFlow";
import ActiveViva from "@/components/ActiveViva";
import Results from "@/components/Results";

import { useAuth } from "@/context/AuthContext";
import { INITIAL_STATS, DEFAULT_SESSIONS, EMPTY_STATS } from "@/utils/mockData";
import { computeOverallScore, computeSessionStats } from "@/utils/scoring";
import { SyllabusMasteryService } from "@/services/SyllabusMasteryService";
import LegalLinks from "@/components/legal/LegalLinks";

// Helper function declared outside of component to ensure render purity
function generateSessionId() {
  return `session_${Date.now()}`;
}

// Address <-> screen names used inside this component.
const SCREEN_FOR_ROUTE = { dashboard: "dashboard", setup: "setup", viva: "active-viva", report: "results" };
const ROUTE_FOR_SCREEN = { dashboard: "dashboard", setup: "setup", "active-viva": "viva", results: "report" };

/** Report data for a saved session (older sessions without a stored report get a sample report). */
function buildReportData(session) {
  if (session.reportData) return session.reportData;
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
  return mockData;
}

/** The whole practice app; the screen follows the address (see app/routes.js). */
export default function AppShell() {
  const {
    user,
    loading: authLoading,
    stats: cloudStats,
    sessions: cloudSessions,
    sessionsLoaded: cloudSessionsLoaded,
    logout,
    syncGuestData,
    addSessionToCloud,
    updateSessionInCloud,
    deleteSessionFromCloud,
    deleteAllCloudHistory,
    deleteAccount
  } = useAuth();

  // App routing states
  const [setupPreset, setSetupPreset] = useState(null);
  // --- Routing: the address decides the screen; buttons change the address with pushState. ---
  // The address is mirrored in state so it changes in the same render as the rest of the app
  // (Next.js applies pushState as a low-priority update, which could briefly show the wrong screen).
  const initialPathname = usePathname();
  const [pathname, setPathname] = useState(initialPathname);
  const requestedRoute = matchRoute(pathname) || { name: "landing", params: {} };
  const navigate = useCallback((name, params = {}, { replace = false } = {}) => {
    if (typeof window === "undefined") return;
    const path = pathFor(name, params);
    if (window.location.pathname !== path) window.history[replace ? "replaceState" : "pushState"](null, "", path);
    setPathname(path);
  }, []);
  // Browser Back / Forward.
  useEffect(() => {
    const onPop = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const setActiveScreen = (screen) => navigate(ROUTE_FOR_SCREEN[screen] || screen);
  const [hydrated, setHydrated] = useState(false); // browser storage has been read
  const [inViva, setInViva] = useState(false); // a practice session is running in this tab
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
  const [resultsId, setResultsId] = useState(null); // id of the report held in resultsData
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
    setHydrated(true);
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
    } else {
      // Fully logged into Firebase Cloud Auth
      setIsGuest(false);
    }
    // The redirect effect below moves on to the dashboard (or the page they first asked for).
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
    setInViva(false);
    navigate("landing");
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
    setInViva(true);
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
          setInViva(true);
          setActiveScreen("active-viva");
          localStorage.removeItem("vivasim_paused_session");
          setPausedSession(null);
        } catch (e) {
          console.error("Failed to resume paused session:", e);
        }
      }
    }
  };

  // --- Data deletion (dashboard "Your data" panel and the bin button on each session) ---
  const handleDeleteSession = async (session) => {
    if (user) {
      await deleteSessionFromCloud(session.id);
      return;
    }
    const remaining = sessions.filter((s) => s !== session && !(session.id && s.id === session.id));
    const nextStats = computeSessionStats(remaining);
    setSessions(remaining);
    setStats(nextStats);
    saveToStorage(remaining, nextStats);
  };

  const handleDeleteAllHistory = async () => {
    if (user) await deleteAllCloudHistory();
    if (typeof window !== "undefined") {
      localStorage.removeItem("vivasim_sessions");
      localStorage.removeItem("vivasim_stats");
      localStorage.removeItem("vivasim_mastery");
      localStorage.removeItem("vivasim_paused_session");
    }
    setSessions([]);
    setStats(EMPTY_STATS);
    setPausedSession(null);
    setHasLocalGuestData(false);
  };

  const handleDeleteAccount = async (password) => {
    await deleteAccount(password);
    await handleLogout(); // clears anything left in this browser and returns to the start screen
  };

  const handleViewReport = (session) => {
    if (session.mode) {
      setCurrentMode(session.mode);
    }
    const id = String(session.id ?? "current");
    setResultsData(buildReportData(session));
    setResultsId(id);
    navigate("report", { id });
  };

  const handleFinishViva = (summary, hindsightPromise) => {
    setInViva(false);
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

    const newSession = {
      id: generateSessionId(),
      subject: summary.subjectName,
      duration: vivaConfig.duration,
      personality: getPersonalityName(vivaConfig.personality, summary.mode),
      score: finalScore,
      date: sessionDateStr,
      createdAt: new Date().toISOString(),
      gradeClass: finalScore >= 80 ? "high" : (finalScore >= 65 ? "med" : "low"),
      reportData: { ...summary, recordedAudios: {}, hindsightLoading: false },
      mode: summary.mode
    };

    // Derive stats from the full history (same function as the cloud path)
    const updatedStats = computeSessionStats([newSession, ...activeSessions]);

    if (user) {
      // Persist directly to Firebase Firestore Cloud
      addSessionToCloud(newSession, updatedStats).catch(() => {
        console.warn("Session could not be saved to the cloud; it is only visible in this report.");
      });
    } else {
      // Sync and save to local storage for guests
      const updatedSessions = [newSession, ...sessions];
      setSessions(updatedSessions);
      setStats(updatedStats);
      saveToStorage(updatedSessions, updatedStats);
    }

    // The AI retrospective resolves after the report is shown; save it into the stored session too.
    if (hindsightPromise && typeof hindsightPromise.then === "function") {
      hindsightPromise.then((hindsight) => {
        if (!hindsight) return;
        if (user) {
          updateSessionInCloud(newSession.id, hindsight);
        } else {
          const apply = (list) => list.map((s) => (s.id === newSession.id
            ? { ...s, reportData: { ...s.reportData, hindsightData: hindsight, hindsightLoading: false } }
            : s));
          setSessions((prev) => apply(prev));
          try {
            const stored = JSON.parse(localStorage.getItem("vivasim_sessions") || "[]");
            localStorage.setItem("vivasim_sessions", JSON.stringify(apply(stored)));
          } catch (e) {
            console.warn("Could not persist retrospective locally:", e);
          }
        }
      });
    }

    setResultsData(summary);
    setResultsId(newSession.id);
    navigate("report", { id: newSession.id });
  };

  const calculateFinalScore = (summary) => computeOverallScore(summary.detectedEmotions, summary.endedEarly);

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

  const signedIn = !!user || isGuest;
  const ready = !authLoading && hydrated;

  // Send people to the right place: private pages need a sign-in (or guest session), and the
  // landing / sign-in pages move signed-in people on to their dashboard. The page they asked for
  // stays in `pathname`, so after signing in they land where they wanted to go.
  const isPrivate = !!ROUTES[requestedRoute.name]?.private;
  const route = !ready
    ? requestedRoute
    : (isPrivate && !signedIn ? { name: "login", params: {} } : (!isPrivate && signedIn ? { name: "dashboard", params: {} } : requestedRoute));
  const routePath = pathFor(route.name, route.params);

  // Keep the browser address in line with what is shown (redirects replace, not push).
  useEffect(() => {
    if (window.location.pathname !== routePath) window.history.replaceState(null, "", routePath);
  }, [routePath]);

  // Each screen gets its own tab title, and new screens start at the top.
  // (The <title> itself is rendered below; React moves it into the page head.)
  const pageTitle = <title>{titleFor(route.name)}</title>;
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [route.name, route.params.id]);

  // A running practice session keeps its screen even if the address changes (browser Back);
  // the person is then asked whether they really want to leave it.
  const routeScreen = SCREEN_FOR_ROUTE[route.name] || "dashboard";
  const activeScreen = inViva ? "active-viva" : routeScreen;
  const leavingViva = inViva && route.name !== "viva";

  // The report for /reports/<id>: the one just finished, or a saved session (after a refresh).
  const reportId = route.name === "report" ? route.params.id : null;
  const historyReady = user ? cloudSessionsLoaded : hydrated;
  const savedSession = reportId ? activeSessions.find((s) => String(s.id) === reportId) : null;
  const reportData = reportId
    ? (resultsData && resultsId && String(resultsId) === reportId ? resultsData : (savedSession ? buildReportData(savedSession) : null))
    : null;

  // SKELETON LOADER SCREEN (Visible while sign-in state and saved history are being read)
  if (!ready) {
    return (
      <div className={shell.loader} role="status" aria-live="polite">
        {pageTitle}
        <Brand />
        <span>Getting your practice room ready…</span>
        <i aria-hidden="true" />
      </div>
    );
  }

  // Landing page and sign-in / sign-up forms (signed-out visitors only)
  if (!signedIn) {
    return (
      <>
        {pageTitle}
        <AuthScreen key={route.name} view={route.name} onNavigate={(name) => navigate(name)} onLoginSuccess={handleLoginSuccess} />
      </>
    );
  }

  const showHeader = activeScreen !== "active-viva" && activeScreen !== "dashboard" && activeScreen !== "setup" && activeScreen !== "results";

  return (
    <div className={(activeScreen === "dashboard" || activeScreen === "setup") ? dashboardStyles.shell : (activeScreen === "results" ? resultsStyles.shell : undefined)} style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      {pageTitle}
      {/* Aesthetic Academic Background Canvas */}
      <div className="bg-decor-canvas">
        <div className="bg-decor-orb decor-orb-1"></div>
        <div className="bg-decor-orb decor-orb-2"></div>
        <div className="bg-decor-orb decor-orb-3"></div>

        {currentMode === "professional" ? (
          <>
            {/* STAR Flowchart Watermark */}
            <svg className="bg-academic-watermark watermark-bell" viewBox="0 0 100 50" fill="none" stroke="currentColor" strokeWidth="0.5">
              <rect x="5" y="15" width="16" height="20" rx="2" strokeWidth="0.6" />
              <text x="13" y="27" fontSize="8" fontWeight="700" fill="currentColor" textAnchor="middle">S</text>
              <text x="13" y="32" fontSize="2.5" fill="currentColor" textAnchor="middle">SITUATION</text>

              <line x1="21" y1="25" x2="27" y2="25" strokeWidth="0.6" />
              <polygon points="27,25 24,23 24,27" fill="currentColor" stroke="none" />

              <rect x="28" y="15" width="16" height="20" rx="2" strokeWidth="0.6" />
              <text x="36" y="27" fontSize="8" fontWeight="700" fill="currentColor" textAnchor="middle">T</text>
              <text x="36" y="32" fontSize="2.5" fill="currentColor" textAnchor="middle">TASK</text>

              <line x1="44" y1="25" x2="50" y2="25" strokeWidth="0.6" />
              <polygon points="50,25 47,23 47,27" fill="currentColor" stroke="none" />

              <rect x="51" y="15" width="16" height="20" rx="2" strokeWidth="0.6" />
              <text x="59" y="27" fontSize="8" fontWeight="700" fill="currentColor" textAnchor="middle">A</text>
              <text x="59" y="32" fontSize="2.5" fill="currentColor" textAnchor="middle">ACTION</text>

              <line x1="67" y1="25" x2="73" y2="25" strokeWidth="0.6" />
              <polygon points="73,25 70,23 70,27" fill="currentColor" stroke="none" />

              <rect x="74" y="15" width="16" height="20" rx="2" strokeWidth="0.6" />
              <text x="82" y="27" fontSize="8" fontWeight="700" fill="currentColor" textAnchor="middle">R</text>
              <text x="82" y="32" fontSize="2.5" fill="currentColor" textAnchor="middle">RESULT</text>
            </svg>

            {/* System Design Component Watermark */}
            <svg className="bg-academic-watermark watermark-grid" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="0.3">
              <rect x="10" y="40" width="16" height="20" rx="2" strokeWidth="0.6" />
              <text x="18" y="52" fontSize="4.5" fill="currentColor" textAnchor="middle">Client</text>

              <line x1="26" y1="50" x2="34" y2="50" strokeWidth="0.6" />
              <polygon points="34,50 31,48 31,52" fill="currentColor" stroke="none" />

              <rect x="35" y="30" width="18" height="40" rx="2" strokeWidth="0.6" />
              <text x="44" y="52" fontSize="4.5" fill="currentColor" textAnchor="middle">LB / API</text>

              <line x1="53" y1="42" x2="61" y2="35" strokeWidth="0.6" />
              <polygon points="61,35 57,35 59,38" fill="currentColor" stroke="none" />

              <line x1="53" y1="58" x2="61" y2="65" strokeWidth="0.6" />
              <polygon points="61,65 59,62 57,65" fill="currentColor" stroke="none" />

              <rect x="62" y="20" width="18" height="20" rx="2" strokeWidth="0.6" />
              <text x="71" y="32" fontSize="4" fill="currentColor" textAnchor="middle">App Svc</text>

              <rect x="62" y="60" width="18" height="20" rx="2" strokeWidth="0.6" />
              <text x="71" y="72" fontSize="4.0" fill="currentColor" textAnchor="middle">DB Cluster</text>

              <path d="M 80 30 Q 95 50 80 70" strokeWidth="0.5" strokeDasharray="1 1" />
            </svg>

            {/* Calendar Grid Schedule Watermark */}
            <svg className="bg-academic-watermark watermark-circle" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="0.4">
              <rect x="10" y="10" width="80" height="80" rx="4" strokeWidth="0.8" />
              <line x1="10" y1="28" x2="90" y2="28" strokeWidth="0.8" />
              <text x="50" y="21" fontSize="6.5" fontWeight="700" fill="currentColor" textAnchor="middle">INTERVIEW SCHEDULE</text>

              <line x1="21.4" y1="28" x2="21.4" y2="90" />
              <line x1="32.8" y1="28" x2="32.8" y2="90" />
              <line x1="44.2" y1="28" x2="44.2" y2="90" />
              <line x1="55.6" y1="28" x2="55.6" y2="90" />
              <line x1="67" y1="28" x2="67" y2="90" />
              <line x1="78.4" y1="28" x2="78.4" y2="90" />

              <line x1="10" y1="43.5" x2="90" y2="43.5" />
              <line x1="10" y1="59" x2="90" y2="59" />
              <line x1="10" y1="74.5" x2="90" y2="74.5" />

              <rect x="34.8" y="30" width="7.4" height="11.5" rx="1.5" strokeWidth="0.5" strokeDasharray="1 1" />
              <text x="38.5" y="38" fontSize="4.5" fill="currentColor" textAnchor="middle" fontWeight="700">9a</text>

              <rect x="57.6" y="45.5" width="7.4" height="11.5" rx="1.5" strokeWidth="0.5" />
              <path d="M59.5,51.5 L61,53 L63.5,49.5" strokeWidth="0.6" strokeLinecap="round" strokeLinejoin="round" />

              <rect x="23.4" y="61" width="7.4" height="11.5" rx="1.5" strokeWidth="0.5" />
              <text x="27.1" y="69" fontSize="4.5" fill="currentColor" textAnchor="middle" fontWeight="700">2p</text>

              <rect x="69" y="76.5" width="7.4" height="11.5" rx="1.5" strokeWidth="0.5" strokeDasharray="1 1" />
              <circle cx="72.7" cy="82.2" r="3.2" strokeWidth="0.5" />
              <line x1="72.7" y1="82.2" x2="72.7" y2="80.2" strokeWidth="0.5" />
              <line x1="72.7" y1="82.2" x2="74.2" y2="82.2" strokeWidth="0.5" />
            </svg>
          </>
        ) : (
          <>
            {/* Normal Distribution Curve (Telemetry Curve) */}
            <svg className="bg-academic-watermark watermark-bell" viewBox="0 0 100 50" fill="none" stroke="currentColor" strokeWidth="0.5">
              <path d="M5 45 L25 45 Q40 45 50 10 Q60 45 75 45 L95 45" />
              <line x1="50" y1="10" x2="50" y2="45" strokeDasharray="1 2" />
              <line x1="5" y1="45" x2="95" y2="45" />
              <text x="48" y="7" fontSize="4" fill="currentColor">μ</text>
              <text x="62" y="38" fontSize="4.5" fill="currentColor">σ</text>
            </svg>

            {/* Grid Cartesian Coordinate Plane (Computational Graph) */}
            <svg className="bg-academic-watermark watermark-grid" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="0.3">
              <line x1="10" y1="50" x2="90" y2="50" strokeWidth="0.8" />
              <line x1="50" y1="10" x2="50" y2="90" strokeWidth="0.8" />
              <circle cx="50" cy="50" r="30" strokeDasharray="2 2" />
              <path d="M 20 80 Q 50 50 80 20" strokeWidth="0.6" strokeDasharray="1 1" />
              <path d="M 20 20 Q 50 50 80 80" strokeWidth="0.6" />
              <text x="88" y="47" fontSize="5" fill="currentColor">x</text>
              <text x="52" y="14" fontSize="5" fill="currentColor">y</text>
            </svg>

            {/* Vector Circle Coordinate System (Kinematics Plane) */}
            <svg className="bg-academic-watermark watermark-circle" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="0.4">
              <circle cx="50" cy="50" r="40" />
              <circle cx="50" cy="50" r="2" fill="currentColor" />
              <line x1="50" y1="50" x2="78" y2="22" />
              <line x1="50" y1="50" x2="50" y2="10" strokeDasharray="1 2" />
              <line x1="10" y1="50" x2="90" y2="50" strokeDasharray="1 2" />
              <path d="M 60 50 A 10 10 0 0 0 57 43" strokeWidth="0.6" />
              <text x="62" y="46" fontSize="5" fill="currentColor">θ</text>
              <text x="75" y="20" fontSize="5" fill="currentColor">r</text>
            </svg>
          </>
        )}
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
                  <p style={{ margin: "2px 0 0", color: "var(--text-muted)", fontSize: "0.9rem" }}>
                    {syncingGuest ? "Please wait while we automatically migrate your offline data to the cloud." : "Merging your guest test histories directly with your cloud profile database..."}
                  </p>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#6366f1", fontSize: "0.9rem", fontWeight: "700" }}>
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
              onStartNewViva={(preset) => { setSetupPreset(preset); setActiveScreen("setup"); }}
              onLogout={handleLogout}
              isGuest={isGuest}
              pausedSession={pausedSession}
              onClearPausedSession={handleClearPausedSession}
              onResumePausedSession={handleResumePausedSession}
              onViewReport={handleViewReport}
              isSignedIn={!!user}
              onDeleteSession={handleDeleteSession}
              onDeleteAllHistory={handleDeleteAllHistory}
              onDeleteAccount={handleDeleteAccount}
            />
          )}

          {/* Syllabus Setup View */}
          {activeScreen === "setup" && (
            <SetupFlow
              initialConfig={setupPreset}
              onCancel={() => setActiveScreen("dashboard")}
              onBeginViva={handleBeginViva}
            />
          )}

          {/* Exam Simulator View */}
          {activeScreen === "active-viva" && inViva && vivaConfig && (
            <ActiveViva
              config={vivaConfig}
              activeUser={activeUserName}
              onBack={() => { setSetupPreset(vivaConfig); setInViva(false); setActiveScreen("setup"); }}
              onFinishViva={handleFinishViva}
            />
          )}

          {/* Viva address opened without a running session (e.g. after a refresh) */}
          {route.name === "viva" && !inViva && (
            <section className={shell.notice} aria-labelledby="no-session-title">
              <span className={shell.eyebrow}>PRACTICE SESSION</span>
              <h1 id="no-session-title">This session <em>isn&apos;t running.</em></h1>
              <p>A practice session can&apos;t continue after the page is refreshed or reopened. Use <strong>Pause</strong> during a session to save it and resume later from your dashboard.</p>
              <div className={shell.actions}>
                <button className={shell.primary} onClick={() => navigate("setup")}>Start a new session <span aria-hidden="true">→</span></button>
                <button className={shell.secondary} onClick={() => navigate("dashboard")}>Go to dashboard</button>
              </div>
            </section>
          )}

          {/* Report address that does not match a saved session */}
          {activeScreen === "results" && !reportData && (
            <section className={shell.notice} aria-labelledby="no-report-title" aria-busy={!historyReady}>
              <span className={shell.eyebrow}>SESSION REPORT</span>
              {historyReady ? (
                <>
                  <h1 id="no-report-title">We couldn&apos;t find <em>this report.</em></h1>
                  <p>{user ? "It may have been deleted, or the link is incomplete." : "Guest reports are kept only in this browser until your next visit. Sign in to keep your reports and open them from any device."}</p>
                  <div className={shell.actions}>
                    <button className={shell.primary} onClick={() => navigate("dashboard")}>Go to dashboard <span aria-hidden="true">→</span></button>
                  </div>
                </>
              ) : (
                <h1 id="no-report-title">Opening your report…</h1>
              )}
            </section>
          )}

          {/* Results Summary View */}
          {activeScreen === "results" && reportData && (
            <Results
              key={reportId}
              resultsData={reportData}
              onRestart={() => { setSetupPreset(null); setActiveScreen("setup"); }}
              onGoDashboard={() => setActiveScreen("dashboard")}
            />
          )}
        </div>
      </main>

      {leavingViva && (
        <div className={shell.backdrop}>
          <div className={shell.dialog} role="alertdialog" aria-modal="true" aria-labelledby="leave-title" aria-describedby="leave-desc">
            <h2 id="leave-title">Leave this practice session?</h2>
            <p id="leave-desc">Your answers so far won&apos;t be saved. To keep them, stay and use <strong>Pause</strong> instead.</p>
            <div className={shell.actions}>
              <button className={shell.primary} autoFocus onClick={() => navigate("viva")}>Stay in the session</button>
              <button className={shell.secondary} onClick={() => setInViva(false)}>Leave without saving</button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="app-footer" style={{ borderTop: "1px solid var(--border-color)", padding: "var(--space-lg) 0", fontSize: "0.875rem", color: "var(--text-muted)", textAlign: "center", backgroundColor: "var(--bg-card)" }}>
        <p>© {new Date().getFullYear()} PrepSim. Engineered as a high-fidelity academic prep tool.</p>
        <LegalLinks />
        {activeScreen !== "active-viva" && <button className="navigation-top" onClick={() => window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" })}>Back to top ↑</button>}
      </footer>
    </div>
  );
}
