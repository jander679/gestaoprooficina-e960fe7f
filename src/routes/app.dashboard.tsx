import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useActiveUnit } from "@/hooks/use-active-unit";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { brl } from "@/lib/format";
import { ClipboardList, Users, Car, Wallet, Plus } from "lucide-react";

export const Route = createFileRoute("/app/dashboard")({
  head: () => ({ meta: [{ title: "Painel — OficinaPro" }] }),
  component: Dashboard,
});

function Card({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string | number }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="mt-2 font-display text-2xl font-semibold">{value}</div>
    </div>
  );
}

function Dashboard() {
  const { t } = useTranslation();
  const { activeUnitId, memberships, isSuperAdmin } = useActiveUnit();

  const { data } = useQuery({
    queryKey: ["dashboard", activeUnitId],
    enabled: !!activeUnitId,
    queryFn: async () => {
      const [os, cust, veh, pay] = await Promise.all([
        supabase.from("service_orders").select("id,status,total", { count: "exact" }).eq("unit_id", activeUnitId!),
        supabase.from("customers").select("id", { count: "exact", head: true }).eq("unit_id", activeUnitId!),
        supabase.from("vehicles").select("id", { count: "exact", head: true }).eq("unit_id", activeUnitId!),
        supabase.from("os_payments").select("valor").eq("unit_id", activeUnitId!)
          .gte("pago_em", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
      ]);
      const open = (os.data ?? []).filter((o) => o.status !== "concluida" && o.status !== "cancelada").length;
      const monthRev = (pay.data ?? []).reduce((s, r) => s + Number(r.valor), 0);
      return { openOs: open, totalOs: os.count ?? 0, customers: cust.count ?? 0, vehicles: veh.count ?? 0, monthRev };
    },
  });

  if (!activeUnitId && !isSuperAdmin) {
    return (
      <div>
        <PageHeader title={t("nav.dashboard")} />
        <div className="rounded-xl border border-dashed p-12 text-center">
          <h3 className="font-display text-base font-medium">Comece configurando sua empresa</h3>
          <p className="mt-2 text-sm text-muted-foreground">Cadastre sua empresa e a primeira unidade para começar.</p>
          <Link to="/app/configuracoes" className="mt-6 inline-block">
            <Button><Plus className="mr-2 h-4 w-4" />Configurar empresa</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (isSuperAdmin && memberships.length === 0) {
    return (
      <div>
        <PageHeader title="Admin Geral do Sistema" subtitle="Você é o administrador geral. Gerencie contas de usuários." />
        <div className="grid gap-4 md:grid-cols-3">
          <Link to="/app/admin/contas" className="rounded-xl border bg-card p-6 hover:bg-accent/5">
            <h3 className="font-display text-lg font-semibold">Contas</h3>
            <p className="mt-2 text-sm text-muted-foreground">Aprove, pause ou defina validade de acesso.</p>
          </Link>
          <Link to="/app/admin/empresas" className="rounded-xl border bg-card p-6 hover:bg-accent/5">
            <h3 className="font-display text-lg font-semibold">Empresas</h3>
            <p className="mt-2 text-sm text-muted-foreground">Todas as empresas e unidades no sistema.</p>
          </Link>
          <Link to="/app/admin/auditoria" className="rounded-xl border bg-card p-6 hover:bg-accent/5">
            <h3 className="font-display text-lg font-semibold">Auditoria</h3>
            <p className="mt-2 text-sm text-muted-foreground">Histórico de ações sensíveis.</p>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={t("nav.dashboard")} />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card icon={ClipboardList} label="OS em aberto" value={data?.openOs ?? 0} />
        <Card icon={ClipboardList} label="Total de OS" value={data?.totalOs ?? 0} />
        <Card icon={Users} label={t("customer.title")} value={data?.customers ?? 0} />
        <Card icon={Car} label={t("vehicle.title")} value={data?.vehicles ?? 0} />
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Wallet className="h-4 w-4" /> Receita do mês
          </div>
          <div className="mt-2 font-display text-3xl font-semibold">{brl(data?.monthRev)}</div>
        </div>
        <div className="rounded-xl border bg-card p-6">
          <div className="text-sm text-muted-foreground">Ações rápidas</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link to="/app/ordens/nova"><Button size="sm"><Plus className="mr-1 h-4 w-4" />Nova OS</Button></Link>
            <Link to="/app/clientes/novo"><Button size="sm" variant="outline"><Plus className="mr-1 h-4 w-4" />Cliente</Button></Link>
            <Link to="/app/veiculos/novo"><Button size="sm" variant="outline"><Plus className="mr-1 h-4 w-4" />Veículo</Button></Link>
          </div>
        </div>
      </div>
    </div>
  );
}
