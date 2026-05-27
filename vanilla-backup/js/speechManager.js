/**
 * VivaSim - Unified Voice Recognition Manager (STT)
 * Modular abstraction wrapping webkitSpeechRecognition / SpeechRecognition.
 * Engineered for continuous hands-free evaluation and silence-to-submit automation.
 */

const SpeechManager = {
  recognition: null,
  isActive: false,
  interimTranscript: "",
  finalTranscript: "",
  
  // Timing & Silence Settings
  silenceTimer: null,
  silenceThresholdMs: 3500, // 3.5 seconds of silence triggers auto-submission
  
  // Acoustic & Temporal analysis metrics
  lastSpeechResultTime: 0,
  gapsHistory: [], // records milliseconds between word groups (pauses)

  // Callbacks
  onResult: null,
  onSilenceDetected: null,
  onError: null,
  onEnd: null,

  /**
   * Initializes the browser Speech Recognition Engine.
   */
  init() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Speech Recognition not supported natively in this browser.");
      return false;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = "en-US";

    // Bind event handlers
    this.recognition.onstart = () => {
      this.isActive = true;
      this.interimTranscript = "";
      this.finalTranscript = "";
      this.gapsHistory = [];
      this.lastSpeechResultTime = Date.now();
      this.resetSilenceTimer();
    };

    this.recognition.onresult = (event) => {
      const now = Date.now();
      let currentInterim = "";
      let newFinals = "";

      // Loop through results
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          this.finalTranscript += event.results[i][0].transcript + " ";
          newFinals += event.results[i][0].transcript + " ";
        } else {
          currentInterim += event.results[i][0].transcript;
        }
      }

      this.interimTranscript = currentInterim;

      // Track temporal gaps (pauses) if there is new final speech
      if (newFinals.trim()) {
        const gap = now - this.lastSpeechResultTime;
        // Gaps above 1.5 seconds indicate localized hesitation pauses
        if (gap > 1500) {
          this.gapsHistory.push(gap);
        }
        this.lastSpeechResultTime = now;
      }

      // Reset Silence Timer on every spoken word
      this.resetSilenceTimer();

      // Dispatch transcript back to application UI
      if (this.onResult) {
        this.onResult(this.interimTranscript, this.finalTranscript.trim());
      }
    };

    this.recognition.onerror = (event) => {
      console.error("Speech Recognition Error:", event.error);
      this.clearSilenceTimer();
      
      if (this.onError) {
        this.onError(event.error);
      }
    };

    this.recognition.onend = () => {
      this.isActive = false;
      this.clearSilenceTimer();
      
      if (this.onEnd) {
        this.onEnd(this.finalTranscript.trim());
      }
    };

    return true;
  },

  /**
   * Starts listening to user input.
   */
  start(callbacks = {}) {
    if (!this.recognition && !this.init()) {
      if (callbacks.onError) {
        callbacks.onError("not-supported");
      }
      return;
    }

    // Register Callbacks
    this.onResult = callbacks.onResult || null;
    this.onSilenceDetected = callbacks.onSilenceDetected || null;
    this.onError = callbacks.onError || null;
    this.onEnd = callbacks.onEnd || null;

    try {
      this.recognition.start();
    } catch (e) {
      console.warn("Speech Recognition already running or starting:", e);
    }
  },

  /**
   * Stops listening to user input.
   */
  stop() {
    this.clearSilenceTimer();
    if (this.recognition && this.isActive) {
      try {
        this.recognition.stop();
      } catch (e) {
        console.error("Error stopping Speech Recognition:", e);
      }
    }
  },

  /**
   * Resets the silence submission countdown timer.
   */
  resetSilenceTimer() {
    this.clearSilenceTimer();
    
    if (!this.isActive) return;

    this.silenceTimer = setTimeout(() => {
      this.clearSilenceTimer();
      
      if (this.onSilenceDetected) {
        this.onSilenceDetected(this.finalTranscript.trim());
      }
    }, this.silenceThresholdMs);
  },

  /**
   * Clears the silence submission countdown timer.
   */
  clearSilenceTimer() {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  },

  /**
   * Checks if speech recognition is supported in browser.
   * @returns {boolean}
   */
  isSupported() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    return !!SpeechRecognition;
  }
};
