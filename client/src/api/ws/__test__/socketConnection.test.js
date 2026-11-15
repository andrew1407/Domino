import { socketConnection } from '../socketConnection';
import { setGuestChannel } from '../../../p2p/peer';
import { getLocalServer } from '../../../engine/localServer';

const handlers = () => new Proxy({}, { get: (t, k) => (t[k] ??= jest.fn()) });

describe('socket connection', () => {
  afterEach(() => {
    delete globalThis.WebSocket;
    jest.restoreAllMocks();
  });

  it('uses the game server for server sessions', () => {
    const sockets = [];
    globalThis.WebSocket = jest.fn(function (url) { this.url = url; this.close = jest.fn(); sockets.push(this); });
    socketConnection('5b0c4a5e-uuid', handlers()).close();
    expect(sockets).toHaveLength(1);
    expect(sockets[0].url).toMatch(/^ws:\/\/.+\/domino-session$/);
  });

  it('uses the in-browser engine for local sessions', () => {
    const connect = jest.spyOn(getLocalServer(), 'connect');
    socketConnection('local-abc', handlers()).close();
    expect(connect).toHaveBeenCalled();
  });

  it('uses the peer channel for a guest of a direct game', async () => {
    const connect = jest.spyOn(getLocalServer(), 'connect');
    const channel = { readyState: 'open', send: jest.fn(), close: jest.fn() };
    setGuestChannel('local-guest', channel);
    const emitter = socketConnection('local-guest', handlers());
    await new Promise(res => setTimeout(res, 5));
    expect(connect).not.toHaveBeenCalled();
    expect(JSON.parse(channel.send.mock.calls[0][0])).toEqual({ event: 'joinSession', data: { session: 'local-guest' } });
    emitter.close();
    expect(channel.close).toHaveBeenCalled();
  });
});
