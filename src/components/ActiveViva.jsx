"use client";

import React, { useState, useEffect, useRef } from "react";
import { VoiceManager } from "@/services/voiceManager";
import { SpeechManager } from "@/services/speechManager";
import { EXAMINER_PERSONALITIES } from "@/utils/mockData";
import { QuestionGraphEngine } from "@/services/QuestionGraphEngine";
import { AnswerEvaluationService } from "@/services/AnswerEvaluationService";
import { SessionContextManager } from "@/services/SessionContextManager";
import ExaminerAvatar from "@/components/ExaminerAvatar";

// Helper to guarantee render purity by getting timestamp outside component scope
function getNow() {
  return Date.now();
}

export default function ActiveViva({ config, activeUser, onFinishViva }) {
  // State machine variables
  const [vivaState, setVivaState] = useState(() => config.isResume ? "speaking" : "intro"); // "intro" | "speaking" | "listening" | "analyzing" | "generating"
  const [visualState, setVisualState] = useState("speaking"); // "speaking" | "listening" | "analyzing"
  const [statusText, setStatusText] = useState(() => config.isResume ? "Professor is speaking..." : "Professor is introducing the exam...");
  
  // Timer stopwatch states
  const [timeRemaining, setTimeRemaining] = useState(config.duration * 60);
  
  // Q&A memory tracking
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(() => config.isResume ? config.resumeState.currentQuestionIndex : 0);
  const [activeQuestion, setActiveQuestion] = useState(() => config.isResume ? config.resumeState.activeQuestion : null);
  const [transcriptText, setTranscriptText] = useState(() => config.isResume ? "Resumed session. Speak or type your answer..." : "Waiting to transcribe your response...");
  const [isPlaceholder, setIsPlaceholder] = useState(true);
  const [lastEvalRecord, setLastEvalRecord] = useState(null);

  // Fallback and Input values
  const [fallbackMode, setFallbackMode] = useState(false);
  const [writtenAnswer, setWrittenAnswer] = useState("");
  
  const speechStartTime = useRef(0);
  const waveIntervalRef = useRef(null);
  const [failsafeWarning, setFailsafeWarning] = useState(null);
  const interruptedRef = useRef(false);
  const latestNervousnessRef = useRef(20);
  
  // Live Biometric Synchronization
  const [liveMetrics, setLiveMetrics] = useState({ confidence: 85, nervousness: 15, clarity: 80, hesitation: 10 });
  const [liveStatusText, setLiveStatusText] = useState("Calibration active. Ready.");
  const liveTrackerRef = useRef(null);

  // Main initial hook: starts the stopwatch timer and loads synthesis
  useEffect(() => {
    // 1. VoiceManager Init
    VoiceManager.init();
    
    // Register failsafe callback
    VoiceManager.onFailsafeActive = (msg) => {
      setFailsafeWarning(msg);
    };

    // 2. Stopwatch interval
    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          alert("Time is up! Let's proceed to your final evaluation.");
          handleFinish(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // 3. Trigger speech sequence (Intro or Resume)
    if (config.isResume) {
      // Restore SessionContextManager state
      SessionContextManager.askedQuestions = config.resumeState.askedQuestions || [];
      SessionContextManager.answerTranscripts = config.resumeState.answerTranscripts || [];
      SessionContextManager.detectedEmotions = config.resumeState.detectedEmotions || [];
      SessionContextManager.weakConcepts = config.resumeState.weakConcepts || [];
      SessionContextManager.confidenceEvolution = config.resumeState.confidenceEvolution || [];
      SessionContextManager.askedTopics = config.resumeState.askedTopics || [];

      // Repeat the active question upon resume!
      const resumeNudge = `Resuming your exam on ${config.topic}. Let me repeat the question: ${config.resumeState.activeQuestion.text}`;
      VoiceManager.speak(resumeNudge, config.personality,
        () => {
          setVisualState("speaking");
          setStatusText("Professor is speaking...");
          startWaveAnimations();
          if (config.personality !== "friendly") {
            startBackgroundListeningForInterruptions(config.resumeState.activeQuestion);
          }
        },
        () => {
          if (interruptedRef.current) return;
          startListeningMode();
        }
      );
    } else {
      setTimeout(() => {
        triggerIntroduction();
      }, 500);
    }

    return () => {
      clearInterval(timer);
      stopAudioStreams();
      clearInterval(waveIntervalRef.current);
      if (liveTrackerRef.current) clearInterval(liveTrackerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopAudioStreams() {
    VoiceManager.stop();
    SpeechManager.stop();
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
        const fillers = ["umm", "uhm", "uh", "like", "basically", "actually"];
        let fillerCount = 0;
        words.forEach(w => {
          if (fillers.includes(w)) fillerCount++;
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
    setStatusText("Professor interrupted you...");
    
    const interruptionPhrases = {
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
    setStatusText("Professor is initializing the exam...");
    
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
        targetSubtopic: config.targetSubtopic || null
      });
      
      setActiveQuestion(firstQuestion);
      
      // Dynamic intro speech: combine dynamic introductory greetings based on personality and user name
      let greeting = config.isTargetDrill 
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
      
      const fullSpeech = greeting + (firstQuestion.speech || firstQuestion.text);
      
      // Preload the intro speech
      VoiceManager.preload(fullSpeech, config.personality);

      setVivaState("speaking");
      VoiceManager.speak(fullSpeech, config.personality,
        // onStart
        () => {
          setVisualState("speaking");
          setStatusText("Professor is speaking...");
          startWaveAnimations();
          if (config.personality !== "friendly") {
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
      // Fallback
      const fallback = QuestionGraphEngine.getRuleBasedOfflineFallback(1, config.personality, config.topic);
      setActiveQuestion(fallback);
      
      // Preload fallback speech
      VoiceManager.preload(fallback.speech, config.personality);

      setVivaState("speaking");
      VoiceManager.speak(fallback.speech, config.personality,
        () => {
          setVisualState("speaking");
          setStatusText("Professor is speaking...");
          startWaveAnimations();
          if (config.personality !== "friendly") {
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

  // Phase 2: Dynamic Listening
  function startListeningMode() {
    setVivaState("listening");
    setVisualState("listening");
    setStatusText("Listening to your answer...");
    setTranscriptText("Speak now. System is listening...");
    setIsPlaceholder(true);
    
    speechStartTime.current = getNow();
    startListeningWaveAnimations();

    SpeechManager.start({
      onResult: (interim, final) => {
        if (!final && !interim) {
          setTranscriptText("Speak now. System is listening...");
          setIsPlaceholder(true);
        } else {
          setTranscriptText(final + (interim ? ` ${interim}` : ""));
          setIsPlaceholder(false);
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
      onSilenceDetected: (finalTranscriptText) => {
        // Hands-free auto submit
        SpeechManager.stop();
        processResponse(finalTranscriptText);
      },
      onAudioCaptured: (audioBlob) => {
        handleHumeEmotionAnalysis(audioBlob, currentQuestionIndex);
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
    setVisualState("listening");
    setStatusText("Keyboard Fallback Active");
    setTranscriptText("Please type your detailed explanation inside the box below.");
    setIsPlaceholder(true);
  }

  async function processResponse(answerText) {
    if (!activeQuestion) {
      console.warn("Speech input captured before activeQuestion was set, ignoring.");
      return;
    }
    if (!answerText || answerText.length < 5) {
      answerText = "[Student remained silent or provided no substantive answer]";
    }

    setVivaState("analyzing");
    setVisualState("analyzing");
    setStatusText("Examiner is evaluating your answer...");
    setTranscriptText(answerText);
    setIsPlaceholder(false);
    clearInterval(waveIntervalRef.current);

    const durationMs = getNow() - speechStartTime.current;
    const pauseCount = SpeechManager.gapsHistory.length;

    try {
      const resultMetrics = await AnswerEvaluationService.evaluateResponse({
        question: activeQuestion.text,
        answer: answerText,
        syllabus: config.syllabusStructure,
        speechDurationMs: durationMs,
        pauseCount: pauseCount,
        liveMetrics: liveMetrics
      });

      // Track nervousness for dynamic pressure adaptations
      latestNervousnessRef.current = resultMetrics.nervousness || 20;

      // Record in SessionContextManager
      SessionContextManager.recordRound({
        questionText: activeQuestion.text,
        answerText: answerText,
        metrics: resultMetrics,
        questionObj: activeQuestion
      });

      // Also record the topic asked for custom strengths computation
      if (activeQuestion.topic) {
        if (!SessionContextManager.askedTopics) {
          SessionContextManager.askedTopics = [];
        }
        SessionContextManager.askedTopics.push({
          topic: activeQuestion.topic,
          metrics: resultMetrics
        });
      }

      // Save visual reaction state
      setLastEvalRecord({
        correctness: resultMetrics.correctness,
        tag: resultMetrics.tag
      });

      // Update status text based on reaction
      let reactionText = "Professor is noting your response...";
      if (resultMetrics.correctness >= 75) {
        reactionText = `${EXAMINER_PERSONALITIES[config.personality].name} is pleased with your answer.`;
      } else if (resultMetrics.correctness < 55 || resultMetrics.tag === "Bluffing" || resultMetrics.tag === "Incorrect") {
        reactionText = `${EXAMINER_PERSONALITIES[config.personality].name} looks skeptical.`;
      }
      setStatusText(reactionText);

      // Delay transition to let user register visual reaction
      setTimeout(async () => {
        // Clear evaluation reaction so face resets
        setLastEvalRecord(null);

        // Progress to next question or end
        const qIndex = currentQuestionIndex + 1;
        if (qIndex >= 4) {
          handleFinish(false);
          return;
        }

        setCurrentQuestionIndex(qIndex);
        setVivaState("generating");
        setVisualState("analyzing");
        setStatusText("Formulating next question...");

        try {
          const nextQuestion = await QuestionGraphEngine.generateNextQuestion({
            syllabus: config.syllabusStructure,
            personality: config.personality,
            duration: config.duration,
            askedList: SessionContextManager.askedQuestions,
            answersList: SessionContextManager.answerTranscripts,
            lastEvaluationTag: resultMetrics.tag,
            currentTopic: activeQuestion.topic,
            nervousness: latestNervousnessRef.current,
            isTargetDrill: config.isTargetDrill || false,
            targetSubtopic: config.targetSubtopic || null
          });

          setActiveQuestion(nextQuestion);
          // Preload next question speech!
          VoiceManager.preload(nextQuestion.speech, config.personality);

          setVivaState("speaking");
          VoiceManager.speak(nextQuestion.speech, config.personality,
            () => {
              setVisualState("speaking");
              setStatusText("Professor is speaking...");
              startWaveAnimations();
              if (config.personality !== "friendly") {
                startBackgroundListeningForInterruptions(nextQuestion);
              }
            },
            () => {
              if (interruptedRef.current) return;
              startListeningMode();
            }
          );
        } catch (nextErr) {
          console.error("Failed to generate next question in delayed block:", nextErr);
          // Catch and handle fallback inside delayed try
          const qIdx = currentQuestionIndex + 1;
          setCurrentQuestionIndex(qIdx);
          setVivaState("generating");
          setVisualState("analyzing");
          setStatusText("Formulating next question...");

          const nextQuestion = QuestionGraphEngine.getRuleBasedOfflineFallback(qIdx + 1, config.personality, activeQuestion.topic);
          setActiveQuestion(nextQuestion);
          VoiceManager.preload(nextQuestion.speech, config.personality);

          setVivaState("speaking");
          VoiceManager.speak(nextQuestion.speech, config.personality,
            () => {
              setVisualState("speaking");
              setStatusText("Professor is speaking...");
              startWaveAnimations();
              if (config.personality !== "friendly") {
                startBackgroundListeningForInterruptions(nextQuestion);
              }
            },
            () => {
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
      const fallbackMetrics = AnswerEvaluationService.getLocalFallbackMetrics(liveMetrics || localDelivery, answerText);
      
      SessionContextManager.recordRound({
        questionText: activeQuestion.text,
        answerText: answerText,
        metrics: fallbackMetrics,
        questionObj: activeQuestion
      });

      if (!SessionContextManager.askedTopics) {
        SessionContextManager.askedTopics = [];
      }
      SessionContextManager.askedTopics.push({
        topic: activeQuestion.topic || "Syllabus Fundamentals",
        metrics: fallbackMetrics
      });

      // Save visual reaction state
      setLastEvalRecord({
        correctness: fallbackMetrics.correctness,
        tag: fallbackMetrics.tag
      });

      // Update status text based on reaction
      let reactionText = "Professor is noting your response...";
      if (fallbackMetrics.correctness >= 75) {
        reactionText = `${EXAMINER_PERSONALITIES[config.personality].name} is pleased with your answer.`;
      } else if (fallbackMetrics.correctness < 55 || fallbackMetrics.tag === "Bluffing" || fallbackMetrics.tag === "Incorrect") {
        reactionText = `${EXAMINER_PERSONALITIES[config.personality].name} looks skeptical.`;
      }
      setStatusText(reactionText);

      // Delay transition to let user register visual reaction
      setTimeout(() => {
        // Clear evaluation reaction so face resets
        setLastEvalRecord(null);

        const qIndex = currentQuestionIndex + 1;
        if (qIndex >= 4) {
          handleFinish(false);
          return;
        }

        setCurrentQuestionIndex(qIndex);
        setVivaState("generating");
        setVisualState("analyzing");
        setStatusText("Formulating next question...");

        const nextQuestion = QuestionGraphEngine.getRuleBasedOfflineFallback(qIndex + 1, config.personality, activeQuestion.topic);
        setActiveQuestion(nextQuestion);
        // Preload next question speech!
        VoiceManager.preload(nextQuestion.speech, config.personality);

        setVivaState("speaking");
        VoiceManager.speak(nextQuestion.speech, config.personality,
          () => {
            setVisualState("speaking");
            setStatusText("Professor is speaking...");
            startWaveAnimations();
            if (config.personality !== "friendly") {
              startBackgroundListeningForInterruptions(nextQuestion);
            }
          },
          () => {
            if (interruptedRef.current) return;
            startListeningMode();
          }
        );
      }, 3200);
    }
  };

  const handlePauseSession = () => {
    stopAudioStreams();
    clearInterval(waveIntervalRef.current);
    
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
    alert("Your oral examination session has been paused and saved securely. You can resume it anytime from the dashboard!");
    onFinishViva(null); // Return directly to dashboard
  };

  function handleFinish(endedEarly = false) {
    stopAudioStreams();
    clearInterval(waveIntervalRef.current);
    
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

    onFinishViva({
      ...baseReport,
      askedTopics: SessionContextManager.askedTopics || [],
      endedEarly,
      sessionConfidenceScores: SessionContextManager.confidenceEvolution,
      dynamicStrengths,
      dynamicWeaknesses,
      dynamicRevisions,
      isLastMinute: config.isLastMinute || false,
      isMockExternal: config.isMockExternal || false,
      examinerPersonality: config.personality
    });
  };

  // Unified Submission for Oral & Keyboard Modes
  const handleSubmit = () => {
    if (fallbackMode) {
      if (!writtenAnswer.trim()) return;
      const textToSubmit = writtenAnswer.trim();
      setWrittenAnswer("");
      setFallbackMode(false);
      processResponse(textToSubmit);
    } else {
      // Force submit current oral microphone transcript
      SpeechManager.stop();
      
      let textToSubmit = transcriptText;
      if (isPlaceholder || !textToSubmit || textToSubmit.includes("Speak now") || textToSubmit.includes("System is listening")) {
        textToSubmit = "[Student force-submitted response early without substantive oral recording]";
      }
      
      processResponse(textToSubmit);
    }
  };

  // Wave Animations
  function startWaveAnimations() {
    clearInterval(waveIntervalRef.current);
    waveIntervalRef.current = setInterval(() => {
      const bars = document.querySelectorAll("#viva-waveform .waveform-bar");
      bars.forEach(bar => {
        const height = Math.floor(Math.random() * 26) + 6;
        bar.style.height = `${height}px`;
      });
    }, 150);
  }

  function startListeningWaveAnimations() {
    clearInterval(waveIntervalRef.current);
    // Initialize bars at baseline flat level (4px)
    const bars = document.querySelectorAll("#viva-waveform .waveform-bar");
    bars.forEach(bar => {
      bar.style.height = "4px";
    });
  }

  function triggerSpeechWavePulse() {
    // Pulse animation superseded by live volume physics
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
            />
          </div>

          <div className="examiner-status-tag" id="examiner-status">
            <span className="status-pulse-dot"></span>
            <span id="examiner-status-text">{statusText}</span>
          </div>

          {/* wave audio rendering */}
          <div className="waveform-container" id="viva-waveform">
            <div className="waveform-bar" style={{ height: "12px" }}></div>
            <div className="waveform-bar" style={{ height: "24px" }}></div>
            <div className="waveform-bar" style={{ height: "8px" }}></div>
            <div className="waveform-bar" style={{ height: "18px" }}></div>
            <div className="waveform-bar" style={{ height: "32px" }}></div>
            <div className="waveform-bar" style={{ height: "14px" }}></div>
            <div className="waveform-bar" style={{ height: "20px" }}></div>
            <div className="waveform-bar" style={{ height: "8px" }}></div>
            <div className="waveform-bar" style={{ height: "28px" }}></div>
            <div className="waveform-bar" style={{ height: "16px" }}></div>
            <div className="waveform-bar" style={{ height: "10px" }}></div>
          </div>

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
              {fallbackMode ? "Microphone access blocked." : vivaState === "listening" ? "Microphone active. Speak naturally." : "Microphone inactive while examiner speaks."}
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
                <span>Student Biometric Sync</span>
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
              {vivaState === "listening" ? "Student Oral Response (Live)" : "Transcription Output"}
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
                      handleKeyboardSubmit();
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
            {activeQuestion ? `"${activeQuestion.text}"` : '"Loading examination question..."'}
          </div>
          
          <div className="viva-card-controls">
            <div style={{ display: "flex", gap: "var(--space-xs)" }}>
              <button className="btn btn-secondary" onClick={handlePauseSession} style={{ fontSize: "0.85rem", padding: "8px 16px" }}>
                Pause Exam
              </button>
              <button className="btn btn-secondary" onClick={() => handleFinish(true)} style={{ fontSize: "0.85rem", padding: "8px 16px", color: "var(--color-error)", borderColor: "var(--color-error-bg)" }}>
                End Exam
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
