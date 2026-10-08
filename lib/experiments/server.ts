import "server-only";
import { cookies } from "next/headers";
import { evaluateExperiment, CORE_EXPERIMENTS } from "./engine";
import type { ExperimentAssignment, ExperimentDefinition } from "@/types/experiments";

const COOKIE_ANON_ID = "dramashort_anon_id";
const COOKIE_EXPERIMENTS = "dramashort_experiments";

/**
 * Evaluates an experiment inside Server Components & Route Handlers with zero layout shift.
 */
export async function getServerExperiment<T = any>(
  experimentId: string,
  customDefinition?: ExperimentDefinition<T>
): Promise<ExperimentAssignment<T>> {
  const definition: ExperimentDefinition<T> | undefined =
    customDefinition || (CORE_EXPERIMENTS[experimentId] as any);

  if (!definition) {
    throw new Error(`[Experimentation] Unknown experiment ID: "${experimentId}"`);
  }

  let anonId: string | undefined;
  let storedVariant: string | undefined;

  try {
    const cookieStore = await cookies();
    anonId = cookieStore.get(COOKIE_ANON_ID)?.value;

    const rawExpCookie = cookieStore.get(COOKIE_EXPERIMENTS)?.value;
    if (rawExpCookie) {
      try {
        const parsed = JSON.parse(decodeURIComponent(rawExpCookie));
        storedVariant = parsed[experimentId];
      } catch {}
    }
  } catch {
    // If called outside request context (e.g. static generation)
  }

  return evaluateExperiment(definition, anonId, storedVariant);
}
