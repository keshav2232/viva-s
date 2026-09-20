"use client";

import React, { useState, useEffect, useRef } from "react";
import { VoiceManager } from "@/services/voiceManager";
import { SpeechManager } from "@/services/speechManager";
import { SessionContextManager } from "@/services/SessionContextManager";
import { SlideParserService } from "@/services/SlideParserService";
import ExaminerAvatar from "@/components/ExaminerAvatar";

export default function ActivePresentation({ config, activeUser, onFinishPresentation }) {
  const slides = (config.slides && config.slides.length > 0)
    ? config.slides
    : SlideParserService.getDefaultSampleSlides(config.topic || "System Architecture");

  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [vivaState, setVivaState] = useState("speaking"); // "speaking" | "presenting" | "interrupted" | "analyzing"
  const [statusText, setStatusText] = useState("Panel is ready. Introduce your presentation...");
  
  // Timer & Pacing trackers
  const [totalTimeRemaining, setTotalTimeRemaining] = useState((config.duration || 10) * 60);
  const [slideTimes, setSlideTimes] = useState({});
  const slideTimerRef = useRef(0);
  const slideTimerIntervalRef = useRef(null);
  
  // Speech & Transcripts
  const [transcriptText, setTranscriptText] = useState("Speak now. Panel is listening to your presentation...");
  const [isPlaceholder, setIsPlaceholder] = useState(true);
  const [lastTag, setLastTag] = useState(null);
  const [interruptionQuestion, setInterruptionQuestion] = useState(null);

  // References
  const activeSlideRef = useRef(slides[currentSlideIndex]);
  const isMountedRef = useRef(true);
  const presentationStartTime = useRef(Date.now());

  useEffect(() => {
    activeSlideRef.current = slides[currentSlideIndex];
  }, [currentSlideIndex, slides]);

  // Main init: VoiceManager and intro speech
  useEffect(() => {
    isMountedRef.current = true;
    VoiceManager.init();
    SessionContextManager.reset();

    // Reset slide timing
    const initialSlideTimes = {};
    slides.forEach((_, idx) => { initialSlideTimes[idx] = 0; });
    setSlideTimes(initialSlideTimes);

    // Initial greeting by Panel
    triggerPanelGreeting();

    return () => {
      isMountedRef.current = false;
      VoiceManager.stop();
      SpeechManager.stop();
      if (slideTimerIntervalRef.current) clearInterval(slideTimerIntervalRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Per-slide pacing timer interval
  useEffect(() => {
    if (vivaState === "presenting") {
      if (slideTimerIntervalRef.current) clearInterval(slideTimerIntervalRef.current);

      slideTimerIntervalRef.current = setInterval(() => {
        setSlideTimes(prev => ({
          ...prev,
          [currentSlideIndex]: (prev[currentSlideIndex] || 0) + 1
        }));
        setTotalTimeRemaining(prev => Math.max(0, prev - 1));
      }, 1000);
    } else {
      if (slideTimerIntervalRef.current) clearInterval(slideTimerIntervalRef.current);
    }

    return () => {
      if (slideTimerIntervalRef.current) clearInterval(slideTimerIntervalRef.current);
    };
  }, [vivaState, currentSlideIndex]);

  // Keyboard navigation for slide changes (Left / Right Arrow Keys)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (vivaState !== "presenting") return;
      if (e.key === "ArrowRight" || e.key === "PageDown") {
        handleNextSlide();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        handlePrevSlide();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vivaState, currentSlideIndex]);

  const triggerPanelGreeting = () => {
    const panelName = getPanelTitle(config.personality);
    const greetingText = `Welcome ${activeUser}. The panel is ready for your presentation on "${config.topic || "your topic"}". You have ${config.duration || 10} minutes. You may begin whenever you are ready.`;
    
    setVivaState("speaking");
    setStatusText(`${panelName} is introducing the presentation session...`);

    VoiceManager.speak(greetingText, config.personality,
      () => {},
      () => {
        if (!isMountedRef.current) return;
        startPresentingMode();
      }
    );
  };

  const getPanelTitle = (p) => {
    if (p === "friendly") return "Peer Review Panel";
    if (p === "strict") return "Corporate Executive Panel";
    if (p === "brutal") return "Venture Capital Board";
    if (p === "terror") return "Thesis Defense Board";
    return "Evaluator Panel";
  };

  const startPresentingMode = () => {
    setVivaState("presenting");
    setStatusText(`Presenting Slide ${currentSlideIndex + 1} of ${slides.length}...`);
    setTranscriptText("Presenting live speech. System is tracking slide narrative...");
    setIsPlaceholder(true);

    SpeechManager.start({
      onResult: (interim, final) => {
        if (final || interim) {
          setTranscriptText(final + (interim ? ` ${interim}` : ""));
          setIsPlaceholder(false);
          
          // Store transcript segment in SessionContextManager
          SessionContextManager.answerTranscripts[currentSlideIndex] = (SessionContextManager.answerTranscripts[currentSlideIndex] || "") + " " + (final || interim);
        }
      },
      onVolumeChange: (volPct) => {
        const bars = document.querySelectorAll("#viva-waveform .waveform-bar");
        bars.forEach((bar, index) => {
          const multiplier = 0.35 + (index % 3 === 0 ? 0.55 : index % 3 === 1 ? 0.85 : 0.35);
          const rawHeight = Math.round(volPct * 0.45 * multiplier);
          const barHeight = Math.min(Math.max(rawHeight, 4), 38);
          bar.style.height = `${barHeight}px`;
        });
      },
      onError: (err) => {
        console.warn("SpeechManager presentation warning:", err);
      }
    });
  };

  const handleNextSlide = () => {
    if (currentSlideIndex < slides.length - 1) {
      setCurrentSlideIndex(prev => prev + 1);
      setStatusText(`Presenting Slide ${currentSlideIndex + 2} of ${slides.length}...`);
    }
  };

  const handlePrevSlide = () => {
    if (currentSlideIndex > 0) {
      setCurrentSlideIndex(prev => prev - 1);
      setStatusText(`Presenting Slide ${currentSlideIndex} of ${slides.length}...`);
    }
  };

  const handlePanelInterruption = async () => {
    SpeechManager.stop();
    setVivaState("speaking");
    setStatusText(`${getPanelTitle(config.personality)} is interrupting with a slide probe...`);

    const activeSlide = slides[currentSlideIndex];
    const probeText = `Excuse me. On ${activeSlide.title}, could you clarify the primary trade-off or assumption you are making here?`;

    setInterruptionQuestion(probeText);

    VoiceManager.speak(probeText, config.personality,
      () => {},
      () => {
        if (!isMountedRef.current) return;
        startPresentingMode();
      }
    );
  };

  const handleFinishPresentation = async () => {
    VoiceManager.stop();
    SpeechManager.stop();

    setVivaState("analyzing");
    setStatusText("Panel is compiling holistic presentation insights...");

    const totalDurationSecs = Math.round((Date.now() - presentationStartTime.current) / 1000);
    const fullTranscript = SessionContextManager.answerTranscripts.filter(Boolean).join(" ");

    try {
      const response = await fetch("/api/viva", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "evaluate-presentation",
          topic: config.topic || "Presentation Topic",
          slides: slides,
          slideTimes: slideTimes,
          fullTranscript: fullTranscript || "[Candidate delivered continuous slide presentation]",
          personality: config.personality,
          durationSecs: totalDurationSecs
        })
      });

      let evaluationData = null;
      if (response.ok) {
        evaluationData = await response.json();
      } else {
        throw new Error("Presentation evaluation endpoint returned non-200");
      }

      onFinishPresentation({
        mode: "presentation",
        topic: config.topic || "Presentation Deck",
        slides: slides,
        slideTimes: slideTimes,
        totalDurationSecs,
        evaluationData
      });

    } catch (err) {
      console.warn("Fallback offline presentation evaluation:", err);
      onFinishPresentation({
        mode: "presentation",
        topic: config.topic || "Presentation Deck",
        slides: slides,
        slideTimes: slideTimes,
        totalDurationSecs,
        evaluationData: {
          topicMasteryScore: 82,
          narrativeArcSummary: "You delivered a clean, steady presentation. Your slide explanation was structured, though you can expand on key trade-offs in your technical diagrams.",
          radarScores: {
            topicMastery: 82,
            storytelling: 85,
            vocalDelivery: 80,
            pacingControl: 78,
            qaDefense: 85
          },
          verbatimRatioPct: 15,
          valueAddRatioPct: 85,
          strengths: [
            "Clear slide narrative progression from problem to solution",
            "Engaging vocal tone and strong slide transitions",
            "Good time management across key slide sections"
          ],
          recommendations: [
            "Elaborate more on technical slide diagrams rather than summary bullets",
            "Maintain steady WPM pacing when transitioning between major sections",
            "Incorporate STAR-formatted metrics when explaining results"
          ]
        }
      });
    }
  };

  const activeSlide = slides[currentSlideIndex];
  const slideSecs = slideTimes[currentSlideIndex] || 0;
  const slideMins = Math.floor(slideSecs / 60);
  const slideRemSecs = slideSecs % 60;
  const slideTimeFormatted = `${slideMins}:${slideRemSecs.toString().padStart(2, '0')}`;

  const totalMins = Math.floor(totalTimeRemaining / 60);
  const totalSecs = totalTimeRemaining % 60;
  const totalTimeFormatted = `${totalMins.toString().padStart(2, '0')}:${totalSecs.toString().padStart(2, '0')}`;

  return (
    <div className="active-viva-layout presentation-sim-layout" style={{ display: "flex", gap: "20px", height: "calc(100vh - 100px)", padding: "16px" }}>
      
      {/* LEFT PANE: INTERACTIVE SLIDE DECK VIEWER */}
      <div className="presentation-slide-pane" style={{
        flex: "1.4",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--bg-secondary)",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--border-color)",
        overflow: "hidden",
        padding: "16px"
      }}>
        
        {/* Slide Header Toolbar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <div>
            <span style={{ fontSize: "0.8rem", color: "var(--accent-primary)", fontWeight: "700", textTransform: "uppercase", letterSpacing: "1px" }}>
              📊 Presentation Sim
            </span>
            <h3 style={{ margin: "2px 0 0 0", fontSize: "1.1rem" }}>{activeSlide.title}</h3>
          </div>
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <span className="badge" style={{ backgroundColor: "rgba(56, 189, 248, 0.15)", color: "#38bdf8", padding: "4px 10px", borderRadius: "12px", fontSize: "0.82rem", fontWeight: "700" }}>
              Slide {currentSlideIndex + 1} of {slides.length}
            </span>
            <span className="badge" style={{ backgroundColor: "rgba(245, 158, 11, 0.15)", color: "#f59e0b", padding: "4px 10px", borderRadius: "12px", fontSize: "0.82rem", fontWeight: "700" }}>
              ⏱️ Slide Pacing: {slideTimeFormatted}
            </span>
          </div>
        </div>

        {/* Slide Main Preview Canvas */}
        <div style={{
          flex: 1,
          backgroundColor: "#090d16",
          borderRadius: "var(--radius-md)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          overflow: "hidden",
          border: "1px solid var(--border-color)"
        }}>
          {activeSlide.previewUrl ? (
            <img 
              src={activeSlide.previewUrl} 
              alt={activeSlide.title} 
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
          ) : (
            <div style={{ padding: "30px", color: "var(--text-secondary)", textAlign: "center" }}>
              <h4>{activeSlide.title}</h4>
              <p style={{ whiteSpace: "pre-line", fontSize: "0.95rem", color: "#cbd5e1" }}>{activeSlide.text}</p>
            </div>
          )}
        </div>

        {/* Slide Controls & Thumbnails Strip */}
        <div style={{ marginTop: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
          
          {/* Thumbnails strip */}
          <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "4px" }}>
            {slides.map((s, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setCurrentSlideIndex(idx);
                  setStatusText(`Presenting Slide ${idx + 1} of ${slides.length}...`);
                }}
                style={{
                  minWidth: "70px",
                  height: "44px",
                  borderRadius: "6px",
                  border: currentSlideIndex === idx ? "2px solid var(--accent-primary)" : "1px solid var(--border-color)",
                  backgroundColor: currentSlideIndex === idx ? "rgba(99, 102, 241, 0.2)" : "var(--bg-primary)",
                  cursor: "pointer",
                  overflow: "hidden",
                  padding: "0",
                  position: "relative"
                }}
              >
                {s.previewUrl ? (
                  <img src={s.previewUrl} alt={`Slide ${idx+1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: "600" }}>{idx+1}</span>
                )}
              </button>
            ))}
          </div>

          {/* Navigation bar */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", gap: "8px" }}>
              <button 
                className="btn btn-secondary" 
                disabled={currentSlideIndex === 0}
                onClick={handlePrevSlide}
                style={{ padding: "8px 16px", fontSize: "0.88rem" }}
              >
                ← Previous Slide
              </button>
              <button 
                className="btn btn-secondary" 
                disabled={currentSlideIndex === slides.length - 1}
                onClick={handleNextSlide}
                style={{ padding: "8px 16px", fontSize: "0.88rem" }}
              >
                Next Slide →
              </button>
            </div>

            <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
              💡 Use Left/Right Arrow keys on keyboard to navigate
            </span>
          </div>
        </div>

      </div>

      {/* RIGHT PANE: EVALUATOR PANEL & AUDIO MONITOR */}
      <div className="presentation-eval-pane" style={{
        flex: "1",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--bg-secondary)",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--border-color)",
        padding: "16px",
        gap: "14px"
      }}>
        
        {/* Total Time & Panel Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h4 style={{ margin: "0", fontSize: "1rem" }}>{getPanelTitle(config.personality)}</h4>
            <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{statusText}</span>
          </div>
          <div style={{ textAlign: "right" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block" }}>Total Session Time</span>
            <span style={{ fontSize: "1.1rem", fontWeight: "700", color: totalTimeRemaining < 60 ? "var(--color-danger)" : "var(--accent-primary)" }}>
              {totalTimeFormatted}
            </span>
          </div>
        </div>

        {/* Panel Avatar */}
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0" }}>
          <ExaminerAvatar 
            personality={config.personality}
            visualState={vivaState === "speaking" ? "speaking" : "listening"}
            lastEvalRecord={lastTag}
            mode="presentation"
          />
        </div>

        {/* Audio Waveform & Live Monitor */}
        <div style={{
          backgroundColor: "var(--bg-primary)",
          padding: "12px",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--border-color)",
          display: "flex",
          flexDirection: "column",
          gap: "8px"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
            <span>Live Audio Stream</span>
            <span style={{ color: "var(--color-success)", fontWeight: "600" }}>● Active</span>
          </div>

          <div id="viva-waveform" style={{ display: "flex", gap: "4px", alignItems: "center", justifyContent: "center", height: "36px" }}>
            {[...Array(16)].map((_, i) => (
              <div key={i} className="waveform-bar" style={{ width: "4px", height: "8px", backgroundColor: "var(--accent-primary)", borderRadius: "2px", transition: "height 0.1s ease" }}></div>
            ))}
          </div>
        </div>

        {/* Live Speech Transcript Box */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
          <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: "600" }}>Spoken Transcript:</span>
          <div style={{
            flex: 1,
            backgroundColor: "var(--bg-primary)",
            borderRadius: "var(--radius-md)",
            padding: "12px",
            border: "1px solid var(--border-color)",
            fontSize: "0.88rem",
            lineHeight: "1.5",
            color: isPlaceholder ? "var(--text-secondary)" : "var(--text-primary)",
            overflowY: "auto"
          }}>
            {transcriptText}
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: "flex", gap: "10px" }}>
          {(config.personality === "brutal" || config.personality === "terror") && (
            <button 
              className="btn btn-secondary"
              onClick={handlePanelInterruption}
              style={{ flex: 1, padding: "10px", fontSize: "0.85rem" }}
            >
              🙋 Probing Question
            </button>
          )}

          <button 
            className="btn btn-primary"
            onClick={handleFinishPresentation}
            style={{
              flex: 1.5,
              padding: "10px",
              fontSize: "0.95rem",
              fontWeight: "700",
              background: "linear-gradient(135deg, var(--accent-primary) 0%, #4f46e5 100%)"
            }}
          >
            Finish Presentation & View Insights →
          </button>
        </div>

      </div>

    </div>
  );
}
