
-- 1) Helper: usuário é admin de ALGUMA unidade da empresa informada
CREATE OR REPLACE FUNCTION public.is_company_admin(_user_id uuid, _company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships m
    JOIN public.units u ON u.id = m.unit_id
    WHERE u.company_id = _company_id
      AND m.user_id = _user_id
      AND m.ativo = true
      AND m.role = 'oficina_admin'
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_company_admin(uuid, uuid) TO authenticated;

-- 2) Helper: retorna a company_id de uma unit
CREATE OR REPLACE FUNCTION public.unit_company(_unit_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT company_id FROM public.units WHERE id = _unit_id;
$$;
GRANT EXECUTE ON FUNCTION public.unit_company(uuid) TO authenticated;

-- 3) COMPANIES: recriar policies sem depender de access_active no INSERT
DROP POLICY IF EXISTS "companies insert self" ON public.companies;
DROP POLICY IF EXISTS "companies update by admin" ON public.companies;
DROP POLICY IF EXISTS "companies read" ON public.companies;

CREATE POLICY "companies insert self" ON public.companies
  FOR INSERT TO authenticated
  WITH CHECK (criada_por = auth.uid());

CREATE POLICY "companies read" ON public.companies
  FOR SELECT TO authenticated
  USING (
    is_super_admin(auth.uid())
    OR criada_por = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.memberships m
      JOIN public.units u ON u.id = m.unit_id
      WHERE u.company_id = companies.id
        AND m.user_id = auth.uid() AND m.ativo
    )
  );

CREATE POLICY "companies update by admin" ON public.companies
  FOR UPDATE TO authenticated
  USING (
    is_super_admin(auth.uid())
    OR criada_por = auth.uid()
    OR is_company_admin(auth.uid(), id)
  )
  WITH CHECK (
    is_super_admin(auth.uid())
    OR criada_por = auth.uid()
    OR is_company_admin(auth.uid(), id)
  );

CREATE POLICY "companies delete by admin" ON public.companies
  FOR DELETE TO authenticated
  USING (
    is_super_admin(auth.uid())
    OR criada_por = auth.uid()
    OR is_company_admin(auth.uid(), id)
  );

-- 4) UNITS: sem access_active; criador ou admin da empresa cria/edita/deleta
DROP POLICY IF EXISTS "units insert by company admin" ON public.units;
DROP POLICY IF EXISTS "units update admin" ON public.units;
DROP POLICY IF EXISTS "units delete admin" ON public.units;
DROP POLICY IF EXISTS "units read members" ON public.units;

CREATE POLICY "units read members" ON public.units
  FOR SELECT TO authenticated
  USING (
    is_super_admin(auth.uid())
    OR is_member(auth.uid(), id)
    OR is_company_admin(auth.uid(), company_id)
    OR EXISTS (SELECT 1 FROM public.companies c WHERE c.id = units.company_id AND c.criada_por = auth.uid())
  );

CREATE POLICY "units insert by company admin" ON public.units
  FOR INSERT TO authenticated
  WITH CHECK (
    is_super_admin(auth.uid())
    OR is_company_admin(auth.uid(), company_id)
    OR EXISTS (SELECT 1 FROM public.companies c WHERE c.id = units.company_id AND c.criada_por = auth.uid())
  );

CREATE POLICY "units update admin" ON public.units
  FOR UPDATE TO authenticated
  USING (
    is_super_admin(auth.uid())
    OR is_company_admin(auth.uid(), company_id)
    OR EXISTS (SELECT 1 FROM public.companies c WHERE c.id = units.company_id AND c.criada_por = auth.uid())
  )
  WITH CHECK (
    is_super_admin(auth.uid())
    OR is_company_admin(auth.uid(), company_id)
    OR EXISTS (SELECT 1 FROM public.companies c WHERE c.id = units.company_id AND c.criada_por = auth.uid())
  );

CREATE POLICY "units delete admin" ON public.units
  FOR DELETE TO authenticated
  USING (
    is_super_admin(auth.uid())
    OR is_company_admin(auth.uid(), company_id)
    OR EXISTS (SELECT 1 FROM public.companies c WHERE c.id = units.company_id AND c.criada_por = auth.uid())
  );

-- 5) Ampliar escrita das tabelas de dados: admin da oficina pode agir em qualquer unit da mesma empresa;
--    recepcionista também pode cadastrar peças e serviços.
DROP POLICY IF EXISTS "cust write" ON public.customers;
CREATE POLICY "cust write" ON public.customers
  FOR ALL TO authenticated
  USING (
    is_super_admin(auth.uid())
    OR is_company_admin(auth.uid(), unit_company(unit_id))
    OR has_unit_role(auth.uid(), unit_id, ARRAY['oficina_admin','mecanico','recepcionista']::app_role[])
  )
  WITH CHECK (
    is_super_admin(auth.uid())
    OR is_company_admin(auth.uid(), unit_company(unit_id))
    OR has_unit_role(auth.uid(), unit_id, ARRAY['oficina_admin','mecanico','recepcionista']::app_role[])
  );

DROP POLICY IF EXISTS "veh write" ON public.vehicles;
CREATE POLICY "veh write" ON public.vehicles
  FOR ALL TO authenticated
  USING (
    is_super_admin(auth.uid())
    OR is_company_admin(auth.uid(), unit_company(unit_id))
    OR has_unit_role(auth.uid(), unit_id, ARRAY['oficina_admin','mecanico','recepcionista']::app_role[])
  )
  WITH CHECK (
    is_super_admin(auth.uid())
    OR is_company_admin(auth.uid(), unit_company(unit_id))
    OR has_unit_role(auth.uid(), unit_id, ARRAY['oficina_admin','mecanico','recepcionista']::app_role[])
  );

DROP POLICY IF EXISTS "svc write admin" ON public.services_catalog;
CREATE POLICY "svc write" ON public.services_catalog
  FOR ALL TO authenticated
  USING (
    is_super_admin(auth.uid())
    OR is_company_admin(auth.uid(), unit_company(unit_id))
    OR has_unit_role(auth.uid(), unit_id, ARRAY['oficina_admin','mecanico','recepcionista']::app_role[])
  )
  WITH CHECK (
    is_super_admin(auth.uid())
    OR is_company_admin(auth.uid(), unit_company(unit_id))
    OR has_unit_role(auth.uid(), unit_id, ARRAY['oficina_admin','mecanico','recepcionista']::app_role[])
  );

DROP POLICY IF EXISTS "parts write" ON public.parts;
CREATE POLICY "parts write" ON public.parts
  FOR ALL TO authenticated
  USING (
    is_super_admin(auth.uid())
    OR is_company_admin(auth.uid(), unit_company(unit_id))
    OR has_unit_role(auth.uid(), unit_id, ARRAY['oficina_admin','mecanico','recepcionista']::app_role[])
  )
  WITH CHECK (
    is_super_admin(auth.uid())
    OR is_company_admin(auth.uid(), unit_company(unit_id))
    OR has_unit_role(auth.uid(), unit_id, ARRAY['oficina_admin','mecanico','recepcionista']::app_role[])
  );

DROP POLICY IF EXISTS "batches write" ON public.part_batches;
CREATE POLICY "batches write" ON public.part_batches
  FOR ALL TO authenticated
  USING (
    is_super_admin(auth.uid())
    OR is_company_admin(auth.uid(), unit_company(unit_id))
    OR has_unit_role(auth.uid(), unit_id, ARRAY['oficina_admin','mecanico','recepcionista']::app_role[])
  )
  WITH CHECK (
    is_super_admin(auth.uid())
    OR is_company_admin(auth.uid(), unit_company(unit_id))
    OR has_unit_role(auth.uid(), unit_id, ARRAY['oficina_admin','mecanico','recepcionista']::app_role[])
  );

-- OS itens/pagamentos: mesmas regras já existentes + admin da empresa
DROP POLICY IF EXISTS "osi insert" ON public.os_items;
DROP POLICY IF EXISTS "osi update" ON public.os_items;
DROP POLICY IF EXISTS "osi delete" ON public.os_items;
CREATE POLICY "osi insert" ON public.os_items
  FOR INSERT TO authenticated
  WITH CHECK (
    is_super_admin(auth.uid())
    OR is_company_admin(auth.uid(), unit_company(unit_id))
    OR has_unit_role(auth.uid(), unit_id, ARRAY['oficina_admin','mecanico','recepcionista']::app_role[])
  );
CREATE POLICY "osi update" ON public.os_items
  FOR UPDATE TO authenticated
  USING (
    is_super_admin(auth.uid())
    OR is_company_admin(auth.uid(), unit_company(unit_id))
    OR has_unit_role(auth.uid(), unit_id, ARRAY['oficina_admin','mecanico','recepcionista']::app_role[])
  )
  WITH CHECK (
    is_super_admin(auth.uid())
    OR is_company_admin(auth.uid(), unit_company(unit_id))
    OR has_unit_role(auth.uid(), unit_id, ARRAY['oficina_admin','mecanico','recepcionista']::app_role[])
  );
CREATE POLICY "osi delete" ON public.os_items
  FOR DELETE TO authenticated
  USING (
    is_super_admin(auth.uid())
    OR is_company_admin(auth.uid(), unit_company(unit_id))
    OR has_unit_role(auth.uid(), unit_id, ARRAY['oficina_admin','mecanico','recepcionista']::app_role[])
  );

DROP POLICY IF EXISTS "pay write" ON public.os_payments;
CREATE POLICY "pay write" ON public.os_payments
  FOR ALL TO authenticated
  USING (
    is_super_admin(auth.uid())
    OR is_company_admin(auth.uid(), unit_company(unit_id))
    OR has_unit_role(auth.uid(), unit_id, ARRAY['oficina_admin','financeiro','recepcionista']::app_role[])
  )
  WITH CHECK (
    is_super_admin(auth.uid())
    OR is_company_admin(auth.uid(), unit_company(unit_id))
    OR has_unit_role(auth.uid(), unit_id, ARRAY['oficina_admin','financeiro','recepcionista']::app_role[])
  );

-- service_orders também precisa ser incluído
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename='service_orders' AND policyname='os write') THEN
    DROP POLICY "os write" ON public.service_orders;
  END IF;
END $$;
CREATE POLICY "os write" ON public.service_orders
  FOR ALL TO authenticated
  USING (
    is_super_admin(auth.uid())
    OR is_company_admin(auth.uid(), unit_company(unit_id))
    OR has_unit_role(auth.uid(), unit_id, ARRAY['oficina_admin','mecanico','recepcionista']::app_role[])
  )
  WITH CHECK (
    is_super_admin(auth.uid())
    OR is_company_admin(auth.uid(), unit_company(unit_id))
    OR has_unit_role(auth.uid(), unit_id, ARRAY['oficina_admin','mecanico','recepcionista']::app_role[])
  );

-- 6) PROFILES: admin da oficina pode atualizar perfis dos colaboradores da própria empresa
--    (super admin fica protegido pelo trigger tg_protect_super_admin).
DROP POLICY IF EXISTS "profiles update by company admin" ON public.profiles;
CREATE POLICY "profiles update by company admin" ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    id = auth.uid()
    OR is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.memberships m
      JOIN public.units u ON u.id = m.unit_id
      WHERE m.user_id = profiles.id
        AND is_company_admin(auth.uid(), u.company_id)
    )
  )
  WITH CHECK (
    id = auth.uid()
    OR is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.memberships m
      JOIN public.units u ON u.id = m.unit_id
      WHERE m.user_id = profiles.id
        AND is_company_admin(auth.uid(), u.company_id)
    )
  );

-- 7) MEMBERSHIPS: admin de qualquer unidade da empresa também gerencia todas as memberships da empresa
DROP POLICY IF EXISTS "memberships write by unit admin" ON public.memberships;
CREATE POLICY "memberships write by company admin" ON public.memberships
  FOR ALL TO authenticated
  USING (
    is_super_admin(auth.uid())
    OR is_company_admin(auth.uid(), unit_company(unit_id))
  )
  WITH CHECK (
    is_super_admin(auth.uid())
    OR is_company_admin(auth.uid(), unit_company(unit_id))
  );
