"use client";

import React, { useEffect, useState } from "react";
import { SyllabusMasteryService } from "@/services/SyllabusMasteryService";

export default function Dashboard({ userName, stats, sessions, onStartNewViva, pausedSession, onClearPausedSession, onResumePausedSession, onViewReport }) {
  const [salutation] = useState(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  });

  const masteryData = SyllabusMasteryService.initializeDefaultMastery(sessions || []);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [expandedUnitIdx, setExpandedUnitIdx] = useState(null);

  const subjects = Object.keys(masteryData);
  const activeSubject = selectedSubject || (subjects.length > 0 ? subjects[0] : "");
  const activeSubjectData = masteryData[activeSubject];

  const isProfessionalMode = activeSubjectData?.units?.[0]?.name?.toLowerCase().includes("competency") || 
                              (sessions && sessions.find(s => s.subject === activeSubject)?.mode === "professional") ||
                              activeSubject?.toLowerCase().includes("software engineer") ||
                              activeSubject?.toLowerCase().includes("product manager") ||
                              activeSubject?.toLowerCase().includes("data scientist");

  const isProfessionalDashboard = sessions && sessions.length > 0 
    ? sessions[0].mode === "professional" 
    : isProfessionalMode;

  const getUnitMastery = (unit) => {
    if (!activeSubjectData || !activeSubjectData.mastery) return 0;
    const topics = unit.topics || [];
    if (topics.length === 0) return 0;
    const sum = topics.reduce((acc, t) => acc + (activeSubjectData.mastery[t] || 0), 0);
    return Math.round(sum / topics.length);
  };

  const getOverallMastery = () => {
    if (!activeSubjectData || !activeSubjectData.units) return 0;
    const units = activeSubjectData.units;
    if (units.length === 0) return 0;
    const sum = units.reduce((acc, u) => acc + getUnitMastery(u), 0);
    return Math.round(sum / units.length);
  };

  const getProgressColor = (pct) => {
    if (pct < 50) return "linear-gradient(90deg, hsl(0, 75%, 50%), hsl(20, 80%, 55%))";
    if (pct < 75) return "linear-gradient(90deg, hsl(38, 85%, 50%), hsl(48, 80%, 55%))";
    return "linear-gradient(90deg, hsl(145, 65%, 45%), hsl(160, 60%, 50%))";
  };

  const getDotColor = (pct) => {
    if (pct === 0) return "hsl(0, 0%, 55%)";
    if (pct < 50) return "hsl(0, 75%, 50%)";
    if (pct < 75) return "hsl(38, 85%, 50%)";
    return "hsl(145, 65%, 45%)";
  };

  const getPersonalityName = (pType, mode = "academic") => {
    const cleanType = pType?.toLowerCase();
    if (cleanType?.includes("friendly") || cleanType === "friendly") return mode === "professional" ? "Warm Recruiter" : "Friendly Professor";
    if (cleanType?.includes("strict") || cleanType === "strict") return mode === "professional" ? "Structured Hiring Manager" : "Strict Professor";
    if (cleanType?.includes("brutal") || cleanType === "brutal") return mode === "professional" ? "Bar Raiser" : "Brutal External";
    if (cleanType?.includes("terror") || cleanType === "terror") return mode === "professional" ? "Stress Interviewer" : "Viva Terror";
    return pType || (mode === "professional" ? "AI Interviewer" : "AI Examiner");
  };

  return (
    <section id="dashboard-screen" className="screen active">
      <div className="dashboard-grid">
        {pausedSession && (
          <div className="paused-banner-card" style={{
            gridColumn: "1 / -1",
            background: "linear-gradient(135deg, hsl(215, 32%, 18%) 0%, hsl(215, 25%, 12%) 100%)",
            color: "white",
            padding: "var(--space-md) var(--space-lg)",
            borderRadius: "var(--radius-md)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "var(--space-md)",
            border: "1px solid hsl(215, 25%, 28%)",
            boxShadow: "var(--shadow-md)",
            marginBottom: "var(--space-md)"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)" }}>
              <div style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                backgroundColor: "rgba(255, 255, 255, 0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "hsl(38, 95%, 60%)",
                flexShrink: 0
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 14H11v-2h2v2zm0-4H11V7h2v5z"/>
                </svg>
              </div>
              <div>
                <h4 style={{ margin: 0, fontWeight: "600", fontSize: "0.95rem", color: "hsl(38, 90%, 65%)" }}>
                  Active Paused Practice Session Detected
                </h4>
                <p style={{ margin: "2px 0 0 0", color: "rgba(255, 255, 255, 0.8)", fontSize: "0.85rem" }}>
                  You have a saved practice session in progress on <strong>{pausedSession.config?.topic}</strong> with <strong>{getPersonalityName(pausedSession.config?.personality, pausedSession.config?.mode)}</strong> (Question {pausedSession.currentQuestionIndex + 1} of 4).
                </p>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
              <button 
                className="btn btn-secondary" 
                onClick={onClearPausedSession}
                style={{ 
                  backgroundColor: "rgba(255, 255, 255, 0.05)", 
                  color: "rgba(255, 255, 255, 0.75)", 
                  borderColor: "rgba(255, 255, 255, 0.15)",
                  padding: "8px 16px",
                  fontSize: "0.85rem"
                }}
              >
                Clear
              </button>
              <button 
                className="btn btn-primary" 
                onClick={onResumePausedSession}
                style={{ 
                  backgroundColor: "hsl(38, 85%, 50%)", 
                  color: "hsl(215, 30%, 10%)",
                  borderColor: "transparent",
                  fontWeight: "600",
                  padding: "8px 20px",
                  fontSize: "0.85rem",
                  boxShadow: "0 0 12px rgba(225, 150, 20, 0.3)"
                }}
              >
                Resume Session
              </button>
            </div>
          </div>
        )}
        <div className="hero-section">
          <div className="greeting-section">
            <h1 id="dashboard-greeting">{salutation}, {userName}</h1>
            <p>Ready for your next session? Select an area or configure custom settings to practice.</p>
          </div>
          <div className="dashboard-actions">
            <button 
              className="btn btn-primary" 
              id="btn-start-viva-cta" 
              onClick={onStartNewViva}
              style={{ padding: "var(--space-md) var(--space-xl)", fontSize: "1.05rem" }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14"/>
              </svg>
              Start New Session
            </button>
          </div>
        </div>

        <div className="stats-grid">
          <div className="card stat-card">
            <svg className="stat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            <span className="stat-label">Total Practice Sessions</span>
            <span className="stat-value" id="stat-total-vivas">{stats.totalVivas}</span>
            <span className="stat-sub neutral">Practice sessions complete</span>
          </div>

          <div className="card stat-card">
            <svg className="stat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
            </svg>
            <span className="stat-label">Average Confidence</span>
            <span className="stat-value" id="stat-avg-confidence">{stats.avgConfidence}%</span>
            <span className="stat-sub" style={{ color: stats.totalVivas > 0 ? "var(--color-success)" : "var(--text-muted)" }}>
              {stats.totalVivas > 0 ? "Overall confidence score" : "No practice sessions recorded"}
            </span>
          </div>

          <div className="card stat-card">
            <svg className="stat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            <span className="stat-label">Strongest Area</span>
            <span className="stat-value" id="stat-strongest-subject" style={{ fontSize: "1.2rem", fontWeight: "700", marginTop: "4px" }}>
              {stats.strongestSubject || "None yet"}
            </span>
            <span className="stat-sub" style={{ color: stats.totalVivas > 0 ? "var(--color-success)" : "var(--text-muted)" }}>
              {stats.totalVivas > 0 ? (isProfessionalDashboard ? "Highest-performing domain" : "Highest-performing topic") : "Start a session to analyze strength"}
            </span>
          </div>

          <div className="card stat-card">
            <svg className="stat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            <span className="stat-label">Weakest Area</span>
            <span className="stat-value" id="stat-weakest-subject" style={{ fontSize: "1.2rem", fontWeight: "700", marginTop: "4px" }}>
              {stats.weakestSubject || "None yet"}
            </span>
            <span className="stat-sub" style={{ color: stats.totalVivas > 0 ? "var(--color-error)" : "var(--text-muted)" }}>
              {stats.totalVivas > 0 ? (isProfessionalDashboard ? "Recommended focus domain" : "Recommended focus area") : "Practice needed to detect weaknesses"}
            </span>
          </div>
        </div>

        {/* 📊 Syllabus & Competency Mastery Tracker Section */}
        {Object.keys(masteryData).length > 0 && activeSubjectData && (
          <div className="mastery-tracker-card">
            <div className="mastery-tracker-header">
              <div className="mastery-tracker-title-row">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9M3 20v-8a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v8M11 20V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v16"/>
                </svg>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: "700" }}>
                    {isProfessionalMode ? "Role Competency Matrix" : "Syllabus Progress"}
                  </h3>
                  <p style={{ margin: "2px 0 0 0", fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                    {isProfessionalMode ? "Track real-time competency depth and role readiness." : "Track real-time concept depth and topic readiness."}
                  </p>
                </div>
              </div>

              {/* Subject Selector Dropdown */}
              <select 
                className="mastery-select-dropdown" 
                value={activeSubject} 
                onChange={(e) => {
                  setSelectedSubject(e.target.value);
                  setExpandedUnitIdx(null);
                }}
              >
                {subjects.map(subject => (
                  <option key={subject} value={subject}>{subject}</option>
                ))}
              </select>
            </div>

            {/* Overall Subject Mastery Banner */}
            <div className="mastery-overview-row">
              <span style={{ fontSize: "0.85rem", fontWeight: "600", color: "var(--text-secondary)" }}>
                {isProfessionalMode ? "Overall Role Readiness" : "Overall Syllabus Mastery"}
              </span>
              <span style={{ fontSize: "1.1rem", fontWeight: "800", color: "var(--accent-primary)" }}>
                {getOverallMastery()}% {isProfessionalMode ? "Ready" : "Mastered"}
              </span>
            </div>

            {/* Units Accordion Grid */}
            <div className="mastery-units-container">
              {activeSubjectData.units.map((unit, uIdx) => {
                const uMastery = getUnitMastery(unit);
                const isExpanded = expandedUnitIdx === uIdx;

                return (
                  <div className="mastery-unit-card" key={uIdx}>
                    <button 
                      className="mastery-unit-header-btn" 
                      onClick={() => setExpandedUnitIdx(isExpanded ? null : uIdx)}
                    >
                      <div className="mastery-unit-title-row">
                        <span className="mastery-unit-title">{unit.name}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span className="mastery-unit-pct">{uMastery}%</span>
                          <svg 
                            width="16" 
                            height="16" 
                            viewBox="0 0 24 24" 
                            fill="none" 
                            stroke="currentColor" 
                            strokeWidth="2.5" 
                            style={{ 
                              transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)", 
                              transition: "transform 0.25s ease",
                              color: "var(--text-muted)"
                            }}
                          >
                            <path d="m6 9 6 6 6-6"/>
                          </svg>
                        </div>
                      </div>
                      <div className="mastery-progress-track">
                        <div 
                          className="mastery-progress-fill" 
                          style={{ 
                            width: `${uMastery}%`,
                            background: getProgressColor(uMastery)
                          }}
                        />
                      </div>
                    </button>

                    {/* Unit Subtopics Accordion */}
                    {isExpanded && (
                      <div className="mastery-subtopics-list">
                        {unit.topics.map((t, tIdx) => {
                          const score = activeSubjectData.mastery[t] || 0;
                          return (
                            <div className="mastery-subtopic-item" key={tIdx}>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <div 
                                  className="mastery-dot-indicator" 
                                  style={{ backgroundColor: getDotColor(score) }}
                                />
                                <span style={{ fontWeight: "600", color: "var(--text-primary)" }}>{t}</span>
                              </div>
                              <span style={{ fontWeight: "700", color: score === 0 ? "var(--text-muted)" : "var(--text-primary)" }}>
                                {score === 0 ? "Untested" : `${score}%`}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="sessions-container">
          <div className="sessions-section-title">
            <span>{isProfessionalDashboard ? "Recent Mock Interviews" : "Recent Practice Sessions"}</span>
          </div>
          
          <div className="sessions-list" id="dashboard-sessions-list">
            {sessions && sessions.length > 0 ? (
              sessions.map((sess) => (
                <div 
                  className="card session-card" 
                  key={sess.id}
                  onClick={() => onViewReport && onViewReport(sess)}
                  style={{ cursor: "pointer", transition: "var(--transition-smooth)" }}
                  title="Click to reopen detailed evaluation report"
                >
                  <div className="session-info">
                    <span className="session-subject">{sess.subject}</span>
                    <div className="session-meta-row">
                      <div className="session-meta-item">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: "14px", height: "14px" }}>
                          <circle cx="12" cy="12" r="10"></circle>
                          <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                        <span>{sess.duration} mins</span>
                      </div>
                      <div className="session-meta-item">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: "14px", height: "14px" }}>
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                          <circle cx="12" cy="7" r="4"></circle>
                        </svg>
                        <span>{getPersonalityName(sess.personality, sess.mode)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="session-grade">
                    <span className="session-date">{sess.date}</span>
                    <span className={`grade-badge ${sess.gradeClass || "high"}`}>{sess.score}%</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="card" style={{ 
                textAlign: "center", 
                padding: "48px 24px", 
                backgroundColor: "var(--bg-card)",
                border: "1px solid var(--border-color)",
                borderRadius: "var(--radius-md)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-secondary)"
              }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: "12px", color: "var(--text-muted)" }}>
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
                <h4 style={{ fontWeight: "600", fontSize: "1.05rem", color: "var(--text-primary)", marginBottom: "4px" }}>
                  {isProfessionalDashboard ? "No Interview Sessions Yet" : "No Practice Sessions Yet"}
                </h4>
                <p style={{ fontSize: "0.88rem", maxWidth: "340px", color: "var(--text-secondary)", margin: "0 auto" }}>
                  {isProfessionalDashboard 
                    ? "Start your first interactive AI mock interview using the button above to begin compiling your career metrics!"
                    : "Start your first interactive AI viva exam using the button above to begin compiling your study metrics!"}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
