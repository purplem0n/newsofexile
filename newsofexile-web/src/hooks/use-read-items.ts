import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "news-of-exile-read-items";
const PATCH_UPDATES_STORAGE_KEY = "news-of-exile-read-patch-updates";
// Store acknowledged teaser update IDs: "newsItemId:teaserUpdateId"
const TEASER_UPDATES_STORAGE_KEY = "news-of-exile-teaser-updates";

type ItemId = string | number;

interface ReadItemsState {
  readIds: Set<string>;
  readPatchUpdateIds: Set<string>;
  acknowledgedTeaserIds: Set<string>; // Format: "newsItemId:teaserUpdateId"
  markAsRead: (id: ItemId) => void;
  markPatchUpdateAsRead: (id: ItemId) => void;
  acknowledgeTeaserUpdate: (newsItemId: ItemId, teaserUpdateId: ItemId) => void;
  markAllAsRead: (ids: ItemId[]) => void;
  markAllPatchUpdatesAsRead: (ids: ItemId[]) => void;
  acknowledgeAllTeaserUpdates: (ids: string[]) => void;
  isRead: (id: ItemId) => boolean;
  isPatchUpdateRead: (id: ItemId) => boolean;
  isTeaserUpdateAcknowledged: (newsItemId: ItemId, teaserUpdateId: ItemId) => boolean;
  hasUnread: (allIds: ItemId[]) => boolean;
  hasUnreadPatchUpdates: (allIds: ItemId[]) => boolean;
  hasUnacknowledgedTeaserUpdates: (newsItemId: ItemId, teaserUpdateIds: ItemId[]) => boolean;
}

function toStringId(id: ItemId): string {
  return String(id);
}

export function useReadItems(): ReadItemsState {
  // News items read state
  const [readIds, setReadIds] = useState<Set<string>>(() => {
    if (typeof window === "undefined") {
      return new Set();
    }
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return new Set(parsed);
      }
    } catch {
      // ignore
    }
    return new Set();
  });

  // Patch updates read state
  const [readPatchUpdateIds, setReadPatchUpdateIds] = useState<Set<string>>(() => {
    if (typeof window === "undefined") {
      return new Set();
    }
    try {
      const stored = localStorage.getItem(PATCH_UPDATES_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return new Set(parsed);
      }
    } catch {
      // ignore
    }
    return new Set();
  });

  // Teaser updates acknowledged by ID: "newsItemId:teaserUpdateId"
  const [acknowledgedTeaserIds, setAcknowledgedTeaserIds] = useState<Set<string>>(() => {
    if (typeof window === "undefined") {
      return new Set();
    }
    try {
      const stored = localStorage.getItem(TEASER_UPDATES_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return new Set(parsed);
      }
    } catch {
      // ignore
    }
    return new Set();
  });

  // Persist news items to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...readIds]));
      } catch {
        // ignore
      }
    }
  }, [readIds]);

  // Persist patch updates to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(PATCH_UPDATES_STORAGE_KEY, JSON.stringify([...readPatchUpdateIds]));
      } catch {
        // ignore
      }
    }
  }, [readPatchUpdateIds]);

  // Persist acknowledged teaser IDs to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(TEASER_UPDATES_STORAGE_KEY, JSON.stringify([...acknowledgedTeaserIds]));
      } catch {
        // ignore
      }
    }
  }, [acknowledgedTeaserIds]);

  const markAsRead = useCallback((id: ItemId) => {
    const strId = toStringId(id);
    setReadIds((prev) => {
      if (prev.has(strId)) return prev;
      const next = new Set(prev);
      next.add(strId);
      return next;
    });
  }, []);

  const markPatchUpdateAsRead = useCallback((id: ItemId) => {
    const strId = toStringId(id);
    setReadPatchUpdateIds((prev) => {
      if (prev.has(strId)) return prev;
      const next = new Set(prev);
      next.add(strId);
      return next;
    });
  }, []);

  // Acknowledge a specific teaser update by its ID
  const acknowledgeTeaserUpdate = useCallback((newsItemId: ItemId, teaserUpdateId: ItemId) => {
    const key = `${toStringId(newsItemId)}:${toStringId(teaserUpdateId)}`;
    setAcknowledgedTeaserIds((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  }, []);

  const markAllAsRead = useCallback((ids: ItemId[]) => {
    setReadIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(toStringId(id)));
      return next;
    });
  }, []);

  const markAllPatchUpdatesAsRead = useCallback((ids: ItemId[]) => {
    setReadPatchUpdateIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(toStringId(id)));
      return next;
    });
  }, []);

  // Acknowledge multiple teaser update IDs at once
  const acknowledgeAllTeaserUpdates = useCallback((ids: string[]) => {
    setAcknowledgedTeaserIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
  }, []);

  const isRead = useCallback(
    (id: ItemId) => {
      return readIds.has(toStringId(id));
    },
    [readIds]
  );

  const isPatchUpdateRead = useCallback(
    (id: ItemId) => {
      return readPatchUpdateIds.has(toStringId(id));
    },
    [readPatchUpdateIds]
  );

  // Check if a specific teaser update has been acknowledged
  const isTeaserUpdateAcknowledged = useCallback(
    (newsItemId: ItemId, teaserUpdateId: ItemId) => {
      const key = `${toStringId(newsItemId)}:${toStringId(teaserUpdateId)}`;
      return acknowledgedTeaserIds.has(key);
    },
    [acknowledgedTeaserIds]
  );

  const hasUnread = useCallback(
    (allIds: ItemId[]) => {
      return allIds.some((id) => !readIds.has(toStringId(id)));
    },
    [readIds]
  );

  const hasUnreadPatchUpdates = useCallback(
    (allIds: ItemId[]) => {
      return allIds.some((id) => !readPatchUpdateIds.has(toStringId(id)));
    },
    [readPatchUpdateIds]
  );

  // Check if there are any unacknowledged teaser updates for a news item
  const hasUnacknowledgedTeaserUpdates = useCallback(
    (newsItemId: ItemId, teaserUpdateIds: ItemId[]) => {
      return teaserUpdateIds.some(
        (id) => !isTeaserUpdateAcknowledged(newsItemId, id)
      );
    },
    [isTeaserUpdateAcknowledged]
  );

  return {
    readIds,
    readPatchUpdateIds,
    acknowledgedTeaserIds,
    markAsRead,
    markPatchUpdateAsRead,
    acknowledgeTeaserUpdate,
    markAllAsRead,
    markAllPatchUpdatesAsRead,
    acknowledgeAllTeaserUpdates,
    isRead,
    isPatchUpdateRead,
    isTeaserUpdateAcknowledged,
    hasUnread,
    hasUnreadPatchUpdates,
    hasUnacknowledgedTeaserUpdates,
  };
}
