-- =========================================================
-- v26: contribuições voluntárias nas multas (correr no SQL Editor do Supabase)
-- Uma contribuição não é uma multa: é dinheiro que alguém dá ao fundo (ex.: o dirigente José Maria dá 5 €
-- por cada vitória). Fica na tabela fines com kind = 'contribuicao', já recebida (paid = true), e soma ao
-- total arrecadado; não entra nas dívidas nem no nº de multas.
-- Pode ser de um jogador (player_id), da equipa técnica (staff_id) ou de alguém de fora do plantel
-- (contributor_name, texto livre). As multas continuam a exigir exatamente um jogador ou um elemento da
-- equipa técnica (regra da v19).
-- RLS: as políticas existentes chegam (só o admin escreve; equipa técnica e jogadores leem).
-- Depois do sql/migrations/v19_multas_staff.sql.
-- =========================================================

alter table public.fines add column if not exists kind text not null default 'multa';
alter table public.fines add column if not exists contributor_name text;

alter table public.fines drop constraint if exists fines_kind_valido;
alter table public.fines add constraint fines_kind_valido check (kind in ('multa', 'contribuicao'));

-- substitui a regra da v19: multas com exatamente uma pessoa; contribuições com no máximo uma pessoa
-- e, sem pessoa, com o nome de quem contribuiu
alter table public.fines drop constraint if exists fines_jogador_ou_staff;
alter table public.fines add constraint fines_jogador_ou_staff check (
  (kind = 'multa' and (player_id is not null) <> (staff_id is not null))
  or (kind = 'contribuicao'
      and not (player_id is not null and staff_id is not null)
      and (player_id is not null or staff_id is not null or coalesce(trim(contributor_name), '') <> ''))
);

-- verificação: as colunas existem e as linhas atuais continuam válidas (todas 'multa')
select
  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'fines' and column_name = 'kind') as tem_kind,
  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'fines' and column_name = 'contributor_name') as tem_contributor_name,
  (select count(*) from public.fines where kind = 'multa') as multas,
  (select count(*) from public.fines where kind = 'contribuicao') as contribuicoes;
