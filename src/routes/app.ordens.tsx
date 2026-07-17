import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveUnit } from "@/hooks/use-active-unit";
import { PageHeader, EmptyState } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { traduzirErro } from "@/lib/errors";
import { brl, fmtDateTime } from "@/lib/format";
import { COMMON, OS_STATUS, STAFF_ROLE, safeLabel } from "@/lib/pt-br";

export const Route = createFileRoute("/app/ordens")({
  head: () => ({ meta: [{ title: "Ordens de Serviço — OficinaPro" }] }),
  component: OrdersRoute,
});

function OrdersRoute() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname !== "/app/ordens") return <Outlet />;
  return <OrdersPage />;
}

interface OS {
  id: string; numero: number; status: string; total: number | null;
  data_abertura: string; customer_id: string; vehicle_id: string | null;
  customers: { nome: string } | null;
  vehicles: { placa: string | null; modelo: string | null } | null;
}

const STATUSES = ["aberta","em_andamento","aguardando_peca","aguardando_aprovacao","concluida","cancelada"] as const;

function OrdersPage() {
  const { activeUnitId } = useActiveUnit();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);

  // Novo cadastro
  const [selCustomer, setSelCustomer] = useState("");
  const [selVehicle, setSelVehicle] = useState("");
  const [selMecanico, setSelMecanico] = useState("");
  const [kmEntrada, setKmEntrada] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [servicoRefId, setServicoRefId] = useState("");
  const [descLivre, setDescLivre] = useState("");
  const [precoServico, setPrecoServico] = useState("");

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

  const { data: mecanicos = [] } = useQuery({
    queryKey: ["mecanicos-select", activeUnitId],
    enabled: !!activeUnitId && open,
    queryFn: async () => {
      const { data } = await supabase.from("memberships")
        .select("user_id, role, ativo, profiles!inner(full_name, username)")
        .eq("unit_id", activeUnitId!).eq("ativo", true);
      return (data ?? []) as unknown as Array<{ user_id: string; role: string; profiles: { full_name: string | null; username: string | null } }>;
    },
  });

  const { data: services = [] } = useQuery({
    queryKey: ["services-select-new-os", activeUnitId],
    enabled: !!activeUnitId && open,
    queryFn: async () => {
      const { data } = await supabase.from("services_catalog").select("id,nome,preco_padrao").eq("unit_id", activeUnitId!).order("nome");
      return data ?? [];
    },
  });

  function resetForm() {
    setSelCustomer(""); setSelVehicle(""); setSelMecanico("");
    setKmEntrada(""); setObservacoes(""); setServicoRefId("");
    setDescLivre(""); setPrecoServico("");
  }

  const create = useMutation({
    mutationFn: async () => {
      const { data: nres, error: nerr } = await supabase.rpc("next_os_number", { _unit: activeUnitId! });
      if (nerr) throw nerr;

      const insertPayload = {
        unit_id: activeUnitId!,
        numero: nres as number,
        customer_id: selCustomer,
        vehicle_id: selVehicle || null,
        status: "aberta" as const,
        mecanico_id: selMecanico || null,
        km_entrada: kmEntrada ? Number(kmEntrada) : null,
        observacoes_internas: observacoes || null,
      };

      const { data: os, error } = await supabase.from("service_orders").insert(insertPayload).select("id").single();

      if (error) throw error;

      // Item inicial (opcional)
      const svc = services.find((s: { id: string }) => s.id === servicoRefId) as { id: string; nome: string; preco_padrao: number | null } | undefined;
      let descricao = "";
      let preco = 0;
      let tipo: "servico" | "descricao_livre" | null = null;
      let refId: string | null = null;
      if (svc) {
        tipo = "servico"; refId = svc.id; descricao = svc.nome;
        preco = precoServico ? Number(precoServico) : Number(svc.preco_padrao ?? 0);
      } else if (descLivre.trim()) {
        tipo = "descricao_livre"; descricao = descLivre.trim();
        preco = precoServico ? Number(precoServico) : 0;
      }
      if (tipo) {
        const { error: itErr } = await supabase.from("os_items").insert({
          os_id: os.id, unit_id: activeUnitId!, tipo, descricao,
          referencia_id: refId, quantidade: 1, preco_unitario: preco, desconto: 0, subtotal: preco,
        });
        if (itErr) throw itErr;
      }

      return os.id as string;
    },
    onSuccess: (id) => {
      toast.success(COMMON.saved); setOpen(false); resetForm();
      qc.invalidateQueries({ queryKey: ["orders"] });
      nav({ to: "/app/ordens/$id", params: { id } });
    },
    onError: (e) => toast.error(traduzirErro(e)),
  });

  if (!activeUnitId) return <EmptyState title={COMMON.selectUnit} />;

  return (
    <div>
      <PageHeader
        title="Ordens de Serviço"
        actions={
          <>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{COMMON.all}</SelectItem>
                {STATUSES.map((s) => <SelectItem key={s} value={s}>{safeLabel(OS_STATUS, s)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" />Nova OS</Button>
          </>
        }
      />

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>OS Nº</TableHead>
              <TableHead>Aberta em</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Veículo</TableHead>
              <TableHead>{COMMON.status}</TableHead>
              <TableHead className="text-right">{COMMON.total}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">{COMMON.empty}</TableCell></TableRow>}
            {data.map((o) => (
              <TableRow
                key={o.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => nav({ to: "/app/ordens/$id", params: { id: o.id } })}
              >
                <TableCell><Link to="/app/ordens/$id" params={{ id: o.id }} className="font-medium">#{o.numero}</Link></TableCell>
                <TableCell>{fmtDateTime(o.data_abertura)}</TableCell>
                <TableCell>{o.customers?.nome ?? "—"}</TableCell>
                <TableCell>{[o.vehicles?.placa, o.vehicles?.modelo].filter(Boolean).join(" · ") || "—"}</TableCell>
                <TableCell><Badge variant="secondary">{safeLabel(OS_STATUS, o.status)}</Badge></TableCell>
                <TableCell className="text-right font-medium">{brl(o.total ?? 0)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Nova Ordem de Serviço</DialogTitle></DialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label>Cliente *</Label>
              <Select value={selCustomer} onValueChange={(v) => { setSelCustomer(v); setSelVehicle(""); }}>
                <SelectTrigger><SelectValue placeholder={COMMON.selectCustomer} /></SelectTrigger>
                <SelectContent>{customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
              </Select>
              {customers.length === 0 && (
                <div className="mt-1 text-xs text-muted-foreground">
                  Nenhum cliente. <Link to="/app/clientes" className="underline">Cadastrar cliente</Link>
                </div>
              )}
            </div>
            <div>
              <Label>Veículo</Label>
              <Select value={selVehicle} onValueChange={setSelVehicle} disabled={!selCustomer}>
                <SelectTrigger><SelectValue placeholder="Selecione o veículo" /></SelectTrigger>
                <SelectContent>{vehicles.map((v) => <SelectItem key={v.id} value={v.id}>{[v.placa, v.marca, v.modelo].filter(Boolean).join(" · ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Funcionário responsável</Label>
              <Select value={selMecanico} onValueChange={setSelMecanico}>
                <SelectTrigger><SelectValue placeholder="Selecionar funcionário" /></SelectTrigger>
                <SelectContent>
                  {mecanicos.map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      {m.profiles.full_name || m.profiles.username || "—"} · {safeLabel(STAFF_ROLE, m.role)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>KM na entrada</Label>
              <Input type="number" value={kmEntrada} onChange={(e) => setKmEntrada(e.target.value)} />
            </div>
            <div>
              <Label>Serviço do catálogo (opcional)</Label>
              <Select value={servicoRefId} onValueChange={(v) => {
                setServicoRefId(v);
                const s = services.find((x: { id: string }) => x.id === v) as { preco_padrao: number | null } | undefined;
                if (s?.preco_padrao != null) setPrecoServico(String(s.preco_padrao));
              }}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{services.map((s: { id: string; nome: string }) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label>Ou descreva o serviço (opcional)</Label>
              <Input value={descLivre} onChange={(e) => setDescLivre(e.target.value)} placeholder="Ex.: Diagnóstico do motor" disabled={!!servicoRefId} />
            </div>
            <div>
              <Label>Valor do serviço (opcional)</Label>
              <Input type="number" step="0.01" value={precoServico} onChange={(e) => setPrecoServico(e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <Label>Observações</Label>
              <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter><Button disabled={!selCustomer || create.isPending} onClick={() => create.mutate()}>{COMMON.create}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
