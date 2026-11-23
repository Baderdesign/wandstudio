/* Wandstudio – Offline-Speicher */
const APP='ws-app-v6', ST = 'ws-stencils-v1', EXT = 'ws-ext-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(APP).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => ![APP, ST, EXT].includes(k)).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  if (url.hostname.endsWith('supabase.co')) return; // Anmeldung immer live
  if (url.searchParams.has('nocache')) return; // Versionsprüfung der App: immer direkt vom Server

  // App selbst: gespeicherte Version sofort zeigen (schneller Start auch ohne Empfang).
  // Die neue Version lädt im Hintergrund und gilt ab dem nächsten Start (oder sofort über «Neue Version» in der App). Ohne gespeicherte Version: Netz.
  const isApp = url.origin === location.origin && /\/(index\.html)?$/.test(url.pathname);
  if (req.mode === 'navigate' || isApp) {
    const net = fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' });
    const hitP = caches.match(isApp ? './index.html' : req, { ignoreSearch: true });
    e.respondWith(hitP.then(hit => hit || net.then(r => { if (r.ok && isApp) { const cp = r.clone(); caches.open(APP).then(c => c.put('./index.html', cp)); } return r; }).catch(() => caches.match('./index.html'))));
    e.waitUntil(hitP.then(async hit => {
      if (!hit || !isApp) return;
      const r = await net; if (!r.ok) return;
      const t = await r.text(), old = await hit.clone().text();
      if (old === t) return;
      const c = await caches.open(APP);
      await c.put('./index.html', new Response(t, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }));
    }).catch(() => {}));
    return;
  }
  // Schablonen: zuerst Speicher
  if (url.origin === location.origin && /\.webp$/i.test(url.pathname)) {
    e.respondWith(caches.open(ST).then(c => c.match(req).then(hit => hit || fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; }))));
    return;
  }
  // Übrige eigene Dateien und Bibliotheken/Schriften: Speicher, im Hintergrund auffrischen
  const ext = /(cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com|cdnjs\.cloudflare\.com|unpkg\.com)$/.test(url.hostname);
  if (url.origin === location.origin || ext) {
    const cn = url.origin === location.origin ? APP : EXT;
    e.respondWith(caches.open(cn).then(c => c.match(req).then(hit => {
      const net = fetch(req).then(r => { if (r.ok || r.type === 'opaque') c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    })));
  }
});

self.addEventListener('message', e => {
  if (e.data === 'count') caches.open(ST).then(c => c.keys()).then(k => e.source.postMessage({ count: k.length }));
});
