/**
 * POST /api/viva — thin entry point. All logic lives in src/server/ai/:
 *   guard.js   rate limits + input normalisation
 *   index.js   feature registry, online run + offline fallback
 *   tts.js     ElevenLabs voice (cached)
 */
import { NextResponse } from "next/server";
import { checkRateLimit, clientKey, normalizePayload, resolveTier } from "@/server/ai/guard";
import { runAiAction } from "@/server/ai";
import { synthesizeSpeech } from "@/server/ai/tts";

export async function POST(req) {
  try {
    const raw = await req.json();
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const payload = normalizePayload(raw);

    const identity = await resolveTier(req);
    const limit = checkRateLimit(identity, clientKey(req), payload.action === "synthesize-speech" ? "tts" : "ai");
    if (!limit.ok) {
      return NextResponse.json(
        { error: "Too many requests. Please slow down and try again shortly." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
      );
    }

    if (payload.action === "synthesize-speech") {
      const result = await synthesizeSpeech(payload.text, payload.personality);
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
      return new NextResponse(result.buffer, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=3600" } });
    }

    const { status, body } = await runAiAction(payload, process.env.GEMINI_API_KEY);
    return NextResponse.json(body, { status });
  } catch (e) {
    // Details stay in the server log; the browser only sees a generic message.
    console.error("API route error:", e);
    return NextResponse.json({ error: "The AI service is temporarily unavailable. Please try again." }, { status: 500 });
  }
}
