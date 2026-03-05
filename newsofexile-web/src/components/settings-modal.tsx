import { X, Tag, Eye, EyeOff, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/contexts/settings-context";
import { tagLabels, type ContentTag } from "@/types/news";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { hiddenTags, toggleTagVisibility, showTagsInItems, toggleShowTagsInItems, selectAllTags, unselectAllTags, setDefaultsTags } = useSettings();

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

  if (!isOpen) return null;

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
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-950/50">
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-zinc-400" />
            <h2 className="text-sm font-medium text-zinc-100">Settings</h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-zinc-400 hover:text-zinc-100"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div
          className="flex-1 overflow-auto p-4 overscroll-contain"
          onWheel={handleWheel}
        >
          <div className="space-y-6">
            {/* Show Tags in Items */}
            <div className="space-y-3">
              <h3 className="text-xs font-medium text-zinc-300 uppercase tracking-wider">
                Display Options
              </h3>
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-zinc-400" />
                  <span className="text-sm text-zinc-100">Show tags in news items</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleShowTagsInItems}
                  className="h-8 w-8 p-0 text-zinc-400 hover:text-zinc-100"
                >
                  {showTagsInItems ? (
                    <Eye className="h-4 w-4" />
                  ) : (
                    <EyeOff className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Tag Filters */}
            <div className="space-y-3">
              <h3 className="text-xs font-medium text-zinc-300 uppercase tracking-wider">
                Tag Filters
              </h3>
              <p className="text-xs text-zinc-400">
                Hide news items with specific tags. Unchecked tags will be hidden.
              </p>
              <div className="flex gap-2 mb-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={selectAllTags}
                  className="border-zinc-700 bg-zinc-800/50 hover:bg-zinc-800 text-xs"
                >
                  Select All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={unselectAllTags}
                  className="border-zinc-700 bg-zinc-800/50 hover:bg-zinc-800 text-xs"
                >
                  Unselect All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={setDefaultsTags}
                  className="border-zinc-700 bg-zinc-800/50 hover:bg-zinc-800 text-xs"
                  title="Reset to default tag selection (hide less important tags)"
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Set Defaults
                </Button>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {Object.entries(tagLabels).map(([tag, label]) => {
                  const isHidden = hiddenTags.has(tag as ContentTag);
                  return (
                    <div
                      key={tag}
                      className="flex items-center gap-2 p-2 rounded border border-zinc-800 bg-zinc-800/30 hover:bg-zinc-800/50 transition-colors"
                    >
                      <input
                        type="checkbox"
                        id={`tag-${tag}`}
                        checked={!isHidden}
                        onChange={() => toggleTagVisibility(tag as ContentTag)}
                        className="h-3 w-3 rounded border-zinc-600 bg-zinc-700 text-zinc-100 focus:ring-zinc-500 focus:ring-1"
                      />
                      <label
                        htmlFor={`tag-${tag}`}
                        className="text-xs text-zinc-200 cursor-pointer flex-1"
                      >
                        {label}
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
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
