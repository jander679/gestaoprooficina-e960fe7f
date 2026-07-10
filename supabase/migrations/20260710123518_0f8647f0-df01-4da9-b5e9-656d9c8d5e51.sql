
-- Helper: verifica se o usuário tem determinado papel na unidade
CREATE OR REPLACE FUNCTION public.has_unit_role(_user_id uuid, _unit_id uuid, _roles app_role[])
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE user_id = _user_id
      AND unit_id = _unit_id
      AND ativo = true
      AND role = ANY(_roles)
  );
$$;

-- SERVICES CATALOG
DROP POLICY IF EXISTS "svc unit" ON public.services_catalog;
CREATE POLICY "svc read" ON public.services_catalog FOR SELECT
  USING (is_super_admin(auth.uid()) OR is_member(auth.uid(), unit_id));
CREATE POLICY "svc write admin" ON public.services_catalog FOR ALL
  USING (is_super_admin(auth.uid()) OR has_unit_role(auth.uid(), unit_id, ARRAY['oficina_admin']::app_role[]))
  WITH CHECK (access_active(auth.uid()) AND (is_super_admin(auth.uid()) OR has_unit_role(auth.uid(), unit_id, ARRAY['oficina_admin']::app_role[])));

-- PARTS
DROP POLICY IF EXISTS "parts unit" ON public.parts;
CREATE POLICY "parts read" ON public.parts FOR SELECT
  USING (is_super_admin(auth.uid()) OR is_member(auth.uid(), unit_id));
CREATE POLICY "parts write" ON public.parts FOR ALL
  USING (is_super_admin(auth.uid()) OR has_unit_role(auth.uid(), unit_id, ARRAY['oficina_admin','mecanico']::app_role[]))
  WITH CHECK (access_active(auth.uid()) AND (is_super_admin(auth.uid()) OR has_unit_role(auth.uid(), unit_id, ARRAY['oficina_admin','mecanico']::app_role[])));

-- PART BATCHES
DROP POLICY IF EXISTS "batches unit" ON public.part_batches;
CREATE POLICY "batches read" ON public.part_batches FOR SELECT
  USING (is_super_admin(auth.uid()) OR is_member(auth.uid(), unit_id));
CREATE POLICY "batches write" ON public.part_batches FOR ALL
  USING (is_super_admin(auth.uid()) OR has_unit_role(auth.uid(), unit_id, ARRAY['oficina_admin','mecanico']::app_role[]))
  WITH CHECK (access_active(auth.uid()) AND (is_super_admin(auth.uid()) OR has_unit_role(auth.uid(), unit_id, ARRAY['oficina_admin','mecanico']::app_role[])));

-- OS PAYMENTS (financeiro + admin)
DROP POLICY IF EXISTS "os_payments unit" ON public.os_payments;
CREATE POLICY "pay read" ON public.os_payments FOR SELECT
  USING (is_super_admin(auth.uid()) OR is_member(auth.uid(), unit_id));
CREATE POLICY "pay write" ON public.os_payments FOR ALL
  USING (is_super_admin(auth.uid()) OR has_unit_role(auth.uid(), unit_id, ARRAY['oficina_admin','financeiro','recepcionista']::app_role[]))
  WITH CHECK (access_active(auth.uid()) AND (is_super_admin(auth.uid()) OR has_unit_role(auth.uid(), unit_id, ARRAY['oficina_admin','financeiro','recepcionista']::app_role[])));

-- SERVICE ORDERS (todos operacionais criam/editam; delete só admin)
DROP POLICY IF EXISTS "os unit" ON public.service_orders;
CREATE POLICY "os read" ON public.service_orders FOR SELECT
  USING (is_super_admin(auth.uid()) OR is_member(auth.uid(), unit_id));
CREATE POLICY "os insert" ON public.service_orders FOR INSERT
  WITH CHECK (access_active(auth.uid()) AND (is_super_admin(auth.uid()) OR has_unit_role(auth.uid(), unit_id, ARRAY['oficina_admin','mecanico','recepcionista']::app_role[])));
CREATE POLICY "os update" ON public.service_orders FOR UPDATE
  USING (is_super_admin(auth.uid()) OR has_unit_role(auth.uid(), unit_id, ARRAY['oficina_admin','mecanico','recepcionista']::app_role[]))
  WITH CHECK (is_super_admin(auth.uid()) OR has_unit_role(auth.uid(), unit_id, ARRAY['oficina_admin','mecanico','recepcionista']::app_role[]));
CREATE POLICY "os delete admin" ON public.service_orders FOR DELETE
  USING (is_super_admin(auth.uid()) OR has_unit_role(auth.uid(), unit_id, ARRAY['oficina_admin']::app_role[]));

-- OS ITEMS (mesma coisa)
DROP POLICY IF EXISTS "os_items unit" ON public.os_items;
CREATE POLICY "osi read" ON public.os_items FOR SELECT
  USING (is_super_admin(auth.uid()) OR is_member(auth.uid(), unit_id));
CREATE POLICY "osi insert" ON public.os_items FOR INSERT
  WITH CHECK (access_active(auth.uid()) AND (is_super_admin(auth.uid()) OR has_unit_role(auth.uid(), unit_id, ARRAY['oficina_admin','mecanico','recepcionista']::app_role[])));
CREATE POLICY "osi update" ON public.os_items FOR UPDATE
  USING (is_super_admin(auth.uid()) OR has_unit_role(auth.uid(), unit_id, ARRAY['oficina_admin','mecanico','recepcionista']::app_role[]))
  WITH CHECK (is_super_admin(auth.uid()) OR has_unit_role(auth.uid(), unit_id, ARRAY['oficina_admin','mecanico','recepcionista']::app_role[]));
CREATE POLICY "osi delete" ON public.os_items FOR DELETE
  USING (is_super_admin(auth.uid()) OR has_unit_role(auth.uid(), unit_id, ARRAY['oficina_admin','mecanico','recepcionista']::app_role[]));

-- CUSTOMERS / VEHICLES: leitura para todos os papéis; escrita para admin/mecanico/recepcionista
DROP POLICY IF EXISTS "customers unit" ON public.customers;
CREATE POLICY "cust read" ON public.customers FOR SELECT
  USING (is_super_admin(auth.uid()) OR is_member(auth.uid(), unit_id));
CREATE POLICY "cust write" ON public.customers FOR ALL
  USING (is_super_admin(auth.uid()) OR has_unit_role(auth.uid(), unit_id, ARRAY['oficina_admin','mecanico','recepcionista']::app_role[]))
  WITH CHECK (access_active(auth.uid()) AND (is_super_admin(auth.uid()) OR has_unit_role(auth.uid(), unit_id, ARRAY['oficina_admin','mecanico','recepcionista']::app_role[])));

DROP POLICY IF EXISTS "vehicles unit" ON public.vehicles;
CREATE POLICY "veh read" ON public.vehicles FOR SELECT
  USING (is_super_admin(auth.uid()) OR is_member(auth.uid(), unit_id));
CREATE POLICY "veh write" ON public.vehicles FOR ALL
  USING (is_super_admin(auth.uid()) OR has_unit_role(auth.uid(), unit_id, ARRAY['oficina_admin','mecanico','recepcionista']::app_role[]))
  WITH CHECK (access_active(auth.uid()) AND (is_super_admin(auth.uid()) OR has_unit_role(auth.uid(), unit_id, ARRAY['oficina_admin','mecanico','recepcionista']::app_role[])));

-- INVITATIONS: admin sempre; recepcionista pode criar convites
DROP POLICY IF EXISTS "invites by unit admin" ON public.invitations;
CREATE POLICY "inv read" ON public.invitations FOR SELECT
  USING (is_super_admin(auth.uid()) OR is_member(auth.uid(), unit_id));
CREATE POLICY "inv insert" ON public.invitations FOR INSERT
  WITH CHECK (is_super_admin(auth.uid()) OR has_unit_role(auth.uid(), unit_id, ARRAY['oficina_admin','recepcionista']::app_role[]));
CREATE POLICY "inv modify admin" ON public.invitations FOR UPDATE
  USING (is_super_admin(auth.uid()) OR is_unit_admin(auth.uid(), unit_id))
  WITH CHECK (is_super_admin(auth.uid()) OR is_unit_admin(auth.uid(), unit_id));
CREATE POLICY "inv delete admin" ON public.invitations FOR DELETE
  USING (is_super_admin(auth.uid()) OR is_unit_admin(auth.uid(), unit_id));
