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
  silenceThresholdMs: 7500, // 7.5s silence triggers auto-submission
  
  // Acoustic & Temporal analysis metrics
  lastSpeechResultTime: 0,
  gapsHistory: [], // records pause times (ms)

  // Callbacks
  onResult: null,
  onSilenceDetected: null,
  onError: null,
  onEnd: null,
  onAudioCaptured: null,
  onVolumeChange: null,
  
  // Audio Context Nodes
  audioCtx: null,
  audioAnalyser: null,
  volumeInterval: null,
  lastError: null,
  isHotRestarting: false,
  shouldBeActive: false,

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

      this.recognition.onstart = () => {
        this.isActive = true;
        this.lastError = null;
        if (!this.isHotRestarting) {
          this.interimTranscript = "";
          this.finalTranscript = "";
          this.gapsHistory = [];
        }
        this.isHotRestarting = false;
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
        this.lastError = event.error;
        this.clearSilenceTimer();
        
        if (this.onError) {
          this.onError(event.error);
        }
      };

      this.recognition.onend = () => {
        this.isActive = false;
        this.clearSilenceTimer();
        
        // Auto-restart if premature browser termination occurred (exclude fatal permission blocks)
        const isFatalError = ["not-allowed", "service-not-allowed", "language-not-supported"].includes(this.lastError);
        if (this.shouldBeActive && !isFatalError) {
          console.log("Speech recognition stopped natively by browser. Scheduling auto-restart...");
          this.isHotRestarting = true;
          
          if (this.volumeInterval) {
            clearInterval(this.volumeInterval);
            this.volumeInterval = null;
          }

          setTimeout(() => {
            if (!this.shouldBeActive) return;
            try {
              this.recognition.start();
              this.isActive = true;
              console.log("Speech recognition successfully auto-restarted.");
            } catch (e) {
              console.warn("Speech recognition auto-restart failed:", e);
              this.isHotRestarting = false;
            }
          }, 150);
        } else {
          if (this.onEnd) {
            this.onEnd(this.finalTranscript.trim());
          }
        }
      };

      return true;
    } catch (e) {
      console.error("Failed to construct SpeechRecognition:", e);
      return false;
    }
  },

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
    this.onVolumeChange = callbacks.onVolumeChange || null;

    const activeAudioCallback = callbacks.onAudioCaptured || null;

    this.shouldBeActive = true;
    this.lastError = null;

    try {
      this.recognition.start();

      // Request media stream after a small hardware delay to prevent parallel device acquisition locks
      setTimeout(async () => {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia && this.isActive) {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaStream = stream;
            
            // Web Audio Analyzer for Volume Level tracking
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (AudioContextClass) {
              try {
                const audioCtx = new AudioContextClass();
                const source = audioCtx.createMediaStreamSource(stream);
                const analyser = audioCtx.createAnalyser();
                analyser.fftSize = 32;
                source.connect(analyser);
                
                this.audioCtx = audioCtx;
                this.audioAnalyser = analyser;
                
                const bufferLength = analyser.frequencyBinCount;
                const dataArray = new Uint8Array(bufferLength);
                
                this.volumeInterval = setInterval(() => {
                  if (!this.isActive) return;
                  analyser.getByteFrequencyData(dataArray);
                  let sum = 0;
                  for (let i = 0; i < bufferLength; i++) {
                    sum += dataArray[i];
                  }
                  const average = sum / bufferLength;
                  const pct = Math.min(Math.round((average / 150) * 100), 100);
                  
                  if (this.onVolumeChange) {
                    this.onVolumeChange(pct);
                  }
                }, 80);
              } catch (ctxErr) {
                console.warn("Could not initialize AudioContext volume visualizer:", ctxErr);
              }
            }

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
              if (activeAudioCallback && blob.size > 100) {
                activeAudioCallback(blob);
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

  stop() {
    this.shouldBeActive = false;
    this.clearSilenceTimer();

    // Clean up Web Audio Analyser
    if (this.volumeInterval) {
      clearInterval(this.volumeInterval);
      this.volumeInterval = null;
    }
    if (this.audioCtx) {
      try {
        if (this.audioCtx.state !== "closed") {
          this.audioCtx.close();
        }
      } catch (err) {
        console.warn("Error closing AudioContext:", err);
      }
      this.audioCtx = null;
    }

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
