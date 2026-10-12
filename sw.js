/* Foxed Pages service worker: keeps the app and its fonts available offline. Your journal pages are not stored here, they live in the phone's IndexedDB. */
var SHELL_CACHE = 'foxed-pages-shell-v1';
var FONT_CACHE = 'foxed-pages-fonts-v1';
var SHELL = ['./', 'index.html', 'manifest.json', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];
var FONT_CSS = 'https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&family=IM+Fell+English:ital@0;1&family=Literata:ital,wght@0,400;0,600;1,400&display=swap';

self.addEventListener('install', function (e) {
  e.waitUntil((async function () {
    var c = await caches.open(SHELL_CACHE);
    await c.addAll(SHELL);
    try {
      var fc = await caches.open(FONT_CACHE);
      var r = await fetch(FONT_CSS);
      if (r.ok) {
        var css = await r.clone().text();
        await fc.put(FONT_CSS, r);
        var re = /\/\*\s*(latin(?:-ext)?)\s*\*\/\s*@font-face\s*\{[^}]*?url\((https:[^)]+)\)/g, m, urls = [];
        while ((m = re.exec(css))) urls.push(m[2]);
        await Promise.all(urls.map(function (u) {
          return fetch(u).then(function (x) { if (x.ok) return fc.put(u, x); }).catch(function () {});
        }));
      }
    } catch (err) { /* fonts are optional */ }
    self.skipWaiting();
  })());
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== SHELL_CACHE && k !== FONT_CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var u = new URL(req.url);
  if (u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(FONT_CACHE).then(function (c) {
      return c.match(req.url).then(function (hit) {
        return hit || fetch(req).then(function (r) {
          if (r.ok || r.type === 'opaque') c.put(req.url, r.clone());
          return r;
        });
      });
    }));
    return;
  }
  if (u.origin === location.origin) {
    e.respondWith(fetch(req).then(function (r) {
      if (r.ok) { var copy = r.clone(); caches.open(SHELL_CACHE).then(function (c) { c.put(req, copy); }); }
      return r;
    }).catch(function () {
      return caches.match(req, { ignoreSearch: true }).then(function (hit) { return hit || caches.match('index.html'); });
    }));
  }
});
