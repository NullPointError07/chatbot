import { OllamaService } from './ollamaService';
import { VectorStore } from './vectorStore';

export class ChatService {
  private ollamaService: OllamaService;
  private vectorStore: VectorStore;

  constructor(ollamaService: OllamaService, vectorStore: VectorStore) {
    this.ollamaService = ollamaService;
    this.vectorStore = vectorStore;
  }

  async handleMessage(userMessage: string, history: { role: string; content: string }[] = []): Promise<string> {
    // 1. Retrieve Context
    // We always retrieve context. If it's unrelated, the LLM will decide to ignore it based on system prompt.
    const relevantDocs = await this.vectorStore.search(userMessage, 3);
    
    const contextString = relevantDocs.map(doc => {
        const meta = doc.metadata;
        let info = `[${meta.type.toUpperCase()}] ${meta.title}`;
        if (meta.price) info += ` (Price: ${meta.price})`;
        if (meta.url) info += ` (Link: /${meta.url})`;
        return `${info}\nDetails: ${doc.content}`;
    }).join('\n\n');

    // 2. Construct System Prompt
    const systemPrompt = `You are a helpful and knowledgeable assistant for an EdTech platform called "Ekkademy".
    
    Your goal is to assist students with questions about courses, exams, live classes, and general education queries.
    
    Here is some context from our database that might be relevant to the user's question:
    ====================
    ${contextString}
    ====================
    
    INSTRUCTIONS:
    1. Use the provided Context to answer the user's question if it is relevant.
    2. If the Context contains the answer, cite the course/exam title.
    3. If the Context is NOT relevant (e.g., user says "Hi", "How are you", or asks about unrelated topics like cooking), IGNORE the context and answer naturally and politely.
    4. If the user asks for a recommendation (e.g., "I am weak in reading"), use the context to suggest specific courses/exams.
    5. Keep your answers concise and helpful.
    `;

    // 3. Prepare Messages for Ollama
    const messages = [
        { role: 'system', content: systemPrompt },
        ...history, // Include previous chat history
        { role: 'user', content: userMessage }
    ];

    // 4. Generate Response
    return await this.ollamaService.generateChatResponse(messages);
  }

  async *handleMessageStream(userMessage: string, history: { role: string; content: string }[] = []): AsyncGenerator<string> {
    // 1. Retrieve Context
    const relevantDocs = await this.vectorStore.search(userMessage, 3);
    
    const contextString = relevantDocs.map(doc => {
        const meta = doc.metadata;
        let info = `[${meta.type.toUpperCase()}] ${meta.title}`;
        if (meta.price) info += ` (Price: ${meta.price})`;
        if (meta.url) info += ` (Link: /${meta.url})`;
        return `${info}\nDetails: ${doc.content}`;
    }).join('\n\n');

    // 2. Construct System Prompt
    const systemPrompt = `You are a helpful and knowledgeable assistant for an EdTech platform called "Ekkademy".
    
    Your goal is to assist students with questions about courses, exams, live classes, and general education queries.
    
    Here is some context from our database that might be relevant to the user's question:
    ====================
    ${contextString}
    ====================
    
    INSTRUCTIONS:
    1. Use the provided Context to answer the user's question if it is relevant.
    2. If the Context contains the answer, cite the course/exam title.
    3. If the Context is NOT relevant (e.g., user says "Hi", "How are you", or asks about unrelated topics like cooking), IGNORE the context and answer naturally and politely.
    4. If the user asks for a recommendation (e.g., "I am weak in reading"), use the context to suggest specific courses/exams.
    5. Keep your answers concise and helpful.
    `;

    // 3. Prepare Messages for Ollama
    const messages = [
        { role: 'system', content: systemPrompt },
        ...history,
        { role: 'user', content: userMessage }
    ];

    // 4. Stream Response
    yield* this.ollamaService.generateChatResponseStream(messages);
  }
}
