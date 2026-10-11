"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  GitMerge,
  Eye,
  EyeOff,
  Loader2,
  AlertTriangle,
  Tags as TagsIcon,
  Sparkles,
} from "lucide-react";
import AdminSidebar from "@/components/admin/AdminSidebar";
import Modal from "@/components/Modal";
import Toast from "@/components/Toast";
import { useToast } from "@/hooks/useToast";
import { slugifyTaxonomy } from "@/lib/validation/taxonomy";
import {
  getAdminGenres,
  createAdminGenre,
  updateAdminGenre,
  deleteAdminGenre,
  getAdminTags,
  createAdminTag,
  updateAdminTag,
  mergeAdminTags,
  deleteAdminTag,
  type AdminGenre,
  type AdminTag,
  type CreateGenreInput,
  type UpdateGenreInput,
  type CreateTagInput,
  type UpdateTagInput,
} from "@/lib/services/content.service";

export default function AdminGenresPage() {
  const { message: toastMessage, show: showToast } = useToast();

  const [genres, setGenres] = useState<AdminGenre[]>([]);
  const [tags, setTags] = useState<AdminTag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Modals state
  const [isAddGenreOpen, setIsAddGenreOpen] = useState(false);
  const [isEditGenreOpen, setIsEditGenreOpen] = useState(false);
  const [isDeleteGenreOpen, setIsDeleteGenreOpen] = useState(false);
  const [selectedGenre, setSelectedGenre] = useState<AdminGenre | null>(null);

  const [isAddTagOpen, setIsAddTagOpen] = useState(false);
  const [isEditTagOpen, setIsEditTagOpen] = useState(false);
  const [isMergeTagOpen, setIsMergeTagOpen] = useState(false);
  const [isDeleteTagOpen, setIsDeleteTagOpen] = useState(false);
  const [selectedTag, setSelectedTag] = useState<AdminTag | null>(null);

  // Form states
  const [genreForm, setGenreForm] = useState<CreateGenreInput>({
    name: "",
    slug: "",
    sortOrder: 0,
    isVisible: true,
  });
  const [tagForm, setTagForm] = useState<CreateTagInput>({
    name: "",
    slug: "",
  });
  const [mergeTargetTagId, setMergeTargetTagId] = useState("");
  const [deleteForce, setDeleteForce] = useState(false);
  const [deleteScrubTitles, setDeleteScrubTitles] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load live data
  const loadTaxonomy = useCallback(async () => {
    setIsLoading(true);
    try {
      const [genresData, tagsData] = await Promise.all([
        getAdminGenres(),
        getAdminTags(),
      ]);
      setGenres(genresData);
      setTags(tagsData);
    } catch (err) {
      console.error("Failed to load taxonomy data:", err);
      showToast("Failed to load genres and tags.");
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadTaxonomy();
  }, [loadTaxonomy]);

  // Filtered lists
  const filteredGenres = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return genres;
    return genres.filter(
      (g) => g.name.toLowerCase().includes(q) || g.slug.toLowerCase().includes(q)
    );
  }, [genres, searchQuery]);

  const filteredTags = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return tags;
    return tags.filter(
      (t) => t.name.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q)
    );
  }, [tags, searchQuery]);

  // --------------------------------------------------------------------------
  // Genre Handlers
  // --------------------------------------------------------------------------
  const openAddGenre = () => {
    setGenreForm({
      name: "",
      slug: "",
      sortOrder: genres.length,
      isVisible: true,
    });
    setIsAddGenreOpen(true);
  };

  const openEditGenre = (genre: AdminGenre) => {
    setSelectedGenre(genre);
    setGenreForm({
      name: genre.name,
      slug: genre.slug,
      sortOrder: genre.sortOrder ?? 0,
      isVisible: genre.isVisible ?? true,
    });
    setIsEditGenreOpen(true);
  };

  const openDeleteGenre = (genre: AdminGenre) => {
    setSelectedGenre(genre);
    setDeleteForce(false);
    setIsDeleteGenreOpen(true);
  };

  const handleCreateGenre = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!genreForm.name.trim()) return;

    setIsSubmitting(true);
    try {
      const payload: CreateGenreInput = {
        name: genreForm.name.trim(),
        slug: genreForm.slug?.trim() ? slugifyTaxonomy(genreForm.slug) : slugifyTaxonomy(genreForm.name),
        sortOrder: Number(genreForm.sortOrder) || 0,
        isVisible: genreForm.isVisible ?? true,
      };

      const res = await createAdminGenre(payload);
      if (!res.success) {
        showToast(res.error || "Failed to create genre.");
      } else {
        showToast(`Genre "${payload.name}" created successfully.`);
        setIsAddGenreOpen(false);
        await loadTaxonomy();
      }
    } catch (err) {
      showToast("Error creating genre.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateGenre = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGenre || !genreForm.name.trim()) return;

    setIsSubmitting(true);
    try {
      const payload: UpdateGenreInput = {
        name: genreForm.name.trim(),
        slug: genreForm.slug?.trim() ? slugifyTaxonomy(genreForm.slug) : slugifyTaxonomy(genreForm.name),
        sortOrder: Number(genreForm.sortOrder) || 0,
        isVisible: genreForm.isVisible ?? true,
      };

      const res = await updateAdminGenre(selectedGenre.id, payload);
      if (!res.success) {
        showToast(res.error || "Failed to update genre.");
      } else {
        showToast(`Genre "${payload.name}" updated successfully.`);
        setIsEditGenreOpen(false);
        await loadTaxonomy();
      }
    } catch (err) {
      showToast("Error updating genre.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleVisibility = async (genre: AdminGenre) => {
    try {
      const res = await updateAdminGenre(genre.id, {
        isVisible: !genre.isVisible,
      });
      if (res.success) {
        showToast(`Genre "${genre.name}" is now ${!genre.isVisible ? "visible" : "hidden"}.`);
        await loadTaxonomy();
      } else {
        showToast(res.error || "Failed to toggle visibility.");
      }
    } catch {
      showToast("Error toggling genre visibility.");
    }
  };

  const handleDeleteGenre = async () => {
    if (!selectedGenre) return;

    setIsSubmitting(true);
    try {
      const res = await deleteAdminGenre(selectedGenre.id, { force: deleteForce });
      if (!res.success) {
        showToast(res.error || "Failed to delete genre.");
      } else {
        showToast(`Genre "${selectedGenre.name}" deleted.`);
        setIsDeleteGenreOpen(false);
        await loadTaxonomy();
      }
    } catch {
      showToast("Error deleting genre.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // --------------------------------------------------------------------------
  // Tag Handlers
  // --------------------------------------------------------------------------
  const openAddTag = () => {
    setTagForm({
      name: "",
      slug: "",
    });
    setIsAddTagOpen(true);
  };

  const openEditTag = (tag: AdminTag) => {
    setSelectedTag(tag);
    setTagForm({
      name: tag.name,
      slug: tag.slug,
    });
    setIsEditTagOpen(true);
  };

  const openMergeTag = (tag: AdminTag) => {
    setSelectedTag(tag);
    // Default target: first available other tag
    const other = tags.find((t) => t.id !== tag.id);
    setMergeTargetTagId(other ? other.id : "");
    setIsMergeTagOpen(true);
  };

  const openDeleteTag = (tag: AdminTag) => {
    setSelectedTag(tag);
    setDeleteScrubTitles(false);
    setIsDeleteTagOpen(true);
  };

  const handleCreateTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tagForm.name.trim()) return;

    setIsSubmitting(true);
    try {
      const payload: CreateTagInput = {
        name: tagForm.name.trim(),
        slug: tagForm.slug?.trim() ? slugifyTaxonomy(tagForm.slug) : slugifyTaxonomy(tagForm.name),
      };

      const res = await createAdminTag(payload);
      if (!res.success) {
        showToast(res.error || "Failed to create tag.");
      } else {
        showToast(`Tag "${payload.name}" created successfully.`);
        setIsAddTagOpen(false);
        await loadTaxonomy();
      }
    } catch {
      showToast("Error creating tag.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTag || !tagForm.name.trim()) return;

    setIsSubmitting(true);
    try {
      const payload: UpdateTagInput = {
        name: tagForm.name.trim(),
        slug: tagForm.slug?.trim() ? slugifyTaxonomy(tagForm.slug) : slugifyTaxonomy(tagForm.name),
      };

      const res = await updateAdminTag(selectedTag.id, payload);
      if (!res.success) {
        showToast(res.error || "Failed to update tag.");
      } else {
        showToast(`Tag "${payload.name}" updated successfully.`);
        setIsEditTagOpen(false);
        await loadTaxonomy();
      }
    } catch {
      showToast("Error updating tag.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMergeTags = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTag || !mergeTargetTagId) return;

    setIsSubmitting(true);
    try {
      const targetTag = tags.find((t) => t.id === mergeTargetTagId);
      const res = await mergeAdminTags({
        sourceTagId: selectedTag.id,
        targetTagId: mergeTargetTagId,
      });

      if (!res.success) {
        showToast(res.error || "Failed to merge tags.");
      } else {
        showToast(
          `Merged "${selectedTag.name}" into "${targetTag?.name || "target"}" (${
            res.data?.affectedTitlesCount ?? 0
          } titles updated).`
        );
        setIsMergeTagOpen(false);
        await loadTaxonomy();
      }
    } catch {
      showToast("Error merging tags.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTag = async () => {
    if (!selectedTag) return;

    setIsSubmitting(true);
    try {
      const res = await deleteAdminTag(selectedTag.id, {
        removeFromTitles: deleteScrubTitles,
      });
      if (!res.success) {
        showToast(res.error || "Failed to delete tag.");
      } else {
        showToast(`Tag "${selectedTag.name}" deleted.`);
        setIsDeleteTagOpen(false);
        await loadTaxonomy();
      }
    } catch {
      showToast("Error deleting tag.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div data-theme="light" className="min-h-screen bg-bg text-text flex">
      <AdminSidebar />

      <main className="flex-1 px-6 sm:px-8 py-8 max-w-[1300px]">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="font-display font-bold text-2xl mb-1 flex items-center gap-2">
              <TagsIcon className="text-primary" size={24} />
              Genres & Tags Taxonomy
            </h1>
            <p className="text-sm text-text-muted">
              Manage genres and discoverability tags. Renames automatically propagate to all titles and public browse pages.
            </p>
          </div>

          {/* Search bar */}
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search genres or tags..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-surface border border-border rounded-lg text-text placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        </div>

        {/* Content Layout */}
        {isLoading ? (
          <div className="flex items-center justify-center min-h-[300px]">
            <Loader2 className="animate-spin text-primary" size={32} />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* ---------------------------------------------------------------- */}
            {/* GENRES COLUMN */}
            {/* ---------------------------------------------------------------- */}
            <div className="bg-surface border border-border rounded-xl shadow-sm p-6 flex flex-col">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
                <div>
                  <h2 className="font-display font-bold text-lg flex items-center gap-2">
                    <Sparkles className="text-accent" size={18} />
                    Genres ({filteredGenres.length})
                  </h2>
                  <p className="text-xs text-text-muted">Primary categorization for dramas</p>
                </div>
                <button
                  type="button"
                  onClick={openAddGenre}
                  className="flex items-center gap-1.5 rounded-full bg-btn-primary hover:bg-btn-primary-hover text-btn-primary-text font-semibold text-xs px-3.5 py-2 shadow-sm transition-colors"
                >
                  <Plus size={14} strokeWidth={2.5} />
                  Add Genre
                </button>
              </div>

              {filteredGenres.length === 0 ? (
                <div className="text-center py-12 text-text-muted text-sm">
                  {searchQuery ? "No genres match your search query." : "No genres configured yet."}
                </div>
              ) : (
                <ul className="divide-y divide-border flex-1 overflow-y-auto max-h-[600px] pr-1">
                  {filteredGenres.map((g) => (
                    <li
                      key={g.id}
                      className="flex items-center justify-between py-3 text-sm hover:bg-surface-hover/50 px-2 rounded-lg transition-colors"
                    >
                      <div className="flex flex-col min-w-0 pr-3">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-text truncate">{g.name}</span>
                          {!g.isVisible && (
                            <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">
                              Hidden
                            </span>
                          )}
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-surface border border-border text-text-muted">
                            #{g.sortOrder ?? 0}
                          </span>
                        </div>
                        <span className="text-xs text-text-muted truncate font-mono">/{g.slug}</span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-bg border border-border text-text-muted">
                          {g.dramaCount} {g.dramaCount === 1 ? "drama" : "dramas"}
                        </span>

                        <button
                          type="button"
                          onClick={() => handleToggleVisibility(g)}
                          title={g.isVisible ? "Hide from public catalog" : "Show in public catalog"}
                          className="p-1.5 text-text-muted hover:text-text rounded-md hover:bg-surface transition-colors"
                        >
                          {g.isVisible ? <Eye size={15} /> : <EyeOff size={15} className="text-amber-500" />}
                        </button>

                        <button
                          type="button"
                          onClick={() => openEditGenre(g)}
                          title="Edit Genre"
                          className="p-1.5 text-text-muted hover:text-primary rounded-md hover:bg-surface transition-colors"
                        >
                          <Pencil size={15} />
                        </button>

                        <button
                          type="button"
                          onClick={() => openDeleteGenre(g)}
                          title="Delete Genre"
                          className="p-1.5 text-text-muted hover:text-red-500 rounded-md hover:bg-surface transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* ---------------------------------------------------------------- */}
            {/* TAGS COLUMN */}
            {/* ---------------------------------------------------------------- */}
            <div className="bg-surface border border-border rounded-xl shadow-sm p-6 flex flex-col">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
                <div>
                  <h2 className="font-display font-bold text-lg flex items-center gap-2">
                    <TagsIcon className="text-primary" size={18} />
                    Tags & Tropes ({filteredTags.length})
                  </h2>
                  <p className="text-xs text-text-muted">Discoverability keywords & tropes</p>
                </div>
                <button
                  type="button"
                  onClick={openAddTag}
                  className="flex items-center gap-1.5 rounded-full bg-btn-primary hover:bg-btn-primary-hover text-btn-primary-text font-semibold text-xs px-3.5 py-2 shadow-sm transition-colors"
                >
                  <Plus size={14} strokeWidth={2.5} />
                  Add Tag
                </button>
              </div>

              {filteredTags.length === 0 ? (
                <div className="text-center py-12 text-text-muted text-sm">
                  {searchQuery ? "No tags match your search query." : "No tags configured yet."}
                </div>
              ) : (
                <ul className="divide-y divide-border flex-1 overflow-y-auto max-h-[600px] pr-1">
                  {filteredTags.map((t) => (
                    <li
                      key={t.id}
                      className="flex items-center justify-between py-3 text-sm hover:bg-surface-hover/50 px-2 rounded-lg transition-colors"
                    >
                      <div className="flex flex-col min-w-0 pr-3">
                        <span className="font-semibold text-text truncate">{t.name}</span>
                        <span className="text-xs text-text-muted truncate font-mono">#{t.slug}</span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-bg border border-border text-text-muted">
                          {t.dramaCount} {t.dramaCount === 1 ? "drama" : "dramas"}
                        </span>

                        <button
                          type="button"
                          onClick={() => openMergeTag(t)}
                          title="Merge tag into another tag"
                          className="p-1.5 text-text-muted hover:text-accent rounded-md hover:bg-surface transition-colors"
                        >
                          <GitMerge size={15} />
                        </button>

                        <button
                          type="button"
                          onClick={() => openEditTag(t)}
                          title="Edit Tag"
                          className="p-1.5 text-text-muted hover:text-primary rounded-md hover:bg-surface transition-colors"
                        >
                          <Pencil size={15} />
                        </button>

                        <button
                          type="button"
                          onClick={() => openDeleteTag(t)}
                          title="Delete Tag"
                          className="p-1.5 text-text-muted hover:text-red-500 rounded-md hover:bg-surface transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </main>

      {/* -------------------------------------------------------------------- */}
      {/* ADD GENRE MODAL */}
      {/* -------------------------------------------------------------------- */}
      <Modal open={isAddGenreOpen} onClose={() => setIsAddGenreOpen(false)} title="Add Genre">
        <form onSubmit={handleCreateGenre} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1">Genre Name *</label>
            <input
              type="text"
              required
              value={genreForm.name}
              onChange={(e) => {
                const name = e.target.value;
                setGenreForm((prev) => ({
                  ...prev,
                  name,
                  slug: prev.slug === slugifyTaxonomy(prev.name) || !prev.slug ? slugifyTaxonomy(name) : prev.slug,
                }));
              }}
              placeholder="e.g. Historical Romance"
              className="w-full rounded-md border border-border bg-bg px-3.5 py-2.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">Slug</label>
            <input
              type="text"
              value={genreForm.slug}
              onChange={(e) => setGenreForm((prev) => ({ ...prev, slug: slugifyTaxonomy(e.target.value) }))}
              placeholder="e.g. historical-romance"
              className="w-full rounded-md border border-border bg-bg px-3.5 py-2.5 text-sm text-text font-mono focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1">Sort Order</label>
              <input
                type="number"
                min={0}
                value={genreForm.sortOrder}
                onChange={(e) => setGenreForm((prev) => ({ ...prev, sortOrder: parseInt(e.target.value, 10) || 0 }))}
                className="w-full rounded-md border border-border bg-bg px-3.5 py-2.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div className="flex items-center pt-6">
              <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-text">
                <input
                  type="checkbox"
                  checked={genreForm.isVisible}
                  onChange={(e) => setGenreForm((prev) => ({ ...prev, isVisible: e.target.checked }))}
                  className="rounded border-border text-primary focus:ring-primary/50"
                />
                Visible in Catalog
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 rounded-full bg-btn-primary hover:bg-btn-primary-hover text-btn-primary-text font-semibold text-sm py-2.5 shadow-sm transition-colors disabled:opacity-60"
          >
            {isSubmitting ? "Saving..." : "Create Genre"}
          </button>
        </form>
      </Modal>

      {/* -------------------------------------------------------------------- */}
      {/* EDIT GENRE MODAL */}
      {/* -------------------------------------------------------------------- */}
      <Modal open={isEditGenreOpen} onClose={() => setIsEditGenreOpen(false)} title="Edit Genre">
        <form onSubmit={handleUpdateGenre} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1">Genre Name *</label>
            <input
              type="text"
              required
              value={genreForm.name}
              onChange={(e) => setGenreForm((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full rounded-md border border-border bg-bg px-3.5 py-2.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <p className="text-xs text-text-muted mt-1">
              Renaming will automatically update all drama titles currently using this genre.
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">Slug</label>
            <input
              type="text"
              value={genreForm.slug}
              onChange={(e) => setGenreForm((prev) => ({ ...prev, slug: slugifyTaxonomy(e.target.value) }))}
              className="w-full rounded-md border border-border bg-bg px-3.5 py-2.5 text-sm text-text font-mono focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1">Sort Order</label>
              <input
                type="number"
                min={0}
                value={genreForm.sortOrder}
                onChange={(e) => setGenreForm((prev) => ({ ...prev, sortOrder: parseInt(e.target.value, 10) || 0 }))}
                className="w-full rounded-md border border-border bg-bg px-3.5 py-2.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div className="flex items-center pt-6">
              <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-text">
                <input
                  type="checkbox"
                  checked={genreForm.isVisible}
                  onChange={(e) => setGenreForm((prev) => ({ ...prev, isVisible: e.target.checked }))}
                  className="rounded border-border text-primary focus:ring-primary/50"
                />
                Visible in Catalog
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 rounded-full bg-btn-primary hover:bg-btn-primary-hover text-btn-primary-text font-semibold text-sm py-2.5 shadow-sm transition-colors disabled:opacity-60"
          >
            {isSubmitting ? "Updating..." : "Save Changes"}
          </button>
        </form>
      </Modal>

      {/* -------------------------------------------------------------------- */}
      {/* DELETE GENRE MODAL */}
      {/* -------------------------------------------------------------------- */}
      <Modal open={isDeleteGenreOpen} onClose={() => setIsDeleteGenreOpen(false)} title="Delete Genre">
        {selectedGenre && (
          <div className="space-y-4">
            <p className="text-sm text-text">
              Are you sure you want to delete the genre{" "}
              <strong className="text-red-500 font-semibold">{selectedGenre.name}</strong>?
            </p>

            {selectedGenre.dramaCount > 0 ? (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3.5 text-xs text-amber-500 space-y-2">
                <div className="flex items-center gap-2 font-semibold">
                  <AlertTriangle size={16} />
                  Assigned Dramas Warning
                </div>
                <p>
                  This genre is currently assigned to{" "}
                  <strong>
                    {selectedGenre.dramaCount} drama{selectedGenre.dramaCount === 1 ? "" : "s"}
                  </strong>
                  . Deleting it directly is prevented to avoid orphan titles.
                </p>
                <label className="flex items-center gap-2 pt-1 font-semibold text-text cursor-pointer">
                  <input
                    type="checkbox"
                    checked={deleteForce}
                    onChange={(e) => setDeleteForce(e.target.checked)}
                    className="rounded border-border text-red-500 focus:ring-red-500/50"
                  />
                  Force delete (unlinks genre from all titles)
                </label>
              </div>
            ) : (
              <p className="text-xs text-text-muted">
                No drama titles currently reference this genre. It is safe to remove.
              </p>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsDeleteGenreOpen(false)}
                className="flex-1 rounded-full border border-border py-2 text-sm font-semibold hover:bg-surface transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting || (selectedGenre.dramaCount > 0 && !deleteForce)}
                onClick={handleDeleteGenre}
                className="flex-1 rounded-full bg-red-600 hover:bg-red-700 text-white py-2 text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {isSubmitting ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* -------------------------------------------------------------------- */}
      {/* ADD TAG MODAL */}
      {/* -------------------------------------------------------------------- */}
      <Modal open={isAddTagOpen} onClose={() => setIsAddTagOpen(false)} title="Add Tag">
        <form onSubmit={handleCreateTag} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1">Tag Name *</label>
            <input
              type="text"
              required
              value={tagForm.name}
              onChange={(e) => {
                const name = e.target.value;
                setTagForm((prev) => ({
                  ...prev,
                  name,
                  slug: prev.slug === slugifyTaxonomy(prev.name) || !prev.slug ? slugifyTaxonomy(name) : prev.slug,
                }));
              }}
              placeholder="e.g. Billionaire CEO"
              className="w-full rounded-md border border-border bg-bg px-3.5 py-2.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">Slug</label>
            <input
              type="text"
              value={tagForm.slug}
              onChange={(e) => setTagForm((prev) => ({ ...prev, slug: slugifyTaxonomy(e.target.value) }))}
              placeholder="e.g. billionaire-ceo"
              className="w-full rounded-md border border-border bg-bg px-3.5 py-2.5 text-sm text-text font-mono focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 rounded-full bg-btn-primary hover:bg-btn-primary-hover text-btn-primary-text font-semibold text-sm py-2.5 shadow-sm transition-colors disabled:opacity-60"
          >
            {isSubmitting ? "Saving..." : "Create Tag"}
          </button>
        </form>
      </Modal>

      {/* -------------------------------------------------------------------- */}
      {/* EDIT TAG MODAL */}
      {/* -------------------------------------------------------------------- */}
      <Modal open={isEditTagOpen} onClose={() => setIsEditTagOpen(false)} title="Edit Tag">
        <form onSubmit={handleUpdateTag} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1">Tag Name *</label>
            <input
              type="text"
              required
              value={tagForm.name}
              onChange={(e) => setTagForm((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full rounded-md border border-border bg-bg px-3.5 py-2.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <p className="text-xs text-text-muted mt-1">
              Renaming will automatically update all drama tags arrays across the catalog.
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">Slug</label>
            <input
              type="text"
              value={tagForm.slug}
              onChange={(e) => setTagForm((prev) => ({ ...prev, slug: slugifyTaxonomy(e.target.value) }))}
              className="w-full rounded-md border border-border bg-bg px-3.5 py-2.5 text-sm text-text font-mono focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 rounded-full bg-btn-primary hover:bg-btn-primary-hover text-btn-primary-text font-semibold text-sm py-2.5 shadow-sm transition-colors disabled:opacity-60"
          >
            {isSubmitting ? "Updating..." : "Save Changes"}
          </button>
        </form>
      </Modal>

      {/* -------------------------------------------------------------------- */}
      {/* MERGE TAG MODAL */}
      {/* -------------------------------------------------------------------- */}
      <Modal open={isMergeTagOpen} onClose={() => setIsMergeTagOpen(false)} title="Merge Tag">
        {selectedTag && (
          <form onSubmit={handleMergeTags} className="space-y-4">
            <div className="bg-surface border border-border rounded-lg p-3 text-sm">
              <span className="text-text-muted text-xs block">Source Tag to Merge:</span>
              <strong className="text-text font-semibold">{selectedTag.name}</strong>{" "}
              <span className="text-xs text-text-muted">({selectedTag.dramaCount} titles)</span>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1">Target Tag *</label>
              <select
                required
                value={mergeTargetTagId}
                onChange={(e) => setMergeTargetTagId(e.target.value)}
                className="w-full rounded-md border border-border bg-bg px-3.5 py-2.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                {tags
                  .filter((t) => t.id !== selectedTag.id)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.dramaCount} titles)
                    </option>
                  ))}
              </select>
              <p className="text-xs text-text-muted mt-1.5 leading-relaxed">
                All titles tagged with <strong>{selectedTag.name}</strong> will be migrated to the target tag, and{" "}
                <strong>{selectedTag.name}</strong> will be permanently deleted.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsMergeTagOpen(false)}
                className="flex-1 rounded-full border border-border py-2 text-sm font-semibold hover:bg-surface transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !mergeTargetTagId}
                className="flex-1 rounded-full bg-accent hover:bg-accent/90 text-accent-text py-2 text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {isSubmitting ? "Merging..." : "Confirm Merge"}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* -------------------------------------------------------------------- */}
      {/* DELETE TAG MODAL */}
      {/* -------------------------------------------------------------------- */}
      <Modal open={isDeleteTagOpen} onClose={() => setIsDeleteTagOpen(false)} title="Delete Tag">
        {selectedTag && (
          <div className="space-y-4">
            <p className="text-sm text-text">
              Are you sure you want to delete the tag{" "}
              <strong className="text-red-500 font-semibold">{selectedTag.name}</strong>?
            </p>

            {selectedTag.dramaCount > 0 ? (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-xs text-amber-500 space-y-2">
                <p>
                  This tag is currently used by{" "}
                  <strong>
                    {selectedTag.dramaCount} drama{selectedTag.dramaCount === 1 ? "" : "s"}
                  </strong>
                  .
                </p>
                <label className="flex items-center gap-2 pt-1 font-semibold text-text cursor-pointer">
                  <input
                    type="checkbox"
                    checked={deleteScrubTitles}
                    onChange={(e) => setDeleteScrubTitles(e.target.checked)}
                    className="rounded border-border text-red-500 focus:ring-red-500/50"
                  />
                  Also remove this tag from all assigned drama titles
                </label>
              </div>
            ) : (
              <p className="text-xs text-text-muted">
                No drama titles currently reference this tag. It is safe to remove.
              </p>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsDeleteTagOpen(false)}
                className="flex-1 rounded-full border border-border py-2 text-sm font-semibold hover:bg-surface transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleDeleteTag}
                className="flex-1 rounded-full bg-red-600 hover:bg-red-700 text-white py-2 text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {isSubmitting ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Toast message={toastMessage} />
    </div>
  );
}
