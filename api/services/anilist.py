"""AniList (https://anilist.co) ochiq GraphQL API bilan ishlash.

Hech qanday API key talab qilinmaydi — public so'rovlar uchun bepul va
autentifikatsiyasiz ishlaydi. Faqat anime/personaj qidirish uchun
ishlatiladi, shuning uchun bu yerda minimal so'rovlar bor.
"""

import asyncio

import httpx

ANILIST_URL = "https://graphql.anilist.co"

_SEARCH_QUERY = """
query ($search: String, $perPage: Int) {
  Page(perPage: $perPage) {
    media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
      id
      title {
        romaji
        english
        native
      }
      coverImage {
        large
      }
      format
      seasonYear
    }
  }
}
"""

_CHARACTERS_QUERY = """
query ($id: Int, $page: Int, $perPage: Int) {
  Media(id: $id, type: ANIME) {
    characters(page: $page, perPage: $perPage, sort: ROLE) {
      pageInfo {
        hasNextPage
      }
      edges {
        role
        node {
          id
          name {
            full
            native
          }
          image {
            large
          }
        }
      }
    }
  }
}
"""


class _RateLimited(httpx.HTTPError):
    """AniList 429 qaytardi — qisqa kutib bitta marta qayta urinamiz."""

    def __init__(self) -> None:
        super().__init__("AniList rate limit exceeded")


async def _post(query: str, variables: dict) -> dict:
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post(
            ANILIST_URL,
            json={"query": query, "variables": variables},
            headers={"Accept": "application/json", "Content-Type": "application/json"},
        )
        if response.status_code == 429:
            raise _RateLimited()
        response.raise_for_status()
        payload = response.json()
        if "errors" in payload:
            raise httpx.HTTPError(str(payload["errors"]))
        return payload["data"]


async def search_anime(search: str, per_page: int = 10) -> list[dict]:
    try:
        data = await _post(_SEARCH_QUERY, {"search": search, "perPage": per_page})
    except _RateLimited:
        await asyncio.sleep(1.5)
        data = await _post(_SEARCH_QUERY, {"search": search, "perPage": per_page})
    results = []
    for media in data["Page"]["media"]:
        title = media["title"]
        results.append(
            {
                "anilist_id": media["id"],
                "title": title.get("english") or title.get("romaji") or title.get("native"),
                "title_romaji": title.get("romaji"),
                "title_native": title.get("native"),
                "poster_url": (media.get("coverImage") or {}).get("large"),
                "format": media.get("format"),
                "year": media.get("seasonYear"),
            }
        )
    return results


async def get_characters(anilist_id: int, per_page: int = 50, max_pages: int = 20) -> list[dict]:
    """Anime uchun BARCHA personajlarni qaytaradi (sahifalab, oxirigacha).

    AniList har bir so'rovda ko'pi bilan `per_page` ta yozuv qaytaradi
    (bu yerda 50 — AniList'ning odatiy maksimal chegarasi), shuning
    uchun 50 dan ko'p personaji bor animelarda `hasNextPage` True bo'lib
    qolaveradi va biz keyingi sahifani so'raymiz. `max_pages` faqat
    g'ayrioddiy holatlar uchun xavfsizlik chegarasi — amalda 1000 tadan
    ortiq personaji bor anime deyarli yo'q.

    MUHIM: agar keyingi sahifalardan birida vaqtinchalik xato (masalan
    AniList'ning rate-limit'i) yuz bersa, oldin muvaffaqiyatli olingan
    sahifalar tashlab yuborilmaydi — nima yig'ilgan bo'lsa, o'shani
    qaytaramiz. Faqat BIRINCHI sahifaning o'zi muvaffaqiyatsiz bo'lsa
    (hali hech narsa yo'q holatda), xato yuqoriga uzatiladi — chunki bu
    holda umuman hech narsa ko'rsatib bo'lmaydi va chaqiruvchi buni bilishi
    kerak.
    """
    results: list[dict] = []
    page = 1
    while page <= max_pages:
        try:
            data = await _post(_CHARACTERS_QUERY, {"id": anilist_id, "page": page, "perPage": per_page})
        except _RateLimited:
            # Rate-limit'ga tegib ketdik — bitta marta qisqa kutib qayta
            # urinamiz (AniList odatda soniyalar ichida tiklanadi).
            await asyncio.sleep(1.5)
            try:
                data = await _post(_CHARACTERS_QUERY, {"id": anilist_id, "page": page, "perPage": per_page})
            except httpx.HTTPError:
                if results:
                    break
                raise
        except httpx.HTTPError:
            if results:
                # Ba'zi sahifalar allaqachon muvaffaqiyatli olingan —
                # ularni yo'qotmasdan, shu yergacha to'plangan ro'yxatni
                # qaytaramiz (import butunlay bekor bo'lib qolmasin).
                break
            raise

        media = data.get("Media")
        if media is None:
            break
        characters = media["characters"]
        for edge in characters["edges"]:
            node = edge["node"]
            name = node["name"]
            results.append(
                {
                    "anilist_character_id": node["id"],
                    "name": name.get("full") or name.get("native"),
                    "native_name": name.get("native"),
                    "image_url": (node.get("image") or {}).get("large"),
                    "role": edge.get("role"),
                }
            )
        if not characters["pageInfo"]["hasNextPage"]:
            break
        page += 1
    return results
