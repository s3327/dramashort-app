"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Search,
  Plus,
  MoreVertical,
  ExternalLink,
  Film,
  Pencil,
  Trash2,
  Loader2,
  AlertTriangle,
  Radio,
} from "lucide-react";
import AdminSidebar from "@/components/admin/AdminSidebar";
import Modal from "@/components/Modal";
import { ArtworkUploader } from "@/components/admin/ArtworkUploader";
import Toast from "@/components/Toast";
import { useToast } from "@/hooks/useToast";
import { formatRelativeTime } from "@/lib/format";
import { slugifyChannelName } from "@/lib/validation/channel";
import {
  getAdminChannels,
  createAdminChannel,
  updateAdminChannel,
  deleteAdminChannel,
  type AdminChannel,
  type CreateChannelInput,
  type UpdateChannelInput,
} from "@/lib/services/content.service";

export default function AdminChannelsPage() {
  const { message: toastMessage, show: showToast } = useToast();

  const [channels, setChannels] = useState<AdminChannel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [actionMenuOpenId, setActionMenuOpenId] = useState<string | null>(null);

  // Active channel for Edit / Delete
  const [selectedChannel, setSelectedChannel] = useState<AdminChannel | null>(null);

  // Form states
  const [formData, setFormData] = useState<CreateChannelInput>({
    name: "",
    slug: "",
    code: "",
    description: "",
    avatarUrl: null,
    bannerUrl: null,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load channels on mount
  const loadChannels = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await getAdminChannels();
      if (res.success && res.data) {
        setChannels(res.data);
      } else {
        showToast(res.error || "Failed to load channels");
      }
    } catch {
      showToast("Network error loading channels");
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadChannels();
  }, [loadChannels]);

  // Filter channels by search
  const filteredChannels = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return channels;
    return channels.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.slug.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        (c.description && c.description.toLowerCase().includes(q))
    );
  }, [channels, searchQuery]);

  // Handle auto-slug sync on Add Channel
  const handleNameChange = (name: string, isCreate: boolean) => {
    setFormData((prev) => {
      const next = { ...prev, name };
      if (isCreate && (!prev.slug || prev.slug === slugifyChannelName(prev.name))) {
        next.slug = slugifyChannelName(name);
      }
      return next;
    });
    setFormErrors((prev) => {
      const next = { ...prev };
      delete next.name;
      delete next.slug;
      return next;
    });
  };

  // Open Add Modal
  const openAddModal = () => {
    setFormData({
      name: "",
      slug: "",
      code: "",
      description: "",
      avatarUrl: null,
      bannerUrl: null,
    });
    setFormErrors({});
    setIsAddOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (c: AdminChannel) => {
    setSelectedChannel(c);
    setFormData({
      name: c.name,
      slug: c.slug,
      code: c.code,
      description: c.description || "",
      avatarUrl: c.avatarUrl || null,
      bannerUrl: c.bannerUrl || null,
    });
    setFormErrors({});
    setActionMenuOpenId(null);
    setIsEditOpen(true);
  };

  // Open Delete Modal
  const openDeleteModal = (c: AdminChannel) => {
    setSelectedChannel(c);
    setActionMenuOpenId(null);
    setIsDeleteOpen(true);
  };

  // Submit Add Channel
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormErrors({});

    try {
      const payload: CreateChannelInput = {
        name: formData.name.trim(),
        slug: formData.slug?.trim() || slugifyChannelName(formData.name),
        code: formData.code.trim().toUpperCase(),
        description: formData.description?.trim() || null,
        avatarUrl: formData.avatarUrl || null,
        bannerUrl: formData.bannerUrl || null,
      };

      const res = await createAdminChannel(payload);
      if (res.success && res.data) {
        showToast(`Channel '${res.data.name}' created successfully.`);
        setIsAddOpen(false);
        loadChannels();
      } else {
        showToast(res.error || "Failed to create channel.");
      }
    } catch {
      showToast("Network error creating channel.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Edit Channel
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChannel) return;

    setIsSubmitting(true);
    setFormErrors({});

    try {
      const payload: UpdateChannelInput = {
        name: formData.name.trim(),
        slug: formData.slug?.trim() || slugifyChannelName(formData.name),
        code: formData.code.trim().toUpperCase(),
        description: formData.description?.trim() || null,
        avatarUrl: formData.avatarUrl || null,
        bannerUrl: formData.bannerUrl || null,
      };

      const res = await updateAdminChannel(selectedChannel.id, payload);
      if (res.success && res.data) {
        showToast(`Channel '${res.data.name}' updated successfully.`);
        setIsEditOpen(false);
        setSelectedChannel(null);
        loadChannels();
      } else {
        showToast(res.error || "Failed to update channel.");
      }
    } catch {
      showToast("Network error updating channel.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Delete Channel
  const handleDeleteSubmit = async () => {
    if (!selectedChannel) return;

    setIsSubmitting(true);
    try {
      const res = await deleteAdminChannel(selectedChannel.id);
      if (res.success) {
        showToast(`Channel '${selectedChannel.name}' removed successfully.`);
        setIsDeleteOpen(false);
        setSelectedChannel(null);
        loadChannels();
      } else {
        showToast(res.error || "Failed to delete channel.");
      }
    } catch {
      showToast("Network error deleting channel.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div data-theme="light" className="min-h-screen bg-bg text-text flex">
      <AdminSidebar />

      <main className="flex-1 px-6 sm:px-8 py-8 max-w-[1280px]">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="font-display font-bold text-2xl flex items-center gap-2.5">
              <Radio size={24} className="text-primary" />
              Channels Management
            </h1>
            <p className="text-sm text-text-muted mt-1">
              Manage broadcast channels, studio identities, and catalog distribution across the platform.
            </p>
          </div>

          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md text-sm font-semibold hover:bg-primary/90 transition-colors shadow-xs"
          >
            <Plus size={16} strokeWidth={2.5} />
            Add Channel
          </button>
        </div>

        {/* Toolbar: Search and Channel Count */}
        <div className="bg-surface border border-border rounded-lg p-4 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-2xs">
          <div className="relative w-full sm:w-80">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
            />
            <input
              type="text"
              placeholder="Search by name, slug, or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-sm bg-bg border border-border rounded-md text-text placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="text-xs font-semibold text-text-muted">
            Total Channels: <span className="text-text font-bold">{channels.length}</span>
            {searchQuery && (
              <span className="ml-2 font-normal">
                (Filtered: {filteredChannels.length})
              </span>
            )}
          </div>
        </div>

        {/* Channels Grid */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-text-muted gap-3">
            <Loader2 size={32} className="animate-spin text-primary" />
            <p className="text-sm">Loading channels catalog...</p>
          </div>
        ) : filteredChannels.length === 0 ? (
          <div className="bg-surface border border-border rounded-lg p-12 text-center text-text-muted">
            <Radio size={40} className="mx-auto mb-3 opacity-40 text-primary" />
            <h3 className="font-bold text-text text-base mb-1">No channels found</h3>
            <p className="text-sm max-w-md mx-auto mb-6">
              {searchQuery
                ? `No channels matching "${searchQuery}". Try clearing your search query.`
                : "No channels exist yet. Add your first production studio or channel to begin publishing content."}
            </p>
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="px-4 py-1.5 text-xs font-semibold border border-border rounded-md hover:bg-bg transition-colors"
              >
                Clear Search
              </button>
            ) : (
              <button
                type="button"
                onClick={openAddModal}
                className="px-4 py-2 bg-primary text-white rounded-md text-sm font-semibold hover:bg-primary/90 transition-colors"
              >
                + Add Channel
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredChannels.map((c) => (
              <div
                key={c.id}
                className="bg-surface border border-border rounded-lg shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between overflow-hidden"
              >
                {/* Banner Header if available */}
                {c.bannerUrl && (
                  <div className="relative w-full h-24 border-b border-border bg-bg overflow-hidden">
                    <Image
                      src={c.bannerUrl}
                      alt={`${c.name} banner`}
                      fill
                      sizes="(max-width: 768px) 100vw, 380px"
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                )}

                <div className="p-5 flex-1 flex flex-col">
                  {/* Top Bar: Avatar, Name, Code, and Action Menu */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {c.avatarUrl ? (
                        <Image
                          src={c.avatarUrl}
                          alt={c.name}
                          width={44}
                          height={44}
                          className="h-11 w-11 shrink-0 rounded-full object-cover border border-border shadow-2xs bg-bg"
                          unoptimized
                        />
                      ) : (
                        <div className="h-11 w-11 shrink-0 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-display font-bold text-sm">
                          {c.code ||
                            c.name
                              .split(" ")
                              .map((w) => w[0])
                              .slice(0, 2)
                              .join("")
                              .toUpperCase()}
                        </div>
                      )}

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-text truncate text-base">
                            {c.name}
                          </p>
                          <span className="shrink-0 px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-primary/10 text-primary border border-primary/20">
                            {c.code}
                          </span>
                        </div>
                        <p className="text-xs font-mono text-text-muted truncate mt-0.5">
                          /channel/{c.slug}
                        </p>
                      </div>
                    </div>

                    {/* Action Dropdown Menu */}
                    <div className="relative">
                      <button
                        type="button"
                        aria-label={`Actions for ${c.name}`}
                        onClick={() =>
                          setActionMenuOpenId((prev) => (prev === c.id ? null : c.id))
                        }
                        className="p-1.5 rounded-md text-text-muted hover:text-text hover:bg-bg transition-colors"
                      >
                        <MoreVertical size={16} />
                      </button>

                      {actionMenuOpenId === c.id && (
                        <div className="absolute right-0 top-full mt-1 w-48 bg-surface border border-border rounded-lg shadow-lg py-1.5 z-20 text-xs">
                          <Link
                            href={`/channel/${c.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => setActionMenuOpenId(null)}
                            className="flex items-center gap-2 px-3 py-2 text-text hover:bg-bg transition-colors"
                          >
                            <ExternalLink size={14} className="text-text-muted" />
                            View Public Page
                          </Link>
                          <Link
                            href={`/admin/titles?channel=${encodeURIComponent(c.name)}`}
                            onClick={() => setActionMenuOpenId(null)}
                            className="flex items-center gap-2 px-3 py-2 text-text hover:bg-bg transition-colors"
                          >
                            <Film size={14} className="text-text-muted" />
                            View Dramas ({c.dramaCount})
                          </Link>
                          <button
                            type="button"
                            onClick={() => openEditModal(c)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-text hover:bg-bg transition-colors text-left"
                          >
                            <Pencil size={14} className="text-text-muted" />
                            Edit Channel
                          </button>
                          <div className="border-t border-border my-1" />
                          <button
                            type="button"
                            onClick={() => openDeleteModal(c)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors text-left"
                          >
                            <Trash2 size={14} className="text-red-500" />
                            Delete Channel
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Channel Description */}
                  {c.description ? (
                    <p className="text-xs text-text-muted line-clamp-2 mb-4 leading-relaxed">
                      {c.description}
                    </p>
                  ) : (
                    <p className="text-xs text-text-muted italic mb-4">
                      No description provided.
                    </p>
                  )}

                  {/* Channel Metadata Row */}
                  <div className="mt-auto pt-3 border-t border-border flex items-center justify-between text-xs">
                    <Link
                      href={`/admin/titles?channel=${encodeURIComponent(c.name)}`}
                      className="font-semibold text-primary hover:underline flex items-center gap-1.5"
                    >
                      <Film size={13} />
                      <span>
                        {c.dramaCount} {c.dramaCount === 1 ? "drama" : "dramas"}
                      </span>
                    </Link>

                    <span className="text-text-muted">
                      {c.createdAt ? formatRelativeTime(c.createdAt) : "—"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Click outside backdrop for action menu */}
        {actionMenuOpenId && (
          <div
            className="fixed inset-0 z-10"
            onClick={() => setActionMenuOpenId(null)}
          />
        )}

        {/* Modal: Add Channel */}
        <Modal
          open={isAddOpen}
          onClose={() => !isSubmitting && setIsAddOpen(false)}
          title="Add Channel"
        >
          <p className="text-xs text-text-muted mb-4">
            Create a new studio or broadcast channel brand.
          </p>
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-text mb-1">
                Channel Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Velvet Frame Studios"
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value, true)}
                className="w-full px-3 py-2 text-sm bg-bg border border-border rounded-md text-text focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {formErrors.name && (
                <p className="text-xs text-red-500 mt-1">{formErrors.name}</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-text mb-1">
                  Channel Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. VF (2-10 chars)"
                  value={formData.code}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))
                  }
                  className="w-full px-3 py-2 text-sm font-mono uppercase bg-bg border border-border rounded-md text-text focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <p className="text-[11px] text-text-muted mt-0.5">
                  Unique acronym used in slugs and tags.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text mb-1">
                  URL Slug <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. velvet-frame"
                  value={formData.slug}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, slug: e.target.value.toLowerCase() }))
                  }
                  className="w-full px-3 py-2 text-sm font-mono bg-bg border border-border rounded-md text-text focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text mb-1">
                Description
              </label>
              <textarea
                rows={2}
                placeholder="Brief summary of the studio or channel focus..."
                value={formData.description || ""}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, description: e.target.value }))
                }
                className="w-full px-3 py-2 text-sm bg-bg border border-border rounded-md text-text focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Artwork Uploaders */}
            <div className="space-y-4 pt-2 border-t border-border">
              <ArtworkUploader
                type="avatar"
                label="Channel Avatar (1:1 Square)"
                description="Logo or badge (min 100x100px, 1:1 square ratio)"
                value={formData.avatarUrl}
                onChange={(url) => setFormData((prev) => ({ ...prev, avatarUrl: url }))}
                disabled={isSubmitting}
              />

              <ArtworkUploader
                type="banner"
                label="Channel Banner (16:9 Landscape)"
                description="Header banner for channel page (min 640x360px)"
                value={formData.bannerUrl}
                onChange={(url) => setFormData((prev) => ({ ...prev, bannerUrl: url }))}
                disabled={isSubmitting}
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setIsAddOpen(false)}
                className="px-4 py-2 text-sm font-semibold text-text-muted hover:text-text transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {isSubmitting && <Loader2 size={14} className="animate-spin" />}
                Create Channel
              </button>
            </div>
          </form>
        </Modal>

        {/* Modal: Edit Channel */}
        <Modal
          open={isEditOpen}
          onClose={() => !isSubmitting && setIsEditOpen(false)}
          title={`Edit ${selectedChannel?.name || "Channel"}`}
        >
          <p className="text-xs text-text-muted mb-4">
            Update channel branding, name, code, or artwork.
          </p>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-text mb-1">
                Channel Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value, false)}
                className="w-full px-3 py-2 text-sm bg-bg border border-border rounded-md text-text focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-text mb-1">
                  Channel Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.code}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))
                  }
                  className="w-full px-3 py-2 text-sm font-mono uppercase bg-bg border border-border rounded-md text-text focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text mb-1">
                  URL Slug <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.slug}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, slug: e.target.value.toLowerCase() }))
                  }
                  className="w-full px-3 py-2 text-sm font-mono bg-bg border border-border rounded-md text-text focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text mb-1">
                Description
              </label>
              <textarea
                rows={2}
                value={formData.description || ""}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, description: e.target.value }))
                }
                className="w-full px-3 py-2 text-sm bg-bg border border-border rounded-md text-text focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Artwork Uploaders */}
            <div className="space-y-4 pt-2 border-t border-border">
              <ArtworkUploader
                type="avatar"
                label="Channel Avatar (1:1 Square)"
                value={formData.avatarUrl}
                onChange={(url) => setFormData((prev) => ({ ...prev, avatarUrl: url }))}
                disabled={isSubmitting}
              />

              <ArtworkUploader
                type="banner"
                label="Channel Banner (16:9 Landscape)"
                value={formData.bannerUrl}
                onChange={(url) => setFormData((prev) => ({ ...prev, bannerUrl: url }))}
                disabled={isSubmitting}
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setIsEditOpen(false)}
                className="px-4 py-2 text-sm font-semibold text-text-muted hover:text-text transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {isSubmitting && <Loader2 size={14} className="animate-spin" />}
                Save Changes
              </button>
            </div>
          </form>
        </Modal>

        {/* Modal: Delete Channel (with Safe Deletion Guard) */}
        <Modal
          open={isDeleteOpen}
          onClose={() => !isSubmitting && setIsDeleteOpen(false)}
          title={`Delete Channel: ${selectedChannel?.name}`}
        >
          <p className="text-xs text-text-muted mb-4">
            Confirm permanent channel deletion.
          </p>
          <div className="space-y-4">
            {selectedChannel && selectedChannel.dramaCount > 0 ? (
              <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" size={18} />
                  <div>
                    <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                      Cannot Delete Channel
                    </h4>
                    <p className="text-xs text-amber-800 dark:text-amber-300 mt-1 leading-relaxed">
                      This channel currently has <span className="font-bold">{selectedChannel.dramaCount}</span> associated drama{selectedChannel.dramaCount === 1 ? "" : "s"}.
                      To protect catalog referential integrity, please reassign or delete these dramas before removing this channel.
                    </p>
                  </div>
                </div>

                <div className="pt-2">
                  <Link
                    href={`/admin/titles?channel=${encodeURIComponent(selectedChannel.name)}`}
                    onClick={() => setIsDeleteOpen(false)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-900 dark:text-amber-200 underline"
                  >
                    View assigned dramas in admin &rarr;
                  </Link>
                </div>
              </div>
            ) : (
              <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 p-4">
                <p className="text-sm text-red-800 dark:text-red-300">
                  Are you sure you want to permanently delete channel <span className="font-bold">{selectedChannel?.name}</span>?
                  This channel has 0 active dramas. This operation cannot be undone.
                </p>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setIsDeleteOpen(false)}
                className="px-4 py-2 text-sm font-semibold text-text-muted hover:text-text transition-colors"
              >
                {selectedChannel && selectedChannel.dramaCount > 0 ? "Close" : "Cancel"}
              </button>

              {selectedChannel && selectedChannel.dramaCount === 0 && (
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleDeleteSubmit}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 size={14} className="animate-spin" />}
                  Delete Channel
                </button>
              )}
            </div>
          </div>
        </Modal>

        {/* Global Toast */}
        <Toast message={toastMessage} />
      </main>
    </div>
  );
}
