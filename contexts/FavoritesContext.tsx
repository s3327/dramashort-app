"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
  type ReactNode,
} from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getUserFavorites,
  addUserFavorite,
  addUserFavorites,
  removeUserFavorite,
  getUserCustomLists,
  createCustomList as createCustomListDb,
  addItemToCustomList as addItemToCustomListDb,
  addItemsToCustomList as addItemsToCustomListDb,
  renameCustomList as renameCustomListDb,
  deleteCustomList as deleteCustomListDb,
  removeItemFromCustomList as removeItemFromCustomListDb,
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

export type FavoritesContextValue = {
  favoritedSlugs: Set<string>;
  isFavorited: (slug: string) => boolean;
  toggleFavorite: (slug: string) => Promise<boolean>;
  lists: ListDef[];
  createList: (title: string) => Promise<string | null>;
  addToList: (listId: string, slug: string) => Promise<boolean>;
  renameList: (listId: string, newTitle: string) => Promise<boolean>;
  deleteList: (listId: string) => Promise<boolean>;
  removeFromList: (listId: string, slug: string) => Promise<boolean>;
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

  // 1. Initialize clean state
  const [state, setState] = useState<FavoritesState>({
    favoritedSlugs: new Set<string>(),
    lists: [],
  });
  const [isHydrated, setIsHydrated] = useState(false);
  const migratedUserIdRef = useRef<string | null>(null);

  // 2. Hydrate favorites on mount or user transition, migrating guest favorites & custom lists
  useEffect(() => {
    let mounted = true;

    if (user) {
      async function syncAndLoadUserFavorites() {
        if (!user) return;

        // Perform guest data migration once per user session
        if (migratedUserIdRef.current !== user.id) {
          migratedUserIdRef.current = user.id;

          let guestSlugs: string[] = [];
          let guestLists: ListDef[] = [];

          try {
            const stored = window.localStorage.getItem(STORAGE_KEY);
            if (stored) {
              const parsed = JSON.parse(stored) as {
                favoritedSlugs?: string[];
                lists?: ListDef[];
              };
              if (Array.isArray(parsed?.favoritedSlugs)) {
                guestSlugs = parsed.favoritedSlugs.filter(
                  (slug) => !LEGACY_MOCK_SLUGS.has(slug)
                );
              }
              if (Array.isArray(parsed?.lists)) {
                guestLists = parsed.lists;
              }
            }
          } catch {
            // Ignore localStorage read errors
          }

          // Bulk migrate guest favorites
          if (guestSlugs.length > 0) {
            await addUserFavorites(user.id, guestSlugs);
          }

          // Migrate guest custom lists and their items
          if (guestLists.length > 0) {
            for (const glist of guestLists) {
              const trimmed = glist.title?.trim();
              if (!trimmed) continue;
              const dbId = await createCustomListDb(user.id, trimmed);
              if (dbId && Array.isArray(glist.itemSlugs) && glist.itemSlugs.length > 0) {
                await addItemsToCustomListDb(dbId, glist.itemSlugs);
              }
            }
          }

          // Clean up guest local storage
          try {
            window.localStorage.removeItem(STORAGE_KEY);
          } catch {
            // Ignore storage errors
          }
        }

        // Fetch user's confirmed favorites and custom lists from Supabase
        const [favs, customLists] = await Promise.all([
          getUserFavorites(user.id),
          getUserCustomLists(user.id),
        ]);

        if (!mounted) return;
        setState({
          favoritedSlugs: new Set(favs || []),
          lists: customLists || [],
        });
        setIsHydrated(true);
      }

      syncAndLoadUserFavorites();
    } else {
      // Guest: Restore only genuinely favorited items and lists from localStorage
      migratedUserIdRef.current = null;
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as {
            favoritedSlugs?: string[];
            lists?: ListDef[];
          };

          if (Array.isArray(parsed?.favoritedSlugs)) {
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
              const cleanedSlugs = parsed.favoritedSlugs.filter(
                (s) => !LEGACY_MOCK_SLUGS.has(s)
              );
              if (mounted) {
                setState({
                  favoritedSlugs: new Set(cleanedSlugs),
                  lists: Array.isArray(parsed.lists) ? parsed.lists : [],
                });
              }
            }
          }
        } else {
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

  // 3. Persist guest favorites & lists to localStorage only after hydration is confirmed
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

  const isFavorited = useCallback(
    (slug: string) => state.favoritedSlugs.has(slug),
    [state.favoritedSlugs]
  );

  /**
   * Toggles a favorite slug with optimistic UI update and rollback on failure.
   */
  const toggleFavorite = async (slug: string): Promise<boolean> => {
    const wasFavorited = state.favoritedSlugs.has(slug);

    // Optimistic UI update
    setState((prev) => {
      const next = new Set(prev.favoritedSlugs);
      if (wasFavorited) next.delete(slug);
      else next.add(slug);
      return { ...prev, favoritedSlugs: next };
    });

    if (user) {
      try {
        const success = wasFavorited
          ? await removeUserFavorite(user.id, slug)
          : await addUserFavorite(user.id, slug);

        if (!success) {
          // Roll back optimistic state on failure
          setState((prev) => {
            const rollback = new Set(prev.favoritedSlugs);
            if (wasFavorited) rollback.add(slug);
            else rollback.delete(slug);
            return { ...prev, favoritedSlugs: rollback };
          });
          return false;
        }
      } catch (err) {
        // Roll back optimistic state on exception
        setState((prev) => {
          const rollback = new Set(prev.favoritedSlugs);
          if (wasFavorited) rollback.add(slug);
          else rollback.delete(slug);
          return { ...prev, favoritedSlugs: rollback };
        });
        return false;
      }
    }

    return true;
  };

  /**
   * Creates a custom list asynchronously.
   * For logged in users, waits for database insertion and returns the real database UUID.
   * For guests, generates a local ID and returns it.
   */
  const createList = async (title: string): Promise<string | null> => {
    const trimmed = title.trim();
    if (!trimmed) return null;

    if (user) {
      try {
        const dbId = await createCustomListDb(user.id, trimmed);
        if (!dbId) return null;

        const newList: ListDef = { id: dbId, title: trimmed, itemSlugs: [] };
        setState((prev) => ({
          ...prev,
          lists: [...prev.lists, newList],
        }));
        return dbId;
      } catch (err) {
        console.error("Failed to create list in database:", err);
        return null;
      }
    } else {
      const guestId = `list-${Date.now()}`;
      const newList: ListDef = { id: guestId, title: trimmed, itemSlugs: [] };
      setState((prev) => ({
        ...prev,
        lists: [...prev.lists, newList],
      }));
      return guestId;
    }
  };

  /**
   * Adds a drama slug to a custom list with optimistic update and rollback on failure.
   */
  const addToList = async (listId: string, slug: string): Promise<boolean> => {
    const targetList = state.lists.find((l) => l.id === listId);
    if (!targetList || targetList.itemSlugs.includes(slug)) {
      return true;
    }

    // Optimistic update
    setState((prev) => ({
      ...prev,
      lists: prev.lists.map((l) =>
        l.id === listId ? { ...l, itemSlugs: [...l.itemSlugs, slug] } : l
      ),
    }));

    if (user) {
      try {
        const success = await addItemToCustomListDb(listId, slug);
        if (!success) {
          // Roll back item addition
          setState((prev) => ({
            ...prev,
            lists: prev.lists.map((l) =>
              l.id === listId
                ? { ...l, itemSlugs: l.itemSlugs.filter((s) => s !== slug) }
                : l
            ),
          }));
          return false;
        }
      } catch {
        setState((prev) => ({
          ...prev,
          lists: prev.lists.map((l) =>
            l.id === listId
              ? { ...l, itemSlugs: l.itemSlugs.filter((s) => s !== slug) }
              : l
          ),
        }));
        return false;
      }
    }

    return true;
  };

  /**
   * Renames a custom list with optimistic update and rollback on failure.
   */
  const renameList = async (listId: string, newTitle: string): Promise<boolean> => {
    const trimmed = newTitle.trim();
    if (!trimmed) return false;

    const previousList = state.lists.find((l) => l.id === listId);
    if (!previousList) return false;
    const oldTitle = previousList.title;

    // Optimistic update
    setState((prev) => ({
      ...prev,
      lists: prev.lists.map((l) =>
        l.id === listId ? { ...l, title: trimmed } : l
      ),
    }));

    if (user) {
      try {
        const success = await renameCustomListDb(listId, trimmed);
        if (!success) {
          // Roll back title
          setState((prev) => ({
            ...prev,
            lists: prev.lists.map((l) =>
              l.id === listId ? { ...l, title: oldTitle } : l
            ),
          }));
          return false;
        }
      } catch {
        setState((prev) => ({
          ...prev,
          lists: prev.lists.map((l) =>
            l.id === listId ? { ...l, title: oldTitle } : l
          ),
        }));
        return false;
      }
    }

    return true;
  };

  /**
   * Deletes a custom list with optimistic update and rollback on failure.
   */
  const deleteList = async (listId: string): Promise<boolean> => {
    const previousList = state.lists.find((l) => l.id === listId);
    if (!previousList) return false;

    // Optimistic removal
    setState((prev) => ({
      ...prev,
      lists: prev.lists.filter((l) => l.id !== listId),
    }));

    if (user) {
      try {
        const success = await deleteCustomListDb(listId);
        if (!success) {
          // Roll back deleted list
          setState((prev) => ({
            ...prev,
            lists: [...prev.lists, previousList],
          }));
          return false;
        }
      } catch {
        setState((prev) => ({
          ...prev,
          lists: [...prev.lists, previousList],
        }));
        return false;
      }
    }

    return true;
  };

  /**
   * Removes an item from a custom list with optimistic update and rollback on failure.
   */
  const removeFromList = async (listId: string, slug: string): Promise<boolean> => {
    const targetList = state.lists.find((l) => l.id === listId);
    if (!targetList || !targetList.itemSlugs.includes(slug)) {
      return true;
    }

    // Optimistic removal
    setState((prev) => ({
      ...prev,
      lists: prev.lists.map((l) =>
        l.id === listId
          ? { ...l, itemSlugs: l.itemSlugs.filter((s) => s !== slug) }
          : l
      ),
    }));

    if (user) {
      try {
        const success = await removeItemFromCustomListDb(listId, slug);
        if (!success) {
          // Roll back item removal
          setState((prev) => ({
            ...prev,
            lists: prev.lists.map((l) =>
              l.id === listId ? { ...l, itemSlugs: [...l.itemSlugs, slug] } : l
            ),
          }));
          return false;
        }
      } catch {
        setState((prev) => ({
          ...prev,
          lists: prev.lists.map((l) =>
            l.id === listId ? { ...l, itemSlugs: [...l.itemSlugs, slug] } : l
          ),
        }));
        return false;
      }
    }

    return true;
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
        renameList,
        deleteList,
        removeFromList,
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
