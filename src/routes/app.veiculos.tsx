import { traduzirErro } from "@/lib/errors";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useActiveUnit } from "@/hooks/use-active-unit";
import { PageHeader, EmptyState } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";

export const Route = createFileRoute("/app/veiculos")({
  head: () => ({ meta: [{ title: "Veículos — OficinaPro" }] }),
  component: VehiclesPage,
});

interface Vehicle {
  id: string; customer_id: string; placa: string | null; marca: string | null;
  modelo: string | null; ano: number | null; cor: string | null; km_atual: number | null;
  chassi: string | null; observacoes: string | null;
  customers?: { nome: string } | null;
}

type FipeType = "cars" | "motorcycles" | "trucks";

const emptyV = { customer_id: "", placa: "", marca: "", modelo: "", ano: "", cor: "", km_atual: "", chassi: "", observacoes: "" };

function VehiclesPage() {
  const { t } = useTranslation();
  const { activeUnitId } = useActiveUnit();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [form, setForm] = useState<Record<string, string>>(emptyV);
  const [useFipe, setUseFipe] = useState(true);
  const [fipeType, setFipeType] = useState<FipeType>("cars");
  const [fipeBrandId, setFipeBrandId] = useState("");
  const [fipeModelId, setFipeModelId] = useState("");
  const [fipeYearId, setFipeYearId] = useState("");

  const { data = [] } = useQuery({
    queryKey: ["vehicles", activeUnitId, q],
    enabled: !!activeUnitId,
    queryFn: async () => {
      let query = supabase.from("vehicles").select("*, customers(nome)").eq("unit_id", activeUnitId!).order("created_at", { ascending: false });
      if (q) query = query.or(`placa.ilike.%${q}%,modelo.ilike.%${q}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as Vehicle[];
    },
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers-select", activeUnitId],
    enabled: !!activeUnitId,
    queryFn: async () => {
      const { data } = await supabase.from("customers").select("id,nome").eq("unit_id", activeUnitId!).order("nome");
      return data ?? [];
    },
  });

  const { data: fipeBrands = [] } = useQuery({
    queryKey: ["fipe-brands", fipeType],
    enabled: open && useFipe,
    queryFn: async () => {
      const { data } = await supabase.from("fipe_brands").select("id,nome").eq("tipo", fipeType).order("nome");
      return (data ?? []) as Array<{ id: string; nome: string }>;
    },
  });
  const { data: fipeModels = [] } = useQuery({
    queryKey: ["fipe-models", fipeBrandId],
    enabled: !!fipeBrandId,
    queryFn: async () => {
      const { data } = await supabase.from("fipe_models").select("id,nome").eq("brand_id", fipeBrandId).order("nome");
      return (data ?? []) as Array<{ id: string; nome: string }>;
    },
  });
  const { data: fipeYears = [] } = useQuery({
    queryKey: ["fipe-years", fipeModelId],
    enabled: !!fipeModelId,
    queryFn: async () => {
      const { data } = await supabase.from("fipe_years").select("id,nome").eq("model_id", fipeModelId).order("nome", { ascending: false });
      return (data ?? []) as Array<{ id: string; nome: string }>;
    },
  });

  useEffect(() => {
    if (!fipeBrandId) return;
    const b = fipeBrands.find((x) => x.id === fipeBrandId);
    if (b) setForm((f) => ({ ...f, marca: b.nome }));
  }, [fipeBrandId, fipeBrands]);
  useEffect(() => {
    if (!fipeModelId) return;
    const m = fipeModels.find((x) => x.id === fipeModelId);
    if (m) setForm((f) => ({ ...f, modelo: m.nome }));
  }, [fipeModelId, fipeModels]);
  useEffect(() => {
    if (!fipeYearId) return;
    const y = fipeYears.find((x) => x.id === fipeYearId);
    if (y) {
      const yr = parseInt(y.nome.split(" ")[0], 10);
      if (!Number.isNaN(yr)) setForm((f) => ({ ...f, ano: String(yr) }));
    }
  }, [fipeYearId, fipeYears]);

  function openNew() {
    setEditing(null); setForm(emptyV); setOpen(true);
    setFipeBrandId(""); setFipeModelId(""); setFipeYearId("");
  }
  function openEdit(v: Vehicle) {
    setEditing(v);
    setForm({
      customer_id: v.customer_id,
      placa: v.placa ?? "", marca: v.marca ?? "", modelo: v.modelo ?? "",
      ano: v.ano?.toString() ?? "", cor: v.cor ?? "",
      km_atual: v.km_atual?.toString() ?? "", chassi: v.chassi ?? "", observacoes: v.observacoes ?? "",
    });
    setUseFipe(false);
    setFipeBrandId(""); setFipeModelId(""); setFipeYearId("");
    setOpen(true);
  }

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        customer_id: form.customer_id,
        placa: form.placa || null, marca: form.marca || null, modelo: form.modelo || null,
        ano: form.ano ? Number(form.ano) : null, cor: form.cor || null,
        km_atual: form.km_atual ? Number(form.km_atual) : null,
        chassi: form.chassi || null, observacoes: form.observacoes || null,
      };
      if (editing) {
        const { error } = await supabase.from("vehicles").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("vehicles").insert({ ...payload, unit_id: activeUnitId! });
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success(t("common.saved")); setOpen(false); qc.invalidateQueries({ queryKey: ["vehicles"] }); },
    onError: (e) => toast.error(traduzirErro(e)),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("vehicles").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success(t("common.deleted")); qc.invalidateQueries({ queryKey: ["vehicles"] }); },
  });

  if (!activeUnitId) return <EmptyState title={t("common.selectUnit")} />;

  return (
    <div>
      <PageHeader
        title={t("vehicle.title")}
        actions={
          <>
            <Input placeholder={t("common.search")} value={q} onChange={(e) => setQ(e.target.value)} className="w-64" />
            <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" />{t("common.new")}</Button>
          </>
        }
      />

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("vehicle.plate")}</TableHead>
              <TableHead>{t("vehicle.brand")} / {t("vehicle.model")}</TableHead>
              <TableHead>{t("vehicle.year")}</TableHead>
              <TableHead>{t("customer.title").slice(0, -1)}</TableHead>
              <TableHead className="w-24 text-right">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">{t("common.empty")}</TableCell></TableRow>}
            {data.map((v) => (
              <TableRow key={v.id}>
                <TableCell className="font-medium">{v.placa ?? "—"}</TableCell>
                <TableCell>{[v.marca, v.modelo].filter(Boolean).join(" ") || "—"}</TableCell>
                <TableCell>{v.ano ?? "—"}</TableCell>
                <TableCell>{v.customers?.nome ?? "—"}</TableCell>
                <TableCell className="flex justify-end gap-1">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(v)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => { if (confirm(t("common.confirmDelete"))) remove.mutate(v.id); }}><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing ? t("common.edit") : t("common.new")}</DialogTitle></DialogHeader>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>{t("customer.title").slice(0, -1)}<span className="text-destructive"> *</span></Label>
              <Select value={form.customer_id} onValueChange={(v) => setForm({ ...form, customer_id: v })}>
                <SelectTrigger><SelectValue placeholder={t("common.selectCustomer")} /></SelectTrigger>
                <SelectContent>
                  {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2 flex items-center justify-between rounded-md border p-3">
              <div>
                <div className="text-sm font-medium">{t("vehicle.useCatalog")}</div>
                <div className="text-xs text-muted-foreground">{useFipe ? "" : t("vehicle.manualEntry")}</div>
              </div>
              <Switch checked={useFipe} onCheckedChange={setUseFipe} />
            </div>

            {useFipe && (
              <>
                <div>
                  <Label>{t("vehicle.vehicleType")}</Label>
                  <Select value={fipeType} onValueChange={(v) => { setFipeType(v as FipeType); setFipeBrandId(""); setFipeModelId(""); setFipeYearId(""); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cars">{t("vehicle.cars")}</SelectItem>
                      <SelectItem value="motorcycles">{t("vehicle.motorcycles")}</SelectItem>
                      <SelectItem value="trucks">{t("vehicle.trucks")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t("vehicle.brand")}</Label>
                  <Select value={fipeBrandId} onValueChange={(v) => { setFipeBrandId(v); setFipeModelId(""); setFipeYearId(""); }}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent className="max-h-72">{fipeBrands.map((b) => <SelectItem key={b.id} value={b.id}>{b.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t("vehicle.model")}</Label>
                  <Select value={fipeModelId} onValueChange={(v) => { setFipeModelId(v); setFipeYearId(""); }} disabled={!fipeBrandId}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent className="max-h-72">{fipeModels.map((m) => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t("vehicle.year")}</Label>
                  <Select value={fipeYearId} onValueChange={setFipeYearId} disabled={!fipeModelId}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent className="max-h-72">{fipeYears.map((y) => <SelectItem key={y.id} value={y.id}>{y.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </>
            )}

            {!useFipe && (
              <>
                <div><Label>{t("vehicle.brand")}</Label><Input value={form.marca} onChange={(e) => setForm({ ...form, marca: e.target.value })} /></div>
                <div><Label>{t("vehicle.model")}</Label><Input value={form.modelo} onChange={(e) => setForm({ ...form, modelo: e.target.value })} /></div>
                <div><Label>{t("vehicle.year")}</Label><Input type="number" value={form.ano} onChange={(e) => setForm({ ...form, ano: e.target.value })} /></div>
              </>
            )}

            <div><Label>{t("vehicle.plate")}</Label><Input value={form.placa} onChange={(e) => setForm({ ...form, placa: e.target.value.toUpperCase() })} /></div>
            <div><Label>{t("vehicle.color")}</Label><Input value={form.cor} onChange={(e) => setForm({ ...form, cor: e.target.value })} /></div>
            <div><Label>{t("vehicle.km")}</Label><Input type="number" value={form.km_atual} onChange={(e) => setForm({ ...form, km_atual: e.target.value })} /></div>
            <div className="col-span-2"><Label>{t("vehicle.chassis")}</Label><Input value={form.chassi} onChange={(e) => setForm({ ...form, chassi: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button onClick={() => save.mutate()} disabled={!form.customer_id || save.isPending}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
