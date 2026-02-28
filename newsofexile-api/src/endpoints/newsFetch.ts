import { Num, OpenAPIRoute, Str } from "chanfana";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import { createDb, createRedis } from "../db";
import { newsItems } from "../db/schema";
import { type AppContext, SourceType } from "../types";

const MAX_ITEMS = 300;
const CACHE_KEY_PREFIX = "news:list";

/**
 * Generate a cache key based on source type filter
 */
function generateCacheKey(sourceType: string | undefined): string {
  if (sourceType) {
    return `${CACHE_KEY_PREFIX}:source:${sourceType}`;
  }
  return CACHE_KEY_PREFIX;
}

export class NewsFetch extends OpenAPIRoute {
  schema = {
    tags: ["News"],
    summary: "List News Items",
    description: `Fetch up to ${MAX_ITEMS} recent news items. Optionally filter by source type.`,
    request: {
      query: z.object({
        sourceType: SourceType.optional().describe(
          "Filter by source type (poe1-news, poe1-patch, poe2-news, poe2-patch)",
        ),
      }),
    },
    responses: {
      "200": {
        description: "Returns a list of news items",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              data: z.object({
                items: z.array(
                  z.object({
                    id: z.number(),
                    sourceId: z.string(),
                    sourceType: z.string(),
                    title: z.string(),
                    url: z.string(),
                    author: z.string().nullable(),
                    preview: z.string().nullable(),
                    wordCount: z.number().nullable(),
                    postedAt: z.string().nullable(),
                    scrapedAt: z.string(),
                    contentFetchedAt: z.string().nullable(),
                    isActive: z.boolean(),
                  }),
                ),
              }),
            }),
          },
        },
      },
    },
  };

  async handle(c: AppContext) {
    try {
      // Get validated data
      const data = await this.getValidatedData<typeof this.schema>();

      // Retrieve the validated parameters
      const { sourceType } = data.query;

      // Initialize Redis client
      const redis = createRedis(
        c.env.UPSTASH_REDIS_REST_URL,
        c.env.UPSTASH_REDIS_REST_TOKEN,
      );

      // Generate cache key (simple - no cursor)
      const cacheKey = generateCacheKey(sourceType);

      // Try to get cached response
      let cached: unknown = null;
      try {
        cached = await redis.get(cacheKey);
      } catch (redisError) {
        console.error("[Redis] Failed to get cached data:", redisError);
        // Continue without cache - don't fail the request
      }
      if (cached) {
        // Return cached data directly
        return cached;
      }

      // Initialize database connection
      const db = createDb(c.env.DATABASE_URL);

      // Build the query conditions
      const conditions = [eq(newsItems.isActive, true)];

      if (sourceType) {
        conditions.push(eq(newsItems.sourceType, sourceType));
      }

      // Fetch up to MAX_ITEMS items
      const items = await db.query.newsItems.findMany({
        where: and(...conditions),
        orderBy: [desc(newsItems.postedAt), desc(newsItems.id)],
        limit: MAX_ITEMS,
      });

      // Format the response
      const formattedItems = items.map((item) => ({
        id: item.id,
        sourceId: item.sourceId,
        sourceType: item.sourceType,
        title: item.title,
        url: item.url,
        author: item.author,
        preview: item.preview,
        wordCount: item.wordCount,
        postedAt: item.postedAt?.toISOString() || null,
        scrapedAt: item.scrapedAt.toISOString(),
        contentFetchedAt: item.contentFetchedAt?.toISOString() || null,
        isActive: item.isActive,
      }));

      const response = {
        success: true,
        data: {
          items: formattedItems,
        },
      };

      // Cache the response
      try {
        await redis.set(cacheKey, response);
      } catch (redisError) {
        console.error("[Redis] Failed to cache response:", redisError);
        // Continue without caching - don't fail the request
      }

      return response;
    } catch (error) {
      console.error("[NewsFetch] Error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}
