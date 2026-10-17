/* Supabase falso para a auditoria: sessão simulada (papel em localStorage.vfnFakeRole), leituras reais
   pela REST com a chave anon (tabelas protegidas trocadas pelas views públicas), escritas sem efeito. */
(function () {
  const PAPEL = (function () { try { return localStorage.getItem("vfnFakeRole") || ""; } catch (e) { return ""; } })();
  const TROCA = { players: "players_public", players_equipa: "players_public", sessions: "sessions_public" };
  const UID = "00000000-0000-0000-0000-0000000000aa";
  function createClient(url, key) {
    const H = { apikey: key, Authorization: "Bearer " + key };
    const sessao = PAPEL ? { user: { id: UID, email: "audit@vfn.pt", user_metadata: { full_name: "Auditoria" } }, access_token: "x" } : null;
    function builder(tabela) {
      const q = { tabela, filtros: [], escrita: false, unico: false, talvez: false, ordem: null, lim: null };
      const b = {
        select() { return b; }, eq(c, v) { q.filtros.push(c + "=eq." + encodeURIComponent(v)); return b; },
        neq(c, v) { q.filtros.push(c + "=neq." + encodeURIComponent(v)); return b; },
        in(c, l) { q.filtros.push(c + "=in.(" + l.map(encodeURIComponent).join(",") + ")"); return b; },
        match(o) { Object.keys(o).forEach(k => b.eq(k, o[k])); return b; },
        or(s) { q.filtros.push("or=(" + encodeURIComponent(s) + ")"); return b; },
        order(c, o) { q.ordem = c + "." + (o && o.ascending === false ? "desc" : "asc"); return b; },
        limit(n) { q.lim = n; return b; },
        gte(c, v) { q.filtros.push(c + "=gte." + encodeURIComponent(v)); return b; },
        lte(c, v) { q.filtros.push(c + "=lte." + encodeURIComponent(v)); return b; },
        upsert(l) { q.escrita = l; return b; }, insert(l) { q.escrita = l; return b; },
        update(l) { q.escrita = l; return b; }, delete() { q.escrita = {}; return b; },
        single() { q.unico = true; return b; }, maybeSingle() { q.talvez = true; return b; },
        then(ok, ko) { return executar().then(ok, ko); }
      };
      async function executar() {
        if (q.escrita) { window.__vfnEscritas = (window.__vfnEscritas || 0) + 1; (window.__vfnGravacoes = window.__vfnGravacoes || []).push(tabela); const l = Array.isArray(q.escrita) ? q.escrita : [q.escrita]; return { data: q.unico || q.talvez ? l[0] : l, error: null }; }
        // dados de teste (FIXTURES no driver): estas tabelas vêm do ficheiro em vez da base de dados
        const fixtures = (function () { try { return JSON.parse(localStorage.getItem("vfnFakeFixtures") || "{}"); } catch (e) { return {}; } })();
        if (fixtures[TROCA[tabela] || tabela] || fixtures[tabela]) {
          let d = fixtures[tabela] || fixtures[TROCA[tabela]];
          q.filtros.forEach(fl => { const m = fl.match(/^([a-z_]+)=eq\.(.*)$/); if (m) d = d.filter(r => String(r[m[1]]) === decodeURIComponent(m[2])); });
          if (tabela === "players_equipa") d = d.map((p, i) => ({ ...p, e_eu: PAPEL === "jogador" && i === 0 }));
          return { data: q.unico || q.talvez ? d[0] || null : d, error: null };
        }
        if (tabela === "profiles") {
          const d = ["admin", "treinador", "dirigente"].includes(PAPEL) ? { role: PAPEL, full_name: "Auditoria" } : null;
          return { data: q.unico || q.talvez ? d : (d ? [d] : []), error: null };
        }
        const real = TROCA[tabela] || tabela;
        (window.__vfnPedidos = window.__vfnPedidos || []).push(tabela + (q.filtros.length ? "?" + q.filtros.join("&") : ""));
        let u = url + "/rest/v1/" + real + "?select=*";
        q.filtros.forEach(f => { u += "&" + f; });
        if (q.ordem) u += "&order=" + q.ordem;
        if (q.lim) u += "&limit=" + q.lim;
        const r = await fetch(u, { headers: H });
        const j = await r.json();
        if (!r.ok) return { data: null, error: { message: j.message || "erro", code: j.code } };
        let d = j;
        if (tabela === "players_equipa") d = d.map((p, i) => ({ ...p, e_eu: PAPEL === "jogador" && i === 0 }));
        if (q.unico || q.talvez) d = d[0] || null;
        return { data: d, error: null };
      }
      return b;
    }
    return {
      from: builder,
      rpc: async (nome) => ({ data: nome === "vfn_is_player" ? PAPEL === "jogador" : null, error: null }),
      auth: {
        getSession: async () => ({ data: { session: sessao }, error: null }),
        getUser: async () => ({ data: { user: sessao && sessao.user }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
        signInWithPassword: async () => ({ data: { session: sessao }, error: null }),
        signOut: async () => ({ error: null }), resetPasswordForEmail: async () => ({ error: null }), updateUser: async () => ({ error: null })
      },
      storage: { from: () => ({ getPublicUrl: p => ({ data: { publicUrl: "" } }), upload: async () => ({ error: null }), remove: async () => ({ error: null }), createSignedUrls: async () => ({ data: [], error: null }) }) }
    };
  }
  window.supabase = { createClient };
})();
