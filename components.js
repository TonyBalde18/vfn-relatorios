/* =========================================================
   VFN — Componentes reutilizáveis (admin, dashboard e página pública)
   Só apresentação: recebem os dados já carregados e devolvem HTML
   ou ligam eventos. Expostos em window.VFNComp.
   Depende de shared.js (VFN) e hub.js (VFNHub).
   ========================================================= */
(function () {
  "use strict";

  const esc = VFN.escapeHtml;
  const H = () => window.VFNHub;

  /* ---------- Drawer (bottom-sheet no telemóvel, painel ao centro no computador) ---------- */

  let drawerAberto = null;

  function fecharDrawer() {
    const d = document.getElementById("vfnDrawer");
    if (!d || d.hidden) return;
    d.classList.remove("aberto");
    setTimeout(() => { d.hidden = true; }, 220);
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

  /** Jogos do VFN e treinos de um dia. dados: { matches, sessions }. */
  function eventosDoDia(dados, dia) {
    return {
      jogos: VFN.jogosDoVFN(dados.matches).filter(j => VFN.dataIso(j.date) === dia && VFN.estadoJogo(j) !== "cancelado"),
      treinos: (dados.sessions || []).filter(s => s.session_date === dia && s.session_type === "treino")
    };
  }

  /** Célula de um dia: número, cone nos treinos, logo do adversário + casa/fora nos jogos. */
  function renderCalendarDay(data, eventos, opcoes) {
    const o = opcoes || {};
    const dia = iso(data);
    const jogo = eventos.jogos[0];
    const classes = ["cal-dia", o.hoje ? "hoje" : "", o.selecionado ? "selecionado" : "", jogo ? "com-jogo" : "", eventos.treinos.length ? "com-treino" : "",
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
    const descricao = [jogo ? `Jogo ${VFN.jogoEmCasa(jogo) ? "em casa" : "fora"} com ${H().nomeAdversario(o.dados || {}, jogo)}` : "", eventos.treinos.length ? "Treino" : ""].filter(Boolean).join(", ");
    return `<button type="button" class="${classes}" data-dia="${dia}" aria-label="${esc(VFN.dataLonga(dia + "T12:00:00") + (descricao ? ": " + descricao : ""))}"${o.selecionado ? ' aria-pressed="true"' : ""}>
      <span class="cal-num">${data.getDate()}</span>${partes.length ? `<span class="cal-icones">${partes.join("")}</span>` : ""}
    </button>`;
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
      <div class="cal-legenda"><span>${VFN.icone("traffic-cone", 12)} Treino</span><span>${VFN.icone("house", 12)} Casa</span><span>${VFN.icone("bus", 12)} Fora</span><span><i class="leg-res res-V"></i>V <i class="leg-res res-E"></i>E <i class="leg-res res-D"></i>D</span></div>`;
  }

  /* ---------- Detalhe do dia (drawer) ---------- */

  /** Timeline de eventos de um jogo a partir do relatório. */
  function renderMatchEvents(relatorio, nomeJogador) {
    const eventos = H().eventosDoRelatorio(relatorio, nomeJogador);
    if (!eventos.length) return '<p class="muted">Sem eventos registados.</p>';
    return `<ol class="ev-lista">${eventos.map(e => `<li class="${e.neutro ? "neutro" : e.vfn ? "vfn" : "adv"}"><span class="ev-min">${e.minuto}${e.acrescimo ? "+" + e.acrescimo : ""}'</span><span class="ev-tipo">${esc(e.tipo)}</span><span class="ev-texto">${esc(e.texto)}</span></li>`).join("")}</ol>`;
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
        <div><dt>Competição</dt><dd>${esc(jogo.competition || "—")}</dd></div>
        ${fase ? `<div><dt>Fase</dt><dd>${esc(fase)}</dd></div>` : jogo.jornada ? `<div><dt>Jornada</dt><dd>${esc(jogo.jornada)}</dd></div>` : ""}
        <div><dt>Data</dt><dd>${esc(VFN.dataLonga(jogo.date))}</dd></div>
        <div><dt>Hora</dt><dd>${hora && hora !== "00:00" ? esc(hora) : "—"}</dd></div>
        <div><dt>Local</dt><dd>${esc(jogo.venue || (casa ? "Casa" : "—"))}</dd></div>
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
   * Conteúdo do drawer de um dia. o: { perfil: "publico" | "staff" | "admin", nomeRelatorio(idLocal), nomePresenca(playerId) }.
   */
  function detalheDiaHTML(dados, dia, o) {
    const { jogos, treinos } = eventosDoDia(dados, dia);
    const staff = o.perfil === "staff" || o.perfil === "admin";
    const passado = dia < iso(new Date());
    const blocos = [];
    jogos.forEach(j => blocos.push(detalheJogoDiaHTML(dados, j, { ...o, comRelatorios: staff })));
    treinos.forEach(t => blocos.push(`<section class="dia-bloco dia-treino">
      <h4>${VFN.icone("traffic-cone", 16)} Treino</h4>
      <dl class="dia-info"><div><dt>Hora</dt><dd>${esc(t.start_time ? String(t.start_time).slice(0, 5) : "—")}</dd></div><div><dt>Local</dt><dd>${esc(t.location || "—")}</dd></div>${staff && t.notes ? `<div><dt>Notas</dt><dd>${esc(t.notes)}</dd></div>` : ""}</dl>
    </section>`));
    if (staff && passado && (jogos.length || treinos.length)) blocos.push(`<section class="dia-bloco"><h4>${VFN.icone("calendar-check", 16)} Presenças</h4>${presencasDiaHTML(dados, dia, o.nomePresenca || (() => ""))}</section>`);
    if (!blocos.length) blocos.push('<p class="muted dia-vazio">Sem treinos nem jogos neste dia.</p>');
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

  window.VFNComp = {
    abrirDrawer, fecharDrawer,
    listaPresencasHTML, renderAttendanceDrawer,
    eventosDoDia, renderCalendarDay, calendarioMensalHTML, detalheDiaHTML, renderMatchEvents, escalacaoHTML, criarCalendarioMensal, ligarAlternanciaCalendario
  };
})();
