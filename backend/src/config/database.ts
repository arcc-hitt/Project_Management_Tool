import { MongoClient, type Db, type Collection, type Document } from 'mongodb';
import { config } from './config.js';

class Database {
  private client: MongoClient | null;
  private db: Db | null;

  constructor() {
    this.client = null;
    this.db = null;
  }

  async connect() {
    try {
      if (this.db) {
        return this.db;
      }

      this.client = new MongoClient(config.database.uri, {
        maxPoolSize: 50,
        minPoolSize: 5,
        maxIdleTimeMS: 300000,
        connectTimeoutMS: 10000,
        serverSelectionTimeoutMS: 10000,
      });

      await this.client.connect();
      this.db = this.client.db(config.database.name);

      await this.db.command({ ping: 1 });
      console.log('Database connected successfully');

      return this.db;
    } catch (error) {
      console.error('Database connection failed:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async getDb(): Promise<Db> {
    if (!this.db) {
      await this.connect();
    }
    return this.db as Db;
  }

  async getCollection<TSchema extends Document = any>(name: string): Promise<Collection<TSchema>> {
    const db = await this.getDb();
    return db.collection(name);
  }

  async close() {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
      console.log('Database connection closed');
    }
  }
}

// Create singleton instance
const database = new Database();

export default database;