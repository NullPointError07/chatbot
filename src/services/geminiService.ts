import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

export class GeminiService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not set in environment variables');
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  }

  async generateChatResponse(messages: { role: string; content: string }[]): Promise<string> {
    try {
      // Convert messages to Gemini format
      // Gemini expects history + last message
      // System prompt is usually set at model initialization or as the first part of the prompt
      // For simplicity, we'll concatenate the system prompt if present or just map roles
      
      const chat = this.model.startChat({
        history: messages.slice(0, -1).map(m => ({
          role: m.role === 'user' ? 'user' : 'model', // Gemini uses 'model' instead of 'assistant'
          parts: [{ text: m.content }],
        })),
        generationConfig: {
          maxOutputTokens: 1000,
        },
      });

      const lastMessage = messages[messages.length - 1];
      const result = await chat.sendMessage(lastMessage.content);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('Error generating chat response with Gemini:', error);
      throw error;
    }
  }

  async *generateChatResponseStream(messages: { role: string; content: string }[]): AsyncGenerator<string> {
    try {
      // Handle system prompt separately if needed, but for now we assume it's part of the flow or we can prepend it
      // Note: Gemini API supports system instructions in the model config, but for simplicity in this drop-in replacement
      // we will filter out the system message and prepend it to the first user message OR use it if the SDK supports it easily.
      // The current SDK version allows systemInstruction in getGenerativeModel.
      
      // Let's check if the first message is system
      let systemInstruction = undefined;
      let historyMessages = messages.slice(0, -1);
      
      if (messages.length > 0 && messages[0].role === 'system') {
          systemInstruction = messages[0].content;
          historyMessages = messages.slice(1, -1);
      }

      // Re-initialize model with system instruction if present (or just use a new instance)
      const model = systemInstruction 
        ? this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash', systemInstruction: systemInstruction })
        : this.model;

      const chat = model.startChat({
        history: historyMessages.map(m => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.content }],
        })),
      });

      const lastMessage = messages[messages.length - 1];
      const result = await chat.sendMessageStream(lastMessage.content);

      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        if (chunkText) {
          yield chunkText;
        }
      }
    } catch (error) {
      console.error('Error generating streaming chat response with Gemini:', error);
      throw error;
    }
  }
}
