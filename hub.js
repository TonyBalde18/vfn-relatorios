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
      disponibilidade: p.availability || "", // vazio na página pública (a view não tem esta coluna)
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
        <span>${VFN.icone("calendar-days", 16)} ${esc(VFN.dataLonga(jogo.date, true))}</span>
        <span>${casa ? VFN.icone("house", 16) + " Casa" : VFN.icone("bus", 16) + " Fora"}${jogo.jornada ? ` · Jornada ${esc(jogo.jornada)}` : ""}${jogo.venue ? ` · ${esc(jogo.venue)}` : ""}</span>
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
    // só as competições com classificação: 2ª Liga Zero Graus e Taça de Honra Comunilog
    return VFN.COMPETICOES_CLASSIFICACAO;
  }

  function competicaoPreferida(dados) {
    const comps = competicoesComClassificacao(dados);
    const proximo = VFN.proximoJogo(dados.matches);
    if (proximo && comps.includes(proximo.competition)) return proximo.competition;
    return comps[0] || "";
  }

  function opcoesCompeticaoHTML(dados, selecionada) {
    return competicoesComClassificacao(dados).map(c => `<option value="${esc(c)}" ${c === selecionada ? "selected" : ""}>${esc(VFN.nomeCurtoCompeticao(c))}</option>`).join("");
  }

  function classificacaoHTML(dados, competicao) {
    // calculada a partir dos resultados em matches (não usa a tabela standings)
    const linhas = VFN.calcularClassificacao(dados.matches, dados.teams, competicao, dados.league_results);
    if (!linhas.length) return vazio("Classificação ainda não disponível.");
    return `<div class="table-wrap"><table class="standings-compact" data-ordenar="classificacao">
      <thead><tr><th scope="col" data-tipo="numero">Pos</th><th scope="col" class="team-col" data-tipo="texto">Equipa</th><th scope="col" data-tipo="numero">J</th><th scope="col" data-tipo="numero">V</th><th scope="col" data-tipo="numero">E</th><th scope="col" data-tipo="numero">D</th><th scope="col" class="hide-xs" data-tipo="numero">GM</th><th scope="col" class="hide-xs" data-tipo="numero">GS</th><th scope="col" data-tipo="numero">Pts</th></tr></thead>
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
      <tbody>${top.map((j, i) => `<tr><td class="pos-col">${i + 1}</td><td class="team-col"><span class="player-cell">${VFN.avatarJogador(j, "avatar-sm")}<span>${esc(j.nome)}<small class="muted">${esc(j.posicao)}</small></span></span></td><td class="pts-col" data-contar="${j.golos}">${j.golos}</td><td data-contar="${j.assistencias}">${j.assistencias}</td><td data-contar="${j.jogos}">${j.jogos}</td></tr>`).join("")}</tbody></table>`;
  }

  /* ---------- Melhores marcadores do campeonato ---------- */

  /**
   * Golos por jogador numa competição: outras equipas a partir de league_results.scorer_list
   * (jogadores externos) + jogadores do VFN a partir de players.stats (golos da época).
   */
  function marcadoresCampeonato(dados, jogadoresVFN, competicao) {
    const mapa = new Map();
    (dados.league_results || []).filter(r => r.competition === competicao && Array.isArray(r.scorer_list)).forEach(r => {
      r.scorer_list.forEach(s => {
        const chave = s.player_id ? `id:${s.player_id}` : `nome:${s.player_name}|${s.team_id}`;
        const ext = (dados.external_players || []).find(p => String(p.id) === String(s.player_id));
        const atual = mapa.get(chave) || { nome: (ext && ext.name) || s.player_name || "?", teamId: s.team_id || (ext && ext.team_id) || "", golos: 0, vfn: false };
        atual.golos += Number(s.count) || 1;
        mapa.set(chave, atual);
      });
    });
    const vfn = VFN.equipaVFN(dados.teams);
    (jogadoresVFN || []).filter(j => j.golos > 0).forEach(j => mapa.set(`vfn:${j.id}`, { nome: j.nome, teamId: String(vfn.id), golos: j.golos, vfn: true, jogador: j }));
    return [...mapa.values()].sort((a, b) => b.golos - a.golos || a.nome.localeCompare(b.nome, "pt"));
  }

  function marcadoresCampeonatoHTML(dados, jogadoresVFN, competicao, n) {
    const lista = marcadoresCampeonato(dados, jogadoresVFN, competicao).slice(0, n || 10);
    if (!lista.length) return vazio("Ainda não há marcadores registados nesta competição.");
    return `<table class="scorers-table" data-ordenar="marcadores-campeonato"><thead><tr><th scope="col">Pos</th><th scope="col" class="team-col" data-tipo="texto">Jogador</th><th scope="col" class="team-col" data-tipo="texto">Clube</th><th scope="col" data-tipo="numero">Golos</th></tr></thead>
      <tbody>${lista.map((m, i) => {
        const t = equipa(dados, m.teamId);
        const clube = (t && t.name) || "—";
        return `<tr class="${m.vfn ? "is-vfn-row" : ""}"><td class="pos-col">${i + 1}</td>
          <td class="team-col">${m.vfn ? `<span class="player-cell">${VFN.avatarJogador(m.jogador, "avatar-xs")}<span>${esc(m.nome)}</span></span>` : esc(m.nome)}</td>
          <td class="team-col"><span class="team-inline">${logoEquipa(t, clube)}<span>${esc(clube)}</span></span></td>
          <td class="pts-col" data-contar="${m.golos}">${m.golos}</td></tr>`;
      }).join("")}</tbody></table>
      <p class="muted nota-marcadores">Golos do VFN: total da época (todas as competições). Outras equipas: marcadores registados nas Jornadas AF Guarda.</p>`;
  }

  /* ---------- Plantel ---------- */

  const GRUPOS_POSICAO = [["", "Todos"], ["GR", "Guarda-redes"], ["Def", "Defesas"], ["Meio", "Médios"], ["Ata", "Avançados"]];

  function filtrosPosicaoHTML(ativo) {
    return GRUPOS_POSICAO.map(([v, t]) => `<button type="button" class="filter-chip ${v === ativo ? "active" : ""}" data-posicao="${v}">${t}</button>`).join("");
  }

  function plantelHTML(jogadores, filtro, opcoes) {
    const o = opcoes || {};
    const lista = [...jogadores]
      .filter(j => VFN.posicaoNaCategoria(j.posicao, filtro))
      .filter(j => !o.estado || (j.disponibilidade || "disponivel") === o.estado)
      .sort((a, b) => (Number(a.numero) || 999) - (Number(b.numero) || 999) || a.nome.localeCompare(b.nome, "pt"));
    if (!lista.length) return vazio("Sem jogadores nesta posição.");
    return lista.map(j => `<button type="button" class="player-card" data-id="${esc(j.id)}">
      ${VFN.avatarJogador(j)}
      <span class="player-card-number">${j.numero !== "" ? "#" + esc(j.numero) : ""}</span>
      <strong>${esc(j.nome)}</strong>
      <small>${esc(j.posicao)}</small>
      ${o.disponibilidade && j.disponibilidade ? VFN.badgeDisponibilidade(j.disponibilidade) : ""}
    </button>`).join("");
  }

  /* ---------- Calendário ---------- */

  const FILTROS_CALENDARIO = [["todos", "Todos"], ["liga", "Liga"], ["taca", "Taça"], ["amigavel", "Amigáveis"]];

  function filtrosCalendarioHTML(ativo) {
    return FILTROS_CALENDARIO.map(([v, t]) => `<button type="button" class="filter-chip ${v === ativo ? "active" : ""}" data-filtro="${v}">${t}</button>`).join("") + botaoOrdemCalendarioHTML();
  }

  // ordem do calendário (dashboard e página pública): "asc" ou "desc" por data
  let ordemCalendario = "asc";
  function alternarOrdemCalendario() { ordemCalendario = ordemCalendario === "asc" ? "desc" : "asc"; return ordemCalendario; }
  function botaoOrdemCalendarioHTML() {
    return `<button type="button" class="btn btn-ghost btn-sm" data-ordem-calendario>${VFN.icone("arrow-up-down", 16)} Data ${ordemCalendario === "asc" ? "↑" : "↓"}</button>`;
  }

  function jogosFiltrados(dados, filtro) {
    return VFN.jogosDoVFN(dados.matches)
      .filter(j => filtro === "todos" || VFN.categoriaCompeticao(j.competition) === filtro)
      .sort((a, b) => ((VFN.paraData(a.date) || 0) - (VFN.paraData(b.date) || 0)) * (ordemCalendario === "asc" ? 1 : -1));
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
    const anteriores = lista.filter(j => VFN.estadoJogo(j) !== "agendado");
    const bloco = (titulo, jogos, textoVazio) => `<h3 class="calendar-month">${titulo} <span class="muted">· ${jogos.length}</span></h3>${jogos.length ? jogos.map(j => itemJogoHTML(dados, j, proximo)).join("") : vazio(textoVazio)}`;
    return bloco("Próximos jogos", futuros, "Sem jogos agendados.") + bloco("Jogos anteriores", anteriores, "Ainda não há jogos disputados.");
  }

  /* ---------- Jornadas AF Guarda (league_results + jogos do VFN) ---------- */

  /** Todos os jogos da competição: resultados entre outras equipas e jogos do VFN (não cancelados). */
  function jogosDaJornada(dados, competicao) {
    const liga = (dados.league_results || []).filter(r => r.competition === competicao).map(r => {
      const { casa, fora } = VFN.equipasDoResultadoLiga(r, dados.teams);
      const lista = Array.isArray(r.scorer_list) && r.scorer_list.length ? r.scorer_list.map(s => `${s.player_name}${Number(s.count) > 1 ? " (" + s.count + ")" : ""}`).join(", ") : "";
      return { origem: "liga", id: r.id, jornada: Number(r.jornada) || 0, casa, fora, gc: r.score_home, gf: r.score_away, marcadores: [lista, r.scorers].filter(Boolean).join(" · "), data: r.match_date || null, registo: r };
    });
    const vfn = VFN.jogosDoVFN(dados.matches).filter(j => j.competition === competicao && VFN.estadoJogo(j) !== "cancelado").map(j => {
      const { casa, fora } = VFN.equipasDoJogo(j, dados.teams);
      const jogado = VFN.estadoJogo(j) === "jogado";
      return { origem: "vfn", id: j.id, jornada: Number(j.jornada) || 0, casa, fora, gc: jogado ? j.score_home : null, gf: jogado ? j.score_away : null, marcadores: "", data: j.date };
    });
    return [...liga, ...vfn];
  }

  function jornadasDisponiveis(dados, competicao) {
    return [...new Set(jogosDaJornada(dados, competicao).map(j => j.jornada))].sort((a, b) => a - b);
  }

  function equipasDasJornadas(dados, competicao) {
    const mapa = new Map();
    jogosDaJornada(dados, competicao).forEach(j => { mapa.set(j.casa.id, j.casa.nome); mapa.set(j.fora.id, j.fora.nome); });
    return [...mapa.entries()].map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome, "pt"));
  }

  /**
   * Jogos agrupados por jornada. opcoes: { competicao, jornada, equipa, ordem: "asc"|"desc", editavel }.
   * Os jogos do VFN vêm do calendário e só se editam lá.
   */
  function jornadasHTML(dados, opcoes) {
    const o = opcoes || {};
    const jogos = jogosDaJornada(dados, o.competicao)
      .filter(j => !o.jornada || String(j.jornada) === String(o.jornada))
      .filter(j => !o.equipa || j.casa.id === o.equipa || j.fora.id === o.equipa);
    if (!jogos.length) return vazio("Sem jogos registados para estes filtros.");
    const porJornada = new Map();
    jogos.forEach(j => { (porJornada.get(j.jornada) || porJornada.set(j.jornada, []).get(j.jornada)).push(j); });
    porJornada.forEach(lista => lista.sort((x, y) => String(x.data || "9999").localeCompare(String(y.data || "9999"))));
    const ordem = [...porJornada.keys()].sort((a, b) => o.ordem === "desc" ? b - a : a - b);
    const lado = (eq, classe) => `<span class="jj-equipa ${classe}">${classe === "jj-casa" ? `<span>${esc(eq.nome)}</span>${logoEquipa(equipa(dados, eq.id), eq.nome)}` : `${logoEquipa(equipa(dados, eq.id), eq.nome)}<span>${esc(eq.nome)}</span>`}</span>`;
    return ordem.map(n => `
      <section class="jornada-grupo">
        <h3 class="jornada-titulo">${n ? `Jornada ${n}` : "Sem jornada"} <small class="muted">${porJornada.get(n).length} jogo${porJornada.get(n).length === 1 ? "" : "s"}</small></h3>
        ${porJornada.get(n).map(j => {
          const temRes = j.gc != null && j.gf != null && j.gc !== "" && j.gf !== "";
          const resultado = temRes ? `${Number(j.gc)} – ${Number(j.gf)}` : "–";
          const data = j.data ? `${esc(VFN.dataCurta(j.data))}${VFN.horaIso(j.data) && VFN.horaIso(j.data) !== "00:00" ? " · " + esc(VFN.horaIso(j.data)) : ""}` : "";
          const acoes = j.origem === "vfn"
            ? '<span class="jj-tag" title="Jogo do VFN (vem do Calendário)">VFN</span>'
            : o.editavel ? `<span class="row-actions"><button type="button" class="icon-btn" data-acao="editar" data-id="${esc(j.id)}" title="Editar resultado" aria-label="Editar resultado">${VFN.icone("pencil", 16)}</button><button type="button" class="icon-btn danger" data-acao="apagar" data-id="${esc(j.id)}" title="Eliminar resultado" aria-label="Eliminar resultado">${VFN.icone("trash-2", 16)}</button></span>` : "";
          return `<div class="jornada-jogo${j.origem === "vfn" ? " is-vfn-game" : ""}">
            ${lado(j.casa, "jj-casa")}
            <span class="jj-centro"><span class="jj-resultado${temRes ? "" : " por-jogar"}">${resultado}</span>${data ? `<small class="jj-data">${data}</small>` : ""}</span>
            ${lado(j.fora, "jj-fora")}
            <span class="jj-acoes">${acoes}</span>
            ${j.marcadores ? `<p class="jj-marcadores">${VFN.icone("goal", 14)} ${esc(j.marcadores)}</p>` : ""}
          </div>`;
        }).join("")}
      </section>`).join("");
  }

  /* ---------- Forma atual de uma equipa (adversário) ---------- */

  /**
   * Jogos disputados por uma equipa, do mais recente para o mais antigo:
   * contra o VFN (matches) e contra as outras equipas (league_results).
   * Resultados sem data usam a data do jogo do VFN da mesma competição e jornada.
   */
  function jogosDaEquipa(dados, teamId) {
    const id = String(teamId);
    const vfn = VFN.jogosDoVFN(dados.matches);
    const dataDaJornada = (comp, jornada) => { const j = vfn.find(m => m.competition === comp && String(m.jornada) === String(jornada)); return j ? j.date : null; };
    const lista = [];
    vfn.filter(j => String(j.opponent_team_id) === id && VFN.estadoJogo(j) === "jogado" && VFN.golosJogo(j)).forEach(j => {
      const { casa, fora } = VFN.equipasDoJogo(j, dados.teams);
      lista.push({ casa, fora, gc: Number(j.score_home), gf: Number(j.score_away), data: j.date, jornada: Number(j.jornada) || 0, competicao: j.competition, contraVFN: true });
    });
    (dados.league_results || []).filter(r => (String(r.home_team_id) === id || String(r.away_team_id) === id) && r.score_home != null && r.score_away != null && r.score_home !== "" && r.score_away !== "").forEach(r => {
      const { casa, fora } = VFN.equipasDoResultadoLiga(r, dados.teams);
      lista.push({ casa, fora, gc: Number(r.score_home), gf: Number(r.score_away), data: r.match_date || dataDaJornada(r.competition, r.jornada), jornada: Number(r.jornada) || 0, competicao: r.competition, contraVFN: false });
    });
    const tempo = j => (VFN.paraData(j.data) || new Date(0)).getTime();
    return lista.sort((a, b) => tempo(b) - tempo(a) || b.jornada - a.jornada)
      .map(j => {
        const emCasa = j.casa.id === id;
        const nossos = emCasa ? j.gc : j.gf, deles = emCasa ? j.gf : j.gc;
        return { ...j, letra: nossos > deles ? "V" : nossos === deles ? "E" : "D" };
      });
  }

  /** Último jogo, forma (últimos 5) e confrontos com o VFN, do ponto de vista da equipa. */
  function formaEquipaHTML(dados, teamId) {
    if (!teamId) return "";
    const jogos = jogosDaEquipa(dados, teamId);
    const nomeEq = (equipa(dados, teamId) || {}).name || "";
    const texto = { V: "Vitória", E: "Empate", D: "Derrota" };
    const icone = { V: "circle-check", E: "circle-minus", D: "circle-x" };
    let html = `<div class="forma-equipa">`;
    if (!jogos.length) {
      html += `<p class="muted forma-vazia">Sem jogos com resultado registado${nomeEq ? " para " + esc(nomeEq) : ""}.</p>`;
    } else {
      const u = jogos[0];
      html += `<div class="ultimo-jogo">
        <span class="forma-rotulo">Último jogo</span>
        <strong>${esc(u.casa.nome)} ${u.gc}–${u.gf} ${esc(u.fora.nome)}</strong>
        <span class="muted">${u.data ? esc(VFN.dataDDMMAAAA(u.data)) + " · " : ""}${u.jornada ? "J" + u.jornada + " · " : ""}${esc(VFN.nomeCurtoCompeticao(u.competicao))}</span>
        <span class="resultado-equipa res-${u.letra}">${VFN.icone(icone[u.letra], 16)} ${texto[u.letra]}</span>
      </div>
      <div class="forma-linha"><span class="forma-rotulo">Forma</span><div class="form-row" aria-label="Últimos ${Math.min(5, jogos.length)} jogos, mais recente à esquerda">${jogos.slice(0, 5).map(j => VFN.chipForma(j.letra).replace("<span ", `<span title="${esc(j.casa.nome)} ${j.gc}–${j.gf} ${esc(j.fora.nome)}" `)).join("")}</div></div>`;
    }
    // confrontos com o VFN (do ponto de vista do VFN)
    const h2h = jogos.filter(j => j.contraVFN);
    if (h2h.length) {
      const inv = { V: "D", E: "E", D: "V" };
      const b = { V: 0, E: 0, D: 0 };
      h2h.forEach(j => b[inv[j.letra]]++);
      html += `<div class="forma-linha"><span class="forma-rotulo">Contra o VFN</span><span><strong>${b.V}V · ${b.E}E · ${b.D}D</strong> <span class="muted">(VFN)</span></span></div>`;
    }
    return html + `</div>`;
  }

  /* ---------- Equipas adversárias: cards com forma e ficha completa ---------- */

  function chipsForma(dados, teamId, n) {
    const jogos = jogosDaEquipa(dados, teamId).slice(0, n || 5);
    if (!jogos.length) return '<span class="muted forma-sem-jogos">Sem jogos</span>';
    return `<span class="form-row form-row-sm" aria-label="Forma: últimos ${jogos.length} jogos, mais recente à esquerda">${jogos.map(j => VFN.chipForma(j.letra)).join("")}</span>`;
  }

  /** Cards de todas as equipas (exceto o VFN) com logo, nome, cidade e forma recente. */
  function cardsEquipasHTML(dados, termo) {
    const t = String(termo || "").toLocaleLowerCase("pt-PT");
    const lista = [...(dados.teams || [])].filter(x => !VFN.eVFN(x.name))
      .filter(x => !t || x.name.toLocaleLowerCase("pt-PT").includes(t) || String(x.city || "").toLocaleLowerCase("pt-PT").includes(t))
      .sort((a, b) => a.name.localeCompare(b.name, "pt"));
    if (!lista.length) return vazio("Sem equipas.");
    return lista.map(x => `<button type="button" class="team-card" data-equipa="${esc(x.id)}">
      ${logoEquipa(x, x.name)}
      <strong>${esc(x.name)}</strong>
      ${x.city ? `<small>${esc(x.city)}</small>` : ""}
      ${chipsForma(dados, x.id, 5)}
    </button>`).join("");
  }

  /**
   * Ficha da equipa: forma, confrontos com o VFN (V/E/D, golos), todos os jogos contra
   * o VFN (passados e futuros) e jogadores conhecidos (external_players).
   */
  function perfilEquipaHTML(dados, teamId) {
    const t = equipa(dados, teamId) || { id: teamId, name: "Equipa" };
    const jogosVFN = VFN.jogosDoVFN(dados.matches)
      .filter(j => String(j.opponent_team_id) === String(teamId) && VFN.estadoJogo(j) !== "cancelado")
      .sort((a, b) => (VFN.paraData(a.date) || 0) - (VFN.paraData(b.date) || 0));
    const b = { V: 0, E: 0, D: 0, gm: 0, gs: 0, n: 0 };
    jogosVFN.forEach(j => { const g = VFN.estadoJogo(j) === "jogado" && VFN.golosJogo(j); if (!g) return; b.n++; b.gm += g.vfn; b.gs += g.adv; b[VFN.letraResultado(j)]++; });
    const jogadores = (dados.external_players || []).filter(p => String(p.team_id) === String(teamId)).sort((x, y) => x.name.localeCompare(y.name, "pt"));
    const golosPorJogador = new Map();
    (dados.league_results || []).forEach(r => (Array.isArray(r.scorer_list) ? r.scorer_list : []).forEach(s => { if (s.player_id) golosPorJogador.set(String(s.player_id), (golosPorJogador.get(String(s.player_id)) || 0) + (Number(s.count) || 1)); }));
    return `
      <div class="perfil-equipa-cab">
        ${logoEquipa(t, t.name, "perfil-logo")}
        <div><h3>${esc(t.name)}</h3>${t.city ? `<p class="muted">${VFN.icone("map-pin", 14)} ${esc(t.city)}</p>` : ""}</div>
      </div>
      ${formaEquipaHTML(dados, teamId)}
      <div class="perfil-stats">
        <div><span>Jogos c/ VFN</span><strong>${b.n}</strong></div>
        <div><span>Vitórias VFN</span><strong>${b.V}</strong></div>
        <div><span>Empates</span><strong>${b.E}</strong></div>
        <div><span>Derrotas VFN</span><strong>${b.D}</strong></div>
        <div><span>Golos VFN</span><strong>${b.gm}</strong></div>
        <div><span>Golos sofridos</span><strong>${b.gs}</strong></div>
      </div>
      <h4 class="perfil-subtitulo">Jogos contra o VFN</h4>
      ${jogosVFN.length ? `<ul class="perfil-jogos">${jogosVFN.map(j => {
        const g = VFN.estadoJogo(j) === "jogado" ? VFN.golosJogo(j) : null;
        return `<li>${g ? VFN.chipForma(VFN.letraResultado(j)) : VFN.badgeEstado(j)}<span>${esc(VFN.dataDDMMAAAA(j.date))}</span><span class="muted">${esc(VFN.nomeCurtoCompeticao(j.competition))}${j.jornada ? " · J" + esc(j.jornada) : ""} · ${VFN.jogoEmCasa(j) ? "Casa" : "Fora"}</span><strong>${g ? `VFN ${g.vfn}–${g.adv}` : esc(VFN.horaIso(j.date) !== "00:00" ? VFN.horaIso(j.date) : "")}</strong></li>`;
      }).join("")}</ul>` : vazio("Sem jogos com o VFN no calendário.")}
      <h4 class="perfil-subtitulo">Jogadores conhecidos</h4>
      ${jogadores.length ? `<ul class="perfil-jogadores">${jogadores.map(p => `<li><span>${esc(p.name)}</span><small class="muted">ID ${esc(p.id)}</small>${golosPorJogador.get(String(p.id)) ? `<strong>${golosPorJogador.get(String(p.id))} golo${golosPorJogador.get(String(p.id)) === 1 ? "" : "s"}</strong>` : ""}</li>`).join("")}</ul>` : vazio("Ainda sem jogadores registados (os marcadores das Jornadas aparecem aqui).")}`;
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
    filtrosCalendarioHTML, calendarioHTML, calendarioDivididoHTML, alternarOrdemCalendario, competicaoAtiva, esqueleto,
    jogosDaJornada, jornadasDisponiveis, equipasDasJornadas, jornadasHTML, jogosDaEquipa, formaEquipaHTML, marcadoresCampeonato, marcadoresCampeonatoHTML, chipsForma, cardsEquipasHTML, perfilEquipaHTML
  };
})();
