import { Num, OpenAPIRoute, Str } from "chanfana";
import { eq, and, desc, sql } from "drizzle-orm";
import { z } from "zod";
import { createDb, kvCache } from "../db";
import { newsItems, patchNoteUpdates, teaserUpdates, ContentTags } from "../db/schema";
import { type AppContext, SourceType } from "../types";

const MAX_ITEMS = 300;
const CACHE_KEY_PREFIX = "news:list";

/**
 * Generate a cache key based on source type and tag filters
 */
function generateCacheKey(sourceType: string | undefined, tag: string | undefined): string {
  const parts: string[] = [CACHE_KEY_PREFIX];
  if (sourceType) {
    parts.push(`source:${sourceType}`);
  }
  if (tag) {
    parts.push(`tag:${tag}`);
  }
  return parts.join(":");
}

export class NewsFetch extends OpenAPIRoute {
  schema = {
    tags: ["News"],
    summary: "List News Items",
    description: `Fetch up to ${MAX_ITEMS} recent news items. Optionally filter by source type or content tag. Includes patch note updates as sub-items for Content Update patches.`,
    request: {
      query: z.object({
        sourceType: SourceType.optional().describe(
          "Filter by source type (poe1-news, poe1-patch, poe2-news, poe2-patch)",
        ),
        tag: z.enum(ContentTags as unknown as [string, ...string[]]).optional().describe(
          "Filter by content tag (teaser, twitch-drops, merchandise, etc.)",
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
                    tags: z.array(z.string()),
                    primaryTag: z.string().nullable(),
                    postedAt: z.string().nullable(),
                    scrapedAt: z.string(),
                    contentFetchedAt: z.string().nullable(),
                    isActive: z.boolean(),
                    lastUpdatedAt: z.string(),
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
                    teaserUpdates: z.array(
                      z.object({
                        id: z.number(),
                        contentHash: z.string(),
                        wordCount: z.number(),
                        contentText: z.string(),
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
      const { sourceType, tag } = data.query;

      // Generate cache key based on filters
      const cacheKey = generateCacheKey(sourceType, tag);

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
            tags: string[];
            primaryTag: string | null;
            postedAt: string | null;
            scrapedAt: string;
            contentFetchedAt: string | null;
            isActive: boolean;
            lastUpdatedAt: string;
            patchUpdates?: Array<{
              id: number;
              updateDate: string;
              contentHtml: string;
              contentText: string;
              isPoe1Format: boolean;
              scrapedAt: string;
            }>;
            teaserUpdates?: Array<{
              id: number;
              contentHash: string;
              wordCount: number;
              contentText: string;
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

      // Filter by tag - check if tag is in the JSON array or matches primaryTag
      if (tag) {
        conditions.push(
          sql`${newsItems.tags} LIKE ${`%"${tag}"%`} OR ${newsItems.primaryTag} = ${tag}`
        );
      }

      // Fetch up to MAX_ITEMS items with their updates
      // Sort by lastUpdatedAt to surface newly updated items (teaser/patch updates)
      const items = await db.query.newsItems.findMany({
        where: and(...conditions),
        orderBy: [desc(newsItems.lastUpdatedAt), desc(newsItems.id)],
        limit: MAX_ITEMS,
        with: {
          patchUpdates: {
            orderBy: [desc(patchNoteUpdates.updateDate)],
          },
          teaserUpdates: {
            orderBy: [desc(teaserUpdates.scrapedAt)],
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
        // Parse tags from JSON string
        tags: item.tags ? JSON.parse(item.tags) as string[] : [],
        primaryTag: item.primaryTag || null,
        postedAt: item.postedAt || null,
        scrapedAt: item.scrapedAt,
        contentFetchedAt: item.contentFetchedAt || null,
        isActive: item.isActive,
        lastUpdatedAt: item.lastUpdatedAt || item.scrapedAt,
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
        // Include teaser updates if they exist
        teaserUpdates: item.teaserUpdates?.length > 0
          ? item.teaserUpdates.map((update) => ({
              id: update.id,
              contentHash: update.contentHash,
              wordCount: update.wordCount,
              contentText: update.contentText,
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
