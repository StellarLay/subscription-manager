FROM node:24-alpine

WORKDIR /workspace

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/bot/package.json apps/bot/package.json
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/api-client/package.json packages/api-client/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY packages/ui/package.json packages/ui/package.json

RUN pnpm install --frozen-lockfile

COPY . .

RUN DATABASE_URL=postgresql://build:build@localhost:5432/build pnpm --filter @subscription-manager/server run build \
  && pnpm --filter @subscription-manager/bot run build

ENV NODE_ENV=production

CMD ["pnpm", "--filter", "@subscription-manager/server", "run", "start"]
