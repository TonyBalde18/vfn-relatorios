-- =========================================================
-- v19.2: multas da equipa técnica (correr no SQL Editor do Supabase)
-- Erro corrigido: insert or update on table "fines" violates foreign key constraint "fines_player_id_fkey".
-- fines.player_id é FK para players e o treinador (Ricardo, 1635906) não está em players. As multas da
-- equipa técnica passam a gravar fines.staff_id (FK para staff) com player_id a NULL; cada multa tem
-- exatamente um dos dois. As multas dos jogadores ficam iguais.
-- =========================================================

-- o treinador tem de existir em staff (a app usa este valor por omissão)
insert into public.staff (id, name, full_name, role, date_of_birth)
values ('1635906', 'Ricardo Isento', 'Ricardo Manuel Mendes Isento', 'treinador', '1975-10-25')
on conflict (id) do nothing;

alter table public.fines alter column player_id drop not null;
alter table public.fines add column if not exists staff_id text references public.staff(id) on delete cascade;

alter table public.fines drop constraint if exists fines_jogador_ou_staff;
alter table public.fines add constraint fines_jogador_ou_staff
  check ((player_id is not null) <> (staff_id is not null));

-- RLS: as políticas existentes chegam (o admin escreve todas as linhas; a equipa técnica lê todas;
-- cada jogador só lê as suas — player_id = o seu id, por isso não vê as da equipa técnica).
