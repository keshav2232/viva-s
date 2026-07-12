import React, { useState } from "react";

export default function FlashcardDeck({ flashcards, onStartViva, onClose }) {
  const [currentCardIdx, setCurrentCardIdx] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [masteredCards, setMasteredCards] = useState({});

  if (!flashcards || flashcards.length === 0) {
    return (
      <div style={{ padding: "var(--space-lg)", textAlign: "center" }}>
        <p style={{ color: "var(--text-secondary)" }}>No study cards available.</p>
        {onClose && (
          <button className="btn btn-secondary" onClick={onClose}>
            Go Back
          </button>
        )}
      </div>
    );
  }

  const handleNext = (e) => {
    e.stopPropagation();
    if (currentCardIdx < flashcards.length - 1) {
      setIsFlipped(false);
      setTimeout(() => {
        setCurrentCardIdx((prev) => prev + 1);
      }, 150);
    }
  };

  const handlePrev = (e) => {
    e.stopPropagation();
    if (currentCardIdx > 0) {
      setIsFlipped(false);
      setTimeout(() => {
        setCurrentCardIdx((prev) => prev - 1);
      }, 150);
    }
  };

  const handleMarkReview = (e) => {
    e.stopPropagation();
    setMasteredCards((prev) => ({ ...prev, [currentCardIdx]: false }));
    if (currentCardIdx < flashcards.length - 1) {
      setTimeout(() => {
        setIsFlipped(false);
        setTimeout(() => setCurrentCardIdx((p) => p + 1), 150);
      }, 400);
    }
  };

  const handleMarkMastered = (e) => {
    e.stopPropagation();
    setMasteredCards((prev) => ({ ...prev, [currentCardIdx]: true }));
    if (currentCardIdx < flashcards.length - 1) {
      setTimeout(() => {
        setIsFlipped(false);
        setTimeout(() => setCurrentCardIdx((p) => p + 1), 150);
      }, 400);
    }
  };

  return (
    <div className="flashcards-screen-container">
      {/* Header Info */}
      <div style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.82rem", color: "var(--text-secondary)", fontWeight: "600", marginBottom: "var(--space-md)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {onClose && (
            <button 
              className="btn-close-flashcards"
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                color: "var(--text-secondary)",
                fontSize: "1.1rem",
                cursor: "pointer",
                padding: 0
              }}
              title="Close Study Deck"
            >
              ← Back
            </button>
          )}
          <span>Card {currentCardIdx + 1} of {flashcards.length}</span>
        </div>
        <span style={{
          color: masteredCards[currentCardIdx] ? "var(--color-success)" : "var(--color-warning)",
          backgroundColor: masteredCards[currentCardIdx] ? "var(--color-success-bg)" : "var(--color-warning-bg)",
          padding: "2px 8px",
          borderRadius: "var(--radius-full)",
          fontSize: "0.72rem",
          fontWeight: "700"
        }}>
          {masteredCards[currentCardIdx] ? "✓ Mastered" : "⏳ Reviewing"}
        </span>
      </div>

      {/* 3D Flip Card */}
      <div 
        className={`flashcard-wrapper ${isFlipped ? "flipped" : ""}`}
        onClick={() => setIsFlipped(!isFlipped)}
      >
        <div className="flashcard-inner">
          {/* Front Side */}
          <div className="flashcard-front">
            <span className="flashcard-watermark">Question Nudge</span>
            <p className="flashcard-text">{flashcards[currentCardIdx].question}</p>
            <span className="flashcard-hint-text">💡 Click card to flip and reveal answer</span>
          </div>

          {/* Back Side */}
          <div className="flashcard-back">
            <span className="flashcard-watermark">Key Concepts & Formulas</span>
            <div className="flashcard-text">
              {flashcards[currentCardIdx].shortAnswer}
            </div>
            <span className="flashcard-hint-text">💡 Click card to flip back</span>
          </div>
        </div>
      </div>

      {/* Navigation Controls */}
      <div className="flashcards-nav-row" style={{ marginTop: "var(--space-md)" }}>
        <button 
          className="btn btn-secondary" 
          disabled={currentCardIdx === 0}
          onClick={handlePrev}
          style={{ padding: "8px 16px", minWidth: "90px" }}
        >
          Previous
        </button>

        <div className="flashcard-mastery-buttons">
          <button 
            className="btn btn-secondary btn-mastery-review"
            onClick={handleMarkReview}
            style={{ padding: "8px 14px", fontSize: "0.8rem", fontWeight: "600" }}
          >
            Need Review
          </button>
          <button 
            className="btn btn-secondary btn-mastery-mastered"
            onClick={handleMarkMastered}
            style={{ padding: "8px 14px", fontSize: "0.8rem", fontWeight: "600" }}
          >
            Mastered ✓
          </button>
        </div>

        <button 
          className="btn btn-secondary" 
          disabled={currentCardIdx === flashcards.length - 1}
          onClick={handleNext}
          style={{ padding: "8px 16px", minWidth: "90px" }}
        >
          Next
        </button>
      </div>

      {/* Start Exam Action */}
      {onStartViva && (
        <button 
          type="button"
          className="btn btn-primary"
          onClick={onStartViva}
          style={{ width: "100%", padding: "12px", fontSize: "1.02rem", marginTop: "var(--space-md)", background: "linear-gradient(135deg, var(--accent-primary) 0%, #4f46e5 100%)", fontWeight: "700", boxShadow: "0 4px 14px rgba(99, 102, 241, 0.3)" }}
        >
          Ready: Launch High-Pressure Viva Now
        </button>
      )}
    </div>
  );
}
