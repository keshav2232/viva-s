/**
 * VivaSim - Unified Voice Synthesis Manager (TTS) with ElevenLabs support, preloading, and backup failsafes.
 * Safe for Next.js SSR.
 */

export const VoiceManager = {
  activeAudio: null,
  activeUtterance: null,
  voices: [],
  selectedVoice: null,
  
  // Preload Cache
  preloadedCache: {}, // Maps text string to object URL
  
  // Callback for failsafe state shifts
  onFailsafeActive: null,
  isFailsafeMode: false,

  /**
   * Initializes the browser fallback voice synthesis system. Safe for SSR.
   */
  init() {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    this.loadVoices();
    window.speechSynthesis.onvoiceschanged = () => {
      this.loadVoices();
    };

    // Unlock Web Speech API and HTML5 Audio on the first user interaction
    const unlockAudioAndTTS = () => {
      try {
        // Play silent audio to unlock HTML5 Audio
        const audio = new Audio();
        audio.play().catch(() => {});

        // Speak a silent utterance to unlock Web Speech Synthesis
        const silentUtterance = new SpeechSynthesisUtterance("");
        window.speechSynthesis.speak(silentUtterance);
      } catch (e) {
        console.warn("Failed to pre-unlock audio/TTS context:", e);
      }

      document.removeEventListener("click", unlockAudioAndTTS);
      document.removeEventListener("keydown", unlockAudioAndTTS);
    };

    document.addEventListener("click", unlockAudioAndTTS);
    document.addEventListener("keydown", unlockAudioAndTTS);
  },

  /**
   * Loads and filters browser fallback voices.
   */
  loadVoices() {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    
    try {
      const allVoices = window.speechSynthesis.getVoices();
      this.voices = allVoices.filter(v => v.lang.startsWith("en"));
      
      const preferredKeywords = [
        "google uk english male",
        "google uk english female",
        "google us english male",
        "google us english female",
        "natural",
        "microsoft david",
        "microsoft zira",
        "en-GB",
        "en-US"
      ];

      for (const keyword of preferredKeywords) {
        const match = this.voices.find(v => v.name.toLowerCase().includes(keyword));
        if (match) {
          this.selectedVoice = match;
          break;
        }
      }

      if (!this.selectedVoice && this.voices.length > 0) {
        this.selectedVoice = this.voices[0];
      }
    } catch (e) {
      console.warn("Unable to fetch browser fallback voices:", e);
    }
  },

  /**
   * Preloads voice synthesis from ElevenLabs in the background.
   */
  async preload(text, personality = "friendly") {
    if (typeof window === "undefined" || !text) return;
    const cleanText = text.trim();
    if (this.preloadedCache[cleanText]) return; // Already cached

    try {
      const response = await fetch("/api/viva", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "synthesize-speech",
          text: cleanText,
          personality
        })
      });

      if (!response.ok) throw new Error("Preload fetch failed");

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      this.preloadedCache[cleanText] = objectUrl;
    } catch (err) {
      console.warn(`ElevenLabs speech preload failed for: "${cleanText.substring(0, 20)}...". ${err.message}`);
    }
  },

  /**
   * Speaks the provided text aloud. Uses ElevenLabs with browser Web Speech TTS fallback.
   */
  async speak(text, personality = "friendly", onStart = null, onEnd = null) {
    const speakId = Math.random().toString(36).substring(2, 9);
    this.activeSpeakId = speakId;

    this.stop(); // Cancel active playbacks and reset the active ID to this new one
    this.activeSpeakId = speakId;

    if (typeof window === "undefined") {
      if (onStart) onStart();
      setTimeout(() => {
        if (this.activeSpeakId === speakId && onEnd) onEnd();
      }, 2000);
      return;
    }

    const cleanText = text.trim();

    // 1. Attempt ElevenLabs Synthesis (Preloaded or Live)
    if (!this.isFailsafeMode) {
      try {
        let objectUrl = this.preloadedCache[cleanText];
        
        if (!objectUrl) {
          // Fetch live if not preloaded
          const response = await fetch("/api/viva", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "synthesize-speech",
              text: cleanText,
              personality
            })
          });

          // Check if this speak call is still the active one
          if (this.activeSpeakId !== speakId) {
            console.log("Speak call superseded during fetch, aborting.");
            return;
          }

          if (!response.ok) throw new Error("ElevenLabs live synthesis failed");
          const blob = await response.blob();
          
          // Check again after reading blob
          if (this.activeSpeakId !== speakId) {
            console.log("Speak call superseded during blob parse, aborting.");
            return;
          }

          objectUrl = URL.createObjectURL(blob);
          this.preloadedCache[cleanText] = objectUrl; // Cache it
        }

        // Final check before creating Audio and playing
        if (this.activeSpeakId !== speakId) {
          console.log("Speak call superseded before playback, aborting.");
          return;
        }

        const audio = new Audio(objectUrl);
        this.activeAudio = audio;

        audio.onplay = () => {
          if (this.activeSpeakId === speakId && onStart) {
            onStart();
          }
        };

        audio.onended = () => {
          if (this.activeSpeakId === speakId) {
            this.activeAudio = null;
            if (onEnd) onEnd();
          }
        };

        audio.onerror = (e) => {
          if (this.activeSpeakId !== speakId) return;
          console.error("Audio playback error, falling back to browser TTS:", e);
          this.triggerFailsafeFallback(cleanText, personality, onStart, onEnd, speakId);
        };

        await audio.play();
        return; // Success!

      } catch (err) {
        if (this.activeSpeakId !== speakId) return;
        console.warn("ElevenLabs TTS failed. Activating Web Speech fallback:", err.message);
        this.isFailsafeMode = true;
        if (this.onFailsafeActive) {
          this.onFailsafeActive("Voice quality reduced temporarily.");
        }
      }
    }

    // 2. Browser Web Speech Fallback
    if (this.activeSpeakId === speakId) {
      this.triggerFailsafeFallback(cleanText, personality, onStart, onEnd, speakId);
    }
  },

  /**
   * Browser TTS Fallback implementation
   */
  triggerFailsafeFallback(text, personality, onStart, onEnd, speakId) {
    if (this.activeSpeakId !== speakId) return;

    if (!window.speechSynthesis) {
      console.warn("Browser Speech Synthesis is not supported.");
      if (onStart) onStart();
      setTimeout(() => {
        if (this.activeSpeakId === speakId && onEnd) onEnd();
      }, 2000);
      return;
    }

    try {
      this.activeUtterance = new SpeechSynthesisUtterance(text);
      
      if (!this.selectedVoice && this.voices.length === 0) {
        this.loadVoices();
      }

      if (this.selectedVoice) {
        this.activeUtterance.voice = this.selectedVoice;
      }

      // Emulate personality pacing on standard Web Speech API
      switch(personality) {
        case "friendly":
          this.activeUtterance.rate = 0.98;
          this.activeUtterance.pitch = 1.05;
          break;
        case "strict":
          this.activeUtterance.rate = 0.90;
          this.activeUtterance.pitch = 0.90;
          break;
        case "brutal":
          this.activeUtterance.rate = 1.05;
          this.activeUtterance.pitch = 0.95;
          break;
        case "terror":
          this.activeUtterance.rate = 0.88;
          this.activeUtterance.pitch = 0.80;
          break;
        default:
          this.activeUtterance.rate = 1.0;
          this.activeUtterance.pitch = 1.0;
      }

      let speechCompleted = false;
      const handleEnd = (event) => {
        if (speechCompleted) return;
        speechCompleted = true;
        if (this.activeSpeakId === speakId) {
          this.activeUtterance = null;
          if (onEnd) onEnd(event);
        }
      };

      this.activeUtterance.onstart = (event) => {
        if (this.activeSpeakId === speakId && onStart) {
          onStart(event);
        }
      };

      this.activeUtterance.onend = handleEnd;
      this.activeUtterance.onerror = (event) => {
        console.error("Speech Synthesis Error:", event.error || event);
        handleEnd(event);
      };

      window.speechSynthesis.speak(this.activeUtterance);

      // Failsafe timeout to prevent stuck states
      const wordCount = text.split(/\s+/).length;
      const failsafeDelay = (wordCount * 380) + 3000;
      setTimeout(() => {
        if (!speechCompleted && this.activeSpeakId === speakId) {
          console.warn("SpeechSynthesis onend failed to fire, forcing end.");
          handleEnd(null);
        }
      }, failsafeDelay);

    } catch (e) {
      console.error("Browser Speech Synthesis exception:", e);
      if (this.activeSpeakId === speakId && onStart) onStart();
      setTimeout(() => {
        if (this.activeSpeakId === speakId && onEnd) onEnd();
      }, 2000);
    }
  },

  /**
   * Pauses active speech.
   */
  pause() {
    if (this.activeAudio) {
      this.activeAudio.pause();
    } else if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.pause();
    }
  },

  /**
   * Resumes paused speech.
   */
  resume() {
    if (this.activeAudio) {
      this.activeAudio.play().catch(e => console.error("Error resuming audio:", e));
    } else if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.resume();
    }
  },

  /**
   * Stops and cancels all active playbacks.
   */
  stop() {
    this.activeSpeakId = null; // Invalidate any pending async speak calls!
    if (this.activeAudio) {
      this.activeAudio.pause();
      this.activeAudio.currentTime = 0;
      this.activeAudio = null;
    }
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      this.activeUtterance = null;
    }
  },

  /**
   * Checks if speaking is active.
   */
  isSpeaking() {
    if (this.activeAudio) {
      return !this.activeAudio.paused;
    }
    if (typeof window !== "undefined" && window.speechSynthesis) {
      return window.speechSynthesis.speaking;
    }
    return false;
  }
};
