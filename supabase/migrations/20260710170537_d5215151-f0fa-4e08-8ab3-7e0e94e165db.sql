CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ok boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'super_admin'
  ) INTO _ok;
  RETURN COALESCE(_ok, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.is_member(_user_id uuid, _unit_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ok boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE user_id = _user_id AND unit_id = _unit_id AND ativo = true
  ) INTO _ok;
  RETURN COALESCE(_ok, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.is_unit_admin(_user_id uuid, _unit_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ok boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE user_id = _user_id
      AND unit_id = _unit_id
      AND ativo = true
      AND role = 'oficina_admin'
  ) INTO _ok;
  RETURN COALESCE(_ok, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.has_unit_role(_user_id uuid, _unit_id uuid, _roles app_role[])
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ok boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE user_id = _user_id
      AND unit_id = _unit_id
      AND ativo = true
      AND role = ANY(_roles)
  ) INTO _ok;
  RETURN COALESCE(_ok, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.unit_company(_unit_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _company_id uuid;
BEGIN
  SELECT company_id INTO _company_id
  FROM public.units
  WHERE id = _unit_id;
  RETURN _company_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_company_owner(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ok boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.companies c
    WHERE c.id = _company_id
      AND c.criada_por = _user_id
  ) INTO _ok;
  RETURN COALESCE(_ok, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.is_company_admin(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ok boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.memberships m
    JOIN public.units u ON u.id = m.unit_id
    WHERE u.company_id = _company_id
      AND m.user_id = _user_id
      AND m.ativo = true
      AND m.role = 'oficina_admin'
  ) INTO _ok;
  RETURN COALESCE(_ok, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.can_manage_company(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.is_super_admin(_user_id)
      OR public.is_company_owner(_user_id, _company_id)
      OR public.is_company_admin(_user_id, _company_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.can_manage_unit(_user_id uuid, _unit_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _company_id uuid;
BEGIN
  SELECT public.unit_company(_unit_id) INTO _company_id;
  RETURN public.is_super_admin(_user_id)
      OR public.is_unit_admin(_user_id, _unit_id)
      OR public.can_manage_company(_user_id, _company_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.can_read_profile(_actor_id uuid, _profile_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ok boolean;
BEGIN
  IF _actor_id = _profile_id OR public.is_super_admin(_actor_id) THEN
    RETURN true;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.memberships actor_m
    JOIN public.memberships target_m ON target_m.unit_id = actor_m.unit_id
    WHERE actor_m.user_id = _actor_id
      AND target_m.user_id = _profile_id
      AND actor_m.ativo = true
      AND target_m.ativo = true
  ) OR EXISTS (
    SELECT 1
    FROM public.memberships target_m
    JOIN public.units target_u ON target_u.id = target_m.unit_id
    WHERE target_m.user_id = _profile_id
      AND target_m.ativo = true
      AND public.is_company_admin(_actor_id, target_u.company_id)
  ) INTO _ok;

  RETURN COALESCE(_ok, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.can_update_profile(_actor_id uuid, _profile_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ok boolean;
BEGIN
  IF _actor_id = _profile_id OR public.is_super_admin(_actor_id) THEN
    RETURN true;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.memberships target_m
    JOIN public.units target_u ON target_u.id = target_m.unit_id
    WHERE target_m.user_id = _profile_id
      AND target_m.ativo = true
      AND public.is_company_admin(_actor_id, target_u.company_id)
  ) INTO _ok;

  RETURN COALESCE(_ok, false);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.is_company_owner(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_manage_company(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_manage_unit(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_read_profile(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_update_profile(uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_company_owner(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_company(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_unit(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_read_profile(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_update_profile(uuid, uuid) TO authenticated, service_role;