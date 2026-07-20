import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveUnit } from "@/hooks/use-active-unit";
import { PageHeader, EmptyState } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Boxes } from "lucide-react";
import { traduzirErro } from "@/lib/errors";
import { brl, fmtDate } from "@/lib/format";

export const Route = createFileRoute("/app/pecas")({
  head: () => ({ meta: [{ title: "Peças — OficinaPro" }] }),
  component: PartsPage,
});

interface Part {
  id: string; nome: string; sku: string | null;
  preco_venda_padrao: number | null; ativo: boolean;
}
interface Batch {
  id: string; part_id: string; lote: string | null; quantidade: number;
  preco_custo: number | null; preco_venda: number | null;
  validade: string | null; fornecedor: string | null;
}

const emptyPart = { nome: "", sku: "", preco_venda_padrao: "" };
const emptyBatch = { lote: "", quantidade: "", preco_custo: "", preco_venda: "", validade: "", fornecedor: "" };

function PartsPage() {
  const { activeUnitId } = useActiveUnit();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Part | null>(null);
  const [form, setForm] = useState<Record<string, string>>(emptyPart);
  const [batchesFor, setBatchesFor] = useState<Part | null>(null);

  const { data = [] } = useQuery({
    queryKey: ["parts", activeUnitId, q],
    enabled: !!activeUnitId,
    queryFn: async () => {
      let query = supabase.from("parts").select("*").eq("unit_id", activeUnitId!).order("nome");
      if (q) query = query.or(`nome.ilike.%${q}%,sku.ilike.%${q}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data as Part[];
    },
  });

  function openNew() { setEditing(null); setForm(emptyPart); setOpen(true); }
  function openEdit(p: Part) {
    setEditing(p);
    setForm({
      nome: p.nome, sku: p.sku ?? "",
      preco_venda_padrao: p.preco_venda_padrao?.toString() ?? "",
    });
    setOpen(true);
  }

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        nome: form.nome,
        sku: form.sku || null,
        preco_venda_padrao: form.preco_venda_padrao ? Number(form.preco_venda_padrao) : null,
      };
      if (editing) {
        const { error } = await supabase.from("parts").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("parts").insert({ ...payload, unit_id: activeUnitId!, ativo: true });
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Salvo com sucesso"); setOpen(false); qc.invalidateQueries({ queryKey: ["parts"] }); },
    onError: (e) => toast.error(traduzirErro(e)),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("parts").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Excluído com sucesso"); qc.invalidateQueries({ queryKey: ["parts"] }); },
    onError: (e) => toast.error(traduzirErro(e)),
  });

  if (!activeUnitId) return <EmptyState title="Selecione uma unidade" />;

  return (
    <div>
      <PageHeader
        title="Peças"
        actions={
          <>
            <Input placeholder="Buscar" value={q} onChange={(e) => setQ(e.target.value)} className="w-64" />
            <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" />Nova peça</Button>
          </>
        }
      />

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Preço venda</TableHead>
              <TableHead className="w-40 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Nenhum registro encontrado.</TableCell></TableRow>}
            {data.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.nome}</TableCell>
                <TableCell>{p.sku ?? "—"}</TableCell>
                <TableCell>{p.preco_venda_padrao != null ? brl(p.preco_venda_padrao) : "—"}</TableCell>
                <TableCell className="flex justify-end gap-1">
                  <Button size="icon" variant="ghost" title="Lotes" onClick={() => setBatchesFor(p)}><Boxes className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => { if (confirm("Tem certeza que deseja excluir este registro?")) remove.mutate(p.id); }}><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar peça" : "Nova peça"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Nome *</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
            <div><Label>SKU</Label><Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></div>
            <div><Label>Preço venda</Label><Input type="number" step="0.01" value={form.preco_venda_padrao} onChange={(e) => setForm({ ...form, preco_venda_padrao: e.target.value })} /></div>
          </div>
          <DialogFooter><Button disabled={!form.nome || save.isPending} onClick={() => save.mutate()}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {batchesFor && <BatchesDialog part={batchesFor} unitId={activeUnitId} onClose={() => setBatchesFor(null)} />}
    </div>
  );
}

function BatchesDialog({ part, unitId, onClose }: { part: Part; unitId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Record<string, string>>(emptyBatch);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data = [] } = useQuery({
    queryKey: ["part-batches", part.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("part_batches").select("*").eq("part_id", part.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data as Batch[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        lote: form.lote || null,
        quantidade: form.quantidade ? Number(form.quantidade) : 0,
        preco_custo: form.preco_custo ? Number(form.preco_custo) : null,
        preco_venda: form.preco_venda ? Number(form.preco_venda) : null,
        validade: form.validade || null,
        fornecedor: form.fornecedor || null,
      };
      if (editingId) {
        const { error } = await supabase.from("part_batches").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("part_batches").insert({ ...payload, part_id: part.id, unit_id: unitId });
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Salvo com sucesso"); setForm(emptyBatch); setEditingId(null); qc.invalidateQueries({ queryKey: ["part-batches", part.id] }); },
    onError: (e) => toast.error(traduzirErro(e)),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("part_batches").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["part-batches", part.id] }),
  });

  function edit(b: Batch) {
    setEditingId(b.id);
    setForm({
      lote: b.lote ?? "", quantidade: b.quantidade.toString(),
      preco_custo: b.preco_custo?.toString() ?? "", preco_venda: b.preco_venda?.toString() ?? "",
      validade: b.validade ?? "", fornecedor: b.fornecedor ?? "",
    });
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>Lotes de {part.nome}</DialogTitle></DialogHeader>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lote</TableHead>
                <TableHead>Qtd</TableHead>
                <TableHead>Custo</TableHead>
                <TableHead>Preço venda</TableHead>
                <TableHead>Validade</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead className="w-24 text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Sem lotes cadastrados.</TableCell></TableRow>}
              {data.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>{b.lote ?? "—"}</TableCell>
                  <TableCell>{b.quantidade}</TableCell>
                  <TableCell>{b.preco_custo != null ? brl(b.preco_custo) : "—"}</TableCell>
                  <TableCell>{b.preco_venda != null ? brl(b.preco_venda) : "—"}</TableCell>
                  <TableCell>{fmtDate(b.validade)}</TableCell>
                  <TableCell>{b.fornecedor ?? "—"}</TableCell>
                  <TableCell className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" onClick={() => edit(b)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm("Tem certeza que deseja excluir este registro?")) remove.mutate(b.id); }}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="grid grid-cols-3 gap-3 pt-3">
          <div><Label>Lote</Label><Input value={form.lote} onChange={(e) => setForm({ ...form, lote: e.target.value })} /></div>
          <div><Label>Qtd *</Label><Input type="number" step="0.01" value={form.quantidade} onChange={(e) => setForm({ ...form, quantidade: e.target.value })} /></div>
          <div><Label>Fornecedor</Label><Input value={form.fornecedor} onChange={(e) => setForm({ ...form, fornecedor: e.target.value })} /></div>
          <div><Label>Custo</Label><Input type="number" step="0.01" value={form.preco_custo} onChange={(e) => setForm({ ...form, preco_custo: e.target.value })} /></div>
          <div><Label>Preço venda</Label><Input type="number" step="0.01" value={form.preco_venda} onChange={(e) => setForm({ ...form, preco_venda: e.target.value })} /></div>
          <div><Label>Validade</Label><Input type="date" value={form.validade} onChange={(e) => setForm({ ...form, validade: e.target.value })} /></div>
        </div>

        <DialogFooter>
          {editingId && <Button variant="ghost" onClick={() => { setEditingId(null); setForm(emptyBatch); }}>Cancelar</Button>}
          <Button disabled={!form.quantidade || save.isPending} onClick={() => save.mutate()}>
            {editingId ? "Salvar" : "Adicionar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
