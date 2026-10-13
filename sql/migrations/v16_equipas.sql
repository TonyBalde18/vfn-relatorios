-- =========================================================
-- v16: equipas (correr no SQL Editor do Supabase)
-- =========================================================

-- Kit do adversário (editor no admin → Adversários → equipa → 🎽 Kit)
-- { padrao, cor1, cor2, cor3, cor_calcoes, cor_meias }
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS kit_config JSONB DEFAULT '{}';

-- Filtro do mapa dos estádios: divisão e distrito de cada equipa
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS division TEXT;   -- '2ª Liga', '1ª Liga', ...
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS district TEXT;   -- 'Guarda', 'Castelo Branco', ...

-- Distrito de Castelo Branco: ADE (AD Estação, Covilhã), UD Belmonte e SC Covilhã
UPDATE public.teams SET district = 'Castelo Branco'
WHERE name ILIKE '%Estação%' OR name ILIKE '%Belmonte%' OR name ILIKE '%Covilhã%';

-- (Opcional) Atalhos para preencher o resto — rever depois no Table Editor:
-- todas as outras equipas no distrito da Guarda
-- UPDATE public.teams SET district = 'Guarda' WHERE district IS NULL;
-- 2ª Liga: as equipas que aparecem nos resultados da 2ª Liga
-- UPDATE public.teams t SET division = '2ª Liga'
-- WHERE division IS NULL AND EXISTS (SELECT 1 FROM public.league_results r
--   WHERE r.competition ILIKE '2ª Liga%' AND (r.home_team_id = t.id OR r.away_team_id = t.id));
