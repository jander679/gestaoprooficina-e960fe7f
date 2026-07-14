import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveUnit } from "@/hooks/use-active-unit";
import { useCan } from "@/hooks/use-can";
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
import { Plus, Trash2, CheckCircle2 } from "lucide-react";
import { brl } from "@/lib/format";
import { traduzirErro } from "@/lib/errors";
import { NoAccess } from "@/components/no-access";

export const Route = createFileRoute("/app/financeiro/contas-pagar")({
  head: () => ({ meta: [{ title: "Contas a Pagar — OficinaPro" }] }),
  component: ContasPagarPage,
});

type Conta = { id: string; descricao: string; categoria: string | null; fornecedor: string | null; valor: number; vencimento: string; pago_em: string | null; metodo: string | null; status: string; observacao: string | null; };

function ContasPagarPage() {
  const canView = useCan("nav.finance");
  const canEdit = useCan("finance:edit");
  const { activeUnitId } = useActiveUnit();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data = [] } = useQuery({
    queryKey: ["contas-pagar", activeUnitId],
    enabled: !!activeUnitId && canView,
    queryFn: async () => {
      const { data, error } = await supabase.from("contas_pagar").select("*").eq("unit_id", activeUnitId!).order("vencimento");
      if (error) throw error;
      return (data ?? []) as Conta[];
    },
  });

  const mPay = useMutation({
    mutationFn: async (c: Conta) => {
      const { error } = await supabase.from("contas_pagar").update({ status: "paga", pago_em: new Date().toISOString() }).eq("id", c.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Marcada como paga"); qc.invalidateQueries({ queryKey: ["contas-pagar", activeUnitId] }); },
    onError: (e) => toast.error(traduzirErro(e)),
  });

  const mDel = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("contas_pagar").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Excluída"); qc.invalidateQueries({ queryKey: ["contas-pagar", activeUnitId] }); },
    onError: (e) => toast.error(traduzirErro(e)),
  });

  if (!canView) return <NoAccess />;
  if (!activeUnitId) return <EmptyState title="Selecione uma unidade" />;

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <PageHeader title="Contas a Pagar" subtitle="Fornecedores, aluguel, folha e outras despesas da oficina."
        actions={canEdit && <Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" />Nova conta</Button>} />

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Descrição</TableHead><TableHead>Categoria</TableHead><TableHead>Fornecedor</TableHead>
            <TableHead>Vencimento</TableHead><TableHead className="text-right">Valor</TableHead>
            <TableHead>Status</TableHead><TableHead className="w-32"></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {data.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Nenhuma conta cadastrada.</TableCell></TableRow>}
            {data.map((c) => {
              const atrasada = c.status !== "paga" && c.status !== "cancelada" && c.vencimento < today;
              return (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.descricao}</TableCell>
                  <TableCell>{c.categoria ?? "—"}</TableCell>
                  <TableCell>{c.fornecedor ?? "—"}</TableCell>
                  <TableCell>{new Date(c.vencimento).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell className="text-right font-medium">{brl(c.valor)}</TableCell>
                  <TableCell><Badge variant={c.status === "paga" ? "default" : atrasada ? "destructive" : "outline"}>{atrasada ? "atrasada" : c.status}</Badge></TableCell>
                  <TableCell className="flex gap-1">
                    {canEdit && c.status !== "paga" && (
                      <Button size="icon" variant="ghost" title="Marcar como paga" onClick={() => mPay.mutate(c)}><CheckCircle2 className="h-4 w-4 text-emerald-600" /></Button>
                    )}
                    {canEdit && (
                      <Button size="icon" variant="ghost" onClick={() => confirm("Excluir?") && mDel.mutate(c.id)}><Trash2 className="h-4 w-4" /></Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {open && canEdit && <NovaContaDialog unitId={activeUnitId} onClose={() => setOpen(false)} />}
    </div>
  );
}

function NovaContaDialog({ unitId, onClose }: { unitId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState("");
  const [fornecedor, setFornecedor] = useState("");
  const [valor, setValor] = useState("");
  const [vencimento, setVencimento] = useState(new Date().toISOString().slice(0, 10));
  const [metodo, setMetodo] = useState("");
  const [obs, setObs] = useState("");
  const [recorrente, setRecorrente] = useState(false);
  const [diaMes, setDiaMes] = useState("");
  const [recAte, setRecAte] = useState("");

  const save = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("contas_pagar").insert({
        unit_id: unitId, descricao, categoria: categoria || null, fornecedor: fornecedor || null,
        valor: Number(valor || 0), vencimento, metodo: metodo || null, observacao: obs || null,
        created_by: u.user?.id,
        recorrente,
        recorrencia_dia_mes: recorrente ? (diaMes ? Number(diaMes) : Number(vencimento.slice(8, 10))) : null,
        recorrencia_ate: recorrente && recAte ? recAte : null,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => { toast.success(recorrente ? "Conta recorrente cadastrada — parcelas geradas" : "Conta cadastrada"); onClose(); qc.invalidateQueries({ queryKey: ["contas-pagar", unitId] }); },
    onError: (e) => toast.error(traduzirErro(e)),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nova conta a pagar</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div><Label>Descrição *</Label><Input value={descricao} onChange={(e) => setDescricao(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Categoria</Label>
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Fornecedor">Fornecedor</SelectItem>
                  <SelectItem value="Aluguel">Aluguel</SelectItem>
                  <SelectItem value="Folha">Folha</SelectItem>
                  <SelectItem value="Impostos">Impostos</SelectItem>
                  <SelectItem value="Utilidades">Utilidades</SelectItem>
                  <SelectItem value="Outros">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Fornecedor</Label><Input value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Valor *</Label><Input type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} /></div>
            <div><Label>Vencimento *</Label><Input type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} /></div>
          </div>
          <div><Label>Método</Label><Input value={metodo} onChange={(e) => setMetodo(e.target.value)} placeholder="pix / boleto / cartão…" /></div>

          <div className="rounded-lg border bg-muted/30 p-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={recorrente} onChange={(e) => setRecorrente(e.target.checked)} />
              Recorrência mensal (gera parcelas automáticas)
            </label>
            {recorrente && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Dia do mês</Label><Input type="number" min={1} max={31} placeholder={vencimento.slice(8, 10)} value={diaMes} onChange={(e) => setDiaMes(e.target.value)} /></div>
                <div><Label className="text-xs">Repetir até (opcional)</Label><Input type="date" value={recAte} onChange={(e) => setRecAte(e.target.value)} /></div>
                <div className="col-span-2 text-xs text-muted-foreground">Se não informar data final, serão geradas as próximas 12 parcelas.</div>
              </div>
            )}
          </div>

          <div><Label>Observação</Label><Textarea value={obs} onChange={(e) => setObs(e.target.value)} /></div>
        </div>
        <DialogFooter><Button disabled={!descricao || !valor || save.isPending} onClick={() => save.mutate()}>Salvar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
