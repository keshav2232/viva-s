import React, { useState, useEffect } from "react";

export default function GaugeMetric({ percentage, label, isLarge = false }) {
  const [displayedValue, setDisplayedValue] = useState(0);
  
  const circumference = 314.16; // 2 * pi * r (where r = 50)
  const offset = circumference - (displayedValue / 100) * circumference;

  useEffect(() => {
    const duration = 1200; // 1.2s to animate progress smoothly
    const start = performance.now();
    const target = percentage || 0;

    let animFrame;
    const animate = (time) => {
      const elapsed = time - start;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing out cubic: easeOutCubic(t) = 1 - (1-t)^3
      const ease = 1 - Math.pow(1 - progress, 3);
      setDisplayedValue(Math.round(ease * target));

      if (progress < 1) {
        animFrame = requestAnimationFrame(animate);
      }
    };

    animFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrame);
  }, [percentage]);

  if (isLarge) {
    return (
      <div className="radial-svg-wrapper" style={{ width: "110px", height: "110px", flexShrink: 0, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg viewBox="0 0 120 120" style={{ width: "100%", height: "100%" }}>
          <circle className="radial-svg-circle-bg" cx="60" cy="60" r="50" />
          <circle 
            className="radial-svg-circle-fill" 
            cx="60" 
            cy="60" 
            r="50" 
            strokeDasharray={circumference.toString()} 
            strokeDashoffset={offset}
            style={{
              fill: "none",
              stroke: "var(--accent-primary)",
              strokeWidth: 10,
              strokeLinecap: "round",
              transform: "rotate(-90deg)",
              transformOrigin: "60px 60px",
              transition: "stroke-dashoffset 0.1s linear"
            }}
          />
        </svg>
        <div className="radial-score-value" style={{ position: "absolute", fontSize: "1.6rem", fontWeight: "800", color: "var(--accent-primary)" }}>{displayedValue}%</div>
      </div>
    );
  }

  // Small inline detail row metric
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: "var(--radius-sm)", backgroundColor: "var(--bg-primary)" }}>
      <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{label}</span>
      <strong style={{ fontSize: "0.9rem", color: "var(--accent-primary)" }}>{percentage}%</strong>
    </div>
  );
}
