import { useState, useEffect, useCallback, useRef } from "react";
import { fetchNews, type FetchNewsParams } from "@/lib/api";
import type { NewsItem, SourceType } from "@/types/news";

interface UseNewsResult {
  items: NewsItem[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useNews(sourceType?: SourceType): UseNewsResult {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);
  const lastSourceTypeRef = useRef<SourceType | undefined>(sourceType);

  const fetchData = useCallback(
    async (params: FetchNewsParams) => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetchNews(params);

        if (response.success) {
          setItems(response.data.items);
        } else {
          setError("Failed to fetch news");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Initial fetch and when sourceType changes
  useEffect(() => {
    // Skip if already fetched with same sourceType (React StrictMode double mount)
    const sourceChanged = lastSourceTypeRef.current !== sourceType;

    if (fetchedRef.current && !sourceChanged) {
      return;
    }

    fetchedRef.current = true;
    lastSourceTypeRef.current = sourceType;

    fetchData({ sourceType });
  }, [sourceType, fetchData]);

  const refresh = useCallback(() => {
    fetchData({ sourceType });
  }, [sourceType, fetchData]);

  return {
    items,
    loading,
    error,
    refresh,
  };
}
