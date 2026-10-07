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
      golos,
      amarelos: vfnEm("Cartão Amarelo").map(e => ({ min: minuto(e), nome: nome(e.jogadorId) })),
      vermelhos: vfnEm("Cartão Vermelho").map(e => ({ min: minuto(e), nome: nome(e.jogadorId) })),
      // estrutura do relatório (v9): Resumo Rápido · Síntese · Evolução do Jogo · Momentos e Situações · Análise Tática · Tópicos para o Treino
      marcadores: marcadoresTexto(golos),
      // relatórios antigos sem síntese: os "Pontos positivos" fazem as vezes dela
      sintese: an.sintese || an.positivos || "",
      primeiroTempo: r.first_half_notes || an.primeiroTempo || "",
      segundoTempo: r.second_half_notes || an.segundoTempo || "",
      destaques: r.highlights || an.destaques || "",
      seccoes,
      adversarioAnalise: an.adversario || {},
      notasPreviasAdversario: pre.notasAdversario || "",
      // "Pontos a melhorar" passou a "Tópicos para o treino": nos relatórios antigos junta as duas listas, sem repetir
      // (areas_to_improve: nos antigos é "Pontos a melhorar"; desde a v9 é uma cópia dos tópicos)
      topicos: [...new Set([...paragrafos(an.topicosTreino), ...paragrafos(an.aMelhorar), ...paragrafos(r.areas_to_improve)])].join("\n"),
      // momentos do jogo avaliados como Mau/Médio: a origem dos tópicos para o treino
      aTrabalhar: seccoes.filter(s => s.avaliacao === "Mau" || s.avaliacao === "Médio")
    };
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
      ${d.destaques || situacoesDe(r).length ? `<section class="rel-bloco"><h4>Momentos e Situações</h4>${paragrafos(d.destaques).map(p => `<p>${esc(p)}</p>`).join("")}${situacoesGaleria(r)}</section>` : ""}
      ${d.seccoes.length || temAdversario(d) ? `<section class="rel-bloco"><h4>Análise Tática</h4>${d.seccoes.map(s => `<div class="rel-seccao"><h5>${esc(s.titulo)}${s.avaliacao ? ` <span class="rel-aval aval-${esc(s.avaliacao)}">${esc(s.avaliacao)}</span>` : ""}</h5>${paragrafos(s.texto).map(p => `<p>${esc(p)}</p>`).join("")}</div>`).join("")}${adversarioHTML(d)}</section>` : ""}
      ${d.topicos ? `<section class="rel-bloco"><h4>Tópicos para o Treino</h4>${d.aTrabalhar.length ? `<p class="rel-origem">A partir de: ${esc(textoATrabalhar(d.aTrabalhar))}</p>` : ""}<ol>${paragrafos(d.topicos).map(t => `<li>${esc(t)}</li>`).join("")}</ol></section>` : ""}
      <section class="rel-bloco"><h4>Ficha do Jogo</h4>
      <div class="rel-grelha">
        <div>
          ${d.formacao ? `<p><strong>Formação:</strong> ${esc(d.formacao)}${d.formacaoAdv ? ` · adversário ${esc(d.formacaoAdv)}` : ""}</p>` : ""}
          ${lista("Onze inicial", d.onze)}${lista("Suplentes", d.suplentes)}
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
  const temAdversario = d => camposAdversario(d).length > 0 || jogadoresChave(d).length > 0 || !!d.notasPreviasAdversario;

  function adversarioHTML(d) {
    if (!temAdversario(d)) return "";
    const chave = jogadoresChave(d);
    return `<div class="rel-seccao rel-adversario"><h5>Adversário — ${esc(d.adversario)}</h5>
      ${camposAdversario(d).map(([t, v]) => `<p><strong>${esc(t)}:</strong> ${esc(v)}</p>`).join("")}
      ${chave.length ? `<p><strong>Jogadores-chave:</strong> ${chave.map(j => esc(j.nome + (j.posicao ? ` (${j.posicao})` : "") + (j.descricao ? " — " + j.descricao : ""))).join("; ")}</p>` : ""}
      ${d.notasPreviasAdversario ? `<p><strong>Notas prévias:</strong> ${esc(d.notasPreviasAdversario)}</p>` : ""}</div>`;
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
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 160 }, children: [new TextRun({ text: [d.competicao, d.jornada ? "Jornada " + d.jornada : "", VFN.dataDDMMAAAA(d.data), d.local].filter(Boolean).join("  ·  "), size: 20, color: CINZA })] })
    ];
    const subtitulo = t => new Paragraph({ spacing: { before: 120, after: 40 }, children: [new TextRun({ text: t, bold: true, size: 21, color: NAVY })] });
    // 1. Resumo rápido (resultado e data já no cabeçalho)
    if (d.marcadores) corpo.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80 }, children: [new TextRun({ text: "Marcadores: ", bold: true, size: 20, color: CINZA }), new TextRun({ text: d.marcadores, size: 20 })] }));
    // 2. Síntese
    if (d.sintese) corpo.push(titulo("Síntese"), ...texto(d.sintese));
    // 3. Evolução do jogo
    if (d.primeiroTempo || d.segundoTempo) {
      corpo.push(titulo("Evolução do Jogo"));
      if (d.primeiroTempo) corpo.push(subtitulo("1.ª parte"), ...texto(d.primeiroTempo));
      if (d.segundoTempo) corpo.push(subtitulo("2.ª parte"), ...texto(d.segundoTempo));
    }
    // 4. Momentos e situações
    const situacoes = await situacoesParaWord(r, ctx.cliente, null);
    if (d.destaques || situacoes.length) corpo.push(titulo("Momentos e Situações"), ...texto(d.destaques), ...situacoes);
    // 5. Análise tática: os 5 momentos e o adversário
    if (d.seccoes.length || temAdversario(d)) {
      corpo.push(titulo("Análise Tática"));
      d.seccoes.forEach(s => { corpo.push(new Paragraph({ spacing: { before: 120, after: 40 }, children: [new TextRun({ text: s.titulo, bold: true, size: 21, color: NAVY }), new TextRun({ text: s.avaliacao ? `  ·  ${s.avaliacao}` : "", bold: true, size: 20, color: s.avaliacao === "Bom" ? "15803D" : s.avaliacao === "Mau" ? "B91C1C" : "A16207" })] }), ...texto(s.texto)); });
      if (temAdversario(d)) {
        corpo.push(subtitulo(`Adversário — ${d.adversario}`));
        camposAdversario(d).forEach(([t, v]) => corpo.push(linha(t, v)));
        const chave = jogadoresChave(d);
        if (chave.length) corpo.push(linha("Jogadores-chave", chave.map(j => j.nome + (j.posicao ? ` (${j.posicao})` : "") + (j.descricao ? " — " + j.descricao : "")).join("; ")));
        if (d.notasPreviasAdversario) corpo.push(linha("Notas prévias", d.notasPreviasAdversario));
      }
    }
    // 6. Tópicos para o treino (ligados aos momentos avaliados como Mau/Médio)
    if (d.topicos) {
      corpo.push(titulo("Tópicos para o Treino"));
      if (d.aTrabalhar.length) corpo.push(new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "A partir de: " + textoATrabalhar(d.aTrabalhar), italics: true, size: 18, color: CINZA })] }));
      paragrafos(d.topicos).forEach((t, i) => corpo.push(new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: `${i + 1}. ${t}`, size: 20 })] })));
    }
    // anexo: ficha do jogo
    corpo.push(titulo("Ficha do Jogo"));
    if (d.formacao) corpo.push(linha("Formação", d.formacao + (d.formacaoAdv ? `  (adversário: ${d.formacaoAdv})` : "")));
    if (d.onze.length) corpo.push(linha("Onze inicial", d.onze.join(", ")));
    if (d.suplentes.length) corpo.push(linha("Suplentes", d.suplentes.join(", ")));
    if (d.substituicoes.length) corpo.push(linha("Substituições", d.substituicoes.map(s => `${s.min} ${s.sai} → ${s.entra}`).join("; ")));
    corpo.push(linha("Golos", d.golos.length ? d.golos.map(g => `${g.min} ${g.texto}${g.vfn ? "" : " [adv.]"}`).join("; ") : "—"));
    if (d.amarelos.length) corpo.push(linha("Amarelos", d.amarelos.map(c => `${c.min} ${c.nome}`).join("; ")));
    if (d.vermelhos.length) corpo.push(linha("Vermelhos", d.vermelhos.map(c => `${c.min} ${c.nome}`).join("; ")));
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

  /* ---------- Situações de jogo (imagens no bucket privado report-images) ----------
     Cada situação: { path (no bucket) | data (data URL, modo local), caption, order }.
     O bucket é privado: as imagens mostram-se com URLs assinados (válidos 1 hora). */

  const BUCKET_SITUACOES = "report-images";
  const MAX_SITUACOES = 10;

  function situacoesDe(r) {
    const lista = (r && (r.situations || ((r.match_data || {}).analise || {}).situacoes)) || [];
    return [...lista].filter(s => s && (s.path || s.data)).sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
  }

  const urlsAssinados = new Map(); // path -> { url, ate }

  /** URL de cada situação (pela mesma ordem): data URL, ou URL assinado do bucket privado. */
  async function urlsSituacoes(lista, cliente) {
    const agora = Date.now();
    const porAssinar = [...new Set(lista.filter(s => s.path && !(urlsAssinados.get(s.path) && urlsAssinados.get(s.path).ate > agora)).map(s => s.path))];
    if (porAssinar.length && cliente) {
      const { data } = await cliente.storage.from(BUCKET_SITUACOES).createSignedUrls(porAssinar, 3600);
      (data || []).forEach(x => { if (x.signedUrl) urlsAssinados.set(x.path, { url: x.signedUrl, ate: agora + 55 * 60 * 1000 }); });
    }
    return lista.map(s => s.data || (urlsAssinados.get(s.path) || {}).url || "");
  }

  /** Galeria (só leitura). As imagens carregam depois com carregarSituacoes(contentor, r, cliente). */
  function situacoesHTML(r) {
    const galeria = situacoesGaleria(r);
    return galeria ? `<section class="rel-bloco"><h4>Situações de jogo</h4>${galeria}</section>` : "";
  }

  /** Só a grelha das situações (na secção "Momentos e Situações"). */
  function situacoesGaleria(r) {
    const lista = situacoesDe(r);
    if (!lista.length) return "";
    return `<div class="rel-situacoes">${lista.map((s, i) => `
      <figure class="rel-situacao"><button type="button" class="rel-situacao-img" data-situacao="${i}" aria-label="Ampliar situação ${i + 1}"><img alt="${esc(s.caption || "Situação " + (i + 1))}" loading="lazy"></button>
        ${s.caption ? `<figcaption>${esc(s.caption)}</figcaption>` : ""}</figure>`).join("")}</div>`;
  }

  /** Preenche as imagens da galeria e liga a lightbox. */
  async function carregarSituacoes(contentor, r, cliente) {
    const lista = situacoesDe(r);
    if (!contentor || !lista.length) return;
    let urls = [];
    try { urls = await urlsSituacoes(lista, cliente); } catch (e) { console.warn("Situações:", e.message || e); }
    contentor.querySelectorAll("[data-situacao]").forEach(b => {
      const i = Number(b.dataset.situacao);
      const img = b.querySelector("img");
      if (urls[i]) img.src = urls[i]; else b.classList.add("sem-imagem");
      b.onclick = () => abrirLightbox(lista, urls, i);
    });
  }

  /** Lightbox com setas (← →) e Esc para fechar. */
  function abrirLightbox(lista, urls, inicio) {
    let i = inicio;
    let caixa = document.getElementById("vfnLightbox");
    if (!caixa) {
      caixa = document.createElement("div");
      caixa.id = "vfnLightbox";
      caixa.className = "vfn-lightbox";
      caixa.setAttribute("role", "dialog");
      caixa.setAttribute("aria-modal", "true");
      caixa.innerHTML = `<button type="button" class="lb-fechar" aria-label="Fechar">×</button><button type="button" class="lb-ant" aria-label="Anterior">‹</button>
        <figure><img alt=""><figcaption></figcaption></figure><button type="button" class="lb-seg" aria-label="Seguinte">›</button>`;
      document.body.appendChild(caixa);
    }
    const mostrar = () => {
      caixa.querySelector("img").src = urls[i] || "";
      caixa.querySelector("img").alt = lista[i].caption || `Situação ${i + 1}`;
      caixa.querySelector("figcaption").textContent = `${i + 1}/${lista.length}${lista[i].caption ? " · " + lista[i].caption : ""}`;
      caixa.querySelector(".lb-ant").hidden = caixa.querySelector(".lb-seg").hidden = lista.length < 2;
    };
    const fechar = () => { caixa.hidden = true; document.removeEventListener("keydown", teclas); };
    const mover = d => { i = (i + d + lista.length) % lista.length; mostrar(); };
    const teclas = e => { if (e.key === "Escape") fechar(); else if (e.key === "ArrowLeft") mover(-1); else if (e.key === "ArrowRight") mover(1); };
    caixa.onclick = e => {
      if (e.target.closest(".lb-ant")) mover(-1);
      else if (e.target.closest(".lb-seg")) mover(1);
      else if (e.target === caixa || e.target.closest(".lb-fechar")) fechar();
    };
    document.addEventListener("keydown", teclas);
    caixa.hidden = false;
    mostrar();
    caixa.querySelector(".lb-fechar").focus();
  }

  /** Imagem (PNG, JPG ou SVG) → PNG para o Word, reduzida a largura máxima. null se falhar. */
  function imagemParaWord(url, larguraMax) {
    return new Promise(resolve => {
      if (!url) { resolve(null); return; }
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const w0 = img.naturalWidth || 800, h0 = img.naturalHeight || 600;
          const escala = Math.min(1, (larguraMax || 560) / w0);
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(w0 * escala * 2); canvas.height = Math.round(h0 * escala * 2); // 2x para ficar nítida
          const ctx = canvas.getContext("2d");
          ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(b => b ? b.arrayBuffer().then(data => resolve({ data, width: Math.round(w0 * escala), height: Math.round(h0 * escala) })) : resolve(null), "image/png");
        } catch (e) { resolve(null); }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

  /** Parágrafos do Word com as situações (imagem + legenda). titulo(texto) devolve o parágrafo do título (null: sem título). */
  async function situacoesParaWord(r, cliente, titulo) {
    const D = window.docx;
    const lista = situacoesDe(r);
    if (!D || !lista.length) return [];
    const urls = await urlsSituacoes(lista, cliente).catch(() => []);
    const imagens = await Promise.all(urls.map(u => imagemParaWord(u, 520)));
    const blocos = titulo ? [titulo("Situações de jogo")] : [];
    lista.forEach((s, i) => {
      const im = imagens[i];
      if (im) blocos.push(new D.Paragraph({ alignment: D.AlignmentType.CENTER, spacing: { before: 160 }, children: [new D.ImageRun({ data: im.data, type: "png", transformation: { width: im.width, height: im.height } })] }));
      blocos.push(new D.Paragraph({ alignment: D.AlignmentType.CENTER, spacing: { before: 60, after: 120 }, children: [new D.TextRun({ text: `${i + 1}. ${s.caption || "Situação"}${im ? "" : " (imagem indisponível)"}`, italics: true, size: 18, color: "4F4847" })] }));
    });
    return blocos;
  }

  window.VFNRelatorio = { estadoRelatorio, extrair, comJogo, html, word, BUCKET_SITUACOES, MAX_SITUACOES, situacoesDe, urlsSituacoes, situacoesHTML, situacoesGaleria, carregarSituacoes, abrirLightbox, situacoesParaWord };
})();
