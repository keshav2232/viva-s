import fetch from 'node-fetch';

async function testLiveRoute() {
  console.log("=== Testing Live Local /api/viva Endpoint ===");

  // 1. Evaluate Text Answer
  const start1 = Date.now();
  try {
    const res1 = await fetch("http://localhost:3000/api/viva", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "evaluate-answer",
        question: "What is Carnot efficiency?",
        answer: "Carnot efficiency is the maximum theoretical efficiency achievable by a heat engine operating between two thermal reservoirs.",
        syllabus: { topic: "Thermodynamics", units: [] },
        mode: "academic"
      })
    });
    const elapsed1 = Date.now() - start1;
    const data1 = await res1.json();
    console.log(`⚡ [evaluate-answer (text)]: Status ${res1.status} | Latency: ${elapsed1}ms`);
    console.log("   Result:", JSON.stringify(data1).substring(0, 120) + "...");
  } catch (e) {
    console.error("❌ evaluate-answer failed:", e.message);
  }

  // 2. Generate Next Question
  const start2 = Date.now();
  try {
    const res2 = await fetch("http://localhost:3000/api/viva", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "generate-question",
        syllabus: { topic: "Thermodynamics", units: [] },
        personality: "friendly",
        duration: "5",
        asked: ["What is entropy?"],
        history: ["It is randomness."],
        mode: "academic"
      })
    });
    const elapsed2 = Date.now() - start2;
    const data2 = await res2.json();
    console.log(`⚡ [generate-question]: Status ${res2.status} | Latency: ${elapsed2}ms`);
    console.log("   Result:", JSON.stringify(data2).substring(0, 120) + "...");
  } catch (e) {
    console.error("❌ generate-question failed:", e.message);
  }
}

testLiveRoute();
