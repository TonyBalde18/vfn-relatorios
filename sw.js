/*
 * Service worker do HUB VFN (PWA): permite instalar a app ("Adicionar ao ecrã inicial") e abrir as
 * páginas principais sem rede (última versão vista). Não guarda dados do Supabase nem nada de CDNs.
 * VERSAO tem de acompanhar o ?v= dos ficheiros nos HTML: ao mudar um, muda o outro.
 */
const VERSAO = "15";
const CACHE = `vfn-v${VERSAO}`;
const PAGINAS = ["./", "index.html", "dashboard.html", "equipa.html", "public.html"];
const FICHEIROS = ["styles.css", "hub.css", "config.js", "shared.js", "hub.js", "components.js", "relatorio.js", "app.js", "admin.js", "dashboard.js", "equipa.js", "public.js"]
  .map(f => `${f}?v=${VERSAO}`)
  .concat(["manifest.json", "assets/logo.png", "assets/logo-icon.ico", "assets/icons/icon-192.png", "assets/icons/icon-512.png"]);

self.addEventListener("install", e => {
  // um ficheiro em falta não impede a instalação
  e.waitUntil(caches.open(CACHE).then(c => Promise.all([...PAGINAS, ...FICHEIROS].map(u => c.add(u).catch(() => null)))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(chaves => Promise.all(chaves.filter(k => k.startsWith("vfn-") && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const pedido = e.request;
  if (pedido.method !== "GET") return;
  const url = new URL(pedido.url);
  if (url.origin !== self.location.origin) return; // Supabase, CDNs: sempre pela rede
  if (pedido.mode === "navigate") {
    // páginas: rede primeiro (versão nova logo que exista); sem rede, a última guardada
    e.respondWith(fetch(pedido).then(r => {
      if (r.ok) { const copia = r.clone(); caches.open(CACHE).then(c => c.put(pedido, copia)); }
      return r;
    }).catch(() => caches.match(pedido, { ignoreSearch: true }).then(r => r || caches.match("public.html"))));
    return;
  }
  // CSS, JS e imagens do site: da cache, atualizados em segundo plano
  e.respondWith(caches.match(pedido).then(guardado => {
    const daRede = fetch(pedido).then(r => {
      if (r.ok) { const copia = r.clone(); caches.open(CACHE).then(c => c.put(pedido, copia)); }
      return r;
    }).catch(() => guardado || Response.error());
    return guardado || daRede;
  }));
});
