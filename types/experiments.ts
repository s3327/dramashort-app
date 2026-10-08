/**
 * Types & Domain Models for Platform Experimentation & Feature Flagging (Task 15.5)
 */

export interface ExperimentVariant<T = any> {
  id: string;
  name: string;
  weight: number; // Percentage share (e.g. 50 = 50%), weights sum to 100
  value: T;
}

export type ExperimentStatus = "active" | "draft" | "concluded";

export interface ExperimentDefinition<T = any> {
  id: string;
  name: string;
  description: string;
  status: ExperimentStatus;
  variants: ExperimentVariant<T>[];
  defaultVariantId: string;
}

export interface ExperimentAssignment<T = any> {
  experimentId: string;
  variantId: string;
  value: T;
  isOverride: boolean;
}

export interface ExperimentExposurePayload {
  experimentId: string;
  variantId: string;
  subjectId: string;
  timestamp?: string;
  metadata?: Record<string, unknown>;
}
