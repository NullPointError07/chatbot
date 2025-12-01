import express from "express";
import cors from "cors";
import path from "path";
import { OllamaService } from "./services/ollamaService";
import { VectorStore } from "./services/vectorStore";
import { ChatService } from "./services/chatService";

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../client")));

// Initialize Services
const ollamaService = new OllamaService(); // Defaults to llama3.1 and nomic-embed-text
const vectorStore = new VectorStore(ollamaService);
const chatService = new ChatService(ollamaService, vectorStore);

// Load Data on Startup
const dataDir = path.join(__dirname, "../data");
vectorStore.loadData(dataDir).catch((err) => console.error("Failed to load data:", err));

// Routes
app.post("/api/chat", async (req, res) => {
  try {
    const { message, history, type } = req.body;

    if (type !== "text") {
      return res.status(400).json({ error: "Invalid type" });
    }

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    const response = await chatService.handleMessage(message, history || []);
    res.json({ response });
  } catch (error) {
    console.error("Chat error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Streaming Chat Route
app.post("/api/chat/stream", async (req, res) => {
  try {
    const { message, history, type } = req.body;

    if (type !== "text") {
      return res.status(400).json({ error: "Invalid type" });
    }

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    // Set headers for Server-Sent Events
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // Stream the response
    for await (const chunk of chatService.handleMessageStream(message, history || [])) {
      res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
    }

    // Send done signal
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (error) {
    console.error("Streaming error:", error);
    res.write(`data: ${JSON.stringify({ error: "Internal server error" })}\n\n`);
    res.end();
  }
});

// Health Check
app.get("/health", (req, res) => {
  res.json({ status: "ok", documentsLoaded: (vectorStore as any).documents.length });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Ollama URL assumed: http://127.0.0.1:11434`);
  // Keep process alive
  setInterval(() => {}, 10000);
});
