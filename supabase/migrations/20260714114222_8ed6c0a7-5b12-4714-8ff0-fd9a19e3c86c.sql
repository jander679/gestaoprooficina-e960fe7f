
-- Contas a pagar: recorrência e vínculo com conta-mãe
ALTER TABLE public.contas_pagar
  ADD COLUMN IF NOT EXISTS recorrente boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recorrencia_dia_mes int,
  ADD COLUMN IF NOT EXISTS recorrencia_ate date,
  ADD COLUMN IF NOT EXISTS conta_mae_id uuid REFERENCES public.contas_pagar(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_contas_pagar_mae ON public.contas_pagar(conta_mae_id);

-- Service Orders: quem fechou e se ficou com saldo
ALTER TABLE public.service_orders
  ADD COLUMN IF NOT EXISTS fechada_por uuid,
  ADD COLUMN IF NOT EXISTS fechada_com_saldo boolean NOT NULL DEFAULT false;

-- Trigger: ao inserir conta recorrente-mãe, gera parcelas até recorrencia_ate (ou 12 meses)
CREATE OR REPLACE FUNCTION public.tg_contas_pagar_gerar_parcelas()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _fim date;
  _dia int;
  _cursor date;
  _venc date;
  _mes_alvo date;
  _ult int;
BEGIN
  IF NEW.recorrente = false OR NEW.conta_mae_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  _dia := COALESCE(NEW.recorrencia_dia_mes, EXTRACT(day FROM NEW.vencimento)::int);
  _fim := COALESCE(NEW.recorrencia_ate, (NEW.vencimento + INTERVAL '12 months')::date);

  _cursor := (date_trunc('month', NEW.vencimento) + INTERVAL '1 month')::date;

  WHILE _cursor <= _fim LOOP
    _mes_alvo := date_trunc('month', _cursor)::date;
    _ult := EXTRACT(day FROM (date_trunc('month', _mes_alvo) + INTERVAL '1 month - 1 day'))::int;
    _venc := _mes_alvo + (LEAST(_dia, _ult) - 1);

    IF _venc > _fim THEN EXIT; END IF;

    INSERT INTO public.contas_pagar(
      unit_id, descricao, categoria, fornecedor, valor, vencimento, metodo, observacao,
      created_by, conta_mae_id, recorrente
    ) VALUES (
      NEW.unit_id, NEW.descricao, NEW.categoria, NEW.fornecedor, NEW.valor, _venc, NEW.metodo, NEW.observacao,
      NEW.created_by, NEW.id, false
    );

    _cursor := (_cursor + INTERVAL '1 month')::date;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_contas_pagar_gerar_parcelas ON public.contas_pagar;
CREATE TRIGGER tg_contas_pagar_gerar_parcelas
AFTER INSERT ON public.contas_pagar
FOR EACH ROW EXECUTE FUNCTION public.tg_contas_pagar_gerar_parcelas();
