"use strict";

/* =========================================================
   PÁGINA PÚBLICA — atletas, sem login, só leitura.
   Lê apenas dados públicos: teams, matches e a view
   players_public (sem atributos, notas, multas nem presenças).
   ========================================================= */

const H = VFNHub;
const $ = id => document.getElementById(id);

let dados = { teams: [], matches: [], league_results: [], external_players: [], players: [] };
let jogadores = [];
let filtroPosicao = "";
let filtroCalendario = "todos";
let competicao = "";

async function carregarDados() {
  const cliente = VFN.criarClienteSupabase({ semSessao: true });
  if (!cliente) return mostrarAviso("Supabase não configurado (config.js).");
  const pedidos = { teams: "teams", matches: "matches", league_results: "league_results", external_players: "external_players", players: "players_public" };
  const chaves = Object.keys(pedidos);
  // do plantel só as colunas públicas da view (nunca a tabela players)
  const colunas = { players: "id, name, display_name, full_name, position, number, photo_url, stats" };
  const respostas = await Promise.all(chaves.map(k => cliente.from(pedidos[k]).select(colunas[k] || "*")));
  let falhou = false;
  // tabelas novas (ainda por criar no Supabase) não disparam o aviso
  const opcionais = ["external_players"];
  respostas.forEach((r, i) => { if (r.error && !opcionais.includes(chaves[i])) falhou = true; dados[chaves[i]] = r.error ? [] : r.data || []; });
  dados.matches = VFN.normalizarLinhas(dados.matches); // nomes antigos da competição → nome oficial
  dados.league_results = VFN.normalizarLinhas(dados.league_results);
  jogadores = dados.players.map(H.jogadorDeLinha);
  if (falhou) mostrarAviso("Alguns dados não estão disponíveis de momento.");
}

function mostrarAviso(texto) {
  $("avisoDados").textContent = texto;
  $("avisoDados").hidden = false;
}

// atalhos "Ver todos" no hub
document.addEventListener("click", e => { const b = e.target.closest("[data-ir-vista]"); if (b) mostrarVista(b.dataset.irVista); });

function mostrarVista(vista) {
  document.querySelectorAll(".view").forEach(v => v.classList.toggle("active", v.id === `view-${vista}`));
  document.querySelectorAll(".public-nav button").forEach(b => {
    const ativo = b.dataset.view === vista;
    b.classList.toggle("active", ativo);
    if (ativo) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
  });
  window.scrollTo({ top: 0 });
  VFN.anim.tab($(`view-${vista}`));
  if (vista === "plantel") VFN.anim.cascata($("pubPlantel").children);
  if (vista === "classificacao") VFN.anim.linhas($("pubClassificacao").querySelectorAll("tbody tr"));
  if (vista === "marcadores") VFN.anim.contar($("pubMarcadores"));
  if (vista === "jornadas" && graficoPosicaoPub) graficoPosicaoPub.resize();
  VFN.refreshAOS();
}

function renderPlantel() {
  $("pubPlantelFiltros").innerHTML = H.filtrosPosicaoHTML(filtroPosicao);
  $("pubPlantel").innerHTML = H.plantelHTML(jogadores, filtroPosicao);
  $("pubPlantelFiltros").querySelectorAll(".filter-chip").forEach(b => b.addEventListener("click", () => { filtroPosicao = b.dataset.posicao; renderPlantel(); VFN.refreshAOS(); }));
  $("pubPlantel").querySelectorAll(".player-card").forEach(c => c.addEventListener("click", () => abrirJogador(c.dataset.id)));
  if ($("view-plantel").classList.contains("active")) VFN.anim.cascata($("pubPlantel").children);
}

/** Ficha só de leitura: nome completo, camisola, posição, número e estatísticas. */
function abrirJogador(id) {
  const j = jogadores.find(x => String(x.id) === String(id));
  if (!j) return;
  $("pjAvatar").innerHTML = VFN.avatarJogador(j, "avatar-modal");
  $("pjNome").textContent = j.nomeCompleto;
  $("pjMeta").textContent = [j.posicao, j.numero !== "" ? `Nº ${j.numero}` : ""].filter(Boolean).join(" · ");
  $("pjVisual").innerHTML = H.fichaVisualHTML(j, jogadores);
  $("pjStats").innerHTML = ""; // os números estão na ficha visual
  $("modalJogador").hidden = false;
  $("btnFecharJogador").focus();
}

function fecharJogador() {
  $("modalJogador").hidden = true;
}

function renderCalendario() {
  $("pubCalendarioFiltros").innerHTML = H.filtrosCalendarioHTML(filtroCalendario);
  $("pubCalendario").innerHTML = H.calendarioDivididoHTML(dados, filtroCalendario);
  $("pubCalendarioFiltros").querySelectorAll(".filter-chip").forEach(b => b.addEventListener("click", () => { filtroCalendario = b.dataset.filtro; renderCalendario(); }));
  $("pubCalendarioFiltros").querySelector("[data-ordem-calendario]").addEventListener("click", () => { H.alternarOrdemCalendario(); renderCalendario(); });
}

function mostrarEsqueletos() {
  $("pubProximoJogo").innerHTML = H.esqueleto("hero");
  $("pubUltimoResultado").innerHTML = H.esqueleto("hero");
  $("pubForma").innerHTML = H.esqueleto("linhas");
  $("pubPlantel").innerHTML = H.esqueleto("cards", 8);
  $("pubClassificacao").innerHTML = H.esqueleto("linhas", 8);
  $("pubCalendario").innerHTML = H.esqueleto("jogos", 5);
  $("pubMarcadores").innerHTML = H.esqueleto("linhas", 5);
  $("pubHubMarcadores").innerHTML = H.esqueleto("linhas", 5);
  $("pubMinutos").innerHTML = H.esqueleto("linhas", 6);
  $("pubHubMarcadoresCamp").innerHTML = H.esqueleto("linhas", 5);
}

/* ---------- Jornadas AF Guarda (só leitura) ---------- */

const filtrosJornadas = { competicao: VFN.COMPETICOES_CLASSIFICACAO[0], jornada: "", equipa: "", ordem: "asc" };

let graficoPosicaoPub = null;

function renderJornadas() {
  const comp = $("pubJornCompeticao"), jor = $("pubJornJornada"), eq = $("pubJornEquipa");
  comp.innerHTML = VFN.COMPETICOES_CLASSIFICACAO.map(c => `<option value="${VFN.escapeHtml(c)}">${VFN.escapeHtml(VFN.nomeCurtoCompeticao(c))}</option>`).join("");
  comp.value = filtrosJornadas.competicao;
  const jornadas = H.jornadasDisponiveis(dados, filtrosJornadas.competicao);
  jor.innerHTML = '<option value="">Todas as jornadas</option>' + jornadas.map(n => `<option value="${n}">${n ? "Jornada " + n : "Sem jornada"}</option>`).join("");
  jor.value = jornadas.map(String).includes(filtrosJornadas.jornada) ? filtrosJornadas.jornada : "";
  const equipas = H.equipasDasJornadas(dados, filtrosJornadas.competicao);
  eq.innerHTML = '<option value="">Todas as equipas</option>' + equipas.map(t => `<option value="${VFN.escapeHtml(t.id)}">${VFN.escapeHtml(t.nome)}</option>`).join("");
  eq.value = equipas.some(t => t.id === filtrosJornadas.equipa) ? filtrosJornadas.equipa : "";
  $("pubJornOrdem").innerHTML = `${VFN.icone(filtrosJornadas.ordem === "asc" ? "arrow-up-1-0" : "arrow-down-1-0", 16)} Jornada ${filtrosJornadas.ordem === "asc" ? "↑" : "↓"}`;
  $("pubJornLista").innerHTML = H.jornadasHTML(dados, filtrosJornadas);
  $("pubJornMarcadores").innerHTML = H.marcadoresCampeonatoHTML(dados, jogadores, filtrosJornadas.competicao, 15);
  graficoPosicaoPub = H.graficoPosicao($("pubChartPosicao"), dados, filtrosJornadas.competicao, graficoPosicaoPub);
}

function initJornadas() {
  $("pubJornCompeticao").addEventListener("change", e => { filtrosJornadas.competicao = e.target.value; filtrosJornadas.jornada = ""; filtrosJornadas.equipa = ""; renderJornadas(); });
  $("pubJornJornada").addEventListener("change", e => { filtrosJornadas.jornada = e.target.value; renderJornadas(); });
  $("pubJornEquipa").addEventListener("change", e => { filtrosJornadas.equipa = e.target.value; renderJornadas(); });
  $("pubJornOrdem").addEventListener("click", () => { filtrosJornadas.ordem = filtrosJornadas.ordem === "asc" ? "desc" : "asc"; renderJornadas(); });
}

/* ---------- Equipas (só leitura) ---------- */

function renderEquipas() {
  $("pubEquipasGrid").innerHTML = H.cardsEquipasHTML(dados, $("pubEquipasPesquisa").value);
}

function abrirEquipa(teamId) {
  if (!teamId || VFN.eVFN((H.equipa(dados, teamId) || {}).name)) return;
  $("equipaPerfilCorpo").innerHTML = H.perfilEquipaHTML(dados, teamId);
  $("modalEquipaPerfil").hidden = false;
  $("btnFecharEquipaPerfil").focus();
}

function initEquipas() {
  $("pubEquipasPesquisa").addEventListener("input", renderEquipas);
  // qualquer elemento com data-equipa abre a ficha
  document.addEventListener("click", e => { const alvo = e.target.closest("[data-equipa]"); if (alvo) abrirEquipa(alvo.dataset.equipa); });
  $("btnFecharEquipaPerfil").addEventListener("click", () => { $("modalEquipaPerfil").hidden = true; });
  $("modalEquipaPerfil").addEventListener("click", e => { if (e.target.id === "modalEquipaPerfil") $("modalEquipaPerfil").hidden = true; });
  document.addEventListener("keydown", e => { if (e.key === "Escape") $("modalEquipaPerfil").hidden = true; });
}

function renderTudo() {
  $("pubProximoJogo").innerHTML = H.proximoJogoHTML(dados);
  $("pubUltimoResultado").innerHTML = H.ultimoResultadoHTML(dados);
  $("pubForma").innerHTML = H.formaHTML(dados, 5) || H.vazio("Ainda não há jogos disputados.");

  competicao = H.competicaoPreferida(dados);
  $("pubCompeticao").innerHTML = H.opcoesCompeticaoHTML(dados, competicao);
  $("pubCompeticao").hidden = !competicao;
  $("pubClassificacao").innerHTML = H.classificacaoHTML(dados, competicao);

  $("pubMarcadores").innerHTML = H.marcadoresHTML(jogadores, 10);
  $("pubHubMarcadores").innerHTML = H.marcadoresHTML(jogadores, 5);
  // minutos da ficha de cada jogador (players.stats, atualizados no admin)
  const minutos = jogadores.filter(j => j.minutos > 0).map(j => ({ jogador: j, minutos: j.minutos, jogos: j.jogos }))
    .sort((a, b) => b.minutos - a.minutos || a.jogador.nome.localeCompare(b.jogador.nome, "pt"));
  $("pubOnze").innerHTML = H.onzeCampoHTML(minutos);
  $("pubMinutos").innerHTML = H.minutosListaHTML(minutos.slice(0, 15));
  $("pubHubMarcadoresCamp").innerHTML = H.marcadoresCampeonatoHTML(dados, jogadores, VFN.COMPETICOES_CLASSIFICACAO[0], 5);
  $("pubMarcadoresCampeonato").innerHTML = H.marcadoresCampeonatoHTML(dados, jogadores, VFN.COMPETICOES_CLASSIFICACAO[0], 10);
  renderPlantel();
  renderJornadas();
  renderEquipas();
  renderCalendario();

  // rodapé: AF Guarda + patrocinador da competição do próximo jogo
  VFN.renderSponsors($("sponsorFooter"), H.competicaoAtiva(dados));
  VFN.refreshAOS();
}

async function iniciar() {
  VFN.initAOS();
  initJornadas();
  initEquipas();
  H.ligarDetalheJogo(() => dados); // os relatórios não são públicos: só resultado e marcadores
  // qualquer avatar de jogador abre a ficha (marcadores, minutos, campo, multas, presenças...)
  document.addEventListener("click", e => {
    const avatar = e.target.closest("[data-jogador]");
    if (!avatar || e.target.closest(".modal-overlay, .player-card")) return;
    if (jogadores.some(j => String(j.id) === avatar.dataset.jogador)) abrirJogador(avatar.dataset.jogador);
  });
  document.querySelectorAll(".public-nav button").forEach(b => b.addEventListener("click", () => mostrarVista(b.dataset.view)));
  $("btnFecharJogador").addEventListener("click", fecharJogador);
  $("modalJogador").addEventListener("click", e => { if (e.target.id === "modalJogador") fecharJogador(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") fecharJogador(); });
  $("pubCompeticao").addEventListener("change", e => { competicao = e.target.value; $("pubClassificacao").innerHTML = H.classificacaoHTML(dados, competicao); VFN.anim.linhas($("pubClassificacao").querySelectorAll("tbody tr")); });
  mostrarEsqueletos();
  await carregarDados();
  renderTudo();
  setInterval(H.atualizarContagens, 30000);
}

document.addEventListener("DOMContentLoaded", iniciar);
