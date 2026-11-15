FROM node:26-alpine AS build
WORKDIR /app/client
ARG NEXT_PUBLIC_SERVER_ADDR=localhost:8080
ARG NEXT_PUBLIC_WS_ADDR=localhost:8081
ENV NEXT_PUBLIC_SERVER_ADDR=$NEXT_PUBLIC_SERVER_ADDR NEXT_PUBLIC_WS_ADDR=$NEXT_PUBLIC_WS_ADDR
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:26-alpine
WORKDIR /app/client
ENV NODE_ENV=production
COPY --from=build /app/client ./
CMD [ "npm", "start" ]
