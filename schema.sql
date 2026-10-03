-- =====================================================================
-- VFN Hub — esquema Supabase (época 2026/27)
--
-- Idempotente: pode ser executado várias vezes no SQL Editor.
-- Completa as tabelas já existentes (players, teams, matches, standings,
-- attendance, fines, match_reports, draft) e cria as que faltam
-- (profiles, opponents, sessions). Nenhuma coluna existente é removida.
--
-- DEPOIS DE CORRER: executar o bloco "1. ADMIN" no fim deste ficheiro
-- com o teu email, senão o index.html deixa de conseguir gravar dados.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- PERFIS E PAPÉIS
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'treinador', 'dirigente')),
  full_name text,
  created_at timestamptz not null default now()
);

-- security definer: as políticas podem consultar profiles sem recursão de RLS
create or replace function public.vfn_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.vfn_is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.vfn_role() = 'admin', false)
$$;

create or replace function public.vfn_is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.vfn_role() in ('admin', 'treinador', 'dirigente'), false)
$$;

-- ---------------------------------------------------------------------
-- TABELAS EXISTENTES — colunas em falta
-- ---------------------------------------------------------------------
create table if not exists public.players (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  position text,
  number integer,
  photo_url text,
  attributes jsonb not null default '{}'::jsonb,
  stats jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.teams (
  id text primary key,
  name text not null,
  logo_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  competition text,
  jornada integer,
  date timestamptz,
  home_away text,
  opponent text,
  opponent_team_id text,
  status text default 'agendado',
  score_home integer,
  score_away integer,
  created_at timestamptz not null default now()
);
alter table public.matches add column if not exists venue text;
alter table public.matches add column if not exists notes text;

create table if not exists public.standings (
  id uuid primary key default gen_random_uuid(),
  competition text not null,
  team_id text,
  team_name text,
  played integer not null default 0,
  won integer not null default 0,
  drawn integer not null default 0,
  lost integer not null default 0,
  goals_for integer not null default 0,
  goals_against integer not null default 0,
  points integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  player_id text not null,
  session_date date not null,
  session_type text not null default 'treino',
  status text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.fines (
  id uuid primary key default gen_random_uuid(),
  player_id text not null,
  infraction_type text not null,
  amount numeric(8,2) not null default 0,
  description text,
  match_date date,
  paid boolean not null default false,
  paid_date date,
  created_at timestamptz not null default now()
);

create table if not exists public.match_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  match_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.draft (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- TABELAS NOVAS
-- ---------------------------------------------------------------------

-- Observação de adversários (uma linha por equipa)
create table if not exists public.opponents (
  id uuid primary key default gen_random_uuid(),
  team_id text not null unique references public.teams(id) on delete cascade,
  style text,
  strengths text,
  weaknesses text,
  formation text,
  history text,
  updated_at timestamptz not null default now()
);

-- Sessões de treino/jogo da grelha de presenças: permite ter colunas
-- ainda sem nenhuma presença marcada
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  session_date date not null,
  session_type text not null check (session_type in ('treino', 'jogo')),
  notes text,
  created_at timestamptz not null default now(),
  unique (session_date, session_type)
);

create index if not exists attendance_session_idx on public.attendance (session_date, session_type);
create index if not exists attendance_player_idx on public.attendance (player_id);
create index if not exists fines_player_idx on public.fines (player_id);
create index if not exists fines_date_idx on public.fines (match_date);
create index if not exists matches_date_idx on public.matches (date);
create index if not exists standings_competition_idx on public.standings (competition);

-- ---------------------------------------------------------------------
-- VIEW PÚBLICA DO PLANTEL (sem atributos, notas nem dados pessoais)
-- Corre com os privilégios do dono, por isso o anónimo lê a view
-- sem ter acesso à tabela players.
-- ---------------------------------------------------------------------
create or replace view public.players_public as
select
  id,
  name,
  position,
  number,
  photo_url,
  jsonb_build_object(
    'jogos', coalesce(stats->'jogos', '0'::jsonb),
    'golos', coalesce(stats->'golos', '0'::jsonb),
    'assistencias', coalesce(stats->'assistencias', '0'::jsonb),
    'cartoesA', coalesce(stats->'cartoesA', '0'::jsonb),
    'cartoesV', coalesce(stats->'cartoesV', '0'::jsonb),
    'minutos', coalesce(stats->'minutos', '0'::jsonb)
  ) as stats
from public.players;

grant select on public.players_public to anon, authenticated;

-- ---------------------------------------------------------------------
-- ATUALIZAÇÃO 30/09/2026 — nomes dos jogadores e jogos entre outras equipas
-- (só acrescenta colunas; pode ser corrida sozinha)
-- ---------------------------------------------------------------------
alter table public.players add column if not exists display_name text;
alter table public.players add column if not exists full_name text;
alter table public.players add column if not exists date_of_birth date;

-- Jogos entre outras equipas da liga (para a classificação completa).
-- Nos jogos do VFN ficam a null e continuam a usar opponent/home_away.
alter table public.matches add column if not exists home_team_id text;
alter table public.matches add column if not exists away_team_id text;

-- ---------------------------------------------------------------------
-- ATUALIZAÇÃO 01/10/2026 — Jornadas AF Guarda: resultados entre outras
-- equipas (a classificação combina league_results + matches do VFN)
-- ---------------------------------------------------------------------
create table if not exists public.league_results (
  id uuid primary key default gen_random_uuid(),
  competition text not null,
  jornada integer not null,
  home_team_id text references public.teams(id),
  home_team_name text,
  away_team_id text references public.teams(id),
  away_team_name text,
  score_home integer,
  score_away integer,
  scorers text,
  created_at timestamptz not null default now()
);
create index if not exists league_results_comp_idx on public.league_results (competition, jornada);

alter table public.league_results enable row level security;
drop policy if exists "league_results public read" on public.league_results;
drop policy if exists "league_results admin write" on public.league_results;
create policy "league_results public read" on public.league_results for select to anon, authenticated using (true);
create policy "league_results admin write" on public.league_results for all to authenticated
  using (public.vfn_is_admin()) with check (public.vfn_is_admin());

-- ---------------------------------------------------------------------
-- ATUALIZAÇÃO 02/10/2026 — nomes das competições e data nos resultados
-- ---------------------------------------------------------------------
-- Nomes antigos → nomes oficiais (ex.: J3 VFN–Casal Cinza estava como
-- "2ª LIGA FUTEBOL ZERO GRAUS PRODUÇÕES" e ficava fora das jornadas e da classificação)
update public.matches set competition = '2ª Liga Zero Graus'
where competition ilike '%zero graus%' and competition ilike '%liga%' and competition not ilike '%taça%'
  and competition <> '2ª Liga Zero Graus';
update public.matches set competition = 'Taça de Honra Comunilog'
where competition ilike '%honra%' and competition <> 'Taça de Honra Comunilog';
update public.matches set competition = 'Taça 2ª Liga FDM'
where competition ilike '%fdm%' and competition <> 'Taça 2ª Liga FDM';

-- Data de cada jogo nas Jornadas AF Guarda
alter table public.league_results add column if not exists match_date date;

-- ---------------------------------------------------------------------
-- ATUALIZAÇÃO v3 (02/10/2026) — correr esta secção antes do deploy v3
-- ---------------------------------------------------------------------

-- [Tarefa 1] Relatórios de jogo: evolui a tabela existente (o match_data mantém-se)
alter table public.match_reports add column if not exists match_id uuid references public.matches(id) on delete set null;
alter table public.match_reports add column if not exists status text not null default 'draft';
alter table public.match_reports drop constraint if exists match_reports_status_check;
alter table public.match_reports add constraint match_reports_status_check check (status in ('draft', 'published'));
alter table public.match_reports add column if not exists competition text;
alter table public.match_reports add column if not exists match_date date;
alter table public.match_reports add column if not exists location text;
alter table public.match_reports add column if not exists opponent text;
alter table public.match_reports add column if not exists score_vfn integer;
alter table public.match_reports add column if not exists score_opponent integer;
alter table public.match_reports add column if not exists squad text[];
alter table public.match_reports add column if not exists lineup text[];
alter table public.match_reports add column if not exists formation text;
alter table public.match_reports add column if not exists substitutions jsonb;
alter table public.match_reports add column if not exists scorers jsonb;
alter table public.match_reports add column if not exists yellow_cards jsonb;
alter table public.match_reports add column if not exists red_cards jsonb;
alter table public.match_reports add column if not exists tactical_notes text;
alter table public.match_reports add column if not exists first_half_notes text;
alter table public.match_reports add column if not exists second_half_notes text;
alter table public.match_reports add column if not exists highlights text;
alter table public.match_reports add column if not exists areas_to_improve text;
alter table public.match_reports add column if not exists individual_notes jsonb;
alter table public.match_reports add column if not exists created_by uuid references auth.users(id);
create index if not exists match_reports_match_idx on public.match_reports (match_id);
-- relatórios antigos (gerados antes da v3) ficam publicados
update public.match_reports set status = coalesce(match_data->>'_status', 'published') where status = 'draft';
-- treinador/dirigentes só leem os publicados; o admin gere todos
drop policy if exists "reports staff read" on public.match_reports;
drop policy if exists "reports own rows" on public.match_reports;
drop policy if exists "Staff reads published" on public.match_reports;
drop policy if exists "Admin manages all" on public.match_reports;
create policy "Staff reads published" on public.match_reports for select to authenticated
  using ((status = 'published' and public.vfn_is_staff()) or public.vfn_is_admin());
create policy "Admin manages all" on public.match_reports for all to authenticated
  using (public.vfn_is_admin()) with check (public.vfn_is_admin());

-- [Tarefa 5] Disponibilidade dos jogadores (só admin e dashboard; fora da view pública)
alter table public.players add column if not exists availability text default 'disponivel'
  check (availability in ('disponivel', 'em_duvida', 'lesionado', 'suspenso', 'indisponivel'));

-- [Tarefa 2] Jogadores das outras equipas (ID Zerozero evita duplicados)
create table if not exists public.external_players (
  id text primary key,
  name text not null,
  team_id text references public.teams(id),
  team_name text,
  created_at timestamptz not null default now()
);
alter table public.external_players enable row level security;
drop policy if exists "Anyone reads external_players" on public.external_players;
drop policy if exists "Admin manages external_players" on public.external_players;
create policy "Anyone reads external_players" on public.external_players for select using (true);
create policy "Admin manages external_players" on public.external_players for all to authenticated
  using (public.vfn_is_admin()) with check (public.vfn_is_admin());

-- Marcadores estruturados: [{"player_id": "12345", "player_name": "Nome", "team_id": "6846", "count": 1}]
-- (a coluna de texto scorers mantém-se como notas)
alter table public.league_results add column if not exists scorer_list jsonb;

-- [Tarefa 9] Segurança do plantel público: mantém-se a view players_public
-- (id, name, display_name, full_name, position, number, photo_url e stats de jogo).
-- A tabela players continua sem leitura anónima; a disponibilidade (availability)
-- fica fora da view de propósito: só admin e dashboard a veem.
revoke all on public.players from anon;

-- [Tarefa 6] Taça 2ª Liga FDM — Pré-Eliminatória (jornada 1, 21/03/2027)
-- Só insere os jogos que ainda não existem (pode ser corrido várias vezes)
insert into public.league_results (competition, jornada, match_date, home_team_id, home_team_name, away_team_id, away_team_name)
select v.competition, v.jornada, v.match_date, v.home_team_id, v.home_team_name, v.away_team_id, v.away_team_name
from (values
  ('Taça 2ª Liga FDM', 1, date '2027-03-21', '6846', 'GD Foz Côa', '11082', 'Freixo de Numão'),
  ('Taça 2ª Liga FDM', 1, date '2027-03-21', '16479', 'Seia FC', '8063', 'Gonçalense'),
  ('Taça 2ª Liga FDM', 1, date '2027-03-21', '11073', 'Paços da Serra', '6306', 'Mileu Guarda')
) as v(competition, jornada, match_date, home_team_id, home_team_name, away_team_id, away_team_name)
where not exists (
  select 1 from public.league_results r
  where r.competition = v.competition and r.jornada = v.jornada
    and r.home_team_id = v.home_team_id and r.away_team_id = v.away_team_id
);

-- ---------------------------------------------------------------------
-- ATUALIZAÇÃO v4 (03/10/2026) — correr esta secção antes do deploy v4
-- ---------------------------------------------------------------------

-- [v4 Tarefa 1] Posições: o código AV passa a PL (mantém a ordem "DC/MDC/...")
update public.players
set position = (
  select string_agg(case when upper(trim(p)) = 'AV' then 'PL' else trim(p) end, '/' order by n)
  from unnest(string_to_array(position, '/')) with ordinality as t(p, n)
)
where position ~* '(^|/)\s*AV\s*(/|$)';

-- [v4 Tarefa 1] Tipos de multa: tabela própria; cada multa continua a guardar o nome
-- do tipo em texto (infraction_type), por isso as multas antigas mantêm-se como estão.
create table if not exists public.fine_types (
  id integer primary key,
  name text not null,
  amount numeric(8,2) not null default 0,
  description text,
  payer text not null default 'jogador' check (payer in ('jogador', 'treinador')),
  created_at timestamptz not null default now()
);
alter table public.fine_types enable row level security;
drop policy if exists "fine_types staff read" on public.fine_types;
drop policy if exists "fine_types admin write" on public.fine_types;
create policy "fine_types staff read" on public.fine_types for select to authenticated using (public.vfn_is_staff());
create policy "fine_types admin write" on public.fine_types for all to authenticated
  using (public.vfn_is_admin()) with check (public.vfn_is_admin());
-- valores iniciais; correr de novo não apaga nem altera tipos editados no admin
insert into public.fine_types (id, name, amount, payer) values
  (1,  'Joia Mensal', 0.50, 'jogador'),
  (2,  'Atraso treino até 5min', 0.50, 'jogador'),
  (3,  'Atraso treino após 5min', 1.00, 'jogador'),
  (4,  'Atraso jogo até 5min', 1.00, 'jogador'),
  (5,  'Atraso jogo após 5min', 2.00, 'jogador'),
  (6,  'Falta treino sem justificação', 5.00, 'jogador'),
  (7,  'Falta jogo sem justificação', 10.00, 'jogador'),
  (8,  'Não levar shampoo', 0.50, 'jogador'),
  (9,  'Não levar chinelos', 0.50, 'jogador'),
  (10, 'Cartão vermelho por protesto', 5.00, 'jogador'),
  (11, 'Cartão amarelo por protesto', 2.00, 'jogador'),
  (12, 'Telemóvel durante refeição ou palestra', 2.00, 'jogador'),
  (13, 'Falta de fato de treino no dia de jogo', 5.00, 'jogador'),
  (14, 'Cada golo sofrido', 0.50, 'jogador'),
  (15, 'Jogo sem sofrer golo', 2.00, 'treinador'),
  (16, 'Esquecer material no balneário', 0.50, 'jogador'),
  (17, 'Não tomar banho no dia de treino ou jogo', 1.00, 'jogador'),
  (18, 'Falta de respeito', 5.00, 'jogador'),
  (19, 'Levantar da refeição sem autorização', 1.00, 'jogador')
on conflict (id) do nothing;
alter table public.fines add column if not exists fine_type_id integer references public.fine_types(id) on delete set null;

-- [v4 Tarefa 1] Equipa técnica (o treinador paga a multa 15 "Jogo sem sofrer golo").
-- As multas usam fines.player_id com o id do treinador (a coluna não tem chave estrangeira).
create table if not exists public.staff (
  id text primary key,
  name text not null,
  full_name text,
  role text not null default 'treinador',
  date_of_birth date,
  photo_url text,
  created_at timestamptz not null default now()
);
alter table public.staff enable row level security;
drop policy if exists "staff staff read" on public.staff;
drop policy if exists "staff admin write" on public.staff;
create policy "staff staff read" on public.staff for select to authenticated using (public.vfn_is_staff());
create policy "staff admin write" on public.staff for all to authenticated
  using (public.vfn_is_admin()) with check (public.vfn_is_admin());
insert into public.staff (id, name, full_name, role, date_of_birth, photo_url) values
  ('1635906', 'Ricardo Isento', 'Ricardo Manuel Mendes Isento', 'treinador', date '1975-10-25', 'https://tonybalde18.github.io/vfn-relatorios/assets/staff/1635906.png')
on conflict (id) do nothing;

-- [v4 Tarefa 4] Equipas novas (logos em assets/opponents/<id>.png)
alter table public.teams add column if not exists city text; -- já usada no admin (Equipas)
insert into public.teams (id, name, city, logo_url) values
  ('8062',  'AD São Romão',        'São Romão, Seia',             'https://tonybalde18.github.io/vfn-relatorios/assets/opponents/8062.png'),
  ('5668',  'Ginásio Figueirense', 'Figueira de Castelo Rodrigo', 'https://tonybalde18.github.io/vfn-relatorios/assets/opponents/5668.png'),
  ('3546',  'Aguiar da Beira',     'Aguiar da Beira',             'https://tonybalde18.github.io/vfn-relatorios/assets/opponents/3546.png'),
  ('10485', 'Os Vilanovenses',     'Gouveia',                     'https://tonybalde18.github.io/vfn-relatorios/assets/opponents/10485.png'),
  ('3583',  'Fornos de Algodres',  'Fornos de Algodres',          'https://tonybalde18.github.io/vfn-relatorios/assets/opponents/3583.png'),
  ('6837',  'Manteigas',           'Manteigas',                   'https://tonybalde18.github.io/vfn-relatorios/assets/opponents/6837.png'),
  ('6845',  'Vila Cortez',         'Guarda',                      'https://tonybalde18.github.io/vfn-relatorios/assets/opponents/6845.png')
on conflict (id) do nothing;

-- Logos das equipas com o caminho absoluto do GitHub Pages
update public.teams
set logo_url = 'https://tonybalde18.github.io/vfn-relatorios/' || logo_url
where logo_url like 'assets/%';

-- A view pública passa a ter os nomes curto e completo (colunas novas no fim)
create or replace view public.players_public as
select
  id,
  name,
  position,
  number,
  photo_url,
  jsonb_build_object(
    'jogos', coalesce(stats->'jogos', '0'::jsonb),
    'golos', coalesce(stats->'golos', '0'::jsonb),
    'assistencias', coalesce(stats->'assistencias', '0'::jsonb),
    'cartoesA', coalesce(stats->'cartoesA', '0'::jsonb),
    'cartoesV', coalesce(stats->'cartoesV', '0'::jsonb),
    'minutos', coalesce(stats->'minutos', '0'::jsonb)
  ) as stats,
  display_name,
  full_name
from public.players;

grant select on public.players_public to anon, authenticated;

-- ---------------------------------------------------------------------
-- RLS — remove todas as políticas antigas destas tabelas e recria
-- ---------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select policyname, tablename from pg_policies
    where schemaname = 'public'
      and tablename in ('profiles', 'players', 'teams', 'matches', 'standings', 'opponents',
                        'attendance', 'fines', 'sessions', 'match_reports', 'draft')
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

alter table public.profiles enable row level security;
alter table public.players enable row level security;
alter table public.teams enable row level security;
alter table public.matches enable row level security;
alter table public.standings enable row level security;
alter table public.opponents enable row level security;
alter table public.attendance enable row level security;
alter table public.fines enable row level security;
alter table public.sessions enable row level security;
alter table public.match_reports enable row level security;
alter table public.draft enable row level security;

-- profiles: cada um lê o seu; o admin gere todos
create policy "profiles read own" on public.profiles for select to authenticated
  using (id = auth.uid() or public.vfn_is_admin());
create policy "profiles admin write" on public.profiles for all to authenticated
  using (public.vfn_is_admin()) with check (public.vfn_is_admin());

-- Dados públicos: qualquer pessoa lê, só o admin escreve
create policy "teams public read" on public.teams for select to anon, authenticated using (true);
create policy "teams admin write" on public.teams for all to authenticated
  using (public.vfn_is_admin()) with check (public.vfn_is_admin());

create policy "matches public read" on public.matches for select to anon, authenticated using (true);
create policy "matches admin write" on public.matches for all to authenticated
  using (public.vfn_is_admin()) with check (public.vfn_is_admin());

create policy "standings public read" on public.standings for select to anon, authenticated using (true);
create policy "standings admin write" on public.standings for all to authenticated
  using (public.vfn_is_admin()) with check (public.vfn_is_admin());

-- Dados da equipa técnica: staff lê, só o admin escreve
create policy "players staff read" on public.players for select to authenticated using (public.vfn_is_staff());
create policy "players admin write" on public.players for all to authenticated
  using (public.vfn_is_admin()) with check (public.vfn_is_admin() and user_id = auth.uid());

create policy "opponents staff read" on public.opponents for select to authenticated using (public.vfn_is_staff());
create policy "opponents admin write" on public.opponents for all to authenticated
  using (public.vfn_is_admin()) with check (public.vfn_is_admin());

create policy "attendance staff read" on public.attendance for select to authenticated using (public.vfn_is_staff());
create policy "attendance admin write" on public.attendance for all to authenticated
  using (public.vfn_is_admin()) with check (public.vfn_is_admin());

create policy "sessions staff read" on public.sessions for select to authenticated using (public.vfn_is_staff());
create policy "sessions admin write" on public.sessions for all to authenticated
  using (public.vfn_is_admin()) with check (public.vfn_is_admin());

create policy "fines staff read" on public.fines for select to authenticated using (public.vfn_is_staff());
create policy "fines admin write" on public.fines for all to authenticated
  using (public.vfn_is_admin()) with check (public.vfn_is_admin());

-- Relatórios e rascunhos: cada utilizador gere os seus; staff lê relatórios
create policy "Staff reads published" on public.match_reports for select to authenticated
  using ((status = 'published' and public.vfn_is_staff()) or public.vfn_is_admin());
create policy "Admin manages all" on public.match_reports for all to authenticated
  using (public.vfn_is_admin()) with check (public.vfn_is_admin());

create policy "draft own row" on public.draft for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- STORAGE — logos de equipas usam o mesmo bucket das fotografias
-- (pasta <uid>/teams/...), por isso as políticas existentes chegam.
-- Se o bucket ainda não existir, ver README.
-- ---------------------------------------------------------------------


-- =====================================================================
-- 1. ADMIN — executar uma vez, substituindo o email
-- =====================================================================
-- insert into public.profiles (id, role, full_name)
-- select id, 'admin', 'Tony' from auth.users where email = 'O_TEU_EMAIL'
-- on conflict (id) do update set role = excluded.role;

-- =====================================================================
-- 2. TREINADOR / DIRIGENTES — criar primeiro o utilizador em
--    Authentication > Users, depois:
-- =====================================================================
-- insert into public.profiles (id, role, full_name)
-- select id, 'treinador', 'Nome do Treinador' from auth.users where email = 'email@exemplo.pt'
-- on conflict (id) do update set role = excluded.role;
--
-- insert into public.profiles (id, role, full_name)
-- select id, 'dirigente', 'Nome do Dirigente' from auth.users where email = 'email@exemplo.pt'
-- on conflict (id) do update set role = excluded.role;
