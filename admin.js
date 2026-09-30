"use strict";

/* =========================================================
   TABS DE GESTÃO DO ADMIN (index.html)
   Multas · Presenças · Calendário · Classificação · Adversários
   Usa os globais do app.js: plantel, dadosClube, jogosCalendario,
   equipasCalendario, el, escapeHtml, idJogadorBD, jogadorPorIdBD...
   ========================================================= */

// tipos e valores em VFN.TIPOS_MULTA (shared.js)

const CICLO_PRESENCA = ["", "P", "F", "A", "J"];
const NOMES_PRESENCA = { P: "Presente", F: "Falta", A: "Atraso", J: "Justificada" };
const TABS_GESTAO = ["multas", "presencas", "calendario", "resultados", "jornadas", "classificacao", "adversarios"];

const cacheAdmin = { fines: [], attendance: [], sessions: [], opponents: [] };
const tabelasCarregadas = new Set();
let filtroCalendarioAdmin = "todos";
let multaEmEdicao = null;
let jogoEmEdicao = null;
let equipaEmEdicaoAdmin = null;
let filaPresencas = Promise.resolve();

const formatoEuro = new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" });

/* ---------- Utilitários ---------- */

function dataPt(valor) {
  const d = VFN.paraData(valor);
  return d ? d.toLocaleDateString("pt-PT") : "—";
}

function hojeIso() {
  return VFN.dataIso(new Date());
}

function mostrarErroAdmin(id, erro) {
  const alvo = el(id);
  if (alvo) alvo.textContent = erro ? mensagemErro(erro) : "";
}

async function carregarTabelaAdmin(tabela, erroId, forcar) {
  if (tabelasCarregadas.has(tabela) && !forcar) return;
  try {
    cacheAdmin[tabela] = await dadosClube.listar(tabela);
    tabelasCarregadas.add(tabela);
    mostrarErroAdmin(erroId, null);
  } catch (e) {
    cacheAdmin[tabela] = [];
    mostrarErroAdmin(erroId, e);
  }
}

function abrirModalAdmin(id) {
  el(id).hidden = false;
  const primeiro = el(id).querySelector("input:not([type=hidden]):not([type=file]), select, textarea");
  if (primeiro) primeiro.focus();
}

function fecharModalAdmin(id) {
  el(id).hidden = true;
}

function opcoesMesesHTML(selecionado, comEpoca) {
  const meses = VFN.mesesDaEpoca(new Date());
  const opcoes = meses.map(m => `<option value="${m.valor}" ${m.valor === selecionado ? "selected" : ""}>${m.rotulo}</option>`);
  if (comEpoca) opcoes.unshift(`<option value="epoca" ${selecionado === "epoca" ? "selected" : ""}>Época inteira</option>`);
  return opcoes.join("");
}

function mesDaEpocaOuAtual() {
  const atual = VFN.mesAtual();
  return VFN.mesesDaEpoca(new Date()).some(m => m.valor === atual) ? atual : VFN.mesesDaEpoca(new Date())[0].valor;
}

function opcoesPlantelHTML(selecionadoBD) {
  return '<option value="">— Selecionar jogador —</option>' + [...plantel]
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt"))
    .map(j => { const id = idJogadorBD(j); return `<option value="${escapeHtml(id)}" ${id === selecionadoBD ? "selected" : ""}>${j.numero ? "#" + escapeHtml(j.numero) + " " : ""}${escapeHtml(j.nome)}</option>`; })
    .join("");
}

function celulaJogadorHTML(playerId) {
  const j = jogadorPorIdBD(playerId);
  if (!j) return `<span class="player-cell muted">Jogador removido</span>`;
  return `<span class="player-cell">${VFN.avatarJogador(j, "avatar-xs")}<span>${escapeHtml(j.nome)}</span></span>`;
}

/* =========================================================
   MULTAS
   ========================================================= */

function initMultas() {
  el("multasMes").innerHTML = opcoesMesesHTML(mesDaEpocaOuAtual(), true);
  el("multasMes").addEventListener("change", renderMultas);
  el("multaTipo").addEventListener("change", () => aplicarTipoMulta(true));
  el("btnAddMulta").addEventListener("click", () => abrirModalMulta(null));
  el("btnMultaCancelar").addEventListener("click", () => fecharModalAdmin("modalMulta"));
  el("btnMultaGuardar").addEventListener("click", guardarMulta);
}

function multasDoPeriodo() {
  const mes = el("multasMes").value;
  return cacheAdmin.fines
    .filter(f => mes === "epoca" || String(f.match_date || "").startsWith(mes))
    .sort((a, b) => String(b.match_date || "").localeCompare(String(a.match_date || "")));
}

function renderMultas() {
  const lista = multasDoPeriodo();
  const pendente = lista.filter(f => !f.paid).reduce((s, f) => s + (Number(f.amount) || 0), 0);
  const pago = lista.filter(f => f.paid).reduce((s, f) => s + (Number(f.amount) || 0), 0);
  const aDefinir = lista.filter(f => !f.paid && VFN.multaADefinir(f)).length;
  el("multasResumo").innerHTML = `
    <div class="summary-tile tile-pendente"><span>Total pendente</span><strong>${formatoEuro.format(pendente)}</strong>${aDefinir ? `<small class="valor-a-definir-nota">+ ${aDefinir} a definir (% do ordenado)</small>` : ""}</div>
    <div class="summary-tile tile-pago"><span>Total arrecadado</span><strong>${formatoEuro.format(pago)}</strong></div>
    <div class="summary-tile"><span>Nº de multas</span><strong>${lista.length}</strong></div>`;

  const tbody = el("multasBody");
  if (!lista.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state">Sem multas neste período.</td></tr>`;
    return;
  }
  tbody.innerHTML = lista.map(f => `
    <tr data-id="${escapeHtml(f.id)}">
      <td>${celulaJogadorHTML(f.player_id)}</td>
      <td class="fine-infraction">${escapeHtml(rotuloInfraccao(f.infraction_type))}${VFN.multaADefinir(f) ? `<span class="nota-percentagem">${escapeHtml(VFN.NOTA_PERCENTAGEM)}</span>` : ""}${f.description ? `<span class="fine-desc">${escapeHtml(f.description)}</span>` : ""}</td>
      <td class="num">${VFN.valorMultaHTML(f)}</td>
      <td><label class="paid-toggle" title="Marcar como pago"><input type="checkbox" data-acao="pago" ${f.paid ? "checked" : ""}><span class="switch" aria-hidden="true"></span><span>${f.paid ? "Pago" : "Pendente"}</span></label>${f.paid && f.paid_date ? `<span class="fine-desc">em ${dataPt(f.paid_date)}</span>` : ""}</td>
      <td>${dataPt(f.match_date)}</td>
      <td><div class="row-actions"><button type="button" class="icon-btn" data-acao="editar" title="Editar multa" aria-label="Editar multa">${VFN.icone("pencil", 16)}</button><button type="button" class="icon-btn danger" data-acao="apagar" title="Eliminar multa" aria-label="Eliminar multa">${VFN.icone("trash-2", 16)}</button></div></td>
    </tr>`).join("");

  tbody.querySelectorAll("tr[data-id]").forEach(tr => {
    const multa = cacheAdmin.fines.find(f => String(f.id) === tr.dataset.id);
    tr.querySelector("[data-acao=pago]").addEventListener("change", e => alternarPagamento(multa, e.target.checked));
    tr.querySelector("[data-acao=editar]").addEventListener("click", () => abrirModalMulta(multa));
    tr.querySelector("[data-acao=apagar]").addEventListener("click", () => apagarMulta(multa));
  });
}

function rotuloInfraccao(tipo) {
  return VFN.rotuloMulta(tipo);
}

/** Ao escolher o tipo, preenche o valor da tabela; nas multas em % do ordenado o valor fica 0 e mostra a nota. */
function aplicarTipoMulta(preencherValor) {
  const tipo = VFN.tipoMulta(el("multaTipo").value);
  const percentagem = !!tipo && tipo.valor === null;
  el("multaNotaPercentagem").hidden = !percentagem;
  if (preencherValor && tipo) el("multaValor").value = percentagem ? 0 : tipo.valor;
}

function abrirModalMulta(multa) {
  multaEmEdicao = multa;
  el("modalMultaTitulo").textContent = multa ? "Editar Multa" : "Adicionar Multa";
  el("multaJogador").innerHTML = opcoesPlantelHTML(multa ? multa.player_id : "");
  el("multaTipo").innerHTML = VFN.TIPOS_MULTA.map((t, n) => `<option value="${escapeHtml(t.tipo)}">${n + 1}. ${escapeHtml(t.tipo)} — ${t.valor === null ? "% do ordenado" : formatoEuro.format(t.valor)}</option>`).join("");
  // multas antigas com tipos que já não existem continuam a abrir
  if (multa && !VFN.tipoMulta(multa.infraction_type)) el("multaTipo").add(new Option(rotuloInfraccao(multa.infraction_type), multa.infraction_type));
  el("multaTipo").value = multa ? multa.infraction_type : VFN.TIPOS_MULTA[0].tipo;
  el("multaValor").value = multa ? multa.amount : "";
  aplicarTipoMulta(!multa);
  el("multaDescricao").value = multa ? multa.description || "" : "";
  el("multaData").value = multa ? multa.match_date || "" : hojeIso();
  el("multaErro").textContent = "";
  abrirModalAdmin("modalMulta");
}

async function guardarMulta() {
  const valor = Number(String(el("multaValor").value).replace(",", "."));
  const tipo = VFN.tipoMulta(el("multaTipo").value);
  const percentagem = !!tipo && tipo.valor === null; // pode ficar a 0 até os dirigentes definirem
  const erro = !el("multaJogador").value ? "Escolhe o jogador." : !(valor >= 0) || (!percentagem && !(valor > 0)) ? "Indica um valor em euros maior que zero." : !el("multaData").value ? "Indica a data." : "";
  el("multaErro").textContent = erro;
  if (erro) return;
  const linha = {
    ...(multaEmEdicao || {}),
    player_id: el("multaJogador").value,
    infraction_type: el("multaTipo").value,
    amount: Math.round(valor * 100) / 100,
    description: el("multaDescricao").value.trim() || null,
    match_date: el("multaData").value,
    paid: multaEmEdicao ? !!multaEmEdicao.paid : false,
    paid_date: multaEmEdicao ? multaEmEdicao.paid_date || null : null
  };
  const botao = el("btnMultaGuardar");
  botao.disabled = true;
  try {
    const gravada = await dadosClube.guardar("fines", linha);
    cacheAdmin.fines = cacheAdmin.fines.filter(f => String(f.id) !== String(gravada.id)).concat(gravada);
    fecharModalAdmin("modalMulta");
    // mostra o mês da multa acabada de gravar
    const mes = String(gravada.match_date || "").slice(0, 7);
    if (el("multasMes").value !== "epoca" && [...el("multasMes").options].some(o => o.value === mes)) el("multasMes").value = mes;
    renderMultas();
  } catch (e) {
    el("multaErro").textContent = mensagemErro(e);
  } finally {
    botao.disabled = false;
  }
}

async function alternarPagamento(multa, pago) {
  const anterior = { paid: multa.paid, paid_date: multa.paid_date };
  multa.paid = pago;
  multa.paid_date = pago ? hojeIso() : null;
  renderMultas();
  try {
    const gravada = await dadosClube.guardar("fines", multa);
    Object.assign(multa, gravada);
  } catch (e) {
    Object.assign(multa, anterior);
    renderMultas();
    alert(mensagemErro(e));
  }
}

async function apagarMulta(multa) {
  if (!confirm(`Eliminar a multa "${rotuloInfraccao(multa.infraction_type)}"${VFN.multaADefinir(multa) ? "" : " de " + formatoEuro.format(Number(multa.amount) || 0)}?`)) return;
  try {
    await dadosClube.remover("fines", multa.id);
    cacheAdmin.fines = cacheAdmin.fines.filter(f => f !== multa);
    renderMultas();
  } catch (e) {
    alert(mensagemErro(e));
  }
}

/* =========================================================
   PRESENÇAS
   ========================================================= */

function initPresencas() {
  el("presencasMes").innerHTML = opcoesMesesHTML(mesDaEpocaOuAtual(), false);
  el("presencasMes").addEventListener("change", renderPresencas);
  el("btnAddSessao").addEventListener("click", () => {
    el("sessaoData").value = hojeIso();
    el("sessaoTipo").value = "treino";
    el("sessaoNotas").value = "";
    el("sessaoErro").textContent = "";
    abrirModalAdmin("modalSessao");
  });
  el("btnSessaoCancelar").addEventListener("click", () => fecharModalAdmin("modalSessao"));
  el("btnSessaoGuardar").addEventListener("click", guardarSessao);
}

function chaveSessao(data, tipo) {
  return `${data}|${tipo}`;
}

/** Colunas do mês: sessões criadas + dias com presenças marcadas + jogos do calendário. */
function sessoesDoMes(mes) {
  const mapa = new Map();
  const juntar = (data, tipo, origem) => {
    if (!data || !String(data).startsWith(mes)) return;
    const chave = chaveSessao(data, tipo);
    const atual = mapa.get(chave) || { data, tipo, sessao: null, doCalendario: false };
    if (origem && origem.sessao) atual.sessao = origem.sessao;
    if (origem && origem.calendario) atual.doCalendario = true;
    mapa.set(chave, atual);
  };
  cacheAdmin.sessions.forEach(s => juntar(s.session_date, s.session_type, { sessao: s }));
  cacheAdmin.attendance.forEach(a => juntar(a.session_date, a.session_type));
  VFN.jogosDoVFN(jogosCalendario)
    .filter(j => VFN.estadoJogo(j) !== "cancelado")
    .forEach(j => juntar(VFN.dataIso(j.date), "jogo", { calendario: true }));
  return [...mapa.values()].sort((a, b) => a.data.localeCompare(b.data) || (a.tipo === "treino" ? -1 : 1));
}

function registoPresenca(playerId, sessao) {
  return cacheAdmin.attendance.find(a => a.player_id === playerId && a.session_date === sessao.data && a.session_type === sessao.tipo);
}

function renderPresencas() {
  const mes = el("presencasMes").value;
  const sessoes = sessoesDoMes(mes);
  const jogadores = [...plantel].sort((a, b) => a.nome.localeCompare(b.nome, "pt"));
  const container = el("presencasGrelha");
  // a grelha é redesenhada a cada clique: guardar scroll (da grelha e da página) e foco
  const grelhaAntiga = container.querySelector(".attendance-wrap");
  const scroll = { top: grelhaAntiga ? grelhaAntiga.scrollTop : 0, left: grelhaAntiga ? grelhaAntiga.scrollLeft : 0, pagina: window.scrollY };
  const focada = document.activeElement && document.activeElement.classList.contains("att-cell") ? { jogador: document.activeElement.dataset.jogador, sessao: document.activeElement.dataset.sessao } : null;

  if (!sessoes.length) {
    container.innerHTML = `<p class="empty-state">Sem sessões em ${escapeHtml(el("presencasMes").selectedOptions[0].textContent)}. Usa "Adicionar Sessão" para criar um treino ou jogo.</p>`;
    return;
  }

  const cabecalho = sessoes.map((s, i) => {
    const podeRemover = s.sessao || cacheAdmin.attendance.some(a => a.session_date === s.data && a.session_type === s.tipo);
    return `<th scope="col" title="${s.tipo === "jogo" ? "Jogo" : "Treino"} · ${dataPt(s.data)}"><span class="session-day">${VFN.dataCurta(s.data)}</span><span class="session-icon" aria-label="${s.tipo === "jogo" ? "Jogo" : "Treino"}">${VFN.icone(s.tipo === "jogo" ? "goal" : "footprints", 16)}</span>${podeRemover ? `<button type="button" class="session-remove" data-sessao="${i}" title="Remover sessão" aria-label="Remover sessão de ${dataPt(s.data)}">${VFN.icone("x", 14)}</button>` : ""}</th>`;
  }).join("");

  const totaisSessao = sessoes.map(() => ({ P: 0, F: 0, A: 0, J: 0 }));
  const totaisGerais = { P: 0, F: 0, A: 0, J: 0 };

  const linhas = jogadores.map(j => {
    const idBD = idJogadorBD(j);
    const totais = { P: 0, F: 0, A: 0, J: 0 };
    const celulas = sessoes.map((s, i) => {
      const registo = registoPresenca(idBD, s);
      const estado = registo && registo.status || "";
      if (estado) { totais[estado]++; totaisSessao[i][estado]++; totaisGerais[estado]++; }
      return `<td><button type="button" class="att-cell" data-jogador="${escapeHtml(idBD)}" data-sessao="${i}" data-status="${estado}" aria-label="${escapeHtml(j.nome)}, ${dataPt(s.data)}: ${NOMES_PRESENCA[estado] || "sem registo"}">${estado}</button></td>`;
    }).join("");
    return `<tr><th scope="row" class="col-player"><span class="player-cell">${VFN.avatarJogador(j, "avatar-xs")}<span>${escapeHtml(j.nome)}</span></span></th>${celulas}${["P", "F", "A", "J"].map(k => `<td class="col-total total-${k}">${totais[k]}</td>`).join("")}</tr>`;
  }).join("");

  const rodape = totaisSessao.map(t => `<td title="Presentes ${t.P} · Faltas ${t.F} · Atrasos ${t.A} · Justificadas ${t.J}">${t.P + t.A}/${jogadores.length}</td>`).join("");

  container.innerHTML = `
    <div class="attendance-wrap">
      <table class="attendance-table">
        <thead><tr><th scope="col" class="col-player">Jogador</th>${cabecalho}${["P", "F", "A", "J"].map(k => `<th scope="col" class="col-total" title="${NOMES_PRESENCA[k]}">${k}</th>`).join("")}</tr></thead>
        <tbody>${linhas}</tbody>
        <tfoot><tr><td class="col-player">Presentes (P+A)</td>${rodape}${["P", "F", "A", "J"].map(k => `<td class="col-total total-${k}">${totaisGerais[k]}</td>`).join("")}</tr></tfoot>
      </table>
    </div>`;

  const grelha = container.querySelector(".attendance-wrap");
  grelha.scrollTop = scroll.top;
  grelha.scrollLeft = scroll.left;
  if (focada) {
    const alvo = [...container.querySelectorAll(".att-cell")].find(b => b.dataset.jogador === focada.jogador && b.dataset.sessao === focada.sessao);
    if (alvo) alvo.focus({ preventScroll: true });
  }
  if (window.scrollY !== scroll.pagina) window.scrollTo(0, scroll.pagina);

  container.querySelectorAll(".att-cell").forEach(btn => btn.addEventListener("click", e => { e.preventDefault(); alternarPresenca(btn.dataset.jogador, sessoes[Number(btn.dataset.sessao)]); }));
  container.querySelectorAll(".session-remove").forEach(btn => btn.addEventListener("click", () => removerSessao(sessoes[Number(btn.dataset.sessao)])));
}

const MULTA_FALTA_TREINO = { infraction_type: "Falta ao treino injustificada", amount: 0 };
const DESCRICAO_MULTA_AUTOMATICA = "Criada automaticamente (falta no treino)";

function multaAutomatica(playerId, data) {
  // só as criadas pela grelha (as antigas usavam o tipo 'falta_treino')
  return cacheAdmin.fines.find(f => String(f.player_id) === String(playerId) && f.match_date === data && (f.infraction_type === "falta_treino" || (f.infraction_type === MULTA_FALTA_TREINO.infraction_type && f.description === DESCRICAO_MULTA_AUTOMATICA))) || null;
}

/** Falta num treino cria a multa automática; ao sair de F, a multa é retirada se ainda não estiver paga. */
async function sincronizarMultaFalta(playerId, sessao, anterior, seguinte) {
  if (sessao.tipo !== "treino" || (anterior !== "F" && seguinte !== "F")) return;
  if (!tabelasCarregadas.has("fines")) await carregarTabelaAdmin("fines", "presencasErro");
  const existente = multaAutomatica(playerId, sessao.data);
  if (seguinte === "F" && !existente) {
    const multa = await dadosClube.guardar("fines", { player_id: playerId, ...MULTA_FALTA_TREINO, match_date: sessao.data, description: DESCRICAO_MULTA_AUTOMATICA, paid: false, paid_date: null });
    cacheAdmin.fines.push(multa);
  } else if (anterior === "F" && seguinte !== "F" && existente && !existente.paid) {
    await dadosClube.remover("fines", existente.id);
    cacheAdmin.fines = cacheAdmin.fines.filter(f => f !== existente);
  }
}

function alternarPresenca(playerId, sessao) {
  const registo = registoPresenca(playerId, sessao);
  const atual = registo && registo.status || "";
  const seguinte = CICLO_PRESENCA[(CICLO_PRESENCA.indexOf(atual) + 1) % CICLO_PRESENCA.length];

  // atualização otimista; as gravações seguem em fila para não se cruzarem
  if (!seguinte) {
    cacheAdmin.attendance = cacheAdmin.attendance.filter(a => a !== registo);
  } else if (registo) {
    registo.status = seguinte;
  } else {
    cacheAdmin.attendance.push({ id: VFN.novoId(), player_id: playerId, session_date: sessao.data, session_type: sessao.tipo, status: seguinte, notes: null });
  }
  renderPresencas();

  const alvo = registoPresenca(playerId, sessao);
  const idRemover = !seguinte && registo ? registo.id : null;
  const copia = alvo ? { ...alvo } : null;
  filaPresencas = filaPresencas.then(async () => {
    try {
      if (idRemover) await dadosClube.remover("attendance", idRemover);
      else if (copia) await dadosClube.guardar("attendance", copia);
      await sincronizarMultaFalta(playerId, sessao, atual, seguinte);
      mostrarErroAdmin("presencasErro", null);
    } catch (e) {
      mostrarErroAdmin("presencasErro", e);
      await carregarTabelaAdmin("attendance", "presencasErro", true);
      renderPresencas();
    }
  });
}

async function guardarSessao() {
  const data = el("sessaoData").value;
  const tipo = el("sessaoTipo").value;
  if (!data) { el("sessaoErro").textContent = "Indica a data da sessão."; return; }
  if (cacheAdmin.sessions.some(s => s.session_date === data && s.session_type === tipo)) {
    el("sessaoErro").textContent = "Já existe uma sessão deste tipo nesse dia.";
    return;
  }
  try {
    const gravada = await dadosClube.guardar("sessions", { session_date: data, session_type: tipo, notes: el("sessaoNotas").value.trim() || null });
    cacheAdmin.sessions.push(gravada);
    fecharModalAdmin("modalSessao");
    const mes = data.slice(0, 7);
    if ([...el("presencasMes").options].some(o => o.value === mes)) el("presencasMes").value = mes;
    renderPresencas();
  } catch (e) {
    el("sessaoErro").textContent = mensagemErro(e);
  }
}

async function removerSessao(sessao) {
  const registos = cacheAdmin.attendance.filter(a => a.session_date === sessao.data && a.session_type === sessao.tipo);
  const aviso = registos.length ? ` e as ${registos.length} presenças marcadas` : "";
  if (!confirm(`Remover a sessão de ${sessao.tipo} de ${dataPt(sessao.data)}${aviso}?`)) return;
  try {
    for (const r of registos) await dadosClube.remover("attendance", r.id);
    if (sessao.sessao) await dadosClube.remover("sessions", sessao.sessao.id);
    cacheAdmin.attendance = cacheAdmin.attendance.filter(a => !registos.includes(a));
    cacheAdmin.sessions = cacheAdmin.sessions.filter(s => s !== sessao.sessao);
    renderPresencas();
  } catch (e) {
    alert(mensagemErro(e));
  }
}

/* =========================================================
   CALENDÁRIO
   ========================================================= */

function initCalendarioAdmin() {
  const filtros = [["todos", "Todos"], ["liga", "Liga"], ["taca", "Taça"], ["amigavel", "Amigáveis"]];
  el("calendarioFiltros").innerHTML = filtros.map(([v, t]) => `<button type="button" class="filter-chip ${v === filtroCalendarioAdmin ? "active" : ""}" data-filtro="${v}">${t}</button>`).join("");
  el("calendarioFiltros").querySelectorAll(".filter-chip").forEach(b => b.addEventListener("click", () => {
    filtroCalendarioAdmin = b.dataset.filtro;
    el("calendarioFiltros").querySelectorAll(".filter-chip").forEach(x => x.classList.toggle("active", x === b));
    renderCalendarioAdmin();
  }));
  el("jogoCompeticao").innerHTML = COMPETICOES.map(c => `<option>${escapeHtml(c)}</option>`).join("");
  el("jogoAdversarioEquipa").addEventListener("change", () => { el("jogoAdversarioNomeWrap").hidden = el("jogoAdversarioEquipa").value !== ""; });
  el("btnAddJogo").addEventListener("click", () => abrirModalJogo(null));
  el("btnJogoCancelar").addEventListener("click", () => fecharModalAdmin("modalJogo"));
  el("btnJogoGuardar").addEventListener("click", guardarJogo);
}

function renderCalendarioAdmin() {
  const tbody = el("calendarioBody");
  if (!tbody) return;
  const lista = VFN.jogosDoVFN(jogosCalendario)
    .filter(j => filtroCalendarioAdmin === "todos" || VFN.categoriaCompeticao(j.competition) === filtroCalendarioAdmin)
    .sort((a, b) => (VFN.paraData(a.date) || 0) - (VFN.paraData(b.date) || 0));
  if (!lista.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty-state">Sem jogos. Usa "Adicionar Jogo" para construir o calendário.</td></tr>`;
    return;
  }
  const proximo = VFN.proximoJogo(jogosCalendario);
  tbody.innerHTML = lista.map(j => {
    const nome = nomeAdversarioJogo(j);
    const g = VFN.golosJogo(j);
    return `<tr data-id="${escapeHtml(j.id)}" class="${proximo && proximo.id === j.id ? "is-vfn-row" : ""}">
      <td>${escapeHtml(VFN.dataLonga(j.date, true))}</td>
      <td><span class="comp-tag comp-${VFN.categoriaCompeticao(j.competition)}">${escapeHtml(VFN.nomeCurtoCompeticao(j.competition))}</span></td>
      <td class="num">${j.jornada != null ? escapeHtml(j.jornada) : "—"}</td>
      <td>${VFN.jogoEmCasa(j) ? "Casa" : "Fora"}</td>
      <td><span class="team-inline">${logoEquipaHTML(equipaPorId(j.opponent_team_id), nome)}${escapeHtml(nome)}</span></td>
      <td class="num">${g ? `<strong>${g.vfn} – ${g.adv}</strong>` : "—"}</td>
      <td>${VFN.badgeEstado(j)}</td>
      <td><div class="row-actions"><button type="button" class="icon-btn" data-acao="editar" title="Editar jogo" aria-label="Editar jogo">${VFN.icone("pencil", 16)}</button><button type="button" class="icon-btn danger" data-acao="apagar" title="Eliminar jogo" aria-label="Eliminar jogo">${VFN.icone("trash-2", 16)}</button></div></td>
    </tr>`;
  }).join("");
  tbody.querySelectorAll("tr[data-id]").forEach(tr => {
    const jogo = jogosCalendario.find(j => String(j.id) === tr.dataset.id);
    tr.querySelector("[data-acao=editar]").addEventListener("click", () => abrirModalJogo(jogo));
    tr.querySelector("[data-acao=apagar]").addEventListener("click", () => apagarJogo(jogo));
  });
}

function abrirModalJogo(jogo) {
  jogoEmEdicao = jogo;
  el("modalJogoTitulo").textContent = jogo ? "Editar Jogo" : "Adicionar Jogo";
  el("jogoCompeticao").value = jogo && COMPETICOES.includes(jogo.competition) ? jogo.competition : COMPETICOES[0];
  el("jogoJornada").value = jogo && jogo.jornada != null ? jogo.jornada : "";
  el("jogoData").value = jogo ? VFN.dataIso(jogo.date) : "";
  el("jogoHora").value = jogo ? VFN.horaIso(jogo.date) : "15:00";
  el("jogoCasaFora").value = jogo && !VFN.jogoEmCasa(jogo) ? "Fora" : "Casa";
  const equipas = [...equipasCalendario].filter(t => !VFN.eVFN(t.name)).sort((a, b) => a.name.localeCompare(b.name, "pt"));
  el("jogoAdversarioEquipa").innerHTML = equipas.map(t => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.name)}</option>`).join("") + '<option value="">Outra (escrever nome)</option>';
  el("jogoAdversarioEquipa").value = jogo && equipaPorId(jogo.opponent_team_id) ? jogo.opponent_team_id : (jogo ? "" : (equipas[0] ? equipas[0].id : ""));
  el("jogoAdversarioNome").value = jogo ? jogo.opponent || "" : "";
  el("jogoAdversarioNomeWrap").hidden = el("jogoAdversarioEquipa").value !== "";
  el("jogoEstado").value = jogo ? VFN.estadoJogo(jogo) || "agendado" : "agendado";
  const g = jogo ? VFN.golosJogo(jogo) : null;
  el("jogoGolosVFN").value = g ? g.vfn : "";
  el("jogoGolosAdv").value = g ? g.adv : "";
  el("jogoLocal").value = jogo ? jogo.venue || "" : "";
  el("jogoErro").textContent = "";
  abrirModalAdmin("modalJogo");
}

async function guardarJogo() {
  const data = el("jogoData").value;
  const equipa = equipaPorId(el("jogoAdversarioEquipa").value);
  const nomeAdv = equipa ? equipa.name : el("jogoAdversarioNome").value.trim();
  const estado = el("jogoEstado").value;
  const gVFN = el("jogoGolosVFN").value, gAdv = el("jogoGolosAdv").value;
  const erro = !data ? "Indica a data do jogo." : !nomeAdv ? "Indica o adversário." : (estado === "jogado" && (gVFN === "" || gAdv === "")) ? "Para um jogo jogado indica o resultado." : "";
  el("jogoErro").textContent = erro;
  if (erro) return;
  const casa = el("jogoCasaFora").value === "Casa";
  const temResultado = gVFN !== "" && gAdv !== "";
  const linha = {
    ...(jogoEmEdicao || {}),
    competition: el("jogoCompeticao").value,
    jornada: el("jogoJornada").value ? Number(el("jogoJornada").value) : null,
    date: new Date(`${data}T${el("jogoHora").value || "15:00"}`).toISOString(),
    home_away: casa ? "Casa" : "Fora",
    opponent: nomeAdv,
    opponent_team_id: equipa ? equipa.id : null,
    status: estado,
    score_home: temResultado ? Number(casa ? gVFN : gAdv) : null,
    score_away: temResultado ? Number(casa ? gAdv : gVFN) : null,
    venue: el("jogoLocal").value.trim() || null
  };
  const botao = el("btnJogoGuardar");
  botao.disabled = true;
  try {
    const gravado = await dadosClube.guardar("matches", linha);
    jogosCalendario = jogosCalendario.filter(j => String(j.id) !== String(gravado.id)).concat(gravado);
    fecharModalAdmin("modalJogo");
    renderCalendarioAdmin();
    renderProximoJogoPreJogo();
  } catch (e) {
    el("jogoErro").textContent = mensagemErro(e);
  } finally {
    botao.disabled = false;
  }
}

async function apagarJogo(jogo) {
  if (!confirm(`Eliminar o jogo com ${nomeAdversarioJogo(jogo)} de ${dataPt(jogo.date)}?`)) return;
  try {
    await dadosClube.remover("matches", jogo.id);
    jogosCalendario = jogosCalendario.filter(j => j !== jogo);
    if (state.preJogo.matchId === jogo.id) state.preJogo.matchId = "";
    renderCalendarioAdmin();
    renderProximoJogoPreJogo();
  } catch (e) {
    alert(mensagemErro(e));
  }
}

/* =========================================================
   RESULTADOS E CLASSIFICAÇÃO
   A classificação é calculada em tempo real a partir dos resultados
   em matches (jogos do VFN + jogos entre outras equipas da liga);
   a tabela standings deixa de ser usada para a mostrar.
   ========================================================= */

const ESTADOS_JOGO = [["agendado", "Agendado"], ["jogado", "Jogado"], ["cancelado", "Cancelado"]];
const temporizadoresResultados = {};

function initResultados() {
  el("resultadosCompeticao").addEventListener("change", renderResultados);
  el("classificacaoCompeticao").addEventListener("change", renderClassificacaoAdmin);
}

function competicoesDoCalendario() {
  const ordem = c => ({ liga: 0, taca: 1, amigavel: 2 })[VFN.categoriaCompeticao(c)];
  return [...new Set(jogosCalendario.map(j => j.competition).filter(Boolean))]
    .sort((a, b) => ordem(a) - ordem(b) || a.localeCompare(b, "pt"));
}

function logoPorId(id, nome) {
  return logoEquipaHTML(equipaPorId(id), nome);
}

function linhaResultadoHTML(j) {
  const { casa, fora } = VFN.equipasDoJogo(j, equipasCalendario);
  const doVFN = VFN.eJogoVFN(j);
  const estado = VFN.estadoJogo(j) || "agendado";
  const valor = v => (v == null || v === "" ? "" : Number(v));
  return `<tr data-id="${escapeHtml(j.id)}" class="${doVFN ? "is-vfn-game" : ""} state-${escapeHtml(estado)}">
    <td class="nowrap">${escapeHtml(VFN.dataLonga(j.date))}</td>
    <td class="num">${j.jornada != null ? escapeHtml(j.jornada) : "—"}</td>
    <td class="team-home"><span class="team-inline">${escapeHtml(casa.nome)}${logoPorId(casa.id, casa.nome)}</span></td>
    <td class="score-cell"><input type="number" min="0" data-campo="score_home" value="${valor(j.score_home)}" aria-label="Golos ${escapeHtml(casa.nome)}"><span>–</span><input type="number" min="0" data-campo="score_away" value="${valor(j.score_away)}" aria-label="Golos ${escapeHtml(fora.nome)}"></td>
    <td><span class="team-inline">${logoPorId(fora.id, fora.nome)}${escapeHtml(fora.nome)}</span></td>
    <td><select data-campo="status" aria-label="Estado do jogo">${ESTADOS_JOGO.map(([v, t]) => `<option value="${v}" ${v === estado ? "selected" : ""}>${t}</option>`).join("")}</select></td>
    <td>${doVFN ? '<span class="muted" title="Jogo do VFN (editar no Calendário)">VFN</span>' : '<button type="button" class="icon-btn danger" data-acao="apagar" title="Eliminar jogo" aria-label="Eliminar jogo">${VFN.icone("trash-2", 16)}</button>'}</td>
  </tr>`;
}

function renderResultados() {
  const select = el("resultadosCompeticao");
  const comps = competicoesDoCalendario();
  const atual = select.value;
  select.innerHTML = '<option value="">Todas as competições</option>' + comps.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
  select.value = comps.includes(atual) ? atual : "";

  const grupos = (select.value ? [select.value] : comps)
    .map(c => [c, jogosCalendario.filter(j => j.competition === c).sort((a, b) => (VFN.paraData(a.date) || 0) - (VFN.paraData(b.date) || 0) || String(a.id).localeCompare(String(b.id)))])
    .filter(([, lista]) => lista.length);
  const container = el("resultadosLista");
  if (!grupos.length) {
    container.innerHTML = '<p class="empty-state">Sem jogos. Adiciona os jogos do VFN no Calendário e os das outras equipas aqui.</p>';
    return;
  }
  container.innerHTML = grupos.map(([comp, jogos]) => `
    <section class="results-group">
      <h3 class="results-title"><span class="comp-tag comp-${VFN.categoriaCompeticao(comp)}">${escapeHtml(VFN.nomeCurtoCompeticao(comp))}</span>${escapeHtml(comp)} <small class="muted">${jogos.length} jogo${jogos.length === 1 ? "" : "s"}</small></h3>
      <div class="table-wrap"><table class="data-table results-table">
        <thead><tr><th>Data</th><th class="num">J.</th><th class="team-home">Casa</th><th class="num">Resultado</th><th>Fora</th><th>Estado</th><th></th></tr></thead>
        <tbody>${jogos.map(linhaResultadoHTML).join("")}</tbody>
      </table></div>
    </section>`).join("");

  container.querySelectorAll("tr[data-id]").forEach(tr => {
    const jogo = jogosCalendario.find(j => String(j.id) === tr.dataset.id);
    tr.querySelectorAll("[data-campo]").forEach(input => input.addEventListener("change", () => alterarResultado(jogo, tr, input)));
    const apagar = tr.querySelector("[data-acao=apagar]");
    if (apagar) apagar.addEventListener("click", () => apagarOutroJogo(jogo));
  });
}

function alterarResultado(jogo, tr, input) {
  const campo = input.dataset.campo;
  if (campo === "status") jogo.status = input.value;
  else jogo[campo] = input.value === "" ? null : Math.max(0, Math.round(Number(input.value) || 0));
  // com os dois golos preenchidos, um jogo agendado passa a jogado
  if (campo !== "status" && jogo.score_home != null && jogo.score_away != null && VFN.estadoJogo(jogo) === "agendado") {
    jogo.status = "jogado";
    tr.querySelector("[data-campo=status]").value = "jogado";
  }
  clearTimeout(temporizadoresResultados[jogo.id]);
  temporizadoresResultados[jogo.id] = setTimeout(async () => {
    try {
      Object.assign(jogo, await dadosClube.guardar("matches", jogo));
      mostrarErroAdmin("resultadosErro", null);
    } catch (e) {
      mostrarErroAdmin("resultadosErro", e);
    }
    renderProximoJogoPreJogo();
  }, 400);
}

async function apagarOutroJogo(jogo) {
  const { casa, fora } = VFN.equipasDoJogo(jogo, equipasCalendario);
  if (!confirm(`Eliminar o jogo ${casa.nome} – ${fora.nome}?`)) return;
  try {
    await dadosClube.remover("matches", jogo.id);
    jogosCalendario = jogosCalendario.filter(j => j !== jogo);
    renderResultados();
  } catch (e) {
    alert(mensagemErro(e));
  }
}

/* ---- Classificação (só leitura, calculada) ---- */

function renderClassificacaoAdmin() {
  const select = el("classificacaoCompeticao");
  const comps = VFN.COMPETICOES_CLASSIFICACAO; // 2ª Liga Zero Graus e Taça de Honra Comunilog
  const atual = select.value;
  const proximo = VFN.proximoJogo(jogosCalendario);
  select.innerHTML = comps.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
  select.value = comps.includes(atual) ? atual : (proximo && comps.includes(proximo.competition) ? proximo.competition : comps[0] || "");
  select.hidden = !comps.length;

  const tbody = el("classificacaoBody");
  const linhas = select.value ? VFN.calcularClassificacao(jogosCalendario, equipasCalendario, select.value, resultadosLiga) : [];
  if (!linhas.length) {
    tbody.innerHTML = '<tr><td colspan="10" class="empty-state">Sem jogos de liga no calendário.</td></tr>';
    return;
  }
  setTimeout(() => VFN.anim.linhas(tbody.querySelectorAll("tr")), 0);
  tbody.innerHTML = linhas.map((s, i) => {
    const dg = s.goals_for - s.goals_against;
    return `<tr class="${VFN.eVFN(s.team_name) ? "is-vfn-row" : ""}">
      <td class="pos-col">${i + 1}</td>
      <td class="team-col"><span class="team-inline">${logoPorId(s.team_id, s.team_name)}${escapeHtml(s.team_name)}</span></td>
      <td>${s.played}</td><td>${s.won}</td><td>${s.drawn}</td><td>${s.lost}</td><td>${s.goals_for}</td><td>${s.goals_against}</td>
      <td>${dg > 0 ? "+" + dg : dg}</td><td class="pts-col">${s.points}</td>
    </tr>`;
  }).join("");
}

/* =========================================================
   JORNADAS AF GUARDA (league_results)
   Resultados de todos os jogos da liga entre as outras equipas;
   os jogos do VFN vêm do Calendário (matches).
   ========================================================= */

const filtrosJornadas = { competicao: VFN.COMPETICOES_CLASSIFICACAO[0], jornada: "", equipa: "", ordem: "asc" };
let resultadoEmEdicao = null;

function dadosJornadas() {
  return { matches: jogosCalendario, teams: equipasCalendario, league_results: resultadosLiga };
}

function initJornadas() {
  el("jornadasCompeticao").innerHTML = VFN.COMPETICOES_CLASSIFICACAO.map(c => `<option>${escapeHtml(c)}</option>`).join("");
  el("jornadasCompeticao").addEventListener("change", e => { filtrosJornadas.competicao = e.target.value; filtrosJornadas.jornada = ""; filtrosJornadas.equipa = ""; renderJornadasAdmin(); });
  el("jornadasFiltroJornada").addEventListener("change", e => { filtrosJornadas.jornada = e.target.value; renderJornadasAdmin(); });
  el("jornadasFiltroEquipa").addEventListener("change", e => { filtrosJornadas.equipa = e.target.value; renderJornadasAdmin(); });
  el("btnOrdemJornadas").addEventListener("click", () => { filtrosJornadas.ordem = filtrosJornadas.ordem === "asc" ? "desc" : "asc"; renderJornadasAdmin(); });
  el("btnGuardarResultadoLiga").addEventListener("click", guardarResultadoLiga);
  el("btnCancelarResultadoLiga").addEventListener("click", () => limparFormJornada());
  el("jornadasLista").addEventListener("click", e => {
    const botao = e.target.closest("[data-acao]");
    if (!botao) return;
    const registo = resultadosLiga.find(r => String(r.id) === botao.dataset.id);
    if (!registo) return;
    if (botao.dataset.acao === "editar") editarResultadoLiga(registo);
    else if (botao.dataset.acao === "apagar") apagarResultadoLiga(registo);
  });
}

function opcoesEquipasLiga(selecionada) {
  return '<option value="">— Equipa —</option>' + [...equipasCalendario]
    .filter(t => !VFN.eVFN(t.name))
    .sort((a, b) => a.name.localeCompare(b.name, "pt"))
    .map(t => `<option value="${escapeHtml(t.id)}" ${String(t.id) === String(selecionada) ? "selected" : ""}>${escapeHtml(t.name)}</option>`).join("");
}

function renderJornadasAdmin() {
  if (!el("jornadasLista")) return;
  const dados = dadosJornadas();
  el("jornadasCompeticao").value = filtrosJornadas.competicao;
  const jornadas = VFNHub.jornadasDisponiveis(dados, filtrosJornadas.competicao);
  el("jornadasFiltroJornada").innerHTML = '<option value="">Todas as jornadas</option>' + jornadas.map(n => `<option value="${n}">${n ? "Jornada " + n : "Sem jornada"}</option>`).join("");
  el("jornadasFiltroJornada").value = jornadas.map(String).includes(filtrosJornadas.jornada) ? filtrosJornadas.jornada : "";
  const equipas = VFNHub.equipasDasJornadas(dados, filtrosJornadas.competicao);
  el("jornadasFiltroEquipa").innerHTML = '<option value="">Todas as equipas</option>' + equipas.map(t => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.nome)}</option>`).join("");
  el("jornadasFiltroEquipa").value = equipas.some(t => t.id === filtrosJornadas.equipa) ? filtrosJornadas.equipa : "";
  el("btnOrdemJornadas").innerHTML = `${VFN.icone(filtrosJornadas.ordem === "asc" ? "arrow-up-1-0" : "arrow-down-1-0", 16)} Jornada ${filtrosJornadas.ordem === "asc" ? "↑" : "↓"}`;
  if (!el("jornadaCasa").options.length) limparFormJornada();
  el("jornadasLista").innerHTML = VFNHub.jornadasHTML(dados, { ...filtrosJornadas, editavel: true });
}

function limparFormJornada(manterJornada) {
  resultadoEmEdicao = null;
  const jornada = manterJornada ? el("jornadaNumero").value : "";
  el("jornadaNumero").value = jornada;
  el("jornadaCasa").innerHTML = opcoesEquipasLiga("");
  el("jornadaFora").innerHTML = opcoesEquipasLiga("");
  ["jornadaGolosCasa", "jornadaGolosFora", "jornadaMarcadores"].forEach(id => { el(id).value = ""; });
  el("btnGuardarResultadoLiga").textContent = "Adicionar resultado";
  el("btnCancelarResultadoLiga").hidden = true;
  mostrarErroAdmin("jornadasErro", null);
}

function editarResultadoLiga(r) {
  resultadoEmEdicao = r;
  filtrosJornadas.competicao = r.competition;
  el("jornadaNumero").value = r.jornada;
  el("jornadaCasa").innerHTML = opcoesEquipasLiga(r.home_team_id);
  el("jornadaFora").innerHTML = opcoesEquipasLiga(r.away_team_id);
  el("jornadaGolosCasa").value = r.score_home ?? "";
  el("jornadaGolosFora").value = r.score_away ?? "";
  el("jornadaMarcadores").value = r.scorers || "";
  el("btnGuardarResultadoLiga").textContent = "Guardar alterações";
  el("btnCancelarResultadoLiga").hidden = false;
  el("jornadaNumero").focus();
}

async function guardarResultadoLiga() {
  const jornada = Number(el("jornadaNumero").value);
  const casa = equipaPorId(el("jornadaCasa").value), fora = equipaPorId(el("jornadaFora").value);
  const gc = el("jornadaGolosCasa").value, gf = el("jornadaGolosFora").value;
  const erro = !(jornada > 0) ? "Indica o número da jornada." : !casa || !fora ? "Escolhe a equipa da casa e a de fora." : casa.id === fora.id ? "As equipas têm de ser diferentes." : (gc === "") !== (gf === "") ? "Indica os dois resultados (ou nenhum, se o jogo ainda não se realizou)." : "";
  el("jornadasErro").textContent = erro;
  if (erro) return;
  const linha = {
    ...(resultadoEmEdicao || {}),
    competition: filtrosJornadas.competicao,
    jornada,
    home_team_id: casa.id, home_team_name: casa.name,
    away_team_id: fora.id, away_team_name: fora.name,
    score_home: gc === "" ? null : Number(gc),
    score_away: gf === "" ? null : Number(gf),
    scorers: el("jornadaMarcadores").value.trim() || null
  };
  const botao = el("btnGuardarResultadoLiga");
  botao.disabled = true;
  try {
    const gravado = await dadosClube.guardar("league_results", linha);
    resultadosLiga = resultadosLiga.filter(r => String(r.id) !== String(gravado.id)).concat(gravado);
    limparFormJornada(true); // mantém a jornada para lançar os jogos seguintes
    renderJornadasAdmin();
  } catch (e) {
    el("jornadasErro").textContent = mensagemErro(e);
  } finally {
    botao.disabled = false;
  }
}

async function apagarResultadoLiga(r) {
  if (!confirm(`Eliminar ${r.home_team_name} – ${r.away_team_name} (jornada ${r.jornada})?`)) return;
  try {
    await dadosClube.remover("league_results", r.id);
    resultadosLiga = resultadosLiga.filter(x => x !== r);
    if (resultadoEmEdicao === r) limparFormJornada();
    renderJornadasAdmin();
  } catch (e) {
    alert(mensagemErro(e));
  }
}

/* =========================================================
   ADVERSÁRIOS (teams + opponents)
   ========================================================= */

function initAdversarios() {
  el("equipasPesquisa").addEventListener("input", renderAdversarios);
  el("btnAddEquipa").addEventListener("click", () => abrirModalEquipa(null));
  el("btnEquipaCancelar").addEventListener("click", () => fecharModalAdmin("modalEquipa"));
  el("btnEquipaGuardar").addEventListener("click", guardarEquipa);
  el("btnEquipaApagar").addEventListener("click", apagarEquipa);
  el("equipaLogoUpload").addEventListener("change", () => {
    const ficheiro = el("equipaLogoUpload").files[0];
    if (!ficheiro) return;
    const reader = new FileReader();
    reader.onload = () => { el("equipaLogoPreview").innerHTML = `<img class="team-logo" src="${reader.result}" alt="">`; };
    reader.readAsDataURL(ficheiro);
  });
}

function observacaoDaEquipa(teamId) {
  return cacheAdmin.opponents.find(o => String(o.team_id) === String(teamId)) || null;
}

function historicoContra(teamId) {
  const jogos = jogosCalendario.filter(j => String(j.opponent_team_id) === String(teamId));
  const r = { V: 0, E: 0, D: 0 };
  jogos.forEach(j => { const l = VFN.letraResultado(j); if (VFN.estadoJogo(j) === "jogado" && l) r[l]++; });
  return r;
}

function renderAdversarios() {
  const termo = el("equipasPesquisa").value.trim().toLocaleLowerCase("pt-PT");
  const equipas = [...equipasCalendario]
    .filter(t => !termo || t.name.toLocaleLowerCase("pt-PT").includes(termo))
    .sort((a, b) => a.name.localeCompare(b.name, "pt"));
  const grelha = el("equipasGrid");
  if (!equipas.length) {
    grelha.innerHTML = `<p class="empty-state">${equipasCalendario.length ? "Nenhuma equipa corresponde à pesquisa." : "Ainda não há equipas. Adiciona os clubes da competição (incluindo o VFN) para aparecerem no calendário e na classificação."}</p>`;
    return;
  }
  grelha.innerHTML = equipas.map(t => {
    const obs = observacaoDaEquipa(t.id);
    const h = historicoContra(t.id);
    const temObs = obs && (obs.style || obs.strengths || obs.weaknesses || obs.history || obs.formation);
    return `<button type="button" class="team-card" data-id="${escapeHtml(t.id)}">
      ${logoEquipaHTML(t, t.name)}
      <strong>${escapeHtml(t.name)}</strong>
      ${VFN.eVFN(t.name) ? '<small>O nosso clube</small>' : `<small>Histórico: ${h.V}V ${h.E}E ${h.D}D</small>${temObs ? `<span class="scouting-flag">${VFN.icone("check", 14)} Observação</span>` : ""}`}
    </button>`;
  }).join("");
  grelha.querySelectorAll(".team-card").forEach(b => b.addEventListener("click", () => abrirModalEquipa(equipaPorId(b.dataset.id))));
}

function abrirModalEquipa(equipa) {
  equipaEmEdicaoAdmin = equipa;
  const obs = equipa ? observacaoDaEquipa(equipa.id) : null;
  el("modalEquipaTitulo").textContent = equipa ? equipa.name : "Adicionar Equipa";
  el("equipaNome").value = equipa ? equipa.name : "";
  el("equipaLogo").value = equipa && equipa.logo_url && !equipa.logo_url.startsWith("data:") ? equipa.logo_url : "";
  el("equipaLogoUpload").value = "";
  el("equipaLogoPreview").innerHTML = equipa ? logoEquipaHTML(equipa, equipa.name) : "";
  el("equipaFormacao").value = obs ? obs.formation || "" : "";
  el("equipaEstilo").value = obs ? obs.style || "" : "";
  el("equipaFortes").value = obs ? obs.strengths || "" : "";
  el("equipaFracos").value = obs ? obs.weaknesses || "" : "";
  el("equipaHistorico").value = obs ? obs.history || "" : "";
  el("equipaApagarWrap").hidden = !equipa;
  el("equipaErro").textContent = "";
  el("equipaObservacao").hidden = equipa ? VFN.eVFN(equipa.name) : false;
  abrirModalAdmin("modalEquipa");
}

async function carregarLogoEquipa(ficheiro, teamId) {
  if (!ficheiro) return null;
  if (!dadosClube.usaSupabase()) {
    return new Promise(resolve => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = () => resolve(null); r.readAsDataURL(ficheiro); });
  }
  const caminho = `${currentUser.id}/teams/${teamId}-${Date.now()}-${ficheiro.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const { error } = await supabaseClient.storage.from("player-photos").upload(caminho, ficheiro, { upsert: true });
  if (error) throw error;
  return supabaseClient.storage.from("player-photos").getPublicUrl(caminho).data.publicUrl;
}

function idEquipaNovo(nome) {
  const base = VFN.slug(nome);
  let id = base, n = 2;
  while (equipaPorId(id)) id = `${base}-${n++}`;
  return id;
}

async function guardarEquipa() {
  const nome = el("equipaNome").value.trim();
  if (!nome) { el("equipaErro").textContent = "Indica o nome da equipa."; return; }
  const botao = el("btnEquipaGuardar");
  botao.disabled = true;
  try {
    const id = equipaEmEdicaoAdmin ? equipaEmEdicaoAdmin.id : idEquipaNovo(nome);
    let logo = el("equipaLogo").value.trim() || (equipaEmEdicaoAdmin ? equipaEmEdicaoAdmin.logo_url : null) || null;
    const carregado = await carregarLogoEquipa(el("equipaLogoUpload").files[0], id);
    if (carregado) logo = carregado;
    const equipa = await dadosClube.guardar("teams", { ...(equipaEmEdicaoAdmin || {}), id, name: nome, logo_url: logo });
    equipasCalendario = equipasCalendario.filter(t => String(t.id) !== String(equipa.id)).concat(equipa);

    if (!VFN.eVFN(nome)) {
      const campos = { formation: el("equipaFormacao").value.trim() || null, style: el("equipaEstilo").value.trim() || null, strengths: el("equipaFortes").value.trim() || null, weaknesses: el("equipaFracos").value.trim() || null, history: el("equipaHistorico").value.trim() || null };
      const existente = observacaoDaEquipa(equipa.id);
      if (existente || Object.values(campos).some(Boolean)) {
        const obs = await dadosClube.guardar("opponents", { ...(existente || {}), team_id: equipa.id, ...campos, updated_at: new Date().toISOString() });
        cacheAdmin.opponents = cacheAdmin.opponents.filter(o => String(o.id) !== String(obs.id)).concat(obs);
      }
    }
    fecharModalAdmin("modalEquipa");
    renderAdversarios();
    renderCalendarioAdmin();
    renderProximoJogoPreJogo();
  } catch (e) {
    el("equipaErro").textContent = mensagemErro(e);
  } finally {
    botao.disabled = false;
  }
}

async function apagarEquipa() {
  const equipa = equipaEmEdicaoAdmin;
  if (!equipa || !confirm(`Eliminar ${equipa.name}? Os jogos do calendário mantêm o nome do adversário.`)) return;
  try {
    const obs = observacaoDaEquipa(equipa.id);
    if (obs) await dadosClube.remover("opponents", obs.id);
    await dadosClube.remover("teams", equipa.id);
    cacheAdmin.opponents = cacheAdmin.opponents.filter(o => o !== obs);
    equipasCalendario = equipasCalendario.filter(t => t !== equipa);
    fecharModalAdmin("modalEquipa");
    renderAdversarios();
    renderCalendarioAdmin();
  } catch (e) {
    el("equipaErro").textContent = mensagemErro(e);
  }
}

/* =========================================================
   NAVEGAÇÃO E ARRANQUE
   ========================================================= */

async function abrirTabGestao(tab) {
  document.body.classList.toggle("tab-gestao", TABS_GESTAO.includes(tab));
  if (tab === "multas") {
    await carregarTabelaAdmin("fines", "multasErro");
    renderMultas();
  } else if (tab === "presencas") {
    await Promise.all([carregarTabelaAdmin("attendance", "presencasErro"), carregarTabelaAdmin("sessions", "presencasErro"), carregarTabelaAdmin("fines", "presencasErro")]);
    renderPresencas();
  } else if (tab === "calendario") {
    renderCalendarioAdmin();
  } else if (tab === "resultados") {
    renderResultados();
  } else if (tab === "jornadas") {
    renderJornadasAdmin();
  } else if (tab === "classificacao") {
    renderClassificacaoAdmin();
  } else if (tab === "adversarios") {
    await carregarTabelaAdmin("opponents", "adversariosErro");
    renderAdversarios();
  }
  VFN.refreshAOS();
}

/** Aviso quando quem entra no admin não tem o papel admin. */
async function verificarPapelAdmin() {
  if (!supabaseClient || !currentUser) return;
  const perfil = await VFN.obterPapel(supabaseClient, currentUser);
  const aviso = el("avisoPapel");
  if (!perfil) {
    aviso.innerHTML = 'O teu utilizador ainda não tem papel atribuído. As alterações não vão ser gravadas até correres o bloco "ADMIN" do <code>schema.sql</code>.';
    aviso.hidden = false;
  } else if (perfil.role !== "admin" && perfil.role !== "sem-tabela") {
    aviso.innerHTML = 'Esta é a área de administração. Como treinador/dirigente usa o <a href="dashboard.html">Dashboard</a>.';
    aviso.hidden = false;
  }
}

function initAdmin() {
  initMultas();
  initPresencas();
  initCalendarioAdmin();
  initResultados();
  initJornadas();
  initAdversarios();

  document.querySelectorAll(".tab-btn[data-tab]").forEach(btn => btn.addEventListener("click", () => abrirTabGestao(btn.dataset.tab)));
  document.querySelectorAll("[data-fechar-modal]").forEach(b => b.addEventListener("click", () => fecharModalAdmin(b.dataset.fecharModal)));
  ["modalMulta", "modalSessao", "modalJogo", "modalEquipa"].forEach(id => {
    el(id).addEventListener("click", e => { if (e.target.id === id) fecharModalAdmin(id); });
  });
  document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    ["modalMulta", "modalSessao", "modalJogo", "modalEquipa"].forEach(id => { if (!el(id).hidden) fecharModalAdmin(id); });
  });
  verificarPapelAdmin();
}
