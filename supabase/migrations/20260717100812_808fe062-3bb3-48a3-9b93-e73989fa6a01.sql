DROP TRIGGER IF EXISTS trg_os_items_recalc_after_delete ON public.os_items;
DROP TRIGGER IF EXISTS trg_os_items_recalc_after_insert ON public.os_items;
DROP TRIGGER IF EXISTS trg_os_items_recalc_after_update ON public.os_items;
DROP TRIGGER IF EXISTS trg_os_items_recalc_delete ON public.os_items;
DROP TRIGGER IF EXISTS trg_os_items_recalc_insert ON public.os_items;
DROP TRIGGER IF EXISTS trg_os_items_recalc_update ON public.os_items;

DROP TRIGGER IF EXISTS tg_contas_pagar_gerar_parcelas ON public.contas_pagar;
DROP TRIGGER IF EXISTS tg_contas_pagar_updated ON public.contas_pagar;

DROP TRIGGER IF EXISTS trg_os_upd ON public.service_orders;
DROP TRIGGER IF EXISTS trg_service_orders_updated_at ON public.service_orders;