-- Ported from the dramashort-user chain (20261006120000_watch_progress_semantics.sql) by ADR-0005.
-- The single project is built from this chain (ADR-0005); this file runs after the catalog chain.
-- Migration: 20261006120000_watch_progress_semantics.sql
-- Task 12.3: Watch Progress Semantics & Reliable Persistence
-- Adds position_seconds and duration_seconds columns to public.watch_history

ALTER TABLE public.watch_history
  ADD COLUMN IF NOT EXISTS position_seconds INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS duration_seconds INT NOT NULL DEFAULT 0;

-- Ensure permissions for authenticated users on the new columns
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.watch_history TO authenticated;
