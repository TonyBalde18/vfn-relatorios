-- =========================================================
-- v24: migrações que só existiam em comentários do JS (documentação — NÃO é preciso correr)
-- Juntadas aqui na V1.0 para que os ficheiros .sql descrevam a base de dados inteira. Estado em 13/10/2026:
-- as instruções abaixo estão comentadas de propósito; só servem para recriar a base de dados de raiz.
-- Ao recriar, correr depois do sql/schema.sql e das migrações anteriores (ver sql/README.md).
-- =========================================================

-- 1) Lugares do onze no mini-campo da convocatória (v15) — APLICADO (confirmado 13/10/2026)
--    Formato: { "0": "<id do GR>", "1": "<id>", ... } com o índice de VFN.FORMACOES_SLOTS[formation].
--    Usado em js/admin/admin.js (convocatória) e js/core/hub.js (11 mais utilizado).
-- alter table public.squads add column if not exists lineup_slots jsonb default '{}';

-- 2) Sub-posições dos jogadores (admin e dashboard; não aparecem na página pública) — APLICADO (confirmado 13/10/2026)
--    A posição principal continua a ser a categoria do primeiro código de players.position.
--    Usado em js/core/shared.js (SUB_POSICOES) e na ficha do jogador do admin.
-- alter table public.players add column if not exists sub_posicao text;
-- alter table public.players add column if not exists posicoes_secundarias jsonb default '[]';

-- 3) players_equipa com as sub-posições (Área do Jogador: posições secundárias na ficha) — SUBSTITUÍDO pela v25
--    (sql/migrations/v25_players_equipa_posicoes.sql, com a verificação). Fica aqui só como histórico.
--    A view base está no sql/schema.sql; esta versão acrescenta as duas colunas no fim. Sem ela a ficha
--    da Área do Jogador mostra só a posição principal. Se for aplicada, repetir o revoke/grant da v21
--    (create or replace view mantém os privilégios, mas confirmar com a verificação da v21).
-- create or replace view public.players_equipa as
-- select id, name, display_name, full_name, position, number, photo_url, date_of_birth, availability,
--   jsonb_build_object('jogos', coalesce(stats->'jogos', '0'::jsonb), 'golos', coalesce(stats->'golos', '0'::jsonb),
--     'assistencias', coalesce(stats->'assistencias', '0'::jsonb), 'cartoesA', coalesce(stats->'cartoesA', '0'::jsonb),
--     'cartoesV', coalesce(stats->'cartoesV', '0'::jsonb), 'minutos', coalesce(stats->'minutos', '0'::jsonb),
--     'pePreferencial', coalesce(stats->'pePreferencial', '""'::jsonb)) as stats,
--   coalesce(auth_user_id = auth.uid(), false) as e_eu,
--   sub_posicao, posicoes_secundarias
-- from public.players where public.vfn_is_player() or public.vfn_is_staff();

-- 4) Presenças: cada jogador lê só as suas (v15) — NÃO NECESSÁRIO (decisão 13/10/2026)
--    Está ativa a política mais larga "Players read attendance" do sql/schema.sql (cada jogador lê as
--    presenças de todo o plantel), que cobre as do próprio: a ficha da Área do Jogador mostra-as. Mantém-se
--    assim por decisão do clube. Esta alternativa (só as suas) fica documentada caso se queira restringir:
--    nesse caso apagar também "Players read attendance".
-- drop policy if exists "Players read own attendance" on public.attendance;
-- create policy "Players read own attendance" on public.attendance for select to authenticated
--   using (player_id in (select id from public.players where auth_user_id = auth.uid()));

-- 5) View golos_zonas (mapa de calor público, retirado na v15) — APLICADO: a view já não existe (13/10/2026)
-- drop view if exists public.golos_zonas;

-- 6) Notas individuais dos relatórios (removidas na v9; a coluna deixou de ser escrita) — OPCIONAL, NÃO APLICADO (a coluna ainda existe, sem uso)
-- alter table public.match_reports drop column if exists individual_notes;

-- Verificação (pode correr-se): estado de cada ponto
select
  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'squads' and column_name = 'lineup_slots') as "1_lineup_slots",
  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'players' and column_name = 'sub_posicao') as "2_sub_posicao",
  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'players_equipa' and column_name = 'sub_posicao') as "3_players_equipa_com_posicoes",
  exists (select 1 from pg_policies where tablename = 'attendance' and policyname in ('Players read attendance', 'Players read own attendance')) as "4_jogador_le_presencas",
  not exists (select 1 from information_schema.views where table_schema = 'public' and table_name = 'golos_zonas') as "5_golos_zonas_apagada",
  not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'match_reports' and column_name = 'individual_notes') as "6_individual_notes_apagada";
