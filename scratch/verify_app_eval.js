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

async function verifyFullPipeline() {
  console.log("--- VERIFYING UPDATED GEMINI AI SERVICE WITH OGG AUDIO ---");
  const oggPath = path.resolve("WhatsApp Ptt 2026-08-21 at 10.10.00 PM.ogg");
  const audioBuffer = fs.readFileSync(oggPath);
  const audioBase64 = audioBuffer.toString("base64");
  const audioMimeType = "audio/ogg";

  const prompt = `Act as an academic examiner grading an oral response in a college viva.

Question Asked: "Explain the fundamental principles of thermodynamics and units & dimensions."
Student Response: "(Spoken audio response)"
Syllabus Context: {"topic":"Physics","units":[{"name":"Unit 1","topics":["Units","Dimensions"]}]}
An audio recording of the speaker's actual voice is attached. Listen carefully and evaluate BOTH the spoken content (correctness, logic, accuracy) AND the vocal delivery (clarity, confidence, nervousness, hesitation) from the audio prosody, pitch, tone, pacing, and hesitation.

CRITICAL SCORING INSTRUCTIONS:
Assign DYNAMIC, UNIQUE INTEGER SCORES (0-100) specific to this student's exact answer and voice audio.

Respond ONLY with a valid clean JSON object:
{
  "correctness": 82,
  "completeness": 68,
  "accuracy": 76,
  "clarity": 84,
  "confidence": 78,
  "nervousness": 24,
  "hesitation": 16,
  "tag": "Strong",
  "correctAnswer": "Ideal reference answer",
  "gradingSource": "audio+text"
}`;

  try {
    const result = await GeminiAIService.callGeminiInteraction({
      prompt,
      apiKey: process.env.GEMINI_API_KEY,
      audioBase64,
      audioMimeType
    });

    console.log("\nVERIFICATION SUCCESSFUL!");
    console.log("Evaluation Result:", JSON.stringify(result, null, 2));

    if (
      typeof result.correctness === "number" &&
      typeof result.clarity === "number" &&
      typeof result.confidence === "number" &&
      typeof result.nervousness === "number" &&
      typeof result.hesitation === "number"
    ) {
      console.log("\n✅ All 8 evaluation parameters are valid numbers!");
    } else {
      console.error("\n❌ Incomplete metric numbers returned!");
      process.exit(1);
    }
  } catch (err) {
    console.error("\n❌ Verification Failed:", err.message);
    process.exit(1);
  }
}

verifyFullPipeline();
