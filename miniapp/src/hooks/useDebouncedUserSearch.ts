import { useEffect, useRef, useState } from "react";
import { searchUsers } from "@/api/users";
import type { User } from "@/types";

// Foydalanuvchi qidiruvini debounce qiladigan umumiy hook — a'zo qo'shish
// (ProjectDetailPage) va aktyor biriktirish (CharacterDetailPage)
// formalarida takrorlanadigan mantiqni bitta joyga jamlaydi va har harf
// terilganda API'ga so'rov ketishining oldini oladi.
export function useDebouncedUserSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  function handleQueryChange(value: string) {
    setQuery(value);
    clearTimeout(timerRef.current);

    if (value.trim().length < 2) {
      setResults([]);
      return;
    }

    timerRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        setResults(await searchUsers(value.trim()));
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 350);
  }

  function reset() {
    clearTimeout(timerRef.current);
    setQuery("");
    setResults([]);
    setIsSearching(false);
  }

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return { query, setQuery, results, setResults, isSearching, handleQueryChange, reset };
}
