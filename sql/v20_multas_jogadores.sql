-- =========================================================
-- v20: multas visíveis a todo o plantel na Área do Jogador (correr no SQL Editor do Supabase)
-- Cada jogador com conta ligada passa a ler todas as multas (as suas, as dos colegas e as do
-- treinador — linhas com staff_id, ver v19_multas_staff.sql) e os totais da equipa.
-- Substitui a política da v10 que só deixava ler as próprias ("Players read own fines").
-- Escrever continua só para o admin ("fines admin write"); a equipa técnica já lê tudo ("fines staff read").
-- =========================================================

drop policy if exists "Players read own fines" on public.fines;
drop policy if exists "Players read fines" on public.fines;
create policy "Players read fines" on public.fines for select to authenticated using (public.vfn_is_player());

-- nome/foto do treinador nas multas dele (já existia no schema.sql; repetido para garantir)
drop policy if exists "Players read staff" on public.staff;
create policy "Players read staff" on public.staff for select to authenticated using (public.vfn_is_player());
