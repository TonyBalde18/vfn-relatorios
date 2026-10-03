"use strict";

/* =========================================================
   ÁREA DO JOGADOR (equipa.html) — login Supabase, só leitura.
   A conta liga-se ao jogador por players.auth_user_id (ver schema.sql,
   secção 03/10/2026): no primeiro login, vfn_ligar_minha_conta() liga a
   conta cujo email está na ficha do jogador. O plantel vem da view
   players_equipa (sem atributos, notas nem emails); e_eu marca o próprio.
   A equipa técnica (profiles) também pode entrar, sem as secções pessoais.
   ========================================================= */

const H = VFNHub;
const esc = VFN.escapeHtml;
const $ = id => document.getElementById(id);

let cliente = null;
let utilizador = null;
let perfil = null; // profiles (equipa técnica) ou null
let dados = { teams: [], matches: [], league_results: [], external_players: [], players: [], sessions: [], attendance: [], fines: [], match_reports: [], staff: [] };
let jogadores = [];
let eu = null; // o jogador com sessão iniciada (null para a equipa técnica)

// link do convite / recuperação: o Supabase põe o tipo no hash do URL antes de criar a sessão
const tipoLink = (/type=(invite|recovery)/.exec(location.hash) || [])[1] || "";

/* ---------- Dados ---------- */

const TABELAS = { teams: "teams", matches: "matches", league_results: "league_results", external_players: "external_players", players: "players_equipa", sessions: "sessions", attendance: "attendance", fines: "fines", match_reports: "match_reports", staff: "staff" };
const OPCIONAIS = ["external_players", "staff"];

async function carregarDados() {
  const chaves = Object.keys(TABELAS);
  const respostas = await Promise.all(chaves.map(k => cliente.from(TABELAS[k]).select("*")));
  const falhas = [];
  respostas.forEach((r, i) => {
    if (r.error && !OPCIONAIS.includes(chaves[i])) falhas.push(chaves[i]);
    dados[chaves[i]] = r.error ? [] : r.data || [];
  });
  dados.matches = VFN.normalizarLinhas(dados.matches);
  dados.league_results = VFN.normalizarLinhas(dados.league_results);
  // relatórios: só os publicados (a RLS já filtra; o admin vê todos)
  dados.match_reports = dados.match_reports.filter(r => VFN.estadoRelatorio(r) === "published");
  jogadores = dados.players.map(p => ({ ...H.jogadorDeLinha(p), eEu: !!p.e_eu }));
  eu = jogadores.find(j => j.eEu) || null;
  const aviso = $("avisoDados");
  aviso.hidden = !falhas.length;
  if (falhas.length) aviso.textContent = falhas.includes("players")
    ? "Ainda não é possível ler o plantel. O administrador tem de correr a secção de 03/10/2026 do schema.sql."
    : `Não foi possível ler: ${falhas.join(", ")}.`;
}

/** Jogador (ou elemento da equipa técnica, nas multas do treinador). */
function pessoa(id) {
  const j = jogadores.find(x => String(x.id) === String(id));
  if (j) return j;
  const t = (dados.staff.length ? dados.staff : VFN.STAFF_PADRAO).find(x => String(x.id) === String(id));
  return t ? VFN.pessoaStaff(t) : null;
}

/* ---------- Navegação ---------- */

function mostrarVista(vista) {
  document.querySelectorAll(".view").forEach(v => v.classList.toggle("active", v.id === `view-${vista}`));
  document.querySelectorAll(".public-nav button").forEach(b => {
    const ativo = b.dataset.view === vista;
    b.classList.toggle("active", ativo);
    if (ativo) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
  });
  window.scrollTo({ top: 0 });
  VFN.anim.tab($(`view-${vista}`));
  VFN.refreshAOS();
}

/* ---------- Início ---------- */

function presencaDe(id) {
  const t = { P: 0, A: 0, F: 0, J: 0 };
  dados.attendance.filter(a => String(a.player_id) === String(id) && t[a.status] !== undefined).forEach(a => { t[a.status]++; });
  const total = t.P + t.A + t.F + t.J;
  return { ...t, total, pct: total ? Math.round((t.P + t.A) / total * 100) : null };
}

function renderInicio() {
  const euro = v => VFN.formatoEuro.format(v);
  if (eu) {
    const minhas = dados.fines.filter(f => String(f.player_id) === String(eu.id));
    const pendente = minhas.filter(f => !f.paid).reduce((s, f) => s + (Number(f.amount) || 0), 0);
    const p = presencaDe(eu.id);
    $("eqBoasVindas").innerHTML = `<div class="eq-ola">${VFN.avatarJogador(eu, "avatar-sm")}<div><span class="muted">Olá,</span><h2>${esc(eu.nome)}</h2>
        <p>${esc(eu.posicao)}${eu.numero !== "" ? " · Nº " + esc(eu.numero) : ""} ${eu.disponibilidade ? VFN.badgeDisponibilidade(eu.disponibilidade) : ""}</p></div></div>
      <div class="summary-tiles eq-kpis">
        <div class="summary-tile"><span>Presença</span><strong>${p.pct === null ? "—" : p.pct + "%"}</strong></div>
        <div class="summary-tile tile-pendente"><span>Multas por pagar</span><strong>${euro(pendente)}</strong></div>
        <div class="summary-tile"><span>Golos</span><strong>${eu.golos}</strong></div>
        <div class="summary-tile"><span>Minutos</span><strong>${eu.minutos}'</strong></div>
      </div>`;
  } else {
    $("eqBoasVindas").innerHTML = `<div class="eq-ola"><div><span class="muted">Olá,</span><h2>${esc((perfil && perfil.full_name) || utilizador.email)}</h2><p class="muted">Entraste como equipa técnica: vês os dados do plantel, sem as secções pessoais.</p></div></div>`;
  }
  $("eqProximoJogo").innerHTML = H.proximoJogoHTML(dados);
  $("eqForma").innerHTML = H.formaHTML(dados, 5);
  $("eqResultados").innerHTML = H.resultadosHTML(dados, 5);
}

/* ---------- Calendário ---------- */

let calendario = null;

function renderCalendario() {
  if (calendario) { calendario.render(); return; }
  calendario = VFNComp.criarCalendarioMensal($("eqCalMes"), {
    obterDados: () => dados,
    perfil: "staff", // detalhe com eventos, escalação e presenças (só leitura)
    nomeRelatorio: id => (jogadorDoRelatorio(id) || {}).nome,
    nomePresenca: id => (pessoa(id) || {}).nome
  });
}

/* ---------- Multas ---------- */

function linhasMultasHTML(lista, comJogador) {
  if (!lista.length) return H.vazio("Sem multas.");
  return `<div class="table-wrap"><table class="fines-table eq-multas" data-ordenar="${comJogador ? "eq-multas-todas" : "eq-multas-minhas"}">
    <thead><tr>${comJogador ? '<th scope="col" data-tipo="texto">Jogador</th>' : ""}<th scope="col" data-tipo="texto">Infracção</th><th scope="col" class="num" data-tipo="numero">Valor</th><th scope="col" data-tipo="texto">Estado</th><th scope="col" data-tipo="data">Data</th></tr></thead>
    <tbody>${lista.map(f => {
      const p = pessoa(f.player_id);
      return `<tr>${comJogador ? `<td data-v="${esc((p || {}).nome || "")}">${p ? `<span class="player-cell">${VFN.avatarJogador(p, "avatar-xs")}<span>${esc(p.nome)}</span></span>` : '<span class="muted">Jogador removido</span>'}</td>` : ""}
        <td class="fine-infraction">${esc(VFN.rotuloMulta(f.infraction_type))}${f.description ? `<span class="fine-desc">${esc(f.description)}</span>` : ""}</td>
        <td class="num" data-v="${Number(f.amount) || 0}">${VFN.valorMultaHTML(f)}</td>
        <td><span class="status-badge status-jogado ${f.paid ? "result-V" : "result-D"}">${f.paid ? "Pago" : "Pendente"}</span></td>
        <td data-v="${esc(f.match_date || "")}">${esc(VFN.dataDDMMAAAA(f.match_date) || "—")}</td></tr>`;
    }).join("")}</tbody></table></div>`;
}

const porData = (a, b) => String(b.match_date || "").localeCompare(String(a.match_date || ""));

function renderMultas() {
  const euro = v => VFN.formatoEuro.format(v);
  if (eu) {
    const minhas = dados.fines.filter(f => String(f.player_id) === String(eu.id)).sort(porData);
    const soma = l => l.reduce((s, f) => s + (Number(f.amount) || 0), 0);
    $("eqMinhasMultasResumo").innerHTML = `<div class="summary-tile tile-pendente"><span>Por pagar</span><strong>${euro(soma(minhas.filter(f => !f.paid)))}</strong></div>
      <div class="summary-tile tile-pago"><span>Pago</span><strong>${euro(soma(minhas.filter(f => f.paid)))}</strong></div>
      <div class="summary-tile"><span>Nº de multas</span><strong>${minhas.length}</strong></div>`;
    $("eqMinhasMultas").innerHTML = linhasMultasHTML(minhas, false);
  } else {
    $("eqMinhasMultasResumo").innerHTML = "";
    $("eqMinhasMultas").innerHTML = H.vazio("Só para jogadores.");
  }
  $("eqDividas").innerHTML = VFNComp.renderDebtReport(dados.fines, { pessoa });
  const sel = $("eqMultasJogador");
  const atual = sel.value;
  sel.innerHTML = '<option value="">Todos os jogadores</option>' + [...jogadores].sort((a, b) => a.nome.localeCompare(b.nome, "pt")).map(j => `<option value="${esc(j.id)}">${esc(j.nome)}</option>`).join("");
  sel.value = atual;
  const estado = $("eqMultasEstado").value;
  const todas = dados.fines
    .filter(f => !sel.value || String(f.player_id) === sel.value)
    .filter(f => !estado || (estado === "pago" ? f.paid : !f.paid))
    .sort(porData);
  $("eqMultasTodas").innerHTML = linhasMultasHTML(todas, true);
}

/* ---------- Presenças ---------- */

function sessoesDoMes(mes) {
  const mapa = new Map();
  const juntar = (data, tipo) => { if (data && String(data).startsWith(mes)) mapa.set(`${data}|${tipo}`, { data, tipo }); };
  dados.sessions.forEach(s => juntar(s.session_date, s.session_type));
  dados.attendance.forEach(a => juntar(a.session_date, a.session_type));
  VFN.jogosDoVFN(dados.matches).filter(j => VFN.estadoJogo(j) !== "cancelado").forEach(j => juntar(VFN.dataIso(j.date), "jogo"));
  return [...mapa.values()].sort((a, b) => a.data.localeCompare(b.data) || (a.tipo === "treino" ? -1 : 1));
}

function estadoPresenca(id, s) {
  const r = dados.attendance.find(a => String(a.player_id) === String(id) && a.session_date === s.data && a.session_type === s.tipo);
  return r && r.status || "";
}

function renderPresencas() {
  if (eu) {
    const p = presencaDe(eu.id);
    $("eqMinhaPresencaInfo").textContent = p.pct === null ? "" : `· ${p.pct}% na época`;
    $("eqMeuHeatmap").innerHTML = VFN.heatmapPresencasHTML(dados.attendance.filter(a => String(a.player_id) === String(eu.id)).map(a => ({ data: a.session_date, status: a.status })), { individual: true });
  } else {
    $("eqMeuHeatmap").innerHTML = VFN.heatmapPresencasHTML(dados.attendance.map(a => ({ data: a.session_date, status: a.status })));
  }
  const selMes = $("eqPresencasMes");
  const meses = VFN.mesesDaEpoca(new Date());
  const mes = selMes.value || (meses.some(m => m.valor === VFN.mesAtual()) ? VFN.mesAtual() : meses[0].valor);
  selMes.innerHTML = meses.map(m => `<option value="${m.valor}" ${m.valor === mes ? "selected" : ""}>${m.rotulo}</option>`).join("");
  const sessoes = sessoesDoMes(mes);
  if (!sessoes.length) { $("eqPresencasLista").innerHTML = H.vazio("Sem sessões neste mês."); return; }
  const linhas = [...jogadores].sort((a, b) => a.nome.localeCompare(b.nome, "pt")).map(j => {
    const totais = { P: 0, A: 0, F: 0, J: 0 };
    sessoes.forEach(s => { const e = estadoPresenca(j.id, s); if (totais[e] !== undefined) totais[e]++; });
    return { jogador: j, id: j.id, totais };
  });
  // a lista aparece sempre aqui (no admin/dashboard só no telemóvel em vertical)
  $("eqPresencasLista").innerHTML = VFNComp.listaPresencasHTML(linhas).replace('class="att-lista"', 'class="att-lista sempre"');
}

function abrirPresencasJogador(id) {
  const j = pessoa(id);
  if (!j) return;
  const sessoes = sessoesDoMes($("eqPresencasMes").value);
  const p = presencaDe(id);
  VFNComp.abrirDrawer({
    titulo: "Presenças · " + $("eqPresencasMes").selectedOptions[0].textContent,
    corpo: VFNComp.renderAttendanceDrawer({ jogador: j, epoca: { P: p.P, A: p.A, F: p.F, J: p.J }, editavel: false, sessoes: sessoes.map(s => ({ data: s.data, tipo: s.tipo, estado: estadoPresenca(id, s) })) })
  });
}

/* ---------- Estatísticas ---------- */

const COLUNAS_STATS = [["nome", "Jogador", "texto"], ["jogos", "J", "numero"], ["minutos", "Min", "numero"], ["golos", "Golos", "numero"], ["assistencias", "Ass", "numero"], ["cartoesA", "Am.", "numero"], ["cartoesV", "Verm.", "numero"]];

function renderEstatisticas() {
  $("eqMinhaFicha").innerHTML = eu ? H.fichaVisualHTML(eu, jogadores) : H.vazio("Só para jogadores.");
  const lista = [...jogadores].sort((a, b) => b.golos - a.golos || b.minutos - a.minutos || a.nome.localeCompare(b.nome, "pt"));
  $("eqStatsTabela").innerHTML = `<thead><tr>${COLUNAS_STATS.map(([c, t, tipo]) => `<th scope="col" class="${c === "nome" ? "team-col" : "num"}" data-tipo="${tipo}">${t}</th>`).join("")}</tr></thead>
    <tbody>${lista.map(j => `<tr class="${j.eEu ? "is-vfn-row" : ""}"><td class="team-col" data-v="${esc(j.nome)}"><span class="player-cell">${VFN.avatarJogador(j, "avatar-xs")}<span>${esc(j.nome)} <small class="muted">${esc(j.posicao)}</small></span></span></td>${COLUNAS_STATS.slice(1).map(([c]) => `<td class="num">${j[c]}</td>`).join("")}</tr>`).join("")}</tbody>`;
}

/* ---------- Ficha do jogador (modal) ---------- */

function abrirJogador(id) {
  const j = jogadores.find(x => String(x.id) === String(id));
  if (!j) return;
  $("ejAvatar").innerHTML = VFN.avatarJogador(j, "avatar-modal");
  $("ejNome").textContent = j.nomeCompleto;
  $("ejMeta").innerHTML = esc([j.posicao, j.numero !== "" ? `Nº ${j.numero}` : ""].filter(Boolean).join(" · ")) + (j.disponibilidade ? " " + VFN.badgeDisponibilidade(j.disponibilidade) : "");
  $("ejStats").innerHTML = [["Jogos", j.jogos], ["Golos", j.golos], ["Assist.", j.assistencias], ["Minutos", j.minutos]].map(([l, v]) => `<div class="player-modal-stat"><strong>${v}</strong><span>${l}</span></div>`).join("");
  const p = presencaDe(j.id);
  $("ejCorpo").innerHTML = `${H.fichaVisualHTML(j, jogadores)}
    <h4 class="perfil-subtitulo">Presenças na época ${p.pct === null ? "" : `<small class="muted">· ${p.pct}%</small>`}</h4>
    ${VFN.heatmapPresencasHTML(dados.attendance.filter(a => String(a.player_id) === String(j.id)).map(a => ({ data: a.session_date, status: a.status })), { individual: true })}`;
  $("modalJogador").hidden = false;
  $("btnFecharJogador").focus();
}

/* ---------- Relatórios publicados ---------- */

/** Os relatórios guardam o id local do plantel do admin ("1014939" ou "<uid>-3"). */
function jogadorDoRelatorio(idLocal) {
  const alvo = String(idLocal);
  return jogadores.find(j => String(j.id) === alvo || String(j.id).endsWith("-" + alvo)) || null;
}

function relatoriosPublicados() {
  const porJogo = new Map();
  dados.match_reports.forEach(r => {
    const pre = (r.match_data || {}).preJogo || {};
    const chave = r.match_id || pre.matchId || r.id;
    const atual = porJogo.get(chave);
    if (!atual || String(r.updated_at || r.created_at || "") > String(atual.updated_at || atual.created_at || "")) porJogo.set(chave, r);
  });
  return [...porJogo.values()].map(r => {
    const matchId = r.match_id || ((r.match_data || {}).preJogo || {}).matchId;
    const jogo = dados.matches.find(m => String(m.id) === String(matchId));
    const completo = jogo ? VFNRelatorio.comJogo(r, jogo, H.nomeAdversario(dados, jogo)) : r;
    return { r: completo, d: VFNRelatorio.extrair(completo, id => (jogadorDoRelatorio(id) || {}).nome) };
  }).sort((a, b) => String(b.d.data || "").localeCompare(String(a.d.data || "")));
}

let relatorioAberto = "";

function renderRelatorios() {
  const lista = relatoriosPublicados();
  $("eqRelatoriosInfo").textContent = lista.length ? `${lista.length} relatório${lista.length === 1 ? "" : "s"}` : "";
  $("eqRelatoriosLista").innerHTML = lista.length ? lista.map(({ r, d }) => {
    const v = d.golosVFN > d.golosAdv ? "V" : d.golosVFN < d.golosAdv ? "D" : "E";
    return `<button type="button" class="historico-item${relatorioAberto === String(r.id) ? " active" : ""}" data-relatorio="${esc(r.id)}">
      <span class="form-chip form-${v}">${v}</span>
      <span class="historico-texto"><strong>${d.casa ? "VFN" : esc(d.adversario)} ${d.casa ? d.golosVFN : d.golosAdv}–${d.casa ? d.golosAdv : d.golosVFN} ${d.casa ? esc(d.adversario) : "VFN"}</strong>
      <small>${esc([VFN.dataDDMMAAAA(d.data), VFN.nomeCurtoCompeticao(d.competicao)].filter(Boolean).join(" · "))}</small></span>
    </button>`;
  }).join("") : H.vazio("Ainda não há relatórios publicados.");
}

function abrirRelatorio(id) {
  const item = relatoriosPublicados().find(x => String(x.r.id) === String(id));
  if (!item) return;
  relatorioAberto = String(id);
  document.querySelectorAll(".modal-overlay").forEach(m => { m.hidden = true; });
  mostrarVista("relatorios");
  renderRelatorios();
  $("eqRelatorioDetalhe").innerHTML = VFNRelatorio.html(item.r, {
    nomeJogador: x => (jogadorDoRelatorio(x) || {}).nome,
    logoVFN: `<img class="team-logo rel-logo" src="${esc(H.logoVFN(dados))}" alt="Logótipo VFN">`,
    logoEquipa: (tid, nome) => H.logoEquipa(H.equipa(dados, tid) || { id: tid, name: nome }, nome, "rel-logo")
  });
  if (window.innerWidth < 900) $("eqRelatorioDetalhe").scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ---------- Render geral ---------- */

function renderCabecalho() {
  $("eqAvatar").innerHTML = eu ? VFN.avatarJogador(eu, "avatar-sm") : VFN.icone("user", 20);
  $("eqAvatar").hidden = !eu;
  $("eqSubtitulo").textContent = eu ? `${eu.nome}${eu.numero !== "" ? " · #" + eu.numero : ""}` : { admin: "Administrador", treinador: "Treinador", dirigente: "Dirigente" }[perfil && perfil.role] || "Equipa técnica";
}

function renderTudo() {
  renderCabecalho();
  renderInicio();
  renderCalendario();
  renderMultas();
  renderPresencas();
  renderEstatisticas();
  $("eqDisponibilidade").innerHTML = H.disponibilidadeHTML(dados, jogadores);
  renderRelatorios();
  VFN.refreshAOS();
}

/* ---------- Autenticação ---------- */

function mostrarEcra(id) {
  ["loginScreen", "esperaScreen", "eqShell"].forEach(x => { $(x).hidden = x !== id; });
}

function mostrarLogin(mensagem, definirPassword) {
  mostrarEcra("loginScreen");
  $("loginForm").hidden = !!definirPassword;
  $("passwordForm").hidden = !definirPassword;
  $("loginMessage").textContent = mensagem || "";
}

async function entrarComSessao(sessao) {
  utilizador = sessao.user;
  // primeiro login: liga a conta ao jogador com o mesmo email (se o admin já o indicou)
  try { await cliente.rpc("vfn_ligar_minha_conta"); } catch (e) { /* função ainda não criada */ }
  perfil = await VFN.obterPapel(cliente, utilizador);
  if (perfil && perfil.role === "sem-tabela") perfil = null;
  await carregarDados();
  if (!eu && !perfil) {
    $("esperaEmail").textContent = utilizador.email || "";
    mostrarEcra("esperaScreen");
    return;
  }
  mostrarEcra("eqShell");
  renderTudo();
}

async function sair() {
  await cliente.auth.signOut();
  eu = null; perfil = null; utilizador = null;
  mostrarLogin("Sessão terminada.");
}

/* ---------- Arranque ---------- */

async function iniciar() {
  VFN.initAOS();
  document.querySelectorAll(".public-nav button").forEach(b => b.addEventListener("click", () => mostrarVista(b.dataset.view)));
  $("eqAvatar").addEventListener("click", () => { if (eu) abrirJogador(eu.id); });
  $("eqMultasJogador").addEventListener("change", renderMultas);
  $("eqMultasEstado").addEventListener("change", renderMultas);
  $("eqPresencasMes").addEventListener("change", renderPresencas);
  $("eqPresencasLista").addEventListener("click", e => { const b = e.target.closest("[data-presencas-jogador]"); if (b && !e.target.closest("[data-jogador]")) abrirPresencasJogador(b.dataset.presencasJogador); });
  $("eqRelatoriosLista").addEventListener("click", e => { const b = e.target.closest("[data-relatorio]"); if (b) abrirRelatorio(b.dataset.relatorio); });
  H.ligarDetalheJogo(() => dados, { nomeJogador: id => (jogadorDoRelatorio(id) || {}).nome, verRelatorio: id => abrirRelatorio(id) });
  // qualquer foto de jogador abre a ficha
  document.addEventListener("click", e => {
    const alvo = e.target.closest("[data-jogador]");
    if (!alvo || e.target.closest(".modal-overlay")) return;
    if (jogadores.some(j => String(j.id) === alvo.dataset.jogador)) abrirJogador(alvo.dataset.jogador);
  });
  $("btnFecharJogador").addEventListener("click", () => { $("modalJogador").hidden = true; });
  $("modalJogador").addEventListener("click", e => { if (e.target.id === "modalJogador") $("modalJogador").hidden = true; });
  document.addEventListener("keydown", e => { if (e.key === "Escape") $("modalJogador").hidden = true; });
  setInterval(H.atualizarContagens, 30000);

  cliente = VFN.criarClienteSupabase();
  if (!cliente) { mostrarLogin("Supabase não configurado (config.js)."); return; }

  $("loginForm").addEventListener("submit", async e => {
    e.preventDefault();
    $("loginMessage").textContent = "";
    const { data, error } = await cliente.auth.signInWithPassword({ email: $("loginEmail").value, password: $("loginPassword").value });
    if (error) { $("loginMessage").textContent = error.message === "Invalid login credentials" ? "Email ou password incorretos." : error.message; return; }
    await entrarComSessao(data.session);
  });
  $("btnEsqueci").addEventListener("click", async () => {
    const email = $("loginEmail").value.trim();
    if (!email) { $("loginMessage").textContent = "Escreve o teu email primeiro."; $("loginEmail").focus(); return; }
    const { error } = await cliente.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    $("loginMessage").textContent = error ? error.message : "Enviámos-te um email para definires uma nova password.";
  });
  $("passwordForm").addEventListener("submit", async e => {
    e.preventDefault();
    const p1 = $("novaPassword").value, p2 = $("novaPassword2").value;
    if (p1 !== p2) { $("loginMessage").textContent = "As passwords não coincidem."; return; }
    const { error } = await cliente.auth.updateUser({ password: p1 });
    if (error) { $("loginMessage").textContent = error.message; return; }
    history.replaceState(null, "", location.pathname);
    const { data } = await cliente.auth.getSession();
    if (data.session) await entrarComSessao(data.session);
  });
  $("btnLogout").addEventListener("click", sair);
  $("btnSairEspera").addEventListener("click", sair);
  $("btnTentarDeNovo").addEventListener("click", async () => { const { data } = await cliente.auth.getSession(); if (data.session) await entrarComSessao(data.session); else mostrarLogin(); });
  cliente.auth.onAuthStateChange(evento => { if (evento === "PASSWORD_RECOVERY") mostrarLogin("", true); });

  const { data } = await cliente.auth.getSession();
  if (data.session && tipoLink) mostrarLogin("", true); // convite ou recuperação: definir a password primeiro
  else if (data.session) await entrarComSessao(data.session);
  else mostrarLogin();
}

document.addEventListener("DOMContentLoaded", iniciar);
