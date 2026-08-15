# /opt/afsona/docker-compose.yml ga qo'shiladigan o'zgarish

Mavjud fayldagi `caddy` xizmatining `volumes:` bo'limiga bitta qator qo'shiladi
(Mini App static build'ini Caddy ko'ra olishi uchun):

```yaml
  caddy:
    image: caddy:2-alpine
    container_name: afsona-caddy
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./caddy/Caddyfile:/etc/caddy/Caddyfile
      - ./caddy/certs:/etc/caddy/certs:ro
      - caddy_data:/data
      - caddy_config:/config
      - /opt/afsona-dub/miniapp/dist:/srv/dub-miniapp:ro   # <-- YANGI QATOR
    depends_on:
      - app
```

Amalda tahrirlash (Termux/SSH orqali, `nano` bilan):

```bash
nano /opt/afsona/docker-compose.yml
# yuqoridagi YANGI QATOR'ni caddy xizmatining volumes: ostiga qo'shing, saqlang (Ctrl+O, Enter, Ctrl+X)
```

**Muhim:** Mini App hali build qilinmagan bo'lsa (`/opt/afsona-dub/miniapp/dist` mavjud emas),
Docker volume mount bo'sh papka sifatida yaratiladi — bu xavfsiz, keyinroq build qilinganda
Caddy avtomatik shu papkani serve qila boshlaydi (qayta deploy shart emas).

O'zgarishdan keyin Caddy'ni qayta ishga tushirish kerak:

```bash
cd /opt/afsona && docker compose up -d caddy
```
