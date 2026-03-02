import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { NewsItem, SourceType, PatchNoteUpdate } from "@/types/news";
import { categoryLabels } from "@/types/news";
import { ExternalLink, ChevronDown, ChevronRight, FileText, X } from "lucide-react";
import { useCallback, useState } from "react";

interface NewsItemProps {
  item: NewsItem;
  isRead?: boolean;
  readPatchUpdateIds?: Set<string>;
  acknowledgedTeaserIds?: Set<string>; // Format: "newsItemId:teaserUpdateId"
  onItemClick?: (id: string) => void;
  onPatchUpdateClick?: (id: number) => void;
  onTeaserUpdateAcknowledge?: (newsItemId: number, teaserUpdateId: number) => void;
}

// Check if a news item is a Content Update patch note
function isContentUpdatePatch(item: NewsItem): boolean {
  return (
    item.sourceType.includes("patch") &&
    item.title.toLowerCase().includes("content update")
  );
}

const NEW_ITEM_THRESHOLD_HOURS = 24;
const UPDATED_ITEM_THRESHOLD_HOURS = 24;

function isNewItem(item: NewsItem): boolean {
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
function isRecentlyUpdated(
  item: NewsItem,
  isRead: boolean,
  acknowledgedTeaserIds: Set<string> | undefined
): boolean {
  const lastUpdated = new Date(item.lastUpdatedAt);
  const postedAt = item.postedAt ? new Date(item.postedAt) : null;
  const now = new Date();

  // Only consider "updated" if the lastUpdated is significantly different from postedAt
  // (more than 1 hour difference indicates an actual update vs initial creation)
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

// Check if item has any updates (patch or teaser)
function hasUpdates(item: NewsItem): boolean {
  const hasPatchUpdates = !!(item.patchUpdates && item.patchUpdates.length > 0);
  const hasTeaserUpdates = !!(item.teaserUpdates && item.teaserUpdates.length > 0);
  return hasPatchUpdates || hasTeaserUpdates;
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

// Modal to display patch update content
interface PatchUpdateModalProps {
  update: PatchNoteUpdate | null;
  isOpen: boolean;
  onClose: () => void;
  parentUrl: string;
  parentTitle: string;
}

function PatchUpdateModal({ update, isOpen, onClose, parentUrl, parentTitle }: PatchUpdateModalProps) {
  if (!isOpen || !update) return null;

  const formattedDate = update.isPoe1Format
    ? update.updateDate
    : update.updateDate;

  // Handle click on backdrop to close modal
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Prevent wheel events from propagating to the main page when modal is open
  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div
        className="relative w-full max-w-2xl max-h-[80vh] rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-950/50">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-zinc-400" />
              <h3 className="text-sm font-medium text-zinc-100">
                Update: {formattedDate}
              </h3>
            </div>
            <span className="text-xs text-zinc-500 pl-6 line-clamp-1">
              {parentTitle}
            </span>
          </div>
          <div className="flex items-center gap-2 pt-0.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-zinc-400 hover:text-zinc-100"
              onClick={() => window.open(parentUrl, "_blank", "noopener,noreferrer")}
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Full Patch Notes
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-zinc-400 hover:text-zinc-100"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div
          className="flex-1 overflow-auto p-4 overscroll-contain"
          onWheel={handleWheel}
        >
          <div
            className="text-sm text-zinc-300 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2 [&_ul]:space-y-1
              [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2 [&_ol]:space-y-1
              [&_li]:ml-4 [&_li]:pl-1
              [&_strong]:font-semibold [&_strong]:text-zinc-200
              [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-zinc-100 [&_h3]:mt-4 [&_h3]:mb-2
              [&_h4]:text-sm [&_h4]:font-semibold [&_h4]:text-zinc-100 [&_h4]:mt-3 [&_h4]:mb-1
              [&_p]:my-2 [&_br]:block [&_br]:content-[''] [&_br]:my-1"
            dangerouslySetInnerHTML={{ __html: update.contentHtml }}
          />
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-zinc-800 bg-zinc-950/50 flex justify-end">
          <Button
            variant="outline"
            size="sm"
            className="border-zinc-700 bg-zinc-800/50 hover:bg-zinc-800"
            onClick={onClose}
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

// Compact patch update item component with NEW badge (RED color)
interface PatchUpdateItemProps {
  update: PatchNoteUpdate;
  isRead?: boolean;
  onClick?: (id: number) => void;
  onOpenModal: (update: PatchNoteUpdate) => void;
}

function PatchUpdateItem({ update, isRead, onClick, onOpenModal }: PatchUpdateItemProps) {
  const formattedDate = update.isPoe1Format
    ? update.updateDate
    : update.updateDate;

  const handleClick = useCallback(() => {
    // Mark as read when clicked
    if (onClick && !isRead) {
      onClick(update.id);
    }
    // Open the modal to display the full content
    onOpenModal(update);
  }, [onClick, update, isRead, onOpenModal]);

  return (
    <div
      onClick={handleClick}
      className={`py-2 px-2 rounded bg-zinc-800/50 border border-zinc-700/50 cursor-pointer hover:bg-zinc-700/50 transition-colors ${
        !isRead ? "border-rose-500/30" : ""
      }`}
    >
      {/* Row 1: Header with icon, date, and NEW badge */}
      <div className="flex items-center gap-2 mb-1">
        <FileText className="h-3 w-3 text-zinc-400 shrink-0" />
        <span className="text-xs text-zinc-300">
          Update:{" "}
          <span className={`font-medium ${!isRead ? "text-rose-300" : "text-zinc-100"}`}>
            {formattedDate}
          </span>
        </span>
        {/* NEW badge for unread updates - RED color */}
        {!isRead && (
          <Badge
            variant="default"
            className="text-[9px] px-1 py-0 h-3 shrink-0 bg-rose-500 hover:bg-rose-500 text-white font-semibold"
          >
            NEW
          </Badge>
        )}
      </div>
      {/* Row 2: Content preview - full width */}
      <p className="text-xs text-zinc-400 leading-relaxed line-clamp-2 pl-5">
        {update.contentText.split(/\s+/).slice(0, 25).join(" ")}...
      </p>
    </div>
  );
}

export function NewsItemCard({
  item,
  isRead,
  readPatchUpdateIds,
  acknowledgedTeaserIds,
  onItemClick,
  onPatchUpdateClick,
  onTeaserUpdateAcknowledge,
}: NewsItemProps) {
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
  const isUpdated = isRecentlyUpdated(item, isRead ?? false, acknowledgedTeaserIds);
  const isContentUpdate = isContentUpdatePatch(item);
  const itemHasUpdates = hasUpdates(item);

  // Use updates from the item (included in main API response)
  const patchUpdates = item.patchUpdates ?? [];
  const [showPatchUpdates, setShowPatchUpdates] = useState(true); // Expanded by default

  // State for modal
  const [selectedUpdate, setSelectedUpdate] = useState<PatchNoteUpdate | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Check if there are any unread patch updates
  const hasUnreadPatchUpdates = patchUpdates.some(
    (update) => !readPatchUpdateIds?.has(String(update.id))
  );

  const handleClick = useCallback(() => {
    // Mark as read when clicking a new item
    if (onItemClick && isNew) {
      onItemClick(String(item.id));
    }
    // Acknowledge all teaser updates when clicking an updated teaser item
    if (onTeaserUpdateAcknowledge && isUpdated && item.teaserUpdates) {
      item.teaserUpdates.forEach((update) => {
        onTeaserUpdateAcknowledge(item.id, update.id);
      });
    }
  }, [onItemClick, onTeaserUpdateAcknowledge, item.id, item.teaserUpdates, isNew, isUpdated]);

  const handleOpenModal = useCallback((update: PatchNoteUpdate) => {
    setSelectedUpdate(update);
    setIsModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setSelectedUpdate(null);
  }, []);

  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-900/60 hover:border-zinc-700 hover:bg-zinc-800/60 transition-all duration-200 overflow-hidden">
      {/* Main card content */}
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block p-3"
        onClick={handleClick}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Row 1: Category + NEW/UPDATED Badge + Date */}
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
              {/* Show UPDATED badge for items with recent teaser/patch updates */}
              {isUpdated && itemHasUpdates && (
                <Badge
                  variant="default"
                  className="text-[10px] px-1.5 py-0 h-4 shrink-0 bg-amber-500 hover:bg-amber-500 text-white font-semibold"
                >
                  UPDATED
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
            <h3 className="font-medium text-base text-zinc-100 hover:text-zinc-300 transition-colors line-clamp-2">
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
          <ExternalLink className="h-4 w-4 text-zinc-400 hover:text-zinc-300 shrink-0 transition-colors" />
        </div>
      </a>

      {/* Patch Updates Section - Only shown when there are updates */}
      {isContentUpdate && patchUpdates.length > 0 && (
        <div className="px-3 pb-3 pt-1 border-t border-zinc-800/50">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowPatchUpdates(!showPatchUpdates);
            }}
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-300 transition-colors"
          >
            {showPatchUpdates ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
            <span>
              {patchUpdates.length} update{patchUpdates.length > 1 ? "s" : ""}
            </span>
            {/* Show NEW indicator for unread updates - RED color */}
            {hasUnreadPatchUpdates && (
              <Badge
                variant="default"
                className="text-[9px] px-1 py-0 h-3 shrink-0 bg-rose-500 hover:bg-rose-500 text-white font-semibold"
              >
                NEW
              </Badge>
            )}
          </button>

          {/* Collapsible updates section - expanded by default */}
          {showPatchUpdates && (
            <div className="mt-2 space-y-1.5">
              {patchUpdates.map((update) => (
                <PatchUpdateItem
                  key={update.id}
                  update={update}
                  isRead={readPatchUpdateIds?.has(String(update.id))}
                  onClick={onPatchUpdateClick}
                  onOpenModal={handleOpenModal}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal for displaying patch update content */}
      <PatchUpdateModal
        update={selectedUpdate}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        parentUrl={item.url}
        parentTitle={item.title}
      />
    </div>
  );
}
