"use strict";

/* =========================================================
   DASHBOARD — treinador e dirigentes (login Supabase, só leitura)
   ========================================================= */

const H = VFNHub;
const esc = VFN.escapeHtml;
const $ = id => document.getElementById(id);

const TITULOS_VISTA = { hub: "Hub", plantel: "Plantel", estatisticas: "Estatísticas", multas: "Multas", presencas: "Presenças", jornadas: "Jornadas AF Guarda", equipas: "Equipas", disponibilidade: "Disponibilidade pré-jogo", historico: "Histórico de relatórios", calendario: "Calendário" };
const COR_MARCADOS = "#1d4ed8";
const COR_SOFRIDOS = "#ea580c";

let cliente = null;
let utilizador = null;
let dados = { players: [], teams: [], matches: [], league_results: [], external_players: [], opponents: [], attendance: [], sessions: [], fines: [], match_reports: [], fine_types: [], staff: [] };
let jogadores = [];
let filtroPosicao = "";
let filtroEstado = "";
let filtroCalendario = "todos";
let competicaoHub = "";
let ordenacaoStats = { campo: "golos", desc: true };
const graficos = {};
let appIniciada = false;

/* ---------- Dados ---------- */

// tabelas que podem ainda não existir (SQL por correr): sem aviso
const TABELAS_OPCIONAIS = ["external_players", "fine_types", "staff"];

async function carregarDados() {
  const tabelas = Object.keys(dados);
  const respostas = await Promise.all(tabelas.map(t => cliente.from(t).select("*")));
  const falhas = [];
  respostas.forEach((r, i) => {
    if (r.error) { if (!TABELAS_OPCIONAIS.includes(tabelas[i])) falhas.push(tabelas[i]); dados[tabelas[i]] = []; }
    else dados[tabelas[i]] = r.data || [];
  });
  dados.matches = VFN.normalizarLinhas(dados.matches); // nomes antigos da competição → nome oficial
  dados.league_results = VFN.normalizarLinhas(dados.league_results);
  jogadores = dados.players.map(H.jogadorDeLinha);
  VFN.definirTiposMulta(dados.fine_types);
  const aviso = $("avisoDados");
  aviso.hidden = !falhas.length;
  if (falhas.length) aviso.textContent = `Não foi possível ler: ${falhas.join(", ")}. Confirma que o schema.sql foi executado e que o teu utilizador tem papel atribuído.`;
}

/* ---------- Navegação ---------- */

function mostrarVista(vista) {
  document.querySelectorAll(".view").forEach(v => v.classList.toggle("active", v.id === `view-${vista}`));
  document.querySelectorAll(".sidebar-nav .nav-item").forEach(b => b.classList.toggle("active", b.dataset.view === vista));
  $("viewTitle").textContent = TITULOS_VISTA[vista] || vista;
  VFN.anim.tab($(`view-${vista}`));
  if (vista === "plantel") VFN.anim.cascata($("plantelGrid").children);
  VFN.refreshAOS();
  if (vista === "hub" || vista === "jornadas") Object.values(graficos).forEach(g => g && g.resize());
}

/* ---------- Hub ---------- */

function renderHub() {
  $("cardProximoJogo").innerHTML = H.proximoJogoHTML(dados);
  $("hubForma").innerHTML = H.formaHTML(dados, 5);
  $("hubResultados").innerHTML = H.resultadosHTML(dados, 5);

  if (!competicaoHub || !H.competicoesComClassificacao(dados).includes(competicaoHub)) competicaoHub = H.competicaoPreferida(dados);
  $("hubCompeticao").innerHTML = H.opcoesCompeticaoHTML(dados, competicaoHub);
  $("hubCompeticao").hidden = !competicaoHub;
  $("hubClassificacao").innerHTML = H.classificacaoHTML(dados, competicaoHub);
  VFN.anim.linhas($("hubClassificacao").querySelectorAll("tbody tr"));

  $("hubMarcadores").innerHTML = H.marcadoresHTML(jogadores, 5);
  renderAlertasSuspensao();
  VFN.anim.contar($("hubMarcadores"));
  $("cardAdversario").innerHTML = proximoAdversarioHTML();
  renderGraficos();
}

function proximoAdversarioHTML() {
  const jogo = VFN.proximoJogo(dados.matches);
  if (!jogo) return `<h2 class="hub-card-title">Próximo adversário</h2>${H.vazio("Sem jogos agendados.")}`;
  const nome = H.nomeAdversario(dados, jogo);
  const obs = dados.opponents.find(o => String(o.team_id) === String(jogo.opponent_team_id)) || {};
  const confrontos = VFN.jogosDoVFN(dados.matches)
    .filter(j => j.id !== jogo.id && VFN.estadoJogo(j) === "jogado" && VFN.golosJogo(j) &&
      (jogo.opponent_team_id ? String(j.opponent_team_id) === String(jogo.opponent_team_id) : j.opponent === jogo.opponent))
    .sort((a, b) => VFN.paraData(b.date) - VFN.paraData(a.date));
  const balanco = { V: 0, E: 0, D: 0 };
  confrontos.forEach(j => balanco[VFN.letraResultado(j)]++);
  const bloco = (titulo, texto, classe) => `<div class="scout-block ${classe || ""}"><h3>${titulo}</h3><p>${texto ? esc(texto).replace(/\n/g, "<br>") : '<span class="muted">Sem observação registada.</span>'}</p></div>`;
  return `
    <div class="hub-card-head">
      <h2 class="hub-card-title">Próximo adversário</h2>
      <span class="team-inline">${H.logoEquipa(H.equipa(dados, jogo.opponent_team_id), nome)}<strong>${esc(nome)}</strong>${obs.formation ? `<span class="comp-tag comp-amigavel">${esc(obs.formation)}</span>` : ""}</span>
    </div>
    ${jogo.opponent_team_id ? H.formaEquipaHTML(dados, jogo.opponent_team_id) : ""}
    <div class="scout-grid">
      ${bloco("Estilo de jogo", obs.style)}
      ${bloco("Pontos fortes", obs.strengths, "scout-strong")}
      ${bloco("Pontos fracos", obs.weaknesses, "scout-weak")}
      <div class="scout-block">
        <h3>Histórico</h3>
        <p><strong>${balanco.V}V · ${balanco.E}E · ${balanco.D}D</strong> <span class="muted">em ${confrontos.length} jogo${confrontos.length === 1 ? "" : "s"} registado${confrontos.length === 1 ? "" : "s"}</span></p>
        ${confrontos.slice(0, 3).map(j => { const g = VFN.golosJogo(j); return `<p class="h2h-line">${VFN.chipForma(VFN.letraResultado(j))} ${g.vfn}–${g.adv} · ${esc(VFN.dataCurta(j.date))} ${VFN.paraData(j.date).getFullYear()} · ${VFN.jogoEmCasa(j) ? "Casa" : "Fora"}</p>`; }).join("")}
        ${obs.history ? `<p>${esc(obs.history).replace(/\n/g, "<br>")}</p>` : ""}
      </div>
    </div>`;
}

/** Alerta automático: 5.º amarelo acumulado (AF Guarda) sem o jogador estar marcado como suspenso. */
function renderAlertasSuspensao() {
  const alvo = $("alertasSuspensao");
  const comBanner = !!VFN.proximoJogo(dados.matches); // o banner do próximo jogo já mostra os jogadores em risco
  const lista = comBanner ? [] : jogadores.filter(j => j.disponibilidade && VFN.alertaSuspensao(j.cartoesA, j.disponibilidade));
  alvo.hidden = !lista.length;
  alvo.innerHTML = lista.length ? `${VFN.icone("triangle-alert", 20)}<div><strong>Possível suspensão</strong><p>${lista.map(j => `${esc(j.nome)} — ${j.cartoesA} amarelos`).join(" · ")}. Na AF Guarda a suspensão é ao ${VFN.AMARELOS_SUSPENSAO}.º amarelo: sugere-se marcar como <em>Suspenso</em> na ficha do jogador (admin), se ainda não cumpriu o castigo.</p></div>` : "";
}

/* ---------- Gráficos ---------- */

function estiloGraficos() {
  if (!window.Chart) return false;
  Chart.defaults.font.family = "Inter, 'Segoe UI', Roboto, Arial, sans-serif";
  Chart.defaults.font.size = 12;
  Chart.defaults.color = "#6B645F";
  Chart.defaults.plugins.tooltip.backgroundColor = "#0A1628";
  Chart.defaults.plugins.tooltip.padding = 10;
  Chart.defaults.plugins.tooltip.cornerRadius = 6;
  return true;
}

function eixoY(extra) {
  return Object.assign({ beginAtZero: true, border: { display: false }, grid: { color: "rgba(10,22,40,.07)" }, ticks: { precision: 0 } }, extra || {});
}

function renderGraficos() {
  if (!estiloGraficos()) return;

  // Golos: últimos 10 jogos, do mais antigo para o mais recente
  const jogos = VFN.ultimosJogos(dados.matches, 10).reverse();
  $("chartGolosVazio").hidden = jogos.length > 0;
  $("chartGolos").parentElement.hidden = !jogos.length;
  if (graficos.golos) graficos.golos.destroy();
  if (jogos.length) {
    graficos.golos = new Chart($("chartGolos"), {
      type: "line",
      data: {
        labels: jogos.map(j => VFN.dataCurta(j.date)),
        datasets: [
          { label: "Marcados", data: jogos.map(j => VFN.golosJogo(j).vfn), borderColor: COR_MARCADOS, backgroundColor: COR_MARCADOS, borderWidth: 2, pointRadius: 4, pointHoverRadius: 6, pointBorderColor: "#fff", pointBorderWidth: 2, tension: 0 },
          { label: "Sofridos", data: jogos.map(j => VFN.golosJogo(j).adv), borderColor: COR_SOFRIDOS, backgroundColor: COR_SOFRIDOS, borderWidth: 2, pointRadius: 4, pointHoverRadius: 6, pointBorderColor: "#fff", pointBorderWidth: 2, tension: 0, borderDash: [6, 4] }
        ]
      },
      options: {
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { position: "top", align: "end", labels: { usePointStyle: true, boxWidth: 8, boxHeight: 8 } },
          tooltip: { callbacks: { title: items => { const j = jogos[items[0].dataIndex]; return `${VFN.dataCurta(j.date)} · ${H.nomeAdversario(dados, j)} (${VFN.jogoEmCasa(j) ? "C" : "F"})`; } } }
        },
        scales: { x: { grid: { display: false }, border: { color: "rgba(10,22,40,.2)" } }, y: eixoY({ grace: 1, ticks: { precision: 0, stepSize: 1 } }) }
      }
    });
  }

  // Presença mensal: (P + A) / registos do mês
  const porMes = {};
  dados.attendance.forEach(a => {
    if (!a.status || !a.session_date) return;
    const mes = String(a.session_date).slice(0, 7);
    const m = porMes[mes] || (porMes[mes] = { presentes: 0, total: 0 });
    m.total++;
    if (a.status === "P" || a.status === "A") m.presentes++;
  });
  const meses = VFN.mesesDaEpoca(new Date()).filter(m => porMes[m.valor]);
  $("chartPresencasVazio").hidden = meses.length > 0;
  $("chartPresencas").parentElement.hidden = !meses.length;
  if (graficos.presencas) graficos.presencas.destroy();
  if (meses.length) {
    graficos.presencas = new Chart($("chartPresencas"), {
      type: "bar",
      data: {
        labels: meses.map(m => VFN.MESES_CURTOS[Number(m.valor.slice(5)) - 1]),
        datasets: [{ label: "% presentes", data: meses.map(m => Math.round(porMes[m.valor].presentes / porMes[m.valor].total * 100)), backgroundColor: COR_MARCADOS, borderRadius: { topLeft: 4, topRight: 4 }, borderSkipped: "bottom", maxBarThickness: 36 }]
      },
      options: {
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { title: items => meses[items[0].dataIndex].rotulo, label: item => { const m = porMes[meses[item.dataIndex].valor]; return `${item.raw}% · ${m.presentes} de ${m.total} registos`; } } }
        },
        scales: { x: { grid: { display: false }, border: { color: "rgba(10,22,40,.2)" } }, y: eixoY({ max: 100, ticks: { stepSize: 25, callback: v => v + "%" } }) }
      }
    });
  }
}

/* ---------- Plantel ---------- */

function renderPlantel() {
  $("plantelFiltros").innerHTML = H.filtrosPosicaoHTML(filtroPosicao);
  $("plantelGrid").innerHTML = H.plantelHTML(jogadores, filtroPosicao, { disponibilidade: true, estado: filtroEstado });
  $("plantelTotal").textContent = `· ${jogadores.length} jogadores`;
  $("plantelFiltros").querySelectorAll(".filter-chip").forEach(b => b.addEventListener("click", () => { filtroPosicao = b.dataset.posicao; renderPlantel(); VFN.refreshAOS(); }));
  const selEstado = $("plantelEstado");
  if (selEstado && !selEstado.dataset.ligado) { selEstado.dataset.ligado = "1"; selEstado.addEventListener("change", e => { filtroEstado = e.target.value; renderPlantel(); }); }
  $("plantelGrid").querySelectorAll(".player-card").forEach(c => c.addEventListener("click", () => abrirJogador(c.dataset.id)));
  if ($("view-plantel").classList.contains("active")) VFN.anim.cascata($("plantelGrid").children);
}

function presencaJogador(id) {
  const registos = dados.attendance.filter(a => String(a.player_id) === String(id) && a.status);
  if (!registos.length) return null;
  const presentes = registos.filter(a => a.status === "P" || a.status === "A").length;
  return { pct: Math.round(presentes / registos.length * 100), presentes, total: registos.length };
}

function abrirJogador(id) {
  const j = jogadores.find(x => String(x.id) === String(id));
  if (!j) return;
  $("mjAvatar").innerHTML = VFN.avatarJogador(j, "avatar-modal");
  $("mjNome").textContent = j.nomeCompleto;
  $("mjMeta").textContent = [j.posicao, j.numero !== "" ? `Nº ${j.numero}` : "", j.info.pe ? `Pé ${j.info.pe}` : ""].filter(Boolean).join(" · ");
  if (j.disponibilidade) $("mjMeta").insertAdjacentHTML("beforeend", " " + VFN.badgeDisponibilidade(j.disponibilidade));
  $("mjStatsPrincipais").innerHTML = [["Jogos", j.jogos], ["Golos", j.golos], ["Assist.", j.assistencias], ["Minutos", j.minutos]]
    .map(([l, v]) => `<div class="player-modal-stat"><strong>${v}</strong><span>${l}</span></div>`).join("");

  const p = presencaJogador(j.id);
  const info = [["Nascimento", VFN.dataDDMMAAAA(j.info.nascimento)], ["Pé dominante", j.info.pe], ["Amarelos", j.cartoesA], ["Vermelhos", j.cartoesV], ["Presença", p ? `${p.pct}% (${p.presentes}/${p.total})` : "—"]].filter(([k, v]) => k !== "Pé dominante" || v);
  $("mjCorpo").innerHTML = `
    ${H.fichaVisualHTML(j, jogadores)}
    <dl class="info-grid">${info.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v === "" ? "—" : v)}</dd></div>`).join("")}</dl>`;
  $("modalJogador").hidden = false;
  $("btnFecharJogador").focus();
}

/* ---------- Estatísticas ---------- */

const COLUNAS_STATS = [["nome", "Jogador"], ["jogos", "J"], ["minutos", "Min"], ["golos", "Golos"], ["assistencias", "Ass"], ["cartoesA", "Am."], ["cartoesV", "Verm."]];

function renderEstatisticas() {
  const jogados = VFN.jogosDoVFN(dados.matches).filter(j => VFN.estadoJogo(j) === "jogado" && VFN.golosJogo(j));
  const t = { J: jogados.length, V: 0, E: 0, D: 0, GM: 0, GS: 0 };
  jogados.forEach(j => { const g = VFN.golosJogo(j); t[VFN.letraResultado(j)]++; t.GM += g.vfn; t.GS += g.adv; });
  $("statsCompeticoes").innerHTML = H.desempenhoPorCompeticaoHTML(dados);
  $("statsEquipa").innerHTML = [["Jogos", t.J], ["Vitórias", t.V], ["Empates", t.E], ["Derrotas", t.D], ["Golos marcados", t.GM], ["Golos sofridos", t.GS]]
    .map(([l, v]) => `<div class="summary-tile"><span>${l}</span><strong>${v}</strong></div>`).join("");

  const categorias = [["goal", "Golos", "golos"], ["target", "Assistências", "assistencias"], ["timer", "Minutos", "minutos"], ["shirt", "Jogos", "jogos"], ["square", "Amarelos", "cartoesA"]];
  $("statsTop").innerHTML = categorias.map(([icone, titulo, campo]) => {
    const top = [...jogadores].filter(j => j[campo] > 0).sort((a, b) => b[campo] - a[campo] || a.nome.localeCompare(b.nome, "pt")).slice(0, 5);
    return `<article class="card top-card" data-aos="fade-up"><h2 class="hub-card-title">${VFN.icone(icone, 18, campo === "cartoesA" ? "card-amarelo" : "")} ${titulo}</h2>${top.length ? `<ol>${top.map(j => `<li><span class="player-cell">${VFN.avatarJogador(j, "avatar-xs")}<span>${esc(j.nome)}</span></span><strong>${j[campo]}</strong></li>`).join("")}</ol>` : H.vazio("Sem dados.")}</article>`;
  }).join("");
  renderTabelaStats();
}

function renderTabelaStats() {
  const { campo, desc } = ordenacaoStats;
  const lista = [...jogadores].sort((a, b) => {
    const r = campo === "nome" ? a.nome.localeCompare(b.nome, "pt") : a[campo] - b[campo];
    return desc ? -r : r;
  });
  $("statsTabela").innerHTML = `<thead><tr>${COLUNAS_STATS.map(([c, t]) => `<th scope="col" class="${c === "nome" ? "team-col" : "num"}" aria-sort="${c === campo ? (desc ? "descending" : "ascending") : "none"}"><button type="button" class="sort-btn" data-campo="${c}">${t}${c === campo ? (desc ? " ▾" : " ▴") : ""}</button></th>`).join("")}</tr></thead>
    <tbody>${lista.map(j => `<tr><td class="team-col"><span class="player-cell">${VFN.avatarJogador(j, "avatar-xs")}<span>${esc(j.nome)} <small class="muted">${esc(j.posicao)}</small></span></span></td>${COLUNAS_STATS.slice(1).map(([c]) => `<td class="num">${j[c]}</td>`).join("")}</tr>`).join("")}</tbody>`;
  $("statsTabela").querySelectorAll(".sort-btn").forEach(b => b.addEventListener("click", () => {
    ordenacaoStats = { campo: b.dataset.campo, desc: ordenacaoStats.campo === b.dataset.campo ? !ordenacaoStats.desc : b.dataset.campo !== "nome" };
    renderTabelaStats();
  }));
}

/* ---------- Minutos jogados (a partir dos relatórios de jogo) ---------- */

/** Um relatório por jogo: o mais recente (o Word pode ter sido gerado várias vezes). */
function relatoriosUnicos() {
  const porJogo = new Map();
  dados.match_reports.filter(r => VFN.estadoRelatorio(r) === "published").forEach(r => {
    const m = r.match_data || {};
    const pre = m.preJogo || {};
    const chave = pre.matchId || `${pre.data || ""}|${pre.adversario || ""}|${r.id}`;
    const quando = r.updated_at || r.created_at || "";
    const atual = porJogo.get(chave);
    if (!atual || String(quando) > String(atual.updated_at || atual.created_at || "")) porJogo.set(chave, r);
  });
  return [...porJogo.values()];
}

/** Minutos de cada jogador num relatório: titulares desde o 0', substituições por minuto. */
function minutosDoRelatorio(matchData) {
  const jogo = (matchData && matchData.jogo) || {};
  const duracao = Number(jogo.duracaoJogo) || 90;
  const periodos = {};
  (jogo.titulares || []).filter(Boolean).forEach(id => { periodos[id] = [{ inicio: 0, fim: null }]; });
  (jogo.eventos || [])
    .filter(e => e.equipa === "VFN" && e.tipo === "Substituição" && e.jogadorSaiId && e.jogadorId)
    .sort((a, b) => (Number(a.minuto) || 0) - (Number(b.minuto) || 0))
    .forEach(e => {
      const minuto = Math.min(Number(e.minuto) || 0, duracao);
      const aberto = (periodos[e.jogadorSaiId] || []).find(p => p.fim === null);
      if (aberto) aberto.fim = minuto;
      (periodos[e.jogadorId] || (periodos[e.jogadorId] = [])).push({ inicio: minuto, fim: null });
    });
  const minutos = {};
  Object.entries(periodos).forEach(([id, lista]) => {
    const total = lista.reduce((s, p) => s + Math.max(0, (p.fim === null ? duracao : p.fim) - p.inicio), 0);
    if (total > 0) minutos[id] = total;
  });
  return minutos;
}

/** Os relatórios guardam o id local do plantel; na tabela players pode ser "1014939" ou "<uid>-3". */
function jogadorDoRelatorio(idLocal) {
  const alvo = String(idLocal);
  return jogadores.find(j => String(j.id) === alvo || String(j.id).endsWith("-" + alvo)) || null;
}

function calcularMinutosJogados() {
  const totais = new Map();
  const relatorios = relatoriosUnicos();
  relatorios.forEach(r => {
    Object.entries(minutosDoRelatorio(r.match_data)).forEach(([idLocal, min]) => {
      const j = jogadorDoRelatorio(idLocal);
      if (!j) return;
      const t = totais.get(j.id) || { jogador: j, minutos: 0, jogos: 0 };
      t.minutos += min;
      t.jogos++;
      totais.set(j.id, t);
    });
  });
  return { lista: [...totais.values()].sort((a, b) => b.minutos - a.minutos || a.jogador.nome.localeCompare(b.jogador.nome, "pt")), relatorios: relatorios.length };
}

/* ---------- Histórico de relatórios (só os publicados) ---------- */

let relatorioAberto = null;

/** Relatório completado com os dados do jogo associado. */
function relatorioCompleto(r) {
  const matchId = r.match_id || ((r.match_data || {}).preJogo || {}).matchId;
  const jogo = dados.matches.find(m => String(m.id) === String(matchId));
  return jogo ? VFNRelatorio.comJogo(r, jogo, H.nomeAdversario(dados, jogo)) : r;
}

function relatoriosPublicados() {
  return relatoriosUnicos()
    .map(relatorioCompleto)
    .map(r => ({ r, d: VFNRelatorio.extrair(r, id => (jogadorDoRelatorio(id) || {}).nome) }))
    .sort((a, b) => String(b.d.data || "").localeCompare(String(a.d.data || "")));
}

function ctxRelatorio() {
  return {
    nomeJogador: id => (jogadorDoRelatorio(id) || {}).nome,
    logoVFN: `<img class="team-logo rel-logo" src="${esc(H.logoVFN ? H.logoVFN(dados) : VFN.LOGO_VFN)}" alt="Logótipo VFN">`,
    logoEquipa: (id, nome) => H.logoEquipa(H.equipa(dados, id) || { id, name: nome }, nome, "rel-logo")
  };
}

function renderHistorico() {
  const lista = relatoriosPublicados();
  $("historicoInfo").textContent = lista.length ? `${lista.length} relatório${lista.length === 1 ? "" : "s"}` : "";
  if (!lista.length) {
    $("historicoLista").innerHTML = H.vazio("Ainda não há relatórios publicados.");
    return;
  }
  $("historicoLista").innerHTML = lista.map(({ r, d }) => {
    const v = d.golosVFN > d.golosAdv ? "V" : d.golosVFN < d.golosAdv ? "D" : "E";
    return `<button type="button" class="historico-item${relatorioAberto && String(relatorioAberto.id) === String(r.id) ? " active" : ""}" data-relatorio="${esc(r.id)}">
      <span class="form-chip form-${v}">${v}</span>
      <span class="historico-texto"><strong>${d.casa ? "VFN" : esc(d.adversario)} ${d.casa ? d.golosVFN : d.golosAdv}–${d.casa ? d.golosAdv : d.golosVFN} ${d.casa ? esc(d.adversario) : "VFN"}</strong>
      <small>${esc([VFN.dataDDMMAAAA(d.data), VFN.nomeCurtoCompeticao(d.competicao)].filter(Boolean).join(" · "))}</small></span>
    </button>`;
  }).join("");
}

/** Abre um relatório publicado na vista Histórico. */
function abrirRelatorio(id) {
  const r = dados.match_reports.find(x => String(x.id) === String(id));
  if (!r || VFN.estadoRelatorio(r) !== "published") return;
  relatorioAberto = relatorioCompleto(r);
  document.querySelectorAll(".modal-overlay").forEach(m => { m.hidden = true; });
  mostrarVista("historico");
  renderHistorico();
  $("historicoDetalhe").innerHTML = VFNRelatorio.html(relatorioAberto, ctxRelatorio());
  $("btnExportarWord").hidden = false;
  if (window.innerWidth < 900) $("historicoDetalhe").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function exportarWordRelatorio() {
  if (!relatorioAberto) return;
  const d = VFNRelatorio.extrair(relatorioAberto, id => (jogadorDoRelatorio(id) || {}).nome);
  const equipa = H.equipa(dados, d.adversarioId);
  const botao = $("btnExportarWord");
  botao.disabled = true;
  try {
    await VFNRelatorio.word(relatorioAberto, {
      nomeJogador: id => (jogadorDoRelatorio(id) || {}).nome,
      urlsLogoAdversario: [d.adversarioId ? `assets/opponents/${d.adversarioId}.png` : "", VFN.urlLogoEquipa(equipa, d.adversario)].filter(Boolean)
    });
  } catch (e) {
    console.error(e);
    alert("Não foi possível gerar o Word. Verifica a ligação à internet.");
  } finally {
    botao.disabled = false;
  }
}

function initHistorico() {
  $("historicoLista").addEventListener("click", e => {
    const b = e.target.closest("[data-relatorio]");
    if (b) abrirRelatorio(b.dataset.relatorio);
  });
  $("btnExportarWord").addEventListener("click", exportarWordRelatorio);
}

function renderMinutos() {
  const { lista, relatorios } = calcularMinutosJogados();
  $("minutosInfo").textContent = relatorios ? `${relatorios} relatório${relatorios === 1 ? "" : "s"} de jogo` : "";
  if (!lista.length) {
    const vazio = H.vazio("Ainda não há relatórios de jogo com o onze e as substituições registados.");
    $("minutosLista").innerHTML = vazio;
    $("onzeCampo").innerHTML = vazio;
    return;
  }
  $("minutosLista").innerHTML = H.minutosListaHTML(lista);
  $("onzeCampo").innerHTML = H.onzeCampoHTML(lista);
}

/* ---------- Disponibilidade pré-jogo e resumo financeiro ---------- */

function renderDisponibilidade() {
  $("dbDisponibilidade").innerHTML = H.disponibilidadeHTML(dados, jogadores);
}

/** Total de multas por mês (época) e jogadores com multas por pagar. */
function renderResumoFinanceiro() {
  const euro = v => VFN.formatoEuro.format(v);
  const porMes = VFN.mesesDaEpoca(new Date()).map(m => {
    const doMes = dados.fines.filter(f => String(f.match_date || "").startsWith(m.valor));
    const soma = l => l.reduce((s, f) => s + (Number(f.amount) || 0), 0);
    return { ...m, n: doMes.length, total: soma(doMes), pago: soma(doMes.filter(f => f.paid)), pendente: soma(doMes.filter(f => !f.paid)) };
  }).filter(m => m.n);
  const maximo = Math.max(1, ...porMes.map(m => m.total));
  $("dbFinanceiroMeses").innerHTML = porMes.length ? `<table class="stats-table fin-table"><thead><tr><th scope="col">Mês</th><th scope="col">Multas</th><th scope="col">Total</th><th scope="col">Pago</th><th scope="col">Por pagar</th></tr></thead>
    <tbody>${porMes.map(m => `<tr><th scope="row">${esc(m.rotulo)}</th><td>${m.n}</td><td><span class="barra-pct barra-euro"><i style="width:${Math.round(m.total / maximo * 100)}%"></i></span>${euro(m.total)}</td><td class="txt-ok">${euro(m.pago)}</td><td class="txt-mau">${euro(m.pendente)}</td></tr>`).join("")}</tbody>
    <tfoot><tr><th scope="row">Época</th><td>${porMes.reduce((s, m) => s + m.n, 0)}</td><td>${euro(porMes.reduce((s, m) => s + m.total, 0))}</td><td class="txt-ok">${euro(porMes.reduce((s, m) => s + m.pago, 0))}</td><td class="txt-mau">${euro(porMes.reduce((s, m) => s + m.pendente, 0))}</td></tr></tfoot></table>` : H.vazio("Ainda não há multas registadas.");
  $("dbFinanceiroAbertos").innerHTML = VFNComp.renderDebtReport(dados.fines, { pessoa: jogadorPorIdDash });
}

/* ---------- Multas e Presenças (dirigentes; só leitura) ---------- */

const filtrosMultas = { mes: "epoca", jogador: "", tipo: "", estado: "" };
const filtrosPresencas = { mes: VFN.mesAtual(), jogador: "" };
const NOMES_PRESENCA = { P: "Presente", F: "Falta", A: "Atraso", J: "Justificada" };

/** Jogador, ou elemento da equipa técnica (as multas do treinador usam o id dele). */
function jogadorPorIdDash(id) {
  const jogador = jogadores.find(j => String(j.id) === String(id));
  if (jogador) return jogador;
  const staff = (dados.staff.length ? dados.staff : VFN.STAFF_PADRAO).find(t => String(t.id) === String(id));
  return staff ? VFN.pessoaStaff(staff) : null;
}

function celulaJogadorDash(id) {
  const j = jogadorPorIdDash(id);
  return j ? `<span class="player-cell">${VFN.avatarJogador(j, "avatar-xs")}<span>${esc(j.nome)}</span></span>` : '<span class="player-cell muted">Jogador removido</span>';
}

function opcoesJogadoresDash(selecionado, rotulo) {
  return `<option value="">${rotulo}</option>` + [...jogadores].sort((a, b) => a.nome.localeCompare(b.nome, "pt"))
    .map(j => `<option value="${esc(j.id)}" ${String(j.id) === String(selecionado) ? "selected" : ""}>${esc(j.nome)}</option>`).join("");
}

function renderMultasDash() {
  if (!$("dbMultasBody")) return;
  const tipos = [...new Set([...VFN.TIPOS_MULTA.map(t => t.tipo), ...dados.fines.map(f => f.infraction_type)])];
  $("dbMultasJogador").innerHTML = opcoesJogadoresDash(filtrosMultas.jogador, "Todos os jogadores");
  $("dbMultasTipo").innerHTML = '<option value="">Todos os tipos</option>' + tipos.map(t => `<option value="${esc(t)}" ${t === filtrosMultas.tipo ? "selected" : ""}>${esc(VFN.rotuloMulta(t))}</option>`).join("");
  $("dbMultasEstado").value = filtrosMultas.estado;
  $("dbMultasMes").innerHTML = '<option value="epoca">Época inteira</option>' + VFN.mesesDaEpoca(new Date()).map(m => `<option value="${m.valor}" ${m.valor === filtrosMultas.mes ? "selected" : ""}>${m.rotulo}</option>`).join("");
  $("dbMultasMes").value = filtrosMultas.mes;
  const lista = multasFiltradasDash();
  renderTabelaMultasDash(lista);
}

function multasFiltradasDash() {
  return dados.fines
    .filter(f => filtrosMultas.mes === "epoca" || String(f.match_date || "").startsWith(filtrosMultas.mes))
    .filter(f => !filtrosMultas.jogador || String(f.player_id) === filtrosMultas.jogador)
    .filter(f => !filtrosMultas.tipo || f.infraction_type === filtrosMultas.tipo)
    .filter(f => !filtrosMultas.estado || (filtrosMultas.estado === "pago" ? f.paid : !f.paid))
    .sort((a, b) => String(b.match_date || "").localeCompare(String(a.match_date || "")));
}

function renderTabelaMultasDash(lista) {
  const pendente = lista.filter(f => !f.paid).reduce((s, f) => s + (Number(f.amount) || 0), 0);
  const pago = lista.filter(f => f.paid).reduce((s, f) => s + (Number(f.amount) || 0), 0);
  $("dbMultasResumo").innerHTML = `
    <div class="summary-tile tile-pendente"><span>Total pendente</span><strong>${VFN.formatoEuro.format(pendente)}</strong></div>
    <div class="summary-tile tile-pago"><span>Total arrecadado</span><strong>${VFN.formatoEuro.format(pago)}</strong></div>
    <div class="summary-tile"><span>Nº de multas</span><strong>${lista.length}</strong></div>`;
  $("dbMultasBody").innerHTML = lista.length ? lista.map(f => `
    <tr>
      <td data-v="${esc((jogadorPorIdDash(f.player_id) || {}).nome || "")}">${celulaJogadorDash(f.player_id)}</td>
      <td class="fine-infraction">${esc(VFN.rotuloMulta(f.infraction_type))}${f.description ? `<span class="fine-desc">${esc(f.description)}</span>` : ""}</td>
      <td class="num" data-v="${Number(f.amount) || 0}">${VFN.valorMultaHTML(f)}</td>
      <td><span class="status-badge ${f.paid ? "status-jogado result-V" : "status-jogado result-D"}">${f.paid ? "Pago" : "Pendente"}</span>${f.paid && f.paid_date ? `<span class="fine-desc">em ${esc(VFN.dataDDMMAAAA(f.paid_date))}</span>` : ""}</td>
      <td data-v="${esc(f.match_date || "")}">${esc(VFN.dataDDMMAAAA(f.match_date) || "—")}</td>
    </tr>`).join("") : `<tr><td colspan="5" class="empty-state">Sem multas com estes filtros.</td></tr>`;
}

/** Colunas do mês: sessões criadas + dias com presenças + jogos do VFN (como no admin). */
function sessoesDoMesDash(mes) {
  const mapa = new Map();
  const juntar = (data, tipo) => { if (data && String(data).startsWith(mes)) mapa.set(`${data}|${tipo}`, { data, tipo }); };
  dados.sessions.forEach(s => juntar(s.session_date, s.session_type));
  dados.attendance.forEach(a => juntar(a.session_date, a.session_type));
  VFN.jogosDoVFN(dados.matches).filter(j => VFN.estadoJogo(j) !== "cancelado").forEach(j => juntar(VFN.dataIso(j.date), "jogo"));
  return [...mapa.values()].sort((a, b) => a.data.localeCompare(b.data) || (a.tipo === "treino" ? -1 : 1));
}

function renderPresencasDash() {
  if (!$("dbPresencasGrelha")) return;
  const meses = VFN.mesesDaEpoca(new Date());
  if (!meses.some(m => m.valor === filtrosPresencas.mes)) filtrosPresencas.mes = meses[0].valor;
  $("dbPresencasMes").innerHTML = meses.map(m => `<option value="${m.valor}" ${m.valor === filtrosPresencas.mes ? "selected" : ""}>${m.rotulo}</option>`).join("");
  $("dbPresencasJogador").innerHTML = opcoesJogadoresDash(filtrosPresencas.jogador, "Todos os jogadores");
  renderHeatmapDash();
  const sessoes = sessoesDoMesDash(filtrosPresencas.mes);
  const lista = [...jogadores].filter(j => !filtrosPresencas.jogador || String(j.id) === filtrosPresencas.jogador).sort((a, b) => a.nome.localeCompare(b.nome, "pt"));
  if (!sessoes.length) { $("dbPresencasGrelha").innerHTML = H.vazio("Sem sessões neste mês."); return; }
  const estado = (id, s) => { const r = dados.attendance.find(a => String(a.player_id) === String(id) && a.session_date === s.data && a.session_type === s.tipo); return r && r.status || ""; };
  const totaisSessao = sessoes.map(() => ({ P: 0, F: 0, A: 0, J: 0 }));
  const linhas = lista.map(j => {
    const t = { P: 0, F: 0, A: 0, J: 0 };
    const celulas = sessoes.map((s, i) => { const e = estado(j.id, s); if (e) { t[e]++; totaisSessao[i][e]++; } return `<td><span class="att-cell" data-status="${e}" title="${NOMES_PRESENCA[e] || "Sem registo"}">${e}</span></td>`; }).join("");
    return `<tr><th scope="row" class="col-player" data-v="${esc(j.nome)}"><span class="player-cell">${VFN.avatarJogador(j, "avatar-xs")}<span>${esc(j.nome)}</span></span></th>${celulas}${["P", "F", "A", "J"].map(k => `<td class="col-total total-${k}">${t[k]}</td>`).join("")}</tr>`;
  }).join("");
  const listaVertical = VFNComp.listaPresencasHTML(linhasListaPresencas(lista, sessoes, estado));
  $("dbPresencasGrelha").innerHTML = `${listaVertical}<div class="attendance-wrap"><table class="attendance-table leitura" data-ordenar="presencas-dash">
    <thead><tr><th scope="col" class="col-player" data-tipo="texto">Jogador</th>${sessoes.map(s => `<th scope="col" title="${s.tipo === "jogo" ? "Jogo" : "Treino"} · ${esc(VFN.dataDDMMAAAA(s.data))}"><span class="session-day">${esc(VFN.dataCurta(s.data))}</span><span class="session-icon" aria-label="${s.tipo === "jogo" ? "Jogo" : "Treino"}">${VFN.icone(s.tipo === "jogo" ? "goal" : "footprints", 16)}</span></th>`).join("")}${["P", "F", "A", "J"].map(k => `<th scope="col" class="col-total" data-tipo="numero" title="${NOMES_PRESENCA[k]}">${k}</th>`).join("")}</tr></thead>
    <tbody>${linhas}</tbody>
    <tfoot><tr><td class="col-player">Presentes (P+A)</td>${totaisSessao.map(t => `<td>${t.P + t.A}</td>`).join("")}<td colspan="4"></td></tr></tfoot>
  </table></div>`;
}

/** Mapa da época (estilo GitHub): equipa inteira, ou só o jogador escolhido no filtro. */
function renderHeatmapDash() {
  const id = filtrosPresencas.jogador;
  const registos = dados.attendance.filter(a => !id || String(a.player_id) === String(id)).map(a => ({ data: a.session_date, status: a.status }));
  const j = id ? jogadorPorIdDash(id) : null;
  $("dbHeatmapInfo").textContent = j ? "· " + j.nome : "· % de presentes por dia";
  $("dbHeatmap").innerHTML = VFN.heatmapPresencasHTML(registos, { individual: !!id });
}

/* ---------- Banner do próximo jogo (recolhível) ---------- */

function renderBannerProximoJogo() {
  const banner = $("bannerProximoJogo");
  const jogo = VFN.proximoJogo(dados.matches);
  banner.hidden = !jogo;
  if (!jogo) return;
  const nome = H.nomeAdversario(dados, jogo);
  const casa = VFN.jogoEmCasa(jogo);
  const fora = jogadores.filter(j => j.disponibilidade && j.disponibilidade !== "disponivel");
  const risco = jogadores.filter(j => VFN.alertaSuspensao(j.cartoesA, j.disponibilidade));
  const chip = (j, extra) => `<span class="banner-jogador" data-jogador="${esc(j.id)}">${VFN.avatarJogador(j, "avatar-xs")}<span>${esc(j.nome)}</span>${extra}</span>`;
  // sem preferência guardada: aberto no computador, recolhido no telemóvel
  let aberto = window.innerWidth > 640;
  try { const guardado = localStorage.getItem("vfnBannerProximo"); if (guardado) aberto = guardado === "aberto"; } catch (e) { /* ignora */ }
  banner.open = aberto;
  banner.innerHTML = `<summary>
      <span class="banner-titulo">${VFN.icone("calendar-days", 18)} Próximo jogo</span>
      <span class="banner-jogo">${H.logoEquipa(H.equipa(dados, jogo.opponent_team_id), nome, "banner-logo")}<strong>${casa ? "VFN vs " + esc(nome) : esc(nome) + " vs VFN"}</strong></span>
      <span class="banner-quando">${esc(VFN.dataLonga(jogo.date, true))} · <strong data-countdown="${esc(jogo.date)}">${esc(VFN.contagemDecrescente(jogo.date))}</strong></span>
      ${fora.length + risco.length ? `<span class="banner-contagem">${VFN.icone("triangle-alert", 16)} ${fora.length + risco.length}</span>` : ""}
      <span class="banner-seta" aria-hidden="true">${VFN.icone("chevron-down", 18)}</span>
    </summary>
    <div class="banner-corpo">
      <div><h3>Indisponíveis</h3>${fora.length ? `<div class="banner-lista">${fora.map(j => chip(j, VFN.badgeDisponibilidade(j.disponibilidade))).join("")}</div>` : '<p class="muted">Todo o plantel disponível.</p>'}</div>
      ${risco.length ? `<div><h3>Em risco de suspensão</h3><div class="banner-lista">${risco.map(j => chip(j, `<span class="disp-badge disp-suspenso">${j.cartoesA} amarelos</span>`)).join("")}</div><p class="banner-nota">Na AF Guarda a suspensão é ao ${VFN.AMARELOS_SUSPENSAO}.º amarelo: marcar como <em>Suspenso</em> na ficha do jogador (admin), se ainda não cumpriu o castigo.</p></div>` : ""}
    </div>`;
}

/** Linhas da lista vertical: totais do mês por jogador. */
function linhasListaPresencas(jogadoresMes, sessoes, estado) {
  return jogadoresMes.map(j => {
    const totais = { P: 0, A: 0, F: 0, J: 0 };
    sessoes.forEach(s => { const e = estado(j.id, s); if (totais[e] !== undefined) totais[e]++; });
    return { jogador: j, id: j.id, totais };
  });
}

/** Drawer (só leitura) com as presenças do mês e o resumo da época. */
function abrirPresencasJogadorDash(id) {
  const j = jogadorPorIdDash(id);
  if (!j) return;
  const sessoes = sessoesDoMesDash(filtrosPresencas.mes);
  const estado = s => { const r = dados.attendance.find(a => String(a.player_id) === String(id) && a.session_date === s.data && a.session_type === s.tipo); return r && r.status || ""; };
  const epoca = { P: 0, A: 0, F: 0, J: 0 };
  dados.attendance.filter(a => String(a.player_id) === String(id) && epoca[a.status] !== undefined).forEach(a => { epoca[a.status]++; });
  VFNComp.abrirDrawer({ titulo: "Presenças · " + $("dbPresencasMes").selectedOptions[0].textContent, corpo: VFNComp.renderAttendanceDrawer({ jogador: j, epoca, editavel: false, sessoes: sessoes.map(s => ({ data: s.data, tipo: s.tipo, estado: estado(s) })) }) });
}

function initMultasPresencasDash() {
  $("dbDividasImagem").addEventListener("click", () => VFNComp.exportarImagemDividas(dados.fines, { pessoa: jogadorPorIdDash }));
  $("dbDividasXlsx").addEventListener("click", () => VFN.exportarXlsx(`dividas_vfn_${new Date().toISOString().slice(0, 10)}.xlsx`, [{ nome: "Dívidas", ...VFN.folhaDividas(dados.fines, id => (jogadorPorIdDash(id) || {}).nome) }]));
  $("dbPresencasGrelha").addEventListener("click", e => { const b = e.target.closest("[data-presencas-jogador]"); if (b && !e.target.closest("[data-jogador]")) abrirPresencasJogadorDash(b.dataset.presencasJogador); });
  $("bannerProximoJogo").addEventListener("toggle", e => { try { localStorage.setItem("vfnBannerProximo", e.target.open ? "aberto" : "fechado"); } catch (err) { /* ignora */ } });
  $("dbMultasJogador").addEventListener("change", e => { filtrosMultas.jogador = e.target.value; renderMultasDash(); });
  $("dbMultasMes").addEventListener("change", e => { filtrosMultas.mes = e.target.value; renderMultasDash(); });
  $("dbExportarMultas").addEventListener("click", () => {
    const rotulo = $("dbMultasMes").selectedOptions[0].textContent;
    VFN.exportarXlsx(`multas_vfn_${filtrosMultas.mes}.xlsx`, [{ nome: "Multas " + rotulo, ...VFN.folhaMultas(multasFiltradasDash(), id => (jogadorPorIdDash(id) || {}).nome) }]);
  });
  $("dbExportarPresencas").addEventListener("click", () => {
    const estado = (j, s) => { const r = dados.attendance.find(a => String(a.player_id) === String(j.id) && a.session_date === s.data && a.session_type === s.tipo); return r && r.status; };
    const rotulo = $("dbPresencasMes").selectedOptions[0].textContent;
    VFN.exportarXlsx(`presencas_vfn_${filtrosPresencas.mes}.xlsx`, [{ nome: "Presenças " + rotulo, ...VFN.folhaPresencas(sessoesDoMesDash(filtrosPresencas.mes), jogadores, estado) }]);
  });
  $("dbMultasTipo").addEventListener("change", e => { filtrosMultas.tipo = e.target.value; renderMultasDash(); });
  $("dbMultasEstado").addEventListener("change", e => { filtrosMultas.estado = e.target.value; renderMultasDash(); });
  $("dbPresencasMes").addEventListener("change", e => { filtrosPresencas.mes = e.target.value; renderPresencasDash(); });
  $("dbPresencasJogador").addEventListener("change", e => { filtrosPresencas.jogador = e.target.value; renderPresencasDash(); });
}

/* ---------- Jornadas AF Guarda (só leitura) ---------- */

const filtrosJornadas = { competicao: VFN.COMPETICOES_CLASSIFICACAO[0], jornada: "", equipa: "", ordem: "asc" };

function renderJornadas() {
  const comp = $("dbJornCompeticao"), jor = $("dbJornJornada"), eq = $("dbJornEquipa");
  comp.innerHTML = VFN.COMPETICOES_CLASSIFICACAO.map(c => `<option value="${VFN.escapeHtml(c)}">${VFN.escapeHtml(VFN.nomeCurtoCompeticao(c))}</option>`).join("");
  comp.value = filtrosJornadas.competicao;
  const jornadas = H.jornadasDisponiveis(dados, filtrosJornadas.competicao);
  jor.innerHTML = '<option value="">Todas as jornadas</option>' + jornadas.map(n => `<option value="${n}">${VFN.escapeHtml(VFN.rotuloJornada(filtrosJornadas.competicao, n))}</option>`).join("");
  jor.value = jornadas.map(String).includes(filtrosJornadas.jornada) ? filtrosJornadas.jornada : "";
  const equipas = H.equipasDasJornadas(dados, filtrosJornadas.competicao);
  eq.innerHTML = '<option value="">Todas as equipas</option>' + equipas.map(t => `<option value="${VFN.escapeHtml(t.id)}">${VFN.escapeHtml(t.nome)}</option>`).join("");
  eq.value = equipas.some(t => t.id === filtrosJornadas.equipa) ? filtrosJornadas.equipa : "";
  $("dbJornOrdem").innerHTML = `${VFN.icone(filtrosJornadas.ordem === "asc" ? "arrow-up-1-0" : "arrow-down-1-0", 16)} Jornada ${filtrosJornadas.ordem === "asc" ? "↑" : "↓"}`;
  $("dbJornLista").innerHTML = H.jornadasHTML(dados, filtrosJornadas);
  $("dbJornMarcadores").innerHTML = H.marcadoresCampeonatoHTML(dados, jogadores, filtrosJornadas.competicao, 15);
  if (estiloGraficos()) graficos.posicao = H.graficoPosicao($("chartPosicao"), dados, filtrosJornadas.competicao, graficos.posicao);
}

function initJornadas() {
  $("dbJornCompeticao").addEventListener("change", e => { filtrosJornadas.competicao = e.target.value; filtrosJornadas.jornada = ""; filtrosJornadas.equipa = ""; renderJornadas(); });
  $("dbJornJornada").addEventListener("change", e => { filtrosJornadas.jornada = e.target.value; renderJornadas(); });
  $("dbJornEquipa").addEventListener("change", e => { filtrosJornadas.equipa = e.target.value; renderJornadas(); });
  $("dbJornOrdem").addEventListener("click", () => { filtrosJornadas.ordem = filtrosJornadas.ordem === "asc" ? "desc" : "asc"; renderJornadas(); });
}


/* ---------- Equipas (só leitura) ---------- */

function renderEquipas() {
  $("dbEquipasGrid").innerHTML = H.cardsEquipasHTML(dados, $("dbEquipasPesquisa").value);
}

function abrirEquipa(teamId) {
  if (!teamId || VFN.eVFN((H.equipa(dados, teamId) || {}).name)) return;
  $("equipaPerfilCorpo").innerHTML = H.perfilEquipaHTML(dados, teamId);
  $("modalEquipaPerfil").hidden = false;
  $("btnFecharEquipaPerfil").focus();
}

function initEquipas() {
  $("dbEquipasPesquisa").addEventListener("input", renderEquipas);
  // qualquer elemento com data-equipa abre a ficha
  document.addEventListener("click", e => { const alvo = e.target.closest("[data-equipa]"); if (alvo) abrirEquipa(alvo.dataset.equipa); });
  $("btnFecharEquipaPerfil").addEventListener("click", () => { $("modalEquipaPerfil").hidden = true; });
  $("modalEquipaPerfil").addEventListener("click", e => { if (e.target.id === "modalEquipaPerfil") $("modalEquipaPerfil").hidden = true; });
  document.addEventListener("keydown", e => { if (e.key === "Escape") $("modalEquipaPerfil").hidden = true; });
}

/* ---------- Calendário ---------- */

let calendarioMensal = null;

function renderCalendario() {
  if (!calendarioMensal) {
    calendarioMensal = VFNComp.criarCalendarioMensal($("dbCalMes"), {
      obterDados: () => dados,
      perfil: "staff",
      nomeRelatorio: id => (jogadorDoRelatorio(id) || {}).nome,
      nomePresenca: id => (jogadorPorIdDash(id) || {}).nome
    });
    VFNComp.ligarAlternanciaCalendario($("dbCalModos"), $("dbCalMes"), $("dbCalLista"), "vfnCalModoDashboard");
  } else calendarioMensal.render();
  $("calendarioFiltros").innerHTML = H.filtrosCalendarioHTML(filtroCalendario);
  $("calendarioLista").innerHTML = H.calendarioHTML(dados, filtroCalendario);
  $("calendarioFiltros").querySelectorAll(".filter-chip").forEach(b => b.addEventListener("click", () => { filtroCalendario = b.dataset.filtro; renderCalendario(); }));
  $("calendarioFiltros").querySelector("[data-ordem-calendario]").addEventListener("click", () => { H.alternarOrdemCalendario(); renderCalendario(); });
}

/* ---------- Arranque ---------- */

function mostrarEsqueletos() {
  $("cardProximoJogo").innerHTML = H.esqueleto("hero");
  $("hubResultados").innerHTML = H.esqueleto("linhas", 5);
  $("hubClassificacao").innerHTML = H.esqueleto("linhas", 8);
  $("hubMarcadores").innerHTML = H.esqueleto("linhas", 5);
  $("plantelGrid").innerHTML = H.esqueleto("cards", 8);
  $("calendarioLista").innerHTML = H.esqueleto("jogos", 5);
  $("minutosLista").innerHTML = H.esqueleto("linhas", 8);
}

function renderTudo() {
  renderBannerProximoJogo();
  renderDisponibilidade();
  renderResumoFinanceiro();
  renderHub();
  renderPlantel();
  renderEstatisticas();
  renderMinutos();
  renderJornadas();
  renderEquipas();
  renderMultasDash();
  renderPresencasDash();
  renderCalendario();
  renderHistorico();
  VFN.renderSponsors($("sponsorFooter"), H.competicaoAtiva(dados));
  VFN.refreshAOS();
}

async function iniciarApp(perfil) {
  $("loginScreen").hidden = true;
  $("appShell").hidden = false;
  const meta = utilizador.user_metadata || {};
  $("sidebarUserName").textContent = (perfil && perfil.full_name) || meta.full_name || meta.name || utilizador.email;
  $("sidebarUserRole").textContent = { admin: "Administrador", treinador: "Treinador", dirigente: "Dirigente" }[perfil && perfil.role] || "";
  $("linkAdmin").hidden = !(perfil && (perfil.role === "admin" || perfil.role === "sem-tabela"));
  // Multas e Presenças: só dirigentes (e admin), sem edição
  const veMultas = !!perfil && ["dirigente", "admin", "sem-tabela"].includes(perfil.role);
  document.querySelectorAll("[data-papel=dirigente]").forEach(b => { b.hidden = !veMultas; });
  if (appIniciada) return;
  appIniciada = true;
  mostrarEsqueletos();
  await carregarDados();
  renderTudo();
}

function mostrarLogin(mensagem) {
  $("appShell").hidden = true;
  $("loginScreen").hidden = false;
  $("loginMessage").textContent = mensagem || "";
}

async function entrarComSessao(sessao) {
  utilizador = sessao.user;
  const perfil = await VFN.obterPapel(cliente, utilizador);
  if (!perfil) {
    await cliente.auth.signOut();
    mostrarLogin("Este utilizador ainda não tem acesso ao dashboard. Pede ao administrador para te atribuir um papel.");
    return;
  }
  await iniciarApp(perfil);
}

async function iniciar() {
  VFN.initAOS();
  VFN.initSidebar($("appSidebar"), $("btnSidebarToggle"));
  initJornadas();
  initEquipas();
  initHistorico();
  H.ligarDetalheJogo(() => dados, {
    nomeJogador: id => (jogadorDoRelatorio(id) || {}).nome,
    verRelatorio: id => abrirRelatorio(id)
  });
  // qualquer avatar de jogador abre a ficha (marcadores, minutos, campo, multas, presenças...)
  document.addEventListener("click", e => {
    const avatar = e.target.closest("[data-jogador]");
    if (!avatar || e.target.closest(".modal-overlay, .player-card")) return;
    if (jogadores.some(j => String(j.id) === avatar.dataset.jogador)) abrirJogador(avatar.dataset.jogador);
  });
  initMultasPresencasDash();
  document.querySelectorAll(".sidebar-nav .nav-item").forEach(b => b.addEventListener("click", () => mostrarVista(b.dataset.view)));
  $("hubCompeticao").addEventListener("change", e => { competicaoHub = e.target.value; $("hubClassificacao").innerHTML = H.classificacaoHTML(dados, competicaoHub); VFN.anim.linhas($("hubClassificacao").querySelectorAll("tbody tr")); });
  $("btnAtualizar").addEventListener("click", async () => { await carregarDados(); renderTudo(); });
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
  $("btnLogout").addEventListener("click", async () => { await cliente.auth.signOut(); appIniciada = false; mostrarLogin("Sessão terminada."); });

  const { data } = await cliente.auth.getSession();
  if (data.session) await entrarComSessao(data.session);
  else mostrarLogin();
}

document.addEventListener("DOMContentLoaded", iniciar);
