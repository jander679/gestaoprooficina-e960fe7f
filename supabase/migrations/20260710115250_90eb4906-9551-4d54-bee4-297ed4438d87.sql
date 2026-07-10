
-- === Extensões para agendamento ===
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- === Enum de tipo de veículo (FIPE) ===
DO $$ BEGIN
  CREATE TYPE public.fipe_vehicle_type AS ENUM ('cars','motorcycles','trucks');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- === Tabelas FIPE ===
CREATE TABLE IF NOT EXISTS public.fipe_brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo public.fipe_vehicle_type NOT NULL,
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tipo, codigo)
);
GRANT SELECT ON public.fipe_brands TO anon, authenticated;
GRANT ALL ON public.fipe_brands TO service_role;
ALTER TABLE public.fipe_brands ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fipe_brands read" ON public.fipe_brands;
CREATE POLICY "fipe_brands read" ON public.fipe_brands FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.fipe_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.fipe_brands(id) ON DELETE CASCADE,
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (brand_id, codigo)
);
CREATE INDEX IF NOT EXISTS fipe_models_brand_idx ON public.fipe_models(brand_id);
GRANT SELECT ON public.fipe_models TO anon, authenticated;
GRANT ALL ON public.fipe_models TO service_role;
ALTER TABLE public.fipe_models ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fipe_models read" ON public.fipe_models;
CREATE POLICY "fipe_models read" ON public.fipe_models FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.fipe_years (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID NOT NULL REFERENCES public.fipe_models(id) ON DELETE CASCADE,
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  combustivel TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (model_id, codigo)
);
CREATE INDEX IF NOT EXISTS fipe_years_model_idx ON public.fipe_years(model_id);
GRANT SELECT ON public.fipe_years TO anon, authenticated;
GRANT ALL ON public.fipe_years TO service_role;
ALTER TABLE public.fipe_years ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fipe_years read" ON public.fipe_years;
CREATE POLICY "fipe_years read" ON public.fipe_years FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.fipe_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running',
  tipo public.fipe_vehicle_type,
  brands_count INT DEFAULT 0,
  models_count INT DEFAULT 0,
  years_count INT DEFAULT 0,
  error TEXT,
  notes TEXT
);
GRANT SELECT ON public.fipe_sync_log TO authenticated;
GRANT ALL ON public.fipe_sync_log TO service_role;
ALTER TABLE public.fipe_sync_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fipe_sync_log read" ON public.fipe_sync_log;
CREATE POLICY "fipe_sync_log read" ON public.fipe_sync_log FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));

-- === Índices adicionais para relatórios financeiros ===
CREATE INDEX IF NOT EXISTS os_payments_unit_pago_idx ON public.os_payments(unit_id, pago_em DESC);
CREATE INDEX IF NOT EXISTS service_orders_unit_status_idx ON public.service_orders(unit_id, status);

-- === Agendamento mensal para atualizar a FIPE (dia 5 às 03:00) ===
DO $$
DECLARE
  _jobid INT;
BEGIN
  SELECT jobid INTO _jobid FROM cron.job WHERE jobname = 'fipe-monthly-sync';
  IF _jobid IS NOT NULL THEN
    PERFORM cron.unschedule(_jobid);
  END IF;

  PERFORM cron.schedule(
    'fipe-monthly-sync',
    '0 3 5 * *',
    $CRON$
    SELECT net.http_post(
      url := 'https://project--80c68952-dfad-48c2-bf26-721390cda68f.lovable.app/api/public/hooks/fipe-sync',
      headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhxb2pjbnpjcnRrcW1icWV0bHh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2MDg4NjksImV4cCI6MjA5OTE4NDg2OX0.INLhka8-C5C_gkGnLH44HQpIPkWSvMmS5wa-xgXguK4"}'::jsonb,
      body := '{"mode":"incremental"}'::jsonb
    );
    $CRON$
  );
END $$;
