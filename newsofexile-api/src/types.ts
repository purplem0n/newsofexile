import { DateTime, Str } from "chanfana";
import type { Context } from "hono";
import { z } from "zod";

export type AppContext = Context<{ Bindings: Env }>;

export const Task = z.object({
  name: Str({ example: "lorem" }),
  slug: Str(),
  description: Str({ required: false }),
  completed: z.boolean().default(false),
  due_date: DateTime(),
});

// News item types based on the schema
export const SourceType = z.enum([
  "poe1-news",
  "poe1-patch",
  "poe2-news",
  "poe2-patch",
]);

export const NewsItemInput = z.object({
  sourceId: Str(),
  sourceType: SourceType,
  title: Str(),
  url: Str(),
  author: Str({ required: false }),
  preview: Str({ required: false }),
  wordCount: z.number().optional(),
  postedAt: DateTime({ required: false }),
});

export const NewsItemResponse = NewsItemInput.extend({
  id: z.number(),
  scrapedAt: DateTime(),
  contentFetchedAt: DateTime({ required: false }),
  isActive: z.boolean(),
});
