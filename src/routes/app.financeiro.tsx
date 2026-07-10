import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useActiveUnit } from "@/hooks/use-active-unit";
import { PageHeader, EmptyState } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { brl, fmtDateTime } from "@/lib/format";
import { Download } from "lucide-react";

export const Route = createFileRoute("/app/financeiro")({
  head: () => ({ meta: [{ title: "Financeiro — OficinaPro" }] }),
  component: FinancePage,
});

function todayISO(offset = 0) {
  const d = new Date(); d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function FinancePage() {
  const { t } = useTranslation();
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
      return (data ?? []) as unknown as Array<{
        id: string; metodo: string; valor: number; pago_em: string; observacao: string | null;
        service_orders: { numero: number; customers: { nome: string } | null } | null;
      }>;
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

  const totals = useMemo(() => {
    const received = payments.reduce((s, p) => s + Number(p.valor), 0);
    const receivable = openOrders.reduce((s, o) => s + Number(o.total ?? 0), 0);
    const orderCount = new Set(payments.map((p) => p.service_orders?.numero)).size;
    const ticket = orderCount ? received / orderCount : 0;
    const byMethod: Record<string, number> = {};
    for (const p of payments) byMethod[p.metodo] = (byMethod[p.metodo] ?? 0) + Number(p.valor);
    const byDay: Record<string, number> = {};
    for (const p of payments) {
      const d = p.pago_em.slice(0, 10);
      byDay[d] = (byDay[d] ?? 0) + Number(p.valor);
    }
    return { received, receivable, ticket, byMethod, byDay };
  }, [payments, openOrders]);

  function exportCsv() {
    const header = "data,os,cliente,metodo,valor,observacao\n";
    const rows = payments.map((p) => [
      p.pago_em, p.service_orders?.numero ?? "",
      (p.service_orders?.customers?.nome ?? "").replace(/,/g, " "),
      p.metodo, Number(p.valor).toFixed(2),
      (p.observacao ?? "").replace(/[\r\n,]/g, " "),
    ].join(",")).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `financeiro-${from}-${to}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const dayEntries = Object.entries(totals.byDay).sort(([a], [b]) => a.localeCompare(b));
  const maxDay = Math.max(1, ...dayEntries.map(([, v]) => v));

  if (!activeUnitId) return <EmptyState title={t("common.selectUnit")} />;

  return (
    <div>
      <PageHeader
        title={t("finance.title")}
        actions={
          <>
            <div className="flex items-center gap-2">
              <Label className="text-xs">{t("common.from")}</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
              <Label className="text-xs">{t("common.to")}</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
            </div>
            <Button variant="outline" onClick={exportCsv}><Download className="mr-2 h-4 w-4" />{t("common.export")}</Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card label={t("finance.received")} value={brl(totals.received)} tone="emerald" />
        <Card label={t("finance.receivable")} value={brl(totals.receivable)} tone="amber" />
        <Card label={t("finance.ticket")} value={brl(totals.ticket)} />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border bg-card p-4">
          <div className="mb-3 text-sm font-medium">{t("finance.byDay")}</div>
          {dayEntries.length === 0 ? (
            <div className="text-sm text-muted-foreground">{t("finance.noPayments")}</div>
          ) : (
            <div className="space-y-1">
              {dayEntries.map(([d, v]) => (
                <div key={d} className="flex items-center gap-2 text-xs">
                  <span className="w-20 text-muted-foreground">{d.slice(5)}</span>
                  <div className="h-4 flex-1 rounded bg-muted">
                    <div className="h-full rounded bg-primary" style={{ width: `${(v / maxDay) * 100}%` }} />
                  </div>
                  <span className="w-24 text-right font-medium">{brl(v)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="mb-3 text-sm font-medium">{t("finance.byMethod")}</div>
          {Object.keys(totals.byMethod).length === 0 ? (
            <div className="text-sm text-muted-foreground">{t("finance.noPayments")}</div>
          ) : (
            <div className="space-y-2">
              {Object.entries(totals.byMethod).map(([m, v]) => (
                <div key={m} className="flex justify-between text-sm">
                  <span>{t(`os.method.${m}`, m)}</span>
                  <span className="font-medium">{brl(v)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 rounded-xl border bg-card">
        <div className="border-b px-4 py-3 text-sm font-medium">{t("finance.receipts")}</div>
        <Table>
          <TableHeader><TableRow><TableHead>{t("common.createdAt")}</TableHead><TableHead>{t("finance.os")}</TableHead><TableHead>{t("os.customer")}</TableHead><TableHead>{t("finance.method")}</TableHead><TableHead className="text-right">{t("common.total")}</TableHead></TableRow></TableHeader>
          <TableBody>
            {payments.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">{t("finance.noPayments")}</TableCell></TableRow>}
            {payments.map((p) => (
              <TableRow key={p.id}>
                <TableCell>{fmtDateTime(p.pago_em)}</TableCell>
                <TableCell>#{p.service_orders?.numero ?? "—"}</TableCell>
                <TableCell>{p.service_orders?.customers?.nome ?? "—"}</TableCell>
                <TableCell>{t(`os.method.${p.metodo}`, p.metodo)}</TableCell>
                <TableCell className="text-right font-medium">{brl(p.valor)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function Card({ label, value, tone }: { label: string; value: string; tone?: "emerald" | "amber" }) {
  const color = tone === "emerald" ? "text-emerald-600" : tone === "amber" ? "text-amber-600" : "";
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${color}`}>{value}</div>
    </div>
  );
}
