import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "news-of-exile-read-items";
const PATCH_UPDATES_STORAGE_KEY = "news-of-exile-read-patch-updates";
const TEASER_UPDATES_STORAGE_KEY = "news-of-exile-read-teaser-updates";

type ItemId = string | number;

interface ReadItemsState {
  readIds: Set<string>;
  readPatchUpdateIds: Set<string>;
  readTeaserUpdateIds: Set<string>;
  markAsRead: (id: ItemId) => void;
  markPatchUpdateAsRead: (id: ItemId) => void;
  markTeaserUpdateAsRead: (id: ItemId) => void;
  markAllAsRead: (ids: ItemId[]) => void;
  markAllPatchUpdatesAsRead: (ids: ItemId[]) => void;
  markAllTeaserUpdatesAsRead: (ids: ItemId[]) => void;
  isRead: (id: ItemId) => boolean;
  isPatchUpdateRead: (id: ItemId) => boolean;
  isTeaserUpdateRead: (id: ItemId) => boolean;
  hasUnread: (allIds: ItemId[]) => boolean;
  hasUnreadPatchUpdates: (allIds: ItemId[]) => boolean;
  hasUnreadTeaserUpdates: (allIds: ItemId[]) => boolean;
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

  // Teaser updates read state
  const [readTeaserUpdateIds, setReadTeaserUpdateIds] = useState<Set<string>>(() => {
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

  // Persist teaser updates to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(TEASER_UPDATES_STORAGE_KEY, JSON.stringify([...readTeaserUpdateIds]));
      } catch {
        // ignore
      }
    }
  }, [readTeaserUpdateIds]);

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

  const markTeaserUpdateAsRead = useCallback((id: ItemId) => {
    const strId = toStringId(id);
    setReadTeaserUpdateIds((prev) => {
      if (prev.has(strId)) return prev;
      const next = new Set(prev);
      next.add(strId);
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

  const markAllTeaserUpdatesAsRead = useCallback((ids: ItemId[]) => {
    setReadTeaserUpdateIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(toStringId(id)));
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

  const isTeaserUpdateRead = useCallback(
    (id: ItemId) => {
      return readTeaserUpdateIds.has(toStringId(id));
    },
    [readTeaserUpdateIds]
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

  const hasUnreadTeaserUpdates = useCallback(
    (allIds: ItemId[]) => {
      return allIds.some((id) => !readTeaserUpdateIds.has(toStringId(id)));
    },
    [readTeaserUpdateIds]
  );

  return {
    readIds,
    readPatchUpdateIds,
    readTeaserUpdateIds,
    markAsRead,
    markPatchUpdateAsRead,
    markTeaserUpdateAsRead,
    markAllAsRead,
    markAllPatchUpdatesAsRead,
    markAllTeaserUpdatesAsRead,
    isRead,
    isPatchUpdateRead,
    isTeaserUpdateRead,
    hasUnread,
    hasUnreadPatchUpdates,
    hasUnreadTeaserUpdates,
  };
}
