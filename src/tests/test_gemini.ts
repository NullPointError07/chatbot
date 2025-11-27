
import { GeminiService } from '../services/geminiService';
import dotenv from 'dotenv';
dotenv.config();

async function testGemini() {
    console.log('Testing Gemini Service...');
    const key = process.env.GEMINI_API_KEY;
    console.log(`API Key present: ${!!key}`);
    if (key) {
        console.log(`API Key length: ${key.length}`);
        console.log(`API Key start: ${key.substring(0, 4)}...`);
    }

    // Manual Fetch Test
    if (key) {
        console.log('Attempting manual fetch...');
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${key}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: "Hello" }] }]
                })
            });
            console.log(`Manual Fetch Status: ${response.status} ${response.statusText}`);
            const data = await response.json();
            console.log('Manual Fetch Data:', JSON.stringify(data, null, 2));
        } catch (e) {
            console.error('Manual Fetch Error:', e);
        }
    }

    try {
        const service = new GeminiService();
        const response = await service.generateChatResponse([
            { role: 'user', content: 'Hello, are you working?' }
        ]);
        console.log('Response:', response);
    } catch (error) {
        console.error('Gemini Test Failed:', error);
    }
}

testGemini();
