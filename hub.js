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
    // clicável: abre a ficha da equipa (o VFN não tem ficha de adversário)
    const attr = t && t.id && !VFN.eVFN(t.name || nome) && !String(t.id).startsWith("nome:") ? ` data-equipa="${esc(t.id)}" title="Ver ficha de ${esc(nome)}"` : "";
    if (url) return `<img class="team-logo ${classe || ""}" src="${esc(url)}" alt="Logótipo ${esc(nome)}" loading="lazy"${attr}>`;
    const iniciais = String(nome || "?").split(/\s+/).filter(w => w.length > 2 || /^[A-Z]{2,}$/.test(w)).slice(0, 2).map(w => w[0]).join("").toUpperCase() || "?";
    return `<span class="team-logo-placeholder ${classe || ""}" aria-hidden="true"${attr}>${esc(iniciais)}</span>`;
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
        <span>${casa ? VFN.icone("house", 16) + " Casa" : VFN.icone("bus", 16) + " Fora"}${VFN.etiquetaJornada(jogo) ? ` · ${esc(VFN.etiquetaJornada(jogo))}` : ""}${VFN.estadioDoJogo(jogo, dados.teams).nome ? ` · ${esc(VFN.estadioDoJogo(jogo, dados.teams).nome)}` : ""}</span>
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
        <button type="button" class="result-score" data-jogo="vfn:${esc(j.id)}" title="Ver detalhe do jogo">${g.vfn}–${g.adv}</button>
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
    // tabelas: 2ª Liga Zero Graus e 1ª Divisão Cima-Tavfer (as taças têm bracket, na vista de cada competição)
    return VFN.COMPETICOES_TABELA;
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

  /* ---------- Taça por eliminatórias (bracket) ---------- */

  /** Vencedor de um confronto: winner_id (penáltis) ou o resultado. "" se ainda não há. */
  function vencedorConfronto(j) {
    if (j.vencedor) return j.vencedor;
    if (j.gc == null || j.gf == null || j.gc === "" || j.gf === "" || Number(j.gc) === Number(j.gf)) return "";
    return Number(j.gc) > Number(j.gf) ? j.casa.id : j.fora.id;
  }

  /**
   * Confrontos da taça por fase: [{ fase, nome, jogos: [{ ...jogo, vencedor, veioDaFaseAnterior: Set }] }].
   * As equipas isentas entram quando o sorteio da fase seguinte é lançado.
   */
  function confrontosPorFase(dados, competicao) {
    const jogos = jogosDaJornada(dados, competicao);
    const vencedoresAnteriores = new Set();
    return VFN.FASES_TACA.map(([fase, nome]) => {
      const daFase = jogos.filter(j => j.fase === fase).sort((a, b) => String(a.data || "9999").localeCompare(String(b.data || "9999")))
        .map(j => ({ ...j, vencedor: vencedorConfronto(j), veioDaFaseAnterior: new Set([j.casa.id, j.fora.id].filter(id => vencedoresAnteriores.has(id))) }));
      daFase.forEach(j => { if (j.vencedor) vencedoresAnteriores.add(j.vencedor); });
      return { fase, nome, jogos: daFase };
    });
  }

  const bracketHTML = (dados, competicao) => window.VFNComp.renderBracket(dados, competicao);

  /**
   * Zonas da tabela por competição: posições (1 = primeiro; negativas contam do fim não se usam aqui),
   * classe da linha, ícone e texto da legenda.
   */
  const ZONAS_TABELA = {
    "2ª Liga Zero Graus": [
      { pos: [1], classe: "zona-campeao", icone: "🟡", texto: "1.º lugar — Campeão · Promoção à 1ª Divisão AF Guarda" },
      { pos: [2], classe: "zona-promocao", icone: "🟢", texto: "2.º lugar — Promoção à 1ª Divisão AF Guarda" }
    ],
    "1ª Divisão Cima-Tavfer": [
      { pos: [1], classe: "zona-campeao", icone: "🏆", texto: "1.º lugar — Campeão · Promoção ao Campeonato de Portugal" },
      { pos: [2], classe: "zona-promocao", icone: "🟢", texto: "2.º lugar — Qualificação para a Taça de Portugal 2027/28" },
      { pos: [13, 14], classe: "zona-descida", icone: "🔴", texto: "13.º e 14.º — Despromoção à 2ª Divisão AF Guarda" }
    ]
  };

  const zonaDaPosicao = (competicao, pos) => (ZONAS_TABELA[competicao] || []).find(z => z.pos.includes(pos)) || null;

  function legendaZonasHTML(competicao) {
    const zonas = ZONAS_TABELA[competicao] || [];
    return zonas.length ? `<ul class="legenda-zonas">${zonas.map(z => `<li class="${z.classe}"><span aria-hidden="true">${z.icone}</span>${esc(z.texto)}</li>`).join("")}</ul>` : "";
  }

  const comSinal = n => (n > 0 ? "+" : "") + n;

  /** Tabela classificativa (taças: bracket). Com DG, zonas, legenda e botão "Apresentar" (o: { semApresentar }). */
  function classificacaoHTML(dados, competicao, opcoes) {
    const o = opcoes || {};
    if (VFN.eliminatorias(competicao)) return bracketHTML(dados, competicao);
    // calculada a partir dos resultados em matches (não usa a tabela standings)
    const linhas = VFN.calcularClassificacao(dados.matches, dados.teams, competicao, dados.league_results);
    if (!linhas.length) return vazio("Classificação ainda não disponível.");
    return `<div class="classificacao-bloco" data-competicao="${esc(competicao)}">
      ${o.semApresentar ? "" : `<div class="classificacao-acoes"><button type="button" class="btn btn-ghost btn-sm" data-apresentar title="Mostrar em ecrã inteiro (balneário)">${VFN.icone("presentation", 16)} Apresentar</button></div>`}
      <div class="table-wrap"><table class="standings-compact" data-ordenar="classificacao">
      <thead><tr><th scope="col" data-tipo="numero">Pos</th><th scope="col" class="team-col" data-tipo="texto">Equipa</th><th scope="col" data-tipo="numero">J</th><th scope="col" data-tipo="numero">V</th><th scope="col" data-tipo="numero">E</th><th scope="col" data-tipo="numero">D</th><th scope="col" class="hide-xs" data-tipo="numero">GM</th><th scope="col" class="hide-xs" data-tipo="numero">GS</th><th scope="col" data-tipo="numero" title="Diferença de golos">DG</th><th scope="col" data-tipo="numero">Pts</th></tr></thead>
      <tbody>${linhas.map((s, i) => {
        const t = equipa(dados, s.team_id);
        const nome = (t && t.name) || s.team_name || "—";
        const zona = zonaDaPosicao(competicao, i + 1);
        const dg = (Number(s.goals_for) || 0) - (Number(s.goals_against) || 0);
        return `<tr class="${[VFN.eVFN(nome) ? "is-vfn-row" : "", zona ? zona.classe : ""].filter(Boolean).join(" ")}"><td class="pos-col">${i + 1}</td><td class="team-col"><span class="team-inline">${logoEquipa(t, nome)}<span>${esc(nome)}</span></span></td><td>${Number(s.played) || 0}</td><td>${Number(s.won) || 0}</td><td>${Number(s.drawn) || 0}</td><td>${Number(s.lost) || 0}</td><td class="hide-xs">${Number(s.goals_for) || 0}</td><td class="hide-xs">${Number(s.goals_against) || 0}</td><td class="dg-col${dg > 0 ? " pos" : dg < 0 ? " neg" : ""}" data-v="${dg}">${comSinal(dg)}</td><td class="pts-col">${Number(s.points) || 0}</td></tr>`;
      }).join("")}</tbody></table></div>
      ${legendaZonasHTML(competicao)}
    </div>`;
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
    golosVFNNaCompeticao(dados, jogadoresVFN, competicao).forEach(m => mapa.set(`vfn:${m.jogador ? m.jogador.id : m.nome}`, m));
    return [...mapa.values()].sort((a, b) => b.golos - a.golos || a.nome.localeCompare(b.nome, "pt"));
  }

  /** O VFN tem marcadores por jogo nesta competição (matches.scorer_list, gravado com o relatório)? */
  function temMarcadoresPorJogo(dados, competicao) {
    return VFN.jogosDoVFN(dados.matches).some(j => j.competition === competicao && Array.isArray(j.scorer_list));
  }

  /**
   * Golos do VFN numa competição: soma de matches.scorer_list dos jogos dessa competição.
   * Sem marcadores por jogo, a 2ª Liga usa o total da época (players.stats); as taças ficam vazias.
   * O VFN não joga nas competições só acompanhadas (ex.: 1ª Divisão).
   */
  function golosVFNNaCompeticao(dados, jogadoresVFN, competicao) {
    if (VFN.semVFN(competicao)) return [];
    const vfn = String(VFN.equipaVFN(dados.teams).id);
    const porId = id => (jogadoresVFN || []).find(j => String(j.id) === String(id) || String(j.id).endsWith("-" + id)) || null;
    if (temMarcadoresPorJogo(dados, competicao)) {
      const mapa = new Map();
      VFN.jogosDoVFN(dados.matches).filter(j => j.competition === competicao && Array.isArray(j.scorer_list)).forEach(j => j.scorer_list.forEach(s => {
        const jogador = porId(s.player_id);
        const chave = jogador ? String(jogador.id) : `nome:${s.player_name}`;
        const atual = mapa.get(chave) || { nome: jogador ? jogador.nome : s.player_name || "?", teamId: vfn, golos: 0, vfn: true, jogador };
        atual.golos += Number(s.count) || 1;
        mapa.set(chave, atual);
      }));
      return [...mapa.values()];
    }
    if (VFN.eliminatorias(competicao)) return [];
    return (jogadoresVFN || []).filter(j => j.golos > 0).map(j => ({ nome: j.nome, teamId: vfn, golos: j.golos, vfn: true, jogador: j }));
  }

  /** Top marcadores do VFN numa competição (golos por jogo dessa competição; na liga sem dados, total da época). */
  function marcadoresVFNCompeticaoHTML(dados, jogadoresVFN, competicao, n) {
    const lista = golosVFNNaCompeticao(dados, jogadoresVFN, competicao).sort((a, b) => b.golos - a.golos || a.nome.localeCompare(b.nome, "pt")).slice(0, n || 10);
    if (!lista.length) return vazio(VFN.semVFN(competicao) ? "O VFN não joga esta competição." : "Ainda sem golos do VFN nesta competição.");
    return `<table class="scorers-table"><thead><tr><th scope="col">Pos</th><th scope="col" class="team-col">Jogador</th><th scope="col">Golos</th></tr></thead>
      <tbody>${lista.map((m, i) => `<tr><td class="pos-col">${i + 1}</td><td class="team-col">${m.jogador ? `<span class="player-cell">${VFN.avatarJogador(m.jogador, "avatar-xs")}<span>${esc(m.nome)}</span></span>` : esc(m.nome)}</td><td class="pts-col">${m.golos}</td></tr>`).join("")}</tbody></table>`;
  }

  /** Tabela classificativa mostrada nas Jornadas para as competições sem o VFN ("" nas outras). */
  function classificacaoJornadasHTML(dados, competicao) {
    return VFN.semVFN(competicao) ? classificacaoHTML(dados, competicao) : "";
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
      <p class="muted nota-marcadores">${VFN.semVFN(competicao) ? "Marcadores registados nas Jornadas AF Guarda." : temMarcadoresPorJogo(dados, competicao) ? "Golos do VFN: relatórios dos jogos desta competição. Outras equipas: marcadores registados nas Jornadas AF Guarda." : "Golos do VFN: total da época (todas as competições). Outras equipas: marcadores registados nas Jornadas AF Guarda."}</p>`;
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
    const capitao = capitaoAtivo(jogadores);
    return lista.map(j => window.VFNComp.renderPlayerCard(j, { capitao: String(j.id) === capitao, disponibilidade: o.disponibilidade })).join("");
  }

  /** Capitão ativo do plantel: o primeiro da lista de prioridade que está disponível. */
  function capitaoAtivo(jogadores) {
    const porId = new Map((jogadores || []).map(j => [String(j.id), j]));
    return VFN.capitaoAutomatico([...porId.keys()], { estado: id => (porId.get(id) || {}).disponibilidade || "" });
  }

  /* ---------- Ficha visual do jogador ---------- */

  // zonas do campo (x, y em %; ataque em cima) por código de posição
  const ZONAS = {
    GR: [50, 90], DC: [50, 76], DD: [84, 72], DE: [16, 72], MDC: [50, 60], MC: [50, 47], MOC: [50, 34],
    ED: [82, 24], EE: [18, 24], PL: [50, 12]
  };
  const ZONAS_ALIAS = { MDEF: "MDC", MD: "MDC", MCEN: "MC", MOFE: "MOC", MO: "MOC", AV: "PL", PA: "PL", ATA: "PL", EXD: "ED", EXE: "EE", LD: "DD", LE: "DE" };

  // área de cada posição no campo (viewBox 100×140, ataque em cima): x, y, largura, altura
  const AREAS = {
    GR: [34, 122, 32, 16], DC: [26, 98, 48, 20], DD: [72, 84, 26, 34], DE: [2, 84, 26, 34],
    MDC: [24, 76, 52, 18], MC: [20, 56, 60, 22], MOC: [26, 38, 48, 18],
    ED: [72, 14, 26, 36], EE: [2, 14, 26, 36], PL: [28, 4, 44, 22]
  };

  /** Campo com as zonas das posições do jogador: principal (dourado) e secundárias, a pulsar. */
  function mapaPosicoesHTML(posicao) {
    const codigos = String(posicao || "").split("/").map(c => c.trim().toUpperCase()).map(c => ZONAS[c] ? c : ZONAS_ALIAS[c]).filter(Boolean);
    const unicos = [...new Set(codigos)];
    const zonas = unicos.map((c, i) => { const [x, y, w, h] = AREAS[c]; return `<rect class="area ${i === 0 ? "principal" : "secundaria"}" x="${x}" y="${y}" width="${w}" height="${h}" rx="6" style="animation-delay:${i * 0.15}s"></rect>`; }).join("");
    return `<div class="mapa-posicoes" role="img" aria-label="Posições: ${esc(unicos.join(", ") || "sem posição")}">
      <svg viewBox="0 0 100 140" preserveAspectRatio="none" aria-hidden="true">
        <rect x="1" y="1" width="98" height="138" rx="3"></rect><line x1="1" y1="70" x2="99" y2="70"></line><circle cx="50" cy="70" r="11"></circle>
        <rect x="27" y="1" width="46" height="18"></rect><rect x="27" y="121" width="46" height="18"></rect>
        ${zonas}
      </svg>
      ${Object.entries(ZONAS).map(([c, [x, y]]) => { const i = unicos.indexOf(c); return `<span class="zona ${i === 0 ? "principal" : i > 0 ? "secundaria" : ""}" style="left:${x}%;top:${y}%">${c}</span>`; }).join("")}
    </div>`;
  }

  /** Anel (mini gráfico) com uma percentagem, animado ao aparecer. */
  function anelHTML(pct, rotulo, detalhe) {
    const p = Math.max(0, Math.min(100, Math.round(pct)));
    const c = 2 * Math.PI * 24;
    return `<div class="anel" title="${esc(detalhe || "")}"><svg viewBox="0 0 60 60" aria-hidden="true"><circle class="anel-fundo" cx="30" cy="30" r="24"></circle>
      <circle class="anel-valor${p >= 75 ? " bom" : p >= 50 ? " medio" : " baixo"}" cx="30" cy="30" r="24" style="--total:${c.toFixed(1)};--alvo:${(c * (1 - p / 100)).toFixed(1)}"></circle></svg>
      <strong>${p}%</strong><span>${esc(rotulo)}</span></div>`;
  }

  /**
   * Ficha visual: campo com as zonas, anéis (utilização e presença), barras comparadas com o
   * melhor do plantel, distinções e mapa de presenças (estilo GitHub).
   * o: { presencas: [{ data, status }], jogosEquipa: nº de jogos disputados pelo VFN }
   */
  function fichaVisualHTML(j, jogadores, opcoes) {
    const o = opcoes || {};
    const todos = jogadores || [];
    const max = k => Math.max(1, ...todos.map(x => Number(x[k]) || 0));
    const posicaoNo = k => [...todos].sort((a, b) => (Number(b[k]) || 0) - (Number(a[k]) || 0)).findIndex(x => x.id === j.id) + 1;
    const distincoes = [];
    [["golos", "Melhor marcador", "bola"], ["assistencias", "Mais assistências", "target"], ["minutos", "Mais minutos", "timer"], ["jogos", "Mais jogos", "shirt"]].forEach(([k, titulo, icone]) => {
      if (!(Number(j[k]) > 0)) return;
      const p = posicaoNo(k);
      if (p === 1) distincoes.push(`<span class="distincao ouro">${VFN.icone(icone, 14)} ${titulo}</span>`);
      else if (p <= 3) distincoes.push(`<span class="distincao">${VFN.icone(icone, 14)} Top 3 · ${titulo.replace(/^Melhor marcador$/, "golos").replace(/^Mais /, "")}</span>`);
    });
    if (String(j.id) === capitaoAtivo(todos)) distincoes.unshift(`<span class="distincao capitao">${VFN.badgeCapitao()} Capitão</span>`);
    const barras = [["Jogos", "jogos", ""], ["Minutos", "minutos", "'"], ["Golos", "golos", ""], ["Assistências", "assistencias", ""]].map(([rotulo, k, suf]) => `
      <div class="ficha-barra"><span>${rotulo}</span><span class="barra"><i style="width:${Math.round((Number(j[k]) || 0) / max(k) * 100)}%"></i></span><strong>${Number(j[k]) || 0}${suf}</strong></div>`).join("");
    const cartoes = `<div class="ficha-cartoes"><span class="cartao amarelo" title="Amarelos">${j.cartoesA || 0}</span><span class="cartao vermelho" title="Vermelhos">${j.cartoesV || 0}</span></div>`;
    const aneis = [];
    if (o.jogosEquipa > 0) aneis.push(anelHTML((Number(j.minutos) || 0) / (o.jogosEquipa * 90) * 100, "Utilização", `${j.minutos || 0}' de ${o.jogosEquipa * 90}' possíveis`));
    const registos = (o.presencas || []).filter(r => r.status);
    if (registos.length) {
      const presentes = registos.filter(r => r.status === "P" || r.status === "A").length;
      aneis.push(anelHTML(presentes / registos.length * 100, "Presença", `${presentes} de ${registos.length} sessões`));
    }
    if (Number(j.jogos) > 0) aneis.push(`<div class="anel anel-num"><strong>${((Number(j.golos) || 0) / Number(j.jogos)).toFixed(2).replace(".", ",")}</strong><span>Golos/jogo</span></div>`);
    return `<div class="ficha-visual">
      ${mapaPosicoesHTML(j.posicao)}
      <div class="ficha-dados">
        ${distincoes.length ? `<div class="distincoes">${distincoes.join("")}</div>` : ""}
        ${aneis.length ? `<div class="aneis">${aneis.join("")}</div>` : ""}
        ${barras}
        ${cartoes}
      </div>
    </div>
    ${o.presencas ? `<h4 class="perfil-subtitulo">Presenças por sessão</h4>${VFN.heatmapPresencasHTML(o.presencas, { individual: true })}` : ""}`;
  }

  /** Nº de jogos do VFN já disputados (com resultado): base da % de utilização. */
  function jogosDisputados(dados) {
    return VFN.jogosDoVFN(dados.matches).filter(j => VFN.estadoJogo(j) === "jogado" && VFN.golosJogo(j)).length;
  }

  /** Opções da ficha visual de um jogador: presenças da época e jogos disputados. */
  function opcoesFicha(dados, id) {
    const presencas = dados.attendance ? dados.attendance.filter(a => String(a.player_id) === String(id)).map(a => ({ data: a.session_date, status: a.status })) : null;
    return { presencas, jogosEquipa: jogosDisputados(dados) };
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

  /** Forma do VFN nos 5 jogos até este, inclusive (mais recente à esquerda). */
  function formaAteJogo(dados, jogo, n) {
    const limite = VFN.paraData(jogo.date);
    if (!limite) return [];
    return VFN.ultimosJogos(dados.matches, 999).filter(j => (VFN.paraData(j.date) || 0) <= limite).slice(0, n || 5);
  }

  // apresentação em components.js (VFNComp.renderMatchCard)
  const itemJogoHTML = (dados, j, proximo) => window.VFNComp.renderMatchCard(dados, j, { proximo });

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

  /* ---------- Onze mais utilizado e minutos ---------- */

  // Posições no campo (x, y em %; o ataque é em cima)
  const POSICOES_CAMPO = {
    GR: [50, 89], DC: [50, 73], DD: [86, 68], DE: [14, 68],
    MDEF: [50, 57], MCEN: [50, 45], MOFE: [50, 33],
    ED: [84, 24], EE: [16, 24], PL: [50, 12]
  };
  const SINONIMOS_POSICAO = { MDC: "MDEF", MD: "MDEF", MC: "MCEN", MOC: "MOFE", MO: "MOFE", AV: "PL", PA: "PL", ATA: "PL", EXD: "ED", EXE: "EE", LD: "DD", LE: "DE" };

  function posicaoNoCampo(posicao) {
    const codigo = String(posicao || "").split("/")[0].trim().toUpperCase();
    const chave = POSICOES_CAMPO[codigo] ? codigo : SINONIMOS_POSICAO[codigo];
    return chave || "MCEN";
  }

  /**
   * 11 mais utilizado: o GR com mais minutos entra sempre (posição principal GR; em caso de
   * empate, o primeiro da lista); os outros 10 lugares são os jogadores de campo com mais minutos.
   * lista: [{ jogador, minutos }] (qualquer ordem). Sem GR com minutos, ficam 11 jogadores de campo.
   */
  function onzeMaisUtilizado(lista) {
    const ordenada = [...lista].sort((a, b) => b.minutos - a.minutos);
    const eGR = t => VFN.categoriaPosicao(t.jogador.posicao) === "GR";
    const gr = ordenada.find(eGR);
    const campo = ordenada.filter(t => !eGR(t));
    return gr ? [gr, ...campo.slice(0, 10)] : campo.slice(0, 11);
  }

  /** Lista de minutos: [{ jogador, minutos, jogos }], já ordenada. */
  function minutosListaHTML(lista) {
    if (!lista.length) return vazio("Ainda não há minutos registados.");
    const maximo = lista[0].minutos || 1;
    return `<ol class="minutes-list">${lista.map((t, i) => `
      <li>
        <span class="minutes-pos">${i + 1}</span>
        <span class="player-cell">${VFN.avatarJogador(t.jogador, "avatar-xs")}<span>${esc(t.jogador.nome)}<small class="muted">${esc(t.jogador.posicao)} · ${t.jogos} jogo${t.jogos === 1 ? "" : "s"}</small></span></span>
        <span class="minutes-bar" aria-hidden="true"><i style="width:${Math.max(2, t.minutos / maximo * 100)}%"></i></span>
        <strong>${t.minutos}'</strong>
      </li>`).join("")}</ol>`;
  }

  /**
   * Onze no campo, colocado pela posição do perfil. lista: [{ jogador, minutos }].
   * o: { rotulo(t) em vez dos minutos, capitao: id com o badge "C", ordenado: já vem como onze }
   */
  function onzeCampoHTML(lista, opcoes) {
    const o = opcoes || {};
    if (!lista.length) return vazio(o.rotulo ? "Onze ainda não definido." : "Ainda não há minutos registados.");
    const onze = o.rotulo ? lista.slice(0, 11) : onzeMaisUtilizado(lista);
    // com formação (convocatória): linhas da formação escolhida; sem formação: posição do perfil
    const marcadores = o.formacao ? posicoesDaFormacao(onze, o.formacao) : [];
    const grupos = {};
    if (!o.formacao) onze.forEach(t => { const p = posicaoNoCampo(t.jogador.posicao); (grupos[p] || (grupos[p] = [])).push(t); });
    Object.entries(grupos).forEach(([pos, doGrupo]) => {
      const [x, y] = POSICOES_CAMPO[pos];
      doGrupo.forEach((t, i) => {
        const desvio = (i - (doGrupo.length - 1) / 2) * 24; // lado a lado quando há vários na mesma posição
        marcadores.push({ t, x: Math.min(90, Math.max(10, x + desvio)), y });
      });
    });
    return `<div class="mini-pitch" role="img" aria-label="Onze mais utilizado: ${esc(onze.map(t => t.jogador.nome).join(", "))}">
      <span class="mini-pitch-lines" aria-hidden="true"></span>
      ${marcadores.map(({ t, x, y }) => {
        const capitao = o.capitao && String(o.capitao) === String(t.jogador.idBD || t.jogador.id);
        return `<div class="pitch-player" style="left:${x}%;top:${y}%">${VFN.avatarJogador(t.jogador, "avatar-xs")}${capitao ? VFN.badgeCapitao("no-campo") : ""}<span class="pitch-player-name"><span>${esc(t.jogador.nome)}</span><b>${o.rotulo ? esc(o.rotulo(t)) : t.minutos + "'"}</b></span></div>`;
      }).join("")}
    </div>
    ${onze.length < 11 ? `<p class="muted readonly-note">${o.rotulo ? `Só ${onze.length} titulares escolhidos.` : `Só ${onze.length} jogadores com minutos registados.`}</p>` : ""}`;
  }

  /** Linhas de uma formação, da defesa para o ataque: "4-3-3" → [4, 3, 3]; "4-4-2 Losango" → [4, 1, 2, 1, 2]. */
  function linhasFormacao(formacao) {
    const f = String(formacao || "");
    if (/losango/i.test(f)) return [4, 1, 2, 1, 2];
    const linhas = (f.match(/\d/g) || []).map(Number);
    return linhas.length && linhas.reduce((s, n) => s + n, 0) === 10 ? linhas : [4, 3, 3];
  }

  /**
   * Coloca o onze nas linhas da formação escolhida: o 1.º é o GR e os restantes enchem as linhas
   * por ordem (a lista vem ordenada GR → defesas → médios → avançados).
   */
  function posicoesDaFormacao(onze, formacao) {
    const linhas = linhasFormacao(formacao);
    const resultado = [];
    if (onze[0]) resultado.push({ t: onze[0], x: 50, y: 89 });
    let i = 1;
    linhas.forEach((n, l) => {
      const y = 73 - l * (60 / Math.max(1, linhas.length - 1));
      for (let k = 0; k < n && i < onze.length; k++, i++) resultado.push({ t: onze[i], x: Math.round((k + 1) * 100 / (n + 1)), y: Math.round(y) });
    });
    return resultado;
  }

  /* ---------- Presenças: quem mais e quem menos ---------- */

  /** % de presença (P + A sobre os registos) de cada jogador na época, só quem tem registos. */
  function presencasPorJogador(jogadores, attendance) {
    return (jogadores || []).map(j => {
      const registos = (attendance || []).filter(a => String(a.player_id) === String(j.id) && a.status);
      const presentes = registos.filter(a => a.status === "P" || a.status === "A").length;
      return { jogador: j, total: registos.length, presentes, pct: registos.length ? Math.round(presentes / registos.length * 100) : null };
    }).filter(p => p.total > 0);
  }

  /** Cards compactos: top presenças e menos presenças (n de cada). */
  function rankingPresencasHTML(jogadores, attendance, n) {
    const lista = presencasPorJogador(jogadores, attendance);
    if (!lista.length) return vazio("Ainda não há presenças registadas.");
    const k = n || 5;
    const desc = [...lista].sort((a, b) => b.pct - a.pct || b.total - a.total || a.jogador.nome.localeCompare(b.jogador.nome, "pt"));
    const asc = [...lista].sort((a, b) => a.pct - b.pct || b.total - a.total || a.jogador.nome.localeCompare(b.jogador.nome, "pt"));
    const card = (p, classe) => `<li class="pres-card ${classe}">${VFN.avatarJogador(p.jogador, "avatar-xs")}<span class="pres-nome">${esc(p.jogador.nome)}<small class="muted">${p.presentes}/${p.total} sessões</small></span>
      <span class="pres-pct"><b>${p.pct}%</b><i style="width:${p.pct}%"></i></span></li>`;
    return `<div class="pres-ranking">
      <section><h3>${VFN.icone("trending-up", 16)} Mais presenças</h3><ol>${desc.slice(0, k).map(p => card(p, "mais")).join("")}</ol></section>
      <section><h3>${VFN.icone("trending-down", 16)} Menos presenças</h3><ol>${asc.slice(0, k).map(p => card(p, "menos")).join("")}</ol></section>
    </div>`;
  }

  /* ---------- Desempenho por competição ---------- */

  function desempenhoPorCompeticaoHTML(dados) {
    const jogados = VFN.jogosDoVFN(dados.matches).filter(j => VFN.estadoJogo(j) === "jogado" && VFN.golosJogo(j));
    if (!jogados.length) return vazio("Ainda não há jogos disputados.");
    const grupos = [["liga", "Liga"], ["taca", "Taças"], ["amigavel", "Amigáveis"], ["", "Total"]].map(([cat, rotulo]) => {
      const t = { rotulo, total: !cat, J: 0, V: 0, E: 0, D: 0, GM: 0, GS: 0 };
      jogados.filter(j => !cat || VFN.categoriaCompeticao(j.competition) === cat).forEach(j => { const g = VFN.golosJogo(j); t.J++; t[VFN.letraResultado(j)]++; t.GM += g.vfn; t.GS += g.adv; });
      return t;
    }).filter(t => t.J);
    const media = (a, b) => b ? (a / b).toFixed(1).replace(".", ",") : "—";
    return `<div class="table-wrap"><table class="stats-table comp-table">
      <thead><tr><th scope="col">Competição</th><th scope="col">J</th><th scope="col">V</th><th scope="col">E</th><th scope="col">D</th><th scope="col">GM</th><th scope="col">GS</th><th scope="col" title="Golos marcados por jogo">GM/J</th><th scope="col" title="Golos sofridos por jogo">GS/J</th><th scope="col" title="Pontos por jogo (3 por vitória)">Pts/J</th><th scope="col">% Vit.</th></tr></thead>
      <tbody>${grupos.map(t => `<tr class="${t.total ? "linha-total" : ""}"><th scope="row">${esc(t.rotulo)}</th><td>${t.J}</td><td>${t.V}</td><td>${t.E}</td><td>${t.D}</td><td>${t.GM}</td><td>${t.GS}</td><td>${media(t.GM, t.J)}</td><td>${media(t.GS, t.J)}</td><td>${media(t.V * 3 + t.E, t.J)}</td><td><span class="barra-pct"><i style="width:${Math.round(t.V / t.J * 100)}%"></i></span>${Math.round(t.V / t.J * 100)}%</td></tr>`).join("")}</tbody>
    </table></div>`;
  }

  /* ---------- Disponibilidade pré-jogo ---------- */

  const ORDEM_POSICAO = { GR: 0, Def: 1, Meio: 2, Ata: 3 };

  function disponibilidadeHTML(dados, jogadores) {
    const jogo = VFN.proximoJogo(dados.matches);
    const ordenar = l => [...l].sort((a, b) => (ORDEM_POSICAO[VFN.categoriaPosicao(a.posicao)] ?? 9) - (ORDEM_POSICAO[VFN.categoriaPosicao(b.posicao)] ?? 9) || a.nome.localeCompare(b.nome, "pt"));
    const risco = j => VFN.alertaSuspensao(j.cartoesA, j.disponibilidade);
    const convocaveis = ordenar(jogadores.filter(j => (!j.disponibilidade || j.disponibilidade === "disponivel" || j.disponibilidade === "em_duvida") && !risco(j)));
    const fora = ordenar(jogadores.filter(j => !convocaveis.includes(j)));
    const linha = (j, extra) => `<li data-jogador="${esc(j.id)}">${VFN.avatarJogador(j, "avatar-xs")}<span class="disp-nome">${esc(j.nome)}<small class="muted">${esc(j.posicao)}</small></span>${extra || ""}</li>`;
    const porCategoria = lista => ["GR", "Def", "Meio", "Ata"].map(c => [c, lista.filter(j => VFN.categoriaPosicao(j.posicao) === c).length]).filter(([, n]) => n).map(([c, n]) => `<span>${{ GR: "GR", Def: "Defesas", Meio: "Médios", Ata: "Avançados" }[c]} <b>${n}</b></span>`).join("");
    return `${jogo ? `<p class="disp-jogo">${VFN.icone("calendar-days", 16)} ${esc(VFN.jogoEmCasa(jogo) ? "VFN vs " + nomeAdversario(dados, jogo) : nomeAdversario(dados, jogo) + " vs VFN")} · ${esc(VFN.dataLonga(jogo.date, true))}</p>` : ""}
      <div class="disp-colunas">
        <section class="disp-coluna ok"><h3>${VFN.icone("circle-check", 18)} Convocáveis <b>${convocaveis.length}</b></h3><div class="disp-resumo">${porCategoria(convocaveis)}</div>
          <ul>${convocaveis.map(j => linha(j, j.disponibilidade === "em_duvida" ? VFN.badgeDisponibilidade("em_duvida") : "")).join("") || "<li class=\"muted\">Nenhum jogador.</li>"}</ul></section>
        <section class="disp-coluna nao"><h3>${VFN.icone("circle-off", 18)} Indisponíveis <b>${fora.length}</b></h3>
          <ul>${fora.map(j => linha(j, risco(j) ? `<span class="disp-badge disp-suspenso">${VFN.icone("triangle-alert", 14)} ${j.cartoesA} amarelos</span>` : VFN.badgeDisponibilidade(j.disponibilidade))).join("") || "<li class=\"muted\">Todo o plantel disponível.</li>"}</ul></section>
      </div>`;
  }

  /* ---------- Posição do VFN por jornada ---------- */

  /** Posição do VFN na classificação no fim de cada jornada com resultados. */
  function posicoesPorJornada(dados, competicao) {
    if (VFN.eliminatorias(competicao) || VFN.semVFN(competicao)) return [];
    const comResultado = (a, b) => a != null && b != null && a !== "" && b !== "";
    const jornadas = [...new Set(jogosDaJornada(dados, competicao).filter(x => x.jornada && comResultado(x.gc, x.gf)).map(x => x.jornada))].sort((a, b) => a - b);
    return jornadas.map(n => {
      const jogos = (dados.matches || []).filter(j => j.competition !== competicao || (Number(j.jornada) || 0) <= n);
      const liga = (dados.league_results || []).filter(r => r.competition !== competicao || (Number(r.jornada) || 0) <= n);
      const tabela = VFN.calcularClassificacao(jogos, dados.teams, competicao, liga);
      const i = tabela.findIndex(l => VFN.eVFN(l.team_name) || VFN.eVFN((equipa(dados, l.team_id) || {}).name));
      return { jornada: n, posicao: i >= 0 ? i + 1 : null, equipas: tabela.length, pontos: i >= 0 ? tabela[i].points : null };
    }).filter(p => p.posicao);
  }

  /** Gráfico de linha (Chart.js) da posição por jornada. Devolve o gráfico ou null. */
  function graficoPosicao(canvas, dados, competicao, anterior) {
    if (anterior) anterior.destroy();
    const pontos = posicoesPorJornada(dados, competicao);
    const caixa = canvas.closest(".chart-box");
    const aviso = caixa && caixa.nextElementSibling && caixa.nextElementSibling.classList.contains("empty-state") ? caixa.nextElementSibling : null;
    // taças e competições sem o VFN não têm gráfico de posição
    const semGrafico = VFN.eliminatorias(competicao) || VFN.semVFN(competicao);
    if (caixa) caixa.hidden = !pontos.length || !window.Chart;
    if (aviso) aviso.hidden = !!pontos.length || semGrafico;
    const titulo = caixa && caixa.previousElementSibling;
    if (titulo && titulo.classList.contains("subsecao-titulo")) titulo.hidden = semGrafico;
    if (!pontos.length || !window.Chart) return null;
    const total = Math.max(...pontos.map(p => p.equipas));
    return new Chart(canvas, {
      type: "line",
      data: { labels: pontos.map(p => "J" + p.jornada), datasets: [{ label: "Posição", data: pontos.map(p => p.posicao), borderColor: "#0A1628", backgroundColor: "#FFD700", borderWidth: 2.5, pointRadius: 5, pointHoverRadius: 7, pointBorderColor: "#0A1628", pointBorderWidth: 2, tension: 0.25 }] },
      options: {
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { title: i => "Jornada " + pontos[i[0].dataIndex].jornada, label: i => { const p = pontos[i.dataIndex]; return ` ${p.posicao}.º de ${p.equipas} · ${p.pontos} pts`; } } } },
        scales: {
          x: { grid: { display: false } },
          y: { reverse: true, min: 1, max: total, ticks: { stepSize: 1, precision: 0, callback: v => v + ".º" }, grid: { color: "rgba(10,22,40,.08)" } }
        }
      }
    });
  }

  /* ---------- Jornadas AF Guarda (league_results + jogos do VFN) ---------- */

  /** Todos os jogos da competição: resultados entre outras equipas e jogos do VFN (não cancelados). */
  function jogosDaJornada(dados, competicao) {
    // nas taças a jornada pode vir a null: agrupa pelo nº da fase (1 = 1ª eliminatória ... 5 = final)
    const taca = VFN.eliminatorias(competicao);
    const numero = (phase, jornada) => taca ? VFN.numeroFase(VFN.faseDoJogo(phase, jornada)) : Number(jornada) || 0;
    // marcadores separados por equipa: [{ nome, golos }] da casa e de fora
    const doLado = (lista, teamId) => (Array.isArray(lista) ? lista : []).filter(s => String(s.team_id) === String(teamId)).map(s => ({ nome: s.player_name || "?", golos: Number(s.count) || 1 }));
    const liga = (dados.league_results || []).filter(r => r.competition === competicao).map(r => {
      const { casa, fora } = VFN.equipasDoResultadoLiga(r, dados.teams);
      return { origem: "liga", id: r.id, jornada: numero(r.phase, r.jornada), fase: VFN.faseDoJogo(r.phase, r.jornada), vencedor: r.winner_id ? String(r.winner_id) : "", casa, fora, gc: r.score_home, gf: r.score_away, golosCasa: doLado(r.scorer_list, casa.id), golosFora: doLado(r.scorer_list, fora.id), notas: r.scorers || "", data: r.match_date || null, registo: r };
    });
    const vfn = VFN.jogosDoVFN(dados.matches).filter(j => j.competition === competicao && VFN.estadoJogo(j) !== "cancelado").map(j => {
      const { casa, fora } = VFN.equipasDoJogo(j, dados.teams);
      const jogado = VFN.estadoJogo(j) === "jogado";
      return { origem: "vfn", id: j.id, jornada: numero(j.phase, j.jornada), fase: VFN.faseDoJogo(j.phase, j.jornada), vencedor: j.winner_id ? String(j.winner_id) : "", casa, fora, gc: jogado ? j.score_home : null, gf: jogado ? j.score_away : null, golosCasa: doLado(j.scorer_list, casa.id), golosFora: doLado(j.scorer_list, fora.id), notas: "", data: j.date };
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
        <h3 class="jornada-titulo">${esc(VFN.rotuloJornada(o.competicao, n))} <small class="muted">${porJornada.get(n).length} jogo${porJornada.get(n).length === 1 ? "" : "s"}</small></h3>
        ${porJornada.get(n).map(j => {
          const temRes = j.gc != null && j.gf != null && j.gc !== "" && j.gf !== "";
          const resultado = temRes ? `${Number(j.gc)} – ${Number(j.gf)}` : "–";
          const data = j.data ? `${esc(VFN.dataCurta(j.data))}${VFN.horaIso(j.data) && VFN.horaIso(j.data) !== "00:00" ? " · " + esc(VFN.horaIso(j.data)) : ""}` : "";
          const acoes = j.origem === "vfn"
            ? `<span class="jj-tag" title="Jogo do VFN (vem do Calendário)">VFN</span>${o.editavel ? `<button type="button" class="icon-btn" data-acao="editar-vfn" data-id="${esc(j.id)}" title="Editar jogo do VFN" aria-label="Editar jogo do VFN">${VFN.icone("pencil", 16)}</button>` : ""}`
            : o.editavel ? `<span class="row-actions"><button type="button" class="icon-btn" data-acao="editar" data-id="${esc(j.id)}" title="Editar resultado" aria-label="Editar resultado">${VFN.icone("pencil", 16)}</button><button type="button" class="icon-btn danger" data-acao="apagar" data-id="${esc(j.id)}" title="Eliminar resultado" aria-label="Eliminar resultado">${VFN.icone("trash-2", 16)}</button></span>` : "";
          return `<div class="jornada-jogo${j.origem === "vfn" ? " is-vfn-game" : ""}">
            ${lado(j.casa, "jj-casa")}
            <button type="button" class="jj-centro" data-jogo="${j.origem === "vfn" ? "vfn" : "liga"}:${esc(j.id)}" title="Ver detalhe do jogo"><span class="jj-resultado${temRes ? "" : " por-jogar"}">${resultado}</span>${data ? `<small class="jj-data">${data}</small>` : ""}</button>
            ${lado(j.fora, "jj-fora")}
            <span class="jj-acoes">${acoes}</span>
            ${j.golosCasa.length || j.golosFora.length ? `<div class="jj-golos">${[j.golosCasa, j.golosFora].map((lista, i) => `<ul class="${i ? "jj-golos-fora" : "jj-golos-casa"}">${lista.map(g => `<li>${VFN.icone("bola", 12)} ${esc(g.nome)}${g.golos > 1 ? ` <b>×${g.golos}</b>` : ""}</li>`).join("")}</ul>`).join("")}</div>` : ""}
            ${j.notas ? `<p class="jj-marcadores">${esc(j.notas)}</p>` : ""}
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

  /** Badge de forma: círculo com as cores da equipa + últimos resultados. */
  function chipsForma(dados, teamId, n) {
    const jogos = jogosDaEquipa(dados, teamId).slice(0, n || 5);
    const cor = corEquipaDot(equipa(dados, teamId));
    if (!jogos.length) return `<span class="forma-badge">${cor}<span class="muted forma-sem-jogos">Sem jogos</span></span>`;
    return `<span class="forma-badge">${cor}<span class="form-row form-row-sm" aria-label="Forma: últimos ${jogos.length} jogos, mais recente à esquerda">${jogos.map(j => VFN.chipForma(j.letra)).join("")}</span></span>`;
  }

  /** Círculo com a cor principal (e a secundária no contorno) da equipa; vazio sem cores. */
  function corEquipaDot(t) {
    const { primaria, secundaria } = VFN.coresEquipa(t);
    return primaria ? `<span class="cor-equipa-dot" style="background:${primaria};border-color:${secundaria || "#fff"}" aria-hidden="true"></span>` : "";
  }

  /** Cards de todas as equipas (exceto o VFN) com logo, nome, cidade e forma recente. */
  function cardsEquipasHTML(dados, termo) {
    const t = String(termo || "").toLocaleLowerCase("pt-PT");
    const lista = [...(dados.teams || [])].filter(x => !VFN.eVFN(x.name))
      .filter(x => !t || [x.name, x.full_name, x.city].some(v => String(v || "").toLocaleLowerCase("pt-PT").includes(t)))
      .sort((a, b) => a.name.localeCompare(b.name, "pt"));
    if (!lista.length) return vazio("Sem equipas.");
    return lista.map(x => `<button type="button" class="team-card${VFN.coresEquipa(x).primaria ? " com-cor" : ""}" data-equipa="${esc(x.id)}"${VFN.estiloCorEquipa(x)}>
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
  function perfilEquipaHTML(dados, teamId, opcoes) {
    const o = opcoes || {}; // { editavel: botões de editar/apagar nos jogadores conhecidos (admin) }
    const t = equipa(dados, teamId) || { id: teamId, name: "Equipa" };
    const jogosVFN = VFN.jogosDoVFN(dados.matches)
      .filter(j => String(j.opponent_team_id) === String(teamId) && VFN.estadoJogo(j) !== "cancelado")
      .sort((a, b) => (VFN.paraData(a.date) || 0) - (VFN.paraData(b.date) || 0));
    const b = { V: 0, E: 0, D: 0, gm: 0, gs: 0, n: 0 };
    jogosVFN.forEach(j => { const g = VFN.estadoJogo(j) === "jogado" && VFN.golosJogo(j); if (!g) return; b.n++; b.gm += g.vfn; b.gs += g.adv; b[VFN.letraResultado(j)]++; });
    const jogadores = (dados.external_players || []).filter(p => String(p.team_id) === String(teamId))
      .sort((x, y) => (Number(x.number) || 999) - (Number(y.number) || 999) || x.name.localeCompare(y.name, "pt"));
    const golosPorJogador = new Map();
    (dados.league_results || []).forEach(r => (Array.isArray(r.scorer_list) ? r.scorer_list : []).forEach(s => { if (s.player_id) golosPorJogador.set(String(s.player_id), (golosPorJogador.get(String(s.player_id)) || 0) + (Number(s.count) || 1)); }));
    const cores = VFN.coresEquipa(t);
    return `
      <div class="perfil-equipa-cab${cores.primaria ? " com-cor" : ""}"${VFN.estiloCorEquipa(t, 0.1)}>
        ${logoEquipa(t, t.name, "perfil-logo")}
        <div class="perfil-equipa-nome"><h3>${esc(t.name)}</h3>${t.full_name && t.full_name !== t.name ? `<p class="perfil-nome-completo">${esc(t.full_name)}</p>` : ""}
          ${t.city ? `<p class="muted">${VFN.icone("map-pin", 14)} ${esc(t.city)}</p>` : ""}${t.stadium ? `<p class="muted">${VFN.icone("landmark", 14)} ${esc(t.stadium)}</p>` : ""}</div>
        ${cores.primaria ? `<div class="perfil-camisola" title="Equipamento principal">${VFN.camisolaEquipaSVG(t, { tamanho: 64 })}</div>` : ""}
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
      ${jogadores.length ? `<ul class="perfil-jogadores">${jogadores.map(p => {
        const golos = golosPorJogador.get(String(p.id)) || 0;
        return `<li${o.editavel ? ` data-externo="${esc(p.id)}"` : ""}>${VFN.avatarExterno(p, t, "avatar-sm")}
          <span class="ext-nome">${p.number != null && p.number !== "" ? `<b class="ext-numero">${esc(p.number)}</b>` : ""}${esc(p.name)}<small class="muted">ID ${esc(p.id)}</small></span>
          ${golos ? `<strong>${golos} golo${golos === 1 ? "" : "s"}</strong>` : "<span></span>"}
          ${o.editavel ? `<span class="row-actions"><button type="button" class="icon-btn" data-acao-externo="editar" data-id="${esc(p.id)}" title="Editar jogador" aria-label="Editar ${esc(p.name)}">${VFN.icone("pencil", 16)}</button><button type="button" class="icon-btn danger" data-acao-externo="apagar" data-id="${esc(p.id)}" title="Eliminar jogador" aria-label="Eliminar ${esc(p.name)}">${VFN.icone("trash-2", 16)}</button></span>` : ""}</li>`;
      }).join("")}</ul>` : vazio("Ainda sem jogadores registados (os marcadores das Jornadas aparecem aqui).")}`;
  }

  /* ---------- Detalhe do jogo (modal) ---------- */

  const ICONE_EVENTO = { "Golo": "bola", "Auto-golo": "bola", "Golo Anulado": "circle-slash", "Penalty Falhado": "circle-x", "Cartão Amarelo": "square", "Cartão Vermelho": "square", "Lesão": "bandage", "Substituição": "repeat", "Nota": "sticky-note" };

  /** Relatório associado a um jogo do VFN (o publicado mais recente; senão o mais recente). */
  function relatorioDoJogo(dados, matchId) {
    const lista = (dados.match_reports || []).filter(r => r.match_id === matchId || ((r.match_data || {}).preJogo || {}).matchId === matchId);
    const recente = l => [...l].sort((a, b) => String(b.updated_at || b.created_at || "").localeCompare(String(a.updated_at || a.created_at || "")))[0] || null;
    return recente(lista.filter(r => VFN.estadoRelatorio(r) === "published")) || recente(lista);
  }

  function eventosDoRelatorio(relatorio, nomeJogador) {
    const jogo = ((relatorio || {}).match_data || {}).jogo || {};
    const nome = id => (id && nomeJogador ? nomeJogador(id) : "") || "";
    return (jogo.eventos || []).filter(e => e.tipo !== "Tempo Acrescentado").map(e => {
      let texto;
      if (e.tipo === "Substituição") texto = `${nome(e.jogadorSaiId) || "—"} ↘ / ${nome(e.jogadorId) || "—"} ↗`;
      else if (e.equipa === "VFN") texto = (nome(e.jogadorId) || e.detalhe || "") + (e.tipo === "Golo" && e.assistId ? ` (assist. ${nome(e.assistId)})` : "");
      else texto = e.detalhe || "";
      return { minuto: Number(e.minuto) || 0, acrescimo: Number(e.acrescimo) || 0, tipo: e.tipo, vfn: e.equipa === "VFN", neutro: !e.equipa, texto };
    }).sort((a, b) => a.minuto - b.minuto || a.acrescimo - b.acrescimo);
  }

  /**
   * HTML do detalhe. ref = "vfn:<matches.id>" ou "liga:<league_results.id>".
   * opcoes.nomeJogador(idLocal) resolve nomes dos relatórios; opcoes.verRelatorio(relatorio) mostra o botão.
   */
  function detalheJogoHTML(dados, ref, opcoes) {
    const o = opcoes || {};
    const [tipo, id] = String(ref).split(/:(.+)/);
    let casa, fora, gc = null, gf = null, data = null, comp = "", local = "", jornada = null, eventos = [], relatorio = null, estado = "jogado";
    if (tipo === "vfn") {
      const j = (dados.matches || []).find(m => String(m.id) === id);
      if (!j) return vazio("Jogo não encontrado.");
      ({ casa, fora } = VFN.equipasDoJogo(j, dados.teams));
      estado = VFN.estadoJogo(j) || "agendado";
      if (estado === "jogado") { gc = j.score_home; gf = j.score_away; }
      data = j.date; comp = j.competition; local = VFN.estadioDoJogo(j, dados.teams).nome || (VFN.jogoEmCasa(j) ? "Casa (VFN)" : `Fora · ${fora.nome === "ACD Vila Franca das Naves" ? casa.nome : fora.nome}`); jornada = VFN.etiquetaJornada(j, true);
      relatorio = relatorioDoJogo(dados, j.id);
      eventos = eventosDoRelatorio(relatorio, o.nomeJogador);
      // sem eventos no relatório, os golos do VFN não são conhecidos; o lado VFN fica à esquerda/direita conforme casa/fora
      eventos.forEach(e => { e.lado = e.neutro ? "centro" : (e.vfn === VFN.jogoEmCasa(j)) ? "casa" : "fora"; });
    } else {
      const r = (dados.league_results || []).find(x => String(x.id) === id);
      if (!r) return vazio("Jogo não encontrado.");
      ({ casa, fora } = VFN.equipasDoResultadoLiga(r, dados.teams));
      gc = r.score_home; gf = r.score_away; data = r.match_date; comp = r.competition; jornada = VFN.etiquetaJornada(r, true);
      estado = gc != null && gf != null ? "jogado" : "agendado";
      eventos = (Array.isArray(r.scorer_list) ? r.scorer_list : []).map(s => ({ minuto: null, tipo: "Golo", texto: `${s.player_name}${Number(s.count) > 1 ? " ×" + s.count : ""}`, lado: String(s.team_id) === String(fora.id) ? "fora" : "casa" }));
      if (r.scorers) eventos.push({ minuto: null, tipo: "Nota", texto: r.scorers, lado: "centro" });
    }
    const temRes = gc != null && gf != null && gc !== "" && gf !== "";
    const lado = (eq) => `<div class="dj-equipa">${logoEquipa(equipa(dados, eq.id) || { id: eq.id, name: eq.nome }, eq.nome, "dj-logo")}<strong>${esc(eq.nome)}</strong></div>`;
    const linhaEvento = e => `<li class="dj-evento lado-${e.lado || "centro"} tipo-${esc(String(e.tipo).toLowerCase().replace(/[^a-z]+/g, "-"))}">
        <span class="dj-min">${e.minuto != null ? `${e.minuto}${e.acrescimo ? "+" + e.acrescimo : ""}'` : ""}</span>
        <span class="dj-ico" data-type="${esc(e.tipo)}">${VFN.icone(ICONE_EVENTO[e.tipo] || "sticky-note", 16)}</span>
        <span class="dj-texto"><small>${esc(e.tipo)}</small> ${esc(e.texto)}</span>
      </li>`;
    return `
      <div class="dj-placar">
        ${lado(casa)}
        <div class="dj-resultado"><span class="dj-golos">${temRes ? `${Number(gc)}<span class="dj-sep">–</span>${Number(gf)}` : `<span class="dj-vs">vs</span>`}</span>${tipo === "vfn" ? VFN.badgeEstado((dados.matches || []).find(m => String(m.id) === id)) : ""}</div>
        ${lado(fora)}
      </div>
      <div class="dj-meta">
        ${data ? `<span>${VFN.icone("calendar-days", 16)} ${esc(VFN.dataLonga(data, true))}</span>` : ""}
        <span>${VFN.icone("trophy", 16)} ${esc(comp || "—")}${jornada ? ` · ${esc(jornada)}` : ""}</span>
        ${local ? `<span>${VFN.icone("map-pin", 16)} ${esc(local)}</span>` : ""}
      </div>
      <h4 class="perfil-subtitulo">Eventos</h4>
      ${eventos.length ? `<ol class="dj-timeline">${eventos.map(linhaEvento).join("")}</ol>` : vazio(estado === "jogado" ? (tipo === "vfn" ? "Sem eventos registados (ainda não há relatório deste jogo)." : "Sem marcadores registados.") : "O jogo ainda não se realizou.")}
      ${relatorio && VFN.estadoRelatorio(relatorio) === "published" && o.verRelatorio ? `<div class="modal-actions"><button type="button" class="btn btn-ghost" data-ver-relatorio="${esc(relatorio.id)}">${VFN.icone("file-text", 16)} Ver Relatório</button></div>` : ""}`;
  }

  /** Cria o modal (uma vez) e liga os cliques em [data-jogo] da página. */
  function ligarDetalheJogo(obterDados, opcoes) {
    const o = opcoes || {};
    let modal = document.getElementById("modalDetalheJogo");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "modalDetalheJogo";
      modal.className = "modal-overlay";
      modal.hidden = true;
      modal.innerHTML = `<div class="modal-box modal-md detalhe-jogo" role="dialog" aria-modal="true" aria-label="Detalhe do jogo"><div id="detalheJogoCorpo"></div><div class="modal-actions"><button type="button" class="btn btn-accent" data-fechar-detalhe>Fechar</button></div></div>`;
      document.body.appendChild(modal);
      modal.addEventListener("click", e => {
        if (e.target === modal || e.target.closest("[data-fechar-detalhe]")) modal.hidden = true;
        const b = e.target.closest("[data-ver-relatorio]");
        if (b && o.verRelatorio) { modal.hidden = true; o.verRelatorio(b.dataset.verRelatorio); }
      });
      document.addEventListener("keydown", e => { if (e.key === "Escape") modal.hidden = true; });
    }
    document.addEventListener("click", e => {
      const alvo = e.target.closest("[data-jogo]");
      if (!alvo || e.target.closest("input, select, [data-equipa], [data-jogador], .row-actions") || alvo.closest("#modalDetalheJogo")) return;
      document.getElementById("detalheJogoCorpo").innerHTML = detalheJogoHTML(obterDados(), alvo.dataset.jogo, o);
      modal.hidden = false;
      modal.querySelector("[data-fechar-detalhe]").focus();
    });
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
    jogadorDeLinha, equipa, nomeAdversario, logoEquipa, logoVFN, corEquipaDot, tagCompeticao, vazio,
    proximoJogoHTML, atualizarContagens, formaHTML, resultadosHTML, ultimoResultadoHTML,
    competicoesComClassificacao, competicaoPreferida, opcoesCompeticaoHTML, classificacaoHTML, ZONAS_TABELA, legendaZonasHTML,
    marcadores, marcadoresHTML, filtrosPosicaoHTML, plantelHTML,
    filtrosCalendarioHTML, calendarioHTML, calendarioDivididoHTML, alternarOrdemCalendario, competicaoAtiva, esqueleto,
    jogosDaJornada, jornadasDisponiveis, classificacaoJornadasHTML, marcadoresVFNCompeticaoHTML, equipasDasJornadas, jornadasHTML, jogosDaEquipa, formaEquipaHTML, marcadoresCampeonato, marcadoresCampeonatoHTML, chipsForma, cardsEquipasHTML, perfilEquipaHTML, relatorioDoJogo, eventosDoRelatorio, detalheJogoHTML, ligarDetalheJogo, formaAteJogo, bracketHTML, confrontosPorFase, vencedorConfronto, posicoesPorJornada, graficoPosicao, posicaoNoCampo, capitaoAtivo, mapaPosicoesHTML, fichaVisualHTML, anelHTML, jogosDisputados, opcoesFicha, minutosListaHTML, onzeCampoHTML, onzeMaisUtilizado, presencasPorJogador, rankingPresencasHTML, desempenhoPorCompeticaoHTML, disponibilidadeHTML
  };
})();
