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
const TABS_GESTAO = ["multas", "convocatoria", "presencas", "calendario", "resultados", "jornadas", "historico", "classificacao", "adversarios"];

const cacheAdmin = { fines: [], attendance: [], sessions: [], opponents: [], fine_types: [], staff: [], squads: [] };
let colunaTipoMulta = true; // fines.fine_type_id (v4); passa a false se a BD ainda não a tiver
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

/** Equipa técnica (tabela staff, ou o treinador por omissão antes do SQL v4). */
function staffAdmin() {
  return (cacheAdmin.staff.length ? cacheAdmin.staff : VFN.STAFF_PADRAO).map(VFN.pessoaStaff);
}

/** Jogador do plantel ou elemento da equipa técnica (as multas do treinador usam o id dele). */
function pessoaPorId(id) {
  return jogadorPorIdBD(id) || staffAdmin().find(p => p.id === String(id)) || null;
}

/** Tipos de multa e equipa técnica: tabelas opcionais (antes do SQL v4 usa os valores por omissão). */
async function carregarTiposMulta() {
  if (tabelasCarregadas.has("fine_types")) return;
  tabelasCarregadas.add("fine_types");
  const ler = async t => { try { return await dadosClube.listar(t); } catch (e) { return null; } };
  const [tipos, staff] = await Promise.all([ler("fine_types"), ler("staff")]);
  cacheAdmin.fine_types = tipos || [];
  cacheAdmin.staff = staff || [];
  // modo local: a tabela começa vazia; grava os tipos por omissão (no Supabase vêm do SQL v4)
  if (tipos && !tipos.length && !dadosClube.usaSupabase()) {
    cacheAdmin.fine_types = VFN.TIPOS_MULTA.map(t => ({ id: t.id, name: t.tipo, amount: t.valor, payer: t.pagador, description: t.descricao || null }));
    dadosClube.gravarLocal("fine_types", cacheAdmin.fine_types);
  }
  tabelaTiposMulta = tipos !== null;
  if (tipos && tipos.length) VFN.definirTiposMulta(tipos);
}
let tabelaTiposMulta = false; // a tabela fine_types existe (SQL v4 corrido ou modo local)

function celulaJogadorHTML(playerId) {
  const j = pessoaPorId(playerId);
  if (!j) return `<span class="player-cell muted">Jogador removido</span>`;
  return `<span class="player-cell">${VFN.avatarJogador(j, "avatar-xs")}<span>${escapeHtml(j.nome)}</span></span>`;
}

/* =========================================================
   MULTAS
   ========================================================= */

function initMultas() {
  el("multasMes").innerHTML = opcoesMesesHTML(mesDaEpocaOuAtual(), true);
  el("multasMes").addEventListener("change", renderMultas);
  ["multasFiltroJogador", "multasFiltroTipo", "multasFiltroEstado"].forEach(id => el(id).addEventListener("change", renderMultas));
  el("btnExportarMultas").addEventListener("click", () => {
    const mes = el("multasMes").value;
    const folha = VFN.folhaMultas(multasDoPeriodo(), id => (pessoaPorId(id) || {}).nome);
    VFN.exportarXlsx(`multas_vfn_${mes}.xlsx`, [{ nome: "Multas " + el("multasMes").selectedOptions[0].textContent, ...folha }]);
  });
  el("multaTipo").addEventListener("change", () => aplicarTipoMulta(true));
  el("multaValorManual").addEventListener("change", () => { el("multaValor").readOnly = !el("multaValorManual").checked; if (!el("multaValorManual").checked) aplicarTipoMulta(true); else el("multaValor").focus(); });
  el("btnAddTipoMulta").addEventListener("click", () => abrirModalTipoMulta(null));
  el("btnTipoMultaCancelar").addEventListener("click", () => fecharModalAdmin("modalTipoMulta"));
  el("btnTipoMultaGuardar").addEventListener("click", guardarTipoMulta);
  el("btnAddMulta").addEventListener("click", () => abrirModalMulta(null));
  el("btnJoiaMes").addEventListener("click", lancarJoiaDoMes);
  el("btnDividasImagem").addEventListener("click", () => VFNComp.exportarImagemDividas(cacheAdmin.fines, { pessoa: pessoaPorId }));
  el("btnDividasXlsx").addEventListener("click", () => VFN.exportarXlsx(`dividas_vfn_${hojeIso()}.xlsx`, [{ nome: "Dívidas", ...VFN.folhaDividas(cacheAdmin.fines, id => (pessoaPorId(id) || {}).nome) }]));
  el("btnMultaCancelar").addEventListener("click", () => fecharModalAdmin("modalMulta"));
  el("btnMultaGuardar").addEventListener("click", guardarMulta);
}

function renderFiltrosMultas() {
  const manter = (id, html) => { const s = el(id); const v = s.value; s.innerHTML = html; if ([...s.options].some(o => o.value === v)) s.value = v; };
  manter("multasFiltroJogador", opcoesPlantelHTML("").replace("— Selecionar jogador —", "Todos os jogadores") + staffAdmin().map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.nome)} (${escapeHtml(p.posicao)})</option>`).join(""));
  const tipos = [...new Set([...VFN.TIPOS_MULTA.map(t => t.tipo), ...cacheAdmin.fines.map(f => f.infraction_type)])];
  manter("multasFiltroTipo", '<option value="">Todos os tipos</option>' + tipos.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(rotuloInfraccao(t))}</option>`).join(""));
}

function multasDoPeriodo() {
  const mes = el("multasMes").value;
  const jogador = el("multasFiltroJogador").value, tipo = el("multasFiltroTipo").value, estado = el("multasFiltroEstado").value;
  return cacheAdmin.fines
    .filter(f => mes === "epoca" || String(f.match_date || "").startsWith(mes))
    .filter(f => !jogador || String(f.player_id) === jogador)
    .filter(f => !tipo || f.infraction_type === tipo)
    .filter(f => !estado || (estado === "pago" ? f.paid : !f.paid))
    .sort((a, b) => String(b.match_date || "").localeCompare(String(a.match_date || "")));
}

/* ---------- Joia mensal (tipo 1) ---------- */

const INICIO_JOIA = "2026-10"; // a joia começa em outubro de 2026

/** Jogadores do plantel com e sem a joia do mês (AAAA-MM). */
function estadoJoia(mes) {
  const tipo = VFN.tipoMultaPorId(VFN.ID_JOIA);
  const temJoia = idBD => cacheAdmin.fines.some(f => String(f.player_id) === idBD && String(f.match_date || "").startsWith(mes) && (Number(f.fine_type_id) === VFN.ID_JOIA || (tipo && f.infraction_type === tipo.tipo)));
  const ids = plantel.map(idJogadorBD);
  return { tipo, lancados: ids.filter(temJoia), emFalta: ids.filter(id => !temJoia(id)) };
}

function renderEstadoJoia() {
  const mes = VFN.mesAtual();
  const nomeMes = VFN.MESES_LONGOS[Number(mes.slice(5)) - 1].toLowerCase();
  const { lancados, emFalta } = estadoJoia(mes);
  const antes = mes < INICIO_JOIA;
  el("btnJoiaMes").disabled = antes || !emFalta.length || !plantel.length;
  el("btnJoiaMes").textContent = emFalta.length && lancados.length ? `Lançar joia em falta (${emFalta.length})` : "Lançar Joia do Mês";
  el("joiaEstado").textContent = antes ? "A joia mensal começa em outubro de 2026." : !emFalta.length && lancados.length ? `Joia de ${nomeMes} já lançada (${lancados.length} jogadores).` : lancados.length ? `Joia de ${nomeMes}: ${lancados.length} lançadas, ${emFalta.length} em falta.` : `Joia de ${nomeMes} por lançar.`;
  el("joiaEstado").classList.toggle("feito", !emFalta.length && lancados.length > 0);
}

async function lancarJoiaDoMes() {
  await carregarTiposMulta();
  const mes = VFN.mesAtual();
  const { tipo, emFalta } = estadoJoia(mes);
  if (!tipo) { alert("O tipo 1 (Joia Mensal) não existe nos tipos de multa."); return; }
  if (!emFalta.length) { renderEstadoJoia(); return; }
  const nomeMes = VFN.MESES_LONGOS[Number(mes.slice(5)) - 1].toLowerCase();
  if (!confirm(`Lançar a joia de ${nomeMes} (${VFN.formatoEuro.format(tipo.valor)}) para ${emFalta.length} jogador${emFalta.length === 1 ? "" : "es"}?`)) return;
  const botao = el("btnJoiaMes");
  botao.disabled = true;
  try {
    for (const idBD of emFalta) {
      const gravada = await guardarLinhaMulta({ player_id: idBD, infraction_type: tipo.tipo, fine_type_id: tipo.id, amount: tipo.valor, match_date: `${mes}-01`, description: "Joia mensal", paid: false, paid_date: null });
      cacheAdmin.fines.push(gravada);
    }
    mostrarErroAdmin("multasErro", null);
  } catch (e) {
    mostrarErroAdmin("multasErro", e);
  } finally {
    renderMultas();
  }
}

function renderMultas() {
  renderFiltrosMultas();
  renderTiposMulta();
  renderEstadoJoia();
  el("dividasRelatorio").innerHTML = VFNComp.renderDebtReport(cacheAdmin.fines, { pessoa: pessoaPorId });
  const lista = multasDoPeriodo();
  const pendente = lista.filter(f => !f.paid).reduce((s, f) => s + (Number(f.amount) || 0), 0);
  const pago = lista.filter(f => f.paid).reduce((s, f) => s + (Number(f.amount) || 0), 0);
  el("multasResumo").innerHTML = `
    <div class="summary-tile tile-pendente"><span>Total pendente</span><strong>${formatoEuro.format(pendente)}</strong></div>
    <div class="summary-tile tile-pago"><span>Total arrecadado</span><strong>${formatoEuro.format(pago)}</strong></div>
    <div class="summary-tile"><span>Nº de multas</span><strong>${lista.length}</strong></div>`;

  const tbody = el("multasBody");
  if (!lista.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state">Sem multas neste período.</td></tr>`;
    return;
  }
  tbody.innerHTML = lista.map(f => `
    <tr data-id="${escapeHtml(f.id)}">
      <td data-v="${escapeHtml((pessoaPorId(f.player_id) || {}).nome || "")}">${celulaJogadorHTML(f.player_id)}</td>
      <td class="fine-infraction">${escapeHtml(rotuloInfraccao(f.infraction_type))}${f.description ? `<span class="fine-desc">${escapeHtml(f.description)}</span>` : ""}</td>
      <td class="num" data-v="${Number(f.amount) || 0}">${VFN.valorMultaHTML(f)}</td>
      <td><label class="paid-toggle" title="Marcar como pago"><input type="checkbox" data-acao="pago" ${f.paid ? "checked" : ""}><span class="switch" aria-hidden="true"></span><span>${f.paid ? "Pago" : "Pendente"}</span></label>${f.paid && f.paid_date ? `<span class="fine-desc">em ${dataPt(f.paid_date)}</span>` : ""}</td>
      <td data-v="${escapeHtml(f.match_date || "")}">${dataPt(f.match_date)}</td>
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

/** Ao escolher o tipo, o valor vem da tabela (só editável com "Alterar valor"); o pagador define a lista de pessoas. */
function aplicarTipoMulta(preencherValor) {
  const tipo = VFN.tipoMulta(el("multaTipo").value);
  if (preencherValor && tipo && !el("multaValorManual").checked) el("multaValor").value = tipo.valor;
  const treinador = !!tipo && tipo.pagador === "treinador";
  const anterior = el("multaJogador").value;
  el("multaJogadorLabel").textContent = treinador ? "Treinador" : "Jogador";
  el("multaJogador").innerHTML = treinador
    ? staffAdmin().filter(p => p.posicao === "Treinador").map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.nome)}</option>`).join("")
    : opcoesPlantelHTML(anterior);
  if ([...el("multaJogador").options].some(o => o.value === anterior)) el("multaJogador").value = anterior;
}

function opcoesTiposMultaHTML() {
  return VFN.TIPOS_MULTA.map(t => `<option value="${escapeHtml(t.tipo)}">${t.id}. ${escapeHtml(t.tipo)} — ${formatoEuro.format(t.valor)}${t.pagador === "treinador" ? " (treinador)" : ""}</option>`).join("");
}

async function abrirModalMulta(multa) {
  await carregarTiposMulta();
  multaEmEdicao = multa;
  el("modalMultaTitulo").textContent = multa ? "Editar Multa" : "Adicionar Multa";
  el("multaJogador").innerHTML = opcoesPlantelHTML(multa ? multa.player_id : "");
  el("multaTipo").innerHTML = opcoesTiposMultaHTML();
  // multas antigas com tipos que já não existem continuam a abrir
  if (multa && !VFN.tipoMulta(multa.infraction_type)) el("multaTipo").add(new Option(rotuloInfraccao(multa.infraction_type), multa.infraction_type));
  el("multaTipo").value = multa ? multa.infraction_type : VFN.TIPOS_MULTA[0].tipo;
  // ao editar mantém-se o valor gravado; o valor manual fica ativo se for diferente do tipo
  const tipo = VFN.tipoMulta(el("multaTipo").value);
  const manual = !!multa && (!tipo || Number(multa.amount) !== tipo.valor);
  el("multaValorManual").checked = manual;
  el("multaValor").readOnly = !manual;
  el("multaValor").value = multa ? multa.amount : "";
  aplicarTipoMulta(!multa);
  if (multa) el("multaJogador").value = multa.player_id;
  el("multaDescricao").value = multa ? multa.description || "" : "";
  el("multaData").value = multa ? multa.match_date || "" : hojeIso();
  el("multaErro").textContent = "";
  abrirModalAdmin("modalMulta");
}

/** Grava uma multa; se a BD ainda não tiver fines.fine_type_id, grava sem essa coluna. */
async function guardarLinhaMulta(linha) {
  const { fine_type_id, ...semTipo } = linha;
  if (!colunaTipoMulta) return dadosClube.guardar("fines", semTipo);
  try {
    return await dadosClube.guardar("fines", linha);
  } catch (e) {
    if (!/fine_type_id|does not exist|schema cache|could not find/i.test(e.message || "")) throw e;
    colunaTipoMulta = false;
    return dadosClube.guardar("fines", semTipo);
  }
}

async function guardarMulta() {
  const valor = Number(String(el("multaValor").value).replace(",", "."));
  const tipo = VFN.tipoMulta(el("multaTipo").value);
  const erro = !el("multaJogador").value ? "Escolhe quem paga a multa." : !(valor > 0) ? "Indica um valor em euros maior que zero." : !el("multaData").value ? "Indica a data." : "";
  el("multaErro").textContent = erro;
  if (erro) return;
  const linha = {
    ...(multaEmEdicao || {}),
    player_id: el("multaJogador").value,
    infraction_type: el("multaTipo").value,
    fine_type_id: tipo ? tipo.id : null,
    amount: Math.round(valor * 100) / 100,
    description: el("multaDescricao").value.trim() || null,
    match_date: el("multaData").value,
    paid: multaEmEdicao ? !!multaEmEdicao.paid : false,
    paid_date: multaEmEdicao ? multaEmEdicao.paid_date || null : null
  };
  const botao = el("btnMultaGuardar");
  botao.disabled = true;
  try {
    const gravada = await guardarLinhaMulta(linha);
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

/* ---------- Tipos de multa (tabela fine_types) ---------- */

let tipoMultaEmEdicao = null;

function renderTiposMulta() {
  const tbody = el("tiposMultaBody");
  if (!tbody) return;
  el("btnAddTipoMulta").disabled = !tabelaTiposMulta;
  el("tiposMultaErro").textContent = tabelaTiposMulta ? "" : "Corre a secção v4 do schema.sql no Supabase para poderes editar os tipos (até lá usam-se os valores por omissão).";
  tbody.innerHTML = VFN.TIPOS_MULTA.map(t => `<tr data-tipo-id="${t.id}">
    <td>${t.id}</td>
    <td>${escapeHtml(t.tipo)}${t.descricao ? `<span class="fine-desc">${escapeHtml(t.descricao)}</span>` : ""}</td>
    <td class="num">${formatoEuro.format(t.valor)}</td>
    <td>${t.pagador === "treinador" ? '<span class="status-badge status-agendado">Treinador</span>' : "Jogador"}</td>
    <td><div class="row-actions"><button type="button" class="icon-btn" data-acao="editar-tipo" title="Editar tipo" aria-label="Editar ${escapeHtml(t.tipo)}" ${tabelaTiposMulta ? "" : "disabled"}>${VFN.icone("pencil", 16)}</button><button type="button" class="icon-btn danger" data-acao="apagar-tipo" title="Apagar tipo" aria-label="Apagar ${escapeHtml(t.tipo)}" ${tabelaTiposMulta ? "" : "disabled"}>${VFN.icone("trash-2", 16)}</button></div></td>
  </tr>`).join("");
  tbody.querySelectorAll("tr[data-tipo-id]").forEach(tr => {
    const tipo = VFN.tipoMultaPorId(tr.dataset.tipoId);
    tr.querySelector("[data-acao=editar-tipo]").addEventListener("click", () => abrirModalTipoMulta(tipo));
    tr.querySelector("[data-acao=apagar-tipo]").addEventListener("click", () => apagarTipoMulta(tipo));
  });
}

function abrirModalTipoMulta(tipo) {
  tipoMultaEmEdicao = tipo;
  el("modalTipoMultaTitulo").textContent = tipo ? `Editar tipo ${tipo.id}` : "Novo tipo de multa";
  el("tipoMultaNome").value = tipo ? tipo.tipo : "";
  el("tipoMultaValor").value = tipo ? tipo.valor : "";
  el("tipoMultaPagador").value = tipo ? tipo.pagador : "jogador";
  el("tipoMultaDescricao").value = tipo ? tipo.descricao : "";
  el("tipoMultaErro").textContent = "";
  abrirModalAdmin("modalTipoMulta");
}

async function guardarTipoMulta() {
  const nome = el("tipoMultaNome").value.trim();
  const valor = Number(String(el("tipoMultaValor").value).replace(",", "."));
  const repetido = VFN.TIPOS_MULTA.some(t => t.tipo.toLowerCase() === nome.toLowerCase() && (!tipoMultaEmEdicao || t.id !== tipoMultaEmEdicao.id));
  const erro = !nome ? "Indica o nome." : repetido ? "Já existe um tipo com esse nome." : !(valor > 0) ? "Indica um valor maior que zero." : "";
  el("tipoMultaErro").textContent = erro;
  if (erro) return;
  const id = tipoMultaEmEdicao ? tipoMultaEmEdicao.id : Math.max(0, ...VFN.TIPOS_MULTA.map(t => t.id)) + 1;
  const linha = { id, name: nome, amount: Math.round(valor * 100) / 100, payer: el("tipoMultaPagador").value, description: el("tipoMultaDescricao").value.trim() || null };
  try {
    const gravado = await dadosClube.guardar("fine_types", linha);
    cacheAdmin.fine_types = cacheAdmin.fine_types.filter(t => Number(t.id) !== id).concat(gravado);
    VFN.definirTiposMulta(cacheAdmin.fine_types);
    fecharModalAdmin("modalTipoMulta");
    renderMultas();
  } catch (e) {
    el("tipoMultaErro").textContent = mensagemErro(e);
  }
}

async function apagarTipoMulta(tipo) {
  const usadas = cacheAdmin.fines.filter(f => f.infraction_type === tipo.tipo).length;
  if (!confirm(`Apagar o tipo "${tipo.tipo}"?${usadas ? `\n\nAs ${usadas} multa(s) já lançadas com este tipo mantêm-se.` : ""}`)) return;
  try {
    await dadosClube.remover("fine_types", tipo.id);
    cacheAdmin.fine_types = cacheAdmin.fine_types.filter(t => Number(t.id) !== tipo.id);
    VFN.definirTiposMulta(cacheAdmin.fine_types);
    renderMultas();
  } catch (e) {
    el("tiposMultaErro").textContent = mensagemErro(e);
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
  if (!confirm(`Eliminar a multa "${rotuloInfraccao(multa.infraction_type)}" de ${formatoEuro.format(Number(multa.amount) || 0)}?`)) return;
  try {
    await dadosClube.remover("fines", multa.id);
    cacheAdmin.fines = cacheAdmin.fines.filter(f => f !== multa);
    renderMultas();
  } catch (e) {
    alert(mensagemErro(e));
  }
}

/* =========================================================
   CONVOCATÓRIA (tabela squads)
   Escolhe-se o jogo, os 18–23 convocados (titular ou suplente),
   a formação e o capitão (automático pela ordem, mas alterável).
   ========================================================= */

const conv = { matchId: "", papel: new Map(), formation: "4-3-3", captain: "", id: null, published: false };

function initConvocatoria() {
  criarOpcoesFormacao(el("convFormacao"));
  el("convJogo").addEventListener("change", () => carregarConvocatoria(el("convJogo").value));
  el("convFormacao").addEventListener("change", () => { conv.formation = el("convFormacao").value; renderConvocatoria(); });
  el("convCapitao").addEventListener("change", () => { conv.captain = el("convCapitao").value; renderConvocatoria(); });
  el("convPlantel").addEventListener("click", e => {
    const b = e.target.closest("[data-conv-papel]");
    if (!b) return;
    const id = b.dataset.convId;
    if (b.dataset.convPapel) conv.papel.set(id, b.dataset.convPapel); else conv.papel.delete(id);
    renderConvocatoria();
  });
  el("btnConvGuardar").addEventListener("click", () => guardarConvocatoria(conv.published));
  el("btnConvPublicar").addEventListener("click", () => guardarConvocatoria(!conv.published));
  el("btnConvAnuncio1").addEventListener("click", () => exportarAnuncioAdmin("1x1"));
  el("btnConvAnuncio2").addEventListener("click", () => exportarAnuncioAdmin("9x16"));
}

/** Jogos do VFN a partir de ontem (os próximos primeiro) e os já com convocatória. */
function jogosParaConvocatoria() {
  const limite = Date.now() - 24 * 3600 * 1000;
  return VFN.jogosDoVFN(jogosCalendario)
    .filter(j => VFN.estadoJogo(j) !== "cancelado" && ((VFN.paraData(j.date) || 0) >= limite || VFNComp.convocatoriaDoJogo(cacheAdmin.squads, j.id)))
    .sort((a, b) => (VFN.paraData(a.date) || 0) - (VFN.paraData(b.date) || 0));
}

function carregarConvocatoria(matchId) {
  const squad = VFNComp.convocatoriaDoJogo(cacheAdmin.squads, matchId);
  conv.matchId = matchId;
  conv.papel = new Map();
  (squad ? squad.lineup || [] : []).forEach(id => conv.papel.set(String(id), "titular"));
  (squad ? (squad.player_ids || []).filter(id => !conv.papel.has(String(id))) : []).forEach(id => conv.papel.set(String(id), "suplente"));
  conv.formation = squad && squad.formation || "4-3-3";
  conv.captain = squad && squad.captain_id && squad.captain_id !== capitaoAutoConv() ? String(squad.captain_id) : "";
  conv.id = squad ? squad.id : null;
  conv.published = !!(squad && squad.published);
  el("convErro").textContent = "";
  renderConvocatoria();
}

const idsConv = papel => VFN.ordenarPorPosicao([...conv.papel].filter(([, p]) => p === papel).map(([id]) => jogadorPorIdBD(id)).filter(Boolean)).map(idJogadorBD);

function capitaoAutoConv() {
  return VFN.capitaoAutomatico(idsConv("titular"), { estado: id => (jogadorPorIdBD(id) || {}).disponibilidade || "" });
}

/** Capitão efetivo: o escolhido (se estiver no onze) ou o automático. */
function capitaoConv() {
  return conv.captain && idsConv("titular").includes(conv.captain) ? conv.captain : capitaoAutoConv();
}

/** Linha de squads a partir do estado do formulário. */
function squadDoFormulario(publicado) {
  const lineup = idsConv("titular"), subs = idsConv("suplente");
  return { ...(conv.id ? { id: conv.id } : {}), match_id: conv.matchId, player_ids: [...lineup, ...subs], lineup, subs, captain_id: capitaoConv() || null, formation: conv.formation, published: !!publicado };
}

function renderConvocatoria() {
  if (!el("convPlantel")) return;
  const jogos = jogosParaConvocatoria();
  const sel = el("convJogo");
  if (!conv.matchId || !jogos.some(j => j.id === conv.matchId)) {
    const proximo = VFN.proximoJogo(jogosCalendario);
    const inicial = proximo && jogos.some(j => j.id === proximo.id) ? proximo.id : jogos[0] ? jogos[0].id : "";
    if (inicial) { carregarConvocatoria(inicial); return; }
  }
  sel.innerHTML = jogos.length ? jogos.map(j => `<option value="${escapeHtml(j.id)}">${escapeHtml(`${VFN.dataCurta(j.date)} · ${nomeAdversarioJogo(j)} (${VFN.jogoEmCasa(j) ? "C" : "F"}) · ${VFN.nomeCurtoCompeticao(j.competition)}`)}${VFNComp.convocatoriaDoJogo(cacheAdmin.squads, j.id) ? " ✓" : ""}</option>`).join("") : '<option value="">Sem jogos agendados</option>';
  sel.value = conv.matchId;
  el("convFormacao").value = conv.formation;

  const titulares = idsConv("titular"), suplentes = idsConv("suplente");
  const total = titulares.length + suplentes.length;
  const auto = capitaoAutoConv();
  el("convCapitao").innerHTML = `<option value="">Automático${auto ? " (" + escapeHtml((jogadorPorIdBD(auto) || {}).nome || "") + ")" : ""}</option>` + titulares.map(id => `<option value="${escapeHtml(id)}">${escapeHtml((jogadorPorIdBD(id) || {}).nome || id)}</option>`).join("");
  el("convCapitao").value = conv.captain && titulares.includes(conv.captain) ? conv.captain : "";
  el("convCapitaoAuto").textContent = "Ordem automática: Toneca, Silvestre, Marco, Macedo (o primeiro no onze e disponível).";
  const ok = (v, cond) => `<span class="conv-contador ${cond ? "ok" : "falta"}">${v}</span>`;
  el("convResumo").innerHTML = `${ok(`${total} convocados`, total >= VFNComp.MIN_CONVOCADOS && total <= VFNComp.MAX_CONVOCADOS)} ${ok(`${titulares.length}/11 titulares`, titulares.length === 11)} ${ok(`${suplentes.length} suplentes`, suplentes.length > 0)} <span class="muted">Para publicar: ${VFNComp.MIN_CONVOCADOS}–${VFNComp.MAX_CONVOCADOS} convocados e 11 titulares.</span>`;
  const estado = el("convEstado");
  estado.hidden = !conv.id;
  estado.className = `estado-relatorio ${conv.published ? "publicado" : "rascunho"}`;
  estado.textContent = conv.published ? "Publicada" : "Rascunho";
  el("btnConvPublicar").innerHTML = conv.published ? `${VFN.icone("undo-2", 16)} Despublicar` : `${VFN.icone("send", 16)} Publicar`;
  [el("btnConvGuardar"), el("btnConvPublicar"), el("btnConvAnuncio1"), el("btnConvAnuncio2")].forEach(b => { b.disabled = !conv.matchId; });

  el("convPlantel").innerHTML = VFN.ordenarPorPosicao(plantel).map(j => {
    const id = idJogadorBD(j);
    const papel = conv.papel.get(id) || "";
    const indisponivel = ["lesionado", "suspenso", "indisponivel"].includes(j.disponibilidade);
    const botao = (valor, rotulo, titulo) => `<button type="button" class="conv-op${papel === valor ? " ativo" : ""}" data-conv-id="${escapeHtml(id)}" data-conv-papel="${valor}" aria-pressed="${papel === valor}" title="${titulo}">${rotulo}</button>`;
    return `<div class="conv-linha${papel ? " " + papel : ""}${indisponivel ? " indisponivel" : ""}">
      ${VFN.avatarJogador(j, "avatar-xs")}<b class="conv-num">${escapeHtml(j.numero || "—")}</b>
      <span class="conv-nome">${escapeHtml(j.nome)}<small class="muted">${escapeHtml(j.posicao)}</small></span>
      ${j.disponibilidade && j.disponibilidade !== "disponivel" ? VFN.badgeDisponibilidade(j.disponibilidade, true) : "<span></span>"}
      <span class="conv-escolha" role="group" aria-label="Convocatória de ${escapeHtml(j.nome)}">${botao("titular", "T", "Titular")}${botao("suplente", "S", "Suplente")}${botao("", "—", "Não convocado")}</span>
    </div>`;
  }).join("") || '<p class="empty-state">Plantel vazio.</p>';

  const jogo = jogosCalendario.find(j => j.id === conv.matchId);
  el("convPreview").innerHTML = jogo ? VFNComp.renderSquadView({ matches: jogosCalendario, teams: equipasCalendario }, jogo, squadDoFormulario(conv.published), jogadorPorIdBD) : '<p class="empty-state">Escolhe um jogo.</p>';
}

async function guardarConvocatoria(publicar) {
  const linha = squadDoFormulario(publicar);
  const total = linha.player_ids.length;
  const erro = !conv.matchId ? "Escolhe o jogo."
    : publicar && (total < VFNComp.MIN_CONVOCADOS || total > VFNComp.MAX_CONVOCADOS) ? `Para publicar, convoca entre ${VFNComp.MIN_CONVOCADOS} e ${VFNComp.MAX_CONVOCADOS} jogadores (tens ${total}).`
    : publicar && linha.lineup.length !== 11 ? `Para publicar, escolhe 11 titulares (tens ${linha.lineup.length}).` : "";
  el("convErro").textContent = erro;
  if (erro) return;
  if (publicar && !conv.published && !confirm("Publicar a convocatória? Os jogadores passam a vê-la na Área do Jogador.")) return;
  try {
    const gravada = await dadosClube.guardar("squads", linha);
    cacheAdmin.squads = cacheAdmin.squads.filter(s => String(s.id) !== String(gravada.id)).concat(gravada);
    conv.id = gravada.id;
    conv.published = !!gravada.published;
    renderConvocatoria();
  } catch (e) {
    el("convErro").textContent = /squads/i.test(e.message || "") && /does not exist|schema cache|could not find/i.test(e.message || "") ? "Falta a tabela squads: corre a secção de 03/10/2026 do schema.sql." : mensagemErro(e);
  }
}

function exportarAnuncioAdmin(formato) {
  const jogo = jogosCalendario.find(j => j.id === conv.matchId);
  if (!jogo) return;
  const squad = squadDoFormulario(conv.published);
  if (!squad.player_ids.length) { el("convErro").textContent = "Escolhe primeiro os convocados."; return; }
  VFNComp.exportarAnuncioConvocatoria({ matches: jogosCalendario, teams: equipasCalendario }, jogo, squad, jogadorPorIdBD, formato);
}

/* =========================================================
   PRESENÇAS
   ========================================================= */

function initPresencas() {
  el("presencasMes").innerHTML = opcoesMesesHTML(mesDaEpocaOuAtual(), false);
  el("presencasMes").addEventListener("change", renderPresencas);
  el("presencasFiltroJogador").addEventListener("change", renderPresencas);
  el("btnExportarPresencas").addEventListener("click", () => {
    const mes = el("presencasMes").value;
    const folha = VFN.folhaPresencas(sessoesDoMes(mes), plantel, (j, s) => (registoPresenca(idJogadorBD(j), s) || {}).status);
    VFN.exportarXlsx(`presencas_vfn_${mes}.xlsx`, [{ nome: "Presenças " + el("presencasMes").selectedOptions[0].textContent, ...folha }]);
  });
  el("btnAddSessao").addEventListener("click", () => {
    el("sessaoData").value = hojeIso();
    el("sessaoTipo").value = "treino";
    ["sessaoNotas", "sessaoHora", "sessaoLocal"].forEach(id => { el(id).value = ""; });
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

/* =========================================================
   PERFIL DO JOGADOR (radar) E ALERTA DE AMARELOS
   ========================================================= */

let graficoRadar = null;

/** % de presenças (P + A sobre os registos) do jogador na época. */
function percentagemPresencas(j) {
  const registos = cacheAdmin.attendance.filter(r => r.player_id === idJogadorBD(j) && r.status);
  return registos.length ? Math.round(registos.filter(r => r.status === "P" || r.status === "A").length / registos.length * 100) : 0;
}

/** Radar com 5 eixos, cada um em % do melhor valor do plantel (presenças em % real). */
function renderRadarJogador(jogador) {
  const caixa = el("playerModalRadar");
  if (!caixa) return;
  if (graficoRadar) { graficoRadar.destroy(); graficoRadar = null; }
  caixa.hidden = !jogador || !window.Chart;
  if (caixa.hidden) return;
  const cartoes = j => (Number(j.cartoesAmarelos) || 0) + 2 * (Number(j.cartoesVermelhos) || 0);
  const eixos = [
    ["Golos", j => Number(j.golos) || 0],
    ["Assistências", j => Number(j.assistencias) || 0],
    ["Cartões", cartoes],
    ["Minutos", j => Number(j.minutosTotais) || 0],
    ["Presenças", percentagemPresencas]
  ];
  const valores = eixos.map(([, f]) => f(jogador));
  const relativos = eixos.map(([nome, f], i) => {
    if (nome === "Presenças") return valores[i];
    const maximo = Math.max(...plantel.map(f));
    return maximo ? Math.round(valores[i] / maximo * 100) : 0;
  });
  // o modal ainda pode estar escondido: cria o gráfico já com o canvas visível
  requestAnimationFrame(() => {
    if (graficoRadar) graficoRadar.destroy();
    graficoRadar = new Chart(el("playerRadarCanvas"), {
      type: "radar",
      data: { labels: eixos.map(([n]) => n), datasets: [{ label: jogador.nome, data: relativos, backgroundColor: "rgba(255,215,0,.35)", borderColor: "#0A1628", borderWidth: 2, pointBackgroundColor: "#0A1628", pointRadius: 3 }] },
      options: {
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => { const i = c.dataIndex; const v = valores[i]; return ` ${eixos[i][0]}: ${eixos[i][0] === "Presenças" ? v + "%" : eixos[i][0] === "Minutos" ? v + "'" : v}${eixos[i][0] === "Cartões" ? " (vermelho conta 2)" : ""} · ${relativos[i]}% do máximo`; } } } },
        scales: { r: { min: 0, max: 100, ticks: { display: false, stepSize: 25 }, pointLabels: { font: { size: 12, weight: "600" }, color: "#0A1628" }, grid: { color: "rgba(10,22,40,.12)" }, angleLines: { color: "rgba(10,22,40,.12)" } } }
      }
    });
  });
}

/** Jogador do plantel do admin no formato das vistas (hub.js): minutos, cartoesA, cartoesV, id da BD. */
function jogadorParaFicha(j) {
  return { ...j, id: idJogadorBD(j), minutos: Number(j.minutosTotais) || 0, cartoesA: Number(j.cartoesAmarelos) || 0, cartoesV: Number(j.cartoesVermelhos) || 0, jogos: Number(j.jogos) || 0, golos: Number(j.golos) || 0, assistencias: Number(j.assistencias) || 0 };
}

/** Ficha visual (zonas no campo, anéis, barras e mapa de presenças) no modal do jogador. */
async function renderFichaAdmin(jogador) {
  const caixa = el("playerModalFicha");
  if (!caixa) return;
  caixa.hidden = !jogador || !plantel.includes(jogador);
  if (caixa.hidden) { caixa.innerHTML = ""; return; }
  const desenhar = () => {
    const id = idJogadorBD(jogador);
    caixa.innerHTML = VFNHub.fichaVisualHTML(jogadorParaFicha(jogador), plantel.map(jogadorParaFicha), VFNHub.opcoesFicha({ matches: jogosCalendario, attendance: cacheAdmin.attendance }, id));
  };
  desenhar();
  if (!tabelasCarregadas.has("attendance")) { await carregarTabelaAdmin("attendance", "presencasErro"); if (jogadorEmEdicao === jogador) desenhar(); }
}

/**
 * Alerta de amarelos (AF Guarda: suspensão ao 5.º): quem está a um amarelo
 * da suspensão (4, 9, ...) e quem completou um ciclo de 5 e não está marcado como suspenso.
 */
function renderAlertaAmarelos() {
  const alvo = el("alertaAmarelos");
  if (!alvo) return;
  const n = j => Number(j.cartoesAmarelos) || 0;
  const N = VFN.AMARELOS_SUSPENSAO;
  const suspensao = plantel.filter(j => VFN.alertaSuspensao(n(j), j.disponibilidade));
  const aUm = plantel.filter(j => n(j) % N === N - 1);
  alvo.hidden = !suspensao.length && !aUm.length;
  if (alvo.hidden) { alvo.innerHTML = ""; return; }
  const nomes = l => l.map(j => `<strong>${escapeHtml(j.nome)}</strong> (${n(j)})`).join(", ");
  alvo.innerHTML = `${VFN.icone("triangle-alert", 20)}<div>
    ${suspensao.length ? `<p><b>Suspensão:</b> ${nomes(suspensao)} — completou ${N} amarelos. Marca como <em>Suspenso</em> na ficha, se ainda não cumpriu o castigo.</p>` : ""}
    ${aUm.length ? `<p><b>A um amarelo da suspensão:</b> ${nomes(aUm)}.</p>` : ""}
  </div>`;
}

/** Mapa da época: toda a equipa, ou o jogador escolhido no filtro. */
function renderHeatmapAdmin(escolhido) {
  if (!el("presencasHeatmap")) return;
  const registos = cacheAdmin.attendance.filter(r => !escolhido || r.player_id === escolhido).map(r => ({ data: r.session_date, status: r.status }));
  const j = escolhido ? jogadorPorIdBD(escolhido) : null;
  el("presencasHeatmapInfo").textContent = j ? "· " + j.nome : "· % de presentes por dia";
  el("presencasHeatmap").innerHTML = VFN.heatmapPresencasHTML(registos, { individual: !!escolhido });
}

/** Drawer com as presenças do jogador no mês (editáveis) e o resumo da época. */
function abrirPresencasJogador(idBD) {
  const j = jogadorPorIdBD(idBD);
  if (!j) return;
  const sessoes = sessoesDoMes(el("presencasMes").value);
  const epoca = { P: 0, A: 0, F: 0, J: 0 };
  cacheAdmin.attendance.filter(a => a.player_id === idBD && epoca[a.status] !== undefined).forEach(a => { epoca[a.status]++; });
  const corpo = VFNComp.abrirDrawer({
    titulo: "Presenças · " + el("presencasMes").selectedOptions[0].textContent,
    corpo: VFNComp.renderAttendanceDrawer({ jogador: j, epoca, editavel: true, sessoes: sessoes.map(s => ({ data: s.data, tipo: s.tipo, estado: (registoPresenca(idBD, s) || {}).status || "" })) })
  });
  corpo.querySelectorAll("[data-definir]").forEach(b => b.addEventListener("click", () => {
    alternarPresenca(idBD, sessoes[Number(b.dataset.sessao)], b.dataset.definir);
    abrirPresencasJogador(idBD);
  }));
}

function renderPresencas() {
  const mes = el("presencasMes").value;
  const sessoes = sessoesDoMes(mes);
  const filtroJogador = el("presencasFiltroJogador");
  const escolhido = filtroJogador.value;
  filtroJogador.innerHTML = opcoesPlantelHTML(escolhido).replace("— Selecionar jogador —", "Todos os jogadores");
  const jogadores = [...plantel].filter(j => !escolhido || idJogadorBD(j) === escolhido).sort((a, b) => a.nome.localeCompare(b.nome, "pt"));
  renderHeatmapAdmin(escolhido);
  const container = el("presencasGrelha");
  // a grelha é redesenhada a cada clique: guardar scroll (da grelha e da página) e foco
  const grelhaAntiga = container.querySelector(".attendance-wrap");
  const scroll = { top: grelhaAntiga ? grelhaAntiga.scrollTop : 0, left: grelhaAntiga ? grelhaAntiga.scrollLeft : 0, pagina: window.scrollY };
  const focada = document.activeElement && document.activeElement.classList.contains("att-cell") ? { jogador: document.activeElement.dataset.attJogador, sessao: document.activeElement.dataset.sessao } : null;

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
      return `<td><button type="button" class="att-cell" data-att-jogador="${escapeHtml(idBD)}" data-sessao="${i}" data-status="${estado}" aria-label="${escapeHtml(j.nome)}, ${dataPt(s.data)}: ${NOMES_PRESENCA[estado] || "sem registo"}">${estado}</button></td>`;
    }).join("");
    return `<tr><th scope="row" class="col-player"><span class="player-cell">${VFN.avatarJogador(j, "avatar-xs")}<span>${escapeHtml(j.nome)}</span></span></th>${celulas}${["P", "F", "A", "J"].map(k => `<td class="col-total total-${k}">${totais[k]}</td>`).join("")}</tr>`;
  }).join("");

  const lista = VFNComp.listaPresencasHTML(jogadores.map(j => {
    const idBD = idJogadorBD(j);
    const totais = { P: 0, A: 0, F: 0, J: 0 };
    sessoes.forEach(s => { const r = registoPresenca(idBD, s); if (r && totais[r.status] !== undefined) totais[r.status]++; });
    return { jogador: j, id: idBD, totais };
  }));
  const rodape = totaisSessao.map(t => `<td title="Presentes ${t.P} · Faltas ${t.F} · Atrasos ${t.A} · Justificadas ${t.J}">${t.P + t.A}/${jogadores.length}</td>`).join("");

  container.innerHTML = `${lista}
    <div class="attendance-wrap">
      <table class="attendance-table" data-ordenar="presencas-admin">
        <thead><tr><th scope="col" class="col-player" data-tipo="texto">Jogador</th>${cabecalho}${["P", "F", "A", "J"].map(k => `<th scope="col" class="col-total" data-tipo="numero" title="${NOMES_PRESENCA[k]}">${k}</th>`).join("")}</tr></thead>
        <tbody>${linhas}</tbody>
        <tfoot><tr><td class="col-player">Presentes (P+A)</td>${rodape}${["P", "F", "A", "J"].map(k => `<td class="col-total total-${k}">${totaisGerais[k]}</td>`).join("")}</tr></tfoot>
      </table>
    </div>`;

  const grelha = container.querySelector(".attendance-wrap");
  grelha.scrollTop = scroll.top;
  grelha.scrollLeft = scroll.left;
  if (focada) {
    const alvo = [...container.querySelectorAll(".att-cell")].find(b => b.dataset.attJogador === focada.jogador && b.dataset.sessao === focada.sessao);
    if (alvo) alvo.focus({ preventScroll: true });
  }
  if (window.scrollY !== scroll.pagina) window.scrollTo(0, scroll.pagina);

  // a célula só marca a presença; a ficha do jogador abre apenas pela foto (data-jogador)
  container.querySelectorAll(".att-cell").forEach(btn => btn.addEventListener("click", e => { e.preventDefault(); alternarPresenca(btn.dataset.attJogador, sessoes[Number(btn.dataset.sessao)]); }));
  container.querySelectorAll("[data-presencas-jogador]").forEach(btn => btn.addEventListener("click", e => { if (!e.target.closest("[data-jogador]")) abrirPresencasJogador(btn.dataset.presencasJogador); }));
  container.querySelectorAll(".session-remove").forEach(btn => btn.addEventListener("click", () => removerSessao(sessoes[Number(btn.dataset.sessao)])));
}

/** Multa automática por falta ao treino: tipo 6 "Falta treino sem justificação", com o valor atual da tabela. */
function multaFaltaTreino() {
  const t = VFN.tipoMultaPorId(VFN.ID_FALTA_TREINO) || { id: VFN.ID_FALTA_TREINO, tipo: "Falta treino sem justificação", valor: 5 };
  return { infraction_type: t.tipo, fine_type_id: t.id, amount: t.valor };
}
const TIPOS_FALTA_AUTOMATICA = ["falta_treino", "Falta ao treino injustificada"]; // nomes usados antes da v4
const DESCRICAO_MULTA_AUTOMATICA = "Criada automaticamente (falta no treino)";

function multaAutomatica(playerId, data) {
  // só as criadas pela grelha (as antigas usavam o tipo 'falta_treino')
  return cacheAdmin.fines.find(f => String(f.player_id) === String(playerId) && f.match_date === data && (f.infraction_type === "falta_treino" || ((TIPOS_FALTA_AUTOMATICA.includes(f.infraction_type) || f.infraction_type === multaFaltaTreino().infraction_type) && f.description === DESCRICAO_MULTA_AUTOMATICA))) || null;
}

/** Falta num treino cria a multa automática; ao sair de F, a multa é retirada se ainda não estiver paga. */
async function sincronizarMultaFalta(playerId, sessao, anterior, seguinte) {
  if (sessao.tipo !== "treino" || (anterior !== "F" && seguinte !== "F")) return;
  if (!tabelasCarregadas.has("fines")) await carregarTabelaAdmin("fines", "presencasErro");
  const existente = multaAutomatica(playerId, sessao.data);
  if (seguinte === "F" && !existente) {
    const multa = await guardarLinhaMulta({ player_id: playerId, ...multaFaltaTreino(), match_date: sessao.data, description: DESCRICAO_MULTA_AUTOMATICA, paid: false, paid_date: null });
    cacheAdmin.fines.push(multa);
  } else if (anterior === "F" && seguinte !== "F" && existente && !existente.paid) {
    await dadosClube.remover("fines", existente.id);
    cacheAdmin.fines = cacheAdmin.fines.filter(f => f !== existente);
  }
}

/** Sem `estado`: passa ao seguinte do ciclo (grelha). Com `estado`: define-o (tocar no mesmo limpa). */
function alternarPresenca(playerId, sessao, estado) {
  const registo = registoPresenca(playerId, sessao);
  const atual = registo && registo.status || "";
  const seguinte = estado === undefined ? CICLO_PRESENCA[(CICLO_PRESENCA.indexOf(atual) + 1) % CICLO_PRESENCA.length] : (estado === atual ? "" : estado);

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
    const linha = { session_date: data, session_type: tipo, notes: el("sessaoNotas").value.trim() || null };
    // hora e local só vão no pedido quando preenchidos (as colunas são do SQL v4)
    if (el("sessaoHora").value) linha.start_time = el("sessaoHora").value;
    if (el("sessaoLocal").value.trim()) linha.location = el("sessaoLocal").value.trim();
    const gravada = await dadosClube.guardar("sessions", linha);
    cacheAdmin.sessions.push(gravada);
    fecharModalAdmin("modalSessao");
    if (calendarioMensalAdmin) calendarioMensalAdmin.render();
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
  el("calendarioCompeticaoFiltro").addEventListener("change", renderCalendarioAdmin);
  el("jogoAdversarioEquipa").addEventListener("change", () => { el("jogoAdversarioNomeWrap").hidden = el("jogoAdversarioEquipa").value !== ""; });
  el("btnAddJogo").addEventListener("click", () => abrirModalJogo(null));
  el("btnJogoCancelar").addEventListener("click", () => fecharModalAdmin("modalJogo"));
  el("btnJogoGuardar").addEventListener("click", guardarJogo);
  ["jogoCompeticao", "jogoGolosVFN", "jogoGolosAdv"].forEach(id => el(id).addEventListener("input", atualizarPenaltisJogo));
  el("jogoCompeticao").addEventListener("change", atualizarPenaltisJogo);
  el("jogoFase").innerHTML = '<option value="">— Fase —</option>' + VFN.FASES_TACA.map(([k, nome]) => `<option value="${k}">${escapeHtml(nome)}</option>`).join("");
  el("jogoCompeticao").addEventListener("change", atualizarCamposTaca);
}

/** Nas taças por eliminatórias o jogo tem fase (a jornada fica a null); nas ligas tem jornada. */
function atualizarCamposTaca() {
  const taca = VFN.eliminatorias(el("jogoCompeticao").value);
  el("jogoJornadaWrap").hidden = taca;
  el("jogoFaseWrap").hidden = !taca;
}

/* ---------- Vista mensal (componente partilhado) ---------- */

let calendarioMensalAdmin = null;

function renderCalendarioMensalAdmin() {
  if (!el("adminCalMes")) return;
  if (calendarioMensalAdmin) { calendarioMensalAdmin.render(); return; }
  calendarioMensalAdmin = VFNComp.criarCalendarioMensal(el("adminCalMes"), {
    obterDados: () => ({ matches: jogosCalendario, teams: equipasCalendario, sessions: cacheAdmin.sessions, attendance: cacheAdmin.attendance, match_reports: relatoriosAdmin, aniversariantes: VFN.aniversariantes(plantel, cacheAdmin.staff) }),
    perfil: "admin",
    nomeRelatorio: id => nomeJogador(id),
    nomePresenca: id => (pessoaPorId(id) || {}).nome,
    novoTreino: dia => {
      el("sessaoData").value = dia; el("sessaoTipo").value = "treino";
      ["sessaoHora", "sessaoLocal", "sessaoNotas"].forEach(id => { el(id).value = ""; });
      el("sessaoErro").textContent = "";
      abrirModalAdmin("modalSessao");
    },
    novoJogo: dia => { abrirModalJogo(null); el("jogoData").value = dia; }
  });
}

function renderCalendarioAdmin() {
  const tbody = el("calendarioBody");
  if (!tbody) return;
  const filtroComp = el("calendarioCompeticaoFiltro");
  const comps = [...new Set(VFN.jogosDoVFN(jogosCalendario).map(j => j.competition).filter(Boolean))].sort((x, y) => x.localeCompare(y, "pt"));
  const compEscolhida = comps.includes(filtroComp.value) ? filtroComp.value : "";
  filtroComp.innerHTML = '<option value="">Todas as competições</option>' + comps.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
  filtroComp.value = compEscolhida;
  const lista = VFN.jogosDoVFN(jogosCalendario)
    .filter(j => !compEscolhida || j.competition === compEscolhida)
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
      <td data-v="${escapeHtml(VFN.paraData(j.date) ? VFN.paraData(j.date).toISOString() : "")}">${escapeHtml(VFN.dataLonga(j.date, true))}</td>
      <td><span class="comp-tag comp-${VFN.categoriaCompeticao(j.competition)}">${escapeHtml(VFN.nomeCurtoCompeticao(j.competition))}</span></td>
      <td class="num">${escapeHtml(VFN.etiquetaJornada(j, true).replace(/^J/, "") || "—")}</td>
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
  const comp = jogo ? VFN.normalizarCompeticao(jogo.competition) : COMPETICOES[0];
  if (!COMPETICOES.includes(comp)) el("jogoCompeticao").add(new Option(comp, comp));
  el("jogoCompeticao").value = comp;
  el("jogoJornada").value = jogo && jogo.jornada != null ? jogo.jornada : "";
  el("jogoFase").value = jogo && VFN.eliminatorias(comp) ? VFN.faseDoJogo(jogo.phase, jogo.jornada) : "";
  atualizarCamposTaca();
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
  el("jogoPenaltis").value = jogo && jogo.winner_id ? (String(jogo.winner_id) === String(jogo.opponent_team_id) ? "adv" : "vfn") : "";
  atualizarPenaltisJogo();
  el("jogoErro").textContent = "";
  abrirModalAdmin("modalJogo");
}

/** Taça por eliminatórias com empate: pede o vencedor nos penáltis. */
function atualizarPenaltisJogo() {
  const gVFN = el("jogoGolosVFN").value, gAdv = el("jogoGolosAdv").value;
  el("jogoPenaltisWrap").hidden = !(VFN.eliminatorias(el("jogoCompeticao").value) && gVFN !== "" && gVFN === gAdv);
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
  const taca = VFN.eliminatorias(el("jogoCompeticao").value);
  const fase = taca ? el("jogoFase").value : "";
  const linha = {
    ...(jogoEmEdicao || {}),
    competition: el("jogoCompeticao").value,
    // taça com fase: a jornada não é obrigatória e fica a null
    jornada: fase ? null : el("jogoJornada").value && !taca ? Number(el("jogoJornada").value) : null,
    date: new Date(`${data}T${el("jogoHora").value || "15:00"}`).toISOString(),
    home_away: casa ? "Casa" : "Fora",
    opponent: nomeAdv,
    opponent_team_id: equipa ? equipa.id : null,
    status: estado,
    score_home: temResultado ? Number(casa ? gVFN : gAdv) : null,
    score_away: temResultado ? Number(casa ? gAdv : gVFN) : null,
    venue: el("jogoLocal").value.trim() || null
  };
  // winner_id só vai no pedido quando faz falta (ou já existia), para funcionar antes do SQL v4
  const penaltis = el("jogoPenaltisWrap").hidden ? "" : el("jogoPenaltis").value;
  const idVFN = VFN.equipaVFN(equipasCalendario).id;
  if (penaltis) linha.winner_id = penaltis === "vfn" ? idVFN : (equipa ? equipa.id : null);
  else if (jogoEmEdicao && "winner_id" in jogoEmEdicao) linha.winner_id = null;
  // phase só vai no pedido nas taças (ou se já existia), para funcionar antes do SQL de 03/10
  if (taca) linha.phase = fase || null;
  else if (jogoEmEdicao && "phase" in jogoEmEdicao) linha.phase = null;
  const botao = el("btnJogoGuardar");
  botao.disabled = true;
  try {
    let gravado;
    try {
      gravado = await dadosClube.guardar("matches", linha);
    } catch (e) {
      // BD sem matches.phase: a fase fica guardada no nº da jornada (1 = 1ª eliminatória ... 5 = final)
      if (!/phase/i.test(e.message || "")) throw e;
      delete linha.phase;
      if (fase) linha.jornada = VFN.numeroFase(fase);
      gravado = await dadosClube.guardar("matches", linha);
    }
    jogosCalendario = jogosCalendario.filter(j => String(j.id) !== String(gravado.id)).concat(gravado);
    fecharModalAdmin("modalJogo");
    renderCalendarioAdmin();
    if (calendarioMensalAdmin) calendarioMensalAdmin.render();
    renderResultados();
    renderJornadasAdmin();
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

function botaoRelatorio(j) {
  const r = relatorioDoJogoAdmin(j.id);
  const estado = r ? (estadoDoRelatorio(r) === "published" ? '<span class="estado-relatorio publicado">Publicado</span>' : '<span class="estado-relatorio rascunho">Rascunho</span>') : "";
  return `<button type="button" class="btn btn-ghost btn-sm" data-abrir-relatorio="${escapeHtml(j.id)}" title="${r ? "Abrir relatório" : "Fazer relatório"}">${VFN.icone(r ? "file-pen" : "file-plus", 16)} ${r ? "Relatório" : "Fazer Relatório"}</button>${estado}`;
}

function linhaResultadoHTML(j) {
  const { casa, fora } = VFN.equipasDoJogo(j, equipasCalendario);
  const doVFN = VFN.eJogoVFN(j);
  const estado = VFN.estadoJogo(j) || "agendado";
  const valor = v => (v == null || v === "" ? "" : Number(v));
  return `<tr data-id="${escapeHtml(j.id)}" class="${doVFN ? "is-vfn-game" : ""} state-${escapeHtml(estado)}">
    <td class="nowrap">${escapeHtml(VFN.dataLonga(j.date))}</td>
    <td class="num">${escapeHtml(VFN.etiquetaJornada(j, true).replace(/^J/, "") || "—")}</td>
    <td class="team-home"><span class="team-inline">${escapeHtml(casa.nome)}${logoPorId(casa.id, casa.nome)}</span></td>
    <td class="score-cell"><input type="number" min="0" data-campo="score_home" value="${valor(j.score_home)}" aria-label="Golos ${escapeHtml(casa.nome)}"><span>–</span><input type="number" min="0" data-campo="score_away" value="${valor(j.score_away)}" aria-label="Golos ${escapeHtml(fora.nome)}"></td>
    <td><span class="team-inline">${logoPorId(fora.id, fora.nome)}${escapeHtml(fora.nome)}</span></td>
    <td><select data-campo="status" aria-label="Estado do jogo">${ESTADOS_JOGO.map(([v, t]) => `<option value="${v}" ${v === estado ? "selected" : ""}>${t}</option>`).join("")}</select></td>
    <td><div class="row-actions-livre"><button type="button" class="icon-btn" data-jogo="vfn:${escapeHtml(j.id)}" title="Ver detalhe do jogo" aria-label="Ver detalhe do jogo">${VFN.icone("eye", 16)}</button>${doVFN ? botaoRelatorio(j) : ""}${doVFN ? `<button type="button" class="icon-btn" data-acao="editar-vfn" title="Editar jogo (data, hora, local, competição, fase)" aria-label="Editar jogo">${VFN.icone("pencil", 16)}</button>` : `<button type="button" class="icon-btn danger" data-acao="apagar" title="Eliminar jogo" aria-label="Eliminar jogo">${VFN.icone("trash-2", 16)}</button>`}</div></td>
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
    const editar = tr.querySelector("[data-acao=editar-vfn]");
    if (editar) editar.addEventListener("click", () => abrirModalJogo(jogo));
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
  const comps = VFN.COMPETICOES_CLASSIFICACAO; // 2ª Liga (tabela) e as duas taças (bracket)
  const atual = select.value;
  const proximo = VFN.proximoJogo(jogosCalendario);
  select.innerHTML = comps.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
  select.value = comps.includes(atual) ? atual : (proximo && comps.includes(proximo.competition) ? proximo.competition : comps[0] || "");
  select.hidden = !comps.length;

  // taças por eliminatórias: bracket em vez da tabela
  const taca = VFN.eliminatorias(select.value);
  el("classificacaoBracket").hidden = !taca;
  el("classificacaoBody").closest("table").hidden = taca;
  if (taca) { el("classificacaoBracket").innerHTML = VFNHub.bracketHTML(dadosJornadas(), select.value); return; }
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
  el("jornadasCompeticao").innerHTML = VFN.COMPETICOES_JORNADAS.map(c => `<option>${escapeHtml(c)}</option>`).join("");
  el("jornadasCompeticao").addEventListener("change", e => { filtrosJornadas.competicao = e.target.value; filtrosJornadas.jornada = ""; filtrosJornadas.equipa = ""; renderJornadasAdmin(); });
  el("jornadasFiltroJornada").addEventListener("change", e => { filtrosJornadas.jornada = e.target.value; renderJornadasAdmin(); });
  el("jornadasFiltroEquipa").addEventListener("change", e => { filtrosJornadas.equipa = e.target.value; renderJornadasAdmin(); });
  el("btnOrdemJornadas").addEventListener("click", () => { filtrosJornadas.ordem = filtrosJornadas.ordem === "asc" ? "desc" : "asc"; renderJornadasAdmin(); });
  el("btnGuardarResultadoLiga").addEventListener("click", guardarResultadoLiga);
  el("jornadaFase").innerHTML = VFN.FASES_TACA.map(([k, nome], i) => `<option value="${k}" data-jornada="${i + 1}">${escapeHtml(nome)}</option>`).join("");
  ["jornadaCasa", "jornadaFora", "jornadaGolosCasa", "jornadaGolosFora"].forEach(id => el(id).addEventListener("change", () => renderVencedorForm()));
  // sugere a data do jogo do VFN da mesma jornada (as jornadas jogam-se no mesmo fim de semana)
  el("jornadaNumero").addEventListener("change", () => {
    if (el("jornadaData").value) return;
    const jogo = VFN.jogosDoVFN(jogosCalendario).find(j => j.competition === filtrosJornadas.competicao && String(j.jornada) === el("jornadaNumero").value);
    if (jogo) el("jornadaData").value = VFN.dataIso(jogo.date);
  });
  el("btnCancelarResultadoLiga").addEventListener("click", () => limparFormJornada());
  el("jornadasLista").addEventListener("click", e => {
    const botao = e.target.closest("[data-acao]");
    if (!botao) return;
    if (botao.dataset.acao === "editar-vfn") {
      const jogo = jogosCalendario.find(j => String(j.id) === botao.dataset.id);
      if (jogo) abrirModalJogo(jogo);
      return;
    }
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
  el("jornadasFiltroJornada").innerHTML = '<option value="">Todas as jornadas</option>' + jornadas.map(n => `<option value="${n}">${escapeHtml(VFN.rotuloJornada(filtrosJornadas.competicao, n))}</option>`).join("");
  el("jornadasFiltroJornada").value = jornadas.map(String).includes(filtrosJornadas.jornada) ? filtrosJornadas.jornada : "";
  const equipas = VFNHub.equipasDasJornadas(dados, filtrosJornadas.competicao);
  el("jornadasFiltroEquipa").innerHTML = '<option value="">Todas as equipas</option>' + equipas.map(t => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.nome)}</option>`).join("");
  el("jornadasFiltroEquipa").value = equipas.some(t => t.id === filtrosJornadas.equipa) ? filtrosJornadas.equipa : "";
  el("btnOrdemJornadas").innerHTML = `${VFN.icone(filtrosJornadas.ordem === "asc" ? "arrow-up-1-0" : "arrow-down-1-0", 16)} Jornada ${filtrosJornadas.ordem === "asc" ? "↑" : "↓"}`;
  // as equipas podem chegar depois do primeiro render: reconstrói os menus mantendo a escolha
  ["jornadaCasa", "jornadaFora"].forEach(id => { const v = el(id).value; el(id).innerHTML = opcoesEquipasLiga(v); });
  const taca = VFN.eliminatorias(filtrosJornadas.competicao);
  el("jornadaNumero").closest(".field").hidden = taca;
  el("jornadaFase").closest(".field").hidden = !taca;
  el("jornadaVencedor").closest(".field").hidden = !taca;
  renderVencedorForm();
  // competições sem o VFN (1ª Divisão): classificação calculada aqui, fora do separador Classificação
  const tabela = VFNHub.classificacaoJornadasHTML(dados, filtrosJornadas.competicao);
  el("jornadasClassificacaoWrap").hidden = !tabela;
  el("jornadasClassificacao").innerHTML = tabela;
  el("jornadasLista").innerHTML = VFNHub.jornadasHTML(dados, { ...filtrosJornadas, editavel: true });
  el("jornadasMarcadores").innerHTML = VFNHub.marcadoresCampeonatoHTML({ ...dados, external_players: jogadoresExternos }, plantel.map(j => ({ ...j, id: idJogadorBD(j), golos: Number(j.golos) || 0 })), filtrosJornadas.competicao, 15);
}

/** Vencedor do confronto (taças): pelo resultado, ou escolhido quando há empate. */
function renderVencedorForm() {
  const casa = equipaPorId(el("jornadaCasa").value), fora = equipaPorId(el("jornadaFora").value);
  const gc = el("jornadaGolosCasa").value, gf = el("jornadaGolosFora").value;
  const anterior = el("jornadaVencedor").value || (resultadoEmEdicao && resultadoEmEdicao.winner_id) || "";
  const porResultado = gc !== "" && gf !== "" && Number(gc) !== Number(gf) ? (Number(gc) > Number(gf) ? casa : fora) : null;
  const opcoes = [casa, fora].filter(Boolean);
  el("jornadaVencedor").innerHTML = '<option value="">— Por decidir —</option>' + opcoes.map(t => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.name)}</option>`).join("");
  el("jornadaVencedor").value = porResultado ? porResultado.id : opcoes.some(t => String(t.id) === String(anterior)) ? anterior : "";
  el("jornadaVencedor").disabled = !!porResultado;
}

function limparFormJornada(manterJornada) {
  resultadoEmEdicao = null;
  const jornada = manterJornada ? el("jornadaNumero").value : "";
  el("jornadaNumero").value = jornada;
  if (!manterJornada) el("jornadaData").value = ""; // ao lançar a mesma jornada mantém a data
  el("jornadaCasa").innerHTML = opcoesEquipasLiga("");
  el("jornadaFora").innerHTML = opcoesEquipasLiga("");
  ["jornadaGolosCasa", "jornadaGolosFora", "jornadaMarcadores"].forEach(id => { el(id).value = ""; });
  marcadoresForm = [];
  renderMarcadoresForm();
  el("btnGuardarResultadoLiga").textContent = "Adicionar resultado";
  el("btnCancelarResultadoLiga").hidden = true;
  mostrarErroAdmin("jornadasErro", null);
}

function editarResultadoLiga(r) {
  resultadoEmEdicao = r;
  filtrosJornadas.competicao = r.competition;
  el("jornadaNumero").value = r.jornada ?? "";
  if (VFN.eliminatorias(r.competition)) el("jornadaFase").value = VFN.faseDoJogo(r.phase, r.jornada) || "1eliminatoria";
  el("jornadaData").value = r.match_date || "";
  el("jornadaCasa").innerHTML = opcoesEquipasLiga(r.home_team_id);
  el("jornadaFora").innerHTML = opcoesEquipasLiga(r.away_team_id);
  el("jornadaGolosCasa").value = r.score_home ?? "";
  el("jornadaGolosFora").value = r.score_away ?? "";
  el("jornadaMarcadores").value = r.scorers || "";
  el("jornadaVencedor").value = "";
  renderVencedorForm();
  el("jornadaVencedor").value = r.winner_id || el("jornadaVencedor").value;
  marcadoresForm = (Array.isArray(r.scorer_list) ? r.scorer_list : []).map(s => ({ lado: String(s.team_id) === String(r.away_team_id) ? "fora" : "casa", player_id: s.player_id || "", player_name: s.player_name || "", count: s.count || 1 }));
  renderMarcadoresForm();
  el("btnGuardarResultadoLiga").textContent = "Guardar alterações";
  el("btnCancelarResultadoLiga").hidden = false;
  el("jornadaNumero").focus();
}

async function guardarResultadoLiga() {
  const taca = VFN.eliminatorias(filtrosJornadas.competicao);
  // nas taças só a fase é obrigatória: a jornada fica a null
  const jornada = taca ? null : Number(el("jornadaNumero").value);
  const casa = equipaPorId(el("jornadaCasa").value), fora = equipaPorId(el("jornadaFora").value);
  const gc = el("jornadaGolosCasa").value, gf = el("jornadaGolosFora").value;
  const erro = taca && !el("jornadaFase").value ? "Escolhe a fase." : !taca && !(jornada > 0) ? "Indica o número da jornada." : !casa || !fora ? "Escolhe a equipa da casa e a de fora." : casa.id === fora.id ? "As equipas têm de ser diferentes." : (gc === "") !== (gf === "") ? "Indica os dois resultados (ou nenhum, se o jogo ainda não se realizou)." : "";
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
  if (taca) { linha.phase = el("jornadaFase").value; linha.winner_id = el("jornadaVencedor").value || null; }
  // match_date só vai no pedido quando há data (ou já existia), para funcionar antes de a coluna ser criada
  const data = el("jornadaData").value;
  if (data) linha.match_date = data;
  else if (resultadoEmEdicao && "match_date" in resultadoEmEdicao) linha.match_date = null;
  const botao = el("btnGuardarResultadoLiga");
  botao.disabled = true;
  try {
    const listaMarcadores = await gravarMarcadoresForm(casa, fora);
    // scorer_list só vai no pedido quando há marcadores (ou já existia), para funcionar antes do SQL v3
    if (listaMarcadores.length) linha.scorer_list = listaMarcadores;
    else if (resultadoEmEdicao && "scorer_list" in resultadoEmEdicao) linha.scorer_list = null;
    let gravado;
    try {
      gravado = await dadosClube.guardar("league_results", linha);
    } catch (e) {
      // antes do SQL de 03/10 a jornada é obrigatória (e antes da v4 não há phase/winner_id):
      // a fase fica também no nº da jornada (1 = 1ª eliminatória ... 5 = final)
      if (!taca || !/phase|winner_id|jornada|not-null/i.test(e.message || "")) throw e;
      linha.jornada = VFN.numeroFase(linha.phase);
      if (/phase|winner_id/i.test(e.message || "")) { delete linha.phase; delete linha.winner_id; }
      gravado = await dadosClube.guardar("league_results", linha);
    }
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
  if (!confirm(`Eliminar ${r.home_team_name} – ${r.away_team_name} (${VFN.etiquetaJornada(r) || "sem jornada"})?`)) return;
  try {
    await dadosClube.remover("league_results", r.id);
    resultadosLiga = resultadosLiga.filter(x => x !== r);
    if (resultadoEmEdicao === r) limparFormJornada();
    renderJornadasAdmin();
  } catch (e) {
    alert(mensagemErro(e));
  }
}

/* ---- Marcadores estruturados (league_results.scorer_list + external_players) ---- */

let jogadoresExternos = [];
let marcadoresForm = []; // [{ lado: "casa"|"fora", player_id, player_name, count }]

async function carregarJogadoresExternos() {
  try { jogadoresExternos = await dadosClube.listar("external_players"); }
  catch (e) { jogadoresExternos = []; } // tabela ainda não criada (schema.sql v3)
}

function equipaDoLado(lado) {
  return equipaPorId(el(lado === "fora" ? "jornadaFora" : "jornadaCasa").value);
}

function renderMarcadoresForm() {
  const casa = equipaDoLado("casa"), fora = equipaDoLado("fora");
  const ids = new Set([casa && String(casa.id), fora && String(fora.id)].filter(Boolean));
  el("listaJogadoresExternos").innerHTML = jogadoresExternos.filter(p => !ids.size || ids.has(String(p.team_id)))
    .map(p => `<option value="${escapeHtml(p.name)}" label="${escapeHtml(p.team_name || "")} · ID ${escapeHtml(p.id)}"></option>`).join("");
  el("jornadaMarcadoresLista").innerHTML = marcadoresForm.map((m, i) => `
    <div class="marcador-linha" data-i="${i}">
      <select data-campo="lado" aria-label="Equipa do marcador"><option value="casa" ${m.lado === "casa" ? "selected" : ""}>${escapeHtml(casa ? casa.name : "Casa")}</option><option value="fora" ${m.lado === "fora" ? "selected" : ""}>${escapeHtml(fora ? fora.name : "Fora")}</option></select>
      <input type="text" data-campo="player_name" list="listaJogadoresExternos" placeholder="Nome do jogador" value="${escapeHtml(m.player_name || "")}" aria-label="Nome do marcador">
      <input type="text" data-campo="player_id" inputmode="numeric" placeholder="ID Zerozero" value="${escapeHtml(m.player_id || "")}" aria-label="ID Zerozero do marcador">
      <input type="number" data-campo="count" min="1" value="${Number(m.count) || 1}" aria-label="Golos">
      <button type="button" class="icon-btn danger" data-remover="${i}" title="Remover marcador" aria-label="Remover marcador">${VFN.icone("x", 14)}</button>
    </div>`).join("");
}

function initMarcadoresForm() {
  el("btnAddMarcador").addEventListener("click", () => {
    marcadoresForm.push({ lado: "casa", player_id: "", player_name: "", count: 1 });
    renderMarcadoresForm();
    const linhas = el("jornadaMarcadoresLista").querySelectorAll(".marcador-linha");
    linhas[linhas.length - 1].querySelector("[data-campo=player_name]").focus();
  });
  ["jornadaCasa", "jornadaFora"].forEach(id => el(id).addEventListener("change", renderMarcadoresForm));
  el("jornadaMarcadoresLista").addEventListener("click", e => {
    const b = e.target.closest("[data-remover]");
    if (b) { marcadoresForm.splice(Number(b.dataset.remover), 1); renderMarcadoresForm(); }
  });
  el("jornadaMarcadoresLista").addEventListener("change", e => {
    const linha = e.target.closest(".marcador-linha");
    if (!linha) return;
    const m = marcadoresForm[Number(linha.dataset.i)];
    const campo = e.target.dataset.campo;
    m[campo] = e.target.value.trim();
    // nome ou ID conhecidos: completa o outro campo e a equipa
    const conhecido = campo === "player_id" ? jogadoresExternos.find(p => String(p.id) === m.player_id)
      : campo === "player_name" ? jogadoresExternos.find(p => p.name.toLowerCase() === m.player_name.toLowerCase()) : null;
    if (conhecido) {
      m.player_id = String(conhecido.id);
      m.player_name = conhecido.name;
      const fora = equipaDoLado("fora");
      if (fora && String(fora.id) === String(conhecido.team_id)) m.lado = "fora";
      else if (equipaDoLado("casa") && String(equipaDoLado("casa").id) === String(conhecido.team_id)) m.lado = "casa";
      renderMarcadoresForm();
    }
  });
}

/** Valida os marcadores, cria/atualiza external_players e devolve a scorer_list. */
async function gravarMarcadoresForm(casa, fora) {
  const lista = [];
  for (const m of marcadoresForm) {
    if (!m.player_name) continue;
    if (m.player_id && !/^\d+$/.test(m.player_id)) throw new Error(`O ID Zerozero de ${m.player_name} só pode ter algarismos.`);
    const equipaM = m.lado === "fora" ? fora : casa;
    if (m.player_id) {
      const existente = jogadoresExternos.find(p => String(p.id) === m.player_id);
      // reaproveita o jogador; cria-o (ou associa-o ao clube) se for novo
      if (!existente || existente.name !== m.player_name || String(existente.team_id) !== String(equipaM.id)) {
        const gravado = await dadosClube.guardar("external_players", { ...(existente || {}), id: m.player_id, name: m.player_name, team_id: equipaM.id, team_name: equipaM.name });
        jogadoresExternos = jogadoresExternos.filter(p => String(p.id) !== m.player_id).concat(gravado);
      }
    }
    lista.push({ player_id: m.player_id || null, player_name: m.player_name, team_id: String(equipaM.id), count: Math.max(1, Number(m.count) || 1) });
  }
  return lista;
}

/* =========================================================
   RELATÓRIOS DE JOGO (match_reports ligado a matches)
   O relatório é o mesmo estado do Pré-Jogo/Jogo/Análise; fica
   associado ao jogo (match_id), em rascunho até ser publicado.
   ========================================================= */

let colunasRelatorioV3 = true; // passa a false se a BD ainda não tiver as colunas novas
let colunaCapitao = true; // match_reports.captain_id (v4)
let gravacaoRelatorio = Promise.resolve();

function estadoDoRelatorio(r) {
  return VFNRelatorio.estadoRelatorio(r);
}

function relatorioDoJogoAdmin(matchId) {
  return VFNHub.relatorioDoJogo({ match_reports: relatoriosAdmin }, matchId);
}

function nomesJogadores(ids) {
  return (ids || []).filter(Boolean).map(id => nomeJogador(id)).filter(Boolean);
}

/** Linha de match_reports a partir do estado atual (colunas novas preenchidas para consulta direta). */
function linhaRelatorio() {
  const ev = state.jogo.eventos;
  const vfn = t => ev.filter(e => e.equipa === "VFN" && e.tipo === t);
  const seccoes = SECCOES_TATICAS.map(s => { const d = state.analise.seccoes[s.key] || {}; return d.texto ? `${s.titulo}${d.avaliacao ? " (" + d.avaliacao + ")" : ""}: ${d.texto}` : ""; }).filter(Boolean).join("\n\n");
  state._status = state.estadoRelatorio; // cópia no match_data (funciona antes do SQL v3)
  const base = { id: state.relatorioId || VFN.novoId(), user_id: currentUser ? currentUser.id : null, match_data: state, updated_at: new Date().toISOString() };
  if (!colunasRelatorioV3) return base;
  return {
    ...base,
    match_id: state.preJogo.matchId || null,
    status: state.estadoRelatorio,
    competition: state.preJogo.competicao || null,
    match_date: state.preJogo.data || null,
    location: state.preJogo.local || null,
    opponent: state.preJogo.adversario || null,
    score_vfn: state.jogo.golosVFN,
    score_opponent: state.jogo.golosAdversario,
    squad: nomesJogadores([...state.jogo.titulares, ...state.jogo.suplentes]),
    lineup: nomesJogadores(state.jogo.titulares),
    formation: state.jogo.formacaoVFN || null,
    substitutions: vfn("Substituição").map(e => ({ min: Number(e.minuto) || 0, out: nomeJogador(e.jogadorSaiId), in: nomeJogador(e.jogadorId) })),
    scorers: ev.filter(e => e.equipa === "VFN" && e.tipo === "Golo").map(e => ({ name: nomeJogador(e.jogadorId), min: Number(e.minuto) || 0, assist: e.assistId ? nomeJogador(e.assistId) : null })),
    yellow_cards: vfn("Cartão Amarelo").map(e => ({ name: nomeJogador(e.jogadorId), min: Number(e.minuto) || 0 })),
    red_cards: vfn("Cartão Vermelho").map(e => ({ name: nomeJogador(e.jogadorId), min: Number(e.minuto) || 0 })),
    tactical_notes: seccoes || null,
    first_half_notes: state.analise.primeiroTempo || null,
    second_half_notes: state.analise.segundoTempo || null,
    highlights: state.analise.destaques || null,
    areas_to_improve: state.analise.aMelhorar || null,
    individual_notes: (state.analise.notasIndividuais || []).filter(n => n.jogadorId && n.nota).map(n => ({ player: nomeJogador(n.jogadorId), note: n.nota })),
    created_by: currentUser ? currentUser.id : null,
    ...(colunaCapitao ? { captain_id: state.jogo.capitaoId ? idJogadorBD(plantel.find(p => p.id === Number(state.jogo.capitaoId)) || { id: state.jogo.capitaoId }) : null } : {})
  };
}

/** Grava o relatório do jogo associado (rascunho ou publicado). Sem jogo associado não faz nada. */
function guardarRelatorioDoJogo() {
  if (!state.preJogo.matchId) return Promise.resolve(null);
  gravacaoRelatorio = gravacaoRelatorio.then(async () => {
    try {
      let gravado;
      try {
        gravado = await dadosClube.guardar("match_reports", linhaRelatorio());
      } catch (e) {
        if (!colunasRelatorioV3 || !/does not exist|schema cache|could not find|foreign key/i.test(e.message || "")) throw e;
        if (colunaCapitao && /captain_id/i.test(e.message || "")) colunaCapitao = false; // só falta a coluna da v4 (ou o capitão não está na BD)
        else colunasRelatorioV3 = false; // BD sem as colunas da v3: grava só o match_data
        gravado = await dadosClube.guardar("match_reports", linhaRelatorio());
      }
      state.relatorioId = gravado.id;
      relatoriosAdmin = relatoriosAdmin.filter(r => String(r.id) !== String(gravado.id)).concat(gravado);
      renderEstadoRelatorio();
      return gravado;
    } catch (e) {
      console.warn("Não foi possível guardar o relatório:", mensagemErro(e));
      return null;
    }
  });
  return gravacaoRelatorio;
}

function renderEstadoRelatorio() {
  const badge = el("estadoRelatorio"), botao = el("btnPublicar");
  if (!badge) return;
  const ligado = !!state.preJogo.matchId;
  badge.hidden = !ligado;
  botao.hidden = !ligado;
  const publicado = state.estadoRelatorio === "published";
  badge.className = `estado-relatorio ${publicado ? "publicado" : "rascunho"}`;
  badge.textContent = publicado ? "Publicado" : "Rascunho";
  botao.innerHTML = publicado ? `${VFN.icone("undo-2", 18)} Voltar a rascunho` : `${VFN.icone("send", 18)} Publicar`;
  if (typeof renderResultados === "function" && el("resultadosLista")) renderResultados();
  if (el("historicoBody")) renderHistoricoAdmin();
}

async function alternarPublicacao() {
  if (!state.preJogo.matchId) return;
  const publicar = state.estadoRelatorio !== "published";
  if (publicar && !confirm("Publicar este relatório? Fica visível para o treinador e os dirigentes no Dashboard.")) return;
  state.estadoRelatorio = publicar ? "published" : "draft";
  const gravado = await guardarRelatorioDoJogo();
  if (!gravado) { state.estadoRelatorio = publicar ? "draft" : "published"; alert("Não foi possível alterar o estado do relatório."); }
  else if (publicar) await registarResultadoNoCalendario(); // resultado e marcadores ficam no calendário (públicos)
  renderEstadoRelatorio();
}

/** Abre o relatório de um jogo (ou cria um rascunho novo para ele) e vai para o Pré-Jogo. */
async function abrirRelatorioDoJogo(matchId) {
  const jogo = jogosCalendario.find(j => String(j.id) === String(matchId));
  if (!jogo) return;
  const existente = relatorioDoJogoAdmin(matchId);
  const temOutro = state.preJogo.matchId && state.preJogo.matchId !== matchId;
  if (temOutro) await guardarRelatorioDoJogo(); // o relatório aberto fica guardado antes de mudar
  else if (!state.preJogo.matchId && state.jogo.eventos.length && !confirm("O formulário tem dados que não estão associados a nenhum jogo. Substituir pelo relatório deste jogo?")) return;
  if (existente) {
    aplicarDadosEstado(existente.match_data || {});
    state.relatorioId = existente.id;
    state.estadoRelatorio = estadoDoRelatorio(existente);
    state.preJogo.matchId = matchId;
  } else {
    state = estadoInicial();
    usarJogoNoRelatorio(jogo);
    await guardarRelatorioDoJogo(); // cria o rascunho
  }
  renderTudo();
  renderEstadoRelatorio();
  document.querySelector('.tab-btn[data-tab="pre-jogo"]').click();
}

function abrirRelatorioPublicado(relatorioId) {
  const r = relatoriosAdmin.find(x => String(x.id) === String(relatorioId));
  const matchId = r && (r.match_id || ((r.match_data || {}).preJogo || {}).matchId);
  if (matchId) abrirRelatorioDoJogo(matchId);
}

function renderHistoricoAdmin() {
  const tbody = el("historicoBody");
  if (!tbody) return;
  const lista = [...relatoriosAdmin].map(r => {
    const matchId = r.match_id || ((r.match_data || {}).preJogo || {}).matchId;
    const jogo = jogosCalendario.find(j => String(j.id) === String(matchId));
    const completo = jogo ? VFNRelatorio.comJogo(r, jogo, nomeAdversarioJogo(jogo)) : r;
    return { r, d: VFNRelatorio.extrair(completo, id => nomeJogador(id)), matchId };
  })
    .sort((a, b) => String(b.d.data || "").localeCompare(String(a.d.data || "")));
  if (!lista.length) { tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Ainda não há relatórios. Abre um jogo em Resultados e clica em "Relatório".</td></tr>'; return; }
  tbody.innerHTML = lista.map(({ r, d, matchId }) => {
    const pub = estadoDoRelatorio(r) === "published";
    return `<tr>
      <td data-v="${escapeHtml(d.data || "")}">${escapeHtml(VFN.dataDDMMAAAA(d.data) || "—")}</td>
      <td>${escapeHtml(d.adversario)}</td>
      <td>${escapeHtml(VFN.nomeCurtoCompeticao(d.competicao))}</td>
      <td class="num">${d.casa ? d.golosVFN : d.golosAdv}–${d.casa ? d.golosAdv : d.golosVFN}</td>
      <td><span class="estado-relatorio ${pub ? "publicado" : "rascunho"}">${pub ? "Publicado" : "Rascunho"}</span></td>
      <td>${matchId ? `<button type="button" class="btn btn-ghost btn-sm" data-abrir-relatorio="${escapeHtml(matchId)}">${VFN.icone("file-pen", 16)} Abrir</button>` : '<span class="muted">sem jogo associado</span>'}</td>
    </tr>`;
  }).join("");
}

function initRelatorios() {
  el("btnPublicar").addEventListener("click", alternarPublicacao);
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-abrir-relatorio]");
    if (b) abrirRelatorioDoJogo(b.dataset.abrirRelatorio);
  });
  renderEstadoRelatorio();
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
  el("btnExtGuardar").addEventListener("click", guardarExterno);
  el("btnExtCancelar").addEventListener("click", limparFormExterno);
  el("equipaForma").addEventListener("click", e => {
    const b = e.target.closest("[data-acao-externo]");
    if (!b) return;
    if (b.dataset.acaoExterno === "editar") editarExterno(b.dataset.id);
    else apagarExterno(b.dataset.id);
  });
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

function dadosEquipasAdmin() {
  return { matches: jogosCalendario, teams: equipasCalendario, league_results: resultadosLiga, external_players: jogadoresExternos };
}

function renderAdversarios() {
  const termo = el("equipasPesquisa").value.trim().toLocaleLowerCase("pt-PT");
  const equipas = [...equipasCalendario]
    .filter(t => !termo || [t.name, t.full_name, t.city].some(v => String(v || "").toLocaleLowerCase("pt-PT").includes(termo)))
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
    return `<button type="button" class="team-card${VFN.coresEquipa(t).primaria ? " com-cor" : ""}" data-id="${escapeHtml(t.id)}"${VFN.estiloCorEquipa(t)}>
      ${logoEquipaHTML(t, t.name)}
      <strong>${escapeHtml(t.name)}</strong>
      ${t.city ? `<small>${escapeHtml(t.city)}</small>` : ""}
      ${VFN.eVFN(t.name) ? '<small>O nosso clube</small>' : `${VFNHub.chipsForma(dadosEquipasAdmin(), t.id, 5)}<small>Contra o VFN: ${h.V}V ${h.E}E ${h.D}D</small>${temObs ? `<span class="scouting-flag">${VFN.icone("check", 14)} Observação</span>` : ""}`}
    </button>`;
  }).join("");
  grelha.querySelectorAll(".team-card").forEach(b => b.addEventListener("click", () => abrirModalEquipa(equipaPorId(b.dataset.id))));
}

function abrirModalEquipa(equipa) {
  equipaEmEdicaoAdmin = equipa;
  const obs = equipa ? observacaoDaEquipa(equipa.id) : null;
  el("modalEquipaTitulo").textContent = equipa ? equipa.name : "Adicionar Equipa";
  el("equipaNome").value = equipa ? equipa.name : "";
  el("equipaNomeCompleto").value = equipa ? equipa.full_name || "" : "";
  el("equipaEstadio").value = equipa ? equipa.stadium || "" : "";
  const cores = VFN.coresEquipa(equipa && !VFN.eVFN(equipa.name) ? equipa : null);
  el("equipaSemCores").checked = !cores.primaria;
  el("equipaCorPrincipal").value = cores.primaria && cores.primaria.length === 7 ? cores.primaria : "#cbd5e1";
  el("equipaCorSecundaria").value = cores.secundaria && cores.secundaria.length === 7 ? cores.secundaria : "#ffffff";
  el("equipaIdZerozero").value = equipa ? equipa.id : "";
  el("equipaIdZerozero").readOnly = !!equipa; // chave da tabela teams
  el("equipaCidade").value = equipa ? equipa.city || "" : "";
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
  // forma atual: último jogo (contra o VFN ou outra equipa), últimos 5 e confrontos com o VFN
  // ficha completa (forma, confrontos, jogos com o VFN e jogadores conhecidos), só de leitura
  renderFichaEquipaAdmin();
  limparFormExterno();
  abrirModalAdmin("modalEquipa");
}

function renderFichaEquipaAdmin() {
  const equipa = equipaEmEdicaoAdmin;
  const comFicha = !!equipa && !VFN.eVFN(equipa.name);
  el("equipaForma").innerHTML = comFicha ? `<div class="perfil-equipa">${VFNHub.perfilEquipaHTML(dadosEquipasAdmin(), equipa.id, { editavel: true })}</div>` : "";
  el("equipaExternosForm").hidden = !comFicha;
}

/* ---- Jogadores conhecidos da equipa (external_players: nome, número e foto) ---- */

let externoEmEdicao = null;

function limparFormExterno() {
  externoEmEdicao = null;
  ["extId", "extNome", "extNumero", "extFoto"].forEach(id => { el(id).value = ""; });
  el("extId").readOnly = false;
  el("extErro").textContent = "";
  el("extFormTitulo").textContent = "Adicionar jogador conhecido";
  el("btnExtGuardar").textContent = "+ Adicionar jogador";
  el("btnExtCancelar").hidden = true;
}

function editarExterno(id) {
  const p = jogadoresExternos.find(x => String(x.id) === String(id));
  if (!p) return;
  externoEmEdicao = p;
  el("extId").value = p.id; el("extId").readOnly = true;
  el("extNome").value = p.name || "";
  el("extNumero").value = p.number ?? "";
  el("extFoto").value = p.photo_url || "";
  el("extFormTitulo").textContent = `Editar ${p.name}`;
  el("btnExtGuardar").textContent = "Guardar jogador";
  el("btnExtCancelar").hidden = false;
  el("extNome").focus();
}

async function guardarExterno() {
  const equipa = equipaEmEdicaoAdmin;
  const id = el("extId").value.trim(), nome = el("extNome").value.trim(), numero = el("extNumero").value.trim();
  const existente = jogadoresExternos.find(p => String(p.id) === id);
  const erro = !/^\d+$/.test(id) ? "Indica o ID Zerozero (só algarismos)." : !nome ? "Indica o nome." : !externoEmEdicao && existente && String(existente.team_id) === String(equipa.id) ? "Este jogador já está registado nesta equipa." : "";
  el("extErro").textContent = erro;
  if (erro) return;
  const linha = { ...(existente || {}), id, name: nome, team_id: equipa.id, team_name: equipa.name };
  // colunas do SQL de 03/10: só vão no pedido quando preenchidas (ou já existentes)
  const extra = { number: numero ? Number(numero) : null, photo_url: el("extFoto").value.trim() || null };
  Object.entries(extra).forEach(([k, v]) => { if (v !== null || (existente && k in existente)) linha[k] = v; });
  try {
    const gravado = await dadosClube.guardar("external_players", linha);
    jogadoresExternos = jogadoresExternos.filter(p => String(p.id) !== id).concat(gravado);
    limparFormExterno();
    renderFichaEquipaAdmin();
  } catch (e) {
    el("extErro").textContent = /number|photo_url/i.test(e.message || "") ? "Falta a foto/número em external_players: corre a secção de 03/10/2026 do schema.sql." : mensagemErro(e);
  }
}

async function apagarExterno(id) {
  const p = jogadoresExternos.find(x => String(x.id) === String(id));
  if (!p || !confirm(`Eliminar ${p.name} dos jogadores conhecidos? Os golos já registados nas Jornadas mantêm o nome.`)) return;
  try {
    await dadosClube.remover("external_players", p.id);
    jogadoresExternos = jogadoresExternos.filter(x => x !== p);
    if (externoEmEdicao === p) limparFormExterno();
    renderFichaEquipaAdmin();
  } catch (e) {
    el("extErro").textContent = mensagemErro(e);
  }
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
  const idZerozero = el("equipaIdZerozero").value.trim();
  if (!equipaEmEdicaoAdmin) {
    const erroId = !idZerozero ? "Indica o ID Zerozero da equipa (obrigatório)." : !/^\d+$/.test(idZerozero) ? "O ID Zerozero só tem algarismos." : equipaPorId(idZerozero) ? "Já existe uma equipa com este ID Zerozero." : "";
    if (erroId) { el("equipaErro").textContent = erroId; el("equipaIdZerozero").focus(); return; }
  }
  if (!nome) { el("equipaErro").textContent = "Indica o nome da equipa."; return; }
  const botao = el("btnEquipaGuardar");
  botao.disabled = true;
  try {
    const id = equipaEmEdicaoAdmin ? equipaEmEdicaoAdmin.id : idZerozero;
    // sem logo indicado, usa assets/opponents/{id}.png
    let logo = el("equipaLogo").value.trim() || (equipaEmEdicaoAdmin ? equipaEmEdicaoAdmin.logo_url : null) || `${VFN.BASE_SITE}assets/opponents/${id}.png`;
    const carregado = await carregarLogoEquipa(el("equipaLogoUpload").files[0], id);
    if (carregado) logo = carregado;
    const linha = { ...(equipaEmEdicaoAdmin || {}), id, name: nome, city: el("equipaCidade").value.trim() || null, logo_url: logo };
    // colunas novas (SQL de 03/10): só vão no pedido quando preenchidas ou já existentes
    const semCores = el("equipaSemCores").checked;
    const extra = {
      full_name: el("equipaNomeCompleto").value.trim() || null,
      stadium: el("equipaEstadio").value.trim() || null,
      color_primary: semCores ? null : el("equipaCorPrincipal").value,
      color_secondary: semCores ? null : el("equipaCorSecundaria").value
    };
    Object.entries(extra).forEach(([k, v]) => { if (v !== null || (equipaEmEdicaoAdmin && k in equipaEmEdicaoAdmin)) linha[k] = v; });
    let equipa;
    try {
      equipa = await dadosClube.guardar("teams", linha);
    } catch (e) {
      if (!/full_name|stadium|color_/i.test(e.message || "")) throw e;
      Object.keys(extra).forEach(k => delete linha[k]);
      equipa = await dadosClube.guardar("teams", linha);
      alert("Equipa guardada sem nome completo, cores e estádio: corre a secção de 03/10/2026 do schema.sql.");
    }
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
    await Promise.all([carregarTabelaAdmin("fines", "multasErro"), carregarTiposMulta()]);
    renderMultas();
  } else if (tab === "convocatoria") {
    await carregarTabelaAdmin("squads", "convErro");
    renderConvocatoria();
  } else if (tab === "presencas") {
    await Promise.all([carregarTabelaAdmin("attendance", "presencasErro"), carregarTabelaAdmin("sessions", "presencasErro"), carregarTabelaAdmin("fines", "presencasErro"), carregarTiposMulta()]);
    renderPresencas();
  } else if (tab === "calendario") {
    renderCalendarioAdmin();
    await Promise.all([carregarTabelaAdmin("sessions", "calendarioErro"), carregarTabelaAdmin("attendance", "calendarioErro")]);
    renderCalendarioMensalAdmin();
  } else if (tab === "resultados") {
    renderResultados();
  } else if (tab === "jornadas") {
    renderJornadasAdmin();
  } else if (tab === "historico") {
    renderHistoricoAdmin();
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
  initConvocatoria();
  initPresencas();
  initCalendarioAdmin();
  initResultados();
  initJornadas();
  initRelatorios();
  initMarcadoresForm();
  carregarJogadoresExternos().then(renderJornadasAdmin);
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

  // detalhe do jogo ao clicar no resultado (Resultados e Jornadas)
  VFNHub.ligarDetalheJogo(() => ({ matches: jogosCalendario, teams: equipasCalendario, league_results: resultadosLiga, match_reports: relatoriosAdmin }), {
    nomeJogador: id => nomeJogador(id),
    verRelatorio: id => { if (typeof abrirRelatorioPublicado === "function") abrirRelatorioPublicado(id); }
  });

  // perfis clicáveis: logo → ficha da equipa; avatar → ficha do jogador
  document.addEventListener("click", e => {
    if (e.target.closest(".modal-overlay, select, input, .team-card")) return;
    const logo = e.target.closest("[data-equipa]");
    if (logo) { const t = equipaPorId(logo.dataset.equipa); if (t) abrirModalEquipa(t); return; }
    const avatar = e.target.closest("[data-jogador]");
    if (avatar && !e.target.closest("#plantelBody")) { const j = jogadorPorIdBD(avatar.dataset.jogador); if (j) abrirModalExistente(j); }
  });
}
