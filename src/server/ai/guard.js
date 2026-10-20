/**
 * Request guard: abuse protection (rate limits + signed-in tiers) and input normalisation.
 * Nothing from the browser reaches a prompt without passing through normalizePayload().
 */
import { clip, normalizeSyllabus } from "./context";

const MAX_TTS_CHARS = 1200;
const MAX_TEXT_CHARS = 8000;
const MAX_AUDIO_BASE64_CHARS = 8_000_000;
const VALID_PERSONALITIES = ["friendly", "strict", "brutal", "terror"];
const VALID_TAGS = ["Strong", "Weak", "Partially Correct", "Bluffing", "Incomplete", "Confused"];

// ---------------------------------------------------------------------------
// Abuse protection: per-client sliding-window limits. Signed-in users (valid Firebase
// ID token) get a higher tier than guests. In-memory, so it is per server instance;
// put a shared store (Redis/Upstash) behind it if you scale horizontally.
// ---------------------------------------------------------------------------
const LIMITS = {
  guest: { ai: 40, tts: 20 },
  user: { ai: 120, tts: 60 }
};
const WINDOW_MS = 60_000;
const hits = new Map(); // key -> { count, resetAt }
const tokenCache = new Map(); // token -> { uid, expiresAt }

export function clientKey(req) {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd ? fwd.split(",")[0].trim() : req.headers.get("x-real-ip")) || "local";
}

export async function resolveTier(req) {
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return { tier: "guest", id: null };

  const cached = tokenCache.get(token);
  if (cached && cached.expiresAt > Date.now()) return { tier: "user", id: cached.uid };

  const webKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!webKey) return { tier: "guest", id: null };
  try {
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${webKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: token }),
      signal: AbortSignal.timeout(4000)
    });
    if (!res.ok) return { tier: "guest", id: null };
    const data = await res.json();
    const uid = data?.users?.[0]?.localId;
    if (!uid) return { tier: "guest", id: null };
    if (tokenCache.size > 500) tokenCache.clear();
    tokenCache.set(token, { uid, expiresAt: Date.now() + 5 * 60_000 });
    return { tier: "user", id: uid };
  } catch {
    return { tier: "guest", id: null };
  }
}

export function checkRateLimit(identity, ip, bucket) {
  const key = `${identity.id || ip}:${bucket}`;
  const now = Date.now();
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (v.resetAt < now) hits.delete(k);
  }
  const entry = hits.get(key);
  if (!entry || entry.resetAt < now) {
    hits.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true };
  }
  entry.count += 1;
  if (entry.count > LIMITS[identity.tier][bucket]) {
    return { ok: false, retryAfter: Math.max(Math.ceil((entry.resetAt - now) / 1000), 1) };
  }
  return { ok: true };
}


const arr = (v, max = 20) => (Array.isArray(v) ? v.slice(0, max) : []);
const num = (v, lo = 0, hi = 100) => (Number.isFinite(Number(v)) ? Math.min(Math.max(Number(v), lo), hi) : undefined);

/** Compact round summary sent by the browser: {topic, tag, score, q, a}. */
function normalizeRounds(rounds) {
  return arr(rounds, 15).map((r) => ({
    topic: clip(r?.topic, 80),
    tag: VALID_TAGS.includes(r?.tag) ? r.tag : "",
    score: num(r?.score),
    q: clip(r?.q, 160),
    a: clip(r?.a, 260),
    depth: num(r?.depth, 0, 5) ?? 0 // 0 = main question, 1.. = follow-up in a chain
  }));
}

export function normalizePayload(raw) {
  const mode = raw.mode === "professional" ? "professional" : "academic";
  const q = raw.question && typeof raw.question === "object" ? raw.question : {};
  const delivery = raw.delivery && typeof raw.delivery === "object" ? raw.delivery : {};

  return {
    action: typeof raw.action === "string" ? raw.action : "",
    mode,
    personality: VALID_PERSONALITIES.includes(raw.personality) ? raw.personality : "friendly",
    duration: parseInt(raw.duration, 10) || 5,
    topic: clip(raw.topic, 300),
    text: typeof raw.text === "string" ? raw.text.slice(0, raw.action === "synthesize-speech" ? MAX_TTS_CHARS : MAX_TEXT_CHARS) : "",
    syllabus: normalizeSyllabus(raw.syllabus),
    syllabusStructure: normalizeSyllabus(raw.syllabusStructure),
    isTargetDrill: !!raw.isTargetDrill,
    targetSubtopic: clip(raw.targetSubtopic, 120),
    nervousness: num(raw.nervousness) ?? 0,
    // Seconds left on the session clock (drives when the session ends; undefined = unknown)
    timeLeftSec: num(raw.timeLeftSec, 0, 4 * 3600),
    // Live-session turn
    question: typeof raw.question === "string"
      ? clip(raw.question, 2000)
      : { text: clip(q.text, 600), topic: clip(q.topic, 100), keyPoints: arr(q.keyPoints, 5).map((k) => clip(k, 80)).filter(Boolean), depth: num(q.depth, 0, 5) ?? 0 },
    answer: typeof raw.answer === "string" ? raw.answer.slice(0, 6000) : "",
    rounds: normalizeRounds(raw.rounds),
    pauseCount: num(raw.pauseCount, 0, 200) ?? 0,
    delivery: { wpm: num(delivery.wpm, 0, 400), fillerCount: num(delivery.fillerCount, 0, 200) },
    audioBase64: typeof raw.audioBase64 === "string" && raw.audioBase64.length <= MAX_AUDIO_BASE64_CHARS ? raw.audioBase64 : null,
    // Stuck-candidate nudges: hint level (friendly) and sub-question level/tone
    level: ["rephrase", "hint", "simplify"].includes(raw.level) ? raw.level : "hint",
    step: num(raw.step, 1, 3) ?? 1,
    // Hindsight
    subjectName: clip(raw.subjectName, 120),
    askedQuestions: arr(raw.askedQuestions, 15).map((x) => clip(x, 400)),
    askedQuestionsObjects: arr(raw.askedQuestionsObjects, 15).map((o) => ({ topic: clip(o?.topic, 80), difficulty: clip(o?.difficulty, 12) })),
    answerTranscripts: arr(raw.answerTranscripts, 15).map((x) => clip(x, 1500)),
    detectedEmotions: arr(raw.detectedEmotions, 15).map((e) => ({
      tag: VALID_TAGS.includes(e?.tag) ? e.tag : "",
      correctness: num(e?.correctness), confidence: num(e?.confidence), nervousness: num(e?.nervousness), hesitation: num(e?.hesitation)
    }))
  };
}
