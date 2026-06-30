# FlipFeedback API image. Multi-stage: build TS -> run compiled JS.
# openssl is required by the Prisma query engine on alpine.
FROM node:22-alpine AS build
RUN apk add --no-cache openssl
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY prisma ./prisma
RUN npx prisma generate
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine AS runtime
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY prisma ./prisma
RUN npx prisma generate
COPY --from=build /app/dist ./dist
EXPOSE 4000
# On boot: apply migrations, then start the server. Seeding is a separate step.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
