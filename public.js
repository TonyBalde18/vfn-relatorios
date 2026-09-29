"use strict";

/* =========================================================
   PÁGINA PÚBLICA — atletas, sem login, só leitura.
   Lê apenas dados públicos: teams, matches e a view
   players_public (sem atributos, notas, multas nem presenças).
   ========================================================= */

const H = VFNHub;
const $ = id => document.getElementById(id);

let dados = { teams: [], matches: [], players: [] };
let jogadores = [];
let filtroPosicao = "";
let filtroCalendario = "todos";
let competicao = "";

async function carregarDados() {
  const cliente = VFN.criarClienteSupabase({ semSessao: true });
  if (!cliente) return mostrarAviso("Supabase não configurado (config.js).");
  const pedidos = { teams: "teams", matches: "matches", players: "players_public" };
  const chaves = Object.keys(pedidos);
  const respostas = await Promise.all(chaves.map(k => cliente.from(pedidos[k]).select("*")));
  let falhou = false;
  respostas.forEach((r, i) => { if (r.error) falhou = true; dados[chaves[i]] = r.error ? [] : r.data || []; });
  jogadores = dados.players.map(H.jogadorDeLinha);
  if (falhou) mostrarAviso("Alguns dados não estão disponíveis de momento.");
}

function mostrarAviso(texto) {
  $("avisoDados").textContent = texto;
  $("avisoDados").hidden = false;
}

function mostrarVista(vista) {
  document.querySelectorAll(".view").forEach(v => v.classList.toggle("active", v.id === `view-${vista}`));
  document.querySelectorAll(".public-nav button").forEach(b => {
    const ativo = b.dataset.view === vista;
    b.classList.toggle("active", ativo);
    if (ativo) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
  });
  window.scrollTo({ top: 0 });
  VFN.refreshAOS();
}

function renderPlantel() {
  $("pubPlantelFiltros").innerHTML = H.filtrosPosicaoHTML(filtroPosicao);
  // na página pública os cartões não abrem ficha
  $("pubPlantel").innerHTML = H.plantelHTML(jogadores, filtroPosicao).replace(/<button type="button" class="player-card"/g, '<div class="player-card is-static"').replace(/<\/button>/g, "</div>");
  $("pubPlantelFiltros").querySelectorAll(".filter-chip").forEach(b => b.addEventListener("click", () => { filtroPosicao = b.dataset.posicao; renderPlantel(); VFN.refreshAOS(); }));
}

function renderCalendario() {
  $("pubCalendarioFiltros").innerHTML = H.filtrosCalendarioHTML(filtroCalendario);
  $("pubCalendario").innerHTML = H.calendarioHTML(dados, filtroCalendario);
  $("pubCalendarioFiltros").querySelectorAll(".filter-chip").forEach(b => b.addEventListener("click", () => { filtroCalendario = b.dataset.filtro; renderCalendario(); }));
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
  renderPlantel();
  renderCalendario();

  // rodapé: AF Guarda + patrocinador da competição do próximo jogo
  VFN.renderSponsors($("sponsorFooter"), H.competicaoAtiva(dados));
  VFN.refreshAOS();
}

async function iniciar() {
  VFN.initAOS();
  document.querySelectorAll(".public-nav button").forEach(b => b.addEventListener("click", () => mostrarVista(b.dataset.view)));
  $("pubCompeticao").addEventListener("change", e => { competicao = e.target.value; $("pubClassificacao").innerHTML = H.classificacaoHTML(dados, competicao); });
  renderTudo(); // estados vazios enquanto carrega
  await carregarDados();
  renderTudo();
  setInterval(H.atualizarContagens, 30000);
}

document.addEventListener("DOMContentLoaded", iniciar);
