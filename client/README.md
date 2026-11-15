# Domino Game browser client

Next.js 16 / React 19 client. It works with the game server (online sessions with humans and bots)
or completely in the browser (offline game against bots, or a direct WebRTC game hosted by one of the players).

## Setup

**Install packages:**
```bash
npm i
```

**Run tests:**
```bash
npm test
```

**Run tests with coverage:**
```bash
npm test -- --coverage
```

**Start the dev server (create .env like .env.example optionally):**
```bash
npm run dev
```

**Build the project and run the build:**
```bash
npm run build
npm start
```

**Static export (e.g. for GitHub Pages, served from `/Domino`):**
```bash
NEXT_PUBLIC_BASE_PATH=/Domino npm run export   # result is in ./out
```

## Configuration

| variable | default | description |
| --- | --- | --- |
| `NEXT_PUBLIC_SERVER_ADDR` | `localhost:8080` | default HTTP API address |
| `NEXT_PUBLIC_WS_ADDR` | `localhost:8081` | default WebSocket API address |
| `NEXT_PUBLIC_DEFAULT_MODE` | `online` | default game mode: `online`, `peer` (direct) or `offline` |
| `NEXT_PUBLIC_BASE_PATH` | (empty) | base path for static hosting |

The server addresses can be changed at runtime (home page or the *Server* tab); they are stored in `localStorage`.
Invite links carry the server addresses, so invited players connect to the same server.

## Board

The chain is drawn on a canvas as a snake: the right branch goes right and zigzags upwards,
the left branch goes left and zigzags downwards, and doubles are placed across the line.
Pick a tile and click a highlighted end (or use the *left end* / *right end* buttons).
Drag to move the board, scroll to zoom.
