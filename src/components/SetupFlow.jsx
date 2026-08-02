"use client";

import React, { useState, useEffect } from "react";
import { EXAMINER_PERSONALITIES } from "@/utils/mockData";
import { PDFExtractionService } from "@/services/PDFExtractionService";
import { SyllabusParserService } from "@/services/SyllabusParserService";
import { VoiceManager } from "@/services/voiceManager";
import ExaminerAvatar from "@/components/ExaminerAvatar";
import FlashcardDeck from "./FlashcardDeck";
import SyllabusMindMap from "./SyllabusMindMap";

export default function SetupFlow({ onCancel, onBeginViva, initialSelectedSubtopic }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [practiceMode, setPracticeMode] = useState("academic"); // "academic" | "professional"
  const [sourceType, setSourceType] = useState("syllabus"); // "syllabus" | "topic"
  
  // Input fields
  const [topic, setTopic] = useState("");
  const [syllabusText, setSyllabusText] = useState("");
  
  // File Upload states
  const [syllabusUploaded, setSyllabusUploaded] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("Drag & drop syllabus PDF/TXT here or click to browse");
  const [isExtractingText, setIsExtractingText] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  
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
  const [showDetailsKey, setShowDetailsKey] = useState(null);

  // Hackathon differentiator toggles
  const [isLastMinute, setIsLastMinute] = useState(false);
  const [isMockExternal, setIsMockExternal] = useState(false);
  const [enableInterruption, setEnableInterruption] = useState(false);
  const [enablePanelMode, setEnablePanelMode] = useState(false);

  // Target Drill & Mind Map States
  const [selectedSubtopic, setSelectedSubtopic] = useState(null);
  const [previewMode, setPreviewMode] = useState("map"); // "map" | "list"

  // Quick Cram Flashcards States
  const [cramMode, setCramMode] = useState(false);
  const [flashcards, setFlashcards] = useState([]);
  const [isLoadingFlashcards, setIsLoadingFlashcards] = useState(false);

  const handleStartCramMode = async () => {
    setCramMode(true);
    setIsLoadingFlashcards(true);
    
    try {
      const response = await fetch("/api/viva", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate-flashcards",
          syllabusStructure: syllabusStructure || SyllabusParserService.getDefaultHierarchy(topic || "Thermodynamics", getActiveDuration())
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

  // Sync initial subtopic drill target if coming from results page
  useEffect(() => {
    if (initialSelectedSubtopic) {
      const { subjectName, mode } = initialSelectedSubtopic;
      setPracticeMode(mode || "academic");
      setTopic(subjectName || "");
      setSelectedSubtopic({
        name: initialSelectedSubtopic.name,
        unitIndex: initialSelectedSubtopic.unitIndex,
        topicIndex: initialSelectedSubtopic.topicIndex
      });
      // Skip directly to Step 2 (Syllabus Mind Map Preview)
      setCurrentStep(2);
      
      const struct = SyllabusParserService.getDefaultHierarchy(
        subjectName || "Thermodynamics",
        duration
      );
      setSyllabusStructure(struct);
    }
  }, [initialSelectedSubtopic]);

  const handlePlaySampleVoice = () => {
    if (isPlayingSample) {
      VoiceManager.stop();
      setIsPlayingSample(false);
      return;
    }
    
    // Stop any active playbacks
    VoiceManager.stop();
    setIsPlayingSample(true);

    const samplePhrases = practiceMode === "academic" ? {
      friendly: "Hello, I am George. Take your time during the exam. I am here to help you explain your concepts in the right direction.",
      strict: "Hello, I am Daniel. During this examination, I expect formal definitions, complete derivations, and strict precision. Let us begin.",
      brutal: "I am Adam, your external reviewer. I am here to test your limits. I want to see if you actually know what you are talking about.",
      terror: "I am Professor Thorne. Sit down. I expect first-principle, flawless breakdowns. No book-memorized answers. We start now."
    } : {
      friendly: "Hello, I'm George. Thanks for joining us today. We'll start with a few warm-up questions about your experience. Take your time.",
      strict: "Hello, I'm Daniel. In this session, I will evaluate your technical competencies, design trade-offs, and system architecture choices. Let's start.",
      brutal: "I'm Adam. I want to dig deep into your past projects. I expect concrete STAR-formatted details and real architectural choices.",
      terror: "I'm Thorne, the bar raiser for this panel. I'll be assessing how you handle high-pressure trade-offs and logical edge cases. We'll begin immediately."
    };

    const text = samplePhrases[personality] || (practiceMode === "academic" ? "Hello, let us begin the examination." : "Hello, let's begin the interview.");
    
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
          alert(practiceMode === "academic" ? "Please enter a subject topic to proceed." : "Please enter a job role to proceed.");
          return;
        }
        
        // Expand the topic into a structured tree using Gemini!
        setIsExpandingTopic(true);
        try {
          const tree = await SyllabusParserService.expandTopicTree(topic.trim(), practiceMode, getActiveDuration());
          setSyllabusStructure(tree);
        } catch (e) {
          console.error("Failed expanding topic tree:", e);
        } finally {
          setIsExpandingTopic(false);
        }

      } else {
        if (!syllabusUploaded && !syllabusText.trim()) {
          alert(practiceMode === "academic" ? "Please upload a syllabus PDF or paste notes text to proceed." : "Please upload a job description PDF or paste its text to proceed.");
          return;
        }
        
        // Expand the custom syllabus text into a structured tree using Gemini!
        setIsExpandingTopic(true);
        try {
          const parsedTree = await SyllabusParserService.parseSyllabusRemote(
            syllabusText.trim(),
            practiceMode,
            getActiveDuration()
          );
          setSyllabusStructure(parsedTree);
        } catch (e) {
          console.warn("Syllabus remote parsing error, falling back to local heuristic:", e);
          const parsedTree = SyllabusParserService.parseSyllabus(
            syllabusText || (practiceMode === "academic" ? "Standard Syllabus context loaded." : "Standard Job Description context loaded."),
            practiceMode === "academic" ? "Custom Syllabus Practice" : "Custom Job Role Practice",
            getActiveDuration()
          );
          setSyllabusStructure(parsedTree);
        } finally {
          setIsExpandingTopic(false);
        }
      }
    }

    // Step 2 to Step 3 Transition: Scale syllabus units if duration changed
    if (nextStep === 3 && currentStep === 2) {
      const targetUnits = SyllabusParserService.getTargetUnitsForDuration(getActiveDuration());
      const currentUnits = syllabusStructure ? syllabusStructure.units.length : 0;

      if (currentUnits !== targetUnits) {
        setIsExpandingTopic(true);
        try {
          if (sourceType === "topic") {
            const tree = await SyllabusParserService.expandTopicTree(topic.trim(), practiceMode, getActiveDuration());
            setSyllabusStructure(tree);
          } else {
            const parsedTree = await SyllabusParserService.parseSyllabusRemote(
              syllabusText.trim(),
              practiceMode,
              getActiveDuration()
            );
            setSyllabusStructure(parsedTree);
          }
        } catch (e) {
          console.warn("Failed scaling syllabus for new duration, using fallback:", e);
          const parsedTree = SyllabusParserService.parseSyllabus(
            syllabusText || (practiceMode === "academic" ? "Standard Syllabus context loaded." : "Standard Job Description context loaded."),
            practiceMode === "academic" ? "Custom Syllabus Practice" : "Custom Job Role Practice",
            getActiveDuration()
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
    input.multiple = true;
    input.onchange = (e) => {
      if (e.target.files.length > 0) {
        handleFileParsing(e.target.files);
      }
    };
    input.click();
  };

  const handleFileParsing = async (files) => {
    setIsExtractingText(true);
    setUploadStatus(`Ingesting documents...`);
    
    const newFiles = [...uploadedFiles];
    let errors = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      // Avoid duplicates
      if (newFiles.some(f => f.name === file.name && f.size === file.size)) {
        continue;
      }
      try {
        const extractedText = await PDFExtractionService.extractText(file);
        newFiles.push({
          name: file.name,
          size: file.size,
          text: extractedText
        });
      } catch (e) {
        console.error(e);
        errors.push(`${file.name}: ${e.message}`);
      }
    }
    
    setUploadedFiles(newFiles);
    
    if (newFiles.length > 0) {
      setSyllabusUploaded(true);
      const combinedText = newFiles.map(f => `--- ${f.name} ---\n${f.text}`).join("\n\n");
      setSyllabusText(combinedText);
      setUploadStatus(`${newFiles.length} file(s) uploaded successfully`);
    } else {
      setSyllabusUploaded(false);
      setSyllabusText("");
      setUploadStatus("Drag & drop syllabus PDF/TXT here or click to browse");
    }
    
    if (errors.length > 0) {
      alert("Errors occurred while parsing some files:\n" + errors.join("\n"));
    }
    setIsExtractingText(false);
  };

  const handleRemoveFile = (indexToRemove) => {
    const updated = uploadedFiles.filter((_, idx) => idx !== indexToRemove);
    setUploadedFiles(updated);
    if (updated.length > 0) {
      const combinedText = updated.map(f => `--- ${f.name} ---\n${f.text}`).join("\n\n");
      setSyllabusText(combinedText);
      setUploadStatus(`${updated.length} file(s) uploaded successfully`);
    } else {
      setSyllabusUploaded(false);
      setSyllabusText("");
      setUploadStatus("Drag & drop syllabus PDF/TXT here or click to browse");
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
      handleFileParsing(e.dataTransfer.files);
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
      topic: syllabusStructure ? syllabusStructure.topic : (topic || (practiceMode === "academic" ? "Custom Syllabus" : "Custom Job Role")),
      syllabusStructure: syllabusStructure || SyllabusParserService.getDefaultHierarchy(topic || (practiceMode === "academic" ? "Thermodynamics" : "Software Engineer (Backend)"), isLastMinute ? 5 : getActiveDuration()),
      duration: isLastMinute ? 5 : getActiveDuration(),
      personality: isMockExternal ? "terror" : personality, // Force high stress terror examiner if mock external is on!
      isLastMinute,
      isMockExternal,
      isTargetDrill: !!selectedSubtopic,
      targetSubtopic: selectedSubtopic ? selectedSubtopic.name : null,
      enableInterruption,
      enablePanelMode,
      mode: practiceMode
    });
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
            <FlashcardDeck
              flashcards={flashcards}
              onStartViva={handleStartExam}
              onClose={() => setCramMode(false)}
            />
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
            {/* GOAL SELECTOR TOGGLE */}
            <div className="goal-selector-toggle" style={{
              display: "flex",
              backgroundColor: "var(--bg-primary)",
              padding: "4px",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-color)",
              marginBottom: "var(--space-md)",
              gap: "4px"
            }}>
              <button
                type="button"
                className={`btn ${practiceMode === "academic" ? "btn-primary" : "btn-secondary"}`}
                onClick={() => {
                  setPracticeMode("academic");
                  setSyllabusStructure(null);
                  setSelectedSubtopic(null);
                  setTopic("");
                }}
                style={{ flex: 1, padding: "8px 16px", fontSize: "0.9rem", borderRadius: "var(--radius-sm)", border: "none" }}
              >
                🎓 Academic Viva Mode
              </button>
              <button
                type="button"
                className={`btn ${practiceMode === "professional" ? "btn-primary" : "btn-secondary"}`}
                onClick={() => {
                  setPracticeMode("professional");
                  setSyllabusStructure(null);
                  setSelectedSubtopic(null);
                  setTopic("");
                }}
                style={{ flex: 1, padding: "8px 16px", fontSize: "0.9rem", borderRadius: "var(--radius-sm)", border: "none" }}
              >
                💼 Professional Mock Interview
              </button>
            </div>

            <div style={{ textAlign: "left", marginBottom: "var(--space-sm)" }}>
              <h2>{practiceMode === "academic" ? "Select Viva Source" : "Select Interview Context"}</h2>
              <p>{practiceMode === "academic" 
                ? "Provide the syllabus or topic you want the AI Examiner to focus on." 
                : "Provide the job description, resume, or job role you want the AI Interviewer to focus on."}</p>
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
                  <h3>{practiceMode === "academic" ? "Upload Syllabus" : "Upload JD / Resume"}</h3>
                </div>
                <p style={{ fontSize: "0.85rem" }}>
                  {practiceMode === "academic" 
                    ? "Upload custom PDF syllabus, notes, or paste table of contents." 
                    : "Upload custom PDF job description, resume, or paste recruitment specs."}
                </p>
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
                  <h3>{practiceMode === "academic" ? "Topic-Based" : "Role Presets"}</h3>
                </div>
                <p style={{ fontSize: "0.85rem" }}>
                  {practiceMode === "academic" 
                    ? "Enter a single subject or chapter to generate an examination automatically." 
                    : "Enter or select a job role/domain to generate a mock interview immediately."}
                </p>
              </div>
            </div>

            {sourceType === "syllabus" ? (
              <div className="source-details active">
                <div className="form-group">
                  <label className="form-label">
                    {practiceMode === "academic" ? "Upload Syllabus PDF / Notes / MD" : "Upload Job Description / Resume PDF"}
                  </label>
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

                  {uploadedFiles.length > 0 && (
                    <div className="uploaded-files-list" style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                      {uploadedFiles.map((file, index) => (
                        <div key={index} className="uploaded-file-item" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "8px", fontSize: "0.85rem" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <svg style={{ width: "16px", height: "16px", color: "var(--accent-primary)", flexShrink: 0 }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                            </svg>
                            <span style={{ fontWeight: "600", color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "250px" }}>{file.name}</span>
                            <span style={{ color: "var(--text-muted)", fontSize: "0.75rem", flexShrink: 0 }}>({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                          </div>
                          <button 
                            type="button" 
                            onClick={(e) => { e.stopPropagation(); handleRemoveFile(index); }} 
                            style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", display: "flex", alignItems: "center", padding: "4px" }}
                            title="Remove file"
                          >
                            <svg style={{ width: "16px", height: "16px" }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="syllabus-text">
                    {practiceMode === "academic" ? "Or Paste Syllabus Text / Notes" : "Or Paste Job Description / Resume Text"}
                  </label>
                  <textarea 
                    className="form-input" 
                    id="syllabus-text" 
                    rows="5" 
                    value={syllabusText}
                    onChange={(e) => setSyllabusText(e.target.value)}
                    placeholder={practiceMode === "academic" 
                      ? "Paste Table of Contents, course outlines, or structural notes here..." 
                      : "Paste Job Description, qualifications, or your Resume details here..."} 
                    style={{ resize: "vertical", minHeight: "100px", fontSize: "0.9rem" }}
                  />
                </div>
              </div>
            ) : (
              <div className="source-details active">
                <div className="form-group">
                  <label className="form-label" htmlFor="topic-input">
                    {practiceMode === "academic" ? "Enter Viva Subject / Chapter" : "Enter Job Role / Domain"}
                  </label>
                  <input 
                    className="form-input" 
                    type="text" 
                    id="topic-input" 
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder={practiceMode === "academic" 
                      ? "e.g. Thermodynamics, Data Structures, Marketing Management" 
                      : "e.g. Software Engineer (Backend), Product Manager, Data Scientist"} 
                  />
                </div>

                <div>
                  <label className="form-label">
                    {practiceMode === "academic" ? "Suggested Academic Subjects" : "Suggested Job Roles"}
                  </label>
                  <div className="suggestion-pills">
                    {practiceMode === "academic" ? (
                      <>
                        <span className="suggestion-pill" onClick={() => setTopic("Thermodynamics")}>Thermodynamics</span>
                        <span className="suggestion-pill" onClick={() => setTopic("Data Structures")}>Data Structures</span>
                        <span className="suggestion-pill" onClick={() => setTopic("Machine Design")}>Machine Design</span>
                        <span className="suggestion-pill" onClick={() => setTopic("Computer Networks")}>Computer Networks</span>
                        <span className="suggestion-pill" onClick={() => setTopic("Marketing Management")}>Marketing Management</span>
                      </>
                    ) : (
                      <>
                        <span className="suggestion-pill" onClick={() => setTopic("Software Engineer (Backend)")}>Software Engineer</span>
                        <span className="suggestion-pill" onClick={() => setTopic("Product Manager")}>Product Manager</span>
                        <span className="suggestion-pill" onClick={() => setTopic("Data Scientist")}>Data Scientist</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="flow-nav-buttons">
              <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
              <button className="btn btn-primary" onClick={() => handleProceedStep(2)} disabled={isExtractingText}>
                {isExpandingTopic ? (practiceMode === "academic" ? "Expanding Syllabus..." : "Structuring Role...") : "Next: Configuration"}
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
              <h2>{practiceMode === "academic" ? "Configure Examination Parameters" : "Configure Interview Parameters"}</h2>
              <p>{practiceMode === "academic" 
                ? "Adjust the time duration and the pedagogical personality of your examiner." 
                : "Adjust the duration and the evaluation style of your recruitment panel."}</p>
            </div>

            <div className="duration-selector">
              <label className="form-label">{practiceMode === "academic" ? "Examination Duration" : "Interview Duration"}</label>
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
                  <h4 style={{ margin: "0 0 2px 0", fontSize: "0.9rem", color: "var(--accent-primary)" }}>
                    {practiceMode === "academic" ? "Last-Minute Viva Mode" : "Rapid Fire Interview"}
                  </h4>
                  <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                    {practiceMode === "academic" 
                      ? "5-minute rapid-fire preparation. Ideal for last-minute cram sessions. Focuses on high-yield basic concepts."
                      : "5-minute rapid session focusing on core questions. Perfect for a quick check before stepping in."}
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
                  <h4 style={{ margin: "0 0 2px 0", fontSize: "0.9rem", color: "var(--color-error)" }}>
                    {practiceMode === "academic" ? "Mock External Viva" : "Stress / Bar Raiser Interview"}
                  </h4>
                  <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                    {practiceMode === "academic" 
                      ? "High-stress university board review. Intimidating grading and intense questioning."
                      : "High-stress bar-raiser session. Intimidating recruiter questioning and complex system-design pressure."}
                  </p>
                </div>
              </div>

              {/* Committee Group Panel Mode Toggle */}
              <div 
                className={`card ${enablePanelMode ? "selected" : ""}`} 
                onClick={() => setEnablePanelMode(prev => !prev)}
                style={{
                  padding: "var(--space-md)",
                  border: enablePanelMode ? "1px solid var(--accent-primary)" : "1px solid var(--border-color)",
                  borderRadius: "var(--radius-md)",
                  cursor: "pointer",
                  display: "flex",
                  gap: "var(--space-sm)",
                  alignItems: "flex-start",
                  backgroundColor: enablePanelMode ? "var(--accent-light)" : "var(--bg-card)",
                  transition: "var(--transition-smooth)",
                  marginTop: "var(--space-sm)"
                }}
              >
                <div style={{
                  width: "20px",
                  height: "20px",
                  borderRadius: "var(--radius-xs)",
                  border: enablePanelMode ? "2px solid var(--accent-primary)" : "2px solid var(--accent-primary)",
                  backgroundColor: enablePanelMode ? "var(--accent-primary)" : "transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  flexShrink: 0,
                  marginTop: "2px"
                }}>
                  {enablePanelMode && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  )}
                </div>
                <div style={{ textAlign: "left" }}>
                  <h4 style={{ margin: "0 0 2px 0", fontSize: "0.9rem", color: "var(--accent-primary)" }}>
                    Committee Group Panel Mode
                  </h4>
                  <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                    Alternate questions between a panel of two co-examiners/interviewers with different testing personalities.
                  </p>
                </div>
              </div>
            </div>

            <div className="form-group" style={{ marginTop: "var(--space-md)" }}>
              <label className="form-label" style={{ marginBottom: "var(--space-xs)" }}>
                {practiceMode === "academic" ? "Examiner Personality" : "Interviewer Style"}
              </label>
              <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "var(--space-md)" }}>
                {practiceMode === "academic" 
                  ? "Select who will evaluate you. Each persona carries distinct grading traits and oral behaviors."
                  : "Select who will conduct your mock interview. Each interviewer uses a distinct candidate evaluation style."}
              </p>
              
              <div className="personality-grid">
                {Object.entries(EXAMINER_PERSONALITIES).map(([key, details]) => {
                  const displayName = practiceMode === "academic" ? details.name : (
                    key === "friendly" ? "Warm Recruiter" :
                    key === "strict" ? "Structured Hiring Manager" :
                    key === "brutal" ? "Bar Raiser Interviewer" :
                    "Stress Interviewer"
                  );
                  const displayDesc = practiceMode === "academic" ? details.description : (
                    key === "friendly" ? "Encouraging recruiter, conversational pace, supportive hints." :
                    key === "strict" ? "Focused on role competencies, structured questions, demands clarity." :
                    key === "brutal" ? "Detailed behavioral driller, probe deep into decisions, STAR checks." :
                    "Elite stress interviewer, rapid design challenges, logical pressure."
                  );
                  return (
                    <div 
                      className={`card personality-card card-personality-${key} ${personality === key ? "selected" : ""}`} 
                      key={key}
                      onClick={() => {
                        setPersonality(key);
                        VoiceManager.stop();
                        setIsPlayingSample(false);
                      }}
                      style={{ position: "relative" }}
                    >
                      <button 
                        type="button"
                        className="info-btn-mobile"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowDetailsKey(showDetailsKey === key ? null : key);
                        }}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"></circle>
                          <line x1="12" y1="16" x2="12" y2="12"></line>
                          <line x1="12" y1="8" x2="12.01" y2="8"></line>
                        </svg>
                      </button>

                      <div className="personality-name">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" dangerouslySetInnerHTML={{ __html: details.icon }} />
                        {displayName}
                      </div>
                      <span className="personality-desc">{displayDesc}</span>
                      <div className="personality-attributes">
                        <span className={`attribute-tag ${key === "friendly" ? "friendly" : key === "strict" ? "strict" : "intimidating"}`}>
                          {details.attributes.patience === "High" ? "Patient" : details.attributes.patience === "Moderate" ? "Precise" : "Intense"}
                        </span>
                        <span className={`attribute-tag ${key === "friendly" ? "friendly" : key === "strict" ? "strict" : "intimidating"}`}>
                          {key === "friendly" ? (practiceMode === "academic" ? "Hints Included" : "Guiding Hints") : key === "strict" ? "No Hints" : key === "brutal" ? "Rapid-Fire" : "Elite Stress"}
                        </span>
                      </div>

                      {showDetailsKey === key && (
                        <div className="personality-details-overlay" onClick={(e) => { e.stopPropagation(); setShowDetailsKey(null); }}>
                          <p style={{ margin: 0, fontWeight: "600", fontSize: "0.78rem", color: "var(--text-primary)" }}>{displayDesc}</p>
                          <div style={{ fontSize: "0.72rem", fontWeight: "700", marginTop: "6px", color: "var(--accent-primary)" }}>
                            Patience: {details.attributes.patience} | Grading: {details.attributes.grading}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
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
                    isProfessional={practiceMode === "professional"}
                  />
                </div>

                {/* Profile text */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: "0.75rem", fontWeight: "600", textTransform: "uppercase", color: "var(--text-secondary)", letterSpacing: "0.05em" }}>
                    {practiceMode === "academic" ? "Active Examiner Profile" : "Active Interviewer Profile"}
                  </span>
                  <h4 style={{ margin: "4px 0", fontSize: "1.2rem", color: "var(--accent-primary)" }}>
                    {practiceMode === "academic" ? (
                      personality === "friendly" ? "Dr. George Abernathy" :
                      personality === "strict" ? "Dr. Daniel Sterling" :
                      personality === "brutal" ? "Dr. Adam Vance" :
                      "Professor Harry Thorne"
                    ) : (
                      personality === "friendly" ? "George Abernathy (Talent Partner)" :
                      personality === "strict" ? "Daniel Sterling (Engineering Manager)" :
                      personality === "brutal" ? "Adam Vance (Lead Architect)" :
                      "Director Harry Thorne (Bar Raiser)"
                    )}
                  </h4>
                  <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.4 }}>
                    {practiceMode === "academic" ? (
                      personality === "friendly" ? "A highly supportive educator known for conceptual guiding, patient pauses, and constructive evaluations." :
                      personality === "strict" ? "An exacting formal academic focusing on flawless precision, mathematical derivations, and technical accuracy." :
                      personality === "brutal" ? "An external industry reviewer focused on skepticism, pressure loading, and testing boundaries." :
                      "A legendary exam terror designed to simulate high-stress viva environments with sudden logical challenges."
                    ) : (
                      personality === "friendly" ? "A welcoming recruiter focusing on your career trajectory, culture fit, and foundational skills with supportive pacing." :
                      personality === "strict" ? "A methodical team leader checking architectural choices, trade-offs, and practical design principles." :
                      personality === "brutal" ? "A seasoned industry interviewer who probes deeply into execution details, failure modes, and problem-solving." :
                      "A senior executive testing logical boundaries, decision resilience, and system scalability under high pressure."
                    )}
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
              <button 
                className="btn btn-primary" 
                onClick={() => handleProceedStep(3)}
                disabled={isExpandingTopic}
              >
                {isExpandingTopic ? (practiceMode === "academic" ? "Scaling Syllabus..." : "Scaling Competencies...") : "Next: Preview Screen"}
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

        {/* STEP 3: PREVIEW */}
        {currentStep === 3 && (
          <div className="setup-step-view active">
            <div style={{ textAlign: "left", marginBottom: "var(--space-sm)" }}>
              <h2>{practiceMode === "academic" ? "Review Exam Structure" : "Review Interview Outline"}</h2>
              <p>{practiceMode === "academic" 
                ? "Verify the structured course syllabus mapped dynamically by the intelligence engine." 
                : "Verify the job competencies and mock questions mapped dynamically by the AI model."}</p>
            </div>

            <div className="card preview-summary-card" style={{ padding: "var(--space-md) var(--space-lg)" }}>
              {/* Header inside Preview */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-color)", paddingBottom: "12px", marginBottom: "16px" }}>
                <div style={{ textAlign: "left" }}>
                  <h3 style={{ fontSize: "1.25rem", color: "var(--accent-primary)", margin: 0, fontWeight: "700" }}>
                    {syllabusStructure ? syllabusStructure.topic : (practiceMode === "academic" ? "Custom Examination" : "Custom Interview")} Mapped Outline
                  </h3>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", margin: "2px 0 0 0" }}>
                    {practiceMode === "academic" 
                      ? "Select a subtopic leaf node to launch a highly focused Custom Target Drill."
                      : "Select a competency leaf node to launch a highly focused target mock session."}
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
                <SyllabusMindMap
                  syllabusStructure={syllabusStructure}
                  selectedSubtopic={selectedSubtopic}
                  setSelectedSubtopic={setSelectedSubtopic}
                  practiceMode={practiceMode}
                />
              ) : (
                /* ACCORDION OUTLINE LIST FALLBACK */
                <div className="preview-grid" style={{ gridTemplateColumns: "1fr", gap: "var(--space-md)", textAlign: "left", borderBottom: "1px solid var(--border-color)", paddingBottom: "var(--space-md)" }}>
                  {syllabusStructure && syllabusStructure.units.map((u, idx) => (
                    <div key={idx} style={{ padding: "var(--space-sm) var(--space-md)", border: "1px solid var(--border-color)", borderRadius: "var(--radius-sm)", backgroundColor: "var(--bg-primary)" }}>
                      <strong style={{ fontSize: "0.9rem", color: "var(--accent-primary)" }}>
                        {practiceMode === "academic" ? u.name : u.name.replace(/^(unit|competency)\s*\d+\s*:\s*/i, "Competency Area: ")}
                      </strong>
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
                        {practiceMode === "academic" ? "Focus Target Drill Engaged" : "Focused Competency Drill Engaged"}
                      </div>
                      <p style={{ margin: "2px 0 0 0", fontSize: "0.775rem", color: "var(--text-secondary)" }}>
                        Practice session will center strictly on <strong>&quot;{selectedSubtopic.name}&quot;</strong> ({practiceMode === "academic" ? `Unit #${selectedSubtopic.unitIndex + 1}` : `Competency #${selectedSubtopic.unitIndex + 1}`}).
                      </p>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: "0.85rem", fontWeight: "700", color: "var(--color-success)", display: "flex", alignItems: "center", gap: "4px" }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: "16px", height: "16px" }}>
                          <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/>
                        </svg>
                        {practiceMode === "academic" ? "Comprehensive Oral Mode" : "Comprehensive Interview Mode"}
                      </div>
                      <p style={{ margin: "2px 0 0 0", fontSize: "0.775rem", color: "var(--text-secondary)" }}>
                        {practiceMode === "academic" 
                          ? "Questions will cover all topics mapped throughout the curriculum syllabus."
                          : "Questions will cover all competencies mapped for this role."}
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
                  <span className="preview-label">{practiceMode === "academic" ? "Examiner" : "Interviewer"}</span>
                  <div className="preview-personality-details" style={{ justifyContent: "center", gap: "4px" }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: "14px", height: "14px" }} dangerouslySetInnerHTML={{ __html: EXAMINER_PERSONALITIES[personality].icon }} />
                    <span className="preview-value" style={{ fontSize: "0.8rem" }}>
                      {practiceMode === "academic" ? EXAMINER_PERSONALITIES[personality].name : (
                        personality === "friendly" ? "Warm Recruiter" :
                        personality === "strict" ? "Structured Hiring Manager" :
                        personality === "brutal" ? "Bar Raiser Interviewer" :
                        "Stress Interviewer"
                      )}
                    </span>
                  </div>
                </div>

                <div className="preview-item" style={{ padding: "6px" }}>
                  <span className="preview-label">Duration</span>
                  <span className="preview-value" style={{ fontSize: "0.8rem" }}>{selectedSubtopic ? "5 Mins (Speed)" : `${getActiveDuration()} Mins`}</span>
                </div>

                <div className="preview-item" style={{ padding: "6px" }}>
                  <span className="preview-label">Scope</span>
                  <span className="preview-value" style={{ fontSize: "0.8rem" }}>
                    {selectedSubtopic ? "1 Concept" : (practiceMode === "academic" ? `${syllabusStructure ? syllabusStructure.units.length : 3} Units` : `${syllabusStructure ? syllabusStructure.units.length : 3} Competencies`)}
                  </span>
                </div>

                <div className="preview-item" style={{ padding: "6px" }}>
                  <span className="preview-label">{practiceMode === "academic" ? "Pedagogical Guard" : "Interview Guard"}</span>
                  <span className="preview-value" style={{ fontSize: "0.8rem", color: "var(--color-success)" }}>Active</span>
                </div>
              </div>

              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={handleStartExam}
                style={{ width: "100%", padding: "12px", fontSize: "1.05rem", marginTop: "16px", background: selectedSubtopic ? "linear-gradient(135deg, var(--color-warning), hsl(38, 85%, 35%))" : "var(--accent-primary)" }}
              >
                {selectedSubtopic 
                  ? (practiceMode === "academic" ? `Begin Target Drill: ${selectedSubtopic.name}` : `Begin Competency Drill: ${selectedSubtopic.name}`)
                  : (practiceMode === "academic" ? "Begin Mapped Viva" : "Begin Mock Interview")}
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
                {practiceMode === "academic" ? "⚡ Quick Cram: Study Flashcards" : "⚡ Quick Prep: Study Questions"}
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
