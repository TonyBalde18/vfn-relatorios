// Auditoria headless (Edge + CDP): consola, pedidos falhados, overflow horizontal e contraste, por vista.
// uso: node driver.js <raiz-do-repo> <saida.json> [filtroPagina] [screenshots:0|1]
const http = require("http"), fs = require("fs"), path = require("path"), { spawn } = require("child_process");
const RAIZ = process.argv[2], SAIDA = process.argv[3], FILTRO = process.argv[4] || "", SHOTS = process.argv[5] === "1";
// FIXTURES=<ficheiro.json> { "tabela": [linhas] }: essas tabelas vêm do ficheiro (dados de teste), o resto da BD real
const FIXTURES = process.env.FIXTURES ? fs.readFileSync(process.env.FIXTURES, "utf8").replace(/\s+/g, " ") : "{}";
const DIR = path.dirname(SAIDA);
const FAKE = fs.readFileSync(path.join(__dirname, "fake-supabase.js"));
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PORTA = 8765, CDP = 9333;
const espera = ms => new Promise(r => setTimeout(r, ms));

const TIPOS = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".webp": "image/webp" };
http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split("?")[0]); if (p === "/") p = "/index.html";
  fs.readFile(path.join(RAIZ, p), (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { "Content-Type": TIPOS[path.extname(p)] || "application/octet-stream" }); r.end(d); });
}).listen(PORTA);

const CENARIOS = [];
const PAGINAS = [
  { pagina: "public.html", papel: "", nav: ".public-nav button[data-view]" },
  { pagina: "equipa.html", papel: "jogador", nav: ".public-nav button[data-view]" },
  { pagina: "dashboard.html", papel: "treinador", nav: "[data-view]" },
  { pagina: "index.html", papel: "admin", nav: "#tabNav [data-tab]" },
  { pagina: "index.html", papel: "", nav: "" },     // ecrã de login
  { pagina: "equipa.html", papel: "", nav: "" },
];
for (const p of PAGINAS) if (!FILTRO || p.pagina.includes(FILTRO)) for (const tema of (process.env.TEMAS || "claro,escuro").split(",")) for (const largura of (process.env.LARGURAS || "375,768,1280").split(",").map(Number)) CENARIOS.push({ ...p, tema, largura });

const AUDITORIA = `(() => {
  const W = innerWidth;
  const desc = el => { let s = el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + [...el.classList].slice(0, 3).map(c => "." + c).join(""); const a = el.parentElement && el.parentElement.closest("[id]"); return (a && !el.id ? "#" + a.id + " " : "") + s; };
  const visivel = el => { const cs = getComputedStyle(el); if (cs.visibility === "hidden" || cs.display === "none") return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !el.closest("[hidden]") && !el.closest(".modal-overlay[hidden]"); };
  // overflow horizontal
  const overflow = [];
  if (document.documentElement.scrollWidth > W + 1) {
    const clipa = el => { for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) { const o = getComputedStyle(a).overflowX; if (o !== "visible") return true; } return false; };
    document.querySelectorAll("body *").forEach(el => { if (!visivel(el)) return; const r = el.getBoundingClientRect(); if (r.right > W + 1 && !clipa(el) && getComputedStyle(el).position !== "fixed") { const p = el.parentElement; const pr = p && p.getBoundingClientRect(); if (!pr || pr.right <= W + 1 || p === document.body) overflow.push(desc(el) + " (right=" + Math.round(r.right) + ")"); } });
  }
  // contraste
  const rgba = s => { const m = s.match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const v = m[1].split(/[ ,\\/]+/).filter(Boolean).map(Number); return { r: v[0], g: v[1], b: v[2], a: v.length > 3 ? v[3] : 1 }; };
  const lum = c => { const f = x => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const fundo = el => {
    let camadas = [];
    for (let a = el; a; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (cs.backgroundImage && cs.backgroundImage !== "none") return null; // gradiente/imagem: não se avalia
      const c = rgba(cs.backgroundColor); if (c && c.a > 0) { camadas.push(c); if (c.a >= 0.99) break; }
    }
    let base = { r: 255, g: 255, b: 255 };
    for (let i = camadas.length - 1; i >= 0; i--) { const c = camadas[i]; base = { r: c.r * c.a + base.r * (1 - c.a), g: c.g * c.a + base.g * (1 - c.a), b: c.b * c.a + base.b * (1 - c.a) }; }
    return base;
  };
  const vistos = new Set(), contraste = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n; while ((n = walker.nextNode())) {
    const t = n.textContent.trim(); if (!t) continue;
    const el = n.parentElement; if (!el || el.closest("svg, script, style, noscript, .leaflet-container, canvas") || !visivel(el)) continue;
    const cs = getComputedStyle(el); if (parseFloat(cs.opacity) === 0) continue;
    const cor = rgba(cs.color); if (!cor || cor.a < 0.3) continue;
    const bg = fundo(el); if (!bg) continue;
    const l1 = lum(cor), l2 = lum(bg); const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    const grande = parseFloat(cs.fontSize) >= 18.5 || (parseFloat(cs.fontSize) >= 14 && Number(cs.fontWeight) >= 700);
    if (ratio < (grande ? 2.5 : 3)) { const k = desc(el); if (!vistos.has(k)) { vistos.add(k); contraste.push(k + " «" + t.slice(0, 30) + "» " + ratio.toFixed(2) + " cor=" + cs.color + " fundo=rgb(" + [bg.r, bg.g, bg.b].map(Math.round) + ")"); } }
  }
  return { overflow: overflow.slice(0, 15), contraste: contraste.slice(0, 25), scrollW: document.documentElement.scrollWidth };
})()`;

(async () => {
  const perfil = fs.mkdtempSync(path.join(require("os").tmpdir(), "vfn-audit-"));
  const edge = spawn(EDGE, ["--headless=new", "--disable-gpu", `--remote-debugging-port=${CDP}`, `--user-data-dir=${perfil}`, "--force-prefers-reduced-motion", "--no-first-run", "about:blank"], { stdio: "ignore" });
  let alvos; for (let i = 0; i < 40; i++) { try { alvos = await (await fetch(`http://127.0.0.1:${CDP}/json/list`)).json(); if (alvos.some(a => a.type === "page")) break; } catch (e) {} await espera(250); }
  const ws = new WebSocket(alvos.find(a => a.type === "page").webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  let id = 0; const pend = new Map(); const ouvintes = [];
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } else ouvintes.forEach(f => f(m)); };
  const cmd = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  for (const d of ["Page", "Runtime", "Log", "Network"]) await cmd(d + ".enable");
  // sem cache nem service worker: cada corrida vê sempre os ficheiros atuais do disco
  await cmd("Network.setCacheDisabled", { cacheDisabled: true });
  await cmd("Network.setBypassServiceWorker", { bypass: true });
  await cmd("Fetch.enable", { patterns: [{ urlPattern: "*supabase-js*" }] });
  let eventos = [];
  ouvintes.push(m => {
    // janelas alert/confirm: DIALOGO=cancelar responde Cancelar; senão OK (a mensagem fica nos eventos)
    if (m.method === "Page.javascriptDialogOpening") { eventos.push("DIALOGO " + m.params.message.replace(/\s+/g, " ").slice(0, 160)); cmd("Page.handleJavaScriptDialog", { accept: process.env.DIALOGO !== "cancelar" }); return; }
    if (m.method === "Fetch.requestPaused") cmd("Fetch.fulfillRequest", { requestId: m.params.requestId, responseCode: 200, responseHeaders: [{ name: "Content-Type", value: "text/javascript" }], body: FAKE.toString("base64") });
    else if (m.method === "Runtime.exceptionThrown") { const e = m.params.exceptionDetails; eventos.push("EXCEÇÃO " + ((e.exception && e.exception.description) || e.text).split("\n").slice(0, 2).join(" | ") + " @" + (e.url || "").split("/").pop() + ":" + e.lineNumber); }
    else if (m.method === "Runtime.consoleAPICalled" && ["error", "warning", "warn", "log"].includes(m.params.type)) eventos.push("console." + m.params.type + " " + m.params.args.map(a => a.value !== undefined ? String(a.value) : a.description || "").join(" ").slice(0, 200));
    else if (m.method === "Log.entryAdded" && ["error", "warning"].includes(m.params.entry.level)) eventos.push("log." + m.params.entry.level + " " + m.params.entry.text.slice(0, 200) + (m.params.entry.url ? " " + m.params.entry.url.slice(0, 120) : ""));
    else if (m.method === "Network.responseReceived" && m.params.response.status >= 400) eventos.push("HTTP " + m.params.response.status + " " + m.params.response.url.slice(0, 160));
    else if (m.method === "Network.loadingFailed" && !m.params.canceled) eventos.push("FALHOU " + m.params.errorText + " " + (m.params.type || ""));
  });
  const resultados = [];
  let scriptId = null;
  for (const c of CENARIOS) {
    if (scriptId) await cmd("Page.removeScriptToEvaluateOnNewDocument", { identifier: scriptId });
    const s = await cmd("Page.addScriptToEvaluateOnNewDocument", { source: `try{localStorage.setItem("vfnTema","${c.tema}");localStorage.setItem("vfnFakeRole","${c.papel}");localStorage.setItem("vfnFakeFixtures",${JSON.stringify(FIXTURES)});sessionStorage.setItem("vfnSplash","1");}catch(e){}
      document.addEventListener("DOMContentLoaded",()=>{const st=document.createElement("style");st.textContent="[data-aos]{opacity:1!important;transform:none!important}*{transition:none!important;animation-duration:0s!important}";document.head.appendChild(st);});` });
    scriptId = s.result.identifier;
    await cmd("Emulation.setDeviceMetricsOverride", { width: c.largura, height: 900, deviceScaleFactor: 1, mobile: c.largura < 800 });
    eventos = [];
    await cmd("Page.navigate", { url: `http://localhost:${PORTA}/${c.pagina}` });
    await espera(6000);
    const vistas = c.nav ? (await cmd("Runtime.evaluate", { expression: `[...document.querySelectorAll(${JSON.stringify(c.nav)})].map(b => b.dataset.view || b.dataset.tab)`, returnByValue: true })).result.result.value || [] : ["(inicial)"];
    const porVista = [];
    const pedidos = (await cmd("Runtime.evaluate", { expression: "window.__vfnPedidos || []", returnByValue: true })).result.result.value || [];
    // VISTAS=multas,hub: só estas vistas (as outras são saltadas)
    const SO = process.env.VISTAS ? process.env.VISTAS.split(",") : null;
    for (const v of [...new Set(vistas)].filter(v => !SO || !c.nav || SO.includes(v))) {
      if (c.nav) { await cmd("Runtime.evaluate", { expression: `(() => { const b = [...document.querySelectorAll(${JSON.stringify(c.nav)})].find(b => (b.dataset.view || b.dataset.tab) === ${JSON.stringify(v)}); if (b) b.click(); })()` }); await espera(1800); }
      const a = (await cmd("Runtime.evaluate", { expression: AUDITORIA, returnByValue: true })).result.result.value || {};
      // EVAL=<expressão>: mostra o resultado na consola (depuração de estilos, por exemplo)
      if (process.env.EVAL) console.log(v, JSON.stringify((await cmd("Runtime.evaluate", { expression: process.env.EVAL, returnByValue: true, awaitPromise: true })).result.result.value));
      if (SHOTS) { const sc = await cmd("Page.captureScreenshot", { format: "png", captureBeyondViewport: true }); if (sc.result) fs.writeFileSync(path.join(DIR, `${c.pagina.replace(".html", "")}-${c.papel || "anon"}-${c.tema}-${c.largura}-${v}.png`), Buffer.from(sc.result.data, "base64")); }
      porVista.push({ vista: v, ...a, eventos: eventos.splice(0) });
    }
    resultados.push({ ...c, pedidos, vistas: porVista });
    process.stdout.write(`${c.pagina} ${c.papel || "anon"} ${c.tema} ${c.largura}: ${porVista.length} vistas\n`);
  }
  fs.writeFileSync(SAIDA, JSON.stringify(resultados, null, 1));
  ws.close(); edge.kill(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
