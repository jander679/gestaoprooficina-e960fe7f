DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_os_items_recalc_after_insert'
  ) THEN
    CREATE TRIGGER trg_os_items_recalc_after_insert
    AFTER INSERT ON public.os_items
    FOR EACH ROW EXECUTE FUNCTION public.recalc_os_total();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_os_items_recalc_after_update'
  ) THEN
    CREATE TRIGGER trg_os_items_recalc_after_update
    AFTER UPDATE ON public.os_items
    FOR EACH ROW EXECUTE FUNCTION public.recalc_os_total();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_os_items_recalc_after_delete'
  ) THEN
    CREATE TRIGGER trg_os_items_recalc_after_delete
    AFTER DELETE ON public.os_items
    FOR EACH ROW EXECUTE FUNCTION public.recalc_os_total();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_service_orders_updated_at'
  ) THEN
    CREATE TRIGGER trg_service_orders_updated_at
    BEFORE UPDATE ON public.service_orders
    FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
  END IF;
END $$;

DROP POLICY IF EXISTS "os insert" ON public.service_orders;
DROP POLICY IF EXISTS "os update" ON public.service_orders;
DROP POLICY IF EXISTS "os delete admin" ON public.service_orders;
DROP POLICY IF EXISTS "osi insert" ON public.os_items;
DROP POLICY IF EXISTS "osi update" ON public.os_items;
DROP POLICY IF EXISTS "osi delete" ON public.os_items;
DROP POLICY IF EXISTS "pay write" ON public.os_payments;

CREATE POLICY "os insert all workshop profiles"
ON public.service_orders
FOR INSERT
TO authenticated
WITH CHECK (
  public.access_active(auth.uid())
  AND public.has_unit_role(
    auth.uid(),
    unit_id,
    ARRAY['oficina_admin'::public.app_role, 'mecanico'::public.app_role, 'recepcionista'::public.app_role, 'financeiro'::public.app_role]
  )
);

CREATE POLICY "os update all workshop profiles"
ON public.service_orders
FOR UPDATE
TO authenticated
USING (
  public.has_unit_role(
    auth.uid(),
    unit_id,
    ARRAY['oficina_admin'::public.app_role, 'mecanico'::public.app_role, 'recepcionista'::public.app_role, 'financeiro'::public.app_role]
  )
)
WITH CHECK (
  public.has_unit_role(
    auth.uid(),
    unit_id,
    ARRAY['oficina_admin'::public.app_role, 'mecanico'::public.app_role, 'recepcionista'::public.app_role, 'financeiro'::public.app_role]
  )
);

CREATE POLICY "os delete workshop admin only"
ON public.service_orders
FOR DELETE
TO authenticated
USING (
  public.has_unit_role(auth.uid(), unit_id, ARRAY['oficina_admin'::public.app_role])
);

CREATE POLICY "osi insert all workshop profiles"
ON public.os_items
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_unit_role(
    auth.uid(),
    unit_id,
    ARRAY['oficina_admin'::public.app_role, 'mecanico'::public.app_role, 'recepcionista'::public.app_role, 'financeiro'::public.app_role]
  )
);

CREATE POLICY "osi update all workshop profiles"
ON public.os_items
FOR UPDATE
TO authenticated
USING (
  public.has_unit_role(
    auth.uid(),
    unit_id,
    ARRAY['oficina_admin'::public.app_role, 'mecanico'::public.app_role, 'recepcionista'::public.app_role, 'financeiro'::public.app_role]
  )
)
WITH CHECK (
  public.has_unit_role(
    auth.uid(),
    unit_id,
    ARRAY['oficina_admin'::public.app_role, 'mecanico'::public.app_role, 'recepcionista'::public.app_role, 'financeiro'::public.app_role]
  )
);

CREATE POLICY "osi delete all workshop profiles"
ON public.os_items
FOR DELETE
TO authenticated
USING (
  public.has_unit_role(
    auth.uid(),
    unit_id,
    ARRAY['oficina_admin'::public.app_role, 'mecanico'::public.app_role, 'recepcionista'::public.app_role, 'financeiro'::public.app_role]
  )
);

CREATE POLICY "pay write all workshop profiles"
ON public.os_payments
FOR ALL
TO authenticated
USING (
  public.has_unit_role(
    auth.uid(),
    unit_id,
    ARRAY['oficina_admin'::public.app_role, 'mecanico'::public.app_role, 'recepcionista'::public.app_role, 'financeiro'::public.app_role]
  )
)
WITH CHECK (
  public.has_unit_role(
    auth.uid(),
    unit_id,
    ARRAY['oficina_admin'::public.app_role, 'mecanico'::public.app_role, 'recepcionista'::public.app_role, 'financeiro'::public.app_role]
  )
);