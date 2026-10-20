// Gemini TTS prebuilt voices and the descriptor Google publishes for each.
export const GEMINI_VOICES = [
  { name: "Zephyr", tone: "Bright" }, { name: "Puck", tone: "Upbeat" }, { name: "Charon", tone: "Informative" },
  { name: "Kore", tone: "Firm" }, { name: "Fenrir", tone: "Excitable" }, { name: "Leda", tone: "Youthful" },
  { name: "Orus", tone: "Firm" }, { name: "Aoede", tone: "Breezy" }, { name: "Callirrhoe", tone: "Easy-going" },
  { name: "Autonoe", tone: "Bright" }, { name: "Enceladus", tone: "Breathy" }, { name: "Iapetus", tone: "Clear" },
  { name: "Umbriel", tone: "Easy-going" }, { name: "Algieba", tone: "Smooth" }, { name: "Despina", tone: "Smooth" },
  { name: "Erinome", tone: "Clear" }, { name: "Algenib", tone: "Gravelly" }, { name: "Rasalgethi", tone: "Informative" },
  { name: "Laomedeia", tone: "Upbeat" }, { name: "Achernar", tone: "Soft" }, { name: "Alnilam", tone: "Firm" },
  { name: "Schedar", tone: "Even" }, { name: "Gacrux", tone: "Mature" }, { name: "Pulcherrima", tone: "Forward" },
  { name: "Achird", tone: "Friendly" }, { name: "Zubenelgenubi", tone: "Casual" }, { name: "Vindemiatrix", tone: "Gentle" },
  { name: "Sadachbia", tone: "Lively" }, { name: "Sadaltager", tone: "Knowledgeable" }, { name: "Sulafat", tone: "Warm" }
];

// Starting point for each examiner: a voice plus a plain-language acting direction.
export const PROFESSORS = [
  {
    id: "friendly", title: "Friendly Professor", voice: "Sulafat",
    style: "You are a kind, encouraging university professor. Speak warmly and patiently, with a gentle smile in your voice and an unhurried pace."
  },
  {
    id: "strict", title: "Strict Professor", voice: "Kore",
    style: "You are a formal, exacting professor. Speak crisply and precisely, neutral and businesslike, with no warmth and a measured pace."
  },
  {
    id: "brutal", title: "Brutal External Examiner", voice: "Algenib",
    style: "You are a blunt, impatient external examiner. Sound unimpressed and slightly sarcastic. Speak fast, in clipped sentences."
  },
  {
    id: "terror", title: "Viva Terror", voice: "Charon",
    style: "You are a cold, intimidating examiner. Speak slowly and deliberately in a low voice, with a menacing calm and short pauses before key words."
  }
];

export const SAMPLE_LINES = [
  { label: "Question", text: "Let's begin. Explain the second law of thermodynamics, and tell me why entropy matters in a real engine." },
  { label: "After a good answer", text: "Good. That is correct. Now go one step further: what limits the efficiency of a Carnot engine?" },
  { label: "After a weak answer", text: "That is not quite right. You are mixing up heat and temperature. Try again, and be precise this time." },
  { label: "Interruption", text: "Stop. You are going around in circles. Give me the definition, in one sentence." }
];
