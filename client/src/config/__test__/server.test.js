/**
 * @jest-environment node
 */
import { httpUrl, wsUrl, isLocalAddress, saveSettings, loadSettings, setSessionServer, withScheme, turnServer, stunUrls, badServerUrls } from '../server';
import { makeShareLink } from '../../components/gameSession/headerInfo/SessionContainer';

// the page this code runs on
const setProtocol = protocol => {
  globalThis.window = { location: new URL(`${protocol}//example.github.io/Domino/game-session/play/?id=1`) };
};

afterEach(() => {
  delete globalThis.window;
  setSessionServer(null);
  saveSettings({ httpAddr: 'localhost:8080', wsAddr: 'localhost:8081' });
});

describe('server addresses', () => {
  it('recognizes local addresses', () => {
    expect(isLocalAddress('localhost:8080')).toBe(true);
    expect(isLocalAddress('ws://127.0.0.1:8081/')).toBe(true);
    expect(isLocalAddress('[::1]:80')).toBe(true);
    expect(isLocalAddress('localhost.example.com')).toBe(false);
    expect(isLocalAddress('192.168.0.5:8080')).toBe(false);
  });

  it('uses plain schemes on an http page', () => {
    setProtocol('http:');
    expect(withScheme('game.example.com:8081', 'wss', 'ws')).toBe('ws://game.example.com:8081');
  });

  it('uses secure schemes on an https page, except for localhost', () => {
    setProtocol('https:');
    expect(withScheme('game.example.com:8081', 'wss', 'ws')).toBe('wss://game.example.com:8081');
    expect(withScheme('localhost:8081', 'wss', 'ws')).toBe('ws://localhost:8081');
    // an explicit scheme is kept
    expect(withScheme('ws://10.0.0.2:8081/', 'wss', 'ws')).toBe('ws://10.0.0.2:8081');
  });

  it('uses the server of an invite link for the session only', () => {
    setProtocol('http:');
    saveSettings({ httpAddr: '192.168.0.5:8080', wsAddr: '192.168.0.5:8081' });
    setSessionServer({ httpAddr: 'game.example.com:80', wsAddr: 'game.example.com:81' });
    expect(httpUrl('/x')).toBe('http://game.example.com:80/x');
    expect(wsUrl('')).toBe('ws://game.example.com:81');
    expect(loadSettings().httpAddr).toBe('192.168.0.5:8080');
    setSessionServer(null);
    expect(httpUrl('')).toBe('http://192.168.0.5:8080');
  });

  it('puts the server into invite links unless it is localhost', () => {
    setProtocol('http:');
    expect(new URL(makeShareLink('abc')).search).toBe('?id=abc');
    saveSettings({ httpAddr: '192.168.0.5:8080', wsAddr: '192.168.0.5:8081' });
    const params = new URL(makeShareLink('abc')).searchParams;
    expect(params.get('id')).toBe('abc');
    expect(params.get('http')).toBe('http://192.168.0.5:8080');
    expect(params.get('ws')).toBe('ws://192.168.0.5:8081');
  });
});

describe('TURN server', () => {
  it('is unset by default', () => {
    expect(turnServer({ turnUrl: '' })).toBeNull();
    expect(turnServer({ turnUrl: '  ' })).toBeNull();
  });

  it('adds the turn: scheme and keeps the credentials', () => {
    expect(turnServer({ turnUrl: 'a.example.com:3478, turns:a.example.com:5349', turnUser: 'u', turnPass: 'p' })).toEqual({
      urls: ['turn:a.example.com:3478', 'turns:a.example.com:5349'], username: 'u', credential: 'p',
    });
    expect(turnServer({ turnUrl: 'TURN:a.example.com', turnUser: 'u', turnPass: 'p' }))
      .toEqual({ urls: ['TURN:a.example.com'], username: 'u', credential: 'p' });
  });

  it('is not used without the login: browsers reject it', () => {
    expect(turnServer({ turnUrl: 'a.example.com:3478' })).toBeNull();
    expect(turnServer({ turnUrl: 'a.example.com:3478', turnUser: 'u' })).toBeNull();
    expect(turnServer({ turnUrl: 'a.example.com:3478', turnPass: 'p' })).toBeNull();
  });
});

it('reads own STUN servers', () => {
  expect(stunUrls('')).toEqual([]);
  expect(stunUrls('a.example.com:3478, stun:b.example.com')).toEqual(['stun:a.example.com:3478', 'stun:b.example.com']);
});

it('cleans up pasted web addresses', () => {
  expect(stunUrls('https://stun.example.com/')).toEqual(['stun:stun.example.com']);
  expect(stunUrls('stun.example.com:3478/')).toEqual(['stun:stun.example.com:3478']);
});

it('finds the addresses a browser would reject', () => {
  expect(badServerUrls({ stunUrl: 'stun.example.com:3478, [::1]:3478', turnUrl: 'turn:t.example.com:3478?transport=tcp' })).toEqual([]);
  expect(badServerUrls({ stunUrl: 'stun.example.com:abc', turnUrl: 't.example.com/path' }))
    .toEqual(['stun:stun.example.com:abc', 'turn:t.example.com/path']);
});
