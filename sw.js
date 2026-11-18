/* Serves /game/* from Cache Storage, with HTTP Range support (needed by iOS audio/video). */
const CACHE = 'happy-game-v2';
const BASE = new URL('./', self.registration.scope).pathname;   // e.g. '/' or '/repo/'
const GAME = BASE + 'game/';
const MIME = {html:'text/html;charset=utf-8',js:'text/javascript',css:'text/css',json:'application/json',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',svg:'image/svg+xml',webp:'image/webp',
  m4a:'audio/mp4',mp3:'audio/mpeg',ogg:'audio/ogg',mp4:'video/mp4',webm:'video/webm',ks:'text/plain;charset=utf-8',tjs:'text/plain;charset=utf-8',txt:'text/plain;charset=utf-8',
  webmanifest:'application/manifest+json',woff:'font/woff',woff2:'font/woff2',ttf:'font/ttf',otf:'font/otf'};
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async()=>{ for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k); await self.clients.claim(); })()));
function keyFor(pathname){
  let p; try { p = decodeURIComponent(pathname); } catch(_) { p = pathname; }
  p = p.normalize('NFC');
  const rel = p.startsWith(GAME) ? p.slice(GAME.length) : p;
  return new Request(self.location.origin + GAME + rel.split('/').map(encodeURIComponent).join('/'));
}
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (u.origin !== self.location.origin || !u.pathname.startsWith(GAME) || e.request.method !== 'GET') return;
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    let path = u.pathname; if (path.endsWith('/')) path += 'index.html';
    const res = await c.match(keyFor(path), {ignoreSearch:true});
    if (!res) return new Response('Not found: ' + path, {status:404});
    const ext = path.split('.').pop().toLowerCase();
    const type = res.headers.get('Content-Type') || MIME[ext] || 'application/octet-stream';
    const blob = await res.blob();
    const range = e.request.headers.get('Range');
    const base = {'Content-Type':type,'Accept-Ranges':'bytes','Cache-Control':'no-cache'};
    if (range) {
      const m = /bytes=(\d*)-(\d*)/.exec(range); const size = blob.size;
      let a = m[1] ? parseInt(m[1]) : 0, b = m[2] ? parseInt(m[2]) : size - 1;
      if (!m[1] && m[2]) { a = Math.max(0, size - parseInt(m[2])); b = size - 1; }
      b = Math.min(b, size - 1);
      if (a > b) return new Response(null, {status:416, headers:{'Content-Range':'bytes */' + size}});
      return new Response(blob.slice(a, b + 1), {status:206, headers:{...base,'Content-Range':`bytes ${a}-${b}/${size}`,'Content-Length':String(b - a + 1)}});
    }
    return new Response(blob, {status:200, headers:{...base,'Content-Length':String(blob.size)}});
  })());
});
