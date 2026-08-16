import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import WebApp from "@twa-dev/sdk";
import { CheckCircle2, ChevronLeft, ChevronRight, PlayCircle, Theater } from "lucide-react";
import { getEpisode } from "@/api/projects";
import { getOriginalVideoPlaybackUrl } from "@/api/originalVideo";
import { listEpisodeCues, markCueRecorded } from "@/api/voiceCues";
import { formatCueTime } from "@/components/VoiceCueCard";
import { LoadingScreen, QueryError } from "@/components/StatusScreens";
import { EmptyState } from "@/components/EmptyState";
import { useTelegramBackButton } from "@/hooks/useTelegramBackButton";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/auth/useAuth";

// Aktyor "▶ Video joyini ko'rish" bosganda replikadan necha soniya oldinroq
// boshlanadi — kontekst uchun (VOICE-CUES-PLAN.md, VF6).
const CONTEXT_LEAD_SECONDS = 5;

export default function ActorWorkspacePage() {
  const { episodeId } = useParams<{ episodeId: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { showError } = useToast();
  useTelegramBackButton(episodeId ? `/episodes/${episodeId}` : "/");

  const [index, setIndex] = useState(0);
  const [previewSeconds, setPreviewSeconds] = useState<number | null>(null);

  const episodeQuery = useQuery({
    queryKey: ["episode", episodeId],
    queryFn: () => getEpisode(episodeId!),
    enabled: !!episodeId,
  });

  const videoQuery = useQuery({
    queryKey: ["episode-video", episodeId],
    queryFn: () => getOriginalVideoPlaybackUrl(episodeId!),
    enabled: !!episodeId,
  });

  const cuesQuery = useQuery({
    queryKey: ["episode-cues", episodeId, "actor", user?.id],
    queryFn: () => listEpisodeCues(episodeId!, { actorId: user!.id }),
    enabled: !!episodeId && !!user?.id,
  });

  const cues = useMemo(
    () => (cuesQuery.data ?? []).slice().sort((a, b) => a.timestamp_seconds - b.timestamp_seconds),
    [cuesQuery.data]
  );

  useEffect(() => {
    setPreviewSeconds(null);
  }, [index]);

  const markRecordedMutation = useMutation({
    mutationFn: (cueId: string) => markCueRecorded(cueId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["episode-cues", episodeId] });
      WebApp.HapticFeedback.notificationOccurred("success");
      // Keyingi cue'ga avtomatik o'tadi, lekin qaytarib bo'lmas emas —
      // aktyor "←" bilan istalgan vaqt orqaga qaytishi mumkin.
      setIndex((i) => Math.min(i + 1, cues.length - 1));
    },
    onError: () => showError("Belgilab bo'lmadi"),
  });

  if (episodeQuery.isLoading || cuesQuery.isLoading || videoQuery.isLoading) {
    return <LoadingScreen />;
  }

  if (episodeQuery.isError || cuesQuery.isError) {
    return (
      <div className="p-5">
        <QueryError message="Ma'lumotlarni yuklab bo'lmadi." onRetry={() => cuesQuery.refetch()} />
      </div>
    );
  }

  const episode = episodeQuery.data!;
  const video = videoQuery.data;

  if (cues.length === 0) {
    return (
      <div className="flex flex-col gap-4 p-5 pt-6">
        <h1 className="text-lg font-semibold text-tg-text">{episode.title}</h1>
        <EmptyState icon={Theater} message="Sizga hali rol biriktirilmagan." />
      </div>
    );
  }

  const cue = cues[Math.min(index, cues.length - 1)];
  const recordedCount = cues.filter((c) => c.status === "recorded").length;
  const contextStart = Math.max(0, cue.timestamp_seconds - CONTEXT_LEAD_SECONDS);

  return (
    <div className="flex flex-col gap-4 p-5 pt-6 pb-20">
      <div>
        <h1 className="text-lg font-semibold text-tg-text">{episode.title}</h1>
        <p className="text-sm text-tg-hint">Mening rollarim</p>
      </div>

      {/* Progress */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs text-tg-hint">
          <span>
            {recordedCount}/{cues.length} bajarildi
          </span>
          <span className="font-mono">
            {index + 1} / {cues.length}
          </span>
        </div>
        <div className="flex gap-1">
          {cues.map((c, i) => (
            <div
              key={c.id}
              className={`h-1.5 flex-1 rounded-full ${
                c.status === "recorded"
                  ? "bg-role-sound-600"
                  : i === index
                    ? "bg-role-translator-600"
                    : "bg-tg-secondaryBg"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Katta skrinshot */}
      <div className="overflow-hidden rounded-2xl bg-black/10">
        {cue.screenshot_url && (
          <img src={cue.screenshot_url} alt="" className="aspect-video w-full object-cover" />
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className="font-mono text-sm text-tg-hint">{formatCueTime(cue.timestamp_seconds)}</span>
        <span className="text-base font-semibold text-tg-text">
          {cue.character?.name ?? cue.temp_label}
        </span>
      </div>

      {cue.director_note && (
        <div className="rounded-2xl bg-role-director-50 p-3 text-sm text-role-director-800">
          {cue.director_note}
        </div>
      )}

      {video && (
        <>
          <button
            onClick={() => setPreviewSeconds(contextStart)}
            className="flex items-center justify-center gap-2 rounded-xl bg-tg-secondaryBg px-4 py-3 text-sm font-medium text-tg-text active:opacity-70"
          >
            <PlayCircle size={17} aria-hidden="true" /> Video joyini ko'rish
          </button>
          {previewSeconds !== null && (
            <video
              key={cue.id}
              src={`${video.video_url}#t=${previewSeconds}`}
              controls
              autoPlay
              playsInline
              className="w-full rounded-2xl bg-black"
            />
          )}
        </>
      )}

      {cue.status === "recorded" ? (
        <div className="flex items-center justify-center gap-2 rounded-xl bg-role-sound-50 px-4 py-3 text-sm font-medium text-role-sound-800">
          <CheckCircle2 size={16} aria-hidden="true" /> Rol bajarildi ✓
        </div>
      ) : (
        <button
          onClick={() => markRecordedMutation.mutate(cue.id)}
          disabled={markRecordedMutation.isPending}
          className="flex items-center justify-center gap-2 rounded-xl bg-tg-button px-4 py-3 text-sm font-semibold text-tg-buttonText disabled:opacity-50"
        >
          <CheckCircle2 size={16} aria-hidden="true" /> Yozib bo'ldim
        </button>
      )}

      <div className="flex items-center justify-between">
        <button
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
          className="flex items-center gap-1 rounded-xl bg-tg-secondaryBg px-4 py-2.5 text-sm font-medium text-tg-text disabled:opacity-40"
        >
          <ChevronLeft size={16} aria-hidden="true" /> {index > 0 ? formatCueTime(cues[index - 1].timestamp_seconds) : ""}
        </button>
        <button
          onClick={() => setIndex((i) => Math.min(cues.length - 1, i + 1))}
          disabled={index === cues.length - 1}
          className="flex items-center gap-1 rounded-xl bg-tg-secondaryBg px-4 py-2.5 text-sm font-medium text-tg-text disabled:opacity-40"
        >
          {index < cues.length - 1 ? formatCueTime(cues[index + 1].timestamp_seconds) : ""} <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
