import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

const envFile = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf-8');
const match = envFile.match(/GEMINI_API_KEY=(.+)/);
const apiKey = match ? match[1].trim() : '';

const modelsToTest = [
  'gemini-2.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash-lite',
  'gemini-3.6-flash',
  'gemini-2.5-flash'
];

async function testSingle(model, textOnly = true) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const prompt = 'Act as examiner. Grade: "Entropy is measure of disorder". Respond ONLY JSON: {"correctness":90, "tag":"Strong"}';
  
  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });
    const elapsed = Date.now() - start;
    if (!res.ok) {
      return { model, ok: false, status: res.status, elapsed };
    }
    return { model, ok: true, elapsed };
  } catch (err) {
    return { model, ok: false, err: err.message, elapsed: Date.now() - start };
  }
}

async function run() {
  console.log("=== Running 3-Round Speed Benchmark ===");
  for (const model of modelsToTest) {
    const times = [];
    let successes = 0;
    for (let i = 0; i < 3; i++) {
      const res = await testSingle(model);
      if (res.ok) {
        successes++;
        times.push(res.elapsed);
      } else {
        console.log(`  Round ${i+1} failed for ${model}: status ${res.status}`);
      }
    }
    if (successes > 0) {
      const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
      const min = Math.min(...times);
      const max = Math.max(...times);
      console.log(`📊 ${model}: Avg=${avg}ms | Min=${min}ms | Max=${max}ms (${successes}/3 succeeded)`);
    } else {
      console.log(`❌ ${model}: All 3 attempts failed!`);
    }
  }
}

run();
