import type { VoiceCue } from "@/types";

export const CUE_STATUS_DOT: Record<VoiceCue["status"], string> = {
  pending: "bg-tg-hint",
  assigned: "bg-role-translator-600",
  recorded: "bg-role-sound-600",
};

export const CUE_STATUS_LABEL: Record<VoiceCue["status"], string> = {
  pending: "Kutilmoqda",
  assigned: "Biriktirildi",
  recorded: "Yozildi",
};

export function formatCueTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function VoiceCueCard({
  cue,
  active,
  onClick,
}: {
  cue: VoiceCue;
  active?: boolean;
  onClick?: () => void;
}) {
  const label = cue.character?.name ?? cue.temp_label ?? "Noma'lum";
  const actorName = cue.actor
    ? [cue.actor.first_name, cue.actor.last_name].filter(Boolean).join(" ")
    : null;

  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left transition active:opacity-70 ${
        active ? "bg-role-director-50 ring-1 ring-role-director-400" : "bg-tg-secondaryBg"
      }`}
    >
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-black/10">
        {cue.screenshot_url && (
          <img src={cue.screenshot_url} alt={label} className="h-full w-full object-cover" />
        )}
        <span
          className={`absolute right-1 top-1 h-2 w-2 rounded-full ${CUE_STATUS_DOT[cue.status]}`}
          aria-hidden="true"
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-tg-hint">{formatCueTime(cue.timestamp_seconds)}</span>
          <span className="truncate text-sm font-medium text-tg-text">{label}</span>
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-tg-hint">
          <span className={`h-1.5 w-1.5 rounded-full ${CUE_STATUS_DOT[cue.status]}`} aria-hidden="true" />
          <span>{CUE_STATUS_LABEL[cue.status]}</span>
          {actorName && <span className="truncate">• {actorName}</span>}
        </div>
      </div>
    </button>
  );
}
