"use client";

import React, { useState, useRef, useCallback } from "react";
import Image from "next/image";
import {
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  RefreshCw,
  Link as LinkIcon,
  Image as ImageIcon,
} from "lucide-react";
import {
  uploadArtwork,
  validateClientImage,
  type ArtworkUploadResponse,
} from "@/lib/services/artwork.service";
import { ARTWORK_LIMITS, type ArtworkType } from "@/lib/validation/artwork";

export interface ArtworkUploaderProps {
  type: ArtworkType;
  value?: string | null;
  onChange: (url: string | null) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
}

export function ArtworkUploader({
  type,
  value,
  onChange,
  label,
  description,
  disabled = false,
}: ArtworkUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadStats, setUploadStats] = useState<ArtworkUploadResponse | null>(null);
  const [mode, setMode] = useState<"upload" | "url">("upload");
  const [urlInput, setUrlInput] = useState(value || "");

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isPoster = type === "poster";
  const defaultLabel = isPoster ? "Poster Artwork (2:3)" : "Banner Artwork (16:9)";
  const spec = isPoster ? ARTWORK_LIMITS.poster : ARTWORK_LIMITS.banner;
  const ratioLabel = isPoster ? "2:3 Portrait" : "16:9 Landscape";
  const minDimLabel = `${spec.minWidth}×${spec.minHeight}px`;

  const handleProcessFile = useCallback(
    async (file: File) => {
      setErrorMessage(null);

      // 1. Client-side dimension & constraint check
      const validation = await validateClientImage(file, type);
      if (!validation.valid) {
        setErrorMessage(validation.error || "Image failed validation requirements.");
        return;
      }

      // 2. Perform backend upload
      setIsUploading(true);
      try {
        const res = await uploadArtwork(file, type);
        if (!res.success || !res.data) {
          setErrorMessage(res.error || "Failed to upload image. Please try again.");
          return;
        }

        setUploadStats(res.data);
        onChange(res.data.url);
        setUrlInput(res.data.url);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unexpected upload error.";
        setErrorMessage(msg);
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [type, onChange]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !isUploading) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (disabled || isUploading) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleProcessFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleProcessFile(e.target.files[0]);
    }
  };

  const handleRemove = () => {
    onChange(null);
    setUrlInput("");
    setUploadStats(null);
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleUrlApply = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) {
      onChange(null);
      return;
    }
    onChange(trimmed);
    setErrorMessage(null);
  };

  return (
    <div className="space-y-2.5">
      {/* Header with Title and Badges */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <label className="block text-sm font-semibold text-text">
            {label || defaultLabel}
          </label>
          {description && (
            <p className="text-xs text-text-muted mt-0.5">{description}</p>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-[11px]">
          <span className="px-2 py-0.5 rounded font-medium bg-surface-raised border border-border text-text-muted">
            {ratioLabel}
          </span>
          <span className="px-2 py-0.5 rounded font-medium bg-surface-raised border border-border text-text-muted">
            Min {minDimLabel}
          </span>
          <span className="px-2 py-0.5 rounded font-medium bg-surface-raised border border-border text-text-muted">
            Max 5MB
          </span>
        </div>
      </div>

      {/* Mode Selector */}
      <div className="flex items-center gap-1 bg-surface-raised p-1 rounded-md border border-border w-fit text-xs">
        <button
          type="button"
          onClick={() => setMode("upload")}
          disabled={disabled || isUploading}
          className={`px-2.5 py-1 rounded transition-colors flex items-center gap-1.5 font-medium ${
            mode === "upload"
              ? "bg-surface text-text shadow-xs"
              : "text-text-muted hover:text-text"
          }`}
        >
          <UploadCloud size={13} />
          <span>Upload File</span>
        </button>
        <button
          type="button"
          onClick={() => setMode("url")}
          disabled={disabled || isUploading}
          className={`px-2.5 py-1 rounded transition-colors flex items-center gap-1.5 font-medium ${
            mode === "url"
              ? "bg-surface text-text shadow-xs"
              : "text-text-muted hover:text-text"
          }`}
        >
          <LinkIcon size={13} />
          <span>External URL</span>
        </button>
      </div>

      {/* Main Upload / Preview Area */}
      {mode === "upload" ? (
        <div>
          {value ? (
            /* Uploaded Image Preview Card */
            <div className="rounded-lg border border-border bg-surface p-3.5 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex items-center gap-3.5 min-w-0">
                <div
                  className={`relative overflow-hidden rounded-md border border-border bg-bg shrink-0 ${
                    isPoster ? "w-16 aspect-[2/3]" : "w-28 aspect-[16/9]"
                  }`}
                >
                  <Image
                    src={value}
                    alt={label || defaultLabel}
                    fill
                    sizes={isPoster ? "64px" : "112px"}
                    className="object-cover"
                    unoptimized
                  />
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-text">
                    <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                    <span className="truncate">Active {isPoster ? "Poster" : "Banner"}</span>
                  </div>

                  <p className="text-[11px] font-mono text-text-muted truncate max-w-xs sm:max-w-md mt-0.5">
                    {value}
                  </p>

                  {uploadStats && (
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-text-muted">
                      <span>
                        {uploadStats.width}×{uploadStats.height}px
                      </span>
                      <span>•</span>
                      <span className="uppercase">{uploadStats.format}</span>
                      <span>•</span>
                      <span>{(uploadStats.size / 1024).toFixed(0)} KB</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={disabled || isUploading}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-semibold text-text hover:bg-surface-raised transition-colors cursor-pointer"
                >
                  <RefreshCw size={13} />
                  <span>Replace</span>
                </button>
                <button
                  type="button"
                  onClick={handleRemove}
                  disabled={disabled || isUploading}
                  className="inline-flex items-center gap-1.5 rounded-md border border-danger/30 bg-danger-soft px-2.5 py-1.5 text-xs font-semibold text-danger hover:bg-danger/10 transition-colors cursor-pointer"
                >
                  <Trash2 size={13} />
                  <span>Remove</span>
                </button>
              </div>
            </div>
          ) : (
            /* Dropzone Empty State */
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !disabled && !isUploading && fileInputRef.current?.click()}
              className={`relative rounded-lg border-2 border-dashed p-6 text-center transition-colors cursor-pointer ${
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 bg-surface/50 hover:bg-surface"
              } ${disabled || isUploading ? "opacity-60 cursor-not-allowed" : ""}`}
            >
              <div className="flex flex-col items-center justify-center space-y-2">
                <div className="rounded-full bg-surface-raised p-3 text-primary border border-border">
                  {isUploading ? (
                    <Loader2 size={24} className="animate-spin text-primary" />
                  ) : (
                    <UploadCloud size={24} />
                  )}
                </div>

                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-text">
                    {isUploading ? (
                      "Validating and uploading artwork..."
                    ) : (
                      <>
                        <span className="text-primary hover:underline">Click to upload</span> or drag and drop
                      </>
                    )}
                  </p>
                  <p className="text-xs text-text-muted">
                    JPEG, PNG, or WebP up to 5 MB ({ratioLabel}, min {minDimLabel})
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileInputChange}
            disabled={disabled || isUploading}
            className="hidden"
          />
        </div>
      ) : (
        /* Direct URL Mode */
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://..."
              disabled={disabled || isUploading}
              className="w-full rounded-md border border-border bg-bg px-3.5 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors disabled:opacity-60"
            />
            <button
              type="button"
              onClick={handleUrlApply}
              disabled={disabled || isUploading}
              className="rounded-md border border-border bg-surface px-3 py-2 text-xs font-semibold text-text hover:bg-surface-raised transition-colors shrink-0 cursor-pointer"
            >
              Apply
            </button>
          </div>
          <p className="text-xs text-text-muted">
            Paste a direct URL from an allowed image host (e.g., Supabase Storage or Unsplash).
          </p>
        </div>
      )}

      {/* Error Message Alert */}
      {errorMessage && (
        <div className="flex items-start gap-2.5 rounded-md border border-danger/30 bg-danger-soft p-3 text-xs text-danger">
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
}
