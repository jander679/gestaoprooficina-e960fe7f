import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useActiveUnit } from "@/hooks/use-active-unit";
import { PageHeader } from "@/components/page-header";
import { listSaasFinance, updateSubscription, updateSaasInvoice, generateMonthlyInvoices } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { brl } from "@/lib/format";
import { traduzirErro } from "@/lib/errors";
import { Download, RefreshCw, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/app/admin/financeiro")({
  head: () => ({ meta: [{ title: "Admin Geral — Financeiro SaaS" }] }),
  component: AdminSaasFinancePage,
});

type Sub = { id: string; unit_id: string; plano: string; valor_mensal: number; dia_vencimento: number; status: string; units: any };
type Inv = { id: string; unit_id: string; competencia: string; valor: number; vencimento: string; pago_em: string | null; status: string; metodo: string | null; units: any };

function AdminSaasFinancePage() {
  const { isSuperAdmin } = useActiveUnit();
  const nav = useNavigate();
  useEffect(() => { if (!isSuperAdmin) nav({ to: "/app/dashboard" }); }, [isSuperAdmin, nav]);

  const qc = useQueryClient();
  const list = useServerFn(listSaasFinance);
  const updSub = useServerFn(updateSubscription);
  const updInv = useServerFn(updateSaasInvoice);
  const genInv = useServerFn(generateMonthlyInvoices);

  const { data, isLoading } = useQuery({
    queryKey: ["saas-finance"],
    queryFn: () => list() as Promise<{ subscriptions: Sub[]; invoices: Inv[] }>,
    enabled: isSuperAdmin,
  });

  const [status, setStatus] = useState<string>("all");
  const [q, setQ] = useState("");

  const invoices = data?.invoices ?? [];
  const subs = data?.subscriptions ?? [];

  const stats = useMemo(() => {
    const activeSubs = subs.filter((s) => s.status === "ativa");
    const mrr = activeSubs.reduce((s, x) => s + Number(x.valor_mensal), 0);
    const now = new Date();
    const mesAtual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const receitaMes = invoices.filter((i) => i.competencia === mesAtual && i.status === "paga").reduce((s, x) => s + Number(x.valor), 0);
    const today = now.toISOString().slice(0, 10);
    const inadimplencia = invoices.filter((i) => i.status !== "paga" && i.status !== "cancelada" && i.vencimento < today).reduce((s, x) => s + Number(x.valor), 0);
    return { mrr, arr: mrr * 12, receitaMes, inadimplencia, ativas: activeSubs.length, total: subs.length };
  }, [subs, invoices]);

  const filteredInv = invoices.filter((i) => {
    if (status !== "all" && i.status !== status) return false;
    if (!q) return true;
    const s = q.toLowerCase();
    return (i.units?.nome ?? "").toLowerCase().includes(s) || (i.units?.companies?.nome_fantasia ?? "").toLowerCase().includes(s) || (i.units?.companies?.razao_social ?? "").toLowerCase().includes(s);
  });

  const mMark = useMutation({
    mutationFn: (v: { id: string; status: "paga" | "cancelada" | "aberta" }) => updInv({ data: v }),
    onSuccess: () => { toast.success("Fatura atualizada"); qc.invalidateQueries({ queryKey: ["saas-finance"] }); },
    onError: (e) => toast.error(traduzirErro(e)),
  });

  const mSub = useMutation({
    mutationFn: (v: any) => updSub({ data: v }),
    onSuccess: () => { toast.success("Assinatura atualizada"); qc.invalidateQueries({ queryKey: ["saas-finance"] }); },
    onError: (e) => toast.error(traduzirErro(e)),
  });

  const mGen = useMutation({
    mutationFn: () => genInv({ data: undefined }),
    onSuccess: (r: any) => { toast.success(`${r.created} faturas geradas para ${r.competencia}`); qc.invalidateQueries({ queryKey: ["saas-finance"] }); },
    onError: (e) => toast.error(traduzirErro(e)),
  });

  function exportCsv() {
    const header = "competencia,unidade,cnpj,valor,vencimento,status,pago_em\n";
    const rows = filteredInv.map((i) => [
      i.competencia,
      (i.units?.nome ?? "").replace(/,/g, " "),
      (i.units?.companies?.cnpj ?? ""),
      Number(i.valor).toFixed(2), i.vencimento, i.status, i.pago_em ?? "",
    ].join(",")).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `saas-faturas.csv`; a.click(); URL.revokeObjectURL(url);
  }

  if (!isSuperAdmin) return null;

  return (
    <div>
      <PageHeader title="Financeiro do Sistema (SaaS)" subtitle="Mensalidades cobradas de cada unidade cadastrada."
        actions={
          <>
            <Button variant="outline" onClick={() => mGen.mutate()} disabled={mGen.isPending}>
              <RefreshCw className="mr-2 h-4 w-4" />Gerar faturas do mês
            </Button>
            <Button variant="outline" onClick={exportCsv}><Download className="mr-2 h-4 w-4" />Exportar</Button>
          </>
        } />

      <div className="grid gap-3 md:grid-cols-4">
        <Card label="MRR" value={brl(stats.mrr)} tone="emerald" />
        <Card label="ARR" value={brl(stats.arr)} />
        <Card label="Receita do mês" value={brl(stats.receitaMes)} tone="emerald" />
        <Card label="Inadimplência" value={brl(stats.inadimplencia)} tone="red" />
      </div>
      <div className="mt-2 text-xs text-muted-foreground">Unidades ativas: {stats.ativas} · total: {stats.total}</div>

      <h2 className="mt-8 mb-3 text-lg font-medium">Faturas</h2>
      <div className="mb-3 flex flex-wrap gap-3">
        <Input placeholder="Buscar por unidade / empresa…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="aberta">Abertas</SelectItem>
            <SelectItem value="paga">Pagas</SelectItem>
            <SelectItem value="atrasada">Atrasadas</SelectItem>
            <SelectItem value="cancelada">Canceladas</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Competência</TableHead><TableHead>Unidade</TableHead><TableHead>Vencimento</TableHead>
            <TableHead className="text-right">Valor</TableHead><TableHead>Status</TableHead><TableHead className="w-40">Ações</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Carregando…</TableCell></TableRow>}
            {!isLoading && filteredInv.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Sem faturas.</TableCell></TableRow>}
            {filteredInv.map((i) => {
              const today = new Date().toISOString().slice(0, 10);
              const atrasada = i.status !== "paga" && i.status !== "cancelada" && i.vencimento < today;
              return (
                <TableRow key={i.id}>
                  <TableCell>{i.competencia}</TableCell>
                  <TableCell>
                    <div className="text-sm">{i.units?.nome}</div>
                    <div className="text-xs text-muted-foreground">{i.units?.companies?.nome_fantasia || i.units?.companies?.razao_social}</div>
                  </TableCell>
                  <TableCell>{new Date(i.vencimento).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell className="text-right font-medium">{brl(i.valor)}</TableCell>
                  <TableCell><Badge variant={i.status === "paga" ? "default" : atrasada ? "destructive" : "outline"}>{atrasada ? "atrasada" : i.status}</Badge></TableCell>
                  <TableCell className="flex gap-1">
                    {i.status !== "paga" && (
                      <Button size="sm" onClick={() => mMark.mutate({ id: i.id, status: "paga" })}><CheckCircle2 className="mr-1 h-3 w-3" />Pagar</Button>
                    )}
                    {i.status !== "cancelada" && (
                      <Button size="sm" variant="outline" onClick={() => mMark.mutate({ id: i.id, status: "cancelada" })}>Cancelar</Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <h2 className="mt-8 mb-3 text-lg font-medium">Assinaturas por unidade</h2>
      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Unidade</TableHead><TableHead>Plano</TableHead><TableHead className="text-right">Mensalidade</TableHead>
            <TableHead>Dia venc.</TableHead><TableHead>Status</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {subs.map((s) => (
              <TableRow key={s.id}>
                <TableCell>
                  <div className="text-sm">{s.units?.nome}</div>
                  <div className="text-xs text-muted-foreground">{s.units?.companies?.nome_fantasia || s.units?.companies?.razao_social}</div>
                </TableCell>
                <TableCell>
                  <Input defaultValue={s.plano} onBlur={(e) => e.target.value !== s.plano && mSub.mutate({ id: s.id, plano: e.target.value })} className="h-8 w-32" />
                </TableCell>
                <TableCell className="text-right">
                  <Input type="number" step="0.01" defaultValue={s.valor_mensal} onBlur={(e) => Number(e.target.value) !== Number(s.valor_mensal) && mSub.mutate({ id: s.id, valor_mensal: Number(e.target.value) })} className="h-8 w-28 text-right" />
                </TableCell>
                <TableCell>
                  <Input type="number" min={1} max={28} defaultValue={s.dia_vencimento} onBlur={(e) => Number(e.target.value) !== s.dia_vencimento && mSub.mutate({ id: s.id, dia_vencimento: Number(e.target.value) })} className="h-8 w-20" />
                </TableCell>
                <TableCell>
                  <Select value={s.status} onValueChange={(v) => mSub.mutate({ id: s.id, status: v })}>
                    <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ativa">Ativa</SelectItem>
                      <SelectItem value="suspensa">Suspensa</SelectItem>
                      <SelectItem value="cancelada">Cancelada</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function Card({ label, value, tone }: { label: string; value: string; tone?: "emerald" | "amber" | "red" }) {
  const color = tone === "emerald" ? "text-emerald-600" : tone === "amber" ? "text-amber-600" : tone === "red" ? "text-red-600" : "";
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${color}`}>{value}</div>
    </div>
  );
}
