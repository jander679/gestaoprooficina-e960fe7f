DROP POLICY IF EXISTS "pay write" ON public.os_payments;

CREATE POLICY "pay write"
ON public.os_payments
FOR ALL
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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.os_payments TO authenticated;
GRANT ALL ON public.os_payments TO service_role;