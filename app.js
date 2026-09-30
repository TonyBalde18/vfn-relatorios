"use strict";

/* =========================================================
   DADOS DE BASE
   ========================================================= */

const FORMACOES = ["4-3-3", "4-4-2", "4-4-2 Losango", "4-2-3-1", "3-5-2", "5-3-2"];

const FORMACOES_SLOTS = {
  "4-3-3": [
    { label: "GR", x: 50, y: 93 },
    { label: "DD", x: 83, y: 75 }, { label: "DC", x: 62, y: 80 }, { label: "DC", x: 38, y: 80 }, { label: "DE", x: 17, y: 75 },
    { label: "MCen", x: 28, y: 55 }, { label: "MCen", x: 50, y: 58 }, { label: "MCen", x: 72, y: 55 },
    { label: "EE", x: 17, y: 25 }, { label: "PL", x: 50, y: 15 }, { label: "ED", x: 83, y: 25 }
  ],
  "4-4-2": [
    { label: "GR", x: 50, y: 93 },
    { label: "DD", x: 83, y: 75 }, { label: "DC", x: 62, y: 80 }, { label: "DC", x: 38, y: 80 }, { label: "DE", x: 17, y: 75 },
    { label: "ED", x: 83, y: 50 }, { label: "MCen", x: 60, y: 52 }, { label: "MCen", x: 40, y: 52 }, { label: "EE", x: 17, y: 50 },
    { label: "PL", x: 38, y: 20 }, { label: "PL", x: 62, y: 20 }
  ],
  "4-4-2 Losango": [
    { label: "GR", x: 50, y: 93 },
    { label: "DD", x: 83, y: 75 }, { label: "DC", x: 62, y: 80 }, { label: "DC", x: 38, y: 80 }, { label: "DE", x: 17, y: 75 },
    { label: "MDef", x: 50, y: 62 }, { label: "ED", x: 76, y: 47 }, { label: "EE", x: 24, y: 47 }, { label: "MOfe", x: 50, y: 33 },
    { label: "PL", x: 38, y: 16 }, { label: "PL", x: 62, y: 16 }
  ],
  "4-2-3-1": [
    { label: "GR", x: 50, y: 93 },
    { label: "DD", x: 83, y: 75 }, { label: "DC", x: 62, y: 80 }, { label: "DC", x: 38, y: 80 }, { label: "DE", x: 17, y: 75 },
    { label: "MDef", x: 38, y: 60 }, { label: "MDef", x: 62, y: 60 },
    { label: "EE", x: 18, y: 36 }, { label: "MOfe", x: 50, y: 38 }, { label: "ED", x: 82, y: 36 },
    { label: "PL", x: 50, y: 14 }
  ],
  "3-5-2": [
    { label: "GR", x: 50, y: 93 },
    { label: "DC", x: 70, y: 78 }, { label: "DC", x: 50, y: 81 }, { label: "DC", x: 30, y: 78 },
    { label: "DD", x: 90, y: 55 }, { label: "MCen", x: 65, y: 52 }, { label: "MCen", x: 50, y: 55 }, { label: "MCen", x: 35, y: 52 }, { label: "DE", x: 10, y: 55 },
    { label: "PL", x: 38, y: 18 }, { label: "PL", x: 62, y: 18 }
  ],
  "5-3-2": [
    { label: "GR", x: 50, y: 93 },
    { label: "DD", x: 90, y: 75 }, { label: "DC", x: 68, y: 80 }, { label: "DC", x: 50, y: 82 }, { label: "DC", x: 32, y: 80 }, { label: "DE", x: 10, y: 75 },
    { label: "MCen", x: 30, y: 50 }, { label: "MCen", x: 50, y: 53 }, { label: "MCen", x: 70, y: 50 },
    { label: "PL", x: 38, y: 20 }, { label: "PL", x: 62, y: 20 }
  ]
};

const COMPETICOES = ["2ª LIGA FUTEBOL ZERO GRAUS PRODUÇÕES", "TAÇA 2ª LIGA - FDM", "TAÇA DE HONRA COMUNILOG", "Amigável"];
const TIPOS_EVENTO = ["Golo", "Auto-golo", "Golo Anulado", "Penalty Falhado", "Cartão Amarelo", "Cartão Vermelho", "Lesão", "Substituição", "Tempo Acrescentado", "Nota"];
// emojis só para o Word e para as <option>; na interface usam-se ícones Lucide
const ICONES_LUCIDE_EVENTO = {
  "Golo": "goal", "Auto-golo": "goal", "Golo Anulado": "circle-slash", "Penalty Falhado": "circle-x",
  "Cartão Amarelo": "square", "Cartão Vermelho": "square", "Lesão": "bandage",
  "Substituição": "repeat", "Tempo Acrescentado": "timer", "Nota": "sticky-note"
};
const ICONES_EVENTO = {
  "Golo": "⚽", "Auto-golo": "🟥⚽", "Golo Anulado": "⚽❌", "Penalty Falhado": "🔴",
  "Cartão Amarelo": "🟨", "Cartão Vermelho": "🟥", "Lesão": "🤕",
  "Substituição": "🔄", "Tempo Acrescentado": "⏱️", "Nota": "📝"
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
      coachpad: null, // { dataUrl, tipo, largura, altura }
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
      positivos: "",
      aMelhorar: "",
      adversario: {
        estilo: "",
        jogadoresChave: [],
        pontosFortes: "",
        vulnerabilidades: ""
      },
      topicosTreino: ""
    }
  };
}

let state = estadoInicial();
let plantel = [];
let jogadorEmEdicao = null;
let pesquisaEquipa = "";
let filtroPosicaoEquipa = "";
let posicoesModal = [];
let posicaoPrincipalModal = "";
// campo vertical (ataque em cima); DC centrado na mesma vertical do MDef
const POSICOES_MAPA = { GR: [50, 92], DC: [50, 77], DD: [85, 70], DE: [15, 70], MDef: [50, 61], MCen: [50, 46], MOfe: [50, 31], ED: [84, 21], EE: [16, 21], PL: [50, 9] };
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

async function carregarEstatisticasEpocaSupabase() {
  const vazio = { jogos: 0, vitorias: 0, empates: 0, derrotas: 0, marcados: 0, sofridos: 0 };
  if (!supabaseClient || !currentUser) { renderSeasonStats(vazio); return; }
  const { data, error } = await supabaseClient.from("match_reports").select("match_data").eq("user_id", currentUser.id);
  if (error || !data) { renderSeasonStats(vazio); return; }
  const stats = data.reduce((acc, row) => {
    const jogo = row.match_data || {}; const pre = jogo.preJogo || {}; const jogoData = jogo.jogo || {};
    const eventos = jogoData.eventos || []; let vfn = Number(jogoData.golosVFN) || 0; let adv = Number(jogoData.golosAdversario) || 0;
    if (eventos.length) { vfn = 0; adv = 0; eventos.forEach(evento => { if (evento.tipo !== "Golo" && evento.tipo !== "Auto-golo") return; const vfnMarca = evento.tipo === "Golo" ? evento.equipa === "VFN" : evento.equipa !== "VFN"; if (vfnMarca) vfn++; else adv++; }); }
    acc.jogos++; acc.marcados += vfn; acc.sofridos += adv; if (vfn > adv) acc.vitorias++; else if (vfn === adv) acc.empates++; else acc.derrotas++; return acc;
  }, vazio);
  renderSeasonStats(stats);
}

function renderSeasonStats(stats) {
  const container = el("seasonStatsCard");
  if (!container) return;
  container.innerHTML = `<h2 class="section-title">Estatísticas Rápidas da Época</h2><div class="season-stats-grid">${[["Jogos", stats.jogos], ["Vitórias", stats.vitorias], ["Empates", stats.empates], ["Derrotas", stats.derrotas], ["Golos marcados", stats.marcados], ["Golos sofridos", stats.sofridos]].map(([label, value]) => `<div class="season-stat"><strong>${value}</strong><span>${label}</span></div>`).join("")}</div>${stats.jogos === 0 ? '<small class="season-empty">Ainda não existem relatórios guardados.</small>' : ""}`;
}

async function guardarRelatorioSupabase() {
  if (!supabaseClient || !currentUser) return;
  const { error } = await supabaseClient.from("match_reports").insert({ user_id: currentUser.id, match_data: state, updated_at: new Date().toISOString() });
  if (error) console.warn("Não foi possível guardar o relatório:", error.message);
}

async function sincronizarPlantelSupabase() {
  if (!supabaseClient || !currentUser) return;
  const rows = plantel.map(p => ({ id: idJogadorBD(p), user_id: currentUser.id, name: p.nome, display_name: p.nome || null, full_name: p.nomeCompleto || null, date_of_birth: p.nascimento || null, position: p.posicao, number: p.numero || null, photo_url: p.fotoUrl || null, attributes: p.attributes || {}, stats: { ...(p.stats || {}), jogos: p.jogos || 0, golos: p.golos || 0, assistencias: p.assistencias || 0, cartoesA: p.cartoesAmarelos || 0, cartoesV: p.cartoesVermelhos || 0, minutos: p.minutosTotais || 0, nacionalidade: p.nacionalidade || "", nascimento: p.nascimento || "", pePreferencial: p.pePreferencial || "", altura: p.altura || "", peso: p.peso || "", notas: p.notas || "" } }));
  if (!rows.length) return;
  const { error } = await supabaseClient.from("players").upsert(rows, { onConflict: "id" });
  if (error) console.warn("Não foi possível sincronizar o plantel:", error.message);
}

let temporizadorPlantel = null;
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
    posicao: p.posicao || "—",
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
    return migrarJogador({ id, idBD: texto, nome: p.display_name || p.name, nomeCompleto: p.full_name || "", nascimento: p.date_of_birth || "", posicao: p.position, numero: p.number, fotoUrl: p.photo_url, attributes: p.attributes, stats: p.stats });
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
    try {
      const copiaSemImagem = JSON.parse(JSON.stringify(state));
      if (copiaSemImagem.jogo) copiaSemImagem.jogo.coachpad = null;
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ savedAt: new Date().toISOString(), data: copiaSemImagem }));
    } catch (e2) { /* ignora */ }
  }
  sincronizarRascunhoSupabase();
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
  state.preJogo.proximoJogo = Object.assign(base.preJogo.proximoJogo, dados.preJogo && dados.preJogo.proximoJogo || {});
  state.jogo = Object.assign(base.jogo, dados.jogo);
  state.jogo.eventos = (state.jogo.eventos || []).map(migrarEvento);
  // rascunhos antigos: considera os eventos já refletidos no plantel para não os contar duas vezes
  if (!dados.jogo || !dados.jogo.statsAplicadas) state.jogo.statsAplicadas = contribuicaoDoJogo();
  state.analise = Object.assign(base.analise, dados.analise || {});
  if (Array.isArray(state.analise.positivos)) state.analise.positivos = state.analise.positivos.filter(Boolean).join("\n");
  if (Array.isArray(state.analise.aMelhorar)) state.analise.aMelhorar = state.analise.aMelhorar.filter(Boolean).join("\n");
  if (Array.isArray(state.analise.topicosTreino)) state.analise.topicosTreino = state.analise.topicosTreino.filter(Boolean).join("\n");
  if (dados.analise && dados.analise.seccoes) {
    state.analise.seccoes = Object.assign(base.analise.seccoes, dados.analise.seccoes);
  }
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
  const titulos = { "pre-jogo": "Pré-Jogo", jogo: "Jogo", analise: "Análise", equipa: "Equipa", multas: "Multas", presencas: "Presenças", calendario: "Calendário", resultados: "Resultados", classificacao: "Classificação", adversarios: "Adversários" };
  botoes.forEach(btn => {
    btn.addEventListener("click", () => {
      guardarRascunho(); // preserva dados sempre que se muda de separador
      botoes.forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      el("tab-" + btn.dataset.tab).classList.add("active");
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
  el("pjCompeticao").addEventListener("change", e => { state.preJogo.competicao = e.target.value; atualizarSponsorsAdmin(); });
  el("pjAdversario").addEventListener("change", e => escolherAdversario(e.target.value));
  el("pjFormacaoPrevista").addEventListener("change", e => state.preJogo.formacaoPrevista = e.target.value);
  el("pjNotasAdversario").addEventListener("input", e => state.preJogo.notasAdversario = e.target.value);

  el("coachpadInputPre").addEventListener("change", handleCoachpadUpload);
  el("btnRemoveCoachpadPre").addEventListener("click", () => {
    state.jogo.coachpad = null;
    renderCoachpad();
  });

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
  if (url) return `<img class="team-logo" src="${escapeHtml(url)}" alt="Logótipo ${escapeHtml(nome)}">`;
  const iniciais = String(nome || "?").split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join("").toUpperCase();
  return `<span class="team-logo-placeholder" aria-hidden="true">${escapeHtml(iniciais)}</span>`;
}

function nomeAdversarioJogo(jogo) {
  const equipa = equipaPorId(jogo.opponent_team_id);
  return (equipa && equipa.name) || jogo.opponent || "Adversário";
}

function renderProximoJogoPreJogo() {
  const container = el("nextMatchBody");
  if (!container) return;
  renderOpcoesPreJogo(); // o calendário ou as equipas podem ter mudado
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
      <span><span class="comp-tag comp-${VFN.categoriaCompeticao(jogo.competition)}">${escapeHtml(VFN.nomeCurtoCompeticao(jogo.competition))}</span>${jogo.jornada ? ` · Jornada ${escapeHtml(jogo.jornada)}` : ""} · ${casa ? "Casa" : "Fora"}</span>
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
  state.preJogo.matchId = jogo.id;
  state.preJogo.jornada = jogo.jornada != null ? String(jogo.jornada) : "";
  state.preJogo.data = VFN.dataIso(jogo.date);
  if (jogo.competition) state.preJogo.competicao = jogo.competition;
  state.preJogo.casaFora = VFN.jogoEmCasa(jogo) ? "Casa" : "Fora";
  state.preJogo.adversario = nomeAdversarioJogo(jogo);
  state.preJogo.adversarioId = jogo.opponent_team_id || "";
  renderPreJogo();
  atualizarSponsorsAdmin();
  guardarRascunho();
}

/** Ao gerar o relatório, grava o resultado no jogo do calendário associado. */
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
  try {
    const gravado = await dadosClube.guardar("matches", atualizado);
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
let calendarioCarregado = false;

async function carregarCalendario() {
  try {
    [jogosCalendario, equipasCalendario] = await Promise.all([dadosClube.listar("matches"), dadosClube.listar("teams")]);
  } catch (e) {
    console.warn("Não foi possível carregar o calendário:", e.message || e);
  }
  calendarioCarregado = true;
  renderProximoJogoPreJogo();
  if (typeof renderCalendarioAdmin === "function") renderCalendarioAdmin();
  if (typeof renderResultados === "function") { renderResultados(); renderClassificacaoAdmin(); }
}

/* ---- Sponsors no rodapé: AF Guarda + sponsor da competição do relatório ---- */

function atualizarSponsorsAdmin() {
  VFN.renderSponsors(el("sponsorFooter"), state.preJogo.competicao);
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

  el("coachpadInput").addEventListener("change", handleCoachpadUpload);
  el("btnRemoveCoachpad").addEventListener("click", () => {
    state.jogo.coachpad = null;
    renderCoachpad();
  });
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

const COACHPAD_LADO_MAX = 1600;

/**
 * Carrega a imagem do CoachPad (pré-jogo ou jogo) e reduz para no máximo 1600px,
 * para caber no rascunho (localStorage/Supabase) e no Word.
 */
function handleCoachpadUpload(e) {
  const input = e.target;
  const file = input.files[0];
  if (!file) return;
  if (!/^image\//.test(file.type)) { alert("Escolhe um ficheiro de imagem (PNG ou JPG)."); input.value = ""; return; }
  const reader = new FileReader();
  reader.onerror = () => alert("Não foi possível ler a imagem do CoachPad.");
  reader.onload = function (ev) {
    const img = new Image();
    img.onerror = () => alert("Formato de imagem não suportado. Usa PNG ou JPG.");
    img.onload = function () {
      const escala = Math.min(1, COACHPAD_LADO_MAX / Math.max(img.naturalWidth, img.naturalHeight));
      const largura = Math.round(img.naturalWidth * escala);
      const altura = Math.round(img.naturalHeight * escala);
      const canvas = document.createElement("canvas");
      canvas.width = largura;
      canvas.height = altura;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#FFFFFF"; // fundo branco para PNG transparentes convertidos em JPG
      ctx.fillRect(0, 0, largura, altura);
      ctx.drawImage(img, 0, 0, largura, altura);
      state.jogo.coachpad = { dataUrl: canvas.toDataURL("image/jpeg", 0.85), tipo: "jpg", largura, altura };
      renderCoachpad();
      guardarRascunho();
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
  input.value = "";
}

function renderCoachpad() {
  [["coachpadPreview", "coachpadImg", "btnRemoveCoachpad"], ["coachpadPreviewPre", "coachpadImgPre", "btnRemoveCoachpadPre"]].forEach(([previewId, imgId, btnId]) => {
    const preview = el(previewId);
    if (!preview) return;
    if (state.jogo.coachpad) el(imgId).src = state.jogo.coachpad.dataUrl;
    preview.hidden = !state.jogo.coachpad;
    el(btnId).hidden = !state.jogo.coachpad;
  });
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
function renderPitch() {
  const pitch = el("pitch");
  pitch.innerHTML = "";
  const slots = FORMACOES_SLOTS[state.jogo.formacaoVFN] || FORMACOES_SLOTS["4-3-3"];

  slots.forEach((slot, idx) => {
    const jogadorId = state.jogo.titulares[idx];
    const div = document.createElement("div");
    div.className = "pitch-slot" + (jogadorId ? "" : " empty");
    div.style.left = slot.x + "%";
    div.style.top = slot.y + "%";

    const labelSpan = document.createElement("span");
    labelSpan.className = "slot-label";
    labelSpan.textContent = slot.label;
    div.appendChild(labelSpan);

    if (jogadorId) {
      const nameSpan = document.createElement("span");
      nameSpan.className = "slot-name";
      nameSpan.textContent = nomeJogador(jogadorId).split(" ")[0];
      div.appendChild(nameSpan);
    }

    pitch.appendChild(div);
  });
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

    const valorAtual = state.jogo.titulares[idx];
    const select = document.createElement("select");
    select.innerHTML = opcoesJogadoresHTML(valorAtual, { excludeIds: idsUsadosExcluindo(valorAtual) });
    select.addEventListener("change", () => {
      state.jogo.titulares[idx] = select.value ? Number(select.value) : null;
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
  ev.equipa = ev.equipa === "Adversário" ? "Adversário" : "VFN";
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

function renderTimeline() {
  const container = el("matchTimeline");
  if (!container) return;
  const duracao = 90;
  container.innerHTML = `<div class="timeline-track"><span class="timeline-half"></span><span class="timeline-label start">0'</span><span class="timeline-label half">45'</span><span class="timeline-label end">${duracao}'</span></div>`;
  const track = container.querySelector(".timeline-track");
  state.jogo.eventos.forEach(ev => {
    const marker = document.createElement("div");
    marker.className = `timeline-event ${ev.equipa === "VFN" ? "vfn" : "adv"}`;
    marker.dataset.type = ev.tipo;
    marker.style.left = `${Math.min(100, Math.max(0, Number(ev.minuto) || 0) / duracao * 100)}%`;
    marker.title = `${formatarMinuto(ev)} ${ev.tipo} — ${nomeOuDetalheEvento(ev)}`;
    marker.innerHTML = VFN.icone(ICONES_LUCIDE_EVENTO[ev.tipo] || "sticky-note", 18);
    const label = document.createElement("span");
    label.textContent = formatarMinuto(ev);
    marker.appendChild(label);
    track.appendChild(marker);
  });
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
  if (state.jogo.presencasAplicadas) {
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
  if (!mudou) return;
  try { localStorage.setItem(PLANTEL_KEY, JSON.stringify(plantel)); } catch (e) { /* ignora */ }
  sincronizarPlantelDiferido();
  if (el("plantelBody")) renderPlantel();
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
    selectEquipa.innerHTML = ["VFN", "Adversário"].map(e => `<option value="${e}" ${e === ev.equipa ? "selected" : ""}>${e}</option>`).join("");
    selectEquipa.addEventListener("change", () => { ev.equipa = selectEquipa.value; ev.jogadorId = ""; ev.jogadorSaiId = ""; ev.assistId = ""; renderEventos(false); });
    tdEquipa.appendChild(selectEquipa);

    const tdTipo = document.createElement("td");
    const selectTipo = document.createElement("select");
    selectTipo.innerHTML = TIPOS_EVENTO.map(t => `<option value="${t}" ${t === ev.tipo ? "selected" : ""}>${t}</option>`).join("");
    selectTipo.addEventListener("change", () => { ev.tipo = selectTipo.value; if (ev.tipo !== "Golo") ev.assistId = ""; renderEventos(false); });
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
  el("jgFormacaoVFN").value = state.jogo.formacaoVFN;
  el("jgFormacaoAdv").value = state.jogo.formacaoAdversario;
  renderPitch();
  renderTitulares();
  renderBench();
  renderFormacaoAdversarioOutro();
  renderCoachpad();
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
      });
    });

    const textarea = card.querySelector("textarea");
    textarea.addEventListener("input", () => {
      state.analise.seccoes[sec.key].texto = textarea.value;
    });
  });

  el("btnAddJogadorChave").addEventListener("click", () => { state.analise.adversario.jogadoresChave.push({ nome: "", posicao: "", descricao: "" }); renderJogadoresChave(); });
  el("positivosText").addEventListener("input", e => state.analise.positivos = e.target.value);
  el("melhorarText").addEventListener("input", e => state.analise.aMelhorar = e.target.value);
  el("topicosText").addEventListener("input", e => state.analise.topicosTreino = e.target.value);

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
  el("positivosText").value = state.analise.positivos;
  el("melhorarText").value = state.analise.aMelhorar;
  el("topicosText").value = state.analise.topicosTreino;

  renderAnalysisSummary();

  el("advEstilo").value = state.analise.adversario.estilo;
  el("advPontosFortes").value = state.analise.adversario.pontosFortes;
  el("advVulnerabilidades").value = state.analise.adversario.vulnerabilidades;
}

function renderAnalysisSummary() {
  const avaliadas = Object.values(state.analise.seccoes).filter(sec => sec.avaliacao).length;
  const resultado = `${state.jogo.golosVFN} - ${state.jogo.golosAdversario}`;
  el("analysisSummary").innerHTML = `
    <h2>Resumo rápido</h2>
    <div><span class="summary-label">Resultado</span><span class="summary-value">${escapeHtml(resultado)}</span></div>
    <div><span class="summary-label">Formação</span><span class="summary-value">${escapeHtml(state.jogo.formacaoVFN)}</span></div>
    <div><span class="summary-label">Nº eventos</span><span class="summary-value">${state.jogo.eventos.length}</span></div>
    <div><span class="summary-label">Avaliações preenchidas</span><span class="summary-value">${avaliadas}/5</span></div>
  `;
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
    const posicao = el("modalPosicao").value.trim();
    const numero = el("modalNumero").value.trim();
    if (!nome) { el("modalNome").focus(); return; }
    const jogador = jogadorEmEdicao || jogadorBase(proximoIdPlantel(), nome, posicao || "—", numero);
    jogador.nome = nome; jogador.nomeCompleto = nomeCompleto; jogador.posicao = posicao || "—"; jogador.numero = numero; jogador.fotoUrl = el("modalFoto").value.trim();
      const fotoSupabase = await carregarFotoParaSupabase(el("modalFotoUpload").files[0], jogador.id);
      if (fotoSupabase) jogador.fotoUrl = fotoSupabase;
    jogador.nascimento = el("modalNascimento").value; jogador.pePreferencial = el("modalPe").value;
    jogador.posicao = posicoesModal.join("/") || jogador.posicao;
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
  el("modalPosicao").addEventListener("input", () => { posicoesModal = el("modalPosicao").value.split("/").filter(Boolean); posicaoPrincipalModal = posicoesModal[0] || ""; renderPositionMap(); });
  el("teamSearch").addEventListener("input", event => { pesquisaEquipa = event.target.value.toLocaleLowerCase("pt-PT"); renderPlantel(); });
  el("teamPositionFilter").addEventListener("change", event => { filtroPosicaoEquipa = event.target.value; renderPlantel(); });

  el("btnExportarPlantel").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(plantel, null, 2)], { type: "application/json" });
    descarregarBlob(blob, "plantel_vfn.json");
  });
}

function abrirModalJogador() {
  jogadorEmEdicao = null;
  el("modalNome").value = "";
  el("modalNomeCompleto").value = "";
  el("modalPosicao").value = "";
  el("modalNumero").value = "";
  el("modalFoto").value = "";
  el("modalFotoUpload").value = "";
  el("modalNascimento").value = ""; el("modalPe").value = "";
  posicoesModal = []; posicaoPrincipalModal = "";
  renderPositionMap(); renderPlayerModalHeader(null);
  el("modalOverlay").hidden = false;
  el("modalNome").focus();
}

function abrirModalExistente(jogador) {
  jogadorEmEdicao = jogador;
  el("modalNome").value = jogador.nome;
  el("modalNomeCompleto").value = jogador.nomeCompleto || "";
  el("modalPosicao").value = jogador.posicao;
  el("modalNumero").value = jogador.numero;
  el("modalFoto").value = jogador.fotoUrl || "";
  el("modalFotoUpload").value = "";
  el("modalNascimento").value = jogador.nascimento || ""; el("modalPe").value = jogador.pePreferencial || "";
  posicoesModal = (jogador.posicao || "").split("/").filter(Boolean); posicaoPrincipalModal = posicoesModal[0] || "";
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
}

function renderPlayerModalHeader(jogador) {
  const photo = el("playerModalPhoto");
  const numero = jogador ? jogador.numero : el("modalNumero").value;
  photo.innerHTML = jogador && jogador.fotoUrl ? `<img src="${escapeHtml(jogador.fotoUrl)}" alt="Fotografia de ${escapeHtml(jogador.nome)}">` : generateJerseyAvatar(numero);
  el("playerModalName").textContent = jogador ? (jogador.nomeCompleto || jogador.nome) : "Adicionar Jogador";
  el("playerModalMeta").textContent = jogador ? `${jogador.posicao || "—"} · Nº ${jogador.numero || "—"}${jogador.nascimento ? ` · ${VFN.dataDDMMAAAA(jogador.nascimento)}` : ""}${jogador.pePreferencial ? ` · Pé ${jogador.pePreferencial}` : ""}` : "Ficha do jogador";
  const stats = jogador || { golos: 0, assistencias: 0, minutosTotais: 0 };
  el("playerModalMainStats").innerHTML = [["Golos", stats.golos || 0], ["Assistências", stats.assistencias || 0], ["Minutos", stats.minutosTotais || 0]].map(([label, value]) => `<div class="player-modal-stat"><strong>${value}</strong><span>${label}</span></div>`).join("");
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
    const matchesPosition = !filtroPosicaoEquipa || (filtroPosicaoEquipa === "Def" ? /DC|DD|DE/.test(posicao) : filtroPosicaoEquipa === "Meio" ? /MDEF|MCEN|MOFE|EE|ED/.test(posicao) : filtroPosicaoEquipa === "Ata" ? /PL|EE|ED/.test(posicao) : posicao.includes(filtroPosicaoEquipa.toUpperCase()));
    return matchesSearch && matchesPosition;
  }).sort((a, b) => a.nome.localeCompare(b.nome, "pt"));

  ordenado.forEach(j => {
    const tr = document.createElement("tr");

    const tdFoto = document.createElement("td");
    tdFoto.innerHTML = VFN.avatarJogador(j, "avatar-sm");
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

  container.appendChild(criarStatCard("Top 3 Golos", "goal", topGolos, p => `${p.nome} — ${p.golos}`));
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

    const caixaLogo = (texto) => new TableCell({
      width: { size: 34, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.DASHED, size: 6, color: COR_OLD_GOLD },
        bottom: { style: BorderStyle.DASHED, size: 6, color: COR_OLD_GOLD },
        left: { style: BorderStyle.DASHED, size: 6, color: COR_OLD_GOLD },
        right: { style: BorderStyle.DASHED, size: 6, color: COR_OLD_GOLD }
      },
      margins: { top: 500, bottom: 500 },
      children: [
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
      rows: [new TableRow({ children: [caixaLogo("Logo VFN"), caixaResultado, caixaLogo("Logo " + nomeAdversario)] })]
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

    if (state.preJogo.notasAdversario) {
      pagina1.push(new Paragraph({ spacing: { before: 300, after: 60 }, children: [new TextRun({ text: "Notas Prévias Sobre o Adversário", bold: true, size: 20, color: COR_DARK_KHAKI })] }));
      pagina1.push(new Paragraph({ children: [new TextRun({ text: state.preJogo.notasAdversario, size: 18 })] }));
    }

    pagina1.push(new Paragraph({ children: [new PageBreak()] }));

    // ================= PÁGINA 2 — FICHA DE JOGO =================
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
      const centro = minuto === 45 ? "│\nIntervalo\n│" : "│";
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
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: m.nome, size: 16 })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: m.posicao, size: 16 })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: m.minutos + "'", size: 16 })] })] })
        ]
      }));
      pagina2.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [linhaCabecalhoMin, ...linhasMin] }));
    }
    pagina2.push(new Paragraph({ spacing: { before: 80 }, children: [new TextRun({ text: "* Calculado com base nas substituições registadas.", italics: true, size: 14, color: COR_CHARCOAL })] }));

    if (state.jogo.coachpad) {
      try {
        const buf = dataUrlParaArrayBuffer(state.jogo.coachpad.dataUrl);
        const larguraMax = 460;
        const escala = Math.min(1, larguraMax / state.jogo.coachpad.largura);
        const w = Math.round(state.jogo.coachpad.largura * escala);
        const h = Math.round(state.jogo.coachpad.altura * escala);
        pagina2.push(new Paragraph({
          spacing: { before: 320 },
          alignment: AlignmentType.CENTER,
          children: [new ImageRun({ data: buf, type: state.jogo.coachpad.tipo === "png" ? "png" : "jpg", transformation: { width: w, height: h } })]
        }));
        pagina2.push(new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 60 },
          children: [new TextRun({ text: "Posicionamento Tático", italics: true, size: 18, color: COR_CHARCOAL })]
        }));
      } catch (e) { /* imagem inválida - ignora */ }
    }

    pagina2.push(new Paragraph({ children: [new PageBreak()] }));

    // ================= PÁGINA 3 — ANÁLISE TÁTICA (2 colunas) =================
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

    pagina3.push(new Paragraph({ children: [new PageBreak()] }));

    // ================= PÁGINA 4 — SÍNTESE =================
    const pagina4 = [];

    const blocoPositivos = [
      new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: "PONTOS POSITIVOS", bold: true, size: 22, color: "67A23F" })] })
    ];
    const positivosValidos = String(state.analise.positivos || "").split(/\n+/).map(p => p.trim()).filter(Boolean);
    if (positivosValidos.length === 0) {
      blocoPositivos.push(new Paragraph({ children: [new TextRun({ text: "— nenhum registado —", italics: true, size: 18 })] }));
    } else {
      positivosValidos.forEach(p => blocoPositivos.push(new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: "✅ " + p, size: 18 })] })));
    }

    const blocoMelhorar = [
      new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: "PONTOS A MELHORAR", bold: true, size: 22, color: "E7A601" })] })
    ];
    const melhorarValidos = String(state.analise.aMelhorar || "").split(/\n+/).map(p => p.trim()).filter(Boolean);
    if (melhorarValidos.length === 0) {
      blocoMelhorar.push(new Paragraph({ children: [new TextRun({ text: "— nenhum registado —", italics: true, size: 18 })] }));
    } else {
      melhorarValidos.forEach(p => blocoMelhorar.push(new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: "⚠️ " + p, size: 18 })] })));
    }

    pagina4.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: SEM_BORDAS,
      rows: [new TableRow({
        children: [
          new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, borders: CELULA_SEM_BORDAS, margins: { right: 200 }, children: blocoPositivos }),
          new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, borders: CELULA_SEM_BORDAS, margins: { left: 200 }, children: blocoMelhorar })
        ]
      })]
    }));

    pagina4.push(new Paragraph({ spacing: { before: 260, after: 120 }, children: [new TextRun({ text: "TÓPICOS PARA O TREINO", bold: true, size: 24, color: COR_DARK_KHAKI })] }));
    const topicosValidos = String(state.analise.topicosTreino || "").split(/\n+/).map(t => t.trim()).filter(Boolean);
    if (topicosValidos.length === 0) {
      pagina4.push(new Paragraph({ children: [new TextRun({ text: "— nenhum registado —", italics: true, size: 18 })] }));
    } else {
      topicosValidos.forEach((t, idx) => {
        pagina4.push(new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: `${idx + 1}. ${t}`, size: 18 })] }));
      });
    }

    pagina4.push(new Paragraph({ spacing: { before: 260, after: 120 }, children: [new TextRun({ text: "ANÁLISE DO ADVERSÁRIO", bold: true, size: 24, color: COR_DARK_KHAKI })] }));
    pagina4.push(new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: "Estilo de Jogo: ", bold: true, size: 18, color: COR_CHARCOAL }), new TextRun({ text: state.analise.adversario.estilo || "—", size: 18 })] }));

    pagina4.push(new Paragraph({ spacing: { before: 120, after: 40 }, children: [new TextRun({ text: "Jogadores-Chave", bold: true, size: 18, color: COR_CHARCOAL })] }));
    const jogadoresChaveValidos = state.analise.adversario.jogadoresChave.filter(jc => jc.nome);
    if (jogadoresChaveValidos.length === 0) {
      pagina4.push(new Paragraph({ children: [new TextRun({ text: "—", size: 18 })] }));
    } else {
      jogadoresChaveValidos.forEach(jc => {
        const posicaoTxt = jc.posicao ? ` (${jc.posicao})` : "";
        pagina4.push(new Paragraph({ spacing: { after: 30 }, children: [new TextRun({ text: `• ${jc.nome}${posicaoTxt}`, bold: true, size: 18 }), new TextRun({ text: jc.descricao ? " — " + jc.descricao : "", size: 18 })] }));
      });
    }

    pagina4.push(new Paragraph({ spacing: { before: 120, after: 40 }, children: [new TextRun({ text: "Pontos Fortes: ", bold: true, size: 18, color: COR_CHARCOAL }), new TextRun({ text: state.analise.adversario.pontosFortes || "—", size: 18 })] }));
    pagina4.push(new Paragraph({ spacing: { before: 60 }, children: [new TextRun({ text: "Vulnerabilidades a Explorar na 2ª Volta: ", bold: true, size: 18, color: COR_CHARCOAL }), new TextRun({ text: state.analise.adversario.vulnerabilidades || "—", size: 18 })] }));

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
        children: [...pagina1, ...pagina2, ...pagina3, ...pagina4]
      }]
    });

    const blob = await Packer.toBlob(doc);
    // o jogo fica registado: jogos e minutos passam a contar nas estatísticas
    state.jogo.presencasAplicadas = true;
    sincronizarStatsJogadores();
    guardarRascunho();
    await guardarRelatorioSupabase();
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

function initAplicacao() {
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
  renderSeasonStats({ jogos: 0, vitorias: 0, empates: 0, derrotas: 0, marcados: 0, sofridos: 0 });
  carregarEstatisticasEpocaSupabase();

  initRascunho();
  atualizarSponsorsAdmin();
  carregarCalendario();
  setInterval(renderProximoJogoPreJogo, 60000); // atualiza a contagem decrescente

  el("btnGenerateDocx").addEventListener("click", gerarRelatorioWord);
}

function mostrarAplicacao() {
  el("loginScreen").hidden = true;
  el("appShell").hidden = false;
  el("sidebarUserName").textContent = currentUser ? (currentUser.user_metadata && (currentUser.user_metadata.full_name || currentUser.user_metadata.name) || currentUser.email) : "Modo local";
}

function mostrarLogin(mensagem) {
  el("appShell").hidden = true;
  el("loginScreen").hidden = false;
  el("loginMessage").textContent = mensagem || "";
  el("btnLocalMode").hidden = supabaseConfigurado();
}

async function iniciarAutenticacao() {
  iniciarSupabase();
  if (supabaseClient) {
    const { data } = await supabaseClient.auth.getSession();
    if (data.session) { currentUser = data.session.user; plantelDoSupabase = await carregarPlantelSupabase(); mostrarAplicacao(); initAplicacao(); const draft = await carregarRascunhoSupabase(); if (draft) mostrarBannerRascunho(draft); }
    else mostrarLogin();
    supabaseClient.auth.onAuthStateChange(async (_event, session) => {
      currentUser = session && session.user;
      if (currentUser && !document.querySelector("#appShell:not([hidden])")) { plantelDoSupabase = await carregarPlantelSupabase(); mostrarAplicacao(); initAplicacao(); }
      if (!currentUser && _event !== "INITIAL_SESSION") mostrarLogin("Sessão terminada.");
    });
  } else mostrarLogin();
  el("loginForm").addEventListener("submit", async event => {
    event.preventDefault();
    if (!supabaseClient) return;
    const { error } = await supabaseClient.auth.signInWithPassword({ email: el("loginEmail").value, password: el("loginPassword").value });
    if (error) el("loginMessage").textContent = error.message;
  });
  el("btnLocalMode").addEventListener("click", () => { localMode = true; mostrarAplicacao(); initAplicacao(); });
  el("btnLogout").addEventListener("click", async () => { if (supabaseClient) await supabaseClient.auth.signOut(); else { localMode = false; mostrarLogin(); } });
}

function mostrarBannerRascunho(armazenado) {
  el("draftBannerText").textContent = `Tens um rascunho de ${formatarDataHora(armazenado.savedAt)}. Carregar?`;
  el("draftBanner").hidden = false;
  el("btnLoadDraft").onclick = () => { aplicarDadosEstado(armazenado.data); renderTudo(); el("draftBanner").hidden = true; };
}

document.addEventListener("DOMContentLoaded", iniciarAutenticacao);
