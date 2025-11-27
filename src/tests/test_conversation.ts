async function testConversationContext() {
  const baseURL = "http://localhost:3000/api/chat";
  
  console.log("=== Testing Conversation Context & Follow-up Questions ===\n");

  // Scenario 1: Multi-turn conversation about IELTS
  console.log("--- Scenario 1: Multi-turn IELTS conversation ---");
  
  const history: { role: string; content: string }[] = [];

  // Turn 1: Initial question
  const turn1 = "I need help with IELTS reading";
  console.log(`\nUser: ${turn1}`);
  
  let res1 = await fetch(baseURL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: turn1, history }),
  });
  let data1 = await res1.json();
  console.log(`Bot: ${data1.response}\n`);
  
  // Add to history
  history.push({ role: "user", content: turn1 });
  history.push({ role: "assistant", content: data1.response });

  // Turn 2: Follow-up - ask about time management (should use context)
  const turn2 = "How much time do I have for the reading test?";
  console.log(`User: ${turn2}`);
  
  let res2 = await fetch(baseURL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: turn2, history }),
  });
  let data2 = await res2.json();
  console.log(`Bot: ${data2.response}\n`);
  
  // Add to history
  history.push({ role: "user", content: turn2 });
  history.push({ role: "assistant", content: data2.response });

  // Turn 3: Follow-up - ask about specific course (should remember we're talking about reading)
  const turn3 = "Do you have any courses for it?";
  console.log(`User: ${turn3}`);
  
  let res3 = await fetch(baseURL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: turn3, history }),
  });
  let data3 = await res3.json();
  console.log(`Bot: ${data3.response}\n`);

  console.log("\n=== Scenario 2: Topic switch mid-conversation ===");
  
  const history2: { role: string; content: string }[] = [];
  
  // Turn 1: Ask about writing
  const turn4 = "I want to improve my IELTS writing";
  console.log(`\nUser: ${turn4}`);
  
  let res4 = await fetch(baseURL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: turn4, history: history2 }),
  });
  let data4 = await res4.json();
  console.log(`Bot: ${data4.response}\n`);
  
  history2.push({ role: "user", content: turn4 });
  history2.push({ role: "assistant", content: data4.response });

  // Turn 2: Switch topic to speaking (should NOT confuse with writing)
  const turn5 = "Actually, I need help with speaking instead";
  console.log(`User: ${turn5}`);
  
  let res5 = await fetch(baseURL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: turn5, history: history2 }),
  });
  let data5 = await res5.json();
  console.log(`Bot: ${data5.response}\n`);

  console.log("\n=== Test Complete ===");
  console.log("\nWhat to look for:");
  console.log("✅ Turn 2 should answer about reading time (60 minutes) without needing 'IELTS reading' again");
  console.log("✅ Turn 3 should recommend IELTS Reading courses using context from Turn 1");
  console.log("✅ Turn 5 should switch from writing to speaking recommendations");
}

testConversationContext();
