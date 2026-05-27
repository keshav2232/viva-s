/**
 * VivaSim - Unified Voice Recognition Manager (STT)
 * ES6 Module configured with strict SSR checking for Next.js safety.
 */

export const SpeechManager = {
  recognition: null,
  isActive: false,
  interimTranscript: "",
  finalTranscript: "",
  
  // Timing & Silence Settings
  silenceTimer: null,
  silenceThresholdMs: 3500, // 3.5s silence triggers auto-submission
  
  // Acoustic & Temporal analysis metrics
  lastSpeechResultTime: 0,
  gapsHistory: [], // records pause times (ms)

  // Callbacks
  onResult: null,
  onSilenceDetected: null,
  onError: null,
  onEnd: null,

  /**
   * Initializes the browser Speech Recognition Engine. Safe for SSR.
   */
  init() {
    if (typeof window === "undefined") return false;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Speech Recognition not supported natively in this browser.");
      return false;
    }

    try {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = "en-US";

      // Bind events
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

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            this.finalTranscript += event.results[i][0].transcript + " ";
            newFinals += event.results[i][0].transcript + " ";
          } else {
            currentInterim += event.results[i][0].transcript;
          }
        }

        this.interimTranscript = currentInterim;

        if (newFinals.trim()) {
          const gap = now - this.lastSpeechResultTime;
          if (gap > 1500) {
            this.gapsHistory.push(gap);
          }
          this.lastSpeechResultTime = now;
        }

        this.resetSilenceTimer();

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
    } catch (e) {
      console.error("Failed to construct SpeechRecognition:", e);
      return false;
    }
  },

  /**
   * Starts listening to user input.
   */
  async start(callbacks = {}) {
    if (typeof window === "undefined") {
      if (callbacks.onError) callbacks.onError("not-supported");
      return;
    }

    if (!this.recognition && !this.init()) {
      if (callbacks.onError) {
        callbacks.onError("not-supported");
      }
      return;
    }

    this.onResult = callbacks.onResult || null;
    this.onSilenceDetected = callbacks.onSilenceDetected || null;
    this.onError = callbacks.onError || null;
    this.onEnd = callbacks.onEnd || null;
    this.onAudioCaptured = callbacks.onAudioCaptured || null;

    try {
      this.recognition.start();

      // Request media stream after a small hardware delay to prevent parallel device acquisition locks
      setTimeout(async () => {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia && this.isActive) {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaStream = stream;
            
            this.audioChunks = [];
            const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
            this.mediaRecorder = recorder;
            
            recorder.ondataavailable = (event) => {
              if (event.data && event.data.size > 0) {
                this.audioChunks.push(event.data);
              }
            };
            
            recorder.onstop = () => {
              const blob = new Blob(this.audioChunks, { type: "audio/webm" });
              if (this.onAudioCaptured && blob.size > 100) {
                this.onAudioCaptured(blob);
              }
              
              // Cleanup stream tracks
              if (this.mediaStream) {
                this.mediaStream.getTracks().forEach(track => track.stop());
                this.mediaStream = null;
              }
            };
            
            recorder.start();
          } catch (mediaErr) {
            console.warn("Unable to capture microphone stream for recording:", mediaErr);
          }
        }
      }, 250);

    } catch (e) {
      console.warn("Speech Recognition start failed (possibly already active):", e);
    }
  },

  /**
   * Stops listening to user input.
   */
  stop() {
    this.clearSilenceTimer();

    // Stop MediaRecorder
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      try {
        this.mediaRecorder.stop();
      } catch (err) {
        console.warn("Error stopping media recorder:", err);
      }
      this.mediaRecorder = null;
    }

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
    if (typeof window === "undefined") return false;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    return !!SpeechRecognition;
  }
};
