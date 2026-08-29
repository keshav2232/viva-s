const fs = require('fs');
const path = require('path');

async function testRaw() {
  try {
    let apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      try {
        const envPath = path.join(__dirname, '.env.local');
        if (fs.existsSync(envPath)) {
          const envContent = fs.readFileSync(envPath, 'utf8');
          const match = envContent.match(/^GEMINI_API_KEY\s*=\s*(.+)$/m);
          if (match) {
            apiKey = match[1].replace(/["']/g, '').trim();
          }
        }
      } catch (e) {
        // ignore
      }
    }

    if (!apiKey) {
      console.error("Error: GEMINI_API_KEY is not defined in process.env or .env.local file.");
      process.exit(1);
    }

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
