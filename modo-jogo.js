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
      <div><strong id="mjTitulo">🎮 Modo Jogo</strong><span id="mjPlacar" class="mj-placar"></span></div>
      <button type="button" class="mj-fechar" data-mj="fechar">✗ Fechar Modo Jogo</button>
    </header>
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
  });
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
  mjEl("modoJogo").hidden = false;
  document.body.classList.add("mj-aberto");
}

function fecharModoJogo() {
  const caixa = mjEl("modoJogo");
  if (caixa) caixa.hidden = true;
  document.body.classList.remove("mj-aberto");
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
  modoJogo.rascunho = { tipo, equipa, minuto: tipo === "Intervalo" ? 45 : modoJogo.ultimoMinuto, acrescimo: "", jogadorId: "", jogadorSaiId: "", assistId: "", detalhe: "", autogolo: false };
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
