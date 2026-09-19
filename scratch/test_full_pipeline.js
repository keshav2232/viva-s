import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

const envFile = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf-8');
const match = envFile.match(/GEMINI_API_KEY=(.+)/);
const apiKey = match ? match[1].trim() : '';

const sampleBase64Audio = "GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQRChYECGFOAZwEAAAAAABqARwAAACN2ZWJtYmFzZWZzLzAAAAAAFgAAAGcBAAAAAAAAACdXZWJtLWF1ZGlvLWxvZy0wLjAuMQAAAAAWAAAAAEcBAAAAAAAA";

async function callGeminiAPI(prompt, apiKey, rawAudioInput = null) {
  let audioBase64 = null;
  let audioMimeType = "audio/webm";

  if (rawAudioInput) {
    if (typeof rawAudioInput === "string" && rawAudioInput.startsWith("data:")) {
      const match = rawAudioInput.match(/^data:(audio\/[a-zA-Z0-9\-\+]+);base64,(.+)$/);
      if (match) {
        audioMimeType = match[1];
        audioBase64 = match[2];
      } else {
        audioBase64 = rawAudioInput.replace(/^data:audio\/[a-zA-Z0-9\-\+]+;base64,/, "");
      }
    } else {
      audioBase64 = rawAudioInput;
    }
  }

  const CANDIDATE_MODELS = audioBase64
    ? ["gemini-2.5-flash-lite", "gemini-2.5-flash"]
    : ["gemini-3.5-flash-lite", "gemini-2.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.6-flash", "gemini-2.5-flash"];

  let lastError = null;

  for (const model of CANDIDATE_MODELS) {
    const start = Date.now();
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const parts = [{ text: prompt }];
      if (audioBase64) {
        parts.push({
          inlineData: {
            mimeType: audioMimeType,
            data: audioBase64
          }
        });
      }

      const payload = {
        contents: [{ parts }],
        generationConfig: { responseMimeType: "application/json" }
      };

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const elapsed = Date.now() - start;

      if (!res.ok) {
        const errText = await res.text();
        console.warn(`[${model}] Failed (${elapsed}ms): ${res.status}`);
        lastError = new Error(`Model ${model} returned ${res.status}`);
        continue;
      }

      const result = await res.json();
      const textResponse = result.candidates[0].content.parts[0].text;
      const cleanJson = textResponse.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
      const parsed = JSON.parse(cleanJson);
      return { model, elapsed, parsed };
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

async function run() {
  console.log("=== Testing Optimized Pipeline Latencies ===");
  
  // 1. Text Question Generation
  console.log("\n1. Testing Text Question Generation:");
  const qRes = await callGeminiAPI('Act as examiner. Ask next question on Thermodynamics. Respond ONLY with JSON: {"text":"Explain Second Law"}', apiKey);
  console.log(`⚡ Model used: ${qRes.model} | Latency: ${qRes.elapsed}ms | Response:`, qRes.parsed);

  // 2. Text Answer Evaluation
  console.log("\n2. Testing Text Answer Evaluation:");
  const evalRes = await callGeminiAPI('Act as examiner. Grade: "Second law states entropy increases". Respond ONLY with JSON: {"correctness":90, "tag":"Strong"}', apiKey);
  console.log(`⚡ Model used: ${evalRes.model} | Latency: ${evalRes.elapsed}ms | Response:`, evalRes.parsed);

  // 3. Audio Answer Evaluation
  console.log("\n3. Testing Audio Answer Evaluation:");
  const audioRes = await callGeminiAPI('Act as examiner. Grade attached audio. Respond ONLY with JSON: {"correctness":85, "confidence":90, "tag":"Strong"}', apiKey, sampleBase64Audio);
  console.log(`⚡ Model used: ${audioRes.model} | Latency: ${audioRes.elapsed}ms | Response:`, audioRes.parsed);
}

run();
