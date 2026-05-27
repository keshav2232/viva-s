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
          <svg className="logo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
            <path d="M12 6v10"></path>
            <path d="M8 8v6"></path>
            <path d="M16 9v4"></path>
          </svg>
          <span className="logo-text">VivaSim</span>
        </div>
        <div className="nav-actions">
          <div className="user-profile" id="user-profile-widget">
            <span className="user-avatar" id="avatar-letters">
              {getInitials(userName)}
            </span>
            <span id="user-display-name">{userName || "Student"}</span>
          </div>
          {/* <button className="btn btn-text" id="btn-logout" onClick={onLogout} style={{ fontSize: "0.85rem", fontWeight: "500" }}>
            Sign Out
          </button> */}
        </div>
      </nav>
    </header>
  );
}
