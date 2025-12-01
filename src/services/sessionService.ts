import Redis from "ioredis";
import redis from "../config/redis";
import { v4 as uuidv4 } from "uuid";

export interface Message {
  role: string;
  content: string;
  timestamp?: string;
}

export interface ISessionStore {
  getSession(sessionId: string): Promise<Message[]>;
  saveSession(sessionId: string, messages: Message[]): Promise<void>;
  addMessage(sessionId: string, message: Message): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;
}

export class MemorySessionStore implements ISessionStore {
  private sessions: Map<string, Message[]> = new Map();

  async getSession(sessionId: string): Promise<Message[]> {
    return this.sessions.get(sessionId) || [];
  }

  async saveSession(sessionId: string, messages: Message[]): Promise<void> {
    this.sessions.set(sessionId, messages);
  }

  async addMessage(sessionId: string, message: Message): Promise<void> {
    const messages = await this.getSession(sessionId);
    messages.push(message);
    this.sessions.set(sessionId, messages);
  }

  async deleteSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }
}

export class RedisSessionStore implements ISessionStore {
  private redis: Redis;
  private ttl: number; // Time to live in seconds

  constructor(ttl: number = 86400) {
    // Default 24 hours
    this.redis = redis;
    this.ttl = ttl;
  }

  private getKey(sessionId: string): string {
    return `chat:session:${sessionId}`;
  }

  async getSession(sessionId: string): Promise<Message[]> {
    const data = await this.redis.get(this.getKey(sessionId));
    return data ? JSON.parse(data) : [];
  }

  async saveSession(sessionId: string, messages: Message[]): Promise<void> {
    const key = this.getKey(sessionId);
    await this.redis.set(key, JSON.stringify(messages), "EX", this.ttl);
  }

  async addMessage(sessionId: string, message: Message): Promise<void> {
    const messages = await this.getSession(sessionId);
    messages.push(message);
    await this.saveSession(sessionId, messages);
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.redis.del(this.getKey(sessionId));
  }
}

export class SessionService {
  private store: ISessionStore;

  constructor(useRedis: boolean = true) {
    // Strategy Pattern: Use Redis if requested, otherwise fallback to Memory
    if (useRedis) {
      console.log("Using RedisSessionStore");
      this.store = new RedisSessionStore();
    } else {
      console.log("Using MemorySessionStore");
      this.store = new MemorySessionStore();
    }
  }

  createSession(): string {
    return uuidv4();
  }

  async getHistory(sessionId: string): Promise<Message[]> {
    return await this.store.getSession(sessionId);
  }

  async addMessage(sessionId: string, role: string, content: string): Promise<void> {
    const timestamp = new Date().toISOString();
    await this.store.addMessage(sessionId, { role, content, timestamp });
  }

  async clearSession(sessionId: string): Promise<void> {
    await this.store.deleteSession(sessionId);
  }
}
