"use client";

import { useState, useEffect } from "react";
import { getClientExperiment } from "@/lib/experiments/client";
import { CORE_EXPERIMENTS } from "@/lib/experiments/engine";
import type { ExperimentAssignment, ExperimentDefinition } from "@/types/experiments";

export interface UseExperimentResult<T = any> {
  variantId: string;
  value: T;
  isOverride: boolean;
  isLoading: boolean;
}

/**
 * React hook for consuming feature flag & A/B test experiments in Client Components (Task 15.5).
 * Evaluates sticky assignment, respects overrides, and dispatches exposure events.
 */
export function useExperiment<T = any>(
  experimentId: string,
  customDefinition?: ExperimentDefinition<T>
): UseExperimentResult<T> {
  const definition = customDefinition || (CORE_EXPERIMENTS[experimentId] as any);

  // Initial SSR / hydration default
  const defaultVariant = definition?.variants.find(
    (v: any) => v.id === definition.defaultVariantId
  ) || definition?.variants[0];

  const [assignment, setAssignment] = useState<ExperimentAssignment<T>>({
    experimentId,
    variantId: defaultVariant?.id || "control",
    value: defaultVariant?.value as T,
    isOverride: false,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const resolved = getClientExperiment<T>(experimentId, customDefinition);
      setAssignment(resolved);
    } catch (err) {
      console.warn(`[useExperiment] Failed to resolve experiment "${experimentId}":`, err);
    } finally {
      setIsLoading(false);
    }
  }, [experimentId, customDefinition]);

  return {
    variantId: assignment.variantId,
    value: assignment.value,
    isOverride: assignment.isOverride,
    isLoading,
  };
}
