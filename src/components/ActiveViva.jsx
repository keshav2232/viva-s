"use client";

import React, { useState, useEffect, useRef } from "react";
import { VoiceManager } from "@/services/voiceManager";
import { SpeechManager } from "@/services/speechManager";
import { EXAMINER_PERSONALITIES } from "@/utils/mockData";
import { QuestionGraphEngine } from "@/services/QuestionGraphEngine";
import { AnswerEvaluationService } from "@/services/AnswerEvaluationService";
import { TurnService } from "@/services/ai/TurnService";
import { SessionContextManager } from "@/services/SessionContextManager";
import { HindsightEngine } from "@/services/HindsightEngine";
import room from "./ActiveViva.module.css";
import MicrophoneCheck from "@/components/MicrophoneCheck";
import ExaminerAvatar from "@/components/ExaminerAvatar";
import { getQuestionCountForDuration } from "@/utils/pacing";
import { vivaFetch } from "@/utils/apiClient";

// Helper to guarantee render purity by getting timestamp outside component scope
// Silence ladder: what each professor does, one step at a time, while the student is stuck.
const SILENCE_STEPS = {
  friendly: ["rephrase", "hint", "simplify"],
  strict: ["definition", "moveOn"],
  brutal: ["prod", "moveOn"],
  terror: ["subquestion", "subquestion", "moveOn"]
};
const THINK_MS = 8000; // thinking time before the first words (and again after each nudge)
const STALL_MS = 6000; // pause after a few words that do not yet make an answer
const ANSWERING_WORDS = 8; // from this many words on, silence means "finished" (auto-submit handles it)
const countWords = (text) => (text || "").trim().split(/\s+/).filter(Boolean).length;

const FOLLOW_UP_LABELS = {
  apply: "apply it",
  clarify: "clarify",
  precision: "be precise",
  simplify: "back to basics",
  challenge: "challenge",
  counter_example: "counter-example",
  deepen: "go deeper",
  expose: "prove it"
};

// How long the examiner reaction stays on screen before the next question (its voice is fetched meanwhile).
const REACTION_MS = 1100;

function getNow() {
  return Date.now();
}

export default function ActiveViva({ config, activeUser, onFinishViva, onBack }) {
  const getPersonaTitle = (p, mode) => {
    const cleanType = p?.toLowerCase();
    if (cleanType === "friendly") return mode === "professional" ? "Warm Recruiter" : "Friendly Professor";
    if (cleanType === "strict") return mode === "professional" ? "Structured Hiring Manager" : "Strict Professor";
    if (cleanType === "brutal") return mode === "professional" ? "Bar Raiser" : "Brutal External";
    if (cleanType === "terror") return mode === "professional" ? "Stress Interviewer" : "Viva Terror";
    return mode === "professional" ? "AI Interviewer" : "AI Examiner";
  };

  const totalQuestions = getQuestionCountForDuration(config.duration);

  // State machine variables
  const [vivaState, setVivaState] = useState(() => config.isResume ? "speaking" : "intro"); // "intro" | "speaking" | "listening" | "analyzing" | "generating"
  const [visualState, setVisualState] = useState("speaking"); // "speaking" | "listening" | "analyzing"
  const [statusText, setStatusText] = useState(() => 
    config.isResume 
      ? (config.mode === "professional" ? "Interviewer is speaking..." : "Professor is speaking...") 
      : (config.mode === "professional" ? "Interviewer is introducing the session..." : "Professor is introducing the exam...")
  );
  
  // Timer stopwatch states
  const [timeRemaining, setTimeRemaining] = useState(() => (config.isResume && Number.isFinite(config.resumeState?.timeRemaining) && config.resumeState.timeRemaining > 0) ? config.resumeState.timeRemaining : config.duration * 60);
  
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
  const waveIntervalRef = useRef(null);
  const [failsafeWarning, setFailsafeWarning] = useState(null);
  const latestNervousnessRef = useRef(20);
  
  // Hesitation Monitor & Local Audio Replay states/refs
  const [hesitationPenalties, setHesitationPenalties] = useState({});
  const hesitationTimerRef = useRef(null);
  const silenceStepRef = useRef(0); // next step of the professor's silence ladder for this question
  const answerPrefixRef = useRef(""); // words said before a nudge; they still count towards the answer
  const spokenRef = useRef(""); // everything said so far for the current question (prefix + live)
  const [nudgeNote, setNudgeNote] = useState(null); // hint / simpler question shown under the question
  const recordedAudiosRef = useRef({});
  
  // Live Biometric Synchronization
  const [liveMetrics, setLiveMetrics] = useState({ confidence: 85, nervousness: 15, clarity: 80, hesitation: 10 });
  const liveTrackerRef = useRef(null);

  const introTimeoutRef = useRef(null);
  const transitionTimeoutRef = useRef(null);
  const isMountedRef = useRef(true);
  const isProcessingRef = useRef(false); // an answer is being evaluated (blocks duplicate submits)
  const hasFinishedRef = useRef(false); // report already handed off (blocks double save)
  
  // Refs for tracking background evaluations
  const pendingAudioEvalRef = useRef(null); // { qIdx, resolve } while waiting for the recorder to finalise
  const firstQuestionPromiseRef = useRef(null); // first question is fetched while the mic check is on screen

  // Refs for tracking latest state values in async callbacks
  const activeQuestionRef = useRef(activeQuestion);
  const currentQuestionIndexRef = useRef(currentQuestionIndex);
  const hesitationPenaltiesRef = useRef(hesitationPenalties);
  const liveMetricsRef = useRef(liveMetrics);
  const transcriptTextRef = useRef(transcriptText);
  const timeRemainingRef = useRef(timeRemaining);
  const vivaStateRef = useRef(vivaState);
  const timeUpRef = useRef(false); // the clock ran out: the answer being given or graded is the last one

  useEffect(() => { activeQuestionRef.current = activeQuestion; }, [activeQuestion]);
  useEffect(() => { currentQuestionIndexRef.current = currentQuestionIndex; }, [currentQuestionIndex]);
  useEffect(() => { hesitationPenaltiesRef.current = hesitationPenalties; }, [hesitationPenalties]);
  useEffect(() => { liveMetricsRef.current = liveMetrics; }, [liveMetrics]);
  useEffect(() => { transcriptTextRef.current = transcriptText; }, [transcriptText]);
  useEffect(() => { timeRemainingRef.current = timeRemaining; }, [timeRemaining]);
  useEffect(() => { vivaStateRef.current = vivaState; }, [vivaState]);

  // Main initial hook: registers failsafes
  useEffect(() => {
    isMountedRef.current = true;
    // 1. VoiceManager Init
    VoiceManager.init();
    
    // Register failsafe callback
    VoiceManager.onFailsafeActive = (msg) => {
      if (isMountedRef.current) setFailsafeWarning(msg);
    };

    // Do not make the candidate wait after pressing "Ready": fetch the first question (and its
    // voice) now, while the microphone check is still on screen.
    if (!config.isResume && !firstQuestionPromiseRef.current) {
      SessionContextManager.reset();
      const pending = startFirstQuestion();
      firstQuestionPromiseRef.current = pending;
      pending.then((q) => {
        if (isMountedRef.current && q) VoiceManager.preload(buildGreeting() + (q.speech || q.text), config.personality);
      });
    }

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
          setTimeout(() => handleTimeUp(), 0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // 2. Trigger speech sequence (Intro or Resume)
    if (config.isResume) {
      // Restore SessionContextManager state
      SessionContextManager.askedQuestions = config.resumeState.askedQuestions || [];
      // Older pause files lack question objects; rebuild them so indices stay aligned.
      SessionContextManager.askedQuestionsObjects = config.resumeState.askedQuestionsObjects
        || SessionContextManager.askedQuestions.map(q => ({ text: q, speech: q, topic: "Syllabus Concept", difficulty: "Medium" }));
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
          startWaveAnimations();
        },
        () => {
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

  function getFormattedTime() {
    const mins = Math.floor(timeRemaining / 60);
    const secs = timeRemaining % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  // Phase 1: Examiner Greeting
  function startFirstQuestion() {
    return QuestionGraphEngine.startSession({
      syllabus: config.syllabusStructure,
      personality: config.personality,
      duration: config.duration,
      isTargetDrill: config.isTargetDrill || false,
      targetSubtopic: config.targetSubtopic || null,
      mode: config.mode
    });
  }

  function buildGreeting() {
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
    return greeting;
  }

  // Speak a question; `speech` may carry a spoken greeting/reaction in front of it.
  function speakQuestion(question, speech) {
    setVivaState("speaking");
    VoiceManager.speak(speech || question.speech || question.text, config.personality,
      () => {
        if (!isMountedRef.current) return;
        setVisualState("speaking");
        setStatusText(config.mode === "professional" ? "Interviewer is speaking..." : "Professor is speaking...");
        startWaveAnimations();
      },
      () => {
        if (!isMountedRef.current) return;
        startListeningMode();
      }
    );
  }

  async function triggerIntroduction() {
    setVivaState("generating");
    setVisualState("analyzing");
    setStatusText(config.mode === "professional" ? "Interviewer is initializing the session..." : "Professor is initializing the exam...");

    let firstQuestion;
    try {
      firstQuestion = await (firstQuestionPromiseRef.current || startFirstQuestion());
    } catch (err) {
      console.error("Failed to generate first question:", err);
      firstQuestion = QuestionGraphEngine.getRuleBasedOfflineFallback(1, config.personality, config.topic, config.syllabusStructure);
    }
    if (!isMountedRef.current) return;

    setActiveQuestion(firstQuestion);
    const fullSpeech = buildGreeting() + (firstQuestion.speech || firstQuestion.text);
    VoiceManager.preload(fullSpeech, config.personality); // no-op when the prefetch already cached it
    speakQuestion(firstQuestion, fullSpeech);
  }

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

  // Oral mode: the recording is attached to the single grading request so content AND voice are
  // judged together. We only wait when the recorder is still finalising (a few ms after stop()),
  // never on a fixed timer, and give up after 700 ms.
  const waitForAnswerAudio = async (qIdx) => {
    if (!SpeechManager.recordingPending) return null;
    const blob = await new Promise((resolve) => {
      pendingAudioEvalRef.current = { qIdx, resolve };
      setTimeout(() => resolve(null), 700);
    });
    pendingAudioEvalRef.current = null;
    return blob;
  };

  const offlineNudge = (step, q) => {
    const topic = q.topic || "this topic";
    if (step === "rephrase") return { hintText: q.text, hintSpeech: `Let me ask that another way. ${q.text}` };
    if (step === "subquestion") {
      return {
        subQuestionText: `What is the basic definition of ${topic}?`,
        subQuestionSpeech: `Let's simplify. What is the basic definition of ${topic}?`
      };
    }
    return {
      hintText: `Think about the core principles of ${topic}. What are its main variables or inputs?`,
      hintSpeech: `No worries. Think about the core principles of ${topic}. What are its main variables or inputs? Take your time.`
    };
  };

  const clearHesitationTimer = () => {
    if (hesitationTimerRef.current) {
      clearTimeout(hesitationTimerRef.current);
      hesitationTimerRef.current = null;
    }
  };

  // Schedules the next step of the silence ladder. A student who has said little or nothing gets
  // THINK_MS of thinking time (STALL_MS once they have started); once they are clearly answering,
  // silence means "finished" and the speech manager's auto-submit takes over instead.
  const resetHesitationTimer = () => {
    clearHesitationTimer();
    if (fallbackMode) return;
    const steps = SILENCE_STEPS[config.personality] || SILENCE_STEPS.friendly;
    if (silenceStepRef.current >= steps.length) return;
    const total = countWords(spokenRef.current);
    if (total >= ANSWERING_WORDS) return;
    const sinceNudge = total - countWords(answerPrefixRef.current);
    hesitationTimerRef.current = setTimeout(handleStudentHesitation, sinceNudge > 0 ? STALL_MS : THINK_MS);
  };

  async function fetchNudge(action, question, extra, fallback) {
    try {
      const res = await vivaFetch({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, question: question.text, topic: question.topic, answer: spokenRef.current, mode: config.mode, ...extra })
      });
      if (!res.ok) throw new Error(`${action} failed (${res.status})`);
      return await res.json();
    } catch (err) {
      console.warn(`Using offline ${action}:`, err);
      return fallback;
    }
  }

  // One step of the professor's silence ladder (SILENCE_STEPS). The student's words so far are kept.
  const handleStudentHesitation = async () => {
    clearHesitationTimer();
    const currentQ = activeQuestionRef.current;
    if (!currentQ || isProcessingRef.current) return;
    const persona = SILENCE_STEPS[config.personality] ? config.personality : "friendly";
    const steps = SILENCE_STEPS[persona];
    const step = steps[silenceStepRef.current];
    if (!step) return;
    const subStep = steps.slice(0, silenceStepRef.current + 1).filter((s) => s === "subquestion").length;
    silenceStepRef.current += 1;
    answerPrefixRef.current = spokenRef.current.trim();
    const qIdx = currentQuestionIndexRef.current;
    const title = getPersonaTitle(persona, config.mode);
    const lowTime = timeRemainingRef.current <= 60 ? "We have under a minute left. " : "";

    SpeechManager.stop();
    setVivaState("speaking");
    setVisualState("speaking");
    startWaveAnimations();

    if (step === "moveOn") {
      if (persona !== "strict") setHesitationPenalties((prev) => ({ ...prev, [qIdx]: true }));
      setStatusText(`${title} is moving on...`);
      const line = persona === "strict"
        ? "We will move on. I will note that answer as incomplete."
        : persona === "brutal" ? "Nothing? Fine. We move on, and that will cost you." : "Enough. We move on.";
      const soFar = answerPrefixRef.current;
      VoiceManager.speak(line, persona, null, () => processResponse(soFar));
      return;
    }

    let speech = "";
    let note = null;
    if (step === "rephrase" || step === "hint" || step === "simplify") {
      setStatusText(`${title} is helping you...`);
      const r = await fetchNudge("generate-hint", currentQ, { level: step }, offlineNudge(step, currentQ));
      speech = r.hintSpeech;
      note = step === "rephrase" ? `Asked another way: ${r.hintText}` : step === "simplify" ? `First step: ${r.hintText}` : `Hint: ${r.hintText}`;
    } else if (step === "subquestion") {
      setStatusText(`${title} is stepping in...`);
      setHesitationPenalties((prev) => ({ ...prev, [qIdx]: true }));
      const r = await fetchNudge("generate-subquestion", currentQ, { step: subStep }, offlineNudge("subquestion", currentQ));
      speech = r.subQuestionSpeech;
      note = `Simpler question: ${r.subQuestionText}`;
      // The grader is told about the simpler question; the original question text is not rewritten.
      setActiveQuestion((prev) => (prev ? { ...prev, subQuestions: [...(prev.subQuestions || []), r.subQuestionText] } : prev));
    } else if (step === "definition") {
      setStatusText(`${title} is waiting...`);
      speech = `${lowTime}Take a moment. Start with the precise definition${currentQ.topic ? ` of ${currentQ.topic}` : ""}, then build from there.`;
    } else if (step === "prod") {
      setStatusText(`${title} is waiting...`);
      speech = `${lowTime}Well? Anything at all? I'm waiting.`;
    }

    // The answer may have been submitted, or the question changed, while the nudge was fetched.
    if (!isMountedRef.current || isProcessingRef.current || activeQuestionRef.current?.text !== currentQ.text) return;
    if (note) setNudgeNote(note);
    VoiceManager.speak(speech, persona, null, () => startListeningMode(true));
  };

  // Phase 2: Dynamic Listening
  // keepAnswer: resuming after a nudge, so the words already said stay part of the answer.
  function startListeningMode(keepAnswer = false) {
    isProcessingRef.current = false;
    if (!keepAnswer) {
      answerPrefixRef.current = "";
      silenceStepRef.current = 0;
      speechStartTime.current = getNow();
      setNudgeNote(null);
    }
    const prefix = answerPrefixRef.current;
    spokenRef.current = prefix;
    setVivaState("listening");
    setVisualState("listening");
    setStatusText("Listening to your answer...");
    setTranscriptText(prefix || "Speak now. System is listening...");
    setIsPlaceholder(!prefix);

    startListeningWaveAnimations();
    resetHesitationTimer();

    SpeechManager.start({
      onResult: (interim, final) => {
        const live = (final + (interim ? ` ${interim}` : "")).trim();
        spokenRef.current = [prefix, live].filter(Boolean).join(" ");
        resetHesitationTimer();
        if (!spokenRef.current) {
          setTranscriptText("Speak now. System is listening...");
          setIsPlaceholder(true);
        } else {
          setTranscriptText(spokenRef.current);
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
        // Hands-free auto submit (the words said before any nudge are part of the answer)
        SpeechManager.stop();
        processResponse([prefix, finalTranscriptText].filter(Boolean).join(" ").trim());
      },
      onAudioCaptured: (audioBlob) => {
        const waiter = pendingAudioEvalRef.current;
        const qIdx = waiter ? waiter.qIdx : currentQuestionIndexRef.current;
        const usable = audioBlob && audioBlob.size > 100;
        if (usable) recordedAudiosRef.current[qIdx] = audioBlob; // kept for the results-page replay
        if (waiter) waiter.resolve(usable ? audioBlob : null);
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
    // Silence auto-submit, the Submit button and the timer can all fire for the same answer.
    if (isProcessingRef.current || hasFinishedRef.current) return;
    isProcessingRef.current = true;
    VoiceManager.stop();
    const currentQ = activeQuestionRef.current;
    if (!currentQ) {
      console.warn("Speech input captured before activeQuestion was set, ignoring.");
      isProcessingRef.current = false;
      return;
    }
    const qIdxStart = currentQuestionIndexRef.current;
    const hasPenalty = hesitationPenaltiesRef.current[qIdxStart] || false;

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
    clearInterval(waveIntervalRef.current);
    clearHesitationTimer();

    const durationMs = getNow() - speechStartTime.current;
    const pauseCount = SpeechManager.gapsHistory.length;

    // 1. Recording (only waits if the recorder is still finalising)
    let audioBase64 = null;
    if (!fallbackMode) {
      const blob = await waitForAnswerAudio(qIdxStart);
      if (blob) {
        try { audioBase64 = await blobToBase64(blob); } catch (e) { console.warn("Could not encode audio:", e); }
      }
    }

    // 2. ONE request: grade this answer AND get the next question
    const turn = await TurnService.submitTurn({
      config,
      // If a simpler sub-question was asked, the grader is told so it judges the answer fairly.
      question: currentQ.subQuestions?.length
        ? { ...currentQ, text: `${currentQ.text} (Then asked, simpler: ${currentQ.subQuestions.join(" / ")})` }
        : currentQ,
      answer: answerText,
      rounds: SessionContextManager.getRounds(),
      audioBase64,
      durationMs,
      pauseCount,
      liveMetrics: liveMetricsRef.current,
      nervousness: latestNervousnessRef.current,
      hasPenalty,
      timeLeftSec: timeRemainingRef.current
    });
    if (!isMountedRef.current || hasFinishedRef.current) return;

    const resultMetrics = turn.metrics;
    latestNervousnessRef.current = resultMetrics.nervousness || 20;

    SessionContextManager.recordRound({
      questionText: currentQ.text,
      answerText,
      metrics: resultMetrics,
      questionObj: currentQ
    });
    if (!SessionContextManager.askedTopics) SessionContextManager.askedTopics = [];
    SessionContextManager.askedTopics.push({
      topic: currentQ.topic || (config.mode === "professional" ? "Role Core Competence" : "Syllabus Fundamentals"),
      metrics: resultMetrics
    });

    // 3. Show the examiner reaction while the next question voice is already being prepared
    setLastEvalRecord({ correctness: resultMetrics.correctness, tag: resultMetrics.tag });
    let reactionText = config.mode === "professional" ? "Interviewer is noting your response..." : "Professor is noting your response...";
    if (resultMetrics.correctness >= 75) {
      reactionText = `${getPersonaTitle(config.personality, config.mode)} is pleased with your answer.`;
    } else if (resultMetrics.correctness < 55 || resultMetrics.tag === "Bluffing") {
      reactionText = `${getPersonaTitle(config.personality, config.mode)} looks skeptical.`;
    }
    setStatusText(reactionText);

    // The server chose a follow-up on this answer, a new main question, or the end of the session.
    // The session runs on time: the server ends it when too little time is left for another question.
    const isLast = turn.done || timeUpRef.current;
    const currentMain = currentQ.mainNumber || 1;
    let nextQuestion = null;
    if (!isLast) {
      const picked = turn.next || {
        ...QuestionGraphEngine.getRuleBasedOfflineFallback(currentMain + 1, config.personality, currentQ.topic, config.syllabusStructure),
        kind: "new_topic", depth: 0
      };
      nextQuestion = { ...picked, mainNumber: picked.depth > 0 ? currentMain : currentMain + 1 };
      if (picked.depth > 0) setStatusText(`${getPersonaTitle(config.personality, config.mode)} wants to dig deeper...`);
    }
    if (nextQuestion) VoiceManager.preload(nextQuestion.speech || nextQuestion.text, config.personality);

    transitionTimeoutRef.current = setTimeout(() => {
      if (!isMountedRef.current) return;
      setLastEvalRecord(null);
      if (isLast) {
        handleFinish(false);
        return;
      }
      setCurrentQuestionIndex(qIdxStart + 1);
      setActiveQuestion(nextQuestion);
      speakQuestion(nextQuestion);
    }, REACTION_MS);
  }

  const handlePauseSession = () => {
    stopAudioStreams();
    clearInterval(waveIntervalRef.current);
    clearHesitationTimer();
    
    const pauseState = {
      config,
      activeUser,
      currentQuestionIndex,
      activeQuestion,
      timeRemaining,
      askedQuestions: SessionContextManager.askedQuestions,
      askedQuestionsObjects: SessionContextManager.askedQuestionsObjects,
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

  // Time is up. An answer in progress is still graded (it becomes the last one) instead of being lost.
  function handleTimeUp() {
    timeUpRef.current = true;
    clearHesitationTimer();
    if (hasFinishedRef.current || isProcessingRef.current) return; // a turn in flight finishes the session
    const spoken = spokenRef.current.trim();
    if (vivaStateRef.current === "listening" && spoken) {
      setStatusText("Time is up. Grading your last answer...");
      SpeechManager.stop();
      processResponse(spoken);
      return;
    }
    handleFinish(false);
  }

  function handleFinish(endedEarly = false) {
    if (hasFinishedRef.current) return;
    hasFinishedRef.current = true;
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
    const hindsightPromise = HindsightEngine.analyze({
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
      return hindsightResult;
    }).catch(err => {
      console.warn("HindsightEngine failed, results will use original data:", err);
      reportPayload.hindsightLoading = false;
      return null;
    });

    // The second argument lets the host persist the retrospective once it resolves.
    onFinishViva(reportPayload, hindsightPromise);
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

  if (!sessionUnlocked) {
    return <MicrophoneCheck config={config} examiner={getPersonaTitle(config.personality, config.mode)} onBack={onBack} onReady={() => {
      try { window.speechSynthesis.speak(new SpeechSynthesisUtterance("")); } catch {}
      setSessionUnlocked(true);
    }} />;
  }

  return (
    <section id="active-viva-screen" className={`screen active ${room.room}`}>
      <div className={room.roomHeader}><div><span>PREPSIM / PRACTICE ROOM</span><h1>{config.mode === "professional" ? "The interview room." : "Your viva, in session."}</h1></div><p>Listen carefully. Take a breath. Think aloud.</p></div>
      <div className={room.roomGrid}>
      <aside className={room.brief} aria-label="Session brief">
        <span className={room.eyebrow}>SESSION BRIEF</span><h2>{config.mode === "professional" ? "Mock interview" : "Oral examination"}</h2>
        <dl><div><dt>Candidate</dt><dd>{activeUser || "Guest"}</dd></div><div><dt>Subject / role</dt><dd>{config.topic}</dd></div><div><dt>Examiner</dt><dd>{getPersonaTitle(config.personality, config.mode)}</dd></div><div><dt>Planned duration</dt><dd>{config.duration} minutes</dd></div><div><dt>Scope</dt><dd>{config.isTargetDrill ? config.targetSubtopic : "Full practice outline"}</dd></div></dl>
        <div className={room.deskArt} aria-hidden="true"><span>PREPSIM</span><strong>Practice.<br/>Reflect.<br/>Repeat.</strong><i>FIELD NOTES / ORAL PRACTICE</i></div>
        <div className={room.guidelines}><h3>A good answer has a shape.</h3><ol><li>Start with the core idea.</li><li>Explain your reasoning.</li><li>Add an example or application.</li></ol><p>Need a moment? It’s okay to pause and organise your thoughts.</p></div>
      </aside>
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
          fontSize: "0.875rem",
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

        <div className={room.examinerPlate}><span>YOUR {config.mode === "professional" ? "INTERVIEWER" : "EXAMINER"}</span><strong>{getPersonaTitle(config.personality, config.mode)}</strong><small>AI practice examiner</small></div>
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
            <div className="btn-mic" id="btn-microphone" role="img" aria-label={vivaState === "listening" && !fallbackMode ? "Microphone listening" : "Microphone inactive"}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                <line x1="12" y1="19" x2="12" y2="23"></line>
                <line x1="8" y1="23" x2="16" y2="23"></line>
              </svg>
            </div>
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
                style={{ fontSize: "0.875rem", padding: "4px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)", cursor: "pointer", transition: "var(--transition-smooth)" }}
              >
                Switch to Keyboard Input
              </button>
            )}
          </div>

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
                <label className="form-label" htmlFor="viva-fallback-input" style={{ fontSize: "0.85rem" }}>Type your answer below and press Enter or Submit:</label>
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
            {(activeQuestion?.mainNumber || currentQuestionIndex + 1) > totalQuestions
              ? "Bonus question"
              : `Question ${activeQuestion?.mainNumber || currentQuestionIndex + 1} of ${totalQuestions}`}
            {activeQuestion?.depth > 0 && ` · Follow-up${FOLLOW_UP_LABELS[activeQuestion.followUpType] ? `: ${FOLLOW_UP_LABELS[activeQuestion.followUpType]}` : ""}`}
          </span>
          <div className="viva-question-content" id="viva-question-content-text">
            {activeQuestion ? `"${activeQuestion.text}"` : (config.mode === "professional" ? '"Loading interview question..."' : '"Loading examination question..."')}
          </div>
          {nudgeNote && <p className="viva-nudge-note" role="status">{nudgeNote}</p>}
          
          <div className="viva-card-controls">
            <div style={{ display: "flex", gap: "var(--space-xs)" }}>
              <button className="btn btn-secondary" onClick={handlePauseSession} style={{ fontSize: "0.9rem", padding: "8px 16px" }}>
                {config.mode === "professional" ? "Pause Interview" : "Pause Exam"}
              </button>
              <button className="btn btn-secondary" onClick={() => handleFinish(true)} style={{ fontSize: "0.9rem", padding: "8px 16px", color: "var(--color-error)", borderColor: "var(--color-error-bg)" }}>
                {config.mode === "professional" ? "End Interview" : "End Exam"}
              </button>
            </div>
            <button 
              className="btn btn-primary" 
              id="btn-next-question" 
              onClick={handleSubmit}
              disabled={vivaState !== "listening"}
              style={{ fontSize: "0.9rem", padding: "8px 20px" }}
            >
              Submit Answer
            </button>
          </div>
        </div>
      </div>
      </div>
      <div className={room.bottomNote}><span>PREPSIM · PRACTICE, NOT A FORMAL ASSESSMENT</span><p>Your aim is a clear explanation, not a perfect performance.</p></div>
    </section>
  );
}
