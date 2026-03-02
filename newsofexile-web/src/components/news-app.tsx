import { useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { NewsFilter } from "@/components/news-filter";
import { NewsList, NewsListSkeleton } from "@/components/news-list";
import { useNews } from "@/hooks/use-news";
import { useReadItems } from "@/hooks/use-read-items";
import type { NewsCategory, SourceType } from "@/types/news";

const validFilters: NewsCategory[] = [
  "all",
  "poe1-news",
  "poe1-patch",
  "poe2-news",
  "poe2-patch",
];

export function NewsApp() {
  const { filter: urlFilter } = useParams<{ filter?: string }>();
  const navigate = useNavigate();

  // Validate and normalize the filter from URL
  const filter: NewsCategory = useMemo(() => {
    if (urlFilter && validFilters.includes(urlFilter as NewsCategory)) {
      return urlFilter as NewsCategory;
    }
    return "all";
  }, [urlFilter]);

  const sourceType: SourceType | undefined =
    filter === "all" ? undefined : filter;

  const { items, loading, error, refresh } = useNews(sourceType);

  const {
    readIds,
    readPatchUpdateIds,
    acknowledgedTeaserIds,
    markAsRead,
    markPatchUpdateAsRead,
    acknowledgeTeaserUpdate,
    acknowledgeAllTeaserUpdates,
    markAllAsRead,
    markAllPatchUpdatesAsRead,
    hasUnread,
    hasUnreadPatchUpdates,
    hasUnacknowledgedTeaserUpdates,
  } = useReadItems();

  // Extract all patch update IDs from items for "Mark all as read" functionality
  const allPatchUpdateIds = useMemo(() => {
    const updateIds: number[] = [];
    for (const item of items) {
      if (item.patchUpdates && item.patchUpdates.length > 0) {
        for (const update of item.patchUpdates) {
          updateIds.push(update.id);
        }
      }
    }
    return updateIds;
  }, [items]);

  // Extract all teaser update IDs for "Mark all as read" functionality
  const allTeaserIds = useMemo(() => {
    const ids: string[] = [];
    for (const item of items) {
      if (item.teaserUpdates && item.teaserUpdates.length > 0) {
        for (const update of item.teaserUpdates) {
          ids.push(`${item.id}:${update.id}`);
        }
      }
    }
    return ids;
  }, [items]);

  // Check if there are any unread items (main news items, patch updates, or unacknowledged teasers)
  const hasAnyUnread = useMemo(() => {
    const ids = items.map((item) => item.id as string | number);
    const hasUnreadMainItems = hasUnread(ids);
    const hasUnreadPatches = hasUnreadPatchUpdates(allPatchUpdateIds);
    // Check for unacknowledged teaser updates
    const hasUnreadTeasers = items.some(
      (item) =>
        item.teaserUpdates &&
        item.teaserUpdates.length > 0 &&
        hasUnacknowledgedTeaserUpdates(
          item.id,
          item.teaserUpdates.map((u) => u.id)
        )
    );
    return hasUnreadMainItems || hasUnreadPatches || hasUnreadTeasers;
  }, [items, hasUnread, hasUnreadPatchUpdates, hasUnacknowledgedTeaserUpdates, allPatchUpdateIds]);

  // Handle marking all items as read (including patch updates and teaser IDs)
  const handleMarkAllRead = useCallback(() => {
    const ids = items.map((item) => item.id as string | number);
    markAllAsRead(ids);
    // Also mark all patch updates as read
    markAllPatchUpdatesAsRead(allPatchUpdateIds);
    // Also acknowledge all teaser updates
    acknowledgeAllTeaserUpdates(allTeaserIds);
  }, [items, markAllAsRead, markAllPatchUpdatesAsRead, acknowledgeAllTeaserUpdates, allPatchUpdateIds, allTeaserIds]);

  // Handle filter change - update URL
  const handleFilterChange = useCallback((newFilter: NewsCategory) => {
    if (newFilter === "all") {
      navigate("/", { replace: true });
    } else {
      navigate(`/${newFilter}`, { replace: true });
    }
  }, [navigate]);

  return (
    <div className="min-h-screen bg-zinc-950">
      <NewsFilter
        value={filter}
        onChange={handleFilterChange}
        onMarkAllRead={handleMarkAllRead}
        hasUnread={hasAnyUnread}
      />

      <main className="max-w-3xl mx-auto px-4 py-4">
        {loading && items.length === 0 ? (
          <NewsListSkeleton />
        ) : (
          <NewsList
            items={items}
            loading={loading}
            error={error}
            onRetry={refresh}
            readIds={readIds}
            readPatchUpdateIds={readPatchUpdateIds}
            acknowledgedTeaserIds={acknowledgedTeaserIds}
            onItemClick={markAsRead}
            onPatchUpdateClick={markPatchUpdateAsRead}
            onTeaserUpdateAcknowledge={acknowledgeTeaserUpdate}
          />
        )}

        <footer className="mt-6 text-center text-[10px] text-zinc-400 space-y-1">
          <p>News of Exile - Path of Exile News Aggregator</p>
          <p>Not affiliated with Grinding Gear Games.</p>
        </footer>
      </main>
    </div>
  );
}
