"use client";

import React, { useMemo } from "react";

/**
 * ExaminerAvatar - Premium Dynamic Vector Portrait Component
 * Renders custom SVG designs for each of the four AI examiner personalities.
 * Dynamically adjusts mouth curves, eyebrows, glasses reflections, and head classes
 * in response to live student prosody metrics, active viva states, and Gemini semantic grades.
 */
export default function ExaminerAvatar({
  personality = "friendly",
  vivaState = "default",
  liveMetrics = { confidence: 85, nervousness: 15, clarity: 80, hesitation: 10 },
  lastEvaluation = null,
  reducedMotion = false
}) {
  
  // 1. Calculate active mood based on viva state, evaluation, and live telemetry
  const currentMood = useMemo(() => {
    // If the examiner is thinking/analyzing
    if (vivaState === "analyzing" || vivaState === "generating") {
      return "thinking";
    }

    // Check if we have an active evaluation grade to show reaction
    if (lastEvaluation) {
      const { correctness, tag } = lastEvaluation;
      if (correctness >= 75) {
        return "eval-pleased"; // approval nod
      }
      if (correctness < 55 || tag === "Bluffing" || tag === "Incorrect") {
        return "eval-stern"; // headshake frown
      }
      if (tag === "Incomplete") {
        return "eval-skeptical";
      }
    }

    // Default listening state drives dynamic posture based on student metrics
    if (vivaState === "listening") {
      if (liveMetrics.nervousness > 45 || liveMetrics.hesitation > 35) {
        return "listening-skeptical"; // raised eyebrow / concerned
      }
      if (liveMetrics.confidence > 80 && liveMetrics.hesitation < 15) {
        return "listening-pleased"; // micro-smile approval
      }
      return "listening"; // baseline focus
    }

    // Speaking state
    if (vivaState === "speaking") {
      return "speaking";
    }

    return "default";
  }, [vivaState, liveMetrics, lastEvaluation]);

  // 2. Select visual parameters based on currentMood
  const { mouthPath, eyebrowRotationL, eyebrowRotationR, eyebrowTranslationY, eyeScaleY, moodClass } = useMemo(() => {
    let mouth = "M 40,65 Q 50,65 60,65"; // neutral flat line
    let eyebrowRotL = 0;
    let eyebrowRotR = 0;
    let eyebrowTransY = 0;
    let eyeScale = 1;
    let cls = "mood-neutral";

    switch (currentMood) {
      case "speaking":
        mouth = "M 38,64 Q 50,68 62,64";
        cls = "mood-speaking";
        break;
      case "thinking":
        mouth = "M 42,65 Q 50,65 58,65"; // small flat line
        eyebrowRotL = -5;
        eyebrowRotR = 5;
        eyebrowTransY = -1;
        cls = "mood-thinking";
        break;
      case "listening-pleased":
      case "eval-pleased":
        mouth = "M 36,60 Q 50,74 64,60"; // wide warm smile
        eyebrowRotL = -5;
        eyebrowRotR = 5;
        eyebrowTransY = -2;
        cls = currentMood === "eval-pleased" ? "mood-pleased mood-nod" : "mood-pleased";
        break;
      case "listening-skeptical":
      case "eval-skeptical":
        mouth = "M 40,66 Q 50,63 60,66"; // wavy skeptical mouth
        eyebrowRotL = -15; // one highly raised
        eyebrowRotR = 5;   // one low
        eyebrowTransY = -3;
        eyeScale = 0.85; // narrowed eyes
        cls = "mood-skeptical";
        break;
      case "eval-stern":
        mouth = "M 36,68 Q 50,56 64,68"; // deep frown
        eyebrowRotL = 15;  // intense down slant
        eyebrowRotR = -15; // intense down slant
        eyebrowTransY = 2;
        eyeScale = 0.9;
        cls = "mood-stern mood-shake";
        break;
      default:
        // Default based on personality
        if (personality === "friendly") {
          mouth = "M 38,62 Q 50,69 62,62"; // subtle soft smile
        } else {
          mouth = "M 40,65 Q 50,65 60,65"; // flat
        }
        cls = "mood-neutral";
        break;
    }

    return {
      mouthPath: mouth,
      eyebrowRotationL: eyebrowRotL,
      eyebrowRotationR: eyebrowRotR,
      eyebrowTranslationY: eyebrowTransY,
      eyeScaleY: eyeScale,
      moodClass: cls
    };
  }, [currentMood, personality]);

  // Combine CSS classes for dynamic transitions
  const avatarClass = `examiner-avatar avatar-${personality} ${moodClass} ${vivaState === "speaking" ? "speaking" : ""} ${reducedMotion ? "reduced-motion" : ""}`;

  return (
    <div className="examiner-avatar-wrapper" style={{ width: "100%", height: "100%", display: "flex", justifyContent: "center", alignItems: "center" }}>
      <svg
        className={avatarClass}
        viewBox="0 0 100 100"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          width: "100%",
          height: "100%",
          overflow: "visible",
          transition: "transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)"
        }}
      >
        <defs>
          {/* Shared Glow and Gradient Assets */}
          <radialGradient id="face-glow-friendly" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="hsl(142, 60%, 98%)" />
            <stop offset="100%" stopColor="hsl(142, 45%, 93%)" />
          </radialGradient>
          <radialGradient id="face-glow-strict" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="hsl(210, 60%, 98%)" />
            <stop offset="100%" stopColor="hsl(210, 40%, 90%)" />
          </radialGradient>
          <radialGradient id="face-glow-brutal" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="hsl(35, 60%, 98%)" />
            <stop offset="100%" stopColor="hsl(35, 45%, 91%)" />
          </radialGradient>
          <radialGradient id="face-glow-terror" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="hsl(0, 45%, 97%)" />
            <stop offset="100%" stopColor="hsl(0, 30%, 82%)" />
          </radialGradient>
          
          <linearGradient id="hair-grey" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#d1d5db" />
            <stop offset="100%" stopColor="#6b7280" />
          </linearGradient>
          <linearGradient id="hair-dark" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#374151" />
            <stop offset="100%" stopColor="#111827" />
          </linearGradient>
          <linearGradient id="beard-terror" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4b5563" />
            <stop offset="100%" stopColor="#1f2937" />
          </linearGradient>
          
          <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodColor="#000000" floodOpacity="0.15" />
          </filter>
        </defs>

        {/* 1. BACKGROUND GLOW DISC */}
        <circle 
          cx="50" 
          cy="50" 
          r="48" 
          fill={
            personality === "friendly" ? "url(#face-glow-friendly)" :
            personality === "strict" ? "url(#face-glow-strict)" :
            personality === "brutal" ? "url(#face-glow-brutal)" :
            "url(#face-glow-terror)"
          }
          stroke={
            personality === "friendly" ? "hsl(142, 50%, 80%)" :
            personality === "strict" ? "hsl(210, 40%, 78%)" :
            personality === "brutal" ? "hsl(35, 40%, 78%)" :
            "hsl(0, 30%, 65%)"
          }
          strokeWidth="1.5"
          filter="url(#shadow)"
        />

        {/* Dynamic Examiner Art Group */}
        <g id="examiner-art-group" style={{ transformOrigin: "50px 75px", transition: "transform 0.4s ease" }}>
          
          {/* ========================================================
              PERSONA: DR. GEORGE (FRIENDLY)
              ======================================================== */}
          {personality === "friendly" && (
            <g id="friendly-features">
              {/* Ears */}
              <circle cx="21" cy="52" r="5" fill="#fde047" opacity="0.9" />
              <circle cx="79" cy="52" r="5" fill="#fde047" opacity="0.9" />
              
              {/* Head shape */}
              <path d="M 24,40 C 24,20 76,20 76,40 L 76,62 C 76,74 64,80 50,80 C 36,80 24,74 24,62 Z" fill="#fef08a" />
              
              {/* Elegant grey hair */}
              <path d="M 22,40 C 22,18 78,18 78,40 C 74,34 68,32 50,32 C 32,32 26,34 22,40 Z" fill="url(#hair-grey)" />
              <path d="M 23,40 C 21,30 35,22 50,25 C 65,22 79,30 77,40 C 78,44 79,48 78,50 C 76,45 74,42 74,42 L 72,42 C 72,42 70,46 66,42 C 62,38 50,40 50,40 C 50,40 38,38 34,42 C 30,46 28,42 28,42 L 26,42 C 26,42 24,45 22,50 C 21,48 22,44 23,40 Z" fill="url(#hair-grey)" />
              
              {/* Rosy Friendly Cheeks */}
              <circle cx="32" cy="62" r="5" fill="#fca5a5" opacity="0.35" />
              <circle cx="68" cy="62" r="5" fill="#fca5a5" opacity="0.35" />

              {/* Eyes & Specs Group */}
              <g id="eyes-specs">
                {/* Left & Right Eyes (Blinking enabled) */}
                <ellipse className="avatar-eye avatar-eye-l" cx="36" cy="50" rx="3.5" ry={4 * eyeScaleY} fill="#1f2937" style={{ transformOrigin: "36px 50px" }} />
                <ellipse className="avatar-eye avatar-eye-r" cx="64" cy="50" rx="3.5" ry={4 * eyeScaleY} fill="#1f2937" style={{ transformOrigin: "64px 50px" }} />
                
                {/* Friendly Specs */}
                <circle cx="36" cy="50" r="9" fill="none" stroke="#6b7280" strokeWidth="2" />
                <circle cx="64" cy="50" r="9" fill="none" stroke="#6b7280" strokeWidth="2" />
                <line x1="45" y1="50" x2="55" y2="50" stroke="#6b7280" strokeWidth="2" />
                {/* Specs Reflection shine */}
                <path d="M 30,46 A 9 9 0 0 1 39,43" fill="none" stroke="#ffffff" strokeWidth="1" opacity="0.6" />
                <path d="M 58,46 A 9 9 0 0 1 67,43" fill="none" stroke="#ffffff" strokeWidth="1" opacity="0.6" />
              </g>

              {/* Eyebrows */}
              <path
                className="avatar-eyebrow"
                d="M 28,42 Q 36,36 44,41"
                fill="none"
                stroke="url(#hair-grey)"
                strokeWidth="2.5"
                strokeLinecap="round"
                style={{
                  transformOrigin: "36px 42px",
                  transform: `translate3d(0, ${eyebrowTranslationY}px, 0) rotate(${eyebrowRotationL}deg)`,
                  transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
                }}
              />
              <path
                className="avatar-eyebrow"
                d="M 56,41 Q 64,36 72,42"
                fill="none"
                stroke="url(#hair-grey)"
                strokeWidth="2.5"
                strokeLinecap="round"
                style={{
                  transformOrigin: "64px 42px",
                  transform: `translate3d(0, ${eyebrowTranslationY}px, 0) rotate(${eyebrowRotationR}deg)`,
                  transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
                }}
              />

              {/* Smart soft nose */}
              <path d="M 50,49 Q 47,56 50,57" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
            </g>
          )}

          {/* ========================================================
              PERSONA: DR. DANIEL (STRICT)
              ======================================================== */}
          {personality === "strict" && (
            <g id="strict-features">
              {/* Ears */}
              <rect x="19" y="48" width="4" height="10" rx="2" fill="#fbcfe8" opacity="0.8" />
              <rect x="77" y="48" width="4" height="10" rx="2" fill="#fbcfe8" opacity="0.8" />
              
              {/* Precise Angular Head shape */}
              <path d="M 25,38 C 25,18 75,18 75,38 L 75,64 C 75,75 66,79 50,79 C 34,79 25,75 25,64 Z" fill="#fce7f3" />
              
              {/* Clean parted black hair */}
              <path d="M 23,38 C 23,16 77,16 77,38 C 73,30 65,24 53,24 L 47,24 C 35,24 27,30 23,38 Z" fill="url(#hair-dark)" />
              {/* Sleek parting line */}
              <path d="M 48,24 L 51,32 C 51,32 38,30 25,38 C 25,38 31,28 48,24 Z" fill="#111827" />

              {/* Eyes & Specs Group */}
              <g id="eyes-specs">
                {/* Precise Eyes */}
                <ellipse className="avatar-eye avatar-eye-l" cx="36" cy="49" rx="3" ry={3 * eyeScaleY} fill="#111827" style={{ transformOrigin: "36px 49px" }} />
                <ellipse className="avatar-eye avatar-eye-r" cx="64" cy="49" rx="3" ry={3 * eyeScaleY} fill="#111827" style={{ transformOrigin: "64px 49px" }} />
                
                {/* Thin Rectangular Specs */}
                <rect x="26" y="43" width="18" height="11" rx="1.5" fill="none" stroke="#4b5563" strokeWidth="2.2" />
                <rect x="56" y="43" width="18" height="11" rx="1.5" fill="none" stroke="#4b5563" strokeWidth="2.2" />
                <line x1="44" y1="48" x2="56" y2="48" stroke="#4b5563" strokeWidth="2.2" />
                {/* Glare */}
                <line x1="28" y1="45" x2="35" y2="52" stroke="#ffffff" strokeWidth="1" opacity="0.4" />
                <line x1="58" y1="45" x2="65" y2="52" stroke="#ffffff" strokeWidth="1" opacity="0.4" />
              </g>

              {/* Eyebrows (Strict horizontal lines) */}
              <line
                className="avatar-eyebrow"
                x1="26" y1="39" x2="43" y2="39"
                stroke="url(#hair-dark)"
                strokeWidth="3"
                strokeLinecap="round"
                style={{
                  transformOrigin: "34px 39px",
                  transform: `translate3d(0, ${eyebrowTranslationY}px, 0) rotate(${eyebrowRotationL}deg)`,
                  transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
                }}
              />
              <line
                className="avatar-eyebrow"
                x1="57" y1="39" x2="74" y2="39"
                stroke="url(#hair-dark)"
                strokeWidth="3"
                strokeLinecap="round"
                style={{
                  transformOrigin: "66px 39px",
                  transform: `translate3d(0, ${eyebrowTranslationY}px, 0) rotate(${eyebrowRotationR}deg)`,
                  transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
                }}
              />

              {/* Academic formal collar */}
              <path d="M 38,79 L 50,91 L 62,79 Z" fill="#ffffff" />
              <path d="M 45,79 L 50,88 L 55,79 Z" fill="#2563eb" /> {/* blue tie */}
              
              {/* Clean straight nose */}
              <line x1="50" y1="48" x2="50" y2="58" stroke="#db2777" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
            </g>
          )}

          {/* ========================================================
              PERSONA: DR. ADAM (BRUTAL)
              ======================================================== */}
          {personality === "brutal" && (
            <g id="brutal-features">
              {/* Sharp ears */}
              <polygon points="18,48 24,53 24,45" fill="#fed7aa" opacity="0.9" />
              <polygon points="82,48 76,53 76,45" fill="#fed7aa" opacity="0.9" />
              
              {/* Sharp Chiseled Jaw Shape */}
              <path d="M 24,36 C 24,18 76,18 76,36 L 76,58 C 76,70 65,77 50,81 C 35,77 24,70 24,58 Z" fill="#ffedd5" />
              
              {/* Spiky stylish modern grey hair */}
              <path d="M 23,36 C 21,24 35,12 50,15 C 65,12 79,24 77,36 C 73,30 68,26 50,28 C 32,28 27,30 23,36 Z" fill="url(#hair-grey)" />
              <polygon points="28,26 34,14 40,24" fill="url(#hair-grey)" />
              <polygon points="42,20 50,8 58,20" fill="url(#hair-grey)" />
              <polygon points="60,24 66,14 72,26" fill="url(#hair-grey)" />

              {/* Eyes & Tech Specs */}
              <g id="eyes-specs">
                {/* Intense Eyes */}
                <ellipse className="avatar-eye avatar-eye-l" cx="37" cy="48" rx="2.5" ry={2.5 * eyeScaleY} fill="#111827" style={{ transformOrigin: "37px 48px" }} />
                <ellipse className="avatar-eye avatar-eye-r" cx="63" cy="48" rx="2.5" ry={2.5 * eyeScaleY} fill="#111827" style={{ transformOrigin: "63px 48px" }} />
                
                {/* Sharp Octagonal Glasses */}
                <polygon points="27,41 45,41 43,53 29,53" fill="none" stroke="#ea580c" strokeWidth="2.2" />
                <polygon points="55,41 73,41 71,53 57,53" fill="none" stroke="#ea580c" strokeWidth="2.2" />
                <polyline points="44,46 50,44 56,46" fill="none" stroke="#ea580c" strokeWidth="2.2" />
                {/* Glare */}
                <line x1="31" y1="43" x2="39" y2="51" stroke="#ffffff" strokeWidth="0.8" opacity="0.5" />
                <line x1="59" y1="43" x2="67" y2="51" stroke="#ffffff" strokeWidth="0.8" opacity="0.5" />
              </g>

              {/* Eyebrows (Skeptical asymmetrical default, dynamic transforms active) */}
              <path
                className="avatar-eyebrow"
                d="M 26,38 Q 36,32 44,37"
                fill="none"
                stroke="url(#hair-dark)"
                strokeWidth="3.2"
                strokeLinecap="round"
                style={{
                  transformOrigin: "35px 38px",
                  // Inject default skepticism offset on left brow for brutal persona
                  transform: `translate3d(0, ${eyebrowTranslationY - (currentMood === "listening" || currentMood === "default" ? 2 : 0)}px, 0) rotate(${eyebrowRotationL - (currentMood === "listening" || currentMood === "default" ? 8 : 0)}deg)`,
                  transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
                }}
              />
              <path
                className="avatar-eyebrow"
                d="M 56,37 Q 64,32 74,38"
                fill="none"
                stroke="url(#hair-dark)"
                strokeWidth="3.2"
                strokeLinecap="round"
                style={{
                  transformOrigin: "65px 38px",
                  transform: `translate3d(0, ${eyebrowTranslationY}px, 0) rotate(${eyebrowRotationR}deg)`,
                  transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
                }}
              />

              {/* Dynamic shadow on cheekbones */}
              <line x1="28" y1="58" x2="38" y2="60" stroke="#ea580c" strokeWidth="1" opacity="0.15" />
              <line x1="72" y1="58" x2="62" y2="60" stroke="#ea580c" strokeWidth="1" opacity="0.15" />
              
              {/* Sharp nose */}
              <path d="M 50,46 L 47,56 L 50,56" fill="none" stroke="#ea580c" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
            </g>
          )}

          {/* ========================================================
              PERSONA: PROF. THORNE (TERROR)
              ======================================================== */}
          {personality === "terror" && (
            <g id="terror-features">
              {/* Ears */}
              <circle cx="21" cy="50" r="4.5" fill="#f87171" opacity="0.8" />
              <circle cx="79" cy="50" r="4.5" fill="#f87171" opacity="0.8" />
              
              {/* Stern Head shape */}
              <path d="M 23,38 C 23,18 77,18 77,38 L 77,60 C 77,72 65,78 50,78 C 35,78 23,72 23,60 Z" fill="#fee2e2" />
              
              {/* Menacing Shadow Overlay across top half of face */}
              <path d="M 23,38 C 23,38 50,32 77,38 L 77,53 L 23,53 Z" fill="hsl(0, 50%, 82%)" opacity="0.6" />
              
              {/* Dynamic glowing eyes under shadow */}
              <g id="glowing-eyes">
                <ellipse className="avatar-eye avatar-eye-l" cx="36" cy="47" rx="3.5" ry={3.5 * eyeScaleY} fill="#ef4444" filter="drop-shadow(0px 0px 3px #ef4444)" style={{ transformOrigin: "36px 47px" }} />
                <ellipse className="avatar-eye avatar-eye-r" cx="64" cy="47" rx="3.5" ry={3.5 * eyeScaleY} fill="#ef4444" filter="drop-shadow(0px 0px 3px #ef4444)" style={{ transformOrigin: "64px 47px" }} />
                <circle cx="36" cy="47" r="1" fill="#ffffff" />
                <circle cx="64" cy="47" r="1" fill="#ffffff" />
              </g>

              {/* Massive academic beard and white hair */}
              <path d="M 22,38 C 22,14 78,14 78,38 C 72,28 66,25 50,25 C 34,25 28,28 22,38 Z" fill="url(#hair-grey)" />
              <path d="M 23,58 C 23,78 35,88 50,88 C 65,88 77,78 77,58 L 72,58 C 72,70 62,77 50,77 C 38,77 28,70 28,58 Z" fill="url(#beard-terror)" />
              <path d="M 38,58 L 50,66 L 62,58 Z" fill="url(#beard-terror)" opacity="0.9" />

              {/* Academic circular specs */}
              <circle cx="36" cy="47" r="8" fill="none" stroke="#1f2937" strokeWidth="2.5" />
              <circle cx="64" cy="47" r="8" fill="none" stroke="#1f2937" strokeWidth="2.5" />
              <line x1="44" y1="47" x2="56" y2="47" stroke="#1f2937" strokeWidth="2.5" />

              {/* Eyebrows (Deeply angled downturned default, dynamic slant multiplier) */}
              <path
                className="avatar-eyebrow"
                d="M 25,37 L 43,43"
                fill="none"
                stroke="url(#hair-dark)"
                strokeWidth="4.2"
                strokeLinecap="round"
                style={{
                  transformOrigin: "34px 37px",
                  // Thorne starts with a fierce slant; evaluation reactions morph it further
                  transform: `translate3d(0, ${eyebrowTranslationY + (currentMood === "default" || currentMood === "listening" ? 1.5 : 0)}px, 0) rotate(${eyebrowRotationL + (currentMood === "default" || currentMood === "listening" ? 15 : 0)}deg)`,
                  transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
                }}
              />
              <path
                className="avatar-eyebrow"
                d="M 57,43 L 75,37"
                fill="none"
                stroke="url(#hair-dark)"
                strokeWidth="4.2"
                strokeLinecap="round"
                style={{
                  transformOrigin: "66px 37px",
                  transform: `translate3d(0, ${eyebrowTranslationY + (currentMood === "default" || currentMood === "listening" ? 1.5 : 0)}px, 0) rotate(${eyebrowRotationR - (currentMood === "default" || currentMood === "listening" ? 15 : 0)}deg)`,
                  transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
                }}
              />

              {/* Intimidating nose */}
              <path d="M 50,45 L 47,55 L 50,56" fill="none" stroke="#b91c1c" strokeWidth="2" strokeLinecap="round" opacity="0.3" />
            </g>
          )}

          {/* ========================================================
              SHARED: STATE-DRIVEN MOUTH PORTION
              Renders uniquely scaled curves that smooth-morph driven by CSS
              ======================================================== */}
          <path
            className="avatar-mouth"
            d={mouthPath}
            stroke={personality === "terror" ? "#1f2937" : "#1f2937"}
            strokeWidth="3.2"
            fill="none"
            strokeLinecap="round"
            style={{
              transformOrigin: "50px 65px",
              transition: "d 0.3s ease, transform 0.2s ease"
            }}
          />
        </g>
      </svg>
    </div>
  );
}
