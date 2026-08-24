import fs from "fs";
import path from "path";
import { GeminiAIService } from "../src/services/GeminiAIService.js";

// Read .env.local manually
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

async function testAudioEval() {
  const oggPath = path.resolve("WhatsApp Ptt 2026-08-21 at 10.10.00 PM.ogg");
  const audioBuffer = fs.readFileSync(oggPath);
  const audioBase64 = audioBuffer.toString("base64");

  console.log("Audio file loaded:", oggPath, "Size:", audioBuffer.length, "bytes");
  console.log("Using GEMINI_API_KEY present:", !!process.env.GEMINI_API_KEY);

  const prompt = `Act as an academic examiner grading an oral response in a college viva.

Question Asked: "Explain the fundamental principles of thermodynamics and energy conservation."
Student Response: "(Spoken audio response in attached recording)"
Syllabus Context: {"topic":"Thermodynamics","units":[{"name":"Unit 1: Fundamentals","topics":["First law","Second law","Entropy"]}]}
An audio recording of the speaker's actual voice is attached. Listen carefully and evaluate BOTH the spoken content (correctness, logic, accuracy) AND the vocal delivery (clarity, confidence, nervousness, hesitation) from the audio.

CRITICAL SCORING INSTRUCTIONS:
You MUST evaluate THIS specific response individually and assign DYNAMIC, UNIQUE INTEGER SCORES (0-100) specific to this student's exact answer and voice audio.

Respond ONLY with a valid clean JSON object matching this schema:
{
  "correctness": 82,
  "completeness": 68,
  "accuracy": 76,
  "clarity": 84,
  "confidence": 78,
  "nervousness": 24,
  "hesitation": 16,
  "tag": "Strong",
  "transcript": "Transcribe exact spoken words here",
  "vocalAnalysis": "Detailed analysis of emotional tone, nervousness, confidence, pitch, speed, hesitation, tone quality from the audio",
  "correctAnswer": "A precise academic answer with governing equations, definitions, boundary conditions.",
  "gradingSource": "audio+text"
}`;

  console.log("\n--- TESTING WITH CURRENT CODE (GeminiAIService with current models & hardcoded webm) ---");
  try {
    const result = await GeminiAIService.callGeminiInteraction({
      prompt,
      apiKey: process.env.GEMINI_API_KEY,
      audioBase64
    });
    console.log("\nSUCCESS Result:", JSON.stringify(result, null, 2));
  } catch (err) {
    console.error("\nFAILED Error:", err.message);
  }
}

testAudioEval();
