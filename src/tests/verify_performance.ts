
import { OllamaService } from '../services/ollamaService';
import { VectorStore } from '../services/vectorStore';
import path from 'path';

async function verifyPerformance() {
    console.log('--- Starting Performance Verification ---');

    const ollamaService = new OllamaService();
    const vectorStore = new VectorStore(ollamaService);

    // 1. Measure Data Loading (should be fast if cached)
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

    // 3. Measure LLM Generation (Stream)
    console.log('\n--- Testing LLM Generation (Stream) ---');
    const messages = [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: query }
    ];

    console.time('LLM Response');
    const stream = ollamaService.generateChatResponseStream(messages);
    let firstToken = true;
    let tokenCount = 0;
    
    for await (const chunk of stream) {
        if (firstToken) {
            console.timeLog('LLM Response', 'First token received');
            firstToken = false;
        }
        process.stdout.write(chunk);
        tokenCount++;
    }
    console.log('\n');
    console.timeEnd('LLM Response');
    console.log(`Total tokens: ${tokenCount}`);
}

verifyPerformance().catch(console.error);
