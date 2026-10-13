// Funções declaradas que nunca são referidas noutro sítio (código + HTML, incluindo onclick="").
const fs = require("fs"), path = require("path");
const R = process.argv[2];
const js = ["core", "admin", "pages"].flatMap(d => fs.readdirSync(path.join(R, "js", d)).filter(f => f.endsWith(".js")).map(f => "js/" + d + "/" + f));
const html = fs.readdirSync(R).filter(f => f.endsWith(".html"));
const fontes = Object.fromEntries([...js, ...html].map(f => [f, fs.readFileSync(path.join(R, f), "utf8")]));
const tudo = Object.values(fontes).join("\n");
const resultado = [];
for (const f of js) {
  const s = fontes[f];
  const re = /(?:^|\n)\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(|(?:^|\n)\s*const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/g;
  let m;
  while ((m = re.exec(s))) {
    const nome = m[1] || m[2];
    const usos = (tudo.match(new RegExp("\\b" + nome.replace(/\$/g, "\\$") + "\\b", "g")) || []).length;
    // 1 = só a declaração; 2 = declaração + entrada no objeto exportado (sem uso real)
    const exportada = new RegExp("\\b" + nome + "\\s*[,}\\n]").test(s.slice(s.lastIndexOf("return {")));
    if (usos === 1 || (usos === 2 && exportada)) resultado.push(`${f}: ${nome}${usos === 2 ? " (só exportada)" : ""}`);
  }
}
console.log(resultado.join("\n") || "nenhuma");
