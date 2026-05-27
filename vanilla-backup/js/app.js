/**
 * VivaSim - Core Live Viva Engine & State Coordinator
 * Pure Vanilla JavaScript State Machine & Real-Time Orchestrator
 */

// ==========================================
// STATE DEFINITION
// ==========================================
const appState = {
  activeUser: "Keshav",
  sessions: [...DEFAULT_SESSIONS],
  stats: { ...INITIAL_STATS },
  
  // Navigation & Wizard State
  currentScreen: "auth-screen",
  currentStep: 1,
  
  // Setup Selection Details
  selectedSource: "syllabus", // "syllabus" | "topic"
  selectedTopic: "Thermodynamics",
  selectedDuration: 5, // minutes
  selectedPersonality: "friendly", // friendly | strict | brutal | terror
  syllabusUploaded: false,
  syllabusContent: "",
  
  // ==========================================
  // NEW CORE VOICE VIVA STATE MACHINE
  // ==========================================
  vivaActive: false,
  vivaState: "idle", // idle | intro | speaking | listening | analyzing | generating | completed
  
  vivaQuestions: [], // history of questions presented
  askedQuestions: [], // list of question strings asked
  answerTranscripts: [], // student spoken transcripts
  detectedEmotions: [], // records emotion metrics per answer
  weakConcepts: [], // keywords where student scored low clarity
  confidenceEvolution: [], // records confidence over timeline
  
  vivaTimeRemaining: 0,
  vivaTimerTotal: 0,
  vivaTimerInterval: null,
  
  // Fallback and Input control
  fallbackMode: false,
  speechStartTime: 0,
  activeBranchKey: "intro"
};

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  initEventListeners();
  renderDashboard();
  showScreen("auth-screen"); // Start at login
});

// ==========================================
// ROUTING & VIEW CONTROLLER
// ==========================================
function showScreen(screenId) {
  appState.currentScreen = screenId;
  
  // Hide all screens
  document.querySelectorAll(".screen").forEach(screen => {
    screen.classList.remove("active");
  });
  
  // Show target screen
  const targetScreen = document.getElementById(screenId);
  if (targetScreen) {
    targetScreen.classList.add("active");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Manage navigation header visibility
  const header = document.getElementById("app-header");
  if (screenId === "auth-screen" || screenId === "active-viva-screen") {
    header.style.display = "none";
  } else {
    header.style.display = "block";
    updateHeaderProfile();
  }
}

function updateHeaderProfile() {
  const avatarLetters = document.getElementById("avatar-letters");
  const displayName = document.getElementById("user-display-name");
  
  if (avatarLetters && displayName) {
    avatarLetters.textContent = appState.activeUser.charAt(0).toUpperCase();
    displayName.textContent = appState.activeUser;
  }
}

// ==========================================
// EVENT LISTENERS & DELEGATION
// ==========================================
function initEventListeners() {
  // Logo home click
  document.getElementById("nav-logo").addEventListener("click", () => {
    if (!appState.vivaActive) showScreen("dashboard-screen");
  });

  // Start new Viva CTA
  document.getElementById("btn-start-viva-cta").addEventListener("click", () => {
    resetSetupWizard();
    showScreen("setup-screen");
  });

  // Google Sign-In mockup
  document.getElementById("btn-google-auth").addEventListener("click", () => {
    appState.activeUser = "Keshav";
    showScreen("dashboard-screen");
  });

  // Guest sign-in
  document.getElementById("btn-guest-auth").addEventListener("click", () => {
    appState.activeUser = "Guest Student";
    showScreen("dashboard-screen");
  });

  // Log Out button
  document.getElementById("btn-logout").addEventListener("click", () => {
    appState.activeUser = "Keshav";
    showScreen("auth-screen");
  });

  // Begin Exam button
  document.getElementById("btn-begin-viva").addEventListener("click", () => {
    startViva();
  });

  // End Viva early
  document.getElementById("btn-end-viva-early").addEventListener("click", () => {
    if (confirm("Are you sure you want to end this examination early? Your progress will not be fully graded.")) {
      finishViva(true); // end early
    }
  });

  // Submit Answer CTA (keyboard fallback or manual submit override)
  document.getElementById("btn-next-question").addEventListener("click", () => {
    submitWrittenAnswer();
  });

  // Fallback keyboard Enter submission
  const textInput = document.getElementById("viva-fallback-input");
  if (textInput) {
    textInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        submitWrittenAnswer();
      }
    });
  }

  // Results CTA pathways
  document.getElementById("btn-practice-again").addEventListener("click", () => {
    resetSetupWizard();
    showScreen("setup-screen");
  });

  document.getElementById("btn-results-to-dashboard").addEventListener("click", () => {
    showScreen("dashboard-screen");
  });

  // Setup drag-and-drop actions for Syllabus Upload
  const dropzone = document.getElementById("syllabus-drag-drop");
  if (dropzone) {
    ['dragenter', 'dragover'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
      }, false);
    });

    dropzone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;
      if (files.length > 0) {
        handleSyllabusFile(files[0]);
      }
    });
  }
}

// ==========================================
// AUTHENTICATION FLOW
// ==========================================
function switchAuthTab(mode) {
  const loginTab = document.getElementById("tab-login");
  const signupTab = document.getElementById("tab-signup");
  const nameField = document.getElementById("signup-name-field");
  const authBtn = document.getElementById("btn-auth-submit");

  if (mode === "login") {
    loginTab.classList.add("active");
    signupTab.classList.remove("active");
    nameField.style.display = "none";
    authBtn.textContent = "Log In";
  } else {
    loginTab.classList.remove("active");
    signupTab.classList.add("active");
    nameField.style.display = "block";
    authBtn.textContent = "Create Academic Account";
  }
}

function handleAuthSubmit(event) {
  event.preventDefault();
  const nameInput = document.getElementById("auth-name").value;
  
  if (nameInput.trim()) {
    appState.activeUser = nameInput.trim();
  } else {
    appState.activeUser = "Keshav";
  }

  // Redirect to main workspace
  renderDashboard();
  showScreen("dashboard-screen");
}

// ==========================================
// DASHBOARD RENDERING
// ==========================================
function renderDashboard() {
  const dashboardGreeting = document.getElementById("dashboard-greeting");
  if (dashboardGreeting) {
    const hour = new Date().getHours();
    let salutation = "Good Evening";
    if (hour < 12) salutation = "Good Morning";
    else if (hour < 17) salutation = "Good Afternoon";
    
    dashboardGreeting.textContent = `${salutation}, ${appState.activeUser}`;
  }

  // Render Stats
  document.getElementById("stat-total-vivas").textContent = appState.stats.totalVivas;
  document.getElementById("stat-avg-confidence").textContent = `${appState.stats.avgConfidence}%`;
  document.getElementById("stat-strongest-subject").textContent = appState.stats.strongestSubject;
  document.getElementById("stat-weakest-subject").textContent = appState.stats.weakestSubject;

  // Render Recent Sessions list
  const listContainer = document.getElementById("dashboard-sessions-list");
  if (listContainer) {
    listContainer.innerHTML = "";

    appState.sessions.forEach(sess => {
      const card = document.createElement("div");
      card.className = "card session-card";
      const badgeClass = sess.gradeClass || "high";
      
      card.innerHTML = `
        <div class="session-info">
          <span class="session-subject">${sess.subject}</span>
          <div class="session-meta-row">
            <div class="session-meta-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              <span>${sess.duration} mins</span>
            </div>
            <div class="session-meta-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
              <span>${sess.personality}</span>
            </div>
          </div>
        </div>
        <div class="session-grade">
          <span class="session-date">${sess.date}</span>
          <span class="grade-badge ${badgeClass}">${sess.score}%</span>
        </div>
      `;
      listContainer.appendChild(card);
    });
  }
}

// ==========================================
// START VIVA SETUP FLOW (WIZARD)
// ==========================================
function resetSetupWizard() {
  appState.currentStep = 1;
  appState.selectedSource = "syllabus";
  appState.selectedTopic = "Thermodynamics";
  appState.selectedDuration = 5;
  appState.selectedPersonality = "friendly";
  appState.syllabusUploaded = false;
  appState.syllabusContent = "";
  
  // Clean inputs
  document.getElementById("topic-input").value = "";
  document.getElementById("syllabus-text").value = "";
  document.getElementById("custom-duration-val").value = "";
  
  const uploadText = document.getElementById("upload-status-text");
  if (uploadText) uploadText.textContent = "Drag & drop syllabus file here or click to browse";
  
  selectDuration(5);
  selectSource("syllabus");
  selectPersonality("friendly");
  proceedToStep(1);
}

function proceedToStep(step) {
  if (step === 2 && appState.currentStep === 1) {
    if (appState.selectedSource === "topic") {
      const topicVal = document.getElementById("topic-input").value.trim();
      if (!topicVal) {
        alert("Please enter a subject topic to proceed.");
        return;
      }
      appState.selectedTopic = topicVal;
    } else {
      const sylText = document.getElementById("syllabus-text").value.trim();
      if (!appState.syllabusUploaded && !sylText) {
        alert("Please upload a syllabus PDF or paste notes text to proceed.");
        return;
      }
      appState.selectedTopic = "Thermodynamics"; // fallback default subject if custom syllabus loaded
      appState.syllabusContent = sylText || "Syllabus uploaded in binary frame";
    }
  }

  // Transition steps
  appState.currentStep = step;
  
  for (let i = 1; i <= 3; i++) {
    const node = document.getElementById(`step-node-${i}`);
    if (i < step) {
      node.className = "step-node completed";
    } else if (i === step) {
      node.className = "step-node active";
    } else {
      node.className = "step-node";
    }
  }

  document.querySelectorAll(".setup-step-view").forEach(view => {
    view.classList.remove("active");
  });
  document.getElementById(`setup-step-${step}`).classList.add("active");

  if (step === 3) {
    compilePreviewDetails();
  }
}

function selectSource(sourceType) {
  appState.selectedSource = sourceType;
  
  const sylCard = document.getElementById("source-card-syllabus");
  const topicCard = document.getElementById("source-card-topic");
  const sylDetails = document.getElementById("source-details-syllabus");
  const topicDetails = document.getElementById("source-details-topic");

  if (sourceType === "syllabus") {
    sylCard.classList.add("selected");
    topicCard.classList.remove("selected");
    sylDetails.classList.add("active");
    topicDetails.classList.remove("active");
  } else {
    sylCard.classList.remove("selected");
    topicCard.classList.add("selected");
    sylDetails.classList.remove("active");
    topicDetails.classList.add("active");
  }
}

function fillSubject(subject) {
  const input = document.getElementById("topic-input");
  if (input) {
    input.value = subject;
    appState.selectedTopic = subject;
  }
}

function selectDuration(mins) {
  appState.selectedDuration = mins;
  
  document.querySelectorAll(".duration-pills-row .btn-pill").forEach(pill => {
    pill.classList.remove("active");
  });
  
  const selectedPill = document.getElementById(`duration-${mins}`);
  if (selectedPill) {
    selectedPill.classList.add("active");
  }
  
  document.getElementById("custom-duration-wrapper").classList.remove("active");
}

function toggleCustomDuration() {
  document.querySelectorAll(".duration-pills-row .btn-pill").forEach(pill => {
    pill.classList.remove("active");
  });
  document.getElementById("duration-custom").classList.add("active");
  
  document.getElementById("custom-duration-wrapper").classList.add("active");
  document.getElementById("custom-duration-val").focus();
}

function selectPersonality(type) {
  appState.selectedPersonality = type;
  document.querySelectorAll(".personality-grid .personality-card").forEach(card => {
    card.classList.remove("selected");
  });
  document.getElementById(`personality-${type}`).classList.add("selected");
}

function simulateFileUpload() {
  const uploadText = document.getElementById("upload-status-text");
  uploadText.textContent = "Analysing document matrices...";
  
  setTimeout(() => {
    appState.syllabusUploaded = true;
    appState.syllabusContent = DUMMY_SYLLABUS;
    uploadText.textContent = "ME-302_Applied_Thermodynamics_Syllabus.pdf (1.8 MB) — 100% Calibrated";
    document.getElementById("syllabus-text").value = DUMMY_SYLLABUS;
  }, 1200);
}

function handleSyllabusFile(file) {
  const uploadText = document.getElementById("upload-status-text");
  uploadText.textContent = `Reading ${file.name}...`;
  
  setTimeout(() => {
    appState.syllabusUploaded = true;
    appState.syllabusContent = DUMMY_SYLLABUS;
    uploadText.textContent = `${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB) — 100% Calibrated`;
    document.getElementById("syllabus-text").value = DUMMY_SYLLABUS;
  }, 1000);
}

function compilePreviewDetails() {
  const subjTitle = document.getElementById("preview-subject-title");
  const sourceSub = document.getElementById("preview-source-sub");
  
  if (appState.selectedSource === "topic") {
    const topicVal = document.getElementById("topic-input").value.trim() || "Thermodynamics";
    subjTitle.textContent = `${topicVal} Simulator`;
    sourceSub.textContent = `Source: Topic Search — "${topicVal}"`;
    appState.selectedTopic = topicVal;
  } else {
    // syllabus matching
    const pasted = document.getElementById("syllabus-text").value.toLowerCase();
    let detectedSubj = "Applied Thermodynamics";
    if (pasted.includes("data structure") || pasted.includes("stack") || pasted.includes("sort")) {
      detectedSubj = "Data Structures";
    } else if (pasted.includes("machine") || pasted.includes("shaft") || pasted.includes("bearing")) {
      detectedSubj = "Machine Design";
    }
    subjTitle.textContent = `${detectedSubj} (Syllabus)`;
    sourceSub.textContent = "Source: Syllabus Blueprint Document Loaded";
    appState.selectedTopic = detectedSubj;
  }

  let durationMins = appState.selectedDuration;
  if (durationMins === "custom" || document.getElementById("duration-custom").classList.contains("active")) {
    const customVal = parseInt(document.getElementById("custom-duration-val").value);
    durationMins = isNaN(customVal) || customVal <= 0 ? 15 : customVal;
    appState.selectedDuration = durationMins;
  }
  document.getElementById("preview-duration-text").textContent = `${durationMins} Minutes`;

  const personalityMeta = EXAMINER_PERSONALITIES[appState.selectedPersonality];
  document.getElementById("preview-personality-name").textContent = personalityMeta.name;
  document.getElementById("preview-personality-icon").innerHTML = personalityMeta.icon;

  // Question estimate
  document.getElementById("preview-questions-count").textContent = `4 Dynamic Branching Questions`;
}

// ==========================================
// ACTIVE REAL-TIME VIVA STATE MACHINE
// ==========================================
function startViva() {
  appState.vivaActive = true;
  appState.fallbackMode = false;
  appState.vivaState = "idle";
  
  // Clear history
  appState.vivaQuestions = [];
  appState.askedQuestions = [];
  appState.answerTranscripts = [];
  appState.detectedEmotions = [];
  appState.weakConcepts = [];
  appState.confidenceEvolution = [];
  appState.currentQuestionIndex = 0;
  
  // UI setups
  const keyboardBlock = document.getElementById("viva-keyboard-fallback");
  if (keyboardBlock) keyboardBlock.style.display = "none";
  document.getElementById("viva-fallback-input").value = "";

  // Topic Badge
  const subjectKey = getValidSubjectKey(appState.selectedTopic);
  document.getElementById("active-viva-topic-badge").textContent = subjectKey;

  // Set Examiner Icon
  const examinerIcon = document.querySelector("#viva-examiner-stage .examiner-avatar-icon");
  if (examinerIcon) {
    examinerIcon.innerHTML = EXAMINER_PERSONALITIES[appState.selectedPersonality].icon;
  }

  // Open Active Screen
  showScreen("active-viva-screen");

  // Timer Initialization
  appState.vivaTimerTotal = appState.selectedDuration * 60;
  appState.vivaTimeRemaining = appState.vivaTimerTotal;
  updateTimerDisplay();

  appState.vivaTimerInterval = setInterval(() => {
    appState.vivaTimeRemaining--;
    updateTimerDisplay();
    
    if (appState.vivaTimeRemaining <= 0) {
      clearInterval(appState.vivaTimerInterval);
      alert("Time limit reached. Compiling your final grade metrics.");
      finishViva();
    }
  }, 1000);

  // Phase 1: Examiner Introduction speech
  triggerIntroduction();
}

function getValidSubjectKey(subjectName) {
  if (ADAPTIVE_VIVAS[subjectName]) return subjectName;
  
  // search keywords
  const lower = subjectName.toLowerCase();
  if (lower.includes("data") || lower.includes("structure") || lower.includes("stack") || lower.includes("tree")) {
    return "Data Structures";
  } else if (lower.includes("machine") || lower.includes("design") || lower.includes("shaft") || lower.includes("bearing")) {
    return "Machine Design";
  }
  return "Thermodynamics"; // fallback default
}

function updateTimerDisplay() {
  const timerSpan = document.getElementById("active-viva-timer");
  if (timerSpan) {
    const mins = Math.floor(appState.vivaTimeRemaining / 60);
    const secs = appState.vivaTimeRemaining % 60;
    timerSpan.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}

/**
 * PHASE 1: EXAMINER INTRO SPEECH
 */
function triggerIntroduction() {
  setVivaState("intro");
  
  const subjectKey = getValidSubjectKey(appState.selectedTopic);
  const db = ADAPTIVE_VIVAS[subjectKey];
  
  // Custom intro text incorporating userName
  const introSpeech = `Good evening, ${appState.activeUser}. Let us begin your oral examination. ${db.intro.speech}`;
  
  // Show intro question text inside the card
  document.getElementById("viva-question-num-tag").textContent = "Question 1 of 4";
  document.getElementById("viva-question-content-text").textContent = `"${db.intro.text}"`;
  
  const transcriptBox = document.getElementById("viva-transcript-text");
  transcriptBox.innerHTML = `<span class="transcript-placeholder">Examiner is introducing the exam...</span>`;

  // Start voice speaking
  VoiceManager.speak(introSpeech, appState.selectedPersonality, 
    // onStart
    () => {
      setExaminerVisualState("speaking", "Professor is speaking...");
    },
    // onEnd
    () => {
      // Transition immediately into listening state
      appState.vivaQuestions.push(db.intro);
      appState.askedQuestions.push(db.intro.text);
      appState.activeBranchKey = "intro";
      
      startListeningState();
    }
  );
}

/**
 * PHASE 2: AUTOMATIC LISTENING STATE (Auto microphone trigger, no push-to-talk)
 */
function startListeningState() {
  setVivaState("listening");
  setExaminerVisualState("listening", "Listening to your answer...");
  
  document.getElementById("btn-microphone-sub").textContent = "Microphone active. Start speaking your answer naturally.";
  
  const transcriptBox = document.getElementById("viva-transcript-text");
  transcriptBox.innerHTML = `<span class="transcript-placeholder" style="color: var(--color-success); font-weight: 500;">Speak now. System is listening...</span>`;

  appState.speechStartTime = Date.now();

  // Trigger web speech recognition
  SpeechManager.start({
    onResult: (interim, final) => {
      if (appState.vivaState !== "listening") return; // ignore if state progressed
      
      if (!final && !interim) {
        transcriptBox.innerHTML = `<span class="transcript-placeholder" style="color: var(--color-success); font-weight: 500;">Speak now. System is listening...</span>`;
      } else {
        const textOut = final + (interim ? ` <span style="color: var(--text-muted); font-style: italic;">${interim}</span>` : "");
        transcriptBox.innerHTML = textOut;
        
        // Dynamic waveform jump response
        animateVoiceWaveform();
      }
    },
    onSilenceDetected: (finalTranscriptText) => {
      // 3.5s of silence triggers Auto-Submission!
      SpeechManager.stop();
      processSpokenAnswer(finalTranscriptText);
    },
    onError: (errorType) => {
      console.warn("Speech API captured error type:", errorType);
      
      // If mic permission is blocked, switch to text keyboard fallback
      if (errorType === "not-allowed" || errorType === "service-not-allowed" || errorType === "not-supported") {
        enableKeyboardFallbackMode();
      } else if (errorType === "no-speech") {
        // Silent timeout warning
        triggerSilenceNudge();
      }
    },
    onEnd: (finalTranscriptText) => {
      // recognition closure
    }
  });
}

function animateVoiceWaveform() {
  const bars = document.querySelectorAll("#viva-waveform .waveform-bar");
  bars.forEach(bar => {
    // Generate random heights to simulate live vocal volume
    const randomHeight = Math.floor(Math.random() * 32) + 8;
    bar.style.height = `${randomHeight}px`;
  });
}

/**
 * KEYBOARD FALLBACK MODE (If browser blocks microphone)
 */
function enableKeyboardFallbackMode() {
  appState.fallbackMode = true;
  SpeechManager.stop();
  
  setExaminerVisualState("listening", "Keyboard Fallback Active");
  document.getElementById("btn-microphone-sub").textContent = "Microphone access blocked. Please type your answer below.";
  
  const transcriptBox = document.getElementById("viva-transcript-text");
  transcriptBox.innerHTML = `<span class="transcript-placeholder" style="color: var(--text-muted);">Please type your detailed explanation inside the box below.</span>`;

  // Show hidden input block
  const fallbackBox = document.getElementById("viva-keyboard-fallback");
  if (fallbackBox) {
    fallbackBox.style.display = "block";
  }
  
  const textInput = document.getElementById("viva-fallback-input");
  if (textInput) {
    textInput.focus();
  }

  // Enable Next Question button
  const submitBtn = document.getElementById("btn-next-question");
  submitBtn.disabled = false;
  submitBtn.textContent = "Submit Answer";
}

function triggerSilenceNudge() {
  if (appState.vivaState !== "listening" || appState.fallbackMode) return;

  const phrase = "I am listening. Please share your thoughts in your own words, or let me know if you would like me to move to another concept.";
  
  setExaminerVisualState("speaking", "Professor is prompting...");
  
  VoiceManager.speak(phrase, appState.selectedPersonality, 
    null, 
    () => {
      // return to listening
      if (appState.vivaState === "listening") {
        setExaminerVisualState("listening", "Listening to your answer...");
        SpeechManager.start(); // restart listening
      }
    }
  );
}

/**
 * GRADES SPOKEN OR WRITTEN RESPONSES
 */
function submitWrittenAnswer() {
  if (!appState.fallbackMode) {
    // Manual submit button override during active speech recognition
    SpeechManager.stop();
    const spokenText = document.getElementById("viva-transcript-text").textContent.replace("Speak now. System is listening...", "").trim();
    processSpokenAnswer(spokenText);
  } else {
    // Fallback textbox submission
    const writtenInput = document.getElementById("viva-fallback-input");
    const writtenText = writtenInput.value.trim();
    
    if (!writtenText) {
      alert("Please type an answer to submit.");
      return;
    }
    
    // Hide input block value for next question
    writtenInput.value = "";
    document.getElementById("viva-keyboard-fallback").style.display = "none";
    appState.fallbackMode = false; // reset fallback state temporarily
    
    processSpokenAnswer(writtenText);
  }
}

function processSpokenAnswer(answerText) {
  if (!answerText || answerText.toLowerCase().includes("speak now.") || answerText.length < 4) {
    // Empty speech fallback: ask again or treat as weak
    answerText = "[Student remained silent or provided no substantive answer]";
  }

  setVivaState("analyzing");
  setExaminerVisualState("speaking", "Examiner is evaluating your answer...");
  
  const transcriptBox = document.getElementById("viva-transcript-text");
  transcriptBox.textContent = answerText;

  // ==========================================
  // REAL-TIME EMOTION DETECTION PIPELINE
  // ==========================================
  
  // Lexical Parameters
  const textLower = answerText.toLowerCase();
  const words = textLower.split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;

  // 1. Hesitation Index: counts fillers ("uhm", "umm", "like", "basically", etc.) + acoustic pauses
  const fillers = ["umm", "uhm", "uh", "like", "basically", "actually", "maybe", "sort of", "kind of"];
  let fillerCount = 0;
  fillers.forEach(f => {
    const regex = new RegExp(`\\b${f}\\b`, 'g');
    const matches = textLower.match(regex);
    if (matches) fillerCount += matches.length;
  });

  // Gaps pauses count from SpeechManager
  const pauseCount = SpeechManager.gapsHistory.length;
  
  let hesitationScore = Math.min(Math.max((fillerCount * 8) + (pauseCount * 12) + 10, 8), 92);

  // 2. Uncertainty Index: counts weak wording ("i guess", "i think", "not sure", "possibly")
  const weakTerms = ["i think", "i guess", "not sure", "don't know", "possibly", "probably", "maybe", "perhaps"];
  let weakCount = 0;
  weakTerms.forEach(t => {
    if (textLower.includes(t)) weakCount++;
  });
  
  // Speaking duration estimation
  const durationMs = Date.now() - appState.speechStartTime;
  const durationMins = durationMs / 1000 / 60;
  const wpm = durationMins > 0 ? Math.round(wordCount / durationMins) : 120;
  
  // Extreme speed variance correlates with nervousness
  let wpmDeviation = 0;
  if (wpm < 85) wpmDeviation = (85 - wpm) * 1.5;
  else if (wpm > 175) wpmDeviation = (wpm - 175) * 1.2;

  let nervousnessScore = Math.min(Math.max((weakCount * 15) + wpmDeviation + 15, 10), 90);

  // 3. Clarity Index: based on word count, technical terminology inclusion, and low uncertainty
  const subjectKey = getValidSubjectKey(appState.selectedTopic);
  const db = ADAPTIVE_VIVAS[subjectKey];
  const expectedKeywords = Object.keys(db.keywords);
  
  let keyMatchCount = 0;
  expectedKeywords.forEach(k => {
    if (textLower.includes(k)) keyMatchCount++;
  });

  let clarityScore = Math.min(Math.max((keyMatchCount * 25) + (wordCount > 15 ? 40 : 15) - (weakCount * 8), 20), 98);

  // 4. Overall Confidence: inverse weighting of hesitation, nervousness, and lack of clarity
  let confidenceScore = Math.round(100 - (hesitationScore * 0.4 + nervousnessScore * 0.4 + (100 - clarityScore) * 0.2));
  confidenceScore = Math.min(Math.max(confidenceScore, 35), 98);

  // Save parsed metrics
  const questionMetrics = {
    confidence: confidenceScore,
    clarity: clarityScore,
    nervousness: nervousnessScore,
    hesitation: hesitationScore
  };

  appState.detectedEmotions.push(questionMetrics);
  appState.answerTranscripts.push(answerText);
  appState.confidenceEvolution.push(confidenceScore);
  appState.sessionConfidenceScores.push(confidenceScore);

  // Log keyword weaknesses for report cards
  if (clarityScore < 60) {
    expectedKeywords.forEach(k => {
      if (!textLower.includes(k) && !appState.weakConcepts.includes(k)) {
        appState.weakConcepts.push(k);
      }
    });
  }

  // BRIEF SYSTEM THINKING DELAY
  setTimeout(() => {
    appState.currentQuestionIndex++;
    decideNextAdaptiveQuestion(answerText, questionMetrics);
  }, 1800);
}

/**
 * ==========================================
 * ADAPTIVE QUESTIONING & BRANCHING DECISION ENGINE
 * ==========================================
 */
function decideNextAdaptiveQuestion(lastAnswerText, metrics) {
  const subjectKey = getValidSubjectKey(appState.selectedTopic);
  const db = ADAPTIVE_VIVAS[subjectKey];
  
  const qIndex = appState.currentQuestionIndex;
  
  // Terminate after 4 branching rounds
  if (qIndex >= 4) {
    finishViva();
    return;
  }

  setVivaState("generating");
  setExaminerVisualState("speaking", "Formulating question...");

  let nextQuestionObj = null;
  let branchingRemark = "";

  // 1. BLUFF / KEYWORD CROSS-EXAMINATION RULES
  const wordsLower = lastAnswerText.toLowerCase();
  const expectedKeywords = Object.keys(db.keywords);
  let matchedKeyword = null;
  
  // Find if student mentioned a technical keyword in their answer
  for (const kw of expectedKeywords) {
    if (wordsLower.includes(kw)) {
      matchedKeyword = kw;
      break;
    }
  }

  // Cross-examine if they mentioned a keyword but scored poorly on clarity, OR under general stress branches
  if (matchedKeyword && metrics.clarity < 65 && !appState.askedQuestions.includes(db.keywords[matchedKeyword].text)) {
    nextQuestionObj = db.keywords[matchedKeyword];
    branchingRemark = `You mentioned the term ${matchedKeyword}. Let us examine that precisely. `;
    appState.activeBranchKey = `cross_${matchedKeyword}`;
  } 
  // 2. STRONG & CONFIDENT PATHWAY
  else if (metrics.confidence >= 78 && metrics.clarity >= 78) {
    const praisePhrases = [
      "Excellent. Your conceptual base is very strong. Let us go a little deeper. ",
      "Very good articulation. Let us examine an analytical scenario. ",
      "Highly precise answer. Let us stretch this boundary further. "
    ];
    branchingRemark = praisePhrases[Math.floor(Math.random() * praisePhrases.length)];
    
    // Choose Advanced or Analytical question
    if (qIndex % 2 === 0 && !appState.askedQuestions.includes(db.branches.advanced.text)) {
      nextQuestionObj = db.branches.advanced;
      appState.activeBranchKey = "advanced";
    } else {
      nextQuestionObj = db.branches.analytical;
      appState.activeBranchKey = "analytical";
    }
  } 
  // 3. NERVOUS / SUPPORTIVE PATHWAY
  else if (metrics.confidence < 65 || metrics.hesitation >= 35) {
    const supportivePhrases = [
      "No worries, let us take it step-by-step. Let's make this simple. ",
      "Take your time. Can you explain the basic core elements of this instead? ",
      "Do not stress. Let us look at a foundational representation of this. "
    ];
    branchingRemark = supportivePhrases[Math.floor(Math.random() * supportivePhrases.length)];
    
    if (!appState.askedQuestions.includes(db.branches.supportive.text)) {
      nextQuestionObj = db.branches.supportive;
      appState.activeBranchKey = "supportive";
    } else {
      nextQuestionObj = db.branches.foundational;
      appState.activeBranchKey = "foundational";
    }
  } 
  // 4. WEAK / FOUNDATIONAL PATHWAY
  else if (metrics.clarity < 65) {
    branchingRemark = "I see. Let us drop back to some fundamental concepts to clarify this. ";
    nextQuestionObj = db.branches.foundational;
    appState.activeBranchKey = "foundational";
  }
  // 5. DEFAULT PROGRESSION
  else {
    branchingRemark = "Good. Now let us progress to the next concept. ";
    
    // Fallback choosing any un-asked question
    if (!appState.askedQuestions.includes(db.branches.analytical.text)) {
      nextQuestionObj = db.branches.analytical;
      appState.activeBranchKey = "analytical";
    } else {
      nextQuestionObj = db.branches.foundational;
      appState.activeBranchKey = "foundational";
    }
  }

  // Backup fallback in case something is somehow already asked
  if (!nextQuestionObj) {
    nextQuestionObj = db.branches.foundational;
    appState.activeBranchKey = "foundational";
  }

  // Update memory
  appState.vivaQuestions.push(nextQuestionObj);
  appState.askedQuestions.push(nextQuestionObj.text);

  // Present next question
  const totalQ = 4;
  document.getElementById("viva-question-num-tag").textContent = `Question ${qIndex + 1} of ${totalQ}`;
  document.getElementById("viva-question-content-text").textContent = `"${nextQuestionObj.text}"`;
  
  const transcriptBox = document.getElementById("viva-transcript-text");
  transcriptBox.innerHTML = `<span class="transcript-placeholder">Professor is speaking follow-up...</span>`;

  // Dynamic voice synthesis speaking branchingRemark + Question text
  const fullSpeech = branchingRemark + nextQuestionObj.speech;
  
  setVivaState("speaking");
  
  VoiceManager.speak(fullSpeech, appState.selectedPersonality,
    () => {
      setExaminerVisualState("speaking", "Professor is speaking...");
    },
    () => {
      startListeningState();
    }
  );
}

function setVivaState(state) {
  appState.vivaState = state;
}

function setExaminerVisualState(visualClass, labelText) {
  const stage = document.getElementById("viva-examiner-stage");
  const statusSpan = document.getElementById("examiner-status-text");
  
  if (stage && statusSpan) {
    stage.className = `examiner-stage ${visualClass}`;
    statusSpan.textContent = labelText;
  }
  
  // Pulse active wave sizes
  const wave = document.getElementById("viva-waveform");
  if (wave) {
    if (visualClass === "speaking") {
      wave.style.opacity = "1";
    } else if (visualClass === "listening") {
      wave.style.opacity = "0.7";
    } else {
      wave.style.opacity = "0.2";
    }
  }
}

// ==========================================
// RESULTS & GRADINGS GENERATOR
// ==========================================
function finishViva(endedEarly = false) {
  appState.vivaActive = false;
  setVivaState("completed");
  
  if (appState.vivaTimerInterval) clearInterval(appState.vivaTimerInterval);
  if (appState.transcriptInterval) clearInterval(appState.transcriptInterval);
  
  SpeechManager.stop();
  VoiceManager.stop();

  let confidenceAvg = 84;
  let clarityAvg = 82;
  let hesitationAvg = 15;
  let nervousnessAvg = 20;

  // Compute actual averages from our real-time emotion engine!
  if (appState.detectedEmotions.length > 0) {
    let confSum = 0, clarSum = 0, hesSum = 0, nervSum = 0;
    
    appState.detectedEmotions.forEach(emo => {
      confSum += emo.confidence;
      clarSum += emo.clarity;
      hesSum += emo.hesitation;
      nervSum += emo.nervousness;
    });

    confidenceAvg = Math.round(confSum / appState.detectedEmotions.length);
    clarityAvg = Math.round(clarSum / appState.detectedEmotions.length);
    hesitationAvg = Math.round(hesSum / appState.detectedEmotions.length);
    nervervousnessAvg = Math.round(nervSum / appState.detectedEmotions.length);
  }

  // Calculate final score
  let finalScore = Math.round((confidenceAvg * 0.4) + (clarityAvg * 0.6) - (hesitationAvg * 0.1) - (nervousnessAvg * 0.1) + 12);
  finalScore = Math.min(Math.max(finalScore, 40), 99);

  if (endedEarly) {
    finalScore = Math.round(finalScore * 0.6); // early penalty
  }

  let subjectName = getValidSubjectKey(appState.selectedTopic);

  // Push new history session card
  const sessionDateStr = new Date().toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  });
  
  const newSession = {
    id: `session_${Date.now()}`,
    subject: subjectName,
    duration: appState.selectedDuration,
    personality: EXAMINER_PERSONALITIES[appState.selectedPersonality].name,
    score: finalScore,
    date: sessionDateStr,
    gradeClass: finalScore >= 80 ? "high" : (finalScore >= 65 ? "med" : "low")
  };
  
  appState.sessions.unshift(newSession);

  // Update aggregate scores
  appState.stats.totalVivas++;
  let allConf = appState.stats.avgConfidence * (appState.stats.totalVivas - 1) + confidenceAvg;
  appState.stats.avgConfidence = Math.round(allConf / appState.stats.totalVivas);
  
  if (finalScore > 86) appState.stats.strongestSubject = subjectName;
  if (finalScore < 72) appState.stats.weakestSubject = subjectName;

  // Open Results screen
  showScreen("results-screen");

  // RENDER EVALUATION METRICS
  document.getElementById("results-topic-badge").textContent = subjectName;
  
  const radialFill = document.getElementById("results-radial-stroke");
  const percentageVal = document.getElementById("results-percentage-val");
  percentageVal.textContent = `${finalScore}%`;

  const strokeOffset = 314.16 - (314.16 * finalScore) / 100;
  setTimeout(() => {
    radialFill.style.strokeDashoffset = strokeOffset;
  }, 100);

  const gradeLabel = document.getElementById("results-grade-label");
  const evaluationVerdict = document.getElementById("results-evaluation-verdict");
  
  if (finalScore >= 80) {
    gradeLabel.textContent = "First Class Honor (Distinction)";
    evaluationVerdict.textContent = `Excellent presentation. You answered with strong cognitive clarity (${clarityAvg}%), solid semantic phrasing, and successfully countered deep cross-examinations.`;
  } else if (finalScore >= 65) {
    gradeLabel.textContent = "Upper Second Class Honor";
    evaluationVerdict.textContent = `Honorable performance. Sound general concepts, though stress triggers under the ${EXAMINER_PERSONALITIES[appState.selectedPersonality].name} personality caused minor lexical pauses or hesitation gaps.`;
  } else {
    gradeLabel.textContent = "Requires Conceptual Review";
    evaluationVerdict.textContent = "Your answers lacked structured academic terminology. High uncertainty or hesitation markers significantly degraded speaking clarity scores.";
  }

  // Set Emotion meters
  setEmotionMetric("confidence", confidenceAvg);
  setEmotionMetric("clarity", clarityAvg);
  setEmotionMetric("nervousness", nervousnessAvg);
  setEmotionMetric("hesitation", hesitationAvg);

  // Populate Feedback Lists
  populateFeedbackLists(subjectName, finalScore);

  // Redraw SVG graph using real-time results
  drawConfidenceGraph();
}

function setEmotionMetric(metric, value) {
  document.getElementById(`results-${metric}-pct`).textContent = `${value}%`;
  const bar = document.getElementById(`results-${metric}-bar`);
  if (bar) {
    setTimeout(() => {
      bar.style.width = `${value}%`;
    }, 200);
  }
}

function populateFeedbackLists(subject, score) {
  const strengthsUl = document.getElementById("results-strengths-list");
  const weakUl = document.getElementById("results-weak-list");
  const pillsContainer = document.getElementById("results-revision-pills");

  strengthsUl.innerHTML = "";
  weakUl.innerHTML = "";
  pillsContainer.innerHTML = "";

  let strengths = [], weaknesses = [], revisions = [];

  // Tailored diagnostics
  if (subject === "Thermodynamics") {
    strengths = [
      "Excellent logical layout of the Second Law of thermodynamics and entropy limits.",
      "Clear articulation of temperature gradients and heat rejection constraints."
    ];
    weaknesses = [
      "Slight terminology confusion when asked to define phase boundary slope formulas.",
      "Weak exergy boundary separation under open controlling volumes."
    ];
    revisions = ["Carnot parameters", "Clausius inequality integration", "Clapeyron equation derivations"];
    
    if (appState.weakConcepts.length > 0) {
      weaknesses.push(`Struggled to define exact concepts for: ${appState.weakConcepts.join(", ")}.`);
    }
  } else if (subject === "Data Structures") {
    strengths = [
      "Superb clarity on stack and queue access indices and O(1) constraints.",
      "Accurate time complexity descriptions for self-balancing AVL nodes."
    ];
    weaknesses = [
      "pauses when explaining balance factors during double rotations.",
      "Slight lexical hesitation mapping search structures in BST skew limits."
    ];
    revisions = ["AVL rotation calculations", "Separate chaining buckets", "BFS queue space margins"];
  } else {
    strengths = [
      "Strong identification of Goodman loading lines on the alternating-stress axis.",
      "Clean definition of shaft fillet curves preventing stress concentration."
    ];
    weaknesses = [
      "Struggled to define oil clearance variables inside the Sommerfeld lubrication formula.",
      "Vague representation of tooth bending root stress limits."
    ];
    revisions = ["Sommerfeld Clearance values", "Lewis tooth stress AGMA parameters", "Endurance limit crack checks"];
  }

  strengths.forEach(str => {
    const li = document.createElement("li");
    li.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg><span>${str}</span>`;
    strengthsUl.appendChild(li);
  });

  weaknesses.forEach(weak => {
    const li = document.createElement("li");
    li.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg><span>${weak}</span>`;
    weakUl.appendChild(li);
  });

  revisions.forEach(rev => {
    const span = document.createElement("span");
    span.className = "revision-pill-tag";
    span.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>${rev}`;
    pillsContainer.appendChild(span);
  });
}

// ==========================================
// SVG GRAPH RENDERING CONTROLLER
// ==========================================
function drawConfidenceGraph() {
  const scores = appState.confidenceEvolution.length > 0 
    ? appState.confidenceEvolution 
    : [80, 85, 70, 92]; // Fallback if ended empty

  const svg = document.getElementById("results-timeline-svg");
  const path = document.getElementById("graph-trend-path");
  
  if (!svg || !path) return;

  const width = 500;
  const height = 160;
  const paddingX = 60;
  const paddingY = 30;

  const count = scores.length;
  const stepX = (width - paddingX * 2) / (count - 1 || 1);

  const mapY = (val) => {
    const pct = (val - 50) / 50; 
    return height - paddingY - pct * (height - paddingY * 2);
  };

  let dPath = "";
  
  svg.querySelectorAll(".graph-point, .graph-axis-text").forEach(el => el.remove());

  scores.forEach((score, index) => {
    const cx = paddingX + index * stepX;
    const cy = mapY(score);

    if (index === 0) {
      dPath = `M ${cx} ${cy}`;
    } else {
      dPath += ` L ${cx} ${cy}`;
    }

    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("class", "graph-point");
    circle.setAttribute("cx", cx);
    circle.setAttribute("cy", cy);
    circle.setAttribute("r", "5");
    circle.setAttribute("id", `graph-pt-${index}`);
    
    circle.addEventListener("mouseover", () => {
      showGraphTooltip(index, score, cx, cy);
    });
    
    svg.appendChild(circle);

    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("class", "graph-axis-text");
    text.setAttribute("x", cx);
    text.setAttribute("y", height - 8);
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("font-size", "10px");
    text.setAttribute("font-weight", "600");
    text.setAttribute("fill", "var(--text-muted)");
    text.textContent = `Q${index + 1}`;
    svg.appendChild(text);
  });

  path.setAttribute("d", dPath);
  path.style.strokeDasharray = "1000";
  path.style.strokeDashoffset = "1000";
  path.getBoundingClientRect();
  path.style.animation = "drawLine 1.5s cubic-bezier(0.25, 0.8, 0.25, 1) forwards";

  showGraphTooltip(0, scores[0], paddingX, mapY(scores[0]));
}

function showGraphTooltip(index, score, cx, cy) {
  const tooltip = document.querySelector(".graph-tooltip-box");
  const content = document.getElementById("graph-tooltip-content");
  
  if (!tooltip || !content) return;

  content.textContent = `Question ${index + 1}: ${score}% Confidence`;
  
  document.querySelectorAll(".graph-point").forEach((c, idx) => {
    if (idx === index) {
      c.setAttribute("r", "7.5");
      c.style.fill = "var(--accent-primary)";
    } else {
      c.setAttribute("r", "5");
      c.style.fill = "var(--bg-card)";
    }
  });
}
