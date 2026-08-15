// Film lentasi countdown'iga ishora qiluvchi halqa — deadline yaqinlashganda
// yoki kechikkanda vazifa muddatini vizual jihatda ta'kidlaydi. Butun kunni
// (24 soat) to'liq aylana deb olib, qolgan vaqt ulushini chizadi.

const RADIUS = 18;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const WINDOW_HOURS = 24;

function hoursLeft(deadline: string): number {
  return (new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60);
}

function formatLeft(hours: number): string {
  if (hours <= 0) return "kechikdi";
  if (hours < 1) return `${Math.round(hours * 60)}min`;
  return `${Math.round(hours)}soat`;
}

export function DeadlineRing({ deadline, size = 46 }: { deadline: string; size?: number }) {
  const hours = hoursLeft(deadline);
  const isOverdue = hours <= 0;
  const ratio = Math.max(0, Math.min(1, hours / WINDOW_HOURS));
  const dashOffset = CIRCUMFERENCE * (1 - ratio);

  const trackClass = "stroke-tg-secondaryBg";
  const progressClass = isOverdue ? "stroke-role-voice-600" : "stroke-role-director-600";
  const labelClass = isOverdue
    ? "text-role-voice-800 dark:text-role-voice-400"
    : "text-role-director-800 dark:text-role-director-400";

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 46 46" className="-rotate-90">
        <circle cx="23" cy="23" r={RADIUS} fill="none" strokeWidth="3" className={trackClass} />
        <circle
          cx="23"
          cy="23"
          r={RADIUS}
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          className={progressClass}
        />
      </svg>
      <div
        className={`absolute inset-0 flex items-center justify-center font-mono text-[10px] font-medium ${labelClass}`}
      >
        {formatLeft(hours)}
      </div>
    </div>
  );
}
