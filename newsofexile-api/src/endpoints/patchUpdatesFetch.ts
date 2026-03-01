import { Num, OpenAPIRoute } from "chanfana";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import { createDb, kvCache } from "../db";
import { patchNoteUpdates } from "../db/schema";
import { type AppContext } from "../types";

const CACHE_KEY_PREFIX = "patch-updates";
const CACHE_TTL_SECONDS = 300; // 5 minutes

/**
 * Generate a cache key for patch updates of a specific news item
 */
function generateCacheKey(newsItemId: number): string {
  return `${CACHE_KEY_PREFIX}:by-news-item:${newsItemId}`;
}

export class PatchUpdatesFetch extends OpenAPIRoute {
  schema = {
    tags: ["Patch Updates"],
    summary: "List Patch Note Updates",
    description: "Fetch patch note updates for a specific Content Update news item",
    request: {
      params: z.object({
        newsItemId: Num({ description: "News item ID to fetch updates for" }),
      }),
    },
    responses: {
      "200": {
        description: "Returns a list of patch note updates",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              data: z.object({
                updates: z.array(
                  z.object({
                    id: z.number(),
                    newsItemId: z.number(),
                    updateDate: z.string(),
                    contentHtml: z.string(),
                    contentText: z.string(),
                    isPoe1Format: z.boolean(),
                    scrapedAt: z.string(),
                  }),
                ),
              }),
            }),
          },
        },
      },
      "404": {
        description: "News item not found or has no updates",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              error: z.string(),
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
      const { newsItemId } = data.params;

      // Generate cache key
      const cacheKey = generateCacheKey(newsItemId);

      // Try to get cached response from KV
      const cached = await kvCache.get<{
        success: boolean;
        data: {
          updates: Array<{
            id: number;
            newsItemId: number;
            updateDate: string;
            contentHtml: string;
            contentText: string;
            isPoe1Format: boolean;
            scrapedAt: string;
          }>;
        };
      }>(c.env.CACHE, cacheKey);

      if (cached) {
        return cached;
      }

      // Initialize database connection with D1
      const db = createDb(c.env.DB);

      // Fetch updates for this news item
      const updates = await db.query.patchNoteUpdates.findMany({
        where: eq(patchNoteUpdates.newsItemId, newsItemId),
        orderBy: [desc(patchNoteUpdates.updateDate)],
      });

      const response = {
        success: true,
        data: {
          updates: updates.map((update) => ({
            id: update.id,
            newsItemId: update.newsItemId,
            updateDate: update.updateDate,
            contentHtml: update.contentHtml,
            contentText: update.contentText,
            isPoe1Format: update.isPoe1Format,
            scrapedAt: update.scrapedAt,
          })),
        },
      };

      // Cache the response in KV with TTL
      await c.env.CACHE.put(cacheKey, JSON.stringify(response), {
        expirationTtl: CACHE_TTL_SECONDS,
      });

      return response;
    } catch (error) {
      console.error("[PatchUpdatesFetch] Error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}
