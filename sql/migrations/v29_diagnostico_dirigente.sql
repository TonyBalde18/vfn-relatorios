-- =====================================================================
-- v29 — DIAGNÓSTICO: o dirigente entra no dashboard mas não lê os dados
-- =====================================================================
-- Sintoma (25/10/2026): ao entrar como dirigente aparece "Não foi possível ler: players" e ficam vazios o
-- plantel, a convocatória, as presenças, os relatórios e o histórico. No repositório (schema.sql) o dirigente
-- lê essas tabelas através de public.vfn_is_staff() — por isso o problema deve estar no que está no Supabase.
--
-- SÓ LEITURA: nada é alterado. Correr cada bloco à parte no SQL Editor (o editor só mostra o resultado da
-- última consulta de cada execução) e mandar os resultados.
-- =====================================================================

-- 1) Contas com papel na tabela profiles (o valor de role tem de ser exatamente 'dirigente', sem espaços nem maiúsculas)
select p.id, '[' || p.role || ']' as role_exato, p.full_name, u.email
from public.profiles p
left join auth.users u on u.id = p.id
order by p.role, u.email;

-- 2) A função vfn_is_staff() que está mesmo no Supabase (deve ter 'admin', 'treinador', 'dirigente')
select pg_get_functiondef('public.vfn_is_staff()'::regprocedure) as vfn_is_staff,
       pg_get_functiondef('public.vfn_role()'::regprocedure) as vfn_role;

-- 3) Políticas (RLS) das tabelas que o dirigente não consegue ler
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('players', 'attendance', 'sessions', 'squads', 'match_reports', 'fines', 'staff')
order by tablename, policyname;

-- 4) Simular a sessão do dirigente: substitui o UUID abaixo pelo id da conta do dirigente (coluna id do passo 1).
--    Mostra o papel visto pela base de dados e quantas linhas consegue ler; se der erro, manda a mensagem do erro.
--    O rollback no fim garante que nada fica alterado.
begin;
select set_config('request.jwt.claims', json_build_object('sub', 'COLOCAR-AQUI-O-UUID-DO-DIRIGENTE', 'role', 'authenticated')::text, true);
set local role authenticated;
select public.vfn_role() as papel, public.vfn_is_staff() as e_staff,
       (select count(*) from public.players) as players,
       (select count(*) from public.attendance) as presencas,
       (select count(*) from public.squads) as convocatorias,
       (select count(*) from public.match_reports) as relatorios;
rollback;
