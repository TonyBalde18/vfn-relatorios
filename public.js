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
  VFN.anim.tab($(`view-${vista}`));
  if (vista === "plantel") VFN.anim.cascata($("pubPlantel").children);
  if (vista === "classificacao") VFN.anim.linhas($("pubClassificacao").querySelectorAll("tbody tr"));
  if (vista === "marcadores") VFN.anim.contar($("pubMarcadores"));
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
  $("pjStats").innerHTML = [["Jogos", j.jogos], ["Minutos", j.minutos], ["Golos", j.golos], ["Assistências", j.assistencias], ["Amarelos", j.cartoesA], ["Vermelhos", j.cartoesV]]
    .map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("");
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
}

function mostrarEsqueletos() {
  $("pubProximoJogo").innerHTML = H.esqueleto("hero");
  $("pubUltimoResultado").innerHTML = H.esqueleto("hero");
  $("pubForma").innerHTML = H.esqueleto("linhas");
  $("pubPlantel").innerHTML = H.esqueleto("cards", 8);
  $("pubClassificacao").innerHTML = H.esqueleto("linhas", 8);
  $("pubCalendario").innerHTML = H.esqueleto("jogos", 5);
  $("pubMarcadores").innerHTML = H.esqueleto("linhas", 5);
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
