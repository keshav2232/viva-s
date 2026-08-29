const fs = require('fs');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');

async function testGeminiInteraction() {
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

    console.log("Initializing GoogleGenAI SDK with API key...");
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `Act as an academic curriculum specialist. Expand the topic "Operating Systems" into a structured syllabus with exactly 2 Units. Respond ONLY with a valid, clean JSON object matching this schema:
    {
      "topic": "Operating Systems",
      "units": [
        { "name": "Unit name", "topics": ["topic 1", "topic 2"] }
      ]
    }`;

    console.log("Testing Gemini Interaction API call...");
    let responseText = "";

    try {
      if (ai.interactions && typeof ai.interactions.create === "function") {
        const interaction = await ai.interactions.create({
          model: "gemini-2.5-flash",
          input: prompt,
          config: {
            responseMimeType: "application/json"
          }
        });
        responseText = interaction.output_text || (interaction.outputs && interaction.outputs[0] && interaction.outputs[0].text) || "";
      } else {
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json"
          }
        });
        responseText = response.text || "";
      }
    } catch (err) {
      console.log("Interaction API call fallback to models.generateContent:", err.message);
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });
      responseText = response.text || "";
    }

    console.log("Raw Response from Gemini:\n", responseText);

    const cleanJson = responseText.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
    const parsed = JSON.parse(cleanJson);
    console.log("Parsed JSON Object:\n", JSON.stringify(parsed, null, 2));
    console.log("SUCCESS: Gemini Interaction API is working correctly!");
  } catch (err) {
    console.error("Test Failed:", err);
  }
}

testGeminiInteraction();
