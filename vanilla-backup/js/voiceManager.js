/**
 * VivaSim - Unified Voice Synthesis Manager (TTS)
 * Modular abstraction layer wrapping HTML5 window.speechSynthesis.
 * Engineered for easy plug-and-play ElevenLabs cloud streaming later.
 */

const VoiceManager = {
  activeUtterance: null,
  voices: [],
  selectedVoice: null,
  provider: "webSpeech", // "webSpeech" | "elevenLabs" (prepared for future transition)

  /**
   * Initializes the speech synthesis system and loads browser voices.
   */
  init() {
    this.loadVoices();
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = () => {
        this.loadVoices();
      };
    }
  },

  /**
   * Loads and filters the best natural english academic voices.
   */
  loadVoices() {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    
    const allVoices = window.speechSynthesis.getVoices();
    this.voices = allVoices.filter(v => v.lang.startsWith("en"));
    
    // Prioritize natural sounding english voices
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
  },

  /**
   * Speaks the provided text aloud.
   * @param {string} text - The transcript to read.
   * @param {string} personality - friendly | strict | brutal | terror (influences speech rate and pitch).
   * @param {function} onStart - Callback when audio speaking begins.
   * @param {function} onEnd - Callback when audio speaking completes successfully.
   */
  speak(text, personality = "friendly", onStart = null, onEnd = null) {
    if (this.provider === "elevenLabs") {
      // Future hook: ElevenLabs stream implementation
      console.log(`ElevenLabs TTS Provider Mock Speak: "${text}"`);
      if (onStart) onStart();
      setTimeout(() => {
        if (onEnd) onEnd();
      }, text.split(" ").length * 350);
      return;
    }

    // Default Web Speech API
    this.stop(); // Stop any currently speaking voice

    if (typeof window === "undefined" || !window.speechSynthesis) {
      console.warn("Web Speech Synthesis not supported in this browser.");
      if (onStart) onStart();
      setTimeout(() => { if (onEnd) onEnd(); }, 1500);
      return;
    }

    this.activeUtterance = new SpeechSynthesisUtterance(text);
    
    if (this.selectedVoice) {
      this.activeUtterance.voice = this.selectedVoice;
    }

    // Customise acoustics according to Examiner Personality
    switch(personality) {
      case "friendly":
        this.activeUtterance.rate = 0.98;   // Warm, comfortable speed
        this.activeUtterance.pitch = 1.05;  // Slightly higher encouraging pitch
        break;
      case "strict":
        this.activeUtterance.rate = 0.90;   // Deliberate, slower speed
        this.activeUtterance.pitch = 0.90;  // Lower, authoritative pitch
        break;
      case "brutal":
        this.activeUtterance.rate = 1.05;   // Faster, high-tempo speed
        this.activeUtterance.pitch = 0.95;  // Flat, strict pitch
        break;
      case "terror":
        this.activeUtterance.rate = 0.88;   // Very slow, calculated, intimidating pace
        this.activeUtterance.pitch = 0.80;  // Deep, cold, hollow pitch
        break;
      default:
        this.activeUtterance.rate = 1.0;
        this.activeUtterance.pitch = 1.0;
    }

    // Event hooks
    this.activeUtterance.onstart = (event) => {
      if (onStart) onStart(event);
    };

    this.activeUtterance.onend = (event) => {
      this.activeUtterance = null;
      if (onEnd) onEnd(event);
    };

    this.activeUtterance.onerror = (event) => {
      console.error("Speech Synthesis Error:", event);
      this.activeUtterance = null;
      if (onEnd) onEnd(event); // Fallback to end cycle
    };

    window.speechSynthesis.speak(this.activeUtterance);
  },

  /**
   * Pauses active speech synthesis.
   */
  pause() {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.pause();
    }
  },

  /**
   * Resumes paused speech synthesis.
   */
  resume() {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.resume();
    }
  },

  /**
   * Stops and cancels all active speech synthesis operations.
   */
  stop() {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      this.activeUtterance = null;
    }
  },

  /**
   * Checks if speech is actively speaking.
   * @returns {boolean}
   */
  isSpeaking() {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      return window.speechSynthesis.speaking;
    }
    return false;
  }
};

// Initialize Synthesis
VoiceManager.init();
