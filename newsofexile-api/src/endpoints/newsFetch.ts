import { Num, OpenAPIRoute, Str } from "chanfana";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import { createDb, kvCache } from "../db";
import { newsItems, patchNoteUpdates } from "../db/schema";
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
    description: `Fetch up to ${MAX_ITEMS} recent news items. Optionally filter by source type. Includes patch note updates as sub-items for Content Update patches.`,
    request: {
      query: z.object({
        sourceType: SourceType.optional().describe(
          "Filter by source type (poe1-news, poe1-patch, poe2-news, poe2-patch)",
        ),
      }),
    },
    responses: {
      "200": {
        description: "Returns a list of news items with patch updates",
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
                    patchUpdates: z.array(
                      z.object({
                        id: z.number(),
                        updateDate: z.string(),
                        contentHtml: z.string(),
                        contentText: z.string(),
                        isPoe1Format: z.boolean(),
                        scrapedAt: z.string(),
                      })
                    ).optional(),
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

      // Generate cache key (simple - no cursor)
      const cacheKey = generateCacheKey(sourceType);

      // Try to get cached response from KV
      const cached = await kvCache.get<{
        success: boolean;
        data: {
          items: Array<{
            id: number;
            sourceId: string;
            sourceType: string;
            title: string;
            url: string;
            author: string | null;
            preview: string | null;
            wordCount: number | null;
            postedAt: string | null;
            scrapedAt: string;
            contentFetchedAt: string | null;
            isActive: boolean;
            patchUpdates?: Array<{
              id: number;
              updateDate: string;
              contentHtml: string;
              contentText: string;
              isPoe1Format: boolean;
              scrapedAt: string;
            }>;
          }>;
        };
      }>(c.env.CACHE, cacheKey);

      if (cached) {
        // Return cached data directly
        return cached;
      }

      // Initialize database connection with D1
      const db = createDb(c.env.DB);

      // Build the query conditions
      const conditions = [eq(newsItems.isActive, true)];

      if (sourceType) {
        conditions.push(eq(newsItems.sourceType, sourceType));
      }

      // Fetch up to MAX_ITEMS items with their patch updates
      const items = await db.query.newsItems.findMany({
        where: and(...conditions),
        orderBy: [desc(newsItems.postedAt), desc(newsItems.id)],
        limit: MAX_ITEMS,
        with: {
          patchUpdates: {
            orderBy: [desc(patchNoteUpdates.updateDate)],
          },
        },
      });

      // Format the response (dates are already ISO strings in D1/SQLite)
      const formattedItems = items.map((item) => ({
        id: item.id,
        sourceId: item.sourceId,
        sourceType: item.sourceType,
        title: item.title,
        url: item.url,
        author: item.author,
        preview: item.preview,
        wordCount: item.wordCount,
        postedAt: item.postedAt || null,
        scrapedAt: item.scrapedAt,
        contentFetchedAt: item.contentFetchedAt || null,
        isActive: item.isActive,
        // Include patch updates if they exist (only for Content Update patches)
        patchUpdates: item.patchUpdates?.length > 0
          ? item.patchUpdates.map((update) => ({
              id: update.id,
              updateDate: update.updateDate,
              contentHtml: update.contentHtml,
              contentText: update.contentText,
              isPoe1Format: update.isPoe1Format,
              scrapedAt: update.scrapedAt,
            }))
          : undefined,
      }));

      const response = {
        success: true,
        data: {
          items: formattedItems,
        },
      };

      // Cache the response in KV
      await kvCache.put(c.env.CACHE, cacheKey, response);

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
