import { Injectable, ConfigService, type OnModuleInit } from '@nitrostack/core';
import mongoose from 'mongoose';

/**
 * DatabaseService
 *
 * Manages the single Mongoose connection for the app, backed by
 * MONGODB_URI from the environment (database: nitroAppDB).
 */
@Injectable({ deps: [ConfigService] })
export class DatabaseService implements OnModuleInit {
  private connection: typeof mongoose | null = null;
  private connecting: Promise<typeof mongoose> | null = null;

  constructor(private config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    await this.connect();
  }

  async connect(): Promise<typeof mongoose> {
    if (this.connection) {
      return this.connection;
    }
    if (this.connecting) {
      return this.connecting;
    }

    const uri = this.config.get<string>('MONGODB_URI');
    if (!uri) {
      throw new Error('MONGODB_URI is not set in the environment');
    }

    this.connecting = mongoose
      .connect(uri, { dbName: 'nitroAppDB' })
      .then((conn) => {
        this.connection = conn;
        return conn;
      });

    return this.connecting;
  }

  getConnection(): typeof mongoose {
    if (!this.connection) {
      throw new Error('Database not connected yet. Call connect() first.');
    }
    return this.connection;
  }

  isConnected(): boolean {
    return this.connection !== null && mongoose.connection.readyState === 1;
  }
}
