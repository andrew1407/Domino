// In-browser game server: mirrors the WebSocket API of the NestJS gateway.
// It runs offline games (one human + bots) and also hosts peer-to-peer games:
// remote players reach it through WebRTC data channels (see ../p2p).
import {
  MoveState, PLAYER_NAMES, createDeck, distributeTiles, pickFirstMove,
  checkMovePermission, getEnds, pickMove, ableToPlay, roundSumUp, checkWinner,
} from './rules';

export const LOCAL_PREFIX = 'local-';

const TURN_DELAY = 900;
const BOT_DELAY = 700;

const errors = {
  SESSION_NOT_EXISTS: 'Current session does not exist',
  SESSION_FORBIDDEN: 'Current game session is forbidden to you',
  MOVE_UNAVAILABLE: 'You are not supposed to make move right now',
  PLAYERS_LIMIT_REACHED: 'Players limit has already been reached',
  BAD_REQUEST: 'Invalid session data has been sent',
  EMPTY_STOCK: 'You cannot get tiles from the empty stock',
  INTERNAL: 'The game has stopped because of an internal error',
};

class SessionError extends Error {
  constructor(status) {
    super(errors[status]);
    this.status = status;
  }
}

const wait = ms => new Promise(res => setTimeout(res, ms));

const shuffle = arr => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; --i) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const makeId = () => globalThis.crypto?.randomUUID?.() ??
  Math.random().toString(36).slice(2) + Date.now().toString(36);

export const isLocalSession = id => typeof id === 'string' && id.startsWith(LOCAL_PREFIX);

export class LocalServer {
  sessions = new Map();

  /**
   * @param bots bot players; the rest of the seats are for humans
   *   (the first human is the host page, others join through peer connections)
   */
  createSession(players, score, bots = players - 1) {
    const invalidPlayers = !Number.isInteger(players) || players < 2 || players > 4;
    const invalidScore = !Number.isInteger(score) || score <= 0 || score >= 26_000_000;
    const invalidBots = !Number.isInteger(bots) || bots < 0 || bots >= players;
    if (invalidPlayers || invalidScore || invalidBots)
      throw new Error(errors.BAD_REQUEST);
    const id = LOCAL_PREFIX + makeId();
    const names = shuffle(PLAYER_NAMES).slice(0, players);
    const botNames = names.slice(0, bots);
    this.sessions.set(id, {
      id,
      score,
      players,
      round: 1,
      currentMove: undefined,
      order: [...botNames],
      bots: new Set(botNames),
      freeNames: names.slice(bots),
      scores: Object.fromEntries(botNames.map(n => [n, 0])),
      decks: {},
      stock: [],
      common: [],
      humans: [], // { name, socket }
      started: false,
      locked: true,
    });
    return id;
  }

  getSession(id) {
    const s = this.sessions.get(id);
    if (!s) return null;
    return {
      id,
      players: s.players,
      bots: s.bots.size,
      humans: s.humans.map(h => h.name),
      freeSeats: s.players - s.order.length,
      started: s.started,
    };
  }

  // a socket for the page of this browser
  connect() {
    const server = this;
    const socket = {
      readyState: 0,
      onopen: null,
      onmessage: null,
      onclose: null,
      onerror: null,
      send(raw) {
        if (socket.readyState !== 1) return;
        server.#receive(socket, raw);
      },
      close() {
        if (socket.readyState >= 2) return;
        socket.readyState = 3;
        server.#disconnect(socket);
        setTimeout(() => socket.onclose?.({ code: 1000 }));
      },
    };
    setTimeout(() => {
      if (socket.readyState !== 0) return;
      socket.readyState = 1;
      socket.onopen?.({});
    });
    return socket;
  }

  /**
   * Serves a remote player through a message channel (an open RTCDataChannel
   * or anything with send/close/onmessage/onclose).
   */
  accept(channel) {
    const server = this;
    const socket = {
      readyState: 1,
      remote: true,
      onmessage: e => {
        try {
          channel.send(e.data);
        } catch {
          socket.close();
        }
      },
      close() {
        if (socket.readyState >= 2) return;
        socket.readyState = 3;
        server.#disconnect(socket);
        try {
          channel.close();
        } catch {
          // already closed
        }
      },
    };
    channel.onmessage = e => {
      if (socket.readyState === 1) server.#receive(socket, e.data);
    };
    channel.onclose = () => socket.close();
    return socket;
  }

  #receive(socket, raw) {
    let message;
    try {
      message = JSON.parse(raw);
    } catch {
      return;
    }
    if (!message || typeof message !== 'object') return;
    Promise.resolve().then(() => this.#handle(socket, message));
  }

  #send(socket, event, data, errorStatus = 'NONE') {
    if (!socket || socket.readyState !== 1) return;
    const raw = JSON.stringify({ event, data, errorStatus });
    setTimeout(() => socket.onmessage?.({ data: raw }));
  }

  #broadcast(s, event, data, except = null) {
    for (const { socket } of s.humans)
      if (socket !== except) this.#send(socket, event, data);
  }

  // sends personal data to every human player
  #notify(s, event, makeData) {
    for (const { name, socket } of s.humans) this.#send(socket, event, makeData(name));
  }

  #handle(socket, { event, data }) {
    const payload = data && typeof data === 'object' ? data : {};
    try {
      const handler = {
        joinSession: this.#onJoin,
        moveCheck: this.#onMoveCheck,
        moveAction: this.#onMoveAction,
        fromStock: this.#onFromStock,
      }[event];
      if (!handler) return;
      handler.call(this, socket, payload);
    } catch (e) {
      const status = e instanceof SessionError ? e.status : 'INTERNAL_SERVER_ERROR';
      this.#send(socket, 'error', e.message, status);
    }
  }

  #sessionData(s) {
    return { score: s.score, players: s.players, round: s.round, current_move: s.currentMove };
  }

  #decksInfo(s, recipient) {
    const tilesCount = Object.fromEntries(s.order.map(p => [p, s.decks[p]?.length ?? 0]));
    return {
      ...this.#sessionData(s),
      stock: s.stock.length,
      scores: { ...s.scores },
      name: recipient,
      deck: (s.decks[recipient] ?? []).map(t => ({ ...t })),
      tilesCount,
    };
  }

  // move info for a recipient: other players' hidden data is removed
  #moveInfo(s, recipient, player, tile, hidden) {
    const info = { ...this.#decksInfo(s, recipient), tile: { ...tile }, commonDeck: s.common.map(t => ({ ...t })) };
    if (player !== recipient) hidden.forEach(k => delete info[k]);
    return info;
  }

  #get(id) {
    const s = this.sessions.get(id);
    if (!s) throw new SessionError('SESSION_NOT_EXISTS');
    return s;
  }

  #onJoin(socket, { session }) {
    if (typeof session !== 'string') throw new SessionError('BAD_REQUEST');
    const s = this.#get(session);
    if (s.humans.some(h => h.socket === socket)) throw new SessionError('SESSION_FORBIDDEN');
    if (!s.freeNames.length) throw new SessionError('PLAYERS_LIMIT_REACHED');
    const name = s.freeNames.shift();
    const joined = { ...this.#sessionData(s), name, bots: [...s.bots] };
    this.#broadcast(s, 'sessionNewcomer', joined);
    s.humans.push({ name, socket });
    s.order.push(name);
    s.scores[name] = 0;
    this.#send(socket, 'joinSession', { ...joined, scores: { ...s.scores } });
    if (!s.freeNames.length) {
      s.started = true;
      this.#run(s, this.#startRound(s));
    }
  }

  #validate(socket, session) {
    if (typeof session !== 'string') throw new SessionError('BAD_REQUEST');
    const s = this.#get(session);
    const player = s.humans.find(h => h.socket === socket);
    if (!player) throw new SessionError('SESSION_FORBIDDEN');
    if (s.locked || s.currentMove !== player.name) throw new SessionError('MOVE_UNAVAILABLE');
    return [s, player.name];
  }

  #parseMove({ tile, side }) {
    if (side !== 'left' && side !== 'right') throw new SessionError('BAD_REQUEST');
    const left = parseInt(tile?.left, 10);
    const right = parseInt(tile?.right, 10);
    const invalid = v => isNaN(v) || v < 0 || v > 6;
    if (invalid(left) || invalid(right)) throw new SessionError('BAD_REQUEST');
    return [{ left, right }, side];
  }

  #onMoveCheck(socket, data) {
    const [s] = this.#validate(socket, data.session);
    const [tile, side] = this.#parseMove(data);
    const comparable = getEnds(s.common)[side === 'left' ? 0 : 1];
    const permission = checkMovePermission(tile, comparable, side);
    this.#send(socket, 'moveCheck', { permission, tile, side });
  }

  #onMoveAction(socket, data) {
    const [s, player] = this.#validate(socket, data.session);
    const [tile, side] = this.#parseMove(data);
    this.#makeMove(s, player, tile, side);
  }

  #onFromStock(socket, data) {
    const [s, player] = this.#validate(socket, data.session);
    this.#takeFromStock(s, player);
  }

  #makeMove(s, player, tile, side) {
    const deck = s.decks[player];
    const idx = deck.findIndex(t => t.left === tile.left && t.right === tile.right);
    const comparable = getEnds(s.common)[side === 'left' ? 0 : 1];
    if (idx < 0 || !checkMovePermission(tile, comparable, side)) throw new SessionError('BAD_REQUEST');
    deck.splice(idx, 1);
    const reversed = side === 'left' ?
      comparable.left !== tile.right :
      comparable.right !== tile.left;
    const placed = reversed ? { left: tile.right, right: tile.left } : { ...tile };
    if (side === 'left') s.common.unshift(placed);
    else s.common.push(placed);
    s.locked = true;
    this.#notify(s, 'moveAction', r => this.#moveInfo(s, r, player, placed, ['deck']));
    if (!deck.length) this.#run(s, this.#endRound(s));
    else this.#run(s, this.#nextMove(s));
  }

  #takeFromStock(s, player) {
    if (!s.stock.length) throw new SessionError('EMPTY_STOCK');
    const [tile] = s.stock.splice(Math.floor(Math.random() * s.stock.length), 1);
    s.decks[player].push(tile);
    this.#notify(s, 'fromStock', r => this.#moveInfo(s, r, player, tile, ['deck', 'tile']));
    this.#handleMoveState(s, player);
  }

  async #startRound(s) {
    s.locked = true;
    await wait(TURN_DELAY);
    if (!this.#alive(s)) return;
    const [decks, stock] = distributeTiles(s.order, createDeck());
    s.decks = decks;
    s.stock = stock;
    s.common = [];
    this.#notify(s, 'roundStart', r => this.#decksInfo(s, r));
    await wait(TURN_DELAY);
    if (!this.#alive(s)) return;
    const [first, tile] = pickFirstMove(s.decks);
    s.decks[first] = s.decks[first].filter(t => !(t.left === tile.left && t.right === tile.right));
    s.common = [tile];
    s.currentMove = first;
    this.#notify(s, 'firstMove', r => this.#moveInfo(s, r, first, tile, ['deck']));
    await this.#nextMove(s);
  }

  async #nextMove(s, skippedBy = null) {
    s.locked = true;
    await wait(TURN_DELAY);
    if (!this.#alive(s)) return;
    const idx = s.order.indexOf(s.currentMove);
    s.currentMove = s.order[(idx + 1) % s.order.length];
    s.locked = false;
    const info = { name: s.currentMove };
    if (skippedBy) info.skippedBy = skippedBy;
    this.#broadcast(s, 'nextMove', info);
    this.#handleMoveState(s, s.currentMove);
  }

  #handleMoveState(s, player) {
    const state = ableToPlay(player, s.decks, s.stock.length, getEnds(s.common));
    if (state !== MoveState.AVAILABLE) s.locked = true;
    if (state === MoveState.SKIPPABLE) this.#run(s, this.#nextMove(s, player));
    else if (state === MoveState.DEAD_END) this.#run(s, this.#endRound(s, true));
    else if (s.bots.has(player)) this.#run(s, this.#botMove(s, player));
  }

  async #botMove(s, player) {
    await wait(BOT_DELAY);
    if (!this.#alive(s) || s.locked || s.currentMove !== player) return;
    const move = pickMove(s.decks[player], getEnds(s.common));
    if (move) this.#makeMove(s, player, ...move);
    else this.#takeFromStock(s, player);
  }

  async #endRound(s, deadEnd = false) {
    s.locked = true;
    await wait(TURN_DELAY);
    if (!this.#alive(s)) return;
    const { scores, winner } = roundSumUp(s.decks, s.scores);
    s.scores = scores;
    const endGame = !!checkWinner(scores, s.score);
    const res = { ...this.#sessionData(s), scores: { ...scores }, endGame, deadEnd };
    if (winner) res.winner = winner;
    this.#broadcast(s, 'endRound', res);
    if (endGame) {
      const sockets = s.humans.map(h => h.socket);
      this.sessions.delete(s.id);
      setTimeout(() => sockets.forEach(socket => socket.close()), 50);
      return;
    }
    s.round += 1;
    await this.#startRound(s);
  }

  #alive(s) {
    return this.sessions.get(s.id) === s && s.humans.some(h => h.socket.readyState === 1);
  }

  #run(s, task) {
    task.catch(e => {
      if (!this.#alive(s)) return;
      console.error(e);
      // a failed turn chain would leave the session locked forever: end it
      this.sessions.delete(s.id);
      for (const { socket } of s.humans) {
        this.#send(socket, 'error', errors.INTERNAL, 'INTERNAL_SERVER_ERROR');
        setTimeout(() => socket.close(), 50);
      }
    });
  }

  #disconnect(socket) {
    for (const [id, s] of this.sessions) {
      const idx = s.humans.findIndex(h => h.socket === socket);
      if (idx < 0) continue;
      const [{ name }] = s.humans.splice(idx, 1);
      // the host page holds the game: without it (or once started) the game is over
      const hostLeft = !socket.remote;
      if (s.started || hostLeft || !s.humans.length) {
        this.sessions.delete(id);
        for (const h of s.humans) {
          this.#send(h.socket, 'interruptedSession', { name });
          setTimeout(() => h.socket.close(), 50);
        }
      } else {
        s.order.splice(s.order.indexOf(name), 1);
        delete s.scores[name];
        s.freeNames.push(name);
        this.#broadcast(s, 'leaveSession', { name });
      }
    }
  }
}

let instance = null;

export const getLocalServer = () => (instance ??= new LocalServer());
