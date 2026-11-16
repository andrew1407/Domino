/**
 * @jest-environment node
 */
import { LocalServer, isLocalSession } from '../localServer';
import { pickMove, getEnds } from '../rules';

jest.setTimeout(30000);

// plays a whole offline game with a scripted human (using the bot tactic)
const playGame = (players, score) => new Promise((resolve, reject) => {
  jest.useFakeTimers();
  const server = new LocalServer();
  const id = server.createSession(players, score);
  const socket = server.connect();
  const events = [];
  let me = null;
  let deck = [];
  let common = [];
  const send = (event, data = {}) => socket.send(JSON.stringify({ event, data: { session: id, ...data } }));
  let stock = 0;
  let finished = false;
  const act = () => {
    const move = pickMove(deck, getEnds(common));
    if (move) send('moveAction', { tile: move[0], side: move[1] });
    else if (stock) send('fromStock');
  };
  socket.onopen = () => send('joinSession');
  socket.onclose = () => {
    finished = true;
    resolve({ events, me });
  };
  socket.onmessage = ({ data: raw }) => {
    const { event, data, errorStatus } = JSON.parse(raw);
    events.push({ event, data, errorStatus });
    if (errorStatus !== 'NONE') return reject(new Error(`${event}: ${data}`));
    if (data?.deck) deck = data.deck;
    if (typeof data?.stock === 'number') stock = data.stock;
    if (data?.commonDeck) common = data.commonDeck;
    if (event === 'joinSession') me = data.name;
    if (event === 'nextMove' && data.name === me) act();
    if (event === 'fromStock' && data.deck) act();
  };
  (async () => {
    for (let i = 0; i < 20000 && !finished; ++i)
      await jest.advanceTimersByTimeAsync(100);
  })();
});

afterEach(() => jest.useRealTimers());

describe('local (in-browser) server', () => {
  it('creates local sessions only with bots for the free seats', () => {
    const server = new LocalServer();
    expect(isLocalSession(server.createSession(3, 20))).toBe(true);
    expect(() => server.createSession(3, 20, 3)).toThrow();
    expect(() => server.createSession(3, 20, -1)).toThrow();
    expect(server.getSession(server.createSession(3, 20, 0))).toMatchObject({ players: 3, bots: 0, freeSeats: 3 });
    expect(() => server.createSession(5, 20)).toThrow();
    expect(() => server.createSession(2, 0)).toThrow();
  });

  it.each([2, 3, 4])('plays a full game with %s players', async players => {
    const { events, me } = await playGame(players, 30);
    const join = events.find(e => e.event === 'joinSession').data;
    expect(join.bots).toHaveLength(players - 1);
    expect(join.bots).not.toContain(me);
    const rounds = events.filter(e => e.event === 'endRound');
    expect(rounds.length).toBeGreaterThan(0);
    const last = rounds[rounds.length - 1].data;
    expect(last.endGame).toBe(true);
    expect(last.scores[last.winner]).toBeGreaterThanOrEqual(30);
    expect(events.some(e => e.event === 'moveAction')).toBe(true);
    // against bots only, the human sits first
    const roundStart = events.find(e => e.event === 'roundStart').data;
    expect(Object.keys(roundStart.tilesCount)[0]).toBe(me);
  });

  it('rejects a move out of turn', async () => {
    jest.useFakeTimers();
    const server = new LocalServer();
    const id = server.createSession(2, 10);
    const socket = server.connect();
    const messages = [];
    socket.onmessage = ({ data }) => messages.push(JSON.parse(data));
    await jest.advanceTimersByTimeAsync(1);
    socket.send(JSON.stringify({ event: 'joinSession', data: { session: id } }));
    await jest.advanceTimersByTimeAsync(1);
    socket.send(JSON.stringify({ event: 'fromStock', data: { session: id } }));
    await jest.advanceTimersByTimeAsync(1);
    expect(messages.map(m => m.errorStatus)).toContain('MOVE_UNAVAILABLE');
    socket.close();
  });

  // a fake data channel pair: what one side sends, the other receives
  const channelPair = () => {
    const a = { readyState: 'open', onmessage: null, onclose: null };
    const b = { readyState: 'open', onmessage: null, onclose: null };
    const link = (from, to) => {
      from.send = data => setTimeout(() => to.onmessage?.({ data }));
      from.close = () => {
        if (from.readyState === 'closed') return;
        from.readyState = to.readyState = 'closed';
        setTimeout(() => { from.onclose?.({}); to.onclose?.({}); });
      };
    };
    link(a, b);
    link(b, a);
    return [a, b];
  };

  // a scripted player of a peer game using the bot tactic
  const scriptedPlayer = (socket, id, log) => {
    const state = { me: null, deck: [], common: [], stock: 0, closed: false, events: [] };
    const send = (event, data = {}) => socket.send(JSON.stringify({ event, data: { session: id, ...data } }));
    const act = () => {
      const move = pickMove(state.deck, getEnds(state.common));
      if (move) send('moveAction', { tile: move[0], side: move[1] });
      else if (state.stock) send('fromStock');
    };
    socket.onopen = () => send('joinSession');
    socket.onclose = () => { state.closed = true; };
    socket.onmessage = ({ data: raw }) => {
      const { event, data, errorStatus } = JSON.parse(raw);
      state.events.push({ event, data, errorStatus });
      log.push(errorStatus);
      if (data?.deck) state.deck = data.deck;
      if (typeof data?.stock === 'number') state.stock = data.stock;
      if (data?.commonDeck) state.common = data.commonDeck;
      if (event === 'joinSession') state.me = data.name;
      if (event === 'nextMove' && data.name === state.me) act();
      if (event === 'fromStock' && data.deck) act();
    };
    return state;
  };

  const run = async (done, steps = 20000) => {
    for (let i = 0; i < steps && !done(); ++i)
      await jest.advanceTimersByTimeAsync(100);
  };

  it.each([[2, 0], [3, 1], [4, 1], [4, 2]])('plays a peer game: %s players, %s bots', async (players, bots) => {
    jest.useFakeTimers();
    const { channelSocket } = await import('../../p2p/peer');
    const server = new LocalServer();
    const id = server.createSession(players, 25, bots);
    const statuses = [];
    const host = scriptedPlayer(server.connect(), id, statuses);
    const guests = Array.from({ length: players - bots - 1 }, () => {
      const [hostSide, guestSide] = channelPair();
      server.accept(hostSide);
      return scriptedPlayer(channelSocket(guestSide), id, statuses);
    });
    const all = [host, ...guests];
    await run(() => all.every(p => p.closed));

    expect(all.every(p => p.closed)).toBe(true);
    expect(statuses.every(s => s === 'NONE')).toBe(true);
    const names = all.map(p => p.me);
    expect(new Set(names).size).toBe(names.length);
    for (const p of all) {
      const join = p.events.find(e => e.event === 'joinSession').data;
      expect(join.bots).toHaveLength(bots);
      // a player sees only their own deck
      const start = p.events.find(e => e.event === 'roundStart').data;
      expect(start.name).toBe(p.me);
      expect(start.deck).toHaveLength(start.tilesCount[p.me]);
      const last = p.events.filter(e => e.event === 'endRound').pop().data;
      expect(last.endGame).toBe(true);
    }
    // every player received the same moves
    const moves = p => p.events.filter(e => e.event === 'moveAction').map(e => e.data.tile);
    for (const g of guests) expect(moves(g)).toEqual(moves(host));
  });

  it('frees the seat when a guest leaves before the start and interrupts a started game', async () => {
    jest.useFakeTimers();
    const { channelSocket } = await import('../../p2p/peer');
    const server = new LocalServer();
    const id = server.createSession(3, 25, 0);
    const statuses = [];
    const host = scriptedPlayer(server.connect(), id, statuses);
    const join = () => {
      const [hostSide, guestSide] = channelPair();
      server.accept(hostSide);
      return [scriptedPlayer(channelSocket(guestSide), id, statuses), guestSide];
    };
    const [first, firstChannel] = join();
    await jest.advanceTimersByTimeAsync(10);
    expect(server.getSession(id).freeSeats).toBe(1);
    firstChannel.close();
    await jest.advanceTimersByTimeAsync(10);
    expect(server.getSession(id).freeSeats).toBe(2);
    expect(host.events.some(e => e.event === 'leaveSession' && e.data.name === first.me)).toBe(true);

    join();
    const [, thirdChannel] = join();
    await jest.advanceTimersByTimeAsync(3000);
    expect(server.getSession(id).started).toBe(true);
    thirdChannel.close();
    await jest.advanceTimersByTimeAsync(200);
    expect(server.getSession(id)).toBeNull();
    expect(host.events.some(e => e.event === 'interruptedSession')).toBe(true);
    expect(host.closed).toBe(true);
  });

});
