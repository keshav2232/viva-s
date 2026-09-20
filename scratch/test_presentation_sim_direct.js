import fs from 'fs';
import path from 'path';

const envFile = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf-8');
const match = envFile.match(/GEMINI_API_KEY=(.+)/);
const apiKey = match ? match[1].trim() : '';

console.log("Testing PresentationSim Direct Call with Gemini API Key...");

async function testDirect() {
  const mockSlides = [
    { page: 1, title: "Slide 1: Executive Summary", text: "Overview of microservices migration, scalability goals, and ROI." },
    { page: 2, title: "Slide 2: System Architecture", text: "Database sharding, Redis caching layer, Kafka event bus, and API Gateway." },
    { page: 3, title: "Slide 3: Performance Benchmarks", text: "Latency reduced from 450ms to 45ms. RPS increased by 10x under load." }
  ];

  const mockTranscript = "Good morning panel. Today I am presenting our system architecture scalability project. On slide 1, our core goal was migrating from monolithic architecture to microservices to support 10x growth. Moving to slide 2, we implemented database sharding with Redis caching layer and Kafka event streaming to eliminate DB lock contention. On slide 3, benchmarking showed latencies dropped from 450ms down to 45ms with 99.9% uptime.";

  const slidesSummary = mockSlides.map((s, i) => `Slide ${i+1}: "${s.title}" -> Content: "${s.text}"`).join("\n");

  const prompt = `Act as an expert presentation coach and executive pitch evaluator. You have access to a COMPLETE presentation delivered live by a candidate.
Your job is to perform a HOLISTIC presentation evaluation — judging how effectively the presenter explained the overall topic, their narrative flow, delivery presence, and value-add over slide bullet text.

Presentation Topic: "System Architecture & Scalability"
Evaluator Panel Style: "strict"
Total Duration: 3 minutes (180 seconds across 3 slides, avg 60s/slide)

PRESENTATION SLIDE DECK CONTENT:
${slidesSummary}

CANDIDATE SPOKEN TRANSCRIPT:
"""
${mockTranscript}
"""

HOLISTIC EVALUATION TASKS:
1. Grade overall Topic Explanation Mastery (0-100) — how effectively did the presenter explain the core subject to an audience?
2. Write a 2-3 sentence Narrative Arc Summary describing their presentation flow.
3. Compute 5 Radar Metric Scores out of 100 (topicMastery, storytelling, vocalDelivery, pacingControl, qaDefense).
4. Estimate Verbatim Reading Ratio % vs Value-Add Ratio %.
5. Identify 3 specific Strengths.
6. Provide 3 specific Actionable Recommendations.

Respond ONLY with a valid, clean JSON object matching this schema. Do not enclose in markdown blocks:
{
  "topicMasteryScore": 88,
  "narrativeArcSummary": "2-3 sentence narrative arc summary",
  "radarScores": {
    "topicMastery": 88,
    "storytelling": 85,
    "vocalDelivery": 82,
    "pacingControl": 80,
    "qaDefense": 85
  },
  "verbatimRatioPct": 15,
  "valueAddRatioPct": 85,
  "strengths": ["Strength 1", "Strength 2", "Strength 3"],
  "recommendations": ["Recommendation 1", "Recommendation 2", "Recommendation 3"]
}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" }
    })
  });

  const data = await res.json();
  console.log("Status:", res.status);
  if (res.ok) {
    const text = data.candidates[0].content.parts[0].text;
    console.log("Gemini Presentation Evaluation Output:\n", JSON.parse(text));
  } else {
    console.error("Gemini API Error:", data);
  }
}

testDirect();
