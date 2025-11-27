async function testStreamingChat() {
  const scenarios = [
    { name: "General", message: "Hello" },
    { name: "Specific", message: "I need help with IELTS reading" },
    { name: "Unrelated", message: "Who is the president of US?" },
  ];

  for (const scenario of scenarios) {
    console.log(`\n--- Testing Scenario: ${scenario.name} ---`);
    console.log(`User: ${scenario.message}`);
    process.stdout.write(`Bot: `);

    try {
      const res = await fetch("http://localhost:3000/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: scenario.message }),
      });

      if (!res.body) {
        console.error("No response body");
        continue;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));
            if (data.chunk) {
              process.stdout.write(data.chunk);
              fullResponse += data.chunk;
            } else if (data.done) {
              console.log("\n"); // New line after complete response
            } else if (data.error) {
              console.error("\nError:", data.error);
            }
          }
        }
      }
    } catch (e: any) {
      console.error("\nError:", e.message);
    }
  }
}

testStreamingChat();
