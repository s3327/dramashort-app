"use client";

import {
  evaluateExperiment,
  CORE_EXPERIMENTS,
} from "./engine";
import { getAnonId, trackExperimentExposure } from "@/lib/analytics/track";
import type { ExperimentAssignment, ExperimentDefinition } from "@/types/experiments";

const EXPERIMENTS_COOKIE = "dramashort_experiments";
const EXPERIMENTS_STORAGE_KEY = "dramashort_experiments";

/**
 * Reads the sticky experiments map from cookies or localStorage.
 */
export function getStoredAssignments(): Record<string, string> {
  if (typeof window === "undefined") return {};

  // 1. Try Cookie
  try {
    const cookies = document.cookie.split(";");
    for (const cookie of cookies) {
      const [name, ...rest] = cookie.trim().split("=");
      if (name === EXPERIMENTS_COOKIE) {
        const val = decodeURIComponent(rest.join("="));
        return JSON.parse(val) || {};
      }
    }
  } catch {}

  // 2. Try localStorage
  try {
    const raw = localStorage.getItem(EXPERIMENTS_STORAGE_KEY);
    if (raw) return JSON.parse(raw) || {};
  } catch {}

  return {};
}

/**
 * Saves a sticky experiment variant assignment to cookies and localStorage.
 */
export function saveAssignment(experimentId: string, variantId: string): void {
  if (typeof window === "undefined") return;

  const current = getStoredAssignments();
  current[experimentId] = variantId;
  const json = JSON.stringify(current);

  // Cookie with 1-year TTL
  try {
    const maxAge = 365 * 24 * 60 * 60;
    document.cookie = `${EXPERIMENTS_COOKIE}=${encodeURIComponent(
      json
    )}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
  } catch {}

  // LocalStorage backup
  try {
    localStorage.setItem(EXPERIMENTS_STORAGE_KEY, json);
  } catch {}
}

/**
 * Checks for URL query parameter overrides (e.g. ?exp_landing_entry_mode=feed_direct).
 */
export function getUrlOverride(experimentId: string): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const url = new URL(window.location.href);
    return (
      url.searchParams.get(`exp_${experimentId}`) ||
      url.searchParams.get(`override_${experimentId}`) ||
      url.searchParams.get("exp_override") ||
      undefined
    );
  } catch {
    return undefined;
  }
}

/**
 * Evaluates an experiment on the client, managing sticky storage and exposure telemetry.
 */
export function getClientExperiment<T = any>(
  experimentId: string,
  customDefinition?: ExperimentDefinition<T>
): ExperimentAssignment<T> {
  const definition: ExperimentDefinition<T> | undefined =
    customDefinition || (CORE_EXPERIMENTS[experimentId] as any);

  if (!definition) {
    throw new Error(`[Experimentation] Unknown experiment ID: "${experimentId}"`);
  }

  // 1. Check URL override
  const urlOverride = getUrlOverride(experimentId);
  if (urlOverride) {
    const assignment = evaluateExperiment(definition, undefined, urlOverride);
    return assignment;
  }

  // 2. Check sticky storage
  const stored = getStoredAssignments();
  const storedVariant = stored[experimentId];

  const anonId = getAnonId();
  const assignment = evaluateExperiment(definition, anonId, storedVariant);

  // 3. Persist assignment if not yet saved
  if (storedVariant !== assignment.variantId) {
    saveAssignment(experimentId, assignment.variantId);
  }

  // 4. Log exposure event once per watch session
  if (typeof window !== "undefined") {
    try {
      const sessionKey = `dramashort_exp_exposed_${experimentId}`;
      if (!sessionStorage.getItem(sessionKey)) {
        sessionStorage.setItem(sessionKey, assignment.variantId);
        trackExperimentExposure({
          experimentId: assignment.experimentId,
          variantId: assignment.variantId,
        });
      }
    } catch {}
  }

  return assignment;
}
