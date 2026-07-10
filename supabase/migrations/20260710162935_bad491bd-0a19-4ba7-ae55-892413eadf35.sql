
-- 1) Novo status "revoked" no enum account_status
ALTER TYPE public.account_status ADD VALUE IF NOT EXISTS 'revoked';

-- 2) Trigger para proteger super_admin
CREATE OR REPLACE FUNCTION public.tg_protect_super_admin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  _target_id uuid;
  _actor uuid := auth.uid();
BEGIN
  IF TG_TABLE_NAME = 'profiles' THEN
    _target_id := COALESCE(OLD.id, NEW.id);
  ELSIF TG_TABLE_NAME IN ('user_roles','account_access') THEN
    _target_id := COALESCE(OLD.user_id, NEW.user_id);
  END IF;
  IF _target_id IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  IF public.is_super_admin(_target_id) AND (_actor IS NULL OR NOT public.is_super_admin(_actor)) THEN
    RAISE EXCEPTION 'Somente o Administrador Geral do Sistema pode alterar dados do Administrador Geral';
  END IF;
  RETURN COALESCE(NEW, OLD);
END; $$;

DROP TRIGGER IF EXISTS tg_protect_super_admin_profiles ON public.profiles;
CREATE TRIGGER tg_protect_super_admin_profiles BEFORE UPDATE OR DELETE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.tg_protect_super_admin();
DROP TRIGGER IF EXISTS tg_protect_super_admin_roles ON public.user_roles;
CREATE TRIGGER tg_protect_super_admin_roles BEFORE UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.tg_protect_super_admin();
DROP TRIGGER IF EXISTS tg_protect_super_admin_access ON public.account_access;
CREATE TRIGGER tg_protect_super_admin_access BEFORE UPDATE OR DELETE ON public.account_access
FOR EACH ROW EXECUTE FUNCTION public.tg_protect_super_admin();

-- 3) SaaS Subscriptions
CREATE TABLE IF NOT EXISTS public.saas_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL UNIQUE REFERENCES public.units(id) ON DELETE CASCADE,
  plano text NOT NULL DEFAULT 'padrao',
  valor_mensal numeric(12,2) NOT NULL DEFAULT 149.90,
  dia_vencimento int NOT NULL DEFAULT 10 CHECK (dia_vencimento BETWEEN 1 AND 28),
  status text NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa','suspensa','cancelada')),
  inicio date NOT NULL DEFAULT CURRENT_DATE,
  fim date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saas_subscriptions TO authenticated;
GRANT ALL ON public.saas_subscriptions TO service_role;
ALTER TABLE public.saas_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super admin manages subs" ON public.saas_subscriptions FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "oficina ve sua sub" ON public.saas_subscriptions FOR SELECT TO authenticated
USING (public.has_unit_role(auth.uid(), unit_id, ARRAY['oficina_admin','financeiro']::app_role[]));
CREATE TRIGGER tg_saas_subs_updated BEFORE UPDATE ON public.saas_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 4) SaaS Invoices
CREATE TABLE IF NOT EXISTS public.saas_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  competencia text NOT NULL,
  valor numeric(12,2) NOT NULL,
  vencimento date NOT NULL,
  pago_em timestamptz,
  status text NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta','paga','atrasada','cancelada')),
  metodo text,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (unit_id, competencia)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saas_invoices TO authenticated;
GRANT ALL ON public.saas_invoices TO service_role;
ALTER TABLE public.saas_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super admin manages inv" ON public.saas_invoices FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "oficina ve suas inv" ON public.saas_invoices FOR SELECT TO authenticated
USING (public.has_unit_role(auth.uid(), unit_id, ARRAY['oficina_admin','financeiro']::app_role[]));
CREATE TRIGGER tg_saas_invoices_updated BEFORE UPDATE ON public.saas_invoices
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 5) Auto-criar assinatura ao criar unidade
CREATE OR REPLACE FUNCTION public.tg_units_create_subscription()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  INSERT INTO public.saas_subscriptions (unit_id) VALUES (NEW.id) ON CONFLICT (unit_id) DO NOTHING;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS tg_units_create_subscription ON public.units;
CREATE TRIGGER tg_units_create_subscription AFTER INSERT ON public.units
FOR EACH ROW EXECUTE FUNCTION public.tg_units_create_subscription();

INSERT INTO public.saas_subscriptions (unit_id)
SELECT id FROM public.units WHERE id NOT IN (SELECT unit_id FROM public.saas_subscriptions);

-- 6) Contas a pagar
CREATE TABLE IF NOT EXISTS public.contas_pagar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  descricao text NOT NULL,
  categoria text,
  fornecedor text,
  valor numeric(12,2) NOT NULL,
  vencimento date NOT NULL,
  pago_em timestamptz,
  metodo text,
  status text NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta','paga','atrasada','cancelada')),
  observacao text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contas_pagar TO authenticated;
GRANT ALL ON public.contas_pagar TO service_role;
ALTER TABLE public.contas_pagar ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cp select" ON public.contas_pagar FOR SELECT TO authenticated
USING (public.has_unit_role(auth.uid(), unit_id, ARRAY['oficina_admin','financeiro']::app_role[]));
CREATE POLICY "cp write" ON public.contas_pagar FOR ALL TO authenticated
USING (public.has_unit_role(auth.uid(), unit_id, ARRAY['oficina_admin','financeiro']::app_role[]))
WITH CHECK (public.has_unit_role(auth.uid(), unit_id, ARRAY['oficina_admin','financeiro']::app_role[]));
CREATE TRIGGER tg_contas_pagar_updated BEFORE UPDATE ON public.contas_pagar
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 7) Boletos vinculados a OS
CREATE TABLE IF NOT EXISTS public.os_boletos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id uuid NOT NULL REFERENCES public.service_orders(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  valor numeric(12,2) NOT NULL,
  vencimento date NOT NULL,
  linha_digitavel text,
  status text NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','pago','atrasado','cancelado')),
  pago_em timestamptz,
  observacao text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.os_boletos TO authenticated;
GRANT ALL ON public.os_boletos TO service_role;
ALTER TABLE public.os_boletos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bol select" ON public.os_boletos FOR SELECT TO authenticated
USING (public.is_member(auth.uid(), unit_id));
CREATE POLICY "bol write" ON public.os_boletos FOR ALL TO authenticated
USING (public.has_unit_role(auth.uid(), unit_id, ARRAY['oficina_admin','financeiro','recepcionista']::app_role[]))
WITH CHECK (public.has_unit_role(auth.uid(), unit_id, ARRAY['oficina_admin','financeiro','recepcionista']::app_role[]));
CREATE TRIGGER tg_os_boletos_updated BEFORE UPDATE ON public.os_boletos
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 8) Métodos de pagamento
CREATE TABLE IF NOT EXISTS public.payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  nome text NOT NULL,
  tipo text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  taxa_percentual numeric(5,2) DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(unit_id, nome)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_methods TO authenticated;
GRANT ALL ON public.payment_methods TO service_role;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pm select" ON public.payment_methods FOR SELECT TO authenticated
USING (public.is_member(auth.uid(), unit_id));
CREATE POLICY "pm write" ON public.payment_methods FOR ALL TO authenticated
USING (public.has_unit_role(auth.uid(), unit_id, ARRAY['oficina_admin','financeiro']::app_role[]))
WITH CHECK (public.has_unit_role(auth.uid(), unit_id, ARRAY['oficina_admin','financeiro']::app_role[]));
CREATE TRIGGER tg_payment_methods_updated BEFORE UPDATE ON public.payment_methods
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 9) Auditoria automática financeira
CREATE OR REPLACE FUNCTION public.tg_finance_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  _actor uuid := auth.uid();
BEGIN
  INSERT INTO public.audit_log(actor_id, acao, entidade, entidade_id, payload)
  VALUES (_actor, TG_OP, TG_TABLE_NAME, COALESCE(NEW.id, OLD.id),
    jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW)));
  RETURN COALESCE(NEW, OLD);
END; $$;

DROP TRIGGER IF EXISTS tg_audit_os_payments ON public.os_payments;
CREATE TRIGGER tg_audit_os_payments AFTER INSERT OR UPDATE OR DELETE ON public.os_payments
FOR EACH ROW EXECUTE FUNCTION public.tg_finance_audit();
DROP TRIGGER IF EXISTS tg_audit_os_boletos ON public.os_boletos;
CREATE TRIGGER tg_audit_os_boletos AFTER INSERT OR UPDATE OR DELETE ON public.os_boletos
FOR EACH ROW EXECUTE FUNCTION public.tg_finance_audit();
DROP TRIGGER IF EXISTS tg_audit_contas_pagar ON public.contas_pagar;
CREATE TRIGGER tg_audit_contas_pagar AFTER INSERT OR UPDATE OR DELETE ON public.contas_pagar
FOR EACH ROW EXECUTE FUNCTION public.tg_finance_audit();
