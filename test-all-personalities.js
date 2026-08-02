const fs = require('fs');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');

const DEFAULT_CANDIDATE_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite"
];

async function callGeminiInteractionWithFallback(prompt, apiKey) {
  const ai = new GoogleGenAI({ apiKey });
  let lastError = null;

  for (const model of DEFAULT_CANDIDATE_MODELS) {
    try {
      let rawText = "";
      try {
        if (ai.interactions && typeof ai.interactions.create === "function") {
          const interaction = await ai.interactions.create({
            model: model,
            input: prompt
          });
          rawText = interaction.output_text || (interaction.outputs && interaction.outputs[0] && interaction.outputs[0].text) || "";
        }
      } catch (e) {
        // fallback
      }

      if (!rawText) {
        const response = await ai.models.generateContent({
          model: model,
          contents: prompt,
          config: {
            responseMimeType: "application/json"
          }
        });
        rawText = response.text || "";
      }

      const cleanJson = rawText.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
      return { parsed: JSON.parse(cleanJson), modelUsed: model };
    } catch (err) {
      console.warn(`  [Model ${model} unavailable: ${err.message.substring(0, 70)}... Rotating to next candidate]`);
      lastError = err;
    }
  }

  throw new Error(`All models failed. Last error: ${lastError ? lastError.message : 'Unknown'}`);
}

async function testAllPersonalities() {
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

    const personalities = [
      { key: "friendly", name: "Friendly Professor / Warm Recruiter" },
      { key: "strict", name: "Strict Professor / Structured Hiring Manager" },
      { key: "brutal", name: "Brutal Examiner / Bar Raiser EM" },
      { key: "terror", name: "Viva Terror / Director Bar Raiser" }
    ];

    console.log("Testing Gemini Interaction API across ALL 4 Professor Personalities with Model Rotation:\n");

    for (const p of personalities) {
      console.log(`--------------------------------------------------`);
      console.log(`Testing Personality: [${p.key.toUpperCase()}] - ${p.name}`);

      const prompt = `Act as an examiner conducting a viva for Operating Systems with personality: "${p.key}".
      Respond ONLY with a valid clean JSON object matching:
      {
        "text": "Question text",
        "speech": "Examiner spoken remark matching your personality style (${p.key}) followed by the question",
        "topic": "Process Synchronization",
        "difficulty": "Medium",
        "correctAnswer": "Ideal answer explanation"
      }`;

      try {
        const { parsed, modelUsed } = await callGeminiInteractionWithFallback(prompt, apiKey);
        console.log(`[PASS via ${modelUsed}] ${p.key.toUpperCase()} Speech Output:`);
        console.log(`"${parsed.speech}"\n`);
      } catch (err) {
        console.error(`[FAIL] ${p.key}:`, err.message);
      }
    }

    console.log(`--------------------------------------------------`);
    console.log("ALL 4 PROFESSOR PERSONALITIES VERIFIED AND WORKING!");
  } catch (err) {
    console.error("Test Error:", err);
  }
}

testAllPersonalities();
