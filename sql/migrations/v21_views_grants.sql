-- =========================================================
-- v21: views só de leitura (correr no SQL Editor do Supabase)
-- O Supabase dá por omissão ALL (INSERT/UPDATE/DELETE/...) ao anon e ao authenticated em tudo o que se
-- cria no schema public. As 4 views abaixo são simples (uma tabela, colunas diretas), por isso o Postgres
-- deixa escrever através delas — e, sendo SECURITY DEFINER, essa escrita corre como o dono da view,
-- sem a RLS de players / sessions / match_reports (ex.: o anon podia alterar nomes em players pela
-- players_public; um jogador podia apagar linhas de players pela players_equipa).
-- As views ficam SECURITY DEFINER de propósito: escondem colunas (a RLS só filtra linhas); ver o aviso
-- "security definer view" do Security Advisor como intencional.
-- =========================================================

revoke all on public.players_public, public.sessions_public, public.onze_jogos, public.players_equipa
  from anon, authenticated;

-- só leitura, para quem já lia
grant select on public.players_public, public.sessions_public, public.onze_jogos to anon, authenticated;
grant select on public.players_equipa to authenticated;

-- verificação: não deve devolver linhas (nenhuma view do public com escrita para anon/authenticated)
select c.relname as view, g.grantee, g.privilege_type
from information_schema.role_table_grants g
join pg_class c on c.relname = g.table_name
join pg_namespace n on n.oid = c.relnamespace and n.nspname = g.table_schema
where g.table_schema = 'public' and c.relkind = 'v'
  and g.grantee in ('anon', 'authenticated') and g.privilege_type <> 'SELECT'
order by 1, 2, 3;
