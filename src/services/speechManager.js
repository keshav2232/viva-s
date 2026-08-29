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
  pendingCallbacks: null,

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
        console.warn("Speech Recognition Error:", event.error);
        this.lastError = event.error;
        this.clearSilenceTimer();
        
        if (this.onError) {
          this.onError(event.error);
        }
      };

      this.recognition.onend = () => {
        this.isActive = false;
        this.clearSilenceTimer();
        
        if (this.pendingCallbacks) {
          console.log("SpeechManager: Previous session stopped. Starting queued fresh session...");
          const callbacks = this.pendingCallbacks;
          this.pendingCallbacks = null;
          this.interimTranscript = "";
          this.finalTranscript = "";
          this.gapsHistory = [];
          this.isHotRestarting = false;
          this.start(callbacks);
          return;
        }
        
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

    if (this.isActive) {
      console.log("SpeechManager: start() called while active. Queueing start after stopping current session...");
      this.pendingCallbacks = callbacks;
      this.shouldBeActive = false;
      if (this.recognition) {
        try {
          this.recognition.stop();
        } catch (e) {
          console.warn("SpeechManager: Error stopping during restart:", e);
        }
      }
      return;
    }

    if (!this.recognition && !this.init()) {
      if (callbacks.onError) {
        callbacks.onError("not-supported");
      }
      return;
    }

    // Reset transcripts and states on a fresh start
    if (!this.isHotRestarting) {
      this.interimTranscript = "";
      this.finalTranscript = "";
      this.gapsHistory = [];
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
            let options = {};
            let mimeType = "audio/webm";
            
            try {
              if (typeof MediaRecorder.isTypeSupported === "function") {
                if (MediaRecorder.isTypeSupported("audio/webm")) {
                  options = { mimeType: "audio/webm" };
                  mimeType = "audio/webm";
                } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
                  options = { mimeType: "audio/mp4" };
                  mimeType = "audio/mp4";
                } else if (MediaRecorder.isTypeSupported("audio/ogg")) {
                  options = { mimeType: "audio/ogg" };
                  mimeType = "audio/ogg";
                } else if (MediaRecorder.isTypeSupported("audio/wav")) {
                  options = { mimeType: "audio/wav" };
                  mimeType = "audio/wav";
                }
              }
            } catch (mimeErr) {
              console.warn("MediaRecorder.isTypeSupported check failed:", mimeErr);
            }

            const recorder = new MediaRecorder(stream, options);
            this.mediaRecorder = recorder;
            
            recorder.ondataavailable = (event) => {
              if (event.data && event.data.size > 0) {
                this.audioChunks.push(event.data);
              }
            };
            
            recorder.onstop = () => {
              const blob = new Blob(this.audioChunks, { type: mimeType });
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

  /**
   * Stops recording and returns a Promise that resolves with the final
   * { transcript, audioBlob, durationMs, gapsCount } bundle atomically.
   * This is the primary stop path for evaluated rounds — it eliminates
   * the old race condition where transcript and audio arrived separately.
   * @param {number} speechStartTime - Date.now() value from when listening started
   * @returns {Promise<{ transcript: string, audioBlob: Blob|null, durationMs: number, gapsCount: number }>}
   */
  stopAndCapture(speechStartTime) {
    return new Promise((resolve) => {
      const durationMs = speechStartTime ? (Date.now() - speechStartTime) : 0;
      const transcript = this.finalTranscript.trim();
      const gapsCount = this.gapsHistory.length;

      this.shouldBeActive = false;
      this.clearSilenceTimer();

      // Cleanup volume analyser
      if (this.volumeInterval) {
        clearInterval(this.volumeInterval);
        this.volumeInterval = null;
      }
      if (this.audioCtx) {
        try {
          if (this.audioCtx.state !== "closed") this.audioCtx.close();
        } catch (err) {
          console.warn("Error closing AudioContext in stopAndCapture:", err);
        }
        this.audioCtx = null;
      }

      // Stop speech recognition
      if (this.recognition && this.isActive) {
        try { this.recognition.stop(); } catch (e) { /* ignore */ }
      }

      // Wait for MediaRecorder onstop to get the blob, then resolve
      if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
        // Override onstop to capture blob and resolve the promise
        const originalMimeType = this.mediaRecorder.mimeType || "audio/webm";
        const chunks = [...(this.audioChunks || [])];

        this.mediaRecorder.addEventListener("dataavailable", (e) => {
          if (e.data && e.data.size > 0) chunks.push(e.data);
        }, { once: true });

        this.mediaRecorder.addEventListener("stop", () => {
          const blob = new Blob(chunks, { type: originalMimeType });

          // Cleanup stream tracks
          if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
          }
          this.mediaRecorder = null;

          resolve({
            transcript,
            audioBlob: blob.size > 100 ? blob : null,
            durationMs,
            gapsCount
          });
        }, { once: true });

        try {
          this.mediaRecorder.stop();
        } catch (err) {
          console.warn("MediaRecorder stop error in stopAndCapture:", err);
          if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
          }
          this.mediaRecorder = null;
          resolve({ transcript, audioBlob: null, durationMs, gapsCount });
        }
      } else {
        // No active recorder — resolve immediately with transcript only
        if (this.mediaStream) {
          this.mediaStream.getTracks().forEach(track => track.stop());
          this.mediaStream = null;
        }
        resolve({ transcript, audioBlob: null, durationMs, gapsCount });
      }
    });
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

    // Stop Media Stream Tracks immediately to release mic indicator
    if (this.mediaStream) {
      try {
        this.mediaStream.getTracks().forEach(track => track.stop());
      } catch (err) {
        console.warn("Error stopping media stream tracks on stop:", err);
      }
      this.mediaStream = null;
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
