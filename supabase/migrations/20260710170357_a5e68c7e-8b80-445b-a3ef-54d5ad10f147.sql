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