"use strict";

/* =========================================================
   VFN — utilitários partilhados por index.html, dashboard.html
   e public.html. Tudo fica em window.VFN para não colidir com
   os nomes globais do app.js; generateJerseyAvatar é global.
   ========================================================= */

(function () {
  const COMPETICOES = ["2ª LIGA FUTEBOL ZERO GRAUS PRODUÇÕES", "TAÇA 2ª LIGA - FDM", "TAÇA DE HONRA COMUNILOG", "Amigável"];
  // Competições com classificação e jornadas AF Guarda (nomes usados em matches e league_results)
  const COMPETICOES_CLASSIFICACAO = ["2ª Liga Zero Graus", "Taça de Honra Comunilog"];

  const AF_GUARDA = { src: "assets/sponsors/af-guarda.png", alt: "Associação de Futebol da Guarda" };
  const SPONSORS = {
    zero: { src: "assets/sponsors/zero-graus.png", alt: "Zero Graus Produções" },
    fdm: { src: "assets/sponsors/fdm.png", alt: "FDM" },
    comunilog: { src: "assets/sponsors/comunilog.png", alt: "Comunilog" }
  };

  /* Tabela de multas do plantel. valor null = percentagem do ordenado (amount 0 até os dirigentes definirem). */
  const TIPOS_MULTA = [
    { tipo: "Atraso ao treino", valor: null },
    { tipo: "Atraso ao jogo até 5 min", valor: 1 },
    { tipo: "Atraso ao jogo mais de 5 min", valor: 2 },
    { tipo: "Falta ao treino justificada", valor: 2 },
    { tipo: "Falta ao treino injustificada", valor: null },
    { tipo: "Falta ao jogo justificada", valor: 2 },
    { tipo: "Falta ao jogo injustificada", valor: 5 },
    { tipo: "Cartão amarelo justificado", valor: 0.5 },
    { tipo: "Cartão amarelo injustificado", valor: 1 },
    { tipo: "Cartão vermelho justificado", valor: 2 },
    { tipo: "Cartão vermelho injustificado", valor: 5 },
    { tipo: "Falta de respeito", valor: 5 },
    { tipo: "Falta de material", valor: 2.5 },
    { tipo: "Falta de uso de caneleiras no treino", valor: 1.5 },
    { tipo: "Uso de telemóvel no balneário", valor: 1 }
  ];
  const NOTA_PERCENTAGEM = "Percentagem do ordenado — valor a definir pelos dirigentes";
  const formatoEuro = new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" });

  function tipoMulta(nome) {
    return TIPOS_MULTA.find(t => t.tipo === nome) || null;
  }

  /** Multa em percentagem do ordenado ainda sem valor (inclui as automáticas antigas 'falta_treino'). */
  function multaADefinir(f) {
    const t = tipoMulta(f.infraction_type);
    return (!!t && t.valor === null || f.infraction_type === "falta_treino") && !(Number(f.amount) > 0);
  }

  function rotuloMulta(tipo) {
    return tipo === "falta_treino" ? "Falta ao treino injustificada" : tipo;
  }

  /** Valor da multa para mostrar: euros, ou "% ordenado" enquanto não estiver definido. */
  function valorMultaHTML(f) {
    return multaADefinir(f) ? '<span class="valor-a-definir" title="' + NOTA_PERCENTAGEM + '">% ordenado</span>' : formatoEuro.format(Number(f.amount) || 0);
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
  // Códigos atuais (MDC, MC, MOC, AV) e antigos (MDef, MCen, MOfe, PL)
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
    /** Mudança de tab: fade-in de 200ms. */
    tab(painel) {
      if (!temGsap() || !painel) return;
      window.gsap.fromTo(painel, { opacity: 0 }, { opacity: 1, duration: 0.2, ease: "power1.out", clearProps: "opacity" });
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
    const candidatos = [j.photo_url || j.fotoUrl, id && `${PASTA_FOTOS}${id}.jpg`, id && `${PASTA_FOTOS}${id}.png`].filter(Boolean);
    const conhecida = fotosConhecidas.get(id);
    if (conhecida) return `<span class="${cls} has-photo"><img src="${escapeHtml(conhecida)}" alt="Fotografia de ${escapeHtml(nome)}" loading="lazy"></span>`;
    const camisola = generateJerseyAvatar(numero);
    if (conhecida === null || !candidatos.length) return `<span class="${cls}">${camisola}</span>`;
    return `<span class="${cls}">${camisola}<img class="foto-tentativa" alt="Fotografia de ${escapeHtml(nome)}" data-id="${escapeHtml(id)}" data-candidatos="${escapeHtml(candidatos.join("|"))}" src="${escapeHtml(candidatos[0])}" onload="VFN.fotoCarregou(this)" onerror="VFN.fotoFalhou(this)"></span>`;
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

  window.VFN = {
    COMPETICOES, COMPETICOES_CLASSIFICACAO, AF_GUARDA,
    TIPOS_MULTA, NOTA_PERCENTAGEM, formatoEuro, tipoMulta, multaADefinir, rotuloMulta, valorMultaHTML, SPONSORS, MESES_CURTOS, MESES_LONGOS,
    escapeHtml, novoId, slug, icone, hidratarIcones, anim, ordenarTabela,
    categoriaCompeticao, nomeCurtoCompeticao, sponsorDaCompeticao, renderSponsors,
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
