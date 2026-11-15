/**
 * @jest-environment node
 */
import { httpUrl, wsUrl, isLocalAddress, saveSettings, loadSettings, setSessionServer, withScheme } from '../server';
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
