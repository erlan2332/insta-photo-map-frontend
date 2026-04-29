FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG VITE_MAPBOX_TOKEN
ARG VITE_API_ORIGIN=

ENV VITE_MAPBOX_TOKEN=${VITE_MAPBOX_TOKEN}
ENV VITE_API_ORIGIN=${VITE_API_ORIGIN}

RUN npm run build

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
