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
  
  // Reference maps for lookups
  private categoryMap: Map<string, any> = new Map();
  private teacherMap: Map<string, any> = new Map();
  private lessonMap: Map<string, any> = new Map();
  private courseMap: Map<string, any> = new Map();
  private examMap: Map<string, any> = new Map();
  private liveClassMap: Map<string, any> = new Map();

  constructor(ollamaService: OllamaService) {
    this.ollamaService = ollamaService;
    this.embeddingCachePath = path.join(process.cwd(), 'cache', 'embeddings.json');
  }

  async loadData(dataDir: string) {
    console.log('Loading data from:', dataDir);
    
    // First, load ALL reference data
    await this.loadReferenceData(dataDir);
    
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
        
        const items = Array.isArray(data) ? data : [data];
        
        for (const item of items) {
            let content = '';
            let type = 'unknown';

            if (file.includes('bundle')) {
                type = 'bundle';
                content = this.buildBundleContent(item);
            } else if (file.includes('course')) {
                type = 'course';
                content = this.buildCourseContent(item);
            } else if (file.includes('examSet')) {
                type = 'examSet';
                content = this.buildExamSetContent(item);
            } else if (file.includes('exam') && !file.includes('examSet')) {
                type = 'exam';
                content = this.buildExamContent(item);
            } else if (file.includes('liveClass')) {
                type = 'liveClass';
                content = this.buildLiveClassContent(item);
            } else if (file.includes('lesson')) {
                type = 'lesson';
                content = this.buildLessonContent(item);
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

  private async loadReferenceData(dataDir: string) {
    // Load categories
    const categoryPath = path.join(dataDir, 'category.json');
    if (fs.existsSync(categoryPath)) {
      const categories = JSON.parse(fs.readFileSync(categoryPath, 'utf-8'));
      (Array.isArray(categories) ? categories : [categories]).forEach(cat => {
        if (cat._id?.$oid) this.categoryMap.set(cat._id.$oid, cat);
      });
      console.log(`Loaded ${this.categoryMap.size} categories`);
    }

    // Load teachers
    const teacherPath = path.join(dataDir, 'teacher.json');
    if (fs.existsSync(teacherPath)) {
      const teachers = JSON.parse(fs.readFileSync(teacherPath, 'utf-8'));
      (Array.isArray(teachers) ? teachers : [teachers]).forEach(teacher => {
        if (teacher._id?.$oid) this.teacherMap.set(teacher._id.$oid, teacher);
      });
      console.log(`Loaded ${this.teacherMap.size} teachers`);
    }

    // Load lessons
    const lessonPath = path.join(dataDir, 'lesson.json');
    if (fs.existsSync(lessonPath)) {
      const lessons = JSON.parse(fs.readFileSync(lessonPath, 'utf-8'));
      (Array.isArray(lessons) ? lessons : [lessons]).forEach(lesson => {
        if (lesson._id?.$oid) this.lessonMap.set(lesson._id.$oid, lesson);
      });
      console.log(`Loaded ${this.lessonMap.size} lessons`);
    }

    // Load courses
    const coursePath = path.join(dataDir, 'course.json');
    if (fs.existsSync(coursePath)) {
      const courses = JSON.parse(fs.readFileSync(coursePath, 'utf-8'));
      (Array.isArray(courses) ? courses : [courses]).forEach(course => {
        if (course._id?.$oid) this.courseMap.set(course._id.$oid, course);
      });
      console.log(`Loaded ${this.courseMap.size} courses`);
    }

    // Load exams
    const examPath = path.join(dataDir, 'exam.json');
    if (fs.existsSync(examPath)) {
      const exams = JSON.parse(fs.readFileSync(examPath, 'utf-8'));
      (Array.isArray(exams) ? exams : [exams]).forEach(exam => {
        if (exam._id?.$oid) this.examMap.set(exam._id.$oid, exam);
      });
      console.log(`Loaded ${this.examMap.size} exams`);
    }

    // Load live classes
    const liveClassPath = path.join(dataDir, 'liveClass.json');
    if (fs.existsSync(liveClassPath)) {
      const liveClasses = JSON.parse(fs.readFileSync(liveClassPath, 'utf-8'));
      (Array.isArray(liveClasses) ? liveClasses : [liveClasses]).forEach(liveClass => {
        if (liveClass._id?.$oid) this.liveClassMap.set(liveClass._id.$oid, liveClass);
      });
      console.log(`Loaded ${this.liveClassMap.size} live classes`);
    }
  }

  private buildBundleContent(bundle: any): string {
    const parts: string[] = [];
    
    parts.push(`Bundle: ${bundle.title}`);
    parts.push(`Description: ${this.stripHtml(bundle.shortDescription || bundle.description || '')}`);
    
    // Category names
    if (bundle.category && Array.isArray(bundle.category) && bundle.category.length > 0) {
      const categoryNames = bundle.category
        .map((catRef: any) => this.categoryMap.get(catRef.$oid)?.title || 'Unknown')
        .join(', ');
      parts.push(`Categories: ${categoryNames}`);
    }
    
    // Teacher names
    if (bundle.teacher && Array.isArray(bundle.teacher) && bundle.teacher.length > 0) {
      const teacherNames = bundle.teacher
        .map((teacherRef: any) => this.teacherMap.get(teacherRef.$oid)?.name || 'Unknown')
        .join(', ');
      parts.push(`Teachers: ${teacherNames}`);
    }
    
    // Pricing
    const price = bundle.offerPrice || bundle.price;
    if (price) {
      parts.push(`Price: ${price} BDT`);
    }
    
    // Bundle statistics
    if (bundle.noOfVideos !== undefined) parts.push(`Number of Videos: ${bundle.noOfVideos}`);
    if (bundle.noOfLiveClasses !== undefined) parts.push(`Number of Live Classes: ${bundle.noOfLiveClasses}`);
    if (bundle.noOfMockTests !== undefined) parts.push(`Number of Mock Tests: ${bundle.noOfMockTests}`);
    if (bundle.noOfAssignments !== undefined) parts.push(`Number of Assignments: ${bundle.noOfAssignments}`);
    
    // Courses in bundle
    if (bundle.course && Array.isArray(bundle.course) && bundle.course.length > 0) {
      parts.push(`Number of Courses: ${bundle.course.length}`);
      const courseNames = bundle.course
        .map((courseRef: any) => this.courseMap.get(courseRef.$oid)?.title || 'Unknown')
        .slice(0, 3)
        .join(', ');
      parts.push(`Includes Courses: ${courseNames}${bundle.course.length > 3 ? ' and more' : ''}`);
    }
    
    return parts.join('. ');
  }

  private buildCourseContent(course: any): string {
    const parts: string[] = [];
    
    parts.push(`Course: ${course.title}`);
    parts.push(`Description: ${this.stripHtml(course.shortDescription || course.description || '')}`);
    
    // Category names
    if (course.category && Array.isArray(course.category) && course.category.length > 0) {
      const categoryNames = course.category
        .map((catRef: any) => this.categoryMap.get(catRef.$oid)?.title || 'Unknown')
        .join(', ');
      parts.push(`Categories: ${categoryNames}`);
    }
    
    // Teacher names
    if (course.teacher && Array.isArray(course.teacher) && course.teacher.length > 0) {
      const teacherNames = course.teacher
        .map((teacherRef: any) => this.teacherMap.get(teacherRef.$oid)?.name || 'Unknown')
        .join(', ');
      parts.push(`Teachers: ${teacherNames}`);
    }
    
    // Class types
    const classTypes: string[] = [];
    if (course.hasLiveClass) classTypes.push('Live Classes');
    if (course.hasRecordedClass) classTypes.push('Recorded Classes');
    if (classTypes.length > 0) {
      parts.push(`Class Types: ${classTypes.join(', ')}`);
    }
    
    // Lesson count and assignment detection
    if (course.lesson && Array.isArray(course.lesson)) {
      parts.push(`Number of Lessons: ${course.lesson.length}`);
      
      const hasAssignments = course.lesson.some((lessonRef: any) => {
        const lesson = this.lessonMap.get(lessonRef.$oid);
        return lesson?.assignment && Array.isArray(lesson.assignment) && lesson.assignment.length > 0;
      });
      
      if (hasAssignments) {
        parts.push(`Has Assignments: Yes`);
      }
    }
    
    // Pricing
    if (course.pricing) {
      if (course.pricing.type === 'free') {
        parts.push(`Price: Free`);
      } else if (course.pricing.type === 'paid') {
        const price = course.pricing.offerPrice || course.pricing.price;
        parts.push(`Price: ${price} BDT`);
      } else if (course.pricing.type === 'inBundle') {
        parts.push(`Price: Available in Bundle`);
      }
    }
    
    // Difficulty level
    if (course.difficultyLevel) {
      parts.push(`Difficulty: ${course.difficultyLevel}`);
    }
    
    // Topics
    if (course.topics && Array.isArray(course.topics) && course.topics.length > 0) {
      parts.push(`Topics: ${course.topics.slice(0, 5).join(', ')}`);
    }
    
    return parts.join('. ');
  }

  private buildExamSetContent(examSet: any): string {
    const parts: string[] = [];
    
    parts.push(`Exam Set: ${examSet.title}`);
    parts.push(`Description: ${this.stripHtml(examSet.shortDescription || examSet.description || '')}`);
    
    // Set type is CRITICAL for mock test detection
    if (examSet.setType) {
      parts.push(`Set Type: ${examSet.setType}`);
      
      if (examSet.setType === 'full length') {
        parts.push(`Full Length Mock Test: Yes (includes all 4 IELTS modules: Reading, Writing, Listening, Speaking)`);
      } else if (examSet.setType === 'partial') {
        parts.push(`Partial Mock Test: Yes (includes some IELTS modules)`);
      } else if (examSet.setType === 'practice') {
        parts.push(`Practice Set: Yes`);
      }
    }
    
    // Category
    if (examSet.category?.$oid) {
      const cat = this.categoryMap.get(examSet.category.$oid);
      if (cat) {
        parts.push(`Category: ${cat.title}`);
      }
    }
    
    // Exam details
    if (examSet.exam && Array.isArray(examSet.exam)) {
      parts.push(`Number of Exams: ${examSet.exam.length}`);
      
      // Get exam categories to show which modules are included
      const examCategories = examSet.exam
        .map((examRef: any) => {
          const exam = this.examMap.get(examRef.$oid);
          if (exam && exam.category && Array.isArray(exam.category) && exam.category.length > 0) {
            const cat = this.categoryMap.get(exam.category[0].$oid);
            return cat?.title || null;
          }
          return null;
        })
        .filter(Boolean);
      
      if (examCategories.length > 0) {
        parts.push(`Includes: ${examCategories.join(', ')}`);
      }
    }
    
    // Pricing
    if (examSet.pricing) {
      if (examSet.pricing.type === 'free') {
        parts.push(`Price: Free`);
      } else if (examSet.pricing.type === 'paid') {
        const price = examSet.pricing.offerPrice || examSet.pricing.price;
        parts.push(`Price: ${price} BDT`);
      }
    }
    
    // Duration
    if (examSet.setDuration) {
      const hours = Math.floor(examSet.setDuration / 3600);
      parts.push(`Duration: ${hours} hours`);
    }
    
    return parts.join('. ');
  }

  private buildExamContent(exam: any): string {
    const parts: string[] = [];
    
    parts.push(`Exam: ${exam.title}`);
    parts.push(`Description: ${this.stripHtml(exam.shortDescription || exam.generalInstruction || '')}`);
    
    // Category names
    if (exam.category && Array.isArray(exam.category) && exam.category.length > 0) {
      const categoryNames = exam.category
        .map((catRef: any) => this.categoryMap.get(catRef.$oid)?.title || 'Unknown')
        .join(', ');
      parts.push(`Categories: ${categoryNames}`);
    }
    
    // Exam type
    if (exam.type) {
      parts.push(`Type: ${exam.type}`);
    }
    
    // Scope
    if (exam.scope) {
      parts.push(`Scope: ${exam.scope}`);
    }
    
    // Questions
    if (exam.totalNoOfQuestions) {
      parts.push(`Number of Questions: ${exam.totalNoOfQuestions}`);
    }
    
    // Duration
    if (exam.duration) {
      const minutes = Math.floor(exam.duration / 60);
      parts.push(`Duration: ${minutes} minutes`);
    }
    
    // Pricing
    if (exam.pricing) {
      if (exam.pricing.type === 'free') {
        parts.push(`Price: Free`);
      } else if (exam.pricing.type === 'paid') {
        const price = exam.pricing.offerPrice || exam.pricing.price;
        parts.push(`Price: ${price} BDT`);
      }
    }
    
    return parts.join('. ');
  }

  private buildLiveClassContent(liveClass: any): string {
    const parts: string[] = [];
    
    parts.push(`Live Class: ${liveClass.title}`);
    parts.push(`Description: ${this.stripHtml(liveClass.shortDescription || liveClass.description || '')}`);
    
    // Category
    if (liveClass.category && Array.isArray(liveClass.category) && liveClass.category.length > 0) {
      const categoryNames = liveClass.category
        .map((catRef: any) => this.categoryMap.get(catRef.$oid)?.title || 'Unknown')
        .join(', ');
      parts.push(`Categories: ${categoryNames}`);
    }
    
    // Topics
    if (liveClass.topics && Array.isArray(liveClass.topics) && liveClass.topics.length > 0) {
      parts.push(`Topics: ${liveClass.topics.join(', ')}`);
    }
    
    return parts.join('. ');
  }

  private buildLessonContent(lesson: any): string {
    const parts: string[] = [];
    
    parts.push(`Lesson: ${lesson.title}`);
    parts.push(`Description: ${this.stripHtml(lesson.shortDescription || lesson.summary || '')}`);
    
    // Category names
    if (lesson.category && Array.isArray(lesson.category) && lesson.category.length > 0) {
      const categoryNames = lesson.category
        .map((catRef: any) => this.categoryMap.get(catRef.$oid)?.title || 'Unknown')
        .join(', ');
      parts.push(`Categories: ${categoryNames}`);
    }
    
    // Topics
    if (lesson.topics && Array.isArray(lesson.topics) && lesson.topics.length > 0) {
      parts.push(`Topics: ${lesson.topics.join(', ')}`);
    }
    
    // Difficulty
    if (lesson.difficultyLevel) {
      parts.push(`Difficulty: ${lesson.difficultyLevel}`);
    }
    
    // Assignment
    if (lesson.assignment && Array.isArray(lesson.assignment) && lesson.assignment.length > 0) {
      parts.push(`Has Assignment: Yes`);
    }
    
    // Pricing
    if (lesson.pricing) {
      if (lesson.pricing.type === 'free') {
        parts.push(`Price: Free`);
      } else if (lesson.pricing.type === 'paid') {
        const price = lesson.pricing.offerPrice || lesson.pricing.price;
        parts.push(`Price: ${price} BDT`);
      } else if (lesson.pricing.type === 'inCourse') {
        parts.push(`Price: Included in Course`);
      }
    }
    
    return parts.join('. ');
  }

  private stripHtml(html: string): string {
      return html.replace(/<[^>]*>?/gm, '').replace(/&[a-z]+;/gi, ' ');
  }

  private async generateEmbeddings() {
    if (fs.existsSync(this.embeddingCachePath)) {
      console.log('Loading embeddings from cache...');
      try {
        const cachedData = JSON.parse(fs.readFileSync(this.embeddingCachePath, 'utf-8'));
        
        for (const doc of this.documents) {
          const cached = cachedData[doc.id];
          if (cached) {
            doc.embedding = cached;
          }
        }
        
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
    
    try {
      const cacheDir = path.dirname(this.embeddingCachePath);
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }
      fs.writeFileSync(this.embeddingCachePath, JSON.stringify(cache, null, 2));
      console.log('Embeddings cached to disk.');
    } catch (e) {
      console.error('Failed to save embeddings cache', e);
    }
  }

  async search(query: string, topK: number = 3): Promise<Document[]> {
    const queryEmbedding = await this.ollamaService.generateEmbedding(query);
    
    const scoredDocs = this.documents.map(doc => {
        if (!doc.embedding) return { doc, score: -1 };
        const score = this.cosineSimilarity(queryEmbedding, doc.embedding);
        return { doc, score };
    });

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
