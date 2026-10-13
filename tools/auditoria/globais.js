// Globais (funções e let/const de topo) de um ficheiro usadas noutro (scripts clássicos partilham o âmbito global).
const fs = require("fs"), path = require("path");
const R = process.argv[2];
const ler = f => fs.readFileSync(path.join(R, f), "utf8");
const decl = s => { const r = new Set(); for (const l of s.split(/\r?\n/)) { const m = l.match(/^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)|^(?:let|const|var)\s+([A-Za-z_$][\w$]*)/); if (m) r.add(m[1] || m[2]); } return r; };
const pares = [["js/admin/admin.js", "js/admin/app.js"], ["js/admin/app.js", "js/admin/admin.js"], ["js/admin/modo-jogo.js", "js/admin/app.js"], ["js/admin/modo-jogo.js", "js/admin/admin.js"], ["js/admin/app.js", "js/admin/modo-jogo.js"]];
for (const [quem, de] of pares) {
  const s = ler(quem), d = decl(ler(de));
  const usados = [...d].filter(n => new RegExp("(^|[^\\w$.])" + n.replace(/\$/g, "\\$") + "\\b").test(s));
  console.log(`${quem} usa ${usados.length} globais de ${de}: ${usados.slice(0, 30).join(", ")}${usados.length > 30 ? " …" : ""}`);
}
