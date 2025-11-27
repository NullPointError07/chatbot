import { OllamaService } from './ollamaService';
import { VectorStore } from './vectorStore';
import { GeminiService } from './geminiService';

export class ChatService {
  private ollamaService: OllamaService;
  private vectorStore: VectorStore;
  private geminiService: GeminiService;

  constructor(ollamaService: OllamaService, vectorStore: VectorStore) {
    this.ollamaService = ollamaService;
    this.vectorStore = vectorStore;
    this.geminiService = new GeminiService();
  }

  async handleMessage(userMessage: string, history: { role: string; content: string }[] = []): Promise<string> {
    // 1. Retrieve Context
    // We always retrieve context. If it's unrelated, the LLM will decide to ignore it based on system prompt.
    const relevantDocs = await this.vectorStore.search(userMessage, 3);
    
    const contextString = relevantDocs.map(doc => {
        const meta = doc.metadata;
        let info = `[${meta.type.toUpperCase()}] ${meta.title}`;
        if (meta.price) info += ` (Price: ${meta.price})`;
        if (meta.url) info += ` (Link: https://dev.ekkademy.net/${meta.url})`;
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
    1. **Analyze the User's Intent First**:
       - If the user asks a **General Question** (e.g., "What is IELTS?", "How to improve writing?"), answer using your general knowledge. **DO NOT** suggest specific courses unless the user explicitly asks for them (e.g., "Do you have any courses for this?").
       - If the user asks about **Ekkademy's Offerings** (e.g., "What courses do you have?", "Price of IELTS exam"), use the provided Context to answer.
    
    2. **Using Context**:
       - If the Context contains the answer to a specific question about Ekkademy, cite the course/exam title AND its full link (https://dev.ekkademy.net/...).
       - If the Context is NOT relevant to the user's specific question, IGNORE it completely.
    
    3. **Tone and Style**:
       - Be direct, professional, and helpful.
       - Do NOT apologize for being an AI or say "I am under development".
       - Keep your answers concise.
    `;

    // 3. Prepare Messages for Gemini
    const messages = [
        { role: 'system', content: systemPrompt },
        ...history, // Include previous chat history
        { role: 'user', content: userMessage }
    ];

    // 4. Generate Response using Gemini
    return await this.geminiService.generateChatResponse(messages);
  }

  async *handleMessageStream(userMessage: string, history: { role: string; content: string }[] = []): AsyncGenerator<string> {
    // 1. Retrieve Context
    const relevantDocs = await this.vectorStore.search(userMessage, 3);
    
    const contextString = relevantDocs.map(doc => {
        const meta = doc.metadata;
        let info = `[${meta.type.toUpperCase()}] ${meta.title}`;
        if (meta.price) info += ` (Price: ${meta.price})`;
        if (meta.url) info += ` (Link: https://dev.ekkademy.net/${meta.url})`;
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
    1. **Analyze the User's Intent First**:
       - If the user asks a **General Question** (e.g., "What is IELTS?", "How to improve writing?"), answer using your general knowledge. **DO NOT** suggest specific courses unless the user explicitly asks for them (e.g., "Do you have any courses for this?").
       - If the user asks about **Ekkademy's Offerings** (e.g., "What courses do you have?", "Price of IELTS exam"), use the provided Context to answer.
    
    2. **Using Context**:
       - If the Context contains the answer to a specific question about Ekkademy, cite the course/exam title AND its full link (https://dev.ekkademy.net/...).
       - If the Context is NOT relevant to the user's specific question, IGNORE it completely.
    
    3. **Tone and Style**:
       - Be direct, professional, and helpful.
       - Do NOT apologize for being an AI or say "I am under development".
       - Keep your answers concise.
    `;

    // 3. Prepare Messages for Gemini
    const messages = [
        { role: 'system', content: systemPrompt },
        ...history,
        { role: 'user', content: userMessage }
    ];

    // 4. Stream Response using Gemini
    yield* this.geminiService.generateChatResponseStream(messages);
  }
}

