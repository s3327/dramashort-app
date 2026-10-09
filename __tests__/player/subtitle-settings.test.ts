import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  timeStringToSeconds,
  secondsToVttTime,
  parseVtt,
  parseSrt,
  parseVttOrSrt,
  findActiveCue,
  generateVttContent,
  getDefaultDemoTracks,
} from "../../lib/player/subtitles";
import {
  loadSubtitleSettings,
  saveSubtitleSettings,
  DEFAULT_SUBTITLE_SETTINGS,
  SUBTITLE_SETTINGS_STORAGE_KEY,
  type SubtitleSettings,
} from "../../types/subtitles";

describe("Task 9.2: Subtitle Engine & Settings Tests", () => {
  // In-memory localStorage mock for node test runner
  const storageMock: Record<string, string> = {};
  beforeEach(() => {
    for (const key of Object.keys(storageMock)) {
      delete storageMock[key];
    }
    (globalThis as any).window = {};
    (globalThis as any).localStorage = {
      getItem: (key: string) => storageMock[key] ?? null,
      setItem: (key: string, val: string) => {
        storageMock[key] = val;
      },
      removeItem: (key: string) => {
        delete storageMock[key];
      },
      clear: () => {
        for (const key of Object.keys(storageMock)) {
          delete storageMock[key];
        }
      },
    };
  });

  describe("Time parsing and formatting", () => {
    test("timeStringToSeconds correctly parses HH:MM:SS.mmm", () => {
      assert.equal(timeStringToSeconds("00:01:23.456"), 83.456);
      assert.equal(timeStringToSeconds("01:00:00.000"), 3600);
      assert.equal(timeStringToSeconds("01:02:03.500"), 3723.5);
    });

    test("timeStringToSeconds correctly parses MM:SS.mmm", () => {
      assert.equal(timeStringToSeconds("02:15.500"), 135.5);
      assert.equal(timeStringToSeconds("00:05.000"), 5);
    });

    test("timeStringToSeconds handles SRT comma decimal separator", () => {
      assert.equal(timeStringToSeconds("00:01:23,456"), 83.456);
      assert.equal(timeStringToSeconds("02:10,250"), 130.25);
    });

    test("timeStringToSeconds handles edge cases and empty strings", () => {
      assert.equal(timeStringToSeconds(""), 0);
      assert.equal(timeStringToSeconds("invalid"), 0);
    });

    test("secondsToVttTime formats seconds to standard WebVTT timestamp", () => {
      assert.equal(secondsToVttTime(0), "00:00:00.000");
      assert.equal(secondsToVttTime(83.456), "00:01:23.456");
      assert.equal(secondsToVttTime(3723.5), "01:02:03.500");
    });
  });

  describe("WebVTT and SRT Parsing", () => {
    test("parseVtt extracts cues from standard WebVTT text", () => {
      const vtt = `WEBVTT

1
00:00:01.000 --> 00:00:04.500
Hello, welcome to DramaShort!

2
00:00:05.200 --> 00:00:08.800
This is episode 1.
Enjoy the show!
`;
      const cues = parseVtt(vtt);
      assert.equal(cues.length, 2);
      assert.equal(cues[0].startTime, 1.0);
      assert.equal(cues[0].endTime, 4.5);
      assert.equal(cues[0].text, "Hello, welcome to DramaShort!");

      assert.equal(cues[1].startTime, 5.2);
      assert.equal(cues[1].endTime, 8.8);
      assert.equal(cues[1].text, "This is episode 1.\nEnjoy the show!");
    });

    test("parseVtt ignores NOTE comments in WebVTT", () => {
      const vtt = `WEBVTT
NOTE This is a commentary block

00:00:02.000 --> 00:00:04.000
Valid cue
`;
      const cues = parseVtt(vtt);
      assert.equal(cues.length, 1);
      assert.equal(cues[0].text, "Valid cue");
    });

    test("parseSrt parses SubRip subtitles with comma separators", () => {
      const srt = `1
00:00:02,500 --> 00:00:06,000
Who sent you here?

2
00:00:07,000 --> 00:00:10,500
I can't tell you that.
`;
      const cues = parseSrt(srt);
      assert.equal(cues.length, 2);
      assert.equal(cues[0].startTime, 2.5);
      assert.equal(cues[0].endTime, 6.0);
      assert.equal(cues[0].text, "Who sent you here?");
      assert.equal(cues[1].startTime, 7.0);
      assert.equal(cues[1].endTime, 10.5);
      assert.equal(cues[1].text, "I can't tell you that.");
    });

    test("parseVttOrSrt handles either format gracefully", () => {
      const vtt = `WEBVTT\n\n00:01.000 --> 00:03.000\nDialogue`;
      const cues = parseVttOrSrt(vtt);
      assert.equal(cues.length, 1);
      assert.equal(cues[0].text, "Dialogue");
    });
  });

  describe("Active Cue Matching", () => {
    const cues = [
      { startTime: 2.0, endTime: 5.0, text: "First line" },
      { startTime: 8.0, endTime: 12.0, text: "Second line" },
    ];

    test("findActiveCue matches current time inside cue range", () => {
      const cue = findActiveCue(cues, 3.5);
      assert.ok(cue);
      assert.equal(cue?.text, "First line");
    });

    test("findActiveCue matches exact boundary times", () => {
      assert.equal(findActiveCue(cues, 2.0)?.text, "First line");
      assert.equal(findActiveCue(cues, 5.0)?.text, "First line");
    });

    test("findActiveCue returns null in gaps or outside range", () => {
      assert.equal(findActiveCue(cues, 0.5), null); // Before first cue
      assert.equal(findActiveCue(cues, 6.5), null); // In gap between 5.0 and 8.0
      assert.equal(findActiveCue(cues, 15.0), null); // After last cue
    });

    test("findActiveCue handles empty cues or invalid times safely", () => {
      assert.equal(findActiveCue([], 3.0), null);
      assert.equal(findActiveCue(undefined, 3.0), null);
      assert.equal(findActiveCue(cues, -1), null);
      assert.equal(findActiveCue(cues, NaN), null);
    });
  });

  describe("VTT Content Generation", () => {
    test("generateVttContent outputs valid WebVTT and roundtrips through parseVtt", () => {
      const originalCues = [
        { startTime: 1.0, endTime: 3.5, text: "Line 1" },
        { startTime: 4.0, endTime: 8.2, text: "Line 2\nLine 2 continued" },
      ];

      const vttString = generateVttContent(originalCues);
      assert.ok(vttString.startsWith("WEBVTT"));
      assert.ok(vttString.includes("00:00:01.000 --> 00:00:03.500"));

      const parsedCues = parseVtt(vttString);
      assert.equal(parsedCues.length, 2);
      assert.equal(parsedCues[0].startTime, 1.0);
      assert.equal(parsedCues[0].endTime, 3.5);
      assert.equal(parsedCues[0].text, "Line 1");
      assert.equal(parsedCues[1].text, "Line 2\nLine 2 continued");
    });
  });

  describe("Demo Multilingual Tracks", () => {
    test("getDefaultDemoTracks generates tracks for en, id, es, zh", () => {
      const tracks = getDefaultDemoTracks("The CEO's Secret Wife", 3);
      assert.equal(tracks.length, 4);

      const langs = tracks.map((t) => t.language);
      assert.ok(langs.includes("en"));
      assert.ok(langs.includes("id"));
      assert.ok(langs.includes("es"));
      assert.ok(langs.includes("zh"));

      tracks.forEach((track) => {
        assert.ok(track.cues && track.cues.length > 0, `Track ${track.language} should have cues`);
        assert.ok(track.src, `Track ${track.language} should have src URL`);
        // Check timing monotonicity
        track.cues?.forEach((cue) => {
          assert.ok(cue.startTime < cue.endTime, "Cue start time must be before end time");
          assert.ok(cue.text.length > 0, "Cue text must not be empty");
        });
      });
    });
  });

  describe("Settings Persistence", () => {
    test("loadSubtitleSettings returns defaults when storage is empty", () => {
      const settings = loadSubtitleSettings();
      assert.deepEqual(settings, DEFAULT_SUBTITLE_SETTINGS);
      assert.equal(settings.language, "en");
      assert.equal(settings.fontSize, "medium");
      assert.equal(settings.textColor, "white");
      assert.equal(settings.backgroundColor, "semi-black");
    });

    test("saveSubtitleSettings saves to localStorage and loadSubtitleSettings retrieves it", () => {
      const customSettings: SubtitleSettings = {
        language: "es",
        fontSize: "large",
        textColor: "yellow",
        backgroundColor: "solid-black",
      };

      saveSubtitleSettings(customSettings);
      const retrieved = loadSubtitleSettings();
      assert.deepEqual(retrieved, customSettings);
    });

    test("loadSubtitleSettings validates and sanitizes corrupt storage data", () => {
      storageMock[SUBTITLE_SETTINGS_STORAGE_KEY] = JSON.stringify({
        language: "id",
        fontSize: "giant_invalid_size",
        textColor: "purple_invalid",
        backgroundColor: "blurry_invalid",
      });

      const retrieved = loadSubtitleSettings();
      assert.equal(retrieved.language, "id");
      assert.equal(retrieved.fontSize, "medium"); // sanitized to default
      assert.equal(retrieved.textColor, "white"); // sanitized to default
      assert.equal(retrieved.backgroundColor, "semi-black"); // sanitized to default
    });
  });
});
