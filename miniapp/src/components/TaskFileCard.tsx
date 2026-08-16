import { useQuery } from "@tanstack/react-query";
import { Download, FileText, Loader2, Music, Video } from "lucide-react";
import type { TaskFile } from "@/types";

// Fayl kengaytmasi/mime turiga qarab pleer turini tanlash. Telegram
// hujjatlarda mime_type ba'zan bo'sh bo'lishi mumkin — shu holda fayl
// nomidagi kengaytmaga qaraymiz (video/audio uchun eng ehtimolli holat).
function detectKind(file: TaskFile): "video" | "audio" | "other" {
  const mime = file.mime_type ?? "";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  const name = file.current_name.toLowerCase();
  if (/\.(mp4|mov|mkv|webm|avi)$/.test(name)) return "video";
  if (/\.(mp3|wav|ogg|m4a|flac|aac|opus)$/.test(name)) return "audio";
  return "other";
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  const mb = bytes / (1024 * 1024);
  if (mb < 1) return `${Math.round(bytes / 1024)} KB`;
  return `${mb.toFixed(1)} MB`;
}

/** Bitta topshirilgan/oldingi bosqich faylini ko'rsatadigan karta:
 *  video/audio uchun ichki pleer, hujjatlar uchun yuklab olish havolasi. */
export function TaskFileCard({
  title,
  file,
  accentClassName = "bg-tg-secondaryBg text-tg-text",
}: {
  title: string;
  file: TaskFile;
  /** Rolga mos rang (masalan role-translator-50/800) — vizual ajratish uchun. */
  accentClassName?: string;
}) {
  const kind = detectKind(file);

  return (
    <div className="flex flex-col gap-2.5 rounded-2xl bg-tg-secondaryBg p-4">
      <div className="flex items-center justify-between gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium ${accentClassName}`}>
          {kind === "video" ? <Video size={13} aria-hidden="true" /> : kind === "audio" ? <Music size={13} aria-hidden="true" /> : <FileText size={13} aria-hidden="true" />}
          {title}
        </span>
        <span className="font-mono text-xs text-tg-hint">v{file.version_number}</span>
      </div>

      {kind === "video" && (
        <video src={file.file_url} controls playsInline className="w-full rounded-xl bg-black" />
      )}

      {kind === "audio" && (
        <audio src={file.file_url} controls className="w-full" />
      )}

      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm text-tg-text">{file.current_name}</span>
          {file.file_size != null && (
            <span className="text-xs text-tg-hint">{formatBytes(file.file_size)}</span>
          )}
        </div>
        <a
          href={file.file_url}
          download={file.current_name}
          target="_blank"
          rel="noreferrer"
          className="flex shrink-0 items-center gap-1.5 rounded-xl bg-tg-bg px-3 py-2 text-xs font-medium text-tg-button active:opacity-70"
        >
          <Download size={14} aria-hidden="true" /> Yuklab olish
        </a>
      </div>
    </div>
  );
}

/** `queryFn` chaqirib, natijani (yoki yo'qligini/xatoni) TaskFileCard bilan
 *  ko'rsatuvchi wrapper — har bir ishlatilish joyida loading/empty/error
 *  holatlarini takrorlamaslik uchun. */
export function TaskFileSection({
  title,
  emptyMessage,
  accentClassName,
  queryKey,
  queryFn,
}: {
  title: string;
  emptyMessage: string;
  accentClassName?: string;
  queryKey: unknown[];
  queryFn: () => Promise<TaskFile | null>;
}) {
  const { data, isLoading, isError } = useQuery({ queryKey, queryFn });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-2xl bg-tg-secondaryBg p-4 text-sm text-tg-hint">
        <Loader2 size={15} className="animate-spin" aria-hidden="true" /> Fayl tekshirilmoqda...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-2xl bg-tg-secondaryBg p-4 text-sm text-tg-hint">
        {title}ni yuklab bo'lmadi.
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl bg-tg-secondaryBg p-4 text-sm text-tg-hint">{emptyMessage}</div>
    );
  }

  return <TaskFileCard title={title} file={data} accentClassName={accentClassName} />;
}
