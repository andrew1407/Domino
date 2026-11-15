# Domino Game server

This is a system containing both HTTP and WebSocket servers (NestJS 12, ESM, Node.js 26+). Session data is stored in Redis.

## Setup

**Install packages:**
```bash
npm i
```

**Run tests (Vitest; the game session service tests need Redis at `REDIS_URL`):**
```bash
npm test
```

**Run tests with coverage:**
```bash
npm test -- --coverage
```

**To start the server create .env file like .env.example (optionally) and run:**
```bash
npm start
```

**Build the project and run the build:**
```bash
npm run build
npm run start:prod
```

## Environment

| variable | default | description |
| --- | --- | --- |
| `PORT` | `8080` | HTTP port |
| `HOST` | `localhost` | HTTP host |
| `WS_PORT` | `8081` | WebSocket port |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection URL |
| `BOT_MOVE_DELAY` | `800` | bot "thinking" delay, ms |

## Bots

`GET /domino-session?players=4&score=50&bots=3` (or `POST /domino-session` with `{ "players": 4, "score": 50, "bots": 3 }`)
creates a session where 3 seats are taken by bots (`0 <= bots < players`). Bots join immediately; the game starts when all
human players have joined. Bot names are sent in the `bots` field of `joinSession`/`sessionNewcomer` events.
