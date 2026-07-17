CREATE OR REPLACE FUNCTION public.tg_reopen_service_order_from_child()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _os uuid;
BEGIN
  _os := COALESCE(NEW.os_id, OLD.os_id);

  UPDATE public.service_orders
     SET status = 'em_andamento',
         data_conclusao = NULL,
         fechada_por = NULL,
         fechada_com_saldo = false,
         updated_at = now()
   WHERE id = _os
     AND status IN ('concluida', 'cancelada');

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_reopen_service_order_on_main_edit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.status IN ('concluida', 'cancelada')
     AND NEW.status = OLD.status
     AND (
       NEW.customer_id IS DISTINCT FROM OLD.customer_id OR
       NEW.vehicle_id IS DISTINCT FROM OLD.vehicle_id OR
       NEW.mecanico_id IS DISTINCT FROM OLD.mecanico_id OR
       NEW.km_entrada IS DISTINCT FROM OLD.km_entrada OR
       NEW.diagnostico IS DISTINCT FROM OLD.diagnostico OR
       NEW.observacoes_cliente IS DISTINCT FROM OLD.observacoes_cliente OR
       NEW.observacoes_internas IS DISTINCT FROM OLD.observacoes_internas
     ) THEN
    NEW.status := 'em_andamento';
    NEW.data_conclusao := NULL;
    NEW.fechada_por := NULL;
    NEW.fechada_com_saldo := false;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_service_orders_reopen_on_main_edit ON public.service_orders;
CREATE TRIGGER trg_service_orders_reopen_on_main_edit
BEFORE UPDATE ON public.service_orders
FOR EACH ROW
EXECUTE FUNCTION public.tg_reopen_service_order_on_main_edit();

DROP TRIGGER IF EXISTS trg_os_items_recalc ON public.os_items;
CREATE TRIGGER trg_os_items_recalc
AFTER INSERT OR UPDATE OR DELETE ON public.os_items
FOR EACH ROW
EXECUTE FUNCTION public.recalc_os_total();

DROP TRIGGER IF EXISTS trg_os_items_reopen ON public.os_items;
CREATE TRIGGER trg_os_items_reopen
AFTER INSERT OR UPDATE OR DELETE ON public.os_items
FOR EACH ROW
EXECUTE FUNCTION public.tg_reopen_service_order_from_child();

DROP TRIGGER IF EXISTS trg_os_payments_reopen ON public.os_payments;
CREATE TRIGGER trg_os_payments_reopen
AFTER INSERT OR UPDATE OR DELETE ON public.os_payments
FOR EACH ROW
EXECUTE FUNCTION public.tg_reopen_service_order_from_child();

DROP TRIGGER IF EXISTS trg_contas_pagar_updated_at ON public.contas_pagar;
CREATE TRIGGER trg_contas_pagar_updated_at
BEFORE UPDATE ON public.contas_pagar
FOR EACH ROW
EXECUTE FUNCTION public.tg_set_updated_at();

DROP TRIGGER IF EXISTS trg_contas_pagar_gerar_parcelas ON public.contas_pagar;
CREATE TRIGGER trg_contas_pagar_gerar_parcelas
AFTER INSERT ON public.contas_pagar
FOR EACH ROW
EXECUTE FUNCTION public.tg_contas_pagar_gerar_parcelas();