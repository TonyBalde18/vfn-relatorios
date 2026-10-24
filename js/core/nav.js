"use strict";

/* =========================================================
   NAVEGAÇÃO DE TOPO (V2.0) — partilhada pelo admin, dashboard e Área do Jogador
   Barra principal (Portal · Plantel · Jogo) + barra secundária com os separadores da secção ativa;
   no telemóvel (≤768px) a principal passa para uma barra inferior. As vistas continuam a ser de cada
   página: a nav só chama cfg.aoMudar(vista) e a página mostra a secção #view-<vista> / #tab-<vista>.
   O endereço guarda a posição (#portal/calendario), para links entre páginas e para recarregar.
   ========================================================= */

(function () {
  const esc = s => VFN.escapeHtml(s);
  const icone = (nome, tam) => `<i data-icon="${nome}" data-size="${tam || 18}"></i>`;

  let cfg = null;
  let papel = "";
  let atual = { seccao: "", tab: "" };
  const ultimoTab = {}; // voltar a uma secção abre o último separador visto nela

  const visivel = item => !item.papeis || item.papeis.includes(papel);
  const hrefDe = s => (typeof s.href === "function" ? s.href(papel) : s.href) || "";
  const seccoes = () => cfg.seccoes.filter(visivel).map(s => Object.assign({}, s, { tabs: (s.tabs || []).filter(visivel) }));
  const locais = () => seccoes().filter(s => !hrefDe(s) && s.tabs.length);
  const $n = sel => document.querySelector(`#vfnNav ${sel}`);
  const todos = sel => document.querySelectorAll(`#vfnNav ${sel}`);

  /** Botão (secção desta página) ou link (secção noutra página). */
  function itemSeccao(s, classe) {
    const href = hrefDe(s);
    const conteudo = `<span class="vfn-nav-ic" aria-hidden="true">${icone(s.icone, 20)}</span><span class="vfn-nav-rotulo">${esc(s.rotulo)}</span>`;
    return href
      ? `<a class="${classe}" href="${esc(href)}" data-seccao="${esc(s.id)}">${conteudo}</a>`
      : `<button type="button" class="${classe}" data-seccao="${esc(s.id)}">${conteudo}</button>`;
  }

  function separadores(s) {
    return `<div class="vfn-sub-grupo" data-grupo="${esc(s.id)}" role="tablist" aria-label="${esc(s.rotulo)}" hidden>${s.tabs.map(t => {
      const href = typeof t.href === "function" ? t.href(papel) : t.href;
      const contador = t.contador ? `<span id="${esc(t.contador)}" class="tab-count">0</span>` : "";
      return href
        ? `<a class="vfn-sub-item" href="${esc(href)}">${esc(t.rotulo)}</a>`
        : `<button type="button" class="vfn-sub-item" role="tab" data-seccao="${esc(s.id)}" data-tab="${esc(t.id)}" aria-selected="false">${esc(t.rotulo)}${contador}</button>`;
    }).join("")}</div>`;
  }

  /** Partes que dependem do papel (secções, separadores, links do menu): voltam a ser desenhadas em definirPapel. */
  function renderVariavel() {
    const lista = seccoes();
    const principais = lista.filter(s => !s.acao);
    $n(".vfn-nav-principal").innerHTML = principais.map(s => itemSeccao(s, "vfn-nav-item")).join("");
    $n(".vfn-bottom-bar").innerHTML = principais.map(s => itemSeccao(s, "vfn-bottom-item")).join("");
    $n(".vfn-acoes-seccao").innerHTML = lista.filter(s => s.acao).map(s => itemSeccao(s, "vfn-acao-seccao")).join("");
    $n(".vfn-nav-secundaria").innerHTML = lista.filter(s => !hrefDe(s) && s.tabs.length).map(separadores).join("");
    $n(".vfn-menu-links").innerHTML = (cfg.links || []).filter(visivel).map(l =>
      `<a class="vfn-menu-item" href="${esc(l.href)}"${l.novaJanela ? ' target="_blank" rel="noopener"' : ""}>${icone(l.icone, 16)}<span>${esc(l.rotulo)}</span></a>`).join("");
    VFN.hidratarIcones(document.getElementById("vfnNav"));
  }

  function montar(config) {
    cfg = config;
    papel = config.papel || "";
    const raiz = document.getElementById("vfnNav");
    if (!raiz) return;
    raiz.innerHTML = `<header class="vfn-topo">
        <div class="vfn-topo-linha">
          <a class="vfn-marca" href="${esc(cfg.inicio || "#")}" aria-label="VFN Hub — início"><img src="assets/logo.png" alt=""><span class="vfn-marca-texto"><strong>VFN Hub</strong><small>${esc(cfg.subtitulo || "Época 2026/27")}</small></span></a>
          <span class="vfn-titulo-seccao" aria-hidden="true"></span>
          <nav class="vfn-nav-principal" aria-label="Navegação principal"></nav>
          <div class="vfn-topo-acoes">
            ${cfg.acoes || ""}
            <span class="vfn-acoes-seccao"></span>
            <button type="button" class="tema-btn vfn-icone-btn" data-tema-btn aria-pressed="false"><span class="tema-ic" aria-hidden="true"></span><span class="tema-rotulo sr-only">Tema escuro</span></button>
            <div class="vfn-menu">
              <button type="button" class="vfn-icone-btn vfn-menu-btn" aria-haspopup="true" aria-expanded="false" aria-label="Conta e opções">${icone("circle-user", 20)}</button>
              <div class="vfn-menu-painel" hidden>
                <div class="vfn-menu-quem"><strong id="navUserName">Utilizador</strong><small id="navUserRole"></small></div>
                <div class="vfn-menu-links"></div>
                <button type="button" id="btnLogout" class="vfn-menu-item">${icone("log-out", 16)}<span>Sair</span></button>
              </div>
            </div>
          </div>
        </div>
        <nav class="vfn-nav-secundaria" aria-label="Separadores da secção"></nav>
      </header>
      <nav class="vfn-bottom-bar" aria-label="Navegação principal"></nav>`;
    renderVariavel();

    raiz.addEventListener("click", e => {
      const tab = e.target.closest("button[data-tab]");
      if (tab) return ir(tab.dataset.seccao, tab.dataset.tab);
      const sec = e.target.closest("button[data-seccao]");
      if (sec) return ir(sec.dataset.seccao, ultimoTab[sec.dataset.seccao] || "");
    });
    const menuBtn = $n(".vfn-menu-btn"), painel = $n(".vfn-menu-painel");
    const fecharMenu = () => { painel.hidden = true; menuBtn.setAttribute("aria-expanded", "false"); };
    menuBtn.addEventListener("click", () => { painel.hidden = !painel.hidden; menuBtn.setAttribute("aria-expanded", String(!painel.hidden)); });
    document.addEventListener("click", e => { if (!e.target.closest(".vfn-menu")) fecharMenu(); });
    document.addEventListener("keydown", e => { if (e.key === "Escape") fecharMenu(); });
    painel.addEventListener("click", e => { if (e.target.closest(".vfn-menu-item")) fecharMenu(); });
    window.addEventListener("hashchange", () => { const r = rotaDoEndereco(); if (r && (r.seccao !== atual.seccao || r.tab !== atual.tab)) ir(r.seccao, r.tab); });
    if (VFN.aplicarTema) VFN.aplicarTema(); // o botão do tema foi criado agora (o shared.js já o tinha procurado)

    const r = rotaDoEndereco();
    posicionar(r ? r.seccao : "", r ? r.tab : "");
  }

  /** Quando a página está pronta (listeners e dados): mostra a vista da posição atual (a do endereço, se houver). */
  function arrancar() {
    if (cfg) ir(atual.seccao, atual.tab);
  }

  /** "#portal/calendario", ou o nome de um separador/vista antigo ("#pre-jogo"). Ignora os links de autenticação (#...=...). */
  function rotaDoEndereco() {
    const h = decodeURIComponent(location.hash.slice(1));
    if (!h || h.includes("=")) return null;
    const [s, t] = h.split("/");
    const lista = locais();
    const sec = lista.find(x => x.id === s);
    if (sec) return { seccao: sec.id, tab: (sec.tabs.find(x => x.id === t) || sec.tabs[0]).id };
    for (const x of lista) { const tab = x.tabs.find(y => y.id === h || y.vista === h); if (tab) return { seccao: x.id, tab: tab.id }; }
    return null;
  }

  function guardarEndereco() {
    if (location.hash.includes("=")) return; // convite/recuperação de password: o Supabase ainda precisa do hash
    try { history.replaceState(null, "", `${location.pathname}${location.search}#${atual.seccao}/${atual.tab}`); } catch (e) { /* file:// */ }
  }

  function marcar() {
    ultimoTab[atual.seccao] = atual.tab;
    todos("[data-seccao]:not([data-tab])").forEach(b => {
      const ativo = b.dataset.seccao === atual.seccao;
      b.classList.toggle("active", ativo);
      if (ativo) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
    });
    todos(".vfn-sub-grupo").forEach(g => { g.hidden = g.dataset.grupo !== atual.seccao; });
    todos(".vfn-sub-item[data-tab]").forEach(b => {
      const ativo = b.dataset.seccao === atual.seccao && b.dataset.tab === atual.tab;
      b.classList.toggle("active", ativo);
      b.setAttribute("aria-selected", String(ativo));
      if (ativo && b.scrollIntoView && b.parentElement.scrollWidth > b.parentElement.clientWidth) b.scrollIntoView({ block: "nearest", inline: "center" });
    });
    document.body.dataset.seccao = atual.seccao;
    const s = cfg.seccoes.find(x => x.id === atual.seccao);
    $n(".vfn-titulo-seccao").textContent = s ? s.rotulo : ""; // telemóvel: a barra principal está em baixo
  }

  /** Marca o separador (sem tab: o primeiro da secção) sem avisar a página. */
  function posicionar(seccaoId, tabId) {
    const lista = locais();
    if (!lista.length) return null;
    const s = lista.find(x => x.id === seccaoId) || lista[0];
    const t = s.tabs.find(x => x.id === tabId) || s.tabs[0];
    atual = { seccao: s.id, tab: t.id };
    marcar();
    guardarEndereco();
    return { s, t };
  }

  /** Abre um separador desta página e avisa a página (cfg.aoMudar). */
  function ir(seccaoId, tabId) {
    const p = posicionar(seccaoId, tabId);
    if (p && cfg.aoMudar) cfg.aoMudar(p.t.vista, p.t, p.s);
  }

  /** A página mudou de vista por si (ex.: "Ver relatório"): marca o separador dessa vista, de preferência na secção atual. */
  function marcarVista(vista) {
    const lista = locais();
    const daAtual = lista.find(s => s.id === atual.seccao);
    if (daAtual && (daAtual.tabs.find(t => t.id === atual.tab) || {}).vista === vista) return;
    const sec = (daAtual && daAtual.tabs.some(t => t.vista === vista)) ? daAtual : lista.find(s => s.tabs.some(t => t.vista === vista));
    if (!sec) return;
    atual = { seccao: sec.id, tab: sec.tabs.find(t => t.vista === vista).id };
    marcar();
    guardarEndereco();
  }

  /** Vai para a vista (marca o separador e chama a página). */
  function irVista(vista) {
    marcarVista(vista);
    const s = locais().find(x => x.id === atual.seccao);
    const t = s && s.tabs.find(x => x.id === atual.tab);
    if (t && t.vista === vista) ir(s.id, t.id);
  }

  /** Papel conhecido depois do login: mostra/esconde secções, separadores e links desse papel. */
  function definirPapel(novo) {
    papel = novo || "";
    if (!cfg) return;
    renderVariavel();
    const ok = locais().some(s => s.id === atual.seccao && s.tabs.some(t => t.id === atual.tab));
    if (ok) marcar(); else ir("", "");
  }

  function definirUtilizador(nome, rotuloPapel) {
    const n = document.getElementById("navUserName"), p = document.getElementById("navUserRole");
    if (n) n.textContent = nome || "Utilizador";
    if (p) p.textContent = rotuloPapel || "";
  }

  window.VFNNav = { montar, arrancar, ir, irVista, marcarVista, definirPapel, definirUtilizador, atual: () => Object.assign({}, atual) };
})();
