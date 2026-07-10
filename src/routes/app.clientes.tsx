import { traduzirErro } from "@/lib/errors";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useActiveUnit } from "@/hooks/use-active-unit";
import { PageHeader, EmptyState } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ResourceDialog, type Field } from "@/components/resource-dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";

export const Route = createFileRoute("/app/clientes")({
  head: () => ({ meta: [{ title: "Clientes — OficinaPro" }] }),
  component: CustomersPage,
});

interface Customer { id: string; nome: string; cpf_cnpj: string | null; telefone: string | null; email: string | null; endereco: string | null; observacoes: string | null }

function CustomersPage() {
  const { t } = useTranslation();
  const { activeUnitId } = useActiveUnit();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Customer | null>(null);
  const [open, setOpen] = useState(false);

  const { data = [], isLoading } = useQuery({
    queryKey: ["customers", activeUnitId, q],
    enabled: !!activeUnitId,
    queryFn: async () => {
      let query = supabase.from("customers").select("*").eq("unit_id", activeUnitId!).order("nome");
      if (q) query = query.ilike("nome", `%${q}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data as Customer[];
    },
  });

  const save = useMutation({
    mutationFn: async (v: Partial<Customer>) => {
      if (editing) {
        const { error } = await supabase.from("customers").update(v).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("customers").insert({ ...v, unit_id: activeUnitId! } as never);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success(t("common.saved")); setOpen(false); setEditing(null); qc.invalidateQueries({ queryKey: ["customers"] }); },
    onError: (e) => toast.error(traduzirErro(e)),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success(t("common.deleted")); qc.invalidateQueries({ queryKey: ["customers"] }); },
    onError: (e) => toast.error(traduzirErro(e)),
  });

  const fields: Field[] = [
    { name: "nome", label: t("common.name"), required: true, colSpan: 2 },
    { name: "cpf_cnpj", label: t("customer.cpfCnpj") },
    { name: "telefone", label: t("common.phone") },
    { name: "email", label: t("common.email"), type: "email", colSpan: 2 },
    { name: "endereco", label: t("common.address"), colSpan: 2 },
    { name: "observacoes", label: t("customer.notes"), type: "textarea", colSpan: 2 },
  ];

  if (!activeUnitId) return <EmptyState title={t("common.selectUnit")} />;

  return (
    <div>
      <PageHeader
        title={t("customer.title")}
        actions={
          <>
            <Input placeholder={t("common.search")} value={q} onChange={(e) => setQ(e.target.value)} className="w-64" />
            <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="mr-2 h-4 w-4" />{t("common.new")}</Button>
          </>
        }
      />

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("common.name")}</TableHead>
              <TableHead>{t("customer.cpfCnpj")}</TableHead>
              <TableHead>{t("common.phone")}</TableHead>
              <TableHead>{t("common.email")}</TableHead>
              <TableHead className="w-24 text-right">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">{t("common.loading")}</TableCell></TableRow>}
            {!isLoading && data.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">{t("common.empty")}</TableCell></TableRow>}
            {data.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.nome}</TableCell>
                <TableCell>{c.cpf_cnpj ?? "—"}</TableCell>
                <TableCell>{c.telefone ?? "—"}</TableCell>
                <TableCell>{c.email ?? "—"}</TableCell>
                <TableCell className="flex justify-end gap-1">
                  <Button size="icon" variant="ghost" onClick={() => { setEditing(c); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => { if (confirm(t("common.confirmDelete"))) remove.mutate(c.id); }}><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ResourceDialog
        open={open}
        onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}
        title={editing ? t("common.edit") : t("common.new")}
        fields={fields}
        initial={(editing ?? {}) as Record<string, unknown>}
        onSubmit={(v) => save.mutate(v as Partial<Customer>)}
        submitting={save.isPending}
      />
    </div>
  );
}
