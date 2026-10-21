-- =========================================================
-- v28: terceiro estado dos relatórios — "ficha_publicada" (correr no SQL Editor do Supabase)
-- match_reports.status é texto com uma regra (check): passa a aceitar 'draft' (rascunho), 'ficha_publicada'
-- (ficha do jogo: onze, eventos, minutos — conta para as estatísticas, sem a análise) e 'published'
-- (relatório completo). A equipa técnica, os dirigentes e os jogadores passam a ler também as fichas
-- publicadas (como já liam os relatórios publicados); o admin continua a gerir tudo ("Admin manages all").
-- A view pública onze_jogos (11 mais utilizado na página pública) passa a contar as fichas publicadas.
-- Sem este SQL, publicar uma ficha dá erro (a regra antiga só aceita 'draft' e 'published').
-- =========================================================

-- 1) estados aceites
alter table public.match_reports drop constraint if exists match_reports_status_check;
alter table public.match_reports add constraint match_reports_status_check
  check (status in ('draft', 'ficha_publicada', 'published'));

-- 2) leitura: equipa técnica e dirigentes (staff) e jogadores leem fichas e relatórios publicados
drop policy if exists "Staff reads published" on public.match_reports;
create policy "Staff reads published" on public.match_reports for select to authenticated
  using ((status in ('published', 'ficha_publicada') and public.vfn_is_staff()) or public.vfn_is_admin());

drop policy if exists "Players read reports published" on public.match_reports;
create policy "Players read reports published" on public.match_reports for select to authenticated
  using ((status in ('published', 'ficha_publicada') and public.vfn_is_player()) or public.vfn_is_admin());

-- 3) view pública do 11 mais utilizado (igual à v18, com as fichas publicadas)
create or replace view public.onze_jogos as
select
  r.id as report_id,
  r.match_id,
  coalesce(r.competition, r.match_data->'preJogo'->>'competicao') as competition,
  r.updated_at,
  r.match_data->'jogo'->>'formacaoVFN' as formacao,
  coalesce(nullif(r.match_data->'jogo'->>'duracaoJogo', '')::numeric::int, 90) as duracao,
  r.match_data->'jogo'->'titulares' as titulares,
  coalesce((
    select jsonb_agg(jsonb_build_object('tipo', e->>'tipo', 'equipa', e->>'equipa', 'minuto', e->'minuto',
                                        'jogadorId', e->'jogadorId', 'jogadorSaiId', e->'jogadorSaiId'))
    from jsonb_array_elements(coalesce(r.match_data->'jogo'->'eventos', '[]'::jsonb)) e
    where e->>'tipo' = 'Substituição'
  ), '[]'::jsonb) as substituicoes
from public.match_reports r
where coalesce(r.status, r.match_data->>'_status') in ('published', 'ficha_publicada');

-- só leitura (convenção da v21: o Supabase dá escrita por omissão às views)
revoke all on public.onze_jogos from anon, authenticated;
grant select on public.onze_jogos to anon, authenticated;

-- verificação: a regra aceita os 3 estados, as duas políticas leem as fichas e a view só tem SELECT
select
  pg_get_constraintdef(c.oid) as regra_status
from pg_constraint c where c.conname = 'match_reports_status_check';
select policyname, qual from pg_policies where tablename = 'match_reports' order by 1;
select count(*) as privilegios_de_escrita_onze_jogos from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'onze_jogos' and grantee in ('anon', 'authenticated') and privilege_type <> 'SELECT';
