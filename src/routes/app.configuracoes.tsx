import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useActiveUnit } from "@/hooks/use-active-unit";
import { PageHeader, EmptyState } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Building2, Pencil, Trash2 } from "lucide-react";
import { traduzirErro } from "@/lib/errors";

export const Route = createFileRoute("/app/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — OficinaPro" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <div>
      <PageHeader title="Configurações" />
      <Tabs defaultValue="company">
        <TabsList>
          <TabsTrigger value="company">Empresa</TabsTrigger>
          <TabsTrigger value="units">Unidades</TabsTrigger>
          <TabsTrigger value="fipe">Base FIPE</TabsTrigger>
        </TabsList>
        <TabsContent value="company" className="mt-6"><CompanySection /></TabsContent>
        <TabsContent value="units" className="mt-6"><UnitsSection /></TabsContent>
        <TabsContent value="fipe" className="mt-6"><FipeSection /></TabsContent>
      </Tabs>
    </div>
  );
}

function FipeSection() {
  const [busy, setBusy] = useState<string | null>(null);
  const [syncYears, setSyncYears] = useState(false);
  const types: Array<{ id: "cars" | "motorcycles" | "trucks"; label: string }> = [
    { id: "cars", label: "Carros" },
    { id: "motorcycles", label: "Motos" },
    { id: "trucks", label: "Caminhões" },
  ];
  async function sync(type: string) {
    setBusy(type);
    try {
      const res = await fetch("/api/public/hooks/fipe-sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type, sync_years: syncYears }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
      toast.success(`Sincronizado: ${j.brands} marcas, ${j.models} modelos${j.years ? `, ${j.years} anos` : ""}`);
    } catch (e) {
      toast.error(traduzirErro(e));
    } finally { setBusy(null); }
  }
  return (
    <div className="space-y-4 rounded-xl border bg-card p-6">
      <div>
        <div className="font-display text-lg font-semibold">Sincronizar base FIPE</div>
        <p className="mt-1 text-sm text-muted-foreground">
          Popula/atualiza marcas e modelos do catálogo brasileiro (Parallelum FIPE). Rode uma vez por tipo.
          Ative "incluir anos" apenas se quiser a lista de anos por modelo (demora bem mais).
        </p>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={syncYears} onChange={(e) => setSyncYears(e.target.checked)} />
        Incluir anos (lento)
      </label>
      <div className="flex flex-wrap gap-2">
        {types.map((tp) => (
          <Button key={tp.id} variant="outline" disabled={busy !== null} onClick={() => sync(tp.id)}>
            {busy === tp.id ? "Sincronizando..." : `Sincronizar ${tp.label}`}
          </Button>
        ))}
      </div>
    </div>
  );
}

function CompanySection() {
  const { user } = useAuth();
  const { activeMembership, refetch } = useActiveUnit();
  const qc = useQueryClient();
  const companyId = activeMembership?.units?.company_id ?? null;
  const company = activeMembership?.units?.companies ?? null;

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ cnpj: "", razao_social: "", nome_fantasia: "", nome: "" });

  // Edição
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ cnpj: "", razao_social: "", nome_fantasia: "" });

  function startEdit() {
    if (!company) return;
    setEditForm({ cnpj: company.cnpj ?? "", razao_social: company.razao_social ?? "", nome_fantasia: company.nome_fantasia ?? "" });
    setEditing(true);
  }

  const update = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("Sem empresa ativa");
      const { error } = await supabase.from("companies").update({
        cnpj: editForm.cnpj.trim(),
        razao_social: editForm.razao_social.trim(),
        nome_fantasia: editForm.nome_fantasia.trim() || null,
      }).eq("id", companyId);
      if (error) throw error;
    },
    onSuccess: async () => { toast.success("Empresa atualizada"); setEditing(false); await qc.invalidateQueries(); await refetch(); },
    onError: (e) => toast.error(traduzirErro(e)),
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sessão expirada. Faça login novamente.");
      const { data: c, error } = await supabase.from("companies")
        .insert({
          cnpj: form.cnpj.trim(),
          razao_social: form.razao_social.trim(),
          nome_fantasia: form.nome_fantasia.trim() || null,
          criada_por: user.id,
        })
        .select().single();
      if (error) throw error;
      const { error: uerr } = await supabase.from("units")
        .insert({ company_id: c.id, nome: form.nome.trim() || "Matriz" });
      if (uerr) throw uerr;
    },
    onSuccess: async () => {
      toast.success("Empresa cadastrada com sucesso!");
      setOpen(false);
      setForm({ cnpj: "", razao_social: "", nome_fantasia: "", nome: "" });
      await qc.invalidateQueries();
      await refetch();
    },
    onError: (e) => toast.error(traduzirErro(e)),
  });

  if (!companyId) {
    return (
      <EmptyState
        title="Nenhuma empresa cadastrada"
        description="Cadastre sua empresa (CNPJ) e a primeira unidade para começar."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Cadastrar empresa</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nova empresa</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>CNPJ <span className="text-destructive">*</span></Label><Input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} /></div>
                <div><Label>Razão Social <span className="text-destructive">*</span></Label><Input value={form.razao_social} onChange={(e) => setForm({ ...form, razao_social: e.target.value })} /></div>
                <div><Label>Nome Fantasia</Label><Input value={form.nome_fantasia} onChange={(e) => setForm({ ...form, nome_fantasia: e.target.value })} /></div>
                <div><Label>Nome da primeira unidade</Label><Input placeholder="Matriz" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
              </div>
              <DialogFooter>
                <Button onClick={() => create.mutate()} disabled={!form.cnpj.trim() || !form.razao_social.trim() || create.isPending}>
                  {create.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
    );
  }

  return (
    <div className="rounded-xl border bg-card p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Building2 className="mt-1 h-5 w-5 text-muted-foreground" />
          <div>
            <div className="font-display text-lg font-semibold">{company?.nome_fantasia || company?.razao_social}</div>
            <div className="text-sm text-muted-foreground">Razão social: {company?.razao_social}</div>
            <div className="text-sm text-muted-foreground">CNPJ: {company?.cnpj}</div>
          </div>
        </div>
        {!editing && <Button variant="outline" size="sm" onClick={startEdit}><Pencil className="mr-2 h-4 w-4" />Editar</Button>}
      </div>

      {editing && (
        <div className="mt-4 space-y-3 border-t pt-4">
          <div><Label>CNPJ *</Label><Input value={editForm.cnpj} onChange={(e) => setEditForm({ ...editForm, cnpj: e.target.value })} /></div>
          <div><Label>Razão Social *</Label><Input value={editForm.razao_social} onChange={(e) => setEditForm({ ...editForm, razao_social: e.target.value })} /></div>
          <div><Label>Nome Fantasia</Label><Input value={editForm.nome_fantasia} onChange={(e) => setEditForm({ ...editForm, nome_fantasia: e.target.value })} /></div>
          <div className="flex gap-2">
            <Button onClick={() => update.mutate()} disabled={!editForm.cnpj.trim() || !editForm.razao_social.trim() || update.isPending}>
              {update.isPending ? "Salvando..." : "Salvar alterações"}
            </Button>
            <Button variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>
          </div>
        </div>
      )}
    </div>
  );
}

type Unit = { id: string; nome: string; endereco: string | null; cidade: string | null; uf: string | null; cep: string | null; telefone: string | null; company_id: string };

function UnitsSection() {
  const { activeMembership, memberships, refetch } = useActiveUnit();
  const companyId = activeMembership?.units?.company_id;
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ nome: "", endereco: "", cidade: "", uf: "", cep: "", telefone: "" });
  const [editUnit, setEditUnit] = useState<Unit | null>(null);

  const { data: units = [] } = useQuery({
    queryKey: ["units-of-company", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase.from("units").select("*").eq("company_id", companyId!).order("nome");
      if (error) throw error;
      return data as Unit[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("units").insert({ ...form, company_id: companyId! });
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Unidade cadastrada com sucesso!");
      setOpen(false);
      setForm({ nome: "", endereco: "", cidade: "", uf: "", cep: "", telefone: "" });
      await qc.invalidateQueries();
      await refetch();
    },
    onError: (e) => toast.error(traduzirErro(e)),
  });

  const removeUnit = useMutation({
    mutationFn: async (id: string) => {
      const { count } = await supabase.from("service_orders").select("*", { count: "exact", head: true }).eq("unit_id", id);
      if ((count ?? 0) > 0) throw new Error("Esta unidade possui ordens de serviço vinculadas. Exclusão bloqueada.");
      const { error } = await supabase.from("units").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => { toast.success("Unidade excluída"); await qc.invalidateQueries(); await refetch(); },
    onError: (e) => toast.error(traduzirErro(e)),
  });

  if (!companyId) return <p className="text-sm text-muted-foreground">Cadastre uma empresa primeiro.</p>;

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Nova unidade</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova unidade</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Nome <span className="text-destructive">*</span></Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
              <div className="col-span-2"><Label>Endereço</Label><Input value={form.endereco} onChange={(e) => setForm({ ...form, endereco: e.target.value })} /></div>
              <div><Label>Cidade</Label><Input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} /></div>
              <div><Label>UF</Label><Input maxLength={2} value={form.uf} onChange={(e) => setForm({ ...form, uf: e.target.value.toUpperCase() })} /></div>
              <div><Label>CEP</Label><Input value={form.cep} onChange={(e) => setForm({ ...form, cep: e.target.value })} /></div>
              <div><Label>Telefone</Label><Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button onClick={() => create.mutate()} disabled={!form.nome.trim() || create.isPending}>
                {create.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {units.map((u) => (
          <div key={u.id} className="rounded-xl border bg-card p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-medium">{u.nome}</div>
                <div className="mt-1 text-sm text-muted-foreground">{[u.endereco, u.cidade, u.uf].filter(Boolean).join(", ") || "—"}</div>
                {u.cep && <div className="text-sm text-muted-foreground">CEP: {u.cep}</div>}
                {u.telefone && <div className="text-sm text-muted-foreground">Tel: {u.telefone}</div>}
                {!memberships.find((m) => m.unit_id === u.id) && (
                  <div className="mt-2 text-xs text-warning">Você não tem vínculo nesta unidade</div>
                )}
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => setEditUnit(u)}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => confirm(`Excluir unidade "${u.nome}"?`) && removeUnit.mutate(u.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editUnit && <EditUnitDialog unit={editUnit} onClose={() => setEditUnit(null)} />}
    </div>
  );
}

function EditUnitDialog({ unit, onClose }: { unit: Unit; onClose: () => void }) {
  const qc = useQueryClient();
  const { refetch } = useActiveUnit();
  const [f, setF] = useState({
    nome: unit.nome ?? "", endereco: unit.endereco ?? "", cidade: unit.cidade ?? "",
    uf: unit.uf ?? "", cep: unit.cep ?? "", telefone: unit.telefone ?? "",
  });

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("units").update({
        nome: f.nome.trim(),
        endereco: f.endereco.trim() || null,
        cidade: f.cidade.trim() || null,
        uf: f.uf.trim() || null,
        cep: f.cep.trim() || null,
        telefone: f.telefone.trim() || null,
      }).eq("id", unit.id);
      if (error) throw error;
    },
    onSuccess: async () => { toast.success("Unidade atualizada"); onClose(); await qc.invalidateQueries(); await refetch(); },
    onError: (e) => toast.error(traduzirErro(e)),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Editar unidade</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><Label>Nome *</Label><Input value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} /></div>
          <div className="col-span-2"><Label>Endereço</Label><Input value={f.endereco} onChange={(e) => setF({ ...f, endereco: e.target.value })} /></div>
          <div><Label>Cidade</Label><Input value={f.cidade} onChange={(e) => setF({ ...f, cidade: e.target.value })} /></div>
          <div><Label>UF</Label><Input maxLength={2} value={f.uf} onChange={(e) => setF({ ...f, uf: e.target.value.toUpperCase() })} /></div>
          <div><Label>CEP</Label><Input value={f.cep} onChange={(e) => setF({ ...f, cep: e.target.value })} /></div>
          <div><Label>Telefone</Label><Input value={f.telefone} onChange={(e) => setF({ ...f, telefone: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button onClick={() => save.mutate()} disabled={!f.nome.trim() || save.isPending}>{save.isPending ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
