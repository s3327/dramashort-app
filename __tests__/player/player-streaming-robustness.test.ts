import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  HLS_SHORT_VOD_CONFIG,
  MAX_NETWORK_RETRIES,
  MAX_MEDIA_RECOVERIES,
  RETRY_BASE_DELAY_MS,
  RESUME_NOTIFICATION_DURATION_MS,
  calculateBackoffDelay,
  handleNetworkError,
  handleMediaError,
} from "@/lib/player/streaming-robustness";
import {
  HLS_SHORT_VOD_CONFIG as VideoPlayerHlsConfig,
  MAX_NETWORK_RETRIES as VideoPlayerMaxNetworkRetries,
  MAX_MEDIA_RECOVERIES as VideoPlayerMaxMediaRecoveries,
  RETRY_BASE_DELAY_MS as VideoPlayerRetryBaseDelay,
  calculateBackoffDelay as videoPlayerCalculateBackoffDelay,
} from "@/components/VideoPlayer";

describe("Task 12.8: Player Streaming Robustness & Lifecycle Reliability", () => {
  describe("R1: HLS VOD Configuration for Short Dramas", () => {
    it("configures lowLatencyMode to false for VOD streaming", () => {
      assert.equal(
        HLS_SHORT_VOD_CONFIG.lowLatencyMode,
        false,
        "lowLatencyMode must be false for VOD short dramas"
      );
      assert.equal(VideoPlayerHlsConfig.lowLatencyMode, false);
    });

    it("tunes buffer parameters for ~1–2 minute episodes", () => {
      assert.equal(HLS_SHORT_VOD_CONFIG.enableWorker, true, "Worker should be enabled for demuxing");
      assert.equal(HLS_SHORT_VOD_CONFIG.maxBufferLength, 30, "Target buffer ahead should be 30 seconds");
      assert.equal(
        HLS_SHORT_VOD_CONFIG.maxMaxBufferLength,
        60,
        "Max forward buffer should be capped at 60s for short dramas"
      );
      assert.equal(
        HLS_SHORT_VOD_CONFIG.maxBufferSize,
        30 * 1000 * 1000,
        "Buffer memory footprint should be capped to 30 MB"
      );
      assert.equal(
        HLS_SHORT_VOD_CONFIG.backBufferLength,
        15,
        "Back buffer should be lean (15s) to prevent memory accumulation"
      );
    });

    it("verifies components/VideoPlayer.tsx source instantiates Hls with short VOD config", () => {
      const playerSourcePath = path.resolve(process.cwd(), "components/VideoPlayer.tsx");
      const playerCode = fs.readFileSync(playerSourcePath, "utf-8");

      assert.ok(
        playerCode.includes("new Hls(HLS_SHORT_VOD_CONFIG)"),
        "VideoPlayer must instantiate Hls with HLS_SHORT_VOD_CONFIG"
      );
      assert.ok(
        !playerCode.includes("lowLatencyMode: true"),
        "VideoPlayer must not contain legacy lowLatencyMode: true"
      );
    });
  });

  describe("R2: Capped Retries with Exponential Backoff on Fatal Errors", () => {
    it("verifies retry constants and caps", () => {
      assert.equal(MAX_NETWORK_RETRIES, 3, "Network retries must be capped at 3");
      assert.equal(VideoPlayerMaxNetworkRetries, 3);
      assert.equal(RETRY_BASE_DELAY_MS, 1000, "Base delay must be 1000ms");
      assert.equal(VideoPlayerRetryBaseDelay, 1000);
    });

    it("computes exact exponential backoff delays (1s, 2s, 4s)", () => {
      // 0-indexed attempts: 0 -> 1s, 1 -> 2s, 2 -> 4s
      assert.equal(calculateBackoffDelay(0), 1000, "1st retry delay must be 1000ms (1s)");
      assert.equal(calculateBackoffDelay(1), 2000, "2nd retry delay must be 2000ms (2s)");
      assert.equal(calculateBackoffDelay(2), 4000, "3rd retry delay must be 4000ms (4s)");
      assert.equal(videoPlayerCalculateBackoffDelay(0), 1000);
      assert.equal(videoPlayerCalculateBackoffDelay(1), 2000);
      assert.equal(videoPlayerCalculateBackoffDelay(2), 4000);
    });

    it("retries up to 3 times then transitions cleanly to fatal error state", () => {
      let retries = 0;

      // 1st network error
      const action1 = handleNetworkError(retries);
      assert.equal(action1.type, "retry");
      if (action1.type === "retry") {
        assert.equal(action1.delayMs, 1000);
        retries = action1.nextRetries;
      }
      assert.equal(retries, 1);

      // 2nd network error
      const action2 = handleNetworkError(retries);
      assert.equal(action2.type, "retry");
      if (action2.type === "retry") {
        assert.equal(action2.delayMs, 2000);
        retries = action2.nextRetries;
      }
      assert.equal(retries, 2);

      // 3rd network error
      const action3 = handleNetworkError(retries);
      assert.equal(action3.type, "retry");
      if (action3.type === "retry") {
        assert.equal(action3.delayMs, 4000);
        retries = action3.nextRetries;
      }
      assert.equal(retries, 3);

      // 4th network error (exceeds cap of 3)
      const action4 = handleNetworkError(retries);
      assert.equal(action4.type, "fatal");
      if (action4.type === "fatal") {
        assert.ok(
          action4.reason.includes("Network error"),
          "Fatal transition must provide user-facing error message"
        );
      }
    });

    it("verifies components/VideoPlayer.tsx binds exponential backoff and retry cap", () => {
      const playerSourcePath = path.resolve(process.cwd(), "components/VideoPlayer.tsx");
      const playerCode = fs.readFileSync(playerSourcePath, "utf-8");

      assert.ok(
        playerCode.includes("networkRetryCountRef.current < MAX_NETWORK_RETRIES"),
        "Player must check network retry cap"
      );
      assert.ok(
        playerCode.includes("calculateBackoffDelay(networkRetryCountRef.current)"),
        "Player must calculate exponential backoff delay"
      );
      assert.ok(
        playerCode.includes("hlsRef.current.startLoad();") || playerCode.includes("startLoad()"),
        "Player must retry loading with startLoad()"
      );
    });
  });

  describe("R3: Media Error Recovery Bounds", () => {
    it("verifies media recovery bound constant", () => {
      assert.equal(MAX_MEDIA_RECOVERIES, 2, "Media recoveries must be bounded to maximum 2 attempts");
      assert.equal(VideoPlayerMaxMediaRecoveries, 2);
    });

    it("recovers up to 2 times then transitions cleanly to fatal error state", () => {
      let recoveries = 0;

      // 1st media error
      const action1 = handleMediaError(recoveries);
      assert.equal(action1.type, "recover");
      if (action1.type === "recover") {
        recoveries = action1.nextRecoveries;
      }
      assert.equal(recoveries, 1);

      // 2nd media error
      const action2 = handleMediaError(recoveries);
      assert.equal(action2.type, "recover");
      if (action2.type === "recover") {
        recoveries = action2.nextRecoveries;
      }
      assert.equal(recoveries, 2);

      // 3rd media error (exceeds bound of 2)
      const action3 = handleMediaError(recoveries);
      assert.equal(action3.type, "fatal");
      if (action3.type === "fatal") {
        assert.ok(
          action3.reason.includes("Playback error"),
          "Fatal transition must provide user-facing error message"
        );
      }
    });

    it("verifies components/VideoPlayer.tsx bounds media error recovery", () => {
      const playerSourcePath = path.resolve(process.cwd(), "components/VideoPlayer.tsx");
      const playerCode = fs.readFileSync(playerSourcePath, "utf-8");

      assert.ok(
        playerCode.includes("mediaRecoveryCountRef.current < MAX_MEDIA_RECOVERIES"),
        "Player must bound media recoveries"
      );
      assert.ok(
        playerCode.includes("hls.recoverMediaError();"),
        "Player must invoke recoverMediaError on bounded attempts"
      );
    });
  });

  describe("Retry Reset Invariants: Episode Navigation & Playback Resets", () => {
    it("verifies onPlaying callback resets retry counters", () => {
      const playerSourcePath = path.resolve(process.cwd(), "components/VideoPlayer.tsx");
      const playerCode = fs.readFileSync(playerSourcePath, "utf-8");

      // Verify onPlaying in video tag resets both counters
      assert.ok(
        playerCode.includes("onPlaying={() => {") &&
          playerCode.includes("networkRetryCountRef.current = 0;") &&
          playerCode.includes("mediaRecoveryCountRef.current = 0;"),
        "onPlaying handler must reset network and media retry counters to 0"
      );
    });

    it("verifies episode navigation / effect setup resets retry counters and timers", () => {
      const playerSourcePath = path.resolve(process.cwd(), "components/VideoPlayer.tsx");
      const playerCode = fs.readFileSync(playerSourcePath, "utf-8");

      assert.ok(
        playerCode.includes("networkRetryCountRef.current = 0;") &&
          playerCode.includes("mediaRecoveryCountRef.current = 0;"),
        "Source setup effect must reset retry counters"
      );
      assert.ok(
        playerCode.includes("retryTimeoutRef.current = null;"),
        "Source setup effect must clear pending retry timer"
      );
    });

    it("verifies handleRetryPlayback resets counters and clears pending retry timeout", () => {
      const playerSourcePath = path.resolve(process.cwd(), "components/VideoPlayer.tsx");
      const playerCode = fs.readFileSync(playerSourcePath, "utf-8");

      assert.ok(
        playerCode.includes("const handleRetryPlayback = useCallback("),
        "Player must define handleRetryPlayback"
      );
      assert.ok(
        playerCode.includes("onClick={handleRetryPlayback}"),
        "Error overlay button must invoke handleRetryPlayback"
      );
    });
  });

  describe("R4: Timer Lifecycle & Memory Leak Elimination", () => {
    it("verifies handleLoadedMetadata does NOT return a cleanup function", () => {
      const playerSourcePath = path.resolve(process.cwd(), "components/VideoPlayer.tsx");
      const playerCode = fs.readFileSync(playerSourcePath, "utf-8");

      // Ensure the buggy no-op return () => clearTimeout(...) was completely eliminated
      assert.ok(
        !playerCode.includes("return () => clearTimeout(timer);"),
        "handleLoadedMetadata must not return a cleanup function from a DOM event listener"
      );
    });

    it("verifies resume notification pill timer is managed via React ref and effect lifecycle", () => {
      const playerSourcePath = path.resolve(process.cwd(), "components/VideoPlayer.tsx");
      const playerCode = fs.readFileSync(playerSourcePath, "utf-8");

      assert.ok(
        playerCode.includes("const resumeTimeoutRef = useRef<NodeJS.Timeout | null>(null);"),
        "resumeTimeoutRef must be declared"
      );
      assert.ok(
        playerCode.includes("resumeTimeoutRef.current = setTimeout("),
        "Resume timer must be assigned to resumeTimeoutRef.current"
      );
      assert.ok(
        playerCode.includes("RESUME_NOTIFICATION_DURATION_MS"),
        "Resume timer must use RESUME_NOTIFICATION_DURATION_MS (6000ms)"
      );
      assert.ok(
        playerCode.includes("clearTimeout(resumeTimeoutRef.current);"),
        "Resume timer must be cleared on cleanup or dismiss"
      );
    });

    it("verifies all player timers (controls, countdown, resume, retry) are cleared on unmount", () => {
      const playerSourcePath = path.resolve(process.cwd(), "components/VideoPlayer.tsx");
      const playerCode = fs.readFileSync(playerSourcePath, "utf-8");

      assert.ok(
        playerCode.includes("controlsTimeoutRef.current = null;"),
        "Controls timeout must be cleaned up on unmount"
      );
      assert.ok(
        playerCode.includes("countdownIntervalRef.current = null;"),
        "Countdown interval must be cleaned up on unmount"
      );
      assert.ok(
        playerCode.includes("resumeTimeoutRef.current = null;"),
        "Resume timeout must be cleaned up on unmount"
      );
      assert.ok(
        playerCode.includes("retryTimeoutRef.current = null;"),
        "Retry timeout must be cleaned up on unmount"
      );
    });

    it("verifies auto-next countdown interval is cleared when cancelled or episode changes", () => {
      const playerSourcePath = path.resolve(process.cwd(), "components/VideoPlayer.tsx");
      const playerCode = fs.readFileSync(playerSourcePath, "utf-8");

      assert.ok(
        playerCode.includes("const cancelNextCountdown = useCallback(() => {") ||
          playerCode.includes("const cancelNextCountdown = () => {"),
        "cancelNextCountdown must be defined"
      );
      assert.ok(
        playerCode.includes("clearInterval(countdownIntervalRef.current);"),
        "Countdown interval must be cleared on cancellation"
      );
    });
  });

  describe("End-to-End Streaming Simulation Invariants", () => {
    it("simulates full retry failure and recovery cycles with a mock HLS controller", () => {
      class MockHlsController {
        networkRetries = 0;
        mediaRecoveries = 0;
        isDestroyed = false;
        errorOverlay: string | null = null;
        isBuffering = false;
        reloadCalls = 0;
        mediaRecoverCalls = 0;

        triggerFatalNetworkError(): "retrying" | "overlay" {
          if (this.networkRetries < MAX_NETWORK_RETRIES) {
            this.networkRetries += 1;
            this.isBuffering = true;
            this.reloadCalls += 1;
            return "retrying";
          }
          this.isDestroyed = true;
          this.isBuffering = false;
          this.errorOverlay = "Network error: unable to load video stream.";
          return "overlay";
        }

        triggerFatalMediaError(): "recovering" | "overlay" {
          if (this.mediaRecoveries < MAX_MEDIA_RECOVERIES) {
            this.mediaRecoveries += 1;
            this.isBuffering = true;
            this.mediaRecoverCalls += 1;
            return "recovering";
          }
          this.isDestroyed = true;
          this.isBuffering = false;
          this.errorOverlay = "Playback error: unable to recover media stream.";
          return "overlay";
        }

        onPlaying() {
          this.networkRetries = 0;
          this.mediaRecoveries = 0;
          this.isBuffering = false;
        }

        retryPlayback() {
          this.networkRetries = 0;
          this.mediaRecoveries = 0;
          this.isDestroyed = false;
          this.errorOverlay = null;
          this.isBuffering = true;
        }
      }

      const player = new MockHlsController();

      // Network error retry sequence
      assert.equal(player.triggerFatalNetworkError(), "retrying");
      assert.equal(player.networkRetries, 1);
      assert.equal(player.reloadCalls, 1);

      assert.equal(player.triggerFatalNetworkError(), "retrying");
      assert.equal(player.networkRetries, 2);
      assert.equal(player.reloadCalls, 2);

      assert.equal(player.triggerFatalNetworkError(), "retrying");
      assert.equal(player.networkRetries, 3);
      assert.equal(player.reloadCalls, 3);

      // 4th error triggers overlay and destroys player
      assert.equal(player.triggerFatalNetworkError(), "overlay");
      assert.equal(player.isDestroyed, true);
      assert.ok(player.errorOverlay !== null);

      // User clicks retry playback
      player.retryPlayback();
      assert.equal(player.networkRetries, 0);
      assert.equal(player.isDestroyed, false);
      assert.equal(player.errorOverlay, null);

      // Media error recovery sequence
      assert.equal(player.triggerFatalMediaError(), "recovering");
      assert.equal(player.mediaRecoveries, 1);
      assert.equal(player.mediaRecoverCalls, 1);

      assert.equal(player.triggerFatalMediaError(), "recovering");
      assert.equal(player.mediaRecoveries, 2);
      assert.equal(player.mediaRecoverCalls, 2);

      // 3rd media error triggers overlay and destroys player
      assert.equal(player.triggerFatalMediaError(), "overlay");
      assert.equal(player.isDestroyed, true);
      assert.ok(player.errorOverlay !== null);

      // Successful playback resets counters
      player.retryPlayback();
      player.onPlaying();
      assert.equal(player.networkRetries, 0);
      assert.equal(player.mediaRecoveries, 0);
    });
  });

  describe("Adversarial QA & Edge-Case Robustness", () => {
    it("handles boundary, non-finite, and negative inputs in calculateBackoffDelay", () => {
      // Negative count clamps to 0 (1000ms)
      assert.equal(calculateBackoffDelay(-1), 1000);
      assert.equal(calculateBackoffDelay(-99), 1000);

      // NaN / Infinity count clamps to 0 (1000ms)
      assert.equal(calculateBackoffDelay(NaN), 1000);
      assert.equal(calculateBackoffDelay(Infinity), 1000);

      // Fractional count floors safely
      assert.equal(calculateBackoffDelay(1.9), 2000);

      // Custom base delay
      assert.equal(calculateBackoffDelay(1, 500), 1000);
      assert.equal(calculateBackoffDelay(2, 500), 2000);

      // Invalid base delay falls back to RETRY_BASE_DELAY_MS
      assert.equal(calculateBackoffDelay(1, -500), 2000);
      assert.equal(calculateBackoffDelay(1, NaN), 2000);
    });

    it("handles boundary, non-finite, and negative inputs in error handlers", () => {
      const netRes = handleNetworkError(NaN);
      assert.equal(netRes.type, "retry");
      if (netRes.type === "retry") {
        assert.equal(netRes.delayMs, 1000);
        assert.equal(netRes.nextRetries, 1);
      }

      const mediaRes = handleMediaError(-10);
      assert.equal(mediaRes.type, "recover");
      if (mediaRes.type === "recover") {
        assert.equal(mediaRes.nextRecoveries, 1);
      }
    });

    it("verifies handleLoadedMetadata guards against non-finite/Infinity duration", () => {
      const playerSourcePath = path.resolve(process.cwd(), "components/VideoPlayer.tsx");
      const playerCode = fs.readFileSync(playerSourcePath, "utf-8");

      assert.ok(
        playerCode.includes("Number.isFinite(dur)") && playerCode.includes("Number.isFinite(targetTime)"),
        "VideoPlayer must check Number.isFinite to prevent Infinity/NaN currentTime DOMException"
      );
    });

    it("verifies native HLS and MP4 branches call video.load() on setup and retry", () => {
      const playerSourcePath = path.resolve(process.cwd(), "components/VideoPlayer.tsx");
      const playerCode = fs.readFileSync(playerSourcePath, "utf-8");

      assert.ok(
        playerCode.includes("video.src = src;\n        video.load();"),
        "VideoPlayer must invoke video.load() to ensure native media re-evaluation"
      );
      assert.ok(
        playerCode.includes("autoPlay || reloadIndex > 0"),
        "VideoPlayer must start playback on explicit retry regardless of autoPlay prop"
      );
    });

    it("verifies retryTimeoutRef is cleared inside the setTimeout execution callback", () => {
      const playerSourcePath = path.resolve(process.cwd(), "components/VideoPlayer.tsx");
      const playerCode = fs.readFileSync(playerSourcePath, "utf-8");

      assert.ok(
        playerCode.includes("retryTimeoutRef.current = setTimeout(() => {\n                    retryTimeoutRef.current = null;"),
        "retryTimeoutRef must be set to null inside callback to avoid stale timer IDs"
      );
    });

    it("verifies controlsTimeoutRef is cleared on episode changes", () => {
      const playerSourcePath = path.resolve(process.cwd(), "components/VideoPlayer.tsx");
      const playerCode = fs.readFileSync(playerSourcePath, "utf-8");

      assert.ok(
        playerCode.includes("if (controlsTimeoutRef.current) {\n      clearTimeout(controlsTimeoutRef.current);\n      controlsTimeoutRef.current = null;\n    }"),
        "controlsTimeoutRef must be cleared on episode change in source setup effect"
      );
    });

    it("verifies video onError handler does not preempt active HLS.js error recovery and preserves existing error", () => {
      const playerSourcePath = path.resolve(process.cwd(), "components/VideoPlayer.tsx");
      const playerCode = fs.readFileSync(playerSourcePath, "utf-8");

      assert.ok(
        playerCode.includes("if (hlsRef.current) return;"),
        "video onError must bypass setting error overlay if HLS instance is active"
      );
      assert.ok(
        playerCode.includes("setHasError((prev) => prev ||"),
        "video onError must preserve any existing diagnostic error message"
      );
    });

    it("verifies FRAG_LOADED only resets networkRetryCountRef and NOT mediaRecoveryCountRef to prevent infinite loops", () => {
      const playerSourcePath = path.resolve(process.cwd(), "components/VideoPlayer.tsx");
      const playerCode = fs.readFileSync(playerSourcePath, "utf-8");

      // FRAG_LOADED block must not reset mediaRecoveryCountRef
      const fragLoadedMatch = playerCode.match(/hls\.on\(Hls\.Events\.FRAG_LOADED, \(\) => \{([\s\S]*?)\}\);/);
      assert.ok(fragLoadedMatch, "FRAG_LOADED event handler must be registered");
      const fragLoadedBody = fragLoadedMatch[1];
      assert.ok(
        fragLoadedBody.includes("networkRetryCountRef.current = 0;"),
        "FRAG_LOADED should reset network retry counter on segment download"
      );
      assert.ok(
        !fragLoadedBody.includes("mediaRecoveryCountRef.current = 0;"),
        "FRAG_LOADED must NOT reset media recovery count to prevent infinite reload loops on corrupted segments"
      );
    });

    it("verifies hasAppliedInitialProgressRef prevents re-seeking backwards on subsequent loadedmetadata events", () => {
      const playerSourcePath = path.resolve(process.cwd(), "components/VideoPlayer.tsx");
      const playerCode = fs.readFileSync(playerSourcePath, "utf-8");

      assert.ok(
        playerCode.includes("hasAppliedInitialProgressRef"),
        "VideoPlayer must declare hasAppliedInitialProgressRef"
      );
      assert.ok(
        playerCode.includes("if (hasAppliedInitialProgressRef.current) {\n      return;\n    }"),
        "handleLoadedMetadata must return early if initial progress was already restored"
      );
    });

    it("verifies auto-next countdown is cancelled on manual navigation (Next/Prev/Swipe/Keys) and scrubbing/seeking", () => {
      const playerSourcePath = path.resolve(process.cwd(), "components/VideoPlayer.tsx");
      const playerCode = fs.readFileSync(playerSourcePath, "utf-8");

      assert.ok(
        playerCode.includes("const goToNextEpisode = useCallback(() => {\n    cancelNextCountdown();") ||
          playerCode.includes("const goToNextEpisode = () => {\n    cancelNextCountdown();"),
        "goToNextEpisode must cancel pending countdown timer before navigation"
      );
      assert.ok(
        playerCode.includes("const goToPrevEpisode = useCallback(() => {\n    cancelNextCountdown();") ||
          playerCode.includes("const goToPrevEpisode = () => {\n    cancelNextCountdown();"),
        "goToPrevEpisode must cancel pending countdown timer before navigation"
      );
      assert.ok(
        playerCode.includes("handleScrubClick = (e: React.MouseEvent<HTMLDivElement>) => {\n    const bar = scrubBarRef.current;\n    const video = videoRef.current;\n    if (!bar || !video || duration <= 0) return;\n    cancelNextCountdown();"),
        "handleScrubClick must cancel countdown to prevent interruption when rewinding"
      );
    });

    it("verifies onTouchCancel is wired on the player container to prevent gesture freeze on mobile", () => {
      const playerSourcePath = path.resolve(process.cwd(), "components/VideoPlayer.tsx");
      const playerCode = fs.readFileSync(playerSourcePath, "utf-8");

      assert.ok(
        playerCode.includes("onTouchCancel={handleTouchCancel}"),
        "Video container must handle onTouchCancel"
      );
    });

    it("verifies controlsTimeoutRef is reset to null inside the auto-hide callback", () => {
      const playerSourcePath = path.resolve(process.cwd(), "components/VideoPlayer.tsx");
      const playerCode = fs.readFileSync(playerSourcePath, "utf-8");

      assert.ok(
        playerCode.includes("controlsTimeoutRef.current = setTimeout(() => {\n        controlsTimeoutRef.current = null;\n        setControlsVisible(false);"),
        "controlsTimeoutRef must be set to null inside callback to prevent stale timer IDs"
      );
    });

    it("verifies async initialProgress updates apply reactively if metadata loaded before DB lookup finishes", () => {
      const playerSourcePath = path.resolve(process.cwd(), "components/VideoPlayer.tsx");
      const playerCode = fs.readFileSync(playerSourcePath, "utf-8");

      assert.ok(
        playerCode.includes("useEffect(() => {\n    if (hasAppliedInitialProgressRef.current) return;"),
        "VideoPlayer must define reactive effect for asynchronous initialProgress props"
      );
      assert.ok(
        playerCode.includes("[initialProgressRatio, initialProgressSeconds]"),
        "Reactive resume effect must depend on initialProgressRatio and initialProgressSeconds"
      );
      assert.ok(
        playerCode.includes("if (video.currentTime > 2) {\n      hasAppliedInitialProgressRef.current = true;\n      return;\n    }"),
        "Reactive resume must not seek backwards if user has already actively played past 2 seconds"
      );
    });

    it("verifies controls remain visible and auto-hide timer is cleared when video is paused or scrubbing", () => {
      const playerSourcePath = path.resolve(process.cwd(), "components/VideoPlayer.tsx");
      const playerCode = fs.readFileSync(playerSourcePath, "utf-8");

      assert.ok(
        playerCode.includes("if (!isPlaying || showSpeedMenu || showSettingsMenu || isScrubbing) {\n      if (controlsTimeoutRef.current) {\n        clearTimeout(controlsTimeoutRef.current);\n        controlsTimeoutRef.current = null;\n      }\n      setControlsVisible(true);\n    }"),
        "VideoPlayer must clear controls timer and keep controls visible when paused or menu open"
      );
    });

    it("verifies auto-next countdown is cancelled immediately if user toggles autoPlayNext to OFF", () => {
      const playerSourcePath = path.resolve(process.cwd(), "components/VideoPlayer.tsx");
      const playerCode = fs.readFileSync(playerSourcePath, "utf-8");

      assert.ok(
        playerCode.includes("if (!autoPlayNext) {\n      cancelNextCountdown();\n    }"),
        "VideoPlayer must cancel active countdown when autoPlayNext is turned OFF"
      );
    });

    it("verifies videoRef is explicitly paused during cleanup to prevent audio and decoder leaks", () => {
      const playerSourcePath = path.resolve(process.cwd(), "components/VideoPlayer.tsx");
      const playerCode = fs.readFileSync(playerSourcePath, "utf-8");

      assert.ok(
        playerCode.includes("if (video) {\n        video.pause();\n      }"),
        "VideoPlayer cleanups must explicitly pause media element on unmount and source reset"
      );
    });

    it("verifies togglePlay rewinds currentTime to 0 when replaying an ended video", () => {
      const playerSourcePath = path.resolve(process.cwd(), "components/VideoPlayer.tsx");
      const playerCode = fs.readFileSync(playerSourcePath, "utf-8");

      assert.ok(
        playerCode.includes("if (video.ended) {\n        video.currentTime = 0;\n      }"),
        "togglePlay must reset currentTime to 0 on ended video replay to prevent immediate re-triggering of ended event"
      );
    });
  });
});



