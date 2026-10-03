"use strict";

/* =========================================================
   VFN — utilitários partilhados por index.html, dashboard.html
   e public.html. Tudo fica em window.VFN para não colidir com
   os nomes globais do app.js; generateJerseyAvatar é global.
   ========================================================= */

(function () {
  const COMPETICOES = ["2ª Liga Zero Graus", "Taça 2ª Liga FDM", "Taça de Honra Comunilog", "Amigável"];
  // Competições com classificação e jornadas AF Guarda (nomes usados em matches e league_results)
  const COMPETICOES_CLASSIFICACAO = ["2ª Liga Zero Graus", "Taça de Honra Comunilog", "Taça 2ª Liga FDM"];

  const AF_GUARDA = { src: "assets/sponsors/af-guarda.png", alt: "Associação de Futebol da Guarda" };
  const SPONSORS = {
    zero: { src: "assets/sponsors/zero-graus.png", alt: "Zero Graus Produções" },
    fdm: { src: "assets/sponsors/fdm.png", alt: "FDM" },
    comunilog: { src: "assets/sponsors/comunilog.png", alt: "Comunilog" }
  };

  // Tipos de multa por omissão, todos com valor fixo (a tabela fine_types no Supabase substitui-os ao carregar)
  const TIPOS_MULTA = [
    [1, "Joia Mensal", 0.5], [2, "Atraso treino até 5min", 0.5], [3, "Atraso treino após 5min", 1],
    [4, "Atraso jogo até 5min", 1], [5, "Atraso jogo após 5min", 2], [6, "Falta treino sem justificação", 5],
    [7, "Falta jogo sem justificação", 10], [8, "Não levar shampoo", 0.5], [9, "Não levar chinelos", 0.5],
    [10, "Cartão vermelho por protesto", 5], [11, "Cartão amarelo por protesto", 2], [12, "Telemóvel durante refeição ou palestra", 2],
    [13, "Falta de fato de treino no dia de jogo", 5], [14, "Cada golo sofrido", 0.5], [15, "Jogo sem sofrer golo", 2, "treinador"],
    [16, "Esquecer material no balneário", 0.5], [17, "Não tomar banho no dia de treino ou jogo", 1], [18, "Falta de respeito", 5],
    [19, "Levantar da refeição sem autorização", 1]
  ].map(([id, tipo, valor, pagador]) => ({ id, tipo, valor, pagador: pagador || "jogador", descricao: "" }));
  const ID_JOIA = 1, ID_FALTA_TREINO = 6;

  /** Substitui os tipos pelos da tabela fine_types (mantém o mesmo array). */
  function definirTiposMulta(linhas) {
    if (!Array.isArray(linhas) || !linhas.length) return;
    const tipos = linhas.map(t => ({ id: Number(t.id), tipo: t.name, valor: Number(t.amount) || 0, pagador: t.payer || "jogador", descricao: t.description || "" }))
      .sort((a, b) => a.id - b.id);
    TIPOS_MULTA.splice(0, TIPOS_MULTA.length, ...tipos);
  }

  function tipoMultaPorId(id) {
    return TIPOS_MULTA.find(t => t.id === Number(id)) || null;
  }

  // Equipa técnica por omissão (tabela staff no Supabase)
  const STAFF_PADRAO = [{ id: "1635906", name: "Ricardo Isento", full_name: "Ricardo Manuel Mendes Isento", role: "treinador", date_of_birth: "1975-10-25", photo_url: "" }];

  /** Linha de staff -> objeto com o mesmo formato dos jogadores nas vistas (nome, fotoUrl, ...). */
  function pessoaStaff(t) {
    return { id: String(t.id), idBD: String(t.id), nome: t.name, nomeCompleto: t.full_name || t.name, posicao: t.role === "treinador" ? "Treinador" : (t.role || "Staff"), numero: "", fotoUrl: t.photo_url || `${BASE_SITE}assets/staff/${t.id}.png`, staff: true };
  }

  const formatoEuro = new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" });

  function tipoMulta(nome) {
    return TIPOS_MULTA.find(t => t.tipo === nome) || null;
  }

  function rotuloMulta(tipo) {
    return tipo === "falta_treino" ? "Falta ao treino injustificada" : tipo;
  }

  /** Valor da multa para mostrar (sempre um valor fixo em euros). */
  function valorMultaHTML(f) {
    return formatoEuro.format(Number(f.amount) || 0);
  }

  /* Disponibilidade dos jogadores (players.availability). Suspensão ao 5.º amarelo (AF Guarda). */
  const DISPONIBILIDADE = {
    disponivel: { rotulo: "Disponível", icone: "circle-check" },
    em_duvida: { rotulo: "Em dúvida", icone: "circle-help" },
    lesionado: { rotulo: "Lesionado", icone: "bandage" },
    suspenso: { rotulo: "Suspenso", icone: "ban" },
    indisponivel: { rotulo: "Indisponível", icone: "circle-off" }
  };
  const AMARELOS_SUSPENSAO = 5;

  function badgeDisponibilidade(estado, compacto) {
    const e = DISPONIBILIDADE[estado] ? estado : "disponivel";
    const d = DISPONIBILIDADE[e];
    return `<span class="disp-badge disp-${e}" title="${d.rotulo}">${icone(d.icone, 14)}${compacto ? '<span class="sr-only">' + d.rotulo + "</span>" : " " + d.rotulo}</span>`;
  }

  /**
   * Estado de um relatório de jogo: coluna status (v3) ou cópia no match_data.
   * Relatórios antigos (gerados antes da v3, sem estado) contam como publicados.
   */
  function estadoRelatorio(r) {
    if (!r) return "draft";
    return r.status || (r.match_data || {})._status || "published";
  }

  /** Jogadores a quem o último amarelo completou um ciclo de 5 e que ainda não estão suspensos. */
  function alertaSuspensao(amarelos, estado) {
    const n = Number(amarelos) || 0;
    return n > 0 && n % AMARELOS_SUSPENSAO === 0 && estado !== "suspenso";
  }

  const MESES_CURTOS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const MESES_LONGOS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

  /* ---------- Texto ---------- */

  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function novoId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  function slug(str) {
    return String(str || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "equipa";
  }

  /* ---------- Competições e sponsors ---------- */

  /**
   * Nome oficial da competição. Aliases antigos (ex.: "2ª LIGA FUTEBOL ZERO GRAUS PRODUÇÕES",
   * "AF Guarda Taça de Honra 2026/27") passam aos nomes usados na classificação e nas jornadas.
   */
  function normalizarCompeticao(competicao) {
    const s = String(competicao || "").toUpperCase();
    if (s.includes("FDM")) return COMPETICOES_CLASSIFICACAO[2];
    if (s.includes("ZERO") && s.includes("LIGA") && !s.includes("TAÇA")) return COMPETICOES_CLASSIFICACAO[0];
    if (s.includes("HONRA")) return COMPETICOES_CLASSIFICACAO[1];
    return competicao;
  }

  /** Aplica normalizarCompeticao a linhas de matches/league_results (devolve cópias). */
  function normalizarLinhas(linhas) {
    return (linhas || []).map(l => l && l.competition ? { ...l, competition: normalizarCompeticao(l.competition) } : l);
  }

  function categoriaCompeticao(competicao) {
    const s = String(competicao || "").toUpperCase();
    if (s.includes("AMIG")) return "amigavel";
    if (s.includes("TAÇA") || s.includes("TACA")) return "taca";
    return "liga";
  }

  function nomeCurtoCompeticao(competicao) {
    const s = String(competicao || "").toUpperCase();
    if (s.includes("HONRA")) return "Taça de Honra";
    if (s.includes("TAÇA") || s.includes("TACA")) return "Taça 2ª Liga";
    if (s.includes("AMIG")) return "Amigável";
    if (s.includes("LIGA")) return "2ª Liga";
    return competicao || "—";
  }

  function sponsorDaCompeticao(competicao) {
    const s = String(competicao || "").toUpperCase();
    if (s.includes("COMUNILOG") || s.includes("HONRA")) return SPONSORS.comunilog;
    if (s.includes("FDM") || (s.includes("TAÇA") && s.includes("LIGA"))) return SPONSORS.fdm;
    if (s.includes("ZERO") || (s.includes("LIGA") && !s.includes("TAÇA"))) return SPONSORS.zero;
    return null;
  }

  /** Rodapé de parceiros: AF Guarda sempre + sponsor da competição indicada. */
  function renderSponsors(container, competicao) {
    if (!container) return;
    const sponsor = sponsorDaCompeticao(competicao);
    const logos = [AF_GUARDA, sponsor].filter(Boolean)
      .map(s => `<img src="${s.src}" alt="${escapeHtml(s.alt)}" title="${escapeHtml(s.alt)}" loading="lazy">`).join("");
    container.innerHTML = `<div class="sponsor-logos">${logos}</div>`;
  }

  /* ---------- Datas ---------- */

  function paraData(valor) {
    if (!valor) return null;
    if (valor instanceof Date) return valor;
    // "YYYY-MM-DD" sem hora é tratado como data local, não UTC
    const d = /^\d{4}-\d{2}-\d{2}$/.test(valor) ? new Date(valor + "T00:00:00") : new Date(valor);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function dataIso(d) {
    const x = paraData(d);
    if (!x) return "";
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  }

  function horaIso(d) {
    const x = paraData(d);
    return x ? `${String(x.getHours()).padStart(2, "0")}:${String(x.getMinutes()).padStart(2, "0")}` : "";
  }

  /** "15/03/1998" */
  function dataDDMMAAAA(valor) {
    const d = paraData(valor);
    return d ? `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}` : "";
  }

  function dataCurta(valor) {
    const d = paraData(valor);
    return d ? `${d.getDate()} ${MESES_CURTOS[d.getMonth()]}` : "—";
  }

  function dataLonga(valor, comHora) {
    const d = paraData(valor);
    if (!d) return "—";
    const texto = d.toLocaleDateString("pt-PT", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
    const hora = horaIso(d);
    return comHora && hora !== "00:00" ? `${texto} · ${hora}` : texto;
  }

  function contagemDecrescente(valor) {
    const d = paraData(valor);
    if (!d) return "";
    const ms = d.getTime() - Date.now();
    if (ms <= 0) return "A decorrer";
    const min = Math.floor(ms / 60000);
    const dias = Math.floor(min / 1440);
    const horas = Math.floor((min % 1440) / 60);
    const minutos = min % 60;
    return dias > 0 ? `${dias}d ${String(horas).padStart(2, "0")}h ${String(minutos).padStart(2, "0")}m` : `${horas}h ${String(minutos).padStart(2, "0")}m`;
  }

  /** Meses da época (julho a junho) que contém a data indicada. */
  function mesesDaEpoca(referencia) {
    const ref = paraData(referencia) || new Date();
    const inicio = ref.getMonth() >= 6 ? ref.getFullYear() : ref.getFullYear() - 1;
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(inicio, 6 + i, 1);
      return { valor: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, rotulo: `${MESES_LONGOS[d.getMonth()]} ${d.getFullYear()}` };
    });
  }

  function mesAtual() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }

  /* ---------- Jogos, equipas e classificação ---------- */

  function eVFN(nome) {
    return /vila\s*franca|^\s*vfn\s*$/i.test(String(nome || ""));
  }

  /** Jogo do VFN (os jogos entre outras equipas têm home_team_id e away_team_id preenchidos). */
  function eJogoVFN(jogo) {
    return !!jogo && !(jogo.home_team_id && jogo.away_team_id);
  }

  function jogoEmCasa(jogo) {
    return /^(casa|home|c)$/i.test(String(jogo && jogo.home_away || "").trim());
  }

  function estadoJogo(jogo) {
    return String(jogo && jogo.status || "").trim().toLowerCase();
  }

  function golosJogo(jogo) {
    const casa = jogo.score_home, fora = jogo.score_away;
    if (casa == null || fora == null || casa === "" || fora === "") return null;
    return jogoEmCasa(jogo) ? { vfn: Number(casa), adv: Number(fora) } : { vfn: Number(fora), adv: Number(casa) };
  }

  function letraResultado(jogo) {
    const g = golosJogo(jogo);
    if (!g) return "";
    return g.vfn > g.adv ? "V" : g.vfn === g.adv ? "E" : "D";
  }

  function proximoJogo(jogos) {
    const limite = Date.now() - 2 * 3600 * 1000; // jogo em curso continua a ser o "próximo"
    return jogosDoVFN(jogos)
      .filter(j => estadoJogo(j) === "agendado" && paraData(j.date) && paraData(j.date).getTime() >= limite)
      .sort((a, b) => paraData(a.date) - paraData(b.date))[0] || null;
  }

  function ultimosJogos(jogos, n) {
    return jogosDoVFN(jogos)
      .filter(j => estadoJogo(j) === "jogado" && golosJogo(j))
      .sort((a, b) => (paraData(b.date) || 0) - (paraData(a.date) || 0))
      .slice(0, n || 5);
  }

  /** Só os jogos do VFN (exclui os jogos entre outras equipas usados na classificação). */
  function jogosDoVFN(jogos) {
    return (jogos || []).filter(eJogoVFN);
  }

  function equipaVFN(equipas) {
    return (equipas || []).find(t => eVFN(t.name)) || { id: "vfn", name: "ACD Vila Franca das Naves" };
  }

  /** Equipas da casa e de fora de um jogo, como { id, nome }. */
  function equipasDoJogo(jogo, equipas) {
    const porId = id => (equipas || []).find(t => String(t.id) === String(id));
    if (!eJogoVFN(jogo)) {
      const casa = porId(jogo.home_team_id), fora = porId(jogo.away_team_id);
      return { casa: { id: String(jogo.home_team_id), nome: casa ? casa.name : String(jogo.home_team_id) }, fora: { id: String(jogo.away_team_id), nome: fora ? fora.name : String(jogo.away_team_id) } };
    }
    const vfn = equipaVFN(equipas);
    const adv = porId(jogo.opponent_team_id);
    const nosso = { id: String(vfn.id), nome: vfn.name };
    const deles = { id: adv ? String(adv.id) : `nome:${jogo.opponent || "?"}`, nome: adv ? adv.name : (jogo.opponent || "Adversário") };
    return jogoEmCasa(jogo) ? { casa: nosso, fora: deles } : { casa: deles, fora: nosso };
  }

  /** Competições de liga presentes no calendário (as que têm classificação). */
  function competicoesLiga(jogos) {
    return [...new Set((jogos || []).map(j => j.competition).filter(c => c && categoriaCompeticao(c) === "liga"))].sort();
  }

  /** Equipas de uma linha de league_results, como { id, nome }. */
  function equipasDoResultadoLiga(r, equipas) {
    const porId = id => (equipas || []).find(t => String(t.id) === String(id));
    const lado = (id, nome) => {
      const t = id != null && id !== "" ? porId(id) : null;
      return { id: t ? String(t.id) : (id ? String(id) : `nome:${nome || "?"}`), nome: t ? t.name : (nome || String(id || "?")) };
    };
    return { casa: lado(r.home_team_id, r.home_team_name), fora: lado(r.away_team_id, r.away_team_name) };
  }

  const temResultado = (a, b) => a != null && b != null && a !== "" && b !== "";

  /**
   * Classificação calculada em tempo real (não usa a tabela standings):
   * jogos do VFN em matches + jogos entre as outras equipas em league_results.
   * Entram todas as equipas com jogos na competição.
   */
  function calcularClassificacao(jogos, equipas, competicao, resultadosLiga) {
    const linhas = new Map();
    const linha = eq => {
      if (!linhas.has(eq.id)) linhas.set(eq.id, { team_id: eq.id, team_name: eq.nome, played: 0, won: 0, drawn: 0, lost: 0, goals_for: 0, goals_against: 0, points: 0 });
      return linhas.get(eq.id);
    };
    const somar = (casa, fora, gc, gf) => {
      const lc = linha(casa), lf = linha(fora);
      if (!temResultado(gc, gf)) return;
      const [a, b] = [Number(gc), Number(gf)];
      lc.played++; lf.played++;
      lc.goals_for += a; lc.goals_against += b; lf.goals_for += b; lf.goals_against += a;
      if (a > b) { lc.won++; lf.lost++; } else if (a < b) { lf.won++; lc.lost++; } else { lc.drawn++; lf.drawn++; }
    };
    (jogos || []).filter(j => j.competition === competicao && estadoJogo(j) !== "cancelado").forEach(j => {
      const { casa, fora } = equipasDoJogo(j, equipas);
      if (estadoJogo(j) === "jogado") somar(casa, fora, j.score_home, j.score_away);
      else { linha(casa); linha(fora); }
    });
    (resultadosLiga || []).filter(r => r.competition === competicao).forEach(r => {
      const { casa, fora } = equipasDoResultadoLiga(r, equipas);
      somar(casa, fora, r.score_home, r.score_away);
    });
    linhas.forEach(l => { l.points = l.won * 3 + l.drawn; });
    return ordenarClassificacao([...linhas.values()]);
  }

  function ordenarClassificacao(linhas) {
    return [...(linhas || [])].sort((a, b) =>
      (Number(b.points) || 0) - (Number(a.points) || 0) ||
      ((Number(b.goals_for) || 0) - (Number(b.goals_against) || 0)) - ((Number(a.goals_for) || 0) - (Number(a.goals_against) || 0)) ||
      (Number(b.goals_for) || 0) - (Number(a.goals_for) || 0) ||
      String(a.team_name || "").localeCompare(String(b.team_name || ""), "pt"));
  }

  function chipForma(letra) {
    const titulo = { V: "Vitória", E: "Empate", D: "Derrota" }[letra] || "";
    return letra ? `<span class="form-chip form-${letra}" title="${titulo}">${letra}</span>` : "";
  }

  function badgeEstado(jogo) {
    const estado = estadoJogo(jogo) || "agendado";
    const rotulos = { agendado: "Agendado", jogado: "Jogado", adiado: "Adiado", cancelado: "Cancelado" };
    const letra = estado === "jogado" ? letraResultado(jogo) : "";
    return `<span class="status-badge status-${escapeHtml(estado)}${letra ? " result-" + letra : ""}">${escapeHtml(rotulos[estado] || estado)}</span>`;
  }

  /** Categoria de posição a partir da posição principal ("DC/MDef" -> Def). */
  // Códigos atuais (MDC, MC, MOC, PL) e antigos (MDef, MCen, MOfe, AV)
  const CATEGORIA_CODIGO = {
    GR: "GR",
    DC: "Def", DD: "Def", DE: "Def", LD: "Def", LE: "Def",
    MDC: "Meio", MC: "Meio", MOC: "Meio", MDEF: "Meio", MCEN: "Meio", MOFE: "Meio", MD: "Meio", MO: "Meio",
    AV: "Ata", PL: "Ata", PA: "Ata", ATA: "Ata", EE: "Ata", ED: "Ata"
  };

  function codigosPosicao(posicao) {
    return String(posicao || "").split("/").map(p => p.trim().toUpperCase()).filter(Boolean);
  }

  /** Categoria da posição principal ("MDC/DD" -> Meio). */
  function categoriaPosicao(posicao) {
    return CATEGORIA_CODIGO[codigosPosicao(posicao)[0]] || "";
  }

  /** O jogador entra no filtro se alguma das suas posições for da categoria ("MDC/DD" está em Meio e em Def). */
  function posicaoNaCategoria(posicao, categoria) {
    return !categoria || codigosPosicao(posicao).some(c => CATEGORIA_CODIGO[c] === categoria);
  }

  /* ---------- Ícones Lucide ---------- */

  const nomeLucide = nome => String(nome).split("-").map(p => p.charAt(0).toUpperCase() + p.slice(1)).join("");

  /**
   * SVG de um ícone Lucide ("calendar-days", "trash-2"...). Gera o SVG a partir
   * dos dados da biblioteca (não usa lucide.createIcons, que deixa data-lucide
   * no SVG e voltaria a processá-lo). Tamanho: 20px; nas tabelas o CSS reduz a 16px.
   */
  function icone(nome, tamanho, classe) {
    const no = window.lucide && window.lucide.icons && window.lucide.icons[nomeLucide(nome)];
    if (!no) return "";
    const filhos = no[2] || [];
    const t = tamanho || 20;
    const corpo = filhos.map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).map(([k, v]) => `${k}="${escapeHtml(v)}"`).join(" ")}/>`).join("");
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="ic ic-${nome}${classe ? " " + classe : ""}" aria-hidden="true" focusable="false">${corpo}</svg>`;
  }

  /** Troca os <i data-icon="nome" data-size="16"> do HTML pelos SVG. */
  function hidratarIcones(raiz) {
    (raiz || document).querySelectorAll("i[data-icon]").forEach(el => {
      const svg = icone(el.dataset.icon, Number(el.dataset.size) || 20, el.className);
      if (svg) el.outerHTML = svg;
    });
  }

  document.addEventListener("DOMContentLoaded", () => hidratarIcones());

  /* ---------- Animações (GSAP) ---------- */

  const semMovimento = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const temGsap = () => !!window.gsap && !semMovimento();
  const lista = alvo => (!alvo ? [] : alvo.length !== undefined && !(alvo instanceof Element) ? [...alvo] : [alvo]).filter(Boolean);

  const anim = {
    /** Cards a entrar em cascata (fade-in + slide-up). */
    cascata(elementos) {
      const els = lista(elementos);
      if (!temGsap() || !els.length) return;
      window.gsap.fromTo(els, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.4, ease: "power2.out", stagger: 0.035, clearProps: "opacity,transform" });
    },
    /** Mudança de tab: fade-in com um pequeno deslize horizontal (220ms). */
    tab(painel) {
      if (!temGsap() || !painel) return;
      window.gsap.fromTo(painel, { opacity: 0, x: 12 }, { opacity: 1, x: 0, duration: 0.22, ease: "power2.out", clearProps: "opacity,transform" });
    },
    /** Modal ao abrir: scale 0.95 → 1 com fade-in. */
    modal(caixa) {
      if (!temGsap() || !caixa) return;
      window.gsap.fromTo(caixa, { opacity: 0, scale: 0.95 }, { opacity: 1, scale: 1, duration: 0.22, ease: "power2.out", clearProps: "opacity,transform" });
    },
    /** Linhas de tabela a entrar da esquerda em cascata. */
    linhas(linhas) {
      const els = lista(linhas);
      if (!temGsap() || !els.length) return;
      window.gsap.fromTo(els, { opacity: 0, x: -24 }, { opacity: 1, x: 0, duration: 0.35, ease: "power2.out", stagger: 0.04, clearProps: "opacity,transform" });
    },
    /** Números com data-contar="N" contam de 0 até N. */
    contar(raiz) {
      const els = [...(raiz || document).querySelectorAll("[data-contar]")];
      if (!temGsap()) return;
      els.forEach(el => {
        const fim = Number(el.dataset.contar) || 0;
        if (!fim) return;
        const obj = { v: 0 };
        el.textContent = "0";
        window.gsap.to(obj, { v: fim, duration: 0.9, ease: "power2.out", onUpdate: () => { el.textContent = Math.round(obj.v); }, onComplete: () => { el.textContent = fim; } });
      });
    }
  };

  /* ---------- Contagem animada dos números (KPIs) ----------
     Ao entrar no ecrã, o número conta de 0 até ao valor (700ms), mantendo o formato
     ("6,00 €", "75%", "270'"). Novos elementos são apanhados automaticamente. */

  const SELETOR_KPI = ".summary-tile strong, .season-stat strong, .player-modal-stat strong, .dividas-total strong, .att-pct, .disp-coluna h3 b, .stat-num";
  const animados = new WeakSet();
  let observadorKpi = null;

  function animarNumero(el) {
    const texto = el.textContent;
    const m = texto.match(/^(\D*?)(\d[\d.\s\u00a0]*(?:,\d+)?)(\D*)$/);
    if (!m) return;
    const decimais = (m[2].split(",")[1] || "").length;
    const fim = Number(m[2].replace(/[.\s\u00a0]/g, "").replace(",", "."));
    if (!(fim > 0)) return;
    const formato = new Intl.NumberFormat("pt-PT", { minimumFractionDigits: decimais, maximumFractionDigits: decimais });
    const duracao = 700, inicio = performance.now();
    const passo = agora => {
      if (el.textContent !== texto && !el.dataset.aContar) return; // o conteúdo mudou entretanto
      const t = Math.min(1, (agora - inicio) / duracao);
      const v = fim * (1 - Math.pow(1 - t, 3)); // ease-out cúbico
      el.dataset.aContar = "1";
      el.textContent = t < 1 ? m[1] + formato.format(v) + m[3] : texto;
      if (t < 1) requestAnimationFrame(passo); else delete el.dataset.aContar;
    };
    requestAnimationFrame(passo);
  }

  function procurarKpis() {
    if (!observadorKpi) return;
    document.querySelectorAll(SELETOR_KPI).forEach(el => {
      if (animados.has(el)) return;
      animados.add(el);
      observadorKpi.observe(el);
    });
  }

  function observarKpis() {
    if (!window.IntersectionObserver || !window.MutationObserver || semMovimento()) return;
    observadorKpi = new IntersectionObserver(entradas => entradas.forEach(e => {
      if (!e.isIntersecting) return;
      observadorKpi.unobserve(e.target);
      animarNumero(e.target);
    }), { threshold: 0.4 });
    let pendente = false;
    new MutationObserver(() => {
      if (pendente) return;
      pendente = true;
      requestAnimationFrame(() => { pendente = false; procurarKpis(); });
    }).observe(document.body, { childList: true, subtree: true });
    procurarKpis();
  }

  // Todos os modais (.modal-overlay) animam ao perder o atributo hidden
  function observarModais() {
    if (!window.MutationObserver) return;
    new MutationObserver(mudancas => mudancas.forEach(m => {
      const el = m.target;
      if (el.classList && el.classList.contains("modal-overlay") && !el.hidden && m.oldValue !== null) anim.modal(el.querySelector(".modal-box"));
    })).observe(document.body, { attributes: true, attributeFilter: ["hidden"], attributeOldValue: true, subtree: true });
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (temGsap()) document.documentElement.classList.add("gsap-on");
    observarModais();
    observarKpis();
  });

  /* ---------- Ordenação de tabelas por coluna ----------
     <table data-ordenar="chave"> e <th data-tipo="texto|numero|data"> nas colunas ordenáveis.
     Valor da célula: data-v, senão o valor do input, senão o texto. A ordem escolhida
     fica guardada por chave e volta a aplicar-se quando a tabela é redesenhada. */

  const estadoOrdenacao = new Map(); // chave -> { col, dir }

  function valorCelula(celula, tipo) {
    if (!celula) return tipo === "texto" ? "" : 0;
    const campo = celula.querySelector("input, select");
    const bruto = celula.dataset.v !== undefined ? celula.dataset.v : campo ? campo.value : celula.textContent.trim();
    if (tipo === "numero") { const n = parseFloat(String(bruto).replace(",", ".").replace(/[^\d.-]/g, "")); return Number.isFinite(n) ? n : -Infinity; }
    return String(bruto);
  }

  function ordenarTabela(tabela) {
    const chave = tabela.dataset.ordenar;
    const est = estadoOrdenacao.get(chave);
    const cabecalho = tabela.tHead && tabela.tHead.rows[0];
    if (!cabecalho) return;
    [...cabecalho.cells].forEach((th, i) => {
      if (!th.dataset.tipo) return;
      th.tabIndex = 0;
      th.setAttribute("aria-sort", est && est.col === i ? (est.dir === "asc" ? "ascending" : "descending") : "none");
    });
    const tbody = tabela.tBodies[0];
    if (!est || !tbody) return;
    const tipo = cabecalho.cells[est.col] && cabecalho.cells[est.col].dataset.tipo || "texto";
    const linhas = [...tbody.rows].filter(r => r.cells.length > 1); // ignora linhas de "sem dados"
    const ordenadas = [...linhas].sort((a, b) => {
      const x = valorCelula(a.cells[est.col], tipo), y = valorCelula(b.cells[est.col], tipo);
      const r = tipo === "numero" ? x - y : String(x).localeCompare(String(y), "pt", { numeric: true, sensitivity: "base" });
      return est.dir === "asc" ? r : -r;
    });
    // só mexe no DOM se a ordem mudar (evita ciclos com o observador)
    if (ordenadas.every((l, i) => l === linhas[i])) return;
    const frag = document.createDocumentFragment();
    ordenadas.forEach(l => frag.appendChild(l));
    tbody.appendChild(frag);
  }

  function alternarOrdenacao(th) {
    const tabela = th.closest("table[data-ordenar]");
    const chave = tabela.dataset.ordenar;
    const atual = estadoOrdenacao.get(chave);
    const col = th.cellIndex;
    const dir = atual && atual.col === col ? (atual.dir === "asc" ? "desc" : "asc") : (th.dataset.tipo === "texto" ? "asc" : "desc");
    estadoOrdenacao.set(chave, { col, dir });
    ordenarTabela(tabela);
  }

  document.addEventListener("click", e => {
    const th = e.target.closest && e.target.closest("table[data-ordenar] thead th[data-tipo]");
    if (th && !e.target.closest("input, select, button:not(.sort-btn)")) alternarOrdenacao(th);
  });
  document.addEventListener("keydown", e => {
    const th = e.target.closest && e.target.closest("table[data-ordenar] thead th[data-tipo]");
    if (th && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); alternarOrdenacao(th); }
  });
  document.addEventListener("DOMContentLoaded", () => {
    let pendente = false;
    new MutationObserver(() => {
      if (pendente) return;
      pendente = true;
      requestAnimationFrame(() => { pendente = false; document.querySelectorAll("table[data-ordenar]").forEach(ordenarTabela); });
    }).observe(document.body, { childList: true, subtree: true });
  });

  /* ---------- Taças por eliminatórias ---------- */

  const COMPETICOES_ELIMINATORIAS = ["Taça 2ª Liga FDM"];
  const FASES_TACA = [["1eliminatoria", "1ª Eliminatória"], ["oitavos", "Oitavos-de-final"], ["quartos", "Quartos-de-final"], ["meias", "Meias-finais"], ["final", "Final"]];

  function eliminatorias(competicao) {
    return COMPETICOES_ELIMINATORIAS.includes(competicao);
  }

  /** Fase de um jogo: a coluna phase, ou o nº da jornada (1 = 1ª eliminatória ... 5 = final). */
  function faseDoJogo(phase, jornada) {
    if (FASES_TACA.some(([k]) => k === phase)) return phase;
    const f = FASES_TACA[(Number(jornada) || 0) - 1];
    return f ? f[0] : "";
  }

  /** "Jornada 3", ou o nome da fase nas taças por eliminatórias. */
  function rotuloJornada(competicao, n) {
    if (eliminatorias(competicao) && nomeFase(faseDoJogo("", n))) return nomeFase(faseDoJogo("", n));
    return n ? "Jornada " + n : "Sem jornada";
  }

  function nomeFase(fase) {
    return (FASES_TACA.find(([k]) => k === fase) || [, ""])[1];
  }

  /** Nº de ordem da fase (1 = 1ª eliminatória ... 5 = final); 0 se não for uma fase. */
  function numeroFase(fase) {
    return FASES_TACA.findIndex(([k]) => k === fase) + 1;
  }

  /** "J3" / "Jornada 3" num jogo de liga, ou o nome da fase nas taças ("" se não houver). */
  function etiquetaJornada(jogo, curto) {
    if (!jogo) return "";
    if (eliminatorias(jogo.competition)) return nomeFase(faseDoJogo(jogo.phase, jogo.jornada));
    return jogo.jornada ? (curto ? "J" : "Jornada ") + jogo.jornada : "";
  }

  /* ---------- Capitão ---------- */

  // ordem de prioridade (ids Zerozero): Toneca, Silvestre, Marco, Macedo
  const CAPITAES = ["872514", "726895", "710175", "664348"];
  const INDISPONIVEIS = ["lesionado", "suspenso", "indisponivel"];

  /**
   * Primeiro da lista de capitães presente em `candidatos` (ids) e disponível.
   * opcoes.estado(id) devolve a disponibilidade (vazio = desconhecida, conta como disponível).
   */
  function capitaoAutomatico(candidatos, opcoes) {
    const o = opcoes || {};
    const ids = new Set((candidatos || []).map(String));
    return CAPITAES.find(id => ids.has(id) && !INDISPONIVEIS.includes(o.estado ? o.estado(id) : "")) || "";
  }

  function badgeCapitao(classe) {
    return `<span class="badge-capitao ${classe || ""}" title="Capitão" aria-label="Capitão">C</span>`;
  }

  /* ---------- Mapa de presenças (estilo GitHub) ---------- */

  const PRESENTE = e => e === "P" || e === "A";

  /**
   * Mapa de calor da época: uma coluna por semana, uma linha por dia (Seg–Dom).
   * registos: [{ data: "AAAA-MM-DD", status }]. Com um só jogador (opcoes.individual)
   * cada dia mostra o estado (P/A/F/J); com a equipa, a % de presentes nesse dia.
   */
  function heatmapPresencasHTML(registos, opcoes) {
    const o = opcoes || {};
    const porDia = new Map();
    (registos || []).forEach(r => {
      if (!r.status || !r.data) return;
      const d = porDia.get(r.data) || { P: 0, A: 0, F: 0, J: 0 };
      if (d[r.status] != null) d[r.status]++;
      porDia.set(r.data, d);
    });
    if (!porDia.size) return '<p class="empty-state">Ainda não há presenças registadas.</p>';
    const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const dias = [...porDia.keys()].sort();
    const inicio = new Date(dias[0] + "T12:00:00");
    inicio.setDate(inicio.getDate() - ((inicio.getDay() + 6) % 7)); // segunda-feira
    const hoje = new Date(); hoje.setHours(12, 0, 0, 0);
    const ultimo = new Date(dias[dias.length - 1] + "T12:00:00");
    const fim = ultimo > hoje ? ultimo : hoje;
    const celulas = [], meses = [];
    let semana = 0, mesAnterior = -1;
    for (const d = new Date(inicio); d <= fim; d.setDate(d.getDate() + 1)) {
      const linha = (d.getDay() + 6) % 7;
      if (linha === 0 && d > inicio) semana++;
      if (d.getMonth() !== mesAnterior && d.getDate() <= 7) { meses.push({ semana, rotulo: MESES_CURTOS[d.getMonth()] }); mesAnterior = d.getMonth(); }
      const chave = iso(d);
      const t = porDia.get(chave);
      let classe = "hm-0", titulo = `${dataDDMMAAAA(chave)}: sem sessão`;
      if (t) {
        const presentes = t.P + t.A, total = presentes + t.F + t.J;
        if (o.individual) {
          const estado = ["P", "A", "J", "F"].find(k => t[k]) || "";
          classe = "hm-" + estado;
          titulo = `${dataDDMMAAAA(chave)}: ${{ P: "Presente", A: "Atraso", F: "Falta", J: "Falta justificada" }[estado] || ""}`;
        } else {
          const pct = total ? presentes / total : 0;
          classe = pct >= 0.9 ? "hm-4" : pct >= 0.75 ? "hm-3" : pct >= 0.5 ? "hm-2" : "hm-1";
          titulo = `${dataDDMMAAAA(chave)}: ${presentes}/${total} presentes (${Math.round(pct * 100)}%)`;
        }
      }
      celulas.push(`<span class="hm-cel ${classe}" style="grid-column:${semana + 2};grid-row:${linha + 2}" title="${escapeHtml(titulo)}"></span>`);
    }
    const semanas = semana + 1;
    const rotulosDias = ["Seg", "", "Qua", "", "Sex", "", "Dom"].map((t, i) => t ? `<span class="hm-dia" style="grid-column:1;grid-row:${i + 2}">${t}</span>` : "").join("");
    const rotulosMeses = meses.map(m => `<span class="hm-mes" style="grid-column:${m.semana + 2} / span 3;grid-row:1">${m.rotulo}</span>`).join("");
    const legenda = o.individual
      ? '<span class="hm-cel hm-P"></span>Presente <span class="hm-cel hm-A"></span>Atraso <span class="hm-cel hm-J"></span>Justificada <span class="hm-cel hm-F"></span>Falta'
      : 'Menos <span class="hm-cel hm-1"></span><span class="hm-cel hm-2"></span><span class="hm-cel hm-3"></span><span class="hm-cel hm-4"></span> Mais presentes';
    return `<div class="heatmap-scroll"><div class="heatmap" style="grid-template-columns:auto repeat(${semanas}, var(--hm-tam))" role="img" aria-label="Mapa de presenças da época">${rotulosMeses}${rotulosDias}${celulas.join("")}</div></div>
      <div class="heatmap-legenda">${legenda}</div>`;
  }

  /* ---------- Splash (primeira visita da sessão) ---------- */

  function splash() {
    const raiz = document.documentElement;
    let primeira = false;
    try { primeira = !sessionStorage.getItem("vfnSplash"); sessionStorage.setItem("vfnSplash", "1"); } catch (e) { /* sem storage: sem splash */ }
    if (!primeira || (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches)) { raiz.classList.remove("vfn-splash-on"); return; }
    const el = document.createElement("div");
    el.className = "vfn-splash";
    el.setAttribute("aria-hidden", "true");
    el.innerHTML = `<img src="${LOGO_VFN}" alt=""><span>ACD Vila Franca das Naves</span>`;
    document.body.appendChild(el);
    raiz.classList.remove("vfn-splash-on");
    setTimeout(() => el.classList.add("sair"), 1500);
    setTimeout(() => el.remove(), 1900);
  }

  /* ---------- Exportação para Excel (SheetJS) ---------- */

  const ORDEM_CATEGORIA = { GR: 0, Def: 1, Meio: 2, Ata: 3 };

  /** Ordena jogadores por posição (GR, defesas, médios, avançados) e depois pelo número. */
  function ordenarPorPosicao(lista) {
    return [...lista].sort((a, b) =>
      (ORDEM_CATEGORIA[categoriaPosicao(a.posicao)] ?? 9) - (ORDEM_CATEGORIA[categoriaPosicao(b.posicao)] ?? 9) ||
      (Number(a.numero) || 999) - (Number(b.numero) || 999) || String(a.nome).localeCompare(String(b.nome), "pt"));
  }

  /**
   * Folha de presenças: Nº | Nome | uma coluna por sessão | Total Presenças | Total Faltas | % Frequência.
   * Presenças = P + A (atraso conta como presente); faltas = F + J.
   */
  function folhaPresencas(sessoes, jogadores, estado) {
    const cab = ["Nº", "Nome", ...sessoes.map(s => `${dataDDMMAAAA(s.data)}${s.tipo === "jogo" ? " (jogo)" : ""}`), "Total Presenças", "Total Faltas", "% Frequência"];
    const linhas = ordenarPorPosicao(jogadores).map(j => {
      const estados = sessoes.map(s => estado(j, s) || "");
      const presentes = estados.filter(e => e === "P" || e === "A").length;
      const faltas = estados.filter(e => e === "F" || e === "J").length;
      const registos = presentes + faltas;
      return [j.numero === "" || j.numero == null ? "" : Number(j.numero), j.nome, ...estados, presentes, faltas, registos ? Math.round(presentes / registos * 100) / 100 : ""];
    });
    return { linhas: [cab, ...linhas], larguras: [5, 24, ...sessoes.map(() => 11), 15, 12, 12], percentagem: cab.length - 1, paisagem: true };
  }

  /** Folha de dívidas: Jogador | Tipo de dívida | Valor | Data | Estado | Observações (só multas por pagar). */
  function folhaDividas(multas, nomeJogador) {
    const porPagar = multas.filter(f => !f.paid).sort((a, b) => String(nomeJogador(a.player_id) || "").localeCompare(String(nomeJogador(b.player_id) || ""), "pt") || String(a.match_date || "").localeCompare(String(b.match_date || "")));
    const cab = ["Jogador", "Tipo de dívida", "Valor (€)", "Data", "Estado", "Observações"];
    const linhas = porPagar.map(f => [nomeJogador(f.player_id) || "Jogador removido", rotuloMulta(f.infraction_type), Number(f.amount) || 0, dataDDMMAAAA(f.match_date), "Pendente", f.description || ""]);
    const total = porPagar.reduce((t, f) => t + (Number(f.amount) || 0), 0);
    return { linhas: [cab, ...linhas, [], ["Total em dívida", "", total, "", "", ""]], larguras: [24, 34, 12, 12, 11, 40], euros: 2, paisagem: true };
  }

  /** Folha de multas: Nome | Tipo de Multa | Data | Valor | Notas, com total no rodapé. */
  function folhaMultas(multas, nomeJogador) {
    const cab = ["Nome", "Tipo de Multa", "Data", "Valor (€)", "Notas"];
    const ordenadas = [...multas].sort((a, b) => String(a.match_date || "").localeCompare(String(b.match_date || "")));
    const linhas = ordenadas.map(f => [nomeJogador(f.player_id) || "Jogador removido", rotuloMulta(f.infraction_type), dataDDMMAAAA(f.match_date), Number(f.amount) || 0, [f.paid ? "Paga" : "Pendente", f.description].filter(Boolean).join(" · ")]);
    const total = ordenadas.reduce((s, f) => s + (Number(f.amount) || 0), 0);
    return { linhas: [cab, ...linhas, [], ["Total acumulado", "", "", total, ""]], larguras: [24, 34, 12, 12, 40], euros: 3, paisagem: true };
  }

  /** Gera o .xlsx (várias folhas) e descarrega-o. As folhas com paisagem: true ficam em orientação horizontal. */
  function exportarXlsx(nomeFicheiro, folhas) {
    const X = window.XLSX;
    if (!X) { alert("A biblioteca de Excel não carregou. Verifica a ligação à internet."); return; }
    const wb = X.utils.book_new();
    folhas.forEach(f => {
      const ws = X.utils.aoa_to_sheet(f.linhas);
      ws["!cols"] = (f.larguras || []).map(wch => ({ wch }));
      ws["!margins"] = { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 };
      // formatos: percentagem e euros
      const intervalo = X.utils.decode_range(ws["!ref"]);
      for (let r = 1; r <= intervalo.e.r; r++) {
        [[f.percentagem, "0%"], [f.euros, '#,##0.00 "€"']].forEach(([c, z]) => {
          if (c == null) return;
          const cel = ws[X.utils.encode_cell({ r, c })];
          if (cel && typeof cel.v === "number") cel.z = z;
        });
      }
      X.utils.book_append_sheet(wb, ws, f.nome.slice(0, 31));
    });
    const bruto = X.write(wb, { type: "array", bookType: "xlsx" });
    // a versão gratuita do SheetJS não escreve a orientação: acrescenta-a ao XML de cada folha
    const zip = X.CFB.read(new Uint8Array(bruto), { type: "array" });
    folhas.forEach((f, i) => {
      if (!f.paisagem) return;
      const n = zip.FullPaths.findIndex(p => p.endsWith(`xl/worksheets/sheet${i + 1}.xml`));
      if (n < 0) return;
      const ent = zip.FileIndex[n];
      let xml = new TextDecoder().decode(ent.content);
      if (!/<sheetPr/.test(xml)) xml = xml.replace(/(<worksheet[^>]*>)/, "$1<sheetPr><pageSetUpPr fitToPage=\"1\"/></sheetPr>");
      xml = xml.replace(/(<pageMargins[^>]*\/>)/, "$1<pageSetup paperSize=\"9\" orientation=\"landscape\" fitToWidth=\"1\" fitToHeight=\"0\"/>");
      ent.content = new TextEncoder().encode(xml);
      ent.size = ent.content.length;
    });
    const final = X.CFB.write(zip, { fileType: "zip", type: "array" });
    const blob = new Blob([final], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = nomeFicheiro;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /* ---------- Logos das equipas ---------- */

  const BASE_SITE = "https://tonybalde18.github.io/vfn-relatorios/";
  const LOGO_VFN = BASE_SITE + "assets/logo.png";

  /**
   * URL absoluto do logo de uma equipa (GitHub Pages):
   * - logo_url absoluto (http/data) é usado como está;
   * - logo_url relativo ("assets/...") passa a BASE_SITE + caminho;
   * - sem logo_url e com id numérico (zerozero): assets/opponents/{id}.png;
   * - o VFN usa assets/logo.png.
   */
  function urlLogoEquipa(equipa, nome) {
    const t = equipa || {};
    const logo = String(t.logo_url || "").trim();
    if (/^(https?:|data:)/i.test(logo)) return logo;
    if (logo) return BASE_SITE + logo.replace(/^\.?\//, "");
    if (eVFN(t.name || nome)) return LOGO_VFN;
    if (/^\d+$/.test(String(t.id || ""))) return `${BASE_SITE}assets/opponents/${t.id}.png`;
    return "";
  }

  /* ---------- Avatar camisola ---------- */

  let contadorAvatar = 0;

  /** Camisola principal VFN (amarela com faixa azul #055bd0) com o número. SVG 80x90. */
  function generateJerseyAvatar(number) {
    const numero = escapeHtml(String(number == null ? "" : number).trim().slice(0, 3));
    const id = `vfnJersey${++contadorAvatar}`;
    const corpo = "M27 7 L13 12 L2 28 L13 38 L19 32 L19 86 Q40 90 61 86 L61 32 L67 38 L78 28 L67 12 L53 7 Q40 17 27 7 Z";
    const tamanho = numero.length > 2 ? 22 : numero.length > 1 ? 28 : 32;
    return `<svg class="jersey-avatar" xmlns="http://www.w3.org/2000/svg" width="80" height="90" viewBox="0 0 80 90" role="img" aria-label="${numero ? "Camisola número " + numero : "Camisola VFN"}">` +
      `<defs><clipPath id="${id}"><path d="${corpo}"/></clipPath></defs>` +
      `<path d="${corpo}" fill="#FFD700"/>` +
      `<g clip-path="url(#${id})"><rect x="33" y="0" width="14" height="90" fill="#055bd0"/>` +
      `<path d="M2 28 L13 38 L15 36 L4 26 Z M78 28 L67 38 L65 36 L76 26 Z" fill="#055bd0"/></g>` +
      `<path d="M27 7 Q40 17 53 7" fill="none" stroke="#055bd0" stroke-width="3"/>` +
      `<path d="${corpo}" fill="none" stroke="#0A1628" stroke-opacity=".35" stroke-width="1.2"/>` +
      (numero ? `<text x="40" y="${tamanho > 28 ? 64 : 61}" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-weight="800" font-size="${tamanho}" fill="#FFFFFF" stroke="#0A1628" stroke-width="3" paint-order="stroke" stroke-linejoin="round">${numero}</text>` : "") +
      `</svg>`;
  }

  // Fotos em assets/players/{id}.jpg ou .png. Guarda o resultado para não repetir pedidos falhados.
  const PASTA_FOTOS = "assets/players/";
  const fotosConhecidas = new Map(); // id -> url encontrado | null (sem foto)

  /**
   * Avatar de jogador: começa pela camisola e tenta a foto real em segundo plano
   * (photo_url, depois assets/players/{id}.jpg e .png); se nenhuma existir, fica a camisola.
   * Aceita jogadores do app.js (idBD/fotoUrl/numero/nome) e do Supabase (id/photo_url/number/name).
   */
  function avatarJogador(jogador, classe) {
    const j = jogador || {};
    const numero = j.number != null && j.number !== "" ? j.number : j.numero;
    const nome = j.name || j.nome || "";
    const id = String(j.idBD || j.id || "");
    const cls = `vfn-avatar ${classe || ""}`.trim();
    const attrJogador = id ? ` data-jogador="${escapeHtml(id)}"` : ""; // clicável: abre a ficha do jogador
    const candidatos = [j.photo_url || j.fotoUrl, id && `${PASTA_FOTOS}${id}.jpg`, id && `${PASTA_FOTOS}${id}.png`].filter(Boolean);
    const conhecida = fotosConhecidas.get(id);
    if (conhecida) return `<span class="${cls} has-photo"${attrJogador}><img src="${escapeHtml(conhecida)}" alt="Fotografia de ${escapeHtml(nome)}" loading="lazy"></span>`;
    const camisola = generateJerseyAvatar(numero);
    if (conhecida === null || !candidatos.length) return `<span class="${cls}"${attrJogador}>${camisola}</span>`;
    return `<span class="${cls}"${attrJogador}>${camisola}<img class="foto-tentativa" alt="Fotografia de ${escapeHtml(nome)}" data-id="${escapeHtml(id)}" data-candidatos="${escapeHtml(candidatos.join("|"))}" src="${escapeHtml(candidatos[0])}" onload="VFN.fotoCarregou(this)" onerror="VFN.fotoFalhou(this)"></span>`;
  }

  function fotoCarregou(img) {
    const span = img.parentElement;
    if (img.dataset.id) fotosConhecidas.set(img.dataset.id, img.getAttribute("src"));
    img.classList.remove("foto-tentativa");
    [...span.querySelectorAll("svg")].forEach(s => s.remove());
    span.classList.add("has-photo");
  }

  function fotoFalhou(img) {
    const candidatos = (img.dataset.candidatos || "").split("|").filter(Boolean);
    const seguinte = candidatos[candidatos.indexOf(img.getAttribute("src")) + 1];
    if (seguinte) { img.src = seguinte; return; }
    if (img.dataset.id) fotosConhecidas.set(img.dataset.id, null);
    img.remove(); // fica a camisola
  }

  /* ---------- Loading spinner (todos os pedidos Supabase) ---------- */

  let pedidosAtivos = 0;
  let temporizadorSpinner = null;

  function elementoSpinner() {
    let s = document.getElementById("vfnSpinner");
    if (!s) {
      s = document.createElement("div");
      s.id = "vfnSpinner";
      s.className = "vfn-spinner";
      s.setAttribute("role", "status");
      s.setAttribute("aria-live", "polite");
      s.innerHTML = '<span class="vfn-spinner-ring"><img src="assets/logo.png" alt=""></span><span class="vfn-spinner-text">A carregar…</span>';
      document.body.appendChild(s);
    }
    return s;
  }

  function iniciarCarregamento() {
    pedidosAtivos++;
    // atraso curto para não piscar em pedidos rápidos
    if (!temporizadorSpinner) temporizadorSpinner = setTimeout(() => {
      temporizadorSpinner = null;
      if (pedidosAtivos > 0 && document.body) elementoSpinner().classList.add("is-visible");
    }, 250);
  }

  function terminarCarregamento() {
    pedidosAtivos = Math.max(0, pedidosAtivos - 1);
    if (pedidosAtivos) return;
    clearTimeout(temporizadorSpinner);
    temporizadorSpinner = null;
    const s = document.getElementById("vfnSpinner");
    if (s) s.classList.remove("is-visible");
  }

  function fetchComSpinner(...args) {
    iniciarCarregamento();
    return fetch(...args).finally(terminarCarregamento);
  }

  /* ---------- Supabase ---------- */

  function supabaseConfigurado() {
    return typeof window.supabase !== "undefined" &&
      typeof SUPABASE_URL !== "undefined" && !String(SUPABASE_URL).startsWith("YOUR_") &&
      typeof SUPABASE_ANON_KEY !== "undefined" && !String(SUPABASE_ANON_KEY).startsWith("YOUR_");
  }

  function criarClienteSupabase(opcoes) {
    if (!supabaseConfigurado()) return null;
    const auth = opcoes && opcoes.semSessao ? { persistSession: false, autoRefreshToken: false } : {};
    return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth, global: { fetch: fetchComSpinner } });
  }

  /** Papel do utilizador (admin/treinador/dirigente). null se não tiver perfil; "sem-tabela" se profiles não existir. */
  async function obterPapel(cliente, utilizador) {
    if (!cliente || !utilizador) return null;
    const { data, error } = await cliente.from("profiles").select("role, full_name").eq("id", utilizador.id).maybeSingle();
    if (error) return { role: "sem-tabela", full_name: "" };
    return data || null;
  }

  /* ---------- Layout ---------- */

  /** Sidebar off-canvas em ecrãs < 768px. */
  function initSidebar(sidebar, botao) {
    if (!sidebar || !botao) return;
    let fundo = document.querySelector(".sidebar-backdrop");
    if (!fundo) {
      fundo = document.createElement("div");
      fundo.className = "sidebar-backdrop";
      document.body.appendChild(fundo);
    }
    const fechar = () => { sidebar.classList.remove("is-open"); fundo.classList.remove("is-visible"); botao.setAttribute("aria-expanded", "false"); };
    const abrir = () => { sidebar.classList.add("is-open"); fundo.classList.add("is-visible"); botao.setAttribute("aria-expanded", "true"); };
    botao.addEventListener("click", () => sidebar.classList.contains("is-open") ? fechar() : abrir());
    fundo.addEventListener("click", fechar);
    document.addEventListener("keydown", e => { if (e.key === "Escape") fechar(); });
    sidebar.addEventListener("click", e => { if (e.target.closest(".nav-item") && window.innerWidth < 768) fechar(); });
    return fechar;
  }

  function initAOS() {
    if (window.AOS) window.AOS.init({ once: true, duration: 450, offset: 10, easing: "ease-out" });
  }

  function refreshAOS() {
    if (window.AOS) window.AOS.refreshHard();
  }

  window.generateJerseyAvatar = generateJerseyAvatar;

  if (document.body) splash(); else document.addEventListener("DOMContentLoaded", splash);

  window.VFN = {
    COMPETICOES, COMPETICOES_CLASSIFICACAO, AF_GUARDA,
    DISPONIBILIDADE, AMARELOS_SUSPENSAO, badgeDisponibilidade, alertaSuspensao, estadoRelatorio, CAPITAES, capitaoAutomatico, badgeCapitao, COMPETICOES_ELIMINATORIAS, FASES_TACA, eliminatorias, faseDoJogo, nomeFase, numeroFase, etiquetaJornada, rotuloJornada, heatmapPresencasHTML,
    TIPOS_MULTA, ID_JOIA, ID_FALTA_TREINO, definirTiposMulta, tipoMultaPorId, STAFF_PADRAO, pessoaStaff, formatoEuro, tipoMulta, rotuloMulta, valorMultaHTML, SPONSORS, MESES_CURTOS, MESES_LONGOS,
    escapeHtml, novoId, slug, icone, hidratarIcones, anim, ordenarTabela,
    ordenarPorPosicao, folhaPresencas, folhaMultas, folhaDividas, exportarXlsx,
    normalizarCompeticao, normalizarLinhas, categoriaCompeticao, nomeCurtoCompeticao, sponsorDaCompeticao, renderSponsors,
    paraData, dataIso, horaIso, dataDDMMAAAA, dataCurta, dataLonga, contagemDecrescente, mesesDaEpoca, mesAtual,
    BASE_SITE, LOGO_VFN, urlLogoEquipa,
    eVFN, eJogoVFN, jogoEmCasa, estadoJogo, golosJogo, letraResultado, proximoJogo, ultimosJogos, ordenarClassificacao,
    jogosDoVFN, equipaVFN, equipasDoJogo, equipasDoResultadoLiga, competicoesLiga, calcularClassificacao,
    chipForma, badgeEstado, categoriaPosicao, posicaoNaCategoria,
    generateJerseyAvatar, avatarJogador, fotoCarregou, fotoFalhou,
    iniciarCarregamento, terminarCarregamento,
    supabaseConfigurado, criarClienteSupabase, obterPapel,
    initSidebar, initAOS, refreshAOS
  };
})();
