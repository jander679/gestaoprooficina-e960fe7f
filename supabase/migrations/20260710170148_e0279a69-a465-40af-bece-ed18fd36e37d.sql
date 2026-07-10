CREATE OR REPLACE FUNCTION public.is_company_owner(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.companies c
    WHERE c.id = _company_id
      AND c.criada_por = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_company_admin(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.memberships m
    JOIN public.units u ON u.id = m.unit_id
    WHERE u.company_id = _company_id
      AND m.user_id = _user_id
      AND m.ativo = true
      AND m.role = 'oficina_admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_company(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_super_admin(_user_id)
      OR public.is_company_owner(_user_id, _company_id)
      OR public.is_company_admin(_user_id, _company_id);
$$;

CREATE OR REPLACE FUNCTION public.can_manage_unit(_user_id uuid, _unit_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_super_admin(_user_id)
      OR public.is_unit_admin(_user_id, _unit_id)
      OR public.can_manage_company(_user_id, public.unit_company(_unit_id));
$$;

CREATE OR REPLACE FUNCTION public.can_read_profile(_actor_id uuid, _profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _actor_id = _profile_id
      OR public.is_super_admin(_actor_id)
      OR EXISTS (
        SELECT 1
        FROM public.memberships actor_m
        JOIN public.memberships target_m ON target_m.unit_id = actor_m.unit_id
        WHERE actor_m.user_id = _actor_id
          AND target_m.user_id = _profile_id
          AND actor_m.ativo = true
          AND target_m.ativo = true
      )
      OR EXISTS (
        SELECT 1
        FROM public.memberships target_m
        JOIN public.units target_u ON target_u.id = target_m.unit_id
        WHERE target_m.user_id = _profile_id
          AND target_m.ativo = true
          AND public.is_company_admin(_actor_id, target_u.company_id)
      );
$$;

CREATE OR REPLACE FUNCTION public.can_update_profile(_actor_id uuid, _profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _actor_id = _profile_id
      OR public.is_super_admin(_actor_id)
      OR EXISTS (
        SELECT 1
        FROM public.memberships target_m
        JOIN public.units target_u ON target_u.id = target_m.unit_id
        WHERE target_m.user_id = _profile_id
          AND target_m.ativo = true
          AND public.is_company_admin(_actor_id, target_u.company_id)
      );
$$;

CREATE OR REPLACE FUNCTION public.tg_units_grant_creator_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RETURN NEW;
  END IF;

  IF public.access_active(_uid) AND public.can_manage_company(_uid, NEW.company_id) THEN
    INSERT INTO public.memberships (user_id, unit_id, role, ativo)
    VALUES (_uid, NEW.id, 'oficina_admin', true)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_units_grant_creator_membership ON public.units;
CREATE TRIGGER trg_units_grant_creator_membership
AFTER INSERT ON public.units
FOR EACH ROW
EXECUTE FUNCTION public.tg_units_grant_creator_membership();

DROP POLICY IF EXISTS "companies read" ON public.companies;
DROP POLICY IF EXISTS "companies insert self" ON public.companies;
DROP POLICY IF EXISTS "companies update by admin" ON public.companies;
DROP POLICY IF EXISTS "companies delete by admin" ON public.companies;

CREATE POLICY "companies read" ON public.companies
FOR SELECT TO authenticated
USING (public.can_manage_company(auth.uid(), id));

CREATE POLICY "companies insert self" ON public.companies
FOR INSERT TO authenticated
WITH CHECK (criada_por = auth.uid() AND public.access_active(auth.uid()));

CREATE POLICY "companies update by admin" ON public.companies
FOR UPDATE TO authenticated
USING (public.can_manage_company(auth.uid(), id))
WITH CHECK (public.can_manage_company(auth.uid(), id));

CREATE POLICY "companies delete by admin" ON public.companies
FOR DELETE TO authenticated
USING (public.can_manage_company(auth.uid(), id));

DROP POLICY IF EXISTS "units read members" ON public.units;
DROP POLICY IF EXISTS "units insert by company admin" ON public.units;
DROP POLICY IF EXISTS "units update admin" ON public.units;
DROP POLICY IF EXISTS "units delete admin" ON public.units;

CREATE POLICY "units read members" ON public.units
FOR SELECT TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR public.is_member(auth.uid(), id)
  OR public.can_manage_company(auth.uid(), company_id)
);

CREATE POLICY "units insert by company admin" ON public.units
FOR INSERT TO authenticated
WITH CHECK (public.access_active(auth.uid()) AND public.can_manage_company(auth.uid(), company_id));

CREATE POLICY "units update admin" ON public.units
FOR UPDATE TO authenticated
USING (public.can_manage_company(auth.uid(), company_id))
WITH CHECK (public.can_manage_company(auth.uid(), company_id));

CREATE POLICY "units delete admin" ON public.units
FOR DELETE TO authenticated
USING (public.can_manage_company(auth.uid(), company_id));

DROP POLICY IF EXISTS "memberships read" ON public.memberships;
DROP POLICY IF EXISTS "memberships write by company admin" ON public.memberships;

CREATE POLICY "memberships read" ON public.memberships
FOR SELECT TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR user_id = auth.uid()
  OR public.can_manage_unit(auth.uid(), unit_id)
);

CREATE POLICY "memberships write by company admin" ON public.memberships
FOR ALL TO authenticated
USING (public.can_manage_unit(auth.uid(), unit_id))
WITH CHECK (public.can_manage_unit(auth.uid(), unit_id));

DROP POLICY IF EXISTS "profiles self read" ON public.profiles;
DROP POLICY IF EXISTS "profiles update by company admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles self update" ON public.profiles;

CREATE POLICY "profiles self read" ON public.profiles
FOR SELECT TO authenticated
USING (public.can_read_profile(auth.uid(), id));

CREATE POLICY "profiles self update" ON public.profiles
FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

CREATE POLICY "profiles update by company admin" ON public.profiles
FOR UPDATE TO authenticated
USING (public.can_update_profile(auth.uid(), id))
WITH CHECK (public.can_update_profile(auth.uid(), id));

DROP POLICY IF EXISTS "cust read" ON public.customers;
CREATE POLICY "cust read" ON public.customers
FOR SELECT TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR public.is_member(auth.uid(), unit_id)
  OR public.is_company_admin(auth.uid(), public.unit_company(unit_id))
);

DROP POLICY IF EXISTS "veh read" ON public.vehicles;
CREATE POLICY "veh read" ON public.vehicles
FOR SELECT TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR public.is_member(auth.uid(), unit_id)
  OR public.is_company_admin(auth.uid(), public.unit_company(unit_id))
);

DROP POLICY IF EXISTS "svc read" ON public.services_catalog;
CREATE POLICY "svc read" ON public.services_catalog
FOR SELECT TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR public.is_member(auth.uid(), unit_id)
  OR public.is_company_admin(auth.uid(), public.unit_company(unit_id))
);

DROP POLICY IF EXISTS "parts read" ON public.parts;
CREATE POLICY "parts read" ON public.parts
FOR SELECT TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR public.is_member(auth.uid(), unit_id)
  OR public.is_company_admin(auth.uid(), public.unit_company(unit_id))
);

DROP POLICY IF EXISTS "batches read" ON public.part_batches;
CREATE POLICY "batches read" ON public.part_batches
FOR SELECT TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR public.is_member(auth.uid(), unit_id)
  OR public.is_company_admin(auth.uid(), public.unit_company(unit_id))
);

DROP POLICY IF EXISTS "os read" ON public.service_orders;
CREATE POLICY "os read" ON public.service_orders
FOR SELECT TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR public.is_member(auth.uid(), unit_id)
  OR public.is_company_admin(auth.uid(), public.unit_company(unit_id))
);

DROP POLICY IF EXISTS "osi read" ON public.os_items;
CREATE POLICY "osi read" ON public.os_items
FOR SELECT TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR public.is_member(auth.uid(), unit_id)
  OR public.is_company_admin(auth.uid(), public.unit_company(unit_id))
);

DROP POLICY IF EXISTS "pay read" ON public.os_payments;
CREATE POLICY "pay read" ON public.os_payments
FOR SELECT TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR public.is_member(auth.uid(), unit_id)
  OR public.is_company_admin(auth.uid(), public.unit_company(unit_id))
);