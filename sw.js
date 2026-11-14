/* Wandstudio – Offline-Speicher */
const APP='ws-app-v5', ST = 'ws-stencils-v1', EXT = 'ws-ext-v1';
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

  // App selbst: gespeicherte Version sofort zeigen, wenn das Netz nicht innert 2.5 s die ganze neue Version liefert.
  // Die neue Version lädt im Hintergrund weiter und ist beim nächsten Start da. Ohne gespeicherte Version: Netz.
  const isApp = url.origin === location.origin && /\/(index\.html)?$/.test(url.pathname);
  if (req.mode === 'navigate' || isApp) {
    const net = fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }).then(r => {
      if (!r.ok) return r;
      return r.blob().then(b => {
        const full = new Response(b, { status: r.status, statusText: r.statusText, headers: r.headers });
        if (isApp) { const cp = full.clone(); caches.open(APP).then(c => c.put('./index.html', cp)); }
        return full;
      });
    });
    e.waitUntil(net.then(() => {}, () => {}));
    e.respondWith(caches.match(isApp ? './index.html' : req, { ignoreSearch: true }).then(hit => {
      if (!hit) return net.catch(() => caches.match('./index.html'));
      const slow = new Promise(res => setTimeout(() => res(hit), 2500));
      return Promise.race([net.then(r => (r && r.ok) ? r : hit, () => hit), slow]);
    }));
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
