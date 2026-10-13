-- =========================================================
-- v23: bucket player-photos — só o admin carrega ficheiros (correr no SQL Editor do Supabase)
-- Antes, qualquer conta com login (incluindo jogadores) podia carregar ficheiros para a sua pasta
-- num bucket público (= alojar ficheiros com link aberto). O admin carrega as fotos dos jogadores
-- (app.js) e os emblemas das equipas (admin.js), sempre na pasta com o seu id: isso mantém-se.
-- =========================================================

drop policy if exists "authenticated upload player photos" on storage.objects;
drop policy if exists "authenticated update player photos" on storage.objects;
drop policy if exists "player-photos admin upload" on storage.objects;
drop policy if exists "player-photos admin update" on storage.objects;

create policy "player-photos admin upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'player-photos' and public.vfn_is_admin() and (auth.uid())::text = (storage.foldername(name))[1]);

create policy "player-photos admin update" on storage.objects for update to authenticated
  using (bucket_id = 'player-photos' and public.vfn_is_admin() and (auth.uid())::text = (storage.foldername(name))[1])
  with check (bucket_id = 'player-photos' and public.vfn_is_admin() and (auth.uid())::text = (storage.foldername(name))[1]);

-- verificação: devem aparecer 3 políticas, todas com vfn_is_admin()
select policyname, cmd, roles, qual, with_check from pg_policies
where schemaname = 'storage' and tablename = 'objects' and (qual like '%player-photos%' or with_check like '%player-photos%')
order by cmd;
