import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Theater } from "lucide-react";
import type { Character, ProjectMember, VoiceCue, VoiceCueStatus } from "@/types";
import { listEpisodeCues } from "@/api/voiceCues";
import { VoiceCueCard } from "@/components/VoiceCueCard";
import { EmptyState } from "@/components/EmptyState";
import { QueryError } from "@/components/StatusScreens";

type FilterTab = "all" | "mine" | VoiceCueStatus;

const TABS: { key: FilterTab; label: string }[] = [
  { key: "all", label: "Barchasi" },
  { key: "mine", label: "Mening rollarim" },
  { key: "pending", label: "Kutilmoqda" },
  { key: "assigned", label: "Biriktirildi" },
  { key: "recorded", label: "Yozildi" },
];

export function CueList({
  episodeId,
  allCuesCount,
  activeCueId,
  currentUserId,
  characters,
  members,
  onSelect,
}: {
  episodeId: string;
  /** Filtrlanmagan umumiy cue soni — sarlavhada ko'rsatiladi (ota-komponentdagi
   * to'liq ro'yxatdan, timeline markerlari uchun ishlatilgan). */
  allCuesCount: number;
  activeCueId: string | null;
  currentUserId?: string;
  characters: Character[];
  members: ProjectMember[];
  onSelect: (cue: VoiceCue) => void;
}) {
  const [tab, setTab] = useState<FilterTab>("all");
  const [characterFilter, setCharacterFilter] = useState("");
  const [actorFilter, setActorFilter] = useState("");

  // VF5: filterlash backend orqali (100-200 cue bo'lgan bo'limlarda butun
  // ro'yxatni frontendga tortib, keyin JS bilan filtrlash o'rniga — server
  // darajasida query parametrlar bilan qisqartirilgan natija so'raladi.
  const filteredQuery = useQuery({
    queryKey: [
      "episode-cues",
      episodeId,
      {
        status: tab !== "all" && tab !== "mine" ? tab : undefined,
        createdByMe: tab === "mine",
        characterId: characterFilter || undefined,
        actorId: actorFilter || undefined,
      },
    ],
    queryFn: () =>
      listEpisodeCues(episodeId, {
        status: tab !== "all" && tab !== "mine" ? (tab as VoiceCueStatus) : undefined,
        createdByMe: tab === "mine",
        characterId: characterFilter || undefined,
        actorId: actorFilter || undefined,
      }),
    enabled: !!episodeId,
    placeholderData: (prev) => prev,
  });

  const filtered = (filteredQuery.data ?? [])
    .slice()
    .sort((a, b) => a.timestamp_seconds - b.timestamp_seconds);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Theater size={15} className="text-tg-text" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-tg-text">Rollar ({allCuesCount})</h2>
      </div>

      <div className="-mx-5 flex gap-1.5 overflow-x-auto px-5 pb-0.5 lg:mx-0 lg:px-0">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium ${
              tab === t.key
                ? "bg-role-director-600 text-white"
                : "bg-tg-secondaryBg text-tg-hint"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {(characters.length > 0 || members.length > 0) && (
        <div className="flex gap-2">
          <select
            value={characterFilter}
            onChange={(e) => setCharacterFilter(e.target.value)}
            className="flex-1 rounded-xl bg-tg-secondaryBg px-2.5 py-2 text-xs text-tg-text outline-none"
          >
            <option value="">Barcha personajlar</option>
            {characters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={actorFilter}
            onChange={(e) => setActorFilter(e.target.value)}
            className="flex-1 rounded-xl bg-tg-secondaryBg px-2.5 py-2 text-xs text-tg-text outline-none"
          >
            <option value="">Barcha aktyorlar</option>
            {members.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {[m.user.first_name, m.user.last_name].filter(Boolean).join(" ")}
              </option>
            ))}
          </select>
        </div>
      )}

      {filteredQuery.isError ? (
        <QueryError
          message="Rollar ro'yxatini yuklab bo'lmadi."
          onRetry={() => filteredQuery.refetch()}
        />
      ) : filteredQuery.isLoading ? (
        <div className="flex flex-col gap-2">
          <div className="h-16 animate-pulse rounded-2xl bg-tg-secondaryBg" />
          <div className="h-16 animate-pulse rounded-2xl bg-tg-secondaryBg" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Theater} message="Bu filterda rol topilmadi." />
      ) : (
        <div
          className={`flex flex-col gap-2 ${filteredQuery.isFetching ? "opacity-60" : ""}`}
        >
          {filtered.map((cue) => (
            <VoiceCueCard
              key={cue.id}
              cue={cue}
              active={cue.id === activeCueId}
              onClick={() => onSelect(cue)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
