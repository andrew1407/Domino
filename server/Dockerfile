FROM node:26-alpine AS build
WORKDIR /app/server
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:26-alpine
WORKDIR /app/server
ENV NODE_ENV=production
COPY --from=build /app/server/package.json ./
COPY --from=build /app/server/node_modules ./node_modules
COPY --from=build /app/server/dist ./dist
CMD [ "node", "dist/index.js" ]
