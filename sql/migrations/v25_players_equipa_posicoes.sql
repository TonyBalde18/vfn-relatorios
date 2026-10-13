-- =========================================================
-- v25: posições secundárias na Área do Jogador (correr no SQL Editor do Supabase)
-- A view players_equipa (Área do Jogador) passa a ter players.sub_posicao e players.posicoes_secundarias
-- (as colunas já existem, v24 ponto 2). A ficha do jogador mostra então a posição detalhada e as
-- secundárias, como no admin e no dashboard; o código já as lê (VFNHub.jogadorDeLinha), não muda nada.
-- As duas colunas vão no fim: "create or replace view" só aceita colunas novas no fim. Se a view no
-- Supabase for diferente da do sql/schema.sql, o comando dá erro e nada muda.
-- Substitui o ponto 3 da v24.
-- =========================================================

create or replace view public.players_equipa as
select
  id, name, display_name, full_name, position, number, photo_url, date_of_birth, availability,
  jsonb_build_object(
    'jogos', coalesce(stats->'jogos', '0'::jsonb),
    'golos', coalesce(stats->'golos', '0'::jsonb),
    'assistencias', coalesce(stats->'assistencias', '0'::jsonb),
    'cartoesA', coalesce(stats->'cartoesA', '0'::jsonb),
    'cartoesV', coalesce(stats->'cartoesV', '0'::jsonb),
    'minutos', coalesce(stats->'minutos', '0'::jsonb),
    'pePreferencial', coalesce(stats->'pePreferencial', '""'::jsonb)
  ) as stats,
  coalesce(auth_user_id = auth.uid(), false) as e_eu,
  sub_posicao,
  posicoes_secundarias
from public.players
where public.vfn_is_player() or public.vfn_is_staff();

-- só leitura e só para contas autenticadas (como na v21; o "create or replace" mantém os privilégios,
-- repete-se para garantir)
revoke all on public.players_equipa from anon, authenticated;
grant select on public.players_equipa to authenticated;

-- verificação: as duas colunas novas aparecem e não há escrita para anon/authenticated
select
  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'players_equipa' and column_name = 'sub_posicao') as tem_sub_posicao,
  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'players_equipa' and column_name = 'posicoes_secundarias') as tem_posicoes_secundarias,
  (select count(*) from information_schema.role_table_grants where table_schema = 'public' and table_name = 'players_equipa'
     and grantee in ('anon', 'authenticated') and privilege_type <> 'SELECT') as privilegios_de_escrita; -- deve ser 0
