import fs from 'fs';
import path from 'path';

const envFile = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf-8');
const match = envFile.match(/GEMINI_API_KEY=(.+)/);
const apiKey = match ? match[1].trim() : '';

console.log("Using API key:", apiKey ? `${apiKey.substring(0, 8)}...` : "NONE");

async function testDirect() {
  const mockSyllabus = {
    topic: "Thermodynamics",
    units: [{ name: "Unit 1", topics: ["Carnot Cycle"] }]
  };

  let heavyContextText = `
    SYSTEM CONTEXT & EXAMINER PERSONA:
    Act as a college professor conducting a viva examination.
    Examiner Personality: friendly
    Syllabus & Competency Context: ${JSON.stringify(mockSyllabus)}

    ACCUMULATED VIVA SESSION HISTORY (Strategy B Dynamic Checkpoint):
    No questions asked yet. Initial session setup.
  `;

  while (heavyContextText.length < 15000) {
    heavyContextText += `\nReference Context Padding: Rule entry ${heavyContextText.length}. Ensure precise domain evaluations.`;
  }

  // 1. Test create cache
  console.log("\n1. Calling cachedContents POST API directly...");
  const cacheUrl = `https://generativelanguage.googleapis.com/v1beta/cachedContents?key=${apiKey}`;
  const cacheRes = await fetch(cacheUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "models/gemini-2.5-flash-lite",
      contents: [{ role: "user", parts: [{ text: heavyContextText }] }],
      ttl: "1800s"
    })
  });

  const cacheResult = await cacheRes.json();
  console.log("Cache creation status:", cacheRes.status);
  console.log("Cache creation output:", cacheResult);

  // 2. Test generateContent with cachedContent (and automatic fallback test if non-200)
  const cacheId = cacheRes.ok ? cacheResult.name : "cachedContents/invalid_fallback_test";
  console.log(`\n2. Testing generateContent with cacheId: "${cacheId}"...`);

  const genUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`;
  const payload = {
    contents: [{ parts: [{ text: "Generate the first viva question on Carnot Cycle." }] }],
    generationConfig: { responseMimeType: "application/json" },
    cachedContent: cacheId
  };

  const genRes = await fetch(genUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const genResult = await genRes.json();
  console.log("generateContent status with cacheId:", genRes.status);
  if (genRes.ok) {
    console.log("generateContent output text:", genResult.candidates[0].content.parts[0].text.substring(0, 150));
  } else {
    console.log("generateContent error output:", genResult.error?.message);
    console.log("Simulating Strategy B Automatic Fallback to full prompt without cacheId...");
    
    // Fallback without cacheId
    delete payload.cachedContent;
    const fallbackRes = await fetch(genUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const fallbackResult = await fallbackRes.json();
    console.log("Fallback generateContent status:", fallbackRes.status);
    console.log("Fallback generateContent output snippet:", fallbackResult.candidates[0].content.parts[0].text.substring(0, 150));
  }
}

testDirect();
