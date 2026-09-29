"use strict";

/* =========================================================
   VFN — utilitários partilhados por index.html, dashboard.html
   e public.html. Tudo fica em window.VFN para não colidir com
   os nomes globais do app.js; generateJerseyAvatar é global.
   ========================================================= */

(function () {
  const COMPETICOES = ["2ª LIGA FUTEBOL ZERO GRAUS PRODUÇÕES", "TAÇA 2ª LIGA - FDM", "TAÇA DE HONRA COMUNILOG", "Amigável"];

  const AF_GUARDA = { src: "assets/sponsors/af-guarda.png", alt: "Associação de Futebol da Guarda" };
  const SPONSORS = {
    zero: { src: "assets/sponsors/zero-graus.png", alt: "Zero Graus Produções" },
    fdm: { src: "assets/sponsors/fdm.png", alt: "FDM" },
    comunilog: { src: "assets/sponsors/comunilog.png", alt: "Comunilog" }
  };

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

  /**
   * Classificação calculada em tempo real a partir dos resultados em matches
   * (não usa a tabela standings). Entram todas as equipas com jogos na competição.
   */
  function calcularClassificacao(jogos, equipas, competicao) {
    const linhas = new Map();
    const linha = eq => {
      if (!linhas.has(eq.id)) linhas.set(eq.id, { team_id: eq.id, team_name: eq.nome, played: 0, won: 0, drawn: 0, lost: 0, goals_for: 0, goals_against: 0, points: 0 });
      return linhas.get(eq.id);
    };
    (jogos || []).filter(j => j.competition === competicao && estadoJogo(j) !== "cancelado").forEach(j => {
      const { casa, fora } = equipasDoJogo(j, equipas);
      const lc = linha(casa), lf = linha(fora);
      const gc = j.score_home, gf = j.score_away;
      if (estadoJogo(j) !== "jogado" || gc == null || gf == null || gc === "" || gf === "") return;
      const [a, b] = [Number(gc), Number(gf)];
      lc.played++; lf.played++;
      lc.goals_for += a; lc.goals_against += b; lf.goals_for += b; lf.goals_against += a;
      if (a > b) { lc.won++; lf.lost++; } else if (a < b) { lf.won++; lc.lost++; } else { lc.drawn++; lf.drawn++; }
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
  function categoriaPosicao(posicao) {
    const principal = String(posicao || "").split("/")[0].trim().toUpperCase();
    if (principal === "GR") return "GR";
    if (["DC", "DD", "DE"].includes(principal)) return "Def";
    if (["MDEF", "MCEN", "MOFE"].includes(principal)) return "Meio";
    if (["EE", "ED", "PL"].includes(principal)) return "Ata";
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

  /**
   * Avatar de jogador: fotografia se existir, senão camisola com o número.
   * Aceita jogadores do app.js (fotoUrl/numero/nome) e do Supabase (photo_url/number/name).
   */
  function avatarJogador(jogador, classe) {
    const j = jogador || {};
    const foto = j.photo_url || j.fotoUrl || "";
    const numero = j.number != null && j.number !== "" ? j.number : j.numero;
    const nome = j.name || j.nome || "";
    const cls = `vfn-avatar ${classe || ""}`.trim();
    if (foto) return `<span class="${cls} has-photo"><img src="${escapeHtml(foto)}" alt="Fotografia de ${escapeHtml(nome)}" loading="lazy"></span>`;
    return `<span class="${cls}">${generateJerseyAvatar(numero)}</span>`;
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
    COMPETICOES, AF_GUARDA, SPONSORS, MESES_CURTOS, MESES_LONGOS,
    escapeHtml, novoId, slug,
    categoriaCompeticao, nomeCurtoCompeticao, sponsorDaCompeticao, renderSponsors,
    paraData, dataIso, horaIso, dataDDMMAAAA, dataCurta, dataLonga, contagemDecrescente, mesesDaEpoca, mesAtual,
    eVFN, eJogoVFN, jogoEmCasa, estadoJogo, golosJogo, letraResultado, proximoJogo, ultimosJogos, ordenarClassificacao,
    jogosDoVFN, equipaVFN, equipasDoJogo, competicoesLiga, calcularClassificacao,
    chipForma, badgeEstado, categoriaPosicao,
    generateJerseyAvatar, avatarJogador,
    iniciarCarregamento, terminarCarregamento,
    supabaseConfigurado, criarClienteSupabase, obterPapel,
    initSidebar, initAOS, refreshAOS
  };
})();
