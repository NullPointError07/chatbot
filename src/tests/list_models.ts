
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

async function listModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('No API key found.');
    return;
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const response = await fetch(url);
    
    if (!response.ok) {
        const text = await response.text();
        fs.writeFileSync('models_list.txt', `Error: ${response.status} ${response.statusText}\n${text}`);
        return;
    }

    const data = await response.json();
    let output = 'Available Models:\n';
    if (data.models) {
        data.models.forEach((m: any) => {
            output += `- ${m.name} (${m.displayName})\n`;
            output += `  Supported methods: ${m.supportedGenerationMethods.join(', ')}\n`;
        });
    } else {
        output += 'No models found in response: ' + JSON.stringify(data);
    }
    fs.writeFileSync('models_list.txt', output);
    console.log('Output written to models_list.txt');

  } catch (error) {
    fs.writeFileSync('models_list.txt', `Exception: ${error}`);
  }
}

listModels();
