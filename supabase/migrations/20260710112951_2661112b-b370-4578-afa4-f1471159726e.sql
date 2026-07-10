
-- Trigger que cria automaticamente a membership do criador quando uma unidade é inserida
CREATE OR REPLACE FUNCTION public.tg_units_grant_creator_membership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _is_company_owner boolean;
  _is_company_admin boolean;
BEGIN
  IF _uid IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT (c.criada_por = _uid) INTO _is_company_owner
    FROM public.companies c WHERE c.id = NEW.company_id;

  SELECT EXISTS (
    SELECT 1 FROM public.memberships m
    JOIN public.units u ON u.id = m.unit_id
    WHERE u.company_id = NEW.company_id
      AND m.user_id = _uid
      AND m.role = 'oficina_admin'
      AND m.ativo = true
  ) INTO _is_company_admin;

  IF COALESCE(_is_company_owner, false) OR COALESCE(_is_company_admin, false) THEN
    INSERT INTO public.memberships (user_id, unit_id, role, ativo)
    VALUES (_uid, NEW.id, 'oficina_admin', true)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS units_grant_creator_membership ON public.units;
CREATE TRIGGER units_grant_creator_membership
AFTER INSERT ON public.units
FOR EACH ROW EXECUTE FUNCTION public.tg_units_grant_creator_membership();
