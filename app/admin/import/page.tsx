"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  Film,
  PlaySquare,
  ArrowRight,
  Database,
  History,
  FileCode,
  Check,
  Copy,
  ChevronRight,
  ExternalLink,
  Download,
  Loader2,
} from "lucide-react";
import AdminSidebar from "@/components/admin/AdminSidebar";
import type {
  ImportSourceFormat,
  ImportValidationSummary,
  ImportJobItem,
  ExecuteImportResult,
} from "@/types/import";

const SAMPLE_DRAMABOSS_JSON = JSON.stringify(
  {
    dramas: [
      {
        id: "db-alpha-ceo",
        title: "The Billionaire's Hidden Heiress",
        synopsis: "Betrayed by her family, she returns incognito as the CEO of a global conglomerate.",
        channel: "ds",
        category: "Romance",
        tags: ["CEO", "Revenge", "Billionaire", "Secret Identity"],
        poster: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80",
        banner: "https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=1200&auto=format&fit=crop&q=80",
        episodes: [
          {
            id: "db-alpha-ceo-ep1",
            number: 1,
            title: "The Grand Return",
            video_url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
            duration: 95,
            is_free: true,
          },
          {
            id: "db-alpha-ceo-ep2",
            number: 2,
            title: "Unmasked at the Gala",
            video_url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
            duration: 110,
            is_free: false,
          },
        ],
      },
    ],
  },
  null,
  2
);

const SAMPLE_CSV = `drama_external_id,drama_title,drama_synopsis,channel_code,genre,tags,poster_url,banner_url,episode_external_id,episode_number,episode_title,video_url,duration_seconds,is_free
csv-reborn-queen,"Reborn Empress of Wall Street","Awakening ten years in the past, she vows to reclaim her corporate empire.",ds,Revenge,"Rebirth;Strong Female;CEO",https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80,,csv-reborn-queen-1,1,"A Second Chance",https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4,90,true
csv-reborn-queen,"Reborn Empress of Wall Street","Awakening ten years in the past, she vows to reclaim her corporate empire.",ds,Revenge,"Rebirth;Strong Female;CEO",https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80,,csv-reborn-queen-2,2,"Trading Secrets",https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4,105,false`;

export default function AdminImportPage() {
  const [activeTab, setActiveTab] = useState<"import" | "history">("import");
  const [format, setFormat] = useState<ImportSourceFormat>("dramaboss");
  const [manifestContent, setManifestContent] = useState(SAMPLE_DRAMABOSS_JSON);
  const [fileName, setFileName] = useState("sample_dramaboss.json");

  // Wizard state: 1: input -> 2: validation -> 3: result
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Validation report
  const [isValidating, setIsValidating] = useState(false);
  const [validationReport, setValidationReport] = useState<ImportValidationSummary | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Execution state
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<ExecuteImportResult | null>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);

  // History state
  const [historyJobs, setHistoryJobs] = useState<ImportJobItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const isCsv = file.name.endsWith(".csv");
    if (isCsv) {
      setFormat("custom_csv");
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      if (content) {
        setManifestContent(content);
        showToast(`Loaded ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
      }
    };
    reader.readAsText(file);
  };

  const handleRunValidation = async () => {
    if (!manifestContent.trim()) {
      showToast("Manifest content cannot be empty.");
      return;
    }

    setIsValidating(true);
    setValidationError(null);

    try {
      const res = await fetch("/api/admin/import/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: manifestContent, format }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson?.error?.message || "Validation failed.");
      }

      const json = await res.json();
      const report: ImportValidationSummary = json.data || json;
      setValidationReport(report);
      setStep(2);
    } catch (err: any) {
      setValidationError(err.message || "Failed to validate manifest.");
    } finally {
      setIsValidating(false);
    }
  };

  const handleCommitExecution = async () => {
    if (!validationReport || !validationReport.valid) return;

    setIsExecuting(true);
    setExecutionError(null);

    try {
      const res = await fetch("/api/admin/import/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: manifestContent,
          format,
          fileName,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson?.error?.message || "Import execution failed.");
      }

      const json = await res.json();
      const result: ExecuteImportResult = json.data || json;
      setExecutionResult(result);
      setStep(3);
      showToast("Import job executed successfully!");
    } catch (err: any) {
      setExecutionError(err.message || "Execution failed.");
    } finally {
      setIsExecuting(false);
    }
  };

  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch("/api/admin/import/jobs?pageSize=20");
      if (res.ok) {
        const json = await res.json();
        setHistoryJobs(json.data?.items || json.items || []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "history") {
      fetchHistory();
    }
  }, [activeTab, fetchHistory]);

  const loadSample = (sampleType: "dramaboss" | "csv") => {
    if (sampleType === "dramaboss") {
      setFormat("dramaboss");
      setManifestContent(SAMPLE_DRAMABOSS_JSON);
      setFileName("sample_dramaboss.json");
    } else {
      setFormat("custom_csv");
      setManifestContent(SAMPLE_CSV);
      setFileName("sample_import.csv");
    }
    setStep(1);
    setValidationReport(null);
    showToast(`Loaded ${sampleType.toUpperCase()} sample template.`);
  };

  return (
    <div data-theme="light" className="min-h-screen bg-bg text-text flex flex-col md:flex-row">
      <AdminSidebar />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-lg bg-surface-elevated border border-border shadow-xl text-sm font-medium text-text flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <CheckCircle2 size={16} className="text-primary" />
          {toastMessage}
        </div>
      )}

      <main className="flex-1 px-6 sm:px-8 py-8 pt-16 md:pt-8 max-w-[1400px]">
        <div className="space-y-6 pb-12">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                  <Upload size={22} />
                </div>
                <h1 className="text-2xl font-bold font-display text-text">Bulk Import Pipeline</h1>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                  Idempotent Upsert
                </span>
              </div>
              <p className="text-sm text-text-muted mt-1">
                Batch ingest titles, episodes, and streaming media from partner manifests (DramaBoss, JSON, CSV) with zero duplicates.
              </p>
            </div>

            {/* Quick Actions / Templates */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => loadSample("dramaboss")}
                className="px-3 py-1.5 rounded-lg bg-surface-elevated border border-border text-xs font-medium text-text hover:bg-surface-hover transition-colors inline-flex items-center gap-1.5"
              >
                <FileCode size={13} className="text-primary" />
                DramaBoss JSON
              </button>
              <button
                onClick={() => loadSample("csv")}
                className="px-3 py-1.5 rounded-lg bg-surface-elevated border border-border text-xs font-medium text-text hover:bg-surface-hover transition-colors inline-flex items-center gap-1.5"
              >
                <FileText size={13} className="text-primary" />
                Sample CSV
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-4 border-b border-border">
            <button
              onClick={() => setActiveTab("import")}
              className={`pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === "import"
                  ? "border-primary text-primary"
                  : "border-transparent text-text-muted hover:text-text"
              }`}
            >
              <Upload size={16} />
              Import Manifest
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === "history"
                  ? "border-primary text-primary"
                  : "border-transparent text-text-muted hover:text-text"
              }`}
            >
              <History size={16} />
              Job History
            </button>
          </div>

          {activeTab === "import" && (
            <div className="space-y-6">
              {/* Wizard Step Indicator */}
              <div className="flex items-center justify-between max-w-xl mx-auto py-2">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                      step >= 1 ? "bg-primary text-white" : "bg-surface-elevated text-text-muted"
                    }`}
                  >
                    1
                  </div>
                  <span className={`text-xs font-semibold ${step >= 1 ? "text-text" : "text-text-muted"}`}>
                    Manifest Input
                  </span>
                </div>
                <div className="flex-1 h-0.5 bg-border mx-4" />
                <div className="flex items-center gap-2">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                      step >= 2 ? "bg-primary text-white" : "bg-surface-elevated text-text-muted"
                    }`}
                  >
                    2
                  </div>
                  <span className={`text-xs font-semibold ${step >= 2 ? "text-text" : "text-text-muted"}`}>
                    Dry-Run Report
                  </span>
                </div>
                <div className="flex-1 h-0.5 bg-border mx-4" />
                <div className="flex items-center gap-2">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                      step >= 3 ? "bg-primary text-white" : "bg-surface-elevated text-text-muted"
                    }`}
                  >
                    3
                  </div>
                  <span className={`text-xs font-semibold ${step >= 3 ? "text-text" : "text-text-muted"}`}>
                    Commit & Result
                  </span>
                </div>
              </div>

              {/* STEP 1: MANIFEST INPUT */}
              {step === 1 && (
                <div className="bg-surface border border-border rounded-xl p-6 space-y-6 shadow-sm">
                  {/* Format Selector */}
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-text-muted block mb-2">
                      1. Select Source Format
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <button
                        type="button"
                        onClick={() => setFormat("dramaboss")}
                        className={`p-4 rounded-xl border text-left transition-all ${
                          format === "dramaboss"
                            ? "bg-primary/5 border-primary text-primary"
                            : "bg-surface-elevated border-border text-text hover:bg-surface-hover"
                        }`}
                      >
                        <div className="font-semibold text-sm">DramaBoss Partner JSON</div>
                        <div className="text-xs text-text-muted mt-1">
                          External feed format with nested drama & episode entities.
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setFormat("custom_json")}
                        className={`p-4 rounded-xl border text-left transition-all ${
                          format === "custom_json"
                            ? "bg-primary/5 border-primary text-primary"
                            : "bg-surface-elevated border-border text-text hover:bg-surface-hover"
                        }`}
                      >
                        <div className="font-semibold text-sm">Custom JSON Manifest</div>
                        <div className="text-xs text-text-muted mt-1">
                          Standard DramaShort schema supporting total episode lists.
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setFormat("custom_csv")}
                        className={`p-4 rounded-xl border text-left transition-all ${
                          format === "custom_csv"
                            ? "bg-primary/5 border-primary text-primary"
                            : "bg-surface-elevated border-border text-text hover:bg-surface-hover"
                        }`}
                      >
                        <div className="font-semibold text-sm">Tabular CSV Format</div>
                        <div className="text-xs text-text-muted mt-1">
                          One row per episode with shared drama metadata headers.
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* File Upload Dropzone */}
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-text-muted block mb-2">
                      2. Upload Manifest File (Optional)
                    </label>
                    <div className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary/50 transition-colors bg-surface-elevated/20">
                      <input
                        type="file"
                        accept=".json,.csv,.txt"
                        onChange={handleFileUpload}
                        className="hidden"
                        id="manifest-upload-input"
                      />
                      <label htmlFor="manifest-upload-input" className="cursor-pointer">
                        <Upload size={28} className="mx-auto text-primary mb-2 opacity-80" />
                        <span className="text-sm font-semibold text-primary hover:underline">
                          Click to select manifest file
                        </span>
                        <span className="text-xs text-text-muted block mt-1">
                          Supported formats: .json, .csv (Max 15MB)
                        </span>
                      </label>
                      {fileName && (
                        <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded bg-surface border border-border text-xs font-medium text-text">
                          <FileText size={12} className="text-primary" />
                          {fileName}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Raw Content Textarea */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                        3. Review or Paste Manifest Payload
                      </label>
                      <span className="text-xs text-text-muted font-mono">
                        {(manifestContent.length / 1024).toFixed(1)} KB
                      </span>
                    </div>
                    <textarea
                      value={manifestContent}
                      onChange={(e) => setManifestContent(e.target.value)}
                      rows={14}
                      className="w-full p-4 font-mono text-xs bg-surface border border-border rounded-xl text-text placeholder:text-text-muted/60 focus:outline-none focus:border-primary transition-colors leading-relaxed"
                      placeholder="Paste JSON or CSV payload here..."
                    />
                  </div>

                  {/* Validation Error Banner */}
                  {validationError && (
                    <div className="p-4 rounded-xl bg-danger/10 border border-danger/20 text-danger text-sm flex items-center gap-2">
                      <AlertTriangle size={16} />
                      <span>{validationError}</span>
                    </div>
                  )}

                  {/* Validation Action */}
                  <div className="flex justify-end">
                    <button
                      onClick={handleRunValidation}
                      disabled={isValidating || !manifestContent.trim()}
                      className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-40 shadow-sm"
                    >
                      {isValidating ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          Running Dry-Run Validation...
                        </>
                      ) : (
                        <>
                          Run Dry-Run Validation
                          <ArrowRight size={16} />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2: DRY-RUN REPORT */}
              {step === 2 && validationReport && (
                <div className="space-y-6">
                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <div className="p-4 rounded-xl bg-surface border border-border">
                      <span className="text-xs text-text-muted block font-semibold uppercase">Total Dramas</span>
                      <span className="text-2xl font-bold font-display text-text mt-1 block">
                        {validationReport.totalDramas}
                      </span>
                      <span className="text-[11px] text-primary mt-1 block">
                        +{validationReport.newDramasCount} new, {validationReport.existingDramasCount} updates
                      </span>
                    </div>

                    <div className="p-4 rounded-xl bg-surface border border-border">
                      <span className="text-xs text-text-muted block font-semibold uppercase">Total Episodes</span>
                      <span className="text-2xl font-bold font-display text-text mt-1 block">
                        {validationReport.totalEpisodes}
                      </span>
                      <span className="text-[11px] text-purple-400 mt-1 block">
                        +{validationReport.newEpisodesCount} new, {validationReport.existingEpisodesCount} updates
                      </span>
                    </div>

                    <div className="p-4 rounded-xl bg-surface border border-border">
                      <span className="text-xs text-text-muted block font-semibold uppercase">Unchanged</span>
                      <span className="text-2xl font-bold font-display text-text mt-1 block">
                        {validationReport.unchangedCount}
                      </span>
                      <span className="text-[11px] text-text-muted mt-1 block">
                        Idempotent skips
                      </span>
                    </div>

                    <div className="p-4 rounded-xl bg-surface border border-border">
                      <span className="text-xs text-text-muted block font-semibold uppercase">Errors</span>
                      <span className={`text-2xl font-bold font-display mt-1 block ${
                        validationReport.errors.length > 0 ? "text-danger" : "text-emerald-500"
                      }`}>
                        {validationReport.errors.length}
                      </span>
                      <span className="text-[11px] text-text-muted mt-1 block">
                        Blocking errors
                      </span>
                    </div>

                    <div className="p-4 rounded-xl bg-surface border border-border">
                      <span className="text-xs text-text-muted block font-semibold uppercase">Warnings</span>
                      <span className="text-2xl font-bold font-display text-amber-500 mt-1 block">
                        {validationReport.warnings.length}
                      </span>
                      <span className="text-[11px] text-text-muted mt-1 block">
                        Non-blocking alerts
                      </span>
                    </div>
                  </div>

                  {/* Status Banner */}
                  {validationReport.valid ? (
                    <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2.5">
                        <CheckCircle2 size={18} />
                        <div>
                          <span className="font-semibold block">Dry-Run Validation Passed</span>
                          <span className="text-xs text-emerald-400/80">
                            Manifest has zero syntax or sequencing errors. Ready for safe idempotent database upsert.
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-danger/10 border border-danger/20 text-danger text-sm flex items-center gap-2.5">
                      <AlertTriangle size={18} />
                      <div>
                        <span className="font-semibold block">Dry-Run Validation Failed</span>
                        <span className="text-xs text-danger/80">
                          Please resolve the blocking errors listed below before committing to the database.
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Errors and Warnings List */}
                  {(validationReport.errors.length > 0 || validationReport.warnings.length > 0) && (
                    <div className="bg-surface border border-border rounded-xl p-5 space-y-3">
                      <h3 className="font-semibold text-sm text-text">Validation Diagnostics Log</h3>
                      <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                        {validationReport.errors.map((err, idx) => (
                          <div
                            key={`err-${idx}`}
                            className="p-3 rounded-lg bg-danger/10 border border-danger/20 text-xs text-danger flex items-start gap-2"
                          >
                            <AlertCircle size={15} className="shrink-0 mt-0.5" />
                            <div>
                              <span className="font-bold">Error (Row {err.row || idx + 1}):</span> {err.message}
                              {err.externalId && <span className="ml-2 font-mono opacity-80">[{err.externalId}]</span>}
                            </div>
                          </div>
                        ))}
                        {validationReport.warnings.map((warn, idx) => (
                          <div
                            key={`warn-${idx}`}
                            className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-500 flex items-start gap-2"
                          >
                            <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                            <div>
                              <span className="font-bold">Warning:</span> {warn.message}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Candidate Dramas Preview */}
                  <div className="bg-surface border border-border rounded-xl p-5 space-y-3">
                    <h3 className="font-semibold text-sm text-text">Candidate Dramas Preview</h3>
                    <div className="divide-y divide-border">
                      {validationReport.dramas.map((drama, idx) => (
                        <div key={drama.externalId} className="py-3 flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-mono text-text-muted">{idx + 1}.</span>
                            <div>
                              <div className="font-semibold text-sm text-text">{drama.title}</div>
                              <div className="text-xs text-text-muted flex items-center gap-2 mt-0.5">
                                <span className="font-mono text-[11px]">ID: {drama.externalId}</span>
                                <span>•</span>
                                <span>Genre: {drama.genre || "Romance"}</span>
                                <span>•</span>
                                <span>Episodes: {drama.episodes?.length || 0}</span>
                              </div>
                            </div>
                          </div>
                          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-surface-elevated border border-border text-text-muted">
                            {drama.status || "Draft"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  {executionError && (
                    <div className="p-4 rounded-xl bg-danger/10 border border-danger/20 text-danger text-sm flex items-center gap-2">
                      <AlertTriangle size={16} />
                      <span>{executionError}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setStep(1)}
                      className="px-4 py-2 rounded-lg bg-surface border border-border text-sm font-semibold text-text hover:bg-surface-hover transition-colors"
                    >
                      Back to Editor
                    </button>

                    <button
                      onClick={handleCommitExecution}
                      disabled={isExecuting || !validationReport.valid}
                      className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-40 shadow-sm"
                    >
                      {isExecuting ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          Executing Idempotent Import...
                        </>
                      ) : (
                        <>
                          <Database size={16} />
                          Commit Import to Database
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: RESULT */}
              {step === 3 && executionResult && (
                <div className="bg-surface border border-border rounded-xl p-8 text-center space-y-6 shadow-sm">
                  <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
                    <CheckCircle2 size={32} />
                  </div>

                  <div>
                    <h2 className="text-2xl font-bold font-display text-text">Import Completed Successfully</h2>
                    <p className="text-sm text-text-muted mt-1">
                      Job ID: <span className="font-mono text-text">{executionResult.jobId}</span>
                    </p>
                  </div>

                  {/* Result Metric Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl mx-auto">
                    <div className="p-4 rounded-xl bg-surface-elevated/40 border border-border">
                      <span className="text-xs text-text-muted block">Created Dramas</span>
                      <span className="text-2xl font-bold text-primary mt-1 block">
                        +{executionResult.createdDramas}
                      </span>
                    </div>

                    <div className="p-4 rounded-xl bg-surface-elevated/40 border border-border">
                      <span className="text-xs text-text-muted block">Updated Dramas</span>
                      <span className="text-2xl font-bold text-blue-500 mt-1 block">
                        {executionResult.updatedDramas}
                      </span>
                    </div>

                    <div className="p-4 rounded-xl bg-surface-elevated/40 border border-border">
                      <span className="text-xs text-text-muted block">Episodes Processed</span>
                      <span className="text-2xl font-bold text-purple-400 mt-1 block">
                        +{executionResult.createdEpisodes + executionResult.updatedEpisodes}
                      </span>
                    </div>

                    <div className="p-4 rounded-xl bg-surface-elevated/40 border border-border">
                      <span className="text-xs text-text-muted block">Unchanged Skipped</span>
                      <span className="text-2xl font-bold text-text-muted mt-1 block">
                        {executionResult.unchangedRecords}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-3 pt-4">
                    <Link
                      href="/admin/dramas"
                      className="px-5 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors inline-flex items-center gap-2"
                    >
                      <Film size={15} />
                      View in Dramas Catalog
                    </Link>
                    <button
                      onClick={() => {
                        setStep(1);
                        setValidationReport(null);
                        setExecutionResult(null);
                      }}
                      className="px-5 py-2.5 rounded-lg bg-surface border border-border text-sm font-semibold text-text hover:bg-surface-hover transition-colors"
                    >
                      Import Another Manifest
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* HISTORY TAB */}
          {activeTab === "history" && (
            <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h3 className="font-semibold text-sm text-text">Past Import Jobs</h3>
                <button
                  onClick={fetchHistory}
                  disabled={loadingHistory}
                  className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
                  aria-label="Refresh job history"
                >
                  <RefreshCw size={15} className={loadingHistory ? "animate-spin" : ""} />
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border bg-surface-elevated/40 text-text-muted text-xs font-semibold uppercase tracking-wider">
                      <th className="py-3 px-4">Job ID</th>
                      <th className="py-3 px-4">Source Format</th>
                      <th className="py-3 px-4">File Name</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Dramas</th>
                      <th className="py-3 px-4">Episodes</th>
                      <th className="py-3 px-4">Executed At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {loadingHistory && historyJobs.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-text-muted">
                          <Loader2 size={24} className="animate-spin mx-auto mb-2 text-primary" />
                          <p>Loading import history...</p>
                        </td>
                      </tr>
                    ) : historyJobs.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-text-muted">
                          <History size={36} className="mx-auto mb-3 opacity-30" />
                          <p className="font-semibold text-text">No past import jobs found</p>
                          <p className="text-xs mt-1">Execute a manifest import to view historical job records.</p>
                        </td>
                      </tr>
                    ) : (
                      historyJobs.map((job) => (
                        <tr key={job.id} className="hover:bg-surface-hover/50 transition-colors">
                          <td className="py-3 px-4 font-mono text-xs font-semibold text-text">
                            #{job.id.slice(0, 8)}
                          </td>
                          <td className="py-3 px-4 uppercase text-xs font-medium text-text-muted">
                            {job.sourceName}
                          </td>
                          <td className="py-3 px-4 text-xs text-text font-medium">
                            {job.fileName || "manifest"}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                                job.status === "completed"
                                  ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                                  : job.status === "processing"
                                  ? "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                                  : "bg-danger/10 text-danger border border-danger/20"
                              }`}
                            >
                              {job.status === "completed" && <CheckCircle2 size={11} />}
                              {job.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-xs">
                            <span className="text-primary font-semibold">+{job.createdDramas}</span>
                            <span className="text-text-muted ml-1">/ {job.totalDramas}</span>
                          </td>
                          <td className="py-3 px-4 text-xs">
                            <span className="text-purple-400 font-semibold">+{job.createdEpisodes}</span>
                            <span className="text-text-muted ml-1">/ {job.totalEpisodes}</span>
                          </td>
                          <td className="py-3 px-4 text-xs text-text-muted">
                            {new Date(job.createdAt).toLocaleString(undefined, {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
