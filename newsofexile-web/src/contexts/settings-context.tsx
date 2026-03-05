import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
import type { ContentTag } from "@/types/news";
import { tagLabels } from "@/types/news";

interface SettingsContextType {
  // Tag filtering
  hiddenTags: Set<ContentTag>;
  toggleTagVisibility: (tag: ContentTag) => void;
  isTagVisible: (tag: ContentTag) => boolean;
  selectAllTags: () => void;
  unselectAllTags: () => void;
  setDefaultsTags: () => void;
  
  // Tag display in items
  showTagsInItems: boolean;
  toggleShowTagsInItems: () => void;
  
  // Settings modal
  isSettingsOpen: boolean;
  openSettings: () => void;
  closeSettings: () => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

interface SettingsProviderProps {
  children: ReactNode;
}

export function SettingsProvider({ children }: SettingsProviderProps) {
  const defaultHiddenTags: ContentTag[] = [
    "competition",
    "concept-art",
    "faq",
    "community",
    "soundtrack",
    "recap"
  ];
  
  // Initialize state from localStorage immediately
  const getInitialHiddenTags = (): Set<ContentTag> => {
    try {
      const savedHiddenTags = localStorage.getItem("news-hidden-tags");
      console.log("Initializing hidden tags from localStorage:", savedHiddenTags);
      if (savedHiddenTags) {
        const parsedTags = JSON.parse(savedHiddenTags);
        console.log("Initial hidden tags loaded:", parsedTags);
        return new Set(parsedTags);
      }
    } catch (error) {
      console.warn("Failed to load hidden tags from localStorage:", error);
    }
    console.log("Using default hidden tags:", defaultHiddenTags);
    return new Set(defaultHiddenTags);
  };
  
  const getInitialShowTags = (): boolean => {
    try {
      const savedShowTags = localStorage.getItem("news-show-tags-in-items");
      console.log("Initializing show tags from localStorage:", savedShowTags);
      if (savedShowTags !== null) {
        const parsed = JSON.parse(savedShowTags);
        console.log("Initial show tags loaded:", parsed);
        return parsed;
      }
    } catch (error) {
      console.warn("Failed to load show tags from localStorage:", error);
    }
    console.log("Using default show tags: false");
    return false;
  };
  
  const [hiddenTags, setHiddenTags] = useState<Set<ContentTag>>(getInitialHiddenTags());
  const [showTagsInItems, setShowTagsInItems] = useState(getInitialShowTags());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Save hiddenTags to localStorage when it changes
  useEffect(() => {
    try {
      const tagsArray = Array.from(hiddenTags);
      console.log("Saving hidden tags to localStorage:", tagsArray);
      localStorage.setItem("news-hidden-tags", JSON.stringify(tagsArray));
    } catch (error) {
      console.warn("Failed to save hidden tags to localStorage:", error);
    }
  }, [hiddenTags]);

  // Save showTagsInItems to localStorage when it changes
  useEffect(() => {
    try {
      localStorage.setItem("news-show-tags-in-items", JSON.stringify(showTagsInItems));
    } catch (error) {
      console.warn("Failed to save show tags setting to localStorage:", error);
    }
  }, [showTagsInItems]);

  const toggleTagVisibility = (tag: ContentTag) => {
    console.log("Toggling tag visibility:", tag);
    setHiddenTags(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tag)) {
        console.log("Removing tag from hidden:", tag);
        newSet.delete(tag);
      } else {
        console.log("Adding tag to hidden:", tag);
        newSet.add(tag);
      }
      console.log("New hidden tags:", Array.from(newSet));
      return newSet;
    });
  };

  const isTagVisible = (tag: ContentTag) => !hiddenTags.has(tag);

  const toggleShowTagsInItems = () => {
    setShowTagsInItems(prev => !prev);
  };

  const selectAllTags = () => {
    setHiddenTags(new Set());
  };

  const unselectAllTags = () => {
    setHiddenTags(new Set(Object.values(tagLabels).map((_, index) => {
      const tags: ContentTag[] = [
        "teaser",
        "twitch-drops",
        "launch",
        "competition",
        "sale",
        "concept-art",
        "interview",
        "build-showcase",
        "faq",
        "patch-update",
        "event",
        "community",
        "development",
        "announcement",
        "maintenance",
        "content-update",
        "rewards",
        "soundtrack",
        "recap",
        "livestream",
        "timeline",
        "league-end",
        "cosmetics",
        "stash-tab-sale",
        "hotfix",
        "restart-fix",
        "other"
      ];
      return tags[index];
    })));
  };

  const setDefaultsTags = () => {
    setHiddenTags(new Set(defaultHiddenTags));
  };

  const openSettings = () => setIsSettingsOpen(true);
  const closeSettings = () => setIsSettingsOpen(false);

  return (
    <SettingsContext.Provider
      value={{
        hiddenTags,
        toggleTagVisibility,
        isTagVisible,
        selectAllTags,
        unselectAllTags,
        setDefaultsTags,
        showTagsInItems,
        toggleShowTagsInItems,
        isSettingsOpen,
        openSettings,
        closeSettings,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}
