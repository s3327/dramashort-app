import type { Episode } from "@/types/content";

export type AspectRatioMode = "fit" | "9:16" | "16:9";

export interface VideoPlayerProps {
  src: string;
  poster?: string;
  title?: string;
  dramaTitle?: string;
  currentEpisode: number;
  totalEpisodes: number;
  initialProgressSeconds?: number;
  initialProgressRatio?: number;
  autoPlay?: boolean;
  aspectRatio?: string;
  isMobileFullViewport?: boolean;
  onTimeUpdate?: (currentTime: number, duration: number, progressRatio: number) => void;
  onPause?: (currentTime: number, duration: number, progressRatio: number) => void;
  onEnded?: () => void;
  onNextEpisode?: () => void;
  onPrevEpisode?: () => void;
}

export interface EpisodeSheetProps {
  isOpen: boolean;
  onClose: () => void;
  currentEpisode: number;
  totalEpisodes: number;
  episodes: Episode[];
  onSelectEpisode: (episodeNumber: number) => void;
  dramaTitle?: string;
}

export interface WatchOverlayProps {
  drama: {
    slug: string;
    title: string;
    poster?: string;
  };
  currentEpisode: number;
  totalEpisodes: number;
  isPlaying: boolean;
  isBuffering: boolean;
  currentTime: number;
  duration: number;
  onTogglePlay: () => void;
  onOpenEpisodes: () => void;
  onNextEpisode?: () => void;
  onPrevEpisode?: () => void;
  onSeek?: (ratio: number) => void;
  onSeekRelative?: (seconds: number) => void;
  onSetPlaybackRate?: (rate: number) => void;
  currentPlaybackRate?: number;
  swipeHint?: "next" | "prev" | null;
  onToggleFullscreen?: () => void;
  isFullscreen?: boolean;
  isMuted?: boolean;
  onToggleMute?: () => void;
  showUnmutePill?: boolean;
  onGuestPromptTrigger?: (trigger: "favorite") => void;
}
