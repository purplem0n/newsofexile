import type { NewsItem } from "@/types/news";

const NEW_ITEM_THRESHOLD_HOURS = 24;
const UPDATED_ITEM_THRESHOLD_HOURS = 24;

export function isNewItem(item: NewsItem): boolean {
  if (!item.postedAt) return false;
  const postedDate = new Date(item.postedAt);
  const now = new Date();
  const diffMs = now.getTime() - postedDate.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  return diffHours <= NEW_ITEM_THRESHOLD_HOURS;
}

// Check if an item has been recently updated (teaser or patch update)
// For teasers, we check if there are unacknowledged teaser update IDs
// For patch notes, we check if the item itself is unread
export function isRecentlyUpdated(
  item: NewsItem,
  isRead: boolean,
  acknowledgedTeaserIds: Set<string> | undefined
): boolean {
  const lastUpdated = new Date(item.lastUpdatedAt);
  const postedAt = item.postedAt ? new Date(item.postedAt) : null;
  const now = new Date();

  if (postedAt) {
    const updateDiff = Math.abs(lastUpdated.getTime() - postedAt.getTime());

    // If lastUpdated is within 1 hour of postedAt, it's likely a new item, not an update
    if (updateDiff < 60 * 60 * 1000) return false;

    // Check if the update is recent (within threshold)
    const timeSinceUpdate = now.getTime() - lastUpdated.getTime();
    const isRecent = timeSinceUpdate <= UPDATED_ITEM_THRESHOLD_HOURS * 60 * 60 * 1000;
    if (!isRecent) return false;

    // For teaser posts, check if there are unacknowledged teaser update IDs
    if (item.teaserUpdates && item.teaserUpdates.length > 0) {
      const unacknowledged = item.teaserUpdates.some(
        (update) => !acknowledgedTeaserIds?.has(`${item.id}:${update.id}`)
      );
      return unacknowledged;
    }

    // For patch note updates, check if the item itself is unread
    if (item.patchUpdates && item.patchUpdates.length > 0) {
      return !isRead;
    }

    return false;
  }

  return false;
}

