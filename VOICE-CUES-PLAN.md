# VoiceCue ("Rollar") funksiyasi — to'liq implementatsiya rejasi

> **Maqsad:** Rejissyor bo'limni ko'rib chiqayotib, kerakli joylarda skrinshot +
> vaqt + (personaj/aktyor) + izoh bilan "rolik" yaratadi. Aktyor o'z vazifasi
> ichida shu rollarni tartiblangan holda ko'radi va ovoz beradi.
>
> Bu fayl — **davom ettirish nuqtasi**. Har bir bosqich mustaqil tugallanadigan
> qilib yozilgan: agar suhbat context/limit tugab qolsa, keyingi sessiya pastdagi
> "Holat jadvali"ni ko'rib, qaysi bosqichdan davom etishni biladi.

---

## 0. Holat jadvali (har safar shu yerni yangilab boring)

| # | Bosqich | Holat |
|---|---|---|
| V1 | Video uchun R2 storage qatlami (model+presigned upload) | ✅ bajarildi |
| VF1 | Video Studio — video player + timeline (asosiy ekran) | ✅ bajarildi |
| VF2 | Cue Capture — 📸 kadr olish, tezkor/batafsil rejim | ✅ bajarildi |
| VF3 | Cue Editor — forma (yaratish/tahrirlash/duplicate) | ✅ bajarildi (Duplicate — joriy video freymidan, personaj/aktyor/izoh nusxalanadi) |
| VF4 | Cue Timeline — video ustidagi markerlar | ✅ bajarildi |
| VF5 | Cue List — filter (personaj/aktyor/status) | ✅ bajarildi (Barchasi/Mening/status tab + personaj/aktyor dropdown, **backend filterlash orqali**) |
| VF6 | Actor Workspace — aktyor uchun alohida player | ✅ bajarildi (`ActorWorkspace/VoiceCuePlayer.tsx`, `/episodes/:id/voice-cues/mine`, `TaskDetailPage`dan "Ovoz berish" tugmasi ulandi) |
| VF7 | UX holatlari (loading/empty/error/upload) | ✅ bajarildi (video upload uchun tarmoq xatosi + qayta urinish ham qo'shildi) |
| — | Desktop ikki ustunli layout | ✅ bajarildi (`lg:` breakpoint) |
| 1 | `api/models/voice_cues.py` | ✅ bajarildi |
| 2 | Alembic migratsiya `0007_voice_cues.py` | ✅ bajarildi |
| 3 | `api/schemas/voice_cues.py` | ✅ bajarildi |
| 4 | `api/services/r2_storage.py` — prefix parametri | ✅ bajarildi |
| 5 | `api/routers/voice_cues.py` | ✅ bajarildi (Duplicate endpointi bilan) |
| 6 | `api/main.py` — router ulash | ✅ bajarildi |
| 7 | `api/models/__init__.py` — export | ✅ bajarildi |
| 8 | `api/schemas/projects.py` — `EpisodeOut.project_id` | ✅ bajarildi |
| 9 | `miniapp/src/types/index.ts` — VoiceCue turlari | ✅ bajarildi |
| 10 | `miniapp/src/api/voiceCues.ts` | ✅ bajarildi (+ `api/originalVideo.ts`) |
| 11-14 | Frontend komponentlar — pastdagi VF1-VF7 bo'limlariga qarang (eski oddiy reja almashtirildi) | ✅ bajarildi (VF1/VF2/VF4 to'liq, VF3/VF5 qisman) |
| 15 | `npm run build` tekshiruvi | ✅ xatosiz o'tdi |
| 16 | O'zgargan fayllarni zip qilish + DEPLOY qo'shimchasi | ✅ shu sessiyada |

**Keyingi sessiya uchun eng muhim qolganlar:** — hammasi bajarildi (quyida).
Video CORS sozlamasini serverda haqiqiy R2 bucket bilan tekshirish hali
qoladi — bu infratuzilma (bucket konfiguratsiyasi) bandi, kod bilan hal
qilinmaydi, deploy vaqtida qo'lda tasdiqlanadi.

**Shu sessiyada qo'shimcha tuzatilgan/tugallangan:**
- `CueTimeline.tsx`: z-order xatosi — shaffof seek-range marker tugmalarini
  bosilishini to'sib qo'ygan edi, endi markerlar `z-10`, range `z-0`.
- `VoiceCueFormModal.tsx`: `character_cast` so'rovi endi render vaqtida emas,
  `useQuery` bilan to'g'ri lifecycle'da (`characterId` o'zgarganda).
- `EpisodeVideoStudioPage.tsx`: blob URL (`URL.createObjectURL`) endi
  `revokeObjectURL` bilan tozalanadi (capture almashtirilganda va unmount'da).
- **Video yuklash — tarmoq xatosi/qayta urinish (VF7):** endi xato holatida
  "↻ Qayta urinish" tugmasi chiqadi, fayl qayta tanlanmasdan davom ettiriladi.
- **Desktop ikki ustunli layout:** `lg:` breakpointda video/timeline chapda
  (`lg:w-3/5`), ro'yxat o'ngda (`lg:flex-1`) — mobilda bir ustunli tartib
  saqlanadi.
- **VF5 filterlari backend orqali:** `CueList` endi barcha cue'larni olib
  client-side filtrlash o'rniga, `listEpisodeCues` orqali
  `character_id`/`actor_id`/`status_filter`/`created_by_me` bilan backendga
  so'rov yuboradi (`useQuery` + `placeholderData` bilan silliq almashish,
  loading/error holatlari bilan). Timeline markerlari uchun to'liq
  filtrlanmagan ro'yxat alohida saqlanadi.

**Qoida:** har bir bosqich yozib bo'lingach, shu jadvaldagi holatni ✅ ga
o'zgartirib qo'yish kerak (fayl tahrirlanadi), shunda progress hech qachon
yo'qolmaydi — hatto suhbat uzilib qolsa ham fayl saqlanib qoladi.

---

## V-BOSQICH: Video saytda online ko'rinishi + avtomatik kadr olish

> **Nega alohida katta bosqich:** Hozir original video serverda saqlanmaydi —
> faqat `File.telegram_file_id` bor ("binary hech qachon serverga tushmaydi"
> degan asl qaror). Videoni brauzerda pleer bilan ko'rsatish uchun uni R2'da
> **haqiqatan saqlash** kerak. Bu eski arxitektura qarorini o'zgartiradi —
> ataylab shu joyni alohida ajratib qo'ydik, chunki narxi (R2 xotira hajmi,
> katta fayl yuklash murakkabligi) va foydasi (rejissyor uchun juda qulay
> ish oqimi) alohida baholanishi kerak.

### V1. Video uchun R2 storage qatlami

- `File` modelida `file_kind = original_video` uchun `r2_key` maydoni
  qo'shiladi (hozir bunday maydon yo'q — faqat `telegram_file_id` bor).
  Ikkalasi ham saqlanadi: Telegram nusxasi zaxira sifatida, R2 — pleer uchun.
- **Katta fayllarni backend orqali o'tkazmaslik kerak** (API serveri orqali
  bir necha GB videoni "proxy" qilish — sekin va xavfli). Shuning uchun:
  **presigned PUT URL** yondashuvi: backend R2'dan vaqtinchalik yuklash havolasi
  so'raydi (`generate_presigned_url`), frontend fayl to'g'ridan-to'g'ri
  brauzerdan R2'ga yuklaydi, backend faqat metadata (`file_id`, `r2_key`) yozib
  qoladi.
- Yangi endpointlar: `POST /episodes/{id}/original-video/upload-url` (presigned
  URL qaytaradi) va `POST /episodes/{id}/original-video/confirm` (yuklash
  tugagach, DB yozuvini yaratadi/yangilaydi). **Ruxsat: loyihaning istalgan
  a'zosi** (rejissyor, tarjimon, ovoz aktyori, sound — hammasi) yuklashi
  mumkin — cheklov faqat "shu loyiha a'zosimi" darajasida, rol bo'yicha emas.
  **Faqat video hali mavjud bo'lmagan bo'limga** — video allaqachon bor bo'lsa,
  oddiy a'zo qayta yuklay olmaydi (pastga qarang).
- **Hajm chegarasi: 500 MB.** Bu chegara ham frontendda (yuklashdan oldin
  tekshirish, foydalanuvchiga darhol xabar berish uchun), ham backendda
  (`confirm` endpointida haqiqiy fayl hajmini R2'dan so'rab tasdiqlash — faqat
  frontend tekshiruviga ishonib bo'lmaydi) qo'llanadi.
- **O'chirish/almashtirish huquqi:** video hali yo'q bo'lsa — istalgan a'zo
  birinchi marta yuklay oladi. Video **allaqachon mavjud** bo'lsa:
  - **Faqat rejissyor va admin** yangi video bilan almashtira oladi (oddiy
    a'zo — hatto o'zi birinchi yuklagan bo'lsa ham — qayta yuklay olmaydi,
    faqat birinchi marta yuklashga ruxsati bor)
  - **O'chirish**: kim yuklagan bo'lsa o'sha + rejissyor + admin
  - Bu farq router darajasida ikkita alohida tekshiruv bilan amalga oshiriladi:
    `upload-url` endpointi — agar video mavjud bo'lsa va so'rovchi
    rejissyor/admin bo'lmasa → 403; `delete` endpointi — agar so'rovchi
    yuklagan shaxs YOKI rejissyor/admin bo'lmasa → 403
- Ko'rish uchun: `GET /episodes/{id}/original-video` — R2'dan **vaqtinchalik
  (masalan 1 soatlik) o'qish havolasi** qaytaradi, MiniApp shu URL'ni
  `<video src=...>`ga beradi.
- **MUHIM (texnik):** R2 bucket'da CORS sozlanishi shart
  (`Access-Control-Allow-Origin: https://dub.afsonatv.uz`, kamida `GET`
  metodiga). Aks holda V3'dagi `canvas.drawImage(videoElement)` brauzerda
  "tainted canvas" xatosi bilan ishlamay qoladi (cross-origin video kadrini
  canvas orqali o'qib bo'lmaydi). Bu V1 bosqichida R2 konfiguratsiyasiga
  bitta qo'shimcha qadam sifatida bajarilishi kerak — kod yozishdan oldin
  eslatib qo'yiladi.

### V2-V4 → Endi VF1-VF7 sifatida qaraladi (pastga, "Frontend: Video Studio arxitekturasi" bo'limiga qarang)

Eski reja video pleerni oddiy elementga o'xshab tasvirlagan edi. Foydalanuvchi
bilan muhokamadan so'ng aniqlandiki, bu **alohida ekran — "Video Studio"**
bo'lishi kerak, u yerda rejissyor videodan chiqmasdan butun ishni bajaradi.
To'liq tafsilotlar pastda, 11-14 o'rniga yozilgan **VF1-VF7** bo'limida.

### Hal qilingan qaror (eski qismlar uchun)

Eski qismlarning original videolari uchun R2'ga ko'chirish/migratsiya kerak
emas — **faqat bundan keyingi yangi yuklanadigan videolar** uchun R2 yo'li
ishlatiladi. Eski qismlarda video pleer/kadr olish tugmasi ko'rinmaydi
(video yo'q holati sifatida ko'rsatiladi, xohlasa rejissyor keyin video
yuklab qo'yishi mumkin — retroaktiv ham ishlaydi, majburiy migratsiya emas).

---

## 1. Ma'lumotlar modeli — `VoiceCue`

Joylashuv: `api/models/voice_cues.py` (yangi fayl, `characters.py` naqshiga o'xshab)

### Maydonlar

| Maydon | Tur | Nullable | Izoh |
|---|---|---|---|
| `id` | UUID PK | — | `uuid_pk()` |
| `episode_id` | UUID FK → `episodes.id`, CASCADE | yo'q | qaysi qismga tegishli |
| `timestamp_seconds` | Integer | yo'q | 3:28 → 208 |
| `screenshot_key` | String(512) | yo'q | R2 kalit: `dub-cues/<uuid>.webp` |
| `character_id` | UUID FK → `characters.id`, SET NULL | ha | mavjud personaj bo'lsa |
| `temp_label` | String(256) | ha | personaj hali tanilmagan bo'lsa ("Notanish ayol") |
| `actor_id` | UUID FK → `users.id`, SET NULL | ha | kim ovoz berishi kerak |
| `director_note` | Text | ha | "Balandroq ovozda gapiring!" |
| `status` | Enum(`VoiceCueStatus`) | yo'q, default=`pending` | pastga qarang |
| `order_index` | Integer | yo'q, default=0 | qo'lda tartiblash uchun zaxira (asosiy sort — `timestamp_seconds`) |
| `created_by` | UUID FK → `users.id` | yo'q | rejissyor |
| `created_at`/`updated_at` | `TimestampMixin` | — | mavjud mixin ishlatiladi |

### Enum

```python
class VoiceCueStatus(str, enum.Enum):
    pending = "pending"      # hali aktyor biriktirilmagan
    assigned = "assigned"    # actor_id bor, hali yozilmagan
    recorded = "recorded"    # aktyor "Yozib bo'ldim" bosgan
```

### CHECK constraint (muhim)

DB darajasida: `character_id IS NOT NULL OR temp_label IS NOT NULL` —
ikkalasi ham bo'sh bo'lishi mumkin emas (personaj noma'lum bo'lsa ham,
kamida vaqtinchalik nom kerak). Bu `__table_args__` ichida
`CheckConstraint(...)` bilan qo'shiladi.

### Status avtomatikasi (router darajasida, modelda emas)

- Yaratilganda: `actor_id` bo'lsa → `assigned`, bo'lmasa → `pending`
- `actor_id` keyin qo'shilsa (PATCH) → `pending` dan `assigned`ga o'tadi
- Aktyor `PATCH .../status` bilan faqat `assigned → recorded` qila oladi
  (boshqa hech qanday statusga o'zi o'ta olmaydi — buni router tekshiradi)

---

## 2. Alembic migratsiya — `0007_voice_cues.py`

Naqsh: `0006_character_anilist_role.py` faylini andoza qilib oling (`down_revision`
zanjirini to'g'ri qo'yish kerak — oxirgi migratsiya qaysi ekanini albatta
`alembic history` yoki fayl ichidan tekshirib chiqing, taxmin qilmang).

Yaratiladigan narsalar:
1. `voice_cue_status` Postgres enum turi
2. `voice_cues` jadvali (yuqoridagi maydonlar)
3. Indexlar: `episode_id`, `actor_id`, `(episode_id, timestamp_seconds)` — ro'yxatni
   tez olish uchun
4. CHECK constraint (yuqorida)
5. `downgrade()` — jadval, enum va indexlarni to'g'ri ketma-ketlikda o'chirish

---

## 3. Pydantic sxemalar — `api/schemas/voice_cues.py`

- `VoiceCueCreate` — `episode_id` (URL path'dan keladi, body'da kerak emas),
  `timestamp_seconds`, `character_id | temp_label`, `actor_id` (ixtiyoriy),
  `director_note` (ixtiyoriy). Skrinshot **multipart file** sifatida keladi
  (JSON body emas — `characters.py` router'idagi rasm yuklash naqshiga qarang).
- `VoiceCueUpdate` — hammasi ixtiyoriy (`character_id`, `temp_label`, `actor_id`,
  `director_note`, `timestamp_seconds`)
- `VoiceCueStatusUpdate` — faqat `status` (aktyor uchun cheklangan endpoint)
- `VoiceCueOut` — to'liq chiqish: barcha maydon + `screenshot_url` (R2'dan
  imzolangan/ochiq URL, `character.py` dagi `image_url` naqshiga o'xshab) +
  ichma-ich qisqa `character` va `actor` obyektlari (id + name/full_name),
  frontendga qo'shimcha so'rov qilmasligi uchun

---

## 4. `r2_storage.py` — prefix parametri

Hozirgi funksiya faqat `characters/` prefiksiga yozadi (yoki shunga o'xshash
qattiq kodlangan yo'l bo'lishi mumkin — **avval faylni o'qib tasdiqlang**).
Kerakli o'zgarish: yuklash funksiyasiga `prefix: str = "characters"` kabi
parametr qo'shish, chaqiruvda `dub-cues` uzatiladi. **Personajlar kodini
buzmaslik uchun** default qiymat eski xatti-harakatni saqlab qolishi shart.

---

## 5. Router — `api/routers/voice_cues.py`

Ruxsatlar: mavjud `services/permissions.py`dagi `require_project_director`
(yoki unga o'xshash) — episode → season → project zanjiri orqali project_id
topiladi (`projects.py` routeridagi naqshga qarang).

**Yangilangan qaror:** "Rollar" bo'limi faqat rejissyorga emas — loyihaning
**barcha faol a'zolariga** (director, translator, voice actor, **sound ham**)
bir xil huquq bilan ochiq: hammasi cue yarata/tahrirlay/o'chira oladi.
Yagona cheklov — aktyor faqat o'ziga biriktirilgan cue'da status'ni
`assigned → recorded`ga o'zgartira oladi, boshqa maydonlarni emas. Shu sabab
quyidagi jadvaldagi "director" ruxsati `require_project_member` (shunchaki
loyiha a'zosi) bilan almashtiriladi, `require_project_director` faqat kerak
bo'lmaydi.

**Bildirishnoma:** `actor_id` cue'ga biriktirilganda (yaratishda yoki keyin
PATCH orqali) — aktyorga **bot orqali avtomatik xabar** yuboriladi (mavjud
`services/notification_dispatcher.py`dan foydalaniladi, Task biriktirilganda
ishlatilgan naqshga o'xshab). Xabarda: bo'lim nomi, personaj, vaqt (MM:SS),
izoh (bo'lsa) ko'rsatiladi.

| Endpoint | Method | Kim | Vazifa |
|---|---|---|---|
| `/episodes/{episode_id}/voice-cues` | POST | project a'zosi | multipart: skrinshot + JSON maydonlar → yaratadi |
| `/episodes/{episode_id}/voice-cues` | GET | project a'zosi | ro'yxat, `timestamp_seconds` bo'yicha tartiblangan. **Query filterlar (VF5):** `?character_id=`, `?actor_id=`, `?status=`, `?created_by=me` |
| `/voice-cues/mine` | GET | login qilgan user | `actor_id = current_user`, barcha loyihalar bo'yicha (yoki `?episode_id=` filter bilan) |
| `/voice-cues/{id}` | PATCH | project a'zosi | istalgan maydonni yangilaydi, `actor_id` qo'shilsa status avto-yangilanadi + bildirishnoma |
| `/voice-cues/{id}/status` | PATCH | actor_id egasi | faqat `assigned→recorded` |
| `/voice-cues/{id}/duplicate` | POST | project a'zosi | **(VF3, yangi)** — `character_id`/`actor_id` mavjud cue'dan nusxalanadi, `screenshot_key`/`timestamp_seconds` yangi so'rovdan olinadi (multipart), `status`, `director_note` bo'sh boshlanadi |
| `/voice-cues/{id}` | DELETE | project a'zosi | o'chiradi (R2'dagi faylni ham o'chirish — `file_service`/`r2_storage`dagi delete funksiyasidan foydalaning) |

**Validatsiya:** `character_id` berilsa — o'sha personaj shu `episode`ning
`project_id`iga tegishli ekanini tekshirish shart (boshqa loyiha personajini
bog'lab qo'yish xatosining oldini olish uchun — `characters.py` routerida
shunga o'xshash tekshiruv bor, o'shani ko'chiring).

---

## 6-8. Ulanish nuqtalari

- `main.py`: `app.include_router(voice_cues.router)` — boshqa routerlar qanday
  ulanganiga qarab, xuddi shu joyga qo'shiladi
- `models/__init__.py`: `VoiceCue`, `VoiceCueStatus` export qilinadi (Alembic
  autogenerate uchun ham muhim)
- `schemas/projects.py`: `EpisodeOut`ga `project_id: uuid.UUID` qo'shiladi —
  frontend episode obyektidan to'g'ridan-to'g'ri `project_id` olib, personajlar
  ro'yxatini so'rashi uchun (hozir buni bilish uchun qo'shimcha so'rov kerak
  bo'lishi mumkin — avval frontendda haqiqatan shart ekanini tekshiring)

---

## 9-10. Frontend: turlar va API klient

`types/index.ts`ga qo'shiladi:
```ts
export type VoiceCueStatus = "pending" | "assigned" | "recorded";

export interface VoiceCue {
  id: string;
  episode_id: string;
  timestamp_seconds: number;
  screenshot_url: string;
  character: { id: string; name: string } | null;
  temp_label: string | null;
  actor: { id: string; full_name: string } | null;
  director_note: string | null;
  status: VoiceCueStatus;
  created_at: string;
}
```

`api/voiceCues.ts` — mavjud `api/characters.ts` naqshiga qarab: `getEpisodeCues`,
`getMyCues`, `createCue` (FormData bilan, chunki fayl bor — `api/client.ts`da
multipart uchun mavjud yordamchi funksiyani toping, qayta yozmang),
`updateCue`, `markRecorded`, `deleteCue`.

---

## VF1-VF7 — Frontend: "Video Studio" arxitekturasi

> Asosiy g'oya: VoiceCue oddiy CRUD-forma emas, balki **video ustida
> ishlaydigan kichik dubbing-rejissyorlik studiyasi**. Rejissyor videodan
> chiqmasdan butun ishni bajaradi — vaqt kiritish, skrinshot yuklash kabi
> qo'lda ishlar yo'q.

### VF1 — Video Studio (asosiy ekran)

Yangi sahifa: `EpisodeDetailPage`dagi "Rollar" tugmasi endi alohida to'liq
ekranga olib boradi (masalan `EpisodeVideoStudioPage.tsx`, marshrut:
`/episodes/:id/studio`) — modal emas, chunki tarkib katta (video + timeline +
ro'yxat).

Tuzilma (yuqoridan pastga, **mobil-birinchi**, chunki Telegram Mini App
asosan telefon ekranida ochiladi):
1. **Video pleer** — HTML5 `<video>`, joriy vaqt/umumiy davomiylik (`0:42 / 23:18`)
2. **Progress/seek chizig'i** — bosilgan joyga o'tish
3. **Boshqaruv paneli** — orqaga/oldinga, tezlik, **📸 ROL** (bitta ixcham
   qatorda — mobilda joy tejash uchun)
4. **Rollar ro'yxati** — video ostida, **scroll qilinadigan panel**
   (`🎭 Rollar (24)` sarlavhasi), vaqt bo'yicha tartiblangan

Desktop/WebView (kattaroq ekran) uchun keyinroq **ikki ustunli** variant
(video chapda, rollar o'ngda, fixed panel) qo'shiladi — bu keyingi
optimallashtiruv, mobil versiya birinchi navbatda tugallanadi.

**"🎭 Joriy rol" tugmasi** — rejissyor timeline bo'ylab erkin yurgandan keyin,
bitta bosish bilan videoni **oxirgi ochilgan/tanlangan cue**ning
timestamp'iga qaytaradi (context yo'qotmaslik uchun).

Video hali yuklanmagan holat — "Video yuklang" (istalgan a'zo birinchi marta
yuklay oladi — V1'dagi qoidaga qarang).

### VF2 — Cue Capture (kadr olish, ikki rejim)

**📸 tugmasi bosilganda:**
- video avtomatik pauza qilinadi
- `canvas.drawImage()` orqali joriy kadr olinadi (CORS talabi V1'da yozilgan)
- `currentTime` soniyaga aylantiriladi

**Ikki rejim, standart — ⚡ Tezkor:**

| Rejim | Nima ko'rsatiladi | Qachon foydali |
|---|---|---|
| **⚡ Tezkor** (standart) | skrinshot, vaqt, Personaj + Aktyor dropdown, **"✓ Saqlash"** — bitta bosish | ketma-ket ko'p replika, izohsiz |
| **📝 Batafsil** | + izoh maydoni, vaqtni qo'lda tuzatish | murakkab/muhim joylar uchun |

Tezkor rejimda izoh so'ralmaydi — saqlangandan keyin kartani ochib
**"📝 Izoh qo'shish"** orqali istalgan vaqt qo'shish mumkin (izoh doim
ixtiyoriy).

**"Oxirgi tanlovni eslab qolish" (muhim UX, duplicate'dan ham ko'proq vaqt
tejaydi):** Personaj va Aktyor dropdown'lari **har safar 📸 bosilganda
oldingi cue'da tanlangan qiymat bilan oldindan to'ldirilgan** holda ochiladi
(frontend local state, backendga bog'liq emas). Amalda: rejissyor bir marta
"Marinette → Shohruxxon" tanlasa, keyingi 📸'larda bu juftlik avtomatik
turadi — personaj o'zgarmaguncha faqat 📸 → ✓ qilish kifoya. Bu holat sahifa
yopilganda tozalanadi (persistlanmaydi — har video-studio sessiyasi yangidan
boshlanadi).

### VF3 — Cue Editor (forma, + Duplicate)

To'liq forma (`VoiceCueFormModal.tsx`): skrinshot (VF2'dan avtomatik keladi,
batafsil rejimda qo'lda ham almashtirish mumkin), vaqt (avtomatik, batafsil
rejimda tahrirlanadi), personaj, aktyor, izoh (batafsil rejimda yoki keyin
qo'shiladi).

**Personaj dropdown:** ro'yxat oxirida **"＋ Yangi personaj"** punkti (alohida
toggle/switch emas — bitta dropdown ichida). Tanlanganda shu joyda kichik
matn input ochiladi (nom kiritish uchun).

**Aktyor dropdown — ikki guruhli, aqlli tartib:**
```
⭐ Shu personaj aktyorlari   ← character_cast'dan (avval bor edi)
────────────────
Barcha loyiha a'zolari       ← qolgan a'zolar
────────────────
Tanlanmagan
```
Personaj tanlanganda, shu personajga `character_cast` orqali biriktirilgan
aktyorlar ro'yxat boshida (yulduzcha bilan) chiqadi — qidirish tezlashadi.

**"Nusxalash" (Duplicate) tugmasi** — har bir mavjud cue kartasida. Bosilganda:
personaj va aktyor oldindan to'ldirilgan yangi cue formasi ochiladi, faqat
yangi skrinshot (📸) va vaqt kerak. (VF2'dagi "oxirgi tanlovni eslab qolish"
bilan qisman bir xil natijaga olib keladi, lekin duplicate — istalgan eski
cue'dan, "eslab qolish" esa faqat oxirgisidan ishlaydi — ikkalasi ham kerak.)

### VF4 — Cue Timeline (video ustidagi markerlar)

Video progress chizig'i ostida/ustida, har bir cue uchun kichik marker:
```
00:00 ────●────────●──────●──────────── 23:18
          🎭       🎭     🎭
```
- Marker bosilsa → video o'sha soniyaga seek qiladi, shu cue "joriy" deb
  belgilanadi (VF1'dagi "🎭 Joriy rol" tugmasi shu yerga qaytaradi)
- Marker rangi statusga qarab: pending=kulrang, assigned=ko'k, recorded=yashil
- 50-100+ cue bo'lgan uzun qismlarda rejissyorga taqsimotni bir qarashda
  ko'rsatadi

### VF5 — Cue List (ro'yxat + filterlar)

Video ostida ro'yxat, har bir qatorda: vaqt, personaj, aktyor, status belgisi.
Qatorga bosilganda **video o'sha vaqtga o'tadi va cue tafsiloti ochiladi**.

**Filterlar** (100-200 cue bo'lgan bo'limlar uchun zarur, barcha loyiha
a'zolari cue yarata olgani sababli ro'yxat tez kattalashadi):
- **Barchasi** / **Mening rollarim** (`created_by = men` — kim yaratgan
  bo'lsa, tezda o'zinikini topishi uchun) / Pending / Assigned / Recorded
- Personaj bo'yicha
- Aktyor bo'yicha

**Backend ta'siri:** `GET /episodes/{id}/voice-cues` endpointiga query
parametrlar: `?character_id=`, `?actor_id=`, `?status=`, `?created_by=me`
(5-bo'limdagi router rejasiga qo'shimcha).

### VF6 — Actor Workspace (aktyorning alohida ekrani)

Aktyor uchun **alohida to'liq ekran player** (`VoiceCuePlayer`), Task
ichidagi "🎙 Ovoz berish" tugmasidan ochiladi.

Ko'rinishi — bitta-bitta, **qo'lda navigatsiya bilan** (`← 3 / 7 →` — aktyor
istalgan rolga erkin qaytishi/o'tishi mumkin):
- Katta skrinshot
- Vaqt (`00:42`)
- Izoh (bo'lsa, ajratilgan)
- **"▶ Video joyini ko'rish"** — original video shu vaqtdan (5 soniya oldinroq,
  kontekst uchun) o'ynaydi — aktyor repligasi nimaga javoban aytilayotganini
  tushunadi
- **"✓ Yozib bo'ldim"** — bosilganda cue `recorded`ga o'tadi va **"Rol
  bajarildi ✓"** deb ko'rinadi, **keyingi cue'ga avtomatik o'tadi, lekin
  aktyor `←` bilan istalgan vaqt orqaga qaytib qayta ko'rishi/belgisini
  bekor qilishi mumkin** (avtomatik o'tish endi "qaytarib bo'lmas" emas —
  xato bosilsa muammo bo'lmaydi)
- Progress: `5/7 bajarildi` + progress bar (🟢 bajarilgan / 🔵 navbatdagi /
  ⚪ hali qilinmagan)

### VF7 — UX holatlari

Har bir yangi ekran uchun standart: loading, bo'sh holat (hali cue yo'q),
xato holati, yuklash progressi (video va skrinshot uchun alohida), tarmoq
uzilishi/qayta urinish. Telegram Mini App ichida mobil ekranga moslashtirilgan
bo'lishi shart (katta tugmalar, video to'liq kenglikda).

---

## 15. Build tekshiruvi

```bash
cd miniapp && npm install && npm run build
```
TypeScript xatolari chiqsa — shu joyda to'xtab, xatolarni birma-bir tuzatish
(screenshot URL turi, ixtiyoriy maydonlar `| null` vs `| undefined` mos
kelmasligi — odatiy xato shu yerda bo'ladi).

## 16. Yetkazib berish

Faqat **o'zgargan/yangi** fayllarni zip qilish (foydalanuvchi git orqali
yuklaydi):
```
api/models/voice_cues.py
api/models/__init__.py
api/db/migrations/versions/0007_voice_cues.py
api/schemas/voice_cues.py
api/schemas/projects.py
api/services/r2_storage.py
api/routers/voice_cues.py
api/main.py
miniapp/src/types/index.ts
miniapp/src/api/voiceCues.ts
miniapp/src/pages/EpisodeVideoStudio/EpisodeVideoStudioPage.tsx
miniapp/src/pages/EpisodeVideoStudio/components/VideoPlayer.tsx
miniapp/src/pages/EpisodeVideoStudio/components/CueTimeline.tsx
miniapp/src/pages/EpisodeVideoStudio/components/CueList.tsx
miniapp/src/components/VoiceCueFormModal.tsx
miniapp/src/components/VoiceCueCard.tsx
miniapp/src/pages/ActorWorkspace/VoiceCuePlayer.tsx
miniapp/src/pages/EpisodeDetail/EpisodeDetailPage.tsx
miniapp/src/pages/TaskDetail/TaskDetailPage.tsx
miniapp/src/router/index.tsx
```
+ qisqa DEPLOY qo'shimchasi: `alembic upgrade head` serverda ishga
tushirilishi kerakligini eslatish (yangi jadval uchun).

---

## Muhim eslatmalar (kelgusi sessiya uchun)

1. **Kod yozishdan oldin har doim mavjud faylni `view` qiling** — bu hujjatdagi
   maydon nomlari taxminiy naqshga asoslangan, lekin haqiqiy `characters.py`,
   `projects.py` routerlaridagi funksiya imzolari, import yo'llari va
   permission funksiyalari nomi bilan solishtirib yozish shart.
2. Har bir fayl yozilgach — shu hujjatning 0-bo'limidagi jadvalni yangilang.
3. Agar migratsiya raqami `0007` band bo'lib qolgan bo'lsa (masalan orada
   boshqa migratsiya qo'shilgan bo'lsa) — `db/migrations/versions/`ni qayta
   tekshirib, keyingi bo'sh raqamni ishlating.
