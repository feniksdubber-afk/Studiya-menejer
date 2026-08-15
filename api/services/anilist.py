"""AniList (https://anilist.co) ochiq GraphQL API bilan ishlash.

Hech qanday API key talab qilinmaydi — public so'rovlar uchun bepul va
autentifikatsiyasiz ishlaydi. Faqat anime/personaj qidirish uchun
ishlatiladi, shuning uchun bu yerda minimal so'rovlar bor.
"""

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


async def _post(query: str, variables: dict) -> dict:
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.post(
            ANILIST_URL,
            json={"query": query, "variables": variables},
        )
        response.raise_for_status()
        payload = response.json()
        if "errors" in payload:
            raise httpx.HTTPError(str(payload["errors"]))
        return payload["data"]


async def search_anime(search: str, per_page: int = 10) -> list[dict]:
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


async def get_characters(anilist_id: int, per_page: int = 25) -> list[dict]:
    data = await _post(_CHARACTERS_QUERY, {"id": anilist_id, "page": 1, "perPage": per_page})
    media = data.get("Media")
    if media is None:
        return []
    edges = media["characters"]["edges"]
    results = []
    for edge in edges:
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
    return results
