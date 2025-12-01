import ollama from "ollama";

export class OllamaService {
  private model: string;
  private embedModel: string;

  constructor(model: string = "llama3.2:3b", embedModel: string = "nomic-embed-text:latest") {
    this.model = model;
    this.embedModel = embedModel;
  }

  async generateEmbedding(prompt: string): Promise<number[]> {
    try {
      const response = await ollama.embeddings({
        model: this.embedModel,
        prompt: prompt,
      });
      return response.embedding;
    } catch (error) {
      console.error("Error generating embedding:", error);
      throw error;
    }
  }

  async generateChatResponse(messages: { role: string; content: string }[]): Promise<string> {
    try {
      const response = await ollama.chat({
        model: this.model,
        messages: messages as any, // Type cast to satisfy library types if needed
      });
      console.log("response", response);
      return response.message.content;
    } catch (error) {
      console.error("Error generating chat response:", error);
      throw error;
    }
  }

  async *generateChatResponseStream(messages: { role: string; content: string }[]): AsyncGenerator<string> {
    try {
      const stream = await ollama.chat({
        model: this.model,
        messages: messages as any,
        stream: true,
      });

      for await (const chunk of stream) {
        if (chunk.message?.content) {
          yield chunk.message.content;
        }
      }
    } catch (error) {
      console.error("Error generating streaming chat response:", error);
      throw error;
    }
  }
}
