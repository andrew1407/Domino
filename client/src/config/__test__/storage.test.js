// the TURN password lives in this tab only (sessionStorage), never in localStorage
const STORAGE_KEY = 'domino:server-settings';
const TAB_SECRET_KEY = 'domino:turn-pass';

// a fresh settings module: it caches the settings once loaded
const freshModule = () => {
  let mod;
  jest.isolateModules(() => { mod = require('../server'); });
  return mod;
};

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

it('keeps the TURN password out of localStorage', () => {
  const { saveSettings, loadSettings } = freshModule();
  saveSettings({ turnUrl: 'turn.example.com', turnUser: 'u', turnPass: 'secret' });
  expect(localStorage.getItem(STORAGE_KEY)).not.toContain('secret');
  expect(JSON.parse(localStorage.getItem(STORAGE_KEY))).toMatchObject({ turnUrl: 'turn.example.com', turnUser: 'u' });
  expect(sessionStorage.getItem(TAB_SECRET_KEY)).toBe('secret');
  expect(loadSettings().turnPass).toBe('secret');
});

it('restores the password in the same tab only', () => {
  freshModule().saveSettings({ turnUrl: 'turn.example.com', turnUser: 'u', turnPass: 'secret' });
  // a reload of the same tab
  expect(freshModule().loadSettings()).toMatchObject({ turnUser: 'u', turnPass: 'secret' });
  // a new tab: sessionStorage is empty
  sessionStorage.clear();
  expect(freshModule().loadSettings()).toMatchObject({ turnUrl: 'turn.example.com', turnUser: 'u', turnPass: '' });
});

it('clears the password', () => {
  const { saveSettings } = freshModule();
  saveSettings({ turnPass: 'secret' });
  saveSettings({ turnPass: '' });
  expect(sessionStorage.getItem(TAB_SECRET_KEY)).toBeNull();
});

it('keeps the password when other settings are saved', () => {
  const { saveSettings } = freshModule();
  saveSettings({ turnPass: 'secret' });
  saveSettings({ mode: 'peer' });
  expect(sessionStorage.getItem(TAB_SECRET_KEY)).toBe('secret');
});

it('moves a password saved by an earlier version out of localStorage', () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ turnUrl: 'turn.example.com', turnUser: 'u', turnPass: 'old' }));
  expect(freshModule().loadSettings()).toMatchObject({ turnUser: 'u', turnPass: 'old' });
  expect(localStorage.getItem(STORAGE_KEY)).not.toContain('old');
  expect(sessionStorage.getItem(TAB_SECRET_KEY)).toBe('old');
});
