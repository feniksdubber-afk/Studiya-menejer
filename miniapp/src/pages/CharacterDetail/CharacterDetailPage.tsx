import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import {
  addCharacterCast,
  getCharacter,
  listCharacterCast,
  removeCharacterCast,
} from "@/api/characters";
import { searchUsers } from "@/api/users";
import { useAuth } from "@/auth/useAuth";
import { Avatar } from "@/components/Avatar";
import type { CastType, User } from "@/types";

const CAST_TYPE_META: Record<CastType, { label: string; badgeClass: string }> = {
  main: { label: "⭐ Asosiy", badgeClass: "bg-emerald-100 text-emerald-700" },
  alternate: { label: "Muqobil", badgeClass: "bg-tg-bg text-tg-hint" },
};

function AddActorForm({ characterId }: { characterId: string }) {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [castType, setCastType] = useState<CastType>("main");

  const { mutate: submit, isPending, error, reset } = useMutation({
    mutationFn: () => addCharacterCast(characterId, selectedUser!.id, castType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["character-cast", characterId] });
      resetForm();
    },
  });

  function resetForm() {
    setIsOpen(false);
    setSelectedUser(null);
    setQuery("");
    setResults([]);
    setCastType("main");
    reset();
  }

  async function handleQueryChange(value: string) {
    setQuery(value);
    setSelectedUser(null);
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    setIsSearching(true);
    try {
      setResults(await searchUsers(value.trim()));
    } catch {
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="self-start rounded-xl bg-tg-button px-3.5 py-2 text-sm font-medium text-tg-buttonText shadow-sm active:opacity-80"
      >
        + Aktyor biriktirish
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-tg-secondaryBg p-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-tg-hint">Aktyorni qidirish</label>
        <input
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          placeholder="Ism yoki @username"
          autoFocus
          className="rounded-xl bg-tg-bg px-3 py-2.5 text-sm text-tg-text outline-none ring-1 ring-transparent focus:ring-tg-button/40"
        />
        {isSearching && <p className="text-xs text-tg-hint">Qidirilmoqda...</p>}
      </div>

      {results.length > 0 && (
        <div className="flex max-h-56 flex-col gap-1 overflow-y-auto rounded-xl bg-tg-bg p-1.5">
          {results.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => {
                setSelectedUser(u);
                setQuery(`${u.first_name}${u.telegram_username ? " @" + u.telegram_username : ""}`);
                setResults([]);
              }}
              className="flex items-center gap-2.5 rounded-lg p-1.5 text-left hover:bg-tg-secondaryBg"
            >
              <Avatar firstName={u.first_name} lastName={u.last_name} size="sm" />
              <div className="flex flex-col">
                <span className="text-sm text-tg-text">
                  {u.first_name} {u.last_name ?? ""}
                </span>
                {u.telegram_username && (
                  <span className="text-xs text-tg-hint">@{u.telegram_username}</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {selectedUser && (
        <>
          <div className="flex items-center gap-2.5 rounded-xl bg-tg-button/10 p-2.5">
            <Avatar firstName={selectedUser.first_name} lastName={selectedUser.last_name} size="sm" />
            <span className="text-sm font-medium text-tg-text">
              {selectedUser.first_name} {selectedUser.last_name ?? ""}
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-tg-hint">Turi</label>
            <div className="flex gap-2">
              {(["main", "alternate"] as CastType[]).map((ct) => (
                <button
                  key={ct}
                  type="button"
                  onClick={() => setCastType(ct)}
                  className={`flex-1 rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                    castType === ct ? "bg-tg-button text-tg-buttonText" : "bg-tg-bg text-tg-text"
                  }`}
                >
                  {CAST_TYPE_META[ct].label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {error && (
        <p className="text-xs text-red-500">
          Aktyorni biriktirib bo'lmadi
          {selectedUser ? " — u allaqachon shu personajga biriktirilgan bo'lishi mumkin." : "."}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={resetForm}
          className="flex-1 rounded-xl bg-tg-bg py-2.5 text-sm font-medium text-tg-hint"
        >
          Bekor qilish
        </button>
        <button
          onClick={() => submit()}
          disabled={!selectedUser || isPending}
          className="flex-[2] rounded-xl bg-tg-button py-2.5 text-sm font-medium text-tg-buttonText shadow-sm disabled:opacity-50"
        >
          {isPending ? "Biriktirilmoqda..." : "Biriktirish"}
        </button>
      </div>
    </div>
  );
}

export default function CharacterDetailPage() {
  const { characterId } = useParams<{ characterId: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canManage = user?.role === "director" || user?.is_admin || user?.is_super_admin;

  const { data: character, isLoading } = useQuery({
    queryKey: ["character", characterId],
    queryFn: () => getCharacter(characterId!),
    enabled: !!characterId,
  });

  const { data: cast } = useQuery({
    queryKey: ["character-cast", characterId],
    queryFn: () => listCharacterCast(characterId!),
    enabled: !!characterId,
  });

  const { mutate: removeCast, variables: removingVars } = useMutation({
    mutationFn: ({ castId }: { castId: string }) => removeCharacterCast(characterId!, castId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["character-cast", characterId] });
    },
  });
  const removingCastId = removingVars?.castId ?? null;

  if (isLoading || !character) {
    return <p className="p-5 text-sm text-tg-hint">Yuklanmoqda...</p>;
  }

  const mainCast = (cast ?? []).filter((c) => c.cast_type === "main");
  const altCast = (cast ?? []).filter((c) => c.cast_type === "alternate");

  return (
    <div className="flex flex-col gap-5 pb-20">
      {/* Hero */}
      <div className="relative">
        <div className="aspect-[3/2] w-full overflow-hidden bg-gradient-to-b from-tg-secondaryBg to-tg-bg">
          {character.display_image_url ? (
            <img
              src={character.display_image_url}
              alt={character.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-5xl">🎭</div>
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0" />
        </div>
        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-0.5 p-5">
          <h1 className="text-xl font-semibold text-white drop-shadow">{character.name}</h1>
          {character.anilist_original_name && character.anilist_original_name !== character.name && (
            <p className="text-sm text-white/80 drop-shadow">{character.anilist_original_name}</p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-5 px-5">
        {!character.is_active && (
          <div className="rounded-xl bg-tg-secondaryBg px-3 py-2 text-xs font-medium text-tg-hint">
            ⚪ Bu personaj faol emas
          </div>
        )}

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-tg-hint">🎙️ Ovoz aktyorlari</h2>
            {canManage && characterId && <AddActorForm characterId={characterId} />}
          </div>

          {mainCast.length === 0 && altCast.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl bg-tg-secondaryBg px-4 py-8 text-center">
              <span className="text-2xl">🎙️</span>
              <p className="text-sm text-tg-hint">
                Hali hech kim biriktirilmagan.
                {canManage ? " Yuqoridagi tugma orqali aktyor qo'shing." : ""}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {[...mainCast, ...altCast].map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-3 rounded-2xl bg-tg-secondaryBg p-3"
                >
                  <Avatar firstName={c.user.first_name} lastName={c.user.last_name} />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium text-tg-text">
                      {c.user.first_name} {c.user.last_name ?? ""}
                    </span>
                    {c.user.telegram_username && (
                      <span className="truncate text-xs text-tg-hint">
                        @{c.user.telegram_username}
                      </span>
                    )}
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${CAST_TYPE_META[c.cast_type].badgeClass}`}
                  >
                    {CAST_TYPE_META[c.cast_type].label}
                  </span>
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => removeCast({ castId: c.id })}
                      disabled={removingCastId === c.id}
                      aria-label="Aktyorni olib tashlash"
                      className="shrink-0 rounded-full p-1.5 text-tg-hint active:bg-tg-bg disabled:opacity-40"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
