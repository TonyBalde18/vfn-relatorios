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
      subPosicao: p.sub_posicao || "", // só na tabela players (admin/dashboard); as views públicas não têm
      posicoesSecundarias: Array.isArray(p.posicoes_secundarias) ? p.posicoes_secundarias : [],
      fotoUrl: p.photo_url || "",
      jogos: Number(s.jogos) || 0,
      golos: Number(s.golos) || 0,
      assistencias: Number(s.assistencias) || 0,
      cartoesA: Number(s.cartoesA) || 0,
      cartoesV: Number(s.cartoesV) || 0,
      minutos: Number(s.minutos) || 0,
      attributes: p.attributes || {},
      proficiencia: s.proficiencia || {}, // v14: 1–20 por posição (VFN.proficienciaJogador)
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
    return `<span class="comp-tag comp-${VFN.categoriaCompeticao(comp)}">${VFN.logoSponsorHTML(comp)}${esc(VFN.nomeCurtoCompeticao(comp))}</span>`;
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

  /**
   * Forma do VFN (v14): últimos n jogos oficiais (sem amigáveis), do mais antigo (esquerda) para o mais recente,
   * em círculos V verde / E cinzento / D vermelho com tooltip "VFN 2-1 Adversário (dd/mm/aaaa)" (hover ou toque).
   * o: { rotulo: false sem o texto "Forma (últ. 5 jogos oficiais)", compacto: linha pequena (próximo adversário) }
   */
  function formaHTML(dados, n, o) {
    const opcoes = o || {};
    const total = n || 5;
    const jogos = VFN.ultimosJogos(dados.matches, Infinity).filter(j => VFN.competicaoOficial(j.competition)).slice(0, total).reverse();
    if (!jogos.length) return "";
    const nomes = { V: "Vitória", E: "Empate", D: "Derrota" };
    const pontos = jogos.map(j => {
      const g = VFN.golosJogo(j), letra = VFN.letraResultado(j);
      const dica = `VFN ${g.vfn}-${g.adv} ${nomeAdversario(dados, j)} (${VFN.dataDDMMAAAA(VFN.dataIso(j.date))})`;
      return `<span class="forma-ponto form-${letra}" tabindex="0" data-dica="${esc(dica)}" title="${esc(dica)}" aria-label="${nomes[letra] || ""}: ${esc(dica)}">●</span>`;
    }).join("");
    const rotulo = opcoes.rotulo === false ? "" : `<span class="forma-pontos-rotulo">${opcoes.compacto ? "Forma VFN" : `Forma (últ. ${total} jogos oficiais)`}</span>`;
    return `<div class="forma-pontos${opcoes.compacto ? " compacto" : ""}">${rotulo}<span class="forma-pontos-linha" aria-label="Forma nos últimos ${jogos.length} jogos oficiais, do mais antigo para o mais recente">${pontos}</span></div>`;
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
      <div class="hero-meta"><span>${esc(VFN.dataLonga(j.date))} · ${VFN.nomeCompeticaoHTML(j.competition, true)}</span></div>`;
  }

  /* ---------- Classificação ---------- */

  function competicoesComClassificacao(dados) {
    // 1ª Liga, 2ª Liga, Taça 2ª Liga e Taça de Honra (nas taças a classificação é o bracket)
    return VFN.COMPETICOES_SELETOR;
  }

  function competicaoPreferida(dados) {
    const comps = competicoesComClassificacao(dados);
    const proximo = VFN.proximoJogo(dados.matches);
    if (proximo && comps.includes(proximo.competition)) return proximo.competition;
    return VFN.COMPETICOES_CLASSIFICACAO[0]; // a liga do VFN
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
    "2ª Liga Futebol Zero Graus Produções": [
      { pos: [1], classe: "zona-campeao", icone: "🟡", texto: "1.º lugar — Campeão · Promoção à 1ª Liga AF Guarda" },
      { pos: [2], classe: "zona-promocao", icone: "🟢", texto: "2.º lugar — Promoção à 1ª Liga AF Guarda" }
    ],
    "1ª Liga Futebol Cima-Tavfer": [
      { pos: [1], classe: "zona-campeao", icone: "🏆", texto: "1.º lugar — Campeão · Promoção ao Campeonato de Portugal" },
      { pos: [2], classe: "zona-promocao", icone: "🟢", texto: "2.º lugar — Qualificação para a Taça de Portugal 2027/28" },
      { pos: [13, 14], classe: "zona-descida", icone: "🔴", texto: "13.º e 14.º — Despromoção à 2ª Liga AF Guarda" }
    ]
  };

  const zonaDaPosicao = (competicao, pos) => (ZONAS_TABELA[competicao] || []).find(z => z.pos.includes(pos)) || null;

  function legendaZonasHTML(competicao) {
    const zonas = ZONAS_TABELA[competicao] || [];
    return zonas.length ? `<ul class="legenda-zonas">${zonas.map(z => `<li class="${z.classe}"><span aria-hidden="true">${z.icone}</span>${esc(z.texto)}</li>`).join("")}</ul>` : "";
  }

  const comSinal = n => (n > 0 ? "+" : "") + n;

  /** Últimos n resultados de uma equipa numa competição (mais recente à esquerda): ["V", "E", ...]. */
  function formaNaCompeticao(dados, teamId, competicao, n) {
    const t = equipa(dados, teamId);
    if (t && VFN.eVFN(t.name)) {
      return VFN.jogosDoVFN(dados.matches).filter(j => j.competition === competicao && VFN.estadoJogo(j) === "jogado" && VFN.golosJogo(j))
        .sort((a, b) => (VFN.paraData(b.date) || 0) - (VFN.paraData(a.date) || 0)).slice(0, n || 5).map(j => VFN.letraResultado(j));
    }
    return jogosDaEquipa(dados, teamId).filter(j => j.competicao === competicao).slice(0, n || 5).map(j => j.letra);
  }

  /** Tabela classificativa (taças: bracket), sempre no estilo escuro, com DG, zonas e legenda. */
  function classificacaoHTML(dados, competicao) {
    const cabecalho = `<p class="classificacao-comp">${VFN.nomeCompeticaoHTML(competicao)}</p>`;
    if (VFN.eliminatorias(competicao)) return cabecalho + bracketHTML(dados, competicao);
    // calculada a partir dos resultados em matches (não usa a tabela standings)
    const linhas = VFN.calcularClassificacao(dados.matches, dados.teams, competicao, dados.league_results);
    if (!linhas.length) return vazio("Classificação ainda não disponível.");
    return `<div class="classificacao-bloco tabela-escura" data-competicao="${esc(competicao)}">
      ${cabecalho}
      <div class="table-wrap"><table class="standings-compact" data-ordenar="classificacao">
      <thead><tr><th scope="col" data-tipo="numero">Pos</th><th scope="col" class="team-col" data-tipo="texto">Equipa</th><th scope="col" data-tipo="numero">J</th><th scope="col" data-tipo="numero">V</th><th scope="col" data-tipo="numero">E</th><th scope="col" data-tipo="numero">D</th><th scope="col" class="hide-xs" data-tipo="numero">GM</th><th scope="col" class="hide-xs" data-tipo="numero">GS</th><th scope="col" data-tipo="numero" title="Diferença de golos">DG</th><th scope="col" data-tipo="numero">Pts</th><th scope="col" class="col-forma" title="Últimos 5 jogos nesta competição (mais recente à esquerda)">Forma</th></tr></thead>
      <tbody>${linhas.map((s, i) => {
        const t = equipa(dados, s.team_id);
        const nome = (t && t.name) || s.team_name || "—";
        const zona = zonaDaPosicao(competicao, i + 1);
        const dg = (Number(s.goals_for) || 0) - (Number(s.goals_against) || 0);
        return `<tr class="${[VFN.eVFN(nome) ? "is-vfn-row" : "", zona ? zona.classe : ""].filter(Boolean).join(" ")}"><td class="pos-col">${i + 1}</td><td class="team-col"><span class="team-inline">${logoEquipa(t, nome)}<span>${esc(nome)}</span></span></td><td>${Number(s.played) || 0}</td><td>${Number(s.won) || 0}</td><td>${Number(s.drawn) || 0}</td><td>${Number(s.lost) || 0}</td><td class="hide-xs">${Number(s.goals_for) || 0}</td><td class="hide-xs">${Number(s.goals_against) || 0}</td><td class="dg-col${dg > 0 ? " pos" : dg < 0 ? " neg" : ""}" data-v="${dg}">${comSinal(dg)}</td><td class="pts-col">${Number(s.points) || 0}</td><td class="col-forma"><span class="form-row form-row-sm">${formaNaCompeticao(dados, s.team_id, competicao, 5).map(l => VFN.chipForma(l)).join("") || '<span class="muted">—</span>'}</span></td></tr>`;
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
    return `<div class="tabela-escura tabela-marcadores"><table class="scorers-table"><thead><tr><th scope="col"></th><th scope="col" class="team-col">Jogador</th><th scope="col" title="Golos">G</th><th scope="col" title="Assistências">Ass</th><th scope="col" title="Jogos">J</th></tr></thead>
      <tbody>${top.map((j, i) => `<tr><td class="pos-col">${i + 1}</td><td class="team-col"><span class="player-cell">${VFN.avatarJogador(j, "avatar-sm")}<span>${esc(j.nome)}<small class="muted">${esc(j.posicao)}</small></span></span></td><td class="pts-col" data-contar="${j.golos}">${j.golos}</td><td data-contar="${j.assistencias}">${j.assistencias}</td><td data-contar="${j.jogos}">${j.jogos}</td></tr>`).join("")}</tbody></table></div>`;
  }

  /* ---------- Melhores marcadores do campeonato ---------- */

  /**
   * Golos de jogadores de outras equipas (jogadores externos): league_results.scorer_list
   * (jogos entre outras equipas) + golos do adversário nos jogos do VFN (matches.scorer_list,
   * team = "adversario"). competicao opcional (sem ela: todas).
   */
  function golosExternos(dados, competicao) {
    const daComp = x => !competicao || x.competition === competicao;
    const liga = (dados.league_results || []).filter(r => daComp(r) && Array.isArray(r.scorer_list)).flatMap(r => r.scorer_list);
    const contraVFN = VFN.jogosDoVFN(dados.matches).filter(j => daComp(j) && VFN.estadoJogo(j) !== "cancelado" && Array.isArray(j.scorer_list))
      .flatMap(j => j.scorer_list.filter(VFN.eGoloAdversario).map(s => ({ ...s, team_id: s.team_id || j.opponent_team_id || "" })));
    return [...liga, ...contraVFN];
  }

  /**
   * Golos por jogador numa competição: outras equipas a partir de golosExternos
   * (jogadores externos) + jogadores do VFN a partir de matches.scorer_list ou players.stats.
   */
  function marcadoresCampeonato(dados, jogadoresVFN, competicao) {
    const mapa = new Map();
    golosExternos(dados, competicao).forEach(s => {
      const chave = s.player_id ? `id:${s.player_id}` : `nome:${s.player_name}|${s.team_id}`;
      const ext = (dados.external_players || []).find(p => String(p.id) === String(s.player_id));
      const atual = mapa.get(chave) || { nome: (ext && ext.name) || s.player_name || "?", teamId: s.team_id || (ext && ext.team_id) || "", golos: 0, vfn: false };
      atual.golos += Number(s.count) || 1;
      mapa.set(chave, atual);
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
   * O VFN não joga nas competições só acompanhadas (ex.: 1ª Liga).
   */
  function golosVFNNaCompeticao(dados, jogadoresVFN, competicao) {
    if (VFN.semVFN(competicao)) return [];
    const vfn = String(VFN.equipaVFN(dados.teams).id);
    const porId = id => (jogadoresVFN || []).find(j => String(j.id) === String(id) || String(j.id).endsWith("-" + id)) || null;
    if (temMarcadoresPorJogo(dados, competicao)) {
      const mapa = new Map();
      VFN.jogosDoVFN(dados.matches).filter(j => j.competition === competicao && Array.isArray(j.scorer_list)).forEach(j => j.scorer_list.filter(s => !VFN.eGoloAdversario(s)).forEach(s => {
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
    return `<div class="tabela-escura tabela-marcadores"><table class="scorers-table"><thead><tr><th scope="col">Pos</th><th scope="col" class="team-col">Jogador</th><th scope="col">Golos</th></tr></thead>
      <tbody>${lista.map((m, i) => `<tr><td class="pos-col">${i + 1}</td><td class="team-col">${m.jogador ? `<span class="player-cell">${VFN.avatarJogador(m.jogador, "avatar-xs")}<span>${esc(m.nome)}</span></span>` : esc(m.nome)}</td><td class="pts-col">${m.golos}</td></tr>`).join("")}</tbody></table></div>`;
  }

  /** Tabela classificativa mostrada nas Jornadas para as competições sem o VFN ("" nas outras). */
  function classificacaoJornadasHTML(dados, competicao) {
    return VFN.semVFN(competicao) ? classificacaoHTML(dados, competicao) : "";
  }

  function marcadoresCampeonatoHTML(dados, jogadoresVFN, competicao, n) {
    const lista = marcadoresCampeonato(dados, jogadoresVFN, competicao).slice(0, n || 10);
    if (!lista.length) return vazio("Ainda não há marcadores registados nesta competição.");
    return `<div class="tabela-escura tabela-marcadores"><table class="scorers-table" data-ordenar="marcadores-campeonato"><thead><tr><th scope="col">Pos</th><th scope="col" class="team-col" data-tipo="texto">Jogador</th><th scope="col" class="team-col" data-tipo="texto">Clube</th><th scope="col" data-tipo="numero">Golos</th></tr></thead>
      <tbody>${lista.map((m, i) => {
        const t = equipa(dados, m.teamId);
        const clube = (t && t.name) || "—";
        return `<tr class="${m.vfn ? "is-vfn-row" : ""}"><td class="pos-col">${i + 1}</td>
          <td class="team-col">${m.vfn ? `<span class="player-cell">${VFN.avatarJogador(m.jogador, "avatar-xs")}<span>${esc(m.nome)}</span></span>` : esc(m.nome)}</td>
          <td class="team-col"><span class="team-inline">${logoEquipa(t, clube)}<span>${esc(clube)}</span></span></td>
          <td class="pts-col" data-contar="${m.golos}">${m.golos}</td></tr>`;
      }).join("")}</tbody></table>
      <p class="muted nota-marcadores">${VFN.semVFN(competicao) ? "Marcadores registados nas Jornadas AF Guarda." : temMarcadoresPorJogo(dados, competicao) ? "Golos do VFN: relatórios dos jogos desta competição. Outras equipas: marcadores registados nas Jornadas AF Guarda e nos jogos contra o VFN." : "Golos do VFN: total da época (todas as competições). Outras equipas: marcadores registados nas Jornadas AF Guarda e nos jogos contra o VFN."}</p></div>`;
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
    return lista.map(j => window.VFNComp.renderPlayerCard(j, { capitao: String(j.id) === capitao, disponibilidade: o.disponibilidade, comparar: o.comparar })).join("");
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
    // tendências (últimos 3 jogos vs 3 anteriores): só golos e minutos nas barras
    const tend = o.tendencias ? { golos: o.tendencias.golos, minutos: o.tendencias.minutos, cartoes: o.tendencias.cartoes, presencas: o.tendencias.presencas } : {};
    const barras = [["Jogos", "jogos", ""], ["Minutos", "minutos", "'"], ["Golos", "golos", ""], ["Assistências", "assistencias", ""]].map(([rotulo, k, suf]) => `
      <div class="ficha-barra"><span>${rotulo}</span><span class="barra"><i style="width:${Math.round((Number(j[k]) || 0) / max(k) * 100)}%"></i></span><strong>${Number(j[k]) || 0}${suf}${tend[k] !== undefined ? badgeTendencia(tend[k], false, rotulo) : ""}</strong></div>`).join("");
    const cartoes = `<div class="ficha-cartoes"><span class="cartao amarelo" title="Amarelos">${j.cartoesA || 0}</span><span class="cartao vermelho" title="Vermelhos">${j.cartoesV || 0}</span>${badgeTendencia(tend.cartoes, true, "Cartões")}</div>`;
    const aneis = [];
    if (o.jogosEquipa > 0) aneis.push(anelHTML((Number(j.minutos) || 0) / (o.jogosEquipa * 90) * 100, "Utilização", `${j.minutos || 0}' de ${o.jogosEquipa * 90}' possíveis`));
    const registos = (o.presencas || []).filter(r => r.status);
    if (registos.length) {
      const presentes = registos.filter(r => r.status === "P" || r.status === "A").length;
      aneis.push(anelHTML(presentes / registos.length * 100, "Presença", `${presentes} de ${registos.length} sessões`).replace("<span>Presença</span>", `<span>Presença${badgeTendencia(tend.presencas, false, "Presenças")}</span>`));
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
  function opcoesFicha(dados, id, jogador, eDoJogador) {
    const presencas = dados.attendance ? dados.attendance.filter(a => String(a.player_id) === String(id)).map(a => ({ data: a.session_date, status: a.status })) : null;
    return { presencas, jogosEquipa: jogosDisputados(dados), tendencias: tendenciasJogador(dados, jogador || { id }, { eDoJogador }) };
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

  // Posições no campo (x = lado, da esquerda para a direita; y = profundidade; o ataque é em cima)
  const POSICOES_CAMPO = {
    GR: [50, 89], DC: [50, 73], DD: [86, 68], DE: [14, 68],
    MDEF: [50, 57], MCEN: [50, 45], MOFE: [50, 33],
    ED: [84, 24], EE: [16, 24], PL: [50, 12]
  };
  // Linhas do campo (de trás para a frente) para o onze sem formação
  const LINHAS_CAMPO = [["DE", "DC", "DD"], ["MDEF", "MCEN", "MOFE"], ["EE", "PL", "ED"]];
  const MAX_POR_LINHA = 5;
  const GR_Y = 89, LINHA_Y_TRAS = 72, LINHA_Y_FRENTE = 13;

  /** Largura (%) de cada jogador numa linha com n jogadores: nunca se sobrepõem. */
  const larguraNaLinha = n => Math.min(26, Math.floor(100 / (n + 1)) - 1);

  /**
   * x (%) dos jogadores de uma linha, já ordenados da esquerda para a direita: usa o lado
   * da posição (laterais e extremos abertos) se houver espaço; senão distribui por igual.
   */
  function xDaLinha(preferidos) {
    const n = preferidos.length;
    const minimo = larguraNaLinha(n) + 2;
    const cabe = preferidos.every((x, i) => i === 0 || x - preferidos[i - 1] >= minimo) && preferidos[0] >= 12 && preferidos[n - 1] <= 88;
    return cabe ? preferidos : preferidos.map((_, k) => Math.round((k + 1) * 100 / (n + 1)));
  }

  /**
   * Onze sem formação, colocado em linhas pela posição do perfil: GR, defesa, meio-campo
   * (em duas linhas quando há mais de 4 médios) e ataque. Devolve [{ t, x, y, largura }].
   */
  function posicoesPorLinhas(onze) {
    const prof = t => POSICOES_CAMPO[posicaoNoCampo(t.jogador.posicao)];
    const gr = onze.filter(t => posicaoNoCampo(t.jogador.posicao) === "GR");
    const linhas = [];
    LINHAS_CAMPO.forEach(codigos => {
      const doGrupo = onze.filter(t => codigos.includes(posicaoNoCampo(t.jogador.posicao)));
      if (!doGrupo.length) return;
      // meio-campo com muitos jogadores (ou qualquer linha com mais de 5): parte por profundidade
      const partes = doGrupo.length > (codigos[0] === "MDEF" ? 4 : MAX_POR_LINHA) ? 2 : 1;
      const porProf = [...doGrupo].sort((a, b) => prof(b)[1] - prof(a)[1]);
      const tamanho = Math.ceil(porProf.length / partes);
      for (let p = 0; p < partes; p++) linhas.push(porProf.slice(p * tamanho, (p + 1) * tamanho));
    });
    const resultado = [];
    // mais de um GR no onze (sem GR com minutos não acontece): o 2.º joga na linha da defesa
    gr.slice(1).forEach(t => (linhas[0] || (linhas[0] = [])).unshift(t));
    if (gr[0]) resultado.push({ t: gr[0], x: 50, y: GR_Y, largura: larguraNaLinha(1) });
    const passo = linhas.length > 1 ? (LINHA_Y_TRAS - LINHA_Y_FRENTE) / (linhas.length - 1) : 0;
    linhas.forEach((linha, l) => {
      const y = linhas.length > 1 ? LINHA_Y_TRAS - l * passo : 45;
      const ordenada = [...linha].sort((a, b) => prof(a)[0] - prof(b)[0]);
      const xs = xDaLinha(ordenada.map(t => prof(t)[0]));
      ordenada.forEach((t, k) => resultado.push({ t, x: xs[k], y: Math.round(y), largura: larguraNaLinha(ordenada.length) }));
    });
    return resultado;
  }
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
   * o: { rotulo(t) em vez dos minutos, capitao: id com o badge "C", ordenado: já vem como onze,
   *      proficiencia: ponto de proficiência (só com formação: é ela que diz a posição de cada um) }
   */
  function onzeCampoHTML(lista, opcoes) {
    const o = opcoes || {};
    if (!lista.length) return vazio(o.rotulo ? "Onze ainda não definido." : "Ainda não há minutos registados.");
    const onze = o.rotulo ? lista.slice(0, 11) : onzeMaisUtilizado(lista);
    // com formação (convocatória): linhas da formação escolhida; sem formação: posição do perfil
    const marcadores = o.formacao ? posicoesDaFormacao(onze, o.formacao) : posicoesPorLinhas(onze);
    return `<div class="mini-pitch" role="img" aria-label="Onze mais utilizado: ${esc(onze.map(t => t.jogador.nome).join(", "))}">
      <span class="mini-pitch-lines" aria-hidden="true"></span>
      ${marcadores.map(({ t, x, y, largura, slot }) => {
        const capitao = o.capitao && String(o.capitao) === String(t.jogador.idBD || t.jogador.id);
        const rotulo = o.rotulo ? o.rotulo(t) : t.minutos + "'";
        const prof = o.proficiencia && slot ? VFN.proficienciaPontoHTML(VFN.proficienciaJogador(t.jogador, slot)) : "";
        return `<div class="pitch-player" style="left:${x}%;top:${y}%;width:${largura}%" title="${esc(t.jogador.nome)}${rotulo ? " · " + esc(rotulo) : ""}"><span class="pitch-player-avatar">${VFN.avatarJogador(t.jogador, "avatar-sm")}${capitao ? VFN.badgeCapitao("no-campo") : ""}${prof}</span><span class="pitch-player-name"><span>${esc(t.jogador.nome)}</span>${rotulo ? `<b>${esc(rotulo)}</b>` : ""}</span></div>`;
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
    const lugares = lugaresDaFormacao(formacao);
    const resultado = [];
    if (onze[0]) resultado.push({ t: onze[0], x: 50, y: GR_Y, largura: larguraNaLinha(1), slot: lugares[0][0] });
    let i = 1;
    linhas.forEach((n, l) => {
      const y = LINHA_Y_TRAS - l * ((LINHA_Y_TRAS - LINHA_Y_FRENTE) / Math.max(1, linhas.length - 1));
      for (let k = 0; k < n && i < onze.length; k++, i++) resultado.push({ t: onze[i], x: Math.round((k + 1) * 100 / (n + 1)), y: Math.round(y), largura: larguraNaLinha(n), slot: (lugares[l + 1] || [])[k] });
    });
    return resultado;
  }

  /**
   * Lugares (VFN.FORMACOES_SLOTS) agrupados como as linhas de posicoesDaFormacao: [[GR], [linha 1 da esquerda
   * para a direita], ...]. Serve para saber a posição de cada titular na pré-visualização (proficiência).
   */
  function lugaresDaFormacao(formacao) {
    const slots = (VFN.FORMACOES_SLOTS[formacao] || VFN.FORMACOES_SLOTS["4-3-3"]).slice();
    const grupos = [[slots.shift()]];
    linhasFormacao(formacao).forEach(n => grupos.push(slots.splice(0, n).sort((a, b) => a.x - b.x)));
    return grupos;
  }

  /** Lugar de cada titular (id → slot) com o onze colocado pela formação, como na pré-visualização. */
  function lugaresDoOnze(onze, formacao) {
    const mapa = new Map();
    posicoesDaFormacao(onze, formacao).forEach(m => { if (m.slot) mapa.set(String(m.t.jogador.idBD || m.t.jogador.id), m.slot); });
    return mapa;
  }

  /* ---------- Tendências do jogador (últimos 3 jogos vs os 3 anteriores) ---------- */

  /** Competição de um relatório: coluna competition, pré-jogo, ou o jogo do calendário associado. */
  function competicaoDoRelatorio(r, dados) {
    const m = (r && r.match_data) || {};
    const matchId = (r && r.match_id) || (m.preJogo || {}).matchId;
    const jogo = matchId && ((dados && dados.matches) || []).find(j => String(j.id) === String(matchId));
    return (r && r.competition) || (m.preJogo || {}).competicao || (jogo && jogo.competition) || "";
  }

  /** Os minutos só contam nos jogos oficiais: relatórios de amigáveis ficam de fora (VFN.competicaoOficial). */
  function relatorioOficial(r, dados) {
    return VFN.competicaoOficial(competicaoDoRelatorio(r, dados));
  }

  /**
   * Números de um jogador jogo a jogo, para os gráficos pessoais: [{ rotulo, data, minutos, golos,
   * assistencias, golosAcum, assistAcum }] por ordem da data. Só relatórios publicados de competições
   * oficiais (sem amigáveis). Não há tabelas match_players/goals: os dados vêm de match_reports.match_data
   * (onze, substituições e eventos). eDele(idLocal) liga os ids dos relatórios ao jogador.
   */
  function estatisticasPorJogo(dados, eDele) {
    const linhas = (dados.match_reports || [])
      .filter(r => VFN.estadoRelatorio(r) === "published" && (r.match_data || {}).jogo && relatorioOficial(r, dados))
      .map(r => {
        const m = r.match_data, pre = m.preJogo || {};
        const matchId = r.match_id || pre.matchId;
        const jogo = (dados.matches || []).find(j => String(j.id) === String(matchId)) || null;
        const data = (jogo && VFN.dataIso(jogo.date)) || pre.data || r.match_date || "";
        const comp = competicaoDoRelatorio(r, dados);
        const jornada = jogo ? VFN.etiquetaJornada(jogo, true) : pre.jornada ? "J" + pre.jornada : "";
        const adversario = (jogo && nomeAdversario(dados, jogo)) || pre.adversario || r.opponent || "";
        const ev = (m.jogo.eventos || []).filter(e => e.equipa === "VFN");
        return {
          data,
          rotulo: [jornada || VFN.dataCurta(data), adversario].filter(Boolean).join(" · "),
          competicao: VFN.nomeCurtoCompeticao(comp),
          minutos: Object.entries(minutosDoRelatorio(m)).filter(([id]) => eDele(id)).reduce((s, [, v]) => s + v, 0),
          golos: ev.filter(e => e.tipo === "Golo" && eDele(e.jogadorId)).length,
          assistencias: ev.filter(e => e.tipo === "Golo" && e.assistId && eDele(e.assistId)).length
        };
      })
      .filter(x => x.data)
      .sort((a, b) => String(a.data).localeCompare(String(b.data)));
    let g = 0, a = 0;
    return linhas.map(x => ({ ...x, golosAcum: (g += x.golos), assistAcum: (a += x.assistencias) }));
  }

  /** Minutos de cada jogador num relatório: titulares desde o 0', substituições pelo minuto. */
  /** Períodos em campo de cada jogador num relatório: { duracao, periodos: { idLocal: [{ inicio, fim }] } }. */
  function periodosDoRelatorio(matchData) {
    const jogo = (matchData && matchData.jogo) || {};
    const duracao = Number(jogo.duracaoJogo) || 90;
    const periodos = {};
    (jogo.titulares || []).filter(Boolean).forEach(id => { periodos[id] = [{ inicio: 0, fim: null }]; });
    (jogo.eventos || []).filter(e => e.equipa === "VFN" && e.tipo === "Substituição" && e.jogadorSaiId && e.jogadorId)
      .sort((a, b) => (Number(a.minuto) || 0) - (Number(b.minuto) || 0))
      .forEach(e => {
        const minuto = Math.min(Number(e.minuto) || 0, duracao);
        const aberto = (periodos[e.jogadorSaiId] || []).find(p => p.fim === null);
        if (aberto) aberto.fim = minuto;
        (periodos[e.jogadorId] || (periodos[e.jogadorId] = [])).push({ inicio: minuto, fim: null });
      });
    Object.values(periodos).forEach(lista => lista.forEach(p => { if (p.fim === null) p.fim = duracao; }));
    return { duracao, periodos };
  }

  function minutosDoRelatorio(matchData) {
    const minutos = {};
    Object.entries(periodosDoRelatorio(matchData).periodos).forEach(([id, lista]) => {
      const total = lista.reduce((s, p) => s + Math.max(0, p.fim - p.inicio), 0);
      if (total > 0) minutos[id] = total;
    });
    return minutos;
  }

  /**
   * Guarda-redes, a partir dos relatórios (gerados ou publicados, um por jogo, por ordem da data):
   * jogosZero = jogos em que esteve ≥ 60' em campo sem a equipa sofrer golos enquanto jogou;
   * minutosSemSofrer = maior série de minutos em campo sem sofrer (atravessa jogos seguidos).
   * eDele(idLocal) liga os ids dos relatórios ao jogador.
   */
  function estatisticasGR(dados, eDele) {
    const porJogo = new Map();
    (dados.match_reports || []).forEach(r => {
      const m = r && r.match_data;
      if (!m || !m.jogo || !(VFN.estadoRelatorio(r) === "published" || m.jogo.presencasAplicadas)) return;
      const chave = String(r.match_id || (m.preJogo || {}).matchId || r.id);
      const atual = porJogo.get(chave);
      if (!atual || String(r.updated_at || "") > String(atual.updated_at || "")) porJogo.set(chave, r);
    });
    const data = r => (r.match_data.preJogo || {}).data || r.match_date || "";
    let jogosZero = 0, serie = 0, melhor = 0;
    [...porJogo.values()].sort((a, b) => String(data(a)).localeCompare(String(data(b)))).forEach(r => {
      const { duracao, periodos } = periodosDoRelatorio(r.match_data);
      const meus = Object.entries(periodos).filter(([id]) => eDele(id)).flatMap(([, l]) => l).sort((a, b) => a.inicio - b.inicio);
      if (!meus.length) return;
      const sofridos = (r.match_data.jogo.eventos || []).filter(VFN.eGoloSofrido).map(e => Math.min(duracao, Number(e.minuto) || 0)).sort((a, b) => a - b);
      const jogou = meus.reduce((s, p) => s + Math.max(0, p.fim - p.inicio), 0);
      if (jogou >= 60 && !sofridos.some(m => meus.some(p => m >= p.inicio && m <= p.fim))) jogosZero++;
      meus.forEach(p => {
        let inicio = p.inicio;
        sofridos.filter(m => m >= p.inicio && m <= p.fim).forEach(m => { serie += m - inicio; melhor = Math.max(melhor, serie); serie = 0; inicio = m; });
        serie += p.fim - inicio;
        melhor = Math.max(melhor, serie);
      });
    });
    return { jogosZero, minutosSemSofrer: melhor };
  }

  /**
   * Estatísticas de guarda-redes (v14), a partir de match_reports (publicados ou com presenças aplicadas,
   * um por jogo, só competições oficiais — como os minutos):
   *   jogosZero        jogos completos (titular, sem ser substituído) em que o adversário marcou 0;
   *   minutosZero      soma dos minutos desses jogos;
   *   golosSofridos    golos sofridos enquanto esteve em campo; mediaSofridos = golosSofridos / jogos (2 casas);
   *   melhorSerie      maior série de minutos em campo sem sofrer (atravessa jogos seguidos).
   * playerId: id local dos relatórios, ou uma função eDele(idLocal). o.matches: jogos (para saber a competição).
   */
  function calcularStatsGR(playerId, matchReports, o) {
    const eDele = typeof playerId === "function" ? playerId : id => String(id) === String(playerId);
    const dados = { matches: (o && o.matches) || [] };
    const porJogo = new Map();
    (matchReports || []).forEach(r => {
      const m = r && r.match_data;
      if (!m || !m.jogo || !(VFN.estadoRelatorio(r) === "published" || m.jogo.presencasAplicadas) || !relatorioOficial(r, dados)) return;
      const chave = String(r.match_id || (m.preJogo || {}).matchId || r.id);
      const atual = porJogo.get(chave);
      if (!atual || String(r.updated_at || "") > String(atual.updated_at || "")) porJogo.set(chave, r);
    });
    const data = r => (r.match_data.preJogo || {}).data || r.match_date || "";
    let jogos = 0, minutos = 0, jogosZero = 0, minutosZero = 0, golosSofridos = 0, serie = 0, melhorSerie = 0;
    [...porJogo.values()].sort((a, b) => String(data(a)).localeCompare(String(data(b)))).forEach(r => {
      const jogo = r.match_data.jogo;
      const { duracao, periodos } = periodosDoRelatorio(r.match_data);
      const meus = Object.entries(periodos).filter(([id]) => eDele(id)).flatMap(([, l]) => l).sort((a, b) => a.inicio - b.inicio);
      const jogou = meus.reduce((s, p) => s + Math.max(0, p.fim - p.inicio), 0);
      if (!jogou) return;
      jogos++; minutos += jogou;
      const eventos = jogo.eventos || [];
      const sofridos = eventos.filter(VFN.eGoloSofrido).map(e => Math.min(duracao, Number(e.minuto) || 0)).sort((a, b) => a - b);
      golosSofridos += sofridos.filter(m => meus.some(p => m >= p.inicio && m <= p.fim)).length;
      const titular = (jogo.titulares || []).some(id => id && eDele(id));
      // substituído (jogadorSaiId) ou expulso: não fez o jogo inteiro
      const saiu = eventos.some(e => e.equipa === "VFN" && ((e.tipo === "Substituição" && e.jogadorSaiId && eDele(e.jogadorSaiId)) || (e.tipo === "Cartão Vermelho" && eDele(e.jogadorId))));
      if (titular && !saiu && !sofridos.length) { jogosZero++; minutosZero += jogou; }
      meus.forEach(p => {
        let inicio = p.inicio;
        sofridos.filter(m => m >= p.inicio && m <= p.fim).forEach(m => { serie += m - inicio; melhorSerie = Math.max(melhorSerie, serie); serie = 0; inicio = m; });
        serie += p.fim - inicio;
        melhorSerie = Math.max(melhorSerie, serie);
      });
    });
    const mediaSofridos = jogos ? Math.round((golosSofridos / jogos) * 100) / 100 : 0;
    return { jogos, minutos, jogosZero, minutosZero, golosSofridos, mediaSofridos, melhorSerie };
  }

  /** Compara os k mais recentes com os k anteriores (k ≤ 3): 1 sobe, -1 desce, 0 igual; null sem dados. */
  function comparar(valoresRecentesPrimeiro) {
    const n = valoresRecentesPrimeiro.length;
    if (n < 2) return null;
    const k = Math.min(3, Math.floor(n / 2));
    const soma = l => l.reduce((s, v) => s + v, 0);
    const a = soma(valoresRecentesPrimeiro.slice(0, k)), b = soma(valoresRecentesPrimeiro.slice(k, 2 * k));
    return a > b ? 1 : a < b ? -1 : 0;
  }

  /**
   * Tendências de um jogador: { golos, minutos, cartoes, presencas } com 1/-1/0 (null = sem dados).
   * Jogos: relatórios publicados (golos, cartões, minutos); sem relatórios, golos de matches.scorer_list.
   * Presenças: últimas 3 sessões vs as 3 anteriores. o.eDoJogador(idLocal) liga os ids dos relatórios ao jogador.
   */
  function tendenciasJogador(dados, jogador, o) {
    const opcoes = o || {};
    const id = String(jogador.idBD || jogador.id);
    const eDele = opcoes.eDoJogador || (idLocal => String(idLocal) === id || id.endsWith("-" + idLocal) || String(jogador.id) === String(idLocal));
    const t = { golos: null, minutos: null, cartoes: null, presencas: null };
    const relatorios = (dados.match_reports || []).filter(r => VFN.estadoRelatorio(r) === "published" && (r.match_data || {}).jogo)
      .map(r => ({ r, data: (r.match_data.preJogo || {}).data || r.match_date || "" })).filter(x => x.data)
      .sort((a, b) => String(b.data).localeCompare(String(a.data)));
    if (relatorios.length >= 2) {
      const porJogo = relatorios.map(({ r }) => {
        const jogo = r.match_data.jogo;
        const ev = (jogo.eventos || []).filter(e => e.equipa === "VFN" && eDele(e.jogadorId));
        const min = relatorioOficial(r, dados) ? Object.entries(minutosDoRelatorio(r.match_data)).filter(([idl]) => eDele(idl)).reduce((s, [, m]) => s + m, 0) : null; // amigável: fora dos minutos
        return { golos: ev.filter(e => e.tipo === "Golo").length, cartoes: ev.filter(e => /^Cartão/.test(e.tipo)).length, minutos: min };
      });
      ["golos", "cartoes"].forEach(k => { t[k] = comparar(porJogo.map(x => x[k])); });
      t.minutos = comparar(porJogo.map(x => x.minutos).filter(m => m !== null));
    } else {
      const jogos = VFN.jogosDoVFN(dados.matches).filter(j => VFN.estadoJogo(j) === "jogado" && Array.isArray(j.scorer_list))
        .sort((a, b) => (VFN.paraData(b.date) || 0) - (VFN.paraData(a.date) || 0));
      if (jogos.length >= 2) t.golos = comparar(jogos.map(j => j.scorer_list.filter(s => String(s.player_id) === id).reduce((s, x) => s + (Number(x.count) || 1), 0)));
    }
    if (dados.attendance) {
      const sessoes = dados.attendance.filter(a => String(a.player_id) === id && a.status)
        .sort((a, b) => String(b.session_date).localeCompare(String(a.session_date)));
      t.presencas = comparar(sessoes.map(a => a.status === "P" || a.status === "A" ? 1 : 0));
    }
    return t;
  }

  /** Badge discreto ↑ ↓ → (verde = melhor; nos cartões subir é pior). */
  function badgeTendencia(valor, piorQuandoSobe, rotulo) {
    if (valor === null || valor === undefined) return "";
    const seta = valor > 0 ? "↑" : valor < 0 ? "↓" : "→";
    const bom = valor === 0 ? "neutro" : (valor > 0) !== !!piorQuandoSobe ? "bom" : "mau";
    const texto = valor > 0 ? "a subir" : valor < 0 ? "a descer" : "estável";
    return `<span class="tendencia ${bom}" title="${esc(rotulo)}: ${texto} (últimos 3 jogos vs 3 anteriores)" aria-label="${esc(rotulo)} ${texto}">${seta}</span>`;
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

  /* ---------- Estatísticas iniciais do hub ---------- */

  /** Idade (anos completos) numa data. */
  function idade(nascimento, ref) {
    const n = VFN.paraData(nascimento);
    if (!n) return null;
    const r = ref || new Date();
    return r.getFullYear() - n.getFullYear() - (r < new Date(r.getFullYear(), n.getMonth(), n.getDate()) ? 1 : 0);
  }

  /** Maior vitória, maior derrota e sequência atual (ex.: 3 V) dos jogos do VFN. */
  function registosEpoca(dados) {
    const jogados = VFN.ultimosJogos(dados.matches, 999); // mais recente primeiro
    const comDif = jogados.map(j => { const g = VFN.golosJogo(j); return { j, g, dif: g.vfn - g.adv }; });
    const melhor = comDif.filter(x => x.dif > 0).sort((a, b) => b.dif - a.dif || b.g.vfn - a.g.vfn)[0] || null;
    const pior = comDif.filter(x => x.dif < 0).sort((a, b) => a.dif - b.dif || b.g.adv - a.g.adv)[0] || null;
    let seq = null;
    if (jogados.length) {
      const letra = VFN.letraResultado(jogados[0]);
      let n = 0;
      while (n < jogados.length && VFN.letraResultado(jogados[n]) === letra) n++;
      seq = { letra, n };
    }
    return { melhor, pior, seq };
  }

  /** Tiles: atletas, idade média (o.semIdadeMedia: sem ela), treinos por semana, lesionados e registos da época. */
  function estatisticasIniciaisHTML(dados, jogadores, o) {
    const lista = jogadores || [];
    const idades = lista.map(j => idade(j.info ? j.info.nascimento : j.nascimento)).filter(x => x !== null && x > 0);
    const media = idades.length ? (idades.reduce((s, x) => s + x, 0) / idades.length).toFixed(1).replace(".", ",") : "—";
    const desde = new Date(Date.now() - 30 * 86400000);
    const dias = new Set([...(dados.sessions || []).filter(s => s.session_type === "treino").map(s => s.session_date),
      ...(dados.attendance || []).filter(a => a.session_type === "treino").map(a => a.session_date)].filter(d => d && VFN.paraData(d) >= desde && VFN.paraData(d) <= new Date()));
    const porSemana = (dias.size / (30 / 7)).toFixed(1).replace(".", ",");
    const lesionados = lista.filter(j => j.disponibilidade === "lesionado");
    const { melhor, pior, seq } = registosEpoca(dados);
    const jogoTxt = x => x ? `${esc(VFN.jogoEmCasa(x.j) ? "vs " : "@ ")}${esc(nomeAdversario(dados, x.j))} · ${esc(VFN.dataCurta(x.j.date))}` : "";
    const tile = (rotulo, valor, detalhe, classe) => `<div class="summary-tile ${classe || ""}"><span>${rotulo}</span><strong>${valor}</strong>${detalhe ? `<small>${detalhe}</small>` : ""}</div>`;
    return `<div class="summary-tiles hub-inicio">
      ${tile("Atletas", lista.length, "no plantel")}
      ${o && o.semIdadeMedia ? "" : tile("Idade média", media, idades.length < lista.length ? `${idades.length} com data de nascimento` : "anos")}
      ${tile("Treinos por semana", porSemana, "últimos 30 dias")}
      ${tile("Lesionados", lesionados.length, lesionados.map(j => esc(j.nome)).join(", ") || "ninguém", lesionados.length ? "tile-pendente" : "tile-pago")}
      ${tile("Maior vitória", melhor ? `${melhor.g.vfn}–${melhor.g.adv}` : "—", jogoTxt(melhor), "tile-pago")}
      ${tile("Maior derrota", pior ? `${pior.g.vfn}–${pior.g.adv}` : "—", jogoTxt(pior), "tile-pendente")}
      ${tile("Sequência atual", seq ? `${seq.n} ${seq.letra}` : "—", !seq ? "" : seq.n === 1 ? { V: "vitória", E: "empate", D: "derrota" }[seq.letra] + " no último jogo" : { V: "vitórias seguidas", E: "empates seguidos", D: "derrotas seguidas" }[seq.letra], seq ? "seq-" + seq.letra : "")}
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
    // suspensões automáticas (AF Guarda): os suspensos passam para os indisponíveis
    const susp = new Map(jogadores.map(j => [j, calcularSuspensoes(j.id, dados)]));
    const risco = j => susp.get(j).suspenso;
    const convocaveis = ordenar(jogadores.filter(j => (!j.disponibilidade || j.disponibilidade === "disponivel" || j.disponibilidade === "em_duvida") && !risco(j)));
    const fora = ordenar(jogadores.filter(j => !convocaveis.includes(j)));
    const linha = (j, extra) => `<li data-jogador="${esc(j.id)}">${VFN.avatarJogador(j, "avatar-xs")}<span class="disp-nome">${esc(j.nome)}<small class="muted">${esc(j.posicao)}</small></span>${extra || ""}</li>`;
    const porCategoria = lista => ["GR", "Def", "Meio", "Ata"].map(c => [c, lista.filter(j => VFN.categoriaPosicao(j.posicao) === c).length]).filter(([, n]) => n).map(([c, n]) => `<span>${{ GR: "GR", Def: "Defesas", Meio: "Médios", Ata: "Avançados" }[c]} <b>${n}</b></span>`).join("");
    return `${jogo ? `<p class="disp-jogo">${VFN.icone("calendar-days", 16)} ${esc(VFN.jogoEmCasa(jogo) ? "VFN vs " + nomeAdversario(dados, jogo) : nomeAdversario(dados, jogo) + " vs VFN")} · ${esc(VFN.dataLonga(jogo.date, true))}</p>` : ""}
      <div class="disp-colunas">
        <section class="disp-coluna ok"><h3>${VFN.icone("circle-check", 18)} Convocáveis <b>${convocaveis.length}</b></h3><div class="disp-resumo">${porCategoria(convocaveis)}</div>
          <ul>${convocaveis.map(j => linha(j, (j.disponibilidade === "em_duvida" ? VFN.badgeDisponibilidade("em_duvida") : "") + badgeSuspensao(susp.get(j)))).join("") || "<li class=\"muted\">Nenhum jogador.</li>"}</ul></section>
        <section class="disp-coluna nao"><h3>${VFN.icone("circle-off", 18)} Indisponíveis <b>${fora.length}</b></h3>
          <ul>${fora.map(j => linha(j, risco(j) ? badgeSuspensao(susp.get(j)) : VFN.badgeDisponibilidade(j.disponibilidade))).join("") || "<li class=\"muted\">Todo o plantel disponível.</li>"}</ul></section>
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
    // jogos do VFN: o lado vem de "team" (golos do adversário: team = "adversario", mesmo sem team_id)
    const doLadoVFN = (lista, eVFN) => (Array.isArray(lista) ? lista : []).filter(s => VFN.eGoloAdversario(s) !== eVFN)
      .map(s => ({ nome: `${s.player_name || "?"}${s.minute != null ? ` ${s.minute}'` : ""}`, golos: Number(s.count) || 1 }));
    const vfn = VFN.jogosDoVFN(dados.matches).filter(j => j.competition === competicao && VFN.estadoJogo(j) !== "cancelado").map(j => {
      const { casa, fora } = VFN.equipasDoJogo(j, dados.teams);
      const jogado = VFN.estadoJogo(j) === "jogado";
      const emCasa = VFN.jogoEmCasa(j);
      return { origem: "vfn", id: j.id, jornada: numero(j.phase, j.jornada), fase: VFN.faseDoJogo(j.phase, j.jornada), vencedor: j.winner_id ? String(j.winner_id) : "", casa, fora, gc: jogado ? j.score_home : null, gf: jogado ? j.score_away : null, golosCasa: doLadoVFN(j.scorer_list, emCasa), golosFora: doLadoVFN(j.scorer_list, !emCasa), notas: j.notes || "", data: j.date };
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
        <span class="muted">${u.data ? esc(VFN.dataDDMMAAAA(u.data)) + " · " : ""}${u.jornada ? "J" + u.jornada + " · " : ""}${VFN.nomeCompeticaoHTML(u.competicao, true)}</span>
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
    golosExternos(dados).forEach(s => { if (s.player_id) golosPorJogador.set(String(s.player_id), (golosPorJogador.get(String(s.player_id)) || 0) + (Number(s.count) || 1)); });
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
        return `<li>${g ? VFN.chipForma(VFN.letraResultado(j)) : VFN.badgeEstado(j)}<span>${esc(VFN.dataDDMMAAAA(j.date))}</span><span class="muted">${VFN.nomeCompeticaoHTML(j.competition, true)}${j.jornada ? " · J" + esc(j.jornada) : ""} · ${VFN.jogoEmCasa(j) ? "Casa" : "Fora"}</span><strong>${g ? `VFN ${g.vfn}–${g.adv}` : esc(VFN.horaIso(j.date) !== "00:00" ? VFN.horaIso(j.date) : "")}</strong></li>`;
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
    let casa, fora, gc = null, gf = null, data = null, comp = "", local = "", relvado = "", jornada = null, eventos = [], relatorio = null, estado = "jogado";
    if (tipo === "vfn") {
      const j = (dados.matches || []).find(m => String(m.id) === id);
      if (!j) return vazio("Jogo não encontrado.");
      ({ casa, fora } = VFN.equipasDoJogo(j, dados.teams));
      estado = VFN.estadoJogo(j) || "agendado";
      if (estado === "jogado") { gc = j.score_home; gf = j.score_away; }
      relvado = VFN.estadioDoJogo(j, dados.teams).relvado;
      data = j.date; comp = j.competition; local = VFN.estadioDoJogo(j, dados.teams).nome || (VFN.jogoEmCasa(j) ? "Casa (VFN)" : `Fora · ${fora.nome === "ACD Vila Franca das Naves" ? casa.nome : fora.nome}`); jornada = VFN.etiquetaJornada(j, true);
      relatorio = relatorioDoJogo(dados, j.id);
      eventos = eventosDoRelatorio(relatorio, o.nomeJogador);
      // sem eventos no relatório, usa os golos lançados no jogo (matches.scorer_list: VFN e adversário)
      if (!eventos.length && Array.isArray(j.scorer_list)) {
        eventos = j.scorer_list.map(s => ({ minuto: s.minute != null ? Number(s.minute) : null, tipo: "Golo", texto: `${s.player_name || "?"}${Number(s.count) > 1 ? " ×" + s.count : ""}`, vfn: !VFN.eGoloAdversario(s) }))
          .sort((a, b) => (a.minuto == null ? 999 : a.minuto) - (b.minuto == null ? 999 : b.minuto));
      }
      // o lado VFN fica à esquerda/direita conforme casa/fora
      eventos.forEach(e => { e.lado = e.neutro ? "centro" : (e.vfn === VFN.jogoEmCasa(j)) ? "casa" : "fora"; });
      if (j.notes) eventos.push({ minuto: null, tipo: "Nota", texto: j.notes, lado: "centro" });
    } else {
      const r = (dados.league_results || []).find(x => String(x.id) === id);
      if (!r) return vazio("Jogo não encontrado.");
      ({ casa, fora } = VFN.equipasDoResultadoLiga(r, dados.teams));
      gc = r.score_home; gf = r.score_away; data = r.match_date; comp = r.competition; jornada = VFN.etiquetaJornada(r, true);
      // jogo entre outras equipas: estádio e relvado da equipa da casa
      const est = VFN.estadioDaEquipa(equipa(dados, r.home_team_id));
      local = est.nome; relvado = est.relvado;
      estado = gc != null && gf != null ? "jogado" : "agendado";
      eventos = (Array.isArray(r.scorer_list) ? r.scorer_list : []).map(s => ({ minuto: null, tipo: "Golo", texto: `${s.player_name}${Number(s.count) > 1 ? " ×" + s.count : ""}`, lado: String(s.team_id) === String(fora.id) ? "fora" : "casa" }));
      if (r.scorers) eventos.push({ minuto: null, tipo: "Nota", texto: r.scorers, lado: "centro" });
    }
    const temRes = gc != null && gf != null && gc !== "" && gf !== "";
    const lado = (eq) => `<div class="dj-equipa">${logoEquipa(equipa(dados, eq.id) || { id: eq.id, name: eq.nome }, eq.nome, "dj-logo")}<strong>${esc(eq.nome)}</strong></div>`;
    const linhaEvento = e => `<li class="dj-evento lado-${e.lado || "centro"} tipo-${esc(String(e.tipo).toLowerCase().replace(/[^a-z]+/g, "-"))}">
        <span class="dj-min">${e.minuto != null ? `${e.minuto}${e.acrescimo ? "+" + e.acrescimo : ""}'` : ""}</span>
        <span class="dj-ico" data-type="${esc(e.tipo)}">${VFN.iconeEvento(e.tipo, 20)}</span>
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
        ${local || relvado ? `<span class="dj-estadio">${VFN.icone("map-pin", 16)} ${esc(local || "Estádio por indicar")}<br>${VFN.badgeRelvado(relvado)}</span>` : ""}
      </div>
      ${tipo === "vfn" && estado === "jogado" ? resumoJogoHTML(dados, (dados.matches || []).find(m => String(m.id) === id), relatorio, o) : ""}
      <h4 class="perfil-subtitulo">Eventos</h4>
      ${eventos.length ? `<ol class="dj-timeline">${eventos.map(linhaEvento).join("")}</ol>` : vazio(estado === "jogado" ? (tipo === "vfn" ? "Sem eventos registados (ainda não há relatório deste jogo)." : "Sem marcadores registados.") : "O jogo ainda não se realizou.")}
      ${tipo === "vfn" && relatorio && VFN.estadoRelatorio(relatorio) === "published" && o.relatorioCompleto ? `<details class="rs-relatorio"><summary>${VFN.icone("file-text", 16)} Relatório completo <small class="muted">análise da equipa técnica</small></summary><div class="rs-relatorio-corpo" data-relatorio-completo="${esc(relatorio.id)}">${o.relatorioCompleto(relatorio)}</div></details>` : ""}
      ${relatorio && VFN.estadoRelatorio(relatorio) === "published" && o.verRelatorio && !o.relatorioCompleto ? `<div class="modal-actions"><button type="button" class="btn btn-ghost" data-ver-relatorio="${esc(relatorio.id)}">${VFN.icone("file-text", 16)} Ver Relatório</button></div>` : ""}`;
  }

  /*
   * Resumo do Jogo (jogos do VFN já jogados): marcadores, onze inicial no campo e estatísticas tiradas dos
   * eventos do relatório; sem relatório (ex.: página pública, que não lê relatórios) usa os marcadores do
   * calendário (matches.scorer_list). o.jogador(idLocal) → jogador do plantel (nome, número, foto).
   */
  function resumoJogoHTML(dados, jogo, relatorio, o) {
    if (!jogo) return "";
    const m = (relatorio && relatorio.match_data) || null;
    const ev = (m && m.jogo && m.jogo.eventos) || [];
    const jogadorDe = id => (o.jogador && o.jogador(id)) || { id, nome: (o.nomeJogador && o.nomeJogador(id)) || "—", numero: "" };
    const nome = e => e.equipa === "VFN" ? jogadorDe(e.jogadorId).nome : (e.detalhe || "Adversário");
    // marcadores: do relatório (minuto, jogador, tipo) ou do calendário
    let golos = ev.filter(e => e.tipo === "Golo" || e.tipo === "Auto-golo").sort((a, b) => (Number(a.minuto) || 0) - (Number(b.minuto) || 0))
      .map(e => ({ vfn: !VFN.eGoloSofrido(e), minuto: `${Number(e.minuto) || 0}${Number(e.acrescimo) > 0 ? "+" + Number(e.acrescimo) : ""}'`, texto: nome(e), tipo: e.tipo === "Auto-golo" ? "Auto-golo" : e.tipo_lance === "penalty" ? "Penálti" : "Golo" }));
    if (!golos.length && Array.isArray(jogo.scorer_list)) {
      golos = jogo.scorer_list.map(s => ({ vfn: !VFN.eGoloAdversario(s), minuto: s.minute != null ? s.minute + "'" : "", texto: `${s.player_name || "?"}${Number(s.count) > 1 ? " ×" + s.count : ""}`, tipo: "Golo" }));
    }
    const marcadores = golos.length ? `<ul class="rs-golos">${golos.map(g => `<li class="${g.vfn ? "vfn" : "adv"}"><span class="rs-min">${esc(g.minuto)}</span>${VFN.iconeEvento(g.tipo === "Auto-golo" ? "Auto-golo" : "Golo", 18)}<span>${esc(g.texto)}</span>${g.tipo !== "Golo" ? `<small class="rs-tipo">${esc(g.tipo)}</small>` : ""}<small class="rs-lado">${g.vfn ? "VFN" : "Adv."}</small></li>`).join("")}</ul>` : vazio("Sem golos registados.");
    // onze inicial nas posições da formação usada (só leitura)
    const formacao = m && m.jogo.formacaoVFN;
    const slots = (formacao && VFN.FORMACOES_SLOTS[formacao]) || [];
    const titulares = (m && m.jogo.titulares) || [];
    const onze = slots.length && titulares.some(Boolean) ? `<div class="mini-pitch rs-campo" role="img" aria-label="Onze inicial (${esc(formacao)})"><span class="mini-pitch-lines" aria-hidden="true"></span>${slots.map((slot, i) => {
      if (!titulares[i]) return "";
      const j = jogadorDe(titulares[i]);
      const capitao = String(titulares[i]) === String(m.jogo.capitaoId);
      return `<div class="pitch-player" style="left:${slot.x}%;top:${Math.round(8 + slot.y * 0.84)}%;width:20%"><span class="pitch-player-avatar">${VFN.avatarJogador(j, "avatar-sm")}${capitao ? VFN.badgeCapitao("no-campo") : ""}</span><span class="pitch-player-name"><span>${esc(j.nome)}</span><b>${esc(slot.label)}</b></span></div>`;
    }).join("")}</div>` : "";
    // estatísticas do jogo (contagens dos eventos do relatório)
    const conta = (tipo, vfn) => ev.filter(e => e.tipo === tipo && (vfn ? e.equipa === "VFN" : e.equipa === "Adversário")).length;
    const linhasStats = [["Golos", e => golos.filter(g => g.vfn === e).length], ["Cartões amarelos", e => conta("Cartão Amarelo", e)], ["Cartões vermelhos", e => conta("Cartão Vermelho", e)], ["Substituições", e => conta("Substituição", e)], ["Golos anulados", e => conta("Golo Anulado", e)], ["Penáltis falhados", e => conta("Penalty Falhado", e)]]
      .map(([r, f]) => [r, f(true), f(false)]).filter(([r, a, b]) => r === "Golos" || a || b);
    const casa = VFN.jogoEmCasa(jogo);
    const stats = ev.length ? `<table class="rs-stats"><thead><tr><th scope="col">${casa ? "VFN" : "Adv."}</th><th scope="col"></th><th scope="col">${casa ? "Adv." : "VFN"}</th></tr></thead><tbody>${linhasStats.map(([r, a, b]) => `<tr><td>${casa ? a : b}</td><th scope="row">${esc(r)}</th><td>${casa ? b : a}</td></tr>`).join("")}</tbody></table>` : "";
    return `<div class="rs-acoes"><button type="button" class="btn btn-accent btn-sm" data-partilhar-resultado="${esc(jogo.id)}">📸 Partilhar Resultado</button></div>
      <div class="rs-grelha">
        <section><h4 class="perfil-subtitulo">Marcadores</h4>${marcadores}${stats ? `<h4 class="perfil-subtitulo">Estatísticas do jogo</h4>${stats}` : ""}</section>
        ${onze ? `<section><h4 class="perfil-subtitulo">Onze inicial <small class="muted">${esc(formacao)}</small></h4>${onze}</section>` : ""}
      </div>`;
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
      modal.innerHTML = `<div class="modal-box modal-md detalhe-jogo resumo-jogo" role="dialog" aria-modal="true" aria-labelledby="resumoJogoTitulo"><div class="rs-topo"><button type="button" class="btn btn-ghost btn-sm" data-fechar-detalhe>← Voltar</button><h3 id="resumoJogoTitulo">Resumo do Jogo</h3></div><div id="detalheJogoCorpo"></div><div class="modal-actions"><button type="button" class="btn btn-accent" data-fechar-detalhe>Fechar</button></div></div>`;
      document.body.appendChild(modal);
      modal.addEventListener("click", e => {
        if (e.target === modal || e.target.closest("[data-fechar-detalhe]")) modal.hidden = true;
        const b = e.target.closest("[data-ver-relatorio]");
        if (b && o.verRelatorio) { modal.hidden = true; o.verRelatorio(b.dataset.verRelatorio); }
        const p = e.target.closest("[data-partilhar-resultado]");
        if (p && window.VFNComp && VFNComp.gerarImagemResultado) VFNComp.gerarImagemResultado(p.dataset.partilharResultado, obterDados(), o);
      });
      document.addEventListener("keydown", e => { if (e.key === "Escape") modal.hidden = true; });
    }
    document.addEventListener("click", e => {
      const alvo = e.target.closest("[data-jogo]");
      if (!alvo || e.target.closest("input, select, [data-equipa], [data-jogador], .row-actions") || alvo.closest("#modalDetalheJogo")) return;
      document.getElementById("detalheJogoCorpo").innerHTML = detalheJogoHTML(obterDados(), alvo.dataset.jogo, o);
      modal.querySelector(".resumo-jogo").classList.toggle("rs-vfn", alvo.dataset.jogo.startsWith("vfn:"));
      document.getElementById("resumoJogoTitulo").textContent = alvo.dataset.jogo.startsWith("vfn:") ? "Resumo do Jogo" : "Detalhe do jogo";
      if (o.aposAbrir) o.aposAbrir(document.getElementById("detalheJogoCorpo"));
      modal.hidden = false;
      modal.querySelector(".resumo-jogo").scrollTop = 0;
      modal.querySelector("[data-fechar-detalhe]").focus();
    });
  }

  /* ---------- Esqueletos enquanto os dados carregam ---------- */

  /**
   * Skeletons com a forma dos componentes (shimmer): "jogadores" (cards com foto e linhas),
   * "tabela" (classificação), "calendario" (grelha do mês), "resultados" (linhas de jogo);
   * "cards", "linhas", "jogos", "hero" ficam como blocos simples.
   */
  function esqueleto(tipo, n) {
    const osso = (classe, estilo) => `<span class="skeleton ${classe}"${estilo ? ` style="${estilo}"` : ""}></span>`;
    const repetir = (k, f) => Array.from({ length: k }, (_, i) => f(i)).join("");
    if (tipo === "jogadores") return repetir(n || 8, () => `<div class="sk-jogador" aria-hidden="true">${osso("sk-foto")}${osso("sk-linha", "width:70%")}${osso("sk-linha sk-fina", "width:40%")}</div>`);
    if (tipo === "tabela") return `<div class="sk-tabela" aria-hidden="true">${repetir(n || 8, i => `<div class="sk-tabela-linha">${osso("sk-pos")}${osso("sk-logo")}${osso("sk-linha", `width:${55 - (i % 3) * 8}%`)}${osso("sk-num")}${osso("sk-num")}${osso("sk-num")}</div>`)}</div>`;
    if (tipo === "calendario") return `<div class="sk-calendario" aria-hidden="true">${osso("sk-linha", "width:40%;margin:0 auto 10px;height:16px")}<div class="sk-cal-grelha">${repetir(35, () => osso("sk-cal-dia"))}</div></div>`;
    if (tipo === "resultados") return repetir(n || 5, () => `<div class="sk-resultado" aria-hidden="true">${osso("sk-chip")}${osso("sk-logo")}<span class="sk-col">${osso("sk-linha", "width:65%")}${osso("sk-linha sk-fina", "width:40%")}</span>${osso("sk-placar")}</div>`);
    const classe = { cards: "skeleton skeleton-card", linhas: "skeleton skeleton-row", jogos: "skeleton skeleton-match", hero: "skeleton skeleton-hero" }[tipo] || "skeleton skeleton-row";
    return Array.from({ length: n || 1 }, () => `<div class="${classe}" aria-hidden="true"></div>`).join("");
  }

/**
   * Mostra um skeleton num contentor enquanto os dados chegam (o render seguinte substitui-o).
   * Num <tbody> desenha linhas da tabela com o nº de colunas do cabeçalho.
   */
  function mostrarEsqueleto(alvo, tipo, n) {
    const e = typeof alvo === "string" ? document.getElementById(alvo) : alvo;
    if (!e) return;
    if (e.tagName === "TBODY") {
      const tabela = e.closest("table");
      const cols = (tabela && tabela.querySelectorAll("thead th").length) || 1;
      e.innerHTML = Array.from({ length: n || 5 }, (_, i) => `<tr class="sk-tr" aria-hidden="true"><td colspan="${cols}"><span class="skeleton sk-linha" style="width:${92 - (i % 3) * 12}%"></span></td></tr>`).join("");
      return;
    }
    e.innerHTML = esqueleto(tipo, n);
  }

  /* ---------- H2H: histórico de confrontos (tabela h2h, SQL em sql/h2h.sql) ---------- */

  const NOME_VFN_H2H = "VF Naves";
  const normalizarNome = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

  /** O nome da tabela h2h corresponde a algum dos nomes do adversário? (sem acentos/maiúsculas) */
  function mesmoAdversario(nomeH2H, nomes) {
    const n = normalizarNome(nomeH2H);
    return !!n && nomes.map(normalizarNome).filter(Boolean).some(x => x === n || (x.length > 4 && n.length > 4 && (x.includes(n) || n.includes(x))));
  }

  /**
   * Resumo H2H do VFN contra um adversário a partir das linhas da tabela h2h.
   * adversario: nome (ou lista de nomes possíveis, ex.: teams.name e full_name).
   * Devolve { adversario, jogos (data desc, com golosVFN/golosAdv/letra), V, E, D, GM, GS, pctVitorias, ultimo } ou null.
   */
  function resumoH2H(adversario, linhas) {
    const nomes = (Array.isArray(adversario) ? adversario : [adversario]).filter(Boolean);
    const jogos = (linhas || []).filter(l => {
      const vfnCasa = l.equipa_casa === NOME_VFN_H2H, vfnFora = l.equipa_fora === NOME_VFN_H2H;
      return (vfnCasa || vfnFora) && mesmoAdversario(vfnCasa ? l.equipa_fora : l.equipa_casa, nomes);
    }).map(l => {
      const casa = l.equipa_casa === NOME_VFN_H2H;
      const golosVFN = Number(casa ? l.golos_casa : l.golos_fora) || 0, golosAdv = Number(casa ? l.golos_fora : l.golos_casa) || 0;
      return { ...l, vfnCasa: casa, adversario: casa ? l.equipa_fora : l.equipa_casa, golosVFN, golosAdv, letra: golosVFN > golosAdv ? "V" : golosVFN === golosAdv ? "E" : "D" };
    }).sort((a, b) => String(b.data).localeCompare(String(a.data)));
    if (!jogos.length) return null;
    const conta = l => jogos.filter(j => j.letra === l).length;
    const r = { adversario: jogos[0].adversario, jogos, V: conta("V"), E: conta("E"), D: conta("D"), GM: jogos.reduce((s, j) => s + j.golosVFN, 0), GS: jogos.reduce((s, j) => s + j.golosAdv, 0), ultimo: jogos[0] };
    r.pctVitorias = Math.round(r.V / jogos.length * 100);
    return r;
  }

  /**
   * Busca os jogos VFN × adversário (equipa_casa ou equipa_fora = 'VF Naves') e calcula o resumo.
   * fonte: cliente Supabase (faz o pedido) ou as linhas já carregadas da tabela h2h.
   */
  async function carregarH2H(adversario, fonte) {
    let linhas = fonte;
    if (fonte && typeof fonte.from === "function") {
      const { data, error } = await fonte.from("h2h").select("*").or(`equipa_casa.eq.${NOME_VFN_H2H},equipa_fora.eq.${NOME_VFN_H2H}`);
      if (error) return null;
      linhas = data || [];
    }
    return resumoH2H(adversario, linhas);
  }

  /** "VFN 3-2 Casal Cinza" (ou "Casal Cinza 1-3 VFN" fora de casa). */
  const resultadoH2H = j => j.vfnCasa ? `VFN ${j.golosVFN}-${j.golosAdv} ${j.adversario}` : `${j.adversario} ${j.golosAdv}-${j.golosVFN} VFN`;
  const mesAnoH2H = data => { const d = VFN.paraData(data); return d ? `${VFN.MESES_CURTOS[d.getMonth()]} ${d.getFullYear()}` : ""; };

  /** Linha discreta para o bloco "Próximo adversário": histórico e último jogo. */
  function h2hMiniHTML(r) {
    if (!r) return "";
    return `<p class="h2h-mini"><span>Histórico: <b>${r.V}V · ${r.E}E · ${r.D}D</b></span><span>Última vez: ${esc(resultadoH2H(r.ultimo))} (${esc(mesAnoH2H(r.ultimo.data))})</span></p>`;
  }

  /** Vista completa: resumo e lista de jogos (data desc). */
  function h2hHTML(r) {
    if (!r) return vazio("Sem jogos registados contra este adversário.");
    const tile = (rotulo, valor, classe) => `<div class="summary-tile ${classe || ""}"><span>${rotulo}</span><strong>${valor}</strong></div>`;
    return `<div class="summary-tiles h2h-tiles">
        ${tile("Jogos", r.jogos.length)}${tile("Vitórias", r.V, "h2h-v")}${tile("Empates", r.E, "h2h-e")}${tile("Derrotas", r.D, "h2h-d")}
        ${tile("Golos", `${r.GM}–${r.GS}`)}${tile("% vitórias", r.pctVitorias + "%")}
      </div>
      <ol class="h2h-lista">${r.jogos.map(j => `<li class="h2h-${j.letra}">
        <span class="h2h-letra">${j.letra}</span>
        <span class="h2h-data">${esc(VFN.dataDDMMAAAA(j.data))}</span>
        <strong class="h2h-res">${esc(resultadoH2H(j))}</strong>
        <small class="h2h-comp">${esc(j.competicao || "")}${j.jornada ? " · " + esc(j.jornada) : ""} · ${j.local === "casa" ? "Casa" : j.local === "fora" ? "Fora" : "Neutro"}</small>
      </li>`).join("")}</ol>`;
  }

  /* ---------- Suspensões automáticas (AF Guarda) ---------- */

  // amarelos que dão 1 jogo de suspensão: 5.º, 9.º, 12.º, 14.º e depois a cada 2 (16.º, 18.º...)
  const LIMITES_AMARELOS = [5, 9, 12, 14];
  const eLimiteAmarelos = n => LIMITES_AMARELOS.includes(n) || (n > 14 && (n - 14) % 2 === 0);
  function proximoLimiteAmarelos(n) {
    let k = (Number(n) || 0) + 1;
    while (!eLimiteAmarelos(k)) k++;
    return k;
  }

  /**
   * Suspensões de um jogador na época, só em jogos oficiais (VFN.competicaoOficial: sem amigáveis):
   * percorre os jogos por ordem; em cada jogo cumpre primeiro um jogo de castigo pendente e depois
   * soma os cartões desse jogo (amarelos: 1 jogo ao 5.º, 9.º, 12.º, 14.º e a cada 2 depois do 14.º;
   * vermelho: suspensao_jogos do evento, por omissão 1). O castigo é cumprido nos jogos oficiais
   * seguintes do VFN. Fonte: relatórios gerados/publicados (um por jogo) e jogos jogados do calendário.
   * Devolve { amarelos, vermelhos, suspenso, proximoLimite, jogosSuspensao } (jogosSuspensao = por cumprir).
   * o.eDele(idLocal): liga os ids dos relatórios ao jogador (por omissão, o mesmo id).
   */
  function calcularSuspensoes(playerId, dados, o) {
    const id = String(playerId);
    const eDele = (o && o.eDele) || (idLocal => String(idLocal) === id || id.endsWith("-" + idLocal));
    const jogos = new Map();
    VFN.jogosDoVFN((dados && dados.matches) || []).filter(j => VFN.estadoJogo(j) === "jogado" && VFN.competicaoOficial(j.competition))
      .forEach(j => jogos.set(String(j.id), { data: j.date, relatorio: null }));
    ((dados && dados.match_reports) || []).forEach(r => {
      const m = r && r.match_data;
      if (!m || !m.jogo || !(VFN.estadoRelatorio(r) === "published" || m.jogo.presencasAplicadas) || !relatorioOficial(r, dados)) return;
      const chave = String(r.match_id || (m.preJogo || {}).matchId || "r:" + r.id);
      const atual = jogos.get(chave) || { data: (m.preJogo || {}).data || r.match_date || "", relatorio: null };
      if (!atual.relatorio || String(r.updated_at || "") > String(atual.relatorio.updated_at || "")) atual.relatorio = r;
      jogos.set(chave, atual);
    });
    let amarelos = 0, vermelhos = 0, pendente = 0;
    [...jogos.values()].sort((a, b) => (VFN.paraData(a.data) || 0) - (VFN.paraData(b.data) || 0)).forEach(j => {
      if (pendente > 0) pendente--; // cumpre um jogo de castigo neste jogo
      const eventos = j.relatorio ? (j.relatorio.match_data.jogo.eventos || []) : [];
      eventos.filter(e => e.equipa === "VFN" && eDele(e.jogadorId)).sort((a, b) => (Number(a.minuto) || 0) - (Number(b.minuto) || 0)).forEach(e => {
        if (e.tipo === "Cartão Amarelo") { amarelos++; if (eLimiteAmarelos(amarelos)) pendente++; }
        else if (e.tipo === "Cartão Vermelho") { vermelhos++; pendente += Math.max(1, Number(e.suspensao_jogos) || 1); }
      });
    });
    return { amarelos, vermelhos, suspenso: pendente > 0, proximoLimite: proximoLimiteAmarelos(amarelos), jogosSuspensao: pendente };
  }

  /** Aviso preventivo: a um amarelo do próximo limite (e não suspenso). */
  const emRiscoAmarelos = s => !!s && !s.suspenso && s.amarelos > 0 && s.amarelos >= s.proximoLimite - 1;

  /** Badge "SUSPENSO" ou "⚠️ N amarelos" ("" se nenhum). */
  function badgeSuspensao(s) {
    if (!s) return "";
    if (s.suspenso) return `<span class="susp-badge suspenso" title="${s.jogosSuspensao} jogo${s.jogosSuspensao === 1 ? "" : "s"} de suspensão por cumprir">SUSPENSO${s.jogosSuspensao > 1 ? " · " + s.jogosSuspensao + " jogos" : ""}</span>`;
    if (emRiscoAmarelos(s)) return `<span class="susp-badge risco" title="Ao ${s.proximoLimite}.º amarelo cumpre 1 jogo de suspensão">⚠️ ${s.amarelos} amarelos</span>`;
    return "";
  }

  /* ---------- Mapa de calor das zonas dos golos ---------- */

  const LINHAS_HEATMAP = '<g class="hm-linhas" pointer-events="none"><rect x="50" y="0" width="200" height="72"/><rect x="105" y="0" width="90" height="24"/><path d="M122 72 Q150 92 178 72"/><circle cx="150" cy="48" r="1.6"/><path d="M0 150 L0 0 L300 0 L300 150"/><rect class="hm-baliza" x="132" y="-8" width="36" height="8"/></g>';

  /**
   * Mapa de calor das zonas dos golos (campo de frente, cor do clube #043792 com opacidade proporcional
   * ao nº de golos e o número em cada zona). matchReports: relatórios (só os publicados contam, um por jogo)
   * ou linhas já com { tipo, equipa, zona_golo } (view golos_zonas da página pública).
   * filtro: "marcados" | "sofridos" | "ambos".
   */
  function renderHeatmapGolos(matchReports, filtro) {
    const f = filtro || "ambos";
    const golos = [];
    const porJogo = new Map();
    (matchReports || []).forEach(r => {
      if (r && r.zona_golo !== undefined && r.tipo) { golos.push(r); return; } // linha da view pública
      if (!r || VFN.estadoRelatorio(r) !== "published" || !(r.match_data || {}).jogo) return;
      const chave = String(r.match_id || (r.match_data.preJogo || {}).matchId || r.id);
      const atual = porJogo.get(chave);
      if (!atual || String(r.updated_at || "") > String(atual.updated_at || "")) porJogo.set(chave, r);
    });
    porJogo.forEach(r => (r.match_data.jogo.eventos || []).forEach(e => golos.push(e)));
    const contagem = {};
    let total = 0, semZona = 0;
    golos.filter(e => e.tipo === "Golo" || e.tipo === "Auto-golo").forEach(e => {
      const sofrido = VFN.eGoloSofrido(e);
      if ((f === "marcados" && sofrido) || (f === "sofridos" && !sofrido)) return;
      total++;
      if (!e.zona_golo) { semZona++; return; }
      contagem[e.zona_golo] = (contagem[e.zona_golo] || 0) + 1;
    });
    const max = Math.max(1, ...Object.values(contagem));
    const titulo = { marcados: "golos marcados", sofridos: "golos sofridos", ambos: "golos" }[f] || "golos";
    if (!total) return vazio(`Ainda não há ${titulo} registados nos relatórios.`);
    const zonas = VFN.ZONAS_GOLO.map(z => {
      const n = contagem[z.id] || 0;
      const opacidade = n ? (0.18 + 0.72 * n / max).toFixed(2) : 0.04;
      return `<polygon class="hm-zona" points="${z.pts}" fill="#043792" fill-opacity="${opacidade}"><title>${esc(z.nome)}: ${n} golo${n === 1 ? "" : "s"}</title></polygon>` +
        (n ? `<text class="hm-num${n / max > 0.5 ? " claro" : ""}" x="${z.tx}" y="${z.ty}">${n}</text>` : "");
    }).join("");
    return `<figure class="heatmap-golos">
      <svg viewBox="0 -10 300 160" role="img" aria-label="Mapa das zonas dos ${titulo}: ${VFN.ZONAS_GOLO.filter(z => contagem[z.id]).map(z => `${z.nome} ${contagem[z.id]}`).join(", ") || "sem zonas"}">${zonas}${LINHAS_HEATMAP}</svg>
      <figcaption>${total} ${titulo}${semZona ? ` · ${semZona} sem zona registada` : ""}</figcaption>
    </figure>`;
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
    competicoesComClassificacao, competicaoPreferida, opcoesCompeticaoHTML, classificacaoHTML, formaNaCompeticao, ZONAS_TABELA, legendaZonasHTML,
    marcadores, marcadoresHTML, filtrosPosicaoHTML, plantelHTML,
    filtrosCalendarioHTML, calendarioHTML, calendarioDivididoHTML, alternarOrdemCalendario, competicaoAtiva, esqueleto, mostrarEsqueleto, renderHeatmapGolos, carregarH2H, resumoH2H, h2hMiniHTML, h2hHTML, calcularSuspensoes, proximoLimiteAmarelos, emRiscoAmarelos, badgeSuspensao,
    jogosDaJornada, jornadasDisponiveis, classificacaoJornadasHTML, marcadoresVFNCompeticaoHTML, equipasDasJornadas, jornadasHTML, jogosDaEquipa, formaEquipaHTML, marcadoresCampeonato, marcadoresCampeonatoHTML, chipsForma, cardsEquipasHTML, perfilEquipaHTML, relatorioDoJogo, eventosDoRelatorio, detalheJogoHTML, ligarDetalheJogo, formaAteJogo, bracketHTML, confrontosPorFase, vencedorConfronto, posicoesPorJornada, graficoPosicao, posicaoNoCampo, lugaresDoOnze, capitaoAtivo, mapaPosicoesHTML, fichaVisualHTML, anelHTML, jogosDisputados, opcoesFicha, minutosListaHTML, onzeCampoHTML, minutosDoRelatorio, periodosDoRelatorio, estatisticasGR, calcularStatsGR, competicaoDoRelatorio, relatorioOficial, estatisticasPorJogo, tendenciasJogador, badgeTendencia, onzeMaisUtilizado, presencasPorJogador, rankingPresencasHTML, desempenhoPorCompeticaoHTML, disponibilidadeHTML, estatisticasIniciaisHTML, registosEpoca
  };
})();
