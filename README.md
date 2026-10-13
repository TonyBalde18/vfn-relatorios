# VFN — Hub do ACD Vila Franca das Naves

Aplicação web estática (GitHub Pages + Supabase) do ACD Vila Franca das Naves, 2ª Distrital da Guarda: relatórios táticos, gestão do plantel, dashboard da equipa técnica e página pública para os atletas.

## Páginas

| Página | Quem usa | Acesso |
|---|---|---|
| `index.html` | Tony (admin) | Login. Relatório de jogo e gestão (multas, presenças, calendário, classificação, adversários) |
| `dashboard.html` | Treinador e dirigentes | Login. Hub, plantel, estatísticas e calendário (só leitura) |
| `equipa.html` | Jogadores (e equipa técnica) | Login. Calendário, convocatória, multas, presenças, estatísticas, disponibilidade e relatórios publicados (só leitura) |
| `public.html` | Público | Sem login. Próximo jogo, forma, plantel, classificação da 2ª Liga, jornadas, calendário e marcadores (liga e taças) |

## Ficheiros

```
/                    páginas (ficam na raiz: links partilhados, convites e PWA apontam para aqui)
├── index.html       admin: relatório de jogo e gestão
├── dashboard.html   equipa técnica (só leitura)
├── equipa.html      Área do Jogador
├── public.html      página pública
├── entrada.html     arranque da app instalada: encaminha pelo papel da sessão
├── manifest.json · sw.js   PWA (o service worker tem de estar na raiz)
├── css/
│   ├── styles.css   base, admin e componentes (+ bloco do tema escuro gerado)
│   └── hub.css      extra das páginas do hub (dashboard, equipa, pública)
├── js/
│   ├── config.js    URL e chave anon do Supabase
│   ├── core/        partilhados por várias páginas, cada um num namespace global
│   │   ├── shared.js      VFN: utilitários base (datas, competições, posições, multas, avatares, tema, Supabase)
│   │   ├── hub.js         VFNHub: componentes de leitura (resultados, classificação, 11, calendário, H2H…)
│   │   ├── components.js  VFNComp: componentes interativos (cards, comparador, mapa, kits, PDF…)
│   │   └── relatorio.js   VFNRelatorio: relatório de jogo (HTML, Word, situações)
│   ├── admin/       index.html (scripts clássicos que partilham globais; app.js tem de vir primeiro)
│   │   ├── app.js         estado do relatório, camada de dados, plantel, pré-jogo, jogo, análise, Word, login
│   │   ├── admin.js       separadores de gestão (multas, presenças, convocatória, calendário…)
│   │   └── modo-jogo.js   Modo Jogo (cronómetro e eventos ao vivo)
│   └── pages/       dashboard.js · equipa.js · public.js (um por página)
├── sql/             ver sql/README.md (schema base, migrações e seeds, pela ordem de execução)
├── tools/           tema-escuro.js (gera o bloco escuro: node tools/tema-escuro.js css/styles.css css/hub.css)
│                    auditoria/ (verificação das páginas e do código antes de cada versão; ver o README lá dentro)
└── assets/          logo, players/, opponents/ (+ kits/), stadiums/, icons/, sponsors/, kits/, staff/, external/
```

Os caminhos para `assets/` no JS são relativos à página (na raiz). Ao mudar um JS/CSS, sobe o `?v=` nas páginas e o `VERSAO` no `sw.js`.

## Configuração Supabase

1. No SQL Editor, corre **todo** o `sql/schema.sql` e depois o resto pela ordem do [`sql/README.md`](sql/README.md). É idempotente: completa as tabelas existentes, cria `profiles`, `opponents`, `sessions` e a view `players_public`, e substitui as políticas RLS destas tabelas.
2. No fim do ficheiro, descomenta o bloco **1. ADMIN**, põe o teu email e corre-o. **Sem isto o `index.html` deixa de conseguir gravar.**
3. Em Authentication > Users cria as contas do treinador e dos dirigentes e atribui-lhes o papel com o bloco **2** do `sql/schema.sql`.
4. Confirma que `js/config.js` tem o Project URL e a anon key (Settings > API):

```js
const SUPABASE_URL = 'https://o-teu-projeto.supabase.co';
const SUPABASE_ANON_KEY = 'a-tua-chave-anon';
```

### Atualização v6 (03/10/2026)

1. No SQL Editor corre a secção **"ATUALIZAÇÃO 03/10/2026 (v6)"** do `sql/schema.sql` (depois da v5). Cria as colunas novas (convocatória em dois momentos, coordenadas dos estádios, situações dos relatórios), o **bucket privado `report-images`** e as políticas de Storage.
2. Se o `insert into storage.buckets` der erro de permissões, cria o bucket à mão: Storage → New bucket → `report-images`, **sem** "Public bucket"; depois corre só as políticas.
3. As coordenadas dos estádios são aproximadas: ajusta-as na ficha de cada equipa (admin → Adversários), em Latitude/Longitude.
4. Bibliotecas novas por CDN: Leaflet (mapa, tiles OpenStreetMap), D3 (bracket) e a API Open-Meteo (meteorologia), todas sem chave.

### Contas dos jogadores (equipa.html)

0. Uma vez: Supabase → Authentication → URL Configuration: **Site URL** = `https://tonybalde18.github.io/vfn-relatorios/` e, em **Redirect URLs**, acrescentar `https://tonybalde18.github.io/vfn-relatorios/equipa.html`. O convite chega ao Site URL e o `index.html` reencaminha-o para `equipa.html`, onde o jogador define a password.
1. Supabase → Authentication → **Invite user** com o email do jogador.
2. No admin, na ficha do jogador, preenche **Email da conta** com o mesmo email.
3. O jogador abre o link do convite, define a password e entra em `equipa.html`; a conta liga-se sozinha ao jogador (`players.auth_user_id`). Sem email na ficha, vê um ecrã de boas-vindas até o admin o indicar.

### Papéis e permissões

| | Anónimo (public) | Treinador / Dirigente | Admin |
|---|---|---|---|
| Jogos, classificação, equipas | lê | lê | lê e escreve |
| Plantel | só `players_public` (sem atributos nem notas) | lê | lê e escreve |
| Multas, presenças, sessões, observação de adversários | — | lê | lê e escreve |
| Relatórios e rascunhos | — | lê relatórios | os seus |

### Estatísticas dos jogadores

As estatísticas vivem em `players.stats` (jsonb). No separador Jogo, golos, assistências e cartões atualizam o plantel automaticamente; jogos e minutos são somados ao gerar o relatório Word, que também grava o resultado no jogo do calendário associado ("Usar dados deste jogo" no Pré-Jogo).

### Fotografias dos jogadores

No Supabase Dashboard, abre **Storage > New bucket**, cria o bucket `player-photos` e marca-o como público. A aplicação usa o bucket para os uploads do admin (fotos e emblemas) e guarda o URL público em `players.photo_url`.

As políticas do bucket estão em `sql/migrations/v23_player_photos_admin.sql`: só o admin carrega e substitui ficheiros; a leitura é pelo URL público (sem listagem, ver `v22_security_advisor.sql`).

## Testar localmente

A app usa `fetch` para o logo e CDNs para Supabase/docx. Usa um servidor HTTP:

```bash
npx http-server -p 8000
```

Sem credenciais reais em `js/config.js`, o botão **Entrar em modo local** permite testar a interface com `localStorage`. Com credenciais configuradas, o login é obrigatório e os dados ficam isolados por utilizador através de RLS.

## Funcionalidades

- Competições: `2ª LIGA FUTEBOL ZERO GRAUS PRODUÇÕES`, `TAÇA 2ª LIGA - FDM`, `TAÇA DE HONRA COMUNILOG` e `Amigável`.
- Rascunho Supabase a cada 30 segundos, ao trocar de tab e no botão manual **Guardar Rascunho**. O rascunho pendente é apresentado após login.
- Eventos com jogadores em campo, substituição única `Sai`/`Entra`, tempo acrescentado e scoreboard calculado automaticamente.
- Linha do tempo horizontal na app e vertical no Word, com VFN à esquerda e adversário à direita.
- Análise com cinco avaliações táticas e campos de texto livre para síntese e treino.
- Tab Equipa com foto (ou camisola com o número), dados biográficos, stats, atributos 0–10, mapa de posições, modal estilo Zerozero/FIFA e sumários.
- Multas por mês com resumo pendente/arrecadado e marcação de pagamento; presenças numa grelha mensal (P/F/A/J) com totais.
- Calendário, classificação e adversários (logos e observação) geridos no admin e mostrados no dashboard e na página pública.
- O modo local (sem Supabase) guarda também multas, presenças, calendário, classificação e adversários no `localStorage`.

## GitHub Pages

1. Faz commit de todos os ficheiros, incluindo a pasta `assets/`.
2. Publica o ramo `main` em Settings > Pages > Deploy from branch.
3. Usa HTTPS e confirma que `js/config.js` contém apenas a chave **anon**. Nunca publiques a service role key.

## Telemóvel/tablet no estádio

Abre o URL do GitHub Pages no browser do dispositivo e adiciona-o ao ecrã inicial. É necessária ligação à internet para login, Supabase e CDNs. O modo local funciona sem conta, mas não sincroniza entre dispositivos.

## Backup

No Supabase Dashboard, usa Table Editor > Export ou `pg_dump` para exportar as tabelas (`players`, `teams`, `matches`, `standings`, `opponents`, `attendance`, `sessions`, `fines`, `match_reports`, `draft`). Mantém também o botão de exportação JSON da equipa (admin → Equipa) como cópia rápida.
