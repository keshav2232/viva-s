/**
 * ElevenLabs text-to-speech. Not a Gemini feature, but it lives with the other AI services so
 * every paid external call has one home. Identical (text, persona) pairs are served from a small
 * in-memory LRU instead of re-spending credits (e.g. "Replay voice" on the results page).
 */
const VOICES = {
  friendly: "JBFqnCBsd6RMkjVDRZzb", // George
  strict: "onwK4e9ZLuTAKqWW03F9", // Daniel
  brutal: "pNInz6obpgDQGcFmaJgB", // Adam
  terror: "SOYHLrjzK2X1ezoPC6cr" // Harry
};

// Eleven v4 Turbo: low latency, same credit cost as Flash v2.5. Override with ELEVENLABS_MODEL.
const MODEL = process.env.ELEVENLABS_MODEL || "eleven_v4_turbo";

const SETTINGS = {
  friendly: { stability: 0.65, style: 0.0 },
  strict: { stability: 0.65, style: 0.0 },
  brutal: { stability: 0.38, style: 0.1 },
  terror: { stability: 0.22, style: 0.25 }
};

const MAX_ENTRIES = 40;
const MAX_BYTES = 24 * 1024 * 1024;
const lru = new Map(); // key -> ArrayBuffer
let totalBytes = 0;

function remember(key, buffer) {
  lru.set(key, buffer);
  totalBytes += buffer.byteLength;
  while ((lru.size > MAX_ENTRIES || totalBytes > MAX_BYTES) && lru.size > 1) {
    const oldest = lru.keys().next().value;
    totalBytes -= lru.get(oldest).byteLength;
    lru.delete(oldest);
  }
}

/** @returns {Promise<{ok:true,buffer:ArrayBuffer}|{ok:false,status:number,error:string}>} */
export async function synthesizeSpeech(text, personality) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return { ok: false, status: 503, error: "Speech synthesis is not configured." };
  if (!text || !text.trim()) return { ok: false, status: 400, error: "No text to synthesize." };

  const key = `${MODEL}:${personality}:${text}`;
  const hit = lru.get(key);
  if (hit) {
    lru.delete(key); // refresh recency
    lru.set(key, hit);
    return { ok: true, buffer: hit };
  }

  try {
    const s = SETTINGS[personality] || SETTINGS.friendly;
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICES[personality] || VOICES.friendly}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "xi-api-key": apiKey },
      body: JSON.stringify({
        text,
        model_id: MODEL,
        voice_settings: { stability: s.stability, similarity_boost: 0.75, style: s.style, use_speaker_boost: true }
      }),
      signal: AbortSignal.timeout(10000)
    });
    if (!res.ok) {
      console.error("ElevenLabs speech synthesis failed:", (await res.text()).slice(0, 300));
      return { ok: false, status: res.status === 429 ? 429 : 502, error: "Speech synthesis failed." };
    }
    const buffer = await res.arrayBuffer();
    remember(key, buffer);
    return { ok: true, buffer };
  } catch (err) {
    console.error("Error in synthesize-speech:", err);
    return { ok: false, status: 500, error: "Speech synthesis failed." };
  }
}
