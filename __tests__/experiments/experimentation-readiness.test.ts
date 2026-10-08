import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  hashSubjectToBucket,
  evaluateExperiment,
  CORE_EXPERIMENTS,
} from "@/lib/experiments/engine";
import {
  trackExperimentExposure,
  _resetTrackingForTesting,
  _getEventQueue,
} from "@/lib/analytics/track";
import type { ExperimentDefinition } from "@/types/experiments";

test("Task 15.5: hashSubjectToBucket is deterministic and uniformly distributed", () => {
  const expId = "test_experiment";
  const uuid = "550e8400-e29b-41d4-a716-446655440000";

  // 1. Strict determinism
  const bucket1 = hashSubjectToBucket(expId, uuid);
  const bucket2 = hashSubjectToBucket(expId, uuid);
  assert.equal(bucket1, bucket2, "Same input must return identical bucket");
  assert.ok(bucket1 >= 0 && bucket1 < 100, "Bucket must be in range [0, 99]");

  // 2. Uniformity check across 2,000 distinct UUIDs
  let bucketSum = 0;
  const sampleSize = 2000;
  let inFirstHalf = 0;

  for (let i = 0; i < sampleSize; i++) {
    const id = crypto.randomUUID();
    const b = hashSubjectToBucket(expId, id);
    bucketSum += b;
    if (b < 50) inFirstHalf++;
  }

  const average = bucketSum / sampleSize;
  // Expected average of uniform distribution [0, 99] is ~49.5
  assert.ok(
    average >= 45 && average <= 54,
    `Average bucket (${average}) should be near 49.5`
  );

  // Expected 50% split in first half [0, 49]
  const splitRatio = inFirstHalf / sampleSize;
  assert.ok(
    splitRatio >= 0.45 && splitRatio <= 0.55,
    `Split ratio (${splitRatio}) should be near 0.50`
  );
});

test("Task 15.5: evaluateExperiment guarantees sticky variant assignment for same subject", () => {
  const def: ExperimentDefinition<string> = {
    id: "color_test",
    name: "Button Color Test",
    description: "Tests button color",
    status: "active",
    defaultVariantId: "blue",
    variants: [
      { id: "blue", name: "Blue", weight: 50, value: "#0000FF" },
      { id: "green", name: "Green", weight: 50, value: "#00FF00" },
    ],
  };

  const subject1 = "subject-alpha-12345";
  const initial = evaluateExperiment(def, subject1);

  // Evaluate 50 times repeatedly
  for (let i = 0; i < 50; i++) {
    const repeated = evaluateExperiment(def, subject1);
    assert.equal(repeated.variantId, initial.variantId);
    assert.equal(repeated.value, initial.value);
    assert.equal(repeated.isOverride, false);
  }
});

test("Task 15.5: evaluateExperiment adheres to custom variant weights", () => {
  const def: ExperimentDefinition<number> = {
    id: "weight_test",
    name: "Weight Distribution Test",
    description: "70/30 distribution",
    status: "active",
    defaultVariantId: "v_70",
    variants: [
      { id: "v_70", name: "70% Variant", weight: 70, value: 70 },
      { id: "v_30", name: "30% Variant", weight: 30, value: 30 },
    ],
  };

  let count70 = 0;
  const sampleSize = 1000;

  for (let i = 0; i < sampleSize; i++) {
    const id = crypto.randomUUID();
    const assignment = evaluateExperiment(def, id);
    if (assignment.variantId === "v_70") count70++;
  }

  const ratio70 = count70 / sampleSize;
  // Should be close to 0.70 (+/- 0.05)
  assert.ok(
    ratio70 >= 0.65 && ratio70 <= 0.75,
    `Observed ratio ${ratio70} should approximate 0.70`
  );
});

test("Task 15.5: evaluateExperiment honors manual overrides", () => {
  const def = CORE_EXPERIMENTS.landing_entry_mode;

  // 1. Valid override
  const overrideRes = evaluateExperiment(def, "any-user", "feed_direct");
  assert.equal(overrideRes.variantId, "feed_direct");
  assert.equal(overrideRes.value, "feed");
  assert.equal(overrideRes.isOverride, true);

  // 2. Non-existent override falls back to standard evaluation
  const invalidOverrideRes = evaluateExperiment(def, "any-user", "non_existent_variant");
  assert.equal(invalidOverrideRes.isOverride, false);
});

test("Task 15.5: evaluateExperiment falls back to default when inactive or without subject ID", () => {
  const inactiveDef: ExperimentDefinition = {
    ...CORE_EXPERIMENTS.landing_entry_mode,
    status: "concluded",
  };

  // Inactive experiment
  const inactiveRes = evaluateExperiment(inactiveDef, "some-user");
  assert.equal(inactiveRes.variantId, inactiveDef.defaultVariantId);
  assert.equal(inactiveRes.isOverride, false);

  // Missing subject ID
  const activeDef = CORE_EXPERIMENTS.landing_entry_mode;
  const missingIdRes = evaluateExperiment(activeDef, undefined);
  assert.equal(missingIdRes.variantId, activeDef.defaultVariantId);
});

test("Task 15.5: Core platform experiments catalog is correctly configured", () => {
  // 1. landing_entry_mode
  const landingExp = CORE_EXPERIMENTS.landing_entry_mode;
  assert.ok(landingExp);
  assert.equal(landingExp.status, "active");
  assert.equal(landingExp.defaultVariantId, "control");
  assert.equal(landingExp.variants.length, 2);
  const controlVar = landingExp.variants.find((v) => v.id === "control");
  const feedVar = landingExp.variants.find((v) => v.id === "feed_direct");
  assert.equal(controlVar?.value, "landing");
  assert.equal(feedVar?.value, "feed");

  // 2. guest_engagement_threshold
  const guestExp = CORE_EXPERIMENTS.guest_engagement_threshold;
  assert.ok(guestExp);
  assert.equal(guestExp.status, "active");
  assert.equal(guestExp.defaultVariantId, "ep3_soft");
  assert.equal(guestExp.variants.length, 3);
  assert.equal(guestExp.variants.find((v) => v.id === "ep3_soft")?.value, 3);
  assert.equal(guestExp.variants.find((v) => v.id === "ep2_early")?.value, 2);
  assert.equal(guestExp.variants.find((v) => v.id === "ep5_patient")?.value, 5);

  // 3. free_episodes_count
  const freeExp = CORE_EXPERIMENTS.free_episodes_count;
  assert.ok(freeExp);
  assert.equal(freeExp.status, "active");
  assert.equal(freeExp.defaultVariantId, "5_free");
  assert.equal(freeExp.variants.length, 3);
  assert.equal(freeExp.variants.find((v) => v.id === "5_free")?.value, 5);
  assert.equal(freeExp.variants.find((v) => v.id === "3_free")?.value, 3);
  assert.equal(freeExp.variants.find((v) => v.id === "7_free")?.value, 7);
});

test("Task 15.5: trackExperimentExposure enqueues telemetry exposure event", () => {
  _resetTrackingForTesting();

  trackExperimentExposure({
    experimentId: "landing_entry_mode",
    variantId: "feed_direct",
    metadata: { source: "test_suite" },
  });

  const queue = _getEventQueue();
  assert.equal(queue.length, 1);
  assert.equal(queue[0].eventType, "experiment_exposure");
  assert.equal(queue[0].titleSlug, "platform");
  assert.equal((queue[0].payload as any)?.experimentId, "landing_entry_mode");
  assert.equal((queue[0].payload as any)?.variantId, "feed_direct");
  assert.equal((queue[0].payload as any)?.source, "test_suite");

  _resetTrackingForTesting();
});
