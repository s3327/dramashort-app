import { createClient, SupabaseClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";

// Load environment variables if running as standalone script
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

export interface MigrationOptions {
  sourceClient?: SupabaseClient<any, any, any>;
  destClient?: SupabaseClient<any, any, any>;
  batchSize?: number;
  dryRun?: boolean;
  verbose?: boolean;
}

export interface TableMigrationResult {
  extracted: number;
  loaded: number;
}

export interface MigrationSummary {
  success: boolean;
  durationMs: number;
  counts: {
    channels: TableMigrationResult;
    titles: TableMigrationResult;
    episodes: TableMigrationResult;
    episode_media: TableMigrationResult;
  };
  errors: string[];
}

export const MIGRATION_TABLE_ORDER = [
  "channels",
  "titles",
  "episodes",
  "episode_media",
] as const;

export type MigrationTable = (typeof MIGRATION_TABLE_ORDER)[number];

/**
 * Extracts rows in chunks from a source Supabase table.
 */
async function extractTableRows(
  client: SupabaseClient<any, any, any>,
  tableName: string,
  batchSize: number,
  verbose = false
): Promise<any[]> {
  const allRows: any[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const to = from + batchSize - 1;
    const { data, error } = await client
      .from(tableName)
      .select("*")
      .range(from, to)
      .order("created_at", { ascending: true });

    if (error) {
      // If table doesn't exist or is inaccessible (e.g., episode_media in early stages)
      if (error.code === "42P01" || error.message.includes("does not exist")) {
        if (verbose) {
          console.warn(`[Migration] Source table "${tableName}" does not exist, skipping.`);
        }
        return [];
      }
      throw new Error(`Failed to extract rows from source table "${tableName}": ${error.message}`);
    }

    if (!data || data.length === 0) {
      hasMore = false;
    } else {
      allRows.push(...data);
      if (data.length < batchSize) {
        hasMore = false;
      } else {
        from += batchSize;
      }
    }
  }

  return allRows;
}

/**
 * Loads rows in chunks into the unified 'content' schema table with upsert conflict handling.
 */
async function loadTableRows(
  client: SupabaseClient<any, any, any>,
  tableName: string,
  rows: any[],
  batchSize: number,
  verbose = false
): Promise<number> {
  if (rows.length === 0) return 0;

  let loadedCount = 0;
  const target = client.schema ? client.schema("content") : client;

  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    const { error } = await target
      .from(tableName)
      .upsert(chunk, { onConflict: "id", ignoreDuplicates: false });

    if (error) {
      throw new Error(`Failed to upsert chunk into content.${tableName}: ${error.message}`);
    }

    loadedCount += chunk.length;
    if (verbose) {
      console.log(`[Migration] Upserted ${loadedCount}/${rows.length} rows into content.${tableName}`);
    }
  }

  return loadedCount;
}

/**
 * Executes content database migration from legacy Content DB to unified 'content' schema.
 */
export async function migrateContentData(options: MigrationOptions = {}): Promise<MigrationSummary> {
  const startTime = Date.now();
  const batchSize = options.batchSize || 100;
  const dryRun = options.dryRun ?? false;
  const verbose = options.verbose ?? false;
  const errors: string[] = [];

  const counts: MigrationSummary["counts"] = {
    channels: { extracted: 0, loaded: 0 },
    titles: { extracted: 0, loaded: 0 },
    episodes: { extracted: 0, loaded: 0 },
    episode_media: { extracted: 0, loaded: 0 },
  };

  // 1. Resolve clients
  let source = options.sourceClient;
  let dest = options.destClient;

  if (!source) {
    const sourceUrl =
      process.env.LEGACY_CONTENT_SUPABASE_URL ||
      process.env.NEXT_PUBLIC_CONTENT_SUPABASE_URL ||
      "http://127.0.0.1:54321";
    const sourceKey =
      process.env.LEGACY_CONTENT_SERVICE_ROLE_KEY ||
      process.env.CONTENT_SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_CONTENT_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_CONTENT_SUPABASE_ANON_KEY ||
      "dev-anon-key";
    source = createClient(sourceUrl, sourceKey, {
      auth: { persistSession: false },
    });
  }

  if (!dest) {
    const destUrl =
      process.env.UNIFIED_SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.NEXT_PUBLIC_USER_SUPABASE_URL ||
      "http://127.0.0.1:54322";
    const destKey =
      process.env.UNIFIED_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.USER_SUPABASE_SERVICE_ROLE_KEY ||
      "dev-service-key";
    dest = createClient(destUrl, destKey, {
      auth: { persistSession: false },
      db: { schema: "content" },
    });
  }

  if (verbose) {
    console.log("============================================================");
    console.log("  DramaShort Catalog Consolidation Migration Utility");
    console.log("  Mode: " + (dryRun ? "DRY RUN (Extract only)" : "LIVE CUTOVER"));
    console.log("  Batch Size: " + batchSize);
    console.log("============================================================");
  }

  // 2. Execute migration sequentially in dependency order
  for (const table of MIGRATION_TABLE_ORDER) {
    try {
      if (verbose) {
        console.log(`\n📦 Processing table: ${table}...`);
      }

      // Extract from legacy source
      const rows = await extractTableRows(source, table, batchSize, verbose);
      counts[table].extracted = rows.length;

      if (verbose) {
        console.log(`  Extracted ${rows.length} rows from legacy ${table}`);
      }

      if (dryRun) {
        counts[table].loaded = 0;
      } else {
        // Load into target content schema
        const loaded = await loadTableRows(dest, table, rows, batchSize, verbose);
        counts[table].loaded = loaded;
        if (verbose) {
          console.log(`  Successfully loaded ${loaded} rows into content.${table}`);
        }
      }
    } catch (err: any) {
      const msg = `Error migrating table ${table}: ${err.message || String(err)}`;
      errors.push(msg);
      if (verbose) {
        console.error(`❌ ${msg}`);
      }
      break; // Abort subsequent dependent tables on failure
    }
  }

  const durationMs = Date.now() - startTime;
  const success = errors.length === 0;

  if (verbose) {
    console.log("\n============================================================");
    console.log(`  Migration ${success ? "COMPLETED SUCCESSFULLY" : "FAILED"}`);
    console.log(`  Duration: ${durationMs}ms`);
    console.log("  Summary:");
    for (const table of MIGRATION_TABLE_ORDER) {
      console.log(`    - ${table}: ${counts[table].extracted} extracted, ${counts[table].loaded} loaded`);
    }
    if (errors.length > 0) {
      console.log("  Errors:");
      errors.forEach((e) => console.log(`    - ${e}`));
    }
    console.log("============================================================\n");
  }

  return {
    success,
    durationMs,
    counts,
    errors,
  };
}

/**
 * Determines whether the script was executed directly from the CLI or imported as a module.
 */
export function isDirectCliExecution(
  argv1 = process.argv[1],
  currentModuleUrl = typeof import.meta !== "undefined" ? import.meta.url : undefined
): boolean {
  if (typeof require !== "undefined" && require.main === module) {
    return true;
  }
  if (!argv1 || !currentModuleUrl) {
    return false;
  }
  try {
    const currentFilePath = fileURLToPath(currentModuleUrl);
    return path.resolve(argv1) === path.resolve(currentFilePath);
  } catch {
    return false;
  }
}

// Direct CLI entry point
if (isDirectCliExecution()) {
  const isDryRun = process.argv.includes("--dry-run");
  const isVerbose = !process.argv.includes("--quiet") && !process.argv.includes("--silent");
  const batchArg = process.argv.find((a) => a.startsWith("--batch-size="));
  const batchSize = batchArg ? parseInt(batchArg.split("=")[1], 10) : 100;

  migrateContentData({
    dryRun: isDryRun,
    verbose: isVerbose,
    batchSize: isNaN(batchSize) ? 100 : batchSize,
  })
    .then((result) => {
      if (!result.success) {
        process.exit(1);
      }
    })
    .catch((err) => {
      console.error("Fatal migration error:", err);
      process.exit(1);
    });
}
