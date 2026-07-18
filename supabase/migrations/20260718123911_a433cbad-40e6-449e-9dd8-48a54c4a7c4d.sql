
CREATE TABLE public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'agendado',
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  mecanico_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_appointments_unit_start ON public.appointments(unit_id, start_time);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO authenticated;
GRANT ALL ON public.appointments TO service_role;

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "appt read" ON public.appointments FOR SELECT
  USING (is_super_admin(auth.uid()) OR is_member(auth.uid(), unit_id) OR is_company_admin(auth.uid(), unit_company(unit_id)));

CREATE POLICY "appt write" ON public.appointments FOR ALL
  USING (is_super_admin(auth.uid()) OR is_company_admin(auth.uid(), unit_company(unit_id)) OR has_unit_role(auth.uid(), unit_id, ARRAY['oficina_admin'::app_role, 'mecanico'::app_role, 'recepcionista'::app_role]))
  WITH CHECK (is_super_admin(auth.uid()) OR is_company_admin(auth.uid(), unit_company(unit_id)) OR has_unit_role(auth.uid(), unit_id, ARRAY['oficina_admin'::app_role, 'mecanico'::app_role, 'recepcionista'::app_role]));

CREATE OR REPLACE FUNCTION public.tg_appointments_touch()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER tg_appointments_touch BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.tg_appointments_touch();
