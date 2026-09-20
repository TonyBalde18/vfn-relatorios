# VFN — Relatórios de Jogo

Aplicação web estática para relatórios táticos do ACD Vila Franca das Naves, com autenticação Supabase, rascunho sincronizado, equipa e exportação Word.

## Ficheiros

- `index.html` — login e interface das tabs Pré-Jogo, Jogo, Análise e Equipa.
- `app.js` — estado, eventos, Supabase Auth, sincronização, equipa e Word.
- `config.js` — URL e chave anon do projeto Supabase.
- `styles.css` — layout, cores, estados e animações.
- `logo.png` — logótipo VFN.

## Configuração Supabase

1. Cria um projeto em [supabase.com](https://supabase.com).
2. No SQL Editor, executa o SQL abaixo.
3. Em Authentication > Users, cria os utilizadores com email/password.
4. Copia Project URL e anon key de Settings > API para `config.js`:

```js
const SUPABASE_URL = 'https://o-teu-projeto.supabase.co';
const SUPABASE_ANON_KEY = 'a-tua-chave-anon';
```

O campo `user_id` em `players` é adicional ao conjunto base pedido e é necessário para aplicar RLS por utilizador.

```sql
create extension if not exists "pgcrypto";

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

alter table public.players enable row level security;
alter table public.match_reports enable row level security;
alter table public.draft enable row level security;

create policy "players own rows" on public.players for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "reports own rows" on public.match_reports for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "draft own row" on public.draft for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

### Fotografias dos jogadores

No Supabase Dashboard, abre **Storage > New bucket**, cria o bucket `player-photos` e marca-o como público. A aplicação usa o bucket para uploads autenticados e guarda o URL público em `players.photo_url`.

```sql
create policy "public read player photos"
on storage.objects for select
using (bucket_id = 'player-photos');

create policy "authenticated upload player photos"
on storage.objects for insert to authenticated
with check (bucket_id = 'player-photos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "authenticated update player photos"
on storage.objects for update to authenticated
using (bucket_id = 'player-photos' and auth.uid()::text = (storage.foldername(name))[1]);
```

## Testar localmente

A app usa `fetch` para o logo e CDNs para Supabase/docx. Usa um servidor HTTP:

```bash
npx http-server -p 8000
```

Sem credenciais reais em `config.js`, o botão **Entrar em modo local** permite testar a interface com `localStorage`. Com credenciais configuradas, o login é obrigatório e os dados ficam isolados por utilizador através de RLS.

## Funcionalidades

- Competições: `2ª LIGA FUTEBOL ZERO GRAUS PRODUÇÕES`, `TAÇA 2ª LIGA - FDM`, `TAÇA DE HONRA COMUNILOG` e `Amigável`.
- Rascunho Supabase a cada 30 segundos, ao trocar de tab e no botão manual **Guardar Rascunho**. O rascunho pendente é apresentado após login.
- Eventos com jogadores em campo, substituição única `Sai`/`Entra`, tempo acrescentado e scoreboard calculado automaticamente.
- Linha do tempo horizontal na app e vertical no Word, com VFN à esquerda e adversário à direita.
- Análise com cinco avaliações táticas e campos de texto livre para síntese e treino.
- Tab Equipa com foto, dados biográficos, stats, atributos 0–10, mapa de posições, modal estilo Zerozero/FIFA e sumários.

## GitHub Pages

1. Faz commit de `index.html`, `app.js`, `styles.css`, `config.js`, `logo.png` e `README.md`.
2. Publica o ramo `main` em Settings > Pages > Deploy from branch.
3. Usa HTTPS e confirma que `config.js` contém apenas a chave **anon**. Nunca publiques a service role key.

## Telemóvel/tablet no estádio

Abre o URL do GitHub Pages no browser do dispositivo e adiciona-o ao ecrã inicial. É necessária ligação à internet para login, Supabase e CDNs. O modo local funciona sem conta, mas não sincroniza entre dispositivos.

## Backup

No Supabase Dashboard, usa Table Editor > Export ou `pg_dump` para exportar `players`, `match_reports` e `draft`. Mantém também o botão de exportação JSON da equipa e o exportador de rascunho da app como cópia rápida.
