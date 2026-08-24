import fs from "fs";
import path from "path";
import { GoogleGenAI } from "@google/genai";

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

async function run2026ModelsTest() {
  const oggPath = path.resolve("WhatsApp Ptt 2026-08-21 at 10.10.00 PM.ogg");
  const audioBuffer = fs.readFileSync(oggPath);
  const audioBase64 = audioBuffer.toString("base64");

  const apiKey = process.env.GEMINI_API_KEY;
  const ai = new GoogleGenAI({ apiKey });

  const prompt = `Act as an academic examiner and speech/emotion analyst grading an oral response in a college viva.

An audio recording of the student's actual spoken voice is attached. Listen carefully to the audio and evaluate BOTH the spoken content (correctness, logic, accuracy) AND the vocal delivery (clarity, confidence, nervousness, hesitation) from the audio prosody, pitch, pace, pauses, and speech patterns.

CRITICAL INSTRUCTIONS:
1. Transcribe the exact words spoken in the audio recording under "transcript".
2. Perform detailed emotional & vocal analysis under "vocalAnalysis" describing tone, nervousness, confidence, hesitation, pace, pitch variations, and emotional state.
3. Assign DYNAMIC, REAL INTEGER SCORES (0-100) based strictly on what you hear in the audio:
   - correctness (0-100)
   - completeness (0-100)
   - accuracy (0-100)
   - clarity (0-100)
   - confidence (0-100)
   - nervousness (0-100)
   - hesitation (0-100)

Respond ONLY with a valid, clean JSON object matching this schema:
{
  "transcript": "Exact transcription of the attached audio",
  "vocalAnalysis": "Detailed emotional and prosodic evaluation of the audio",
  "correctness": 80,
  "completeness": 75,
  "accuracy": 80,
  "clarity": 85,
  "confidence": 70,
  "nervousness": 30,
  "hesitation": 20,
  "tag": "Strong",
  "correctAnswer": "Ideal reference answer"
}`;

  const validModels = ["gemini-3.6-flash", "gemini-3.5-flash", "gemini-3.5-flash-lite"];

  for (const model of validModels) {
    try {
      console.log(`Trying model: ${model}...`);
      const response = await ai.models.generateContent({
        model: model,
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: "audio/ogg",
                  data: audioBase64
                }
              }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json"
        }
      });

      console.log(`\n=== SUCCESS WITH MODEL: ${model} ===`);
      console.log(response.text);
      return;
    } catch (err) {
      console.error(`Failed with model ${model}:`, err.message);
    }
  }
}

run2026ModelsTest();
