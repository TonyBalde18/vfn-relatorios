-- =====================================================================
-- v30 — Jogadores conhecidos (external_players): número e posição
-- =====================================================================
-- Os jogadores-chave do adversário no relatório passam a ter Nome · Nº · Posição · ID zerozero e ficam nos
-- jogadores conhecidos (o ID zerozero é a chave; não aparece no relatório). A coluna number pode já existir
-- (schema.sql); a position é nova. Sem esta migração a app grava na mesma, só sem a posição.
-- Pode correr-se mais do que uma vez.
-- =====================================================================

alter table public.external_players add column if not exists number integer;
alter table public.external_players add column if not exists position text;

-- Verificação: devem aparecer as colunas number (integer) e position (text)
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'external_players'
order by ordinal_position;
