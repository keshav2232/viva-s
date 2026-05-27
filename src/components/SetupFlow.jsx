"use client";

import React, { useState, useEffect } from "react";
import { EXAMINER_PERSONALITIES } from "@/utils/mockData";
import { PDFExtractionService } from "@/services/PDFExtractionService";
import { SyllabusParserService } from "@/services/SyllabusParserService";
import { VoiceManager } from "@/services/voiceManager";

export default function SetupFlow({ onCancel, onBeginViva }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [sourceType, setSourceType] = useState("syllabus"); // "syllabus" | "topic"
  
  // Input fields
  const [topic, setTopic] = useState("");
  const [syllabusText, setSyllabusText] = useState("");
  
  // File Upload states
  const [syllabusUploaded, setSyllabusUploaded] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("Drag & drop syllabus PDF/TXT here or click to browse");
  const [isExtractingText, setIsExtractingText] = useState(false);
  
  // Syllabus & Topic Tree structures
  const [syllabusStructure, setSyllabusStructure] = useState(null);
  const [isExpandingTopic, setIsExpandingTopic] = useState(false);

  // Duration
  const [duration, setDuration] = useState(5);
  const [customDurationVal, setCustomDurationVal] = useState("");
  const [showCustomDuration, setShowCustomDuration] = useState(false);

  // Personality
  const [personality, setPersonality] = useState("friendly");
  const [isPlayingSample, setIsPlayingSample] = useState(false);

  // Hackathon differentiator toggles
  const [isLastMinute, setIsLastMinute] = useState(false);
  const [isMockExternal, setIsMockExternal] = useState(false);

  // Load PDF.js CDN library on mount so it's ready
  useEffect(() => {
    PDFExtractionService.loadPDFJS().catch(err => {
      console.warn("PDF.js CDN load deferred:", err);
    });

    return () => {
      VoiceManager.stop();
    };
  }, []);

  const handlePlaySampleVoice = () => {
    if (isPlayingSample) {
      VoiceManager.stop();
      setIsPlayingSample(false);
      return;
    }
    
    // Stop any active playbacks
    VoiceManager.stop();
    setIsPlayingSample(true);

    const samplePhrases = {
      friendly: "Hello, I am George. Take your time during the exam. I am here to help you explain your concepts in the right direction.",
      strict: "Hello, I am Daniel. During this examination, I expect formal definitions, complete derivations, and strict precision. Let us begin.",
      brutal: "I am Adam, your external reviewer. I am here to test your limits. I want to see if you actually know what you are talking about.",
      terror: "I am Professor Thorne. Sit down. I expect first-principle, flawless breakdowns. No book-memorized answers. We start now."
    };

    const text = samplePhrases[personality] || "Hello, let us begin the examination.";
    
    VoiceManager.speak(text, personality, 
      () => setIsPlayingSample(true), 
      () => setIsPlayingSample(false)
    );
  };

  const handleProceedStep = async (nextStep) => {
    // Step 1 Validation & parsing
    if (nextStep === 2 && currentStep === 1) {
      if (sourceType === "topic") {
        if (!topic.trim()) {
          alert("Please enter a subject topic to proceed.");
          return;
        }
        
        // Expand the topic into a structured tree using Gemini!
        setIsExpandingTopic(true);
        try {
          const tree = await SyllabusParserService.expandTopicTree(topic.trim());
          setSyllabusStructure(tree);
        } catch (e) {
          console.error("Failed expanding topic tree:", e);
        } finally {
          setIsExpandingTopic(false);
        }

      } else {
        if (!syllabusUploaded && !syllabusText.trim()) {
          alert("Please upload a syllabus PDF or paste notes text to proceed.");
          return;
        }
        
        // Parse syllabus text into structured units
        const parsedTree = SyllabusParserService.parseSyllabus(
          syllabusText || "Standard Syllabus context loaded.",
          "Custom Syllabus Practice"
        );
        setSyllabusStructure(parsedTree);
      }
    }
    setCurrentStep(nextStep);
  };

  const handleFileUploadTrigger = () => {
    // Create virtual file input
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf,.txt,.md";
    input.onchange = (e) => {
      if (e.target.files.length > 0) {
        handleFileParsing(e.target.files[0]);
      }
    };
    input.click();
  };

  const handleFileParsing = async (file) => {
    setIsExtractingText(true);
    setUploadStatus(`Ingesting ${file.name}...`);
    
    try {
      const extractedText = await PDFExtractionService.extractText(file);
      
      setSyllabusText(extractedText);
      setSyllabusUploaded(true);
      setUploadStatus(`${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB) — 100% Calibrated`);
    } catch (e) {
      console.error(e);
      setUploadStatus("Error ingesting document. Click to retry.");
      alert("Failed to parse document: " + e.message);
    } finally {
      setIsExtractingText(false);
    }
  };

  // Drag and drop events
  const handleDragOver = (e) => {
    e.preventDefault();
    e.currentTarget.classList.add("dragover");
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.currentTarget.classList.remove("dragover");
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.currentTarget.classList.remove("dragover");
    if (e.dataTransfer.files.length > 0) {
      handleFileParsing(e.dataTransfer.files[0]);
    }
  };

  const selectDurationPill = (mins) => {
    setDuration(mins);
    setShowCustomDuration(false);
  };

  const triggerCustomDuration = () => {
    setDuration("custom");
    setShowCustomDuration(true);
  };

  const getActiveDuration = () => {
    if (duration === "custom") {
      const customVal = parseInt(customDurationVal);
      return isNaN(customVal) || customVal <= 0 ? 15 : customVal;
    }
    return duration;
  };

  const handleStartExam = () => {
    onBeginViva({
      sourceType,
      topic: syllabusStructure ? syllabusStructure.topic : (topic || "Custom Syllabus"),
      syllabusStructure: syllabusStructure || SyllabusParserService.getDefaultHierarchy(topic || "Thermodynamics"),
      duration: isLastMinute ? 5 : getActiveDuration(),
      personality: isMockExternal ? "terror" : personality, // Force high stress terror examiner if mock external is on!
      isLastMinute,
      isMockExternal
    });
  };

  return (
    <section id="setup-screen" className="screen active">
      <div className="setup-container">
        
        {/* Step node indicators */}
        <div className="setup-steps-header">
          <div className={`step-node ${currentStep === 1 ? "active" : currentStep > 1 ? "completed" : ""}`}>
            <div className="step-circle">1</div>
            <span className="step-label">Source</span>
          </div>
          <div className={`step-node ${currentStep === 2 ? "active" : currentStep > 2 ? "completed" : ""}`}>
            <div className="step-circle">2</div>
            <span className="step-label">Configure</span>
          </div>
          <div className={`step-node ${currentStep === 3 ? "active" : ""}`}>
            <div className="step-circle">3</div>
            <span className="step-label">Preview</span>
          </div>
        </div>

        {/* STEP 1: SELECT SOURCE */}
        {currentStep === 1 && (
          <div className="setup-step-view active">
            <div style={{ textAlign: "left", marginBottom: "var(--space-sm)" }}>
              <h2>Select Viva Source</h2>
              <p>Provide the syllabus or topic you want the AI Examiner to focus on.</p>
            </div>

            <div className="source-selection-grid">
              <div 
                className={`card source-card ${sourceType === "syllabus" ? "selected" : ""}`}
                onClick={() => setSourceType("syllabus")}
              >
                <div className="source-card-header">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                  </svg>
                  <h3>Upload Syllabus</h3>
                </div>
                <p style={{ fontSize: "0.85rem" }}>Upload custom PDF syllabus, notes, or paste table of contents.</p>
              </div>

              <div 
                className={`card source-card ${sourceType === "topic" ? "selected" : ""}`}
                onClick={() => setSourceType("topic")}
              >
                <div className="source-card-header">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="16" x2="12" y2="12"></line>
                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                  </svg>
                  <h3>Topic-Based</h3>
                </div>
                <p style={{ fontSize: "0.85rem" }}>Enter a single subject or chapter to generate an examination automatically.</p>
              </div>
            </div>

            {sourceType === "syllabus" ? (
              <div className="source-details active">
                <div className="form-group">
                  <label className="form-label">Upload Syllabus PDF / Notes / MD</label>
                  <div 
                    className={`upload-zone ${isExtractingText ? "dragover" : ""}`} 
                    onClick={handleFileUploadTrigger}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="17 8 12 3 7 8"></polyline>
                      <line x1="12" y1="3" x2="12" y2="15"></line>
                    </svg>
                    <p className="form-label" style={{ marginBottom: "2px" }}>{uploadStatus}</p>
                    <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Supports PDF, TXT, MD up to 10MB</p>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="syllabus-text">Or Paste Syllabus Text / Notes</label>
                  <textarea 
                    className="form-input" 
                    id="syllabus-text" 
                    rows="5" 
                    value={syllabusText}
                    onChange={(e) => setSyllabusText(e.target.value)}
                    placeholder="Paste Table of Contents, course outlines, or structural notes here..." 
                    style={{ resize: "vertical", minHeight: "100px", fontSize: "0.9rem" }}
                  />
                </div>
              </div>
            ) : (
              <div className="source-details active">
                <div className="form-group">
                  <label className="form-label" htmlFor="topic-input">Enter Viva Subject / Chapter</label>
                  <input 
                    className="form-input" 
                    type="text" 
                    id="topic-input" 
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g. Thermodynamics, Data Structures, Marketing Management" 
                  />
                </div>

                <div>
                  <label className="form-label">Suggested Academic Subjects</label>
                  <div className="suggestion-pills">
                    <span className="suggestion-pill" onClick={() => setTopic("Thermodynamics")}>Thermodynamics</span>
                    <span className="suggestion-pill" onClick={() => setTopic("Data Structures")}>Data Structures</span>
                    <span className="suggestion-pill" onClick={() => setTopic("Machine Design")}>Machine Design</span>
                    <span className="suggestion-pill" onClick={() => setTopic("Computer Networks")}>Computer Networks</span>
                    <span className="suggestion-pill" onClick={() => setTopic("Marketing Management")}>Marketing Management</span>
                  </div>
                </div>
              </div>
            )}

            <div className="flow-nav-buttons">
              <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
              <button className="btn btn-primary" onClick={() => handleProceedStep(2)} disabled={isExtractingText}>
                {isExpandingTopic ? "Expanding Syllabus..." : "Next: Configuration"}
                {!isExpandingTopic && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                    <polyline points="12 5 19 12 12 19"></polyline>
                  </svg>
                )}
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: CONFIGURATION */}
        {currentStep === 2 && (
          <div className="setup-step-view active">
            <div style={{ textAlign: "left", marginBottom: "var(--space-sm)" }}>
              <h2>Configure Examination Parameters</h2>
              <p>Adjust the time duration and the pedagogical personality of your examiner.</p>
            </div>

            <div className="duration-selector">
              <label className="form-label">Examination Duration</label>
              <div className="duration-pills-row">
                <button className={`btn-pill ${duration === 5 ? "active" : ""}`} onClick={() => selectDurationPill(5)}>5 Minutes</button>
                <button className={`btn-pill ${duration === 10 ? "active" : ""}`} onClick={() => selectDurationPill(10)}>10 Minutes</button>
                <button className={`btn-pill ${duration === 15 ? "active" : ""}`} onClick={() => selectDurationPill(15)}>15 Minutes</button>
                <button className={`btn-pill ${duration === 20 ? "active" : ""}`} onClick={() => selectDurationPill(20)}>20 Minutes</button>
                <button className={`btn-pill ${duration === "custom" ? "active" : ""}`} onClick={triggerCustomDuration}>Custom...</button>
              </div>

              {showCustomDuration && (
                <div className="custom-duration-input-wrapper active">
                  <input 
                    className="form-input" 
                    type="number" 
                    min="1" 
                    max="60" 
                    value={customDurationVal}
                    onChange={(e) => setCustomDurationVal(e.target.value)}
                    placeholder="15" 
                    style={{ width: "80px", textAlign: "center" }}
                  />
                  <span className="form-label">Minutes</span>
                </div>
              )}
            </div>

            {/* Hackathon differentiators - Last-Minute Mode & Mock External */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "var(--space-md)",
              marginTop: "var(--space-md)",
              marginBottom: "var(--space-md)"
            }}>
              <div 
                className={`card ${isLastMinute ? "selected" : ""}`} 
                onClick={() => setIsLastMinute(prev => !prev)}
                style={{
                  padding: "var(--space-md)",
                  border: isLastMinute ? "1px solid var(--accent-primary)" : "1px solid var(--border-color)",
                  borderRadius: "var(--radius-md)",
                  cursor: "pointer",
                  display: "flex",
                  gap: "var(--space-sm)",
                  alignItems: "flex-start",
                  backgroundColor: isLastMinute ? "var(--bg-primary)" : "var(--bg-card)",
                  transition: "var(--transition-smooth)"
                }}
              >
                <div style={{
                  width: "20px",
                  height: "20px",
                  borderRadius: "var(--radius-xs)",
                  border: "2px solid var(--accent-primary)",
                  backgroundColor: isLastMinute ? "var(--accent-primary)" : "transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  flexShrink: 0,
                  marginTop: "2px"
                }}>
                  {isLastMinute && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  )}
                </div>
                <div style={{ textAlign: "left" }}>
                  <h4 style={{ margin: "0 0 2px 0", fontSize: "0.9rem", color: "var(--accent-primary)" }}>Last-Minute Viva Mode</h4>
                  <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                    5-minute rapid-fire preparation. Ideal for last-minute cram sessions. Focuses on high-yield basic concepts.
                  </p>
                </div>
              </div>

              <div 
                className={`card ${isMockExternal ? "selected" : ""}`} 
                onClick={() => setIsMockExternal(prev => !prev)}
                style={{
                  padding: "var(--space-md)",
                  border: isMockExternal ? "1px solid var(--color-error)" : "1px solid var(--border-color)",
                  borderRadius: "var(--radius-md)",
                  cursor: "pointer",
                  display: "flex",
                  gap: "var(--space-sm)",
                  alignItems: "flex-start",
                  backgroundColor: isMockExternal ? "var(--color-error-bg)" : "var(--bg-card)",
                  transition: "var(--transition-smooth)"
                }}
              >
                <div style={{
                  width: "20px",
                  height: "20px",
                  borderRadius: "var(--radius-xs)",
                  border: isMockExternal ? "2px solid var(--color-error)" : "2px solid var(--accent-primary)",
                  backgroundColor: isMockExternal ? "var(--color-error)" : "transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  flexShrink: 0,
                  marginTop: "2px"
                }}>
                  {isMockExternal && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  )}
                </div>
                <div style={{ textAlign: "left" }}>
                  <h4 style={{ margin: "0 0 2px 0", fontSize: "0.9rem", color: "var(--color-error)" }}>Mock External Viva</h4>
                  <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                    High-stress university board review. Intimidating grading, intense questioning, and aggressive verbal interruptions.
                  </p>
                </div>
              </div>
            </div>

            <div className="form-group" style={{ marginTop: "var(--space-md)" }}>
              <label className="form-label" style={{ marginBottom: "var(--space-xs)" }}>Examiner Personality</label>
              <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "var(--space-md)" }}>
                Select who will evaluate you. Each persona carries distinct grading traits and oral behaviors.
              </p>
              
              <div className="personality-grid">
                {Object.entries(EXAMINER_PERSONALITIES).map(([key, details]) => (
                  <div 
                    className={`card personality-card ${personality === key ? "selected" : ""}`} 
                    key={key}
                    onClick={() => {
                      setPersonality(key);
                      VoiceManager.stop();
                      setIsPlayingSample(false);
                    }}
                  >
                    <div className="personality-name">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" dangerouslySetInnerHTML={{ __html: details.icon }} />
                      {details.name}
                    </div>
                    <span className="personality-desc">{details.description}</span>
                    <div className="personality-attributes">
                      <span className={`attribute-tag ${key === "friendly" ? "friendly" : key === "strict" ? "strict" : "intimidating"}`}>
                        {details.attributes.patience === "High" ? "Patient" : details.attributes.patience === "Moderate" ? "Precise" : "Intense"}
                      </span>
                      <span className={`attribute-tag ${key === "friendly" ? "friendly" : key === "strict" ? "strict" : "intimidating"}`}>
                        {key === "friendly" ? "Hints Included" : key === "strict" ? "No Hints" : key === "brutal" ? "Rapid-Fire" : "Elite Stress"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Premium Examiner Preview Card */}
              <div className="card" style={{
                marginTop: "var(--space-md)",
                padding: "var(--space-md) var(--space-lg)",
                borderLeft: `4px solid ${
                  personality === "friendly" ? "var(--color-success)" : 
                  personality === "strict" ? "var(--accent-primary)" : 
                  "var(--color-error)"
                }`,
                backgroundColor: "var(--bg-primary)",
                textAlign: "left",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}>
                <div style={{ flex: 1, marginRight: "var(--space-md)" }}>
                  <span style={{ fontSize: "0.75rem", fontWeight: "600", textTransform: "uppercase", color: "var(--text-secondary)", letterSpacing: "0.05em" }}>
                    Active Examiner Profile
                  </span>
                  <h4 style={{ margin: "4px 0", fontSize: "1.2rem", color: "var(--accent-primary)" }}>
                    {personality === "friendly" ? "Dr. George Abernathy" :
                     personality === "strict" ? "Dr. Daniel Sterling" :
                     personality === "brutal" ? "Dr. Adam Vance" :
                     "Professor Harry Thorne"}
                  </h4>
                  <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                    {personality === "friendly" ? "A highly supportive educator known for conceptual guiding, patient pauses, and constructive evaluations." :
                     personality === "strict" ? "An exacting formal academic focusing on flawless precision, mathematical derivations, and technical accuracy." :
                     personality === "brutal" ? "An external industry reviewer focused on skepticism, pressure loading, and testing boundaries." :
                     "A legendary exam terror designed to simulate high-stress viva environments with sudden logical challenges."}
                  </p>
                </div>
                <button 
                  type="button"
                  className="btn btn-secondary" 
                  onClick={handlePlaySampleVoice}
                  style={{
                    padding: "8px 16px",
                    fontSize: "0.85rem",
                    fontWeight: "600",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    cursor: "pointer",
                    whiteSpace: "nowrap"
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                  </svg>
                  {isPlayingSample ? "Speaking..." : "Play Voice Sample"}
                </button>
              </div>
            </div>

            <div className="flow-nav-buttons">
              <button className="btn btn-secondary" onClick={() => handleProceedStep(1)}>Back</button>
              <button className="btn btn-primary" onClick={() => handleProceedStep(3)}>
                Next: Preview Screen
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: PREVIEW */}
        {currentStep === 3 && (
          <div className="setup-step-view active">
            <div style={{ textAlign: "left", marginBottom: "var(--space-sm)" }}>
              <h2>Review Exam Structure</h2>
              <p>Verify the structured course syllabus mapped dynamically by the intelligence engine.</p>
            </div>

            <div className="card preview-summary-card">
              <div style={{ textAlign: "left" }}>
                <h3 style={{ fontSize: "1.4rem", color: "var(--accent-primary)", marginBottom: "2px" }}>
                  {syllabusStructure ? syllabusStructure.topic : "Custom Examination"} Mapped Outline
                </h3>
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                  Syllabus Units extracted successfully:
                </p>
              </div>

              {/* Dynamic Units Accordion view */}
              <div className="preview-grid" style={{ gridTemplateColumns: "1fr", gap: "var(--space-md)", textAlign: "left", borderBottom: "1px solid var(--border-color)", paddingBottom: "var(--space-md)" }}>
                {syllabusStructure && syllabusStructure.units.map((u, idx) => (
                  <div key={idx} style={{ padding: "var(--space-sm) var(--space-md)", border: "1px solid var(--border-color)", borderRadius: "var(--radius-sm)", backgroundColor: "var(--bg-primary)" }}>
                    <strong style={{ fontSize: "0.9rem", color: "var(--accent-primary)" }}>{u.name}</strong>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "6px" }}>
                      {u.topics.map((t, tid) => (
                        <span key={tid} style={{ fontSize: "0.75rem", padding: "2px 8px", backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "var(--radius-full)" }}>{t}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="preview-grid" style={{ marginTop: "var(--space-xs)" }}>
                <div className="preview-item">
                  <span className="preview-label">Examiner Persona</span>
                  <div className="preview-personality-details">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: "20px", height: "20px", color: "var(--accent-primary)" }} dangerouslySetInnerHTML={{ __html: EXAMINER_PERSONALITIES[personality].icon }} />
                    <span className="preview-value">{EXAMINER_PERSONALITIES[personality].name}</span>
                  </div>
                </div>

                <div className="preview-item">
                  <span className="preview-label">Session Duration</span>
                  <span className="preview-value">{getActiveDuration()} Minutes</span>
                </div>

                <div className="preview-item">
                  <span className="preview-label">Exam Questions</span>
                  <span className="preview-value">4 Branching Stages</span>
                </div>

                <div className="preview-item">
                  <span className="preview-label">Anti-Hallucination</span>
                  <span className="preview-value" style={{ color: "var(--color-success)" }}>100% Enforced</span>
                </div>
              </div>

              <button 
                className="btn btn-primary" 
                onClick={handleStartExam}
                style={{ width: "100%", padding: "var(--space-md)", fontSize: "1.1rem", marginTop: "var(--space-md)" }}
              >
                Begin Viva
              </button>
            </div>

            <div className="flow-nav-buttons">
              <button className="btn btn-secondary" onClick={() => handleProceedStep(2)}>Back</button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
