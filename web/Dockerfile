# FlipFeedback web (SPA) image. Build with Vite, serve static files with nginx.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
# Bake a placeholder API URL that the entrypoint rewrites at container start,
# so the same image can target any api.* host without a rebuild.
ENV VITE_API_URL=__API_URL__
RUN npm run build

FROM nginx:1.27-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
COPY docker-entrypoint.sh /docker-entrypoint.d/40-flipfeedback-env.sh
RUN chmod +x /docker-entrypoint.d/40-flipfeedback-env.sh
EXPOSE 80
