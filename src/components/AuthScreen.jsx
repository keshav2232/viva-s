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
          throw new Error("Full name is required to create an account.");
        }
        await signupWithEmail(email, password, fullName.trim());
      } else {
        await loginWithEmail(email, password);
      }
      // Redirection is handled reactively by onAuthStateChanged in page.js,
      // but we call callback as a safe hook if parent page manages it
      if (onLoginSuccess) {
        onLoginSuccess();
      }
    } catch (err) {
      console.error("Auth action failed:", err);
      // Clean and user-friendly error messages
      let msg = err.message;
      if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password") {
        msg = "Invalid academic credentials. Please double-check your email and password.";
      } else if (err.code === "auth/email-already-in-use") {
        msg = "This email is already registered. Please log in instead.";
      } else if (err.code === "auth/weak-password") {
        msg = "Password should be at least 6 characters long.";
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
        setErrorMessage(err.message || "Failed to sign in with Google. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGuestSubmit = () => {
    if (onLoginSuccess) {
      onLoginSuccess("Guest Student"); // Safe guest mode fallback
    }
  };

  return (
    <section id="auth-screen" className="screen active" style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "85vh", padding: "var(--space-lg) 0" }}>
      <div className="auth-container" style={{ width: "100%", maxWidth: "440px", animation: "fadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1)" }}>
        
        {/* App Logo/Branding Header */}
        <div className="auth-header" style={{ textAlign: "center", marginBottom: "var(--space-xl)" }}>
          <div className="logo-wrapper" style={{ justifyContent: "center", display: "flex", gap: "10px", alignItems: "center", marginBottom: "var(--space-md)" }}>
            <svg className="logo-icon animate-pulse" style={{ width: "42px", height: "42px", color: "var(--primary-color)", filter: "drop-shadow(0 0 12px rgba(99, 102, 241, 0.4))" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
              <path d="M12 6v10"></path>
              <path d="M8 8v6"></path>
              <path d="M16 9v4"></path>
            </svg>
            <span className="logo-text" style={{ fontSize: "2rem", fontWeight: "900", letterSpacing: "-0.5px", background: "linear-gradient(135deg, #ffffff 0%, #a5b4fc 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>VivaSim</span>
          </div>
          <h1 style={{ fontSize: "1.65rem", fontWeight: "800", marginBottom: "6px", color: "var(--text-color)" }}>
            {authMode === "login" ? "Welcome Back, Scholar" : "Begin Academic Journey"}
          </h1>
          <p className="auth-subtitle" style={{ color: "var(--text-muted)", fontSize: "0.95rem" }}>
            {authMode === "login" ? "Sign in to access your dashboard & sync test history" : "Create an account to track metrics & get AI reviews"}
          </p>
        </div>

        {/* Auth Main Card */}
        <div className="card glass-card" style={{ padding: "var(--space-xl)", background: "rgba(30, 41, 59, 0.45)", backdropFilter: "blur(16px)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "20px", boxShadow: "0 20px 40px -15px rgba(0, 0, 0, 0.5)" }}>
          
          {/* Action toggle tabs */}
          <div className="auth-tabs" style={{ display: "flex", background: "rgba(15, 23, 42, 0.6)", padding: "4px", borderRadius: "12px", marginBottom: "var(--space-xl)", border: "1px solid rgba(255, 255, 255, 0.05)" }}>
            <button 
              type="button"
              className={`auth-tab-btn ${authMode === "login" ? "active" : ""}`} 
              onClick={() => { setAuthMode("login"); setErrorMessage(""); }}
              style={{ flex: 1, padding: "10px 0", border: "none", background: authMode === "login" ? "var(--primary-color)" : "transparent", color: authMode === "login" ? "#ffffff" : "var(--text-muted)", borderRadius: "9px", fontSize: "0.9rem", fontWeight: "600", cursor: "pointer", transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)" }}
            >
              Sign In
            </button>
            <button 
              type="button"
              className={`auth-tab-btn ${authMode === "signup" ? "active" : ""}`} 
              onClick={() => { setAuthMode("signup"); setErrorMessage(""); }}
              style={{ flex: 1, padding: "10px 0", border: "none", background: authMode === "signup" ? "var(--primary-color)" : "transparent", color: authMode === "signup" ? "#ffffff" : "var(--text-muted)", borderRadius: "9px", fontSize: "0.9rem", fontWeight: "600", cursor: "pointer", transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)" }}
            >
              Sign Up
            </button>
          </div>

          {/* Dynamic Error Banner */}
          {errorMessage && (
            <div className="auth-error-banner" style={{ background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.3)", padding: "12px 16px", borderRadius: "10px", color: "#f87171", fontSize: "0.85rem", marginBottom: "var(--space-lg)", display: "flex", gap: "8px", alignItems: "center", animation: "slideIn 0.3s ease" }}>
              <svg style={{ width: "18px", height: "18px", flexShrink: 0 }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Auth Email/Password Form */}
          <form id="auth-form" onSubmit={handleSubmit}>
            <div className="auth-body" style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)", marginBottom: "var(--space-lg)" }}>
              {authMode === "signup" && (
                <div className="form-group" id="signup-name-field" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label className="form-label" htmlFor="auth-name" style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "1px", fontWeight: "700", color: "var(--text-muted)" }}>Full Name</label>
                  <input 
                    className="form-input" 
                    type="text" 
                    id="auth-name" 
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter your name" 
                    required={authMode === "signup"}
                    style={{ background: "rgba(15, 23, 42, 0.4)", border: "1px solid rgba(255, 255, 255, 0.08)", padding: "12px 14px", borderRadius: "10px", color: "#fff", fontSize: "0.95rem", width: "100%", outline: "none", transition: "border 0.3s" }}
                  />
                </div>
              )}
              
              <div className="form-group" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label className="form-label" htmlFor="auth-email" style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "1px", fontWeight: "700", color: "var(--text-muted)" }}>Academic Email</label>
                <input 
                  className="form-input" 
                  type="email" 
                  id="auth-email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@university.edu" 
                  required 
                  style={{ background: "rgba(15, 23, 42, 0.4)", border: "1px solid rgba(255, 255, 255, 0.08)", padding: "12px 14px", borderRadius: "10px", color: "#fff", fontSize: "0.95rem", width: "100%", outline: "none" }}
                />
              </div>

              <div className="form-group" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label className="form-label" htmlFor="auth-password" style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "1px", fontWeight: "700", color: "var(--text-muted)" }}>Password</label>
                <input 
                  className="form-input" 
                  type="password" 
                  id="auth-password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" 
                  required 
                  style={{ background: "rgba(15, 23, 42, 0.4)", border: "1px solid rgba(255, 255, 255, 0.08)", padding: "12px 14px", borderRadius: "10px", color: "#fff", fontSize: "0.95rem", width: "100%", outline: "none" }}
                />
              </div>
            </div>

            {/* Submit Button */}
            <button 
              className="btn btn-primary" 
              type="submit" 
              disabled={loading}
              style={{ width: "100%", padding: "14px", border: "none", background: "var(--primary-gradient, linear-gradient(135deg, #6366f1 0%, #4f46e5 100%))", color: "#fff", borderRadius: "12px", fontSize: "1rem", fontWeight: "700", cursor: loading ? "not-allowed" : "pointer", display: "flex", justifyContent: "center", alignItems: "center", gap: "8px", transition: "all 0.3s", boxShadow: "0 4px 14px rgba(99, 102, 241, 0.3)" }}
            >
              {loading ? (
                <>
                  <svg className="animate-spin" style={{ width: "20px", height: "20px", color: "#ffffff" }} fill="none" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" style={{ opacity: 0.25 }}></circle>
                    <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Connecting cloud...</span>
                </>
              ) : (
                <span>{authMode === "login" ? "Sign In Securely" : "Create Cloud Account"}</span>
              )}
            </button>
          </form>

          {/* Social and Guest Auth dividers */}
          <div className="divider-text" style={{ textAlign: "center", margin: "var(--space-lg) 0", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "1px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.06)" }}></span>
            <span>or continue with</span>
            <span style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.06)" }}></span>
          </div>

          <div className="social-auth" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {/* Google Sign In Button */}
            <button 
              type="button" 
              className="btn btn-google" 
              id="btn-google-auth" 
              onClick={handleGoogleAuth} 
              disabled={loading || !isConfigured}
              style={{ width: "100%", padding: "12px", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(15, 23, 42, 0.5)", color: "#fff", borderRadius: "10px", fontSize: "0.9rem", fontWeight: "600", cursor: (loading || !isConfigured) ? "not-allowed" : "pointer", display: "flex", justifyContent: "center", alignItems: "center", gap: "10px", transition: "all 0.3s" }}
            >
              <svg viewBox="0 0 24 24" style={{ width: "18px", height: "18px" }}>
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
              </svg>
              <span>Sign in with Google</span>
            </button>
            
            {/* Guest Sign In Button */}
            <button 
              type="button" 
              className="btn btn-guest" 
              id="btn-guest-auth" 
              onClick={handleGuestSubmit}
              disabled={loading}
              style={{ width: "100%", padding: "12px", border: "1px solid transparent", background: "transparent", color: "var(--text-muted)", borderRadius: "10px", fontSize: "0.85rem", fontWeight: "600", cursor: loading ? "not-allowed" : "pointer", transition: "all 0.3s" }}
            >
              Continue as Guest (Offline)
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
