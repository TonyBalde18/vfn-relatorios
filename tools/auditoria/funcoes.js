// Funções: mesmo nome em vários ficheiros, corpos quase iguais (tokens normalizados) e funções longas (>50 linhas).
const fs = require("fs"), path = require("path");
const R = process.argv[2];
const ficheiros = ["js/core/shared.js","js/core/hub.js","js/core/components.js","js/core/relatorio.js","js/core/nav.js","js/admin/app.js","js/admin/admin.js","js/admin/modo-jogo.js","js/pages/dashboard.js","js/pages/equipa.js","js/pages/public.js"];
const funcs = [];
for (const f of ficheiros) {
  const linhas = fs.readFileSync(path.join(R, f), "utf8").split("\n");
  linhas.forEach((l, i) => {
    const m = l.match(/^\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(|^\s*const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{/);
    if (!m) return;
    let prof = 0, abriu = false, fim = i;
    for (let j = i; j < linhas.length; j++) { for (const ch of linhas[j]) { if (ch === "{") { prof++; abriu = true; } else if (ch === "}") prof--; } if (abriu && prof <= 0) { fim = j; break; } }
    const corpo = linhas.slice(i, fim + 1).join("\n");
    const norm = corpo.replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, "").replace(/["'`][^"'`]*["'`]/g, "S").replace(/\b[a-zA-Z_$][\w$]*\b/g, "x").replace(/\s+/g, "");
    funcs.push({ f, nome: m[1] || m[2], linha: i + 1, n: fim - i + 1, norm, corpo });
  });
}
console.log("== mesmo nome em mais do que um ficheiro");
const porNome = {}; funcs.forEach(x => (porNome[x.nome] = porNome[x.nome] || []).push(x));
Object.entries(porNome).filter(([, l]) => new Set(l.map(x => x.f)).size > 1).forEach(([n, l]) => console.log(n.padEnd(26), l.map(x => `${x.f}:${x.linha}(${x.n})`).join("  ")));
console.log("\n== corpos com a mesma estrutura (>=4 linhas, nomes diferentes ou ficheiros diferentes)");
const porNorm = {}; funcs.filter(x => x.n >= 4).forEach(x => (porNorm[x.norm] = porNorm[x.norm] || []).push(x));
Object.values(porNorm).filter(l => l.length > 1 && new Set(l.map(x => x.f)).size > 1).forEach(l => console.log(l.map(x => `${x.f}:${x.linha} ${x.nome}(${x.n})`).join("  ≈  ")));
console.log("\n== funções com mais de 50 linhas");
funcs.filter(x => x.n > 50).sort((a, b) => b.n - a.n).forEach(x => console.log(String(x.n).padStart(4), `${x.f}:${x.linha}`, x.nome));
