import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

// Read GEMINI_API_KEY from .env.local
const envFile = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf-8');
const match = envFile.match(/GEMINI_API_KEY=(.+)/);
const apiKey = match ? match[1].trim() : '';

const model = 'gemini-3.5-flash-lite';
const sampleBase64Audio = "GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQRChYECGFOAZwEAAAAAABqARwAAACN2ZWJtYmFzZWZzLzAAAAAAFgAAAGcBAAAAAAAAACdXZWJtLWF1ZGlvLWxvZy0wLjAuMQAAAAAWAAAAAEcBAAAAAAAA";

async function testTextRound(roundNum) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const prompt = `Act as an academic examiner grading an oral viva response. Question: "What is the Carnot cycle?" Student Answer: "It is an ideal reversible thermodynamic cycle." Respond ONLY with a clean JSON object: {"correctness": 90, "tag": "Strong", "accuracy": 85, "clarity": 90, "correctAnswer": "The Carnot cycle consists of two isothermal and two adiabatic processes."}`;

  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' }
      })
    });
    const elapsed = Date.now() - start;
    const text = await res.text();
    if (!res.ok) {
      console.log(`❌ Round ${roundNum} (Text): Status ${res.status} (${elapsed}ms) -> Error: ${text}`);
      return { ok: false, elapsed, status: res.status, err: text };
    }
    console.log(`✅ Round ${roundNum} (Text): Status 200 (${elapsed}ms) -> Response: ${text.substring(0, 100)}...`);
    return { ok: true, elapsed };
  } catch (err) {
    const elapsed = Date.now() - start;
    console.log(`❌ Round ${roundNum} (Text): Threw exception (${elapsed}ms) -> ${err.message}`);
    return { ok: false, elapsed, err: err.message };
  }
}

async function testAudioRound(roundNum) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const prompt = `Act as an academic examiner grading an oral viva response. Question: "What is Carnot efficiency?" Attached is student audio. Respond ONLY with a clean JSON object: {"correctness": 85, "tag": "Strong"}`;

  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inlineData: { mimeType: 'audio/webm', data: sampleBase64Audio } }
          ]
        }],
        generationConfig: { responseMimeType: 'application/json' }
      })
    });
    const elapsed = Date.now() - start;
    const text = await res.text();
    if (!res.ok) {
      console.log(`❌ Round ${roundNum} (Audio): Status ${res.status} (${elapsed}ms) -> Error: ${text}`);
      return { ok: false, elapsed, status: res.status, err: text };
    }
    console.log(`✅ Round ${roundNum} (Audio): Status 200 (${elapsed}ms) -> Response: ${text.substring(0, 100)}...`);
    return { ok: true, elapsed };
  } catch (err) {
    const elapsed = Date.now() - start;
    console.log(`❌ Round ${roundNum} (Audio): Threw exception (${elapsed}ms) -> ${err.message}`);
    return { ok: false, elapsed, err: err.message };
  }
}

async function run() {
  console.log(`\n==============================================`);
  console.log(`🔬 TESTING MODEL: ${model}`);
  console.log(`==============================================\n`);

  console.log(`--- PART 1: Text-Only Evaluation (3 Rounds) ---`);
  const textTimes = [];
  for (let i = 1; i <= 3; i++) {
    const res = await testTextRound(i);
    if (res.ok) textTimes.push(res.elapsed);
  }

  if (textTimes.length > 0) {
    const avg = Math.round(textTimes.reduce((a, b) => a + b, 0) / textTimes.length);
    console.log(`📊 Text-Only Metrics: Avg=${avg}ms | Min=${Math.min(...textTimes)}ms | Max=${Math.max(...textTimes)}ms (${textTimes.length}/3 passed)`);
  } else {
    console.log(`❌ Text-Only: All 3 rounds failed!`);
  }

  console.log(`\n--- PART 2: Multimodal Audio Evaluation (3 Rounds) ---`);
  const audioTimes = [];
  for (let i = 1; i <= 3; i++) {
    const res = await testAudioRound(i);
    if (res.ok) audioTimes.push(res.elapsed);
  }

  if (audioTimes.length > 0) {
    const avg = Math.round(audioTimes.reduce((a, b) => a + b, 0) / audioTimes.length);
    console.log(`📊 Audio Metrics: Avg=${avg}ms | Min=${Math.min(...audioTimes)}ms | Max=${Math.max(...audioTimes)}ms (${audioTimes.length}/3 passed)`);
  } else {
    console.log(`❌ Audio: All 3 rounds failed!`);
  }
}

run();
