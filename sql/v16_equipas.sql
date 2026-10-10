-- =========================================================
-- v16: equipas (correr no SQL Editor do Supabase)
-- =========================================================

-- Kit do adversário (editor no admin → Adversários → equipa → 🎽 Kit)
-- { padrao, cor1, cor2, cor3, cor_calcoes, cor_meias }
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS kit_config JSONB DEFAULT '{}';
