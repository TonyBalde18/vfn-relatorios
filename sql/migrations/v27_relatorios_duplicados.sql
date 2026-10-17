-- =========================================================
-- v27: relatórios repetidos do mesmo jogo (correr no SQL Editor do Supabase, por partes)
-- Causa (corrigida na app na v1.1): ao escolher no Pré-Jogo um jogo que já tinha relatório e carregar em
-- "Cancelar", o formulário ficava associado ao jogo com um relatório novo; e cada "Gerar Relatório Word" de um
-- formulário sem jogo criava uma linha nova. Agora a app verifica na base de dados antes de criar um relatório
-- e reutiliza a mesma linha.
-- Este ficheiro: 1) mostra os repetidos; 2) (opcional) apaga-os; 3) (opcional) impede-os na base de dados.
-- =========================================================

-- 1) Jogos com mais de um relatório: ids do mais recente para o mais antigo, com o estado de cada um
select match_id,
       count(*) as relatorios,
       array_agg(id order by (status = 'published') desc, updated_at desc) as ids,
       array_agg(coalesce(status, match_data->>'_status', '?') order by (status = 'published') desc, updated_at desc) as estados,
       array_agg(updated_at order by (status = 'published') desc, updated_at desc) as atualizados
from public.match_reports
where match_id is not null
group by match_id
having count(*) > 1
order by max(updated_at) desc;

-- 2) OPCIONAL — apagar os repetidos. Fica um por jogo: o publicado; se houver vários, o mais recente.
--    Rever primeiro o resultado do passo 1 (o 1.º id de cada linha é o que fica). Não se pode desfazer.
-- with ordenados as (
--   select id, row_number() over (partition by match_id order by (status = 'published') desc, updated_at desc) as n
--   from public.match_reports where match_id is not null
-- )
-- delete from public.match_reports where id in (select id from ordenados where n > 1);

-- 3) OPCIONAL — depois do passo 2: a base de dados passa a recusar um segundo relatório para o mesmo jogo.
-- create unique index if not exists match_reports_um_por_jogo on public.match_reports (match_id) where match_id is not null;
