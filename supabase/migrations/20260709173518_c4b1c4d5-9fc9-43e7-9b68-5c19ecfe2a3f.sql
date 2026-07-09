
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('super_admin','oficina_admin','mecanico','recepcionista','financeiro');
CREATE TYPE public.account_status AS ENUM ('pending','approved','rejected','paused','expired');
CREATE TYPE public.os_status AS ENUM ('aberta','em_andamento','aguardando_peca','aguardando_aprovacao','concluida','cancelada');
CREATE TYPE public.payment_method AS ENUM ('dinheiro','pix','credito','debito','boleto','transferencia','outro');
CREATE TYPE public.os_item_type AS ENUM ('servico','peca','descricao_livre');

-- ============ HELPER: updated_at ============
CREATE OR REPLACE FUNCTION public.tg_set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  locale TEXT NOT NULL DEFAULT 'pt-BR',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_profiles_upd BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ SUPER ADMIN roles ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin');
$$;

CREATE POLICY "own roles or super sees all" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));

-- ============ ACCOUNT ACCESS (gate) ============
CREATE TABLE public.account_access (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.account_status NOT NULL DEFAULT 'pending',
  valid_until DATE,
  paused_at TIMESTAMPTZ,
  reason TEXT,
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.account_access TO authenticated;
GRANT ALL ON public.account_access TO service_role;
ALTER TABLE public.account_access ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_aa_upd BEFORE UPDATE ON public.account_access FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE POLICY "self or super reads account_access" ON public.account_access FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));

-- Helper: is access active
CREATE OR REPLACE FUNCTION public.access_active(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.account_access
    WHERE user_id = _user_id
      AND status = 'approved'
      AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)
  ) OR public.is_super_admin(_user_id);
$$;

-- ============ COMPANIES ============
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj TEXT NOT NULL UNIQUE,
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT,
  criada_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_companies_upd BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ UNITS (oficinas) ============
CREATE TABLE public.units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  endereco TEXT,
  cidade TEXT,
  uf TEXT,
  cep TEXT,
  telefone TEXT,
  ativa BOOLEAN NOT NULL DEFAULT true,
  os_seq INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.units TO authenticated;
GRANT ALL ON public.units TO service_role;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_units_upd BEFORE UPDATE ON public.units FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ MEMBERSHIPS ============
CREATE TABLE public.memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, unit_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.memberships TO authenticated;
GRANT ALL ON public.memberships TO service_role;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

-- Helper: is member of unit
CREATE OR REPLACE FUNCTION public.is_member(_user_id UUID, _unit_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE user_id = _user_id AND unit_id = _unit_id AND ativo = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_unit_admin(_user_id UUID, _unit_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE user_id = _user_id AND unit_id = _unit_id AND ativo = true AND role = 'oficina_admin'
  );
$$;

-- Companies: visible if user has membership in any of its units, or super
CREATE POLICY "companies read" ON public.companies FOR SELECT TO authenticated USING (
  public.is_super_admin(auth.uid())
  OR EXISTS (SELECT 1 FROM public.memberships m JOIN public.units u ON u.id=m.unit_id
             WHERE u.company_id = companies.id AND m.user_id = auth.uid() AND m.ativo)
);
CREATE POLICY "companies insert self" ON public.companies FOR INSERT TO authenticated
  WITH CHECK (criada_por = auth.uid() AND public.access_active(auth.uid()));
CREATE POLICY "companies update by admin" ON public.companies FOR UPDATE TO authenticated USING (
  public.is_super_admin(auth.uid())
  OR EXISTS (SELECT 1 FROM public.memberships m JOIN public.units u ON u.id=m.unit_id
             WHERE u.company_id = companies.id AND m.user_id = auth.uid() AND m.role = 'oficina_admin' AND m.ativo)
);

-- Units policies
CREATE POLICY "units read members" ON public.units FOR SELECT TO authenticated USING (
  public.is_super_admin(auth.uid()) OR public.is_member(auth.uid(), id)
);
CREATE POLICY "units insert by company admin" ON public.units FOR INSERT TO authenticated WITH CHECK (
  public.access_active(auth.uid()) AND (
    public.is_super_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.memberships m JOIN public.units u2 ON u2.id=m.unit_id
               WHERE u2.company_id = units.company_id AND m.user_id = auth.uid() AND m.role='oficina_admin' AND m.ativo)
    OR EXISTS (SELECT 1 FROM public.companies c WHERE c.id = units.company_id AND c.criada_por = auth.uid())
  )
);
CREATE POLICY "units update admin" ON public.units FOR UPDATE TO authenticated USING (
  public.is_super_admin(auth.uid()) OR public.is_unit_admin(auth.uid(), id)
);
CREATE POLICY "units delete admin" ON public.units FOR DELETE TO authenticated USING (
  public.is_super_admin(auth.uid()) OR public.is_unit_admin(auth.uid(), id)
);

-- Memberships policies
CREATE POLICY "memberships read" ON public.memberships FOR SELECT TO authenticated USING (
  public.is_super_admin(auth.uid())
  OR user_id = auth.uid()
  OR public.is_unit_admin(auth.uid(), unit_id)
);
CREATE POLICY "memberships write by unit admin" ON public.memberships FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_unit_admin(auth.uid(), unit_id))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_unit_admin(auth.uid(), unit_id));

-- Profiles policies
CREATE POLICY "profiles self read" ON public.profiles FOR SELECT TO authenticated USING (
  id = auth.uid() OR public.is_super_admin(auth.uid())
  OR EXISTS (SELECT 1 FROM public.memberships m1 JOIN public.memberships m2 ON m1.unit_id = m2.unit_id
             WHERE m1.user_id = auth.uid() AND m2.user_id = profiles.id AND m1.ativo AND m2.ativo)
);
CREATE POLICY "profiles self upsert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profiles self update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());

-- ============ CUSTOMERS ============
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  cpf_cnpj TEXT,
  telefone TEXT,
  email TEXT,
  endereco TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_customers_upd BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE POLICY "customers unit" ON public.customers FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_member(auth.uid(), unit_id))
  WITH CHECK (public.access_active(auth.uid()) AND (public.is_super_admin(auth.uid()) OR public.is_member(auth.uid(), unit_id)));

-- ============ VEHICLES ============
CREATE TABLE public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  placa TEXT,
  marca TEXT,
  modelo TEXT,
  ano INT,
  cor TEXT,
  km_atual INT,
  chassi TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicles TO authenticated;
GRANT ALL ON public.vehicles TO service_role;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_vehicles_upd BEFORE UPDATE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE POLICY "vehicles unit" ON public.vehicles FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_member(auth.uid(), unit_id))
  WITH CHECK (public.access_active(auth.uid()) AND (public.is_super_admin(auth.uid()) OR public.is_member(auth.uid(), unit_id)));

-- ============ SERVICES CATALOG ============
CREATE TABLE public.services_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  preco_padrao NUMERIC(12,2) NOT NULL DEFAULT 0,
  tempo_estimado_min INT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.services_catalog TO authenticated;
GRANT ALL ON public.services_catalog TO service_role;
ALTER TABLE public.services_catalog ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_svc_upd BEFORE UPDATE ON public.services_catalog FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE POLICY "svc unit" ON public.services_catalog FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_member(auth.uid(), unit_id))
  WITH CHECK (public.access_active(auth.uid()) AND (public.is_super_admin(auth.uid()) OR public.is_member(auth.uid(), unit_id)));

-- ============ PARTS + BATCHES ============
CREATE TABLE public.parts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  sku TEXT,
  preco_venda_padrao NUMERIC(12,2),
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parts TO authenticated;
GRANT ALL ON public.parts TO service_role;
ALTER TABLE public.parts ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_parts_upd BEFORE UPDATE ON public.parts FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE POLICY "parts unit" ON public.parts FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_member(auth.uid(), unit_id))
  WITH CHECK (public.access_active(auth.uid()) AND (public.is_super_admin(auth.uid()) OR public.is_member(auth.uid(), unit_id)));

CREATE TABLE public.part_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  part_id UUID NOT NULL REFERENCES public.parts(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  lote TEXT,
  quantidade NUMERIC(12,2) NOT NULL DEFAULT 0,
  preco_custo NUMERIC(12,2),
  preco_venda NUMERIC(12,2),
  validade DATE,
  fornecedor TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.part_batches TO authenticated;
GRANT ALL ON public.part_batches TO service_role;
ALTER TABLE public.part_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "batches unit" ON public.part_batches FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_member(auth.uid(), unit_id))
  WITH CHECK (public.access_active(auth.uid()) AND (public.is_super_admin(auth.uid()) OR public.is_member(auth.uid(), unit_id)));

-- ============ SERVICE ORDERS ============
CREATE TABLE public.service_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  numero INT NOT NULL,
  customer_id UUID NOT NULL REFERENCES public.customers(id),
  vehicle_id UUID REFERENCES public.vehicles(id),
  mecanico_id UUID REFERENCES auth.users(id),
  status public.os_status NOT NULL DEFAULT 'aberta',
  km_entrada INT,
  diagnostico TEXT,
  observacoes_internas TEXT,
  observacoes_cliente TEXT,
  data_abertura TIMESTAMPTZ NOT NULL DEFAULT now(),
  data_conclusao TIMESTAMPTZ,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(unit_id, numero)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_orders TO authenticated;
GRANT ALL ON public.service_orders TO service_role;
ALTER TABLE public.service_orders ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_os_upd BEFORE UPDATE ON public.service_orders FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE POLICY "os unit" ON public.service_orders FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_member(auth.uid(), unit_id))
  WITH CHECK (public.access_active(auth.uid()) AND (public.is_super_admin(auth.uid()) OR public.is_member(auth.uid(), unit_id)));

-- Next OS number
CREATE OR REPLACE FUNCTION public.next_os_number(_unit UUID) RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n INT;
BEGIN
  UPDATE public.units SET os_seq = os_seq + 1 WHERE id = _unit RETURNING os_seq INTO n;
  RETURN n;
END; $$;

CREATE TABLE public.os_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id UUID NOT NULL REFERENCES public.service_orders(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  tipo public.os_item_type NOT NULL,
  referencia_id UUID,
  descricao TEXT NOT NULL,
  quantidade NUMERIC(12,2) NOT NULL DEFAULT 1,
  preco_unitario NUMERIC(12,2) NOT NULL DEFAULT 0,
  desconto NUMERIC(12,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.os_items TO authenticated;
GRANT ALL ON public.os_items TO service_role;
ALTER TABLE public.os_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "os_items unit" ON public.os_items FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_member(auth.uid(), unit_id))
  WITH CHECK (public.access_active(auth.uid()) AND (public.is_super_admin(auth.uid()) OR public.is_member(auth.uid(), unit_id)));

CREATE TABLE public.os_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id UUID NOT NULL REFERENCES public.service_orders(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  metodo public.payment_method NOT NULL,
  valor NUMERIC(12,2) NOT NULL,
  pago_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  observacao TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.os_payments TO authenticated;
GRANT ALL ON public.os_payments TO service_role;
ALTER TABLE public.os_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "os_payments unit" ON public.os_payments FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_member(auth.uid(), unit_id))
  WITH CHECK (public.access_active(auth.uid()) AND (public.is_super_admin(auth.uid()) OR public.is_member(auth.uid(), unit_id)));

-- Recalcula total da OS
CREATE OR REPLACE FUNCTION public.recalc_os_total() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _os UUID;
BEGIN
  _os := COALESCE(NEW.os_id, OLD.os_id);
  UPDATE public.service_orders
    SET total = COALESCE((SELECT SUM(subtotal) FROM public.os_items WHERE os_id = _os), 0)
    WHERE id = _os;
  RETURN NULL;
END; $$;
CREATE TRIGGER trg_os_items_recalc AFTER INSERT OR UPDATE OR DELETE ON public.os_items
  FOR EACH ROW EXECUTE FUNCTION public.recalc_os_total();

-- ============ INVITATIONS ============
CREATE TABLE public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role public.app_role NOT NULL,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24),'hex'),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at TIMESTAMPTZ,
  invited_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invitations TO authenticated;
GRANT ALL ON public.invitations TO service_role;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invites by unit admin" ON public.invitations FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_unit_admin(auth.uid(), unit_id))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_unit_admin(auth.uid(), unit_id));

-- ============ AUDIT LOG ============
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id),
  acao TEXT NOT NULL,
  entidade TEXT,
  entidade_id UUID,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit super" ON public.audit_log FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));
CREATE POLICY "audit insert self" ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());

-- ============ AUTO-CREATE profile + account_access on signup ============
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'))
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.account_access (user_id, status)
  VALUES (NEW.id, 'pending')
  ON CONFLICT (user_id) DO NOTHING;

  -- Se for o PRIMEIRO usuário do sistema, promove a super_admin e aprova
  IF (SELECT COUNT(*) FROM public.user_roles WHERE role='super_admin') = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'super_admin') ON CONFLICT DO NOTHING;
    UPDATE public.account_access SET status = 'approved' WHERE user_id = NEW.id;
  END IF;

  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
