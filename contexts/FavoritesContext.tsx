"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { defaultFavoriteSlugs } from "@/data/favorites.mock";

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
};

const STORAGE_KEY = "dramashort-favorites";

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  // Kept as one state object (not two separate useState calls) so a
  // change that touches both favorites and lists at once — like
  // addToList — updates and persists them together atomically, instead
  // of risking a stale-closure write to localStorage.
  const [state, setState] = useState<FavoritesState>(() => ({
    favoritedSlugs: new Set(defaultFavoriteSlugs),
    lists: [],
  }));

  // localStorage isn't available during SSR, so saved state is restored
  // right after mount instead.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as { favoritedSlugs: string[]; lists: ListDef[] };
        setState({ favoritedSlugs: new Set(parsed.favoritedSlugs), lists: parsed.lists });
      }
    } catch {
      // Ignore malformed/missing storage — defaults already apply.
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ favoritedSlugs: Array.from(state.favoritedSlugs), lists: state.lists })
    );
  }, [state]);

  const isFavorited = (slug: string) => state.favoritedSlugs.has(slug);

  const toggleFavorite = (slug: string) => {
    setState((prev) => {
      const next = new Set(prev.favoritedSlugs);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return { ...prev, favoritedSlugs: next };
    });
  };

  const createList = (title: string) => {
    const id = `list-${Date.now()}`;
    setState((prev) => ({ ...prev, lists: [...prev.lists, { id, title, itemSlugs: [] }] }));
    return id;
  };

  // Adding a title to a list also favorites it — being in a list implies
  // it's a favorite. Both changes commit in the same state update.
  const addToList = (listId: string, slug: string) => {
    setState((prev) => ({
      favoritedSlugs: new Set(prev.favoritedSlugs).add(slug),
      lists: prev.lists.map((l) =>
        l.id === listId && !l.itemSlugs.includes(slug)
          ? { ...l, itemSlugs: [...l.itemSlugs, slug] }
          : l
      ),
    }));
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
