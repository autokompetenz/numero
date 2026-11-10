# Build et exécution de l'API Numivo.
# Cibles : build (dev deps), migrate (CLI Prisma), runtime (production).
FROM docker.io/library/node:22-bookworm-slim AS base
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./

FROM base AS build
RUN npm ci
COPY prisma ./prisma
COPY tsconfig.json ./
COPY src ./src
RUN npx prisma generate && npm run build

FROM build AS migrate
CMD ["npx", "prisma", "migrate", "deploy"]

# Amorçage ponctuel : pays, services, tarification, compte administrateur.
# Idempotent — à lancer une fois après la première migration.
FROM build AS seed
CMD ["npx", "tsx", "prisma/seed.ts"]

FROM base AS runtime
ENV NODE_ENV=production
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /app/prisma ./prisma
ENV PORT=4000
EXPOSE 4000
USER node
CMD ["node", "dist/index.js"]
