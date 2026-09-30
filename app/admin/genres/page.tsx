"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import AdminSidebar from "@/components/admin/AdminSidebar";
import Modal from "@/components/Modal";
import { titles } from "@/data/titles.mock";

export default function AdminGenresPage() {
  // Seeded from whatever genres/tags already exist across the title
  // catalog — assigning a genre/tag to a specific title happens on that
  // title's edit page, not here. This page only manages the metadata
  // itself (the list of valid genres/tags) and how many titles use each.
  const [genres, setGenres] = useState<string[]>(() =>
    Array.from(new Set(titles.map((t) => t.genre))).sort()
  );
  const [tags, setTags] = useState<string[]>(() =>
    Array.from(new Set(titles.flatMap((t) => t.tags))).sort()
  );

  const genreCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of titles) counts.set(t.genre, (counts.get(t.genre) ?? 0) + 1);
    return counts;
  }, []);

  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of titles) {
      for (const tag of t.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    return counts;
  }, []);

  const [modal, setModal] = useState<"genre" | "tag" | null>(null);
  const [newName, setNewName] = useState("");

  const openModal = (kind: "genre" | "tag") => {
    setNewName("");
    setModal(kind);
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    // TODO: persist to the real metadata API once it exists.
    if (modal === "genre") {
      setGenres((prev) => (prev.some((g) => g.toLowerCase() === name.toLowerCase()) ? prev : [...prev, name].sort()));
    } else if (modal === "tag") {
      setTags((prev) => (prev.some((t) => t.toLowerCase() === name.toLowerCase()) ? prev : [...prev, name].sort()));
    }
    setModal(null);
  };

  return (
    <div data-theme="light" className="min-h-screen bg-bg text-text flex">
      <AdminSidebar />

      <main className="flex-1 px-6 sm:px-8 py-8 max-w-[1200px]">
        <h1 className="font-display font-bold text-2xl mb-1">Genres & Tags</h1>
        <p className="text-sm text-text-muted mb-6">
          All genres and tags in the database. Assign them to a title from that
          title&apos;s edit page.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Genres */}
          <div className="bg-surface border border-border rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-bold text-lg">Genres</h2>
              <button
                type="button"
                onClick={() => openModal("genre")}
                className="flex items-center gap-1.5 rounded-full border border-border text-text hover:bg-surface font-semibold text-xs px-3 py-1.5 transition-colors"
              >
                <Plus size={14} strokeWidth={2.5} />
                Add Genre
              </button>
            </div>
            <ul className="divide-y divide-border">
              {genres.map((g) => (
                <li key={g} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="text-text">{g}</span>
                  <span className="text-text-muted">
                    {genreCounts.get(g) ?? 0} title{(genreCounts.get(g) ?? 0) === 1 ? "" : "s"}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Tags */}
          <div className="bg-surface border border-border rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-bold text-lg">Tags</h2>
              <button
                type="button"
                onClick={() => openModal("tag")}
                className="flex items-center gap-1.5 rounded-full border border-border text-text hover:bg-surface font-semibold text-xs px-3 py-1.5 transition-colors"
              >
                <Plus size={14} strokeWidth={2.5} />
                Add Tag
              </button>
            </div>
            <ul className="divide-y divide-border">
              {tags.map((t) => (
                <li key={t} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="text-text">{t}</span>
                  <span className="text-text-muted">
                    {tagCounts.get(t) ?? 0} title{(tagCounts.get(t) ?? 0) === 1 ? "" : "s"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </main>

      <Modal
        open={modal !== null}
        onClose={() => setModal(null)}
        title={modal === "genre" ? "Add Genre" : "Add Tag"}
      >
        <form onSubmit={handleAdd} className="space-y-4">
          <div>
            <label htmlFor="newName" className="block text-sm font-semibold mb-1.5">
              {modal === "genre" ? "Genre name" : "Tag name"}
            </label>
            <input
              id="newName"
              type="text"
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={modal === "genre" ? "e.g. Historical" : "e.g. Slow Burn"}
              autoFocus
              className="w-full rounded-md border border-border bg-bg px-3.5 py-2.5 text-sm text-text placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-full bg-btn-primary hover:bg-btn-primary-hover text-btn-primary-text font-semibold text-sm py-2.5 shadow-sm transition-colors"
          >
            Save
          </button>
        </form>
      </Modal>
    </div>
  );
}
