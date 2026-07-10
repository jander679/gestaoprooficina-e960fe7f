import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useActiveUnit } from "@/hooks/use-active-unit";
import { PageHeader, EmptyState } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { traduzirErro } from "@/lib/errors";
import { brl, fmtDateTime } from "@/lib/format";

export const Route = createFileRoute("/app/ordens")({
  head: () => ({ meta: [{ title: "Ordens de Serviço — OficinaPro" }] }),
  component: OrdersPage,
});

interface OS {
  id: string; numero: number; status: string; total: number | null;
  data_abertura: string; customer_id: string; vehicle_id: string | null;
  customers: { nome: string } | null;
  vehicles: { placa: string | null; modelo: string | null } | null;
}

const STATUSES = ["aberta","em_andamento","aguardando_peca","aguardando_aprovacao","concluida","cancelada"] as const;

function OrdersPage() {
  const { t } = useTranslation();
  const { activeUnitId } = useActiveUnit();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [selCustomer, setSelCustomer] = useState("");
  const [selVehicle, setSelVehicle] = useState("");

  const { data = [] } = useQuery({
    queryKey: ["orders", activeUnitId, statusFilter],
    enabled: !!activeUnitId,
    queryFn: async () => {
      let q = supabase.from("service_orders")
        .select("id,numero,status,total,data_abertura,customer_id,vehicle_id,customers(nome),vehicles(placa,modelo)")
        .eq("unit_id", activeUnitId!)
        .order("data_abertura", { ascending: false });
      if (statusFilter !== "all") q = q.eq("status", statusFilter as never);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as OS[];
    },
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers-select", activeUnitId],
    enabled: !!activeUnitId && open,
    queryFn: async () => {
      const { data } = await supabase.from("customers").select("id,nome").eq("unit_id", activeUnitId!).order("nome");
      return data ?? [];
    },
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles-for-customer", selCustomer],
    enabled: !!selCustomer,
    queryFn: async () => {
      const { data } = await supabase.from("vehicles").select("id,placa,modelo,marca").eq("customer_id", selCustomer);
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data: nres, error: nerr } = await supabase.rpc("next_os_number", { _unit: activeUnitId! });
      if (nerr) throw nerr;
      const { data, error } = await supabase.from("service_orders").insert({
        unit_id: activeUnitId!, numero: nres as number, customer_id: selCustomer,
        vehicle_id: selVehicle || null, status: "aberta",
      }).select("id").single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => {
      toast.success(t("common.saved")); setOpen(false); setSelCustomer(""); setSelVehicle("");
      qc.invalidateQueries({ queryKey: ["orders"] });
      window.location.assign(`/app/ordens/${id}`);
    },
    onError: (e) => toast.error(traduzirErro(e)),
  });

  if (!activeUnitId) return <EmptyState title={t("common.selectUnit")} />;

  return (
    <div>
      <PageHeader
        title={t("os.title")}
        actions={
          <>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.all")}</SelectItem>
                {STATUSES.map((s) => <SelectItem key={s} value={s}>{t(`os.status.${s}`)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" />{t("os.new")}</Button>
          </>
        }
      />

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("os.number")}</TableHead>
              <TableHead>{t("os.openedAt")}</TableHead>
              <TableHead>{t("os.customer")}</TableHead>
              <TableHead>{t("os.vehicle")}</TableHead>
              <TableHead>{t("common.status")}</TableHead>
              <TableHead className="text-right">{t("common.total")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">{t("common.empty")}</TableCell></TableRow>}
            {data.map((o) => (
              <TableRow key={o.id} className="cursor-pointer hover:bg-muted/50">
                <TableCell><Link to="/app/ordens/$id" params={{ id: o.id }} className="font-medium">#{o.numero}</Link></TableCell>
                <TableCell>{fmtDateTime(o.data_abertura)}</TableCell>
                <TableCell>{o.customers?.nome ?? "—"}</TableCell>
                <TableCell>{[o.vehicles?.placa, o.vehicles?.modelo].filter(Boolean).join(" · ") || "—"}</TableCell>
                <TableCell><Badge variant="secondary">{t(`os.status.${o.status}`)}</Badge></TableCell>
                <TableCell className="text-right font-medium">{brl(o.total ?? 0)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("os.new")}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>{t("os.customer")} *</Label>
              <Select value={selCustomer} onValueChange={(v) => { setSelCustomer(v); setSelVehicle(""); }}>
                <SelectTrigger><SelectValue placeholder={t("common.selectCustomer")} /></SelectTrigger>
                <SelectContent>{customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("os.vehicle")}</Label>
              <Select value={selVehicle} onValueChange={setSelVehicle} disabled={!selCustomer}>
                <SelectTrigger><SelectValue placeholder={t("os.selectVehicle")} /></SelectTrigger>
                <SelectContent>{vehicles.map((v) => <SelectItem key={v.id} value={v.id}>{[v.placa, v.marca, v.modelo].filter(Boolean).join(" · ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button disabled={!selCustomer || create.isPending} onClick={() => create.mutate()}>{t("common.create")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
