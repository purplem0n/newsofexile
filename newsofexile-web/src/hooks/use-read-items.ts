import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "news-of-exile-read-items";

type ItemId = string | number;

interface ReadItemsState {
  readIds: Set<string>;
  markAsRead: (id: ItemId) => void;
  markAllAsRead: (ids: ItemId[]) => void;
  isRead: (id: ItemId) => boolean;
  hasUnread: (allIds: ItemId[]) => boolean;
}

function toStringId(id: ItemId): string {
  return String(id);
}

export function useReadItems(): ReadItemsState {
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

  // Persist to localStorage whenever readIds changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...readIds]));
      } catch {
        // ignore
      }
    }
  }, [readIds]);

  const markAsRead = useCallback((id: ItemId) => {
    const strId = toStringId(id);
    setReadIds((prev) => {
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

  const isRead = useCallback(
    (id: ItemId) => {
      return readIds.has(toStringId(id));
    },
    [readIds]
  );

  const hasUnread = useCallback(
    (allIds: ItemId[]) => {
      return allIds.some((id) => !readIds.has(toStringId(id)));
    },
    [readIds]
  );

  return {
    readIds,
    markAsRead,
    markAllAsRead,
    isRead,
    hasUnread,
  };
}
