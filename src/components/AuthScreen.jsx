"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import Image from "next/image";

// Interactive Syllabus Guides for Hero Explorer
const syllabusGuides = {
  dataStructures: {
    title: "Data Structures & Algorithms",
    code: "CS-201",
    difficulty: "High",
    examiner: "Dr. Daniel (Strict)",
    topics: ["Balanced Trees", "Hashing Collisions", "Graph traversals (DFS/BFS)", "Complexity Proofs"],
    prompt: "Let us discuss AVL Trees. When a double-rotation is required during insertion, what exact imbalance criteria are you correcting? Explain the balance factor equations mathematically.",
    tone: "strict"
  },
  thermo: {
    title: "Engineering Thermodynamics",
    code: "ME-302",
    difficulty: "High",
    examiner: "Dr. George (Friendly)",
    topics: ["Clausius Statement", "Entropy Boundaries", "Carnot Cycles", "Rankine efficiency"],
    prompt: "Welcome! Let's think about the second law of thermodynamics. Under what physical constraints is it impossible to transfer heat from a cooler body to a warmer body? Take your time.",
    tone: "friendly"
  },
  mechanics: {
    title: "Quantum Mechanics",
    code: "PH-401",
    difficulty: "Extreme",
    examiner: "Prof. Thorne (Terror)",
    topics: ["Schrödinger wave mechanics", "Uncertainty relations", "Hermitian operators", "Infinite potential wells"],
    prompt: "State the mathematical derivation of the Heisenberg Uncertainty principle. Under what exact conditions do two operators commute? Silence is not an acceptable answer.",
    tone: "terror"
  }
};

// AI Examiner Bulletin Faculty Directory
const examinersBulletin = [
  {
    name: "Dr. George",
    role: "Friendly Professor",
    personality: "Friendly",
    toughness: "Low",
    toughnessClass: "low",
    quote: "Take your time. Let's think about the fundamentals together.",
    desc: "Focuses on steady encouragement, conceptual scaffolding, and foundational understanding. Perfect for early-stage preparation."
  },
  {
    name: "Dr. Daniel",
    role: "Strict Professor",
    personality: "Rigor & Precision",
    toughness: "Medium",
    toughnessClass: "med",
    quote: "Correct, but incomplete. State the mathematical boundary conditions immediately.",
    desc: "Requires absolute precision, strict adherence to definitions, and rapid responses. Emphasizes theoretical proof."
  },
  {
    name: "Dr. Adam",
    role: "Brutal External",
    personality: "Practical Trade-offs",
    toughness: "High",
    toughnessClass: "high",
    quote: "In the real world, hesitation costs millions. State the engineering limit.",
    desc: "An industry veteran who targets bluffing instantly. Zero tolerance for textbook memorization; expects deep practical analysis."
  },
  {
    name: "Prof. Thorne",
    role: "Viva Terror",
    personality: "Legendary Pressure",
    toughness: "Extreme",
    toughnessClass: "extreme",
    quote: "Do not attempt to bluff me with buzzwords! State the exact proof!",
    desc: "Expects flawless mastery under extreme psychological and intellectual pressure. Unpredictable questions, rapid drills."
  }
];

export default function AuthScreen({ onLoginSuccess }) {
  const { loginWithEmail, signupWithEmail, loginWithGoogle, isConfigured } = useAuth();

  const [authMode, setAuthMode] = useState("login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // New State variables for landing page and explorer interactivity
  const [screenMode, setScreenMode] = useState("landing"); // "landing" | "auth"
  const [selectedSyllabus, setSelectedSyllabus] = useState("dataStructures"); // "dataStructures" | "thermo" | "mechanics"

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return;
    
    setLoading(true);
    setErrorMessage("");

    try {
      if (authMode === "signup") {
        if (!fullName.trim()) {
          throw new Error("Full name is required to create your academic profile.");
        }
        await signupWithEmail(email, password, fullName.trim());
      } else {
        await loginWithEmail(email, password);
      }
      if (onLoginSuccess) {
        onLoginSuccess();
      }
    } catch (err) {
      console.error("Auth action failed:", err);
      let msg = err.message;
      if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password") {
        msg = "Invalid credentials. Please verify your email and password.";
      } else if (err.code === "auth/email-already-in-use") {
        msg = "This email is already registered. Please sign in instead.";
      } else if (err.code === "auth/weak-password") {
        msg = "Password must be at least 6 characters long.";
      } else if (err.code === "auth/invalid-email") {
        msg = "Please enter a valid academic email address.";
      } else if (msg.includes("Firebase:")) {
        msg = msg.replace("Firebase:", "").trim();
      }
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      await loginWithGoogle();
      if (onLoginSuccess) {
        onLoginSuccess();
      }
    } catch (err) {
      console.error("Google authentication failed:", err);
      if (err.code !== "auth/popup-closed-by-user") {
        setErrorMessage(err.message || "Failed to authenticate with Google.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGuestSubmit = () => {
    if (onLoginSuccess) {
      onLoginSuccess("Guest Student");
    }
  };

  return (
    <div className="landing-portal-wrapper">
      {/* Aesthetic Academic Background Canvas */}
      <div className="bg-decor-canvas">
        <div className="bg-decor-orb decor-orb-1"></div>
        <div className="bg-decor-orb decor-orb-2"></div>
        <div className="bg-decor-orb decor-orb-3"></div>
        
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
      </div>
      {/* 📖 INTERACTIVE LANDING PAGE BROCHURE VIEW */}
      <div className={`landing-view-container ${screenMode === "auth" ? "landing-hidden" : ""}`}>
        
        {/* Landing Navigation Header */}
        <header className="landing-header">
          <div className="landing-logo">
            <div className="logo-icon-container">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="sidebar-logo-svg">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                <path d="m22 7-10-4-10 4 10 4Z"/>
                <path d="M6 9.5V14a6 6 0 0 0 12 0V9.5"/>
              </svg>
            </div>
            <div className="logo-brand">
              <span className="logo-brand-title">VivaSim</span>
              <span className="logo-brand-subtitle">AI Oral Examiner</span>
            </div>
          </div>
          <nav className="landing-nav">
            <a href="#syllabus" className="nav-item-link">Syllabi Modules</a>
            <a href="#examiners" className="nav-item-link">Faculty directory</a>
            <a href="#methodology" className="nav-item-link">Methodology</a>
          </nav>
          <button type="button" className="btn-landing-cta" onClick={() => setScreenMode("auth")}>
            Access Portal
          </button>
        </header>

        {/* Hero Banner Section */}
        <section className="landing-hero-section">
          <div className="landing-hero-grid">
            <div className="hero-left-info">
              <span className="hero-badge">Next-Gen Academic Prep</span>
              <h1 className="hero-heading">
                Master Your Oral Exams Under <span className="highlight">Realistic AI Pressure.</span>
              </h1>
              <div className="hero-divider-line"></div>
              <p className="hero-subtext">
                The world&apos;s first interactive simulator combining cognitive semantic evaluation with voice-enabled emotional telemetry. Upload your syllabus, face realistic examiner profiles, and obtain actionable stress analytics.
              </p>
              <div className="hero-action-buttons">
                <button type="button" className="btn-hero-primary" onClick={() => setScreenMode("auth")}>
                  Access Simulator Portal
                </button>
                <a href="#syllabus" className="btn-hero-secondary">
                  Explore Syllabus Guides
                </a>
              </div>
            </div>

            {/* Interactive Syllabus Explorer */}
            <div className="hero-right-explorer" id="syllabus">
              <div className="syllabus-explorer-box">
                <div className="explorer-header">
                  <span className="explorer-badge">Interactive Module</span>
                  <h3 className="explorer-title">Syllabus Prompt Explorer</h3>
                  <p className="explorer-desc">Click a syllabus module to view sample questions generated by different examiner personalities.</p>
                </div>
                
                <div className="syllabus-selector-grid">
                  {Object.keys(syllabusGuides).map((key) => (
                    <button
                      key={key}
                      type="button"
                      className={`syllabus-selector-chip ${selectedSyllabus === key ? "active" : ""}`}
                      onClick={() => setSelectedSyllabus(key)}
                    >
                      {syllabusGuides[key].title.split(" & ")[0]}
                    </button>
                  ))}
                </div>

                <div className="syllabus-card-content">
                  <div className="syllabus-meta-row">
                    <span className="syllabus-code">{syllabusGuides[selectedSyllabus].code}</span>
                    <span className="syllabus-difficulty" data-diff={syllabusGuides[selectedSyllabus].difficulty}>
                      Diff: {syllabusGuides[selectedSyllabus].difficulty}
                    </span>
                  </div>
                  <h4 className="syllabus-subject-title">{syllabusGuides[selectedSyllabus].title}</h4>
                  
                  <div className="syllabus-topics-list">
                    <span className="topics-label">Key Exam Topics Covered:</span>
                    <div className="topics-grid">
                      {syllabusGuides[selectedSyllabus].topics.map((topic, i) => (
                        <span key={i} className="topic-tag">• {topic}</span>
                      ))}
                    </div>
                  </div>

                  <div className={`explorer-prompt-bubble border-${syllabusGuides[selectedSyllabus].tone}`}>
                    <span className="bubble-speaker-label">Simulated Prompt ({syllabusGuides[selectedSyllabus].examiner}):</span>
                    <p className="bubble-prompt-text">&quot;{syllabusGuides[selectedSyllabus].prompt}&quot;</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* AI Examiner Faculty directory Bulletin Section */}
        <section className="landing-faculty-section" id="examiners">
          <div className="section-header-centered">
            <span className="section-badge">Academic Directory</span>
            <h2 className="section-title">The AI Examiner Faculty</h2>
            <div className="section-divider-mini"></div>
            <p className="section-desc">
              Our simulators feature distinct, dynamically reacting examiner profiles designed to replicate different university examiner temperaments.
            </p>
          </div>

          <div className="faculty-grid">
            {examinersBulletin.map((ex, i) => (
              <div key={i} className={`faculty-card card-${ex.toughnessClass}`}>
                <div className="faculty-card-header">
                  <div>
                    <h3 className="faculty-card-name">{ex.name}</h3>
                    <span className="faculty-card-role">{ex.role}</span>
                  </div>
                  <span className="faculty-card-badge" data-class={ex.toughnessClass}>{ex.toughness}</span>
                </div>
                <p className="faculty-card-desc">{ex.desc}</p>
                <div className="faculty-card-quote-box">
                  <span className="quote-mark">“</span>
                  <p className="faculty-card-quote">{ex.quote}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Methodology & Biometrics Diagnostics overview */}
        <section className="landing-methodology-section" id="methodology">
          <div className="section-header-centered">
            <span className="section-badge">Our Methodology</span>
            <h2 className="section-title">High-Fidelity Speech & Biometric Diagnostics</h2>
            <div className="section-divider-mini"></div>
            <p className="section-desc">
              We track and analyze complex auditory and linguistic indicators in real-time, giving you comprehensive insights into your academic performance.
            </p>
          </div>

          <div className="methodology-grid">
            <div className="methodology-card">
              <div className="methodology-icon-box bg-blue">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="methodology-icon-svg">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                  <line x1="12" y1="19" x2="12" y2="22"></line>
                </svg>
              </div>
              <h3 className="methodology-card-title">Emotional Telemetry</h3>
              <p className="methodology-card-desc">
                Tracks voice inflection, pitch variance, and speech pauses to dynamically rate Confidence, Clarity, Nervousness, and Hesitation metrics.
              </p>
            </div>

            <div className="methodology-card">
              <div className="methodology-icon-box bg-gold">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="methodology-icon-svg">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
              </div>
              <h3 className="methodology-card-title">Gemini Semantic Evaluation</h3>
              <p className="methodology-card-desc">
                Advanced language models analyze the academic completeness, semantic correctness, and spot bluffing or hollow buzzword answers.
              </p>
            </div>

            <div className="methodology-card">
              <div className="methodology-icon-box bg-green">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="methodology-icon-svg">
                  <line x1="18" y1="20" x2="18" y2="10"></line>
                  <line x1="12" y1="20" x2="12" y2="4"></line>
                  <line x1="6" y1="20" x2="6" y2="14"></line>
                </svg>
              </div>
              <h3 className="methodology-card-title">Performance Insights</h3>
              <p className="methodology-card-desc">
                Provides a comprehensive aggregate breakdown, concept weakness tracking, confidence timeline charts, and actionable mock grading.
              </p>
            </div>
          </div>

          <div className="methodology-bottom-cta">
            <h3 className="m-cta-title">Ready to face the panel?</h3>
            <button type="button" className="btn-landing-cta-large" onClick={() => setScreenMode("auth")}>
              Enter Simulation Portal
            </button>
          </div>
        </section>

        {/* Landing Page Footer */}
        <footer className="landing-footer">
          <div className="footer-emblem-container">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="footer-emblem-svg">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <path d="m22 7-10-4-10 4 10 4Z"/>
              <path d="M6 9.5V14a6 6 0 0 0 12 0V9.5"/>
            </svg>
            <span className="copyright-text">
              © 2026 VivaSim. Engineered as a high-fidelity academic prep tool.
            </span>
          </div>
        </footer>
      </div>

      {/* 🔐 MORPHING SECURE CREDENTIALS CARD VIEW */}
      <div className={`auth-view-container ${screenMode === "auth" ? "auth-visible" : "auth-hidden"}`}>
        <section id="auth-screen" className="auth-split-layout">
          {/* 🚀 Main Split Columns */}
          <div className="auth-main-row">
            
            {/* 💻 Left Sidebar Panel */}
            <aside className="auth-sidebar">
              {/* Logo brand */}
              <div className="sidebar-logo" onClick={() => setScreenMode("landing")}>
                <div className="logo-icon-container">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="sidebar-logo-svg">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    <path d="m22 7-10-4-10 4 10 4Z"/>
                    <path d="M6 9.5V14a6 6 0 0 0 12 0V9.5"/>
                  </svg>
                </div>
                <div className="logo-brand">
                  <span className="logo-brand-title">VivaSim</span>
                  <span className="logo-brand-subtitle">AI Viva Simulator</span>
                </div>
              </div>

              {/* Tagline headers */}
              <div className="sidebar-tagline-container">
                <h1 className="sidebar-tagline">
                  Prepare.<br />
                  Practice.<br />
                  <span className="highlight">Excel.</span>
                </h1>
                <div className="sidebar-divider"></div>
                <p className="sidebar-desc">
                  The most realistic AI viva experience to help you prepare with confidence.
                </p>
              </div>

              {/* University sketch positioned standing in the middle vertically */}
              <div className="sidebar-image-container-sketch">
                <Image src="/university_sketch.png" alt="University campus building sketch" className="sidebar-sketch-image" width={320} height={240} priority />
              </div>

              {/* Gold Quote Block seated at the bottom left */}
              <div className="sidebar-quote-container">
                <span className="sidebar-quote-symbol">“</span>
                <p className="sidebar-quote-text">
                  Preparation today,{"\n"}confidence tomorrow.
                </p>
                <div className="sidebar-quote-divider"></div>
              </div>
            </aside>

            {/* 🏢 Right Form Viewport */}
            <div className="auth-form-viewport">
              
              {/* Top Nav link switch */}
              <div className="auth-top-nav">
                <span className="landing-back-link" onClick={() => { setScreenMode("landing"); setErrorMessage(""); }}>
                  ← Read Course Guide
                </span>
                <span style={{ margin: "0 10px", color: "#cbd5e1" }}>|</span>
                {authMode === "login" ? (
                  <>New to VivaSim? <span className="auth-nav-link" onClick={() => { setAuthMode("signup"); setErrorMessage(""); }}>Create account</span></>
                ) : (
                  <>Already have an account? <span className="auth-nav-link" onClick={() => { setAuthMode("login"); setErrorMessage(""); }}>Sign in</span></>
                )}
              </div>

              {/* Frosted Welcome card */}
              <div className="auth-card-custom">
                <h2 className="card-title-custom">
                  {authMode === "login" ? "Welcome Back" : "Create Account"}
                </h2>
                <div className="card-divider-mini"></div>
                <p className="card-subtitle-custom">
                  {authMode === "login" ? "Sign in to continue to VivaSim" : "Register to continue to VivaSim"}
                </p>

                {/* Error alerts banner */}
                {errorMessage && (
                  <div className="premium-error-banner">
                    <svg style={{ width: "20px", height: "20px", flexShrink: 0 }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="12" y1="8" x2="12" y2="12"></line>
                      <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Google OAuth button */}
                <button 
                  type="button" 
                  className="google-btn-custom" 
                  onClick={handleGoogleAuth}
                  disabled={loading || !isConfigured}
                >
                  <svg viewBox="0 0 24 24" className="google-icon-svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                  </svg>
                  <span>
                    Continue with Google
                  </span>
                </button>

                {/* Text divider */}
                <div className="or-divider-custom">
                  <span>or</span>
                </div>

                {/* Main Email Form */}
                <form onSubmit={handleSubmit}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "20px" }}>
                    
                    {authMode === "signup" && (
                      <div>
                        <label className="form-label-custom" htmlFor="auth-name">Full name</label>
                        <div className="input-wrapper-custom">
                          <svg className="input-icon-left" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                            <circle cx="12" cy="7" r="4"></circle>
                          </svg>
                          <input 
                            className="input-custom has-icon-both" 
                            type="text" 
                            id="auth-name" 
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            placeholder="Enter your full name" 
                            required={authMode === "signup"}
                          />
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="form-label-custom" htmlFor="auth-email">Email address</label>
                      <div className="input-wrapper-custom">
                        <input 
                          className="input-custom has-icon-right" 
                          type="email" 
                          id="auth-email" 
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="Enter your email" 
                          required 
                        />
                        <svg className="input-icon-right" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                          <polyline points="22,6 12,13 2,6"></polyline>
                        </svg>
                      </div>
                    </div>

                    <div>
                      <label className="form-label-custom" htmlFor="auth-password">Password</label>
                      <div className="input-wrapper-custom">
                        <svg className="input-icon-left" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                        </svg>
                        <input 
                          className="input-custom has-icon-both" 
                          type={showPassword ? "text" : "password"} 
                          id="auth-password" 
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Enter your password" 
                          required 
                        />
                        <button 
                          type="button" 
                          className="password-toggle-btn"
                          onClick={() => setShowPassword(!showPassword)}
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                              <line x1="1" y1="1" x2="23" y2="23"></line>
                            </svg>
                          ) : (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                              <circle cx="12" cy="12" r="3"></circle>
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>

                  </div>

                  {/* Remember Me and Forgot Password links */}
                  <div className="remember-row-custom">
                    <label className="remember-checkbox-label">
                      <input 
                        type="checkbox" 
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                      />
                      <span>Remember me</span>
                    </label>
                    <a href="#forgot" className="forgot-link-custom" onClick={(e) => { e.preventDefault(); alert("Password reset workflow is being initialized. Check your academic inbox shortly."); }}>
                      Forgot password?
                    </a>
                  </div>

                  {/* Submit triggers */}
                  <button 
                    className="btn-submit-custom" 
                    type="submit" 
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <svg className="animate-spin" style={{ width: "18px", height: "18px", color: "#ffffff" }} fill="none" viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" style={{ opacity: 0.25 }}></circle>
                          <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Authenticating...</span>
                      </>
                    ) : (
                      <span>Sign in</span>
                    )}
                  </button>
                </form>

                {/* Guest Entry button section */}
                <div className="or-divider-custom">
                  <span>or continue as guest</span>
                </div>

                <button 
                  type="button" 
                  className="btn-guest-custom" 
                  onClick={handleGuestSubmit}
                  disabled={loading}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="guest-icon-svg">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                  <span>Continue as guest</span>
                </button>

              </div>
            </div>

          </div>

          {/* 📥 Bottom Footer features lists */}
          <footer className="auth-footer">
            <div className="features-row">
              
              {/* Feature 1 */}
              <div className="feature-item">
                <div className="feature-icon-box">
                  <svg className="feature-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                  </svg>
                </div>
                <div className="feature-text">
                  <span className="feature-title">Subject-specific questions</span>
                  <span className="feature-desc">Questions generated from your syllabus and important topics.</span>
                </div>
              </div>

              {/* Feature 2 */}
              <div className="feature-item">
                <div className="feature-icon-box">
                  <svg className="feature-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="20" x2="18" y2="10"></line>
                    <line x1="12" y1="20" x2="12" y2="4"></line>
                    <line x1="6" y1="20" x2="6" y2="14"></line>
                  </svg>
                </div>
                <div className="feature-text">
                  <span className="feature-title">Performance insights</span>
                  <span className="feature-desc">Detailed feedback to help you identify and improve.</span>
                </div>
              </div>

              {/* Feature 3 */}
              <div className="feature-item">
                <div className="feature-icon-box">
                  <svg className="feature-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                    <polyline points="9 11 12 14 17 9"></polyline>
                  </svg>
                </div>
                <div className="feature-text">
                  <span className="feature-title">Realistic viva experience</span>
                  <span className="feature-desc">Al examiners adapt based on your responses and confidence.</span>
                </div>
              </div>

            </div>

            {/* Dynamic Logo Emblem and Copyright notice */}
            <div className="footer-emblem-container">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="footer-emblem-svg">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                <path d="m22 7-10-4-10 4 10 4Z"/>
                <path d="M6 9.5V14a6 6 0 0 0 12 0V9.5"/>
              </svg>
              <span className="copyright-text">
                © 2024 VivaSim. All rights reserved.
              </span>
            </div>
          </footer>
        </section>
      </div>
    </div>
  );
}
