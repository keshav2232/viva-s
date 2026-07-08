"use client";

import React from "react";

export default function Header({ userName, onNavigate, onLogout }) {
  const getInitials = (name) => {
    return name ? name.charAt(0).toUpperCase() : "S";
  };

  return (
    <header id="app-header">
      <nav className="nav-container">
        <div className="logo-wrapper" id="nav-logo" onClick={() => onNavigate("dashboard")}>
          <svg className="logo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            <path d="m22 7-10-4-10 4 10 4Z"/>
            <path d="M6 9.5V14a6 6 0 0 0 12 0V9.5"/>
          </svg>
          <span className="logo-text">PrepSim</span>
        </div>
        <div className="nav-actions">
          <div className="user-profile" id="user-profile-widget">
            <span className="user-avatar" id="avatar-letters">
              {getInitials(userName)}
            </span>
            <span id="user-display-name">{userName || "Candidate"}</span>
          </div>
          <button 
            className="btn btn-text btn-logout-hover" 
            id="btn-logout" 
            onClick={onLogout} 
            style={{ 
              fontSize: "0.85rem", 
              fontWeight: "600", 
              color: "rgba(248, 113, 113, 0.8)", 
              background: "rgba(248, 113, 113, 0.06)", 
              border: "1px solid rgba(248, 113, 113, 0.15)",
              padding: "6px 12px",
              borderRadius: "8px",
              cursor: "pointer",
              transition: "background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease",
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}
          >
            <span className="logout-btn-text">Sign Out</span>
            <svg className="logout-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: "16px", height: "16px", display: "none" }}>
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
          </button>
        </div>
      </nav>
    </header>
  );
}
