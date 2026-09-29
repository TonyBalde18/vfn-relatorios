"use strict";

/* =========================================================
   Componentes de leitura partilhados por dashboard.html e public.html:
   próximo jogo, classificação, resultados, marcadores, plantel, calendário.
   Depende de shared.js (window.VFN).
   ========================================================= */

(function () {
  const esc = VFN.escapeHtml;

  /** Linha de players (ou players_public) -> objeto usado nas vistas. */
  function jogadorDeLinha(p) {
    const s = p.stats || {};
    return {
      id: p.id,
      nome: p.display_name || p.name || "", // cards
      nomeCompleto: p.full_name || p.display_name || p.name || "", // ficha
      numero: p.number != null ? p.number : "",
      posicao: p.position || "—",
      fotoUrl: p.photo_url || "",
      jogos: Number(s.jogos) || 0,
      golos: Number(s.golos) || 0,
      assistencias: Number(s.assistencias) || 0,
      cartoesA: Number(s.cartoesA) || 0,
      cartoesV: Number(s.cartoesV) || 0,
      minutos: Number(s.minutos) || 0,
      attributes: p.attributes || {},
      info: { nascimento: p.date_of_birth || s.nascimento || "", pe: s.pePreferencial || "" }
    };
  }

  function equipa(dados, id) {
    return (dados.teams || []).find(t => String(t.id) === String(id)) || null;
  }

  function nomeAdversario(dados, jogo) {
    const t = equipa(dados, jogo.opponent_team_id);
    return (t && t.name) || jogo.opponent || "Adversário";
  }

  function logoVFN(dados) {
    const t = (dados.teams || []).find(x => VFN.eVFN(x.name));
    return VFN.urlLogoEquipa(t, "VFN") || VFN.LOGO_VFN;
  }

  function logoEquipa(t, nome, classe) {
    const url = VFN.urlLogoEquipa(t, nome);
    if (url) return `<img class="team-logo ${classe || ""}" src="${esc(url)}" alt="Logótipo ${esc(nome)}" loading="lazy">`;
    const iniciais = String(nome || "?").split(/\s+/).filter(w => w.length > 2 || /^[A-Z]{2,}$/.test(w)).slice(0, 2).map(w => w[0]).join("").toUpperCase() || "?";
    return `<span class="team-logo-placeholder ${classe || ""}" aria-hidden="true">${esc(iniciais)}</span>`;
  }

  function tagCompeticao(comp) {
    return `<span class="comp-tag comp-${VFN.categoriaCompeticao(comp)}">${esc(VFN.nomeCurtoCompeticao(comp))}</span>`;
  }

  function vazio(texto) {
    return `<p class="empty-state">${esc(texto)}</p>`;
  }

  /* ---------- Próximo jogo (cartão destaque) ---------- */

  function proximoJogoHTML(dados) {
    const jogo = VFN.proximoJogo(dados.matches);
    if (!jogo) return `<h2 class="hub-card-title">Próximo jogo</h2>${vazio("Sem jogos agendados.")}`;
    const nome = nomeAdversario(dados, jogo);
    const casa = VFN.jogoEmCasa(jogo);
    const vfn = `<div class="hero-team">${logoEquipa({ logo_url: logoVFN(dados) }, "VFN", "hero-logo")}<strong>VFN</strong></div>`;
    const adv = `<div class="hero-team">${logoEquipa(equipa(dados, jogo.opponent_team_id), nome, "hero-logo")}<strong>${esc(nome)}</strong></div>`;
    return `
      <div class="hero-head"><h2 class="hub-card-title">Próximo jogo</h2>${tagCompeticao(jogo.competition)}</div>
      <div class="hero-teams">${casa ? vfn : adv}<span class="hero-vs">vs</span>${casa ? adv : vfn}</div>
      <div class="hero-meta">
        <span>📅 ${esc(VFN.dataLonga(jogo.date, true))}</span>
        <span>${casa ? "🏠 Casa" : "🚌 Fora"}${jogo.jornada ? ` · Jornada ${esc(jogo.jornada)}` : ""}${jogo.venue ? ` · ${esc(jogo.venue)}` : ""}</span>
      </div>
      <div class="hero-countdown" aria-live="off"><span>Faltam</span><strong data-countdown="${esc(jogo.date)}">${esc(VFN.contagemDecrescente(jogo.date))}</strong></div>`;
  }

  /** Atualiza as contagens decrescentes visíveis (chamado por intervalo). */
  function atualizarContagens() {
    document.querySelectorAll("[data-countdown]").forEach(n => { n.textContent = VFN.contagemDecrescente(n.dataset.countdown); });
  }

  /* ---------- Resultados e forma ---------- */

  function formaHTML(dados, n) {
    const jogos = VFN.ultimosJogos(dados.matches, n || 5);
    if (!jogos.length) return "";
    return `<div class="form-row" aria-label="Forma nos últimos ${jogos.length} jogos (mais recente à esquerda)">${jogos.map(j => VFN.chipForma(VFN.letraResultado(j))).join("")}</div>`;
  }

  function resultadosHTML(dados, n) {
    const jogos = VFN.ultimosJogos(dados.matches, n || 5);
    if (!jogos.length) return vazio("Ainda não há jogos disputados.");
    return `<ul class="result-list">${jogos.map(j => {
      const g = VFN.golosJogo(j);
      const nome = nomeAdversario(dados, j);
      return `<li>
        ${VFN.chipForma(VFN.letraResultado(j))}
        <span class="result-teams">${logoEquipa(equipa(dados, j.opponent_team_id), nome)}<span><strong>${esc(nome)}</strong><small>${esc(VFN.dataCurta(j.date))} · ${VFN.jogoEmCasa(j) ? "Casa" : "Fora"} · ${esc(VFN.nomeCurtoCompeticao(j.competition))}</small></span></span>
        <span class="result-score">${g.vfn}–${g.adv}</span>
      </li>`;
    }).join("")}</ul>`;
  }

  function ultimoResultadoHTML(dados) {
    const j = VFN.ultimosJogos(dados.matches, 1)[0];
    if (!j) return `<h2 class="hub-card-title">Último resultado</h2>${vazio("Ainda não há jogos disputados.")}`;
    const g = VFN.golosJogo(j);
    const nome = nomeAdversario(dados, j);
    const casa = VFN.jogoEmCasa(j);
    const lado = (quem, golos) => `<div class="hero-team">${quem === "vfn" ? logoEquipa({ logo_url: logoVFN(dados) }, "VFN", "hero-logo") : logoEquipa(equipa(dados, j.opponent_team_id), nome, "hero-logo")}<strong>${quem === "vfn" ? "VFN" : esc(nome)}</strong><span class="big-score">${golos}</span></div>`;
    return `<div class="hero-head"><h2 class="hub-card-title">Último resultado</h2>${VFN.chipForma(VFN.letraResultado(j))}</div>
      <div class="hero-teams compact">${casa ? lado("vfn", g.vfn) : lado("adv", g.adv)}<span class="hero-vs">–</span>${casa ? lado("adv", g.adv) : lado("vfn", g.vfn)}</div>
      <div class="hero-meta"><span>${esc(VFN.dataLonga(j.date))} · ${esc(VFN.nomeCurtoCompeticao(j.competition))}</span></div>`;
  }

  /* ---------- Classificação ---------- */

  function competicoesComClassificacao(dados) {
    return VFN.competicoesLiga(dados.matches);
  }

  function competicaoPreferida(dados) {
    const comps = competicoesComClassificacao(dados);
    const proximo = VFN.proximoJogo(dados.matches);
    if (proximo && comps.includes(proximo.competition)) return proximo.competition;
    return comps.find(c => VFN.categoriaCompeticao(c) === "liga") || comps[0] || "";
  }

  function opcoesCompeticaoHTML(dados, selecionada) {
    return competicoesComClassificacao(dados).map(c => `<option value="${esc(c)}" ${c === selecionada ? "selected" : ""}>${esc(VFN.nomeCurtoCompeticao(c))}</option>`).join("");
  }

  function classificacaoHTML(dados, competicao) {
    // calculada a partir dos resultados em matches (não usa a tabela standings)
    const linhas = VFN.calcularClassificacao(dados.matches, dados.teams, competicao);
    if (!linhas.length) return vazio("Classificação ainda não disponível.");
    return `<div class="table-wrap"><table class="standings-compact">
      <thead><tr><th scope="col">Pos</th><th scope="col" class="team-col">Equipa</th><th scope="col">J</th><th scope="col">V</th><th scope="col">E</th><th scope="col">D</th><th scope="col" class="hide-xs">GM</th><th scope="col" class="hide-xs">GS</th><th scope="col">Pts</th></tr></thead>
      <tbody>${linhas.map((s, i) => {
        const t = equipa(dados, s.team_id);
        const nome = (t && t.name) || s.team_name || "—";
        return `<tr class="${VFN.eVFN(nome) ? "is-vfn-row" : ""}"><td class="pos-col">${i + 1}</td><td class="team-col"><span class="team-inline">${logoEquipa(t, nome)}<span>${esc(nome)}</span></span></td><td>${Number(s.played) || 0}</td><td>${Number(s.won) || 0}</td><td>${Number(s.drawn) || 0}</td><td>${Number(s.lost) || 0}</td><td class="hide-xs">${Number(s.goals_for) || 0}</td><td class="hide-xs">${Number(s.goals_against) || 0}</td><td class="pts-col">${Number(s.points) || 0}</td></tr>`;
      }).join("")}</tbody></table></div>`;
  }

  /* ---------- Marcadores ---------- */

  function marcadores(jogadores, n) {
    return [...jogadores].filter(j => j.golos > 0)
      .sort((a, b) => b.golos - a.golos || b.assistencias - a.assistencias || a.jogos - b.jogos || a.nome.localeCompare(b.nome, "pt"))
      .slice(0, n || 5);
  }

  function marcadoresHTML(jogadores, n) {
    const top = marcadores(jogadores, n);
    if (!top.length) return vazio("Ainda sem golos registados.");
    return `<table class="scorers-table"><thead><tr><th scope="col"></th><th scope="col" class="team-col">Jogador</th><th scope="col" title="Golos">G</th><th scope="col" title="Assistências">Ass</th><th scope="col" title="Jogos">J</th></tr></thead>
      <tbody>${top.map((j, i) => `<tr><td class="pos-col">${i + 1}</td><td class="team-col"><span class="player-cell">${VFN.avatarJogador(j, "avatar-sm")}<span>${esc(j.nome)}<small class="muted">${esc(j.posicao)}</small></span></span></td><td class="pts-col">${j.golos}</td><td>${j.assistencias}</td><td>${j.jogos}</td></tr>`).join("")}</tbody></table>`;
  }

  /* ---------- Plantel ---------- */

  const GRUPOS_POSICAO = [["", "Todos"], ["GR", "Guarda-redes"], ["Def", "Defesas"], ["Meio", "Médios"], ["Ata", "Avançados"]];

  function filtrosPosicaoHTML(ativo) {
    return GRUPOS_POSICAO.map(([v, t]) => `<button type="button" class="filter-chip ${v === ativo ? "active" : ""}" data-posicao="${v}">${t}</button>`).join("");
  }

  function plantelHTML(jogadores, filtro) {
    const lista = [...jogadores]
      .filter(j => !filtro || VFN.categoriaPosicao(j.posicao) === filtro)
      .sort((a, b) => (Number(a.numero) || 999) - (Number(b.numero) || 999) || a.nome.localeCompare(b.nome, "pt"));
    if (!lista.length) return vazio("Sem jogadores nesta posição.");
    return lista.map(j => `<button type="button" class="player-card" data-id="${esc(j.id)}" data-aos="fade-up">
      ${VFN.avatarJogador(j)}
      <span class="player-card-number">${j.numero !== "" ? "#" + esc(j.numero) : ""}</span>
      <strong>${esc(j.nome)}</strong>
      <small>${esc(j.posicao)}</small>
    </button>`).join("");
  }

  /* ---------- Calendário ---------- */

  const FILTROS_CALENDARIO = [["todos", "Todos"], ["liga", "Liga"], ["taca", "Taça"], ["amigavel", "Amigáveis"]];

  function filtrosCalendarioHTML(ativo) {
    return FILTROS_CALENDARIO.map(([v, t]) => `<button type="button" class="filter-chip ${v === ativo ? "active" : ""}" data-filtro="${v}">${t}</button>`).join("");
  }

  function jogosFiltrados(dados, filtro) {
    return VFN.jogosDoVFN(dados.matches)
      .filter(j => filtro === "todos" || VFN.categoriaCompeticao(j.competition) === filtro)
      .sort((a, b) => (VFN.paraData(a.date) || 0) - (VFN.paraData(b.date) || 0));
  }

  function itemJogoHTML(dados, j, proximo) {
    const d = VFN.paraData(j.date);
    const nome = nomeAdversario(dados, j);
    const g = VFN.golosJogo(j);
    const estado = VFN.estadoJogo(j) || "agendado";
    const hora = VFN.horaIso(j.date);
    const eProximo = proximo && proximo.id === j.id;
    return `<article class="match-item state-${esc(estado)}${estado === "jogado" ? " result-" + VFN.letraResultado(j) : ""}${eProximo ? " is-next" : ""}">
        <div class="match-date"><strong>${d ? d.getDate() : "—"}</strong><span>${d ? VFN.MESES_CURTOS[d.getMonth()] : ""}</span></div>
        <div class="match-main">
          <div class="match-line">${tagCompeticao(j.competition)}${j.jornada ? `<small>J${esc(j.jornada)}</small>` : ""}<small>${VFN.jogoEmCasa(j) ? "Casa" : "Fora"}</small>${eProximo ? '<small class="next-flag">Próximo</small>' : ""}</div>
          <div class="match-opponent">${logoEquipa(equipa(dados, j.opponent_team_id), nome)}<strong>${esc(nome)}</strong></div>
        </div>
        <div class="match-side">${estado === "jogado" && g ? `<span class="result-score">${g.vfn}–${g.adv}</span>` : `<span class="match-time">${hora && hora !== "00:00" ? esc(hora) : ""}</span>`}${VFN.badgeEstado(j)}</div>
      </article>`;
  }

  /** Calendário por meses (dashboard). */
  function calendarioHTML(dados, filtro) {
    const lista = jogosFiltrados(dados, filtro);
    if (!lista.length) return vazio("Sem jogos nesta competição.");
    const proximo = VFN.proximoJogo(dados.matches);
    let mesAtual = "";
    return lista.map(j => {
      const d = VFN.paraData(j.date);
      const mes = d ? `${VFN.MESES_LONGOS[d.getMonth()]} ${d.getFullYear()}` : "Sem data";
      const cabecalho = mes !== mesAtual ? `<h3 class="calendar-month">${esc(mes)}</h3>` : "";
      mesAtual = mes;
      return cabecalho + itemJogoHTML(dados, j, proximo);
    }).join("");
  }

  /** Dois blocos: próximos jogos (data, adversário, logo) e jogos anteriores (resultado, logo). */
  function calendarioDivididoHTML(dados, filtro) {
    const lista = jogosFiltrados(dados, filtro);
    if (!lista.length) return vazio("Sem jogos nesta competição.");
    const proximo = VFN.proximoJogo(dados.matches);
    const futuros = lista.filter(j => VFN.estadoJogo(j) === "agendado");
    const anteriores = lista.filter(j => VFN.estadoJogo(j) !== "agendado").reverse(); // mais recente primeiro
    const bloco = (titulo, jogos, textoVazio) => `<h3 class="calendar-month">${titulo} <span class="muted">· ${jogos.length}</span></h3>${jogos.length ? jogos.map(j => itemJogoHTML(dados, j, proximo)).join("") : vazio(textoVazio)}`;
    return bloco("Próximos jogos", futuros, "Sem jogos agendados.") + bloco("Jogos anteriores", anteriores, "Ainda não há jogos disputados.");
  }

  /* ---------- Esqueletos enquanto os dados carregam ---------- */

  function esqueleto(tipo, n) {
    const classe = { cards: "skeleton skeleton-card", linhas: "skeleton skeleton-row", jogos: "skeleton skeleton-match", hero: "skeleton skeleton-hero" }[tipo] || "skeleton skeleton-row";
    return Array.from({ length: n || 1 }, () => `<div class="${classe}" aria-hidden="true"></div>`).join("");
  }

  /* ---------- Rodapé ---------- */

  function competicaoAtiva(dados) {
    const proximo = VFN.proximoJogo(dados.matches);
    if (proximo) return proximo.competition;
    const ultimo = VFN.ultimosJogos(dados.matches, 1)[0];
    return ultimo ? ultimo.competition : "";
  }

  window.VFNHub = {
    jogadorDeLinha, equipa, nomeAdversario, logoEquipa, tagCompeticao, vazio,
    proximoJogoHTML, atualizarContagens, formaHTML, resultadosHTML, ultimoResultadoHTML,
    competicoesComClassificacao, competicaoPreferida, opcoesCompeticaoHTML, classificacaoHTML,
    marcadores, marcadoresHTML, filtrosPosicaoHTML, plantelHTML,
    filtrosCalendarioHTML, calendarioHTML, calendarioDivididoHTML, competicaoAtiva, esqueleto
  };
})();
