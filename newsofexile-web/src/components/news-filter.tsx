import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";
import { type NewsCategory, categoryLabels, type SourceType } from "@/types/news";

interface NewsFilterProps {
  value: NewsCategory;
  onChange: (value: NewsCategory) => void;
  onMarkAllRead?: () => void;
  hasUnread?: boolean;
}

const filters: NewsCategory[] = [
  "all",
  "poe1-news",
  "poe1-patch",
  "poe2-news",
  "poe2-patch",
];

function getCategoryColorClasses(sourceType: SourceType): {
  dot: string;
  active: string;
} {
  switch (sourceType) {
    case "poe1-news":
      return {
        dot: "bg-blue-500",
        active: "data-[state=on]:bg-blue-500 data-[state=on]:text-white data-[state=on]:border-blue-500",
      };
    case "poe1-patch":
      return {
        dot: "bg-emerald-500",
        active: "data-[state=on]:bg-emerald-500 data-[state=on]:text-white data-[state=on]:border-emerald-500",
      };
    case "poe2-news":
      return {
        dot: "bg-purple-500",
        active: "data-[state=on]:bg-purple-500 data-[state=on]:text-white data-[state=on]:border-purple-500",
      };
    case "poe2-patch":
      return {
        dot: "bg-amber-500",
        active: "data-[state=on]:bg-amber-500 data-[state=on]:text-white data-[state=on]:border-amber-500",
      };
  }
}

export function NewsFilter({ value, onChange, onMarkAllRead, hasUnread }: NewsFilterProps) {
  return (
    <div className="sticky top-0 z-10 bg-zinc-950/80 backdrop-blur border-b border-zinc-800/50">
      <div className="max-w-3xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Title + Mark All Read */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <img src="/favicon.ico" alt="News of Exile" className="w-5 h-5" width="20" height="20" />
              <h1 className="text-sm font-semibold text-zinc-100">News of Exile</h1>
            </div>
            {hasUnread && onMarkAllRead && (
              <Button
                onClick={onMarkAllRead}
                variant="ghost"
                size="sm"
                className="text-[10px] h-5 px-2 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800"
              >
                Mark all as read
              </Button>
            )}
          </div>

          {/* Filter Toggle Group */}
          <ToggleGroup
            type="single"
            value={value}
            onValueChange={(v) => v && onChange(v as NewsCategory)}
            size="sm"
            variant="outline"
          >
            {filters.map((filter) => {
              const colorClasses = filter !== "all" ? getCategoryColorClasses(filter as SourceType) : null;
              return (
                <ToggleGroupItem
                  key={filter}
                  value={filter}
                  className={`text-xs data-[state=on]:bg-zinc-800 data-[state=on]:text-zinc-100 gap-1.5 ${
                    colorClasses?.active ?? ""
                  }`}
                >
                  {colorClasses && (
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${colorClasses.dot} group-data-[state=on]/toggle:hidden`}
                    />
                  )}
                  {categoryLabels[filter]}
                </ToggleGroupItem>
              );
            })}
          </ToggleGroup>
        </div>
      </div>
    </div>
  );
}
