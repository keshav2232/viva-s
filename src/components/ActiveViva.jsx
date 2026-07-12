"use client";

import React, { useState, useEffect, useRef } from "react";
import { VoiceManager } from "@/services/voiceManager";
import { SpeechManager } from "@/services/speechManager";
import { EXAMINER_PERSONALITIES } from "@/utils/mockData";
import { QuestionGraphEngine } from "@/services/QuestionGraphEngine";
import { AnswerEvaluationService } from "@/services/AnswerEvaluationService";
import { SessionContextManager } from "@/services/SessionContextManager";
import { HindsightEngine } from "@/services/HindsightEngine";
import ExaminerAvatar from "@/components/ExaminerAvatar";
import WaveformVisualizer from "./WaveformVisualizer";

// Helper to guarantee render purity by getting timestamp outside component scope
function getNow() {
  return Date.now();
}

export default function ActiveViva({ config, activeUser, onFinishViva }) {
  const getPersonaTitle = (p, mode) => {
    const cleanType = p?.toLowerCase();
    if (cleanType === "friendly") return mode === "professional" ? "Warm Recruiter" : "Friendly Professor";
    if (cleanType === "strict") return mode === "professional" ? "Structured Hiring Manager" : "Strict Professor";
    if (cleanType === "brutal") return mode === "professional" ? "Bar Raiser" : "Brutal External";
    if (cleanType === "terror") return mode === "professional" ? "Stress Interviewer" : "Viva Terror";
    return mode === "professional" ? "AI Interviewer" : "AI Examiner";
  };

  // State machine variables
  const [vivaState, setVivaState] = useState(() => config.isResume ? "speaking" : "intro"); // "intro" | "speaking" | "listening" | "analyzing" | "generating"
  const [visualState, setVisualState] = useState("speaking"); // "speaking" | "listening" | "analyzing"
  const [statusText, setStatusText] = useState(() => 
    config.isResume 
      ? (config.mode === "professional" ? "Interviewer is speaking..." : "Professor is speaking...") 
      : (config.mode === "professional" ? "Interviewer is introducing the session..." : "Professor is introducing the exam...")
  );
  
  // Timer stopwatch states
  const [timeRemaining, setTimeRemaining] = useState(config.duration * 60);
  
  // Q&A memory tracking
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(() => config.isResume ? config.resumeState.currentQuestionIndex : 0);
  const [activeQuestion, setActiveQuestion] = useState(() => config.isResume ? config.resumeState.activeQuestion : null);
  const [transcriptText, setTranscriptText] = useState(() => config.isResume ? "Resumed session. Speak or type your answer..." : "Waiting to transcribe your response...");
  const [isPlaceholder, setIsPlaceholder] = useState(true);
  const [lastEvalRecord, setLastEvalRecord] = useState(null);
  const [sessionUnlocked, setSessionUnlocked] = useState(false);

  // Fallback and Input values
  const [fallbackMode, setFallbackMode] = useState(false);
  const [writtenAnswer, setWrittenAnswer] = useState("");
  
  const speechStartTime = useRef(0);
  const [liveVolume, setLiveVolume] = useState(0);
  const [failsafeWarning, setFailsafeWarning] = useState(null);
  const interruptedRef = useRef(false);
  const latestNervousnessRef = useRef(20);
  
  // Hesitation Monitor & Local Audio Replay states/refs
  const [hesitationPenalties, setHesitationPenalties] = useState({});
  const hesitationTimerRef = useRef(null);
  const hasHesitatedInCurrentRoundRef = useRef(false);
  const recordedAudiosRef = useRef({});
  
  // Live Biometric Synchronization
  const [liveMetrics, setLiveMetrics] = useState({ confidence: 85, nervousness: 15, clarity: 80, hesitation: 10 });
  const [liveStatusText, setLiveStatusText] = useState("Calibration active. Ready.");
  const liveTrackerRef = useRef(null);

  const introTimeoutRef = useRef(null);
  const transitionTimeoutRef = useRef(null);
  const isMountedRef = useRef(true);
  
  // Refs for tracking background evaluations
  const pendingAudioEvalRef = useRef(null);
  const evaluationPromisesRef = useRef([]);

  // Refs for tracking latest state values in async callbacks
  const activeQuestionRef = useRef(activeQuestion);
  const currentQuestionIndexRef = useRef(currentQuestionIndex);
  const hesitationPenaltiesRef = useRef(hesitationPenalties);
  const liveMetricsRef = useRef(liveMetrics);
  const transcriptTextRef = useRef(transcriptText);

  useEffect(() => { activeQuestionRef.current = activeQuestion; }, [activeQuestion]);
  useEffect(() => { currentQuestionIndexRef.current = currentQuestionIndex; }, [currentQuestionIndex]);
  useEffect(() => { hesitationPenaltiesRef.current = hesitationPenalties; }, [hesitationPenalties]);
  useEffect(() => { liveMetricsRef.current = liveMetrics; }, [liveMetrics]);
  useEffect(() => { transcriptTextRef.current = transcriptText; }, [transcriptText]);

  // Main initial hook: registers failsafes
  useEffect(() => {
    isMountedRef.current = true;
    // 1. VoiceManager Init
    VoiceManager.init();
    
    // Register failsafe callback
    VoiceManager.onFailsafeActive = (msg) => {
      if (isMountedRef.current) setFailsafeWarning(msg);
    };

    return () => {
      isMountedRef.current = false;
      stopAudioStreams();
      if (liveTrackerRef.current) clearInterval(liveTrackerRef.current);
      if (introTimeoutRef.current) clearTimeout(introTimeoutRef.current);
      if (transitionTimeoutRef.current) clearTimeout(transitionTimeoutRef.current);
      if (hesitationTimerRef.current) clearTimeout(hesitationTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stopwatch timer and speech trigger starts upon unlocking
  useEffect(() => {
    if (!sessionUnlocked) return;

    // 1. Stopwatch interval
    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setTimeout(() => {
            alert("Time is up! Let's proceed to your final evaluation.");
            handleFinish(false);
          }, 0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // 2. Trigger speech sequence (Intro or Resume)
    if (config.isResume) {
      // Restore SessionContextManager state
      SessionContextManager.askedQuestions = config.resumeState.askedQuestions || [];
      SessionContextManager.answerTranscripts = config.resumeState.answerTranscripts || [];
      SessionContextManager.detectedEmotions = config.resumeState.detectedEmotions || [];
      SessionContextManager.weakConcepts = config.resumeState.weakConcepts || [];
      SessionContextManager.confidenceEvolution = config.resumeState.confidenceEvolution || [];
      SessionContextManager.askedTopics = config.resumeState.askedTopics || [];

      // Repeat the active question upon resume!
      const resumeNudge = config.mode === "professional" 
        ? `Resuming your mock interview on ${config.topic}. Let me repeat the question: ${config.resumeState.activeQuestion.text}`
        : `Resuming your exam on ${config.topic}. Let me repeat the question: ${config.resumeState.activeQuestion.text}`;
      VoiceManager.speak(resumeNudge, config.personality,
        () => {
          setVisualState("speaking");
          setStatusText(config.mode === "professional" ? "Interviewer is speaking..." : "Professor is speaking...");
          if (config.personality !== "friendly" && config.enableInterruption !== false) {
            startBackgroundListeningForInterruptions(config.resumeState.activeQuestion);
          }
        },
        () => {
          if (interruptedRef.current) return;
          startListeningMode();
        }
      );
    } else {
      introTimeoutRef.current = setTimeout(() => {
        triggerIntroduction();
      }, 500);
    }

    return () => {
      clearInterval(timer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionUnlocked]);

  function stopAudioStreams() {
    VoiceManager.stop();
    SpeechManager.stop();
    if (transitionTimeoutRef.current) clearTimeout(transitionTimeoutRef.current);
    if (introTimeoutRef.current) clearTimeout(introTimeoutRef.current);
    if (hesitationTimerRef.current) clearTimeout(hesitationTimerRef.current);
  }

  // Live Biometric Speech Prosody Estimator
  useEffect(() => {
    if (vivaState === "listening") {
      if (liveTrackerRef.current) clearInterval(liveTrackerRef.current);

      liveTrackerRef.current = setInterval(() => {
        const durationSecs = (getNow() - speechStartTime.current) / 1000;
        const currentText = (transcriptText || "").trim();
        const isPlaceholderText = isPlaceholder || currentText.includes("Speak now") || currentText.includes("System is listening") || currentText.includes("Please type");
        
        let words = [];
        if (!isPlaceholderText) {
          words = currentText.toLowerCase().split(/\s+/).filter(w => w.length > 0);
        }
        
        const wordCount = words.length;
        const gapsCount = SpeechManager.gapsHistory ? SpeechManager.gapsHistory.length : 0;

        // Count fillers
        let fillerCount = 0;
        const singleFillers = ["um", "umm", "uhm", "uh", "ah", "ahh", "like", "basically", "actually", "maybe"];
        words.forEach(w => {
          if (singleFillers.includes(w)) fillerCount++;
        });
        
        // Count multi-word fillers
        const multiFillers = ["you know", "sort of", "kind of"];
        multiFillers.forEach(phrase => {
          let idx = currentText.toLowerCase().indexOf(phrase);
          while (idx !== -1) {
            fillerCount++;
            idx = currentText.toLowerCase().indexOf(phrase, idx + phrase.length);
          }
        });

        // Compute live values
        let liveHesitation = Math.min(Math.max((fillerCount * 12) + (gapsCount * 15) + 10, 8), 90);
        
        const durationMins = durationSecs / 60;
        const wpm = durationMins > 0 ? Math.round(wordCount / durationMins) : 120;
        
        let wpmDeviation = 0;
        if (wpm > 0) {
          if (wpm < 80) wpmDeviation = (80 - wpm) * 1.6;
          else if (wpm > 170) wpmDeviation = (wpm - 170) * 1.3;
        }

        let liveNervousness = Math.min(Math.max(15 + (fillerCount * 5) + wpmDeviation + (gapsCount * 8), 10), 85);
        let liveClarity = Math.min(Math.max(80 + (wordCount > 5 ? 10 : 0) - (fillerCount * 5) - (gapsCount * 4), 25), 98);
        let liveConfidence = Math.min(Math.max(100 - (liveHesitation * 0.35 + liveNervousness * 0.35 + (100 - liveClarity) * 0.3), 35), 98);

        if (wordCount === 0) {
          liveConfidence = 85;
          liveNervousness = 15;
          liveClarity = 82;
          liveHesitation = 10;
        }

        // Add biometric jitter (±2%)
        const jitter = (val) => Math.round(Math.min(Math.max(val + (Math.random() * 4 - 2), 5), 98));

        const conf = jitter(liveConfidence);
        const nerv = jitter(liveNervousness);
        const clar = jitter(liveClarity);
        const hes = jitter(liveHesitation);

        setLiveMetrics({
          confidence: conf,
          nervousness: nerv,
          clarity: clar,
          hesitation: hes
        });

        // Live dynamic status chips
        let status = "System calibrated. Monitoring...";
        if (nerv > 45) {
          status = "Warning: Stress Levels Spiking";
        } else if (hes > 35) {
          status = "Speech Interruption: Pacing Hesitation";
        } else if (conf > 85 && clar > 80) {
          status = "Excellent: Highly Articulate & Confident";
        } else if (wordCount > 0) {
          status = "Vocal Stream Locked. Analyzing...";
        }
        setLiveStatusText(status);

      }, 350);

    } else {
      if (liveTrackerRef.current) {
        clearInterval(liveTrackerRef.current);
        liveTrackerRef.current = null;
      }
    }

    return () => {
      if (liveTrackerRef.current) {
        clearInterval(liveTrackerRef.current);
      }
    };
  }, [vivaState, transcriptText, isPlaceholder]);

  function startBackgroundListeningForInterruptions(activeQ) {
    interruptedRef.current = false;
    SpeechManager.stop();

    SpeechManager.start({
      onResult: (interim, final) => {
        const text = (interim || "" + final || "").trim();
        // If student spoke more than a few words while examiner was actively speaking
        if (text.length > 8 && VoiceManager.isSpeaking() && !interruptedRef.current) {
          interruptedRef.current = true;
          handleExaminerInterruption(activeQ);
        }
      },
      onError: (err) => {
        console.warn("Background speech recognition error:", err);
      }
    });
  }

  function handleExaminerInterruption(activeQ) {
    VoiceManager.stop();
    SpeechManager.stop();
    
    setVivaState("speaking");
    setVisualState("speaking");
    setStatusText(config.mode === "professional" ? "Interviewer interrupted you..." : "Professor interrupted you...");
    
    const interruptionPhrases = config.mode === "professional" ? {
      strict: "One moment, please. Let me finish framing the scenario before you answer.",
      brutal: "Hold on. Let's finish the question before we dig into the details. Hear me out.",
      terror: "Excuse me! Let me complete the question. Pacing is key here. Answer what is asked."
    } : {
      strict: "One moment, please. Do not speak over me. Listen to the question carefully first.",
      brutal: "Hold on. Stop talking. Let me finish my question before you jump in with your answer.",
      terror: "Silence! Do not interrupt me. Answer precisely what is being asked, and nothing else."
    };
    
    const phrase = interruptionPhrases[config.personality] || "Excuse me, let me finish speaking.";
    const followUpSpeech = phrase + " Let me repeat: " + activeQ.text;
    
    VoiceManager.speak(followUpSpeech, config.personality, 
      () => {
        setTranscriptText("[Examiner interrupted your speech]");
        setIsPlaceholder(false);
      },
      () => {
        interruptedRef.current = false;
        startListeningMode();
      }
    );
  }

  function getFormattedTime() {
    const mins = Math.floor(timeRemaining / 60);
    const secs = timeRemaining % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  // Phase 1: Examiner Greeting
  async function triggerIntroduction() {
    setVivaState("generating");
    setVisualState("analyzing");
    setStatusText(config.mode === "professional" ? "Interviewer is initializing the session..." : "Professor is initializing the exam...");
    
    // Reset Session Context
    SessionContextManager.reset();
    
    try {
      const firstQuestion = await QuestionGraphEngine.generateNextQuestion({
        syllabus: config.syllabusStructure,
        personality: config.personality,
        duration: config.duration,
        askedList: [],
        answersList: [],
        lastEvaluationTag: null,
        currentTopic: "",
        nervousness: 20,
        isTargetDrill: config.isTargetDrill || false,
        targetSubtopic: config.targetSubtopic || null,
        mode: config.mode
      });
      
      if (!isMountedRef.current) return;
      
      setActiveQuestion(firstQuestion);
      
      // Dynamic intro speech: combine dynamic introductory greetings based on personality and user name
      let greeting = "";
      if (config.mode === "professional") {
        greeting = config.isTargetDrill 
          ? `Welcome, ${activeUser}. Let's begin the mock session on your selected competency, ${config.targetSubtopic}. `
          : `Welcome, ${activeUser}. Let's begin the mock interview for the ${config.topic} role. `;
          
        if (config.personality === "terror") {
          greeting = config.isTargetDrill 
            ? `Hello ${activeUser}. I am Thorne, the bar raiser. Let's immediately probe your competency on ${config.targetSubtopic}. `
            : `Hello ${activeUser}. I am Thorne, the bar raiser for this panel. Let's begin the mock interview on ${config.topic}. `;
        } else if (config.personality === "strict") {
          greeting = config.isTargetDrill 
            ? `Welcome, ${activeUser}. Let's verify your competence in ${config.targetSubtopic}. `
            : `Welcome, ${activeUser}. Let's assess your qualifications for ${config.topic}. `;
        } else if (config.personality === "brutal") {
          greeting = config.isTargetDrill 
            ? `Alright, ${activeUser}. Let's test your practical limits in ${config.targetSubtopic}. `
            : `Alright, ${activeUser}. Let's examine your experience depth for ${config.topic}. `;
        }
      } else {
        greeting = config.isTargetDrill 
          ? `Good evening, ${activeUser}. Welcome to your dynamic target drill on ${config.targetSubtopic}. `
          : `Good evening, ${activeUser}. Welcome to your oral examination on ${config.topic}. `;
          
        if (config.personality === "terror") {
          greeting = config.isTargetDrill 
            ? `Sit down, ${activeUser}. We will begin your high-pressure board drill on ${config.targetSubtopic} now. `
            : `Sit down, ${activeUser}. Let us begin the examination on ${config.topic}. I expect absolute precision. `;
        } else if (config.personality === "strict") {
          greeting = config.isTargetDrill 
            ? `Good evening, ${activeUser}. We will now begin a focused review on ${config.targetSubtopic}. `
            : `Good evening, ${activeUser}. We will now begin your viva on ${config.topic}. Answer concisely. `;
        } else if (config.personality === "brutal") {
          greeting = config.isTargetDrill 
            ? `Alright, ${activeUser}. Let's see if you actually understand the limits of ${config.targetSubtopic}. `
            : `Alright, ${activeUser}. Let's see how well you actually know ${config.topic}. `;
        }
      }
      
      const fullSpeech = greeting + (firstQuestion.speech || firstQuestion.text);
      
      // Preload the intro speech
      VoiceManager.preload(fullSpeech, config.personality);
 
      setVivaState("speaking");
      VoiceManager.speak(fullSpeech, config.personality,
        // onStart
        () => {
          setVisualState("speaking");
          setStatusText(config.mode === "professional" ? "Interviewer is speaking..." : "Professor is speaking...");
          if (config.personality !== "friendly" && config.enableInterruption !== false) {
            startBackgroundListeningForInterruptions(firstQuestion);
          }
        },
        // onEnd
        () => {
          if (interruptedRef.current) return;
          startListeningMode();
        }
      );
    } catch (err) {
      console.error("Failed to generate first question:", err);
      if (!isMountedRef.current) return;
      // Fallback
      const fallback = QuestionGraphEngine.getRuleBasedOfflineFallback(1, config.personality, config.topic, config.syllabusStructure);
      setActiveQuestion(fallback);;
      
      // Preload fallback speech
      VoiceManager.preload(fallback.speech, config.personality);

      setVivaState("speaking");
      VoiceManager.speak(fallback.speech, config.personality,
        () => {
          setVisualState("speaking");
          setStatusText(config.mode === "professional" ? "Interviewer is speaking..." : "Professor is speaking...");
          if (config.personality !== "friendly" && config.enableInterruption !== false) {
            startBackgroundListeningForInterruptions(fallback);
          }
        },
        () => {
          if (interruptedRef.current) return;
          startListeningMode();
        }
      );
    }
  };

  const handleHumeEmotionAnalysis = async (audioBlob, questionIndex) => {
    try {
      console.log(`Starting background Hume AI emotion analysis for question #${questionIndex + 1}...`);
      
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        const base64Data = reader.result.split(',')[1];
        
        try {
          const res = await fetch("/api/viva", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "analyze-hume-emotion",
              audioBase64: base64Data
            })
          });
          
          if (!res.ok) throw new Error("Hume AI background analysis failed");
          const humeMetrics = await res.json();
          
          console.log(`Hume AI analysis resolved for question #${questionIndex + 1}:`, humeMetrics);
          
          if (SessionContextManager.detectedEmotions && SessionContextManager.detectedEmotions[questionIndex]) {
            const current = SessionContextManager.detectedEmotions[questionIndex];
            
            if (humeMetrics.confidence !== undefined) current.confidence = humeMetrics.confidence;
            if (humeMetrics.clarity !== undefined) current.clarity = humeMetrics.clarity;
            if (humeMetrics.nervousness !== undefined) current.nervousness = humeMetrics.nervousness;
            if (humeMetrics.hesitation !== undefined) current.hesitation = humeMetrics.hesitation;
            
            if (SessionContextManager.confidenceEvolution && SessionContextManager.confidenceEvolution[questionIndex] !== undefined) {
              SessionContextManager.confidenceEvolution[questionIndex] = humeMetrics.confidence;
            }
          }
        } catch (apiErr) {
          console.warn("Hume AI background API error:", apiErr);
        }
      };
    } catch (err) {
      console.warn("FileReader error during Hume AI audio capture:", err);
    }
  };

  const blobToBase64 = (blob) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result.split(',')[1];
        resolve(base64String);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const startBackgroundEvaluation = async (qIdx, answerText, audioBlob, durationMs, pauseCount, liveMetricsVal, hasPenalty) => {
    try {
      console.log(`Starting background evaluation for question #${qIdx + 1}...`);
      let audioBase64 = null;
      if (audioBlob) {
        try {
          audioBase64 = await blobToBase64(audioBlob);
        } catch (blobErr) {
          console.warn("Could not encode audio blob to base64:", blobErr);
        }
      }

      const currentQ = SessionContextManager.askedQuestionsObjects[qIdx] || activeQuestionRef.current;
      
      const resultMetrics = await AnswerEvaluationService.evaluateResponse({
        question: currentQ.text,
        answer: answerText,
        syllabus: config.syllabusStructure,
        speechDurationMs: durationMs,
        pauseCount: pauseCount,
        liveMetrics: liveMetricsVal,
        isHesitationPenalty: hasPenalty,
        mode: config.mode,
        audioBase64
      });

      console.log(`Background evaluation resolved for question #${qIdx + 1}:`, resultMetrics);

      // Track nervousness for dynamic pressure adaptations
      latestNervousnessRef.current = resultMetrics.nervousness || 20;

      // Record actual metrics in SessionContextManager
      SessionContextManager.updateRoundMetrics(qIdx, resultMetrics);

      // Update askedTopics with the real metrics
      if (currentQ.topic && SessionContextManager.askedTopics) {
        const topicIdx = SessionContextManager.askedTopics.findIndex(t => t.topic === currentQ.topic);
        if (topicIdx !== -1) {
          SessionContextManager.askedTopics[topicIdx].metrics = resultMetrics;
        }
      }
    } catch (err) {
      console.error(`Background evaluation failed for question #${qIdx + 1}:`, err);
      // Heuristic fallback if server error
      const localDelivery = AnswerEvaluationService.calculateLocalDeliveryMetrics(answerText, durationMs, pauseCount);
      const delivery = liveMetricsVal ? { ...localDelivery, ...liveMetricsVal } : localDelivery;
      const fallbackMetrics = AnswerEvaluationService.getLocalFallbackMetrics(delivery, answerText, hasPenalty);
      SessionContextManager.updateRoundMetrics(qIdx, fallbackMetrics);

      const currentQ = SessionContextManager.askedQuestionsObjects[qIdx] || activeQuestionRef.current;
      if (currentQ.topic && SessionContextManager.askedTopics) {
        const topicIdx = SessionContextManager.askedTopics.findIndex(t => t.topic === currentQ.topic);
        if (topicIdx !== -1) {
          SessionContextManager.askedTopics[topicIdx].metrics = fallbackMetrics;
        }
      }
    }
  };

  const getOfflineHint = (topic, questionText) => {
    return {
      hintText: `Friendly hint: Think about the core principles of ${topic || "this topic"}. How does it relate to its main variables or inputs?`,
      hintSpeech: `Don't worry, let's take a step back. Think about the core principles of ${topic || "this topic"}. How does it relate to its main variables or inputs? Take your time.`
    };
  };

  const getOfflineSubquestion = (topic, questionText) => {
    return {
      subQuestionText: `Simpler question: What is the absolute basic definition of ${topic || "this concept"}?`,
      subQuestionSpeech: `You are taking too long. Let's make it simpler. Just tell me: what is the absolute basic definition of ${topic || "this concept"}?`
    };
  };

  const clearHesitationTimer = () => {
    if (hesitationTimerRef.current) {
      clearTimeout(hesitationTimerRef.current);
      hesitationTimerRef.current = null;
    }
  };

  const resetHesitationTimer = () => {
    clearHesitationTimer();
    
    // Only run hesitation monitor if:
    // 1. We are in listening state
    // 2. We are NOT in keyboard fallback mode
    // 3. We haven't already hesitated in this specific question round
    if (!fallbackMode && !hasHesitatedInCurrentRoundRef.current) {
      hesitationTimerRef.current = setTimeout(() => {
        handleStudentHesitation();
      }, 5000); // 5 seconds of inactivity triggers the hesitation monitor
    }
  };

  const handleStudentHesitation = async () => {
    hasHesitatedInCurrentRoundRef.current = true;
    clearHesitationTimer();

    // Stop Speech Recognition temporarily so it doesn't pick up the examiner's voice
    SpeechManager.stop();

    const persona = config.personality;
    
    setVivaState("speaking");
    setVisualState("speaking");

    const currentQ = activeQuestionRef.current;
    if (!currentQ) {
      console.warn("Hesitation triggered but activeQuestion is null, aborting.");
      startListeningMode();
      return;
    }

    if (persona === "friendly") {
      setStatusText(`${getPersonaTitle("friendly", config.mode)} is offering a hint...`);
      
      let hintText = "";
      let hintSpeech = "";
      
      try {
        const res = await fetch("/api/viva", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "generate-hint",
            question: currentQ.text,
            answer: transcriptTextRef.current === "Speak now. System is listening..." ? "" : transcriptTextRef.current,
            topic: currentQ.topic,
            mode: config.mode
          })
        });
        if (res.ok) {
          const data = await res.json();
          hintText = data.hintText;
          hintSpeech = data.hintSpeech;
        } else {
          throw new Error("Hint generation error");
        }
      } catch (err) {
        console.warn("Using offline fallback hint:", err);
        const fallbackHint = getOfflineHint(currentQ.topic, currentQ.text);
        hintText = fallbackHint.hintText;
        hintSpeech = fallbackHint.hintSpeech;
      }

      setTranscriptText(`[Hint: ${hintText}]`);
      setIsPlaceholder(false);

      VoiceManager.speak(hintSpeech, "friendly", 
          null,
        () => {
          startListeningMode();
        }
      );

    } else if (persona === "strict" || persona === "brutal") {
      setStatusText(`${getPersonaTitle(persona, config.mode)} is reminding you of the time...`);

      const mins = Math.floor(timeRemaining / 60);
      const secs = timeRemaining % 60;
      const timeStr = mins > 0 ? `${mins} minutes and ${secs} seconds` : `${secs} seconds`;
      const reminderSpeech = config.mode === "professional"
        ? `We are running out of time. You have ${timeStr} remaining for this interview. Please provide your answer immediately.`
        : `We are running out of time. You have ${timeStr} remaining for this examination. Please provide your explanation immediately.`;
      
      setTranscriptText(config.mode === "professional"
        ? `[Interviewer reminded you of the remaining time: ${getFormattedTime()}]`
        : `[Examiner reminded you of the remaining time: ${getFormattedTime()}]`
      );
      setIsPlaceholder(false);

      VoiceManager.speak(reminderSpeech, persona,
        null,
        () => {
          startListeningMode();
        }
      );

    } else if (persona === "terror") {
      setStatusText(`${getPersonaTitle("terror", config.mode)} is interrupting you...`);
      
      setHesitationPenalties(prev => ({
        ...prev,
        [currentQuestionIndexRef.current]: true
      }));

      let subQuestionText = "";
      let subQuestionSpeech = "";

      try {
        const res = await fetch("/api/viva", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "generate-subquestion",
            question: currentQ.text,
            answer: transcriptTextRef.current === "Speak now. System is listening..." ? "" : transcriptTextRef.current,
            topic: currentQ.topic,
            mode: config.mode
          })
        });
        if (res.ok) {
          const data = await res.json();
          subQuestionText = data.subQuestionText;
          subQuestionSpeech = data.subQuestionSpeech;
        } else {
          throw new Error("Sub-question generation failed");
        }
      } catch (err) {
        console.warn("Using offline subquestion fallback:", err);
        const fallbackSub = getOfflineSubquestion(currentQ.topic, currentQ.text);
        subQuestionText = fallbackSub.subQuestionText;
        subQuestionSpeech = fallbackSub.subQuestionSpeech;
      }

      setActiveQuestion(prev => {
        if (!prev) return null;
        return {
          ...prev,
          text: `${prev.text} (Simplified: ${subQuestionText})`
        };
      });
      setTranscriptText(config.mode === "professional"
        ? `[Interviewer interrupted to ask a simpler sub-question. Score penalty applied.]`
        : `[Examiner interrupted to ask a simpler sub-question. Score penalty applied.]`
      );
      setIsPlaceholder(false);

      VoiceManager.speak(subQuestionSpeech, "terror",
        null,
        () => {
          startListeningMode();
        }
      );
    }
  };

  // Phase 2: Dynamic Listening
  function startListeningMode() {
    setVivaState("listening");
    setVisualState("listening");
    setStatusText("Listening to your answer...");
    setTranscriptText("Speak now. System is listening...");
    setIsPlaceholder(true);
    
    speechStartTime.current = getNow();
    resetHesitationTimer();

    SpeechManager.start({
      onResult: (interim, final) => {
        resetHesitationTimer();
        if (!final && !interim) {
          setTranscriptText("Speak now. System is listening...");
          setIsPlaceholder(true);
        } else {
          setTranscriptText(final + (interim ? ` ${interim}` : ""));
          setIsPlaceholder(false);
        }
      },
      onVolumeChange: (volPct) => {
        setLiveVolume(volPct);
      },
      onSilenceDetected: (finalTranscriptText) => {
        // Hands-free auto submit
        SpeechManager.stop();
        processResponse(finalTranscriptText);
      },
      onAudioCaptured: (audioBlob) => {
        handleHumeEmotionAnalysis(audioBlob, currentQuestionIndex);
        const qIdx = pendingAudioEvalRef.current ? pendingAudioEvalRef.current.qIdx : currentQuestionIndex;
        if (audioBlob && audioBlob.size > 100) {
          recordedAudiosRef.current[qIdx] = audioBlob;
        }

        if (pendingAudioEvalRef.current) {
          const { qIdx: pendingQIdx, answerText, durationMs, pauseCount, liveMetrics: pendingLiveMetrics, hasPenalty } = pendingAudioEvalRef.current;
          pendingAudioEvalRef.current = null;
          
          const evalPromise = startBackgroundEvaluation(pendingQIdx, answerText, audioBlob, durationMs, pauseCount, pendingLiveMetrics, hasPenalty);
          evaluationPromisesRef.current.push(evalPromise);
        }
      },
      onError: (err) => {
        console.warn("React SpeechManager error:", err);
        if (err === "not-allowed" || err === "service-not-allowed" || err === "not-supported") {
          setFallbackMode(true);
          triggerKeyboardFallback();
        } else if (err === "no-speech") {
          // Ignore native browser no-speech timeouts. SpeechManager will automatically hot-restart
          // in the background, preserving any text that the student has already spoken.
          console.log("SpeechManager: Ignored 'no-speech' timeout to protect student pacing.");
        }
      }
    });
  }

  function triggerKeyboardFallback() {
    SpeechManager.stop();
    clearHesitationTimer();
    setVisualState("listening");
    setStatusText("Keyboard Fallback Active");
    setTranscriptText("Please type your detailed explanation inside the box below.");
    setIsPlaceholder(true);
  }

  async function processResponse(answerText) {
    VoiceManager.stop();
    const currentQ = activeQuestionRef.current;
    if (!currentQ) {
      console.warn("Speech input captured before activeQuestion was set, ignoring.");
      return;
    }
    const qIdxStart = currentQuestionIndexRef.current;
    const penalties = hesitationPenaltiesRef.current;
    const metricsVal = liveMetricsRef.current;

    if (!answerText || answerText.length < 5) {
      answerText = config.mode === "professional" 
        ? "[Candidate remained silent or provided no substantive answer]" 
        : "[Student remained silent or provided no substantive answer]";
    }

    setVivaState("analyzing");
    setVisualState("analyzing");
    setStatusText(config.mode === "professional" ? "Interviewer is evaluating your answer..." : "Examiner is evaluating your answer...");
    setTranscriptText(answerText);
    setIsPlaceholder(false);
    clearHesitationTimer();

    const durationMs = getNow() - speechStartTime.current;
    const pauseCount = SpeechManager.gapsHistory.length;
    const hasPenalty = penalties[qIdxStart] || false;

    // Queue for background audio analysis if we are in oral mode (not keyboard fallback)
    if (!fallbackMode) {
      pendingAudioEvalRef.current = {
        qIdx: qIdxStart,
        answerText,
        durationMs,
        pauseCount,
        liveMetrics: metricsVal,
        hasPenalty: hasPenalty
      };
    }

    try {
      const resultMetrics = await AnswerEvaluationService.evaluateResponse({
        question: currentQ.text,
        answer: answerText,
        syllabus: config.syllabusStructure,
        speechDurationMs: durationMs,
        pauseCount: pauseCount,
        liveMetrics: metricsVal,
        isHesitationPenalty: hasPenalty,
        mode: config.mode
      });

      // Track nervousness for dynamic pressure adaptations
      latestNervousnessRef.current = resultMetrics.nervousness || 20;

      // Record in SessionContextManager
      SessionContextManager.recordRound({
        questionText: currentQ.text,
        answerText: answerText,
        metrics: resultMetrics,
        questionObj: currentQ
      });

      // Also record the topic asked for custom strengths computation
      if (currentQ.topic) {
        if (!SessionContextManager.askedTopics) {
          SessionContextManager.askedTopics = [];
        }
        SessionContextManager.askedTopics.push({
          topic: currentQ.topic,
          metrics: resultMetrics
        });
      }

      // Save visual reaction state
      setLastEvalRecord({
        correctness: resultMetrics.correctness,
        tag: resultMetrics.tag
      });

      // Update status text based on reaction
      let reactionText = config.mode === "professional" ? "Interviewer is noting your response..." : "Professor is noting your response...";
      if (resultMetrics.correctness >= 75) {
        reactionText = `${getPersonaTitle(config.personality, config.mode)} is pleased with your answer.`;
      } else if (resultMetrics.correctness < 55 || resultMetrics.tag === "Bluffing" || resultMetrics.tag === "Incorrect") {
        reactionText = `${getPersonaTitle(config.personality, config.mode)} looks skeptical.`;
      }
      setStatusText(reactionText);

      // Delay transition to let user register visual reaction
      transitionTimeoutRef.current = setTimeout(async () => {
        if (!isMountedRef.current) return;
        // Clear evaluation reaction so face resets
        setLastEvalRecord(null);

        // Progress to next question or end
        const qIndex = qIdxStart + 1;
        if (qIndex >= 4) {
          handleFinish(false);
          return;
        }

        hasHesitatedInCurrentRoundRef.current = false;
        setCurrentQuestionIndex(qIndex);
        setVivaState("generating");
        setVisualState("analyzing");
        setStatusText(config.mode === "professional" ? "Formulating next interview question..." : "Formulating next question...");

        try {
          const nextQuestion = await QuestionGraphEngine.generateNextQuestion({
            syllabus: config.syllabusStructure,
            personality: config.personality,
            duration: config.duration,
            askedList: SessionContextManager.askedQuestions,
            answersList: SessionContextManager.answerTranscripts,
            lastEvaluationTag: resultMetrics.tag,
            currentTopic: currentQ.topic,
            nervousness: latestNervousnessRef.current,
            isTargetDrill: config.isTargetDrill || false,
            targetSubtopic: config.targetSubtopic || null,
            mode: config.mode
          });

          if (!isMountedRef.current) return;

          setActiveQuestion(nextQuestion);
          // Preload next question speech!
          VoiceManager.preload(nextQuestion.speech, config.personality);

          setVivaState("speaking");
          VoiceManager.speak(nextQuestion.speech, config.personality,
            () => {
              if (!isMountedRef.current) return;
              setVisualState("speaking");
              setStatusText(config.mode === "professional" ? "Interviewer is speaking..." : "Professor is speaking...");
              if (config.personality !== "friendly" && config.enableInterruption !== false) {
                startBackgroundListeningForInterruptions(nextQuestion);
              }
            },
            () => {
              if (!isMountedRef.current) return;
              if (interruptedRef.current) return;
              startListeningMode();
            }
          );
        } catch (nextErr) {
          console.error("Failed to generate next question in delayed block:", nextErr);
          if (!isMountedRef.current) return;
          // Catch and handle fallback inside delayed try
          const qIdx = qIdxStart + 1;
          setCurrentQuestionIndex(qIdx);
          setVivaState("generating");
          setVisualState("analyzing");
          setStatusText(config.mode === "professional" ? "Formulating next interview question..." : "Formulating next question...");

          const nextQuestion = QuestionGraphEngine.getRuleBasedOfflineFallback(qIdx + 1, config.personality, currentQ.topic, config.syllabusStructure);
          setActiveQuestion(nextQuestion);
          VoiceManager.preload(nextQuestion.speech, config.personality);

          setVivaState("speaking");
          VoiceManager.speak(nextQuestion.speech, config.personality,
            () => {
              if (!isMountedRef.current) return;
              setVisualState("speaking");
              setStatusText(config.mode === "professional" ? "Interviewer is speaking..." : "Professor is speaking...");
              if (config.personality !== "friendly" && config.enableInterruption !== false) {
                startBackgroundListeningForInterruptions(nextQuestion);
              }
            },
            () => {
              if (!isMountedRef.current) return;
              if (interruptedRef.current) return;
              startListeningMode();
            }
          );
        }
      }, 3200);

    } catch (err) {
      console.error("Failed to process answer evaluation:", err);
      // Heuristic fallback if server error
      const localDelivery = AnswerEvaluationService.calculateLocalDeliveryMetrics(answerText, durationMs, pauseCount);
      const hasPenalty = penalties[qIdxStart] || false;
      const delivery = metricsVal ? { ...localDelivery, ...metricsVal } : localDelivery;
      const fallbackMetrics = AnswerEvaluationService.getLocalFallbackMetrics(delivery, answerText, hasPenalty);
      
      SessionContextManager.recordRound({
        questionText: currentQ.text,
        answerText: answerText,
        metrics: fallbackMetrics,
        questionObj: currentQ
      });

      if (!SessionContextManager.askedTopics) {
        SessionContextManager.askedTopics = [];
      }
      SessionContextManager.askedTopics.push({
        topic: currentQ.topic || (config.mode === "professional" ? "Role Core Competence" : "Syllabus Fundamentals"),
        metrics: fallbackMetrics
      });

      // Save visual reaction state
      setLastEvalRecord({
        correctness: fallbackMetrics.correctness,
        tag: fallbackMetrics.tag
      });

      // Update status text based on reaction
      let reactionText = config.mode === "professional" ? "Interviewer is noting your response..." : "Professor is noting your response...";
      if (fallbackMetrics.correctness >= 75) {
        reactionText = `${getPersonaTitle(config.personality, config.mode)} is pleased with your answer.`;
      } else if (fallbackMetrics.correctness < 55 || fallbackMetrics.tag === "Bluffing" || fallbackMetrics.tag === "Incorrect") {
        reactionText = `${getPersonaTitle(config.personality, config.mode)} looks skeptical.`;
      }
      setStatusText(reactionText);

      // Delay transition to let user register visual reaction
      transitionTimeoutRef.current = setTimeout(() => {
        if (!isMountedRef.current) return;
        // Clear evaluation reaction so face resets
        setLastEvalRecord(null);

        const qIndex = qIdxStart + 1;
        if (qIndex >= 4) {
          handleFinish(false);
          return;
        }

        hasHesitatedInCurrentRoundRef.current = false;
        setCurrentQuestionIndex(qIndex);
        setVivaState("generating");
        setVisualState("analyzing");
        setStatusText(config.mode === "professional" ? "Formulating next interview question..." : "Formulating next question...");

        const nextQuestion = QuestionGraphEngine.getRuleBasedOfflineFallback(qIndex + 1, config.personality, currentQ.topic, config.syllabusStructure);
        setActiveQuestion(nextQuestion);
        // Preload next question speech!
        VoiceManager.preload(nextQuestion.speech, config.personality);

        setVivaState("speaking");
        VoiceManager.speak(nextQuestion.speech, config.personality,
          () => {
            if (!isMountedRef.current) return;
            setVisualState("speaking");
            setStatusText(config.mode === "professional" ? "Interviewer is speaking..." : "Professor is speaking...");
            if (config.personality !== "friendly" && config.enableInterruption !== false) {
              startBackgroundListeningForInterruptions(nextQuestion);
            }
          },
          () => {
            if (!isMountedRef.current) return;
            if (interruptedRef.current) return;
            startListeningMode();
          }
        );
      }, 3200);
    }
  };

  const handlePauseSession = () => {
    stopAudioStreams();
    clearHesitationTimer();
    
    const pauseState = {
      config,
      activeUser,
      currentQuestionIndex,
      activeQuestion,
      askedQuestions: SessionContextManager.askedQuestions,
      answerTranscripts: SessionContextManager.answerTranscripts,
      detectedEmotions: SessionContextManager.detectedEmotions,
      weakConcepts: SessionContextManager.weakConcepts,
      confidenceEvolution: SessionContextManager.confidenceEvolution,
      askedTopics: SessionContextManager.askedTopics || []
    };
    
    localStorage.setItem("vivasim_paused_session", JSON.stringify(pauseState));
    const sessionNameText = config.mode === "professional" ? "interview practice session" : "oral examination session";
    alert(`Your ${sessionNameText} has been paused and saved securely. You can resume it anytime from the dashboard!`);
    onFinishViva(null); // Return directly to dashboard
  };

  function handleFinish(endedEarly = false) {
    stopAudioStreams();
    
    // Compile final report using SessionContextManager
    const baseReport = SessionContextManager.compileFinalReport(config.topic);
    
    // Generate custom dynamic strengths and weaknesses for custom syllabi
    let dynamicStrengths = [];
    let dynamicWeaknesses = [];
    let dynamicRevisions = [];

    const askedTopics = SessionContextManager.askedTopics || [];

    askedTopics.forEach(item => {
      const topicName = item.topic;
      const m = item.metrics;

      if (m.correctness >= 75 && m.accuracy >= 70) {
        dynamicStrengths.push(`Demonstrated high correctness (${m.correctness}%) and technical accuracy on "${topicName}".`);
      } else if (m.correctness < 65 || m.accuracy < 60) {
        dynamicWeaknesses.push(`Exhibited conceptual gaps and vulnerability on "${topicName}" (${m.correctness}% correctness).`);
        dynamicRevisions.push(topicName);
      } else if (m.tag === "Bluffing") {
        dynamicWeaknesses.push(`Attempted general filler responses (flagged as Bluffing) when pressed on "${topicName}".`);
        dynamicRevisions.push(topicName);
      } else if (m.tag === "Incomplete") {
        dynamicWeaknesses.push(`Provided a structurally correct but incomplete response on "${topicName}".`);
        dynamicRevisions.push(topicName);
      }
    });

    // Provide default/fallback points if lists are empty
    if (dynamicStrengths.length === 0) {
      dynamicStrengths.push("Maintained reasonable fluency and structure across core subject areas.");
      dynamicStrengths.push("Successfully articulated basic definitions under examiner stress.");
    }
    if (dynamicWeaknesses.length === 0) {
      dynamicWeaknesses.push("No severe conceptual errors detected; minor hesitation under pressure.");
    }
    if (dynamicRevisions.length === 0) {
      try {
        const units = config.syllabusStructure?.units || [];
        if (units.length > 0) {
          dynamicRevisions = units.slice(0, 2).map(u => u.name.replace(/Unit\s*\d+:\s*/i, ""));
        } else {
          dynamicRevisions = ["Fundamental Laws", "Ideal Cycles"];
        }
      } catch {
        dynamicRevisions = ["Fundamental Laws", "Ideal Cycles"];
      }
    }

    const audioUrls = {};
    Object.keys(recordedAudiosRef.current).forEach(idx => {
      const blob = recordedAudiosRef.current[idx];
      if (blob) {
        audioUrls[idx] = URL.createObjectURL(blob);
      }
    });

    clearHesitationTimer();

    const reportPayload = {
      ...baseReport,
      askedTopics: SessionContextManager.askedTopics || [],
      endedEarly,
      sessionConfidenceScores: SessionContextManager.confidenceEvolution,
      dynamicStrengths,
      dynamicWeaknesses,
      dynamicRevisions,
      isLastMinute: config.isLastMinute || false,
      isMockExternal: config.isMockExternal || false,
      examinerPersonality: config.personality,
      recordedAudios: audioUrls,
      mode: config.mode,
      hindsightData: null,
      hindsightLoading: true
    };

    // Fire hindsight analysis asynchronously — does NOT block the results screen
    HindsightEngine.analyze({
      subjectName: config.topic,
      askedQuestions: baseReport.askedQuestions,
      askedQuestionsObjects: baseReport.askedQuestionsObjects,
      answerTranscripts: baseReport.answerTranscripts,
      detectedEmotions: baseReport.detectedEmotions,
      personality: config.personality,
      mode: config.mode
    }).then(hindsightResult => {
      // Enrich the report data after hindsight resolves
      reportPayload.hindsightData = hindsightResult;
      reportPayload.hindsightLoading = false;
    }).catch(err => {
      console.warn("HindsightEngine failed, results will use original data:", err);
      reportPayload.hindsightLoading = false;
    });

    onFinishViva(reportPayload);
  };

  // Unified Submission for Oral & Keyboard Modes
  const handleSubmit = () => {
    if (fallbackMode) {
      if (!writtenAnswer.trim()) return;
      const textToSubmit = writtenAnswer.trim();
      setWrittenAnswer("");
      setFallbackMode(false);
      processResponse(textToSubmit, true);
    } else {
      // Force submit current oral microphone transcript
      SpeechManager.stop();
      let textToSubmit = transcriptText;
      if (isPlaceholder || !textToSubmit || textToSubmit.includes("System is listening") || textToSubmit.includes("Speak now")) {
        textToSubmit = config.mode === "professional" 
          ? "[Candidate force-submitted response early without substantive oral recording]"
          : "[Student force-submitted response early without substantive oral recording]";
      }
      
      processResponse(textToSubmit, false);
    }
  };



  if (!sessionUnlocked) {
    const titleText = config.mode === "professional" ? "Interactive Mock Interview" : "AI Oral Examination Simulator";
    const descText = config.mode === "professional"
      ? `You are about to start a professional technical interview on ${config.topic} with ${getPersonaTitle(config.personality, config.mode)}.`
      : `You are about to start an oral examination on ${config.topic} with ${getPersonaTitle(config.personality, config.mode)}.`;
    
    return (
      <section id="active-viva-screen" className="screen active" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "80vh", padding: "20px" }}>
        <div className="card start-simulation-overlay" style={{
          maxWidth: "480px",
          width: "100%",
          padding: "var(--space-xl) var(--space-lg)",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-md)",
          boxShadow: "var(--shadow-lg)"
        }}>
          <div style={{ fontSize: "3rem", margin: "10px 0" }}>🎙️</div>
          <h2 style={{ fontSize: "1.4rem", fontWeight: "800", color: "var(--accent-primary)", margin: 0 }}>{titleText}</h2>
          <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", lineHeight: 1.5, margin: 0 }}>
            {descText}
          </p>
          <div style={{
            padding: "12px",
            borderRadius: "var(--radius-sm)",
            backgroundColor: "var(--bg-primary)",
            border: "1px dashed var(--border-color)",
            fontSize: "0.8rem",
            color: "var(--text-muted)",
            textAlign: "left",
            lineHeight: 1.4
          }}>
            <strong>🔊 Audio Safety Check:</strong> Mobile browsers block speech synthesis audio until you interact. Click below to authorize speech audio and start your practice session.
          </div>
          <button 
            type="button" 
            className="btn btn-primary" 
            onClick={() => {
              try {
                const u = new SpeechSynthesisUtterance("");
                window.speechSynthesis.speak(u);
              } catch (e) {
                console.warn("Speech synthesis pre-unlock failed:", e);
              }
              setSessionUnlocked(true);
            }}
            style={{
              padding: "12px 24px",
              fontSize: "1rem",
              fontWeight: "700",
              marginTop: "10px",
              boxShadow: "0 4px 14px rgba(37, 99, 235, 0.4)",
              cursor: "pointer"
            }}
          >
            {config.isResume ? "Resume Session" : "Start Session"}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section id="active-viva-screen" className="screen active" style={{ position: "relative" }}>
      {/* Subtle ElevenLabs failsafe warning banner */}
      {failsafeWarning && (
        <div className="failsafe-banner" style={{
          position: "absolute",
          top: "var(--space-md)",
          left: "50%",
          transform: "translateX(-50%)",
          backgroundColor: "hsla(35, 100%, 96%, 0.95)",
          border: "1px solid hsl(35, 90%, 82%)",
          color: "hsl(25, 85%, 36%)",
          padding: "8px var(--space-md)",
          borderRadius: "var(--radius-full)",
          fontSize: "0.8rem",
          fontWeight: "600",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          boxShadow: "var(--shadow-sm)",
          zIndex: 1000
        }}>
          <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "hsl(25, 95%, 45%)" }}></span>
          {failsafeWarning}
        </div>
      )}

      <div className="active-viva-layout">
        
        {/* Top Header details */}
        <div className="viva-header-bar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
          <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
            <span className="viva-topic-badge" id="active-viva-topic-badge">{config.topic}</span>
            {config.isTargetDrill && (
              <span className="viva-topic-badge target-drill-active-badge" style={{
                backgroundColor: "var(--color-warning-bg)",
                color: "var(--color-warning)",
                border: "1px solid var(--color-warning)",
                boxShadow: "0 0 8px rgba(161, 107, 21, 0.25)",
                display: "flex",
                alignItems: "center",
                gap: "4px",
                fontWeight: "700"
              }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: "12px", height: "12px" }}>
                  <circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 4.24 4.24M14.83 9.17l4.24-4.24M14.83 14.83l4.24 4.24M9.17 14.83l-4.24 4.24"/>
                </svg>
                Focus Drill: {config.targetSubtopic}
              </span>
            )}
          </div>
          <div className="viva-timer-box">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            <span id="active-viva-timer">{getFormattedTime()}</span>
          </div>
        </div>

        {/* Middle Stage */}
        <div className={`examiner-stage ${visualState}`} id="viva-examiner-stage">
          <div className="examiner-avatar-box">
            <ExaminerAvatar 
              personality={config.personality}
              vivaState={vivaState}
              liveMetrics={liveMetrics}
              lastEvaluation={lastEvalRecord}
              isProfessional={config.mode === "professional"}
            />
          </div>

          <div className="examiner-status-tag" id="examiner-status">
            <span className="status-pulse-dot"></span>
            <span id="examiner-status-text">{statusText}</span>
          </div>

          {/* wave audio rendering */}
          <WaveformVisualizer status={vivaState} volume={liveVolume} />

          <div className="microphone-box" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
            <button className="btn-mic" id="btn-microphone" disabled={vivaState !== "listening" || fallbackMode}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                <line x1="12" y1="19" x2="12" y2="23"></line>
                <line x1="8" y1="23" x2="16" y2="23"></line>
              </svg>
            </button>
            <span className="mic-subtext" id="btn-microphone-sub">
              {fallbackMode ? "Microphone access blocked." : vivaState === "listening" ? "Microphone active. Speak naturally." : (config.mode === "professional" ? "Microphone inactive while interviewer speaks." : "Microphone inactive while examiner speaks.")}
            </span>
            {vivaState === "listening" && !fallbackMode && (
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => {
                  setFallbackMode(true);
                  triggerKeyboardFallback();
                }}
                style={{ fontSize: "0.8rem", padding: "4px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)", cursor: "pointer", transition: "var(--transition-smooth)" }}
              >
                Switch to Keyboard Input
              </button>
            )}
          </div>

          {/* Biometric live prosody synchronizer */}
          {vivaState === "listening" && (
            <div className="biometric-sync-panel">
              <div className="biometric-header">
                <span className="biometric-pulse"></span>
                <span>{config.mode === "professional" ? "Candidate Biometric Sync" : "Student Biometric Sync"}</span>
              </div>
              <div className="biometric-grid">
                
                {/* Confidence */}
                <div className="biometric-metric-row">
                  <div className="biometric-label-container">
                    <span className="biometric-label">Vocal Confidence</span>
                    <span className="biometric-value">{liveMetrics.confidence}%</span>
                  </div>
                  <div className="biometric-progress-container">
                    <div 
                      className={`biometric-progress-bar biometric-bar-confidence ${liveMetrics.confidence >= 80 ? 'high' : ''}`}
                      style={{ width: `${liveMetrics.confidence}%` }}
                    />
                  </div>
                </div>

                {/* Nervousness */}
                <div className="biometric-metric-row">
                  <div className="biometric-label-container">
                    <span className="biometric-label">Nervousness Index</span>
                    <span className="biometric-value">{liveMetrics.nervousness}%</span>
                  </div>
                  <div className="biometric-progress-container">
                    <div 
                      className={`biometric-progress-bar biometric-bar-nervousness ${liveMetrics.nervousness >= 50 ? 'high' : ''}`}
                      style={{ width: `${liveMetrics.nervousness}%` }}
                    />
                  </div>
                </div>

                {/* Clarity */}
                <div className="biometric-metric-row">
                  <div className="biometric-label-container">
                    <span className="biometric-label">Phonetic Clarity</span>
                    <span className="biometric-value">{liveMetrics.clarity}%</span>
                  </div>
                  <div className="biometric-progress-container">
                    <div 
                      className="biometric-progress-bar biometric-bar-clarity"
                      style={{ width: `${liveMetrics.clarity}%` }}
                    />
                  </div>
                </div>

                {/* Hesitation */}
                <div className="biometric-metric-row">
                  <div className="biometric-label-container">
                    <span className="biometric-label">Hesitation Rate</span>
                    <span className="biometric-value">{liveMetrics.hesitation}%</span>
                  </div>
                  <div className="biometric-progress-container">
                    <div 
                      className="biometric-progress-bar biometric-bar-hesitation"
                      style={{ width: `${liveMetrics.hesitation}%` }}
                    />
                  </div>
                </div>

              </div>
              <div className={`biometric-status-chip ${liveMetrics.nervousness >= 45 ? 'alert' : liveMetrics.confidence >= 80 ? 'stable' : ''}`}>
                {liveStatusText}
              </div>
            </div>
          )}

          <div className="transcript-stage-card">
            <span className="transcript-label" id="transcript-speaker-label">
              {vivaState === "listening" ? (config.mode === "professional" ? "Candidate Oral Response (Live)" : "Student Oral Response (Live)") : "Transcription Output"}
            </span>
            <div className={`transcript-text ${isPlaceholder ? "transcript-placeholder" : ""}`} id="viva-transcript-text">
              {transcriptText}
            </div>

            {/* Fallback keyboard block */}
            {fallbackMode && (
              <div id="viva-keyboard-fallback" style={{ display: "block", marginTop: "var(--space-md)", borderTop: "1px solid var(--border-color)", paddingTop: "var(--space-sm)" }}>
                <label className="form-label" htmlFor="viva-fallback-input" style={{ fontSize: "0.75rem" }}>Type your answer below and press Enter or Submit:</label>
                <textarea 
                  className="form-input" 
                  id="viva-fallback-input" 
                  rows="2" 
                  value={writtenAnswer}
                  onChange={(e) => setWrittenAnswer(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }}
                  placeholder="Type your answer here..." 
                  style={{ fontSize: "0.9rem", resize: "none", marginTop: "4px" }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Bottom card */}
        <div className="viva-question-card" id="viva-question-container">
          <span className="viva-question-number" id="viva-question-num-tag">
            Question {currentQuestionIndex + 1} of 4
          </span>
          <div className="viva-question-content" id="viva-question-content-text">
            {activeQuestion ? `"${activeQuestion.text}"` : (config.mode === "professional" ? '"Loading interview question..."' : '"Loading examination question..."')}
          </div>
          
          <div className="viva-card-controls">
            <div style={{ display: "flex", gap: "var(--space-xs)" }}>
              <button className="btn btn-secondary" onClick={handlePauseSession} style={{ fontSize: "0.85rem", padding: "8px 16px" }}>
                {config.mode === "professional" ? "Pause Interview" : "Pause Exam"}
              </button>
              <button className="btn btn-secondary" onClick={() => handleFinish(true)} style={{ fontSize: "0.85rem", padding: "8px 16px", color: "var(--color-error)", borderColor: "var(--color-error-bg)" }}>
                {config.mode === "professional" ? "End Interview" : "End Exam"}
              </button>
            </div>
            <button 
              className="btn btn-primary" 
              id="btn-next-question" 
              onClick={handleSubmit}
              disabled={vivaState !== "listening"}
              style={{ fontSize: "0.85rem", padding: "8px 20px" }}
            >
              Submit Answer
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
