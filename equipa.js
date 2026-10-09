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
let dados = { teams: [], matches: [], league_results: [], external_players: [], players: [], sessions: [], fines: [], fine_types: [], match_reports: [], staff: [], squads: [], h2h: [] };
let jogadores = [];
let eu = null; // o jogador com sessão iniciada (null para a equipa técnica)
let minhasPresencas = null; // registos de presença do jogador com sessão (null = sem acesso)

// link do convite / recuperação: o Supabase põe o tipo no hash do URL antes de criar a sessão
const tipoLink = (/type=(invite|recovery)/.exec(location.hash) || [])[1] || "";

/* ---------- Dados ---------- */

/*
 * v10: a área do jogador já não lê presenças (attendance) e as multas (fines) são pedidas à parte:
 * um jogador só pede as suas (player_id = o seu id); a equipa técnica pede todas.
 * Para que a base de dados também só devolva as próprias multas a um jogador, correr no Supabase:
 *
 *   drop policy if exists "Players read fines" on public.fines;
 *   create policy "Players read own fines" on public.fines for select to authenticated
 *     using (player_id in (select id from public.players where auth_user_id = auth.uid()));
 *   drop policy if exists "Players read attendance" on public.attendance;
 *
 * ("fines staff read" continua a dar todas as multas à equipa técnica; os valores de cada infração vêm de
 * fine_types, que os jogadores já podem ler.)
 */
const TABELAS = { teams: "teams", matches: "matches", league_results: "league_results", external_players: "external_players", players: "players_equipa", sessions: "sessions", fine_types: "fine_types", match_reports: "match_reports", staff: "staff", squads: "squads", h2h: "h2h" };
const OPCIONAIS = ["external_players", "staff", "squads", "fine_types", "h2h"]; // h2h: sql/h2h.sql (leitura pública)

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
  VFN.definirTiposMulta(dados.fine_types);
  // multas: o jogador só pede as suas; a equipa técnica todas
  let pedidoMultas = cliente.from("fines").select("*");
  if (eu) pedidoMultas = pedidoMultas.eq("player_id", eu.id);
  const multas = await pedidoMultas;
  if (multas.error) falhas.push("fines");
  dados.fines = multas.error ? [] : (multas.data || []).filter(f => !eu || String(f.player_id) === String(eu.id));
  // v15: presenças do próprio jogador (só as suas). Se a RLS não deixar, a ficha mostra "—". Para os jogadores
  // lerem só as próprias presenças, correr no Supabase:
  //   drop policy if exists "Players read own attendance" on public.attendance;
  //   create policy "Players read own attendance" on public.attendance for select to authenticated
  //     using (player_id in (select id from public.players where auth_user_id = auth.uid()));
  minhasPresencas = null;
  if (eu) {
    const pres = await cliente.from("attendance").select("status").eq("player_id", eu.id);
    minhasPresencas = pres.error ? null : (pres.data || []).filter(r => r.status);
  }
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
  VFN.anim.seccao($(`view-${vista}`)); // fade-in da secção
  VFN.refreshAOS();
}

/* ---------- Início ---------- */

/** Estatísticas de GR (H.calcularStatsGR) de um jogador do plantel; null se não for GR. */
function statsGR(j) {
  if (VFN.categoriaPosicao(j.posicao) !== "GR") return null;
  return H.calcularStatsGR(idLocal => { const x = jogadorDoRelatorio(idLocal); return !!x && String(x.id) === String(j.id); }, dados.match_reports, { matches: dados.matches });
}

/** KPIs pessoais: golos e assistências; um GR vê jogos a zero, minutos sem sofrer e média de sofridos. */
function kpisPessoais(j) {
  const gr = statsGR(j);
  const tiles = gr ? [["🧤 Jogos a Zero", gr.jogosZero], ["⏱️ Minutos sem sofrer", gr.minutosZero + "'"], ["📉 Sofridos/jogo", gr.mediaSofridos.toFixed(2).replace(".", ",")]]
    : [["Golos", j.golos], ["Assistências", j.assistencias]];
  return tiles.map(([l, v]) => `<div class="summary-tile"><span>${l}</span><strong>${v}</strong></div>`).join("");
}

function renderInicio() {
  const euro = v => VFN.formatoEuro.format(v);
  if (eu) {
    const minhas = dados.fines.filter(f => String(f.player_id) === String(eu.id));
    const pendente = minhas.filter(f => !f.paid).reduce((s, f) => s + (Number(f.amount) || 0), 0);
    $("eqBoasVindas").innerHTML = `<div class="eq-ola">${VFN.avatarJogador(eu, "avatar-sm")}<div><span class="muted">Olá,</span><h2>${esc(eu.nome)}</h2>
        <p>${esc(eu.posicao)}${eu.numero !== "" ? " · Nº " + esc(eu.numero) : ""} ${eu.disponibilidade ? VFN.badgeDisponibilidade(eu.disponibilidade) : ""}</p></div></div>
      <div class="summary-tiles eq-kpis">
        <div class="summary-tile tile-pendente"><span>Multas por pagar</span><strong>${euro(pendente)}</strong></div>
        ${kpisPessoais(eu)}
        <div class="summary-tile"><span>Minutos</span><strong>${eu.minutos}'</strong></div>
      </div>`;
  } else {
    $("eqBoasVindas").innerHTML = `<div class="eq-ola"><div><span class="muted">Olá,</span><h2>${esc((perfil && perfil.full_name) || utilizador.email)}</h2><p class="muted">Entraste como equipa técnica: vês os dados do plantel, sem as secções pessoais.</p></div></div>`;
  }
  $("eqHubInicio").innerHTML = H.estatisticasIniciaisHTML(dados, jogadores, { semIdadeMedia: true });
  $("eqProximoJogo").innerHTML = H.proximoJogoHTML(dados);
  $("eqForma").innerHTML = H.formaHTML(dados, 5);
  $("eqResultados").innerHTML = H.resultadosHTML(dados, 5);
}

/* ---------- Convocatória ---------- */

/** Jogadores só veem convocatórias publicadas; a equipa técnica vê também rascunhos. */
function convocatoriaAtual() {
  return VFNComp.proximaConvocatoria(dados, !!eu || !perfil);
}

function renderConvocatoria() {
  const c = convocatoriaAtual();
  $("eqConvAcoes").hidden = !c;
  $("eqConvocatoria").innerHTML = c ? VFNComp.renderSquadView(dados, c.jogo, c.squad, pessoa, { eu, todos: jogadores }) : H.vazio("A convocatória do próximo jogo ainda não foi publicada.");
  // resumo no início: convocado ou não
  const resumo = $("eqConvResumo");
  resumo.hidden = !c || !eu;
  if (c && eu) {
    const sim = (c.squad.player_ids || []).map(String).includes(String(eu.id));
    const conc = c.squad.squad_status === "completa" && c.squad.concentration_time ? ` · concentração ${String(c.squad.concentration_time).slice(0, 5)}${c.squad.concentration_location ? " em " + c.squad.concentration_location : ""}` : "";
    const nome = H.nomeAdversario(dados, c.jogo);
    resumo.className = `card eq-conv-resumo ${sim ? "sim" : "nao"}`;
    resumo.innerHTML = `${VFN.icone(sim ? "circle-check" : "circle-off", 26)}<div><strong>${sim ? "Estás convocado" : "Não estás convocado"}</strong><span>${esc(VFN.jogoEmCasa(c.jogo) ? "VFN vs " + nome : nome + " vs VFN")} · ${esc(VFN.dataLonga(c.jogo.date, true))}${sim ? esc(conc) : ""}</span></div><button type="button" class="btn btn-ghost btn-sm" data-ir-vista="convocatoria">Ver convocatória</button>`;
  }
}

/* ---------- Competições: Classificação/Bracket | Jornadas | Marcadores (só leitura) ---------- */

const filtrosComp = { competicao: VFN.COMPETICOES_CLASSIFICACAO[0], jornada: "", equipa: "", ordem: "asc" };
let graficoPosicaoEq = null;

function renderCompeticoes() {
  const comp = $("eqJornCompeticao"), jor = $("eqJornJornada"), eq = $("eqJornEquipa");
  comp.innerHTML = VFN.COMPETICOES_SELETOR.map(c => `<option value="${esc(c)}">${esc(VFN.nomeCurtoCompeticao(c))}</option>`).join("");
  comp.value = filtrosComp.competicao;
  const jornadas = H.jornadasDisponiveis(dados, filtrosComp.competicao);
  jor.innerHTML = '<option value="">Todas as jornadas</option>' + jornadas.map(n => `<option value="${n}">${esc(VFN.rotuloJornada(filtrosComp.competicao, n))}</option>`).join("");
  jor.value = jornadas.map(String).includes(filtrosComp.jornada) ? filtrosComp.jornada : "";
  const equipas = H.equipasDasJornadas(dados, filtrosComp.competicao);
  eq.innerHTML = '<option value="">Todas as equipas</option>' + equipas.map(t => `<option value="${esc(t.id)}">${esc(t.nome)}</option>`).join("");
  eq.value = equipas.some(t => t.id === filtrosComp.equipa) ? filtrosComp.equipa : "";
  $("eqJornOrdem").innerHTML = `${VFN.icone(filtrosComp.ordem === "asc" ? "arrow-up-1-0" : "arrow-down-1-0", 16)} Jornada ${filtrosComp.ordem === "asc" ? "↑" : "↓"}`;
  $("eqJornModos").querySelector(".seg-rotulo-tabela").textContent = VFN.eliminatorias(filtrosComp.competicao) ? "Bracket" : "Classificação";
  document.querySelectorAll("#view-jornadas .seg-nome-comp").forEach(s => { s.innerHTML = VFN.nomeCompeticaoHTML(filtrosComp.competicao, true); });
  $("eqJornTabela").innerHTML = H.classificacaoHTML(dados, filtrosComp.competicao);
  $("eqJornLista").innerHTML = H.jornadasHTML(dados, filtrosComp);
  $("eqJornMarcadoresVFN").innerHTML = H.marcadoresVFNCompeticaoHTML(dados, jogadores, filtrosComp.competicao, 10);
  $("eqJornMarcadores").innerHTML = H.marcadoresCampeonatoHTML(dados, jogadores, filtrosComp.competicao, 15);
  if (window.Chart) graficoPosicaoEq = H.graficoPosicao($("eqChartPosicao"), dados, filtrosComp.competicao, graficoPosicaoEq);
}

function initCompeticoes() {
  VFNComp.ligarSegmentos($("eqJornModos"), $("eqJornPaineis"), modo => { if (modo === "tabela" && graficoPosicaoEq) graficoPosicaoEq.resize(); });
  $("eqJornCompeticao").addEventListener("change", e => { filtrosComp.competicao = e.target.value; filtrosComp.jornada = ""; filtrosComp.equipa = ""; renderCompeticoes(); });
  $("eqJornJornada").addEventListener("change", e => { filtrosComp.jornada = e.target.value; renderCompeticoes(); });
  $("eqJornEquipa").addEventListener("change", e => { filtrosComp.equipa = e.target.value; renderCompeticoes(); });
  $("eqJornOrdem").addEventListener("click", () => { filtrosComp.ordem = filtrosComp.ordem === "asc" ? "desc" : "asc"; renderCompeticoes(); });
}

/* ---------- Calendário ---------- */

let calendario = null;
let mapaEquipa = null;

function renderCalendario() {
  if (!mapaEquipa) mapaEquipa = VFNComp.criarMapaEstadios($("mapaEquipa"), () => dados.teams);
  else mapaEquipa.render();
  if (calendario) { calendario.render(); return; }
  calendario = VFNComp.criarCalendarioMensal($("eqCalMes"), {
    obterDados: () => ({ ...dados, aniversariantes: VFN.aniversariantes(jogadores, dados.staff) }),
    perfil: "staff", // detalhe com eventos e escalação (só leitura; sem presenças)
    semPresencas: true,
    nomeRelatorio: id => (jogadorDoRelatorio(id) || {}).nome
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

/** Valor de cada infração (fine_types): só o tipo, o valor e quem paga — sem dados de jogadores. */
function tabelaValoresMultasHTML() {
  const tipos = VFN.TIPOS_MULTA;
  if (!tipos.length) return H.vazio("Sem tipos de multa definidos.");
  return `<div class="table-wrap"><table class="fines-table eq-valores-multas">
    <thead><tr><th scope="col">Infração</th><th scope="col" class="num">Valor</th><th scope="col">Paga</th></tr></thead>
    <tbody>${tipos.map(t => `<tr><td class="fine-infraction">${esc(t.tipo)}${t.descricao ? `<span class="fine-desc">${esc(t.descricao)}</span>` : ""}</td><td class="num">${VFN.formatoEuro.format(t.valor)}</td><td>${t.pagador === "treinador" ? "Treinador" : "Jogador"}</td></tr>`).join("")}</tbody></table></div>`;
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
  $("eqTabelaMultas").innerHTML = tabelaValoresMultasHTML();
  // jogadores: só as suas multas (sem dados dos outros); a equipa técnica vê as do plantel
  $("eqMultasEquipa").hidden = !!eu;
  if (eu) return;
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

/* ---------- Gráficos pessoais (Chart.js): só os dados do próprio jogador ---------- */

let graficosPessoais = [];

/**
 * Minutos por jornada (barras) e golos/assistências acumulados (linhas), jogo a jogo, a partir dos
 * relatórios publicados de competições oficiais (H.estatisticasPorJogo). "eu" é o jogador cuja conta
 * (players.auth_user_id) é a do utilizador autenticado (players_equipa.e_eu).
 */
function renderGraficosPessoais() {
  graficosPessoais.forEach(g => g.destroy());
  graficosPessoais = [];
  $("eqGraficosCard").hidden = !eu; // equipa técnica: sem gráficos pessoais
  if (!eu) return;
  const vazio = $("eqGraficosVazio");
  const eDele = idLocal => { const j = jogadorDoRelatorio(idLocal); return !!j && String(j.id) === String(eu.id); };
  const jogos = H.estatisticasPorJogo(dados, eDele);
  const semDados = !window.Chart || !jogos.length;
  $("eqGraficos").hidden = semDados;
  vazio.hidden = !semDados;
  vazio.textContent = !window.Chart ? "Não foi possível carregar os gráficos. Verifica a ligação à internet." : "Ainda não há relatórios publicados de jogos oficiais.";
  if (semDados) return;
  VFN.estilizarGraficos();
  const escuro = document.documentElement.classList.contains("tema-escuro");
  const cores = escuro ? { barras: "#FFD700", golos: "#4ade80", assist: "#60a5fa" } : { barras: "#13294B", golos: "#16a34a", assist: "#2563eb" };
  const rotulos = jogos.map(j => j.rotulo);
  const titulo = itens => { const j = jogos[itens[0].dataIndex]; return `${j.rotulo} (${j.competicao})`; };
  const eixoY = extra => Object.assign({ beginAtZero: true, border: { display: false }, grid: { color: Chart.defaults.borderColor }, ticks: { precision: 0 } }, extra || {});
  const eixoX = { grid: { display: false }, ticks: { maxRotation: 50, autoSkip: true } };
  graficosPessoais.push(new Chart($("eqChartMinutos"), {
    type: "bar",
    data: { labels: rotulos, datasets: [{ label: "Minutos", data: jogos.map(j => j.minutos), backgroundColor: cores.barras, borderRadius: 4, maxBarThickness: 34 }] },
    options: { maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { title: titulo, label: c => ` ${c.parsed.y}'` } } }, scales: { x: eixoX, y: eixoY({ suggestedMax: 90, title: { display: true, text: "min" } }) } }
  }));
  graficosPessoais.push(new Chart($("eqChartGolos"), {
    type: "line",
    data: { labels: rotulos, datasets: [
      { label: "Golos", data: jogos.map(j => j.golosAcum), borderColor: cores.golos, backgroundColor: cores.golos, borderWidth: 2, pointRadius: 3, tension: .25 },
      { label: "Assistências", data: jogos.map(j => j.assistAcum), borderColor: cores.assist, backgroundColor: cores.assist, borderWidth: 2, pointRadius: 3, tension: .25, borderDash: [6, 4] }
    ] },
    options: { maintainAspectRatio: false, interaction: { mode: "index", intersect: false }, plugins: { legend: { position: "bottom" }, tooltip: { callbacks: { title: titulo } } }, scales: { x: eixoX, y: eixoY() } }
  }));
}

/* ---------- Estatísticas ---------- */

const COLUNAS_STATS = [["nome", "Jogador", "texto"], ["jogos", "J", "numero"], ["minutos", "Min", "numero"], ["golos", "Golos", "numero"], ["assistencias", "Ass", "numero"], ["cartoesA", "Am.", "numero"], ["cartoesV", "Verm.", "numero"]];

let filtroHeatmapEquipa = "marcados";

/**
 * Mapas de calor (v15): o pessoal (golos do jogador com sessão; só aparece com pelo menos 1 golo com zona_golo)
 * e o da equipa (marcados / sofridos / ambos), a partir dos relatórios publicados.
 */
function renderHeatmapsEquipa() {
  const eDele = idLocal => { const j = jogadorDoRelatorio(idLocal); return !!(eu && j && String(j.id) === String(eu.id)); };
  const meusComZona = eu ? H.golosDosRelatorios(dados.match_reports).filter(e => e.tipo === "Golo" && e.equipa === "VFN" && e.zona_golo && eDele(e.jogadorId)).length : 0;
  $("eqHeatmapPessoalCard").hidden = !meusComZona;
  $("eqHeatmapPessoal").innerHTML = meusComZona ? H.renderHeatmapGolos(dados.match_reports, "marcados", { eDele }) : "";
  $("eqHeatmapEquipa").innerHTML = H.renderHeatmapGolos(dados.match_reports, filtroHeatmapEquipa);
  $("eqHeatmapFiltro").querySelectorAll("[data-filtro]").forEach(b => { const ativo = b.dataset.filtro === filtroHeatmapEquipa; b.classList.toggle("active", ativo); b.setAttribute("aria-pressed", String(ativo)); });
}

/* ---------- Adversários (v15): fichas das equipas e H2H do clube ---------- */

function renderAdversarios() {
  $("eqEquipasGrid").innerHTML = H.cardsEquipasHTML(dados, $("eqEquipasPesquisa").value);
}

/** Ficha do adversário; o H2H (tabela h2h) abre com o botão "Ver H2H". */
function abrirEquipa(teamId) {
  const t = H.equipa(dados, teamId);
  if (!teamId || !t || VFN.eVFN(t.name)) return;
  $("eqEquipaPerfilCorpo").innerHTML = H.perfilEquipaHTML(dados, teamId);
  const resumo = H.resumoH2H([t.name, t.full_name].filter(Boolean), dados.h2h);
  const botao = $("btnEqVerH2H");
  botao.hidden = false;
  botao.disabled = !resumo;
  botao.lastChild.textContent = resumo ? ` Ver H2H (${resumo.jogos.length} jogo${resumo.jogos.length === 1 ? "" : "s"})` : " Sem histórico de confrontos";
  $("eqEquipaH2H").hidden = true;
  $("eqEquipaH2H").innerHTML = resumo ? H.h2hHTML(resumo) : "";
  $("modalEquipaPerfil").hidden = false;
  $("btnFecharEquipaPerfil").focus();
}

/** % de presenças (P e A contam como presente) do jogador com sessão; null sem dados. */
function percentagemMinhasPresencas() {
  if (!minhasPresencas || !minhasPresencas.length) return null;
  return Math.round(minhasPresencas.filter(r => r.status === "P" || r.status === "A").length / minhasPresencas.length * 100);
}

let graficoRadarEq = null;

/*
 * Estatísticas completas do jogador com sessão (v15): presenças, minutos, golos, assistências, cartões, pé e
 * posições; GR: jogos a zero, minutos sem sofrer, golos sofridos e média; radar (o mesmo do admin).
 * As posições secundárias vêm de players_equipa, que ainda não as tem. Para as mostrar, correr no Supabase
 * (acrescenta as duas colunas no fim da view; o resto fica igual ao schema.sql):
 *   create or replace view public.players_equipa as
 *   select id, name, display_name, full_name, position, number, photo_url, date_of_birth, availability,
 *     jsonb_build_object('jogos', coalesce(stats->'jogos', '0'::jsonb), 'golos', coalesce(stats->'golos', '0'::jsonb),
 *       'assistencias', coalesce(stats->'assistencias', '0'::jsonb), 'cartoesA', coalesce(stats->'cartoesA', '0'::jsonb),
 *       'cartoesV', coalesce(stats->'cartoesV', '0'::jsonb), 'minutos', coalesce(stats->'minutos', '0'::jsonb),
 *       'pePreferencial', coalesce(stats->'pePreferencial', '""'::jsonb)) as stats,
 *     coalesce(auth_user_id = auth.uid(), false) as e_eu,
 *     sub_posicao, posicoes_secundarias
 *   from public.players where public.vfn_is_player() or public.vfn_is_staff();
 */
function renderFichaCompleta() {
  if (graficoRadarEq) { graficoRadarEq.destroy(); graficoRadarEq = null; }
  $("eqRadarBox").hidden = !eu || !window.Chart;
  if (!eu) { $("eqFichaCompleta").innerHTML = ""; return; }
  const pct = percentagemMinhasPresencas();
  const presentes = minhasPresencas ? minhasPresencas.filter(r => r.status === "P" || r.status === "A").length : 0;
  const tile = (rotulo, valor) => `<div class="summary-tile"><span>${rotulo}</span><strong>${valor}</strong></div>`;
  const gr = statsGR(eu);
  $("eqFichaCompleta").innerHTML = `
    <div class="summary-tiles eq-ficha-tiles">
      ${tile("Presenças (época)", pct == null ? "—" : `${pct}%`)}${tile("Minutos", eu.minutos + "'")}${tile("Golos", eu.golos)}${tile("Assistências", eu.assistencias)}${tile("Amarelos", eu.cartoesA)}${tile("Vermelhos", eu.cartoesV)}
    </div>
    ${pct != null ? `<p class="muted eq-ficha-nota">${presentes} presença${presentes === 1 ? "" : "s"} em ${minhasPresencas.length} sessões registadas</p>` : ""}
    <dl class="info-grid eq-ficha-info">
      <div><dt>Pé preferido</dt><dd>${esc(eu.info.pe || "—")}</dd></div>
      <div><dt>Posição</dt><dd>${VFN.posicaoDetalhadaHTML(eu.posicao, eu.subPosicao, eu.posicoesSecundarias) || esc(eu.posicao || "—")}</dd></div>
    </dl>
    ${gr ? `<h3 class="subsecao-titulo">🧤 Guarda-redes</h3><div class="summary-tiles eq-ficha-tiles">
      ${tile("Jogos a zero", gr.jogosZero)}${tile("Minutos sem sofrer", gr.minutosZero + "'")}${tile("Golos sofridos", gr.golosSofridos)}${tile("Média sofridos/jogo", gr.mediaSofridos.toFixed(2).replace(".", ","))}
    </div><p class="muted eq-ficha-nota">Jogo a zero: jogou o jogo todo (sem ser substituído) e o adversário não marcou. Minutos sem sofrer: soma dos minutos desses jogos. Golos sofridos: só com ele em campo. Jogos oficiais.</p>` : ""}`;
  if (!$("eqRadarBox").hidden) requestAnimationFrame(() => { graficoRadarEq = H.radarJogador($("eqRadarCanvas"), eu, jogadores, { presencas: j => j === eu ? percentagemMinhasPresencas() : null, anterior: graficoRadarEq }); });
}

function renderEstatisticas() {
  $("eqMinhaFicha").innerHTML = eu ? H.fichaVisualHTML(eu, jogadores, H.opcoesFicha(dados, eu.id, eu)) : H.vazio("Só para jogadores.");
  renderGraficosPessoais();
  renderFichaCompleta();
  renderHeatmapsEquipa();
  const posicao = $("eqStatsPosicao").value;
  const lista = jogadores.filter(j => VFN.posicaoNaCategoria(j.posicao, posicao)).sort((a, b) => b.golos - a.golos || b.minutos - a.minutos || a.nome.localeCompare(b.nome, "pt"));
  if (!lista.length) { $("eqStatsTabela").innerHTML = '<tbody><tr><td class="empty-state">Sem jogadores nesta posição.</td></tr></tbody>'; return; }
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
  const gr = statsGR(j);
  $("ejStats").innerHTML = (gr
    ? [["Jogos", j.jogos], ["🧤 Jogos a Zero", gr.jogosZero], ["⏱️ Min. sem sofrer", gr.minutosZero], ["📉 Sofridos/jogo", gr.mediaSofridos.toFixed(2).replace(".", ",")], ["Minutos", j.minutos]]
    : [["Jogos", j.jogos], ["Golos", j.golos], ["Assist.", j.assistencias], ["Minutos", j.minutos]]).map(([l, v]) => `<div class="player-modal-stat"><strong>${v}</strong><span>${l}</span></div>`).join("");
  $("ejCorpo").innerHTML = H.fichaVisualHTML(j, jogadores, H.opcoesFicha(dados, j.id, j));
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
    return `<button type="button" class="relatorios-item${relatorioAberto === String(r.id) ? " active" : ""}" data-relatorio="${esc(r.id)}">
      <span class="form-chip form-${v}">${v}</span>
      <span class="relatorios-texto"><strong>${d.casa ? "VFN" : esc(d.adversario)} ${d.casa ? d.golosVFN : d.golosAdv}–${d.casa ? d.golosAdv : d.golosVFN} ${d.casa ? esc(d.adversario) : "VFN"}</strong>
      <small>${esc(VFN.dataDDMMAAAA(d.data) || "")}${d.competicao ? (d.data ? " · " : "") + VFN.nomeCompeticaoHTML(d.competicao, true) : ""}</small></span>
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
  VFNRelatorio.carregarSituacoes($("eqRelatorioDetalhe"), item.r, cliente);
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
  renderConvocatoria();
  renderCompeticoes();
  renderCalendario();
  renderMultas();
  renderEstatisticas();
  $("eqDisponibilidade").innerHTML = H.disponibilidadeHTML(dados, jogadores);
  renderRelatorios();
  renderAdversarios();
  VFN.refreshAOS();
}

/* ---------- Skeletons enquanto os dados chegam do Supabase ---------- */

function mostrarEsqueletos() {
  H.mostrarEsqueleto("eqBoasVindas", "linhas", 2);
  H.mostrarEsqueleto("eqHubInicio", "linhas", 2);
  H.mostrarEsqueleto("eqProximoJogo", "hero");
  H.mostrarEsqueleto("eqResultados", "resultados", 5);
  H.mostrarEsqueleto("eqConvocatoria", "linhas", 5);
  H.mostrarEsqueleto("eqJornTabela", "tabela", 8);
  H.mostrarEsqueleto("eqJornLista", "resultados", 6);
  H.mostrarEsqueleto("eqCalMes", "calendario");
  H.mostrarEsqueleto("eqMinhasMultas", "linhas", 4);
  H.mostrarEsqueleto("eqTabelaMultas", "linhas", 5);
  H.mostrarEsqueleto("eqMinhaFicha", "cards", 1);
  H.mostrarEsqueleto("eqDisponibilidade", "jogadores", 8);
  H.mostrarEsqueleto("eqRelatoriosLista", "linhas", 4);
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
  // "perfil" = só equipa técnica (admin/treinador/dirigente); um perfil com outro papel (ex.: "jogador")
  // não dá o modo equipa técnica: o jogador entra pela ligação players.auth_user_id
  perfil = await VFN.obterPapel(cliente, utilizador);
  if (!perfil || !["admin", "treinador", "dirigente"].includes(perfil.role)) perfil = null;
  mostrarEcra("eqShell");
  mostrarEsqueletos();
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
  initCompeticoes();
  $("eqAvatar").addEventListener("click", () => { if (eu) abrirJogador(eu.id); });
  document.addEventListener("click", e => { const b = e.target.closest("[data-ir-vista]"); if (b) mostrarVista(b.dataset.irVista); });
  $("eqConvAcoes").addEventListener("click", e => {
    const b = e.target.closest("[data-anuncio]");
    const c = b && convocatoriaAtual();
    if (c) VFNComp.exportarAnuncioConvocatoria(dados, c.jogo, c.squad, pessoa, b.dataset.anuncio);
  });
  $("eqMultasJogador").addEventListener("change", renderMultas);
  $("eqStatsPosicao").addEventListener("change", renderEstatisticas);
  $("eqHeatmapFiltro").addEventListener("click", e => { const b = e.target.closest("[data-filtro]"); if (b) { filtroHeatmapEquipa = b.dataset.filtro; renderHeatmapsEquipa(); } });
  $("eqEquipasPesquisa").addEventListener("input", renderAdversarios);
  // emblema de uma equipa (cards dos adversários, jornadas...) abre a ficha com o H2H
  document.addEventListener("click", e => { const alvo = e.target.closest("[data-equipa]"); if (alvo && !e.target.closest(".modal-overlay")) abrirEquipa(alvo.dataset.equipa); });
  $("btnEqVerH2H").addEventListener("click", () => { const h = $("eqEquipaH2H"); h.hidden = !h.hidden; $("btnEqVerH2H").hidden = !h.hidden; });
  $("btnFecharEquipaPerfil").addEventListener("click", () => { $("modalEquipaPerfil").hidden = true; });
  $("modalEquipaPerfil").addEventListener("click", e => { if (e.target.id === "modalEquipaPerfil") $("modalEquipaPerfil").hidden = true; });
  document.addEventListener("keydown", e => { if (e.key === "Escape") $("modalEquipaPerfil").hidden = true; });
  $("eqMultasEstado").addEventListener("change", renderMultas);
  $("eqRelatoriosLista").addEventListener("click", e => { const b = e.target.closest("[data-relatorio]"); if (b) abrirRelatorio(b.dataset.relatorio); });
  // relatório completo no resumo só para a equipa técnica (perfil); os jogadores mantêm o botão "Ver Relatório"
  H.ligarDetalheJogo(() => dados, { nomeJogador: id => (jogadorDoRelatorio(id) || {}).nome, jogador: id => jogadorDoRelatorio(id), verRelatorio: id => abrirRelatorio(id), get relatorioCompleto() { return !eu && perfil ? r => VFNRelatorio.html(r, { nomeJogador: x => (jogadorDoRelatorio(x) || {}).nome }) : null; } });
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
  document.addEventListener("vfn:tema", () => { if (eu) { renderGraficosPessoais(); renderFichaCompleta(); } }); // cores dos gráficos no tema claro/escuro
  // telemóvel: puxar para atualizar no início (resultados), calendário e competições
  VFNComp.ligarPuxarParaAtualizar([$("view-inicio"), $("view-calendario"), $("view-jornadas")], async () => { await carregarDados(); renderTudo(); });

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
