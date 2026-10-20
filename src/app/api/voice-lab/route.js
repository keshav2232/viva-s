/**
 * POST /api/voice-lab — development-only playground for Gemini TTS voices (see /voice-lab).
 * Returns a WAV clip for { text, voice, style }. Disabled in production builds.
 */
import { GEMINI_VOICES } from "@/app/voice-lab/voices";

const MODEL = "gemini-2.5-flash-preview-tts";
const cache = new Map(); // `${voice}|${style}|${text}` -> ArrayBuffer (saves the small free-tier quota)

// Gemini returns raw 16-bit mono PCM at 24 kHz; browsers need a WAV header to play it.
function pcmToWav(pcm, sampleRate = 24000) {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

function wavResponse(buffer, ms, cached) {
  return new Response(buffer, { headers: { "Content-Type": "audio/wav", "X-TTS-Ms": String(ms), "X-TTS-Cached": cached ? "1" : "0" } });
}

export async function POST(req) {
  if (process.env.NODE_ENV === "production") return new Response("Not found", { status: 404 });

  let body;
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  const text = String(body?.text || "").trim().slice(0, 500);
  const style = String(body?.style || "").trim().slice(0, 400);
  const voice = String(body?.voice || "");
  if (!text) return Response.json({ error: "Type something for the voice to say." }, { status: 400 });
  if (!GEMINI_VOICES.some((v) => v.name === voice)) return Response.json({ error: "Unknown voice." }, { status: 400 });
  if (!process.env.GEMINI_API_KEY) return Response.json({ error: "GEMINI_API_KEY is not set in .env.local." }, { status: 503 });

  const key = `${voice}|${style}|${text}`;
  if (cache.has(key)) return wavResponse(cache.get(key), 0, true);

  // The style is a plain-language direction placed in front of the line to be spoken.
  const prompt = style ? `${style}\n\nSay exactly this, and nothing else:\n${text}` : text;
  const started = Date.now();
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } }
      }),
      signal: AbortSignal.timeout(30000)
    });
    const data = await res.json();
    if (!res.ok) {
      const msg = res.status === 429
        ? "Gemini TTS quota reached (free tier). Wait a minute, or try again tomorrow if the daily limit is used up."
        : data?.error?.message || "Gemini TTS request failed.";
      return Response.json({ error: msg }, { status: res.status });
    }
    const audio = data?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData;
    if (!audio?.data) return Response.json({ error: "Gemini returned no audio for this line. Try rewording the style." }, { status: 502 });

    const rate = Number(/rate=(\d+)/.exec(audio.mimeType || "")?.[1]) || 24000;
    const wav = pcmToWav(Buffer.from(audio.data, "base64"), rate);
    cache.set(key, wav);
    return wavResponse(wav, Date.now() - started, false);
  } catch (err) {
    console.error("voice-lab TTS error:", err);
    return Response.json({ error: "Could not reach Gemini TTS (timeout or network)." }, { status: 502 });
  }
}
