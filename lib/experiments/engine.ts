import type {
  ExperimentDefinition,
  ExperimentVariant,
  ExperimentAssignment,
} from "@/types/experiments";

/**
 * Deterministically maps an experimentId and subjectId to a bucket between 0 and 99.
 * Uses 32-bit FNV-1a hashing for high speed, uniform distribution, and cross-platform consistency.
 */
export function hashSubjectToBucket(experimentId: string, subjectId: string): number {
  if (!subjectId) return 0;
  const key = `${experimentId}:${subjectId}`;
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 100;
}

/**
 * Evaluates an experiment definition for a specific subject ID (anonymous device or user ID).
 * Honors manual overrides when provided.
 */
export function evaluateExperiment<T = any>(
  definition: ExperimentDefinition<T>,
  subjectId?: string,
  overrideVariantId?: string
): ExperimentAssignment<T> {
  const defaultVariant =
    definition.variants.find((v) => v.id === definition.defaultVariantId) ||
    definition.variants[0];

  // 1. Manual override takes highest precedence (e.g. ?exp_override=...)
  if (overrideVariantId) {
    const matchedOverride = definition.variants.find((v) => v.id === overrideVariantId);
    if (matchedOverride) {
      return {
        experimentId: definition.id,
        variantId: matchedOverride.id,
        value: matchedOverride.value,
        isOverride: true,
      };
    }
  }

  // 2. Inactive experiments or missing subject IDs immediately receive default variant
  if (definition.status !== "active" || !subjectId) {
    return {
      experimentId: definition.id,
      variantId: defaultVariant.id,
      value: defaultVariant.value,
      isOverride: false,
    };
  }

  // 3. Deterministic hashing to bucket [0, 99]
  const bucket = hashSubjectToBucket(definition.id, subjectId);

  let cumulativeWeight = 0;
  for (const variant of definition.variants) {
    cumulativeWeight += variant.weight;
    if (bucket < cumulativeWeight) {
      return {
        experimentId: definition.id,
        variantId: variant.id,
        value: variant.value,
        isOverride: false,
      };
    }
  }

  return {
    experimentId: definition.id,
    variantId: defaultVariant.id,
    value: defaultVariant.value,
    isOverride: false,
  };
}

/**
 * Built-in core experiments catalog (Task 15.5).
 */
export const CORE_EXPERIMENTS: Record<string, ExperimentDefinition> = {
  landing_entry_mode: {
    id: "landing_entry_mode",
    name: "Landing vs. Direct Feed Entry (Task 14.5)",
    description: "Evaluates landing gate against direct vertical feed discovery for first-time visitors.",
    status: "active",
    defaultVariantId: "control",
    variants: [
      { id: "control", name: "Landing Gate", weight: 50, value: "landing" },
      { id: "feed_direct", name: "Direct Feed", weight: 50, value: "feed" },
    ],
  },
  guest_engagement_threshold: {
    id: "guest_engagement_threshold",
    name: "Guest Engagement Prompt Threshold (Task 14.8)",
    description: "Determines optimal episode milestone triggering soft guest registration prompts.",
    status: "active",
    defaultVariantId: "ep3_soft",
    variants: [
      { id: "ep3_soft", name: "Episode 3 Prompt", weight: 50, value: 3 },
      { id: "ep2_early", name: "Episode 2 Prompt", weight: 25, value: 2 },
      { id: "ep5_patient", name: "Episode 5 Prompt", weight: 25, value: 5 },
    ],
  },
  free_episodes_count: {
    id: "free_episodes_count",
    name: "Free Episodes Threshold (Phase 8 Freemium Paywall)",
    description: "Evaluates viewer retention before coin paywall episode locks.",
    status: "active",
    defaultVariantId: "5_free",
    variants: [
      { id: "5_free", name: "5 Free Episodes", weight: 50, value: 5 },
      { id: "3_free", name: "3 Free Episodes", weight: 25, value: 3 },
      { id: "7_free", name: "7 Free Episodes", weight: 25, value: 7 },
    ],
  },
};
