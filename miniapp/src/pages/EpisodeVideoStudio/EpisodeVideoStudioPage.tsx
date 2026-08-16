import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { UploadCloud, Theater } from "lucide-react";
import { getEpisode } from "@/api/projects";
import { listCharacters } from "@/api/characters";
import { listProjectMembers } from "@/api/projects";
import {
  getOriginalVideoPlaybackUrl,
  requestOriginalVideoUploadUrl,
  confirmOriginalVideoUpload,
  uploadVideoToR2,
  MAX_VIDEO_SIZE_BYTES,
} from "@/api/originalVideo";
import {
  listEpisodeCues,
  createVoiceCue,
  updateVoiceCue,
  deleteVoiceCue,
  duplicateVoiceCue,
} from "@/api/voiceCues";
import type { VoiceCue } from "@/types";
import { VideoPlayer, JumpToActiveCueButton, type VideoPlayerHandle } from "./components/VideoPlayer";
import { CueList } from "./components/CueList";
import { VoiceCueFormModal, type VoiceCueFormValues } from "@/components/VoiceCueFormModal";
import { LoadingScreen, QueryError } from "@/components/StatusScreens";
import { useTelegramBackButton } from "@/hooks/useTelegramBackButton";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/auth/useAuth";

type PendingCapture = { blob: Blob; previewUrl: string; timestampSeconds: number } | null;

export default function EpisodeVideoStudioPage() {
  const { episodeId } = useParams<{ episodeId: string }>();
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const { user } = useAuth();
  useTelegramBackButton(episodeId ? `/episodes/${episodeId}` : "/");

  const playerRef = useRef<VideoPlayerHandle>(null);
  const [activeCueId, setActiveCueId] = useState<string | null>(null);
  const [pendingCapture, setPendingCapture] = useState<PendingCapture>(null);
  const [editingCue, setEditingCue] = useState<VoiceCue | null>(null);
  const [lastCharacterId, setLastCharacterId] = useState<string | null>(null);
  const [lastActorId, setLastActorId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const projectId = episodeQuery.data?.project_id;

  const charactersQuery = useQuery({
    queryKey: ["project-characters", projectId],
    queryFn: () => listCharacters(projectId!),
    enabled: !!projectId,
  });

  const membersQuery = useQuery({
    queryKey: ["project-members", projectId],
    queryFn: () => listProjectMembers(projectId!),
    enabled: !!projectId,
  });

  // Filtrlanmagan to'liq ro'yxat — video timeline markerlari (VF4) va
  // sarlavhadagi umumiy son uchun. CueList (VF5) esa o'z filtrlangan
  // so'rovini backend orqali alohida yuboradi.
  const cuesQuery = useQuery({
    queryKey: ["episode-cues", episodeId],
    queryFn: () => listEpisodeCues(episodeId!),
    enabled: !!episodeId,
  });

  const createMutation = useMutation({
    mutationFn: (values: VoiceCueFormValues & { screenshot: Blob }) =>
      createVoiceCue(episodeId!, {
        screenshot: values.screenshot,
        timestampSeconds: values.timestampSeconds,
        characterId: values.characterId,
        tempLabel: values.tempLabel,
        actorId: values.actorId,
        directorNote: values.directorNote,
      }),
    onSuccess: (cue) => {
      queryClient.invalidateQueries({ queryKey: ["episode-cues", episodeId] });
      setLastCharacterId(cue.character?.id ?? null);
      setLastActorId(cue.actor?.id ?? null);
      setPendingCapture(null);
      showSuccess("Rol saqlandi");
    },
    onError: () => showError("Rolni saqlab bo'lmadi"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ cueId, values }: { cueId: string; values: VoiceCueFormValues }) =>
      updateVoiceCue(cueId, {
        timestamp_seconds: values.timestampSeconds,
        character_id: values.characterId,
        temp_label: values.tempLabel,
        actor_id: values.actorId,
        director_note: values.directorNote,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["episode-cues", episodeId] });
      setEditingCue(null);
      showSuccess("O'zgarishlar saqlandi");
    },
    onError: () => showError("Saqlab bo'lmadi"),
  });

  const deleteMutation = useMutation({
    mutationFn: (cueId: string) => deleteVoiceCue(cueId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["episode-cues", episodeId] });
      setEditingCue(null);
      showSuccess("Rol o'chirildi");
    },
    onError: () => showError("O'chirib bo'lmadi"),
  });

  const duplicateMutation = useMutation({
    mutationFn: async (cue: VoiceCue) => {
      const frame = await playerRef.current?.captureFrame();
      if (!frame) throw new Error("no-frame");
      return duplicateVoiceCue(cue.id, frame.blob, frame.timestampSeconds);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["episode-cues", episodeId] });
      setEditingCue(null);
      showSuccess("Rol nusxalandi");
    },
    onError: () => showError("Nusxalab bo'lmadi — videoni pauza qilib qayta urinib ko'ring"),
  });

  const cues = useMemo(
    () => (cuesQuery.data ?? []).slice().sort((a, b) => a.timestamp_seconds - b.timestamp_seconds),
    [cuesQuery.data]
  );

  const handleCapture = (blob: Blob, timestampSeconds: number) => {
    const previewUrl = URL.createObjectURL(blob);
    setPendingCapture((prev) => {
      // Oldingi captureni almashtirsak, uning blob URL'ini ham tozalaymiz.
      if (prev) URL.revokeObjectURL(prev.previewUrl);
      return { blob, previewUrl, timestampSeconds };
    });
  };

  // pendingCapture tugaganda (saqlangan/bekor qilingan) yoki komponent
  // unmount bo'lganda blob URL'ni xotiradan tozalaymiz — memory leak oldini olish.
  useEffect(() => {
    if (!pendingCapture) return;
    return () => URL.revokeObjectURL(pendingCapture.previewUrl);
  }, [pendingCapture]);

  const handleSelectCue = (cue: VoiceCue) => {
    setActiveCueId(cue.id);
    playerRef.current?.seekTo(cue.timestamp_seconds);
    setEditingCue(cue);
  };

  const handleUploadVideo = async (file: File) => {
    if (!episodeId) return;
    if (file.size > MAX_VIDEO_SIZE_BYTES) {
      showError("Video hajmi 500 MB dan oshmasligi kerak");
      return;
    }
    setPendingFile(file);
    setUploadError(null);
    try {
      setUploadProgress(0);
      const { upload_url, r2_key } = await requestOriginalVideoUploadUrl(
        episodeId,
        file.name,
        file.type || "video/mp4"
      );
      await uploadVideoToR2(upload_url, file, setUploadProgress);
      await confirmOriginalVideoUpload(episodeId, r2_key, file.name, file.type || "video/mp4");
      await queryClient.invalidateQueries({ queryKey: ["episode-video", episodeId] });
      showSuccess("Video yuklandi");
      setPendingFile(null);
    } catch (err: any) {
      // Tarmoq uzilishi yoki R2/API xatosi — foydalanuvchi faylni qayta
      // tanlamasdan "Qayta urinish" bosishi mumkin (VF7).
      const message =
        err?.message === "Tarmoq xatosi — video yuklab bo'lmadi"
          ? "Tarmoq uzildi — internet aloqasini tekshirib, qayta urinib ko'ring."
          : "Videoni yuklab bo'lmadi. Qayta urinib ko'ring.";
      setUploadError(message);
    } finally {
      setUploadProgress(null);
    }
  };

  const handleRetryUpload = () => {
    if (pendingFile) handleUploadVideo(pendingFile);
  };

  if (episodeQuery.isLoading || videoQuery.isLoading) {
    return <LoadingScreen />;
  }

  if (episodeQuery.isError) {
    return (
      <div className="p-5">
        <QueryError message="Qismni yuklab bo'lmadi." onRetry={() => episodeQuery.refetch()} />
      </div>
    );
  }

  const episode = episodeQuery.data!;
  const video = videoQuery.data;

  return (
    <div className="flex flex-col gap-4 p-5 pt-6 pb-24 lg:mx-auto lg:max-w-6xl">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-semibold text-tg-text">
          <Theater size={18} aria-hidden="true" /> Rollar
        </h1>
        <p className="text-sm text-tg-hint">{episode.title}</p>
      </div>

      {/* Mobilda bir ustun (video → ro'yxat, tepadan pastga), desktopda
          (lg+) ikki ustun: chapda video/timeline, o'ngda ro'yxat — kattaroq
          ekranda ikkalasini bir vaqtda ko'rish uchun. */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
        <div className="flex flex-col gap-4 lg:w-3/5 lg:shrink-0">
          {!video ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl bg-tg-secondaryBg px-4 py-10 text-center">
              <UploadCloud size={26} className="text-tg-hint" aria-hidden="true" />
              <p className="text-sm text-tg-hint">
                Bu qism uchun video hali yuklanmagan. Video yuklab, "rol" yaratishni boshlang.
              </p>
              {uploadProgress !== null ? (
                <div className="w-full max-w-xs">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-tg-bg">
                    <div
                      className="h-full rounded-full bg-role-director-600 transition-all"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className="mt-1 font-mono text-xs text-tg-hint">{uploadProgress}%</p>
                </div>
              ) : uploadError ? (
                <div className="flex w-full max-w-xs flex-col items-center gap-2">
                  <p className="text-xs text-role-voice-600">{uploadError}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleRetryUpload}
                      className="rounded-xl bg-tg-button px-5 py-2.5 text-sm font-medium text-tg-buttonText"
                    >
                      ↻ Qayta urinish
                    </button>
                    <button
                      onClick={() => {
                        setUploadError(null);
                        setPendingFile(null);
                        fileInputRef.current?.click();
                      }}
                      className="rounded-xl bg-tg-secondaryBg px-5 py-2.5 text-sm font-medium text-tg-text"
                    >
                      Boshqa fayl
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-xl bg-tg-button px-5 py-2.5 text-sm font-medium text-tg-buttonText"
                >
                  Video yuklash
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUploadVideo(file);
                  e.target.value = "";
                }}
              />
            </div>
          ) : (
            <>
              <VideoPlayer
                ref={playerRef}
                src={video.video_url}
                cues={cues}
                activeCueId={activeCueId}
                onCapture={handleCapture}
              />
              {activeCueId && (
                <JumpToActiveCueButton
                  onClick={() => {
                    const cue = cues.find((c) => c.id === activeCueId);
                    if (cue) playerRef.current?.seekTo(cue.timestamp_seconds);
                  }}
                />
              )}
            </>
          )}
        </div>

        <div className="lg:flex-1">
          {cuesQuery.isError ? (
            <QueryError message="Rollarni yuklab bo'lmadi." onRetry={() => cuesQuery.refetch()} />
          ) : (
            <CueList
              episodeId={episodeId!}
              allCuesCount={cues.length}
              activeCueId={activeCueId}
              currentUserId={user?.id}
              characters={charactersQuery.data ?? []}
              members={membersQuery.data ?? []}
              onSelect={handleSelectCue}
            />
          )}
        </div>
      </div>

      {pendingCapture && (
        <VoiceCueFormModal
          screenshotUrl={pendingCapture.previewUrl}
          timestampSeconds={pendingCapture.timestampSeconds}
          characters={charactersQuery.data ?? []}
          members={membersQuery.data ?? []}
          defaultCharacterId={lastCharacterId}
          defaultActorId={lastActorId}
          saving={createMutation.isPending}
          onClose={() => setPendingCapture(null)}
          onSave={(values) =>
            createMutation.mutate({ ...values, screenshot: pendingCapture.blob })
          }
        />
      )}

      {editingCue && !pendingCapture && (
        <VoiceCueFormModal
          screenshotUrl={editingCue.screenshot_url}
          timestampSeconds={editingCue.timestamp_seconds}
          characters={charactersQuery.data ?? []}
          members={membersQuery.data ?? []}
          existingCue={editingCue}
          saving={updateMutation.isPending}
          onClose={() => setEditingCue(null)}
          onSave={(values) => updateMutation.mutate({ cueId: editingCue.id, values })}
          onDelete={() => deleteMutation.mutate(editingCue.id)}
          onDuplicate={video ? () => duplicateMutation.mutate(editingCue) : undefined}
          duplicating={duplicateMutation.isPending}
        />
      )}
    </div>
  );
}
