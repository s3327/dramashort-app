import type { GetAuditLogsQuery } from "@/types/audit";

/**
 * Parses and sanitizes searchParams for the Audit Log listing endpoint.
 */
export function parseAuditLogsQueryParams(
  searchParams: URLSearchParams | Record<string, string | string[] | undefined>
): GetAuditLogsQuery {
  const getParam = (key: string): string | undefined => {
    if (searchParams instanceof URLSearchParams) {
      return searchParams.get(key) || undefined;
    }
    const val = searchParams[key];
    if (Array.isArray(val)) return val[0];
    return val;
  };

  const actorEmail = getParam("actorEmail")?.trim();
  const actorId = getParam("actorId")?.trim();
  const entityType = getParam("entityType")?.trim().toLowerCase();
  const action = getParam("action")?.trim().toLowerCase();
  const entityId = getParam("entityId")?.trim();
  const startDate = getParam("startDate")?.trim();
  const endDate = getParam("endDate")?.trim();
  const search = getParam("search")?.trim().slice(0, 100);

  const rawPage = parseInt(getParam("page") || "1", 10);
  const page = isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;

  const rawPageSize = parseInt(getParam("pageSize") || "25", 10);
  const pageSize = isNaN(rawPageSize) || rawPageSize < 1 ? 25 : Math.min(rawPageSize, 100);

  const rawSortDir = getParam("sortDir")?.toLowerCase();
  const sortDir: "asc" | "desc" = rawSortDir === "asc" ? "asc" : "desc";

  return {
    actorEmail: actorEmail || undefined,
    actorId: actorId || undefined,
    entityType: entityType && entityType !== "all" ? entityType : undefined,
    action: action && action !== "all" ? action : undefined,
    entityId: entityId || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    search: search || undefined,
    page,
    pageSize,
    sortDir,
  };
}

/**
 * Calculates a structured diff between before and after JSON objects.
 */
export function computeAuditDiff(
  before: Record<string, any> | null | undefined,
  after: Record<string, any> | null | undefined
) {
  const b = before ?? {};
  const a = after ?? {};

  const allKeys = Array.from(new Set([...Object.keys(b), ...Object.keys(a)]));

  const added: Record<string, any> = {};
  const removed: Record<string, any> = {};
  const changed: Record<string, { before: any; after: any }> = {};
  let unchangedCount = 0;

  for (const key of allKeys) {
    const hasBefore = key in b;
    const hasAfter = key in a;

    if (!hasBefore && hasAfter) {
      added[key] = a[key];
    } else if (hasBefore && !hasAfter) {
      removed[key] = b[key];
    } else {
      const valBefore = b[key];
      const valAfter = a[key];

      const isSame =
        valBefore === valAfter ||
        JSON.stringify(valBefore) === JSON.stringify(valAfter);

      if (!isSame) {
        changed[key] = { before: valBefore, after: valAfter };
      } else {
        unchangedCount++;
      }
    }
  }

  return { added, removed, changed, unchangedCount };
}
