-- Criação da tabela de agendamentos
CREATE TABLE IF NOT EXISTS public.appointments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'agendado' CHECK (status IN ('agendado', 'concluido', 'cancelado')),
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
    mecanico_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar Row Level Security
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
CREATE POLICY "Membros da unidade podem ver agendamentos"
    ON public.appointments FOR SELECT
    USING (public.is_member(unit_id, auth.uid()));

CREATE POLICY "Membros da unidade podem inserir agendamentos"
    ON public.appointments FOR INSERT
    WITH CHECK (public.is_member(unit_id, auth.uid()));

CREATE POLICY "Membros da unidade podem atualizar agendamentos"
    ON public.appointments FOR UPDATE
    USING (public.is_member(unit_id, auth.uid()))
    WITH CHECK (public.is_member(unit_id, auth.uid()));

CREATE POLICY "Apenas admins da oficina podem deletar agendamentos"
    ON public.appointments FOR DELETE
    USING (public.has_unit_role(ARRAY['oficina_admin']::public.app_role[], unit_id, auth.uid()));

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at_appointments()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_appointments_updated
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at_appointments();
