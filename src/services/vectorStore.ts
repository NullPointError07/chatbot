import fs from 'fs';
import path from 'path';
import { OllamaService } from './ollamaService';

interface Document {
  id: string;
  content: string;
  metadata: any;
  embedding?: number[];
}

export class VectorStore {
  private documents: Document[] = [];
  private ollamaService: OllamaService;
  private embeddingCachePath: string;

  constructor(ollamaService: OllamaService) {
    this.ollamaService = ollamaService;
    this.embeddingCachePath = path.join(process.cwd(), 'data', 'embeddings_cache.json');
  }

  async loadData(dataDir: string) {
    console.log('Loading data from:', dataDir);
    const files = fs.readdirSync(dataDir);

    for (const file of files) {
        if (!file.endsWith('.json')) continue;
        
        const filePath = path.join(dataDir, file);
        let data;
        try {
            data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        } catch (e) {
            console.error(`Skipping invalid JSON file: ${file}`, e);
            continue;
        }
        
        // Handle array of items
        const items = Array.isArray(data) ? data : [data];
        
        for (const item of items) {
            // Create a rich text representation for embedding
            // We include Title, Description, Topics, and Type to help semantic search
            let content = '';
            let type = 'unknown';

            if (file.includes('course')) {
                type = 'course';
                content = `Course: ${item.title}. Description: ${this.stripHtml(item.shortDescription || item.description || '')}. Topics: ${(item.topics || []).join(', ')}.`;
            } else if (file.includes('exam') && !file.includes('examSet')) {
                type = 'exam';
                content = `Exam: ${item.title}. Description: ${this.stripHtml(item.shortDescription || item.generalInstruction || '')}.`;
            } else if (file.includes('examSet')) {
                type = 'examSet';
                content = `Exam Set: ${item.title} (${item.setType || 'unknown type'}). Description: ${this.stripHtml(item.shortDescription || item.description || '')}. Price: ${item.pricing?.type === 'paid' ? `${item.pricing.price} BDT` : 'Free'}.`;
            } else if (file.includes('liveClass')) {
                type = 'liveClass';
                content = `Live Class: ${item.title}. Description: ${this.stripHtml(item.shortDescription || item.description || '')}. Topics: ${(item.topics || []).join(', ')}.`;
            } else if (file.includes('lesson')) {
                type = 'lesson';
                content = `Lesson: ${item.title}. Description: ${this.stripHtml(item.shortDescription || item.summary || '')}. Topics: ${(item.topics || []).join(', ')}. Difficulty: ${item.difficultyLevel || 'not specified'}.`;
            } else if (file.includes('teacher')) {
                 type = 'teacher';
                 content = `Teacher: ${item.name}. Teaching Experience: ${item.currentOccupation?.teachingExperience || 'not specified'} years. IELTS Score: ${item.education?.IELTSBandScore || 'not specified'}. Type: ${item.teacherType || 'teacher'}.`;
            }

            if (content) {
                this.documents.push({
                    id: item._id?.$oid || Math.random().toString(),
                    content: content,
                    metadata: { ...item, type },
                });
            }
        }
    }
    console.log(`Loaded ${this.documents.length} documents. Generating embeddings...`);
    await this.generateEmbeddings();
  }

  private stripHtml(html: string): string {
      return html.replace(/<[^>]*>?/gm, '');
  }

  private async generateEmbeddings() {
    // Check if cache exists
    if (fs.existsSync(this.embeddingCachePath)) {
      console.log('Loading embeddings from cache...');
      try {
        const cachedData = JSON.parse(fs.readFileSync(this.embeddingCachePath, 'utf-8'));
        
        // Map cached embeddings to documents by ID
        for (const doc of this.documents) {
          const cached = cachedData[doc.id];
          if (cached) {
            doc.embedding = cached;
          }
        }
        
        // Check if all documents have embeddings
        const missingEmbeddings = this.documents.filter(doc => !doc.embedding).length;
        if (missingEmbeddings === 0) {
          console.log('All embeddings loaded from cache.');
          return;
        }
        console.log(`${missingEmbeddings} documents missing embeddings, regenerating...`);
      } catch (e) {
        console.error('Failed to load cache, regenerating embeddings', e);
      }
    }

    // Generate missing embeddings
    const cache: Record<string, number[]> = {};
    for (const doc of this.documents) {
      if (doc.embedding) {
        cache[doc.id] = doc.embedding;
        continue;
      }
      
      try {
        doc.embedding = await this.ollamaService.generateEmbedding(doc.content);
        cache[doc.id] = doc.embedding;
        console.log(`Generated embedding for ${doc.metadata.title}`);
      } catch (e) {
        console.error(`Failed to generate embedding for doc ${doc.id}`, e);
      }
    }
    
    // Save cache to disk
    try {
      fs.writeFileSync(this.embeddingCachePath, JSON.stringify(cache, null, 2));
      console.log('Embeddings cached to disk.');
    } catch (e) {
      console.error('Failed to save embeddings cache', e);
    }
  }

  async search(query: string, topK: number = 3): Promise<Document[]> {
    const queryEmbedding = await this.ollamaService.generateEmbedding(query);
    
    // Calculate Cosine Similarity
    const scoredDocs = this.documents.map(doc => {
        if (!doc.embedding) return { doc, score: -1 };
        const score = this.cosineSimilarity(queryEmbedding, doc.embedding);
        return { doc, score };
    });

    // Sort by score descending
    scoredDocs.sort((a, b) => b.score - a.score);

    return scoredDocs.slice(0, topK).map(d => d.doc);
  }

  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    const dotProduct = vecA.reduce((acc, val, i) => acc + val * vecB[i], 0);
    const magA = Math.sqrt(vecA.reduce((acc, val) => acc + val * val, 0));
    const magB = Math.sqrt(vecB.reduce((acc, val) => acc + val * val, 0));
    return dotProduct / (magA * magB);
  }
}
