"use strict";

/* =========================================================
   DASHBOARD — treinador e dirigentes (login Supabase, só leitura)
   ========================================================= */

const H = VFNHub;
const esc = VFN.escapeHtml;
const $ = id => document.getElementById(id);

const TITULOS_VISTA = { hub: "Hub", plantel: "Plantel", estatisticas: "Estatísticas", calendario: "Calendário" };
const COR_MARCADOS = "#1d4ed8";
const COR_SOFRIDOS = "#ea580c";

let cliente = null;
let utilizador = null;
let dados = { players: [], teams: [], matches: [], standings: [], opponents: [], attendance: [] };
let jogadores = [];
let filtroPosicao = "";
let filtroCalendario = "todos";
let competicaoHub = "";
let ordenacaoStats = { campo: "golos", desc: true };
const graficos = {};
let appIniciada = false;

/* ---------- Dados ---------- */

async function carregarDados() {
  const tabelas = Object.keys(dados);
  const respostas = await Promise.all(tabelas.map(t => cliente.from(t).select("*")));
  const falhas = [];
  respostas.forEach((r, i) => {
    if (r.error) { falhas.push(tabelas[i]); dados[tabelas[i]] = []; }
    else dados[tabelas[i]] = r.data || [];
  });
  jogadores = dados.players.map(H.jogadorDeLinha);
  const aviso = $("avisoDados");
  aviso.hidden = !falhas.length;
  if (falhas.length) aviso.textContent = `Não foi possível ler: ${falhas.join(", ")}. Confirma que o schema.sql foi executado e que o teu utilizador tem papel atribuído.`;
}

/* ---------- Navegação ---------- */

function mostrarVista(vista) {
  document.querySelectorAll(".view").forEach(v => v.classList.toggle("active", v.id === `view-${vista}`));
  document.querySelectorAll(".sidebar-nav .nav-item").forEach(b => b.classList.toggle("active", b.dataset.view === vista));
  $("viewTitle").textContent = TITULOS_VISTA[vista] || vista;
  VFN.refreshAOS();
  if (vista === "hub") Object.values(graficos).forEach(g => g && g.resize());
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

  $("hubMarcadores").innerHTML = H.marcadoresHTML(jogadores, 5);
  $("cardAdversario").innerHTML = proximoAdversarioHTML();
  renderGraficos();
}

function proximoAdversarioHTML() {
  const jogo = VFN.proximoJogo(dados.matches);
  if (!jogo) return `<h2 class="hub-card-title">Próximo adversário</h2>${H.vazio("Sem jogos agendados.")}`;
  const nome = H.nomeAdversario(dados, jogo);
  const obs = dados.opponents.find(o => String(o.team_id) === String(jogo.opponent_team_id)) || {};
  const confrontos = dados.matches
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
  $("plantelGrid").innerHTML = H.plantelHTML(jogadores, filtroPosicao);
  $("plantelTotal").textContent = `· ${jogadores.length} jogadores`;
  $("plantelFiltros").querySelectorAll(".filter-chip").forEach(b => b.addEventListener("click", () => { filtroPosicao = b.dataset.posicao; renderPlantel(); VFN.refreshAOS(); }));
  $("plantelGrid").querySelectorAll(".player-card").forEach(c => c.addEventListener("click", () => abrirJogador(c.dataset.id)));
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
  $("mjAvatar").innerHTML = j.fotoUrl ? `<img src="${esc(j.fotoUrl)}" alt="Fotografia de ${esc(j.nome)}">` : generateJerseyAvatar(j.numero);
  $("mjNome").textContent = j.nome;
  $("mjMeta").textContent = [j.posicao, j.numero !== "" ? `Nº ${j.numero}` : "", j.info.nacionalidade, j.info.pe ? `Pé ${j.info.pe}` : ""].filter(Boolean).join(" · ");
  $("mjStatsPrincipais").innerHTML = [["Jogos", j.jogos], ["Golos", j.golos], ["Assist.", j.assistencias], ["Minutos", j.minutos]]
    .map(([l, v]) => `<div class="player-modal-stat"><strong>${v}</strong><span>${l}</span></div>`).join("");

  const atributos = Object.entries(j.attributes || {}).map(([nome, raw]) => {
    const v = Number(raw) > 10 ? Math.round(Number(raw) / 10) : Number(raw) || 0;
    return `<div class="attr-row"><span>${esc(nome)}</span><span class="attribute-bar"><i style="width:${v * 10}%"></i></span><strong>${v}</strong></div>`;
  }).join("");
  const p = presencaJogador(j.id);
  const info = [["Nascimento", j.info.nascimento ? VFN.paraData(j.info.nascimento).toLocaleDateString("pt-PT") : ""], ["Altura", j.info.altura ? j.info.altura + " cm" : ""], ["Peso", j.info.peso ? j.info.peso + " kg" : ""], ["Amarelos", j.cartoesA], ["Vermelhos", j.cartoesV], ["Presença", p ? `${p.pct}% (${p.presentes}/${p.total})` : "—"]];
  $("mjCorpo").innerHTML = `
    <dl class="info-grid">${info.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v === "" ? "—" : v)}</dd></div>`).join("")}</dl>
    ${atributos ? `<h4>Atributos</h4><div class="attr-list">${atributos}</div>` : ""}
    ${j.info.notas ? `<h4>Notas do treinador</h4><p class="coach-notes">${esc(j.info.notas).replace(/\n/g, "<br>")}</p>` : ""}`;
  $("modalJogador").hidden = false;
  $("btnFecharJogador").focus();
}

/* ---------- Estatísticas ---------- */

const COLUNAS_STATS = [["nome", "Jogador"], ["jogos", "J"], ["minutos", "Min"], ["golos", "Golos"], ["assistencias", "Ass"], ["cartoesA", "🟨"], ["cartoesV", "🟥"]];

function renderEstatisticas() {
  const jogados = dados.matches.filter(j => VFN.estadoJogo(j) === "jogado" && VFN.golosJogo(j));
  const t = { J: jogados.length, V: 0, E: 0, D: 0, GM: 0, GS: 0 };
  jogados.forEach(j => { const g = VFN.golosJogo(j); t[VFN.letraResultado(j)]++; t.GM += g.vfn; t.GS += g.adv; });
  $("statsEquipa").innerHTML = [["Jogos", t.J], ["Vitórias", t.V], ["Empates", t.E], ["Derrotas", t.D], ["Golos marcados", t.GM], ["Golos sofridos", t.GS]]
    .map(([l, v]) => `<div class="summary-tile"><span>${l}</span><strong>${v}</strong></div>`).join("");

  const categorias = [["⚽ Golos", "golos"], ["🎯 Assistências", "assistencias"], ["⏱️ Minutos", "minutos"], ["👕 Jogos", "jogos"], ["🟨 Amarelos", "cartoesA"]];
  $("statsTop").innerHTML = categorias.map(([titulo, campo]) => {
    const top = [...jogadores].filter(j => j[campo] > 0).sort((a, b) => b[campo] - a[campo] || a.nome.localeCompare(b.nome, "pt")).slice(0, 5);
    return `<article class="card top-card" data-aos="fade-up"><h2 class="hub-card-title">${titulo}</h2>${top.length ? `<ol>${top.map(j => `<li><span class="player-cell">${VFN.avatarJogador(j, "avatar-xs")}<span>${esc(j.nome)}</span></span><strong>${j[campo]}</strong></li>`).join("")}</ol>` : H.vazio("Sem dados.")}</article>`;
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

/* ---------- Calendário ---------- */

function renderCalendario() {
  $("calendarioFiltros").innerHTML = H.filtrosCalendarioHTML(filtroCalendario);
  $("calendarioLista").innerHTML = H.calendarioHTML(dados, filtroCalendario);
  $("calendarioFiltros").querySelectorAll(".filter-chip").forEach(b => b.addEventListener("click", () => { filtroCalendario = b.dataset.filtro; renderCalendario(); }));
}

/* ---------- Arranque ---------- */

function renderTudo() {
  renderHub();
  renderPlantel();
  renderEstatisticas();
  renderCalendario();
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
  if (appIniciada) return;
  appIniciada = true;
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
  document.querySelectorAll(".sidebar-nav .nav-item").forEach(b => b.addEventListener("click", () => mostrarVista(b.dataset.view)));
  $("hubCompeticao").addEventListener("change", e => { competicaoHub = e.target.value; $("hubClassificacao").innerHTML = H.classificacaoHTML(dados, competicaoHub); });
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
