-- =========================================================
-- v22: avisos do Security Advisor (correr no SQL Editor do Supabase)
-- Ver o fim do ficheiro para o que fica de propósito.
-- =========================================================

-- 0) Segurança: se alguma política que o anon atravessa (roles public/anon) usar estas funções, tirar o
--    EXECUTE ao anon partia essa leitura na página pública. Nesse caso pára aqui sem mudar nada.
do $$
declare lista text;
begin
  select string_agg(schemaname || '.' || tablename || ' / ' || policyname, ', ') into lista
  from pg_policies
  where (roles && array['public', 'anon']::name[])
    and (coalesce(qual, '') ~ 'vfn_(role|is_admin|is_staff|is_player|player_id)' or coalesce(with_check, '') ~ 'vfn_(role|is_admin|is_staff|is_player|player_id)');
  if lista is not null then
    raise exception 'Parado: estas políticas do anon usam funções vfn_* — manda-me a lista: %', lista;
  end if;
end $$;

-- 1) Funções auxiliares da RLS (0028): o anon não as usa — as políticas que o anon atravessa são
--    "using (true)" e as views públicas não as chamam. Por omissão o Postgres dá EXECUTE a PUBLIC (que
--    inclui o anon), por isso revoga-se de PUBLIC e volta a dar-se só ao authenticated (as políticas
--    "to authenticated" e o rpc("vfn_is_player") da app precisam delas).
revoke execute on function public.vfn_role()      from public, anon;
revoke execute on function public.vfn_is_admin()  from public, anon;
revoke execute on function public.vfn_is_staff()  from public, anon;
revoke execute on function public.vfn_is_player() from public, anon;
revoke execute on function public.vfn_player_id() from public, anon;
grant execute on function public.vfn_role(), public.vfn_is_admin(), public.vfn_is_staff(),
  public.vfn_is_player(), public.vfn_player_id() to authenticated;

-- 2) vfn_h2h_do_jogo é a função do trigger dos jogos (sql/migrations/h2h_2.sql): ninguém a chama por rpc.
--    O trigger continua a disparar (o privilégio só conta quando o trigger é criado).
revoke execute on function public.vfn_h2h_do_jogo() from public, anon, authenticated;

-- 3) Bucket player-photos (0025): a política de leitura aberta deixa qualquer pessoa LISTAR as fotos.
--    O site usa só os URLs públicos (getPublicUrl), que num bucket público não precisam de política.
--    O admin continua a poder ler (o upload com upsert precisa de SELECT).
drop policy if exists "public read player photos" on storage.objects;
drop policy if exists "player-photos admin read" on storage.objects;
create policy "player-photos admin read" on storage.objects for select to authenticated
  using (bucket_id = 'player-photos' and public.vfn_is_admin());

-- verificação 1: funções vfn_* que o anon ainda pode executar (devia sobrar nada além das
-- que já eram só do authenticated)
select p.proname, has_function_privilege('anon', p.oid, 'execute') as anon_executa,
       has_function_privilege('authenticated', p.oid, 'execute') as auth_executa
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname like 'vfn\_%'
order by 1;

-- verificação 2: políticas do storage para o player-photos (o admin tem de ter insert e update para
-- carregar fotos; se não aparecerem, as fotos já eram carregadas por outra política — diz-me qual)
select policyname, cmd, roles, qual, with_check from pg_policies
where schemaname = 'storage' and tablename = 'objects' and (qual like '%player-photos%' or with_check like '%player-photos%');

-- =========================================================
-- Fica de propósito (não corrigir):
-- * security_definer_view (players_public, sessions_public, onze_jogos, players_equipa): as views
--   escondem colunas; com security_invoker deixavam de funcionar (ver sql/migrations/v21_views_grants.sql).
-- * 0029 authenticated: vfn_is_* / vfn_role / vfn_player_id (RLS), vfn_ligar_minha_conta (Área do
--   Jogador) e vfn_ligar_jogador (verifica que quem chama é admin) — a app precisa delas.
-- * Leaked password protection: não é SQL — Authentication → Sign In / Providers → Email →
--   "Prevent use of leaked passwords" (só nos planos pagos).
-- =========================================================
