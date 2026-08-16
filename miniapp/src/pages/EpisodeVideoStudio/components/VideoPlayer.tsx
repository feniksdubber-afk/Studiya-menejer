import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Camera, Pause, Play, RotateCcw, RotateCw, Target } from "lucide-react";
import type { VoiceCue } from "@/types";
import { CueTimeline } from "./CueTimeline";
import { formatCueTime } from "@/components/VoiceCueCard";

const SPEEDS = [1, 1.5, 2, 0.5];

export interface VideoPlayerHandle {
  seekTo: (seconds: number) => void;
  captureFrame: () => Promise<{ blob: Blob; timestampSeconds: number } | null>;
}

export const VideoPlayer = forwardRef<
  VideoPlayerHandle,
  {
    src: string;
    cues: VoiceCue[];
    activeCueId: string | null;
    onCapture: (blob: Blob, timestampSeconds: number) => void;
    onSeek?: (seconds: number) => void;
  }
>(function VideoPlayer({ src, cues, activeCueId, onCapture, onSeek }, ref) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speedIdx, setSpeedIdx] = useState(0);
  const [capturing, setCapturing] = useState(false);

  useImperativeHandle(ref, () => ({
    seekTo(seconds: number) {
      const v = videoRef.current;
      if (!v) return;
      v.currentTime = seconds;
      setCurrent(seconds);
    },
    captureFrame,
  }));

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => setCurrent(v.currentTime);
    const onMeta = () => setDuration(v.duration || 0);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("loadedmetadata", onMeta);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("loadedmetadata", onMeta);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
    };
  }, []);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play();
    else v.pause();
  };

  const skip = (delta: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(duration, v.currentTime + delta));
  };

  const cycleSpeed = () => {
    const nextIdx = (speedIdx + 1) % SPEEDS.length;
    setSpeedIdx(nextIdx);
    if (videoRef.current) videoRef.current.playbackRate = SPEEDS[nextIdx];
  };

  const seek = (seconds: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = seconds;
    setCurrent(seconds);
    onSeek?.(seconds);
  };

  // VF2: kadr olish — video pauza, canvas.drawImage orqali skrinshot.
  // R2 bucket'da CORS to'g'ri sozlanmasa "tainted canvas" xatosi chiqadi
  // (VOICE-CUES-PLAN.md, V1 bo'limidagi eslatma).
  const captureFrame = async (): Promise<{ blob: Blob; timestampSeconds: number } | null> => {
    const v = videoRef.current;
    const canvas = canvasRef.current;
    if (!v || !canvas) return null;
    v.pause();
    setCapturing(true);
    try {
      canvas.width = v.videoWidth;
      canvas.height = v.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/webp", 0.9)
      );
      if (!blob) return null;
      return { blob, timestampSeconds: v.currentTime };
    } catch {
      // Tainted canvas yoki boshqa CORS xatosi.
      return null;
    } finally {
      setCapturing(false);
    }
  };

  const handleCapture = async () => {
    const result = await captureFrame();
    if (result) onCapture(result.blob, result.timestampSeconds);
  };

  return (
    <div className="flex flex-col gap-2.5">
      <div className="relative overflow-hidden rounded-2xl bg-black">
        <video
          ref={videoRef}
          src={src}
          crossOrigin="anonymous"
          className="aspect-video w-full bg-black"
          playsInline
        />
        <canvas ref={canvasRef} className="hidden" />
        {capturing && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <div className="h-10 w-10 animate-pulse rounded-full bg-white/80" />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between px-0.5 font-mono text-xs text-tg-hint">
        <span>{formatCueTime(current)}</span>
        <span>{formatCueTime(duration)}</span>
      </div>

      <CueTimeline
        cues={cues}
        duration={duration}
        currentTime={current}
        activeCueId={activeCueId}
        onSeek={seek}
      />

      <div className="flex items-center justify-between gap-1.5">
        <button
          onClick={() => skip(-10)}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-tg-secondaryBg text-tg-text active:opacity-70"
          aria-label="10 soniya orqaga"
        >
          <RotateCcw size={16} aria-hidden="true" />
        </button>
        <button
          onClick={togglePlay}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-tg-button text-tg-buttonText active:opacity-80"
          aria-label={isPlaying ? "Pauza" : "Ijro"}
        >
          {isPlaying ? <Pause size={18} aria-hidden="true" /> : <Play size={18} aria-hidden="true" />}
        </button>
        <button
          onClick={() => skip(10)}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-tg-secondaryBg text-tg-text active:opacity-70"
          aria-label="10 soniya oldinga"
        >
          <RotateCw size={16} aria-hidden="true" />
        </button>
        <button
          onClick={cycleSpeed}
          className="flex h-10 min-w-[2.75rem] items-center justify-center rounded-full bg-tg-secondaryBg px-2 font-mono text-xs font-medium text-tg-text active:opacity-70"
        >
          {SPEEDS[speedIdx]}x
        </button>
        <button
          onClick={handleCapture}
          className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-role-director-600 px-3 text-sm font-semibold text-white active:opacity-80"
        >
          <Camera size={17} aria-hidden="true" /> ROL
        </button>
      </div>
    </div>
  );
});

export function JumpToActiveCueButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 self-start rounded-full bg-role-director-50 px-3 py-1.5 text-xs font-medium text-role-director-800 active:opacity-70"
    >
      <Target size={13} aria-hidden="true" /> Joriy rol
    </button>
  );
}
