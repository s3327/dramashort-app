/**
 * Subtitle Parsing, Formatting, Timing and Fallback Track Engine (Task 9.2).
 */

import type { SubtitleCue, SubtitleTrack } from "@/types/subtitles";

/**
 * Parses time format (00:01:23.456, 01:23.456, or SRT comma 00:01:23,456) to fractional seconds.
 */
export function timeStringToSeconds(timeStr: string): number {
  if (!timeStr) return 0;
  const normalized = timeStr.trim().replace(",", ".");
  const parts = normalized.split(":");

  if (parts.length === 3) {
    const hours = parseFloat(parts[0]) || 0;
    const minutes = parseFloat(parts[1]) || 0;
    const seconds = parseFloat(parts[2]) || 0;
    return hours * 3600 + minutes * 60 + seconds;
  } else if (parts.length === 2) {
    const minutes = parseFloat(parts[0]) || 0;
    const seconds = parseFloat(parts[1]) || 0;
    return minutes * 60 + seconds;
  } else if (parts.length === 1) {
    return parseFloat(parts[0]) || 0;
  }
  return 0;
}

/**
 * Formats fractional seconds to standard WebVTT timestamp (HH:MM:SS.mmm).
 */
export function secondsToVttTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "00:00:00.000";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  const hh = h.toString().padStart(2, "0");
  const mm = m.toString().padStart(2, "0");
  const ss = s.toString().padStart(2, "0");
  const mmm = ms.toString().padStart(3, "0");

  return `${hh}:${mm}:${ss}.${mmm}`;
}

/**
 * Parses a WebVTT formatted string into structured SubtitleCue objects.
 */
export function parseVtt(vttContent: string): SubtitleCue[] {
  if (!vttContent) return [];
  const lines = vttContent.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const cues: SubtitleCue[] = [];

  let currentCue: { id?: string; startTime: number; endTime: number; textLines: string[] } | null = null;
  const timeRegex = /((?:\d{2}:)?\d{2}:\d{2}[.,]\d{3})\s*-->\s*((?:\d{2}:)?\d{2}:\d{2}[.,]\d{3})/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip WEBVTT header and NOTE blocks
    if (line.startsWith("WEBVTT") || line.startsWith("NOTE")) {
      continue;
    }

    const timeMatch = line.match(timeRegex);
    if (timeMatch) {
      if (currentCue && currentCue.textLines.length > 0) {
        cues.push({
          id: currentCue.id,
          startTime: currentCue.startTime,
          endTime: currentCue.endTime,
          text: currentCue.textLines.join("\n").trim(),
        });
      }

      currentCue = {
        startTime: timeStringToSeconds(timeMatch[1]),
        endTime: timeStringToSeconds(timeMatch[2]),
        textLines: [],
      };
      continue;
    }

    if (currentCue) {
      if (line === "") {
        if (currentCue.textLines.length > 0) {
          cues.push({
            id: currentCue.id,
            startTime: currentCue.startTime,
            endTime: currentCue.endTime,
            text: currentCue.textLines.join("\n").trim(),
          });
          currentCue = null;
        }
      } else {
        currentCue.textLines.push(line);
      }
    }
  }

  if (currentCue && currentCue.textLines.length > 0) {
    cues.push({
      id: currentCue.id,
      startTime: currentCue.startTime,
      endTime: currentCue.endTime,
      text: currentCue.textLines.join("\n").trim(),
    });
  }

  return cues;
}

/**
 * Parses a SubRip (.srt) formatted string into SubtitleCue objects.
 */
export function parseSrt(srtContent: string): SubtitleCue[] {
  // WebVTT and SRT cue timing are structurally identical once comma is normalized
  return parseVtt(srtContent);
}

/**
 * Auto-detects and parses either WebVTT or SRT text into cues.
 */
export function parseVttOrSrt(rawContent: string): SubtitleCue[] {
  return parseVtt(rawContent);
}

/**
 * Finds the currently active subtitle cue for a given playback timestamp.
 */
export function findActiveCue(
  cues: SubtitleCue[] | undefined,
  currentTime: number
): SubtitleCue | null {
  if (!cues || cues.length === 0 || isNaN(currentTime) || currentTime < 0) {
    return null;
  }
  for (let i = 0; i < cues.length; i++) {
    const cue = cues[i];
    if (currentTime >= cue.startTime && currentTime <= cue.endTime) {
      return cue;
    }
  }
  return null;
}

/**
 * Generates valid WebVTT formatted text from cue objects.
 */
export function generateVttContent(cues: SubtitleCue[]): string {
  let output = "WEBVTT\n\n";
  cues.forEach((cue, index) => {
    output += `${index + 1}\n`;
    output += `${secondsToVttTime(cue.startTime)} --> ${secondsToVttTime(cue.endTime)}\n`;
    output += `${cue.text}\n\n`;
  });
  return output.trimEnd() + "\n";
}

/**
 * Generates sample short-drama dialog cues for demo and testing purposes.
 */
export function getDefaultDemoTracks(
  dramaTitle = "Drama",
  episodeNumber = 1
): SubtitleTrack[] {
  const enCues: SubtitleCue[] = [
    { startTime: 0.5, endTime: 3.5, text: `[Opening Theme] - ${dramaTitle} Ep ${episodeNumber}` },
    { startTime: 4.0, endTime: 7.8, text: "Wait! You can't just walk away after what happened." },
    { startTime: 8.2, endTime: 12.0, text: "Everything you were told about that night was a lie." },
    { startTime: 12.5, endTime: 16.8, text: "Then tell me the truth. Who sent you here?" },
    { startTime: 17.2, endTime: 21.5, text: "If I tell you, neither of us will walk out of here alive." },
    { startTime: 22.0, endTime: 27.5, text: "Stay right where you are. We're not finished yet." },
    { startTime: 28.0, endTime: 33.0, text: "[Dramatic Stinger] - To be continued..." },
  ];

  const idCues: SubtitleCue[] = [
    { startTime: 0.5, endTime: 3.5, text: `[Musik Pembuka] - ${dramaTitle} Ep ${episodeNumber}` },
    { startTime: 4.0, endTime: 7.8, text: "Tunggu! Kamu tidak bisa pergi begitu saja setelah apa yang terjadi." },
    { startTime: 8.2, endTime: 12.0, text: "Semua yang kamu dengar tentang malam itu adalah kebohongan." },
    { startTime: 12.5, endTime: 16.8, text: "Kalau begitu katakan yang sebenarnya. Siapa yang mengirimmu?" },
    { startTime: 17.2, endTime: 21.5, text: "Jika kukatakan, kita berdua tidak akan keluar dari sini hidup-hidup." },
    { startTime: 22.0, endTime: 27.5, text: "Tetap di tempatmu. Urusan kita belum selesai." },
    { startTime: 28.0, endTime: 33.0, text: "[Musik Menegangkan] - Bersambung..." },
  ];

  const esCues: SubtitleCue[] = [
    { startTime: 0.5, endTime: 3.5, text: `[Música de inicio] - ${dramaTitle} Ep ${episodeNumber}` },
    { startTime: 4.0, endTime: 7.8, text: "¡Espera! No puedes marcharte después de lo que pasó." },
    { startTime: 8.2, endTime: 12.0, text: "Todo lo que te dijeron sobre esa noche fue una mentira." },
    { startTime: 12.5, endTime: 16.8, text: "Entonces dime la verdad. ¿Quién te envió aquí?" },
    { startTime: 17.2, endTime: 21.5, text: "Si te lo digo, ninguno de los dos saldrá vivo de aquí." },
    { startTime: 22.0, endTime: 27.5, text: "Quédate justo donde estás. Aún no hemos terminado." },
    { startTime: 28.0, endTime: 33.0, text: "[Música de suspenso] - Continuará..." },
  ];

  const zhCues: SubtitleCue[] = [
    { startTime: 0.5, endTime: 3.5, text: `[片头曲] - ${dramaTitle} 第${episodeNumber}集` },
    { startTime: 4.0, endTime: 7.8, text: "等等！发生那种事之后，你不能就这么走掉。" },
    { startTime: 8.2, endTime: 12.0, text: "那天晚上你所听到的一切，全都是谎言。" },
    { startTime: 12.5, endTime: 16.8, text: "那就告诉我真相。到底是谁派你来的？" },
    { startTime: 17.2, endTime: 21.5, text: "如果我告诉你，我们俩都休想活着离开这里。" },
    { startTime: 22.0, endTime: 27.5, text: "站住别动。我们的帐还没算完。" },
    { startTime: 28.0, endTime: 33.0, text: "[悬念音效] - 下集待续..." },
  ];

  return [
    {
      id: "track-en",
      language: "en",
      label: "English",
      src: "/subtitles/demo-en.vtt",
      cues: enCues,
      default: true,
    },
    {
      id: "track-id",
      language: "id",
      label: "Indonesian",
      src: "/subtitles/demo-id.vtt",
      cues: idCues,
    },
    {
      id: "track-es",
      language: "es",
      label: "Spanish",
      src: "/subtitles/demo-es.vtt",
      cues: esCues,
    },
    {
      id: "track-zh",
      language: "zh",
      label: "Chinese",
      src: "/subtitles/demo-zh.vtt",
      cues: zhCues,
    },
  ];
}
