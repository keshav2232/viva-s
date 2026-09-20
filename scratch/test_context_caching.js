import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

const envFile = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf-8');
const match = envFile.match(/GEMINI_API_KEY=(.+)/);
const apiKey = match ? match[1].trim() : '';

const modelsToTest = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-1.5-flash'];

async function testModelCache(model) {
  let heavyContext = `Act as an academic examiner conducting a viva examination in Thermodynamics.
Syllabus Structure:
Unit 1: Carnot Cycle, Isothermal and Adiabatic processes, Efficiency calculations, Second Law of Thermodynamics.
Unit 2: Entropy generation, Lost exergy work, Third Law absolute zero, Reversible entropy degradation.
`;
  while (heavyContext.length < 15000) {
    heavyContext += `\nReference Note: Repeat thermodynamics boundary rule ${heavyContext.length}. Verify entropy equations.`;
  }

  const cacheUrl = `https://generativelanguage.googleapis.com/v1beta/cachedContents?key=${apiKey}`;
  const start = Date.now();
  try {
    const res = await fetch(cacheUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: `models/${model}`,
        contents: [{ role: 'user', parts: [{ text: heavyContext }] }],
        ttl: '1800s'
      })
    });
    const elapsed = Date.now() - start;
    const data = await res.json();
    if (!res.ok) {
      console.log(`❌ ${model} Cache Failed (${elapsed}ms): Status ${res.status} -> ${data.error?.message || JSON.stringify(data)}`);
    } else {
      console.log(`✅ ${model} Cache Success (${elapsed}ms)! ID: ${data.name}`);
    }
  } catch (err) {
    console.log(`❌ ${model} Exception: ${err.message}`);
  }
}

async function run() {
  console.log('Testing Context Caching across models...');
  for (const m of modelsToTest) {
    await testModelCache(m);
  }
}

run();
