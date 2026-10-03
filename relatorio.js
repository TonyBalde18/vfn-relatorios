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
    return {
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
      golos: eventos.filter(e => e.tipo === "Golo" || e.tipo === "Auto-golo").map(e => ({ min: minuto(e), vfn: (e.tipo === "Golo") === (e.equipa === "VFN"), texto: e.equipa === "VFN" ? nome(e.jogadorId) + (e.assistId ? ` (assist. ${nome(e.assistId)})` : "") : (e.detalhe || "Adversário") + (e.tipo === "Auto-golo" ? " (autogolo)" : "") })),
      amarelos: vfnEm("Cartão Amarelo").map(e => ({ min: minuto(e), nome: nome(e.jogadorId) })),
      vermelhos: vfnEm("Cartão Vermelho").map(e => ({ min: minuto(e), nome: nome(e.jogadorId) })),
      primeiroTempo: r.first_half_notes || an.primeiroTempo || "",
      segundoTempo: r.second_half_notes || an.segundoTempo || "",
      destaques: r.highlights || an.destaques || "",
      seccoes: SECCOES.map(([k, t]) => ({ titulo: t, avaliacao: AVALIACAO[((an.seccoes || {})[k] || {}).avaliacao] || "", texto: ((an.seccoes || {})[k] || {}).texto || "" })).filter(s => s.avaliacao || s.texto),
      positivos: an.positivos || "",
      aMelhorar: r.areas_to_improve || an.aMelhorar || "",
      topicos: an.topicosTreino || "",
      notasIndividuais: (an.notasIndividuais || []).filter(n => n && n.nota).map(n => ({ jogador: nome(n.jogadorId), nota: n.nota })),
      adversarioAnalise: an.adversario || {}
    };
  }

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
  const blocoTexto = (titulo, texto) => texto ? `<section class="rel-bloco"><h4>${esc(titulo)}</h4>${paragrafos(texto).map(p => `<p>${esc(p)}</p>`).join("")}</section>` : "";

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
      <div class="rel-grelha">
        <section class="rel-bloco"><h4>Equipa</h4>
          ${d.formacao ? `<p><strong>Formação:</strong> ${esc(d.formacao)}${d.formacaoAdv ? ` · adversário ${esc(d.formacaoAdv)}` : ""}</p>` : ""}
          ${lista("Onze inicial", d.onze)}${lista("Suplentes", d.suplentes)}
          ${d.substituicoes.length ? `<div class="rel-lista"><h5>Substituições</h5><ul>${d.substituicoes.map(s => `<li>${esc(s.min)} ${esc(s.sai)} ↘ ${esc(s.entra)} ↗</li>`).join("")}</ul></div>` : ""}
        </section>
        <section class="rel-bloco"><h4>Eventos</h4>
          ${d.golos.length ? `<div class="rel-lista"><h5>Golos</h5><ul>${d.golos.map(g => `<li class="${g.vfn ? "golo-vfn" : "golo-adv"}">${esc(g.min)} ${esc(g.texto)}</li>`).join("")}</ul></div>` : "<p class=\"muted\">Sem golos registados.</p>"}
          ${d.amarelos.length ? `<div class="rel-lista"><h5>Amarelos</h5><ul>${d.amarelos.map(c => `<li>${esc(c.min)} ${esc(c.nome)}</li>`).join("")}</ul></div>` : ""}
          ${d.vermelhos.length ? `<div class="rel-lista"><h5>Vermelhos</h5><ul>${d.vermelhos.map(c => `<li>${esc(c.min)} ${esc(c.nome)}</li>`).join("")}</ul></div>` : ""}
        </section>
      </div>
      ${blocoTexto("1.º tempo", d.primeiroTempo)}${blocoTexto("2.º tempo", d.segundoTempo)}
      ${d.seccoes.length ? `<section class="rel-bloco"><h4>Análise tática</h4>${d.seccoes.map(s => `<div class="rel-seccao"><h5>${esc(s.titulo)}${s.avaliacao ? ` <span class="rel-aval aval-${esc(s.avaliacao)}">${esc(s.avaliacao)}</span>` : ""}</h5>${paragrafos(s.texto).map(p => `<p>${esc(p)}</p>`).join("")}</div>`).join("")}</section>` : ""}
      ${blocoTexto("Momentos de destaque", d.destaques)}${blocoTexto("Pontos positivos", d.positivos)}${blocoTexto("Pontos a melhorar", d.aMelhorar)}${blocoTexto("Tópicos para o treino", d.topicos)}
      ${d.notasIndividuais.length ? `<section class="rel-bloco"><h4>Notas individuais</h4><table class="rel-notas"><tbody>${d.notasIndividuais.map(n => `<tr><th scope="row">${esc(n.jogador)}</th><td>${esc(n.nota)}</td></tr>`).join("")}</tbody></table></section>` : ""}`;
  }

  /* ---------- Word ---------- */

  async function logoParaWord(urls) {
    for (const url of urls.filter(Boolean)) {
      try {
        const resp = await fetch(url);
        if (!resp.ok) continue;
        const blob = await resp.blob();
        if (!/png|jpe?g/i.test(blob.type) && !/\.(png|jpe?g)(\?|$)/i.test(url)) continue;
        const dataUrl = await new Promise((res, rej) => { const f = new FileReader(); f.onload = () => res(f.result); f.onerror = rej; f.readAsDataURL(blob); });
        const dims = await new Promise(res => { const i = new Image(); i.onload = () => res({ w: i.naturalWidth, h: i.naturalHeight }); i.onerror = () => res(null); i.src = dataUrl; });
        if (!dims) continue;
        const k = Math.min(1, 90 / Math.max(dims.w, dims.h));
        const bin = atob(dataUrl.split(",")[1]);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return { data: bytes, type: /png/i.test(blob.type) || /\.png/i.test(url) ? "png" : "jpg", width: Math.round(dims.w * k), height: Math.round(dims.h * k) };
      } catch (e) { /* tenta o seguinte */ }
    }
    return null;
  }

  /** Gera e descarrega o .docx do relatório. ctx: { nomeJogador, urlsLogoAdversario: [] } */
  async function word(r, ctx) {
    const D = window.docx;
    if (!D) { alert("A biblioteca do Word não carregou. Verifica a ligação à internet."); return; }
    const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, ImageRun, BorderStyle, ShadingType, Footer, HeadingLevel } = D;
    const d = extrair(r, ctx.nomeJogador);
    const NAVY = "0A1628", AMARELO = "FFD700", CINZA = "4F4847";
    const semBordas = { top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } };
    const [logoVFN, logoAdv] = await Promise.all([logoParaWord(["assets/logo.png", VFN.LOGO_VFN]), logoParaWord(ctx.urlsLogoAdversario || [])]);
    const celulaLogo = (logo, nome) => new TableCell({ width: { size: 35, type: WidthType.PERCENTAGE }, borders: semBordas, shading: { type: ShadingType.SOLID, color: NAVY, fill: NAVY }, margins: { top: 200, bottom: 200 }, children: [
      new Paragraph({ alignment: AlignmentType.CENTER, children: logo ? [new ImageRun({ data: logo.data, type: logo.type, transformation: { width: logo.width, height: logo.height } })] : [] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80 }, children: [new TextRun({ text: nome, bold: true, color: "FFFFFF", size: 22 })] })] });
    const placar = new TableCell({ width: { size: 30, type: WidthType.PERCENTAGE }, borders: semBordas, shading: { type: ShadingType.SOLID, color: NAVY, fill: NAVY }, children: [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 300 }, children: [new TextRun({ text: `${d.casa ? d.golosVFN : d.golosAdv} – ${d.casa ? d.golosAdv : d.golosVFN}`, bold: true, size: 64, color: AMARELO })] })] });
    const lados = d.casa ? [celulaLogo(logoVFN, "ACD Vila Franca das Naves"), placar, celulaLogo(logoAdv, d.adversario)] : [celulaLogo(logoAdv, d.adversario), placar, celulaLogo(logoVFN, "ACD Vila Franca das Naves")];
    const titulo = t => new Paragraph({ spacing: { before: 280, after: 100 }, border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: AMARELO } }, children: [new TextRun({ text: t.toUpperCase(), bold: true, size: 24, color: NAVY })] });
    const texto = t => paragrafos(t).map(p => new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: p, size: 20 })] }));
    const linha = (rotulo, valor) => new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: rotulo + ": ", bold: true, size: 20, color: CINZA }), new TextRun({ text: valor, size: 20 })] });
    const corpo = [
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: "RELATÓRIO DE JOGO · ACD VILA FRANCA DAS NAVES · ÉPOCA 2026/27", bold: true, size: 18, color: CINZA })] }),
      new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [new TableRow({ children: lados })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 160 }, children: [new TextRun({ text: [d.competicao, d.jornada ? "Jornada " + d.jornada : "", VFN.dataDDMMAAAA(d.data), d.local].filter(Boolean).join("  ·  "), size: 20, color: CINZA })] }),
      titulo("Equipa")
    ];
    if (d.formacao) corpo.push(linha("Formação", d.formacao + (d.formacaoAdv ? `  (adversário: ${d.formacaoAdv})` : "")));
    if (d.onze.length) corpo.push(linha("Onze inicial", d.onze.join(", ")));
    if (d.suplentes.length) corpo.push(linha("Suplentes", d.suplentes.join(", ")));
    if (d.substituicoes.length) corpo.push(linha("Substituições", d.substituicoes.map(s => `${s.min} ${s.sai} → ${s.entra}`).join("; ")));
    corpo.push(titulo("Eventos"));
    corpo.push(linha("Golos", d.golos.length ? d.golos.map(g => `${g.min} ${g.texto}${g.vfn ? "" : " [adv.]"}`).join("; ") : "—"));
    if (d.amarelos.length) corpo.push(linha("Amarelos", d.amarelos.map(c => `${c.min} ${c.nome}`).join("; ")));
    if (d.vermelhos.length) corpo.push(linha("Vermelhos", d.vermelhos.map(c => `${c.min} ${c.nome}`).join("; ")));
    if (d.primeiroTempo) corpo.push(titulo("1.º tempo"), ...texto(d.primeiroTempo));
    if (d.segundoTempo) corpo.push(titulo("2.º tempo"), ...texto(d.segundoTempo));
    if (d.seccoes.length) {
      corpo.push(titulo("Análise tática"));
      d.seccoes.forEach(s => { corpo.push(new Paragraph({ spacing: { before: 120, after: 40 }, children: [new TextRun({ text: s.titulo, bold: true, size: 21, color: NAVY }), new TextRun({ text: s.avaliacao ? `  ·  ${s.avaliacao}` : "", bold: true, size: 20, color: s.avaliacao === "Bom" ? "15803D" : s.avaliacao === "Mau" ? "B91C1C" : "A16207" })] }), ...texto(s.texto)); });
    }
    [["Momentos de destaque", d.destaques], ["Pontos positivos", d.positivos], ["Pontos a melhorar", d.aMelhorar], ["Tópicos para o treino", d.topicos]].forEach(([t, v]) => { if (v) corpo.push(titulo(t), ...texto(v)); });
    if (d.notasIndividuais.length) {
      corpo.push(titulo("Notas individuais"));
      corpo.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: d.notasIndividuais.map(n => new TableRow({ children: [
        new TableCell({ width: { size: 28, type: WidthType.PERCENTAGE }, shading: { type: ShadingType.SOLID, color: "F1F5F9", fill: "F1F5F9" }, children: [new Paragraph({ children: [new TextRun({ text: n.jogador, bold: true, size: 20 })] })] }),
        new TableCell({ width: { size: 72, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: n.nota, size: 20 })] })] })] })) }));
    }
    const doc = new Document({
      styles: { default: { document: { run: { font: "Calibri", size: 20 } } } },
      sections: [{ properties: { page: { margin: { top: 900, bottom: 900, left: 1000, right: 1000 } } }, footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "ACD Vila Franca das Naves · Relatório de jogo · Época 2026/27", size: 16, color: CINZA })] })] }) }, children: corpo }]
    });
    const blob = await Packer.toBlob(doc);
    const nome = `Relatorio_${String(d.adversario).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "_")}_${d.data || "sem-data"}.docx`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = nome;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  window.VFNRelatorio = { estadoRelatorio, extrair, comJogo, html, word };
})();
