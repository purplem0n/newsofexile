import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

// Export the schema for use in queries
export { schema };

/**
 * Create a Drizzle ORM client for Cloudflare D1
 * @param d1Database - D1Database binding from Cloudflare Workers env
 * @returns Drizzle ORM client
 */
export function createDb(d1Database: D1Database) {
  return drizzle(d1Database, { schema });
}

// Export type for the database client
export type Database = ReturnType<typeof createDb>;

/**
 * KV Cache helper functions for Cloudflare KV
 * These functions handle JSON serialization/deserialization automatically
 */
export const kvCache = {
  /**
   * Get a value from KV cache
   * @param kv - KVNamespace binding from Cloudflare Workers env
   * @param key - Cache key
   * @returns Parsed value or null if not found
   */
  async get<T>(kv: KVNamespace, key: string): Promise<T | null> {
    try {
      const value = await kv.get(key);
      if (!value) return null;
      return JSON.parse(value) as T;
    } catch (error) {
      console.error(`[KV] Failed to get key "${key}":`, error);
      return null;
    }
  },

  /**
   * Store a value in KV cache
   * @param kv - KVNamespace binding from Cloudflare Workers env
   * @param key - Cache key
   * @param value - Value to cache (will be JSON stringified)
   */
  async put(kv: KVNamespace, key: string, value: unknown): Promise<void> {
    try {
      await kv.put(key, JSON.stringify(value));
    } catch (error) {
      console.error(`[KV] Failed to put key "${key}":`, error);
    }
  },

  /**
   * Delete a key from KV cache
   * @param kv - KVNamespace binding from Cloudflare Workers env
   * @param key - Cache key to delete
   */
  async delete(kv: KVNamespace, key: string): Promise<void> {
    try {
      await kv.delete(key);
    } catch (error) {
      console.error(`[KV] Failed to delete key "${key}":`, error);
    }
  },

  /**
   * Delete multiple keys from KV cache
   * @param kv - KVNamespace binding from Cloudflare Workers env
   * @param keys - Array of cache keys to delete
   */
  async deleteMany(kv: KVNamespace, keys: string[]): Promise<void> {
    try {
      await Promise.all(keys.map(key => kv.delete(key)));
    } catch (error) {
      console.error(`[KV] Failed to delete keys:`, error);
    }
  },
};

// Export type alias for convenience
export type KVCache = typeof kvCache;
