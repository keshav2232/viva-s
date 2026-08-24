import fs from "fs";
import path from "path";
import { GeminiAIService } from "../src/services/GeminiAIService.js";

const envText = fs.readFileSync(".env.local", "utf8");
envText.split("\n").forEach(line => {
  const parts = line.split("=");
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const val = parts.slice(1).join("=").trim().replace(/^["']|["']$/g, '');
    if (key && !key.startsWith("#")) {
      process.env[key] = val;
    }
  }
});

async function testFillerDetection() {
  console.log("--- TESTING AUDIO FILLER WORD DETECTION ---");
  const oggPath = path.resolve("WhatsApp Ptt 2026-08-21 at 10.10.00 PM.ogg");
  const audioBuffer = fs.readFileSync(oggPath);
  const audioBase64 = audioBuffer.toString("base64");
  const audioMimeType = "audio/ogg";

  const prompt = `Act as an academic examiner and speech analyst grading an oral response in a college viva.

An audio recording of the speaker's actual voice is attached. Listen carefully to the raw audio recording and perform two tasks:
1. Evaluate content and vocal metrics (correctness, completeness, accuracy, clarity, confidence, nervousness, hesitation).
2. LISTEN TO RAW VOCALIZATIONS in the audio recording and count every spoken filler word/vocal hesitation (such as 'um', 'uh', 'ah', 'basically', 'you know', 'like', or phrase repetitions).

Respond ONLY with a valid clean JSON object matching this schema:
{
  "correctness": 75,
  "completeness": 60,
  "accuracy": 70,
  "clarity": 65,
  "confidence": 50,
  "nervousness": 40,
  "hesitation": 45,
  "fillerCount": 3,
  "fillerBreakdown": {
    "um": 1,
    "uh": 1,
    "ah": 0,
    "basically": 1,
    "you know": 0,
    "like": 0
  },
  "tag": "Partially Correct",
  "correctAnswer": "Reference answer",
  "gradingSource": "audio+text"
}`;

  try {
    const result = await GeminiAIService.callGeminiInteraction({
      prompt,
      apiKey: process.env.GEMINI_API_KEY,
      audioBase64,
      audioMimeType
    });

    console.log("\nFILLER DETECTION RESULT:", JSON.stringify(result, null, 2));
  } catch (err) {
    console.error("Error:", err.message);
  }
}

testFillerDetection();
