import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer } from "lucide-react";
import { brl, fmtDateTime } from "@/lib/format";

export const Route = createFileRoute("/app/ordens/$id/imprimir")({
  head: () => ({ meta: [{ title: "Imprimir OS — OficinaPro" }] }),
  component: PrintOs,
});

const STATUS_LABEL: Record<string, string> = {
  aberta: "Aberta", em_andamento: "Em andamento", aguardando_peca: "Aguardando peça",
  aguardando_aprovacao: "Aguardando aprovação", concluida: "Concluída", cancelada: "Cancelada",
};
const METHOD_LABEL: Record<string, string> = {
  dinheiro: "Dinheiro", pix: "Pix", credito: "Crédito", debito: "Débito",
  boleto: "Boleto", transferencia: "Transferência", outro: "Outro",
};
const ITEM_LABEL: Record<string, string> = {
  servico: "Serviço", peca: "Peça", descricao_livre: "Descrição livre",
};

function PrintOs() {
  const { id } = Route.useParams();

  const { data: os } = useQuery({
    queryKey: ["os-print", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("service_orders")
        .select("*, customers(nome,cpf_cnpj,telefone,email,endereco), vehicles(placa,marca,modelo,ano,cor,chassi,km), units(nome,endereco,telefone,companies(razao_social,nome_fantasia,cnpj))")
        .eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: items = [] } = useQuery({
    queryKey: ["os-print-items", id],
    queryFn: async () => {
      const { data } = await supabase.from("os_items").select("*").eq("os_id", id).order("created_at");
      return data ?? [];
    },
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["os-print-payments", id],
    queryFn: async () => {
      const { data } = await supabase.from("os_payments").select("*").eq("os_id", id).order("pago_em");
      return data ?? [];
    },
  });

  const { data: mecanico } = useQuery({
    queryKey: ["os-print-mec", os?.mecanico_id],
    enabled: !!os?.mecanico_id,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("full_name,username").eq("id", os!.mecanico_id!).maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (!os) return;
    const auto = new URLSearchParams(window.location.search).get("auto");
    if (auto) {
      const t = setTimeout(() => window.print(), 400);
      return () => clearTimeout(t);
    }
  }, [os]);

  if (!os) return <div className="p-6">Carregando…</div>;

  const total = items.reduce((s, i) => s + Number(i.subtotal ?? 0), 0);
  const paid = payments.reduce((s, p) => s + Number(p.valor ?? 0), 0);
  const balance = total - paid;
  const company = os.units?.companies;

  return (
    <div className="mx-auto max-w-[900px] print-page bg-white text-black">
      <div className="no-print mb-4 flex items-center justify-between">
        <Link to="/app/ordens/$id" params={{ id }}>
          <Button variant="ghost"><ArrowLeft className="mr-2 h-4 w-4" />Voltar</Button>
        </Link>
        <Button onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" />Imprimir / Salvar PDF
        </Button>
      </div>

      <div className="border-2 border-black p-6 text-[13px] leading-snug">
        <header className="flex items-start justify-between border-b border-black pb-3">
          <div>
            <div className="text-xl font-bold">
              {company?.nome_fantasia || company?.razao_social || os.units?.nome || "Oficina"}
            </div>
            {company?.razao_social && company?.nome_fantasia && (
              <div className="text-xs">{company.razao_social}</div>
            )}
            {company?.cnpj && <div className="text-xs">CNPJ: {company.cnpj}</div>}
            <div className="text-xs">{os.units?.nome}</div>
            {os.units?.endereco && <div className="text-xs">{os.units.endereco}</div>}
            {os.units?.telefone && <div className="text-xs">Tel.: {os.units.telefone}</div>}
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">OS Nº {os.numero}</div>
            <div className="text-xs">Abertura: {fmtDateTime(os.data_abertura)}</div>
            {os.data_conclusao && <div className="text-xs">Conclusão: {fmtDateTime(os.data_conclusao)}</div>}
            <div className="mt-1 inline-block border border-black px-2 py-0.5 text-xs font-semibold">
              {STATUS_LABEL[os.status] ?? os.status}
            </div>
          </div>
        </header>

        <section className="mt-3 grid grid-cols-2 gap-4">
          <div className="border border-black p-2">
            <div className="mb-1 text-[11px] font-bold uppercase">Cliente</div>
            <div><strong>{os.customers?.nome ?? "—"}</strong></div>
            {os.customers?.cpf_cnpj && <div>CPF/CNPJ: {os.customers.cpf_cnpj}</div>}
            {os.customers?.telefone && <div>Tel.: {os.customers.telefone}</div>}
            {os.customers?.email && <div>E-mail: {os.customers.email}</div>}
            {os.customers?.endereco && <div>{os.customers.endereco}</div>}
          </div>
          <div className="border border-black p-2">
            <div className="mb-1 text-[11px] font-bold uppercase">Veículo</div>
            {os.vehicles ? (
              <>
                <div><strong>{[os.vehicles.marca, os.vehicles.modelo].filter(Boolean).join(" ")}</strong></div>
                {os.vehicles.placa && <div>Placa: {os.vehicles.placa}</div>}
                <div>
                  {os.vehicles.ano && <>Ano: {os.vehicles.ano} · </>}
                  {os.vehicles.cor && <>Cor: {os.vehicles.cor}</>}
                </div>
                {os.km_entrada != null && <div>KM entrada: {os.km_entrada}</div>}
                {os.vehicles.chassi && <div>Chassi: {os.vehicles.chassi}</div>}
              </>
            ) : <div>—</div>}
          </div>
        </section>

        <section className="mt-3 border border-black p-2">
          <div className="mb-1 text-[11px] font-bold uppercase">Responsável</div>
          <div>{mecanico?.full_name || mecanico?.username || "—"}</div>
        </section>

        {os.diagnostico && (
          <section className="mt-3 border border-black p-2">
            <div className="mb-1 text-[11px] font-bold uppercase">Diagnóstico</div>
            <div className="whitespace-pre-wrap">{os.diagnostico}</div>
          </section>
        )}

        <section className="mt-3">
          <div className="mb-1 text-[11px] font-bold uppercase">Serviços e peças</div>
          <table className="w-full border-collapse border border-black">
            <thead className="bg-neutral-100">
              <tr>
                <th className="border border-black p-1 text-left">Tipo</th>
                <th className="border border-black p-1 text-left">Descrição</th>
                <th className="border border-black p-1 text-right">Qtd</th>
                <th className="border border-black p-1 text-right">Unit.</th>
                <th className="border border-black p-1 text-right">Desc.</th>
                <th className="border border-black p-1 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr><td colSpan={6} className="border border-black p-2 text-center">Sem itens</td></tr>
              )}
              {items.map((i) => (
                <tr key={i.id}>
                  <td className="border border-black p-1">{ITEM_LABEL[i.tipo] ?? i.tipo}</td>
                  <td className="border border-black p-1">{i.descricao}</td>
                  <td className="border border-black p-1 text-right">{i.quantidade}</td>
                  <td className="border border-black p-1 text-right">{brl(Number(i.preco_unitario))}</td>
                  <td className="border border-black p-1 text-right">{brl(Number(i.desconto))}</td>
                  <td className="border border-black p-1 text-right">{brl(Number(i.subtotal))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5} className="border border-black p-1 text-right font-bold">TOTAL</td>
                <td className="border border-black p-1 text-right font-bold">{brl(total)}</td>
              </tr>
            </tfoot>
          </table>
        </section>

        {payments.length > 0 && (
          <section className="mt-3">
            <div className="mb-1 text-[11px] font-bold uppercase">Pagamentos</div>
            <table className="w-full border-collapse border border-black">
              <thead className="bg-neutral-100">
                <tr>
                  <th className="border border-black p-1 text-left">Data</th>
                  <th className="border border-black p-1 text-left">Método</th>
                  <th className="border border-black p-1 text-left">Obs.</th>
                  <th className="border border-black p-1 text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="border border-black p-1">{fmtDateTime(p.pago_em)}</td>
                    <td className="border border-black p-1">{METHOD_LABEL[p.metodo] ?? p.metodo}</td>
                    <td className="border border-black p-1">{p.observacao ?? ""}</td>
                    <td className="border border-black p-1 text-right">{brl(Number(p.valor))}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} className="border border-black p-1 text-right font-bold">Pago</td>
                  <td className="border border-black p-1 text-right font-bold">{brl(paid)}</td>
                </tr>
                <tr>
                  <td colSpan={3} className="border border-black p-1 text-right font-bold">Saldo</td>
                  <td className="border border-black p-1 text-right font-bold">{brl(balance)}</td>
                </tr>
              </tfoot>
            </table>
          </section>
        )}

        {os.observacoes_cliente && (
          <section className="mt-3 border border-black p-2">
            <div className="mb-1 text-[11px] font-bold uppercase">Observações ao cliente</div>
            <div className="whitespace-pre-wrap">{os.observacoes_cliente}</div>
          </section>
        )}

        <section className="mt-8 grid grid-cols-2 gap-8">
          <div>
            <div className="border-t border-black pt-1 text-center text-xs">
              Assinatura do cliente
            </div>
          </div>
          <div>
            <div className="border-t border-black pt-1 text-center text-xs">
              Assinatura do responsável
            </div>
          </div>
        </section>

        <footer className="mt-4 border-t border-black pt-2 text-center text-[10px]">
          OS Nº {os.numero} · Impresso em {fmtDateTime(new Date())}
        </footer>
      </div>
    </div>
  );
}
