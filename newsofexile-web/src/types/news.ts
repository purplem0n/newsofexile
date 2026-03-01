// API source types matching the backend schema
export type SourceType =
  | "poe1-news"
  | "poe1-patch"
  | "poe2-news"
  | "poe2-patch";

// Filter type includes "all" for UI filtering
export type NewsCategory = SourceType | "all";

// News item matching API response structure
export interface NewsItem {
  id: number;
  sourceId: string;
  sourceType: SourceType;
  title: string;
  url: string;
  author: string | null;
  preview: string | null;
  wordCount: number | null;
  postedAt: string | null; // ISO date string
  scrapedAt: string; // ISO date string
  contentFetchedAt: string | null;
  isActive: boolean;
}

// API response structure
export interface NewsApiResponse {
  success: boolean;
  data: {
    items: NewsItem[];
  };
}

// Patch note update matching API response structure
export interface PatchNoteUpdate {
  id: number;
  newsItemId: number;
  updateDate: string; // Date string like "2026-03-01" or "8-12-2025"
  contentHtml: string;
  contentText: string;
  isPoe1Format: boolean;
  scrapedAt: string;
}

// API response for patch updates
export interface PatchUpdatesApiResponse {
  success: boolean;
  data: {
    updates: PatchNoteUpdate[];
  };
}

export const categoryLabels: Record<NewsCategory, string> = {
  all: "All",
  "poe1-news": "PoE 1 News",
  "poe1-patch": "PoE 1 Patch",
  "poe2-news": "PoE 2 News",
  "poe2-patch": "PoE 2 Patch",
};

export const categoryBadgeColors: Record<
  SourceType,
  { bg: string; text: string }
> = {
  "poe1-news": { bg: "bg-blue-500/10", text: "text-blue-500" },
  "poe1-patch": { bg: "bg-emerald-500/10", text: "text-emerald-500" },
  "poe2-news": { bg: "bg-purple-500/10", text: "text-purple-500" },
  "poe2-patch": { bg: "bg-amber-500/10", text: "text-amber-500" },
};
