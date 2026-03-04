/* FinFlow — Service Worker */
const CACHE = "finflow-v1";
const STATIC = [
  "/",
  "/index.html",
  "/finflow.css",
  "/finflow.js",
  "/manifest.json"
];

// Instalação: faz cache dos arquivos estáticos
self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(STATIC))
  );
  self.skipWaiting();
});

// Ativação: limpa caches antigos
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: network first, fallback para cache
self.addEventListener("fetch", e => {
  // Ignora requisições ao Supabase (sempre precisa de rede)
  if (e.request.url.includes("supabase.co")) return;

  e.respondWith(
    fetch(e.request)
      .then(res => {
        // Atualiza o cache com a resposta mais recente
        if (res.ok && e.request.method === "GET") {
          const clone = res.clone();
          caches.open(CACHE).then(cache => cache.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
