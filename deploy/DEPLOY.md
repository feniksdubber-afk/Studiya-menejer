# AFSONA DUB — Deploy runbook (Hetzner, mavjud afsona_default tarmog'i bilan)

> **Muhim:** bu serverda AfsonaMovieBot allaqachon ishlab turibdi va 80/443
> portlarni `afsona-caddy` egallagan. Shu sababli AFSONA DUB o'z Caddy'sini
> ishga TUSHIRMAYDI — `docker-compose.yml`da caddy xizmati yo'q. Uning o'rniga
> `api` konteyneri mavjud `afsona_default` tarmog'iga qo'shiladi va
> `afsona-caddy` unga proxy qiladi (§0.3 va §8 ga qarang).

## 0. Server tayyorlash
```bash
mkdir -p /opt/afsona-dub && cd /opt/afsona-dub
git clone <repo> .
```

## 0.1 .gitignore tekshirish
Repo ichida fayl nomi ba'zan `gitignore` (nuqtasiz) bo'lib qolgan bo'lishi mumkin
(GitHub zip export xatosi). Kerak bo'lsa:
```bash
[ -f gitignore ] && mv gitignore .gitignore
[ -f miniapp/gitignore ] && mv miniapp/gitignore miniapp/.gitignore
```

## 0.2 Docker tekshirish
Docker/compose plugin serverda allaqachon o'rnatilgan (AfsonaMovieBot ishlab
turibdi). Tekshirish uchun: `docker compose version`.

## 1. .env yaratish
```bash
cp .env.example .env
python3 -c "import secrets; print(secrets.token_urlsafe(48))"   # -> JWT_SECRET
python3 -c "import secrets; print(secrets.token_urlsafe(32))"   # -> INTERNAL_API_KEY
nano .env   # BOT_TOKEN, POSTGRES_PASSWORD, R2_*, DOMAIN, ACME_EMAIL to'ldiriladi
chmod 600 .env
```

## 2. Docker image build
```bash
docker compose build
```

## 3. PostgreSQL ishga tushirish
```bash
docker compose up -d postgres
docker compose ps   # healthy bo'lguncha kuting
```

## 4. Alembic upgrade head
```bash
docker compose run --rm api alembic upgrade head
```

## 5. Super Admin seed
```bash
docker compose run --rm api python -m scripts.seed_super_admin <SIZNING_TELEGRAM_ID>
```
> Faqat bitta marta ishlaydi — bazada allaqachon super admin bo'lsa rad etadi.

## 6. API ishga tushirish
```bash
docker compose up -d api
curl -f http://localhost:8000/health   # -> {"status":"ok"} (konteyner ichidan yoki keyinroq Caddy orqali)
```

## 7. Bot ishga tushirish
```bash
docker compose up -d bot
docker compose logs -f bot   # polling boshlanganini tasdiqlang, xatolik yo'qligini tekshiring
```

## 8. Mavjud afsona-caddy'ga ulash (o'z Caddy'si yo'q!)

**8.1 DNS** — `dub.afsonatv.uz` (yoki tanlangan subdomen) A-record'ini
`138.199.169.92`ga yo'naltiring, tarqalishini kuting (`dig dub.afsonatv.uz`).

**8.2 Caddyfile'ga yangi block qo'shish** — tayyor matn
`deploy/dub-caddy-block.txt` faylida. Uni `/opt/afsona/caddy/Caddyfile`
oxiriga qo'shing:
```bash
cat /opt/afsona-dub/deploy/dub-caddy-block.txt >> /opt/afsona/caddy/Caddyfile
nano /opt/afsona/caddy/Caddyfile   # domen nomini tekshirib/almashtirib qo'ying
```

**8.3 Mini App static uchun volume qo'shish** — ko'rsatma:
`deploy/existing-caddy-compose-patch.md` (bitta qator, `/opt/afsona/docker-compose.yml`
ga qo'shiladi).

**8.4 Caddy'ni qayta ishga tushirish:**
```bash
cd /opt/afsona && docker compose up -d caddy
docker compose logs -f caddy   # ACME sertifikat muvaffaqiyatli olinganini tekshiring
curl -I https://dub.afsonatv.uz/health
```

## 9. Health check (hammasi birga)
```bash
docker compose ps                 # barcha xizmatlar "healthy"/"running"
curl -sf https://$DOMAIN/health
docker compose logs --tail=50 api bot
```

## 10. Telegram Mini App URL sozlash
- @BotFather → `/mybots` → botni tanlang → **Bot Settings → Menu Button** (yoki **Configure Mini App**) → URL: `https://$DOMAIN/`
- Eslatma: bu bosqichda `miniapp/` hali qurilmagan bo'lsa, Caddy static handler 404 qaytaradi — frontend build tayyor bo'lgach `miniapp/dist` papkasini serverga qo'yish yetarli (qayta deploy shart emas, Caddy shu papkani jonli o'qiydi).

---

## Backup (production'ga qo'yilishi shart)
```bash
cp deploy/backup/pg_backup.sh /opt/afsona-dub/deploy/backup/pg_backup.sh
chmod +x deploy/backup/pg_backup.sh
crontab -e
# qo'shing:
0 3 * * * /opt/afsona-dub/deploy/backup/pg_backup.sh >> /var/log/afsona-dub-backup.log 2>&1
```
Backup fayllar `/var/backups/afsona-dub` ga tushadi (konteynerdan tashqarida). Bu papkani muntazam serverdan tashqariga ko'chiring (Hetzner Storage Box, S3, yoki `rclone`) — faqat shu serverning o'zida saqlash yetarli emas.

---

## Production smoke test (MVP qabul mezoni)

Quyidagi zanjir Telegram orqali (real bot + Mini App bilan) to'liq bajarilishi kerak:

1. **register** — foydalanuvchi botga `/start` yuboradi, ro'yxatdan o'tadi
2. **director approval** — director so'rov yuboradi → admin tasdiqlaydi
3. **project** yaratiladi
4. **season** qo'shiladi
5. **episode** qo'shiladi
6. **character** yaratiladi
7. **image upload** — personaj rasmi Mini App orqali yuklanadi (R2'ga tushishi, WebP'ga aylanishi tekshiriladi)
8. **task** yaratiladi va
9. **assignment** — foydalanuvchiga biriktiriladi
10. **Telegram file submission** — user botga faylni yuboradi, `file_versions` yozuvi yaratiladi
11. **revision** — director revision so'raydi, sabab + yangi deadline saqlanadi
12. **new version** — user qayta fayl yuboradi, versiya raqami oshadi, avvalgi versiya `superseded` bo'ladi

Barcha 12 qadam xatosiz o'tsa — backend MVP production'da ishlaydigan holatda deb hisoblanadi.
