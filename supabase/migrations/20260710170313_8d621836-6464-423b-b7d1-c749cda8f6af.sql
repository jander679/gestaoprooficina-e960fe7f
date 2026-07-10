DROP POLICY IF EXISTS "companies read" ON public.companies;
DROP POLICY IF EXISTS "companies update by admin" ON public.companies;
DROP POLICY IF EXISTS "companies delete by admin" ON public.companies;

CREATE POLICY "companies read" ON public.companies
FOR SELECT TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR criada_por = auth.uid()
  OR public.is_company_admin(auth.uid(), id)
);

CREATE POLICY "companies update by admin" ON public.companies
FOR UPDATE TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR criada_por = auth.uid()
  OR public.is_company_admin(auth.uid(), id)
)
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR criada_por = auth.uid()
  OR public.is_company_admin(auth.uid(), id)
);

CREATE POLICY "companies delete by admin" ON public.companies
FOR DELETE TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR criada_por = auth.uid()
  OR public.is_company_admin(auth.uid(), id)
);

DROP TRIGGER IF EXISTS units_grant_creator_membership ON public.units;
DROP TRIGGER IF EXISTS trg_units_grant_creator_membership ON public.units;

CREATE TRIGGER trg_units_grant_creator_membership
AFTER INSERT ON public.units
FOR EACH ROW
EXECUTE FUNCTION public.tg_units_grant_creator_membership();