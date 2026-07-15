-- Reforça permissões das Ordens de Serviço para todos os perfis operacionais da oficina
DROP POLICY IF EXISTS "os read" ON public.service_orders;
DROP POLICY IF EXISTS "os update" ON public.service_orders;
DROP POLICY IF EXISTS "os write" ON public.service_orders;
DROP POLICY IF EXISTS "os insert" ON public.service_orders;
DROP POLICY IF EXISTS "os delete admin" ON public.service_orders;

CREATE POLICY "os read"
ON public.service_orders
FOR SELECT
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR public.is_member(auth.uid(), unit_id)
  OR public.is_company_admin(auth.uid(), public.unit_company(unit_id))
);

CREATE POLICY "os insert"
ON public.service_orders
FOR INSERT
TO authenticated
WITH CHECK (
  public.access_active(auth.uid())
  AND (
    public.is_super_admin(auth.uid())
    OR public.is_company_admin(auth.uid(), public.unit_company(unit_id))
    OR public.has_unit_role(auth.uid(), unit_id, ARRAY['oficina_admin','mecanico','recepcionista','financeiro']::public.app_role[])
  )
);

CREATE POLICY "os update"
ON public.service_orders
FOR UPDATE
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR public.is_company_admin(auth.uid(), public.unit_company(unit_id))
  OR public.has_unit_role(auth.uid(), unit_id, ARRAY['oficina_admin','mecanico','recepcionista','financeiro']::public.app_role[])
)
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR public.is_company_admin(auth.uid(), public.unit_company(unit_id))
  OR public.has_unit_role(auth.uid(), unit_id, ARRAY['oficina_admin','mecanico','recepcionista','financeiro']::public.app_role[])
);

CREATE POLICY "os delete admin"
ON public.service_orders
FOR DELETE
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR public.is_company_admin(auth.uid(), public.unit_company(unit_id))
  OR public.has_unit_role(auth.uid(), unit_id, ARRAY['oficina_admin']::public.app_role[])
);

-- Reforça permissões de itens da OS para todos os perfis operacionais da oficina
DROP POLICY IF EXISTS "osi insert" ON public.os_items;
DROP POLICY IF EXISTS "osi update" ON public.os_items;
DROP POLICY IF EXISTS "osi delete" ON public.os_items;

CREATE POLICY "osi insert"
ON public.os_items
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR public.is_company_admin(auth.uid(), public.unit_company(unit_id))
  OR public.has_unit_role(auth.uid(), unit_id, ARRAY['oficina_admin','mecanico','recepcionista','financeiro']::public.app_role[])
);

CREATE POLICY "osi update"
ON public.os_items
FOR UPDATE
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR public.is_company_admin(auth.uid(), public.unit_company(unit_id))
  OR public.has_unit_role(auth.uid(), unit_id, ARRAY['oficina_admin','mecanico','recepcionista','financeiro']::public.app_role[])
)
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR public.is_company_admin(auth.uid(), public.unit_company(unit_id))
  OR public.has_unit_role(auth.uid(), unit_id, ARRAY['oficina_admin','mecanico','recepcionista','financeiro']::public.app_role[])
);

CREATE POLICY "osi delete"
ON public.os_items
FOR DELETE
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR public.is_company_admin(auth.uid(), public.unit_company(unit_id))
  OR public.has_unit_role(auth.uid(), unit_id, ARRAY['oficina_admin','mecanico','recepcionista','financeiro']::public.app_role[])
);

-- Garante colunas necessárias sem falhar caso já existam
ALTER TABLE public.service_orders
  ADD COLUMN IF NOT EXISTS fechada_por uuid,
  ADD COLUMN IF NOT EXISTS fechada_com_saldo boolean NOT NULL DEFAULT false;

ALTER TABLE public.contas_pagar
  ADD COLUMN IF NOT EXISTS recorrente boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recorrencia_dia_mes integer,
  ADD COLUMN IF NOT EXISTS recorrencia_ate date,
  ADD COLUMN IF NOT EXISTS conta_mae_id uuid REFERENCES public.contas_pagar(id) ON DELETE CASCADE;

-- Validação leve da recorrência
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contas_pagar_recorrencia_dia_mes_check'
  ) THEN
    ALTER TABLE public.contas_pagar
      ADD CONSTRAINT contas_pagar_recorrencia_dia_mes_check
      CHECK (recorrencia_dia_mes IS NULL OR (recorrencia_dia_mes BETWEEN 1 AND 31));
  END IF;
END $$;

-- Triggers essenciais que estavam ausentes no banco
DROP TRIGGER IF EXISTS trg_os_items_recalc_insert ON public.os_items;
DROP TRIGGER IF EXISTS trg_os_items_recalc_update ON public.os_items;
DROP TRIGGER IF EXISTS trg_os_items_recalc_delete ON public.os_items;
CREATE TRIGGER trg_os_items_recalc_insert
AFTER INSERT ON public.os_items
FOR EACH ROW EXECUTE FUNCTION public.recalc_os_total();
CREATE TRIGGER trg_os_items_recalc_update
AFTER UPDATE ON public.os_items
FOR EACH ROW EXECUTE FUNCTION public.recalc_os_total();
CREATE TRIGGER trg_os_items_recalc_delete
AFTER DELETE ON public.os_items
FOR EACH ROW EXECUTE FUNCTION public.recalc_os_total();

DROP TRIGGER IF EXISTS trg_contas_pagar_gerar_parcelas ON public.contas_pagar;
CREATE TRIGGER trg_contas_pagar_gerar_parcelas
AFTER INSERT ON public.contas_pagar
FOR EACH ROW EXECUTE FUNCTION public.tg_contas_pagar_gerar_parcelas();

DROP TRIGGER IF EXISTS trg_contas_pagar_updated_at ON public.contas_pagar;
CREATE TRIGGER trg_contas_pagar_updated_at
BEFORE UPDATE ON public.contas_pagar
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

DROP TRIGGER IF EXISTS trg_units_grant_creator_membership ON public.units;
CREATE TRIGGER trg_units_grant_creator_membership
AFTER INSERT ON public.units
FOR EACH ROW EXECUTE FUNCTION public.tg_units_grant_creator_membership();

DROP TRIGGER IF EXISTS trg_units_create_subscription ON public.units;
CREATE TRIGGER trg_units_create_subscription
AFTER INSERT ON public.units
FOR EACH ROW EXECUTE FUNCTION public.tg_units_create_subscription();

-- Garante acesso via API para tabelas já existentes
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_orders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.os_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.os_payments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contas_pagar TO authenticated;
GRANT ALL ON public.service_orders TO service_role;
GRANT ALL ON public.os_items TO service_role;
GRANT ALL ON public.os_payments TO service_role;
GRANT ALL ON public.contas_pagar TO service_role;