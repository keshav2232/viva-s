const fs = require('fs');
const path = require('path');

async function checkKey() {
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

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`;
    const payload = {
      contents: [{ parts: [{ text: "Respond ONLY with the word 'Active' if you receive this." }] }]
    };

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const data = await res.json();
      console.log("Status: ACTIVE");
      console.log("Model Response:", data.candidates[0].content.parts[0].text.trim());
    } else {
      console.log("Status: INACTIVE/BLOCKED");
      console.log("Details:", await res.text());
    }
  } catch (err) {
    console.log("Status: OFFLINE/ERROR");
    console.error(err);
  }
}

checkKey();
