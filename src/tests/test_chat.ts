async function testChat() {
  const scenarios = [
    { name: "General", message: "Hello" },
    { name: "Specific", message: "I need help with IELTS reading" },
    { name: "Unrelated", message: "Who is the president of US?" },
  ];

  for (const scenario of scenarios) {
    console.log(`\n--- Testing Scenario: ${scenario.name} ---`);
    console.log(`User: ${scenario.message}`);
    try {
      const res = await fetch("http://localhost:3000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: scenario.message }),
      });
      const data = await res.json();
      console.log(`Bot: ${data.response}`);
    } catch (e: any) {
      console.error("Error:", e.message);
    }
  }
}

testChat();
