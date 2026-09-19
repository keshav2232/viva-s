import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

const envFile = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf-8');
const match = envFile.match(/GEMINI_API_KEY=(.+)/);
const apiKey = match ? match[1].trim() : '';

// Generate 1 second of silent PCM/WebM dummy audio in base64
const sampleBase64Audio = "GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQRChYECGFOAZwEAAAAAABqARwAAACN2ZWJtYmFzZWZzLzAAAAAAFgAAAGcBAAAAAAAAACdXZWJtLWF1ZGlvLWxvZy0wLjAuMQAAAAAWAAAAAEcBAAAAAAAA";

const modelsToTest = [
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash-lite',
  'gemini-3.6-flash',
  'gemini-2.5-flash'
];

async function testAudioModel(model) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const prompt = 'Act as an academic examiner. Evaluate student audio response. Question: "What is Carnot cycle?" Student Audio: Attached. Respond ONLY with JSON: {"correctness": 85, "tag": "Strong", "confidence": 90, "nervousness": 10, "hesitation": 10, "clarity": 90, "correctAnswer": "Carnot cycle consists of..."}';

  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inlineData: { mimeType: "audio/webm", data: sampleBase64Audio } }
          ]
        }],
        generationConfig: { responseMimeType: 'application/json' }
      })
    });
    const elapsed = Date.now() - start;
    const data = await res.json();

    if (!res.ok) {
      console.log(`❌ ${model} (Audio): Status ${res.status} (${elapsed}ms) - ${data.error?.message || JSON.stringify(data)}`);
    } else {
      console.log(`✅ ${model} (Audio): Status 200 (${elapsed}ms) - Success!`);
    }
  } catch (err) {
    const elapsed = Date.now() - start;
    console.log(`❌ ${model} (Audio): Error after ${elapsed}ms: ${err.message}`);
  }
}

async function run() {
  console.log('Testing Audio Evaluation Latencies...');
  for (const m of modelsToTest) {
    await testAudioModel(m);
  }
}

run();
