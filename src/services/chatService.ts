import { OllamaService } from "./ollamaService";
import { VectorStore } from "./vectorStore";
import { SessionService, Message } from "./sessionService";

export class ChatService {
  private ollamaService: OllamaService;
  private vectorStore: VectorStore;
  private sessionService: SessionService;
  private readonly MAX_CONTEXT_TOKENS = 3000; // Safety margin (Total 4096 - ~1000 for system/RAG)

  constructor(ollamaService: OllamaService, vectorStore: VectorStore) {
    this.ollamaService = ollamaService;
    this.vectorStore = vectorStore;
    this.sessionService = new SessionService();
  }

  // Helper: Estimate tokens (char count / 4)
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  // Helper: Build dynamic context
  private async buildContext(sessionId: string, systemPrompt: string): Promise<Message[]> {
    const history = await this.sessionService.getHistory(sessionId);
    const systemTokens = this.estimateTokens(systemPrompt);
    console.log(`[ESTIMATED TOKEN] System Token ${systemTokens}`);
    let currentTokens = systemTokens;

    const contextMessages: Message[] = [];

    // Add messages from newest to oldest until limit reached
    for (let i = history.length - 1; i >= 0; i--) {
      const msg = history[i];
      const msgTokens = this.estimateTokens(msg.content);
      console.log(`[ESTIMATED TOKEN] Message Token ${msgTokens}`);

      if (currentTokens + msgTokens <= this.MAX_CONTEXT_TOKENS) {
        contextMessages.unshift(msg); // Add to front to maintain order
        currentTokens += msgTokens;
      } else {
        break; // Stop if limit reached
      }
    }

    console.log(
      `[Context] Built with ${contextMessages.length}/${history.length} messages. Tokens: ~${currentTokens}/${this.MAX_CONTEXT_TOKENS}`
    );

    return [{ role: "system", content: systemPrompt }, ...contextMessages];
  }

  async handleMessage(userMessage: string, sessionId?: string): Promise<{ response: string; sessionId: string }> {
    // 1. Manage Session
    const currentSessionId = sessionId || this.sessionService.createSession();
    console.log(`[Session] Using session ID: ${currentSessionId}`);

    // 2. Retrieve RAG Context
    const relevantDocs = await this.vectorStore.search(userMessage, 3);
    const contextString = relevantDocs
      .map((doc) => {
        const meta = doc.metadata;
        let info = `[${meta.type.toUpperCase()}] ${meta.title}`;
        if (meta.url) info += ` (Link: https://dev.ekkademy.net/${meta.url})`;
        return `${info}\n${doc.content}`;
      })
      .join("\n\n---\n\n");

    // 3. Construct System Prompt
    const systemPrompt = this.getSystemPrompt(contextString);

    // 4. Build Dynamic Context
    // Add user message to session first so it's included in context
    await this.sessionService.addMessage(currentSessionId, "user", userMessage);

    const messages = await this.buildContext(currentSessionId, systemPrompt);
    console.log("[Context] Dynamic context:", messages);

    // 5. Generate Response
    const responseText = await this.ollamaService.generateChatResponse(messages);

    // 6. Save Assistant Response
    await this.sessionService.addMessage(currentSessionId, "assistant", responseText);

    return { response: responseText, sessionId: currentSessionId };
  }

  async *handleMessageStream(userMessage: string, sessionId?: string): AsyncGenerator<string> {
    // 1. Manage Session
    const currentSessionId = sessionId || this.sessionService.createSession();

    // Yield session ID as first chunk (special format)
    yield JSON.stringify({ sessionId: currentSessionId });

    // 2. Retrieve RAG Context
    const relevantDocs = await this.vectorStore.search(userMessage, 3);
    const contextString = relevantDocs
      .map((doc) => {
        const meta = doc.metadata;
        let info = `[${meta.type.toUpperCase()}] ${meta.title}`;
        if (meta.url) info += ` (Link: https://dev.ekkademy.net/${meta.url})`;
        return `${info}\n${doc.content}`;
      })
      .join("\n\n---\n\n");

    // 3. Construct System Prompt
    const systemPrompt = this.getSystemPrompt(contextString);

    // 4. Build Dynamic Context
    await this.sessionService.addMessage(currentSessionId, "user", userMessage);
    const messages = await this.buildContext(currentSessionId, systemPrompt);

    // 5. Stream Response
    let fullResponse = "";
    for await (const chunk of this.ollamaService.generateChatResponseStream(messages)) {
      fullResponse += chunk;
      yield chunk;
    }

    // 6. Save Assistant Response
    await this.sessionService.addMessage(currentSessionId, "assistant", fullResponse);
  }

  private getSystemPrompt(contextString: string): string {
    return `You are a helpful and knowledgeable assistant for Ekkademy, an EdTech platform specializing in IELTS preparation.

Your role is to help students find the right courses, exams, bundles, and live classes based on their needs.

CONTEXT FROM DATABASE:
====================
${contextString}
====================

CRITICAL BOUNDARY RULE:
You ONLY answer questions related to:
- Greetings and casual openers (e.g., "Hi", "How are you?", "What's up?")
- IELTS preparation (Reading, Writing, Listening, Speaking)
- English language learning
- Education and study strategies
- Ekkademy's courses, exams, bundles, and live classes

If the user asks about ANYTHING else (relationships, dating, cooking, sports, politics, etc.), you must politely decline and state that you can only assist with educational topics.

DO NOT engage with off-topic questions. DO NOT provide advice on non-educational topics.

INSTRUCTIONS:

1. ANALYZE USER INTENT:
   - Greeting/Casual → Reply warmly and professionally, then add a light-hearted joke about learning.
   - Off-topic question → Politely decline and redirect to educational topics
   - General education question ("What is IELTS?") → Answer using general knowledge, DO NOT suggest courses unless asked
   - Looking for offerings ("Do you have writing courses?") → Use context to recommend specific items
   - Asking for recommendations ("I'm weak in listening") → Suggest relevant courses/bundles with links

2. UNDERSTAND CONTEXT TYPES:
   - [BUNDLE] = Package of multiple courses (best value)
   - [COURSE] = Individual course with lessons
   - [EXAMSET] = Mock test ("full length" = all 4 modules: Reading, Writing, Listening, Speaking)
   - [EXAM] = Individual exam for practice
   - [LIVECLASS] = Live interactive session
   - [LESSON] = Single lesson (part of a course)

3. WHEN RECOMMENDING:
   - ALWAYS include the full link (https://dev.ekkademy.net/...)
   - Mention key details: price, difficulty, has assignments, has live classes
   - For mock tests, clarify if it's "full length" (all 4 modules) or "partial"
   - Suggest bundles when user needs multiple courses (better value)

4. RESPONSE STYLE:
   - Be direct and helpful
   - DO NOT say "I am an AI" or "I am under development"
   - Keep responses concise (2-4 sentences max)

5. EXAMPLES:
   - "Hey, what's up?" → "I'm doing great! What's up with you?"
   - "What is IELTS?" → Explain IELTS, don't suggest courses
   - "Do you have writing courses?" → List relevant courses with links
   - "I need a full mock test" → Suggest ExamSet with setType: "full length"
   - "I'm weak in all modules" → Suggest a Bundle (best value for multiple courses)
   - "How to find a girlfriend?" → Decline politely (off-topic)
`;
  }
}
