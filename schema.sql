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

-- [v4 Tarefa 3] Taça 2ª Liga FDM por eliminatórias
-- phase: '1eliminatoria', 'oitavos', 'quartos', 'meias', 'final' (a jornada guarda o nº da fase: 1 a 5)
alter table public.league_results add column if not exists phase text;
alter table public.league_results drop constraint if exists league_results_phase_check;
alter table public.league_results add constraint league_results_phase_check
  check (phase is null or phase in ('1eliminatoria', 'oitavos', 'quartos', 'meias', 'final'));
alter table public.league_results add column if not exists winner_id text references public.teams(id);
update public.league_results set phase = '1eliminatoria' where competition = 'Taça 2ª Liga FDM' and phase is null;
-- jogos do VFN na taça: a fase vem do nº da jornada; o vencedor só é preciso quando há empate (penáltis)
alter table public.matches add column if not exists winner_id text references public.teams(id);

-- [v4 Tarefa 5] Calendário mensal: hora e local dos treinos; vista pública só com
-- data, tipo, hora e local (as notas das sessões continuam só para a equipa técnica)
alter table public.sessions add column if not exists start_time time;
alter table public.sessions add column if not exists location text;
create or replace view public.sessions_public as
select id, session_date, session_type, start_time, location from public.sessions;
grant select on public.sessions_public to anon, authenticated;

-- [v4 Tarefa 6] Capitão do jogo (automático: Toneca → Silvestre → Marco → Macedo)
alter table public.match_reports add column if not exists captain_id text references public.players(id) on delete set null;

-- [v4 Tarefa 2] Joia mensal automática (tipo 1) para todo o plantel, no dia 1 de cada mês
-- às 8h (UTC), a partir de outubro de 2026. Não duplica: salta quem já tem a joia desse mês
-- (também as lançadas com o botão "Lançar Joia do Mês" no admin).
-- O pg_cron existe em todos os planos do Supabase; se a linha seguinte der erro de permissões,
-- ativa-o em Database → Extensions (pg_cron) e corre o resto. Sem pg_cron, usa o botão no admin.
create extension if not exists pg_cron;

create or replace function public.vfn_lancar_joia_mensal() returns integer
language plpgsql security definer set search_path = public as $$
declare
  inicio date := date_trunc('month', current_date)::date;
  tipo record;
  n integer;
begin
  if inicio < date '2026-10-01' then return 0; end if;
  select id, name, amount into tipo from public.fine_types where id = 1;
  if not found then return 0; end if;
  insert into public.fines (player_id, infraction_type, fine_type_id, amount, match_date, description, paid)
  select p.id, tipo.name, tipo.id, tipo.amount, inicio, 'Joia mensal', false
  from public.players p
  where not exists (
    select 1 from public.fines f
    where f.player_id = p.id
      and (f.fine_type_id = 1 or f.infraction_type = tipo.name)
      and f.match_date >= inicio and f.match_date < (inicio + interval '1 month')
  );
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.vfn_lancar_joia_mensal() from public, anon, authenticated;

-- (re)agenda o job; correr de novo substitui o job com o mesmo nome
select cron.schedule('vfn-joia-mensal', '0 8 1 * *', 'select public.vfn_lancar_joia_mensal();');

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

-- =====================================================================
-- ATUALIZAÇÃO 03/10/2026 (v5) — correr esta secção antes do deploy v5
-- Fica depois do bloco RLS de propósito: esse bloco apaga as políticas
-- das tabelas principais e as políticas novas abaixo têm de sobreviver.
-- =====================================================================

-- [v5 Tarefa 1] Taças: o jogo tem fase; a jornada deixa de ser obrigatória (fica a null)
alter table public.matches add column if not exists phase text;
alter table public.matches drop constraint if exists matches_phase_check;
alter table public.matches add constraint matches_phase_check
  check (phase is null or phase in ('1eliminatoria', 'oitavos', 'quartos', 'meias', 'final'));
alter table public.league_results alter column jornada drop not null;
-- jogos do VFN na Taça FDM gravados na v4 com a fase no nº da jornada (1..5) passam para a coluna phase
update public.matches
set phase = (array['1eliminatoria', 'oitavos', 'quartos', 'meias', 'final'])[jornada], jornada = null
where competition = 'Taça 2ª Liga FDM' and phase is null and jornada between 1 and 5;

-- [v5 Tarefa 1 · Bug 3] Vilar Formoso vs VFN na Taça 2ª Liga FDM: 1ª eliminatória
-- (id Zerozero 6838; o jogo antigo pode só ter o nome do adversário escrito)
update public.matches
set phase = '1eliminatoria', jornada = null
where competition = 'Taça 2ª Liga FDM'
  and (opponent_team_id = '6838' or opponent ilike '%vilar formoso%')
  and phase is null;

-- [v5 Tarefa 2] Taça de Honra Comunilog passa a eliminatórias (bracket, sem tabela classificativa).
-- Fases: '1eliminatoria', 'oitavos', 'quartos', 'meias', 'final'. Os jogos já existentes são da
-- 1ª eliminatória; as equipas isentas entram nos oitavos quando o sorteio for lançado.
update public.league_results set phase = '1eliminatoria', jornada = null
where competition = 'Taça de Honra Comunilog' and phase is null;
update public.matches set phase = '1eliminatoria', jornada = null
where competition = 'Taça de Honra Comunilog' and phase is null;

-- [v5 Tarefa 3] Equipas: nome completo, cores (cards, camisola, bracket, forma) e estádio
alter table public.teams add column if not exists full_name text;
alter table public.teams add column if not exists color_primary text;
alter table public.teams add column if not exists color_secondary text;
alter table public.teams add column if not exists stadium text;

update public.teams set full_name = 'Sport Gonçalense',        color_primary = '#328e24', color_secondary = '#ffffff' where id = '8063';
update public.teams set full_name = 'ACDR Freixo de Numão',    color_primary = '#023c85', color_secondary = '#eddcb1' where id = '11082';
update public.teams set full_name = 'GDS Póvoa do Mileu',      color_primary = '#040d18', color_secondary = '#f9e18c' where id = '6306';
update public.teams set full_name = 'GD Vila Nova de Foz Côa', color_primary = '#1a9a53', color_secondary = '#ffffff' where id = '6846';
update public.teams set full_name = 'Seia FC',                 color_primary = '#ae9b63', color_secondary = '#ffffff' where id = '16479';
update public.teams set full_name = 'Paços da Serra',          color_primary = '#03490a', color_secondary = '#ffffff' where id = '11073';
update public.teams set full_name = 'Casal Cinza',             color_primary = '#0b22eb', color_secondary = '#fff900' where id = '11085';
update public.teams set full_name = 'UFC Arcozelo',            color_primary = '#003b73', color_secondary = '#ffffff' where id = '6840';
update public.teams set full_name = 'CCR Vila Verde',          color_primary = '#a62f33', color_secondary = '#ffffff' where id = '338084';
update public.teams set full_name = 'Palmares FC',             color_primary = '#000000', color_secondary = '#43fa00' where id = '391027';

update public.teams set full_name = 'Associação Desportiva de São Romão',          color_primary = '#fdfd06', color_secondary = '#ffffff' where id = '8062';
update public.teams set full_name = 'Ginásio Clube Figueirense',                   color_primary = '#c3093a', color_secondary = '#003daf' where id = '5668';
update public.teams set full_name = 'ADRC Aguiar da Beira',                        color_primary = '#0035b9', color_secondary = '#ffffff' where id = '3546';
update public.teams set full_name = 'Clube de Futebol Os Vilanovenses',            color_primary = '#003daf', color_secondary = '#fe0000' where id = '10485';
update public.teams set full_name = 'Associação Desportiva de Fornos de Algodres', color_primary = '#feed01', color_secondary = '#387e40' where id = '3583';
update public.teams set full_name = 'Associação Desportiva de Manteigas',          color_primary = '#f5d425', color_secondary = '#000000' where id = '6837';
update public.teams set full_name = 'CCDRC Vila Cortez do Mondego',                color_primary = '#e40002', color_secondary = '#ffffff' where id = '6845';
update public.teams set full_name = 'Sporting Clube Celoricense',                  color_primary = '#6b9856', color_secondary = '#ffffff' where id = '11074';
update public.teams set full_name = 'AD Belmonte',                                 color_primary = '#0000ff', color_secondary = '#ffffff' where id = '12268';

-- equipas novas da 1ª Divisão Cima-Tavfer (logos em assets/opponents/<id>.png)
insert into public.teams (id, name, full_name, city, color_primary, color_secondary, logo_url) values
  ('6836', 'SC Sabugal',    'Sporting Clube do Sabugal',       'Sabugal',       '#487a5f', '#ffffff', 'https://tonybalde18.github.io/vfn-relatorios/assets/opponents/6836.png'),
  ('4344', 'CD Gouveia',    'Clube Desportivo de Gouveia',     'Gouveia',       '#663366', '#ffffff', 'https://tonybalde18.github.io/vfn-relatorios/assets/opponents/4344.png'),
  ('6839', 'Trancoso',      'Grupo Desportivo de Trancoso',    'Trancoso',      '#e21c22', '#ffffff', 'https://tonybalde18.github.io/vfn-relatorios/assets/opponents/6839.png'),
  ('6843', 'Pinhelenses',   'União Desportiva Os Pinhelenses', 'Pinhel',        '#00b0f0', '#fff212', 'https://tonybalde18.github.io/vfn-relatorios/assets/opponents/6843.png'),
  ('6838', 'Vilar Formoso', 'Sporting Clube Vilar Formoso',    'Vilar Formoso', '#017c4d', '#ffffff', 'https://tonybalde18.github.io/vfn-relatorios/assets/opponents/6838.png'),
  ('6841', 'Sp. Mêda',      'Sporting Clube de Mêda',          'Mêda',          '#00923f', '#fff500', 'https://tonybalde18.github.io/vfn-relatorios/assets/opponents/6841.png')
on conflict (id) do update set
  full_name = excluded.full_name,
  city = excluded.city,
  color_primary = excluded.color_primary,
  color_secondary = excluded.color_secondary,
  logo_url = excluded.logo_url;

-- [v5 Tarefa 5] Jogadores externos: foto (assets/external/<id>.jpg por omissão) e número da camisola
alter table public.external_players add column if not exists photo_url text;
alter table public.external_players add column if not exists number integer;

-- [v5 Tarefa 6] Contas dos jogadores (equipa.html)
-- Nota: a ligação usa a coluna nova players.auth_user_id e NÃO players.user_id, porque o admin
-- reescreve user_id com o seu próprio id sempre que sincroniza o plantel (e a política de escrita
-- do admin depende disso). Fluxo:
--   1. Supabase → Authentication → Invite user (email do jogador)
--   2. No admin (ficha do jogador) preencher "Email da conta" com o mesmo email
--   3. No primeiro login em equipa.html a conta liga-se sozinha (vfn_ligar_minha_conta);
--      ou liga já à mão:  select public.vfn_ligar_jogador('<id do jogador>', '<email>');
alter table public.players add column if not exists email text;
alter table public.players add column if not exists auth_user_id uuid references auth.users(id) on delete set null;
create unique index if not exists players_auth_user_idx on public.players (auth_user_id) where auth_user_id is not null;

create or replace function public.vfn_player_id() returns text
language sql stable security definer set search_path = public as $$
  select id from public.players where auth_user_id = auth.uid() limit 1
$$;

create or replace function public.vfn_is_player() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.players where auth_user_id = auth.uid())
$$;

-- o jogador liga a própria conta no primeiro login (email da conta = players.email)
create or replace function public.vfn_ligar_minha_conta() returns text
language plpgsql security definer set search_path = public as $$
declare pid text;
begin
  select id into pid from public.players where auth_user_id = auth.uid() limit 1;
  if pid is not null then return pid; end if;
  update public.players set auth_user_id = auth.uid()
  where auth_user_id is null and email is not null and lower(email) = lower(auth.email())
  returning id into pid;
  return pid;
end $$;
revoke all on function public.vfn_ligar_minha_conta() from public, anon;
grant execute on function public.vfn_ligar_minha_conta() to authenticated;

-- ligação manual pelo admin (no SQL Editor ou por rpc)
create or replace function public.vfn_ligar_jogador(p_player_id text, p_email text) returns boolean
language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  if auth.uid() is not null and not public.vfn_is_admin() then raise exception 'Só o admin pode ligar contas'; end if;
  select id into uid from auth.users where lower(email) = lower(p_email);
  if uid is null then return false; end if;
  update public.players set auth_user_id = uid, email = p_email where id = p_player_id;
  return found;
end $$;
revoke all on function public.vfn_ligar_jogador(text, text) from public, anon;
grant execute on function public.vfn_ligar_jogador(text, text) to authenticated;

-- Plantel para jogadores: sem atributos, notas, email nem ids de autenticação dos outros.
-- e_eu = true na linha do próprio jogador. Só devolve linhas a jogadores e staff.
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
  coalesce(auth_user_id = auth.uid(), false) as e_eu
from public.players
where public.vfn_is_player() or public.vfn_is_staff();
revoke all on public.players_equipa from anon;
grant select on public.players_equipa to authenticated;

-- Jogadores autenticados (conta ligada) leem multas, presenças, sessões, equipa técnica,
-- tipos de multa e relatórios publicados (só leitura; escrever continua só para o admin)
drop policy if exists "Players read fines" on public.fines;
drop policy if exists "Players read attendance" on public.attendance;
drop policy if exists "Players read sessions" on public.sessions;
drop policy if exists "Players read reports published" on public.match_reports;
drop policy if exists "Players read staff" on public.staff;
drop policy if exists "Players read fine_types" on public.fine_types;
create policy "Players read fines" on public.fines for select to authenticated using (public.vfn_is_player());
create policy "Players read attendance" on public.attendance for select to authenticated using (public.vfn_is_player());
create policy "Players read sessions" on public.sessions for select to authenticated using (public.vfn_is_player());
create policy "Players read reports published" on public.match_reports for select to authenticated
  using ((status = 'published' and public.vfn_is_player()) or public.vfn_is_admin());
create policy "Players read staff" on public.staff for select to authenticated using (public.vfn_is_player());
create policy "Players read fine_types" on public.fine_types for select to authenticated using (public.vfn_is_player());
-- Treinador: Authentication → Invite user e depois o bloco "2. TREINADOR" no fim deste ficheiro.

-- [v5 Tarefa 7] Marcadores do VFN por competição (página pública): gravados no jogo do calendário
-- quando o relatório é gerado ou publicado. Formato igual a league_results.scorer_list:
-- [{"player_id": "872514", "player_name": "Toneca", "team_id": "<id do VFN>", "count": 1}]
alter table public.matches add column if not exists scorer_list jsonb;

-- [v5 Tarefa 8] Convocatórias: 18–23 convocados, onze inicial (por posição), suplentes, capitão e formação
create table if not exists public.squads (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references public.matches(id) on delete cascade,
  player_ids text[],           -- todos os convocados
  lineup text[],               -- onze inicial (por ordem de posição)
  subs text[],                 -- suplentes
  captain_id text references public.players(id) on delete set null,
  formation text default '4-3-3',
  published boolean default false,
  created_at timestamptz not null default now()
);
create unique index if not exists squads_match_idx on public.squads (match_id);
alter table public.squads enable row level security;
drop policy if exists "Staff manages squads" on public.squads;
drop policy if exists "Players read published squads" on public.squads;
create policy "Staff manages squads" on public.squads for all to authenticated
  using (public.vfn_is_admin() or public.vfn_is_staff()) with check (public.vfn_is_admin() or public.vfn_is_staff());
create policy "Players read published squads" on public.squads for select to authenticated
  using (published = true and public.vfn_is_player());

-- =====================================================================
-- ATUALIZAÇÃO 03/10/2026 (v6) — correr esta secção antes do deploy v6
-- (depois da secção v5; idempotente)
-- =====================================================================

-- [v6 Tarefa 2] Convocatória em dois momentos: 'lista' (só os convocados) e 'completa'
-- (onze inicial, suplentes, formação, capitão e concentração)
alter table public.squads add column if not exists concentration_time time;
alter table public.squads add column if not exists concentration_location text;
alter table public.squads add column if not exists squad_status text default 'lista';
alter table public.squads drop constraint if exists squads_squad_status_check;
alter table public.squads add constraint squads_squad_status_check check (squad_status in ('lista', 'completa'));
-- convocatórias v5 que já tinham onze passam a 'completa'
update public.squads set squad_status = 'completa' where squad_status = 'lista' and coalesce(array_length(lineup, 1), 0) = 11;

-- [v6 Tarefa 3] Estádio automático nos jogos: coordenadas do estádio de cada equipa (mapa e meteorologia)
alter table public.teams add column if not exists stadium_lat double precision;
alter table public.teams add column if not exists stadium_lng double precision;

-- VFN: Estádio do Picoto (cria o registo do VFN em teams se ainda não existir)
insert into public.teams (id, name, city, logo_url)
select 'vfn', 'ACD Vila Franca das Naves', 'Vila Franca das Naves', 'https://tonybalde18.github.io/vfn-relatorios/assets/logo.png'
where not exists (select 1 from public.teams where name ilike '%vila franca%');
update public.teams set stadium = 'Estádio do Picoto', stadium_lat = 40.7277, stadium_lng = -7.2645
where name ilike '%vila franca%';

-- Coordenadas aproximadas por localidade (ajustáveis na ficha da equipa, no admin).
-- Só preenche quem ainda não tem coordenadas, para não apagar ajustes feitos na app.
update public.teams t set stadium_lat = v.lat, stadium_lng = v.lng
from (values
  ('8063', 40.5669, -7.4506),  -- Gonçalense
  ('11082', 40.8976, -7.0823), -- Freixo de Numão
  ('6306', 40.5200, -7.4400),  -- Mileu Guarda
  ('6846', 41.0833, -7.1500),  -- GD Foz Côa
  ('16479', 40.4167, -7.7000), -- Seia FC
  ('11073', 40.4300, -7.6300), -- Paços da Serra
  ('11085', 40.5200, -7.3800), -- Casal Cinza
  ('6840', 40.5550, -7.4600),  -- UFC Arcozelo
  ('338084', 40.3700, -7.6400),-- CCR Vila Verde
  ('391027', 40.8200, -6.9800),-- Palmares FC
  ('6839', 40.7790, -7.3490),  -- Trancoso (corrigido: o valor do pedido, 40.36/-7.10, é o Sabugal)
  ('6836', 40.3520, -7.0900),  -- SC Sabugal (corrigido: o valor do pedido, 40.77/-7.10, não é o Sabugal)
  ('4344', 40.4964, -7.5919),  -- CD Gouveia
  ('6843', 40.7800, -7.0200),  -- Pinhelenses
  ('6838', 40.6000, -6.8400),  -- Vilar Formoso
  ('6841', 40.9500, -7.2600),  -- Sp. Mêda
  ('6845', 40.5300, -7.1000),  -- Vila Cortez
  ('8062', 40.5450, -7.4250),  -- AD São Romão
  ('5668', 40.8800, -6.9600),  -- Ginásio Figueirense
  ('3546', 40.6700, -7.5500),  -- Aguiar da Beira
  ('10485', 40.4900, -7.5600), -- Os Vilanovenses
  ('3583', 40.5900, -7.5400),  -- Fornos de Algodres
  ('6837', 40.3900, -7.5300),  -- Manteigas
  ('11074', 40.5600, -7.4700)  -- SC Celoricense
) as v(id, lat, lng)
where t.id = v.id and t.stadium_lat is null;

-- [v6 Tarefa 6] Situações de jogo nos relatórios: imagens no bucket privado report-images.
-- Formato: [{"path": "<match_id>/<ficheiro>", "caption": "Pressing alto no 1º tempo", "order": 1}]
-- (o bucket é privado, por isso guarda-se o caminho e as páginas pedem URLs assinados de 1 hora;
--  as situações ficam também em match_data.analise.situacoes)
alter table public.match_reports add column if not exists situations jsonb;

-- bucket privado (equivale a Storage → New bucket "report-images", sem "Public bucket")
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('report-images', 'report-images', false, 8388608, array['image/png', 'image/jpeg', 'image/svg+xml'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "report-images read" on storage.objects;
drop policy if exists "report-images admin insert" on storage.objects;
drop policy if exists "report-images admin update" on storage.objects;
drop policy if exists "report-images admin delete" on storage.objects;
-- lê: equipa técnica, dirigentes e jogadores com conta ligada (quem vê os relatórios)
create policy "report-images read" on storage.objects for select to authenticated
  using (bucket_id = 'report-images' and (public.vfn_is_staff() or public.vfn_is_player()));
-- escreve: só o admin
create policy "report-images admin insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'report-images' and public.vfn_is_admin());
create policy "report-images admin update" on storage.objects for update to authenticated
  using (bucket_id = 'report-images' and public.vfn_is_admin());
create policy "report-images admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'report-images' and public.vfn_is_admin());

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
