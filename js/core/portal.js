"use strict";

/* =========================================================
   PORTAL (V2.0) — vistas partilhadas pelo dashboard e pela Área do Jogador
   Visão Geral (linha de tempo, último/próximo jogo, classificação, agenda e 2 semanas), cards dos
   relatórios, grelha dos adversários e o índice da pesquisa global (js/core/nav.js).
   ========================================================= */

(function () {
  const esc = s => VFN.escapeHtml(s);
  const H = () => window.VFNHub;

  /* ---------- Visão Geral ---------- */

  /**
   * Liga a Visão Geral a um contentor. o: { obterDados(), calendario: opções do VFNComp.criarCalendarioSemanas
   * (perfil, semPresencas, nomeRelatorio, nomePresenca) }. Devolve { render, esqueleto }.
   */
  function criarVisaoGeral(contentor, o) {
    let competicao = "";
    let semanas = null;
    contentor.innerHTML = `<div class="portal-grid">
        <article class="card portal-linha" data-aos="fade-up">
          <h2 class="hub-card-title">Linha de tempo da época <small class="muted">toca num jogo para ver o detalhe</small></h2>
          <div data-parte="linha"></div>
        </article>
        <article class="card hub-hero portal-ultimo" data-aos="fade-up" data-parte="ultimo"></article>
        <article class="card jds-card portal-proximo" data-aos="fade-up" data-parte="proximo"></article>
        <article class="card card-classificacao portal-classificacao" data-aos="fade-up">
          <div class="hub-card-head"><h2 class="hub-card-title">Classificação</h2><label class="sr-only" for="portalCompeticao">Competição</label><select id="portalCompeticao" class="compact-select"></select></div>
          <div data-parte="classificacao"></div>
        </article>
        <div class="portal-coluna">
          <article class="card portal-agenda" data-aos="fade-up"><h2 class="hub-card-title">Agenda <small class="muted">próximos 5 jogos</small></h2><div data-parte="agenda"></div></article>
          <article class="card portal-semanas" data-aos="fade-up"><h2 class="hub-card-title">Próximas 2 semanas <small class="muted">toca num dia</small></h2><div data-parte="semanas"></div></article>
        </div>
      </div>`;
    const parte = nome => contentor.querySelector(`[data-parte="${nome}"]`);
    const seletor = contentor.querySelector("#portalCompeticao");

    const renderClassificacao = dados => {
      parte("classificacao").innerHTML = H().classificacaoHTML(dados, competicao);
      VFN.anim.linhas(parte("classificacao").querySelectorAll("tbody tr"));
    };
    seletor.addEventListener("change", () => { competicao = seletor.value; renderClassificacao(o.obterDados()); });

    function render() {
      const dados = o.obterDados();
      parte("linha").innerHTML = H().linhaTempoEpocaHTML(dados);
      requestAnimationFrame(() => H().centrarLinhaTempo(parte("linha")));

      const ultimo = VFN.ultimosJogos(dados.matches, 1)[0];
      parte("ultimo").innerHTML = H().ultimoResultadoHTML(dados)
        + (ultimo ? `<div class="portal-ultimo-acoes"><button type="button" class="btn btn-ghost btn-sm" data-jogo="vfn:${esc(ultimo.id)}">${VFN.icone("eye", 16)} Ver detalhe do jogo</button></div>` : "");

      // Jogo da Semana: só redesenha quando o próximo jogo muda (a contagem e a meteorologia continuam)
      const jogo = VFN.proximoJogo(dados.matches);
      const chave = jogo ? `${jogo.id}|${jogo.date}|${jogo.opponent_team_id}` : "-";
      const proximo = parte("proximo");
      if (proximo.dataset.chave !== chave) {
        proximo.dataset.chave = chave;
        proximo.innerHTML = VFNComp.renderJogoDaSemana(dados);
        VFNComp.ligarJogoDaSemana(proximo, dados);
      }

      if (!competicao || !H().competicoesComClassificacao(dados).includes(competicao)) competicao = H().competicaoPreferida(dados);
      seletor.innerHTML = H().opcoesCompeticaoHTML(dados, competicao);
      seletor.hidden = !competicao;
      renderClassificacao(dados);

      parte("agenda").innerHTML = H().proximosJogosHTML(dados, 5);
      if (!semanas) semanas = VFNComp.criarCalendarioSemanas(parte("semanas"), Object.assign({ obterDados: o.obterDados }, o.calendario || {}));
      else semanas.render();
    }

    function esqueleto() {
      parte("linha").innerHTML = H().esqueleto("linhas", 1);
      parte("ultimo").innerHTML = H().esqueleto("hero");
      parte("proximo").innerHTML = H().esqueleto("hero");
      parte("classificacao").innerHTML = H().esqueleto("tabela", 8);
      parte("agenda").innerHTML = H().esqueleto("resultados", 5);
      parte("semanas").innerHTML = H().esqueleto("calendario");
    }

    return { render, esqueleto };
  }

  /* ---------- Relatórios (cards) ---------- */

  /** Golos do VFN, amarelos e vermelhos de um relatório (d = VFNRelatorio.extrair). */
  function resumoEventosHTML(d) {
    const am = (d.amarelos || []).length, vm = (d.vermelhos || []).length;
    const rotulo = `${d.golosVFN} golo${d.golosVFN === 1 ? "" : "s"} do VFN, ${am} amarelo${am === 1 ? "" : "s"}${vm ? `, ${vm} vermelho${vm === 1 ? "" : "s"}` : ""}`;
    return `<span class="rel-card-ev" title="${esc(rotulo)}" aria-label="${esc(rotulo)}"><span aria-hidden="true">⚽ ${d.golosVFN}</span><span aria-hidden="true">🟨 ${am}</span>${vm ? `<span aria-hidden="true">🟥 ${vm}</span>` : ""}</span>`;
  }

  /**
   * Estado em duas partes, separadas: a ficha (eventos, onze) e a análise. Rascunho (amarelo) só no admin;
   * ficha publicada = Ficha azul + Análise por publicar; publicado = Ficha + Análise a verde.
   */
  function estadoHTML(r) {
    const estado = VFN.estadoRelatorio(r);
    if (estado === "draft") return `<span class="rel-card-estado">${VFN.badgeEstadoRelatorio("draft")}</span>`;
    const analise = estado === "published";
    return `<span class="rel-card-estado"><span class="rel-tag ficha" title="Ficha do jogo publicada">✓ Ficha</span><span class="rel-tag ${analise ? "analise" : "sem"}" title="${analise ? "Análise publicada" : "Análise não publicada"}">${analise ? "✓" : "—"} Análise</span></span>`;
  }

  /** Lista de relatórios em cards (header fino na cor da competição). itens: [{ r, d }]; o: { ativo: id aberto } */
  function relatoriosCardsHTML(itens, o) {
    const ativo = String((o || {}).ativo || "");
    return `<div class="rel-cards">${itens.map(({ r, d }) => {
      const v = d.golosVFN > d.golosAdv ? "V" : d.golosVFN < d.golosAdv ? "D" : "E";
      const comp = d.competicao || "";
      const logo = comp ? VFN.logoSponsorHTML(comp) : "";
      const nomeComp = VFN.nomeCurtoCompeticao(comp) || "Jogo";
      const marcador = d.casa ? `VFN ${d.golosVFN}–${d.golosAdv} ${esc(d.adversario)}` : `${esc(d.adversario)} ${d.golosAdv}–${d.golosVFN} VFN`;
      return `<button type="button" class="rel-card comp-${VFN.categoriaCompeticao(comp)}${ativo === String(r.id) ? " active" : ""}" data-relatorio="${esc(r.id)}">
        <span class="rel-card-cab"><span class="rel-card-comp${logo ? "" : " sem-logo"}" title="${esc(comp || nomeComp)}">${logo}<span class="rel-card-comp-nome">${esc(nomeComp)}</span></span><span class="rel-card-data">${esc(VFN.dataDDMMAAAA(d.data) || "")}</span></span>
        <span class="rel-card-jogo"><span class="form-chip form-${v}">${v}</span><strong>${marcador}</strong></span>
        <span class="rel-card-rodape">${resumoEventosHTML(d)}${estadoHTML(r)}</span>
      </button>`;
    }).join("")}</div>`;
  }

  /* ---------- Adversários ---------- */

  /** Grelha dos adversários: logo, nome, cidade e confrontos (H2H); o do próximo jogo primeiro. data-equipa abre a ficha. */
  function adversariosHTML(dados, termo) {
    const t = String(termo || "").toLocaleLowerCase("pt-PT");
    const proximo = VFN.proximoJogo(dados.matches);
    const lista = (dados.teams || []).filter(x => !VFN.eVFN(x.name))
      .filter(x => !t || [x.name, x.full_name, x.city].some(v => String(v || "").toLocaleLowerCase("pt-PT").includes(t)))
      .map(x => ({ x, r: H().resumoH2H([x.name, x.full_name].filter(Boolean), dados.h2h), eProximo: !!proximo && String(proximo.opponent_team_id) === String(x.id) }))
      .sort((a, b) => b.eProximo - a.eProximo || ((b.r ? b.r.jogos.length : 0) - (a.r ? a.r.jogos.length : 0)) || a.x.name.localeCompare(b.x.name, "pt"));
    if (!lista.length) return H().vazio("Sem equipas.");
    return `<div class="adv-grid">${lista.map(({ x, r, eProximo }) => `<button type="button" class="adv-card${eProximo ? " proximo" : ""}" data-equipa="${esc(x.id)}">
        ${H().logoEquipa(x, x.name, "adv-logo")}
        <span class="adv-nome"><strong>${esc(x.name)}</strong><small>${esc([x.city, x.division].filter(Boolean).join(" · ") || "—")}</small></span>
        <span class="adv-h2h">${eProximo ? '<span class="adv-tag">Próximo jogo</span>' : ""}${r ? `<span class="adv-h2h-n"><b>${r.jogos.length}</b> jogo${r.jogos.length === 1 ? "" : "s"}</span><span class="adv-h2h-reg"><b class="v">${r.V}V</b> <b class="e">${r.E}E</b> <b class="d">${r.D}D</b></span><span class="form-row form-row-sm">${r.jogos.slice(0, 5).map(j => VFN.chipForma(j.letra)).join("")}</span>` : '<span class="muted">Sem confrontos</span>'}</span>
      </button>`).join("")}</div>`;
  }

  /* ---------- Pesquisa global (fonte para o VFNNav) ---------- */

  const normalizar = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  /**
   * Itens pesquisáveis: jogadores, jogos do VFN (adversário + data) e eventos dos relatórios visíveis (golos e cartões).
   * o: { dados, jogadores, relatorios: [{ r, d }], abrirJogador(id), abrirRelatorio(id) }
   */
  function indicePesquisa(o) {
    const dados = o.dados;
    const itens = [];
    (o.jogadores || []).forEach(j => itens.push({
      tipo: "Jogadores", titulo: j.nome, sub: [j.posicao, j.numero !== "" && j.numero != null ? "Nº " + j.numero : ""].filter(Boolean).join(" · "),
      icone: VFN.avatarJogador(j, "avatar-xs"), texto: normalizar(`${j.nome} ${j.posicao || ""} ${j.numero || ""}`),
      acao: () => o.abrirJogador(j.id)
    }));
    VFN.jogosDoVFN(dados.matches || []).filter(j => VFN.estadoJogo(j) !== "cancelado")
      .sort((a, b) => (VFN.paraData(b.date) || 0) - (VFN.paraData(a.date) || 0)).forEach(j => {
        const nome = H().nomeAdversario(dados, j);
        const t = H().equipa(dados, j.opponent_team_id) || {};
        const g = VFN.estadoJogo(j) === "jogado" && VFN.golosJogo(j);
        const dataTxt = VFN.dataDDMMAAAA(VFN.dataIso(j.date));
        const d = VFN.paraData(j.date);
        itens.push({
          tipo: "Jogos", titulo: `${VFN.jogoEmCasa(j) ? "VFN vs " + nome : nome + " vs VFN"}${g ? ` · ${g.vfn}–${g.adv}` : ""}`,
          sub: `${dataTxt} · ${VFN.nomeCurtoCompeticao(j.competition)}`,
          icone: H().logoEquipa(t, nome), texto: normalizar(`${nome} ${t.full_name || ""} ${dataTxt} ${VFN.dataCurta(j.date)} ${d ? VFN.MESES_LONGOS[d.getMonth()] : ""} ${j.competition || ""} ${VFN.jogoEmCasa(j) ? "casa" : "fora"}`),
          acao: () => H().abrirDetalheJogo("vfn:" + j.id)
        });
      });
    (o.relatorios || []).forEach(({ r, d }) => {
      const jogo = `${d.casa ? "VFN" : d.adversario} ${d.casa ? d.golosVFN : d.golosAdv}–${d.casa ? d.golosAdv : d.golosVFN} ${d.casa ? d.adversario : "VFN"} · ${VFN.dataDDMMAAAA(d.data) || ""}`;
      const evento = (tipo, icone, nome, min) => itens.push({
        tipo: "Eventos", titulo: `${icone} ${tipo} — ${nome}${min ? ` ${min}` : ""}`, sub: jogo, icone: "",
        texto: normalizar(`${tipo} ${nome} ${d.adversario} ${VFN.dataDDMMAAAA(d.data) || ""}`), acao: () => o.abrirRelatorio(r.id)
      });
      (d.golos || []).filter(x => x.vfn).forEach(x => evento("Golo", "⚽", x.texto, x.min));
      (d.amarelos || []).forEach(x => evento("Amarelo", "🟨", x.nome, x.min));
      (d.vermelhos || []).forEach(x => evento("Vermelho", "🟥", x.nome, x.min));
    });
    return itens;
  }

  /** Itens que têm todas as palavras do termo (sem acentos), no máximo n por tipo. */
  function filtrarPesquisa(itens, termo, n) {
    const palavras = normalizar(termo).split(/\s+/).filter(Boolean);
    if (!palavras.length) return [];
    const porTipo = {};
    return itens.filter(i => palavras.every(p => i.texto.includes(p))).filter(i => { porTipo[i.tipo] = (porTipo[i.tipo] || 0) + 1; return porTipo[i.tipo] <= (n || 5); });
  }

  window.VFNPortal = { criarVisaoGeral, relatoriosCardsHTML, adversariosHTML, indicePesquisa, filtrarPesquisa, normalizar };
})();
