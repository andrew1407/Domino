const STORAGE_KEY = 'domino:server-settings';

export const DEFAULT_SETTINGS = Object.freeze({
  mode: ['offline', 'peer'].includes(process.env.NEXT_PUBLIC_DEFAULT_MODE) ? process.env.NEXT_PUBLIC_DEFAULT_MODE : 'online',
  // public STUN servers for peer-to-peer games across different networks
  stun: false,
  httpAddr: process.env.NEXT_PUBLIC_SERVER_ADDR || 'localhost:8080',
  wsAddr: process.env.NEXT_PUBLIC_WS_ADDR || 'localhost:8081',
});

let current = null;
// server of the session opened by an invite link: used, but not saved
let sessionOverride = null;

export const setSessionServer = server => {
  sessionOverride = server?.httpAddr && server?.wsAddr ? { ...server } : null;
};

const activeSettings = () => ({ ...loadSettings(), ...sessionOverride });

const LOCAL_HOSTS = /^(localhost|127\.\d+\.\d+\.\d+|\[::1\])(:\d+)?$/i;

export const isLocalAddress = addr => LOCAL_HOSTS.test(String(addr ?? '').trim().replace(/^[a-z]+:\/\//i, '').replace(/\/.*$/, ''));

export const loadSettings = () => {
  if (current) return current;
  current = { ...DEFAULT_SETTINGS };
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (stored && typeof stored === 'object') current = { ...current, ...stored };
  } catch {
    // storage may be unavailable (SSR, private mode)
  }
  return current;
};

export const saveSettings = settings => {
  current = { ...loadSettings(), ...settings };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // ignore
  }
  return current;
};

// an https page can't reach plain http/ws servers (mixed content), except localhost
const pageIsSecure = () => typeof window !== 'undefined' && window.location?.protocol === 'https:';

export const withScheme = (addr, secure, plain) => {
  const trimmed = String(addr ?? '').trim().replace(/\/+$/, '');
  if (/^[a-z]+:\/\//i.test(trimmed)) return trimmed;
  const scheme = pageIsSecure() && !isLocalAddress(trimmed) ? secure : plain;
  return `${scheme}://${trimmed}`;
};

export const httpUrl = (path = '/') => withScheme(activeSettings().httpAddr, 'https', 'http') + path;

export const wsUrl = (path = '/') => withScheme(activeSettings().wsAddr, 'wss', 'ws') + path;
