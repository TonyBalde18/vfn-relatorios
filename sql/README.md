# SQL do VFN Hub

Tudo corre à mão no **SQL Editor do Supabase**. A app nunca altera o schema. Os ficheiros são idempotentes: podem correr-se de novo sem estragar nada, exceto quando o ficheiro avisa o contrário.

## Ordem de execução (base de dados de raiz)

| # | Ficheiro | O quê | Estado (13/10/2026) |
|---|---|---|---|
| 1 | `schema.sql` | Schema cumulativo v1–v7: tabelas, RLS, views públicas, funções, buckets, joia mensal. Organizado por secções datadas; correr **todo**, por ordem. No fim: blocos para dar o papel ao admin, treinador e dirigentes. | aplicado |
| 2 | `seeds/seed_v7.sql` | Coordenadas, nomes dos estádios e relvado das 27 equipas (depois da secção v7 do schema). | aplicado |
| 3 | `migrations/h2h.sql` | Tabela `h2h` (histórico de confrontos), RLS e dados das épocas anteriores. | aplicado |
| 4 | `migrations/v16_equipas.sql` | `teams.kit_config`, `division`, `district` (editor de kits, filtro do mapa). | aplicado |
| 5 | `migrations/h2h_2.sql` | Mais confrontos e o trigger `vfn_h2h_do_jogo` (copia os jogos da época para o `h2h`). Depois do `h2h.sql`. | aplicado |
| 6 | `migrations/v18_onze_publico.sql` | View `onze_jogos` (11 mais utilizado na página pública). | aplicado |
| 7 | `migrations/v19_multas_staff.sql` | `fines.staff_id`: multas da equipa técnica. | aplicado |
| 8 | `migrations/v20_multas_jogadores.sql` | Jogadores leem as multas de toda a equipa. | aplicado |
| 9 | `migrations/v21_views_grants.sql` | Views públicas e `players_equipa` só de leitura. | aplicado |
| 10 | `migrations/v22_security_advisor.sql` | Avisos do Security Advisor (funções, trigger, bucket de fotos). | aplicado |
| 11 | `migrations/v23_player_photos_admin.sql` | Bucket `player-photos`: só o admin carrega ficheiros. | aplicado |
| 12 | `migrations/v24_migracoes_em_comentarios.sql` | **Documentação**: migrações que estavam em comentários do JS (lineup_slots, sub-posições…), com o estado de cada uma e uma consulta de verificação. | 1, 2 e 5 aplicados; 3 e 4 por confirmar |

## Convenções

- Uma migração nova = um ficheiro `migrations/vNN_tema.sql`, com um cabeçalho que diz o que faz, porquê e se é preciso correr outro antes.
- Views novas: `revoke all ... from anon, authenticated;` antes do `grant select` (o Supabase dá escrita por omissão — ver v21).
- SQL em comentários no JS só para explicar; a migração em si vai sempre para um ficheiro aqui.
- A chave service role nunca entra no repositório.
