"use strict";

/* =========================================================
   PLANTEL (V2.0) — vistas partilhadas pelo dashboard e pela Área do Jogador
   Visão Geral (lista do plantel, disponibilidade, disciplina, 11 mais utilizado, marcadores e minutos)
   e a lista Equipa detalhada (estatísticas completas; botão de editar só para o admin).
   ========================================================= */

(function () {
  const esc = s => VFN.escapeHtml(s);
  const H = () => window.VFNHub;

  /** eDele(idLocal) de um jogador do plantel: liga os ids locais dos relatórios ao jogador. */
  const eDoJogador = (j, jogadorDoRelatorio) => idLocal => { const x = jogadorDoRelatorio(idLocal); return !!x && String(x.id) === String(j.id); };

  /** Suspensões (AF Guarda) na competição do próximo jogo, com os relatórios e o calendário. */
  function suspensaoDe(dados, j, jogadorDoRelatorio) {
    const proximo = VFN.proximoJogo(dados.matches);
    return H().calcularSuspensoes(j.id, dados, { eDele: eDoJogador(j, jogadorDoRelatorio), competicao: proximo && proximo.competition });
  }

  const idadeDe = j => { const n = j.info && j.info.nascimento; const i = n ? H().idade(n) : null; return i && i > 0 ? i : null; };
  const filtrar = (jogadores, posicao, estado) => VFN.ordenarPorPosicao(jogadores)
    .filter(j => !posicao || VFN.categoriaPosicao(j.posicao) === posicao)
    .filter(j => !estado || (j.disponibilidade || "disponivel") === estado);
  const jogadorHTML = j => `<span class="pl-jogador">${VFN.avatarJogador(j, "avatar-xs")}<span><strong>${esc(j.nome)}</strong>${j.subPosicao ? `<small>${esc(j.subPosicao)}</small>` : ""}</span></span>`;

  /* ---------- Visão Geral ---------- */

  /** Lista compacta do plantel: nº, jogador, posição, idade, jogos, minutos, G, A, cartões e estado. */
  function listaPlantelHTML(jogadores, o) {
    const lista = filtrar(jogadores, o.posicao, "");
    if (!lista.length) return H().vazio("Sem jogadores.");
    return `<div class="table-wrap"><table class="stats-table plantel-tabela" data-ordenar="plantel-visao">
      <thead><tr><th scope="col" class="num" data-tipo="numero">Nº</th><th scope="col" data-tipo="texto">Jogador</th><th scope="col" data-tipo="texto">Pos</th><th scope="col" class="num col-sec" data-tipo="numero">Idade</th><th scope="col" class="num" data-tipo="numero" title="Jogos">J</th><th scope="col" class="num" data-tipo="numero" title="Minutos">Min</th><th scope="col" class="num col-sec" data-tipo="numero" title="Golos">G</th><th scope="col" class="num col-sec" data-tipo="numero" title="Assistências">A</th><th scope="col" class="num col-sec" data-tipo="numero" title="Cartões amarelos">🟨</th><th scope="col" data-tipo="texto">Estado</th></tr></thead>
      <tbody>${lista.map(j => { const i = idadeDe(j); return `<tr data-jogador="${esc(j.id)}" tabindex="0">
        <td class="num">${esc(j.numero)}</td><td>${jogadorHTML(j)}</td><td>${esc(j.posicao)}</td><td class="num col-sec" data-v="${i || 0}">${i || "—"}</td>
        <td class="num">${j.jogos}</td><td class="num" data-v="${j.minutos}">${j.minutos}'</td><td class="num col-sec">${j.golos}</td><td class="num col-sec">${j.assistencias}</td><td class="num col-sec">${j.cartoesA}</td>
        <td data-v="${esc(j.disponibilidade || "disponivel")}">${j.disponibilidade ? VFN.badgeDisponibilidade(j.disponibilidade, true) : "—"}</td></tr>`; }).join("")}</tbody>
    </table></div>`;
  }

  /**
   * Destaques de disponibilidade (compacto, ao lado da lista): convocáveis por posição e, em lista, só quem não está
   * (lesionado, suspenso, indisponível) ou está em dúvida. As suspensões automáticas contam como indisponíveis.
   */
  function disponibilidadeCompactaHTML(dados, jogadores, jogadorDoRelatorio) {
    const jogo = VFN.proximoJogo(dados.matches);
    const comEstado = VFN.ordenarPorPosicao(jogadores).map(j => ({ j, s: suspensaoDe(dados, j, jogadorDoRelatorio) }));
    const fora = comEstado.filter(x => x.s.suspenso || ["lesionado", "suspenso", "indisponivel"].includes(x.j.disponibilidade));
    const duvida = comEstado.filter(x => !fora.includes(x) && x.j.disponibilidade === "em_duvida");
    const conv = comEstado.filter(x => !fora.includes(x)).map(x => x.j);
    const porCategoria = ["GR", "Def", "Meio", "Ata"].map(c => `<span>${{ GR: "GR", Def: "Def", Meio: "Méd", Ata: "Ava" }[c]} <b>${conv.filter(j => VFN.categoriaPosicao(j.posicao) === c).length}</b></span>`).join("");
    const linha = (x, extra) => `<li data-jogador="${esc(x.j.id)}">${VFN.avatarJogador(x.j, "avatar-xs")}<span class="disc-nome">${esc(x.j.nome)}<small class="muted">${esc(x.j.posicao)}</small></span>${extra}</li>`;
    return `${jogo ? `<p class="disp-jogo">${VFN.icone("calendar-days", 16)} ${esc(VFN.jogoEmCasa(jogo) ? "VFN vs " + H().nomeAdversario(dados, jogo) : H().nomeAdversario(dados, jogo) + " vs VFN")} · ${esc(VFN.dataCurta(jogo.date))}</p>` : ""}
      <div class="disp-totais"><span class="disp-total ok"><b>${conv.length}</b> convocáveis</span><span class="disp-total nao"><b>${fora.length}</b> indisponíveis</span></div>
      <div class="disp-resumo">${porCategoria}</div>
      ${fora.length ? `<h3 class="disc-titulo">Indisponíveis</h3><ul class="disc-lista">${fora.map(x => linha(x, x.s.suspenso ? H().badgeSuspensao(x.s) : VFN.badgeDisponibilidade(x.j.disponibilidade, true))).join("")}</ul>` : '<p class="muted">Todo o plantel disponível.</p>'}
      ${duvida.length ? `<h3 class="disc-titulo">Em dúvida</h3><ul class="disc-lista">${duvida.map(x => linha(x, VFN.badgeDisponibilidade("em_duvida", true))).join("")}</ul>` : ""}`;
  }

  /** Disciplina: suspensos e em risco (competição do próximo jogo) e os jogadores com mais cartões. */
  function disciplinaHTML(dados, jogadores, jogadorDoRelatorio) {
    const comSusp = jogadores.map(j => ({ j, s: suspensaoDe(dados, j, jogadorDoRelatorio) }));
    const alerta = comSusp.filter(x => x.s.suspenso || H().emRiscoAmarelos(x.s));
    const peso = j => j.cartoesA + 2 * j.cartoesV;
    const cartoes = jogadores.filter(j => peso(j) > 0 && !alerta.some(x => x.j === j)).sort((a, b) => peso(b) - peso(a) || a.nome.localeCompare(b.nome, "pt")).slice(0, 5);
    const linha = (j, extra) => `<li data-jogador="${esc(j.id)}">${VFN.avatarJogador(j, "avatar-xs")}<span class="disc-nome">${esc(j.nome)}<small class="muted">${esc(j.posicao)}</small></span>${extra}</li>`;
    const cartoesHTML = j => `<span class="disc-cartoes"><span title="Amarelos">🟨 ${j.cartoesA}</span>${j.cartoesV ? `<span title="Vermelhos">🟥 ${j.cartoesV}</span>` : ""}</span>`;
    if (!alerta.length && !cartoes.length) return H().vazio("Sem cartões nem suspensões.");
    return `${alerta.length ? `<h3 class="disc-titulo">Suspensos e em risco</h3><ul class="disc-lista">${alerta.map(x => linha(x.j, H().badgeSuspensao(x.s))).join("")}</ul>` : ""}
      ${cartoes.length ? `<h3 class="disc-titulo">Mais cartões</h3><ul class="disc-lista">${cartoes.map(j => linha(j, cartoesHTML(j))).join("")}</ul>` : ""}
      <p class="muted disc-nota">AF Guarda: 1 jogo ao 5.º, 9.º, 12.º e 14.º amarelo em cada competição.</p>`;
  }

  /**
   * Liga a Visão Geral do Plantel a um contentor.
   * o: { obterDados(), jogadores(), jogadorDoRelatorio(idLocal) }. Devolve { render, esqueleto }.
   */
  function criarVisaoGeral(contentor, o) {
    let posicao = "";
    contentor.innerHTML = `<div class="plantel-grid">
        <article class="card plantel-lista" data-aos="fade-up">
          <div class="hub-card-head"><h2 class="hub-card-title">Plantel <small class="muted" data-parte="total"></small></h2><div class="filter-chips" data-parte="filtros" role="group" aria-label="Filtrar por posição"></div></div>
          <div data-parte="lista"></div>
        </article>
        <div class="plantel-coluna">
          <article class="card" data-aos="fade-up" data-colapsavel><h2 class="hub-card-title">Disponibilidade <small class="muted">próximo jogo</small></h2><p class="card-resumo" data-parte="resumo-disponibilidade"></p><div data-parte="disponibilidade"></div></article>
          <article class="card" data-aos="fade-up" data-colapsavel><h2 class="hub-card-title">Disciplina</h2><p class="card-resumo" data-parte="resumo-disciplina"></p><div data-parte="disciplina"></div></article>
        </div>
        <article class="card plantel-onze" data-aos="fade-up" data-colapsavel><h2 class="hub-card-title">11 mais utilizado <small class="muted">por minutos jogados</small></h2><p class="card-resumo" data-parte="resumo-onze"></p><div data-parte="onze"></div></article>
        <div class="plantel-coluna plantel-coluna-2">
          <article class="card" data-aos="fade-up" data-colapsavel><h2 class="hub-card-title">Top marcadores</h2><p class="card-resumo" data-parte="resumo-marcadores"></p><div data-parte="marcadores"></div></article>
          <article class="card" data-aos="fade-up" data-colapsavel><h2 class="hub-card-title">Mais minutos <small class="muted" data-parte="minutosInfo"></small></h2><p class="card-resumo" data-parte="resumo-minutos"></p><div data-parte="minutos" class="minutes-scroll"></div></article>
        </div>
      </div>`;
    const parte = nome => contentor.querySelector(`[data-parte="${nome}"]`);
    const renderLista = () => {
      parte("filtros").innerHTML = H().filtrosPosicaoHTML(posicao);
      parte("lista").innerHTML = listaPlantelHTML(o.jogadores(), { posicao });
    };
    if (window.VFNNav) VFNNav.ligarColapsaveis(contentor); // telemóvel: fechados, com o resumo
    parte("filtros").addEventListener("click", e => { const b = e.target.closest("[data-posicao]"); if (b) { posicao = b.dataset.posicao; renderLista(); } });

    function render() {
      const dados = o.obterDados(), jogadores = o.jogadores();
      parte("total").textContent = `· ${jogadores.length} jogadores`;
      renderLista();
      parte("disponibilidade").innerHTML = disponibilidadeCompactaHTML(dados, jogadores, o.jogadorDoRelatorio);
      parte("disciplina").innerHTML = disciplinaHTML(dados, jogadores, o.jogadorDoRelatorio);
      parte("marcadores").innerHTML = H().marcadoresHTML(jogadores, 5);
      const { lista, relatorios } = H().minutosJogadosEpoca(dados, o.jogadorDoRelatorio);
      parte("minutosInfo").textContent = relatorios ? `${relatorios} jogo${relatorios === 1 ? "" : "s"} oficia${relatorios === 1 ? "l" : "is"}` : "";
      parte("minutos").innerHTML = H().minutosListaHTML(lista);
      // 11 mais utilizado: posição real (onze por slot + substituições); sem relatórios por slot, a do perfil
      // resumos dos cards fechados (telemóvel)
      const fora = parte("disponibilidade").querySelectorAll(".disc-lista li").length;
      const conv = (parte("disponibilidade").querySelector(".disp-total.ok b") || {}).textContent || "0";
      parte("resumo-disponibilidade").textContent = `${conv} convocáveis · ${parte("disponibilidade").querySelector(".disp-total.nao b") ? parte("disponibilidade").querySelector(".disp-total.nao b").textContent : fora} indisponíveis`;
      const alertas = parte("disciplina").querySelectorAll(".susp-badge").length;
      parte("resumo-disciplina").textContent = alertas ? `${alertas} suspenso${alertas === 1 ? "" : "s"} ou em risco` : "Sem suspensões nem jogadores em risco.";
      const top = [...jogadores].sort((a, b) => b.golos - a.golos)[0];
      parte("resumo-marcadores").textContent = top && top.golos ? `${top.nome} · ${top.golos} golo${top.golos === 1 ? "" : "s"}` : "Ainda sem golos.";
      parte("resumo-minutos").textContent = lista.length ? `${lista[0].jogador ? lista[0].jogador.nome : lista[0].nome || ""} · ${lista[0].minutos}'` : "Ainda sem minutos registados.";
      parte("resumo-onze").textContent = lista.length ? `Formação mais usada: ${H().formacaoMaisUsada ? (H().formacaoMaisUsada(dados) || "4-3-3") : "4-3-3"}` : "Ainda sem relatórios.";
      parte("onze").innerHTML = lista.length ? H().onzeMaisUtilizadoHTML(dados.match_reports, o.jogadorDoRelatorio, lista, dados) : H().vazio("Ainda não há relatórios de jogo com o onze e as substituições registados.");
    }

    function esqueleto() {
      parte("lista").innerHTML = H().esqueleto("linhas", 10);
      parte("disponibilidade").innerHTML = H().esqueleto("linhas", 4);
      parte("disciplina").innerHTML = H().esqueleto("linhas", 3);
      parte("marcadores").innerHTML = H().esqueleto("linhas", 5);
      parte("minutos").innerHTML = H().esqueleto("linhas", 6);
    }

    return { render, esqueleto };
  }

  /* ---------- Equipa (lista detalhada) ---------- */

  /**
   * Uma linha por jogador com as estatísticas completas da época. o: { dados, posicao, estado, jogadorDoRelatorio,
   * presenca(j) → % ou null (sem ela, não há coluna), editar: link de edição por jogador (só admin), eu: id destacado }
   */
  function equipaHTML(jogadores, o) {
    const lista = filtrar(jogadores, o.posicao, o.estado);
    if (!lista.length) return H().vazio("Sem jogadores com estes filtros.");
    const comEditar = !!o.editar, comPres = !!o.presenca;
    return `<div class="table-wrap"><table class="stats-table equipa-tabela" data-ordenar="plantel-equipa">
      <thead><tr><th scope="col" class="num" data-tipo="numero">Nº</th><th scope="col" data-tipo="texto">Jogador</th><th scope="col" data-tipo="texto">Posição</th><th scope="col" class="num col-sec" data-tipo="numero">Idade</th>
        <th scope="col" class="num" data-tipo="numero" title="Jogos">J</th><th scope="col" class="num col-sec" data-tipo="numero" title="Titular (jogos oficiais)">Tit</th><th scope="col" class="num col-sec" data-tipo="numero" title="Suplente utilizado (jogos oficiais)">Sup</th><th scope="col" class="num" data-tipo="numero" title="Minutos">Min</th>
        <th scope="col" class="num" data-tipo="numero" title="Golos">G</th><th scope="col" class="num" data-tipo="numero" title="Assistências">A</th><th scope="col" class="num col-sec" data-tipo="numero" title="Cartões amarelos">🟨</th><th scope="col" class="num col-sec" data-tipo="numero" title="Cartões vermelhos">🟥</th>
        ${comPres ? '<th scope="col" class="num col-sec" data-tipo="numero" title="Presenças nos treinos e jogos">Pres.</th>' : ""}<th scope="col" data-tipo="texto">Estado</th>${comEditar ? '<th scope="col"><span class="sr-only">Editar</span></th>' : ""}</tr></thead>
      <tbody>${lista.map(j => {
        const i = idadeDe(j);
        const p = H().participacoesJogador(o.dados, eDoJogador(j, o.jogadorDoRelatorio));
        const pres = comPres ? o.presenca(j) : null;
        const secundarias = (j.posicoesSecundarias || []).filter(Boolean);
        return `<tr data-jogador="${esc(j.id)}" tabindex="0"${o.eu != null && String(o.eu) === String(j.id) ? ' class="pl-eu"' : ""}>
          <td class="num">${esc(j.numero)}</td><td>${jogadorHTML(j)}</td>
          <td>${esc(j.posicao)}${secundarias.length ? `<small class="pl-secundarias">${esc(secundarias.join(", "))}</small>` : ""}</td>
          <td class="num col-sec" data-v="${i || 0}">${i || "—"}</td>
          <td class="num">${j.jogos}</td><td class="num col-sec">${p.titular}</td><td class="num col-sec">${p.suplente}</td><td class="num" data-v="${j.minutos}">${j.minutos}'</td>
          <td class="num">${j.golos}</td><td class="num">${j.assistencias}</td><td class="num col-sec">${j.cartoesA}</td><td class="num col-sec">${j.cartoesV}</td>
          ${comPres ? `<td class="num col-sec" data-v="${pres == null ? -1 : pres}">${pres == null ? "—" : pres + "%"}</td>` : ""}
          <td data-v="${esc(j.disponibilidade || "disponivel")}">${j.disponibilidade ? VFN.badgeDisponibilidade(j.disponibilidade, true) : "—"}</td>
          ${comEditar ? `<td class="pl-acoes"><a class="icon-btn" href="${esc(o.editar(j))}" title="Editar jogador (gestão)" aria-label="Editar ${esc(j.nome)}">${VFN.icone("pencil", 16)}</a></td>` : ""}
        </tr>`;
      }).join("")}</tbody>
    </table></div>`;
  }

  // linhas com tabindex: Enter abre a ficha (o clique é tratado pela página, em [data-jogador])
  document.addEventListener("keydown", e => { if (e.key === "Enter" && e.target.matches && e.target.matches("tr[data-jogador]")) e.target.click(); });

  window.VFNPlantel = { criarVisaoGeral, equipaHTML, disciplinaHTML };
})();
