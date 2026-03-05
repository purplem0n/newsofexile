// API source types matching the backend schema
export type SourceType =
  | "poe1-news"
  | "poe1-patch"
  | "poe2-news"
  | "poe2-patch";

// Filter type includes "all" for UI filtering
export type NewsCategory = SourceType | "all";

// Patch note update matching API response structure
export interface PatchNoteUpdate {
  id: number;
  newsItemId?: number;
  updateDate: string; // Date string like "2026-03-01" or "8-12-2025"
  contentHtml: string;
  contentText: string;
  isPoe1Format: boolean;
  scrapedAt: string;
}

// Teaser update matching API response structure
export interface TeaserUpdate {
  id: number;
  newsItemId?: number;
  contentHash: string;
  wordCount: number;
  contentText: string;
  scrapedAt: string;
}

export type ContentTag =
  | "teaser"
  | "twitch-drops"
  | "launch"
  | "competition"
  | "sale"
  | "concept-art"
  | "interview"
  | "build-showcase"
  | "faq"
  | "patch-update"
  | "event"
  | "community"
  | "development"
  | "announcement"
  | "maintenance"
  | "content-update"
  | "rewards"
  | "soundtrack"
  | "recap"
  | "livestream"
  | "timeline"
  | "league-end"
  | "cosmetics"
  | "stash-tab-sale"
  | "hotfix"
  | "restart-fix"
  | "other";

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
  lastUpdatedAt: string; // ISO date string - used to surface updated items
  tags: ContentTag[]; // Content tags for filtering
  primaryTag: ContentTag; // Primary tag for filtering
  // Patch updates are included for Content Update patch notes
  patchUpdates?: PatchNoteUpdate[];
  // Teaser updates are included for Teaser posts
  teaserUpdates?: TeaserUpdate[];
}

// API response structure
export interface NewsApiResponse {
  success: boolean;
  data: {
    items: NewsItem[];
  };
}

export const categoryLabels: Record<NewsCategory, string> = {
  all: "All",
  "poe1-news": "PoE 1 News",
  "poe1-patch": "PoE 1 Patch",
  "poe2-news": "PoE 2 News",
  "poe2-patch": "PoE 2 Patch",
};

export const tagLabels: Record<ContentTag, string> = {
  teaser: "Teaser",
  "twitch-drops": "Twitch Drops",
  launch: "Launch",
  competition: "Competition",
  sale: "Sale",
  "concept-art": "Concept Art",
  interview: "Interview",
  "build-showcase": "Build Showcase",
  faq: "FAQ",
  "patch-update": "Patch Update",
  event: "Event",
  community: "Community",
  development: "Development",
  announcement: "Announcement",
  maintenance: "Maintenance",
  "content-update": "Content Update",
  rewards: "Rewards",
  soundtrack: "Soundtrack",
  recap: "Recap",
  livestream: "Livestream",
  timeline: "Timeline",
  "league-end": "League End",
  cosmetics: "Cosmetics",
  "stash-tab-sale": "Stash Tab Sale",
  hotfix: "Hotfix",
  "restart-fix": "Restart Fix",
  other: "Other",
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
