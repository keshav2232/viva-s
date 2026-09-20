import fetch from 'node-fetch';

async function testPresentationSim() {
  console.log("Testing PresentationSim 'evaluate-presentation' API endpoint...");

  const mockSlides = [
    { page: 1, title: "Slide 1: Executive Summary", text: "Overview of microservices migration, scalability goals, and ROI." },
    { page: 2, title: "Slide 2: System Architecture", text: "Database sharding, Redis caching layer, Kafka event bus, and API Gateway." },
    { page: 3, title: "Slide 3: Performance Benchmarks", text: "Latency reduced from 450ms to 45ms. RPS increased by 10x under load." }
  ];

  const mockTranscript = "Good morning panel. Today I am presenting our system architecture scalability project. On slide 1, our core goal was migrating from monolithic architecture to microservices to support 10x growth. Moving to slide 2, we implemented database sharding with Redis caching layer and Kafka event streaming to eliminate DB lock contention. On slide 3, benchmarking showed latencies dropped from 450ms down to 45ms with 99.9% uptime.";

  try {
    const res = await fetch("http://localhost:3000/api/viva", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "evaluate-presentation",
        topic: "System Architecture & Scalability",
        slides: mockSlides,
        slideTimes: { 0: 45, 1: 75, 2: 60 },
        fullTranscript: mockTranscript,
        personality: "strict",
        durationSecs: 180
      })
    });

    if (!res.ok) {
      console.error("HTTP error:", res.status, await res.text());
      return;
    }

    const data = await res.json();
    console.log("\n✅ Presentation Sim Evaluation Result:");
    console.log(JSON.stringify(data, null, 2));

  } catch (err) {
    console.error("Test Exception:", err.message);
  }
}

testPresentationSim();
