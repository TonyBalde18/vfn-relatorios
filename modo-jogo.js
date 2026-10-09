"use strict";

/* =========================================================
   MODO JOGO (admin, separador Jogo): registo rápido de eventos ao vivo,
   em ecrã inteiro e pensado para o telemóvel.
   Grelha de botões grandes → mini-formulário só com os campos do tipo de
   evento → "Guardar" junta o evento a state.jogo.eventos (o mesmo array da
   tabela "Eventos do Jogo", gravado em match_data.jogo.eventos) e volta à
   grelha. Usa as funções do app.js (state, plantel, jogadoresEmCampo...).
   ========================================================= */

const MODO_JOGO_TIPOS = [
  { tipo: "Golo", icone: "⚽", cor: "#15803d" },
  { tipo: "Cartão Amarelo", icone: "🟨", cor: "#FACC15", texto: "#131E4E" },
  { tipo: "Cartão Vermelho", icone: "🟥", cor: "#b91c1c" },
  { tipo: "Substituição", icone: "🔄", cor: "#1d4ed8" },
  { tipo: "Lesão", icone: "🤕", cor: "#c2410c" },
  { tipo: "Golo Anulado", icone: "❌", cor: "#4b5563" },
  { tipo: "Penalty Falhado", icone: "🥅", cor: "#6d28d9" },
  { tipo: "Tempo Acrescentado", icone: "⏱️", cor: "#0e7490" },
  { tipo: "Paragem para hidratação", rotulo: "Paragem Hidratação", icone: "💧", cor: "#0369a1" },
  { tipo: "Intervalo", icone: "⏸️", cor: "#334155" },
  { tipo: "Nota", icone: "📝", cor: "#475569" }
];

// tipos com equipa e jogador (VFN: lista de jogadores; adversário: nome/número em texto)
const MODO_JOGO_COM_JOGADOR = ["Cartão Amarelo", "Cartão Vermelho", "Lesão", "Golo Anulado", "Penalty Falhado"];

const modoJogo = { ultimoMinuto: 0, rascunho: null, ultimoId: null };

function mjEl(id) { return document.getElementById(id); }

/** Ícone do botão: a imagem de assets/icons/ (VFN.ICONES_EVENTO_FICHEIRO); sem ela, o emoji. */
function mjIcone(t) {
  const f = VFN.ICONES_EVENTO_FICHEIRO && VFN.ICONES_EVENTO_FICHEIRO[t.tipo];
  return f ? `<img src="assets/icons/${f}.png" alt="" onerror="this.replaceWith(document.createTextNode('${t.icone}'))">` : t.icone;
}

/** Opções de jogadores: só os ids indicados; sem convocatória (lista vazia), o plantel todo. */
function mjOpcoesJogadores(valor, ids) {
  return opcoesJogadoresHTML(valor, ids && ids.length ? { onlyIds: ids } : {});
}

function mjCriarOverlay() {
  if (mjEl("modoJogo")) return;
  const caixa = document.createElement("div");
  caixa.id = "modoJogo";
  caixa.className = "mj-overlay";
  caixa.hidden = true;
  caixa.setAttribute("role", "dialog");
  caixa.setAttribute("aria-modal", "true");
  caixa.setAttribute("aria-labelledby", "mjTitulo");
  caixa.innerHTML = `
    <header class="mj-topo">
      <div><strong id="mjTitulo">⚽ Modo Jogo</strong><span id="mjPlacar" class="mj-placar"></span></div>
      <button type="button" class="mj-fechar" data-mj="fechar">✗ Fechar Modo Jogo</button>
    </header>
    <section class="mj-cronometro" id="mjCronometro" aria-label="Cronómetro do jogo"></section>
    <div class="mj-grelha" id="mjGrelha">
      ${MODO_JOGO_TIPOS.map(t => `<button type="button" class="mj-botao" data-mj-tipo="${escapeHtml(t.tipo)}" style="background:${t.cor};color:${t.texto || "#fff"}"><span class="mj-ic" aria-hidden="true">${mjIcone(t)}</span><span>${escapeHtml(t.rotulo || t.tipo)}</span></button>`).join("")}
    </div>
    <div class="mj-ultimo" id="mjUltimo" aria-live="polite"></div>
    <form class="mj-form" id="mjForm" hidden novalidate>
      <h2 id="mjFormTitulo"></h2>
      <div id="mjCampos"></div>
      <p class="mj-erro" id="mjErro" role="alert"></p>
      <div class="mj-acoes">
        <button type="submit" class="mj-guardar">✓ Guardar</button>
        <button type="button" class="mj-cancelar" data-mj="cancelar">✗ Cancelar</button>
      </div>
    </form>`;
  document.body.appendChild(caixa);

  caixa.addEventListener("click", e => {
    const b = e.target.closest("[data-mj], [data-mj-tipo], [data-mj-valor]");
    if (!b) return;
    if (b.dataset.mjTipo) mjAbrirForm(b.dataset.mjTipo);
    else if (b.dataset.mj && b.dataset.mj.startsWith("crono-")) mjCronoAcao(b.dataset.mj.slice(6));
    else if (b.dataset.mj === "fechar") fecharModoJogo();
    else if (b.dataset.mj === "cancelar") mjFecharForm();
    else if (b.dataset.mj === "desfazer") mjDesfazer();
    else if (b.dataset.mj === "menos" || b.dataset.mj === "mais") {
      const input = mjEl("mjMinuto");
      input.value = Math.max(0, Math.min(130, (Number(input.value) || 0) + (b.dataset.mj === "mais" ? 1 : -1)));
    } else if (b.dataset.mjValor !== undefined) {
      // botões de escolha (equipa, parte do jogo): atualizam o rascunho e redesenham os campos
      mjLerCampos(); // primeiro o que já está escrito; depois a escolha
      const r = modoJogo.rascunho, campo = b.dataset.mjCampo, valor = b.dataset.mjValor;
      r[campo] = valor;
      if (campo === "equipa") { r.jogadorId = ""; r.assistId = ""; r.detalhe = ""; }
      if (campo === "parte") r.minuto = Number(valor);
      if (typeof mjEscolhaExtra === "function") mjEscolhaExtra(r, campo, valor);
      mjRenderCampos();
    }
  });
  caixa.addEventListener("change", e => {
    if (e.target.id === "mjAutogolo") { mjLerCampos(); modoJogo.rascunho.jogadorId = ""; modoJogo.rascunho.detalhe = ""; mjRenderCampos(); }
    // "Golo sofrido" = golo do adversário: troca a equipa beneficiada
    if (e.target.id === "mjSofrido") { mjLerCampos(); const r = modoJogo.rascunho; r.equipa = e.target.checked ? "Adversário" : "VFN"; r.jogadorId = ""; r.assistId = ""; r.detalhe = ""; mjRenderCampos(); }
  });
  VFNComp.ligarSeletoresZona(caixa);
  mjEl("mjForm").addEventListener("submit", e => { e.preventDefault(); mjGuardar(); });
  document.addEventListener("keydown", e => {
    if (e.key !== "Escape" || caixa.hidden) return;
    if (!mjEl("mjForm").hidden) mjFecharForm(); else fecharModoJogo();
  });
}

function abrirModoJogo() {
  mjCriarOverlay();
  modoJogo.ultimoMinuto = Math.max(0, ...state.jogo.eventos.map(ev => Number(ev.minuto) || 0));
  mjFecharForm();
  mjAtualizarTopo();
  mjCronoCarregar();
  mjEl("modoJogo").hidden = false;
  document.body.classList.add("mj-aberto");
}

function fecharModoJogo() {
  const caixa = mjEl("modoJogo");
  if (caixa) caixa.hidden = true;
  document.body.classList.remove("mj-aberto");
  mjCronoParar();
}

function mjAtualizarTopo() {
  mjEl("mjPlacar").textContent = `VFN ${state.jogo.golosVFN || 0} – ${state.jogo.golosAdversario || 0} ${state.preJogo.adversario || "Adversário"}`;
  const ultimo = state.jogo.eventos.find(ev => ev.id === modoJogo.ultimoId);
  mjEl("mjUltimo").innerHTML = ultimo
    ? `<span>Guardado: <b>${escapeHtml(formatarMinuto(ultimo))} ${escapeHtml(ultimo.tipo)}</b>${ultimo.equipa ? " · " + escapeHtml(nomeOuDetalheEvento(ultimo)) : ""}</span><button type="button" data-mj="desfazer">Desfazer</button>`
    : "";
}

function mjAbrirForm(tipo) {
  const equipa = TIPOS_SEM_EQUIPA.includes(tipo) || tipo === "Nota" || tipo === "Tempo Acrescentado" ? "" : "VFN";
  // com o cronómetro a contar, o minuto vem dele (pode sempre ser corrigido no formulário)
  const crono = mjCronoMinuto();
  const minuto = tipo === "Intervalo" ? (crono && crono.minuto > 45 ? 90 : 45) : crono ? crono.minuto : modoJogo.ultimoMinuto;
  modoJogo.rascunho = { tipo, equipa, minuto, acrescimo: tipo !== "Intervalo" && crono && crono.acrescimo ? crono.acrescimo : "", jogadorId: "", jogadorSaiId: "", assistId: "", detalhe: "", autogolo: false };
  const def = MODO_JOGO_TIPOS.find(t => t.tipo === tipo) || {};
  mjEl("mjFormTitulo").textContent = `${def.icone || ""} ${def.rotulo || tipo}`;
  mjEl("mjErro").textContent = "";
  mjRenderCampos();
  mjEl("mjGrelha").hidden = true;
  mjEl("mjUltimo").hidden = true;
  mjEl("mjForm").hidden = false;
  mjEl("mjForm").scrollTop = 0;
}

function mjFecharForm() {
  if (!mjEl("mjForm")) return;
  mjEl("mjForm").hidden = true;
  mjEl("mjGrelha").hidden = false;
  mjEl("mjUltimo").hidden = false;
}

const mjEscolha = (campo, valor, opcoes) => `<div class="mj-escolha" role="group">${opcoes.map(([v, t]) =>
  `<button type="button" data-mj-campo="${campo}" data-mj-valor="${escapeHtml(v)}" class="${String(valor) === String(v) ? "ativo" : ""}" aria-pressed="${String(valor) === String(v)}">${escapeHtml(t)}</button>`).join("")}</div>`;
const mjCampo = (rotulo, html, id) => `<div class="mj-campo">${id ? `<label for="${id}">${rotulo}</label>` : `<span class="mj-rotulo">${rotulo}</span>`}${html}</div>`;
const mjSelect = (id, valor, ids) => `<select id="${id}">${mjOpcoesJogadores(valor, ids)}</select>`;
const mjTexto = (id, valor, placeholder) => `<input type="text" id="${id}" value="${escapeHtml(valor || "")}" placeholder="${escapeHtml(placeholder)}" autocomplete="off">`;

/** Campos do mini-formulário conforme o tipo de evento (e a equipa escolhida). */
function mjRenderCampos() {
  const r = modoJogo.rascunho;
  const partes = [];
  const minuto = mjCampo("Minuto", `<div class="mj-minuto"><button type="button" data-mj="menos" aria-label="Menos um minuto">−</button><input type="number" id="mjMinuto" inputmode="numeric" min="0" max="130" value="${Number(r.minuto) || 0}"><button type="button" data-mj="mais" aria-label="Mais um minuto">+</button><span>+</span><input type="number" id="mjAcrescimo" class="mj-acrescimo" inputmode="numeric" min="0" max="30" placeholder="X" value="${r.acrescimo || ""}" aria-label="Tempo adicionado (+X)"></div>`, "mjMinuto");

  if (r.tipo === "Tempo Acrescentado") {
    partes.push(mjCampo("Parte", mjEscolha("parte", r.parte || (Number(r.minuto) > 45 ? 90 : 45), [[45, "1.ª parte (45')"], [90, "2.ª parte (90')"]])));
    partes.push(`<input type="hidden" id="mjMinuto" value="${Number(r.parte) || (Number(r.minuto) > 45 ? 90 : 45)}">`);
    partes.push(mjCampo("Minutos de compensação (+X)", `<input type="number" id="mjDetalhe" inputmode="numeric" min="1" max="30" value="${escapeHtml(r.detalhe || "")}" placeholder="4">`, "mjDetalhe"));
  } else {
    partes.push(minuto);
  }

  if (r.tipo === "Golo") {
    // equipa = quem beneficia do golo; com autogolo, o marcador é da outra equipa
    partes.push(mjCampo("Golo de", mjEscolha("equipa", r.equipa, [["VFN", "VFN"], ["Adversário", "Adversário"]])));
    partes.push(`<label class="mj-check"><input type="checkbox" id="mjAutogolo" ${r.autogolo ? "checked" : ""}> Autogolo (marcado por um jogador da outra equipa)</label>`);
    const marcadorVFN = (r.equipa === "VFN") !== r.autogolo;
    if (marcadorVFN) {
      partes.push(mjCampo(r.autogolo ? "Jogador do VFN (autogolo)" : "Marcador", mjSelect("mjJogador", r.jogadorId, r.autogolo ? jogadoresParaCartao() : jogadoresEmCampo()), "mjJogador"));
      if (!r.autogolo) partes.push(mjCampo("Assistência (opcional)", mjSelect("mjAssist", r.assistId, convocadosIds().filter(id => id !== Number(r.jogadorId))), "mjAssist"));
    } else {
      partes.push(mjCampo(r.autogolo ? "Jogador adversário (opcional)" : "Marcador adversário (opcional)", mjTexto("mjDetalhe", r.detalhe, "Nome ou número"), "mjDetalhe"));
    }
    if (typeof mjCamposGolo === "function") partes.push(mjCamposGolo(r)); // zonas do golo (tarefa 3)
  } else if (MODO_JOGO_COM_JOGADOR.includes(r.tipo)) {
    partes.push(mjCampo("Equipa", mjEscolha("equipa", r.equipa, [["VFN", "VFN"], ["Adversário", "Adversário"]])));
    if (r.equipa === "VFN") {
      const ids = r.tipo.startsWith("Cartão") ? jogadoresParaCartao() : r.tipo === "Lesão" ? convocadosIds() : jogadoresEmCampo();
      partes.push(mjCampo("Jogador", mjSelect("mjJogador", r.jogadorId, ids), "mjJogador"));
    } else {
      partes.push(mjCampo("Jogador adversário (opcional)", mjTexto("mjDetalhe", r.detalhe, "Nome ou número"), "mjDetalhe"));
    }
    if (typeof mjCamposCartao === "function") partes.push(mjCamposCartao(r)); // suspensão do vermelho (tarefa 5)
  } else if (r.tipo === "Substituição") {
    const suplentes = suplentesIds();
    const banco = bancoDisponivel().filter(id => !suplentes.length || suplentes.includes(id));
    partes.push(mjCampo("Sai", mjSelect("mjSai", r.jogadorSaiId, jogadoresEmCampo()), "mjSai"));
    partes.push(mjCampo("Entra", mjSelect("mjJogador", r.jogadorId, banco), "mjJogador"));
  } else if (r.tipo === "Nota") {
    partes.push(mjCampo("Nota", `<textarea id="mjDetalhe" rows="4" placeholder="O que aconteceu?">${escapeHtml(r.detalhe || "")}</textarea>`, "mjDetalhe"));
  }
  mjEl("mjCampos").innerHTML = partes.join("");
}

/** Copia os valores do formulário para o rascunho (antes de redesenhar ou guardar). */
function mjLerCampos() {
  const r = modoJogo.rascunho;
  const v = id => mjEl(id) ? mjEl(id).value : undefined;
  if (v("mjMinuto") !== undefined) r.minuto = Math.max(0, Number(v("mjMinuto")) || 0);
  if (v("mjAcrescimo") !== undefined) r.acrescimo = Number(v("mjAcrescimo")) > 0 ? Number(v("mjAcrescimo")) : "";
  if (v("mjJogador") !== undefined) r.jogadorId = v("mjJogador") ? Number(v("mjJogador")) : "";
  if (v("mjAssist") !== undefined) r.assistId = v("mjAssist") ? Number(v("mjAssist")) : "";
  if (v("mjSai") !== undefined) r.jogadorSaiId = v("mjSai") ? Number(v("mjSai")) : "";
  if (v("mjDetalhe") !== undefined) r.detalhe = String(v("mjDetalhe")).trim();
  if (mjEl("mjAutogolo")) r.autogolo = mjEl("mjAutogolo").checked;
  if (typeof mjLerCamposExtra === "function") mjLerCamposExtra(r);
}

function mjGuardar() {
  mjLerCampos();
  const r = modoJogo.rascunho;
  const vfn = r.equipa === "VFN";
  let erro = "";
  if (r.tipo === "Golo" && ((r.equipa === "VFN") !== r.autogolo) && !r.jogadorId) erro = "Escolhe o jogador do VFN.";
  else if (MODO_JOGO_COM_JOGADOR.includes(r.tipo) && vfn && !r.jogadorId) erro = "Escolhe o jogador.";
  else if (r.tipo === "Substituição" && (!r.jogadorSaiId || !r.jogadorId)) erro = "Escolhe quem sai e quem entra.";
  else if (r.tipo === "Tempo Acrescentado" && !(Number(r.detalhe) > 0)) erro = "Indica os minutos de compensação.";
  else if (r.tipo === "Nota" && !r.detalhe) erro = "Escreve a nota.";
  else if (typeof mjValidarExtra === "function") erro = mjValidarExtra(r) || "";
  mjEl("mjErro").textContent = erro;
  if (erro) return;

  const ev = { id: uid(), minuto: r.minuto, acrescimo: r.acrescimo, equipa: r.equipa, tipo: r.tipo, jogadorId: "", jogadorSaiId: "", assistId: "", detalhe: "" };
  if (r.tipo === "Golo") {
    // autogolo: o evento fica com a equipa de quem o marcou (como na tabela de eventos)
    if (r.autogolo) { ev.tipo = "Auto-golo"; ev.equipa = vfn ? "Adversário" : "VFN"; }
    if (ev.equipa === "VFN") { ev.jogadorId = r.jogadorId; if (!r.autogolo) ev.assistId = r.assistId || ""; } else ev.detalhe = r.detalhe;
  } else if (MODO_JOGO_COM_JOGADOR.includes(r.tipo)) {
    if (vfn) ev.jogadorId = r.jogadorId; else ev.detalhe = r.detalhe;
  } else if (r.tipo === "Substituição") {
    ev.equipa = "VFN"; ev.jogadorSaiId = r.jogadorSaiId; ev.jogadorId = r.jogadorId;
  } else if (r.tipo === "Tempo Acrescentado" || r.tipo === "Nota") {
    ev.detalhe = r.detalhe;
  }
  if (typeof mjCompletarEvento === "function") mjCompletarEvento(ev, r);

  state.jogo.eventos.push(ev);
  modoJogo.ultimoMinuto = r.minuto;
  modoJogo.ultimoId = ev.id;
  renderEventos(true); // tabela, linha do tempo, resultado e estatísticas
  guardarRascunho();
  mjFecharForm();
  mjAtualizarTopo();
  if (ev.tipo === "Intervalo") mjCronoAcao("intervalo"); // o intervalo pausa o cronómetro
}

function mjDesfazer() {
  if (!modoJogo.ultimoId) return;
  state.jogo.eventos = state.jogo.eventos.filter(ev => ev.id !== modoJogo.ultimoId);
  modoJogo.ultimoId = null;
  renderEventos(false);
  guardarRascunho();
  mjAtualizarTopo();
}

document.addEventListener("DOMContentLoaded", () => {
  const botao = mjEl("btnModoJogo");
  if (botao) botao.addEventListener("click", abrirModoJogo);
});

/* ---------- Zonas do golo (tarefa 3): no Modo Jogo e na tabela de eventos ----------
   Campos do evento de golo: zona_golo (obrigatória), zona_origem (opcional), tipo_lance e
   golo_sofrido (tirado da equipa: golo do adversário ou autogolo do VFN). */

function mjCamposGolo(r) {
  // "Golo sofrido" = golo do adversário (equipa beneficiada = Adversário)
  return VFNComp.camposZonasGoloHTML(r, "mj", r.equipa === "Adversário");
}

function mjLerCamposExtra(r) {
  if (mjEl("mjSuspensao")) r.suspensao_jogos = Math.max(1, Number(mjEl("mjSuspensao").value) || 1);
  if (r.tipo !== "Golo" || !mjEl("mjCampos").querySelector(".zonas-golo")) return;
  Object.assign(r, VFNComp.lerZonasGolo(mjEl("mjCampos"), "mj"));
}

/** Vermelho do VFN: jogos de suspensão (1 automático; mais se a decisão disciplinar o fixar). */
function mjCamposCartao(r) {
  if (r.tipo !== "Cartão Vermelho" || r.equipa !== "VFN") return "";
  return mjCampo("Jogos de suspensão", `<input type="number" id="mjSuspensao" inputmode="numeric" min="1" max="20" value="${Number(r.suspensao_jogos) || 1}">`, "mjSuspensao");
}

function mjValidarExtra(r) {
  return r.tipo === "Golo" && !r.zona_golo ? "Escolhe a zona do golo." : "";
}

function mjCompletarEvento(ev, r) {
  if (ev.tipo === "Cartão Vermelho" && ev.equipa === "VFN") ev.suspensao_jogos = Math.max(1, Number(r.suspensao_jogos) || 1);
  if (r.tipo !== "Golo") return;
  ev.zona_golo = r.zona_golo || "";
  ev.zona_origem = r.zona_origem || "";
  ev.tipo_lance = r.tipo_lance || "";
  ev.golo_sofrido = VFN.eGoloSofrido(ev);
}

/** Modal das zonas de um golo já registado (botão "📍 Zona" na tabela "Eventos do Jogo"). */
function abrirZonasEvento(ev) {
  let modal = mjEl("modalZonasGolo");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "modalZonasGolo";
    modal.className = "modal-overlay";
    modal.hidden = true;
    modal.innerHTML = `<div class="modal-box modal-md" role="dialog" aria-modal="true" aria-labelledby="zgTitulo">
      <div class="modal-cab"><h3 id="zgTitulo" class="modal-title">Zona do golo</h3><button type="button" class="modal-x" data-zg="fechar" aria-label="Fechar">×</button></div>
      <div id="zgCampos"></div><p id="zgErro" class="form-error" role="alert"></p>
      <div class="modal-actions"><button type="button" class="btn btn-ghost" data-zg="fechar">Cancelar</button><button type="button" class="btn btn-accent" data-zg="guardar">Guardar</button></div></div>`;
    document.body.appendChild(modal);
    VFNComp.ligarSeletoresZona(modal);
    modal.addEventListener("click", e => {
      if (e.target === modal || e.target.closest("[data-zg=fechar]")) { modal.hidden = true; return; }
      if (!e.target.closest("[data-zg=guardar]")) return;
      const alvo = state.jogo.eventos.find(x => x.id === Number(modal.dataset.evento));
      if (!alvo) { modal.hidden = true; return; }
      const z = VFNComp.lerZonasGolo(mjEl("zgCampos"), "zg");
      if (!z.zona_golo) { mjEl("zgErro").textContent = "Escolhe a zona do golo."; return; }
      Object.assign(alvo, z);
      // "Golo sofrido" troca a equipa do golo (mantém a coerência com a tabela)
      const sofrido = mjEl("zgSofrido").checked;
      if (sofrido !== VFN.eGoloSofrido(alvo)) {
        alvo.equipa = alvo.equipa === "VFN" ? "Adversário" : "VFN";
        alvo.jogadorId = ""; alvo.assistId = "";
      }
      alvo.golo_sofrido = VFN.eGoloSofrido(alvo);
      modal.hidden = true;
      renderEventos(false);
      guardarRascunho();
    });
    document.addEventListener("keydown", e => { if (e.key === "Escape" && !modal.hidden) modal.hidden = true; });
  }
  modal.dataset.evento = ev.id;
  mjEl("zgTitulo").textContent = `Zona do golo · ${formatarMinuto(ev)} ${ev.equipa === "VFN" ? nomeOuDetalheEvento(ev) : ev.detalhe || "Adversário"}`;
  mjEl("zgCampos").innerHTML = VFNComp.camposZonasGoloHTML(ev, "zg", VFN.eGoloSofrido(ev));
  mjEl("zgErro").textContent = "";
  modal.hidden = false;
}

/* ---------- Cronómetro do jogo (v15) ----------
   Estados: "parado" (antes do apito) → "jogo" (a contar) ⇄ "pausa" (manual) → "intervalo" (evento
   Intervalo; recomeça com "Recomeçar 2.ª parte") → "jogo" (2.ª parte, a partir de metade da duração)
   → "fim" (botão "Terminar Jogo"). Conta a partir de timestamps (não perde tempo com o separador em
   segundo plano) e guarda-se em localStorage "vfn_timer_<matchId>" para sobreviver a um reload. */

const mjCrono = { estado: "parado", parte: 1, acumuladoMs: 0, inicioMs: 0 };
let mjCronoIntervalo = 0;

const mjCronoChave = () => "vfn_timer_" + ((state.preJogo && state.preJogo.matchId) || "rascunho");
const mjCronoMetadeMs = () => ((Number(state.jogo.duracaoJogo) || 90) / 2) * 60000;

/** Tempo de jogo em ms (2.ª parte começa em metade da duração, ex. 45:00). */
function mjCronoMs() {
  const decorrido = mjCrono.acumuladoMs + (mjCrono.estado === "jogo" ? Date.now() - mjCrono.inicioMs : 0);
  return (mjCrono.parte === 2 ? mjCronoMetadeMs() : 0) + decorrido;
}

/** Minuto do evento a partir do cronómetro: 0:30 → 1'; depois do fim da parte, 45+X / 90+X. Null parado. */
function mjCronoMinuto() {
  if (mjCrono.estado === "parado" || mjCrono.estado === "fim") return null;
  const minuto = Math.floor(mjCronoMs() / 60000) + 1;
  const limite = (mjCrono.parte === 2 ? 2 : 1) * mjCronoMetadeMs() / 60000;
  return minuto > limite ? { minuto: limite, acrescimo: minuto - limite } : { minuto, acrescimo: "" };
}

function mjCronoGuardar() {
  try { localStorage.setItem(mjCronoChave(), JSON.stringify(mjCrono)); } catch (e) { /* sem storage: só nesta sessão */ }
}

function mjCronoCarregar() {
  let guardado = null;
  try { guardado = JSON.parse(localStorage.getItem(mjCronoChave()) || "null"); } catch (e) { /* ignora */ }
  Object.assign(mjCrono, { estado: "parado", parte: 1, acumuladoMs: 0, inicioMs: 0 }, guardado || {});
  mjCronoRender();
  clearInterval(mjCronoIntervalo);
  mjCronoIntervalo = setInterval(mjCronoTique, 1000);
}

function mjCronoParar() {
  clearInterval(mjCronoIntervalo);
  mjCronoIntervalo = 0;
}

const mjFormatarTempo = ms => { const s = Math.max(0, Math.floor(ms / 1000)); return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; };

function mjCronoTique() {
  const visor = mjEl("mjCronoTempo");
  if (visor) visor.textContent = mjFormatarTempo(mjCronoMs());
}

function mjCronoAcao(acao) {
  const agora = Date.now();
  const congelar = () => { if (mjCrono.estado === "jogo") mjCrono.acumuladoMs += agora - mjCrono.inicioMs; };
  if (acao === "iniciar") Object.assign(mjCrono, { estado: "jogo", parte: 1, acumuladoMs: 0, inicioMs: agora });
  else if (acao === "pausa") { congelar(); mjCrono.estado = "pausa"; }
  else if (acao === "retomar") Object.assign(mjCrono, { estado: "jogo", inicioMs: agora });
  else if (acao === "intervalo") { if (mjCrono.estado !== "jogo" && mjCrono.estado !== "pausa") return; congelar(); mjCrono.estado = "intervalo"; }
  else if (acao === "segunda") Object.assign(mjCrono, { estado: "jogo", parte: 2, acumuladoMs: 0, inicioMs: agora });
  else if (acao === "terminar") {
    if (!confirm("Terminar o jogo? O cronómetro para.")) return;
    congelar(); mjCrono.estado = "fim";
  } else if (acao === "repor") {
    if (!confirm("Repor o cronómetro a 00:00?")) return;
    Object.assign(mjCrono, { estado: "parado", parte: 1, acumuladoMs: 0, inicioMs: 0 });
  }
  mjCronoGuardar();
  mjCronoRender();
}

function mjCronoRender() {
  const caixa = mjEl("mjCronometro");
  if (!caixa) return;
  const total = (Number(state.jogo.duracaoJogo) || 90);
  const alvo = mjCrono.parte === 2 ? total : total / 2;
  const b = (acao, texto, classe) => `<button type="button" class="mj-crono-btn ${classe || ""}" data-mj="crono-${acao}">${texto}</button>`;
  const rotulo = { parado: "Antes do apito inicial", jogo: mjCrono.parte === 2 ? "2.ª parte" : "1.ª parte", pausa: "Em pausa", intervalo: "Intervalo", fim: "Jogo terminado" }[mjCrono.estado];
  const botoes = {
    parado: b("iniciar", "▶ Iniciar Jogo", "principal"),
    jogo: b("pausa", "⏸ Pausa") + b("terminar", "■ Terminar Jogo", "perigo"),
    pausa: b("retomar", "▶ Retomar", "principal") + b("terminar", "■ Terminar Jogo", "perigo"),
    intervalo: b("segunda", "▶ Recomeçar 2.ª parte", "principal") + b("terminar", "■ Terminar Jogo", "perigo"),
    fim: b("repor", "↺ Repor")
  }[mjCrono.estado];
  caixa.className = `mj-cronometro estado-${mjCrono.estado}`;
  caixa.innerHTML = `<div class="mj-crono-visor"><span id="mjCronoTempo" class="mj-crono-tempo" aria-live="off">${mjFormatarTempo(mjCronoMs())}</span><span class="mj-crono-alvo">/ ${mjFormatarTempo(alvo * 60000)}</span></div>
    <span class="mj-crono-estado">${rotulo}</span>
    <div class="mj-crono-botoes">${botoes}</div>`;
}
