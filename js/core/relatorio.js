"use strict";

/* =========================================================
   Relatório de jogo — vista só de leitura e exportação Word.
   Usado pelo dashboard (Histórico). Lê o match_data do relatório
   (o mesmo estado que o admin edita) e as colunas de match_reports.
   Depende de shared.js (VFN) e, para o Word, de docx.js.
   ========================================================= */

(function () {
  const esc = VFN.escapeHtml;
  const SECCOES = [["organizacaoOfensiva", "Organização Ofensiva"], ["organizacaoDefensiva", "Organização Defensiva"], ["transicoesOfensivas", "Transições Ofensivas"], ["transicoesDefensivas", "Transições Defensivas"], ["bolasParadas", "Bolas Paradas"]];
  const AVALIACAO = { Bom: "Bom", Medio: "Médio", Mau: "Mau" };

  function estadoRelatorio(r) {
    return VFN.estadoRelatorio(r);
  }

  function minuto(e) {
    return `${Number(e.minuto) || 0}${Number(e.acrescimo) > 0 ? "+" + Number(e.acrescimo) : ""}'`;
  }

  /** Dados do relatório organizados por secção (nomes já resolvidos). */
  function extrair(r, nomeJogador) {
    const m = (r && r.match_data) || {};
    const pre = m.preJogo || {}, jogo = m.jogo || {}, an = m.analise || {};
    const nome = id => (id ? nomeJogador(id) : "") || "—";
    const eventos = (jogo.eventos || []).slice().sort((a, b) => (Number(a.minuto) || 0) - (Number(b.minuto) || 0) || (Number(a.acrescimo) || 0) - (Number(b.acrescimo) || 0));
    const vfnEm = t => eventos.filter(e => e.equipa === "VFN" && e.tipo === t);
    const casa = pre.casaFora !== "Fora";
    const seccoes = SECCOES.map(([k, t]) => ({ titulo: t, avaliacao: AVALIACAO[((an.seccoes || {})[k] || {}).avaliacao] || "", texto: ((an.seccoes || {})[k] || {}).texto || "" })).filter(s => s.avaliacao || s.texto);
    const golos = eventos.filter(e => e.tipo === "Golo" || e.tipo === "Auto-golo").map(e => ({ min: minuto(e), vfn: (e.tipo === "Golo") === (e.equipa === "VFN"), texto: e.equipa === "VFN" ? nome(e.jogadorId) + (e.assistId ? ` (assist. ${nome(e.assistId)})` : "") : (e.detalhe || "Adversário") + (e.tipo === "Auto-golo" ? " (autogolo)" : "") }));
    const d = {
      competicao: r.competition || pre.competicao || "",
      jornada: pre.jornada || "",
      data: r.match_date || pre.data || "",
      local: r.location || pre.local || (casa ? "Casa" : "Fora"),
      casa,
      adversario: r.opponent || pre.adversario || "Adversário",
      adversarioId: pre.adversarioId || "",
      golosVFN: r.score_vfn ?? jogo.golosVFN ?? 0,
      golosAdv: r.score_opponent ?? jogo.golosAdversario ?? 0,
      formacao: r.formation || jogo.formacaoVFN || "",
      formacaoAdv: jogo.formacaoAdversario === "Outro" ? (jogo.formacaoAdversarioOutro || "Outro") : (jogo.formacaoAdversario || ""),
      onze: (jogo.titulares || []).filter(Boolean).map(id => nome(id) + (String(id) === String(jogo.capitaoId) ? " (C)" : "")),
      suplentes: (jogo.suplentes || []).filter(Boolean).map(nome),
      substituicoes: vfnEm("Substituição").map(e => ({ min: minuto(e), sai: nome(e.jogadorSaiId), entra: nome(e.jogadorId) })),
      golos,
      amarelos: vfnEm("Cartão Amarelo").map(e => ({ min: minuto(e), nome: nome(e.jogadorId) })),
      vermelhos: vfnEm("Cartão Vermelho").map(e => ({ min: minuto(e), nome: nome(e.jogadorId) })),
      // estrutura do relatório (v9): Resumo Rápido · Síntese · Evolução do Jogo · Momentos e Situações · Análise Tática · Tópicos para o Treino
      marcadores: marcadoresTexto(golos),
      // relatórios antigos sem síntese: os "Pontos positivos" fazem as vezes dela
      sintese: an.sintese || an.positivos || "",
      primeiroTempo: r.first_half_notes || an.primeiroTempo || "",
      segundoTempo: r.second_half_notes || an.segundoTempo || "",
      seccoes,
      adversarioAnalise: an.adversario || {},
      notasPreviasAdversario: pre.notasAdversario || "",
      // "Pontos a melhorar" passou a "Tópicos para o treino": nos relatórios antigos junta as duas listas, sem repetir
      // (areas_to_improve: nos antigos é "Pontos a melhorar"; desde a v9 é uma cópia dos tópicos)
      topicos: [...new Set([...paragrafos(an.topicosTreino), ...paragrafos(an.aMelhorar), ...paragrafos(r.areas_to_improve)])].join("\n"),
      // momentos do jogo avaliados como Mau/Médio: a origem dos tópicos para o treino
      aTrabalhar: seccoes.filter(s => s.avaliacao === "Mau" || s.avaliacao === "Médio")
    };
    // v1.1: ficha publicada — sem a análise (só a ficha do jogo: onze, eventos, marcadores) e com os minutos jogados
    d.comAnalise = VFN.estadoRelatorio(r) !== "ficha_publicada";
    if (!d.comAnalise) Object.assign(d, { sintese: "", primeiroTempo: "", segundoTempo: "", seccoes: [], adversarioAnalise: {}, notasPreviasAdversario: "", topicos: "", aTrabalhar: [] });
    const H = window.VFNHub;
    d.minutos = !d.comAnalise && H && H.minutosDoRelatorio
      ? Object.entries(H.minutosDoRelatorio(m)).map(([id, min]) => ({ nome: nome(id), min: Math.round(min) })).filter(x => x.nome !== "—" && x.min > 0).sort((a, b) => b.min - a.min)
      : [];
    return d;
  }

  /** "VFN: Toneca 12', Marco 60' · Adversário: 45'" (vazio sem golos). */
  function marcadoresTexto(golos) {
    const lado = vfn => golos.filter(g => g.vfn === vfn).map(g => `${g.texto.replace(/ \(assist\. .*\)$/, "")} ${g.min}`).join(", ");
    return [golos.some(g => g.vfn) ? `VFN: ${lado(true)}` : "", golos.some(g => !g.vfn) ? `Adversário: ${lado(false)}` : ""].filter(Boolean).join(" · ");
  }

  /** "Transições Defensivas (Mau), Bolas Paradas (Médio)": momentos que originam os tópicos para o treino. */
  const textoATrabalhar = lista => lista.map(s => `${s.titulo} (${s.avaliacao})`).join(", ");

  /**
   * Completa um relatório com os dados do jogo do calendário (data, adversário, resultado...)
   * quando o relatório não os tem (relatórios antigos ou incompletos). Não altera o original.
   */
  function comJogo(r, jogo, nomeAdversario) {
    if (!r || !jogo) return r;
    const m = r.match_data || {}, pre = m.preJogo || {}, j = m.jogo || {};
    const casa = VFN.jogoEmCasa(jogo);
    const jogado = jogo.score_home != null && jogo.score_away != null;
    const vazio = v => v === undefined || v === null || v === "";
    const base = { data: VFN.dataIso(jogo.date), adversario: nomeAdversario || jogo.opponent, adversarioId: jogo.opponent_team_id || "", competicao: jogo.competition || "", jornada: jogo.jornada != null ? String(jogo.jornada) : "", casaFora: casa ? "Casa" : "Fora", local: jogo.venue || "" };
    const preFinal = { ...pre };
    Object.entries(base).forEach(([k, v]) => { if (vazio(preFinal[k]) && !vazio(v)) preFinal[k] = v; });
    const jogoFinal = { ...j };
    if (jogado && vazio(j.golosVFN) && vazio(r.score_vfn)) jogoFinal.golosVFN = casa ? jogo.score_home : jogo.score_away;
    if (jogado && vazio(j.golosAdversario) && vazio(r.score_opponent)) jogoFinal.golosAdversario = casa ? jogo.score_away : jogo.score_home;
    return { ...r, match_data: { ...m, preJogo: preFinal, jogo: jogoFinal } };
  }

  const paragrafos = t => String(t || "").split(/\n+/).map(x => x.trim()).filter(Boolean);
  const blocoTexto = (titulo, texto, classe) => texto ? `<section class="rel-bloco${classe ? " " + classe : ""}"><h4>${esc(titulo)}</h4>${paragrafos(texto).map(p => `<p>${esc(p)}</p>`).join("")}</section>` : "";
  const subTexto = (titulo, texto) => texto ? `<h5>${esc(titulo)}</h5>${paragrafos(texto).map(p => `<p>${esc(p)}</p>`).join("")}` : "";

  /** Vista só de leitura do relatório. ctx: { nomeJogador, logoEquipa(teamId, nome) } */
  function html(r, ctx) {
    const d = extrair(r, ctx.nomeJogador);
    const vfn = `<div class="rel-equipa">${ctx.logoVFN || ""}<strong>VFN</strong></div>`;
    const adv = `<div class="rel-equipa">${ctx.logoEquipa ? ctx.logoEquipa(d.adversarioId, d.adversario) : ""}<strong>${esc(d.adversario)}</strong></div>`;
    const lista = (titulo, itens) => itens.length ? `<div class="rel-lista"><h5>${esc(titulo)}</h5><p>${itens.map(esc).join(", ")}</p></div>` : "";
    return `
      <div class="rel-placar">
        ${d.casa ? vfn : adv}
        <div class="rel-resultado">${d.casa ? d.golosVFN : d.golosAdv}<span>–</span>${d.casa ? d.golosAdv : d.golosVFN}</div>
        ${d.casa ? adv : vfn}
      </div>
      <p class="rel-meta">${esc([d.competicao, d.jornada ? "Jornada " + d.jornada : "", VFN.dataDDMMAAAA(d.data), d.local].filter(Boolean).join(" · "))}</p>
      ${d.marcadores ? `<p class="rel-marcadores">${VFN.icone("bola", 14)} ${esc(d.marcadores)}</p>` : ""}
      ${blocoTexto("Síntese", d.sintese, "rel-sintese")}
      ${d.primeiroTempo || d.segundoTempo ? `<section class="rel-bloco"><h4>Evolução do Jogo</h4>${subTexto("1.ª parte", d.primeiroTempo)}${subTexto("2.ª parte", d.segundoTempo)}</section>` : ""}
      ${!d.comAnalise ? `<p class="rel-sem-analise muted">${VFN.icone("info", 16)} Análise não disponível para este jogo (ficha publicada).</p>` : ""}
      ${d.seccoes.length || temAdversario(d) ? `<section class="rel-bloco"><h4>Análise Tática</h4>${d.seccoes.map(s => `<div class="rel-seccao"><h5>${esc(s.titulo)}${s.avaliacao ? ` <span class="rel-aval aval-${esc(s.avaliacao)}">${esc(s.avaliacao)}</span>` : ""}</h5>${paragrafos(s.texto).map(p => `<p>${esc(p)}</p>`).join("")}</div>`).join("")}${adversarioHTML(d)}</section>` : ""}
      ${d.topicos ? `<section class="rel-bloco"><h4>Tópicos para o Treino</h4>${d.aTrabalhar.length ? `<p class="rel-origem">A partir de: ${esc(textoATrabalhar(d.aTrabalhar))}</p>` : ""}<ol>${paragrafos(d.topicos).map(t => `<li>${esc(t)}</li>`).join("")}</ol></section>` : ""}
      <section class="rel-bloco"><h4>Ficha do Jogo</h4>
      <div class="rel-grelha">
        <div>
          ${d.formacao ? `<p><strong>Formação:</strong> ${esc(d.formacao)}${d.formacaoAdv ? ` · adversário ${esc(d.formacaoAdv)}` : ""}</p>` : ""}
          ${lista("Onze inicial", d.onze)}${lista("Suplentes", d.suplentes)}${lista("Minutos jogados", d.minutos.map(x => `${x.nome} ${x.min}'`))}
          ${d.substituicoes.length ? `<div class="rel-lista"><h5>Substituições</h5><ul>${d.substituicoes.map(s => `<li>${esc(s.min)} ${esc(s.sai)} ↘ ${esc(s.entra)} ↗</li>`).join("")}</ul></div>` : ""}
        </div>
        <div>
          ${d.golos.length ? `<div class="rel-lista"><h5>Golos</h5><ul>${d.golos.map(g => `<li class="${g.vfn ? "golo-vfn" : "golo-adv"}">${esc(g.min)} ${esc(g.texto)}</li>`).join("")}</ul></div>` : "<p class=\"muted\">Sem golos registados.</p>"}
          ${d.amarelos.length ? `<div class="rel-lista"><h5>Amarelos</h5><ul>${d.amarelos.map(c => `<li>${esc(c.min)} ${esc(c.nome)}</li>`).join("")}</ul></div>` : ""}
          ${d.vermelhos.length ? `<div class="rel-lista"><h5>Vermelhos</h5><ul>${d.vermelhos.map(c => `<li>${esc(c.min)} ${esc(c.nome)}</li>`).join("")}</ul></div>` : ""}
        </div>
      </div>
      </section>`;
  }

  /** Adversário na Análise Tática: três campos com propósitos distintos (+ jogadores-chave e notas prévias). */
  const camposAdversario = d => {
    const a = d.adversarioAnalise || {};
    return [["Estilo de Jogo", a.estilo], ["Pontos Fortes", a.pontosFortes], ["Vulnerabilidades", a.vulnerabilidades]].filter(([, v]) => v);
  };
  const jogadoresChave = d => ((d.adversarioAnalise || {}).jogadoresChave || []).filter(j => j && j.nome);
  /** "#9 Rui (PL) — descrição": o ID zerozero (idZerozero) fica só como referência, nunca no relatório. */
  const textoJogadorChave = j => `${j.numero ? "#" + j.numero + " " : ""}${j.nome}${j.posicao ? ` (${j.posicao})` : ""}${j.descricao ? " — " + j.descricao : ""}`;
  const temAdversario = d => camposAdversario(d).length > 0 || jogadoresChave(d).length > 0 || !!d.notasPreviasAdversario;

  function adversarioHTML(d) {
    if (!temAdversario(d)) return "";
    const chave = jogadoresChave(d);
    return `<div class="rel-seccao rel-adversario"><h5>Adversário — ${esc(d.adversario)}</h5>
      ${camposAdversario(d).map(([t, v]) => `<p><strong>${esc(t)}:</strong> ${esc(v)}</p>`).join("")}
      ${chave.length ? `<p><strong>Jogadores-chave:</strong> ${chave.map(j => esc(textoJogadorChave(j))).join("; ")}</p>` : ""}
      ${d.notasPreviasAdversario ? `<p><strong>Notas prévias:</strong> ${esc(d.notasPreviasAdversario)}</p>` : ""}</div>`;
  }

  /* ---------- Word ---------- */

  async function logoParaWord(urls, maximo) {
    for (const url of urls.filter(Boolean)) {
      try {
        const resp = await fetch(url);
        if (!resp.ok) continue;
        const blob = await resp.blob();
        if (!/png|jpe?g/i.test(blob.type) && !/\.(png|jpe?g)(\?|$)/i.test(url)) continue;
        const dataUrl = await new Promise((res, rej) => { const f = new FileReader(); f.onload = () => res(f.result); f.onerror = rej; f.readAsDataURL(blob); });
        const dims = await new Promise(res => { const i = new Image(); i.onload = () => res({ w: i.naturalWidth, h: i.naturalHeight }); i.onerror = () => res(null); i.src = dataUrl; });
        if (!dims) continue;
        const k = Math.min(1, (maximo || 90) / Math.max(dims.w, dims.h));
        const bin = atob(dataUrl.split(",")[1]);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return { data: bytes, type: /png/i.test(blob.type) || /\.png/i.test(url) ? "png" : "jpg", width: Math.round(dims.w * k), height: Math.round(dims.h * k) };
      } catch (e) { /* tenta o seguinte */ }
    }
    return null;
  }

  /**
   * Documento Word do relatório (V2.0, o mesmo para o admin e o dashboard). Folha 1 · Relatório: cabeçalho compacto
   * (logos pequenos, resultado, competição · jornada · data, marcadores), Síntese, Evolução do Jogo, Análise Tática,
   * Adversário e Tópicos para o Treino. Folha 2 · Ficha de Jogo: formações, onze por posição e suplentes, linha do
   * tempo e minutos jogados. Devolve o Blob (null sem a biblioteca).
   * ctx: { nomeJogador(id), numeroJogador(id) (opcional), urlsLogoAdversario: [] }
   */
  async function documentoWord(r, ctx) {
    const D = window.docx;
    if (!D) { alert("A biblioteca do Word não carregou. Verifica a ligação à internet."); return null; }
    const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, ImageRun, BorderStyle, ShadingType, Footer, PageBreak, PageNumber, VerticalAlign, TableLayoutType } = D;
    const d = extrair(r, ctx.nomeJogador);
    const m = (r && r.match_data) || {}, jogo = m.jogo || {};
    const NAVY = "0A1628", AMARELO = "F5B301", TEXTO = "1F2937", SUAVE = "6B7280", LINHA = "E5E7EB", FUNDO = "F7F8FA";
    const COR_AVALIACAO = { Bom: "15803D", "Médio": "B45309", Mau: "B91C1C" };
    const nada = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
    const semBordas = { top: nada, bottom: nada, left: nada, right: nada };
    const bordasTabela = { top: nada, bottom: nada, left: nada, right: nada, insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: LINHA }, insideVertical: nada };
    const run = (text, o) => new TextRun({ text: String(text ?? ""), size: 19, color: TEXTO, ...(o || {}) });
    const par = (filhos, o) => new Paragraph({ spacing: { after: 60 }, ...(o || {}), children: Array.isArray(filhos) ? filhos : [filhos] });
    const textoDe = t => paragrafos(t).map(p => par(run(p), { spacing: { after: 70, line: 264 } }));
    // título de secção: barra amarela à esquerda, navy, em maiúsculas
    const titulo = (t, antes) => new Paragraph({ spacing: { before: antes ?? 220, after: 90 }, indent: { left: 120 }, border: { left: { style: BorderStyle.SINGLE, size: 24, color: AMARELO, space: 8 } }, children: [run(t.toUpperCase(), { bold: true, size: 21, color: NAVY })] });
    const celula = (filhos, o) => new TableCell({ borders: semBordas, margins: { top: 60, bottom: 60, left: 100, right: 100 }, verticalAlign: VerticalAlign.CENTER, ...(o || {}), children: Array.isArray(filhos) ? filhos : [filhos] });
    // layout fixo: o Word respeita as larguras das colunas (sem isso estica a 1.ª coluna)
    const tabela = (linhas, larguras, o) => new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, layout: TableLayoutType.FIXED, borders: bordasTabela, columnWidths: larguras, rows: linhas, ...(o || {}) });

    // ---------- cabeçalho ----------
    const [logoVFN, logoAdv] = await Promise.all([logoParaWord(["assets/logo.png", VFN.LOGO_VFN], 46), logoParaWord(ctx.urlsLogoAdversario || [], 46)]);
    const imagem = logo => logo ? [par(new ImageRun({ data: logo.data, type: logo.type, transformation: { width: logo.width, height: logo.height } }), { alignment: AlignmentType.CENTER, spacing: { after: 0 } })] : [par(run(""))];
    const casa = d.casa ? "VFN" : d.adversario, fora = d.casa ? d.adversario : "VFN";
    const resultado = `${d.casa ? d.golosVFN : d.golosAdv} – ${d.casa ? d.golosAdv : d.golosVFN}`;
    const v = d.golosVFN > d.golosAdv ? "V" : d.golosVFN < d.golosAdv ? "D" : "E";
    const contexto = [d.competicao ? VFN.nomeCurtoCompeticao(d.competicao) : "", d.jornada ? "Jornada " + d.jornada : "", VFN.dataDDMMAAAA(d.data), d.casa ? "Casa" : "Fora"].filter(Boolean).join("  ·  ");
    const fundoNavy = { type: ShadingType.SOLID, color: NAVY, fill: NAVY };
    const cabecalho = tabela([new TableRow({ children: [
      celula(imagem(d.casa ? logoVFN : logoAdv), { width: { size: 15, type: WidthType.PERCENTAGE }, shading: fundoNavy }),
      celula([
        par([run(`${casa}  `, { bold: true, size: 26, color: "FFFFFF" }), run(resultado, { bold: true, size: 40, color: AMARELO }), run(`  ${fora}`, { bold: true, size: 26, color: "FFFFFF" })], { alignment: AlignmentType.CENTER, spacing: { after: 30 } }),
        par(run(contexto, { size: 17, color: "D1D5DB" }), { alignment: AlignmentType.CENTER, spacing: { after: 0 } })
      ], { width: { size: 70, type: WidthType.PERCENTAGE }, shading: fundoNavy }),
      celula(imagem(d.casa ? logoAdv : logoVFN), { width: { size: 15, type: WidthType.PERCENTAGE }, shading: fundoNavy })
    ] })], [1400, 6600, 1400], { borders: { top: nada, bottom: nada, left: nada, right: nada, insideHorizontal: nada, insideVertical: nada } });
    const golosVFN = d.golos.filter(g => g.vfn), golosAdv = d.golos.filter(g => !g.vfn);
    const marcadores = [golosVFN.length ? `VFN: ${golosVFN.map(g => `${g.texto.replace(/ \(assist\..*\)$/, "")} ${g.min}`).join(", ")}` : "", golosAdv.length ? `${d.adversario}: ${golosAdv.map(g => `${g.texto === "Adversário" ? "" : g.texto + " "}${g.min}`).join(", ")}` : ""].filter(Boolean).join("   ·   ");

    // ---------- folha 1 · relatório ----------
    const folha1 = [cabecalho];
    folha1.push(par([run(`${{ V: "Vitória", E: "Empate", D: "Derrota" }[v]}   `, { bold: true, size: 18, color: v === "V" ? "15803D" : v === "D" ? "B91C1C" : SUAVE }), run(marcadores ? "⚽ " + marcadores : "Sem golos", { size: 18, color: SUAVE })], { alignment: AlignmentType.CENTER, spacing: { before: 100, after: 40 } }));
    if (!d.comAnalise) folha1.push(titulo("Relatório"), ...textoDe("Análise não disponível para este jogo (ficha publicada). A ficha do jogo está na folha seguinte."));
    if (d.sintese) folha1.push(titulo("Síntese"), ...textoDe(d.sintese));
    if (d.primeiroTempo || d.segundoTempo) {
      folha1.push(titulo("Evolução do Jogo"));
      const parte = (rotulo, t) => celula([par(run(rotulo, { bold: true, size: 18, color: NAVY }), { spacing: { after: 40 } }), ...(t ? textoDe(t) : [par(run("—", { color: SUAVE }))])], { width: { size: 50, type: WidthType.PERCENTAGE }, shading: { type: ShadingType.SOLID, color: FUNDO, fill: FUNDO } });
      folha1.push(tabela([new TableRow({ children: [parte("1.ª parte", d.primeiroTempo), parte("2.ª parte", d.segundoTempo)] })], [4700, 4700], { borders: { top: nada, bottom: nada, left: nada, right: nada, insideHorizontal: nada, insideVertical: { style: BorderStyle.SINGLE, size: 12, color: "FFFFFF" } } }));
    }
    if (d.seccoes.length) {
      folha1.push(titulo("Análise Tática"));
      folha1.push(tabela(d.seccoes.map(s => new TableRow({ children: [
        celula(par(run(s.titulo, { bold: true, size: 18, color: NAVY })), { width: { size: 24, type: WidthType.PERCENTAGE } }),
        celula(par(run(s.avaliacao || "—", { bold: true, size: 16, color: s.avaliacao ? "FFFFFF" : SUAVE }), { alignment: AlignmentType.CENTER, spacing: { after: 0 } }), { width: { size: 11, type: WidthType.PERCENTAGE }, ...(COR_AVALIACAO[s.avaliacao] ? { shading: { type: ShadingType.SOLID, color: COR_AVALIACAO[s.avaliacao], fill: COR_AVALIACAO[s.avaliacao] } } : {}) }),
        celula(s.texto ? textoDe(s.texto) : [par(run("—", { color: SUAVE }))], { width: { size: 65, type: WidthType.PERCENTAGE } })
      ] })), [2250, 1050, 6100]));
    }
    if (temAdversario(d)) {
      folha1.push(titulo(`Adversário — ${d.adversario}`));
      camposAdversario(d).forEach(([t, val]) => folha1.push(par([run(t + ": ", { bold: true, color: NAVY }), run(val)])));
      const chave = jogadoresChave(d);
      if (chave.length) {
        folha1.push(par(run("Jogadores-chave", { bold: true, color: NAVY }), { spacing: { before: 60, after: 30 } }));
        chave.forEach(j => folha1.push(par([run(`${j.numero ? "#" + j.numero + " " : ""}${j.nome}`, { bold: true }), run(j.posicao ? `  (${j.posicao})` : "", { color: SUAVE }), run(j.descricao ? " — " + j.descricao : "")], { bullet: { level: 0 }, spacing: { after: 30 } })));
      }
      if (d.notasPreviasAdversario) folha1.push(par([run("Notas prévias: ", { bold: true, color: NAVY }), run(d.notasPreviasAdversario)]));
    }
    if (d.topicos) {
      folha1.push(titulo("Tópicos para o Treino"));
      if (d.aTrabalhar.length) folha1.push(par(run("A partir de: " + textoATrabalhar(d.aTrabalhar), { italics: true, size: 17, color: SUAVE })));
      paragrafos(d.topicos).forEach((t, i) => folha1.push(par([run(`${i + 1}.  `, { bold: true, color: "B45309" }), run(t)], { spacing: { after: 50 } })));
    }

    // ---------- folha 2 · ficha de jogo ----------
    const folha2 = [new Paragraph({ children: [new PageBreak()] }), new Paragraph({ spacing: { after: 40 }, children: [run("FICHA DE JOGO", { bold: true, size: 26, color: NAVY })] }),
      par(run(`${casa} ${resultado} ${fora}  ·  ${contexto}`, { size: 18, color: SUAVE }), { spacing: { after: 120 } })];
    if (d.formacao || d.formacaoAdv) folha2.push(par([run("Formações: ", { bold: true, color: NAVY }), run(`VFN ${d.formacao || "—"}  ·  ${d.adversario} ${d.formacaoAdv || "—"}`)]));
    // onze por posição (lugar da formação) e suplentes, lado a lado
    const numero = id => (ctx.numeroJogador && ctx.numeroJogador(id)) || "";
    const nomeDe = id => (id ? ctx.nomeJogador(id) : "") || "—";
    const slots = (VFN.FORMACOES_SLOTS && VFN.FORMACOES_SLOTS[jogo.formacaoVFN]) || [];
    const onze = (jogo.titulares || []).map((id, i) => id ? { pos: (slots[i] || {}).label || "", n: numero(id), nome: nomeDe(id) + (String(id) === String(jogo.capitaoId) ? "  (C)" : "") } : null).filter(Boolean);
    const suplentes = (jogo.suplentes || []).filter(Boolean).map(id => ({ n: numero(id), nome: nomeDe(id) }));
    if (onze.length || suplentes.length) {
      const linhaJogador = (pos, n, nome) => new TableRow({ children: [celula(par(run(pos, { bold: true, size: 16, color: SUAVE }), { spacing: { after: 0 } }), { width: { size: 18, type: WidthType.PERCENTAGE } }), celula(par(run(n ? "#" + n : "", { size: 17, color: SUAVE }), { spacing: { after: 0 } }), { width: { size: 16, type: WidthType.PERCENTAGE } }), celula(par(run(nome, { size: 18 }), { spacing: { after: 0 } }))] });
      const lista = (rotulo, itens, comPos) => celula([par(run(rotulo, { bold: true, size: 18, color: NAVY }), { spacing: { after: 40 } }),
        itens.length ? tabela(itens.map(x => linhaJogador(comPos ? x.pos : "", x.n, x.nome)), [800, 700, 3000]) : par(run("—", { color: SUAVE }))], { width: { size: 50, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.TOP });
      folha2.push(tabela([new TableRow({ children: [lista("Onze inicial", onze, true), lista("Suplentes", suplentes, false)] })], [4700, 4700], { borders: { top: nada, bottom: nada, left: nada, right: nada, insideHorizontal: nada, insideVertical: nada } }));
    }
    // linha do tempo dos eventos
    const H = window.VFNHub;
    const eventos = H && H.eventosDoRelatorio ? H.eventosDoRelatorio(r, ctx.nomeJogador) : [];
    // marcas que imprimem bem (os emoji dos cartões saem cinzentos em PDF e na impressão)
    const MARCA = { "Golo": ["⚽", TEXTO], "Auto-golo": ["⚽", TEXTO], "Cartão Amarelo": ["■", "EAB308"], "Cartão Vermelho": ["■", "DC2626"], "Substituição": ["⇄", "2563EB"], "Lesão": ["✚", "DC2626"] };
    const marca = tipo => MARCA[String(tipo).replace(/ \(.*\)$/, "")] || ["•", SUAVE];
    folha2.push(titulo("Linha do tempo", 200));
    folha2.push(eventos.length ? tabela(eventos.map((e, i) => new TableRow({ children: [
      celula(par(run(`${e.minuto}${e.acrescimo ? "+" + e.acrescimo : ""}'`, { bold: true, size: 17, color: NAVY }), { spacing: { after: 0 } }), { width: { size: 9, type: WidthType.PERCENTAGE }, ...(i % 2 ? { shading: { type: ShadingType.SOLID, color: FUNDO, fill: FUNDO } } : {}) }),
      celula(par([run(marca(e.tipo)[0] + "  ", { size: 18, bold: true, color: marca(e.tipo)[1] }), run(e.tipo, { size: 17 })], { spacing: { after: 0 } }), { width: { size: 28, type: WidthType.PERCENTAGE }, ...(i % 2 ? { shading: { type: ShadingType.SOLID, color: FUNDO, fill: FUNDO } } : {}) }),
      celula(par(run(e.neutro ? "" : e.vfn ? "VFN" : d.adversario, { bold: true, size: 16, color: e.vfn ? "B45309" : SUAVE }), { spacing: { after: 0 } }), { width: { size: 18, type: WidthType.PERCENTAGE }, ...(i % 2 ? { shading: { type: ShadingType.SOLID, color: FUNDO, fill: FUNDO } } : {}) }),
      celula(par(run(e.texto || "—", { size: 17 }), { spacing: { after: 0 } }), { width: { size: 45, type: WidthType.PERCENTAGE }, ...(i % 2 ? { shading: { type: ShadingType.SOLID, color: FUNDO, fill: FUNDO } } : {}) })
    ] })), [850, 2650, 1700, 4200]) : par(run("Sem eventos registados.", { italics: true, color: SUAVE })));
    // minutos jogados (duas colunas: nome · minutos)
    const minutos = H && H.minutosDoRelatorio
      ? Object.entries(H.minutosDoRelatorio(m)).map(([id, min]) => ({ nome: nomeDe(id), min: Math.round(min) })).filter(x => x.nome !== "—" && x.min > 0).sort((a, b) => b.min - a.min)
      : [];
    if (minutos.length) {
      folha2.push(titulo("Minutos jogados", 200));
      const meio = Math.ceil(minutos.length / 2);
      const linhas = [];
      for (let i = 0; i < meio; i++) {
        const a = minutos[i], b = minutos[i + meio];
        linhas.push(new TableRow({ children: [celula(par(run(a.nome, { size: 17 }), { spacing: { after: 0 } })), celula(par(run(a.min + "'", { bold: true, size: 17 }), { alignment: AlignmentType.RIGHT, spacing: { after: 0 } })),
          celula(par(run(b ? b.nome : "", { size: 17 }), { spacing: { after: 0 } })), celula(par(run(b ? b.min + "'" : "", { bold: true, size: 17 }), { alignment: AlignmentType.RIGHT, spacing: { after: 0 } }))] }));
      }
      folha2.push(tabela(linhas, [3600, 1100, 3600, 1100]));
      folha2.push(par(run("Calculado a partir do onze inicial e das substituições registadas.", { italics: true, size: 15, color: SUAVE }), { spacing: { before: 60 } }));
    }

    const rodape = new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [run("ACD Vila Franca das Naves · Relatório de jogo · Época 2026/27 · página ", { size: 15, color: SUAVE }), new TextRun({ children: [PageNumber.CURRENT], size: 15, color: SUAVE }), run(" de ", { size: 15, color: SUAVE }), new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 15, color: SUAVE })] })] });
    const doc = new Document({
      styles: { default: { document: { run: { font: "Calibri", size: 19, color: TEXTO } } } },
      sections: [{ properties: { page: { margin: { top: 800, bottom: 800, left: 900, right: 900 } } }, footers: { default: rodape }, children: [...folha1, ...folha2] }]
    });
    return Packer.toBlob(doc);
  }

  /** Nome do ficheiro: Relatorio_<Adversario>_J<jornada>_<data>.docx */
  function nomeFicheiroWord(r, ctx) {
    const d = extrair(r, (ctx && ctx.nomeJogador) || (() => ""));
    const limpo = t => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "");
    return `Relatorio_${limpo(d.adversario) || "Jogo"}_J${d.jornada || "0"}_${d.data || "sem-data"}.docx`;
  }

  /** Gera e descarrega o .docx do relatório (dashboard). ctx: o de documentoWord. */
  async function word(r, ctx) {
    const blob = await documentoWord(r, ctx);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = nomeFicheiroWord(r, ctx);
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // V2.0: "Momentos e Situações" saiu do relatório; as imagens antigas ficam no bucket até se apagar o relatório
  const BUCKET_SITUACOES = "report-images";

  window.VFNRelatorio = { estadoRelatorio, extrair, comJogo, html, word, documentoWord, nomeFicheiroWord, BUCKET_SITUACOES };
})();
