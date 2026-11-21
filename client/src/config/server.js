const STORAGE_KEY = 'domino:server-settings';

export const DEFAULT_SETTINGS = Object.freeze({
  mode: ['offline', 'peer'].includes(process.env.NEXT_PUBLIC_DEFAULT_MODE) ? process.env.NEXT_PUBLIC_DEFAULT_MODE : 'online',
  // public STUN servers for peer-to-peer games across different networks
  stun: false,
  // own STUN servers, used together with the public ones or alone
  stunUrl: '',
  // own TURN relay for networks where STUN can't find a direct route (CGNAT, corporate)
  turnUrl: '',
  turnUser: '',
  turnPass: '',
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

// the TURN password stays in this tab only: it is never written to localStorage
const TAB_SECRET_KEY = 'domino:turn-pass';

// settings without the tab-only secret, as saved to localStorage
const persistent = ({ turnPass, ...rest }) => rest;

const readTabSecret = () => {
  try {
    return window.sessionStorage.getItem(TAB_SECRET_KEY) ?? '';
  } catch {
    return '';
  }
};

const writeTabSecret = value => {
  try {
    if (value) window.sessionStorage.setItem(TAB_SECRET_KEY, value);
    else window.sessionStorage.removeItem(TAB_SECRET_KEY);
  } catch {
    // storage may be unavailable (SSR, private mode)
  }
};

export const loadSettings = () => {
  if (current) return current;
  current = { ...DEFAULT_SETTINGS };
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (stored && typeof stored === 'object') {
      // a password saved by an earlier version: move it into this tab
      current = { ...current, ...persistent(stored) };
      if ('turnPass' in stored) {
        if (stored.turnPass && !readTabSecret()) writeTabSecret(stored.turnPass);
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persistent(stored)));
      }
    }
  } catch {
    // storage may be unavailable (SSR, private mode)
  }
  current.turnPass = readTabSecret();
  return current;
};

export const saveSettings = settings => {
  current = { ...loadSettings(), ...settings };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persistent(current)));
  } catch {
    // ignore
  }
  if ('turnPass' in settings) writeTabSecret(current.turnPass);
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

// "host:port", "<scheme>:host:port" or several of them separated by commas/spaces;
// a pasted web address ("https://host/") is reduced to its host
const serverUrls = (value, schemes, fallback) => String(value ?? '')
  .split(/[\s,]+/)
  .map(url => url.replace(/^[a-z]+:\/\//i, '').replace(/\/+$/, ''))
  .filter(Boolean)
  .map(url => (schemes.test(url) ? url : `${fallback}:${url}`));

export const stunUrls = value => serverUrls(value, /^stuns?:/i, 'stun');

export const turnUrls = value => serverUrls(value, /^turns?:/i, 'turn');

// what browsers accept: host or [IPv6], an optional port and transport
const ICE_URL = /^(stuns?|turns?):(\[[0-9a-f:.]+\]|[a-z0-9.-]+)(:\d{1,5})?(\?transport=(udp|tcp))?$/i;

export const isIceUrl = url => ICE_URL.test(url);

// the addresses of the settings a browser would reject
export const badServerUrls = settings =>
  [...stunUrls(settings.stunUrl), ...turnUrls(settings.turnUrl)].filter(url => !isIceUrl(url));

// a TURN address without the login: browsers reject such a server
export const turnMissingLogin = settings =>
  turnUrls(settings.turnUrl).length > 0 && !(settings.turnUser && settings.turnPass);

// the TURN relay of the settings, null when it isn't set or has no login
export const turnServer = (settings = loadSettings()) => {
  const urls = turnUrls(settings.turnUrl);
  if (!urls.length || turnMissingLogin(settings)) return null;
  return { urls, username: settings.turnUser, credential: settings.turnPass };
};
