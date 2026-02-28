import { Badge } from "@/components/ui/badge";
import type { NewsItem, SourceType } from "@/types/news";
import { categoryLabels } from "@/types/news";
import { ExternalLink } from "lucide-react";
import { useCallback } from "react";

interface NewsItemProps {
  item: NewsItem;
  isRead?: boolean;
  onItemClick?: (id: string) => void;
}

const NEW_ITEM_THRESHOLD_HOURS = 24;

function isNewItem(item: NewsItem): boolean {
  if (!item.postedAt) return false;
  const postedDate = new Date(item.postedAt);
  const now = new Date();
  const diffMs = now.getTime() - postedDate.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  return diffHours <= NEW_ITEM_THRESHOLD_HOURS;
}

function getCategoryBadgeColors(sourceType: SourceType) {
  switch (sourceType) {
    case "poe1-news":
      return "bg-blue-500/10 border-blue-500/20 text-blue-300";
    case "poe1-patch":
      return "bg-emerald-500/10 border-emerald-500/20 text-emerald-300";
    case "poe2-news":
      return "bg-purple-500/10 border-purple-500/20 text-purple-300";
    case "poe2-patch":
      return "bg-amber-500/10 border-amber-500/20 text-amber-300";
  }
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 365) {
    const years = Math.floor(diffDays / 365);
    return `${years}y ago`;
  }
  if (diffDays > 30) {
    const months = Math.floor(diffDays / 30);
    return `${months}mo ago`;
  }
  if (diffDays > 0) {
    return `${diffDays}d ago`;
  }
  if (diffHours > 0) {
    return `${diffHours}h ago`;
  }
  if (diffMinutes > 0) {
    return `${diffMinutes}m ago`;
  }
  return "just now";
}

export function NewsItemCard({ item, isRead, onItemClick }: NewsItemProps) {
  const formattedDateTime = item.postedAt
    ? new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(new Date(item.postedAt))
    : null;

  const relativeTime = item.postedAt
    ? formatRelativeTime(new Date(item.postedAt))
    : null;

  const isNew = isNewItem(item) && !isRead;

  const handleClick = useCallback(() => {
    if (onItemClick && isNew) {
      onItemClick(String(item.id));
    }
  }, [onItemClick, item.id, isNew]);

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block"
      onClick={handleClick}
    >
      <div className="flex items-start justify-between gap-3 p-3 rounded-md border border-zinc-800 bg-zinc-900/60 hover:border-zinc-700 hover:bg-zinc-800/60 transition-all duration-200">
        <div className="flex-1 min-w-0">
          {/* Row 1: Category + NEW Badge + Date */}
          <div className="flex items-center gap-2 mb-1.5">
            <Badge
              variant="outline"
              className={`text-[10px] px-1.5 py-0 h-4 shrink-0 ${getCategoryBadgeColors(item.sourceType)}`}
            >
              {categoryLabels[item.sourceType]}
            </Badge>
            {isNew && (
              <Badge
                variant="default"
                className="text-[10px] px-1.5 py-0 h-4 shrink-0 bg-rose-500 hover:bg-rose-500 text-white font-semibold"
              >
                NEW
              </Badge>
            )}
            {formattedDateTime && (
              <span className="text-xs text-zinc-400">
                {formattedDateTime}
                {relativeTime && (
                  <span className="text-zinc-500"> · {relativeTime}</span>
                )}
              </span>
            )}
          </div>

          {/* Title */}
          <h3 className="font-medium text-base text-zinc-100 group-hover:text-zinc-300 transition-colors line-clamp-2">
            {item.title}
          </h3>

          {/* Preview + Word Count */}
          {item.preview && (
            <p className="text-xs text-zinc-300 mt-1.5">
              {item.preview}
              {typeof item.wordCount === "number" && item.wordCount > 0 && (
                <span className="text-zinc-400"> · {item.wordCount} words</span>
              )}
            </p>
          )}
        </div>

        {/* External Link Icon */}
        <ExternalLink className="h-4 w-4 text-zinc-400 group-hover:text-zinc-300 shrink-0 transition-colors" />
      </div>
    </a>
  );
}
