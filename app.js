"use strict";

/* =========================================================
   DADOS DE BASE
   ========================================================= */

// formações e posições de cada uma no campo: partilhadas (shared.js), também usadas no 11 mais utilizado
const FORMACOES = VFN.FORMACOES;
const FORMACOES_SLOTS = VFN.FORMACOES_SLOTS;

const COMPETICOES = ["2ª Liga Futebol Zero Graus Produções", "Taça 2ª Liga FDM", "Taça de Honra Comunilog", "Amigável"];
const TIPOS_EVENTO = ["Golo", "Auto-golo", "Golo Anulado", "Penalty Falhado", "Cartão Amarelo", "Cartão Vermelho", "Lesão", "Substituição", "Tempo Acrescentado", "Paragem para hidratação", "Intervalo", "Nota"];
// eventos que normalmente não são de nenhuma equipa (a equipa fica vazia ao escolher o tipo)
const TIPOS_SEM_EQUIPA = ["Paragem para hidratação", "Intervalo"];
// emojis só para o Word e para as <option>; na interface usam-se as imagens de assets/icons/ (VFN.iconeEvento)
const ICONES_EVENTO = {
  "Golo": "⚽", "Auto-golo": "🟥⚽", "Golo Anulado": "⚽❌", "Penalty Falhado": "🔴",
  "Cartão Amarelo": "🟨", "Cartão Vermelho": "🟥", "Lesão": "🤕",
  "Substituição": "🔄", "Tempo Acrescentado": "⏱️", "Paragem para hidratação": "💧", "Intervalo": "⏸️", "Nota": "📝"
};

const SECCOES_TATICAS = [
  {
    key: "organizacaoOfensiva",
    titulo: "Organização Ofensiva",
    perguntas: [
      "Como circulámos a bola?",
      "Criámos situações de golo?",
      "Explorámos os corredores?",
      "Como foi a ligação entre linhas?"
    ]
  },
  {
    key: "organizacaoDefensiva",
    titulo: "Organização Defensiva",
    perguntas: [
      "Mantivemos o bloco compacto?",
      "Como foi a pressão?",
      "Sofremos perigo por onde?",
      "Como defendemos as bolas paradas?"
    ]
  },
  {
    key: "transicoesOfensivas",
    titulo: "Transições Ofensivas",
    perguntas: [
      "Fomos rápidos a sair a jogar?",
      "Explorámos os espaços após recuperar a bola?"
    ]
  },
  {
    key: "transicoesDefensivas",
    titulo: "Transições Defensivas",
    perguntas: [
      "Recuperámos bem a posição defensiva?",
      "Fomos vulneráveis ao contra-ataque?"
    ]
  },
  {
    key: "bolasParadas",
    titulo: "Bolas Paradas",
    perguntas: [
      "Como foram os nossos cantos e livres?",
      "Sofremos perigo em bolas paradas?"
    ]
  }
];

function jogadorBase(id, nome, posicao, numero) {
  return {
    id, nome, posicao, numero: numero || "", jogos: 0, fotoUrl: "", nacionalidade: "", nascimento: "", pePreferencial: "", altura: "", peso: "", notas: "", attributes: {}, stats: { jogos: 0 },
    golos: 0, assistencias: 0, cartoesAmarelos: 0, cartoesVermelhos: 0, minutosTotais: 0
  };
}

async function carregarFotoParaSupabase(file, jogadorId) {
  if (!supabaseClient || !currentUser || !file) return null;
  const caminho = `${currentUser.id}/${jogadorId}-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const { error } = await supabaseClient.storage.from("player-photos").upload(caminho, file, { upsert: true });
  if (error) { console.warn("Não foi possível carregar a fotografia:", error.message); return null; }
  const { data } = supabaseClient.storage.from("player-photos").getPublicUrl(caminho);
  return data.publicUrl;
}

const PLANTEL_DEFAULT = [
  jogadorBase(1, "João Macedo", "DC/MDef"),
  jogadorBase(2, "Rodrigo Cruz", "MOfe"),
  jogadorBase(3, "Tomás Vitória", "MCen"),
  jogadorBase(4, "Jota", "DD"),
  jogadorBase(5, "Tony Baldé", "DE"),
  jogadorBase(6, "Silvestre", "DC"),
  jogadorBase(7, "José Maia", "MDef"),
  jogadorBase(8, "João Carvalho (Gravatas)", "GR"),
  jogadorBase(9, "Tiago Rocha", "GR"),
  jogadorBase(10, "Tomás Salcedas", "Posição a definir"),
  jogadorBase(11, "Amadeu", "ED/PL"),
  jogadorBase(12, "Diogo", "GR"),
  jogadorBase(13, "Painço", "DE"),
  jogadorBase(14, "João", "DC"),
  jogadorBase(15, "Marco", "MDef"),
  jogadorBase(16, "Tomás", "MCen"),
  jogadorBase(17, "Fred", "MCen"),
  jogadorBase(18, "Telmo", "EE"),
  jogadorBase(19, "Bomba", "PL"),
  jogadorBase(20, "Bernardo", "DE")
];

const DRAFT_KEY = "vfnRelatorioDraft";
const PLANTEL_KEY = "vfnPlantel";

/* =========================================================
   ESTADO
   ========================================================= */

function estadoInicial() {
  return {
    preJogo: {
      jornada: "",
      data: "",
      competicao: COMPETICOES[0],
      casaFora: "Casa",
      adversario: "",
      formacaoPrevista: "4-3-3",
      notasAdversario: "",
      matchId: "", // jogo do calendário (tabela matches) associado a este relatório
      adversarioId: "", // equipa (tabela teams)
      local: "",
      proximoJogo: { data: "", adversario: "" }
    },
    jogo: {
      golosVFN: 0,
      golosAdversario: 0,
      duracaoJogo: 90,
      formacaoVFN: "4-3-3",
      formacaoAdversario: "4-4-2",
      formacaoAdversarioOutro: "",
      titulares: new Array(11).fill(null),
      suplentes: new Array(7).fill(null),
      capitaoId: null, // id local do capitão (automático pela ordem de prioridade)
      capitaoManual: false, // escolhido à mão no Jogo
      eventos: [],
      statsAplicadas: {}, // contribuição deste jogo já somada ao plantel (id -> campos)
      presencasAplicadas: false // jogos/minutos só contam depois de gerar o relatório
    },
    analise: {
      seccoes: {
        organizacaoOfensiva: { avaliacao: null, texto: "" },
        organizacaoDefensiva: { avaliacao: null, texto: "" },
        transicoesOfensivas: { avaliacao: null, texto: "" },
        transicoesDefensivas: { avaliacao: null, texto: "" },
        bolasParadas: { avaliacao: null, texto: "" }
      },
      sintese: "", // parágrafo executivo (v9; substitui "Pontos positivos")
      adversario: {
        estilo: "",
        jogadoresChave: [],
        pontosFortes: "",
        vulnerabilidades: ""
      },
      topicosTreino: "", // "Tópicos para o Treino" (v9; absorveu "Pontos a melhorar")
      primeiroTempo: "", // Evolução do Jogo: 1.ª parte
      segundoTempo: "", // Evolução do Jogo: 2.ª parte
      destaques: "", // Momentos e Situações (com as imagens em situacoes)
      situacoes: [] // [{ path (bucket report-images) | data (modo local), caption, order }]
    },
    relatorioId: "", // linha de match_reports deste relatório
    estadoRelatorio: "draft" // draft | published
  };
}

let state = estadoInicial();
let plantel = [];
let jogadorEmEdicao = null;
let pesquisaEquipa = "";
let filtroPosicaoEquipa = "";
let filtroDisponibilidadeEquipa = "";
let posicoesModal = [];
let posicaoPrincipalModal = "";
// campo vertical (ataque em cima); DC centrado na mesma vertical do MDef
const POSICOES_MAPA = { GR: [50, 92], DC: [50, 77], DD: [85, 70], DE: [15, 70], MDC: [50, 61], MC: [50, 46], MOC: [50, 31], ED: [84, 21], EE: [16, 21], PL: [50, 9] };
// posições gravadas com os códigos antigos
const CODIGOS_ANTIGOS = { MDEF: "MDC", MCEN: "MC", MOFE: "MOC", AV: "PL" };
const normalizarCodigoPosicao = c => CODIGOS_ANTIGOS[String(c).toUpperCase()] || c;
let supabaseClient = null;
let currentUser = null;
let localMode = false;

function supabaseConfigurado() {
  return VFN.supabaseConfigurado();
}

function iniciarSupabase() {
  supabaseClient = VFN.criarClienteSupabase(); // mostra o spinner VFN em todos os pedidos
}

async function sincronizarRascunhoSupabase() {
  if (!supabaseClient || !currentUser) return;
  const { error } = await supabaseClient.from("draft").upsert({ user_id: currentUser.id, data: state, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) console.warn("Não foi possível sincronizar o rascunho:", error.message);
}

async function carregarRascunhoSupabase() {
  if (!supabaseClient || !currentUser) return null;
  const { data, error } = await supabaseClient.from("draft").select("data, updated_at").eq("user_id", currentUser.id).maybeSingle();
  if (error || !data) return null;
  return { savedAt: data.updated_at, data: data.data };
}

/** Estatísticas da época a partir de matches: jogos do VFN com status 'jogado' e resultado. */
function atualizarEstatisticasEpoca() {
  const stats = { jogos: 0, vitorias: 0, empates: 0, derrotas: 0, marcados: 0, sofridos: 0 };
  VFN.ultimosJogos(jogosCalendario, Infinity).forEach(j => {
    const g = VFN.golosJogo(j);
    stats.jogos++; stats.marcados += g.vfn; stats.sofridos += g.adv;
    if (g.vfn > g.adv) stats.vitorias++; else if (g.vfn === g.adv) stats.empates++; else stats.derrotas++;
  });
  renderSeasonStats(stats);
}

function renderSeasonStats(stats) {
  const container = el("seasonStatsCard");
  if (!container) return;
  container.innerHTML = `<h2 class="section-title">Estatísticas Rápidas da Época</h2><div class="season-stats-grid">${[["Jogos", stats.jogos], ["Vitórias", stats.vitorias], ["Empates", stats.empates], ["Derrotas", stats.derrotas], ["Golos marcados", stats.marcados], ["Golos sofridos", stats.sofridos]].map(([label, value]) => `<div class="season-stat"><strong>${value}</strong><span>${label}</span></div>`).join("")}</div>${stats.jogos === 0 ? '<small class="season-empty">Ainda não há jogos do VFN com resultado no calendário.</small>' : '<small class="season-empty">Calculado a partir dos jogos do VFN com estado "jogado".</small>'}`;
}

async function guardarRelatorioSupabase() {
  if (!supabaseClient || !currentUser) return;
  // relatório sem jogo associado: fica publicado logo ao gerar o Word (como antes da v3)
  const linha = { user_id: currentUser.id, match_data: { ...state, _status: "published" }, updated_at: new Date().toISOString() };
  let { error } = await supabaseClient.from("match_reports").insert({ ...linha, status: "published" });
  if (error && /does not exist|schema cache|could not find/i.test(error.message || "")) ({ error } = await supabaseClient.from("match_reports").insert(linha));
  if (error) console.warn("Não foi possível guardar o relatório:", error.message);
}

async function sincronizarPlantelSupabase() {
  if (!supabaseClient || !currentUser) return;
  // auth_user_id nunca vai no pedido (é o jogador que liga a conta); user_id é o dono (admin)
  const rows = plantel.map(p => ({ ...(colunaDisponibilidade ? { availability: p.disponibilidade || "disponivel" } : {}), ...(colunaEmailConta ? { email: p.email || null } : {}), ...(colunaSubPosicao ? { sub_posicao: p.subPosicao || null, posicoes_secundarias: p.posicoesSecundarias || [] } : {}), id: idJogadorBD(p), user_id: currentUser.id, name: p.nome, display_name: p.nome || null, full_name: p.nomeCompleto || null, date_of_birth: p.nascimento || null, position: p.posicao, number: p.numero || null, photo_url: p.fotoUrl || null, attributes: p.attributes || {}, stats: { ...(p.stats || {}), jogos: p.jogos || 0, golos: p.golos || 0, assistencias: p.assistencias || 0, cartoesA: p.cartoesAmarelos || 0, cartoesV: p.cartoesVermelhos || 0, minutos: p.minutosTotais || 0, nacionalidade: p.nacionalidade || "", nascimento: p.nascimento || "", pePreferencial: p.pePreferencial || "", altura: p.altura || "", peso: p.peso || "", notas: p.notas || "" } }));
  if (!rows.length) return;
  const { error } = await supabaseClient.from("players").upsert(rows, { onConflict: "id" });
  if (error) console.warn("Não foi possível sincronizar o plantel:", error.message);
}

let temporizadorPlantel = null;
let colunaDisponibilidade = false; // players.availability já existe no Supabase?
let colunaEmailConta = false; // players.email (SQL de 03/10) já existe?
let colunaSubPosicao = false; // players.sub_posicao / posicoes_secundarias (SQL da v12) já existem?
function sincronizarPlantelDiferido() {
  clearTimeout(temporizadorPlantel);
  temporizadorPlantel = setTimeout(sincronizarPlantelSupabase, 1500);
}

/** Id do jogador na tabela players (e em fines/attendance): o id que veio do Supabase, ou o id local para jogadores novos. */
function idJogadorBD(jogador) {
  return jogador.idBD || String(jogador.id);
}

function jogadorPorIdBD(playerId) {
  return plantel.find(j => idJogadorBD(j) === String(playerId));
}

/* ---- Dados do clube (matches, teams, standings, fines, attendance...) ----
   Com sessão Supabase lê/escreve nas tabelas; em modo local usa localStorage. */

const dadosClube = {
  usaSupabase() { return !!(supabaseClient && currentUser); },
  chaveLocal(tabela) { return `vfnTabela_${tabela}`; },
  lerLocal(tabela) {
    try { return JSON.parse(localStorage.getItem(this.chaveLocal(tabela)) || "[]"); } catch (e) { return []; }
  },
  gravarLocal(tabela, linhas) {
    try { localStorage.setItem(this.chaveLocal(tabela), JSON.stringify(linhas)); } catch (e) { /* quota */ }
  },
  async listar(tabela) {
    if (!this.usaSupabase()) return this.lerLocal(tabela);
    const { data, error } = await supabaseClient.from(tabela).select("*");
    if (error) throw error;
    return data || [];
  },
  /** Insere ou atualiza pela chave primária `id` e devolve a linha gravada. */
  async guardar(tabela, linha) {
    const registo = { ...linha, id: linha.id || VFN.novoId() };
    if (!this.usaSupabase()) {
      const linhas = this.lerLocal(tabela).filter(l => String(l.id) !== String(registo.id));
      linhas.push(registo);
      this.gravarLocal(tabela, linhas);
      return registo;
    }
    const { data, error } = await supabaseClient.from(tabela).upsert(registo).select().single();
    if (error) throw error;
    return data;
  },
  async remover(tabela, id) {
    if (!this.usaSupabase()) {
      this.gravarLocal(tabela, this.lerLocal(tabela).filter(l => String(l.id) !== String(id)));
      return;
    }
    const { error } = await supabaseClient.from(tabela).delete().eq("id", id);
    if (error) throw error;
  }
};

function mensagemErro(e) {
  const msg = (e && (e.message || e.error_description)) || String(e);
  if (/row-level security|permission denied/i.test(msg)) return "Sem permissão para gravar. Confirma que o teu utilizador tem o papel 'admin' na tabela profiles (ver schema.sql).";
  if (/scorer_list|external_players/i.test(msg) && /does not exist|schema cache|could not find/i.test(msg)) return "Falta criar external_players / scorer_list no Supabase. Corre a secção ATUALIZAÇÃO v3 do schema.sql.";
  if (/match_date/i.test(msg) && /does not exist|schema cache|could not find/i.test(msg)) return "Falta a coluna match_date em league_results. Corre a secção ATUALIZAÇÃO 02/10/2026 do schema.sql.";
  if (/home_team_id|away_team_id|display_name|full_name|date_of_birth/i.test(msg) && /does not exist|schema cache|could not find/i.test(msg)) return "Falta uma coluna nova no Supabase. Corre a secção ATUALIZAÇÃO 30/09/2026 do schema.sql.";
  if (/violates not-null/i.test(msg)) return "O Supabase recusou: uma coluna obrigatória ficou vazia (" + msg + ").";
  if (/does not exist|schema cache/i.test(msg)) return "A tabela ainda não existe no Supabase. Corre o schema.sql no SQL Editor.";
  return msg;
}

async function removerJogadorSupabase(jogador) {
  if (!supabaseClient || !currentUser) return;
  const { error } = await supabaseClient.from("players").delete().eq("id", idJogadorBD(jogador));
  if (error) console.warn("Não foi possível remover o jogador no Supabase:", error.message);
}

/* =========================================================
   PERSISTÊNCIA — PLANTEL
   ========================================================= */

function migrarJogador(p) {
  const stats = p.stats || {};
  return {
    id: p.id,
    idBD: p.idBD || "",
    nome: p.nome || "", // nome curto (players.display_name)
    nomeCompleto: p.nomeCompleto || "", // players.full_name
    posicao: (p.posicao || "—").split("/").map(c => c.trim().toUpperCase() === "AV" ? "PL" : c).join("/"), // AV passou a PL
    subPosicao: p.subPosicao || "", // players.sub_posicao
    posicoesSecundarias: Array.isArray(p.posicoesSecundarias) ? p.posicoesSecundarias : [], // players.posicoes_secundarias
    numero: p.numero !== undefined && p.numero !== null ? p.numero : "",
    // os valores vindos do Supabase estão em players.stats com nomes curtos
    golos: Number(p.golos ?? stats.golos) || 0,
    assistencias: Number(p.assistencias ?? stats.assistencias) || 0,
    cartoesAmarelos: Number(p.cartoesAmarelos ?? stats.cartoesA) || 0,
    cartoesVermelhos: Number(p.cartoesVermelhos ?? stats.cartoesV) || 0,
    minutosTotais: Number(p.minutosTotais ?? stats.minutos) || 0,
    jogos: Number(p.jogos) || Number(stats.jogos) || 0,
    fotoUrl: p.fotoUrl || p.photo_url || "",
    nacionalidade: p.nacionalidade || stats.nacionalidade || "",
    nascimento: p.nascimento || stats.nascimento || "",
    pePreferencial: p.pePreferencial || stats.pePreferencial || "",
    disponibilidade: p.disponibilidade || "disponivel",
    email: p.email || "", // players.email: liga a conta do jogador (equipa.html)
    contaLigada: !!p.contaLigada, // players.auth_user_id preenchido
    altura: p.altura || stats.altura || "",
    peso: p.peso || stats.peso || "",
    notas: p.notas || stats.notas || "",
    attributes: p.attributes || {},
    stats: stats
  };
}

function carregarPlantel() {
  try {
    const raw = localStorage.getItem(PLANTEL_KEY);
    if (raw) {
      plantel = JSON.parse(raw).map(migrarJogador);
      return;
    }
  } catch (e) { /* ignora */ }
  plantel = PLANTEL_DEFAULT.map(p => ({ ...p }));
  guardarPlantel();
}

/** Devolve true se o plantel veio do Supabase (e passa a ser a fonte de verdade). */
async function carregarPlantelSupabase() {
  if (!supabaseClient || !currentUser) return false;
  // todos os jogadores da tabela, com os ids que lá estão (ex.: ids do zerozero)
  const { data, error } = await supabaseClient.from("players").select("*");
  if (error || !data || !data.length) return false;
  const usados = new Set();
  plantel = data.map((p, index) => {
    const texto = String(p.id);
    let id = /^\d+$/.test(texto) ? Number(texto) : Number(texto.split("-").pop()) || index + 1;
    while (usados.has(id)) id += 100000; // ids locais têm de ser únicos
    usados.add(id);
    if ("availability" in p) colunaDisponibilidade = true;
    if ("email" in p) colunaEmailConta = true;
    if ("sub_posicao" in p) colunaSubPosicao = true;
    return migrarJogador({ id, idBD: texto, disponibilidade: p.availability || "disponivel", email: p.email || "", contaLigada: !!p.auth_user_id, nome: p.display_name || p.name, nomeCompleto: p.full_name || "", nascimento: p.date_of_birth || "", posicao: p.position, subPosicao: p.sub_posicao || "", posicoesSecundarias: Array.isArray(p.posicoes_secundarias) ? p.posicoes_secundarias : [], numero: p.number, fotoUrl: p.photo_url, attributes: p.attributes, stats: p.stats });
  });
  try { localStorage.setItem(PLANTEL_KEY, JSON.stringify(plantel)); } catch (e) { /* ignora */ }
  return true;
}

function guardarPlantel() {
  try {
    localStorage.setItem(PLANTEL_KEY, JSON.stringify(plantel));
  } catch (e) { /* quota excedida - ignora silenciosamente */ }
  sincronizarPlantelSupabase();
}

function proximoIdPlantel() {
  const maxId = plantel.reduce((m, p) => Math.max(m, p.id), 0);
  return maxId + 1;
}

/* =========================================================
   PERSISTÊNCIA — RASCUNHO (localStorage + JSON exportável)
   ========================================================= */

function guardarRascunho() {
  const payload = { savedAt: new Date().toISOString(), data: state };
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
  } catch (e) {
    /* sem espaço no localStorage: fica só no Supabase */
  }
  sincronizarRascunhoSupabase();
  if (typeof guardarRelatorioDoJogo === "function") guardarRelatorioDoJogo(); // relatório ligado ao jogo (rascunho automático)
}

function lerRascunhoArmazenado() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.data) return parsed;
    return { savedAt: null, data: parsed }; // compatibilidade com formato antigo
  } catch (e) {
    return null;
  }
}

function existeRascunho() {
  return !!lerRascunhoArmazenado();
}

function aplicarDadosEstado(dados) {
  const base = estadoInicial();
  state = base;
  state.preJogo = Object.assign(base.preJogo, dados.preJogo || {});
  state.preJogo.competicao = VFN.normalizarCompeticao(state.preJogo.competicao); // rascunhos com o nome antigo
  state.preJogo.proximoJogo = Object.assign(base.preJogo.proximoJogo, dados.preJogo && dados.preJogo.proximoJogo || {});
  state.jogo = Object.assign(base.jogo, dados.jogo);
  state.jogo.eventos = (state.jogo.eventos || []).map(migrarEvento);
  delete state.jogo.coachpad; // CoachPad removido (v11)
  // rascunhos antigos: considera os eventos já refletidos no plantel para não os contar duas vezes
  if (!dados.jogo || !dados.jogo.statsAplicadas) state.jogo.statsAplicadas = contribuicaoDoJogo();
  state.analise = Object.assign(base.analise, dados.analise || {});
  if (Array.isArray(state.analise.positivos)) state.analise.positivos = state.analise.positivos.filter(Boolean).join("\n");
  if (Array.isArray(state.analise.aMelhorar)) state.analise.aMelhorar = state.analise.aMelhorar.filter(Boolean).join("\n");
  if (Array.isArray(state.analise.topicosTreino)) state.analise.topicosTreino = state.analise.topicosTreino.filter(Boolean).join("\n");
  if (dados.analise && dados.analise.seccoes) {
    state.analise.seccoes = Object.assign(base.analise.seccoes, dados.analise.seccoes);
  }
  migrarEstruturaRelatorio(state.analise);
  if (!Array.isArray(state.analise.situacoes)) state.analise.situacoes = [];
  state.relatorioId = dados.relatorioId || "";
  state.estadoRelatorio = dados.estadoRelatorio || dados._status || "draft";
}

/**
 * Relatórios anteriores à v9 (estrutura nova): "Pontos positivos" passam para a Síntese (se ainda
 * não houver síntese), "Pontos a melhorar" juntam-se aos Tópicos para o Treino (sem repetir linhas)
 * e as Notas individuais deixam de existir.
 */
function migrarEstruturaRelatorio(analise) {
  const linhas = t => String(t || "").split(/\n+/).map(x => x.trim()).filter(Boolean);
  if (typeof analise.sintese !== "string") analise.sintese = "";
  if (!analise.sintese.trim() && linhas(analise.positivos).length) analise.sintese = linhas(analise.positivos).join("\n");
  if (linhas(analise.aMelhorar).length) analise.topicosTreino = [...new Set([...linhas(analise.topicosTreino), ...linhas(analise.aMelhorar)])].join("\n");
  delete analise.positivos;
  delete analise.aMelhorar;
  delete analise.notasIndividuais;
}

function carregarRascunho() {
  const armazenado = lerRascunhoArmazenado();
  if (!armazenado) return false;
  try {
    aplicarDadosEstado(armazenado.data);
    return true;
  } catch (e) {
    return false;
  }
}

function limparRascunhoStorage() {
  localStorage.removeItem(DRAFT_KEY);
}

function formatarDataHora(iso) {
  if (!iso) return "data desconhecida";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-PT") + " às " + d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
  } catch (e) {
    return "data desconhecida";
  }
}

function exportarRascunhoJSON() {
  const nomeFicheiro = `rascunho_${sanitizarNomeFicheiro(state.preJogo.adversario)}_${state.preJogo.data || "sem-data"}.json`;
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  descarregarBlob(blob, nomeFicheiro);
}

function importarRascunhoJSON(file) {
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const dados = JSON.parse(ev.target.result);
      aplicarDadosEstado(dados);
      renderTudo();
      guardarRascunho();
      alert("Rascunho carregado com sucesso.");
    } catch (e) {
      alert("Não foi possível ler este ficheiro. Verifica se é um JSON de rascunho válido.");
    }
  };
  reader.readAsText(file);
}

function descarregarBlob(blob, nomeFicheiro) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeFicheiro;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* =========================================================
   HELPERS
   ========================================================= */

function el(id) { return document.getElementById(id); }

function criarOpcoesFormacao(select, comOutro) {
  select.innerHTML = "";
  (comOutro ? [...FORMACOES, "Outro"] : FORMACOES).forEach(f => {
    const opt = document.createElement("option");
    opt.value = f;
    opt.textContent = f;
    select.appendChild(opt);
  });
}

function jogadorPorId(id) {
  return plantel.find(p => p.id === Number(id));
}

function nomeJogador(id) {
  const j = jogadorPorId(id);
  return j ? j.nome : "";
}

/**
 * Constrói as <option> do plantel.
 * opts.onlyIds   -> restringe a lista a estes ids (mais o valor já selecionado)
 * opts.excludeIds -> remove estes ids da lista (mais o valor já selecionado, que nunca é removido)
 */
function opcoesJogadoresHTML(selecionadoId, opts) {
  opts = opts || {};
  const selNum = selecionadoId ? Number(selecionadoId) : null;
  let lista = [...plantel];

  if (opts.onlyIds) {
    const onlySet = new Set(opts.onlyIds.map(Number));
    lista = lista.filter(j => onlySet.has(j.id) || j.id === selNum);
  }
  if (opts.excludeIds) {
    const exSet = new Set(opts.excludeIds.map(Number));
    lista = lista.filter(j => !exSet.has(j.id) || j.id === selNum);
  }

  lista.sort((a, b) => a.nome.localeCompare(b.nome, "pt"));

  let html = '<option value="">— Selecionar —</option>';
  lista.forEach(j => {
    const sel = selNum === j.id ? "selected" : "";
    const numTag = j.numero ? `#${escapeHtml(j.numero)} ` : "";
    html += `<option value="${j.id}" ${sel}>${numTag}${escapeHtml(j.nome)} — ${escapeHtml(j.posicao)}</option>`;
  });
  return html;
}

function escapeHtml(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function uid() { return Date.now() + Math.floor(Math.random() * 1000); }

function sanitizarNomeFicheiro(str) {
  return String(str || "Adversario")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "Adversario";
}

/* =========================================================
   TABS
   ========================================================= */

function initTabs() {
  const botoes = document.querySelectorAll(".tab-btn");
  const titulos = { "pre-jogo": "Pré-Jogo", jogo: "Jogo", analise: "Análise", equipa: "Equipa", multas: "Multas", convocatoria: "Convocatória", presencas: "Presenças", calendario: "Calendário", resultados: "Resultados", jornadas: "Competições", historico: "Histórico de relatórios", classificacao: "Classificação", adversarios: "Adversários" };
  botoes.forEach(btn => {
    btn.addEventListener("click", () => {
      guardarRascunho(); // preserva dados sempre que se muda de separador
      botoes.forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      el("tab-" + btn.dataset.tab).classList.add("active");
      VFN.anim.seccao(el("tab-" + btn.dataset.tab)); // fade-in da secção
      el("currentSectionTitle").textContent = titulos[btn.dataset.tab] || btn.dataset.tab;
      el("appSidebar").classList.remove("is-open");
    });
  });
  VFN.initSidebar(el("appSidebar"), el("btnSidebarToggle"));
}

/* =========================================================
   TAB 1: PRÉ-JOGO
   ========================================================= */

function initPreJogo() {
  criarOpcoesFormacao(el("pjFormacaoPrevista"));

  el("pjJogo").addEventListener("change", e => {
    const jogo = jogosCalendario.find(j => String(j.id) === e.target.value);
    if (jogo) usarJogoNoRelatorio(jogo);
    else { state.preJogo.matchId = ""; renderPreJogo(); }
  });
  el("pjData").addEventListener("input", e => state.preJogo.data = e.target.value);
  el("pjCompeticao").addEventListener("change", e => { state.preJogo.competicao = e.target.value; });
  el("pjAdversario").addEventListener("change", e => escolherAdversario(e.target.value));
  el("pjFormacaoPrevista").addEventListener("change", e => state.preJogo.formacaoPrevista = e.target.value);
  el("pjNotasAdversario").addEventListener("input", e => state.preJogo.notasAdversario = e.target.value);
  el("pjLocal").addEventListener("input", e => state.preJogo.local = e.target.value);

  const grupoCasaFora = el("pjCasaFora");
  grupoCasaFora.querySelectorAll(".toggle-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      grupoCasaFora.querySelectorAll(".toggle-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      state.preJogo.casaFora = btn.dataset.value;
    });
  });
}

function renderPreJogo() {
  renderOpcoesPreJogo();
  el("pjData").value = state.preJogo.data;
  garantirOpcaoCompeticao(state.preJogo.competicao);
  el("pjCompeticao").value = state.preJogo.competicao;
  el("pjFormacaoPrevista").value = state.preJogo.formacaoPrevista;
  el("pjNotasAdversario").value = state.preJogo.notasAdversario;
  el("pjLocal").value = state.preJogo.local || "";

  const grupoCasaFora = el("pjCasaFora");
  grupoCasaFora.querySelectorAll(".toggle-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.value === state.preJogo.casaFora);
  });
  renderLiveSummary();
  renderProximoJogoPreJogo();
}

function renderLiveSummary() {
  const container = el("liveSummary");
  if (!container) return;
  container.innerHTML = `<h2 class="section-title">Resumo em tempo real</h2><div class="live-summary-row"><span>Resultado atual</span><strong>${state.jogo.golosVFN} — ${state.jogo.golosAdversario}</strong></div><div class="live-summary-row"><span>Formação</span><strong>${escapeHtml(state.jogo.formacaoVFN)}</strong></div><div class="live-summary-row"><span>Eventos</span><strong>${state.jogo.eventos.length}</strong></div>`;
}

/* ---- Próximo jogo: calculado a partir do calendário (tabela matches), só leitura ---- */

function equipaPorId(id) {
  return equipasCalendario.find(t => String(t.id) === String(id)) || null;
}

function logoEquipaHTML(equipa, nome) {
  const url = VFN.urlLogoEquipa(equipa, nome);
  const attr = equipa && equipa.id && !VFN.eVFN(equipa.name || nome) ? ` data-equipa="${escapeHtml(equipa.id)}" title="Ver ficha de ${escapeHtml(nome)}"` : "";
  if (url) return `<img class="team-logo" src="${escapeHtml(url)}" alt="Logótipo ${escapeHtml(nome)}"${attr}>`;
  const iniciais = String(nome || "?").split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join("").toUpperCase();
  return `<span class="team-logo-placeholder" aria-hidden="true"${attr}>${escapeHtml(iniciais)}</span>`;
}

function nomeAdversarioJogo(jogo) {
  const equipa = equipaPorId(jogo.opponent_team_id);
  return (equipa && equipa.name) || jogo.opponent || "Adversário";
}

/** Card "Jogo da Semana" no topo do Pré-Jogo (só redesenha quando o próximo jogo muda). */
function renderJogoSemanaAdmin() {
  const caixa = el("jogoSemanaAdmin");
  if (!caixa || !calendarioCarregado) return;
  const jogo = VFN.proximoJogo(jogosCalendario);
  const chave = jogo ? `${jogo.id}|${jogo.date}|${jogo.venue || ""}|${jogo.opponent_team_id}` : "";
  if (caixa.dataset.chave === chave && caixa.innerHTML) return;
  caixa.dataset.chave = chave;
  const dados = { matches: jogosCalendario, teams: equipasCalendario };
  caixa.innerHTML = VFNComp.renderJogoDaSemana(dados);
  VFNComp.ligarJogoDaSemana(caixa, dados);
}

function renderProximoJogoPreJogo() {
  renderJogoSemanaAdmin();
  const container = el("nextMatchBody");
  if (!container) return;
  renderOpcoesPreJogo(); // o calendário ou as equipas podem ter mudado
  atualizarEstatisticasEpoca();
  const jogo = VFN.proximoJogo(jogosCalendario);
  if (!jogo) {
    state.preJogo.proximoJogo = { data: "", adversario: "" };
    container.innerHTML = `<p class="empty-state">${calendarioCarregado ? "Sem jogos agendados no calendário." : "A carregar calendário…"}</p>`;
    return;
  }
  const adversario = nomeAdversarioJogo(jogo);
  const casa = VFN.jogoEmCasa(jogo);
  state.preJogo.proximoJogo = { data: VFN.dataIso(jogo.date), adversario };
  const vfn = `<div>${logoEquipaHTML({ logo_url: VFN.LOGO_VFN }, "VFN")}VFN</div>`;
  const adv = `<div>${logoEquipaHTML(equipaPorId(jogo.opponent_team_id), adversario)}${escapeHtml(adversario)}</div>`;
  const associado = state.preJogo.matchId === jogo.id;
  container.innerHTML = `
    <div class="next-match-teams">${casa ? vfn : adv}<span class="vs">vs</span>${casa ? adv : vfn}</div>
    <div class="next-match-meta">
      <span>${escapeHtml(VFN.dataLonga(jogo.date, true))}</span>
      <span>${VFNHub.tagCompeticao(jogo.competition)}${jogo.jornada ? ` · Jornada ${escapeHtml(jogo.jornada)}` : ""} · ${casa ? "Casa" : "Fora"}</span>
      <span>Faltam <span class="countdown">${escapeHtml(VFN.contagemDecrescente(jogo.date))}</span></span>
    </div>
    <button type="button" id="btnUsarProximoJogo" class="btn ${associado ? "btn-ghost" : "btn-accent"} btn-sm">${associado ? `${VFN.icone("check", 16)} Associado a este relatório` : "Usar dados deste jogo"}</button>
    <p class="readonly-note">Calculado automaticamente a partir do Calendário.</p>`;
  el("btnUsarProximoJogo").addEventListener("click", () => usarJogoNoRelatorio(jogo));
}

/* ---- Jornada e adversário escolhidos a partir do calendário e das equipas ---- */

function jogosSelecionaveis() {
  return jogosCalendario
    .filter(j => VFN.eJogoVFN(j) && VFN.estadoJogo(j) !== "cancelado")
    .sort((a, b) => (VFN.paraData(a.date) || 0) - (VFN.paraData(b.date) || 0));
}

function rotuloJogoPreJogo(j) {
  const comp = VFN.nomeCurtoCompeticao(j.competition);
  const inicio = j.jornada ? `J${j.jornada}` : comp;
  return `${inicio} · ${VFN.dataCurta(j.date)} · ${nomeAdversarioJogo(j)} (${VFN.jogoEmCasa(j) ? "Casa" : "Fora"})${j.jornada ? " · " + comp : ""}`;
}

function garantirOpcaoCompeticao(competicao) {
  const select = el("pjCompeticao");
  if (competicao && ![...select.options].some(o => o.value === competicao)) select.add(new Option(competicao, competicao));
}

function renderOpcoesPreJogo() {
  const jogos = jogosSelecionaveis();
  const vazio = !calendarioCarregado ? "A carregar…" : !jogos.length ? "Sem jogos no calendário" : state.preJogo.jornada && !state.preJogo.matchId ? `Jornada ${state.preJogo.jornada} (sem jogo associado)` : "— Escolher jogo —";
  const selJogo = el("pjJogo");
  selJogo.innerHTML = `<option value="">${escapeHtml(vazio)}</option>` + jogos.map(j => `<option value="${escapeHtml(j.id)}">${escapeHtml(rotuloJogoPreJogo(j))}</option>`).join("");
  selJogo.value = jogos.some(j => j.id === state.preJogo.matchId) ? state.preJogo.matchId : "";

  const equipas = equipasCalendario.filter(t => !VFN.eVFN(t.name)).sort((a, b) => a.name.localeCompare(b.name, "pt"));
  const atual = equipas.find(t => String(t.id) === String(state.preJogo.adversarioId)) || equipas.find(t => t.name === state.preJogo.adversario);
  let html = `<option value="">${calendarioCarregado ? "— Escolher adversário —" : "A carregar…"}</option>` + equipas.map(t => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.name)}</option>`).join("");
  // relatórios antigos com um adversário escrito à mão
  if (!atual && state.preJogo.adversario) html += `<option value="__livre">${escapeHtml(state.preJogo.adversario)}</option>`;
  const selAdv = el("pjAdversario");
  selAdv.innerHTML = html;
  selAdv.value = atual ? atual.id : (state.preJogo.adversario ? "__livre" : "");
  el("pjAdversarioLogo").innerHTML = atual ? logoEquipaHTML(atual, atual.name) : "";
}

/** Escolher o adversário associa o jogo com essa equipa (o próximo, ou o mais recente). */
function escolherAdversario(teamId) {
  const equipa = equipaPorId(teamId);
  if (!equipa) return;
  state.preJogo.adversario = equipa.name;
  state.preJogo.adversarioId = equipa.id;
  const contra = jogosSelecionaveis().filter(j => String(j.opponent_team_id) === String(equipa.id));
  const limite = Date.now() - 2 * 3600 * 1000;
  const jogo = contra.find(j => VFN.paraData(j.date) && VFN.paraData(j.date).getTime() >= limite) || contra[contra.length - 1];
  if (jogo && jogo.id !== state.preJogo.matchId) { usarJogoNoRelatorio(jogo); return; }
  if (!jogo) state.preJogo.matchId = "";
  renderPreJogo();
  guardarRascunho();
}

function usarJogoNoRelatorio(jogo) {
  if (jogo.id !== state.preJogo.matchId) {
    // outro jogo: se já tem relatório, abre-o; senão começa um rascunho novo
    const existente = typeof relatorioDoJogoAdmin === "function" && relatorioDoJogoAdmin(jogo.id);
    if (existente && confirm("Este jogo já tem um relatório. Abrir esse relatório?")) { abrirRelatorioDoJogo(jogo.id); return; }
    state.relatorioId = "";
    state.estadoRelatorio = "draft";
  }
  state.preJogo.matchId = jogo.id;
  state.preJogo.jornada = jogo.jornada != null ? String(jogo.jornada) : "";
  state.preJogo.data = VFN.dataIso(jogo.date);
  if (jogo.competition) state.preJogo.competicao = jogo.competition;
  state.preJogo.casaFora = VFN.jogoEmCasa(jogo) ? "Casa" : "Fora";
  state.preJogo.adversario = nomeAdversarioJogo(jogo);
  state.preJogo.adversarioId = jogo.opponent_team_id || "";
  if (jogo.venue) state.preJogo.local = jogo.venue;
  renderPreJogo();
  guardarRascunho();
}

/**
 * Marcadores do VFN neste jogo, no formato de league_results.scorer_list
 * ([{ player_id, player_name, team_id, count }]): ficam públicos em matches.scorer_list
 * para os marcadores por competição (os relatórios não são públicos).
 */
function marcadoresDoJogo() {
  const idVFN = String(VFN.equipaVFN(equipasCalendario).id);
  const porJogador = new Map();
  state.jogo.eventos.filter(ev => ev.equipa === "VFN" && ev.tipo === "Golo" && ev.jogadorId).forEach(ev => {
    const j = jogadorPorId(ev.jogadorId);
    const id = j ? idJogadorBD(j) : String(ev.jogadorId);
    const atual = porJogador.get(id) || { team: "vfn", player_id: id, player_name: j ? j.nome : nomeJogador(ev.jogadorId), team_id: idVFN, count: 0 };
    atual.count++;
    porJogador.set(id, atual);
  });
  return [...porJogador.values()];
}

/** Ao gerar (ou publicar) o relatório, grava o resultado e os marcadores no jogo do calendário associado. */
async function registarResultadoNoCalendario() {
  const jogo = jogosCalendario.find(j => j.id === state.preJogo.matchId);
  if (!jogo) return;
  const casa = VFN.jogoEmCasa(jogo);
  const atualizado = {
    ...jogo,
    status: "jogado",
    score_home: casa ? state.jogo.golosVFN : state.jogo.golosAdversario,
    score_away: casa ? state.jogo.golosAdversario : state.jogo.golosVFN
  };
  // os marcadores do relatório só substituem os lançados à mão no jogo quando o relatório os tem
  // (ou o VFN não marcou); um relatório sem os golos registados não apaga a lista.
  // Os golos do adversário lançados no jogo (team = "adversario") mantêm-se sempre.
  const marcadores = marcadoresDoJogo();
  const golosAdversario = (Array.isArray(jogo.scorer_list) ? jogo.scorer_list : []).filter(VFN.eGoloAdversario);
  if (marcadores.length || Number(state.jogo.golosVFN) === 0) atualizado.scorer_list = [...marcadores, ...golosAdversario];
  try {
    let gravado;
    try {
      gravado = await dadosClube.guardar("matches", atualizado);
    } catch (e) {
      if (!/scorer_list/i.test(e.message || "")) throw e; // antes do SQL de 03/10
      delete atualizado.scorer_list;
      gravado = await dadosClube.guardar("matches", atualizado);
    }
    jogosCalendario = jogosCalendario.map(j => j.id === gravado.id ? gravado : j);
    renderProximoJogoPreJogo();
    if (typeof renderCalendarioAdmin === "function") renderCalendarioAdmin();
    if (typeof renderResultados === "function") renderResultados();
  } catch (e) {
    console.warn("Não foi possível registar o resultado no calendário:", mensagemErro(e));
  }
}

let jogosCalendario = [];
let equipasCalendario = [];
let resultadosLiga = []; // league_results: jogos entre outras equipas (Jornadas AF Guarda)
let relatoriosAdmin = []; // match_reports (eventos para o detalhe do jogo)
let calendarioCarregado = false;

async function carregarCalendario() {
  if (!calendarioCarregado && window.VFNHub) {
    // skeletons até chegarem os jogos, resultados e relatórios
    [["calendarioBody", "", 6], ["resultadosLista", "resultados", 5], ["jornadasTabela", "tabela", 8], ["jornadasLista", "resultados", 6], ["classificacaoTabela", "tabela", 8], ["historicoBody", "", 5]]
      .forEach(([id, tipo, n]) => VFNHub.mostrarEsqueleto(id, tipo, n));
  }
  try {
    [jogosCalendario, equipasCalendario] = await Promise.all([dadosClube.listar("matches"), dadosClube.listar("teams")]);
    jogosCalendario = VFN.normalizarLinhas(jogosCalendario); // nomes antigos da competição → nome oficial
  } catch (e) {
    console.warn("Não foi possível carregar o calendário:", e.message || e);
  }
  try {
    resultadosLiga = VFN.normalizarLinhas(await dadosClube.listar("league_results"));
  } catch (e) {
    resultadosLiga = [];
    console.warn("league_results indisponível (corre a atualização de 01/10 do schema.sql):", e.message || e);
  }
  try { relatoriosAdmin = await dadosClube.listar("match_reports"); } catch (e) { relatoriosAdmin = []; }
  calendarioCarregado = true;
  renderProximoJogoPreJogo();
  if (typeof renderCalendarioAdmin === "function") renderCalendarioAdmin();
  if (typeof renderResultados === "function") { renderResultados(); renderClassificacaoAdmin(); renderJornadasAdmin(); }
}

/* =========================================================
   TAB 2: JOGO
   ========================================================= */

function initJogo() {
  criarOpcoesFormacao(el("jgFormacaoVFN"));
  criarOpcoesFormacao(el("jgFormacaoAdv"), true);

  el("jgFormacaoVFN").addEventListener("change", e => {
    state.jogo.formacaoVFN = e.target.value;
    renderPitch();
    renderTitulares();
  });
  el("jgCapitao").addEventListener("change", e => {
    state.jogo.capitaoManual = !!e.target.value; // vazio volta ao automático
    state.jogo.capitaoId = e.target.value ? Number(e.target.value) : null;
    renderCapitao();
    renderPitch();
    renderTitulares();
  });
  el("jgFormacaoAdv").addEventListener("change", e => {
    state.jogo.formacaoAdversario = e.target.value;
    renderFormacaoAdversarioOutro();
    if (e.target.value === "Outro") el("jgFormacaoAdvOutro").focus();
  });
  el("jgFormacaoAdvOutro").addEventListener("input", e => state.jogo.formacaoAdversarioOutro = e.target.value);

  el("btnAddEvento").addEventListener("click", () => {
    state.jogo.eventos.push({ id: uid(), minuto: 0, acrescimo: "", equipa: "VFN", tipo: "Golo", jogadorId: "", jogadorSaiId: "", assistId: "", detalhe: "" });
    renderEventos(true);
  });
  el("btnOrdenarEventos").addEventListener("click", () => renderEventos(true));
}

function formacaoAdversarioTexto() {
  if (state.jogo.formacaoAdversario !== "Outro") return state.jogo.formacaoAdversario;
  return state.jogo.formacaoAdversarioOutro.trim() || "Outro";
}

function renderFormacaoAdversarioOutro() {
  const input = el("jgFormacaoAdvOutro");
  input.hidden = state.jogo.formacaoAdversario !== "Outro";
  input.value = state.jogo.formacaoAdversarioOutro || "";
}

/* ---- Onze inicial / suplentes: exclusividade de jogadores ---- */

function idsUsadosExcluindo(valorAtual) {
  const usados = [];
  state.jogo.titulares.forEach(id => { if (id) usados.push(Number(id)); });
  state.jogo.suplentes.forEach(id => { if (id) usados.push(Number(id)); });
  const valorNum = valorAtual ? Number(valorAtual) : null;
  return usados.filter(id => id !== valorNum);
}

/* Campo visual — apenas decorativo, reflete os dropdowns */
/*
 * Campo do onze (estilo Football Manager): camisolas vazias nas posições da formação escolhida;
 * os jogadores arrastam-se da lista para as posições (VFNComp.ligarArrastar), entre posições
 * (troca) e de volta para a lista (sai do onze). Escreve em state.jogo.titulares, como os menus.
 */
function renderPitch() {
  atualizarCapitao();
  const pitch = el("pitch");
  const slots = FORMACOES_SLOTS[state.jogo.formacaoVFN] || FORMACOES_SLOTS["4-3-3"];
  pitch.innerHTML = slots.map((slot, idx) => {
    const jogadorId = state.jogo.titulares[idx];
    const j = jogadorId && jogadorPorId(jogadorId);
    const nome = j ? j.nome : "";
    return `<div class="pitch-slot${jogadorId ? "" : " empty"}" style="left:${slot.x}%;top:${slot.y}%" data-alvo="s:${idx}"${jogadorId ? ` data-arrasta="s:${idx}"` : ""} tabindex="0" title="${escapeHtml(slot.label + (nome ? " · " + nome : " (vazia)"))}">
      <span class="slot-camisola">${VFN.generateJerseyAvatar(j ? j.numero : "")}</span>
      <span class="slot-label">${escapeHtml(slot.label)}</span>
      ${jogadorId ? `<span class="slot-name">${escapeHtml(nome.split(" ")[0])}</span>${eCapitao(jogadorId) ? VFN.badgeCapitao("no-campo") : ""}` : ""}
    </div>`;
  }).join("");
  renderPitchJogadores();
  if (window.VFNComp) VFNComp.ligarArrastar(el("pitchArrastar"), largarNoCampo);
}

/** Jogadores que ainda não estão no onze (para arrastar para o campo); os suplentes primeiro. */
function renderPitchJogadores() {
  const lista = el("pitchJogadores");
  if (!lista) return;
  const noOnze = new Set(titularesIds());
  const suplentes = new Set(suplentesIds());
  const livres = VFN.ordenarPorPosicao(plantel.filter(p => !noOnze.has(p.id)))
    .sort((a, b) => suplentes.has(b.id) - suplentes.has(a.id));
  lista.innerHTML = livres.length
    ? livres.map(p => `<span class="pitch-chip${suplentes.has(p.id) ? " suplente" : ""}" data-arrasta="j:${p.id}" tabindex="0" title="${escapeHtml(p.nome)} · ${escapeHtml(p.posicao || "")}">${p.numero ? `<b>${escapeHtml(p.numero)}</b>` : ""}${escapeHtml(p.nome)}<small>${escapeHtml(String(p.posicao || "").split("/")[0])}${suplentes.has(p.id) ? " · sup." : ""}</small></span>`).join("")
    : '<span class="muted">Todo o plantel está no onze.</span>';
}

/** Largar no campo: lista → posição (sai dos suplentes), posição ↔ posição (troca), posição → lista (sai do onze). */
function largarNoCampo(origem, destino) {
  if (!destino) return;
  const [tipo, valor] = origem.split(/:(.+)/);
  const titulares = state.jogo.titulares;
  if (destino === "lista") {
    if (tipo === "s") titulares[Number(valor)] = null;
  } else {
    const i = Number(destino.slice(2));
    if (tipo === "s") {
      const a = Number(valor);
      [titulares[a], titulares[i]] = [titulares[i] || null, titulares[a]];
    } else {
      const id = Number(valor);
      titulares.forEach((t, k) => { if (Number(t) === id) titulares[k] = null; });
      state.jogo.suplentes = state.jogo.suplentes.map(s => Number(s) === id ? null : s);
      titulares[i] = id;
    }
  }
  renderCapitao();
  renderPitch();
  renderTitulares();
  renderBench();
  renderEventos(false);
}

/* ---- Capitão ---- */

/** Atualiza o capitão: o escolhido à mão (se continuar no onze) ou o primeiro titular da lista de prioridade disponível. */
function atualizarCapitao() {
  const titulares = titularesIds();
  if (state.jogo.capitaoManual && titulares.includes(Number(state.jogo.capitaoId))) return;
  state.jogo.capitaoManual = false;
  const porBD = new Map(titulares.map(id => [idJogadorBD(plantel.find(p => p.id === id) || { id }), id]));
  const escolhido = VFN.capitaoAutomatico([...porBD.keys()], { estado: idBD => (jogadorPorIdBD(idBD) || {}).disponibilidade || "" });
  state.jogo.capitaoId = escolhido ? porBD.get(escolhido) : null;
}

function eCapitao(id) {
  return !!id && Number(id) === Number(state.jogo.capitaoId);
}

function renderCapitao() {
  const select = el("jgCapitao");
  if (!select) return;
  atualizarCapitao();
  select.innerHTML = '<option value="">Automático</option>' + titularesIds().map(id => `<option value="${id}" ${state.jogo.capitaoManual && eCapitao(id) ? "selected" : ""}>${escapeHtml(nomeJogador(id))}</option>`).join("");
  el("jgCapitaoAtual").innerHTML = state.jogo.capitaoId ? `${VFN.badgeCapitao()} ${escapeHtml(nomeJogador(state.jogo.capitaoId))}${state.jogo.capitaoManual ? "" : " <small class=\"muted\">(automático)</small>"}` : '<span class="muted">Sem capitão da lista no onze — escolhe um.</span>';
}

/* Lista de dropdowns dos titulares — é aqui que o onze é realmente definido */
function renderTitulares() {
  const container = el("titularesList");
  container.innerHTML = "";
  const slots = FORMACOES_SLOTS[state.jogo.formacaoVFN] || FORMACOES_SLOTS["4-3-3"];

  slots.forEach((slot, idx) => {
    const row = document.createElement("div");
    row.className = "lineup-row";

    const label = document.createElement("span");
    label.className = "lineup-label";
    label.textContent = (idx + 1) + ". " + slot.label;
    if (eCapitao(state.jogo.titulares[idx])) label.insertAdjacentHTML("beforeend", " " + VFN.badgeCapitao());

    const valorAtual = state.jogo.titulares[idx];
    const select = document.createElement("select");
    select.innerHTML = opcoesJogadoresHTML(valorAtual, { excludeIds: idsUsadosExcluindo(valorAtual) });
    select.addEventListener("change", () => {
      state.jogo.titulares[idx] = select.value ? Number(select.value) : null;
      renderCapitao();
      renderPitch();
      renderTitulares();
      renderBench();
      renderEventos(false);
    });

    row.appendChild(label);
    row.appendChild(select);
    container.appendChild(row);
  });
}

function renderBench() {
  const container = el("benchList");
  container.innerHTML = "";
  for (let i = 0; i < 7; i++) {
    const row = document.createElement("div");
    row.className = "lineup-row";

    const label = document.createElement("span");
    label.className = "lineup-label";
    label.textContent = "Sup. " + (i + 1);

    const valorAtual = state.jogo.suplentes[i];
    const select = document.createElement("select");
    select.innerHTML = opcoesJogadoresHTML(valorAtual, { excludeIds: idsUsadosExcluindo(valorAtual) });
    select.addEventListener("change", () => {
      state.jogo.suplentes[i] = select.value ? Number(select.value) : null;
      renderBench();
      renderTitulares();
      renderPitchJogadores();
      renderEventos(false);
    });

    row.appendChild(label);
    row.appendChild(select);
    container.appendChild(row);
  }
}

/* ---- Eventos do jogo ---- */

function titularesIds() {
  return state.jogo.titulares.filter(id => id).map(Number);
}

function suplentesIds() {
  return state.jogo.suplentes.filter(id => id).map(Number);
}

function jaSairam(excludeEventId) {
  const set = new Set();
  state.jogo.eventos.forEach(e => {
    if (e.equipa === "VFN" && e.tipo === "Substituição" && e.id !== excludeEventId && e.jogadorSaiId) set.add(Number(e.jogadorSaiId));
  });
  return set;
}

function jaEntraram(excludeEventId) {
  const set = new Set();
  state.jogo.eventos.forEach(e => {
    if (e.equipa === "VFN" && e.tipo === "Substituição" && e.id !== excludeEventId && e.jogadorId) set.add(Number(e.jogadorId));
  });
  return set;
}

/** Jogadores em campo: titulares + os que entraram, menos os que já saíram. */
function jogadoresEmCampo(excludeEventId) {
  const saidos = jaSairam(excludeEventId);
  const ids = new Set([...titularesIds(), ...jaEntraram(excludeEventId)]);
  return [...ids].filter(id => !saidos.has(id));
}

/** Mantido por compatibilidade com código antigo. */
function titularesEmCampo(excludeEventId) {
  return jogadoresEmCampo(excludeEventId);
}

/**
 * Cartões: quem está em campo, quem já foi substituído e os suplentes convocados
 * (um jogador substituído ou no banco pode ver cartão).
 */
function jogadoresParaCartao(excludeEventId) {
  return [...new Set([...jogadoresEmCampo(excludeEventId), ...jaSairam(excludeEventId), ...suplentesIds()])];
}

function bancoDisponivel(excludeEventId) {
  const titulares = new Set(titularesIds());
  const entrados = jaEntraram(excludeEventId);
  return plantel.filter(p => !titulares.has(p.id) && !entrados.has(p.id)).map(p => p.id);
}

function migrarEvento(evento) {
  const ev = { ...evento };
  ev.id = ev.id || uid();
  ev.equipa = ev.equipa === "Adversário" ? "Adversário" : ev.equipa === "" ? "" : "VFN"; // "" = sem equipa
  if (ev.tipo === "Substituição — Entra") ev.tipo = "Substituição";
  if (ev.tipo === "Substituição — Sai") ev.tipo = "Substituição";
  ev.detalhe = ev.detalhe || ev.nota || "";
  ev.jogadorId = ev.jogadorId || "";
  ev.jogadorSaiId = ev.jogadorSaiId || "";
  // formato gravado no match_data dos golos: { marcador, assistencia }
  ev.jogadorId = ev.jogadorId || ev.marcador || "";
  ev.assistId = ev.assistId || ev.assistencia || "";
  ev.acrescimo = ev.acrescimo || "";
  return ev;
}

function eventoJogadorId(ev) {
  return ev.jogadorId;
}

/** "45+2'" quando há tempo acrescentado, senão "45'". */
function formatarMinuto(ev) {
  const acrescimo = Number(ev.acrescimo) || 0;
  return `${Number(ev.minuto) || 0}${acrescimo > 0 ? "+" + acrescimo : ""}'`;
}

function compararEventos(a, b) {
  return (Number(a.minuto) || 0) - (Number(b.minuto) || 0) || (Number(a.acrescimo) || 0) - (Number(b.acrescimo) || 0);
}

function nomeOuDetalheEvento(ev) {
  if (ev.tipo === "Substituição") return `${nomeJogador(ev.jogadorSaiId) || "—"} sai / ${nomeJogador(ev.jogadorId) || "—"} entra`;
  if (ev.equipa !== "VFN") return ev.detalhe || "—";
  const nome = nomeJogador(eventoJogadorId(ev)) || ev.detalhe || "—";
  return ev.tipo === "Golo" && ev.assistId ? `${nome} (assist. ${nomeJogador(ev.assistId)})` : nome;
}

/*
 * Linha do tempo do jogo: uma linha por parte (1.ª: 0'–45'+, 2.ª: 45'–90'+), com o VFN por cima e o
 * adversário por baixo. Ícones que ficariam a menos de ESPACO_TIMELINE_PX do anterior passam para
 * uma faixa seguinte (mais acima / mais abaixo) em vez de se sobreporem.
 */
const ESPACO_TIMELINE_PX = 38;
let larguraTimeline = 0;

function renderTimeline() {
  const container = el("matchTimeline");
  if (!container) return;
  if (!container.dataset.observado && window.ResizeObserver) {
    // a largura decide as faixas: volta a desenhar quando a largura muda
    container.dataset.observado = "1";
    new ResizeObserver(() => { if (container.clientWidth && container.clientWidth !== larguraTimeline) renderTimeline(); }).observe(container);
  }
  larguraTimeline = container.clientWidth;
  const pista = Math.max(200, (larguraTimeline || 700) - 110); // largura da linha (sem o rótulo da parte)
  const eventos = [...state.jogo.eventos].sort(compararEventos);
  const tempo = ev => (Number(ev.minuto) || 0) + (Number(ev.acrescimo) || 0);
  const partes = [
    { nome: "1.ª parte", inicio: 0, fim: 45, eventos: eventos.filter(ev => (Number(ev.minuto) || 0) <= 45) },
    { nome: "2.ª parte", inicio: 45, fim: 90, eventos: eventos.filter(ev => (Number(ev.minuto) || 0) > 45) }
  ];
  container.innerHTML = partes.map(p => {
    const fim = Math.max(p.fim, ...p.eventos.map(tempo)); // tempo de compensação alarga a escala
    const x = ev => Math.min(100, Math.max(0, (tempo(ev) - p.inicio) / (fim - p.inicio) * 100));
    // faixa de cada evento, por lado: a primeira onde não fica colado ao anterior
    const faixas = new Map();
    const contagem = {};
    ["vfn", "adv"].forEach(lado => {
      const ultimos = [];
      p.eventos.filter(ev => (ev.equipa === "VFN" ? "vfn" : ev.equipa ? "adv" : "neutro") === lado).forEach(ev => {
        const px = x(ev) / 100 * pista;
        let f = ultimos.findIndex(u => px - u >= ESPACO_TIMELINE_PX);
        if (f < 0) { f = ultimos.length; ultimos.push(px); } else ultimos[f] = px;
        faixas.set(ev, f);
      });
      contagem[lado] = Math.max(1, ultimos.length);
    });
    const marcadores = p.eventos.map(ev => {
      const lado = ev.equipa === "VFN" ? "vfn" : ev.equipa ? "adv" : "neutro";
      return `<div class="timeline-event ${lado}" data-type="${escapeHtml(ev.tipo)}" style="left:${x(ev)}%;--faixa:${faixas.get(ev) || 0}" title="${escapeHtml(`${formatarMinuto(ev)} ${ev.tipo} — ${nomeOuDetalheEvento(ev)}`)}">${VFN.iconeEvento(ev.tipo, 22)}<span>${escapeHtml(formatarMinuto(ev))}</span></div>`;
    }).join("");
    return `<div class="tl-parte">
      <div class="tl-rotulo">${p.nome}<small>${p.inicio}'–${p.fim}'${fim > p.fim ? "+" + (fim - p.fim) : ""}</small></div>
      <div class="tl-pista" style="--cima:${contagem.vfn};--baixo:${contagem.adv}">
        <span class="tl-linha" aria-hidden="true"></span>${marcadores}
      </div>
    </div>`;
  }).join("");
}

function calcularResultadoEventos(limite) {
  const resultado = { vfn: 0, adv: 0 };
  state.jogo.eventos.forEach(ev => {
    if ((Number(ev.minuto) || 0) > limite || ev.tipo !== "Golo" && ev.tipo !== "Auto-golo") return;
    if (ev.tipo === "Auto-golo") {
      ev.equipa === "VFN" ? resultado.adv++ : resultado.vfn++;
    } else {
      ev.equipa === "VFN" ? resultado.vfn++ : resultado.adv++;
    }
  });
  return resultado;
}

function renderResultadoParcial() {
  const elResultado = el("halfTimeScore");
  if (elResultado) elResultado.textContent = `Resultado ao intervalo (eventos registados até 45'+): ${calcularResultadoEventos(45).vfn} - ${calcularResultadoEventos(45).adv}`;
}

function calcularResultadoFinal() {
  return calcularResultadoEventos(90);
}

function atualizarScoreboard() {
  const final = calcularResultadoFinal();
  const intervalo = calcularResultadoEventos(45);
  state.jogo.golosVFN = final.vfn;
  state.jogo.golosAdversario = final.adv;
  el("scoreboardScore").textContent = `${final.vfn} — ${final.adv}`;
  el("scoreboardHalf").textContent = `Intervalo: ${intervalo.vfn} — ${intervalo.adv}`;
}

/* ---- Estatísticas dos jogadores atualizadas automaticamente pelos eventos ---- */

const CAMPOS_STATS_JOGO = ["golos", "assistencias", "cartoesAmarelos", "cartoesVermelhos", "jogos", "minutosTotais"];

/**
 * Contribuição deste jogo para as estatísticas de cada jogador.
 * Golos, assistências e cartões contam logo; jogos e minutos só depois
 * de gerar o relatório (o onze pode mudar até lá).
 */
function contribuicaoDoJogo() {
  const contribuicao = {};
  const somar = (id, campo, valor) => {
    if (!id) return;
    const registo = contribuicao[id] || (contribuicao[id] = {});
    registo[campo] = (registo[campo] || 0) + (valor == null ? 1 : valor);
  };
  state.jogo.eventos.forEach(ev => {
    if (ev.equipa !== "VFN") return;
    if (ev.tipo === "Golo") { somar(ev.jogadorId, "golos"); somar(ev.assistId, "assistencias"); }
    else if (ev.tipo === "Cartão Amarelo") somar(ev.jogadorId, "cartoesAmarelos");
    else if (ev.tipo === "Cartão Vermelho") somar(ev.jogadorId, "cartoesVermelhos");
  });
  // jogos e minutos só contam nas competições oficiais (amigáveis de fora: VFN.competicaoOficial).
  // Um amigável já somado antes desta regra sai dos totais quando o relatório volta a ser gerado.
  if (state.jogo.presencasAplicadas && VFN.competicaoOficial(state.preJogo.competicao)) {
    calcularMinutosJogadores().forEach(m => { somar(m.id, "jogos", 1); somar(m.id, "minutosTotais", m.minutos); });
  }
  return contribuicao;
}

/** Aplica ao plantel apenas a diferença face ao que já estava somado (idempotente). */
function sincronizarStatsJogadores() {
  const nova = contribuicaoDoJogo();
  const anterior = state.jogo.statsAplicadas || {};
  let mudou = false;
  new Set([...Object.keys(nova), ...Object.keys(anterior)]).forEach(id => {
    const jogador = jogadorPorId(id);
    if (!jogador) return;
    CAMPOS_STATS_JOGO.forEach(campo => {
      const delta = ((nova[id] || {})[campo] || 0) - ((anterior[id] || {})[campo] || 0);
      if (!delta) return;
      jogador[campo] = Math.max(0, (Number(jogador[campo]) || 0) + delta);
      mudou = true;
    });
  });
  state.jogo.statsAplicadas = nova;
  if (atualizarCombinacoes()) mudou = true;
  if (!mudou) return;
  try { localStorage.setItem(PLANTEL_KEY, JSON.stringify(plantel)); } catch (e) { /* ignora */ }
  sincronizarPlantelDiferido();
  if (el("plantelBody")) renderPlantel();
}

/*
 * Combinações golo–assistência (preparação para uma versão futura; ainda sem UI).
 * Cada golo do VFN com assistId conta para o par (marcador, assistente). O resultado fica em
 * players.stats.combinacoes de cada jogador envolvido: [{ marcadorId, assistenteId, count }], com os
 * ids da tabela players. É recalculado de raiz a partir de todos os relatórios sempre que as stats são
 * recalculadas (relatório aberto incluído), por isso não acumula erros. Conta os relatórios que já
 * contaram para as stats (gerados ou publicados), um por jogo. players.stats é jsonb: sem alteração de
 * schema (a view players_equipa não expõe este campo aos jogadores; acrescentar lá quando houver UI).
 */
function calcularCombinacoes() {
  const contou = md => !!md && !!md.jogo && (md.jogo.presencasAplicadas || (md._status || md.estadoRelatorio) === "published");
  const porJogo = new Map();
  relatoriosAdmin.forEach(r => {
    const md = r.match_data || {};
    const chave = String((md.preJogo || {}).matchId || r.match_id || "r:" + r.id);
    if (String(r.id) !== String(state.relatorioId) && (contou(md) || VFN.estadoRelatorio(r) === "published")) porJogo.set(chave, md);
  });
  // o relatório aberto substitui a versão gravada do mesmo jogo
  const chaveAtual = String(state.preJogo.matchId || "r:" + (state.relatorioId || "atual"));
  if (contou(state)) porJogo.set(chaveAtual, state); else porJogo.delete(chaveAtual);
  const idBD = idLocal => { const j = jogadorPorId(idLocal); return j ? idJogadorBD(j) : String(idLocal); };
  const contagem = new Map();
  porJogo.forEach(md => (md.jogo.eventos || [])
    .filter(e => e.equipa === "VFN" && e.tipo === "Golo" && e.jogadorId && e.assistId && String(e.jogadorId) !== String(e.assistId))
    .forEach(e => { const chave = `${idBD(e.jogadorId)}|${idBD(e.assistId)}`; contagem.set(chave, (contagem.get(chave) || 0) + 1); }));
  return [...contagem].map(([chave, count]) => { const [marcadorId, assistenteId] = chave.split("|"); return { marcadorId, assistenteId, count }; })
    .sort((a, b) => b.count - a.count || a.marcadorId.localeCompare(b.marcadorId));
}

/** Atualiza players.stats.combinacoes de cada jogador (só os pares em que entra). true se algo mudou. */
function atualizarCombinacoes() {
  if (!calendarioCarregado) return false; // sem os relatórios carregados apagaria as combinações dos outros jogos
  const todas = calcularCombinacoes();
  let mudou = false;
  plantel.forEach(p => {
    const id = idJogadorBD(p);
    const minhas = todas.filter(c => c.marcadorId === id || c.assistenteId === id);
    if (JSON.stringify((p.stats || {}).combinacoes || []) === JSON.stringify(minhas)) return;
    p.stats = { ...(p.stats || {}), combinacoes: minhas };
    mudou = true;
  });
  return mudou;
}

/** Golos do VFN guardam também { marcador: id, assistencia: id | null } no match_data. */
function normalizarGolos() {
  state.jogo.eventos.forEach(ev => {
    if (ev.equipa === "VFN" && ev.tipo === "Golo") {
      ev.marcador = ev.jogadorId || null;
      ev.assistencia = ev.assistId || null;
    } else {
      delete ev.marcador;
      delete ev.assistencia;
    }
  });
}

/** Convocados: onze inicial + suplentes. */
function convocadosIds() {
  return [...new Set([...titularesIds(), ...suplentesIds()])];
}

function atualizarIndicadoresJogo() {
  normalizarGolos();
  el("eventCountBadge").textContent = state.jogo.eventos.length;
  renderTimeline();
  renderResultadoParcial();
  atualizarScoreboard();
  sincronizarStatsJogadores();
  renderLiveSummary();
  if (el("analysisSummary")) renderAnalysisSummary();
}

function criarSelectJogador(valor, ids, titulo, aoMudar) {
  const select = document.createElement("select");
  select.title = titulo;
  select.innerHTML = opcoesJogadoresHTML(valor, { onlyIds: ids });
  select.addEventListener("change", () => aoMudar(select.value ? Number(select.value) : ""));
  return select;
}

function renderEventos(ordenar) {
  if (ordenar) state.jogo.eventos.sort(compararEventos);
  const tbody = el("eventsBody");
  tbody.innerHTML = "";

  state.jogo.eventos.forEach(ev => {
    const tr = document.createElement("tr");
    const tdMin = document.createElement("td");
    const minutoWrap = document.createElement("div");
    minutoWrap.className = "minute-cell";
    const inputMin = document.createElement("input");
    inputMin.type = "number"; inputMin.min = "0"; inputMin.max = "90"; inputMin.value = ev.minuto; inputMin.title = "Minuto"; inputMin.setAttribute("aria-label", "Minuto");
    inputMin.addEventListener("change", () => { ev.minuto = Number(inputMin.value) || 0; renderTimeline(); renderResultadoParcial(); atualizarScoreboard(); });
    const mais = document.createElement("span");
    mais.className = "minute-plus"; mais.textContent = "+";
    const inputAcr = document.createElement("input");
    inputAcr.type = "number"; inputAcr.min = "0"; inputAcr.max = "30"; inputAcr.placeholder = "X"; inputAcr.value = ev.acrescimo || "";
    inputAcr.title = "Tempo adicionado (+X min)"; inputAcr.setAttribute("aria-label", "Tempo adicionado em minutos");
    inputAcr.addEventListener("change", () => { const v = Number(inputAcr.value) || 0; ev.acrescimo = v > 0 ? v : ""; inputAcr.value = ev.acrescimo; renderTimeline(); });
    minutoWrap.append(inputMin, mais, inputAcr);
    tdMin.appendChild(minutoWrap);

    const tdEquipa = document.createElement("td");
    const selectEquipa = document.createElement("select");
    selectEquipa.setAttribute("aria-label", "Equipa (opcional)");
    selectEquipa.innerHTML = [["VFN", "VFN"], ["Adversário", "Adversário"], ["", "— Sem equipa —"]].map(([v, t]) => `<option value="${v}" ${v === ev.equipa ? "selected" : ""}>${t}</option>`).join("");
    selectEquipa.addEventListener("change", () => { ev.equipa = selectEquipa.value; ev.jogadorId = ""; ev.jogadorSaiId = ""; ev.assistId = ""; renderEventos(false); });
    tdEquipa.appendChild(selectEquipa);

    const tdTipo = document.createElement("td");
    const selectTipo = document.createElement("select");
    selectTipo.innerHTML = TIPOS_EVENTO.map(t => `<option value="${t}" ${t === ev.tipo ? "selected" : ""}>${t}</option>`).join("");
    selectTipo.addEventListener("change", () => {
      ev.tipo = selectTipo.value;
      if (ev.tipo !== "Golo") ev.assistId = "";
      if (TIPOS_SEM_EQUIPA.includes(ev.tipo)) { ev.equipa = ""; ev.jogadorId = ""; ev.jogadorSaiId = ""; }
      renderEventos(false);
    });
    tdTipo.appendChild(selectTipo);

    const tdJogador = document.createElement("td");
    const eCartao = ev.tipo === "Cartão Amarelo" || ev.tipo === "Cartão Vermelho";
    if (ev.equipa === "VFN" && ev.tipo === "Substituição") {
      // quem já saiu não volta a poder sair nem entrar
      const selectSai = criarSelectJogador(ev.jogadorSaiId, jogadoresEmCampo(ev.id), "Sai", v => { ev.jogadorSaiId = v; renderEventos(false); });
      const selectEntra = criarSelectJogador(ev.jogadorId, bancoDisponivel(ev.id), "Entra", v => { ev.jogadorId = v; renderEventos(false); });
      tdJogador.append("Sai: ", selectSai, " Entra: ", selectEntra);
    } else if (ev.equipa === "VFN" && eCartao) {
      tdJogador.appendChild(criarSelectJogador(ev.jogadorId, jogadoresParaCartao(ev.id), "Jogador", v => { ev.jogadorId = v; renderEventos(false); }));
      if (ev.tipo === "Cartão Vermelho") {
        // suspensão automática: 1 jogo; mais se a decisão disciplinar o fixar
        const label = document.createElement("label");
        label.className = "assist-label susp-label"; label.textContent = "Jogos de suspensão ";
        const input = document.createElement("input");
        input.type = "number"; input.min = "1"; input.max = "20"; input.value = ev.suspensao_jogos || 1; input.setAttribute("aria-label", "Jogos de suspensão");
        input.addEventListener("change", () => { ev.suspensao_jogos = Math.max(1, Number(input.value) || 1); input.value = ev.suspensao_jogos; });
        label.appendChild(input);
        tdJogador.appendChild(label);
      }
    } else if (ev.equipa === "VFN" && ev.tipo === "Golo") {
      tdJogador.appendChild(criarSelectJogador(ev.jogadorId, jogadoresEmCampo(ev.id), "Marcador", v => { ev.jogadorId = v; if (ev.assistId === v) ev.assistId = ""; renderEventos(false); }));
      const label = document.createElement("label");
      label.className = "assist-label"; label.textContent = "Assistência (opcional)";
      const assistentes = convocadosIds().filter(id => id !== Number(ev.jogadorId));
      label.appendChild(criarSelectJogador(ev.assistId, assistentes, "Assistência", v => { ev.assistId = v; renderEventos(false); }));
      tdJogador.appendChild(label);
    } else if (ev.equipa === "VFN" && ev.tipo !== "Nota" && ev.tipo !== "Tempo Acrescentado") {
      tdJogador.appendChild(criarSelectJogador(ev.jogadorId, jogadoresEmCampo(ev.id), "Jogador", v => { ev.jogadorId = v; renderEventos(false); }));
    } else {
      const input = document.createElement("input");
      input.type = ev.tipo === "Tempo Acrescentado" ? "number" : "text"; input.placeholder = ev.tipo === "Tempo Acrescentado" ? "+4" : (ev.tipo === "Nota" ? "Nota do jogo" : "Nome ou número"); input.value = ev.detalhe || "";
      input.addEventListener("input", () => { ev.detalhe = input.value; });
      tdJogador.appendChild(input);
    }

    // golos: zona do golo, origem e tipo de lance (modal em modo-jogo.js)
    if ((ev.tipo === "Golo" || ev.tipo === "Auto-golo") && typeof abrirZonasEvento === "function") {
      const btnZona = document.createElement("button");
      btnZona.type = "button";
      btnZona.className = "btn btn-ghost btn-sm zona-btn" + (ev.zona_golo ? "" : " sem-zona");
      btnZona.textContent = ev.zona_golo ? "📍 " + VFN.nomeZona(ev.zona_golo) : "📍 Zona do golo";
      btnZona.title = "Zona do golo, origem da jogada e tipo de lance";
      btnZona.addEventListener("click", () => abrirZonasEvento(ev));
      tdJogador.appendChild(btnZona);
    }

    const tdAcao = document.createElement("td");
    const btnRemover = document.createElement("button");
    btnRemover.className = "remove-btn"; btnRemover.innerHTML = VFN.icone("x", 16); btnRemover.title = "Eliminar evento"; btnRemover.setAttribute("aria-label", "Eliminar evento");
    btnRemover.addEventListener("click", () => { state.jogo.eventos = state.jogo.eventos.filter(e => e.id !== ev.id); renderEventos(false); });
    tdAcao.appendChild(btnRemover);

    tr.append(tdMin, tdEquipa, tdTipo, tdJogador, tdAcao);
    tbody.appendChild(tr);
  });
  atualizarIndicadoresJogo();
}

function renderJogo() {
  state.jogo.duracaoJogo = 90;
  renderCapitao();
  el("jgFormacaoVFN").value = state.jogo.formacaoVFN;
  el("jgFormacaoAdv").value = state.jogo.formacaoAdversario;
  renderPitch();
  renderTitulares();
  renderBench();
  renderFormacaoAdversarioOutro();
  renderEventos(false);
}

/* =========================================================
   TAB 3: ANÁLISE
   ========================================================= */

function initAnalise() {
  const container = el("taticalSections");
  container.innerHTML = "";

  SECCOES_TATICAS.forEach(sec => {
    const card = document.createElement("div");
    card.className = "card tatical-card";
    card.innerHTML = `
      <div class="tatical-head">
        <h2 class="section-title" style="border:none;padding-left:0;margin-bottom:0;">${sec.titulo}</h2>
        <div class="avaliacao-group" data-key="${sec.key}">
          <button type="button" class="avaliacao-btn" data-val="Bom">${VFN.icone("circle", 14, "dot dot-bom")} Bom</button>
          <button type="button" class="avaliacao-btn" data-val="Medio">${VFN.icone("circle", 14, "dot dot-medio")} Médio</button>
          <button type="button" class="avaliacao-btn" data-val="Mau">${VFN.icone("circle", 14, "dot dot-mau")} Mau</button>
        </div>
      </div>
      <details class="guia">
        <summary>Ver perguntas-guia</summary>
        <ul>${sec.perguntas.map(p => `<li>${escapeHtml(p)}</li>`).join("")}</ul>
      </details>
      <div class="field">
        <textarea rows="5" data-key="${sec.key}" placeholder="Escreve aqui a tua análise..."></textarea>
      </div>
    `;
    container.appendChild(card);

    card.querySelectorAll(".avaliacao-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        state.analise.seccoes[sec.key].avaliacao = btn.dataset.val;
        card.querySelectorAll(".avaliacao-btn").forEach(b => b.classList.toggle("active", b === btn));
        renderTopicosOrigem();
      });
    });

    const textarea = card.querySelector("textarea");
    textarea.addEventListener("input", () => {
      state.analise.seccoes[sec.key].texto = textarea.value;
    });
  });

  el("btnAddJogadorChave").addEventListener("click", () => { state.analise.adversario.jogadoresChave.push({ nome: "", posicao: "", descricao: "" }); renderJogadoresChave(); });
  el("sinteseText").addEventListener("input", e => state.analise.sintese = e.target.value);
  el("topicosText").addEventListener("input", e => state.analise.topicosTreino = e.target.value);
  el("primeiroTempoText").addEventListener("input", e => state.analise.primeiroTempo = e.target.value);
  el("segundoTempoText").addEventListener("input", e => state.analise.segundoTempo = e.target.value);
  el("destaquesText").addEventListener("input", e => state.analise.destaques = e.target.value);

  el("advEstilo").addEventListener("input", e => state.analise.adversario.estilo = e.target.value);
  el("advPontosFortes").addEventListener("input", e => state.analise.adversario.pontosFortes = e.target.value);
  el("advVulnerabilidades").addEventListener("input", e => state.analise.adversario.vulnerabilidades = e.target.value);
}

function renderBulletList(containerId, arr) {
  const container = el(containerId);
  container.innerHTML = "";
  arr.forEach((texto, idx) => {
    const row = document.createElement("div");
    row.className = "bullet-row";
    const input = document.createElement("input");
    input.type = "text";
    input.value = texto;
    input.placeholder = "Escreve aqui...";
    input.addEventListener("input", () => { arr[idx] = input.value; });
    const btnRemover = document.createElement("button");
    btnRemover.className = "remove-btn";
    btnRemover.innerHTML = VFN.icone("x", 16); btnRemover.setAttribute("aria-label", "Remover");
    btnRemover.addEventListener("click", () => { arr.splice(idx, 1); renderBulletList(containerId, arr); });
    row.appendChild(input);
    row.appendChild(btnRemover);
    container.appendChild(row);
  });
}

function renderJogadoresChave() {
  const container = el("jogadoresChaveList");
  container.innerHTML = "";
  state.analise.adversario.jogadoresChave.forEach((jc, idx) => {
    const row = document.createElement("div");
    row.className = "dynamic-row jogador-chave";

    const inputNome = document.createElement("input");
    inputNome.type = "text";
    inputNome.className = "nome-jc";
    inputNome.placeholder = "Nome";
    inputNome.value = jc.nome;
    inputNome.addEventListener("input", () => { jc.nome = inputNome.value; });

    const inputPosicao = document.createElement("input");
    inputPosicao.type = "text";
    inputPosicao.className = "posicao-jc";
    inputPosicao.placeholder = "Posição";
    inputPosicao.value = jc.posicao || "";
    inputPosicao.addEventListener("input", () => { jc.posicao = inputPosicao.value; });

    const textareaDesc = document.createElement("textarea");
    textareaDesc.className = "desc-jc";
    textareaDesc.rows = 2;
    textareaDesc.placeholder = "Descrição / observação (o que se destaca)";
    textareaDesc.value = jc.descricao || "";
    textareaDesc.addEventListener("input", () => { jc.descricao = textareaDesc.value; });

    const btnRemover = document.createElement("button");
    btnRemover.className = "remove-btn";
    btnRemover.innerHTML = VFN.icone("x", 16); btnRemover.setAttribute("aria-label", "Remover");
    btnRemover.addEventListener("click", () => {
      state.analise.adversario.jogadoresChave.splice(idx, 1);
      renderJogadoresChave();
    });

    row.appendChild(inputNome);
    row.appendChild(inputPosicao);
    row.appendChild(textareaDesc);
    row.appendChild(btnRemover);
    container.appendChild(row);
  });
}

function renderTopicos() {
  const container = el("topicosList");
  container.innerHTML = "";
  state.analise.topicosTreino.forEach((texto, idx) => {
    const row = document.createElement("div");
    row.className = "dynamic-row";
    const numBadge = document.createElement("span");
    numBadge.className = "num-badge";
    numBadge.textContent = (idx + 1) + ".";
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Tópico de treino...";
    input.value = texto;
    input.addEventListener("input", () => { state.analise.topicosTreino[idx] = input.value; });
    const btnRemover = document.createElement("button");
    btnRemover.className = "remove-btn";
    btnRemover.innerHTML = VFN.icone("x", 16); btnRemover.setAttribute("aria-label", "Remover");
    btnRemover.addEventListener("click", () => {
      state.analise.topicosTreino.splice(idx, 1);
      renderTopicos();
    });
    row.appendChild(numBadge);
    row.appendChild(input);
    row.appendChild(btnRemover);
    container.appendChild(row);
  });
}

function renderAnalise() {
  if (typeof renderSituacoesAdmin === "function") renderSituacoesAdmin(); // outro relatório aberto
  document.querySelectorAll(".avaliacao-group").forEach(group => {
    const key = group.dataset.key;
    const valorAtual = state.analise.seccoes[key].avaliacao;
    group.querySelectorAll(".avaliacao-btn").forEach(b => {
      b.classList.toggle("active", b.dataset.val === valorAtual);
    });
  });
  document.querySelectorAll('#taticalSections textarea[data-key]').forEach(ta => {
    ta.value = state.analise.seccoes[ta.dataset.key].texto;
  });

  renderJogadoresChave();
  el("sinteseText").value = state.analise.sintese || "";
  el("topicosText").value = state.analise.topicosTreino;
  el("primeiroTempoText").value = state.analise.primeiroTempo || "";
  el("segundoTempoText").value = state.analise.segundoTempo || "";
  el("destaquesText").value = state.analise.destaques || "";

  renderAnalysisSummary();
  renderTopicosOrigem();

  el("advEstilo").value = state.analise.adversario.estilo;
  el("advPontosFortes").value = state.analise.adversario.pontosFortes;
  el("advVulnerabilidades").value = state.analise.adversario.vulnerabilidades;
}

/** 1. Resumo rápido: resultado, marcadores e data (do separador Jogo e do Pré-Jogo). */
function renderAnalysisSummary() {
  const resultado = `VFN ${state.jogo.golosVFN} – ${state.jogo.golosAdversario} ${state.preJogo.adversario || "Adversário"}`;
  const marcadores = VFNRelatorio.extrair({ match_data: state }, nomeJogador).marcadores;
  const data = state.preJogo.data ? new Date(state.preJogo.data + "T00:00:00").toLocaleDateString("pt-PT") : "—";
  el("analysisSummary").innerHTML = `
    <h2>Resumo rápido</h2>
    <div><span class="summary-label">Resultado</span><span class="summary-value">${escapeHtml(resultado)}</span></div>
    <div class="summary-marcadores"><span class="summary-label">Marcadores</span><span class="summary-value">${escapeHtml(marcadores || "—")}</span></div>
    <div><span class="summary-label">Data</span><span class="summary-value">${escapeHtml(data)}</span></div>
  `;
}

/** Tópicos para o Treino: mostra os momentos do jogo avaliados como Médio/Mau (a origem dos tópicos). */
function renderTopicosOrigem() {
  const caixa = el("topicosOrigem");
  if (!caixa) return;
  const aTrabalhar = SECCOES_TATICAS.filter(s => ["Mau", "Medio"].includes((state.analise.seccoes[s.key] || {}).avaliacao));
  caixa.innerHTML = aTrabalhar.length
    ? `<span class="muted">Da Análise Tática:</span>${aTrabalhar.map(s => { const a = state.analise.seccoes[s.key].avaliacao; return `<span class="rel-aval aval-${a === "Medio" ? "Médio" : a}">${escapeHtml(s.titulo)} · ${a === "Medio" ? "Médio" : a}</span>`; }).join("")}`
    : "";
}

/* =========================================================
   TAB 4: PLANTEL
   ========================================================= */

function initPlantel() {
  el("btnOpenAddJogador").addEventListener("click", abrirModalJogador);
  el("btnModalCancelar").addEventListener("click", fecharModalJogador);
  el("btnModalGuardar").addEventListener("click", async () => {
    const nome = el("modalNome").value.trim();
    const nomeCompleto = el("modalNomeCompleto").value.trim();
    const idZerozero = el("modalIdZerozero").value.trim();
    el("modalErro").textContent = "";
    if (!jogadorEmEdicao) {
      // o ID Zerozero é obrigatório na criação e passa a ser a chave primária em players
      const erroId = !idZerozero ? "Indica o ID Zerozero do jogador." : !/^\d+$/.test(idZerozero) ? "O ID Zerozero só tem algarismos." : plantel.some(p => idJogadorBD(p) === idZerozero || p.id === Number(idZerozero)) ? "Já existe um jogador com este ID Zerozero." : "";
      if (erroId) { el("modalErro").textContent = erroId; el("modalIdZerozero").focus(); return; }
    }
    const posicao = el("modalPosicao").value.trim();
    const numero = el("modalNumero").value.trim();
    if (!nome) { el("modalErro").textContent = "Indica o nome curto."; el("modalNome").focus(); return; }
    const email = el("modalEmailConta").value.trim();
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { el("modalErro").textContent = "O email da conta não é válido."; el("modalEmailConta").focus(); return; }
    if (email && !colunaEmailConta && supabaseClient && currentUser) { el("modalErro").textContent = "Para guardar o email da conta corre a secção de 03/10/2026 do schema.sql."; return; }
    const jogador = jogadorEmEdicao || Object.assign(jogadorBase(Number(idZerozero), nome, posicao || "—", numero), { idBD: idZerozero });
    jogador.nome = nome; jogador.nomeCompleto = nomeCompleto; jogador.posicao = posicao || "—"; jogador.numero = numero; jogador.fotoUrl = el("modalFoto").value.trim();
      const fotoSupabase = await carregarFotoParaSupabase(el("modalFotoUpload").files[0], jogador.id);
      if (fotoSupabase) jogador.fotoUrl = fotoSupabase;
    jogador.nascimento = el("modalNascimento").value; jogador.pePreferencial = el("modalPe").value;
    jogador.disponibilidade = el("modalDisponibilidade").value;
    jogador.email = email;
    jogador.posicao = posicoesModal.join("/") || jogador.posicao;
    lerSubPosicoesModal(jogador);
    if (!jogadorEmEdicao) plantel.push(jogador);
    guardarPlantel();
    sincronizarPlantelSupabase();
    jogadorEmEdicao = null;
    fecharModalJogador();
    renderPlantel();
    renderJogo();
  });
  el("modalOverlay").addEventListener("click", (e) => {
    if (e.target.id === "modalOverlay") fecharModalJogador();
  });
  el("modalFotoUpload").addEventListener("change", event => {
    const ficheiro = event.target.files[0];
    if (!ficheiro) return;
    const reader = new FileReader();
    reader.onload = () => { el("modalFoto").value = reader.result; renderPlayerModalHeader({ nome: el("modalNome").value || "Novo jogador", posicao: el("modalPosicao").value, numero: el("modalNumero").value, fotoUrl: reader.result, golos: 0, assistencias: 0, minutosTotais: 0 }); };
    reader.readAsDataURL(ficheiro);
  });
  el("modalNumero").addEventListener("input", () => { if (!el("modalFoto").value) el("playerModalPhoto").innerHTML = generateJerseyAvatar(el("modalNumero").value); });
  el("modalFoto").addEventListener("input", () => renderPlayerModalHeader({ nome: el("modalNome").value || "Novo jogador", posicao: el("modalPosicao").value, numero: el("modalNumero").value, fotoUrl: el("modalFoto").value, golos: 0, assistencias: 0, minutosTotais: 0 }));
  el("modalPosicao").addEventListener("input", () => { posicoesModal = el("modalPosicao").value.split("/").filter(Boolean).map(normalizarCodigoPosicao); posicaoPrincipalModal = posicoesModal[0] || ""; renderPositionMap(); });
  el("modalSubPosicao").addEventListener("change", e => { secundariasModal = [...el("modalSecundarias").querySelectorAll("input:checked")].map(c => c.value); subPosicaoModal = e.target.value; renderSubPosicoesModal(); });
  el("modalSecundarias").addEventListener("change", () => { secundariasModal = [...el("modalSecundarias").querySelectorAll("input:checked")].map(c => c.value); });
  el("teamSearch").addEventListener("input", event => { pesquisaEquipa = event.target.value.toLocaleLowerCase("pt-PT"); renderPlantel(); });
  el("teamPositionFilter").addEventListener("change", event => { filtroPosicaoEquipa = event.target.value; renderPlantel(); });
  el("teamAvailabilityFilter").addEventListener("change", event => { filtroDisponibilidadeEquipa = event.target.value; renderPlantel(); });

  el("btnExportarPlantel").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(plantel, null, 2)], { type: "application/json" });
    descarregarBlob(blob, "plantel_vfn.json");
  });
}

function abrirModalJogador() {
  jogadorEmEdicao = null;
  el("modalIdZerozero").value = "";
  el("modalIdZerozero").readOnly = false;
  el("modalErro").textContent = "";
  el("modalNome").value = "";
  el("modalNomeCompleto").value = "";
  el("modalPosicao").value = "";
  el("modalNumero").value = "";
  el("modalFoto").value = "";
  el("modalFotoUpload").value = "";
  el("modalNascimento").value = ""; el("modalPe").value = ""; el("modalDisponibilidade").value = "disponivel";
  el("modalEmailConta").value = ""; el("modalContaEstado").textContent = "";
  posicoesModal = []; posicaoPrincipalModal = "";
  subPosicaoModal = ""; secundariasModal = [];
  renderPositionMap(); renderPlayerModalHeader(null);
  el("modalOverlay").hidden = false;
  el("modalIdZerozero").focus();
}

function abrirModalExistente(jogador) {
  jogadorEmEdicao = jogador;
  el("modalIdZerozero").value = idJogadorBD(jogador);
  el("modalIdZerozero").readOnly = true; // chave primária: não se altera
  el("modalErro").textContent = "";
  el("modalNome").value = jogador.nome;
  el("modalNomeCompleto").value = jogador.nomeCompleto || "";
  el("modalPosicao").value = jogador.posicao;
  el("modalNumero").value = jogador.numero;
  el("modalFoto").value = jogador.fotoUrl || "";
  el("modalFotoUpload").value = "";
  el("modalNascimento").value = jogador.nascimento || ""; el("modalPe").value = jogador.pePreferencial || ""; el("modalDisponibilidade").value = jogador.disponibilidade || "disponivel";
  el("modalEmailConta").value = jogador.email || "";
  el("modalContaEstado").textContent = jogador.contaLigada ? "· conta ligada ✓" : jogador.email ? "· à espera do primeiro login" : "";
  posicoesModal = (jogador.posicao || "").split("/").filter(Boolean).map(normalizarCodigoPosicao); posicaoPrincipalModal = posicoesModal[0] || "";
  subPosicaoModal = jogador.subPosicao || ""; secundariasModal = [...(jogador.posicoesSecundarias || [])];
  renderPositionMap(); renderPlayerModalHeader(jogador);
  el("modalOverlay").hidden = false;
}

function renderPositionMap() {
  const container = el("positionPoints");
  if (!container) return;
  container.innerHTML = Object.entries(POSICOES_MAPA).map(([posicao, [left, top]]) => {
    const classe = posicao === posicaoPrincipalModal ? "primary" : (posicoesModal.includes(posicao) ? "secondary" : "");
    return `<button type="button" class="position-point ${classe}" data-position="${posicao}" style="left:${left}%;top:${top}%">${posicao}</button>`;
  }).join("");
  container.querySelectorAll(".position-point").forEach(button => button.addEventListener("click", () => {
    const posicao = button.dataset.position;
    if (!posicoesModal.includes(posicao)) { posicoesModal.push(posicao); if (!posicaoPrincipalModal) posicaoPrincipalModal = posicao; }
    else if (posicao === posicaoPrincipalModal) { posicaoPrincipalModal = posicoesModal.find(item => item !== posicao) || ""; posicoesModal = posicoesModal.filter(item => item !== posicao); }
    else posicoesModal = posicoesModal.filter(item => item !== posicao);
    el("modalPosicao").value = posicoesModal.join("/"); renderPositionMap();
  }));
  renderSubPosicoesModal();
}

/* ---- Sub-posição e posições secundárias (players.sub_posicao / posicoes_secundarias) ---- */

let subPosicaoModal = "";
let secundariasModal = [];

/** Sub-posição: opções da categoria da posição principal (oculta no GR); secundárias: todas as outras. */
function renderSubPosicoesModal() {
  const wrap = el("modalSubPosicaoWrap");
  if (!wrap) return;
  const cat = VFN.categoriaPosicao(el("modalPosicao").value);
  const opcoes = VFN.SUB_POSICOES[cat] || [];
  if (!opcoes.includes(subPosicaoModal)) subPosicaoModal = VFN.subPosicaoSugerida(el("modalPosicao").value);
  wrap.hidden = !opcoes.length;
  el("modalSubPosicao").innerHTML = '<option value="">— Escolher —</option>' + opcoes.map(o => `<option ${o === subPosicaoModal ? "selected" : ""}>${escapeHtml(o)}</option>`).join("");
  el("modalSecundarias").innerHTML = VFN.TODAS_SUB_POSICOES.filter(o => o !== subPosicaoModal)
    .map(o => `<label class="sub-check"><input type="checkbox" value="${escapeHtml(o)}" ${secundariasModal.includes(o) ? "checked" : ""}> ${escapeHtml(o)}</label>`).join("");
  el("modalSubPosicaoAviso").hidden = colunaSubPosicao || !supabaseClient || !currentUser;
}

function lerSubPosicoesModal(jogador) {
  const cat = VFN.categoriaPosicao(jogador.posicao);
  jogador.subPosicao = cat === "GR" ? "" : el("modalSubPosicao").value;
  jogador.posicoesSecundarias = [...el("modalSecundarias").querySelectorAll("input:checked")].map(c => c.value).filter(v => v !== jogador.subPosicao);
}

function renderPlayerModalHeader(jogador) {
  const photo = el("playerModalPhoto");
  const numero = jogador ? jogador.numero : el("modalNumero").value;
  // foto real (photo_url ou assets/players/{id}) em destaque; senão a camisola
  photo.innerHTML = VFN.avatarJogador(jogador ? jogador : { numero }, "avatar-modal");
  el("playerModalName").textContent = jogador ? (jogador.nomeCompleto || jogador.nome) : "Adicionar Jogador";
  el("playerModalMeta").textContent = jogador ? `${jogador.posicao || "—"} · Nº ${jogador.numero || "—"}${jogador.nascimento ? ` · ${VFN.dataDDMMAAAA(jogador.nascimento)}` : ""}${jogador.pePreferencial ? ` · Pé ${jogador.pePreferencial}` : ""}` : "Ficha do jogador";
  el("playerModalPosicoes").innerHTML = jogador ? VFN.posicaoDetalhadaHTML(jogador.posicao, jogador.subPosicao, jogador.posicoesSecundarias) : "";
  const stats = jogador || { golos: 0, assistencias: 0, minutosTotais: 0 };
  el("playerModalMainStats").innerHTML = [["Golos", stats.golos || 0], ["Assistências", stats.assistencias || 0], ["Minutos", stats.minutosTotais || 0]].map(([label, value]) => `<div class="player-modal-stat"><strong>${value}</strong><span>${label}</span></div>`).join("");
  if (typeof renderRadarJogador === "function") renderRadarJogador(jogador);
  if (typeof renderFichaAdmin === "function") renderFichaAdmin(jogador);
}

function fecharModalJogador() {
  el("modalOverlay").hidden = true;
}

function criarCelulaEditavel(jogador, campo, tipo, classe) {
  const td = document.createElement("td");
  td.className = classe;
  const input = document.createElement("input");
  input.type = tipo;
  if (tipo === "number") input.min = "0";
  input.value = jogador[campo];
  input.addEventListener("change", () => {
    jogador[campo] = tipo === "number" ? (Number(input.value) || 0) : input.value;
    guardarPlantel();
    renderPlantelSummary();
    if (campo === "nome" || campo === "posicao" || campo === "numero") {
      renderJogo();
    }
  });
  td.appendChild(input);
  return td;
}

function renderPlantel() {
  const tbody = el("plantelBody");
  tbody.innerHTML = "";
  const ordenado = [...plantel].filter(j => {
    const matchesSearch = !pesquisaEquipa || j.nome.toLocaleLowerCase("pt-PT").includes(pesquisaEquipa);
    const posicao = (j.posicao || "").toUpperCase();
    const matchesPosition = VFN.posicaoNaCategoria(posicao, filtroPosicaoEquipa) && (!filtroDisponibilidadeEquipa || (j.disponibilidade || "disponivel") === filtroDisponibilidadeEquipa);
    return matchesSearch && matchesPosition;
  }).sort((a, b) => a.nome.localeCompare(b.nome, "pt"));

  ordenado.forEach(j => {
    const tr = document.createElement("tr");

    const tdFoto = document.createElement("td");
    tdFoto.innerHTML = `<span class="avatar-com-estado">${VFN.avatarJogador(j, "avatar-sm")}${VFN.badgeDisponibilidade(j.disponibilidade, true)}</span>`;
    tdFoto.dataset.v = j.disponibilidade || "disponivel";
    tr.appendChild(tdFoto);

    tr.appendChild(criarCelulaEditavel(j, "nome", "text", "col-nome"));
    tr.appendChild(criarCelulaEditavel(j, "posicao", "text", "col-pos"));
    tr.appendChild(criarCelulaEditavel(j, "numero", "text", "col-num"));
      tr.appendChild(criarCelulaEditavel(j, "jogos", "number", "col-stat"));
    tr.appendChild(criarCelulaEditavel(j, "golos", "number", "col-stat"));
    tr.appendChild(criarCelulaEditavel(j, "assistencias", "number", "col-stat"));
    tr.appendChild(criarCelulaEditavel(j, "cartoesAmarelos", "number", "col-stat"));
    tr.appendChild(criarCelulaEditavel(j, "cartoesVermelhos", "number", "col-stat"));
    tr.appendChild(criarCelulaEditavel(j, "minutosTotais", "number", "col-stat"));

    const tdAcao = document.createElement("td");
    const btnRemover = document.createElement("button");
    btnRemover.className = "remove-btn";
    btnRemover.innerHTML = VFN.icone("x", 16); btnRemover.setAttribute("aria-label", "Remover");
    btnRemover.title = "Remover jogador";
    btnRemover.addEventListener("click", () => {
      if (!confirm(`Remover "${j.nome}" do plantel?`)) return;
      plantel = plantel.filter(p => p.id !== j.id);
      removerJogadorSupabase(j);
      guardarPlantel();
      renderPlantel();
      renderJogo();
    });
    tdAcao.appendChild(btnRemover);
    tr.appendChild(tdAcao);
    tr.addEventListener("click", event => { if (!event.target.closest("input,button")) abrirModalExistente(j); });

    tbody.appendChild(tr);
  });

  renderPlantelSummary();
  renderTeamQuickStats();
}

function renderTeamQuickStats() {
  const golos = plantel.reduce((sum, jogador) => sum + (Number(jogador.golos) || 0), 0);
  el("teamQuickStats").innerHTML = `<span><strong>${plantel.length}</strong> jogadores</span><span><strong>${golos}</strong> golos totais</span>`;
  if (typeof renderAlertaAmarelos === "function") renderAlertaAmarelos();
}

function criarStatCard(titulo, icone, lista, formatador) {
  const card = document.createElement("div");
  card.className = "stat-card";
  const h4 = document.createElement("h4");
  h4.innerHTML = `${VFN.icone(icone, 18)} ${escapeHtml(titulo)}`;
  card.appendChild(h4);
  if (lista.length === 0) {
    const p = document.createElement("p");
    p.className = "stat-empty";
    p.textContent = "Sem dados registados.";
    card.appendChild(p);
  } else {
    const ol = document.createElement("ol");
    lista.forEach(item => {
      const li = document.createElement("li");
      li.textContent = formatador(item);
      ol.appendChild(li);
    });
    card.appendChild(ol);
  }
  return card;
}

function renderPlantelSummary() {
  const container = el("plantelSummary");
  container.innerHTML = "";

  const topGolos = [...plantel].filter(p => p.golos > 0).sort((a, b) => b.golos - a.golos).slice(0, 3);
  const topAssist = [...plantel].filter(p => p.assistencias > 0).sort((a, b) => b.assistencias - a.assistencias).slice(0, 3);
  const topMinutos = [...plantel].filter(p => p.minutosTotais > 0).sort((a, b) => b.minutosTotais - a.minutosTotais).slice(0, 3);
  const totalAmarelos = plantel.reduce((s, p) => s + (Number(p.cartoesAmarelos) || 0), 0);
  const totalVermelhos = plantel.reduce((s, p) => s + (Number(p.cartoesVermelhos) || 0), 0);

  container.appendChild(criarStatCard("Top 3 Golos", "bola", topGolos, p => `${p.nome} — ${p.golos}`));
  container.appendChild(criarStatCard("Top 3 Assistências", "target", topAssist, p => `${p.nome} — ${p.assistencias}`));
  container.appendChild(criarStatCard("Top 3 Minutos Jogados", "timer", topMinutos, p => `${p.nome} — ${p.minutosTotais}'`));

  const cardCartoes = document.createElement("div");
  cardCartoes.className = "stat-card";
  cardCartoes.innerHTML = `
    <h4>Cartões da Equipa</h4>
    <div class="big-number-row">
      <div class="big-number-item"><span class="big-number">${totalAmarelos}</span><span class="stat-label">Amarelos</span></div>
      <div class="big-number-item"><span class="big-number">${totalVermelhos}</span><span class="stat-label">Vermelhos</span></div>
    </div>
  `;
  container.appendChild(cardCartoes);
}

/* =========================================================
   RASCUNHO — BANNER / LIMPAR
   ========================================================= */

function initRascunho() {
  const armazenado = lerRascunhoArmazenado();
  if (armazenado) {
    el("draftBannerText").textContent = `Tens um rascunho guardado de ${formatarDataHora(armazenado.savedAt)}. Carregar?`;
    el("draftBanner").hidden = false;
  }
  el("btnLoadDraft").addEventListener("click", () => {
    if (carregarRascunho()) renderTudo();
    el("draftBanner").hidden = true;
  });
  el("btnDismissDraft").addEventListener("click", () => {
    el("draftBanner").hidden = true;
  });

  setInterval(guardarRascunho, 30000);
  window.addEventListener("beforeunload", guardarRascunho);

  el("btnExportarRascunho").addEventListener("click", async () => { guardarRascunho(); await sincronizarRascunhoSupabase(); alert("Rascunho guardado."); });
  el("importRascunhoInput").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) importarRascunhoJSON(file);
    e.target.value = "";
  });
}

function initLimparFormulario() {
  el("btnClearForm").addEventListener("click", () => {
    if (!confirm("Tens a certeza que queres limpar todo o formulário? Esta ação não pode ser desfeita (o plantel não é afetado).")) return;
    state = estadoInicial();
    limparRascunhoStorage();
    renderTudo();
    if (typeof renderEstadoRelatorio === "function") renderEstadoRelatorio();
  });
}

/* =========================================================
   RENDER GERAL
   ========================================================= */

function renderTudo() {
  renderPreJogo();
  renderJogo();
  renderAnalise();
  renderPlantel();
}

/* =========================================================
   LOGO — fallback caso não exista
   ========================================================= */

function initLogo() {
  const img = el("clubLogo");
  const placeholder = el("logoPlaceholder");
  img.addEventListener("error", () => {
    img.style.display = "none";
    placeholder.hidden = false;
  });
}

/* =========================================================
   CÁLCULO DE MINUTOS JOGADOS (para o relatório Word)
   ========================================================= */

function calcularMinutosJogadores() {
  const duracao = Number(state.jogo.duracaoJogo) || 90;
  const titulares = titularesIds();
  const periodos = {}; // id -> [{ inicio, fim }]

  titulares.forEach(id => { periodos[id] = [{ inicio: 0, fim: null }]; });

  const subsOrdenadas = state.jogo.eventos
    .filter(e => e.equipa === "VFN" && e.tipo === "Substituição" && e.jogadorSaiId && e.jogadorId)
    .slice()
    .sort((a, b) => (Number(a.minuto) || 0) - (Number(b.minuto) || 0));

  subsOrdenadas.forEach(ev => {
    const minuto = Math.min(Number(ev.minuto) || 0, duracao);
    const saiId = Number(ev.jogadorSaiId);
    const entraId = Number(ev.jogadorId);
    if (periodos[saiId] && periodos[saiId].length) {
      const aberto = periodos[saiId].find(p => p.fim === null);
      if (aberto) aberto.fim = minuto;
    }
    if (!periodos[entraId]) periodos[entraId] = [];
    periodos[entraId].push({ inicio: minuto, fim: null });
  });

  const resultado = [];
  Object.keys(periodos).forEach(idStr => {
    const id = Number(idStr);
    let total = 0;
    periodos[id].forEach(p => {
      const fim = p.fim === null ? duracao : p.fim;
      total += Math.max(0, fim - p.inicio);
    });
    if (total > 0) {
      const j = jogadorPorId(id);
      resultado.push({ id, nome: j ? j.nome : "Desconhecido", posicao: j ? j.posicao : "—", minutos: total });
    }
  });

  resultado.sort((a, b) => b.minutos - a.minutos);
  return resultado;
}

/* =========================================================
   GERAÇÃO DO WORD (.docx)
   ========================================================= */

/**
 * Logo para o Word: fetch da imagem (base64 via data URL), dimensões lidas no browser e
 * redução para caber na caixa (máx. 110 px). Devolve null se não existir.
 */
async function carregarLogoParaWord(urls) {
  for (const url of urls.filter(Boolean)) {
    try {
      const resp = await fetch(url);
      if (!resp.ok) continue;
      const blob = await resp.blob();
      const tipo = /png/i.test(blob.type) || /\.png(\?|$)/i.test(url) ? "png" : /jpe?g/i.test(blob.type) || /\.jpe?g(\?|$)/i.test(url) ? "jpg" : null;
      if (!tipo) continue; // o docx só incorpora png/jpg
      const base64 = await new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(blob); });
      const dims = await new Promise(resolve => { const img = new Image(); img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight }); img.onerror = () => resolve(null); img.src = base64; });
      if (!dims || !dims.w) continue;
      const escala = Math.min(1, 110 / Math.max(dims.w, dims.h));
      return { data: dataUrlParaArrayBuffer(base64), type: tipo, width: Math.round(dims.w * escala), height: Math.round(dims.h * escala) };
    } catch (e) { /* tenta o seguinte */ }
  }
  return null;
}

/** Id do adversário na tabela teams: o escolhido no Pré-Jogo ou o do jogo associado. */
function idAdversarioRelatorio() {
  if (state.preJogo.adversarioId) return state.preJogo.adversarioId;
  const jogo = jogosCalendario.find(j => j.id === state.preJogo.matchId);
  if (jogo && jogo.opponent_team_id) return jogo.opponent_team_id;
  const equipa = equipasCalendario.find(t => t.name === state.preJogo.adversario);
  return equipa ? equipa.id : "";
}

async function carregarImagemComoArrayBuffer(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error("Não foi possível carregar: " + url);
  return await resp.arrayBuffer();
}

function dataUrlParaArrayBuffer(dataUrl) {
  const base64 = dataUrl.split(",")[1];
  const binStr = atob(base64);
  const bytes = new Uint8Array(binStr.length);
  for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
  return bytes.buffer;
}

function corAvaliacao(av) {
  if (av === "Bom") return "67A23F";
  if (av === "Medio") return "E7A601";
  if (av === "Mau") return "B23A2E";
  return "4F4847";
}

function valorAvaliacao(av) {
  if (av === "Bom") return "Bom";
  if (av === "Medio") return "Médio";
  if (av === "Mau") return "Mau";
  return "Sem avaliação";
}

function descricaoEvento(ev) {
  return nomeOuDetalheEvento(ev);
}

function validarAntesDeGerarWord() {
  const faltas = [];
  if (!state.preJogo.adversario.trim()) faltas.push("Adversário");
  if (!state.preJogo.data) faltas.push("Data");
  if (titularesIds().length === 0) faltas.push("Pelo menos 1 titular");
  if (faltas.length) alert(`Antes de gerar o Word, faltam preencher:\n\n• ${faltas.join("\n• ")}\n\nO relatório será gerado na mesma assim.`);
}

async function gerarRelatorioWord() {
  validarAntesDeGerarWord();
  const btn = el("btnGenerateDocx");
  const textoOriginal = btn.textContent;
  btn.disabled = true;
  btn.textContent = "A gerar...";

  try {
    const {
      Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
      WidthType, AlignmentType, ImageRun, PageBreak, Footer, BorderStyle,
      ShadingType
    } = docx;

    const COR_DARK_KHAKI = "4D4017";
    const COR_OLD_GOLD = "C7B750";
    const COR_CHARCOAL = "4F4847";
    const COR_SILVER = "C7C7C4";

    const SEM_BORDAS = {
      top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }
    };
    const CELULA_SEM_BORDAS = {
      top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }
    };

    const dataFormatada = state.preJogo.data
      ? new Date(state.preJogo.data + "T00:00:00").toLocaleDateString("pt-PT")
      : "—";
    const nomeAdversario = state.preJogo.adversario || "Adversário";

    // ================= PÁGINA 1 — CAPA (estilo Wyscout) =================
    const pagina1 = [];

    pagina1.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
      children: [new TextRun({ text: "ACD VILA FRANCA DAS NAVES · RELATÓRIO DE JOGO · ÉPOCA 2026/27", bold: true, size: 18, color: COR_CHARCOAL })]
    }));

    // Logos no cabeçalho: VFN e adversário (assets/opponents/{opponent_team_id}.png)
    const idAdversario = idAdversarioRelatorio();
    const [logoVFN, logoAdversario] = await Promise.all([
      carregarLogoParaWord(["assets/logo.png", VFN.LOGO_VFN]),
      idAdversario ? carregarLogoParaWord([`assets/opponents/${idAdversario}.png`, VFN.urlLogoEquipa(equipaPorId(idAdversario))]) : Promise.resolve(null)
    ]);

    const caixaLogo = (texto, logo) => new TableCell({
      width: { size: 34, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.DASHED, size: 6, color: COR_OLD_GOLD },
        bottom: { style: BorderStyle.DASHED, size: 6, color: COR_OLD_GOLD },
        left: { style: BorderStyle.DASHED, size: 6, color: COR_OLD_GOLD },
        right: { style: BorderStyle.DASHED, size: 6, color: COR_OLD_GOLD }
      },
      margins: { top: 500, bottom: 500 },
      children: logo
        ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ data: logo.data, type: logo.type, transformation: { width: logo.width, height: logo.height } })] })]
        : [
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: texto, bold: true, size: 24, color: COR_CHARCOAL })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60 }, children: [new TextRun({ text: "(colar aqui)", italics: true, size: 16, color: COR_SILVER })] })
        ]
    });

    const caixaResultado = new TableCell({
      width: { size: 32, type: WidthType.PERCENTAGE },
      borders: CELULA_SEM_BORDAS,
      margins: { top: 500, bottom: 500 },
      children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${state.jogo.golosVFN} - ${state.jogo.golosAdversario}`, bold: true, size: 42, color: COR_CHARCOAL })] })]
    });

    pagina1.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: SEM_BORDAS,
      rows: [new TableRow({ children: [caixaLogo("Logo VFN", logoVFN), caixaResultado, caixaLogo("Logo " + nomeAdversario, logoAdversario)] })]
    }));

    pagina1.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: SEM_BORDAS,
      rows: [new TableRow({
        children: [
          new TableCell({
            width: { size: 34, type: WidthType.PERCENTAGE }, borders: CELULA_SEM_BORDAS,
            children: [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 300 }, children: [new TextRun({ text: "VILA FRANCA DAS NAVES", bold: true, size: 24, color: COR_DARK_KHAKI })] })]
          }),
          new TableCell({
            width: { size: 32, type: WidthType.PERCENTAGE }, borders: CELULA_SEM_BORDAS,
            children: [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 240 }, children: [new TextRun({ text: `${state.jogo.golosVFN} - ${state.jogo.golosAdversario}`, bold: true, size: 72, color: COR_CHARCOAL })] })]
          }),
          new TableCell({
            width: { size: 34, type: WidthType.PERCENTAGE }, borders: CELULA_SEM_BORDAS,
            children: [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 300 }, children: [new TextRun({ text: nomeAdversario.toUpperCase(), bold: true, size: 24, color: COR_DARK_KHAKI })] })]
          })
        ]
      })]
    }));

    pagina1.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 260 },
      children: [new TextRun({
        text: `${state.preJogo.competicao} · Jornada ${state.preJogo.jornada || "—"} · ${dataFormatada} · ${state.preJogo.casaFora}`,
        size: 22, color: COR_CHARCOAL
      })]
    }));
    pagina1.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 80 },
      children: [new TextRun({ text: `Formação VFN: ${state.jogo.formacaoVFN}   ·   Formação ${nomeAdversario}: ${formacaoAdversarioTexto()}`, size: 20, color: COR_CHARCOAL, italics: true })]
    }));

    // Estrutura (v9): 1. Resumo Rápido + 2. Síntese (capa: os dirigentes leem e param aqui) ·
    // 3. Evolução do Jogo + 4. Momentos e Situações · 5. Análise Tática + 6. Tópicos para o Treino · anexo: Ficha de Jogo
    const linhasTexto = t => String(t || "").split(/\n+/).map(p => p.trim()).filter(Boolean);
    const tituloSeccao = (texto, antes) => new Paragraph({ spacing: { before: antes ?? 260, after: 120 }, children: [new TextRun({ text: texto, bold: true, size: 24, color: COR_DARK_KHAKI })] });
    const subtituloSeccao = texto => new Paragraph({ spacing: { before: 140, after: 60 }, children: [new TextRun({ text: texto, bold: true, size: 20, color: COR_CHARCOAL })] });
    const paragrafosTexto = (t, vazio) => linhasTexto(t).length
      ? linhasTexto(t).map(p => new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: p, size: 20 })] }))
      : [new Paragraph({ children: [new TextRun({ text: vazio || "— por preencher —", italics: true, size: 18, color: COR_SILVER })] })];
    const dadosRelatorio = VFNRelatorio.extrair({ match_data: state }, nomeJogador);

    // 1. Resumo rápido: resultado e data já acima; marcadores
    pagina1.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 120 },
      children: [new TextRun({ text: "Marcadores: ", bold: true, size: 20, color: COR_CHARCOAL }), new TextRun({ text: dadosRelatorio.marcadores || "—", size: 20, color: COR_CHARCOAL })]
    }));

    // 2. Síntese
    pagina1.push(tituloSeccao("SÍNTESE", 400));
    pagina1.push(...paragrafosTexto(state.analise.sintese));

    pagina1.push(new Paragraph({ children: [new PageBreak()] }));

    // ================= 3. EVOLUÇÃO DO JOGO + 4. MOMENTOS E SITUAÇÕES =================
    const paginaEvolucao = [];
    paginaEvolucao.push(tituloSeccao("EVOLUÇÃO DO JOGO", 0));
    paginaEvolucao.push(subtituloSeccao("1.ª parte"), ...paragrafosTexto(state.analise.primeiroTempo));
    paginaEvolucao.push(subtituloSeccao("2.ª parte"), ...paragrafosTexto(state.analise.segundoTempo));
    paginaEvolucao.push(tituloSeccao("MOMENTOS E SITUAÇÕES"));
    linhasTexto(state.analise.destaques).forEach(p => paginaEvolucao.push(new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: "• " + p, size: 18 })] })));
    // situações de jogo (imagens do bucket report-images, com legenda)
    const situacoesWord = await VFNRelatorio.situacoesParaWord({ match_data: state }, supabaseClient, null);
    paginaEvolucao.push(...situacoesWord);
    if (!linhasTexto(state.analise.destaques).length && !situacoesWord.length) paginaEvolucao.push(...paragrafosTexto(""));
    paginaEvolucao.push(new Paragraph({ children: [new PageBreak()] }));

    // ================= ANEXO — FICHA DE JOGO (eventos, linha do tempo, minutos) =================
    const pagina2 = [];
    pagina2.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 }, children: [new TextRun({ text: "FICHA DE JOGO", bold: true, size: 28, color: COR_DARK_KHAKI })] }));
    const eventosOrdenados = [...state.jogo.eventos].sort(compararEventos);
    const eventosColuna = (equipa, cor) => {
      const eventos = eventosOrdenados.filter(ev => ev.equipa === equipa);
      const children = [new Paragraph({ alignment: AlignmentType.CENTER, shading: { type: ShadingType.SOLID, color: cor, fill: cor }, children: [new TextRun({ text: equipa, bold: true, color: "FFFFFF", size: 20 })] })];
      if (!eventos.length) children.push(new Paragraph({ children: [new TextRun({ text: "Sem eventos registados.", italics: true, size: 16 })] }));
      eventos.forEach(ev => children.push(new Paragraph({ spacing: { after: 45 }, children: [new TextRun({ text: `${ICONES_EVENTO[ev.tipo] || "📝"} ${formatarMinuto(ev)} `, bold: true, size: 16 }), new TextRun({ text: `${ev.tipo} — ${nomeOuDetalheEvento(ev)}`, size: 16 })] })));
      return children;
    };
    pagina2.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: SEM_BORDAS, rows: [new TableRow({ children: [
      new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, borders: CELULA_SEM_BORDAS, margins: { right: 200 }, children: eventosColuna("VFN", COR_DARK_KHAKI) }),
      new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, borders: CELULA_SEM_BORDAS, margins: { left: 200 }, children: eventosColuna("Adversário", COR_CHARCOAL) })
    ] })] }));
    const eventosPorMinuto = eventosOrdenados.reduce((mapa, ev) => { const minuto = Number(ev.minuto) || 0; (mapa[minuto] ||= []).push(ev); return mapa; }, {});
    const timelineRows = [0, ...Object.keys(eventosPorMinuto).map(Number).filter(m => m > 0 && m < 90).sort((a, b) => a - b), 45, 90].filter((m, i, arr) => arr.indexOf(m) === i).sort((a, b) => a - b).map(minuto => {
      const eventos = eventosPorMinuto[minuto] || [];
      const esquerda = eventos.filter(ev => ev.equipa === "VFN").map(ev => `${ICONES_EVENTO[ev.tipo] || "📝"} ${formatarMinuto(ev)} ${nomeOuDetalheEvento(ev)}`).join("\n");
      const direita = eventos.filter(ev => ev.equipa === "Adversário").map(ev => `${ICONES_EVENTO[ev.tipo] || "📝"} ${formatarMinuto(ev)} ${nomeOuDetalheEvento(ev)}`).join("\n");
      const neutros = eventos.filter(ev => !ev.equipa).map(ev => `${ICONES_EVENTO[ev.tipo] || "📝"} ${formatarMinuto(ev)} ${ev.tipo}${ev.detalhe ? " — " + ev.detalhe : ""}`);
      const centro = minuto === 45 && !eventos.some(ev => ev.tipo === "Intervalo") ? "│\nIntervalo\n│" : neutros.length ? `│\n${neutros.join("\n")}\n│` : "│";
      return new TableRow({ children: [
        new TableCell({ width: { size: 43, type: WidthType.PERCENTAGE }, borders: CELULA_SEM_BORDAS, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: esquerda || "", size: 15 })] })] }),
        new TableCell({ width: { size: 14, type: WidthType.PERCENTAGE }, borders: { top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, left: { style: BorderStyle.SINGLE, size: 10, color: COR_DARK_KHAKI }, right: { style: BorderStyle.SINGLE, size: 10, color: COR_DARK_KHAKI } }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${minuto}'\n${centro}`, bold: true, size: 14, color: COR_DARK_KHAKI })] })] }),
        new TableCell({ width: { size: 43, type: WidthType.PERCENTAGE }, borders: CELULA_SEM_BORDAS, children: [new Paragraph({ children: [new TextRun({ text: direita || "", size: 15 })] })] })
      ] });
    });
    pagina2.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 220, after: 60 }, children: [new TextRun({ text: "LINHA DO TEMPO", bold: true, size: 20, color: COR_DARK_KHAKI })] }));
    pagina2.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: SEM_BORDAS, rows: timelineRows }));

    // Tabela de minutos jogados
    pagina2.push(new Paragraph({ spacing: { before: 320, after: 120 }, children: [new TextRun({ text: "MINUTOS JOGADOS", bold: true, size: 24, color: COR_DARK_KHAKI })] }));
    const minutosJogadores = calcularMinutosJogadores();
    if (minutosJogadores.length === 0) {
      pagina2.push(new Paragraph({ children: [new TextRun({ text: "Sem dados suficientes para calcular os minutos.", italics: true, size: 18 })] }));
    } else {
      const linhaCabecalhoMin = new TableRow({
        tableHeader: true,
        children: ["Jogador", "Posição", "Minutos"].map(h => new TableCell({
          shading: { type: ShadingType.SOLID, color: COR_DARK_KHAKI, fill: COR_DARK_KHAKI },
          children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, color: "FFFFFF", size: 16 })] })]
        }))
      });
      const linhasMin = minutosJogadores.map(m => new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: m.nome + (eCapitao(m.id) ? " (C)" : ""), size: 16 })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: m.posicao, size: 16 })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: m.minutos + "'", size: 16 })] })] })
        ]
      }));
      pagina2.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [linhaCabecalhoMin, ...linhasMin] }));
    }
    pagina2.push(new Paragraph({ spacing: { before: 80 }, children: [new TextRun({ text: "* Calculado com base nas substituições registadas.", italics: true, size: 14, color: COR_CHARCOAL })] }));

    // ================= 5. ANÁLISE TÁTICA (5 momentos em 2 colunas + adversário) =================
    const pagina3 = [];
    pagina3.push(new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: "ANÁLISE TÁTICA", bold: true, size: 28, color: COR_DARK_KHAKI })] }));

    const blocoSeccao = (sec) => {
      const dados = state.analise.seccoes[sec.key];
      return [
        new Paragraph({
          spacing: { before: 80, after: 60 },
          shading: { type: ShadingType.SOLID, color: COR_DARK_KHAKI, fill: COR_DARK_KHAKI },
          children: [new TextRun({ text: "  " + sec.titulo.toUpperCase(), bold: true, color: COR_OLD_GOLD, size: 20 })]
        }),
        new Paragraph({
          spacing: { after: 60 },
          children: [new TextRun({ text: "● " + valorAvaliacao(dados.avaliacao), bold: true, color: corAvaliacao(dados.avaliacao), size: 18 })]
        }),
        new Paragraph({
          spacing: { after: 160 },
          children: [new TextRun({ text: dados.texto || "Sem notas registadas.", size: 18, italics: !dados.texto })]
        })
      ];
    };

    for (let i = 0; i < SECCOES_TATICAS.length; i += 2) {
      const secEsq = SECCOES_TATICAS[i];
      const secDir = SECCOES_TATICAS[i + 1];
      const celulas = [
        new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, borders: CELULA_SEM_BORDAS, margins: { right: 200 }, children: blocoSeccao(secEsq) })
      ];
      if (secDir) {
        celulas.push(new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, borders: CELULA_SEM_BORDAS, margins: { left: 200 }, children: blocoSeccao(secDir) }));
      } else {
        celulas.push(new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, borders: CELULA_SEM_BORDAS, children: [new Paragraph({ children: [new TextRun({ text: "" })] })] }));
      }
      pagina3.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: SEM_BORDAS, rows: [new TableRow({ children: celulas })] }));
    }

    // adversário: três campos com propósitos distintos
    pagina3.push(new Paragraph({ spacing: { before: 200, after: 80 }, shading: { type: ShadingType.SOLID, color: COR_DARK_KHAKI, fill: COR_DARK_KHAKI }, children: [new TextRun({ text: "  ADVERSÁRIO — " + nomeAdversario.toUpperCase(), bold: true, color: COR_OLD_GOLD, size: 20 })] }));
    [["Estilo de Jogo", state.analise.adversario.estilo], ["Pontos Fortes", state.analise.adversario.pontosFortes], ["Vulnerabilidades", state.analise.adversario.vulnerabilidades]].forEach(([rotulo, texto]) => {
      pagina3.push(new Paragraph({ spacing: { before: 100, after: 40 }, children: [new TextRun({ text: rotulo + ": ", bold: true, size: 18, color: COR_CHARCOAL }), new TextRun({ text: texto || "—", size: 18 })] }));
    });
    const jogadoresChaveValidos = state.analise.adversario.jogadoresChave.filter(jc => jc.nome);
    if (jogadoresChaveValidos.length) {
      pagina3.push(new Paragraph({ spacing: { before: 100, after: 40 }, children: [new TextRun({ text: "Jogadores-Chave", bold: true, size: 18, color: COR_CHARCOAL })] }));
      jogadoresChaveValidos.forEach(jc => {
        const posicaoTxt = jc.posicao ? ` (${jc.posicao})` : "";
        pagina3.push(new Paragraph({ spacing: { after: 30 }, children: [new TextRun({ text: `• ${jc.nome}${posicaoTxt}`, bold: true, size: 18 }), new TextRun({ text: jc.descricao ? " — " + jc.descricao : "", size: 18 })] }));
      });
    }
    if (state.preJogo.notasAdversario) {
      pagina3.push(new Paragraph({ spacing: { before: 100, after: 40 }, children: [new TextRun({ text: "Notas prévias: ", bold: true, size: 18, color: COR_CHARCOAL }), new TextRun({ text: state.preJogo.notasAdversario, size: 18 })] }));
    }

    // ================= 6. TÓPICOS PARA O TREINO (ligados à evolução e à análise) =================
    const pagina4 = [];
    pagina4.push(tituloSeccao("TÓPICOS PARA O TREINO", 360));
    if (dadosRelatorio.aTrabalhar.length) {
      pagina4.push(new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "A partir da análise: " + dadosRelatorio.aTrabalhar.map(s => `${s.titulo} (${s.avaliacao})`).join(", "), italics: true, size: 18, color: COR_CHARCOAL })] }));
    }
    const topicosValidos = linhasTexto(state.analise.topicosTreino);
    if (topicosValidos.length === 0) {
      pagina4.push(new Paragraph({ children: [new TextRun({ text: "— nenhum registado —", italics: true, size: 18 })] }));
    } else {
      topicosValidos.forEach((t, idx) => {
        pagina4.push(new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: `${idx + 1}. ${t}`, size: 18 })] }));
      });
    }
    pagina4.push(new Paragraph({ children: [new PageBreak()] }));
    pagina4.push(new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: "ANEXO", bold: true, size: 18, color: COR_SILVER })] }));

    const footer = new Footer({
      children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "ACD Vila Franca das Naves · Análise Tática · Época 2026/27", size: 16, color: COR_CHARCOAL })]
      })]
    });

    const doc = new Document({
      styles: {
        default: {
          document: {
            run: { font: "Roboto", size: 20 }
          }
        }
      },
      sections: [{
        properties: {},
        footers: { default: footer },
        children: [...pagina1, ...paginaEvolucao, ...pagina3, ...pagina4, ...pagina2]
      }]
    });

    const blob = await Packer.toBlob(doc);
    // o jogo fica registado: jogos e minutos passam a contar nas estatísticas
    state.jogo.presencasAplicadas = true;
    sincronizarStatsJogadores();
    guardarRascunho();
    // relatório ligado a um jogo: atualiza a mesma linha; sem jogo, mantém o registo antigo
    if (state.preJogo.matchId && typeof guardarRelatorioDoJogo === "function") await guardarRelatorioDoJogo();
    else await guardarRelatorioSupabase();
    await registarResultadoNoCalendario();
    const nomeFicheiro = `Relatorio_${sanitizarNomeFicheiro(state.preJogo.adversario)}_J${state.preJogo.jornada || "0"}_${state.preJogo.data || "sem-data"}.docx`;
    descarregarBlob(blob, nomeFicheiro);

  } catch (err) {
    console.error(err);
    alert("Ocorreu um erro ao gerar o relatório Word. Verifica a consola para mais detalhes.");
  } finally {
    btn.disabled = false;
    btn.textContent = textoOriginal;
  }
}

/* =========================================================
   INICIALIZAÇÃO
   ========================================================= */

let plantelDoSupabase = false;

// a aplicação só se inicia uma vez: vários eventos de autenticação seguidos (SIGNED_IN, INITIAL_SESSION,
// renovação do token) ou sair e voltar a entrar duplicavam todos os listeners (ex.: "+ Marcador" a inserir 2)
let aplicacaoIniciada = false;

function initAplicacao() {
  if (aplicacaoIniciada) return;
  aplicacaoIniciada = true;
  if (!plantelDoSupabase) carregarPlantel();
  // primeiro login com Supabase vazio: envia o plantel local para a tabela players
  if (!plantelDoSupabase && supabaseClient && currentUser) sincronizarPlantelSupabase();
  initLogo();
  initTabs();
  initPreJogo();
  initJogo();
  initAnalise();
  initPlantel();
  initLimparFormulario();
  if (typeof initAdmin === "function") initAdmin();
  VFN.initAOS();

  renderTudo();
  atualizarEstatisticasEpoca(); // volta a calcular quando o calendário carrega

  initRascunho();
  carregarCalendario();
  setInterval(renderProximoJogoPreJogo, 60000); // atualiza a contagem decrescente

  el("btnGenerateDocx").addEventListener("click", gerarRelatorioWord);
}

function mostrarAplicacao() {
  el("loginScreen").hidden = true;
  el("appShell").hidden = false;
  el("sidebarUserName").textContent = currentUser ? (currentUser.user_metadata && (currentUser.user_metadata.full_name || currentUser.user_metadata.name) || currentUser.email) : "Modo local";
}

/** O modo local (sem login, dados no localStorage) só existe no computador de desenvolvimento. */
const MODO_LOCAL_PERMITIDO = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) || location.protocol === "file:";

function mostrarLogin(mensagem) {
  el("appShell").hidden = true;
  el("loginScreen").hidden = false;
  // no site publicado, se a biblioteca do Supabase não carregar NÃO há alternativa sem login
  const semSupabase = !supabaseConfigurado();
  el("btnLocalMode").hidden = !(semSupabase && MODO_LOCAL_PERMITIDO);
  el("loginMessage").textContent = mensagem || (semSupabase && !MODO_LOCAL_PERMITIDO ? "Não foi possível ligar ao servidor. Verifica a ligação à internet e recarrega a página." : "");
}

let aEntrar = false; // entrada em curso (à espera do plantel): ignora eventos de autenticação repetidos

/**
 * A área de administração é só para o papel "admin". Jogadores vão para a Área do Jogador e
 * treinador/dirigentes para o dashboard (a sessão mantém-se); outras contas saem.
 */
let adminVerificado = ""; // id da conta já confirmada como admin (as renovações do token não voltam a verificar)

async function acessoAdminPermitido() {
  if (currentUser && currentUser.id === adminVerificado) return true;
  const a = await VFN.acessoDoUtilizador(supabaseClient, currentUser);
  if (a.papel === "admin") { adminVerificado = currentUser.id; return true; }
  adminVerificado = "";
  if (a.papel === "jogador") { location.replace("equipa.html"); return false; }
  if (a.papel === "treinador" || a.papel === "dirigente") { location.replace("dashboard.html"); return false; }
  if (!a.erro) await supabaseClient.auth.signOut();
  mostrarLogin(a.erro ? "Não foi possível confirmar o teu acesso. Verifica a ligação e tenta de novo." : "Esta conta não tem acesso à área de administração.");
  return false;
}

async function iniciarAutenticacao() {
  iniciarSupabase();
  if (supabaseClient) {
    const { data } = await supabaseClient.auth.getSession();
    if (data.session) {
      currentUser = data.session.user;
      aEntrar = true;
      if (await acessoAdminPermitido()) { plantelDoSupabase = await carregarPlantelSupabase(); mostrarAplicacao(); initAplicacao(); const draft = await carregarRascunhoSupabase(); if (draft) mostrarBannerRascunho(draft); }
      aEntrar = false;
    } else mostrarLogin();
    supabaseClient.auth.onAuthStateChange(async (_event, session) => {
      currentUser = session && session.user;
      if (currentUser && !aplicacaoIniciada && !aEntrar) {
        aEntrar = true;
        if (await acessoAdminPermitido()) { plantelDoSupabase = await carregarPlantelSupabase(); mostrarAplicacao(); initAplicacao(); }
        aEntrar = false;
      } else if (currentUser && aplicacaoIniciada && !aEntrar) {
        // voltou a entrar depois de sair: pode ser outra conta, por isso confirma outra vez
        aEntrar = true;
        if (await acessoAdminPermitido()) mostrarAplicacao();
        aEntrar = false;
      }
      if (!currentUser && _event !== "INITIAL_SESSION") mostrarLogin("Sessão terminada.");
    });
  } else mostrarLogin();
  el("loginForm").addEventListener("submit", async event => {
    event.preventDefault();
    if (!supabaseClient) return;
    const { error } = await supabaseClient.auth.signInWithPassword({ email: el("loginEmail").value, password: el("loginPassword").value });
    if (error) el("loginMessage").textContent = error.message;
  });
  el("btnLocalMode").addEventListener("click", () => { if (!MODO_LOCAL_PERMITIDO || supabaseConfigurado()) return; localMode = true; mostrarAplicacao(); initAplicacao(); });
  el("btnLogout").addEventListener("click", async () => { if (supabaseClient) await supabaseClient.auth.signOut(); else { localMode = false; mostrarLogin(); } });
}

function mostrarBannerRascunho(armazenado) {
  el("draftBannerText").textContent = `Tens um rascunho de ${formatarDataHora(armazenado.savedAt)}. Carregar?`;
  el("draftBanner").hidden = false;
  el("btnLoadDraft").onclick = () => { aplicarDadosEstado(armazenado.data); renderTudo(); el("draftBanner").hidden = true; };
}

document.addEventListener("DOMContentLoaded", iniciarAutenticacao);
