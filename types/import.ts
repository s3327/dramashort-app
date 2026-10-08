export type ImportSourceFormat = "dramaboss" | "custom_json" | "custom_csv";

export interface ImportEpisodeManifest {
  externalId: string;
  episodeNumber: number;
  title?: string;
  videoUrl?: string;
  hlsUrl?: string;
  durationSeconds?: number;
  isFree?: boolean;
  rawPayload?: Record<string, unknown>;
}

export interface ImportDramaManifest {
  externalId: string;
  title: string;
  synopsis?: string;
  channelCode?: string;
  channelName?: string;
  genre?: string;
  tags?: string[];
  posterUrl?: string;
  bannerUrl?: string;
  totalEpisodes?: number;
  status?: "Draft" | "Scheduled" | "Published" | "Archived";
  publishAt?: string;
  episodes?: ImportEpisodeManifest[];
  rawPayload?: Record<string, unknown>;
}

export interface ImportValidationError {
  row?: number;
  entity: "drama" | "episode" | "general";
  externalId?: string;
  field?: string;
  message: string;
  severity: "error" | "warning";
}

export interface ImportValidationSummary {
  valid: boolean;
  totalDramas: number;
  totalEpisodes: number;
  newDramasCount: number;
  existingDramasCount: number;
  newEpisodesCount: number;
  existingEpisodesCount: number;
  unchangedCount: number;
  errors: ImportValidationError[];
  warnings: ImportValidationError[];
  dramas: ImportDramaManifest[];
}

export type ImportJobStatus =
  | "pending"
  | "validating"
  | "dry_run_ready"
  | "processing"
  | "completed"
  | "failed";

export interface ImportJobItem {
  id: string;
  actorId?: string | null;
  actorEmail?: string | null;
  sourceName: string;
  fileName?: string | null;
  status: ImportJobStatus;
  totalDramas: number;
  totalEpisodes: number;
  createdDramas: number;
  updatedDramas: number;
  createdEpisodes: number;
  updatedEpisodes: number;
  unchangedRecords: number;
  failedRecords: number;
  validationReport: Partial<ImportValidationSummary>;
  errors: ImportValidationError[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
}

export interface ExecuteImportResult {
  jobId: string;
  status: "completed" | "failed";
  createdDramas: number;
  updatedDramas: number;
  createdEpisodes: number;
  updatedEpisodes: number;
  unchangedRecords: number;
  failedRecords: number;
  errors: ImportValidationError[];
}
