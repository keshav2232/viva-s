"use client";

import React, { useState, useEffect } from "react";
import { EXAMINER_PERSONALITIES } from "@/utils/mockData";
import { PDFExtractionService } from "@/services/PDFExtractionService";
import { SyllabusParserService } from "@/services/SyllabusParserService";
import { VoiceManager } from "@/services/voiceManager";
import ExaminerAvatar from "@/components/ExaminerAvatar";

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

  // Target Drill & Mind Map States
  const [selectedSubtopic, setSelectedSubtopic] = useState(null);
  const [previewMode, setPreviewMode] = useState("map"); // "map" | "list"
  const [hoveredSubtopic, setHoveredSubtopic] = useState(null);

  // Quick Cram Flashcards States
  const [cramMode, setCramMode] = useState(false);
  const [flashcards, setFlashcards] = useState([]);
  const [currentCardIdx, setCurrentCardIdx] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isLoadingFlashcards, setIsLoadingFlashcards] = useState(false);
  const [masteredCards, setMasteredCards] = useState({});

  const handleStartCramMode = async () => {
    setCramMode(true);
    setIsLoadingFlashcards(true);
    setCurrentCardIdx(0);
    setIsFlipped(false);
    
    try {
      const response = await fetch("/api/viva", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate-flashcards",
          syllabusStructure: syllabusStructure || SyllabusParserService.getDefaultHierarchy(topic || "Thermodynamics")
        })
      });
      if (!response.ok) throw new Error("Failed fetching flashcards");
      const data = await response.json();
      setFlashcards(data);
    } catch (e) {
      console.error("Flashcards load error:", e);
      alert("Failed to generate study flashcards. Please try again.");
    } finally {
      setIsLoadingFlashcards(false);
    }
  };

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
        
        // Expand the custom syllabus text into a structured tree using Gemini!
        setIsExpandingTopic(true);
        try {
          const parsedTree = await SyllabusParserService.parseSyllabusRemote(
            syllabusText.trim()
          );
          setSyllabusStructure(parsedTree);
        } catch (e) {
          console.warn("Syllabus remote parsing error, falling back to local heuristic:", e);
          const parsedTree = SyllabusParserService.parseSyllabus(
            syllabusText || "Standard Syllabus context loaded.",
            "Custom Syllabus Practice"
          );
          setSyllabusStructure(parsedTree);
        } finally {
          setIsExpandingTopic(false);
        }
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
      isMockExternal,
      isTargetDrill: !!selectedSubtopic,
      targetSubtopic: selectedSubtopic ? selectedSubtopic.name : null
    });
  };

  const getMindMapNodes = () => {
    if (!syllabusStructure) return { nodes: [], links: [] };

    const nodes = [];
    const links = [];

    // 1. Subject Node
    const subjectX = 75;
    const subjectY = 170;
    nodes.push({
      id: "subject",
      type: "subject",
      name: syllabusStructure.topic,
      x: subjectX,
      y: subjectY
    });

    const totalUnits = syllabusStructure.units.length; // usually 3
    syllabusStructure.units.forEach((u, uIdx) => {
      // 2. Unit Node
      const unitX = 250;
      const unitY = totalUnits === 3 
        ? [65, 170, 275][uIdx] 
        : (uIdx + 1) * (340 / (totalUnits + 1));
        
      const unitId = `unit_${uIdx}`;
      
      nodes.push({
        id: unitId,
        type: "unit",
        name: u.name,
        x: unitX,
        y: unitY,
        unitIndex: uIdx
      });

      links.push({
        source: "subject",
        target: unitId,
        x1: subjectX + 68, // offset from center node edge
        y1: subjectY,
        x2: unitX - 70,
        y2: unitY
      });

      // 3. Subtopics
      const totalTopics = u.topics.length;
      u.topics.forEach((t, tIdx) => {
        const topicX = 470;
        
        // Spacing calculations
        let topicY = unitY;
        if (totalTopics > 0) {
          const delta = 35; // vertical gap between topics
          const startY = unitY - ((totalTopics - 1) * delta) / 2;
          topicY = startY + tIdx * delta;
        }

        const topicId = `topic_${uIdx}_${tIdx}`;
        
        nodes.push({
          id: topicId,
          type: "subtopic",
          name: t,
          x: topicX,
          y: topicY,
          unitIndex: uIdx,
          topicIndex: tIdx
        });

        links.push({
          source: unitId,
          target: topicId,
          x1: unitX + 70,
          y1: unitY,
          x2: topicX - 75,
          y2: topicY
        });
      });
    });

    return { nodes, links };
  };

  if (cramMode) {
    return (
      <section id="setup-screen" className="screen active" style={{ maxWidth: "600px", margin: "0 auto" }}>
        <div className="card" style={{ padding: "var(--space-lg)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-md)", borderBottom: "1px solid var(--border-color)", paddingBottom: "var(--space-sm)" }}>
            <div style={{ textAlign: "left" }}>
              <h2 style={{ fontSize: "1.25rem", fontWeight: "800", color: "var(--accent-primary)", margin: 0 }}>⚡ Quick Cram Mode</h2>
              <p style={{ margin: "2px 0 0 0", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                Study key concepts for <strong>{syllabusStructure?.topic || topic || "Custom Subject"}</strong>
              </p>
            </div>
            <button 
              className="btn btn-secondary" 
              onClick={() => setCramMode(false)}
              style={{ padding: "6px 12px", fontSize: "0.8rem" }}
            >
              Exit Cram
            </button>
          </div>

          {isLoadingFlashcards ? (
            <div style={{ padding: "60px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-md)" }}>
              <svg className="animate-spin" style={{ width: "32px", height: "32px", color: "var(--accent-primary)" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" style={{ opacity: 0.15 }}></circle>
                <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: "600" }}>AI is compiling study flashcards...</span>
            </div>
          ) : flashcards.length > 0 ? (
            <div className="flashcards-screen-container">
              {/* Card deck counter */}
              <div style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.82rem", color: "var(--text-secondary)", fontWeight: "600" }}>
                <span>Card {currentCardIdx + 1} of {flashcards.length}</span>
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

              {/* 3D Flip Card Container */}
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

              {/* Navigation and Actions */}
              <div className="flashcards-nav-row">
                <button 
                  className="btn btn-secondary" 
                  disabled={currentCardIdx === 0}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsFlipped(false);
                    setTimeout(() => {
                      setCurrentCardIdx(prev => prev - 1);
                    }, 150);
                  }}
                  style={{ padding: "8px 16px", minWidth: "90px" }}
                >
                  Previous
                </button>

                <div className="flashcard-mastery-buttons">
                  <button 
                    className="btn btn-secondary btn-mastery-review"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMasteredCards(prev => ({ ...prev, [currentCardIdx]: false }));
                      if (currentCardIdx < flashcards.length - 1) {
                        setTimeout(() => {
                          setIsFlipped(false);
                          setTimeout(() => setCurrentCardIdx(p => p + 1), 150);
                        }, 400);
                      }
                    }}
                    style={{ padding: "8px 14px", fontSize: "0.8rem", fontWeight: "600" }}
                  >
                    Need Review
                  </button>
                  <button 
                    className="btn btn-secondary btn-mastery-mastered"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMasteredCards(prev => ({ ...prev, [currentCardIdx]: true }));
                      if (currentCardIdx < flashcards.length - 1) {
                        setTimeout(() => {
                          setIsFlipped(false);
                          setTimeout(() => setCurrentCardIdx(p => p + 1), 150);
                        }, 400);
                      }
                    }}
                    style={{ padding: "8px 14px", fontSize: "0.8rem", fontWeight: "600" }}
                  >
                    Mastered ✓
                  </button>
                </div>

                <button 
                  className="btn btn-secondary" 
                  disabled={currentCardIdx === flashcards.length - 1}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsFlipped(false);
                    setTimeout(() => {
                      setCurrentCardIdx(prev => prev + 1);
                    }, 150);
                  }}
                  style={{ padding: "8px 16px", minWidth: "90px" }}
                >
                  Next
                </button>
              </div>

              {/* Start Viva directly from flashcards */}
              <button 
                type="button"
                className="btn btn-primary"
                onClick={handleStartExam}
                style={{ width: "100%", padding: "12px", fontSize: "1.02rem", marginTop: "var(--space-md)", background: "linear-gradient(135deg, var(--accent-primary) 0%, #4f46e5 100%)", fontWeight: "700", boxShadow: "0 4px 14px rgba(99, 102, 241, 0.3)" }}
              >
                Ready: Launch High-Pressure Viva Now
              </button>
            </div>
          ) : (
            <p style={{ color: "var(--text-secondary)", padding: "20px 0" }}>No study cards available.</p>
          )}
        </div>
      </section>
    );
  }

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
              <div className="card examiner-preview-card" style={{
                marginTop: "var(--space-md)",
                padding: "var(--space-md) var(--space-lg)",
                borderLeft: `4px solid ${
                  personality === "friendly" ? "var(--color-success)" : 
                  personality === "strict" ? "var(--accent-primary)" : 
                  "var(--color-error)"
                }`,
                backgroundColor: "var(--bg-primary)",
                textAlign: "left",
                width: "100%"
              }}>
                {/* Visual Avatar Frame */}
                <div style={{
                  width: "64px",
                  height: "64px",
                  borderRadius: "var(--radius-full)",
                  overflow: "hidden",
                  flexShrink: 0,
                  boxShadow: "var(--shadow-sm)",
                  border: "1px solid var(--border-color)",
                  backgroundColor: "var(--bg-card)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}>
                  <ExaminerAvatar 
                    personality={personality} 
                    vivaState={isPlayingSample ? "speaking" : "default"} 
                  />
                </div>

                {/* Profile text */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: "0.75rem", fontWeight: "600", textTransform: "uppercase", color: "var(--text-secondary)", letterSpacing: "0.05em" }}>
                    Active Examiner Profile
                  </span>
                  <h4 style={{ margin: "4px 0", fontSize: "1.2rem", color: "var(--accent-primary)" }}>
                    {personality === "friendly" ? "Dr. George Abernathy" :
                     personality === "strict" ? "Dr. Daniel Sterling" :
                     personality === "brutal" ? "Dr. Adam Vance" :
                     "Professor Harry Thorne"}
                  </h4>
                  <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.4 }}>
                    {personality === "friendly" ? "A highly supportive educator known for conceptual guiding, patient pauses, and constructive evaluations." :
                     personality === "strict" ? "An exacting formal academic focusing on flawless precision, mathematical derivations, and technical accuracy." :
                     personality === "brutal" ? "An external industry reviewer focused on skepticism, pressure loading, and testing boundaries." :
                     "A legendary exam terror designed to simulate high-stress viva environments with sudden logical challenges."}
                  </p>
                </div>

                {/* Sample voice button */}
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
                    whiteSpace: "nowrap",
                    flexShrink: 0
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

            <div className="card preview-summary-card" style={{ padding: "var(--space-md) var(--space-lg)" }}>
              {/* Header inside Preview */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-color)", paddingBottom: "12px", marginBottom: "16px" }}>
                <div style={{ textAlign: "left" }}>
                  <h3 style={{ fontSize: "1.25rem", color: "var(--accent-primary)", margin: 0, fontWeight: "700" }}>
                    {syllabusStructure ? syllabusStructure.topic : "Custom Examination"} Mapped Outline
                  </h3>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", margin: "2px 0 0 0" }}>
                    Select a subtopic leaf node to launch a highly focused Custom Target Drill.
                  </p>
                </div>
                
                {/* View Toggles */}
                <div className="no-print" style={{ display: "flex", gap: "6px", backgroundColor: "var(--bg-primary)", padding: "4px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)" }}>
                  <button 
                    type="button"
                    className={`btn ${previewMode === "map" ? "btn-primary" : "btn-secondary"}`}
                    onClick={() => setPreviewMode("map")}
                    style={{ padding: "6px 12px", fontSize: "0.75rem", borderRadius: "var(--radius-xs)" }}
                  >
                    Mind Map
                  </button>
                  <button 
                    type="button"
                    className={`btn ${previewMode === "list" ? "btn-primary" : "btn-secondary"}`}
                    onClick={() => setPreviewMode("list")}
                    style={{ padding: "6px 12px", fontSize: "0.75rem", borderRadius: "var(--radius-xs)" }}
                  >
                    Outline List
                  </button>
                </div>
              </div>

              {previewMode === "map" ? (
                /* INTERACTIVE MIND MAP SVG */
                <div className="mindmap-container-canvas" style={{ position: "relative", overflowX: "auto", border: "1px solid var(--border-color)", borderRadius: "var(--radius-md)", backgroundColor: "var(--bg-primary)", padding: "10px 0" }}>
                  <svg width="640" height="340" viewBox="0 0 640 340" style={{ display: "block", margin: "0 auto" }}>
                    {/* SVG Filters for glowing drop-shadows */}
                    <defs>
                      <filter id="gold-glow" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="5" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                      </filter>
                    </defs>
                    
                    {/* CONNECTOR PATHS */}
                    {getMindMapNodes().links.map((link, idx) => {
                      const isHoveredOrSelected = 
                        (hoveredSubtopic && (link.target === hoveredSubtopic || link.source === hoveredSubtopic)) ||
                        (selectedSubtopic && (link.target === `topic_${selectedSubtopic.unitIndex}_${selectedSubtopic.topicIndex}` || link.source === `topic_${selectedSubtopic.unitIndex}_${selectedSubtopic.topicIndex}`));
                      
                      return (
                        <path
                          key={`link_${idx}`}
                          d={`M ${link.x1} ${link.y1} C ${(link.x1 + link.x2) / 2} ${link.y1}, ${(link.x1 + link.x2) / 2} ${link.y2}, ${link.x2} ${link.y2}`}
                          fill="none"
                          stroke={isHoveredOrSelected ? "var(--color-warning)" : "var(--border-color)"}
                          strokeWidth={isHoveredOrSelected ? "2.5" : "1.25"}
                          strokeDasharray={isHoveredOrSelected ? "none" : "3,3"}
                          style={{ transition: "stroke 0.25s, stroke-width 0.25s" }}
                        />
                      );
                    })}

                    {/* NODE PILLS */}
                    {getMindMapNodes().nodes.map((node) => {
                      const isSelected = selectedSubtopic && node.type === "subtopic" && selectedSubtopic.unitIndex === node.unitIndex && selectedSubtopic.topicIndex === node.topicIndex;
                      
                      let width = 140;
                      let height = 46;
                      if (node.type === "subject") {
                        width = 135;
                        height = 54;
                      } else if (node.type === "subtopic") {
                        width = 150;
                        height = 32;
                      }

                      return (
                        <foreignObject
                          key={node.id}
                          x={node.x - width / 2}
                          y={node.y - height / 2}
                          width={width}
                          height={height}
                        >
                          <div
                            onClick={() => {
                              if (node.type === "subtopic") {
                                if (isSelected) {
                                  setSelectedSubtopic(null);
                                } else {
                                  setSelectedSubtopic({
                                    unitIndex: node.unitIndex,
                                    topicIndex: node.topicIndex,
                                    name: node.name
                                  });
                                }
                              }
                            }}
                            onMouseEnter={() => {
                              if (node.type === "subtopic") {
                                setHoveredSubtopic(node.id);
                              }
                            }}
                            onMouseLeave={() => {
                              setHoveredSubtopic(null);
                            }}
                            style={{
                              width: "100%",
                              height: "100%",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              textAlign: "center",
                              padding: "4px 8px",
                              fontSize: node.type === "subject" ? "0.775rem" : "0.725rem",
                              fontWeight: node.type === "subject" ? "800" : "600",
                              lineHeight: "1.2",
                              borderRadius: "var(--radius-sm)",
                              cursor: node.type === "subtopic" ? "pointer" : "default",
                              transition: "var(--transition-smooth)",
                              
                              // Backgrounds & borders
                              backgroundColor: node.type === "subject" 
                                ? "var(--accent-primary)" 
                                : node.type === "unit" 
                                  ? "var(--bg-card)" 
                                  : isSelected 
                                    ? "var(--color-warning-bg)" 
                                    : "var(--bg-card)",
                              color: node.type === "subject" 
                                ? "white" 
                                : node.type === "unit" 
                                  ? "var(--accent-primary)" 
                                  : isSelected 
                                    ? "var(--color-warning)" 
                                    : "var(--text-primary)",
                              border: node.type === "subject"
                                ? "1px solid var(--accent-primary)"
                                : node.type === "unit"
                                  ? "1.5px solid var(--accent-primary)"
                                  : isSelected
                                    ? "2px solid var(--color-warning)"
                                    : "1px solid var(--border-color)",
                              boxShadow: isSelected
                                ? "0 0 10px rgba(161, 107, 21, 0.35)"
                                : "var(--shadow-subtle)",
                              userSelect: "none"
                            }}
                            className={node.type === "subtopic" ? "mindmap-interactive-subtopic" : ""}
                          >
                            {node.type === "unit" ? (
                              <div style={{ fontSize: "0.68rem" }}>
                                <strong>Unit #{node.unitIndex + 1}</strong>
                                <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "120px" }}>{node.name.replace(/^unit\s*\d+\s*:\s*/i, "")}</div>
                              </div>
                            ) : (
                              node.name
                            )}
                          </div>
                        </foreignObject>
                      );
                    })}
                  </svg>
                </div>
              ) : (
                /* ACCORDION OUTLINE LIST FALLBACK */
                <div className="preview-grid" style={{ gridTemplateColumns: "1fr", gap: "var(--space-md)", textAlign: "left", borderBottom: "1px solid var(--border-color)", paddingBottom: "var(--space-md)" }}>
                  {syllabusStructure && syllabusStructure.units.map((u, idx) => (
                    <div key={idx} style={{ padding: "var(--space-sm) var(--space-md)", border: "1px solid var(--border-color)", borderRadius: "var(--radius-sm)", backgroundColor: "var(--bg-primary)" }}>
                      <strong style={{ fontSize: "0.9rem", color: "var(--accent-primary)" }}>{u.name}</strong>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "6px" }}>
                        {u.topics.map((t, tid) => {
                          const isSel = selectedSubtopic && selectedSubtopic.unitIndex === idx && selectedSubtopic.topicIndex === tid;
                          return (
                            <span 
                              key={tid} 
                              onClick={() => {
                                if (isSel) setSelectedSubtopic(null);
                                else setSelectedSubtopic({ unitIndex: idx, topicIndex: tid, name: t });
                              }}
                              style={{ 
                                fontSize: "0.75rem", 
                                padding: "4px 10px", 
                                backgroundColor: isSel ? "var(--color-warning-bg)" : "var(--bg-card)", 
                                border: isSel ? "2.5px solid var(--color-warning)" : "1px solid var(--border-color)", 
                                color: isSel ? "var(--color-warning)" : "var(--text-primary)",
                                borderRadius: "var(--radius-full)",
                                cursor: "pointer",
                                transition: "var(--transition-smooth)",
                                fontWeight: isSel ? "700" : "500"
                              }}
                            >
                              {t}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* TARGET DRILL NOTIFICATION AND DETAILS */}
              <div style={{ marginTop: "12px", padding: "10px 14px", borderRadius: "var(--radius-sm)", backgroundColor: "var(--bg-primary)", border: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ textAlign: "left" }}>
                  {selectedSubtopic ? (
                    <>
                      <div style={{ fontSize: "0.85rem", fontWeight: "700", color: "var(--color-warning)", display: "flex", alignItems: "center", gap: "4px" }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: "16px", height: "16px" }}>
                          <circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 4.24 4.24M14.83 9.17l4.24-4.24M14.83 14.83l4.24 4.24M9.17 14.83l-4.24 4.24"/>
                        </svg>
                        Focus Target Drill Engaged
                      </div>
                      <p style={{ margin: "2px 0 0 0", fontSize: "0.775rem", color: "var(--text-secondary)" }}>
                        Practice session will center strictly on <strong>&quot;{selectedSubtopic.name}&quot;</strong> (Unit #{selectedSubtopic.unitIndex + 1}).
                      </p>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: "0.85rem", fontWeight: "700", color: "var(--color-success)", display: "flex", alignItems: "center", gap: "4px" }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: "16px", height: "16px" }}>
                          <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/>
                        </svg>
                        Comprehensive Oral Mode
                      </div>
                      <p style={{ margin: "2px 0 0 0", fontSize: "0.775rem", color: "var(--text-secondary)" }}>
                        Questions will cover all topics mapped throughout the curriculum syllabus.
                      </p>
                    </>
                  )}
                </div>
                {selectedSubtopic && (
                  <button 
                    type="button" 
                    className="btn-text" 
                    onClick={() => setSelectedSubtopic(null)}
                    style={{ fontSize: "0.75rem", color: "var(--color-error)", cursor: "pointer", border: "none", background: "none", fontWeight: "600" }}
                  >
                    Clear Focus
                  </button>
                )}
              </div>

              {/* STATS PREVIEW GRID */}
              <div className="preview-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "10px", marginTop: "12px", borderTop: "1px solid var(--border-color)", paddingTop: "12px" }}>
                <div className="preview-item" style={{ padding: "6px" }}>
                  <span className="preview-label">Examiner</span>
                  <div className="preview-personality-details" style={{ justifyContent: "center", gap: "4px" }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: "14px", height: "14px" }} dangerouslySetInnerHTML={{ __html: EXAMINER_PERSONALITIES[personality].icon }} />
                    <span className="preview-value" style={{ fontSize: "0.8rem" }}>{EXAMINER_PERSONALITIES[personality].name}</span>
                  </div>
                </div>

                <div className="preview-item" style={{ padding: "6px" }}>
                  <span className="preview-label">Duration</span>
                  <span className="preview-value" style={{ fontSize: "0.8rem" }}>{selectedSubtopic ? "5 Mins (Speed)" : `${getActiveDuration()} Mins`}</span>
                </div>

                <div className="preview-item" style={{ padding: "6px" }}>
                  <span className="preview-label">Scope</span>
                  <span className="preview-value" style={{ fontSize: "0.8rem" }}>{selectedSubtopic ? "1 Concept" : "3 Units"}</span>
                </div>

                <div className="preview-item" style={{ padding: "6px" }}>
                  <span className="preview-label">Pedagogical Guard</span>
                  <span className="preview-value" style={{ fontSize: "0.8rem", color: "var(--color-success)" }}>Active</span>
                </div>
              </div>

              <button 
                type="button"
                className="btn btn-primary" 
                onClick={handleStartExam}
                style={{ width: "100%", padding: "12px", fontSize: "1.05rem", marginTop: "16px", background: selectedSubtopic ? "linear-gradient(135deg, var(--color-warning), hsl(38, 85%, 35%))" : "var(--accent-primary)" }}
              >
                {selectedSubtopic ? `Begin Target Drill: ${selectedSubtopic.name}` : "Begin Mapped Viva"}
              </button>

              <button 
                type="button"
                className="btn btn-secondary" 
                onClick={handleStartCramMode}
                style={{ width: "100%", padding: "12px", fontSize: "1.05rem", marginTop: "8px", borderColor: "var(--color-warning)", color: "var(--color-warning)", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                </svg>
                ⚡ Quick Cram: Study Flashcards
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
