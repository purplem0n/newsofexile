import { Redis } from "@upstash/redis";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// Export the schema for use in queries
export { schema };

/**
 * Create a Drizzle ORM client for PostgreSQL
 * @param connectionString - PostgreSQL connection string (DATABASE_URL)
 * @returns Drizzle ORM client
 */
export function createDb(connectionString: string) {
  const pool = new Pool({ connectionString });
  return drizzle(pool, { schema });
}

// Export type for the database client
export type Database = ReturnType<typeof createDb>;

/**
 * Create a Redis client using Upstash REST API
 * @param url - Upstash Redis REST URL
 * @param token - Upstash Redis REST token
 * @returns Redis client
 */
export function createRedis(url: string, token: string) {
  if (!url || !token) {
    throw new Error(
      "Redis configuration missing: UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set"
    );
  }
  // Remove trailing slash if present - the SDK adds paths like /pipeline
  const cleanUrl = url.endsWith("/") ? url.slice(0, -1) : url;
  return new Redis({
    url: cleanUrl,
    token,
  });
}

// Export type for the Redis client
export type RedisClient = ReturnType<typeof createRedis>;
