async function testRaw() {
  try {
    const apiKey = "AIzaSyB7diiZGW44bH_VTh1QP6adcWM72qD_9Pc";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
    const prompt = `Act as an academic curriculum specialist. Expand the topic "Thermodynamics" into a structured syllabus with exactly 3 Units. Each Unit must have a name, and exactly 3 or 4 concise core subtopics. 
    Respond ONLY with a valid, clean JSON object matching this schema:
    {
      "topic": "Thermodynamics",
      "units": [
        { "name": "Unit name", "topics": ["topic 1", "topic 2", "topic 3"] }
      ]
    }`;

    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json"
      }
    };

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const result = await res.json();
    console.log("Entire API Result:\n", JSON.stringify(result, null, 2));
  } catch (err) {
    console.error("Test Error:", err);
  }
}

testRaw();
