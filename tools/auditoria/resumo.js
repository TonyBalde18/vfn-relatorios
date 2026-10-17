const r = require(process.argv[2]);
const ruido = /Datadog|getIdsFromUrl|Checking domain|Delay detection|Queue initiali|IMPORTANT: Make sure URL|continue button|Tracking Prevention|assets\/players\/\d+\.jpg|assets\/external\/\d+\.jpg/;
const agg = new Map();
for (const c of r) for (const v of c.vistas) {
  const itens = [...v.eventos.filter(e => !ruido.test(e)).map(e => "EV " + e.replace(/http:\/\/localhost:8765\//g, "")), ...v.overflow.map(o => "OVERFLOW " + o), ...v.contraste.map(o => "CONTRASTE " + o.replace(/ cor=.*/, "") + " [" + o.split(" cor=")[1] + "]")];
  for (const i of itens) { const k = `${c.pagina}|${c.papel||"anon"}|${v.vista}|${i.replace(/ \(right=\d+\)/, "").replace(/» [\d.]+ /, "» ")}`; const e = agg.get(k) || { onde: new Set(), txt: i }; e.onde.add(c.tema[0] + c.largura); agg.set(k, e); }
}
for (const [k, e] of agg) { const [p, papel, v] = k.split("|"); console.log(`${p} ${papel} ${v} [${[...e.onde].join(",")}] ${e.txt.slice(0, 230)}`); }
