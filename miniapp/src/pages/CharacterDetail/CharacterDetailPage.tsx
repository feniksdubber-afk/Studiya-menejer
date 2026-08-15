import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { getCharacter, listCharacterCast } from "@/api/characters";

export default function CharacterDetailPage() {
  const { characterId } = useParams<{ characterId: string }>();

  const { data: character } = useQuery({
    queryKey: ["character", characterId],
    queryFn: () => getCharacter(characterId!),
    enabled: !!characterId,
  });

  const { data: cast } = useQuery({
    queryKey: ["character-cast", characterId],
    queryFn: () => listCharacterCast(characterId!),
    enabled: !!characterId,
  });

  if (!character) return <p className="p-5 text-sm text-tg-hint">Yuklanmoqda...</p>;

  return (
    <div className="flex flex-col gap-4 p-5 pt-6 pb-20">
      <h1 className="text-lg font-semibold text-tg-text">🎭 {character.name}</h1>

      <div className="mx-auto aspect-square w-40 overflow-hidden rounded-2xl bg-tg-secondaryBg">
        {character.display_image_url && (
          <img
            src={character.display_image_url}
            alt={character.name}
            className="h-full w-full object-cover"
          />
        )}
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-tg-hint">Ovoz aktyorlari</h2>
        {cast?.length ? (
          cast.map((c) => (
            <div key={c.id} className="rounded-xl bg-tg-secondaryBg px-3 py-2 text-sm text-tg-text">
              🎙️ {c.cast_type === "main" ? "Asosiy" : "Muqobil"}
            </div>
          ))
        ) : (
          <p className="text-sm text-tg-hint">Hali biriktirilmagan.</p>
        )}
      </section>
    </div>
  );
}
