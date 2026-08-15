# Bu Dockerfile faqat CI/tooling uchun (static build image sifatida).
# Production deploy'da esa docker-compose.yml Caddy'ga to'g'ridan-to'g'ri
# ./miniapp/dist papkasini volume sifatida ulaydi — shuning uchun serverga
# chiqarishdan oldin quyidagini bajarish kifoya:
#   cd miniapp && npm ci && npm run build
# Bu Dockerfile ixtiyoriy: agar build serverning o'zida (masalan alohida
# CI bosqichida) qilinishini istasangiz ishlatiladi.

FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build

FROM scratch AS export
COPY --from=build /app/dist /dist
