import React, { useEffect, useState } from "react";

export default function WaveformVisualizer({ status, volume = 0 }) {
  const [speakHeights, setSpeakHeights] = useState(Array(11).fill(6));

  useEffect(() => {
    if (status !== "speaking") return;

    // Pulse animation mimicking speaking waves locally
    const interval = setInterval(() => {
      setSpeakHeights(
        Array(11)
          .fill(0)
          .map(() => Math.floor(Math.random() * 26) + 6)
      );
    }, 120);

    return () => clearInterval(interval);
  }, [status]);

  const barCount = 11;
  const bars = Array.from({ length: barCount });

  return (
    <div 
      className="waveform-container" 
      id="viva-waveform" 
      style={{ 
        display: "flex", 
        gap: "4px", 
        alignItems: "center", 
        justifyContent: "center", 
        height: "42px",
        margin: "0 auto" 
      }}
    >
      {bars.map((_, index) => {
        let height = 4;
        
        if (status === "speaking") {
          height = speakHeights[index] || 6;
        } else if (status === "listening" || status === "recording") {
          const multiplier = 0.35 + (index % 3 === 0 ? 0.55 : index % 3 === 1 ? 0.85 : 0.35);
          const rawHeight = Math.round(volume * 0.45 * multiplier);
          height = Math.min(Math.max(rawHeight, 4), 38);
        }

        return (
          <div
            key={index}
            className="waveform-bar"
            style={{
              width: "4px",
              height: `${height}px`,
              backgroundColor: status === "speaking" 
                ? "var(--accent-primary)" 
                : (status === "listening" ? "var(--color-warning)" : "var(--border-color)"),
              borderRadius: "var(--radius-full)",
              transition: status === "listening" ? "height 0.05s ease" : "height 0.12s ease"
            }}
          />
        );
      })}
    </div>
  );
}
