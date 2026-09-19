import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

const envFile = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf-8');
const match = envFile.match(/GEMINI_API_KEY=(.+)/);
const apiKey = match ? match[1].trim() : '';

const modelsToTest = [
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash'
];

async function testModel(model) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const prompt = 'Act as an academic examiner grading an oral response in a college viva. Question: "What is entropy?" Student Response: "Entropy is a measure of randomness or disorder in a system." Respond ONLY with JSON: {"correctness": 85, "tag": "Strong"}';

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
    const data = await res.json();

    if (!res.ok) {
      console.log(`❌ ${model}: Status ${res.status} (${elapsed}ms) - ${data.error?.message || JSON.stringify(data)}`);
    } else {
      console.log(`✅ ${model}: Status 200 (${elapsed}ms) - Success!`);
    }
  } catch (err) {
    const elapsed = Date.now() - start;
    console.log(`❌ ${model}: Error after ${elapsed}ms: ${err.message}`);
  }
}

async function run() {
  for (const m of modelsToTest) {
    await testModel(m);
  }
}

run();
