import { useEffect, useState } from "react";
import { X, Trash2 } from "lucide-react";
import type { Character, ProjectMember, VoiceCue } from "@/types";
import { formatCueTime } from "./VoiceCueCard";

export interface VoiceCueFormValues {
  timestampSeconds: number;
  characterId: string | null;
  tempLabel: string | null;
  actorId: string | null;
  directorNote: string | null;
}

export function VoiceCueFormModal({
  screenshotUrl,
  timestampSeconds,
  characters,
  members,
  castActorIdsForCharacter,
  defaultCharacterId,
  defaultActorId,
  existingCue,
  saving,
  onClose,
  onSave,
  onDelete,
  onDuplicate,
  duplicating,
}: {
  /** Yangi cue uchun preview (blob URL) yoki tahrirlashda mavjud skrinshot. */
  screenshotUrl: string | null;
  timestampSeconds: number;
  characters: Character[];
  members: ProjectMember[];
  /** Tanlangan personajga character_cast orqali biriktirilgan aktyorlar id'lari. */
  castActorIdsForCharacter: (characterId: string) => Set<string>;
  defaultCharacterId?: string | null;
  defaultActorId?: string | null;
  existingCue?: VoiceCue | null;
  saving?: boolean;
  onClose: () => void;
  onSave: (values: VoiceCueFormValues) => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  duplicating?: boolean;
}) {
  const isEdit = !!existingCue;
  const [detailed, setDetailed] = useState(isEdit);
  const [characterId, setCharacterId] = useState<string | null>(
    existingCue?.character?.id ?? defaultCharacterId ?? null
  );
  const [addingNewCharacter, setAddingNewCharacter] = useState(false);
  const [tempLabel, setTempLabel] = useState(existingCue?.temp_label ?? "");
  const [actorId, setActorId] = useState<string | null>(
    existingCue?.actor?.id ?? defaultActorId ?? null
  );
  const [note, setNote] = useState(existingCue?.director_note ?? "");
  const [ts, setTs] = useState(timestampSeconds);

  useEffect(() => {
    setTs(timestampSeconds);
  }, [timestampSeconds]);

  const castIds = characterId ? castActorIdsForCharacter(characterId) : new Set<string>();
  const castMembers = members.filter((m) => castIds.has(m.user_id));
  const otherMembers = members.filter((m) => !castIds.has(m.user_id));

  const canSave = !!characterId || tempLabel.trim().length > 0;

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      timestampSeconds: ts,
      characterId: addingNewCharacter ? null : characterId,
      tempLabel: addingNewCharacter ? tempLabel.trim() || null : characterId ? null : tempLabel.trim() || null,
      actorId,
      directorNote: note.trim() || null,
    });
  };

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end bg-black/50" onClick={onClose}>
      <div
        className="flex max-h-[88vh] flex-col gap-4 rounded-t-3xl bg-tg-bg p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-tg-text">
            {isEdit ? "Rolni tahrirlash" : "Yangi rol"}
          </h2>
          <button onClick={onClose} className="text-tg-hint active:opacity-70" aria-label="Yopish">
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="flex gap-3 overflow-y-auto pr-0.5">
          <div className="flex flex-col items-center gap-1">
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-black/10">
              {screenshotUrl && (
                <img src={screenshotUrl} alt="" className="h-full w-full object-cover" />
              )}
            </div>
            <span className="font-mono text-xs text-tg-hint">{formatCueTime(ts)}</span>
          </div>

          <div className="flex flex-1 flex-col gap-3">
            {/* Personaj */}
            <div>
              <label className="mb-1 block text-xs font-medium text-tg-hint">Personaj</label>
              {addingNewCharacter ? (
                <input
                  autoFocus
                  value={tempLabel}
                  onChange={(e) => setTempLabel(e.target.value)}
                  placeholder="Masalan: Notanish ayol"
                  className="w-full rounded-xl bg-tg-secondaryBg px-3 py-2.5 text-sm text-tg-text outline-none"
                />
              ) : (
                <select
                  value={characterId ?? ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "__new__") {
                      setAddingNewCharacter(true);
                      setCharacterId(null);
                    } else {
                      setCharacterId(val || null);
                    }
                  }}
                  className="w-full rounded-xl bg-tg-secondaryBg px-3 py-2.5 text-sm text-tg-text outline-none"
                >
                  <option value="">Tanlanmagan</option>
                  {characters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                  <option value="__new__">＋ Yangi personaj</option>
                </select>
              )}
            </div>

            {/* Aktyor */}
            <div>
              <label className="mb-1 block text-xs font-medium text-tg-hint">Aktyor</label>
              <select
                value={actorId ?? ""}
                onChange={(e) => setActorId(e.target.value || null)}
                className="w-full rounded-xl bg-tg-secondaryBg px-3 py-2.5 text-sm text-tg-text outline-none"
              >
                <option value="">Tanlanmagan</option>
                {castMembers.length > 0 && (
                  <optgroup label="⭐ Shu personaj aktyorlari">
                    {castMembers.map((m) => (
                      <option key={m.user_id} value={m.user_id}>
                        {[m.user.first_name, m.user.last_name].filter(Boolean).join(" ")}
                      </option>
                    ))}
                  </optgroup>
                )}
                <optgroup label="Barcha loyiha a'zolari">
                  {otherMembers.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {[m.user.first_name, m.user.last_name].filter(Boolean).join(" ")}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            {detailed && (
              <>
                <div>
                  <label className="mb-1 block text-xs font-medium text-tg-hint">
                    Vaqt (soniya)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={Math.round(ts)}
                    onChange={(e) => setTs(Number(e.target.value))}
                    className="w-full rounded-xl bg-tg-secondaryBg px-3 py-2.5 text-sm text-tg-text outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-tg-hint">
                    Rejissyor izohi
                  </label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    placeholder="Masalan: Balandroq ovozda gapiring!"
                    className="w-full resize-none rounded-xl bg-tg-secondaryBg px-3 py-2.5 text-sm text-tg-text outline-none"
                  />
                </div>
              </>
            )}

            {!detailed && (
              <button
                onClick={() => setDetailed(true)}
                className="self-start text-xs font-medium text-tg-link active:opacity-70"
              >
                📝 Izoh / vaqtni tahrirlash
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isEdit && onDelete && (
            <button
              onClick={onDelete}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-role-voice-50 text-role-voice-600 active:opacity-70"
              aria-label="O'chirish"
            >
              <Trash2 size={18} aria-hidden="true" />
            </button>
          )}
          {isEdit && onDuplicate && (
            <button
              onClick={onDuplicate}
              disabled={duplicating}
              className="flex h-11 shrink-0 items-center justify-center rounded-xl bg-tg-secondaryBg px-3 text-xs font-medium text-tg-text disabled:opacity-50"
            >
              {duplicating ? "..." : "⧉ Nusxalash"}
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            className="flex h-11 flex-1 items-center justify-center rounded-xl bg-tg-button text-sm font-semibold text-tg-buttonText disabled:opacity-50"
          >
            {saving ? "Saqlanmoqda..." : "✓ Saqlash"}
          </button>
        </div>
      </div>
    </div>
  );
}
