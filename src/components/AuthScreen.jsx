"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";

export default function AuthScreen({ onLoginSuccess }) {
  const { loginWithEmail, signupWithEmail, loginWithGoogle, isConfigured } = useAuth();

  const [authMode, setAuthMode] = useState("login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

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
    <section id="auth-screen" className="screen active auth-premium-portal">
      {/* 🔮 Background Glowing Ambient Orbs */}
      <div className="glow-orb orb-primary"></div>
      <div className="glow-orb orb-secondary"></div>
      <div className="glow-orb orb-tertiary"></div>

      <div className="auth-container" style={{ position: "relative", zIndex: 10, width: "100%", maxWidth: "440px" }}>
        
        {/* App Logo Header */}
        <div className="auth-header" style={{ textAlign: "center", marginBottom: "32px" }}>
          <div className="logo-wrapper" style={{ justifyContent: "center", display: "flex", gap: "10px", alignItems: "center", marginBottom: "16px" }}>
            <svg 
              className="logo-icon" 
              style={{ 
                width: "44px", 
                height: "44px", 
                color: "#6366f1", 
                filter: "drop-shadow(0 0 12px rgba(99, 102, 241, 0.45))" 
              }} 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2.2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
              <path d="M12 6v10"></path>
              <path d="M8 8v6"></path>
              <path d="M16 9v4"></path>
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
          <h1 style={{ fontSize: "1.75rem", fontWeight: "800", marginBottom: "6px", color: "var(--text-primary, #1e293b)", letterSpacing: "-0.02em" }}>
            {authMode === "login" ? "Welcome Back, Scholar" : "Begin Academic Journey"}
          </h1>
          <p className="auth-subtitle" style={{ color: "var(--text-secondary, #475569)", fontSize: "0.95rem" }}>
            {authMode === "login" ? "Sign in to access your dashboard & sync exam history" : "Create an account to track metric cards & practice with AI"}
          </p>
        </div>

        {/* 🏢 Frosted Glass Card Container */}
        <div className="glass-card-premium">
          
          {/* Sign In / Sign Up Selector Tabs */}
          <div className="auth-tabs-premium">
            <button 
              type="button"
              className={`auth-tab-btn-premium ${authMode === "login" ? "active" : ""}`} 
              onClick={() => { setAuthMode("login"); setErrorMessage(""); }}
            >
              Sign In
            </button>
            <button 
              type="button"
              className={`auth-tab-btn-premium ${authMode === "signup" ? "active" : ""}`} 
              onClick={() => { setAuthMode("signup"); setErrorMessage(""); }}
            >
              Sign Up
            </button>
          </div>

          {/* Alert Warning Box */}
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

          {/* Registration/Login Form */}
          <form id="auth-form" onSubmit={handleSubmit}>
            <div className="auth-body" style={{ display: "flex", flexDirection: "column", gap: "18px", marginBottom: "24px" }}>
              {authMode === "signup" && (
                <div className="form-group" id="signup-name-field" style={{ gap: "6px" }}>
                  <label className="form-label" htmlFor="auth-name" style={{ color: "#94a3b8", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "1px", fontWeight: "700" }}>Full Name</label>
                  <input 
                    className="glass-input-premium" 
                    type="text" 
                    id="auth-name" 
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter your name" 
                    required={authMode === "signup"}
                  />
                </div>
              )}
              
              <div className="form-group" style={{ gap: "6px" }}>
                <label className="form-label" htmlFor="auth-email" style={{ color: "#94a3b8", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "1px", fontWeight: "700" }}>Academic Email</label>
                <input 
                  className="glass-input-premium" 
                  type="email" 
                  id="auth-email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="scholar@university.edu" 
                  required 
                />
              </div>

              <div className="form-group" style={{ gap: "6px" }}>
                <label className="form-label" htmlFor="auth-password" style={{ color: "#94a3b8", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "1px", fontWeight: "700" }}>Password</label>
                <input 
                  className="glass-input-premium" 
                  type="password" 
                  id="auth-password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" 
                  required 
                />
              </div>
            </div>

            {/* High Contrast Submission Trigger */}
            <button 
              className="btn-premium-submit" 
              type="submit" 
              disabled={loading}
            >
              {loading ? (
                <>
                  <svg className="animate-spin" style={{ width: "20px", height: "20px", color: "#ffffff" }} fill="none" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" style={{ opacity: 0.25 }}></circle>
                    <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Connecting to Cloud Database...</span>
                </>
              ) : (
                <span>{authMode === "login" ? "Sign In Securely" : "Register Profile"}</span>
              )}
            </button>
          </form>

          {/* Social login option */}
          <div className="divider-text" style={{ color: "rgba(148, 163, 184, 0.4)", margin: "24px 0" }}>
            <span>or continue with</span>
          </div>

          <div className="social-auth" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {/* Google Authentication Trigger */}
            <button 
              type="button" 
              className="btn-google-premium" 
              id="btn-google-auth" 
              onClick={handleGoogleAuth} 
              disabled={loading || !isConfigured}
            >
              <svg viewBox="0 0 24 24" style={{ width: "18px", height: "18px", flexShrink: 0 }}>
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
              </svg>
              <span>Google Academic Account</span>
            </button>
            
            {/* Guest Offline Mode trigger */}
            <button 
              type="button" 
              className="btn-guest-premium" 
              id="btn-guest-auth" 
              onClick={handleGuestSubmit}
              disabled={loading}
            >
              Continue as Guest (Offline)
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
