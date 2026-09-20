import fetch from 'node-fetch';

async function testStrategyB() {
  console.log("Testing Strategy B Context Caching API flows...");

  const mockSyllabus = {
    topic: "Thermodynamics",
    units: [
      { name: "Unit 1: Fundamentals", topics: ["Carnot Cycle", "Entropy"] }
    ]
  };

  // 1. Create Session Cache
  console.log("\n1. Testing 'create-session-cache'...");
  try {
    const res = await fetch("http://localhost:3000/api/viva", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create-session-cache",
        syllabus: mockSyllabus,
        personality: "friendly",
        mode: "academic",
        asked: [],
        history: []
      })
    });
    const cacheData = await res.json();
    console.log("create-session-cache response:", cacheData);
  } catch (err) {
    console.error("Error creating session cache:", err.message);
  }

  // 2. Generate Question with mock cacheId (testing fallback resilience)
  console.log("\n2. Testing 'generate-question' with cacheId & fallback...");
  try {
    const res = await fetch("http://localhost:3000/api/viva", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "generate-question",
        syllabus: mockSyllabus,
        personality: "friendly",
        duration: 5,
        asked: [],
        history: [],
        lastTag: null,
        activeTopic: "Carnot Cycle",
        nervousness: 20,
        mode: "academic",
        cacheId: "cachedContents/invalid_or_mock_id_to_test_fallback"
      })
    });
    const qData = await res.json();
    console.log("generate-question response:", qData);
  } catch (err) {
    console.error("Error generating question:", err.message);
  }

  // 3. Evaluate Answer with mock cacheId (testing fallback resilience)
  console.log("\n3. Testing 'evaluate-answer' with cacheId & fallback...");
  try {
    const res = await fetch("http://localhost:3000/api/viva", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "evaluate-answer",
        question: "What is Carnot efficiency?",
        answer: "Carnot efficiency is the maximum theoretical efficiency achievable by a heat engine operating between two temperatures.",
        syllabus: mockSyllabus,
        mode: "academic",
        cacheId: "cachedContents/invalid_or_mock_id_to_test_fallback"
      })
    });
    const evalData = await res.json();
    console.log("evaluate-answer response:", evalData);
  } catch (err) {
    console.error("Error evaluating answer:", err.message);
  }
}

testStrategyB();
