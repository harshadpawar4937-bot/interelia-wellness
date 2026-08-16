# syntax=docker/dockerfile:1
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Railway: set VITE_API_URL to the public API origin (https://….up.railway.app)
# Leave empty for docker-compose (nginx proxies /api → api:8000)
ARG VITE_API_URL=
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM nginx:1.27-alpine
RUN apk add --no-cache gettext
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENV PORT=80
ENV API_UPSTREAM=http://api:8000
EXPOSE 80
ENTRYPOINT ["/entrypoint.sh"]
