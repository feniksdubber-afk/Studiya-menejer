import type { VoiceCue } from "@/types";
import { CUE_STATUS_DOT } from "@/components/VoiceCueCard";

export function CueTimeline({
  cues,
  duration,
  currentTime,
  activeCueId,
  onSeek,
}: {
  cues: VoiceCue[];
  duration: number;
  currentTime: number;
  activeCueId: string | null;
  onSeek: (seconds: number) => void;
}) {
  const pct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div className="relative pt-1">
      <div className="relative h-1.5 w-full rounded-full bg-tg-secondaryBg">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-role-director-600"
          style={{ width: `${pct}%` }}
        />
      </div>
      {/* Cue markerlari — progress chizig'i ustida */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 w-full">
        {duration > 0 &&
          cues.map((cue) => {
            const left = Math.min(100, (cue.timestamp_seconds / duration) * 100);
            return (
              <button
                key={cue.id}
                onClick={() => onSeek(cue.timestamp_seconds)}
                className={`pointer-events-auto absolute -top-1.5 h-4 w-4 -translate-x-1/2 rounded-full border-2 border-tg-bg ${
                  CUE_STATUS_DOT[cue.status]
                } ${activeCueId === cue.id ? "ring-2 ring-role-director-600" : ""}`}
                style={{ left: `${left}%` }}
                aria-label={`Rol: ${cue.character?.name ?? cue.temp_label ?? ""}`}
              />
            );
          })}
      </div>
      {/* Bosh joyi seek uchun — butun kenglikda shaffof range */}
      <input
        type="range"
        min={0}
        max={Math.max(duration, 0.01)}
        step={0.1}
        value={Math.min(currentTime, duration)}
        onChange={(e) => onSeek(Number(e.target.value))}
        className="absolute inset-x-0 -top-2 h-6 w-full cursor-pointer opacity-0"
        aria-label="Videoni oldinga/orqaga surish"
      />
    </div>
  );
}
