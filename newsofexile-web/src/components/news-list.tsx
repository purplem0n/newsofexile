import { NewsItemCard } from "@/components/news-item";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { NewsItem } from "@/types/news";
import { Loader2, AlertCircle } from "lucide-react";

interface NewsListProps {
  items: NewsItem[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  readIds?: Set<string>;
  readPatchUpdateIds?: Set<string>;
  acknowledgedTeaserIds?: Set<string>;
  onItemClick?: (id: string) => void;
  onPatchUpdateClick?: (id: number) => void;
  onTeaserUpdateAcknowledge?: (newsItemId: number, teaserUpdateId: number) => void;
}

export function NewsList({
  items,
  loading,
  error,
  onRetry,
  readIds,
  readPatchUpdateIds,
  acknowledgedTeaserIds,
  onItemClick,
  onPatchUpdateClick,
  onTeaserUpdateAcknowledge,
}: NewsListProps) {
  if (error && items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <AlertCircle className="h-10 w-10 text-rose-500" />
        <p className="text-sm text-zinc-300">{error}</p>
        <Button
          onClick={onRetry}
          variant="outline"
          size="sm"
          className="border-zinc-700 bg-zinc-800/50 hover:bg-zinc-800"
        >
          Retry
        </Button>
      </div>
    );
  }

  if (items.length === 0 && !loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-zinc-300">No news items found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <NewsItemCard
          key={item.id}
          item={item}
          isRead={readIds?.has(String(item.id))}
          readPatchUpdateIds={readPatchUpdateIds}
          acknowledgedTeaserIds={acknowledgedTeaserIds}
          onItemClick={onItemClick}
          onPatchUpdateClick={onPatchUpdateClick}
          onTeaserUpdateAcknowledge={onTeaserUpdateAcknowledge}
        />
      ))}

      {loading && (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
        </div>
      )}
    </div>
  );
}

export function NewsListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="p-3 rounded-md border border-zinc-800 bg-zinc-900/40"
        >
          <div className="flex items-center gap-2 mb-2">
            <Skeleton className="h-4 w-20 bg-zinc-800" />
            <Skeleton className="h-3 w-12 bg-zinc-800" />
          </div>
          <Skeleton className="h-4 w-full bg-zinc-800 mb-1" />
          <Skeleton className="h-4 w-3/4 bg-zinc-800" />
        </div>
      ))}
    </div>
  );
}
