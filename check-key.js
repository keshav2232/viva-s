async function checkKey() {
  try {
    const apiKey = "AIzaSyB7diiZGW44bH_VTh1QP6adcWM72qD_9Pc";
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
