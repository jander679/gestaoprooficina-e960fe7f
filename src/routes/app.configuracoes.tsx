import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
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
import { Plus, Building2 } from "lucide-react";
import { traduzirErro } from "@/lib/errors";

export const Route = createFileRoute("/app/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — OficinaPro" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { t } = useTranslation();
  return (
    <div>
      <PageHeader title={t("settings.title")} />
      <Tabs defaultValue="company">
        <TabsList>
          <TabsTrigger value="company">{t("settings.company")}</TabsTrigger>
          <TabsTrigger value="units">{t("settings.units")}</TabsTrigger>
        </TabsList>
        <TabsContent value="company" className="mt-6"><CompanySection /></TabsContent>
        <TabsContent value="units" className="mt-6"><UnitsSection /></TabsContent>
      </Tabs>
    </div>
  );
}

function CompanySection() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { activeMembership, refetch } = useActiveUnit();
  const qc = useQueryClient();
  const companyId = activeMembership?.units?.company_id ?? null;

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ cnpj: "", razao_social: "", nome_fantasia: "", nome: "" });

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
      // O trigger no banco cria a membership do criador automaticamente.
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
                <div><Label>{t("settings.cnpj")} <span className="text-destructive">*</span></Label><Input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} /></div>
                <div><Label>{t("settings.razaoSocial")} <span className="text-destructive">*</span></Label><Input value={form.razao_social} onChange={(e) => setForm({ ...form, razao_social: e.target.value })} /></div>
                <div><Label>{t("settings.nomeFantasia")}</Label><Input value={form.nome_fantasia} onChange={(e) => setForm({ ...form, nome_fantasia: e.target.value })} /></div>
                <div><Label>Nome da primeira unidade</Label><Input placeholder="Matriz" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
              </div>
              <DialogFooter>
                <Button onClick={() => create.mutate()} disabled={!form.cnpj.trim() || !form.razao_social.trim() || create.isPending}>
                  {create.isPending ? "Salvando..." : t("common.save")}
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
      <div className="flex items-center gap-3">
        <Building2 className="h-5 w-5 text-muted-foreground" />
        <div>
          <div className="font-display text-lg font-semibold">
            {activeMembership?.units?.companies?.nome_fantasia || activeMembership?.units?.companies?.razao_social}
          </div>
          <div className="text-sm text-muted-foreground">CNPJ: {activeMembership?.units?.companies?.cnpj}</div>
        </div>
      </div>
    </div>
  );
}

function UnitsSection() {
  const { t } = useTranslation();
  const { activeMembership, memberships, refetch } = useActiveUnit();
  const companyId = activeMembership?.units?.company_id;
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ nome: "", endereco: "", cidade: "", uf: "", cep: "", telefone: "" });

  const { data: units = [] } = useQuery({
    queryKey: ["units-of-company", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase.from("units").select("*").eq("company_id", companyId!).order("nome");
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("units").insert({ ...form, company_id: companyId! });
      if (error) throw error;
      // Trigger no banco cria automaticamente a membership do criador.
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

  if (!companyId) return <p className="text-sm text-muted-foreground">Cadastre uma empresa primeiro.</p>;

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />{t("settings.newUnit")}</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t("settings.newUnit")}</DialogTitle></DialogHeader>
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
                {create.isPending ? "Salvando..." : t("common.save")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {units.map((u) => (
          <div key={u.id} className="rounded-xl border bg-card p-4">
            <div className="font-medium">{u.nome}</div>
            <div className="mt-1 text-sm text-muted-foreground">{[u.endereco, u.cidade, u.uf].filter(Boolean).join(", ") || "—"}</div>
            {u.telefone && <div className="text-sm text-muted-foreground">{u.telefone}</div>}
            {!memberships.find((m) => m.unit_id === u.id) && (
              <div className="mt-2 text-xs text-warning">Você não tem vínculo nesta unidade</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
