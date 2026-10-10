-- =========================================================
-- v18: "11 mais utilizado" na página pública pela posição real (correr no SQL Editor do Supabase)
-- A página pública não pode ler match_reports. Esta view expõe só o necessário de cada relatório
-- publicado: formação, onze inicial (por slot) e as substituições (minuto, quem sai, quem entra).
-- Sem a view, a página pública mostra o 11 pela posição do perfil (como antes).
-- (A view corre com os privilégios de quem a cria: expõe só estas colunas, não os relatórios.)
-- =========================================================
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
where coalesce(r.status, r.match_data->>'_status') = 'published';

grant select on public.onze_jogos to anon, authenticated;
