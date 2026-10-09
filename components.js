/* =========================================================
   VFN — Componentes reutilizáveis (admin, dashboard e página pública)
   Só apresentação: recebem os dados já carregados e devolvem HTML
   ou ligam eventos. Expostos em window.VFNComp.
   Depende de shared.js (VFN: formatos, datas, regras) e hub.js (VFNHub:
   cálculos sobre os dados, ex. confrontosPorFase, relatorioDoJogo).
   As consultas ao Supabase ficam nos ficheiros de cada página.

   renderMatchCard(dados, jogo, { proximo })      cartão de jogo
   renderPlayerCard(jogador, { capitao, ... })    cartão de jogador
   renderCalendarDay(data, eventos, opcoes)       célula do calendário
   renderAttendanceDrawer({ jogador, sessoes })   histórico de presenças
   renderMatchEvents(relatorio, nomeJogador)      timeline de eventos
   renderBracket(dados, competicao, fase?)        bracket da taça
   renderDebtReport(multas, { pessoa })           relatório de dívidas
   ========================================================= */
(function () {
  "use strict";

  const esc = VFN.escapeHtml;
  const H = () => window.VFNHub;

  /* ---------- Cartões ---------- */

  /** Cartão de um jogo do VFN (calendário e listas). o: { proximo: jogo seguinte, para o destacar } */
  function renderMatchCard(dados, j, o) {
    const opcoes = o || {};
    const d = VFN.paraData(j.date);
    const nome = H().nomeAdversario(dados, j);
    const g = VFN.golosJogo(j);
    const estado = VFN.estadoJogo(j) || "agendado";
    const hora = VFN.horaIso(j.date);
    const eProximo = opcoes.proximo && opcoes.proximo.id === j.id;
    const forma = estado === "jogado" && g ? H().formaAteJogo(dados, j, 5) : [];
    return `<article class="match-item state-${esc(estado)}${estado === "jogado" ? " result-" + VFN.letraResultado(j) : ""}${eProximo ? " is-next" : ""}"${estado === "jogado" && g ? ` data-jogo="vfn:${esc(j.id)}" title="Ver o resumo do jogo"` : ""}>
        <div class="match-date"><strong>${d ? d.getDate() : "—"}</strong><span>${d ? VFN.MESES_CURTOS[d.getMonth()] : ""}</span></div>
        <div class="match-main">
          <div class="match-line">${H().tagCompeticao(j.competition)}${VFN.etiquetaJornada(j, true) ? `<small>${esc(VFN.etiquetaJornada(j, true))}</small>` : ""}<small>${VFN.jogoEmCasa(j) ? "Casa" : "Fora"}</small>${eProximo ? '<small class="next-flag">Próximo</small>' : ""}</div>
          <div class="match-opponent">${H().logoEquipa(H().equipa(dados, j.opponent_team_id), nome)}<strong>${esc(nome)}</strong></div>
          ${forma.length ? `<div class="form-row form-row-sm match-forma" title="Forma nos ${forma.length} jogos até este (mais recente à esquerda)">${forma.map(x => VFN.chipForma(VFN.letraResultado(x))).join("")}</div>` : ""}
        </div>
        <div class="match-side">${estado === "jogado" && g ? `<button type="button" class="result-score" data-jogo="vfn:${esc(j.id)}" title="Ver detalhe do jogo">${g.vfn}–${g.adv}</button>` : `<span class="match-time">${hora && hora !== "00:00" ? esc(hora) : ""}</span>`}${VFN.badgeEstado(j)}</div>
      </article>`;
  }

  /** Cartão de um jogador do plantel. o: { capitao: true para o badge C, disponibilidade: mostrar o estado } */
  function renderPlayerCard(j, o) {
    const opcoes = o || {};
    const cartao = `<button type="button" class="player-card" data-id="${esc(j.id)}">
      ${VFN.avatarJogador(j)}${opcoes.capitao ? VFN.badgeCapitao("no-card") : ""}
      <span class="player-card-number">${j.numero !== "" ? "#" + esc(j.numero) : ""}</span>
      <strong>${esc(j.nome)}</strong>
      <small>${esc(j.posicao)}</small>
      ${opcoes.disponibilidade && j.disponibilidade ? VFN.badgeDisponibilidade(j.disponibilidade) : ""}
    </button>`;
    // com comparação: o botão "Comparar" fica ao lado do cartão (não pode ir dentro de outro botão)
    return opcoes.comparar ? `<div class="cmp-item">${cartao}<button type="button" class="btn-comparar" data-comparar="${esc(j.id)}" aria-label="Comparar ${esc(j.nome)} com outro jogador">⚖ Comparar</button></div>` : cartao;
  }

  /** Bracket de uma taça por eliminatórias (fases em colunas). Com `fase`, mostra só essa fase. */
  function renderBracket(dados, competicao, fase) {
    const fases = H().confrontosPorFase(dados, competicao).filter(f => !fase || f.fase === fase);
    if (!fases.some(f => f.jogos.length)) return H().vazio("Ainda não há jogos desta taça.");
    const colunas = fases.map(f => {
      const html = f.jogos.map(j => {
        const temRes = j.gc != null && j.gf != null && j.gc !== "" && j.gf !== "";
        // fundo suave com a cor principal da equipa (teams.color_primary)
        const linha = (eq, golos) => `<div data-eq="${esc(eq.id)}" class="br-equipa${j.vencedor ? (j.vencedor === eq.id ? " vence" : " sai") : ""}${VFN.eVFN(eq.nome) ? " is-vfn" : ""}${VFN.coresEquipa(H().equipa(dados, eq.id)).primaria ? " com-cor" : ""}"${VFN.estiloCorEquipa(H().equipa(dados, eq.id), 0.14)}>
          ${H().logoEquipa(H().equipa(dados, eq.id), eq.nome, "br-logo")}<span class="br-nome">${esc(eq.nome)}</span>${j.veioDaFaseAnterior.has(eq.id) ? `<span class="br-veio" title="Passou a fase anterior">${VFN.icone("chevrons-right", 12)}</span>` : ""}
          <strong class="br-golos">${temRes ? Number(golos) : ""}</strong></div>`;
        return `<button type="button" class="br-jogo"${j.vencedor ? ` data-vencedor="${esc(j.vencedor)}" data-vencedor-logo="${esc(VFN.urlLogoEquipa(H().equipa(dados, j.vencedor), j.vencedor === j.casa.id ? j.casa.nome : j.fora.nome))}"` : ""} data-jogo="${j.origem === "vfn" ? "vfn" : "liga"}:${esc(j.id)}" title="Ver detalhe do jogo">
          ${linha(j.casa, j.gc)}${linha(j.fora, j.gf)}
          <small class="br-data">${j.data ? esc(VFN.dataCurta(j.data)) : "Data por definir"}${temRes && !j.vencedor ? " · empate: falta o vencedor" : j.vencedor && Number(j.gc) === Number(j.gf) ? " · após penáltis" : ""}</small>
        </button>`;
      }).join("");
      return `<section class="br-fase${f.jogos.length ? "" : " vazia"}"><h4>${esc(f.nome)}</h4><div class="br-jogos">${html || '<p class="br-sorteio">Por sortear</p>'}</div></section>`;
    });
    // as ligações entre fases (SVG) são desenhadas com D3 por ligarBrackets, quando o bracket aparece no ecrã
    return `<p class="bracket-dica">${VFN.icone("move-horizontal", 14)} Desliza para ver as fases seguintes.</p><div class="bracket-scroll"><div class="bracket${fase ? " uma-fase" : ""}" data-bracket>${colunas.join("")}<svg class="br-ligacoes" aria-hidden="true"></svg></div></div>`;
  }

  /* ---------- Bracket: ligações entre fases com D3 ----------
     Cada vencedor liga-se (path SVG) ao confronto da fase seguinte em que joga; a linha desenha-se
     e o emblema do vencedor "viaja" pelo caminho. Corre sozinho em qualquer página (MutationObserver). */

  const semMovimento = () => window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  function desenharLigacoes(bracket, animar) {
    const d3 = window.d3;
    const svg = bracket.querySelector(".br-ligacoes");
    if (!d3 || !svg || bracket.offsetWidth === 0) return;
    const caixa = bracket.getBoundingClientRect();
    const fases = [...bracket.querySelectorAll(".br-fase")];
    const ligacoes = [];
    fases.forEach((f, i) => {
      const seguinte = fases[i + 1];
      if (!seguinte) return;
      f.querySelectorAll(".br-jogo[data-vencedor]").forEach(jogo => {
        const destino = [...seguinte.querySelectorAll(".br-equipa[data-eq]")].find(e => e.dataset.eq === jogo.dataset.vencedor);
        if (!destino) return;
        const a = jogo.getBoundingClientRect(), b = destino.getBoundingClientRect();
        const x1 = a.right - caixa.left, y1 = a.top + a.height / 2 - caixa.top;
        const x2 = b.left - caixa.left, y2 = b.top + b.height / 2 - caixa.top;
        const meio = (x1 + x2) / 2;
        ligacoes.push({ d: `M${x1},${y1} C${meio},${y1} ${meio},${y2} ${x2},${y2}`, fase: i, logo: jogo.dataset.vencedorLogo || "" });
      });
    });
    const s = d3.select(svg).attr("width", bracket.scrollWidth).attr("height", bracket.scrollHeight);
    s.selectAll("*").remove();
    const caminhos = s.selectAll("path").data(ligacoes).join("path").attr("class", "br-ligacao").attr("d", l => l.d);
    if (!animar || semMovimento()) return;
    caminhos.each(function (l) {
      const comp = this.getTotalLength();
      const atraso = l.fase * 450;
      d3.select(this).attr("stroke-dasharray", comp).attr("stroke-dashoffset", comp)
        .transition().delay(atraso).duration(700).ease(d3.easeCubicOut).attr("stroke-dashoffset", 0)
        .on("end", function () { d3.select(this).attr("stroke-dasharray", null); });
      if (!l.logo) return;
      // o vencedor "avança" para o confronto seguinte
      const caminho = this;
      const viajante = s.append("image").attr("href", l.logo).attr("width", 22).attr("height", 22).attr("class", "br-viajante").attr("opacity", 0);
      viajante.transition().delay(atraso).duration(800).ease(d3.easeCubicInOut).attr("opacity", 1)
        .attrTween("transform", () => t => { const p = caminho.getPointAtLength(t * comp); return `translate(${p.x - 11},${p.y - 11})`; })
        .transition().duration(300).attr("opacity", 0).remove();
    });
  }

  /** Liga os brackets novos: desenha (com animação na primeira vez) e redesenha quando o tamanho muda. */
  function ligarBrackets(raiz) {
    (raiz || document).querySelectorAll("[data-bracket]:not([data-ligado])").forEach(bracket => {
      bracket.dataset.ligado = "1";
      let primeira = true;
      const desenhar = () => { if (bracket.offsetWidth === 0) return; desenharLigacoes(bracket, primeira); primeira = false; };
      if (window.ResizeObserver) new ResizeObserver(() => desenhar()).observe(bracket);
      else setTimeout(desenhar, 50);
      // os emblemas podem chegar depois e mudar a altura das linhas
      bracket.querySelectorAll("img").forEach(img => { if (!img.complete) img.addEventListener("load", () => desenharLigacoes(bracket, false), { once: true }); });
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (!window.MutationObserver) return;
    let pendente = false;
    new MutationObserver(() => {
      if (pendente) return;
      pendente = true;
      requestAnimationFrame(() => { pendente = false; ligarBrackets(); });
    }).observe(document.body, { childList: true, subtree: true });
    ligarBrackets();
  });

  /* ---------- Drawer (bottom-sheet no telemóvel, painel ao centro no computador) ---------- */

  let drawerAberto = null;

  function fecharDrawer() {
    const d = document.getElementById("vfnDrawer");
    if (!d || d.hidden) return;
    d.classList.remove("aberto");
    setTimeout(() => { d.hidden = true; }, 250); // fecho rápido (a abertura demora 600ms)
    const anterior = drawerAberto;
    drawerAberto = null;
    if (anterior && anterior.aoFechar) anterior.aoFechar();
    if (anterior && anterior.foco && document.contains(anterior.foco)) anterior.foco.focus();
  }

  /** Abre o drawer com { titulo, corpo (HTML), aoFechar }. Devolve o elemento do corpo. */
  function abrirDrawer(opcoes) {
    let d = document.getElementById("vfnDrawer");
    if (!d) {
      d = document.createElement("div");
      d.id = "vfnDrawer";
      d.className = "vfn-drawer";
      d.hidden = true;
      d.innerHTML = `<div class="drawer-painel" role="dialog" aria-modal="true" aria-labelledby="vfnDrawerTitulo">
          <span class="drawer-pega" aria-hidden="true"></span>
          <div class="drawer-topo"><h3 id="vfnDrawerTitulo"></h3><button type="button" class="icon-btn drawer-fechar" aria-label="Fechar">${VFN.icone("x", 18)}</button></div>
          <div class="drawer-corpo"></div>
        </div>`;
      document.body.appendChild(d);
      d.addEventListener("click", e => { if (e.target === d || e.target.closest(".drawer-fechar")) fecharDrawer(); });
      document.addEventListener("keydown", e => { if (e.key === "Escape" && drawerAberto) fecharDrawer(); });
      // abas dentro do drawer
      d.addEventListener("click", e => {
        const aba = e.target.closest("[data-aba]");
        if (!aba) return;
        const grupo = aba.closest(".abas");
        grupo.querySelectorAll("[data-aba]").forEach(b => { const ativa = b === aba; b.classList.toggle("ativa", ativa); b.setAttribute("aria-selected", ativa); });
        grupo.parentElement.querySelectorAll(":scope > [data-painel]").forEach(p => { p.hidden = p.dataset.painel !== aba.dataset.aba; });
      });
    }
    drawerAberto = { aoFechar: opcoes.aoFechar, foco: document.activeElement };
    d.querySelector("#vfnDrawerTitulo").textContent = opcoes.titulo || "";
    const corpo = d.querySelector(".drawer-corpo");
    corpo.innerHTML = opcoes.corpo || "";
    corpo.scrollTop = 0;
    d.hidden = false;
    requestAnimationFrame(() => d.classList.add("aberto"));
    d.querySelector(".drawer-fechar").focus({ preventScroll: true });
    return corpo;
  }

  /* ---------- Calendário mensal ---------- */

  const DIAS_SEMANA = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  /**
   * Jogos do VFN, treinos e aniversários de um dia. dados: { matches, sessions, aniversariantes }.
   * aniversariantes: [{ jogador, nascimento: "AAAA-MM-DD" }] — só nas páginas com login.
   */
  function eventosDoDia(dados, dia) {
    return {
      jogos: VFN.jogosDoVFN(dados.matches).filter(j => VFN.dataIso(j.date) === dia && VFN.estadoJogo(j) !== "cancelado"),
      treinos: (dados.sessions || []).filter(s => s.session_date === dia && s.session_type === "treino"),
      aniversarios: aniversariosDoDia(dados.aniversariantes, dia)
    };
  }

  /** Quem faz anos no dia (ignora o ano; os nascidos a 29/02 festejam a 28/02 nos anos comuns). */
  function aniversariosDoDia(aniversariantes, dia) {
    if (!aniversariantes || !aniversariantes.length) return [];
    const [ano, mes, d] = dia.split("-").map(Number);
    const bissexto = (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;
    return aniversariantes.filter(a => {
      const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(a.nascimento || "");
      if (!m) return false;
      const [mn, dn] = [Number(m[2]), Number(m[3])];
      return (mn === mes && dn === d) || (!bissexto && mn === 2 && dn === 29 && mes === 2 && d === 28);
    }).map(a => ({ ...a, idade: ano - Number(a.nascimento.slice(0, 4)) }));
  }

  /** Célula de um dia: número, cone nos treinos, logo do adversário + casa/fora nos jogos. */
  function renderCalendarDay(data, eventos, opcoes) {
    const o = opcoes || {};
    const dia = iso(data);
    const jogo = eventos.jogos[0];
    const classes = ["cal-dia", o.hoje ? "hoje" : "", o.selecionado ? "selecionado" : "", jogo ? "com-jogo" : "", eventos.treinos.length ? "com-treino" : "", eventos.aniversarios.length ? "com-aniversario" : "",
      jogo && VFN.estadoJogo(jogo) === "jogado" && VFN.golosJogo(jogo) ? "res-" + VFN.letraResultado(jogo) : ""].filter(Boolean).join(" ");
    const partes = [];
    if (jogo) {
      const t = H().equipa(o.dados || {}, jogo.opponent_team_id);
      const nome = H().nomeAdversario(o.dados || {}, jogo);
      const url = VFN.urlLogoEquipa(t, nome);
      const casa = VFN.jogoEmCasa(jogo);
      partes.push(`<span class="cal-jogo">${url ? `<img src="${esc(url)}" alt="" loading="lazy">` : `<b>${esc(nome.slice(0, 2).toUpperCase())}</b>`}<span class="cal-local">${VFN.icone(casa ? "house" : "bus", 10)}</span></span>`);
    }
    if (eventos.treinos.length) partes.push(`<span class="cal-treino">${VFN.icone("traffic-cone", 12)}</span>`);
    if (eventos.aniversarios.length) partes.push('<span class="cal-bolo" aria-hidden="true">🎂</span>');
    const descricao = [jogo ? `Jogo ${VFN.jogoEmCasa(jogo) ? "em casa" : "fora"} com ${H().nomeAdversario(o.dados || {}, jogo)}` : "", eventos.treinos.length ? "Treino" : "",
      eventos.aniversarios.length ? "Aniversário de " + eventos.aniversarios.map(a => a.jogador.nome).join(", ") : ""].filter(Boolean).join(", ");
    return `<button type="button" class="${classes}" data-dia="${dia}" aria-label="${esc(VFN.dataLonga(dia + "T12:00:00") + (descricao ? ": " + descricao : ""))}"${o.selecionado ? ' aria-pressed="true"' : ""}>
      <span class="cal-num">${data.getDate()}</span>${partes.length ? `<span class="cal-icones">${partes.join("")}</span>` : ""}${rotulosDiaHTML(eventos, o.dados || {})}
    </button>`;
  }

  /** Etiquetas de texto (só em ecrãs largos, como no Google Calendar): jogo, treino e aniversários. */
  function rotulosDiaHTML(eventos, dados) {
    const r = [];
    eventos.jogos.forEach(j => {
      const hora = VFN.horaIso(j.date);
      const g = VFN.estadoJogo(j) === "jogado" && VFN.golosJogo(j);
      r.push(`<span class="cal-rotulo jogo">${g ? `${g.vfn}–${g.adv}` : hora && hora !== "00:00" ? esc(hora) : ""} ${VFN.jogoEmCasa(j) ? "vs" : "@"} ${esc(H().nomeAdversario(dados, j))}</span>`);
    });
    eventos.treinos.forEach(t => r.push(`<span class="cal-rotulo treino">Treino${t.start_time ? " " + esc(String(t.start_time).slice(0, 5)) : ""}</span>`));
    eventos.aniversarios.forEach(a => r.push(`<span class="cal-rotulo aniv">🎂 ${esc(a.jogador.nome)}</span>`));
    return r.length ? `<span class="cal-rotulos" aria-hidden="true">${r.join("")}</span>` : "";
  }

  /** Mês completo (semana a começar à segunda). */
  function calendarioMensalHTML(dados, ano, mes, selecionado) {
    const primeiro = new Date(ano, mes, 1);
    const desvio = (primeiro.getDay() + 6) % 7;
    const diasNoMes = new Date(ano, mes + 1, 0).getDate();
    const hoje = iso(new Date());
    const celulas = [];
    for (let i = 0; i < desvio; i++) celulas.push('<span class="cal-vazio" aria-hidden="true"></span>');
    for (let n = 1; n <= diasNoMes; n++) {
      const d = new Date(ano, mes, n);
      celulas.push(renderCalendarDay(d, eventosDoDia(dados, iso(d)), { hoje: iso(d) === hoje, selecionado: iso(d) === selecionado, dados }));
    }
    return `<div class="cal-topo">
        <button type="button" class="icon-btn" data-cal="anterior" aria-label="Mês anterior">${VFN.icone("chevron-left", 18)}</button>
        <h3 class="cal-titulo">${VFN.MESES_LONGOS[mes]} ${ano}</h3>
        <button type="button" class="icon-btn" data-cal="seguinte" aria-label="Mês seguinte">${VFN.icone("chevron-right", 18)}</button>
        <button type="button" class="btn btn-ghost btn-sm" data-cal="hoje">Hoje</button>
      </div>
      <div class="cal-grelha" role="grid" aria-label="${VFN.MESES_LONGOS[mes]} ${ano}">
        ${DIAS_SEMANA.map(d => `<span class="cal-semana" aria-hidden="true">${d}</span>`).join("")}
        ${celulas.join("")}
      </div>
      <div class="cal-legenda"><span>${VFN.icone("traffic-cone", 12)} Treino</span>${(dados.aniversariantes || []).length ? '<span><span aria-hidden="true">🎂</span> Aniversário</span>' : ""}<span>${VFN.icone("house", 12)} Casa</span><span>${VFN.icone("bus", 12)} Fora</span><span><i class="leg-res res-V"></i>V <i class="leg-res res-E"></i>E <i class="leg-res res-D"></i>D</span></div>`;
  }

  /* ---------- Detalhe do dia (drawer) ---------- */

  /** Timeline de eventos de um jogo a partir do relatório. */
  function renderMatchEvents(relatorio, nomeJogador) {
    const eventos = H().eventosDoRelatorio(relatorio, nomeJogador);
    if (!eventos.length) return '<p class="muted">Sem eventos registados.</p>';
    return `<ol class="ev-lista">${eventos.map(e => `<li class="${e.neutro ? "neutro" : e.vfn ? "vfn" : "adv"}"><span class="ev-min">${e.minuto}${e.acrescimo ? "+" + e.acrescimo : ""}'</span><span class="ev-tipo">${/^(Golo|Auto-golo)$/.test(e.tipo) ? VFN.icone("bola", 14) + " " : ""}${esc(e.tipo)}</span><span class="ev-texto">${esc(e.texto)}</span></li>`).join("")}</ol>`;
  }

  /** Onze, suplentes, formação e capitão a partir do relatório. */
  function escalacaoHTML(relatorio, nomeJogador) {
    const jogo = ((relatorio || {}).match_data || {}).jogo || {};
    const nome = id => (nomeJogador && nomeJogador(id)) || "—";
    const onze = (jogo.titulares || []).filter(Boolean);
    if (!onze.length) return '<p class="muted">Escalação ainda não registada.</p>';
    const linha = id => `<li>${esc(nome(id))}${String(id) === String(jogo.capitaoId) ? " " + VFN.badgeCapitao() : ""}</li>`;
    return `${jogo.formacaoVFN ? `<p class="esc-formacao">Formação <strong>${esc(jogo.formacaoVFN)}</strong></p>` : ""}
      <div class="esc-grid"><div><h5>Onze inicial</h5><ol>${onze.map(linha).join("")}</ol></div>
      <div><h5>Suplentes</h5><ul>${(jogo.suplentes || []).filter(Boolean).map(linha).join("") || '<li class="muted">—</li>'}</ul></div></div>`;
  }

  function detalheJogoDiaHTML(dados, jogo, o) {
    const nome = H().nomeAdversario(dados, jogo);
    const casa = VFN.jogoEmCasa(jogo);
    const g = VFN.golosJogo(jogo);
    const fase = VFN.eliminatorias(jogo.competition) ? VFN.nomeFase(VFN.faseDoJogo(jogo.phase, jogo.jornada)) : "";
    const hora = VFN.horaIso(jogo.date);
    const relatorio = o.comRelatorios ? H().relatorioDoJogo(dados, jogo.id) : null;
    const resumo = `<div class="dia-jogo-topo">${H().logoEquipa(H().equipa(dados, jogo.opponent_team_id), nome, "dia-logo")}
        <div><strong>${casa ? "VFN vs " + esc(nome) : esc(nome) + " vs VFN"}</strong><span>${VFN.icone(casa ? "house" : "bus", 14)} ${casa ? "Casa" : "Fora"}</span></div>
        ${g && VFN.estadoJogo(jogo) === "jogado" ? `<span class="dia-resultado res-${VFN.letraResultado(jogo)}">${g.vfn}–${g.adv}</span>` : ""}</div>
      <dl class="dia-info">
        <div><dt>Competição</dt><dd>${VFN.nomeCompeticaoHTML(jogo.competition)}</dd></div>
        ${fase ? `<div><dt>Fase</dt><dd>${esc(fase)}</dd></div>` : jogo.jornada ? `<div><dt>Jornada</dt><dd>${esc(jogo.jornada)}</dd></div>` : ""}
        <div><dt>Data</dt><dd>${esc(VFN.dataLonga(jogo.date))}</dd></div>
        <div><dt>Hora</dt><dd>${hora && hora !== "00:00" ? esc(hora) : "—"}</dd></div>
        <div><dt>Local</dt><dd>${esc(VFN.estadioDoJogo(jogo, dados.teams).nome || (casa ? "Casa" : "—"))}</dd></div>
      </dl>
      <button type="button" class="btn btn-ghost btn-sm" data-jogo="vfn:${esc(jogo.id)}">${VFN.icone("eye", 16)} Ver detalhe do jogo</button>`;
    if (!o.comRelatorios) return `<section class="dia-bloco">${resumo}</section>`;
    return `<section class="dia-bloco">
      <div class="abas" role="tablist"><button type="button" class="ativa" role="tab" aria-selected="true" data-aba="resumo">Resumo</button><button type="button" role="tab" aria-selected="false" data-aba="eventos">Eventos</button><button type="button" role="tab" aria-selected="false" data-aba="escalacao">Escalação</button></div>
      <div data-painel="resumo">${resumo}</div>
      <div data-painel="eventos" hidden>${relatorio ? renderMatchEvents(relatorio, o.nomeRelatorio) : '<p class="muted">Ainda não há relatório deste jogo.</p>'}</div>
      <div data-painel="escalacao" hidden>${relatorio ? escalacaoHTML(relatorio, o.nomeRelatorio) : '<p class="muted">Ainda não há relatório deste jogo.</p>'}</div>
    </section>`;
  }

  /** Presentes, faltas e justificadas de um dia (só equipa técnica / dirigentes). */
  function presencasDiaHTML(dados, dia, nomePresenca) {
    const registos = (dados.attendance || []).filter(a => a.session_date === dia && a.status);
    if (!registos.length) return '<p class="muted">Sem presenças marcadas neste dia.</p>';
    const grupos = [["Presentes", r => r.status === "P" || r.status === "A", "ok"], ["Faltas injustificadas", r => r.status === "F", "mau"], ["Faltas justificadas", r => r.status === "J", "neutro"]];
    return grupos.map(([titulo, f, cls]) => {
      const lista = registos.filter(f);
      if (!lista.length) return "";
      return `<div class="dia-presencas ${cls}"><h5>${titulo} <b>${lista.length}</b></h5><p>${lista.map(r => esc(nomePresenca(r.player_id) || "—") + (r.status === "A" ? " (atraso)" : "")).sort((a, b) => a.localeCompare(b, "pt")).join(", ")}</p></div>`;
    }).join("");
  }

  /**
   * Conteúdo do drawer de um dia. o: { perfil: "publico" | "staff" | "admin", nomeRelatorio(idLocal), nomePresenca(playerId), semPresencas }.
   */
  function detalheDiaHTML(dados, dia, o) {
    const { jogos, treinos, aniversarios } = eventosDoDia(dados, dia);
    const staff = o.perfil === "staff" || o.perfil === "admin";
    const passado = dia < iso(new Date());
    const blocos = [];
    if (aniversarios.length) blocos.push(`<section class="dia-bloco dia-aniversarios"><h4><span aria-hidden="true">🎂</span> ${aniversarios.length === 1 ? "Aniversário" : "Aniversários"}</h4>
      <ul class="aniv-lista">${aniversarios.map(a => `<li>${VFN.avatarJogador(a.jogador, "avatar-xs")}<span><strong>${esc(a.jogador.nome)}</strong><small>${a.idade > 0 ? `faz ${a.idade} anos` : ""}${a.jogador.staff ? " · " + esc(a.jogador.posicao) : ""}</small></span></li>`).join("")}</ul></section>`);
    jogos.forEach(j => blocos.push(detalheJogoDiaHTML(dados, j, { ...o, comRelatorios: staff })));
    treinos.forEach(t => blocos.push(`<section class="dia-bloco dia-treino">
      <h4>${VFN.icone("traffic-cone", 16)} Treino</h4>
      <dl class="dia-info"><div><dt>Hora</dt><dd>${esc(t.start_time ? String(t.start_time).slice(0, 5) : "—")}</dd></div><div><dt>Local</dt><dd>${esc(t.location || "—")}</dd></div>${staff && t.notes ? `<div><dt>Notas</dt><dd>${esc(t.notes)}</dd></div>` : ""}</dl>
    </section>`));
    if (staff && !o.semPresencas && passado && (jogos.length || treinos.length)) blocos.push(`<section class="dia-bloco"><h4>${VFN.icone("calendar-check", 16)} Presenças</h4>${presencasDiaHTML(dados, dia, o.nomePresenca || (() => ""))}</section>`);
    if (!jogos.length && !treinos.length) blocos.push('<p class="muted dia-vazio">Sem treinos nem jogos neste dia.</p>');
    if (o.perfil === "admin") blocos.push(`<div class="dia-acoes"><button type="button" class="btn btn-ghost btn-sm" data-cal-acao="treino" data-dia="${dia}">${VFN.icone("traffic-cone", 16)} Adicionar treino</button><button type="button" class="btn btn-accent btn-sm" data-cal-acao="jogo" data-dia="${dia}">${VFN.icone("plus", 16)} Adicionar jogo</button></div>`);
    return blocos.join("");
  }

  /**
   * Liga um calendário mensal a um contentor.
   * opcoes: { obterDados(), perfil, nomeRelatorio, nomePresenca, novoTreino(dia), novoJogo(dia) }
   */
  function criarCalendarioMensal(contentor, opcoes) {
    const hoje = new Date();
    const estado = { ano: hoje.getFullYear(), mes: hoje.getMonth(), selecionado: "" };
    const render = () => {
      contentor.innerHTML = calendarioMensalHTML(opcoes.obterDados(), estado.ano, estado.mes, estado.selecionado);
    };
    contentor.addEventListener("click", e => {
      const nav = e.target.closest("[data-cal]");
      if (nav) {
        if (nav.dataset.cal === "hoje") { estado.ano = hoje.getFullYear(); estado.mes = hoje.getMonth(); }
        else {
          const d = new Date(estado.ano, estado.mes + (nav.dataset.cal === "seguinte" ? 1 : -1), 1);
          estado.ano = d.getFullYear(); estado.mes = d.getMonth();
        }
        render();
        return;
      }
      const celula = e.target.closest("[data-dia]");
      if (!celula) return;
      estado.selecionado = celula.dataset.dia;
      render();
      const corpo = abrirDrawer({ titulo: VFN.dataLonga(estado.selecionado + "T12:00:00"), corpo: detalheDiaHTML(opcoes.obterDados(), estado.selecionado, opcoes), aoFechar: () => { estado.selecionado = ""; render(); } });
      corpo.querySelectorAll("[data-cal-acao]").forEach(b => b.addEventListener("click", () => {
        const dia = b.dataset.dia;
        fecharDrawer();
        if (b.dataset.calAcao === "treino" && opcoes.novoTreino) opcoes.novoTreino(dia);
        if (b.dataset.calAcao === "jogo" && opcoes.novoJogo) opcoes.novoJogo(dia);
      }));
    });
    // deslizar para mudar de mês (telemóvel)
    let inicioX = null;
    contentor.addEventListener("touchstart", e => { inicioX = e.touches[0].clientX; }, { passive: true });
    contentor.addEventListener("touchend", e => {
      if (inicioX === null) return;
      const dx = e.changedTouches[0].clientX - inicioX;
      inicioX = null;
      if (Math.abs(dx) < 60) return;
      const d = new Date(estado.ano, estado.mes + (dx < 0 ? 1 : -1), 1);
      estado.ano = d.getFullYear(); estado.mes = d.getMonth();
      render();
    });
    render();
    return { render, irPara(ano, mes) { estado.ano = ano; estado.mes = mes; render(); } };
  }

  /* ---------- Relatório de dívidas ---------- */

  /** Dívida por pessoa (multas por pagar), da maior para a menor. */
  function dividasPorPessoa(multas, pessoa) {
    const mapa = new Map();
    multas.filter(f => !f.paid).forEach(f => {
      const d = mapa.get(String(f.player_id)) || { id: String(f.player_id), pessoa: pessoa(f.player_id), n: 0, valor: 0 };
      d.n++; d.valor += Number(f.amount) || 0;
      mapa.set(d.id, d);
    });
    return [...mapa.values()].sort((a, b) => b.valor - a.valor || b.n - a.n || String((a.pessoa || {}).nome).localeCompare(String((b.pessoa || {}).nome), "pt"));
  }

  /** Multas por pagar, opcionalmente só de um tipo (infraction_type). */
  function multasEmDivida(multas, tipo) {
    return (multas || []).filter(f => !f.paid && (!tipo || f.infraction_type === tipo));
  }

  /** <option>s dos tipos com dívida (para o filtro "tipo de dívida"), mantendo a escolha. */
  function opcoesTipoDividaHTML(multas, selecionado) {
    const tipos = [...new Set(multasEmDivida(multas).map(f => f.infraction_type))].sort((a, b) => VFN.rotuloMulta(a).localeCompare(VFN.rotuloMulta(b), "pt"));
    return '<option value="">Todos os tipos</option>' + tipos.map(t => `<option value="${esc(t)}"${t === selecionado ? " selected" : ""}>${esc(VFN.rotuloMulta(t))}</option>`).join("");
  }

  /**
   * Relatório de dívidas (ecrã e imagem partilhável).
   * o: { pessoa(id) -> { nome, ... }, tipo: só esse tipo de dívida, imagem: true para a versão da imagem
   * (cabeçalho "Dívidas Pendentes — mês", sem fotos, total no rodapé) }
   */
  function renderDebtReport(multas, o) {
    const lista = dividasPorPessoa(multasEmDivida(multas, o.tipo), o.pessoa);
    const total = lista.reduce((t, d) => t + d.valor, 0);
    const euro = v => VFN.formatoEuro.format(v);
    const hoje = new Date();
    const titulo = `Dívidas Pendentes — ${VFN.MESES_LONGOS[hoje.getMonth()]} ${hoje.getFullYear()}`;
    return `<div class="dividas${o.imagem ? " dividas-imagem" : ""}">
      <div class="dividas-topo"><img src="assets/logo.png" alt=""><div><strong>${esc(titulo)}</strong><span>ACD Vila Franca das Naves${o.tipo ? " · " + esc(VFN.rotuloMulta(o.tipo)) : ""}</span></div></div>
      ${o.imagem ? "" : `<div class="dividas-total"><span>Total em dívida${o.tipo ? " · " + esc(VFN.rotuloMulta(o.tipo)) : ""}</span><strong>${euro(total)}</strong></div>`}
      ${lista.length ? `<ol class="dividas-lista">${lista.map((d, i) => `<li${!o.imagem && d.pessoa ? ` data-jogador="${esc(d.id)}"` : ""}>
        <span class="dividas-pos">${i + 1}</span>
        ${!o.imagem && d.pessoa ? VFN.avatarJogador(d.pessoa, "avatar-xs") : ""}
        <span class="dividas-nome">${esc(d.pessoa ? d.pessoa.nome : "Jogador removido")}<small>${d.n} multa${d.n === 1 ? "" : "s"}</small></span>
        <strong>${euro(d.valor)}</strong>
      </li>`).join("")}</ol>` : '<p class="dividas-vazio">Não há multas por pagar.</p>'}
      ${o.imagem ? `<div class="dividas-total dividas-total-rodape"><span>Total</span><strong>${euro(total)}</strong></div>
        <p class="dividas-rodape">Atualizado a ${esc(VFN.dataDDMMAAAA(VFN.dataIso(hoje)))}</p>` : ""}
    </div>`;
  }

  /** Gera a imagem PNG do relatório (html2canvas) e partilha-a (telemóvel) ou descarrega-a. */
  function exportarImagemDividas(multas, o) {
    return exportarImagemHTML(renderDebtReport(multas, { ...o, imagem: true }), { nome: `dividas_vfn_${VFN.dataIso(new Date())}.png`, titulo: "Dívidas Pendentes — VFN", largura: 540, partilhar: o.partilhar });
  }

  /**
   * HTML → PNG (html2canvas, escala 2) num documento à parte com o CSS do site.
   * o: { nome, titulo, largura (px), fundo, partilhar }. No telemóvel abre a partilha (WhatsApp...);
   * no computador descarrega o ficheiro.
   */
  async function exportarImagemHTML(html, o) {
    if (!window.html2canvas) { alert("A biblioteca de imagens não carregou. Verifica a ligação à internet."); return; }
    // documento à parte (só o conteúdo e o CSS): o html2canvas copia apenas este documento
    const palco = document.createElement("iframe");
    palco.className = "dividas-palco";
    palco.style.width = (o.largura || 540) + "px";
    palco.setAttribute("aria-hidden", "true");
    palco.srcdoc = `<!doctype html><html lang="pt"><head><meta charset="utf-8"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap"><link rel="stylesheet" href="styles.css"></head><body style="margin:0;background:${o.fundo || "#fff"}">${html}</body></html>`;
    document.body.appendChild(palco);
    try {
      await new Promise(r => { palco.onload = r; });
      const doc = palco.contentDocument;
      if (doc.fonts && doc.fonts.ready) await doc.fonts.ready; // sem a letra carregada o html2canvas junta palavras
      await Promise.all([...doc.querySelectorAll("img")].map(img => img.complete ? null : new Promise(r => { img.onload = img.onerror = r; })));
      const alvo = doc.body.firstElementChild;
      palco.style.height = alvo.scrollHeight + "px";
      const canvas = await window.html2canvas(alvo, { scale: 2, backgroundColor: o.fundo || "#ffffff", useCORS: true, logging: false });
      const blob = await new Promise(r => canvas.toBlob(r, "image/png"));
      const nome = o.nome || "vfn.png";
      const ficheiro = new File([blob], nome, { type: "image/png" });
      // no telemóvel abre a partilha (WhatsApp, email...); no computador descarrega o PNG
      const tatil = window.matchMedia && matchMedia("(pointer: coarse)").matches;
      if (o.partilhar !== false && tatil && navigator.canShare && navigator.canShare({ files: [ficheiro] })) {
        try { await navigator.share({ files: [ficheiro], title: o.titulo || "VFN" }); return; } catch (e) { if (e && e.name === "AbortError") return; }
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = nome;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } finally {
      palco.remove();
    }
  }

  /* ---------- Convocatória (tabela squads) ----------
     Dois momentos (squad_status): 'lista' — só os convocados (publicada logo, com anúncio);
     'completa' — onze inicial, suplentes, formação, capitão e concentração (até ~1h antes). */

  const MIN_CONVOCADOS = 18, MAX_CONVOCADOS = 23;

  /** Convocatória de um jogo (a mais recente, se houver várias). */
  function convocatoriaDoJogo(squads, matchId) {
    return (squads || []).filter(s => String(s.match_id) === String(matchId))
      .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))[0] || null;
  }

  /** Próximo jogo do VFN com convocatória (só publicadas, se `publicadas`). Devolve { jogo, squad } ou null. */
  function proximaConvocatoria(dados, publicadas) {
    const limite = Date.now() - 3 * 3600 * 1000;
    const jogos = VFN.jogosDoVFN(dados.matches).filter(j => VFN.estadoJogo(j) !== "cancelado" && (VFN.paraData(j.date) || 0) >= limite)
      .sort((a, b) => VFN.paraData(a.date) - VFN.paraData(b.date));
    for (const jogo of jogos) {
      const squad = convocatoriaDoJogo(dados.squads, jogo.id);
      if (squad && (!publicadas || squad.published)) return { jogo, squad };
    }
    return null;
  }

  /** Jogadores (objetos) de uma lista de ids, ordenados por posição (GR, defesas, médios, avançados). */
  function jogadoresDosIds(ids, pessoa) {
    return VFN.ordenarPorPosicao((ids || []).map(id => pessoa(id)).filter(Boolean));
  }

  const idDe = j => String(j.idBD || j.id);
  const completa = squad => squad.squad_status === "completa";

  /** Hora e local de concentração em destaque (fase 2). */
  function concentracaoHTML(squad) {
    if (!completa(squad) || (!squad.concentration_time && !squad.concentration_location)) return "";
    return `<div class="conv-concentracao">${VFN.icone("map-pin", 22)}<div><span>Concentração</span>
      <strong>${squad.concentration_time ? esc(String(squad.concentration_time).slice(0, 5)) : "Hora a definir"}${squad.concentration_location ? " · " + esc(squad.concentration_location) : ""}</strong></div></div>`;
  }

  /**
   * Vista da convocatória (sem campo tático: esse fica no relatório/análise).
   * Fase 1: convocados e não convocados com foto, número e nome.
   * Fase 2: + concentração em destaque, onze inicial e suplentes, capitão.
   * o: { eu (jogador com sessão), todos (plantel, para os não convocados), campo (pré-visualização do admin) }
   */
  function renderSquadView(dados, jogo, squad, pessoa, o) {
    const opcoes = o || {};
    const nome = H().nomeAdversario(dados, jogo);
    const casa = VFN.jogoEmCasa(jogo);
    const ids = (squad.player_ids || []).map(String);
    const convocados = jogadoresDosIds(ids, pessoa);
    const fase2 = completa(squad);
    const onze = fase2 ? (squad.lineup || []).map(id => pessoa(id)).filter(Boolean) : [];
    const suplentes = fase2 ? jogadoresDosIds(squad.subs, pessoa) : [];
    const fora = VFN.ordenarPorPosicao((opcoes.todos || []).filter(j => !ids.includes(idDe(j))));
    const eu = opcoes.eu ? String(opcoes.eu.id) : "";
    const souConvocado = eu && ids.includes(eu);
    const souTitular = eu && (squad.lineup || []).map(String).includes(eu);
    const aviso = eu ? `<div class="conv-aviso ${souConvocado ? "sim" : "nao"}">${VFN.icone(souConvocado ? "circle-check" : "circle-off", 22)}<div><strong>${souConvocado ? "Estás convocado!" : "Não foste convocado para este jogo."}</strong>${souConvocado && fase2 ? `<span>${souTitular ? "No onze inicial" : "Suplente"}${String(squad.captain_id) === eu ? " · Capitão" : ""}</span>` : ""}</div></div>` : "";
    const linha = j => `<li${idDe(j) === eu ? ' class="eu"' : ""}>${VFN.avatarJogador(j, "avatar-xs")}<b class="conv-num">${esc(j.numero === "" || j.numero == null ? "—" : j.numero)}</b><span class="conv-nome">${esc(j.nome)}${fase2 && String(squad.captain_id) === idDe(j) ? " " + VFN.badgeCapitao() : ""}</span><small class="muted">${esc(j.posicao)}</small></li>`;
    const bloco = (titulo, lista, classe) => lista.length ? `<section class="conv-bloco ${classe || ""}"><h4 class="perfil-subtitulo">${titulo} <small class="muted">${lista.length}</small></h4><ul class="conv-lista">${lista.map(linha).join("")}</ul></section>` : "";
    return `<div class="conv-topo">${H().logoEquipa(H().equipa(dados, jogo.opponent_team_id), nome, "conv-logo")}
        <div><strong>${casa ? "VFN vs " + esc(nome) : esc(nome) + " vs VFN"}</strong><span>${esc(VFN.dataLonga(jogo.date, true))} · ${esc(VFN.nomeCurtoCompeticao(jogo.competition))}${VFN.etiquetaJornada(jogo) ? " · " + esc(VFN.etiquetaJornada(jogo)) : ""}</span></div>
        <span class="conv-fase ${fase2 ? "fase2" : ""}">${fase2 ? "Onze inicial" : "Lista de convocados"}</span>${squad.published ? "" : ' <span class="estado-relatorio rascunho">Rascunho</span>'}</div>
      ${aviso}
      ${concentracaoHTML(squad)}
      ${opcoes.campo && fase2 ? campoConvocatoriaHTML(squad, onze, opcoes) : ""}
      <div class="conv-grelha">
        ${fase2 ? bloco("Onze inicial", VFN.ordenarPorPosicao(onze)) + bloco("Suplentes", suplentes) : bloco("Convocados", convocados)}
        ${bloco("Não convocados", fora, "conv-fora")}
      </div>`;
  }

  /**
   * Pré-visualização tática da convocatória (só admin): cada titular no seu lugar (squads.lineup_slots, índice de
   * VFN.FORMACOES_SLOTS → id; sem slots guardados, a colocação automática). o.editarCampo: lugares arrastáveis.
   */
  function campoConvocatoriaHTML(squad, onze, o) {
    const formacao = squad.formation || "4-3-3";
    const ts = onze.map(j => ({ jogador: j, minutos: 0 }));
    const porId = new Map(ts.map(t => [idDe(t.jogador), t]));
    const lugares = [];
    H().lugaresDoOnzeComSlots(ts, formacao, squad.lineup_slots).forEach((id, i) => { lugares[i] = porId.get(id) || null; });
    const campo = H().onzeCampoHTML(ts, { rotulo: t => t.jogador.numero !== "" && t.jogador.numero != null ? "#" + t.jogador.numero : "", capitao: squad.captain_id, formacao, proficiencia: true, lugares, editavel: !!o.editarCampo });
    return `<section class="conv-bloco"><h4 class="perfil-subtitulo">Pré-visualização tática <small class="muted">${esc(formacao)} · só no admin${o.editarCampo ? " · arrasta um jogador para outro lugar para os trocar" : ""}</small></h4>${campo}</section>`;
  }

  /** Primeira foto que existe de cada jogador (photo_url, assets/players/{id}.jpg ou .png); null = camisola. */
  async function fotosDosJogadores(jogadores) {
    const testar = url => new Promise(r => { const img = new Image(); img.onload = () => r(url); img.onerror = () => r(null); img.src = url; });
    const fotos = new Map();
    await Promise.all(jogadores.map(async j => {
      const id = idDe(j);
      for (const url of [j.photo_url || j.fotoUrl, `assets/players/${id}.jpg`, `assets/players/${id}.png`].filter(Boolean)) {
        if (await testar(url)) { fotos.set(id, url); return; }
      }
      fotos.set(id, null);
    }));
    return fotos;
  }

  /**
   * Anúncio da convocatória para as redes sociais (formato "1x1" ou "9x16"), com os dados da fase 1:
   * escudo e gradiente do clube, jogo e grelha de jogadores (foto, ou camisola, + número + nome). Sem campo tático.
   * fotos: Map id → url (de fotosDosJogadores); sem mapa usa as camisolas.
   * ordem: ids pela ordem escolhida no admin (só para a imagem); sem ordem, por posição (GR → Def → Med → Av).
   */
  function renderAnuncioConvocatoria(dados, jogo, squad, pessoa, formato, fotos, ordem) {
    const nome = H().nomeAdversario(dados, jogo);
    const casa = VFN.jogoEmCasa(jogo);
    const convocados = ordenarConvocados(squad.player_ids, pessoa, ordem);
    const logoAdv = VFN.urlLogoEquipa(H().equipa(dados, jogo.opponent_team_id), nome);
    const equipaLado = (logo, texto) => `<div class="an-equipa">${logo ? `<img src="${esc(logo)}" alt="" crossorigin="anonymous">` : `<span class="an-sem-logo">${esc(texto.slice(0, 2).toUpperCase())}</span>`}<strong>${esc(texto)}</strong></div>`;
    const vfn = equipaLado("assets/logo.png", "ACD VF Naves"), adv = equipaLado(logoAdv, nome);
    const hora = VFN.horaIso(jogo.date);
    const cartao = j => {
      const foto = fotos && fotos.get(idDe(j));
      const numero = j.numero === "" || j.numero == null ? "" : j.numero;
      return `<div class="an-jogador">${completa(squad) && String(squad.captain_id) === idDe(j) ? '<span class="an-capitao">C</span>' : ""}
        ${foto ? `<span class="an-foto"><img src="${esc(foto)}" alt="">${numero !== "" ? `<b>${esc(numero)}</b>` : ""}</span>` : VFN.generateJerseyAvatar(numero)}<span>${esc(j.nome)}</span></div>`;
    };
    return `<div class="anuncio anuncio-${formato === "9x16" ? "9x16" : "1x1"}">
      <img class="an-escudo" src="assets/logo.png" alt="">
      <div class="an-cabecalho"><span>ACD Vila Franca das Naves</span><h1>Convocatória</h1></div>
      <div class="an-jogo">${casa ? vfn : adv}<span class="an-vs">vs</span>${casa ? adv : vfn}</div>
      <p class="an-info">${esc(VFN.dataLonga(jogo.date))}${hora && hora !== "00:00" ? " · " + esc(hora) : ""} · ${esc(jogo.competition || "")}${VFN.etiquetaJornada(jogo) ? " · " + esc(VFN.etiquetaJornada(jogo)) : ""}</p>
      <div class="an-grelha">${convocados.map(cartao).join("")}</div>
    </div>`;
  }

  /** Convocados pela ordem dada (os que faltam na ordem vão no fim, por posição); sem ordem, por posição. */
  function ordenarConvocados(ids, pessoa, ordem) {
    const porPosicao = jogadoresDosIds(ids, pessoa);
    if (!ordem || !ordem.length) return porPosicao;
    const pos = new Map(ordem.map((id, i) => [String(id), i]));
    const n = id => (pos.has(id) ? pos.get(id) : Infinity);
    return porPosicao.map((j, i) => ({ j, i })).sort((a, b) => n(idDe(a.j)) - n(idDe(b.j)) || a.i - b.i).map(x => x.j);
  }

  async function exportarAnuncioConvocatoria(dados, jogo, squad, pessoa, formato, ordem) {
    const nome = VFN.slug(H().nomeAdversario(dados, jogo));
    const fotos = await fotosDosJogadores(jogadoresDosIds(squad.player_ids, pessoa));
    return exportarImagemHTML(renderAnuncioConvocatoria(dados, jogo, squad, pessoa, formato, fotos, ordem), { nome: `convocatoria_vfn_${nome}_${formato}.png`, titulo: "Convocatória VFN", largura: 540, fundo: "#0A1628" });
  }

  /* ---------- Card "Jogo da Semana" (próximo jogo, contagem e meteorologia) ---------- */

  // códigos WMO do Open-Meteo → [ícone Lucide, descrição]
  const METEO = [
    [[0], "sun", "Céu limpo"], [[1, 2], "cloud-sun", "Pouco nublado"], [[3], "cloud", "Nublado"], [[45, 48], "cloud-fog", "Nevoeiro"],
    [[51, 53, 55, 56, 57], "cloud-drizzle", "Chuvisco"], [[61, 63, 65, 66, 67, 80, 81, 82], "cloud-rain", "Chuva"],
    [[71, 73, 75, 77, 85, 86], "cloud-snow", "Neve"], [[95, 96, 99], "cloud-lightning", "Trovoada"]
  ];
  const meteoDoCodigo = c => METEO.find(([cs]) => cs.includes(Number(c))) || [[], "cloud", "—"];

  /** Previsão para o dia/hora do jogo: { temp, codigo } ou { indisponivel } (Open-Meteo, sem chave). */
  async function previsaoDoJogo(jogo, equipas) {
    const e = VFN.estadioDoJogo(jogo, equipas);
    const d = VFN.paraData(jogo.date);
    if (e.lat == null || !d) return { indisponivel: "Sem coordenadas do estádio." };
    const dias = (d - Date.now()) / 86400000;
    if (dias > 15) return { indisponivel: "Previsão disponível a 16 dias do jogo." };
    const dia = VFN.dataIso(d);
    const chave = `vfnMeteo:${e.lat},${e.lng},${dia}`;
    let dados = null;
    try { const c = JSON.parse(sessionStorage.getItem(chave) || "null"); if (c && Date.now() - c.t < 3 * 3600 * 1000) dados = c.d; } catch (x) { /* ignora */ }
    if (!dados) {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${e.lat}&longitude=${e.lng}&hourly=temperature_2m,weathercode&timezone=Europe/Lisbon&start_date=${dia}&end_date=${dia}`;
      const r = await fetch(url);
      if (!r.ok) return { indisponivel: "Previsão indisponível." };
      dados = await r.json();
      try { sessionStorage.setItem(chave, JSON.stringify({ t: Date.now(), d: dados })); } catch (x) { /* ignora */ }
    }
    const horas = (dados.hourly && dados.hourly.time) || [];
    const alvo = `${dia}T${String(d.getHours()).padStart(2, "0")}:00`;
    const i = Math.max(0, horas.indexOf(alvo));
    if (!horas.length) return { indisponivel: "Previsão indisponível." };
    return { temp: Math.round(dados.hourly.temperature_2m[i]), codigo: dados.hourly.weathercode[i] };
  }

  function partesContagem(data) {
    const ms = Math.max(0, (VFN.paraData(data) || new Date()) - Date.now());
    const min = Math.floor(ms / 60000);
    return { d: Math.floor(min / 1440), h: Math.floor((min % 1440) / 60), m: min % 60 };
  }

  /** Card do próximo jogo: emblemas frente a frente, "vs" animado, contagem, competição/fase, data, hora, estádio e tempo. */
  function renderJogoDaSemana(dados, o) {
    const opcoes = o || {};
    const jogo = VFN.proximoJogo(dados.matches);
    if (!jogo) return `<div class="jds jds-vazio"><h2 class="hub-card-title">Jogo da Semana</h2>${H().vazio("Sem jogos agendados.")}</div>`;
    const nome = H().nomeAdversario(dados, jogo);
    const casa = VFN.jogoEmCasa(jogo);
    const adv = H().equipa(dados, jogo.opponent_team_id);
    const lado = (url, texto, t) => `<div class="jds-equipa"${VFN.estiloCorEquipa(t, 0.25)}><span class="jds-logo">${url ? `<img src="${esc(url)}" alt="">` : `<b>${esc(texto.slice(0, 2).toUpperCase())}</b>`}</span><strong>${esc(texto)}</strong></div>`;
    const vfn = lado(H().logoVFN(dados), "VFN", VFN.equipaVFN(dados.teams)), outro = lado(VFN.urlLogoEquipa(adv, nome), nome, adv);
    const c = partesContagem(jogo.date);
    const hora = VFN.horaIso(jogo.date);
    const fechado = (() => { try { return localStorage.getItem("vfnJogoSemana") === "fechado"; } catch (e) { return false; } })();
    const est = VFN.estadioDoJogo(jogo, dados.teams);
    const estadio = est.nome;
    return `<div class="jds${fechado ? " recolhido" : ""}" data-jogo-semana="${esc(jogo.id)}">
      <div class="jds-cab"><h2 class="hub-card-title">Jogo da Semana</h2>${H().tagCompeticao(jogo.competition)}
        <button type="button" class="icon-btn jds-recolher" aria-expanded="${!fechado}" aria-label="${fechado ? "Mostrar" : "Minimizar"} o Jogo da Semana" title="${fechado ? "Mostrar" : "Minimizar"}">${VFN.icone(fechado ? "chevron-down" : "chevron-up", 16)}</button></div>
      <p class="jds-resumo">${esc(casa ? "VFN vs " + nome : nome + " vs VFN")} · ${esc(VFN.dataLonga(jogo.date, true))}</p>
      <div class="jds-corpo">
        <div class="jds-frente">${casa ? vfn : outro}<span class="jds-vs">vs</span>${casa ? outro : vfn}</div>
        <div class="jds-contagem" data-contagem-jogo="${esc(jogo.date)}" aria-label="Tempo até ao jogo">
          <span><b data-parte="d">${c.d}</b><small>dias</small></span><i>:</i><span><b data-parte="h">${String(c.h).padStart(2, "0")}</b><small>horas</small></span><i>:</i><span><b data-parte="m">${String(c.m).padStart(2, "0")}</b><small>min</small></span>
        </div>
        <dl class="jds-info">
          <div><dt>Competição</dt><dd>${VFN.nomeCompeticaoHTML(jogo.competition)}${VFN.etiquetaJornada(jogo) ? " · " + esc(VFN.etiquetaJornada(jogo)) : ""}</dd></div>
          <div><dt>Data</dt><dd>${esc(VFN.dataLonga(jogo.date))}</dd></div>
          <div><dt>Hora</dt><dd>${hora && hora !== "00:00" ? esc(hora) : "—"}</dd></div>
          <div><dt>Local</dt><dd>${casa ? "Casa" : "Fora"}${estadio ? " · " + esc(estadio) : ""} ${VFN.badgeRelvado(est.relvado)}</dd></div>
          <div class="jds-meteo"><dt>Meteorologia</dt><dd data-meteo>${VFN.icone("loader", 14)} a carregar…</dd></div>
        </dl>
        ${opcoes.extra || ""}
      </div>
    </div>`;
  }

  /** Liga o card (contagem a cada segundo, minimizar e meteorologia). */
  async function ligarJogoDaSemana(contentor, dados) {
    const card = contentor && contentor.querySelector("[data-jogo-semana]");
    if (!card) return;
    const botao = card.querySelector(".jds-recolher");
    botao.addEventListener("click", () => {
      const fechado = card.classList.toggle("recolhido");
      botao.setAttribute("aria-expanded", !fechado);
      botao.innerHTML = VFN.icone(fechado ? "chevron-down" : "chevron-up", 16);
      try { localStorage.setItem("vfnJogoSemana", fechado ? "fechado" : "aberto"); } catch (e) { /* ignora */ }
    });
    const jogo = (dados.matches || []).find(j => String(j.id) === card.dataset.jogoSemana);
    // fundo: foto do estádio onde se joga (em casa: vfn.jpg; fora: a do adversário). O banner do Pré-Jogo
    // do admin (#jogoSemanaAdmin) fica só com o gradiente azul do .jds-card (a foto ampliada ficava mal).
    if (contentor.id !== "jogoSemanaAdmin") VFN.aplicarFundoEstadio(contentor, jogo ? (VFN.jogoEmCasa(jogo) ? "vfn" : jogo.opponent_team_id) : "");
    const alvo = card.querySelector("[data-meteo]");
    try {
      const p = await previsaoDoJogo(jogo, dados.teams);
      if (p.indisponivel) alvo.textContent = p.indisponivel;
      else { const [, ic, txt] = meteoDoCodigo(p.codigo); alvo.innerHTML = `<span class="jds-tempo">${VFN.icone(ic, 22)}<b>${p.temp}°C</b> ${esc(txt)}</span>`; }
    } catch (e) { alvo.textContent = "Previsão indisponível."; }
  }

  // contagem decrescente (dias : horas : minutos) de todos os cards visíveis
  setInterval(() => document.querySelectorAll("[data-contagem-jogo]").forEach(el => {
    const c = partesContagem(el.dataset.contagemJogo);
    const por = { d: String(c.d), h: String(c.h).padStart(2, "0"), m: String(c.m).padStart(2, "0") };
    el.querySelectorAll("[data-parte]").forEach(b => { if (b.textContent !== por[b.dataset.parte]) { b.textContent = por[b.dataset.parte]; b.classList.remove("muda"); void b.offsetWidth; b.classList.add("muda"); } });
  }), 1000);

  /* ---------- Puxar para atualizar (telemóvel) ----------
     Em `zonas` (resultados, calendário, jornadas): com a página no topo, puxar para baixo
     mais de 70px mostra o indicador e chama aoAtualizar() (assíncrono). */

  function ligarPuxarParaAtualizar(zonas, aoAtualizar) {
    if (!("ontouchstart" in window)) return;
    let indicador = document.getElementById("vfnPuxar");
    if (!indicador) {
      indicador = document.createElement("div");
      indicador.id = "vfnPuxar";
      indicador.className = "vfn-puxar";
      indicador.setAttribute("role", "status");
      indicador.innerHTML = `<span class="vfn-puxar-ic">${VFN.icone("refresh-cw", 18)}</span><span class="vfn-puxar-txt">Puxa para atualizar</span>`;
      document.body.appendChild(indicador);
    }
    const LIMIAR = 70;
    let inicioY = null, dist = 0, ocupado = false;
    const naZona = alvo => zonas.some(z => z && !z.closest("[hidden]") && z.offsetParent !== null && z.contains(alvo));
    document.addEventListener("touchstart", e => {
      if (ocupado || window.scrollY > 0 || !naZona(e.target) || e.target.closest(".modal-overlay, .vfn-drawer, .mapa-estadios, .bracket-scroll")) { inicioY = null; return; }
      inicioY = e.touches[0].clientY; dist = 0;
    }, { passive: true });
    document.addEventListener("touchmove", e => {
      if (inicioY === null) return;
      dist = Math.max(0, e.touches[0].clientY - inicioY);
      if (!dist) return;
      const d = Math.min(dist, 120);
      indicador.classList.add("visivel");
      indicador.style.transform = `translate(-50%, ${d * 0.6}px)`;
      indicador.querySelector(".vfn-puxar-ic").style.transform = `rotate(${d * 3}deg)`;
      indicador.querySelector(".vfn-puxar-txt").textContent = dist > LIMIAR ? "Larga para atualizar" : "Puxa para atualizar";
    }, { passive: true });
    document.addEventListener("touchend", async () => {
      if (inicioY === null) return;
      inicioY = null;
      if (dist <= LIMIAR) { indicador.classList.remove("visivel"); indicador.style.transform = ""; return; }
      ocupado = true;
      indicador.classList.add("a-atualizar");
      indicador.querySelector(".vfn-puxar-txt").textContent = "A atualizar…";
      try { await aoAtualizar(); } finally {
        ocupado = false;
        indicador.classList.remove("visivel", "a-atualizar");
        indicador.style.transform = "";
      }
    });
  }

  /* ---------- Segmented control (ex.: Classificação | Jornadas | Marcadores) ----------
     Botões [data-seg="x"] dentro de `controlo`; painéis [data-seg-painel="x"] dentro de `raiz`.
     A troca anima o painel novo (fade + slide). Devolve { definir(modo), atual() }. */

  function ligarSegmentos(controlo, raiz, aoMudar, inicial) {
    let atual = inicial || (controlo.querySelector("[data-seg]") || {}).dataset.seg;
    const aplicar = (modo, animar) => {
      atual = modo;
      controlo.querySelectorAll("[data-seg]").forEach(b => { const ativo = b.dataset.seg === modo; b.classList.toggle("ativo", ativo); b.setAttribute("aria-selected", ativo); b.tabIndex = ativo ? 0 : -1; });
      raiz.querySelectorAll("[data-seg-painel]").forEach(p => { p.hidden = p.dataset.segPainel !== modo; if (!p.hidden && animar) VFN.anim.tab(p); });
      if (aoMudar) aoMudar(modo);
    };
    controlo.setAttribute("role", "tablist");
    controlo.addEventListener("click", e => { const b = e.target.closest("[data-seg]"); if (b && b.dataset.seg !== atual) aplicar(b.dataset.seg, true); });
    controlo.addEventListener("keydown", e => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      const botoes = [...controlo.querySelectorAll("[data-seg]")];
      const i = botoes.findIndex(b => b.dataset.seg === atual);
      const seguinte = botoes[(i + (e.key === "ArrowRight" ? 1 : -1) + botoes.length) % botoes.length];
      aplicar(seguinte.dataset.seg, true); seguinte.focus();
    });
    aplicar(atual, false);
    return { definir: m => aplicar(m, true), atual: () => atual };
  }

  /* ---------- Mapa dos estádios (Leaflet + OpenStreetMap, sem chave) ---------- */

  const CENTRO_GUARDA = [40.53, -7.26];

  /** Popup de uma equipa: emblema (64px), nome, estádio, tipo de relvado, cidade e distância ao VFN (em linha reta). */
  function popupEstadioHTML(t, vfn) {
    const e = VFN.estadioDaEquipa(t);
    const ev = VFN.estadioDaEquipa(vfn);
    const souVFN = VFN.eVFN(t.name);
    const km = !souVFN && e.lat != null && ev.lat != null ? VFN.distanciaKm(ev.lat, ev.lng, e.lat, e.lng) : null;
    const logo = VFN.urlLogoEquipa(t, t.name) || (souVFN ? VFN.LOGO_VFN : "");
    return `<div class="mapa-popup" data-estadio="${esc(VFN.idFotoEstadio(t))}">${logo ? `<img class="mapa-popup-logo" src="${esc(logo)}" alt="" width="64" height="64">` : ""}
      <strong>${esc(t.full_name || t.name)}</strong>
      ${e.nome ? `<span>${esc(e.nome)}</span>` : ""}
      <span>${VFN.badgeRelvado(t.surface_type)}</span>
      ${t.city ? `<span>${esc(t.city)}</span>` : ""}
      ${km != null ? `<span class="mapa-km">${Math.round(km)} km do Picoto <small>(em linha reta)</small></span>` : ""}</div>`;
  }

  /**
   * Mapa interativo com o emblema de cada equipa num círculo de 24×24 (contorno na cor principal,
   * âncora ao centro; o VFN sempre por cima). Sem emblema (ou se a imagem falhar): ponto de 20×20 na
   * cor do clube. O popup mostra o emblema grande, o estádio e o relvado.
   * Só se cria quando o contentor fica visível (o Leaflet precisa do tamanho). Devolve { render }.
   */
  function criarMapaEstadios(contentor, obterEquipas) {
    if (!contentor) return { render() {} };
    let mapa = null, camada = null;
    const desenhar = () => {
      if (!mapa) return;
      camada.clearLayers();
      const equipas = obterEquipas() || [];
      const vfn = equipas.find(t => VFN.eVFN(t.name)) || { name: "ACD Vila Franca das Naves" };
      const lista = equipas.some(t => VFN.eVFN(t.name)) ? equipas : [...equipas, vfn];
      let semCoordenadas = 0;
      lista.forEach(t => {
        const e = VFN.estadioDaEquipa(t);
        if (e.lat == null || e.lng == null) { semCoordenadas++; return; }
        const souVFN = VFN.eVFN(t.name);
        const cor = VFN.coresEquipa(t).primaria;
        const logo = VFN.urlLogoEquipa(t, t.name) || (souVFN ? VFN.LOGO_VFN : "");
        const ponto = `<span class="mapa-ponto" style="background:${cor || "#888"}"></span>`;
        // emblema circular; se a imagem não carregar, troca pelo ponto colorido
        const icone = logo
          ? window.L.divIcon({ className: `mapa-pin${souVFN ? " vfn" : ""}`, html: `<img class="mapa-logo" src="${esc(logo)}" alt="" style="border-color:${cor || "#fff"}" onerror="this.outerHTML='${ponto.replace(/"/g, "&quot;")}'">`, iconSize: [24, 24], iconAnchor: [12, 12], popupAnchor: [0, -12] })
          : window.L.divIcon({ className: "mapa-pin", html: ponto, iconSize: [20, 20], iconAnchor: [10, 10], popupAnchor: [0, -10] });
        window.L.marker([e.lat, e.lng], { icon: icone, title: t.name, zIndexOffset: souVFN ? 1000 : 0 }).bindPopup(popupEstadioHTML(t, vfn)).addTo(camada);
      });
      const aviso = contentor.parentElement && contentor.parentElement.querySelector(".mapa-aviso");
      if (aviso) aviso.textContent = semCoordenadas ? `${semCoordenadas} equipa${semCoordenadas === 1 ? "" : "s"} sem coordenadas do estádio.` : "";
    };
    const iniciar = () => {
      if (mapa || !window.L) { if (mapa) mapa.invalidateSize(); return; }
      mapa = window.L.map(contentor, { scrollWheelZoom: false }).setView(CENTRO_GUARDA, 9);
      window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "&copy; OpenStreetMap" }).addTo(mapa);
      camada = window.L.layerGroup().addTo(mapa);
      // popup: foto do estádio no fundo (se existir em assets/stadiums/)
      mapa.on("popupopen", e => {
        const el = e.popup.getElement();
        const conteudo = el && el.querySelector(".mapa-popup");
        if (conteudo) VFN.aplicarFundoEstadio(el.querySelector(".leaflet-popup-content-wrapper"), conteudo.dataset.estadio);
      });
      desenhar();
    };
    if (window.IntersectionObserver) new IntersectionObserver(entradas => { if (entradas.some(e => e.isIntersecting)) iniciar(); }).observe(contentor);
    else iniciar();
    if (!window.L) contentor.innerHTML = '<p class="empty-state">O mapa não carregou. Verifica a ligação à internet.</p>';
    return { render: desenhar };
  }

  /* ---------- Presenças no telemóvel ---------- */

  const NOMES_ESTADO = { P: "Presente", A: "Atraso", F: "Falta", J: "Justificada" };
  const pct = t => { const total = t.P + t.A + t.F + t.J; return total ? Math.round((t.P + t.A) / total * 100) : null; };

  /** Lista de jogadores (vista vertical): resumo do mês e % de presença. linhas: [{ jogador, id, totais }] */
  function listaPresencasHTML(linhas) {
    if (!linhas.length) return "";
    return `<ul class="att-lista">${linhas.map(l => {
      const p = pct(l.totais);
      return `<li><button type="button" class="att-linha" data-presencas-jogador="${esc(l.id)}">
        ${VFN.avatarJogador(l.jogador, "avatar-xs")}
        <span class="att-nome">${esc(l.jogador.nome)}<small>${["P", "A", "F", "J"].filter(k => l.totais[k]).map(k => `<b class="att-chip" data-status="${k}">${k} ${l.totais[k]}</b>`).join("") || '<span class="muted">sem registos</span>'}</small></span>
        <span class="att-pct">${p === null ? "—" : p + "%"}</span>
        ${VFN.icone("chevron-right", 16)}
      </button></li>`;
    }).join("")}</ul>`;
  }

  /**
   * Histórico de presenças de um jogador (drawer).
   * o: { jogador, sessoes: [{ data, tipo, estado }], epoca: { P, A, F, J }, editavel }
   */
  function renderAttendanceDrawer(o) {
    const pe = pct(o.epoca);
    const resumo = `<div class="att-resumo">${VFN.avatarJogador(o.jogador, "avatar-sm")}<div><strong>${esc(o.jogador.nome)}</strong><span>Época: ${pe === null ? "sem registos" : pe + "% de presença"}</span></div>
      <div class="att-totais">${["P", "A", "F", "J"].map(k => `<span class="att-chip" data-status="${k}" title="${NOMES_ESTADO[k]}">${k} ${o.epoca[k]}</span>`).join("")}</div></div>`;
    if (!o.sessoes.length) return resumo + '<p class="muted">Sem sessões neste mês.</p>';
    return resumo + `<ol class="att-historico">${o.sessoes.map((s, i) => `<li>
      <span class="att-data">${VFN.icone(s.tipo === "jogo" ? "goal" : "traffic-cone", 16)}<span>${esc(VFN.dataDDMMAAAA(s.data))}<small>${s.tipo === "jogo" ? "Jogo" : "Treino"}</small></span></span>
      ${o.editavel
        ? `<span class="att-escolha" role="group" aria-label="Estado em ${esc(VFN.dataDDMMAAAA(s.data))}">${["P", "A", "F", "J"].map(k => `<button type="button" class="att-op${s.estado === k ? " ativo" : ""}" data-status="${k}" data-definir="${k}" data-sessao="${i}" aria-pressed="${s.estado === k}" title="${NOMES_ESTADO[k]}">${k}</button>`).join("")}</span>`
        : `<span class="att-chip grande" data-status="${s.estado}">${s.estado ? NOMES_ESTADO[s.estado] : "Sem registo"}</span>`}
    </li>`).join("")}</ol>`;
  }

  /** Alternância "Mês | Lista" (guarda a escolha neste dispositivo). */
  function ligarAlternanciaCalendario(botoes, vistaMes, vistaLista, chave) {
    let modo = "mes";
    try { modo = localStorage.getItem(chave) || "mes"; } catch (e) { /* ignora */ }
    const aplicar = m => {
      modo = m;
      vistaMes.hidden = m !== "mes";
      vistaLista.hidden = m !== "lista";
      botoes.querySelectorAll("[data-modo]").forEach(b => { const ativo = b.dataset.modo === m; b.classList.toggle("active", ativo); b.setAttribute("aria-pressed", ativo); });
      try { localStorage.setItem(chave, m); } catch (e) { /* ignora */ }
    };
    botoes.addEventListener("click", e => { const b = e.target.closest("[data-modo]"); if (b) aplicar(b.dataset.modo); });
    aplicar(modo);
  }

  /* ---------- Arrastar jogadores para o campo (estilo Football Manager) ----------
     Pointer Events (rato e toque). Elementos arrastáveis: [data-arrasta="<origem>"]; alvos:
     [data-alvo="<destino>"]. Também funciona sem arrastar: tocar num jogador e depois no lugar.
     aoLargar(origem, destino) decide o que fazer (destino null = largado fora).
     o.toqueLongo (ms, opcional): no toque (telemóvel), fora de uma pega [data-pega], o arrasto só começa
     depois de um toque longo — antes disso o dedo faz scroll normalmente. Na pega (touch-action: none)
     começa logo. */

  function ligarArrastar(raiz, aoLargar, o) {
    if (!raiz || raiz.dataset.arrastarLigado) return;
    raiz.dataset.arrastarLigado = "1";
    const toqueLongo = (o && o.toqueLongo) || 0;
    let toque = null; // { origem, el, x, y, id, fantasma, espera, longo }
    let selecionado = null;
    const alvoEm = (x, y) => { const e = document.elementFromPoint(x, y); return e && raiz.contains(e) ? e.closest("[data-alvo]") : null; };
    const limparAlvos = () => raiz.querySelectorAll(".alvo-ativo").forEach(a => a.classList.remove("alvo-ativo"));
    const limparSelecao = () => { selecionado = null; raiz.classList.remove("com-selecao"); raiz.querySelectorAll(".arrasta-selecionado").forEach(a => a.classList.remove("arrasta-selecionado")); };

    raiz.addEventListener("pointerdown", e => {
      const el = e.target.closest("[data-arrasta]");
      if (!el || !raiz.contains(el) || e.button > 0) return;
      toque = { origem: el.dataset.arrasta, el, x: e.clientX, y: e.clientY, id: e.pointerId, fantasma: null };
      // toque longo: só no dedo e fora da pega; até lá o movimento é scroll
      if (toqueLongo && e.pointerType === "touch" && !e.target.closest("[data-pega]")) {
        const t = toque;
        t.espera = setTimeout(() => { t.longo = true; el.classList.add("toque-longo"); try { navigator.vibrate && navigator.vibrate(25); } catch (err) { /* sem vibração */ } }, toqueLongo);
      }
    });
    // durante o toque longo o dedo arrasta em vez de fazer scroll
    if (toqueLongo) raiz.addEventListener("touchmove", e => { if (toque && toque.longo) e.preventDefault(); }, { passive: false });
    raiz.addEventListener("pointermove", e => {
      if (!toque || e.pointerId !== toque.id) return;
      if (!toque.fantasma) {
        if (Math.hypot(e.clientX - toque.x, e.clientY - toque.y) < 6) return;
        if (toque.espera && !toque.longo) { clearTimeout(toque.espera); toque = null; return; } // mexeu antes do toque longo: é scroll
        toque.el.classList.remove("toque-longo");
        // começou a arrastar: cópia do elemento a seguir o dedo/rato
        const r = toque.el.getBoundingClientRect();
        toque.fantasma = toque.el.cloneNode(true);
        toque.fantasma.classList.add("arrasta-fantasma");
        toque.fantasma.style.width = r.width + "px";
        document.body.appendChild(toque.fantasma);
        toque.el.classList.add("a-arrastar");
        try { raiz.setPointerCapture(e.pointerId); } catch (err) { /* sem captura */ }
        limparSelecao();
      }
      e.preventDefault();
      toque.fantasma.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%, -50%)`;
      limparAlvos();
      const alvo = alvoEm(e.clientX, e.clientY);
      if (alvo) alvo.classList.add("alvo-ativo");
    });
    const terminar = e => {
      if (!toque || e.pointerId !== toque.id) return;
      const t = toque;
      toque = null;
      if (t.espera) { clearTimeout(t.espera); t.el.classList.remove("toque-longo"); }
      if (!t.fantasma) return; // foi um toque: trata o click
      t.fantasma.remove();
      t.el.classList.remove("a-arrastar");
      limparAlvos();
      if (e.type === "pointercancel") return;
      const alvo = alvoEm(e.clientX, e.clientY);
      raiz.dataset.ignorarClick = "1"; // o click que se segue ao largar não conta como toque
      setTimeout(() => { delete raiz.dataset.ignorarClick; }, 0);
      aoLargar(t.origem, alvo ? alvo.dataset.alvo : null);
    };
    raiz.addEventListener("pointerup", terminar);
    raiz.addEventListener("pointercancel", terminar);
    // tocar num jogador e depois no lugar (telemóvel e teclado)
    raiz.addEventListener("click", e => {
      if (raiz.dataset.ignorarClick) return;
      const el = e.target.closest("[data-arrasta]");
      const alvo = e.target.closest("[data-alvo]");
      if (selecionado && alvo && (!el || el.dataset.arrasta !== selecionado)) {
        const origem = selecionado;
        limparSelecao();
        aoLargar(origem, alvo.dataset.alvo);
        return;
      }
      if (el) {
        const mesmo = selecionado === el.dataset.arrasta;
        limparSelecao();
        if (!mesmo) { selecionado = el.dataset.arrasta; el.classList.add("arrasta-selecionado"); raiz.classList.add("com-selecao"); }
      }
    });
    raiz.addEventListener("keydown", e => {
      if (e.key === "Escape") limparSelecao();
      else if ((e.key === "Enter" || e.key === " ") && e.target.closest("[data-arrasta], [data-alvo]")) { e.preventDefault(); e.target.click(); }
    });
  }

  /* ---------- 11 mais utilizado com tática (dashboard e página pública) ----------
     "Automático": o onze pelas posições do perfil (VFNHub.onzeCampoHTML). Com uma tática: camisolas
     vazias nas posições da formação e a lista de jogadores para arrastar. Só na sessão (sessionStorage),
     não grava na base de dados. */

  const yNoCampo = y => Math.round(8 + y * 0.84); // posições das formações (campo 2:3) no campo 68×105

/**
   * Coloca o onze nas posições da formação: primeiro quem tem essa posição exata (DD no DD), depois
   * quem é da mesma linha (Def/Meio/Ata), por fim quem sobrar. Devolve os ids pela ordem dos lugares.
   */
  function preencherFormacao(onze, lugares) {
    const livres = [...onze];
    const posicoes = lugares.map(() => null);
    const passos = [
      (t, slot) => VFN.posicaoNaCategoria(t.jogador.posicao, "") && String(t.jogador.posicao || "").toUpperCase().split("/").map(x => x.trim()).includes(slot.label.toUpperCase()),
      (t, slot) => VFN.posicaoNaCategoria(t.jogador.posicao, VFN.categoriaPosicao(slot.label)),
      () => true
    ];
    passos.forEach(serve => lugares.forEach((slot, i) => {
      if (posicoes[i]) return;
      const k = livres.findIndex(t => serve(t, slot));
      if (k >= 0) posicoes[i] = String(livres.splice(k, 1)[0].jogador.id);
    }));
    return posicoes;
  }

  function criarOnzeTatico(contentor, opcoes) {
    if (!contentor) return null;
    if (contentor.vfnOnzeTatico) return contentor.vfnOnzeTatico; // já ligado: não repete os eventos
    const chave = "vfnOnzeTatico:" + (opcoes.chave || contentor.id);
    let lista = [];
    let estado = { formacao: "", posicoes: [] };
    try { estado = Object.assign(estado, JSON.parse(sessionStorage.getItem(chave) || "{}")); } catch (e) { /* sem sessionStorage */ }
    const guardar = () => { try { sessionStorage.setItem(chave, JSON.stringify(estado)); } catch (e) { /* sem sessionStorage */ } };
    const porId = id => lista.find(t => String(t.jogador.id) === String(id));
    const slots = () => VFN.FORMACOES_SLOTS[estado.formacao] || [];

    function jogadorNoCampoHTML(t, i, slot) {
      // proficiência na posição (só no dashboard/admin: opcoes.proficiencia)
      const prof = opcoes.proficiencia ? VFN.proficienciaPontoHTML(VFN.proficienciaJogador(t.jogador, slot)) : "";
      return `<div class="pitch-player tatico" style="left:${slot.x}%;top:${yNoCampo(slot.y)}%;width:20%" data-alvo="s:${i}" data-arrasta="s:${i}" tabindex="0" title="${esc(t.jogador.nome)} · ${esc(slot.label)}">
        <span class="pitch-player-avatar">${VFN.avatarJogador(t.jogador, "avatar-sm")}${prof}</span>
        <span class="pitch-player-name"><span>${esc(t.jogador.nome)}</span><b>${t.minutos}'</b></span></div>`;
    }
    function lugarVazioHTML(i, slot) {
      return `<div class="pitch-player tatico vazio" style="left:${slot.x}%;top:${yNoCampo(slot.y)}%;width:20%" data-alvo="s:${i}" tabindex="0" aria-label="Posição ${esc(slot.label)} (vazia)">
        <span class="camisola-vazia">${VFN.generateJerseyAvatar("")}</span>
        <span class="pitch-player-name"><span>${esc(slot.label)}</span></span></div>`;
    }

    function render() {
      const formacoes = VFN.FORMACOES.map(f => `<option value="${esc(f)}" ${f === estado.formacao ? "selected" : ""}>${esc(f)}</option>`).join("");
      const cab = `<div class="onze-tatico-cab"><label class="toolbar-label" for="${esc(contentor.id)}Tatica">Tática</label>
        <select id="${esc(contentor.id)}Tatica" data-tatica><option value="">Automático (posições do perfil)</option>${formacoes}</select>
        ${estado.formacao ? `<button type="button" class="btn btn-ghost btn-sm" data-onze="preencher">Preencher com os mais utilizados</button><button type="button" class="btn btn-ghost btn-sm" data-onze="limpar">Limpar</button>` : ""}</div>`;
      if (!estado.formacao) { contentor.innerHTML = cab + VFNHub.onzeCampoHTML(lista); return; }
      const s = slots();
      estado.posicoes = s.map((_, i) => (estado.posicoes[i] && porId(estado.posicoes[i])) ? String(estado.posicoes[i]) : null);
      const usados = new Set(estado.posicoes.filter(Boolean));
      const livres = lista.filter(t => !usados.has(String(t.jogador.id)));
      contentor.innerHTML = cab + `<div class="onze-tatico">
        <div class="mini-pitch" role="group" aria-label="Campo: ${esc(estado.formacao)}"><span class="mini-pitch-lines" aria-hidden="true"></span>
          ${s.map((slot, i) => { const t = estado.posicoes[i] && porId(estado.posicoes[i]); return t ? jogadorNoCampoHTML(t, i, slot) : lugarVazioHTML(i, slot); }).join("")}
        </div>
        <div class="onze-banco" data-alvo="lista" aria-label="Jogadores">
          <p class="muted onze-dica">Arrasta um jogador para uma posição (ou toca no jogador e depois na posição). Arrasta para aqui para o tirar do campo.</p>
          ${livres.length ? `<ul>${livres.map(t => `<li class="onze-chip" data-arrasta="j:${esc(t.jogador.id)}" tabindex="0">${VFN.avatarJogador(t.jogador, "avatar-xs")}<span>${esc(t.jogador.nome)}<small>${esc(t.jogador.posicao || "")}</small></span><b>${t.minutos}'</b></li>`).join("")}</ul>` : '<p class="muted">Todos os jogadores estão no campo.</p>'}
        </div>
      </div>`;
    }

    function aoLargar(origem, destino) {
      if (!destino) return;
      const [tipo, valor] = origem.split(/:(.+)/);
      const id = tipo === "j" ? valor : estado.posicoes[Number(valor)];
      if (!id) return;
      if (destino === "lista") { if (tipo === "s") estado.posicoes[Number(valor)] = null; }
      else {
        const i = Number(destino.slice(2));
        if (tipo === "s") { const a = Number(valor); [estado.posicoes[a], estado.posicoes[i]] = [estado.posicoes[i] || null, id]; }
        else { estado.posicoes = estado.posicoes.map(p => p === String(id) ? null : p); estado.posicoes[i] = String(id); }
      }
      guardar();
      render();
    }

    contentor.addEventListener("change", e => {
      if (!e.target.matches("[data-tatica]")) return;
      estado.formacao = e.target.value;
      if (!estado.posicoes.some(Boolean)) estado.posicoes = [];
      guardar();
      render();
    });
    contentor.addEventListener("click", e => {
      const b = e.target.closest("[data-onze]");
      if (!b) return;
      if (b.dataset.onze === "limpar") estado.posicoes = [];
      else {
        estado.posicoes = preencherFormacao(VFNHub.onzeMaisUtilizado(lista), slots());
      }
      guardar();
      render();
    });
    ligarArrastar(contentor, aoLargar);
    contentor.vfnOnzeTatico = { atualizar(novaLista) { lista = novaLista || []; render(); } };
    return contentor.vfnOnzeTatico;
  }

  /* ---------- Zonas do golo (formulário do golo: Modo Jogo e tabela de eventos) ----------
     Mini-campo de frente, clicável (SVG): zona do golo (obrigatória) e zona de origem (opcional, mais
     pequeno). A escolha fica em data-valor do .zona-seletor; ligarSeletoresZona trata dos cliques. */

  // linhas do campo (decorativas, por cima das zonas, sem receber cliques)
  const LINHAS_ZONAS = '<g class="zs-linhas" pointer-events="none"><rect x="50" y="0" width="200" height="72"/><rect x="105" y="0" width="90" height="24"/><path d="M122 72 Q150 92 178 72"/><circle cx="150" cy="48" r="1.6"/><path d="M0 150 L0 0 L300 0 L300 150"/><rect class="zs-baliza" x="132" y="-8" width="36" height="8"/></g>';

  function seletorZonaHTML(campo, valor, opcoes) {
    const o = opcoes || {};
    // origem (v15): campo completo (VFN.CAMPO_ORIGEM); golo: meio-campo de frente
    const origem = campo === "zona_origem";
    const zonas = origem ? VFN.ZONAS_ORIGEM : VFN.ZONAS_GOLO;
    return `<div class="zona-seletor${o.pequeno ? " pequeno" : ""}${origem ? " campo-completo" : ""}" data-campo="${campo}" data-valor="${esc(valor || "")}">
      <svg viewBox="${origem ? VFN.CAMPO_ORIGEM.viewBox : "0 -10 300 160"}" role="group" aria-label="${esc(o.rotulo || "Zona")}">
        ${zonas.map(z => `<polygon class="zs-zona${z.id === valor ? " sel" : ""}" points="${z.pts}" data-zona="${z.id}" tabindex="0" role="button" aria-pressed="${z.id === valor}" aria-label="${esc(z.nome)}"><title>${esc(z.nome)}</title></polygon>`).join("")}
        ${origem ? VFN.CAMPO_ORIGEM.linhas("zs") : LINHAS_ZONAS}
      </svg>
      <span class="zs-escolha">${valor ? esc(VFN.nomeZona(valor)) : (o.obrigatorio ? "Toca na zona" : "Opcional")}</span>
    </div>`;
  }

  /** Zona do golo, zona de origem, tipo de lance e "golo sofrido" (p = prefixo dos ids). */
  function camposZonasGoloHTML(ev, p, sofrido) {
    return `<div class="zonas-golo">
      <div class="zg-campo"><span class="zg-rotulo">Zona do golo <b>*</b></span>${seletorZonaHTML("zona_golo", ev.zona_golo, { obrigatorio: true, rotulo: "Zona do golo" })}</div>
      <div class="zg-campo"><span class="zg-rotulo">Zona de origem da jogada <small>(opcional)</small></span>${seletorZonaHTML("zona_origem", ev.zona_origem, { pequeno: true, rotulo: "Zona de origem da jogada" })}</div>
      <fieldset class="zg-lance"><legend class="zg-rotulo">Tipo de lance</legend>${VFN.TIPOS_LANCE.map(([v, t]) => `<label><input type="radio" name="${p}TipoLance" value="${v}" ${ev.tipo_lance === v ? "checked" : ""}> ${esc(t)}</label>`).join("")}</fieldset>
      <label class="zg-sofrido"><input type="checkbox" id="${p}Sofrido" ${sofrido ? "checked" : ""}> Golo sofrido</label>
    </div>`;
  }

  /** Cliques (e Enter/Espaço) nas zonas: marca a escolhida; tocar outra vez na origem (opcional) limpa. */
  function ligarSeletoresZona(raiz, aoMudar) {
    if (!raiz || raiz.dataset.zonasLigadas) return;
    raiz.dataset.zonasLigadas = "1";
    const escolher = alvo => {
      const caixa = alvo.closest(".zona-seletor");
      const opcional = caixa.dataset.campo === "zona_origem";
      const novo = opcional && caixa.dataset.valor === alvo.dataset.zona ? "" : alvo.dataset.zona;
      caixa.dataset.valor = novo;
      caixa.querySelectorAll(".zs-zona").forEach(z => { z.classList.toggle("sel", z.dataset.zona === novo); z.setAttribute("aria-pressed", String(z.dataset.zona === novo)); });
      caixa.querySelector(".zs-escolha").textContent = novo ? VFN.nomeZona(novo) : opcional ? "Opcional" : "Toca na zona";
      if (aoMudar) aoMudar(caixa.dataset.campo, novo);
    };
    raiz.addEventListener("click", e => { const z = e.target.closest(".zs-zona"); if (z && raiz.contains(z)) escolher(z); });
    raiz.addEventListener("keydown", e => { const z = e.target.closest(".zs-zona"); if (z && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); escolher(z); } });
  }

  /** Lê os campos de camposZonasGoloHTML para o evento (zona_golo, zona_origem, tipo_lance). */
  function lerZonasGolo(raiz, p) {
    const valor = campo => { const c = raiz.querySelector(`.zona-seletor[data-campo="${campo}"]`); return c ? c.dataset.valor || "" : ""; };
    const lance = raiz.querySelector(`input[name="${p}TipoLance"]:checked`);
    return { zona_golo: valor("zona_golo"), zona_origem: valor("zona_origem"), tipo_lance: lance ? lance.value : "" };
  }

  /* ---------- Comparação de dois jogadores (dashboard e admin) ----------
     Jogador "normalizado": { id, nome, numero, posicao, fotoUrl, jogos, minutos, golos, assistencias,
     amarelos, vermelhos, gr: { jogosZero, minutosSemSofrer } | null }.
     Barras: o maior valor de cada linha fica com 100% da cor do clube (#043792), o outro proporcional. */

  const COR_CLUBE = "#043792";
  const categoriaDe = j => VFN.categoriaPosicao(j && j.posicao) || "";

  function linhasComparacao(a, b) {
    const gr = categoriaDe(a) === "GR" && categoriaDe(b) === "GR";
    const linhas = [["Jogos", j => j.jogos], ["Minutos", j => j.minutos]];
    if (gr) linhas.push(["Jogos a zero", j => (j.gr || {}).jogosZero || 0], ["Minutos sem sofrer", j => (j.gr || {}).minutosSemSofrer || 0, "maior série"]);
    else linhas.push(["Golos", j => j.golos], ["Assistências", j => j.assistencias]);
    linhas.push(["Cartões amarelos", j => j.amarelos], ["Cartões vermelhos", j => j.vermelhos]);
    return linhas;
  }

  function comparacaoHTML(a, b, candidatos) {
    const lado = (j, qual) => `<div class="cmp-jogador">
      ${VFN.avatarJogador(j, "avatar-sm")}
      <strong>${esc(j.nome)}</strong><small>${esc(j.posicao || "")}${j.numero !== "" && j.numero != null ? " · Nº " + esc(j.numero) : ""}</small>
      <label class="cmp-trocar"><span class="sr-only">Trocar jogador</span><select data-cmp-trocar="${qual}">${candidatos.map(c => `<option value="${esc(c.id)}" ${String(c.id) === String(j.id) ? "selected" : ""} ${String(c.id) === String((qual === "a" ? b : a).id) ? "disabled" : ""}>${esc(c.nome)}</option>`).join("")}</select></label>
    </div>`;
    const barra = (v, max, lado) => `<span class="cmp-barra ${lado}"><i style="width:${max ? Math.round(v / max * 100) : 0}%;background:${COR_CLUBE}"></i></span>`;
    return `<div class="cmp-cab">${lado(a, "a")}<span class="cmp-vs">vs</span>${lado(b, "b")}<button type="button" class="modal-x cmp-fechar" data-cmp="fechar" aria-label="Fechar comparação">×</button></div>
      <div class="cmp-corpo">${linhasComparacao(a, b).map(([rotulo, f, nota]) => {
        const va = Number(f(a)) || 0, vb = Number(f(b)) || 0, max = Math.max(va, vb);
        return `<div class="cmp-linha"><span class="cmp-valor${va > vb ? " maior" : ""}">${va}</span><span class="cmp-rotulo">${esc(rotulo)}${nota ? `<small>${esc(nota)}</small>` : ""}</span><span class="cmp-valor${vb > va ? " maior" : ""}">${vb}</span>${barra(va, max, "esq")}${barra(vb, max, "dir")}</div>`;
      }).join("")}</div>`;
  }

  /** Abre (ou atualiza) o modal. o: { jogador(id) → normalizado, candidatos(categoria) → normalizados } */
  function abrirComparacao(idA, idB, o) {
    let caixa = document.getElementById("vfnComparacao");
    if (!caixa) {
      caixa = document.createElement("div");
      caixa.id = "vfnComparacao";
      caixa.className = "modal-overlay cmp-overlay";
      caixa.innerHTML = '<div class="modal-box cmp-box" role="dialog" aria-modal="true" aria-label="Comparação de jogadores"></div>';
      document.body.appendChild(caixa);
      caixa.addEventListener("click", e => { if (e.target === caixa || e.target.closest("[data-cmp=fechar]")) caixa.hidden = true; });
      document.addEventListener("keydown", e => { if (e.key === "Escape" && !caixa.hidden) caixa.hidden = true; });
    }
    const desenhar = (a, b) => {
      const ja = o.jogador(a), jb = o.jogador(b);
      if (!ja || !jb) return;
      const caixaInterna = caixa.querySelector(".cmp-box");
      caixaInterna.innerHTML = comparacaoHTML(ja, jb, o.candidatos(categoriaDe(ja)));
      // trocar um dos jogadores sem fechar o modal
      caixaInterna.querySelectorAll("[data-cmp-trocar]").forEach(s => s.addEventListener("change", () => desenhar(s.dataset.cmpTrocar === "a" ? s.value : a, s.dataset.cmpTrocar === "b" ? s.value : b)));
    };
    desenhar(idA, idB);
    caixa.hidden = false;
    const fechar = caixa.querySelector(".cmp-fechar");
    if (fechar) fechar.focus();
  }

  /**
   * Liga a comparação a uma lista: botões [data-comparar="<id>"] (no dashboard aparecem ao passar o rato
   * ou com toque longo no cartão). 1.º clique escolhe o jogador; depois, clicar noutro da mesma posição
   * (no botão ou, com opcoes.alvo, no próprio cartão) abre o modal.
   * o: { jogador(id), candidatos(categoria), alvo: seletor dos cartões, idDoAlvo(el) }
   */
  function ligarComparacao(raiz, o) {
    if (!raiz || raiz.dataset.comparacaoLigada) return;
    raiz.dataset.comparacaoLigada = "1";
    let escolhido = null, ignorarClique = false, temporizador = null, inicioToque = null;
    const aviso = document.createElement("div");
    aviso.className = "cmp-aviso";
    aviso.hidden = true;
    aviso.setAttribute("role", "status");
    raiz.parentNode.insertBefore(aviso, raiz);
    const marcar = () => {
      raiz.querySelectorAll(".cmp-selecionado").forEach(x => x.classList.remove("cmp-selecionado"));
      const j = escolhido && o.jogador(escolhido);
      aviso.hidden = !j;
      if (!j) return;
      raiz.querySelectorAll(`[data-comparar="${CSS.escape(String(escolhido))}"]`).forEach(b => (b.closest(".cmp-item") || b).classList.add("cmp-selecionado"));
      aviso.innerHTML = `<span>⚖ A comparar <b>${esc(j.nome)}</b>: escolhe outro ${esc((VFN.NOME_CATEGORIA[categoriaDe(j)] || "jogador").toLowerCase())}.</span><button type="button" class="btn btn-ghost btn-sm">Cancelar</button>`;
      aviso.querySelector("button").onclick = () => { escolhido = null; marcar(); };
    };
    const escolher = id => {
      if (!escolhido || String(escolhido) === String(id)) { escolhido = escolhido ? null : id; marcar(); return; }
      const a = o.jogador(escolhido), b = o.jogador(id);
      if (!a || !b) return;
      if (categoriaDe(a) !== categoriaDe(b)) {
        aviso.querySelector("span").innerHTML = `⚖ <b>${esc(b.nome)}</b> não é da mesma posição que <b>${esc(a.nome)}</b> (${esc(VFN.NOME_CATEGORIA[categoriaDe(a)] || "—")}).`;
        return;
      }
      const primeiro = escolhido;
      escolhido = null;
      marcar();
      abrirComparacao(primeiro, id, o);
    };
    // fase de captura: com um jogador escolhido, o clique noutro cartão compara (não abre a ficha)
    raiz.addEventListener("click", e => {
      if (ignorarClique) { ignorarClique = false; e.stopPropagation(); e.preventDefault(); return; }
      const botao = e.target.closest("[data-comparar]");
      if (botao) { e.stopPropagation(); e.preventDefault(); escolher(botao.dataset.comparar); return; }
      const cartao = o.alvo && escolhido && e.target.closest(o.alvo);
      if (cartao) { e.stopPropagation(); e.preventDefault(); escolher(o.idDoAlvo(cartao)); }
    }, true);
    // toque longo (telemóvel): mostra o botão "Comparar" do cartão
    if (o.alvo) {
      const cancelar = () => { clearTimeout(temporizador); temporizador = null; };
      raiz.addEventListener("pointerdown", e => {
        const cartao = e.target.closest(o.alvo);
        if (!cartao || e.pointerType === "mouse") return;
        cancelar();
        inicioToque = { x: e.clientX, y: e.clientY };
        temporizador = setTimeout(() => {
          raiz.querySelectorAll(".mostrar-comparar").forEach(x => x.classList.remove("mostrar-comparar"));
          (cartao.closest(".cmp-item") || cartao).classList.add("mostrar-comparar");
          ignorarClique = true; // o toque longo não abre a ficha
          if (navigator.vibrate) navigator.vibrate(15);
        }, 550);
      });
      // só cancela se o dedo se mexer mais de 8px (arrastar a lista), não por um tremor
      ["pointerup", "pointercancel", "scroll"].forEach(t => raiz.addEventListener(t, cancelar, { passive: true }));
      raiz.addEventListener("pointermove", e => { if (temporizador && inicioToque && Math.hypot(e.clientX - inicioToque.x, e.clientY - inicioToque.y) > 8) cancelar(); }, { passive: true });
      raiz.addEventListener("contextmenu", e => { if (e.target.closest(o.alvo)) e.preventDefault(); });
    }
  }

  /* ---------- Imagem do resultado para o Instagram (1080 × 1080) ----------
     Elemento de 540 × 540 exportado com html2canvas a scale 2 (exportarImagemHTML) → PNG 1080 × 1080.
     Cores do clube: fundo #0A102D → #131E4E, resultado e destaques #E8D137, texto #D8D8D3. */

  /** Golos do jogo: [{ vfn, minuto, nome }] do relatório (com minuto) ou, sem ele, do calendário. */
  function golosParaImagem(jogo, relatorio, nomeJogador) {
    const ev = (((relatorio || {}).match_data || {}).jogo || {}).eventos || [];
    const golos = ev.filter(e => e.tipo === "Golo" || e.tipo === "Auto-golo")
      .sort((a, b) => (Number(a.minuto) || 0) - (Number(b.minuto) || 0) || (Number(a.acrescimo) || 0) - (Number(b.acrescimo) || 0))
      .map(e => ({
        vfn: !VFN.eGoloSofrido(e),
        minuto: `${Number(e.minuto) || 0}${Number(e.acrescimo) > 0 ? "+" + Number(e.acrescimo) : ""}'`,
        nome: (e.equipa === "VFN" ? (nomeJogador && nomeJogador(e.jogadorId)) || e.detalhe || "VFN" : e.detalhe || "Adversário") + (e.tipo === "Auto-golo" ? " (a.g.)" : e.tipo_lance === "penalty" ? " (g.p.)" : "")
      }));
    if (golos.length || !Array.isArray(jogo.scorer_list)) return golos;
    return jogo.scorer_list.map(s => ({ vfn: !VFN.eGoloAdversario(s), minuto: s.minute != null ? s.minute + "'" : "", nome: `${s.player_name || "?"}${Number(s.count) > 1 ? " ×" + s.count : ""}` }));
  }

  function resultadoImagemHTML(dados, jogo, relatorio, o) {
    const casa = VFN.jogoEmCasa(jogo);
    const nomeAdv = H().nomeAdversario(dados, jogo);
    const adv = H().equipa(dados, jogo.opponent_team_id);
    const jr = ((relatorio || {}).match_data || {}).jogo || {};
    const g = VFN.golosJogo(jogo) || { vfn: 0, adv: 0 };
    // o relatório aberto (admin) pode ter o resultado mais recente do que o calendário
    const golosVFN = jr.golosVFN != null && jr.golosVFN !== "" ? Number(jr.golosVFN) : g.vfn;
    const golosAdv = jr.golosAdversario != null && jr.golosAdversario !== "" ? Number(jr.golosAdversario) : g.adv;
    const lado = (logo, nome) => `<div class="igr-equipa">${logo ? `<img src="${esc(logo)}" alt="" crossorigin="anonymous">` : `<span class="igr-sem-logo">${esc(String(nome).slice(0, 2).toUpperCase())}</span>`}<strong>${esc(nome)}</strong></div>`;
    const vfn = lado("assets/logo.png", "ACD VF Naves"), outro = lado(VFN.urlLogoEquipa(adv, nomeAdv), nomeAdv);
    const golos = golosParaImagem(jogo, relatorio, o && o.nomeJogador);
    const coluna = doVFN => golos.filter(x => x.vfn === doVFN).map(x => `<li><b>${esc(x.minuto)}</b> ${esc(x.nome)}</li>`).join("");
    const etiqueta = VFN.etiquetaJornada(jogo);
    return `<div class="ig-resultado">
      <img class="igr-escudo" src="assets/logo.png" alt="">
      <div class="igr-jogo">${casa ? vfn : outro}<span class="igr-vs">vs</span>${casa ? outro : vfn}</div>
      <div class="igr-placar">${casa ? golosVFN : golosAdv}<span>–</span>${casa ? golosAdv : golosVFN}</div>
      ${golos.length ? `<div class="igr-golos"><ul>${coluna(casa)}</ul><ul>${coluna(!casa)}</ul></div>` : ""}
      <p class="igr-rodape">${esc(jogo.competition || "")}${etiqueta ? " · " + esc(etiqueta) : ""} · ${esc(VFN.dataLonga(jogo.date))}<br><b>ACD Vila Franca das Naves</b></p>
    </div>`;
  }

  /**
   * Gera e descarrega (no telemóvel: abre a partilha) o PNG do resultado: resultado-{adversario}-{data}.png.
   * dados: { matches, teams, match_reports }; o.nomeJogador(idLocal) dá os nomes dos marcadores do relatório.
   */
  async function gerarImagemResultado(matchId, dados, o) {
    const jogo = ((dados && dados.matches) || []).find(j => String(j.id) === String(matchId));
    if (!jogo) { alert("Jogo não encontrado."); return; }
    const relatorio = H().relatorioDoJogo(dados, jogo.id);
    const nome = `resultado-${VFN.slug(H().nomeAdversario(dados, jogo))}-${VFN.dataIso(jogo.date) || "sem-data"}.png`;
    return exportarImagemHTML(resultadoImagemHTML(dados, jogo, relatorio, o), { nome, titulo: "Resultado VFN", largura: 540, fundo: "#0A102D" });
  }

  window.VFNComp = {
    gerarImagemResultado, resultadoImagemHTML,
    abrirComparacao, ligarComparacao,
    seletorZonaHTML, camposZonasGoloHTML, ligarSeletoresZona, lerZonasGolo,
    ligarArrastar, criarOnzeTatico, ordenarConvocados,
    renderMatchCard, renderPlayerCard, renderBracket, ligarBrackets,
    abrirDrawer, fecharDrawer,
    dividasPorPessoa, multasEmDivida, opcoesTipoDividaHTML, renderDebtReport, exportarImagemDividas, exportarImagemHTML,
    MIN_CONVOCADOS, MAX_CONVOCADOS, convocatoriaDoJogo, proximaConvocatoria, jogadoresDosIds, renderSquadView, renderAnuncioConvocatoria, exportarAnuncioConvocatoria,
    listaPresencasHTML, renderAttendanceDrawer,
    criarMapaEstadios, popupEstadioHTML,
    ligarSegmentos, ligarPuxarParaAtualizar, renderJogoDaSemana, ligarJogoDaSemana, previsaoDoJogo,
    eventosDoDia, aniversariosDoDia, renderCalendarDay, calendarioMensalHTML, detalheDiaHTML, renderMatchEvents, escalacaoHTML, criarCalendarioMensal, ligarAlternanciaCalendario
  };
})();
