import { OllamaService } from '../services/ollamaService';
import { VectorStore } from '../services/vectorStore';
import { ChatService } from '../services/chatService';
import path from 'path';

async function verifyPerformance() {
    console.log('--- Starting Performance Verification (Gemini) ---');

    const ollamaService = new OllamaService();
    const vectorStore = new VectorStore(ollamaService);
    const chatService = new ChatService(ollamaService, vectorStore);

    // 1. Measure Data Loading
    console.time('Data Loading');
    await vectorStore.loadData(path.join(process.cwd(), 'data'));
    console.timeEnd('Data Loading');

    // 2. Measure Vector Search
    const query = "I want to learn about IELTS";
    console.time('Vector Search');
    const results = await vectorStore.search(query, 3);
    console.timeEnd('Vector Search');
    console.log(`Found ${results.length} results.`);
    results.forEach((r, i) => console.log(`[${i+1}] ${r.metadata.title}`));

    // 3. Measure Chat Generation (Gemini)
    console.log('\n--- Testing Chat Generation (Gemini Stream) ---');
    
    console.time('Gemini Response');
    const stream = chatService.handleMessageStream(query, []);
    let firstToken = true;
    let tokenCount = 0;
    
    for await (const chunk of stream) {
        if (firstToken) {
            console.timeLog('Gemini Response', 'First token received');
            firstToken = false;
        }
        process.stdout.write(chunk);
        tokenCount++;
    }
    console.log('\n');
    console.timeEnd('Gemini Response');
    console.log(`Total chunks: ${tokenCount}`);
}

verifyPerformance().catch(console.error);
