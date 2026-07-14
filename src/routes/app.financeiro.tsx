import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveUnit } from "@/hooks/use-active-unit";
import { PageHeader, EmptyState } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { brl, fmtDateTime } from "@/lib/format";
import { Download, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/app/financeiro")({
  head: () => ({ meta: [{ title: "Financeiro — OficinaPro" }] }),
  component: FinancePage,
});

function todayISO(offset = 0) {
  const d = new Date(); d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

type Payment = { id: string; metodo: string; valor: number; pago_em: string; observacao: string | null; service_orders: { numero: number; customers: { nome: string } | null } | null };
type Conta = { id: string; descricao: string; categoria: string | null; fornecedor: string | null; valor: number; vencimento: string; pago_em: string | null; status: string };

function FinancePage() {
  const { activeUnitId } = useActiveUnit();
  const [from, setFrom] = useState(todayISO(-30));
  const [to, setTo] = useState(todayISO(0));

  const { data: payments = [] } = useQuery({
    queryKey: ["fin-payments", activeUnitId, from, to],
    enabled: !!activeUnitId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("os_payments")
        .select("id, metodo, valor, pago_em, observacao, service_orders(numero, customers(nome))")
        .eq("unit_id", activeUnitId!)
        .gte("pago_em", `${from}T00:00:00`)
        .lte("pago_em", `${to}T23:59:59`)
        .order("pago_em", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Payment[];
    },
  });

  const { data: openOrders = [] } = useQuery({
    queryKey: ["fin-open", activeUnitId],
    enabled: !!activeUnitId,
    queryFn: async () => {
      const { data } = await supabase
        .from("service_orders")
        .select("id, total")
        .eq("unit_id", activeUnitId!)
        .in("status", ["aberta", "em_andamento", "aguardando_aprovacao", "aguardando_peca"]);
      return (data ?? []) as Array<{ id: string; total: number | null }>;
    },
  });

  const { data: contas = [] } = useQuery({
    queryKey: ["fin-contas", activeUnitId, from, to],
    enabled: !!activeUnitId,
    queryFn: async () => {
      const { data, error } = await supabase.from("contas_pagar")
        .select("id, descricao, categoria, fornecedor, valor, vencimento, pago_em, status")
        .eq("unit_id", activeUnitId!)
        .gte("vencimento", from).lte("vencimento", to)
        .order("vencimento");
      if (error) throw error;
      return (data ?? []) as Conta[];
    },
  });

  const totals = useMemo(() => {
    const received = payments.reduce((s, p) => s + Number(p.valor), 0);
    const receivable = openOrders.reduce((s, o) => s + Number(o.total ?? 0), 0);
    const paidOut = contas.filter((c) => c.status === "paga").reduce((s, c) => s + Number(c.valor), 0);
    const payable = contas.filter((c) => c.status !== "paga" && c.status !== "cancelada").reduce((s, c) => s + Number(c.valor), 0);
    const orderCount = new Set(payments.map((p) => p.service_orders?.numero).filter(Boolean)).size;
    const ticket = orderCount ? received / orderCount : 0;
    const net = received - paidOut;

    const byMethod: Record<string, number> = {};
    for (const p of payments) byMethod[p.metodo] = (byMethod[p.metodo] ?? 0) + Number(p.valor);

    const byCategory: Record<string, number> = {};
    for (const c of contas.filter((c) => c.status === "paga")) {
      const k = c.categoria ?? "Sem categoria";
      byCategory[k] = (byCategory[k] ?? 0) + Number(c.valor);
    }

    const byDayIn: Record<string, number> = {};
    for (const p of payments) {
      const d = p.pago_em.slice(0, 10);
      byDayIn[d] = (byDayIn[d] ?? 0) + Number(p.valor);
    }
    const byDayOut: Record<string, number> = {};
    for (const c of contas.filter((c) => c.status === "paga" && c.pago_em)) {
      const d = c.pago_em!.slice(0, 10);
      byDayOut[d] = (byDayOut[d] ?? 0) + Number(c.valor);
    }

    return { received, receivable, paidOut, payable, ticket, net, byMethod, byCategory, byDayIn, byDayOut };
  }, [payments, openOrders, contas]);

  function exportCsv() {
    const header = "tipo,data,descricao,categoria_metodo,valor\n";
    const rowsIn = payments.map((p) => [
      "RECEITA", p.pago_em, `OS #${p.service_orders?.numero ?? ""} ${p.service_orders?.customers?.nome ?? ""}`.replace(/,/g, " "),
      p.metodo, Number(p.valor).toFixed(2),
    ].join(","));
    const rowsOut = contas.map((c) => [
      c.status === "paga" ? "DESPESA_PAGA" : "DESPESA_PENDENTE",
      c.pago_em ?? c.vencimento,
      `${c.descricao} ${c.fornecedor ?? ""}`.replace(/,/g, " "),
      c.categoria ?? "",
      Number(c.valor).toFixed(2),
    ].join(","));
    const blob = new Blob([header + [...rowsIn, ...rowsOut].join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `financeiro-${from}-${to}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const days = Array.from(new Set([...Object.keys(totals.byDayIn), ...Object.keys(totals.byDayOut)])).sort();
  const maxDay = Math.max(1, ...days.map((d) => Math.max(totals.byDayIn[d] ?? 0, totals.byDayOut[d] ?? 0)));

  if (!activeUnitId) return <EmptyState title="Selecione uma unidade" />;

  return (
    <div>
      <PageHeader
        title="Financeiro"
        subtitle="Painel analítico consolidado — receitas, despesas, a receber e a pagar."
        actions={
          <>
            <div className="flex items-center gap-2">
              <Label className="text-xs">De</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
              <Label className="text-xs">Até</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
            </div>
            <Link to="/app/financeiro/contas-pagar"><Button variant="outline">Contas a Pagar <ArrowRight className="ml-2 h-4 w-4" /></Button></Link>
            <Button variant="outline" onClick={exportCsv}><Download className="mr-2 h-4 w-4" />Exportar CSV</Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Card label="Recebido no período" value={brl(totals.received)} tone="emerald" />
        <Card label="A receber (OS em aberto)" value={brl(totals.receivable)} tone="amber" />
        <Card label="Pago no período" value={brl(totals.paidOut)} tone="rose" />
        <Card label="A pagar (contas em aberto)" value={brl(totals.payable)} tone="amber" />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border bg-card p-4">
          <div className="text-xs text-muted-foreground">Saldo líquido do período</div>
          <div className={`mt-1 text-3xl font-semibold ${totals.net >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{brl(totals.net)}</div>
          <div className="mt-1 text-xs text-muted-foreground">Recebido − Pago</div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="text-xs text-muted-foreground">Ticket médio (por OS paga)</div>
          <div className="mt-1 text-3xl font-semibold">{brl(totals.ticket)}</div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border bg-card p-4">
          <div className="mb-3 text-sm font-medium">Fluxo diário (verde=entradas, vermelho=saídas)</div>
          {days.length === 0 ? (
            <div className="text-sm text-muted-foreground">Sem lançamentos no período.</div>
          ) : (
            <div className="space-y-1">
              {days.map((d) => (
                <div key={d} className="flex items-center gap-2 text-xs">
                  <span className="w-16 text-muted-foreground">{d.slice(5)}</span>
                  <div className="h-3 flex-1 rounded bg-muted"><div className="h-full rounded bg-emerald-500" style={{ width: `${((totals.byDayIn[d] ?? 0) / maxDay) * 100}%` }} /></div>
                  <div className="h-3 flex-1 rounded bg-muted"><div className="h-full rounded bg-rose-500" style={{ width: `${((totals.byDayOut[d] ?? 0) / maxDay) * 100}%` }} /></div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="mb-3 text-sm font-medium">Receitas por método</div>
          {Object.keys(totals.byMethod).length === 0 ? (
            <div className="text-sm text-muted-foreground">Sem pagamentos.</div>
          ) : (
            <div className="space-y-2">
              {Object.entries(totals.byMethod).map(([m, v]) => (
                <div key={m} className="flex justify-between text-sm"><span className="capitalize">{m}</span><span className="font-medium">{brl(v)}</span></div>
              ))}
            </div>
          )}
          <div className="mt-4 mb-2 text-sm font-medium">Despesas pagas por categoria</div>
          {Object.keys(totals.byCategory).length === 0 ? (
            <div className="text-sm text-muted-foreground">Sem despesas pagas.</div>
          ) : (
            <div className="space-y-2">
              {Object.entries(totals.byCategory).map(([m, v]) => (
                <div key={m} className="flex justify-between text-sm"><span>{m}</span><span className="font-medium">{brl(v)}</span></div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6">
        <Tabs defaultValue="in">
          <TabsList>
            <TabsTrigger value="in">Receitas ({payments.length})</TabsTrigger>
            <TabsTrigger value="out">Despesas ({contas.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="in" className="mt-4">
            <div className="rounded-xl border bg-card">
              <Table>
                <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>OS</TableHead><TableHead>Cliente</TableHead><TableHead>Método</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
                <TableBody>
                  {payments.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Sem pagamentos no período.</TableCell></TableRow>}
                  {payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{fmtDateTime(p.pago_em)}</TableCell>
                      <TableCell>#{p.service_orders?.numero ?? "—"}</TableCell>
                      <TableCell>{p.service_orders?.customers?.nome ?? "—"}</TableCell>
                      <TableCell className="capitalize">{p.metodo}</TableCell>
                      <TableCell className="text-right font-medium text-emerald-600">{brl(p.valor)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
          <TabsContent value="out" className="mt-4">
            <div className="rounded-xl border bg-card">
              <Table>
                <TableHeader><TableRow><TableHead>Vencimento</TableHead><TableHead>Descrição</TableHead><TableHead>Categoria</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
                <TableBody>
                  {contas.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Sem contas no período.</TableCell></TableRow>}
                  {contas.map((c) => {
                    const atrasada = c.status !== "paga" && c.status !== "cancelada" && c.vencimento < todayISO(0);
                    return (
                      <TableRow key={c.id}>
                        <TableCell>{new Date(c.vencimento).toLocaleDateString("pt-BR")}</TableCell>
                        <TableCell>{c.descricao}{c.fornecedor ? ` — ${c.fornecedor}` : ""}</TableCell>
                        <TableCell>{c.categoria ?? "—"}</TableCell>
                        <TableCell><Badge variant={c.status === "paga" ? "default" : atrasada ? "destructive" : "outline"}>{atrasada ? "atrasada" : c.status}</Badge></TableCell>
                        <TableCell className={`text-right font-medium ${c.status === "paga" ? "text-rose-600" : ""}`}>{brl(c.valor)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function Card({ label, value, tone }: { label: string; value: string; tone?: "emerald" | "amber" | "rose" }) {
  const color = tone === "emerald" ? "text-emerald-600" : tone === "amber" ? "text-amber-600" : tone === "rose" ? "text-rose-600" : "";
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${color}`}>{value}</div>
    </div>
  );
}
