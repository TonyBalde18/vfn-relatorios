/*
 * Uso: node tools/tema-escuro.js styles.css hub.css
 * Volta a gerar, no fim de cada ficheiro, o bloco "TEMA ESCURO (gerado…)" a partir das regras claras.
 * Correr depois de mudar cores nas regras (o bloco anterior é substituído).
 */
const fs = require("fs");
const INICIO = "/* ===== TEMA ESCURO (gerado a partir das regras acima; não editar à mão) ===== */";
const FIM = "/* ===== FIM TEMA ESCURO ===== */";

// componentes que ficam iguais no escuro: logos/avatares em fundo branco, imagens exportadas (PNG),
// botões/realces amarelos, campo de futebol, cartões navy (hero), tabelas já escuras
const EXCECOES = /mapa-logo|vfn-lightbox|eq-avatar|public-entrar|\.switch|dividas-imagem|anuncio|\.an-|camisola|jersey|equipa-cores|badge-capitao|team-logo|tabela-escura|vfn-splash|login-logo|area-jogador|pitch|\.ic-bola|hero|btn-accent|btn-primary|scoreboard|player-modal-profile|app-sidebar|sidebar|public-header|public-nav|eq-header|vfn-spinner|vfn-puxar|toast|arrasta-fantasma|br-vencedor|is-vfn-row|standings|classificacao-bloco|scorers-table|tabela-marcadores|analysis-summary|marcador-vfn|conv-anuncio|exportar|captura|print|pl-|pitch-campo|comp-logo|mj-|heatmap-golos|hm-zona|hm-num|hm-linhas|hm-baliza|zona-seletor|zs-|ig-resultado|igr-|cmp-barra|scoreboard-|prof-ponto|prof-badge|kit-camisola|forma-ponto/; // v13: campo, logos dos patrocinadores, Modo Jogo, zonas, imagens; v14: proficiência, kits

function hexParaRgb(h) {
  h = h.replace("#", "");
  if (h.length === 3) h = h.split("").map(c => c + c).join("");
  if (h.length !== 6) return null;
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
}
function luminancia([r, g, b]) {
  const c = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b);
}
function saturacao([r, g, b]) {
  const mx = Math.max(r, g, b) / 255, mn = Math.min(r, g, b) / 255;
  return mx === 0 ? 0 : (mx - mn) / mx;
}
const RE_COR = /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|\bwhite\b|rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*[\d.]+\s*)?\)/g;
function rgbDe(cor) {
  if (/^white$/i.test(cor)) return { rgb: [255, 255, 255], a: 1 };
  if (cor[0] === "#") { const rgb = hexParaRgb(cor); return rgb && { rgb, a: 1 }; }
  const n = cor.match(/[\d.]+/g).map(Number);
  return { rgb: n.slice(0, 3), a: n.length > 3 ? n[3] : 1 };
}
const eBranco = c => c && c.rgb.every(v => v >= 250);
const eAmarelo = v => /FFD700|vfn-yellow|old-gold|#FACC15|#E7A601|ambar/i.test(v);

/** Fundo no escuro (ou null se não muda). */
function fundoEscuro(valor) {
  let mudou = false;
  const novo = valor.replace(RE_COR, cor => {
    const c = rgbDe(cor);
    if (!c) return cor;
    if (eBranco(c)) {
      if (c.a >= 0.6) { mudou = true; return c.a >= 0.99 ? "var(--surface)" : `color-mix(in srgb, var(--surface) ${Math.round(c.a * 100)}%, transparent)`; }
      return cor; // véus brancos sobre fundos escuros: ficam
    }
    if (c.a >= 0.6 && luminancia(c.rgb) >= 0.72) { mudou = true; return `color-mix(in srgb, ${cor} 14%, var(--surface))`; }
    return cor;
  });
  return mudou ? novo : null;
}

/** Cor de texto no escuro (ou null se não muda). */
function textoEscuro(valor) {
  const v = valor.trim();
  if (/^var\(--(vfn-navy|coffee-bean|dark-khaki)\)/.test(v)) return v.replace(/^var\(--(vfn-navy|coffee-bean|dark-khaki)\)/, "var(--heading)");
  const m = v.match(RE_COR);
  if (!m || m[0] !== v.replace(/\s*!important$/, "")) return null;
  const c = rgbDe(m[0]);
  if (!c || c.a < 0.5) return null;
  const L = luminancia(c.rgb), s = saturacao(c.rgb);
  const imp = /!important$/.test(v) ? " !important" : "";
  if (L < 0.05 && (s < 0.75 || c.rgb[2] > c.rgb[0])) return "var(--heading)" + imp; // navy/preto
  if (L < 0.3 && s < 0.3) return "var(--fg-muted)" + imp; // cinzentos
  return null;
}

/** Borda/contorno no escuro: cores claras → var(--border). */
function bordaEscura(valor) {
  let mudou = false;
  const novo = valor.replace(RE_COR, cor => {
    const c = rgbDe(cor);
    if (!c || c.a < 0.5) return cor;
    if (luminancia(c.rgb) >= 0.6 && saturacao(c.rgb) < 0.3) { mudou = true; return "var(--border)"; }
    return cor;
  });
  return mudou ? novo : null;
}

function dividirSeletores(sel) {
  const partes = []; let prof = 0, atual = "";
  for (const ch of sel) {
    if (ch === "(") prof++; else if (ch === ")") prof--;
    if (ch === "," && prof === 0) { partes.push(atual.trim()); atual = ""; } else atual += ch;
  }
  if (atual.trim()) partes.push(atual.trim());
  return partes;
}
function prefixar(sel) {
  return dividirSeletores(sel).map(s => {
    // :where() = especificidade 0: a regra escura pesa o mesmo que a original (os estados mais específicos,
    // ex. .filter-chip.active, continuam a ganhar) e ganha-lhe só por vir depois
    if (/^html\b/.test(s)) return s.replace(/^html/, "html:where(.tema-escuro)");
    if (/^:root\b/.test(s)) return s.replace(/^:root/, "html:where(.tema-escuro)");
    return ":where(html.tema-escuro) " + s;
  }).join(",\n");
}

function declaracoes(corpo) {
  const out = []; let prof = 0, atual = "";
  for (const ch of corpo) {
    if (ch === "(") prof++; else if (ch === ")") prof--;
    if (ch === ";" && prof === 0) { if (atual.trim()) out.push(atual.trim()); atual = ""; } else atual += ch;
  }
  if (atual.trim()) out.push(atual.trim());
  return out.map(d => { const i = d.indexOf(":"); return [d.slice(0, i).trim().toLowerCase(), d.slice(i + 1).trim()]; }).filter(([p]) => p && !p.startsWith("--"));
}

function regraEscura(seletor, corpo) {
  if (EXCECOES.test(seletor) || /tema-escuro/.test(seletor)) return null;
  const decls = declaracoes(corpo);
  const fundo = decls.filter(([p]) => p === "background" || p === "background-color" || p === "background-image").map(([, v]) => v).join(" ");
  if (fundo && eAmarelo(fundo)) return null; // texto sobre amarelo fica navy
  const cor = (decls.find(([p]) => p === "color") || [])[1] || "";
  const corTexto = cor && cor.match(RE_COR) && rgbDe(cor.match(RE_COR)[0]);
  // "badge": fundo claro com texto colorido escuro — fica igual (continua legível)
  const textoColoridoEscuro = corTexto && saturacao(corTexto.rgb) >= 0.3 && luminancia(corTexto.rgb) < 0.3;
  const novas = [];
  let fundoMudou = false;
  for (const [p, v] of decls) {
    if ((p === "background" || p === "background-color" || p === "background-image") && !textoColoridoEscuro) {
      const n = fundoEscuro(v); if (n) { novas.push(`${p}: ${n}`); fundoMudou = true; }
    }
  }
  const fundoFicaClaro = fundo && !fundoMudou && fundo.match(RE_COR) && fundo.match(RE_COR).some(c => { const x = rgbDe(c); return x && x.a >= 0.6 && luminancia(x.rgb) >= 0.5; });
  for (const [p, v] of decls) {
    if (p === "color" && !fundoFicaClaro && !textoColoridoEscuro) { const n = textoEscuro(v); if (n) novas.push(`color: ${n}`); }
    if (/^(border(-top|-bottom|-left|-right)?(-color)?|outline(-color)?)$/.test(p)) { const n = bordaEscura(v); if (n) novas.push(`${p}: ${n}`); }
  }
  const campo = /\b(input|select|textarea)\b/.test(seletor);
  const texto = novas.join("; ").replace(/var\(--surface\)/g, campo ? "var(--input-bg)" : "var(--surface)");
  return novas.length ? `${prefixar(seletor)} { ${texto}; }` : null;
}

/** Percorre o CSS (com @media/@supports aninhados) e gera as regras escuras. */
function gerar(css) {
  const saida = [];
  let i = 0;
  function bloco(fim, envolvente) {
    while (i < css.length) {
      // comentários
      if (css.startsWith("/*", i)) { const j = css.indexOf("*/", i + 2); i = j < 0 ? css.length : j + 2; continue; }
      if (css[i] === "}") { i++; return; }
      const abre = css.indexOf("{", i), fecha = css.indexOf("}", i);
      const semi = css.indexOf(";", i);
      if (abre < 0 || (fecha >= 0 && fecha < abre)) { i = fecha < 0 ? css.length : fecha; continue; }
      if (semi >= 0 && semi < abre && css.slice(i, semi).trim().startsWith("@")) { i = semi + 1; continue; } // @import/@charset
      const prelude = css.slice(i, abre).replace(/\/\*[\s\S]*?\*\//g, "").trim();
      i = abre + 1;
      if (prelude.startsWith("@")) {
        if (/^@(media|supports|container)/.test(prelude)) { const antes = saida.length; bloco("}", [...envolvente, prelude]); continue; }
        // @keyframes, @font-face…: salta
        let prof = 1; while (i < css.length && prof) { if (css[i] === "{") prof++; else if (css[i] === "}") prof--; i++; }
        continue;
      }
      const f = css.indexOf("}", i);
      const corpo = css.slice(i, f);
      i = f + 1;
      const r = regraEscura(prelude, corpo);
      if (r) saida.push({ envolvente, regra: r });
    }
  }
  bloco("", []);
  // agrupa por @media
  const linhas = [];
  let atual = null;
  saida.forEach(({ envolvente, regra }) => {
    const chave = envolvente.join(" ");
    if (chave !== atual) { if (atual) linhas.push("}".repeat(atual.split(/(?=@)/).filter(Boolean).length)); atual = chave; if (chave) linhas.push(envolvente.map(e => e + " {").join(" ")); }
    linhas.push(regra);
  });
  if (atual) linhas.push("}".repeat(atual.split(/(?=@)/).filter(Boolean).length));
  return linhas.join("\n");
}

for (const f of process.argv.slice(2)) {
  let css = fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n");
  const a = css.indexOf(INICIO);
  if (a >= 0) {
    // regras escritas depois do bloco gerado não se perdem: passam para antes dele
    const b = css.indexOf(FIM, a);
    const depois = b >= 0 ? css.slice(b + FIM.length).trim() : "";
    css = css.slice(0, a).replace(/\s+$/, "\n") + (depois ? "\n" + depois + "\n" : "");
  }
  const gerado = gerar(css);
  fs.writeFileSync(f, css + "\n" + INICIO + "\n" + gerado + "\n" + FIM + "\n");
  console.log(f, "regras escuras:", (gerado.match(/tema-escuro\)/g) || []).length);
}
