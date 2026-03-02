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
    markAsRead,
    markPatchUpdateAsRead,
    markAllAsRead,
    markAllPatchUpdatesAsRead,
    hasUnread,
    hasUnreadPatchUpdates,
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

  // Check if there are any unread items (main news items or patch updates)
  const hasAnyUnread = useMemo(() => {
    const ids = items.map((item) => item.id as string | number);
    const hasUnreadMainItems = hasUnread(ids);
    const hasUnreadPatches = hasUnreadPatchUpdates(allPatchUpdateIds);
    return hasUnreadMainItems || hasUnreadPatches;
  }, [items, hasUnread, hasUnreadPatchUpdates, allPatchUpdateIds]);

  // Handle marking all items as read (including patch updates)
  const handleMarkAllRead = useCallback(() => {
    const ids = items.map((item) => item.id as string | number);
    markAllAsRead(ids);
    // Also mark all patch updates as read
    markAllPatchUpdatesAsRead(allPatchUpdateIds);
  }, [items, markAllAsRead, markAllPatchUpdatesAsRead, allPatchUpdateIds]);

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
            onItemClick={markAsRead}
            onPatchUpdateClick={markPatchUpdateAsRead}
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
