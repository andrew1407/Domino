// Offline support: keeps the app shell (pages, scripts, styles, fonts, tile images)
// so the game opens and runs against bots without a connection.
//
// - pages: network first (fresh deploys win), the cached copy when offline
// - /_next/static/* and /static/*: cache first (file names are content-hashed or fixed)
// - everything else (game server API, websockets, other origins): untouched
//
// No build step: on install (and on every online visit) the worker downloads each
// page, reads the assets it references and caches them under the build id of the
// deploy, dropping the caches of older deploys.

const PREFIX = 'domino-';
const SCOPE = new URL(self.registration.scope);
const BASE = SCOPE.pathname.replace(/\/$/, '');
const PAGES = ['/', '/game-session', '/game-session/play', '/game-session/peer'];
const TILES = [];
for (let a = 0; a <= 6; a++) for (let b = 0; b <= a; b++) TILES.push(`/static/tiles/${a}-${b}.svg`);
const STATIC = [...TILES, '/static/tile.png', '/static/score.png', '/static/clipboard.png'];
const NAVIGATION_TIMEOUT = 4000;

const local = path => new URL(BASE + path, SCOPE.origin).href;

// one cache entry per page, whatever the url form: /x, /x/, /x/index.html, /x?id=…
const pageKey = url => {
  const { pathname } = new URL(url);
  const path = pathname.slice(BASE.length).replace(/(\/index)?\.html$/, '').replace(/\/+$/, '');
  return local(`${path || ''}/`);
};

const isAsset = url => url.origin === SCOPE.origin &&
  (url.pathname.startsWith(`${BASE}/_next/static/`) || url.pathname.startsWith(`${BASE}/static/`) ||
    url.pathname.startsWith(`${BASE}/fonts/`));

const buildIdOf = html => html.match(/"buildId"\s*:\s*"([^"]+)"/)?.[1];

// a redirected response can't answer a navigation: copy it into a plain one
const plain = async response => new Response(await response.blob(), {
  status: response.status,
  statusText: response.statusText,
  headers: response.headers,
});

const referencedAssets = (text, base) => {
  const urls = new Set();
  const patterns = [/(?:src|href)="([^"]+)"/g, /url\(\s*['"]?([^'")]+)['"]?\s*\)/g];
  for (const pattern of patterns)
    for (const [, ref] of text.matchAll(pattern)) {
      if (ref.startsWith('data:')) continue;
      try {
        const url = new URL(ref.replace(/&amp;/g, '&'), base);
        if (isAsset(url)) urls.add(url.href);
      } catch {
        // not a url
      }
    }
  return urls;
};

const currentCache = async () => {
  const names = (await caches.keys()).filter(n => n.startsWith(PREFIX));
  return names.length ? caches.open(names[names.length - 1]) : null;
};

let precaching = null;

// downloads every page of the current deploy with its assets
const precache = () => precaching ??= (async () => {
  const pages = await Promise.all(PAGES.map(async path => {
    const response = await fetch(local(path), { cache: 'no-cache' });
    if (!response.ok) throw new Error(`${path}: ${response.status}`);
    const html = await response.clone().text();
    return { path, response, html };
  }));
  const buildId = buildIdOf(pages[0].html) ?? 'dev';
  const name = PREFIX + buildId;
  const cache = await caches.open(name);

  const assets = new Set(STATIC.map(local));
  for (const { response, html } of pages) {
    await cache.put(pageKey(response.url), await plain(response));
    referencedAssets(html, response.url).forEach(a => assets.add(a));
  }

  // styles reference fonts, which pages don't list
  const fetched = async url => {
    if (await cache.match(url)) return;
    const response = await fetch(url);
    if (!response.ok) return;
    if (/\.css(\?|$)/.test(url)) {
      const css = await response.clone().text();
      await Promise.all([...referencedAssets(css, url)].map(fetched));
    }
    await cache.put(url, response);
  };
  await Promise.all([...assets].map(fetched));

  for (const old of await caches.keys())
    if (old.startsWith(PREFIX) && old !== name) await caches.delete(old);
})().finally(() => { precaching = null; });

self.addEventListener('install', event => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

// pages ask for a refresh after loading online: picks up a new deploy
self.addEventListener('message', event => {
  if (event.data === 'precache') event.waitUntil(precache().catch(() => {}));
});

const withTimeout = (promise, ms) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('timeout')), ms);
  promise.then(resolve, reject).finally(() => clearTimeout(timer));
});

const page = async request => {
  const network = fetch(request);
  try {
    const response = await withTimeout(network, NAVIGATION_TIMEOUT);
    if (response.ok) {
      const cache = await currentCache();
      if (cache) await cache.put(pageKey(response.url || request.url), await plain(response.clone()));
    }
    return response;
  } catch (error) {
    const cached = await caches.match(pageKey(request.url));
    if (cached) return cached;
    // a slow network still beats nothing
    return network;
  }
};

const asset = async request => {
  const cached = await caches.match(request.url);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await currentCache();
    if (cache) await cache.put(request.url, response.clone());
  }
  return response;
};

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== SCOPE.origin || !url.pathname.startsWith(BASE + '/')) return;
  if (request.mode === 'navigate') event.respondWith(page(request));
  else if (isAsset(url)) event.respondWith(asset(request));
});
