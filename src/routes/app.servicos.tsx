import { traduzirErro } from "@/lib/errors";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveUnit } from "@/hooks/use-active-unit";
import { PageHeader, EmptyState } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ResourceDialog, type Field } from "@/components/resource-dialog";
import { toast } from "sonner";
import { brl } from "@/lib/format";
import { Plus, Pencil, Trash2 } from "lucide-react";

export const Route = createFileRoute("/app/servicos")({
  head: () => ({ meta: [{ title: "Serviços — OficinaPro" }] }),
  component: ServicesPage,
});

interface Service { id: string; nome: string; descricao: string | null; preco_padrao: number; tempo_estimado_min: number | null; ativo: boolean }

function ServicesPage() {
  const { activeUnitId } = useActiveUnit();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);

  const { data = [] } = useQuery({
    queryKey: ["services", activeUnitId],
    enabled: !!activeUnitId,
    queryFn: async () => {
      const { data, error } = await supabase.from("services_catalog").select("*").eq("unit_id", activeUnitId!).order("nome");
      if (error) throw error;
      return data as Service[];
    },
  });

  const save = useMutation({
    mutationFn: async (v: Partial<Service>) => {
      const payload = { ...v, preco_padrao: Number(v.preco_padrao ?? 0), tempo_estimado_min: v.tempo_estimado_min ? Number(v.tempo_estimado_min) : null };
      if (editing) { const { error } = await supabase.from("services_catalog").update(payload).eq("id", editing.id); if (error) throw error; }
      else { const { error } = await supabase.from("services_catalog").insert({ ...payload, unit_id: activeUnitId! } as never); if (error) throw error; }
    },
    onSuccess: () => { toast.success("Salvo com sucesso"); setOpen(false); setEditing(null); qc.invalidateQueries({ queryKey: ["services"] }); },
    onError: (e) => toast.error(traduzirErro(e)),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("services_catalog").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["services"] }); },
  });

  const fields: Field[] = [
    { name: "nome", label: "Nome", required: true, colSpan: 2 },
    { name: "descricao", label: "Descrição", type: "textarea", colSpan: 2 },
    { name: "preco_padrao", label: "Preço padrão", type: "number", required: true },
    { name: "tempo_estimado_min", label: "Tempo estimado (min)", type: "number" },
  ];

  if (!activeUnitId) return <EmptyState title="Selecione uma unidade" />;

  return (
    <div>
      <PageHeader title="Serviços" actions={<Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="mr-2 h-4 w-4" />Novo</Button>} />
      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Preço padrão</TableHead>
            <TableHead>Tempo estimado</TableHead>
            <TableHead className="w-24 text-right">Ações</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {data.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Nenhum registro encontrado.</TableCell></TableRow>}
            {data.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.nome}</TableCell>
                <TableCell>{brl(s.preco_padrao)}</TableCell>
                <TableCell>{s.tempo_estimado_min ? `${s.tempo_estimado_min} min` : "—"}</TableCell>
                <TableCell className="flex justify-end gap-1">
                  <Button size="icon" variant="ghost" onClick={() => { setEditing(s); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => { if (confirm("Tem certeza que deseja excluir este registro?")) remove.mutate(s.id); }}><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ResourceDialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}
        title={editing ? "Editar" : "Novo"}
        fields={fields} initial={(editing ?? {}) as Record<string, unknown>} onSubmit={(v) => save.mutate(v as Partial<Service>)} submitting={save.isPending} />
    </div>
  );
}
