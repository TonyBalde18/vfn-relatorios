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
 * v10: a área do jogador já não lê presenças (attendance).
 * v20: as multas (fines) voltam a ser do plantel todo: cada jogador vê as suas, as dos colegas e as do
 * treinador, com os totais (como no dashboard). Para a base de dados devolver todas a um jogador, correr
 * sql/migrations/v20_multas_jogadores.sql (política "Players read fines"). Sem ele, o jogador continua a ver só as suas.
 */
const TABELAS = { teams: "teams", matches: "matches", league_results: "league_results", external_players: "external_players", players: "players_equipa", sessions: "sessions", fine_types: "fine_types", match_reports: "match_reports", staff: "staff", squads: "squads", h2h: "h2h", fines: "fines" };
const OPCIONAIS = ["external_players", "staff", "squads", "fine_types", "h2h"]; // h2h: sql/migrations/h2h.sql (leitura pública)

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
  dados.match_reports = dados.match_reports.filter(VFN.relatorioVisivel); // ficha publicada ou relatório completo (v1.1)
  jogadores = dados.players.map(p => ({ ...H.jogadorDeLinha(p), eEu: !!p.e_eu }));
  eu = jogadores.find(j => j.eEu) || null;
  VFN.definirTiposMulta(dados.fine_types);
  // multas do plantel e da equipa técnica (a RLS decide o que cada conta lê); pedidas com as outras tabelas
  dados.fines = VFN.normalizarMultas(dados.fines);
  // v15: presenças do próprio jogador (o pedido filtra pelo seu id). A RLS em uso, "Players read attendance"
  // (sql/schema.sql), deixa os jogadores ler as de todo o plantel; sem leitura, a ficha mostra "—".
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
  return VFN.pessoaPorId(jogadores, dados.staff, id);
}

/* ---------- Navegação ---------- */

/* V2.0: Portal · Plantel · Jogo (js/core/nav.js) */
const NAV_EQUIPA = {
  subtitulo: "Área do jogador",
  inicio: "equipa.html",
  acoes: `<button type="button" id="eqAvatar" class="eq-avatar" title="A minha ficha" aria-label="A minha ficha" hidden></button>`,
  seccoes: [
    { id: "portal", rotulo: "Portal", icone: "house", tabs: [
      { id: "visao", rotulo: "Visão Geral", vista: "inicio" },
      { id: "calendario", rotulo: "Calendário", vista: "calendario" },
      { id: "relatorios", rotulo: "Relatórios", vista: "relatorios" },
      { id: "adversarios", rotulo: "Adversários", vista: "adversarios" },
      { id: "competicoes", rotulo: "Competições", vista: "jornadas" },
      { id: "convocatoria", rotulo: "Convocatória", vista: "convocatoria" },
      { id: "multas", rotulo: "Multas", vista: "multas" }
    ] },
    { id: "plantel", rotulo: "Plantel", icone: "users", tabs: [
      { id: "visao", rotulo: "Visão Geral", vista: "plantel-visao" },
      { id: "equipa", rotulo: "Equipa", vista: "plantel" },
      { id: "estatisticas", rotulo: "Estatísticas", vista: "estatisticas" },
      { id: "comparar", rotulo: "Comparar", vista: "comparar" }
    ] },
    { id: "jogo", rotulo: "Jogo", icone: "goal", tabs: [
      { id: "historico", rotulo: "Histórico", vista: "relatorios" }
    ] }
  ],
  links: [{ href: "public.html", rotulo: "HUB VFN (página pública)", icone: "globe" }],
  pesquisa: termo => VFNPortal.filtrarPesquisa(indicePesquisa(), termo),
  aoMudar: vista => mostrarVista(vista)
};

/** Índice da pesquisa global (jogadores, jogos, eventos dos relatórios); refeito quando os dados mudam (renderTudo). */
let indiceCache = null;
function indicePesquisa() {
  if (!indiceCache) indiceCache = VFNPortal.indicePesquisa({ dados, jogadores, relatorios: relatoriosPublicados(), abrirJogador, abrirRelatorio });
  return indiceCache;
}

function mostrarVista(vista) {
  H.ativarVista(vista);
  VFNNav.marcarVista(vista);
  VFN.refreshAOS();
}

/* ---------- Início ---------- */

/** Estatísticas de GR (H.calcularStatsGR) de um jogador do plantel; null se não for GR. */
function statsGR(j) {
  return H.statsGRJogador(j, jogadores, dados);
}

/** KPIs pessoais: golos e assistências; um GR vê jogos a zero, minutos sem sofrer e média de sofridos. */
function kpisPessoais(j) {
  const gr = statsGR(j);
  const tiles = gr ? [["🧤 Jogos a Zero", gr.jogosZero], ["⏱️ Minutos sem sofrer", gr.minutosZero + "'"], ["📉 Sofridos/jogo", gr.mediaSofridos.toFixed(2).replace(".", ",")], ["🥅 Penáltis defendidos", gr.penaltisDefendidos]]
    : [["Golos", j.golos], ["Assistências", j.assistencias]];
  return tiles.map(([l, v]) => `<div class="summary-tile"><span>${l}</span><strong>${v}</strong></div>`).join("");
}

let graficoGolosEq = null;

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
  visaoGeral().render(); // V2.0: linha de tempo, último/próximo jogo, classificação, agenda e 2 semanas
  // v17: 11 mais utilizado (minutos dos relatórios oficiais, formação mais usada) e golos marcados vs sofridos — os mesmos do dashboard
  graficoGolosEq = H.graficoGolos($("eqChartGolosEquipa"), dados, { anterior: graficoGolosEq, vazio: $("eqChartGolosEquipaVazio") });
}

/* V2.0: Portal → Visão Geral e calendário (js/core/portal.js) */
let visaoGeralEq = null;
const obterDadosCalendario = () => ({ ...dados, aniversariantes: VFN.aniversariantes(jogadores, dados.staff) });
// detalhe do dia com eventos e escalação (só leitura; sem presenças)
const OPCOES_CALENDARIO = { perfil: "staff", semPresencas: true, nomeRelatorio: id => (jogadorDoRelatorio(id) || {}).nome };
function visaoGeral() {
  if (!visaoGeralEq) visaoGeralEq = VFNPortal.criarVisaoGeral($("portalVisao"), { obterDados: obterDadosCalendario, calendario: OPCOES_CALENDARIO });
  return visaoGeralEq;
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

let filtroCalendarioEq = "todos";

function renderCalendario() {
  if (calendario) calendario.render();
  else {
    calendario = VFNComp.criarCalendarioMensal($("eqCalMes"), { obterDados: obterDadosCalendario, ...OPCOES_CALENDARIO });
    VFNComp.ligarAlternanciaCalendario($("eqCalModos"), $("eqCalMes"), $("eqCalLista"), "vfnCalModoEquipa");
  }
  // V2.0: vista de lista (a mesma do dashboard)
  $("eqCalendarioFiltros").innerHTML = H.filtrosCalendarioHTML(filtroCalendarioEq);
  $("eqCalendarioLista").innerHTML = H.calendarioHTML(dados, filtroCalendarioEq);
}

/* ---------- Multas ---------- */

function linhasMultasHTML(lista, comJogador) {
  if (!lista.length) return H.vazio("Sem multas.");
  return `<div class="table-wrap"><table class="fines-table eq-multas" data-ordenar="${comJogador ? "eq-multas-todas" : "eq-multas-minhas"}">
    <thead><tr>${comJogador ? '<th scope="col" data-tipo="texto">Jogador</th>' : ""}<th scope="col" data-tipo="texto">Infracção</th><th scope="col" class="num" data-tipo="numero">Valor</th><th scope="col" data-tipo="texto">Estado</th><th scope="col" data-tipo="data">Data</th></tr></thead>
    <tbody>${lista.map(f => {
      const p = pessoa(f.player_id);
      const fora = !p && VFN.eContribuicao(f) && f.contributor_name; // contribuição de alguém de fora do plantel (v1.1)
      return `<tr>${comJogador ? `<td data-v="${esc(VFN.nomeNaMulta(f, pessoa))}">${p ? `<span class="player-cell">${VFN.avatarJogador(p, "avatar-xs")}<span>${esc(p.nome)}</span></span>` : fora ? VFN.celulaContribuidorHTML(f.contributor_name) : '<span class="muted">Jogador removido</span>'}</td>` : ""}
        <td class="fine-infraction">${VFN.infracaoMultaHTML(f)}</td>
        <td class="num" data-v="${Number(f.amount) || 0}">${VFN.valorMultaHTML(f)}</td>
        <td>${VFN.estadoMultaHTML(f)}</td>
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
    // as minhas multas (sem as contribuições, que não são multas; essas aparecem na lista da equipa)
    const minhas = dados.fines.filter(f => String(f.player_id) === String(eu.id) && !VFN.eContribuicao(f)).sort(porData);
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
  // v20: jogadores e equipa técnica veem as multas de todos (incluindo as do treinador)
  $("eqDividas").innerHTML = VFNComp.renderDebtReport(dados.fines, { pessoa });
  const sel = $("eqMultasJogador");
  const atual = sel.value;
  // quem tem multas além do plantel (o treinador) também aparece no filtro
  const extra = [...new Set(dados.fines.map(f => String(f.player_id)))].filter(id => !jogadores.some(j => String(j.id) === id)).map(pessoa).filter(Boolean);
  sel.innerHTML = '<option value="">Todos</option>' + [...jogadores, ...extra].sort((a, b) => a.nome.localeCompare(b.nome, "pt")).map(j => `<option value="${esc(j.id)}">${esc(j.nome)}</option>`).join("");
  sel.value = atual;
  const estado = $("eqMultasEstado").value;
  const todas = dados.fines
    .filter(f => !sel.value || String(f.player_id) === sel.value)
    .filter(f => !estado || (estado === "pago" ? f.paid : !f.paid))
    .sort(porData);
  $("eqMultasEquipaResumo").innerHTML = VFN.resumoMultasHTML(todas); // v1.1: as contribuições somam ao arrecadado
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

/* ---------- Comparar (v16): o jogador com sessão é o A (fixo); a equipa técnica escolhe os dois ---------- */

let comparador = null;

function renderComparar() {
  $("eqCompararAjuda").textContent = eu ? "tu e outro jogador à escolha" : "escolhe os dois jogadores";
  if (!comparador) comparador = VFNComp.criarComparador($("eqComparar"), { jogadores: () => jogadores, statsGR, fixoA: eu ? () => eu.id : null, presencas: j => (eu && j === eu ? percentagemMinhasPresencas() : null) });
  if (comparador) comparador.render();
}

/* ---------- Plantel (v17): grelha de cards como no dashboard ----------
   Golos, assistências e minutos de todos; a disponibilidade só no próprio jogador (destacado). A equipa técnica vê a de todos. */

let filtroPosicaoEq = "";

/* V2.0: Plantel → Visão Geral e Equipa (js/core/plantel.js); só leitura */
let plantelVisao = null;
function visaoPlantel() {
  if (!plantelVisao) plantelVisao = VFNPlantel.criarVisaoGeral($("plantelVisao"), { obterDados: () => dados, jogadores: () => jogadores, jogadorDoRelatorio });
  return plantelVisao;
}

function renderPlantelEq() {
  visaoPlantel().render();
  $("eqPlantelFiltros").innerHTML = H.filtrosPosicaoHTML(filtroPosicaoEq);
  $("eqPlantelGrid").innerHTML = VFNPlantel.equipaHTML(jogadores, { dados, posicao: filtroPosicaoEq, jogadorDoRelatorio, eu: eu ? eu.id : null });
  $("eqPlantelTotal").textContent = `· ${jogadores.length} jogadores`;
}

function renderAdversarios() {
  // mapa dos estádios (v18: na secção dos adversários)
  if (!mapaEquipa) mapaEquipa = VFNComp.criarMapaEstadios($("mapaEquipa"), () => dados.teams);
  else mapaEquipa.render();
  $("eqEquipasGrid").innerHTML = VFNPortal.adversariosHTML(dados, $("eqEquipasPesquisa").value); // V2.0: logo, nome e H2H
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
  const p = VFN.calcularPresencas(null, minhasPresencas); // só os registos do próprio (RLS)
  return p ? p.pct : null;
}

let graficoRadarEq = null;

/*
 * Estatísticas completas do jogador com sessão (v15): presenças, minutos, golos, assistências, cartões, pé e
 * posições; GR: jogos a zero, minutos sem sofrer, golos sofridos e média; radar (o mesmo do admin).
 * As posições secundárias vêm de players_equipa, que só as tem depois de sql/migrations/v25_players_equipa_posicoes.sql
 * (sem ela fica só a posição principal).
 */
let graficoPosicoesEq = null;

function renderFichaCompleta() {
  if (graficoRadarEq) { graficoRadarEq.destroy(); graficoRadarEq = null; }
  if (graficoPosicoesEq) { graficoPosicoesEq.destroy(); graficoPosicoesEq = null; }
  $("eqRadarBox").hidden = !eu || !window.Chart;
  $("eqPosicoesBox").hidden = !eu || !window.Chart;
  if (!eu) { $("eqFichaCompleta").innerHTML = ""; return; }
  const pct = percentagemMinhasPresencas();
  const minhas = VFN.calcularPresencas(null, minhasPresencas) || { presentes: 0, total: 0 };
  const presentes = minhas.presentes;
  const tile = (rotulo, valor) => `<div class="summary-tile"><span>${rotulo}</span><strong>${valor}</strong></div>`;
  const gr = statsGR(eu);
  $("eqFichaCompleta").innerHTML = `
    <div class="summary-tiles eq-ficha-tiles">
      ${tile("Presenças (época)", pct == null ? "—" : `${pct}%`)}${H.participacaoTilesHTML(eu, jogadores, dados)}${tile("Minutos", eu.minutos + "'")}${tile("Golos", eu.golos)}${tile("Assistências", eu.assistencias)}${tile("Amarelos", eu.cartoesA)}${tile("Vermelhos", eu.cartoesV)}
    </div>
    ${pct != null ? `<p class="muted eq-ficha-nota">${presentes} presença${presentes === 1 ? "" : "s"} em ${minhas.total} sessões registadas</p>` : ""}
    ${H.cartoesCompeticaoHTML(H.calcularSuspensoes(eu.id, dados, { eDele: idLocal => { const x = jogadorDoRelatorio(idLocal); return !!x && String(x.id) === String(eu.id); } }))}
    <dl class="info-grid eq-ficha-info">
      <div><dt>Pé preferido</dt><dd>${esc(eu.info.pe || "—")}</dd></div>
      <div><dt>Posição</dt><dd>${VFN.posicaoDetalhadaHTML(eu.posicao, eu.subPosicao, eu.posicoesSecundarias) || esc(eu.posicao || "—")}</dd></div>
    </dl>
    ${gr ? `<h3 class="subsecao-titulo">🧤 Guarda-redes</h3><div class="summary-tiles eq-ficha-tiles">
      ${tile("Jogos a zero", gr.jogosZero)}${tile("Minutos sem sofrer", gr.minutosZero + "'")}${tile("Golos sofridos", gr.golosSofridos)}${tile("Média sofridos/jogo", gr.mediaSofridos.toFixed(2).replace(".", ","))}${tile("Penáltis defendidos", gr.penaltisDefendidos)}
    </div><p class="muted eq-ficha-nota">Jogo a zero: jogou o jogo todo (sem ser substituído) e o adversário não marcou. Minutos sem sofrer: soma dos minutos desses jogos. Golos sofridos: só com ele em campo. Jogos oficiais.</p>` : ""}`;
  if (!$("eqPosicoesBox").hidden) requestAnimationFrame(() => { graficoPosicoesEq = H.graficoPosicoes($("eqPosicoesCanvas"), eu, jogadores, dados, graficoPosicoesEq); });
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

let radarModalEq = null;

function abrirJogador(id) {
  const j = jogadores.find(x => String(x.id) === String(id));
  if (!j) return;
  $("ejAvatar").innerHTML = VFN.avatarJogador(j, "avatar-modal");
  $("ejNome").textContent = j.nomeCompleto;
  $("ejMeta").innerHTML = esc([j.posicao, j.numero !== "" ? `Nº ${j.numero}` : ""].filter(Boolean).join(" · ")) + (j.disponibilidade ? " " + VFN.badgeDisponibilidade(j.disponibilidade) : "");
  const gr = statsGR(j);
  $("ejStats").innerHTML = (gr
    ? [["Jogos", j.jogos], ["🧤 Jogos a Zero", gr.jogosZero], ["⏱️ Min. sem sofrer", gr.minutosZero], ["📉 Sofridos/jogo", gr.mediaSofridos.toFixed(2).replace(".", ",")], ["🥅 Pen. defendidos", gr.penaltisDefendidos], ["Minutos", j.minutos]]
    : [["Jogos", j.jogos], ["Golos", j.golos], ["Assist.", j.assistencias], ["Minutos", j.minutos]]).map(([l, v]) => `<div class="player-modal-stat"><strong>${v}</strong><span>${l}</span></div>`).join("");
  $("ejCorpo").innerHTML = H.fichaVisualHTML(j, jogadores, H.opcoesFicha(dados, j.id, j));
  // v17: perfil da época (o mesmo radar do admin, VFNHub.radarJogador); presenças só do próprio
  if (window.Chart) {
    $("ejCorpo").insertAdjacentHTML("beforeend", `<div class="player-radar"><h4>Perfil da época <small class="muted">comparado com o plantel</small></h4><div class="radar-box"><canvas id="ejRadar" role="img" aria-label="Gráfico radar: golos, assistências, cartões, minutos e presenças"></canvas></div></div>`);
    requestAnimationFrame(() => { radarModalEq = H.radarJogador($("ejRadar"), j, jogadores, { presencas: x => (eu && x === eu ? percentagemMinhasPresencas() : null), anterior: radarModalEq }); });
  }
  $("modalJogador").hidden = false;
  $("btnFecharJogador").focus();
}

/* ---------- Relatórios publicados ---------- */

/** Os relatórios guardam o id local do plantel do admin ("1014939" ou "<uid>-3"). */
function jogadorDoRelatorio(idLocal) {
  return H.jogadorPorIdRelatorio(jogadores, idLocal);
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
  $("eqRelatoriosLista").innerHTML = lista.length ? VFNPortal.relatoriosCardsHTML(lista, { ativo: relatorioAberto }) : H.vazio("Ainda não há relatórios publicados."); // V2.0: cards
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
  VFNNav.definirUtilizador(eu ? `${eu.nome}${eu.numero !== "" ? " · #" + eu.numero : ""}` : (utilizador && utilizador.email), eu ? "Jogador" : { admin: "Administrador", treinador: "Treinador", dirigente: "Dirigente" }[perfil && perfil.role] || "Equipa técnica");
}

function renderTudo() {
  indiceCache = null;
  renderCabecalho();
  renderInicio();
  renderConvocatoria();
  renderCompeticoes();
  renderCalendario();
  renderMultas();
  renderEstatisticas();
  renderPlantelEq();
  renderRelatorios();
  renderAdversarios();
  renderComparar();
  VFN.refreshAOS();
}

/* ---------- Skeletons enquanto os dados chegam do Supabase ---------- */

function mostrarEsqueletos() {
  H.mostrarEsqueleto("eqBoasVindas", "linhas", 2);
  H.mostrarEsqueleto("eqHubInicio", "linhas", 2);
  visaoGeral().esqueleto();
  H.mostrarEsqueleto("eqConvocatoria", "linhas", 5);
  H.mostrarEsqueleto("eqJornTabela", "tabela", 8);
  H.mostrarEsqueleto("eqJornLista", "resultados", 6);
  H.mostrarEsqueleto("eqCalMes", "calendario");
  H.mostrarEsqueleto("eqMinhasMultas", "linhas", 4);
  H.mostrarEsqueleto("eqTabelaMultas", "linhas", 5);
  H.mostrarEsqueleto("eqMinhaFicha", "cards", 1);
  H.mostrarEsqueleto("eqPlantelGrid", "linhas", 10);
  visaoPlantel().esqueleto();
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

const appInstalada = () => (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;

async function entrarComSessao(sessao, viaFormulario) {
  utilizador = sessao.user;
  // primeiro login: liga a conta ao jogador com o mesmo email (se o admin já o indicou)
  try { await cliente.rpc("vfn_ligar_minha_conta"); } catch (e) { /* função ainda não criada */ }
  // "perfil" = só equipa técnica (admin/treinador/dirigente); um perfil com outro papel (ex.: "jogador")
  // não dá o modo equipa técnica: o jogador entra pela ligação players.auth_user_id
  perfil = await VFN.obterPapel(cliente, utilizador);
  if (!perfil || !["admin", "treinador", "dirigente"].includes(perfil.role)) perfil = null;
  // conta da equipa técnica: login feito aqui (a página pública só tem o botão "Área do Jogador") ou app
  // instalada (PWA) → a sua área. No browser, com sessão já aberta, mantém-se o modo equipa técnica.
  if (perfil && (viaFormulario || appInstalada())) { location.replace(perfil.role === "admin" ? "index.html" : "dashboard.html"); return; }
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
  $("eqPlantelFiltros").addEventListener("click", e => { const b = e.target.closest("[data-posicao]"); if (b) { filtroPosicaoEq = b.dataset.posicao; renderPlantelEq(); } });
  $("eqHeatmapFiltro").addEventListener("click", e => { const b = e.target.closest("[data-filtro]"); if (b) { filtroHeatmapEquipa = b.dataset.filtro; renderHeatmapsEquipa(); } });
  $("eqEquipasPesquisa").addEventListener("input", renderAdversarios);
  $("eqCalendarioFiltros").addEventListener("click", e => {
    if (e.target.closest("[data-ordem-calendario]")) { H.alternarOrdemCalendario(); renderCalendario(); return; }
    const b = e.target.closest(".filter-chip[data-filtro]");
    if (b) { filtroCalendarioEq = b.dataset.filtro; renderCalendario(); }
  });
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
  VFNNav.arrancar(); // vista do endereço (ex.: equipa.html#plantel/estatisticas)
  document.addEventListener("vfn:tema", () => { if (eu) { renderGraficosPessoais(); renderFichaCompleta(); } graficoGolosEq = H.graficoGolos($("eqChartGolosEquipa"), dados, { anterior: graficoGolosEq, vazio: $("eqChartGolosEquipaVazio") }); }); // cores dos gráficos no tema claro/escuro
  // telemóvel: puxar para atualizar no início (resultados), calendário e competições
  VFNComp.ligarPuxarParaAtualizar([$("view-inicio"), $("view-calendario"), $("view-jornadas")], async () => { await carregarDados(); renderTudo(); });

  cliente = VFN.criarClienteSupabase();
  if (!cliente) { mostrarLogin("Supabase não configurado (config.js)."); return; }

  $("loginForm").addEventListener("submit", async e => {
    e.preventDefault();
    $("loginMessage").textContent = "";
    const { data, error } = await cliente.auth.signInWithPassword({ email: $("loginEmail").value, password: $("loginPassword").value });
    if (error) { $("loginMessage").textContent = error.message === "Invalid login credentials" ? "Email ou password incorretos." : error.message; return; }
    await entrarComSessao(data.session, true);
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

VFNNav.montar(NAV_EQUIPA); // antes dos listeners do iniciar (o #btnLogout e o #eqAvatar são da nav)
document.addEventListener("DOMContentLoaded", iniciar);
