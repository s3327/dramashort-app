"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getUserFavorites,
  addUserFavorite,
  removeUserFavorite,
  getUserCustomLists,
  createCustomList as createCustomListDb,
  addItemToCustomList as addItemToCustomListDb,
} from "@/lib/services/user.service";

export type ListDef = {
  id: string;
  title: string;
  itemSlugs: string[];
};

type FavoritesState = {
  favoritedSlugs: Set<string>;
  lists: ListDef[];
};

type FavoritesContextValue = {
  favoritedSlugs: Set<string>;
  isFavorited: (slug: string) => boolean;
  toggleFavorite: (slug: string) => void;
  lists: ListDef[];
  createList: (title: string) => string;
  addToList: (listId: string, slug: string) => void;
  isHydrated: boolean;
};

const STORAGE_KEY = "dramashort-favorites";

// Legacy hardcoded mock fixtures to clean up from any previous visitor sessions
const LEGACY_MOCK_SLUGS = new Set([
  "ceo-secret-wife",
  "reborn-to-ruin-him",
  "marrying-my-rival",
  "billionaires-runaway-bride",
  "contract-bride-real-heart",
  "my-fake-fiance-the-general",
  "second-chance-at-first-love",
  "the-widow-duke-wants-me",
  "the-arranged-marriage",
  "someone-like-xavier",
  "married-to-the-enemy-duke",
  "ceos-runaway-bride",
]);

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  // 1. Initialize strictly clean state (no hardcoded fake favorites)
  const [state, setState] = useState<FavoritesState>({
    favoritedSlugs: new Set<string>(),
    lists: [],
  });
  const [isHydrated, setIsHydrated] = useState(false);

  // 2. Hydrate favorites on mount or user transition
  useEffect(() => {
    let mounted = true;

    if (user) {
      // Check if guest had any real favorites in localStorage prior to logging in
      let guestSlugs: string[] = [];
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as { favoritedSlugs?: string[] };
          if (Array.isArray(parsed?.favoritedSlugs)) {
            // Filter out any legacy pre-seeded mock slugs
            guestSlugs = parsed.favoritedSlugs.filter(
              (slug) => !LEGACY_MOCK_SLUGS.has(slug)
            );
          }
        }
      } catch {
        // Ignore localStorage read errors
      }

      // Automatically migrate guest favorites to user Supabase account
      if (guestSlugs.length > 0) {
        guestSlugs.forEach((slug) => addUserFavorite(user.id, slug));
        try {
          window.localStorage.removeItem(STORAGE_KEY);
        } catch {
          // Ignore removal error
        }
      }

      // Fetch user's confirmed favorites and custom lists from Supabase
      Promise.all([
        getUserFavorites(user.id),
        getUserCustomLists(user.id),
      ]).then(([favs, customLists]) => {
        if (!mounted) return;
        const mergedSlugs = new Set([...(favs || []), ...guestSlugs]);
        setState({
          favoritedSlugs: mergedSlugs,
          lists: customLists || [],
        });
        setIsHydrated(true);
      });
    } else {
      // Guest: Restore only genuinely user-favorited items from localStorage
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as {
            favoritedSlugs?: string[];
            lists?: ListDef[];
          };

          if (Array.isArray(parsed?.favoritedSlugs)) {
            // Check if stored data was just the legacy auto-seed (all 12 mock slugs)
            const isPureLegacySeed =
              parsed.favoritedSlugs.length === 12 &&
              parsed.favoritedSlugs.every((s) => LEGACY_MOCK_SLUGS.has(s));

            if (isPureLegacySeed) {
              window.localStorage.removeItem(STORAGE_KEY);
              if (mounted) {
                setState({
                  favoritedSlugs: new Set<string>(),
                  lists: [],
                });
              }
            } else {
              if (mounted) {
                setState({
                  favoritedSlugs: new Set(parsed.favoritedSlugs),
                  lists: parsed.lists || [],
                });
              }
            }
          }
        } else {
          // Fresh guest visitor: completely clean state
          if (mounted) {
            setState({
              favoritedSlugs: new Set<string>(),
              lists: [],
            });
          }
        }
      } catch (err) {
        console.warn("Failed to load favorites from localStorage:", err);
      } finally {
        if (mounted) setIsHydrated(true);
      }
    }

    return () => {
      mounted = false;
    };
  }, [user]);

  // 3. Persist guest favorites to localStorage only after hydration is confirmed
  useEffect(() => {
    if (!user && isHydrated) {
      try {
        if (state.favoritedSlugs.size === 0 && state.lists.length === 0) {
          window.localStorage.removeItem(STORAGE_KEY);
        } else {
          window.localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
              favoritedSlugs: Array.from(state.favoritedSlugs),
              lists: state.lists,
            })
          );
        }
      } catch (err) {
        console.warn("Failed to persist favorites to localStorage:", err);
      }
    }
  }, [state, user, isHydrated]);

  const isFavorited = (slug: string) => state.favoritedSlugs.has(slug);

  const toggleFavorite = (slug: string) => {
    const isCurrentlyFavorited = state.favoritedSlugs.has(slug);

    // Optimistic UI update
    setState((prev) => {
      const next = new Set(prev.favoritedSlugs);
      if (isCurrentlyFavorited) next.delete(slug);
      else next.add(slug);
      return { ...prev, favoritedSlugs: next };
    });

    // Sync to Supabase if logged in
    if (user) {
      if (isCurrentlyFavorited) {
        removeUserFavorite(user.id, slug);
      } else {
        addUserFavorite(user.id, slug);
      }
    }
  };

  const createList = (title: string): string => {
    const tempId = `list-${Date.now()}`;

    // Optimistic update
    setState((prev) => ({
      ...prev,
      lists: [...prev.lists, { id: tempId, title, itemSlugs: [] }],
    }));

    if (user) {
      createCustomListDb(user.id, title).then((dbId) => {
        if (dbId) {
          setState((prev) => ({
            ...prev,
            lists: prev.lists.map((l) => (l.id === tempId ? { ...l, id: dbId } : l)),
          }));
        }
      });
    }

    return tempId;
  };

  const addToList = (listId: string, slug: string) => {
    setState((prev) => ({
      ...prev,
      lists: prev.lists.map((l) =>
        l.id === listId && !l.itemSlugs.includes(slug)
          ? { ...l, itemSlugs: [...l.itemSlugs, slug] }
          : l
      ),
    }));

    if (user) {
      addItemToCustomListDb(listId, slug);
    }
  };

  return (
    <FavoritesContext.Provider
      value={{
        favoritedSlugs: state.favoritedSlugs,
        isFavorited,
        toggleFavorite,
        lists: state.lists,
        createList,
        addToList,
        isHydrated,
      }}
    >
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error("useFavorites must be used within a FavoritesProvider");
  return ctx;
}
