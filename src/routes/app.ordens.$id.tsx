import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, ArrowLeft, Printer, FileDown, Save, Pencil } from "lucide-react";
import { traduzirErro } from "@/lib/errors";
import { brl, fmtDateTime } from "@/lib/format";
import { COMMON, OS_ITEM_TYPE, OS_STATUS, PAYMENT_METHOD, safeLabel } from "@/lib/pt-br";

export const Route = createFileRoute("/app/ordens/$id")({
  head: () => ({ meta: [{ title: "Ordem de Serviço — OficinaPro" }] }),
  component: OrderDetail,
});

type ItemType = "servico" | "peca" | "descricao_livre";
type Method = "dinheiro" | "pix" | "credito" | "debito" | "boleto" | "transferencia" | "outro";
const STATUSES = ["aberta","em_andamento","aguardando_peca","aguardando_aprovacao","concluida","cancelada"] as const;
const METHODS: Method[] = ["dinheiro","pix","credito","debito","boleto","transferencia","outro"];

interface Item {
  id: string; tipo: ItemType; descricao: string; quantidade: number;
  preco_unitario: number; desconto: number; subtotal: number;
}
interface Payment { id: string; metodo: Method; valor: number; pago_em: string; observacao: string | null; }

function OrderDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();

  const { data: os } = useQuery({
    queryKey: ["os", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_orders")
        .select("*, customers(nome,telefone), vehicles(placa,marca,modelo,ano)")
        .eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: items = [] } = useQuery({
    queryKey: ["os-items", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("os_items").select("*").eq("os_id", id).order("created_at");
      if (error) throw error;
      return data as Item[];
    },
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["os-payments", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("os_payments").select("*").eq("os_id", id).order("pago_em", { ascending: false });
      if (error) throw error;
      return data as Payment[];
    },
  });

  const { data: mecanicos = [] } = useQuery({
    queryKey: ["mecanicos-select-os", os?.unit_id],
    enabled: !!os?.unit_id,
    queryFn: async () => {
      const { data } = await supabase.from("memberships")
        .select("user_id, role, ativo, profiles!inner(full_name, username)")
        .eq("unit_id", os!.unit_id).eq("ativo", true);
      return (data ?? []) as unknown as Array<{ user_id: string; role: string; profiles: { full_name: string | null; username: string | null } }>;
    },
  });

  const changeStatus = useMutation({
    mutationFn: async (status: string) => {
      const payload: { status: string; data_conclusao?: string | null; fechada_por?: string | null; fechada_com_saldo?: boolean } = { status };
      if (status === "concluida") {
        payload.data_conclusao = new Date().toISOString();
        const { data: u } = await supabase.auth.getUser();
        payload.fechada_por = u.user?.id ?? null;
        payload.fechada_com_saldo = balance > 0;
      }
      if (status === "aberta" || status === "em_andamento") {
        payload.data_conclusao = null;
        payload.fechada_por = null;
        payload.fechada_com_saldo = false;
      }
      const { error } = await supabase.from("service_orders").update(payload as never).eq("id", id);
      if (error) throw error;
    },

    onSuccess: (_d, status) => {
      const label: Record<string, string> = {
        aberta: "OS reaberta", em_andamento: "OS em andamento", aguardando_peca: "Aguardando peça",
        aguardando_aprovacao: "Aguardando aprovação", concluida: "OS fechada", cancelada: "OS cancelada",
      };
      toast.success(label[status] ?? "Status atualizado");
      qc.invalidateQueries({ queryKey: ["os", id] });
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (e) => toast.error(traduzirErro(e)),
  });

  const removeItem = useMutation({
    mutationFn: async (itemId: string) => { const { error } = await supabase.from("os_items").delete().eq("id", itemId); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["os-items", id] }); qc.invalidateQueries({ queryKey: ["os", id] }); },
    onError: (e) => toast.error(traduzirErro(e)),
  });

  const removePayment = useMutation({
    mutationFn: async (pid: string) => { const { error } = await supabase.from("os_payments").delete().eq("id", pid); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["os-payments", id] }),
    onError: (e) => toast.error(traduzirErro(e)),
  });

  const [itemOpen, setItemOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);

  if (!os) return <div>{COMMON.loading}</div>;
  const total = items.reduce((s, i) => s + Number(i.subtotal), 0);
  const paid = payments.reduce((s, p) => s + Number(p.valor), 0);
  const balance = total - paid;

  const isClosed = os.status === "concluida" || os.status === "cancelada";

  function printPdf() {
    window.open(`/app/ordens/${id}/imprimir?auto=1`, "_blank");
  }

  function fecharOS() {
    if (balance > 0) {
      const ok = confirm(`Existe um saldo em aberto de ${brl(balance)}. Deseja fechar a OS mesmo assim? Ela será marcada como concluída com saldo pendente.`);
      if (!ok) return;
    }
    changeStatus.mutate("concluida");
  }

  return (
    <div>
      <PageHeader
        title={`OS Nº ${os.numero}`}
        actions={
          <>
            <Link to="/app/ordens"><Button variant="ghost"><ArrowLeft className="mr-2 h-4 w-4" />Voltar</Button></Link>
            <Button variant="outline" onClick={printPdf}><Printer className="mr-2 h-4 w-4" />Imprimir</Button>
            <Button variant="outline" onClick={printPdf}><FileDown className="mr-2 h-4 w-4" />PDF</Button>
            {!isClosed && os.status !== "em_andamento" && (
              <Button variant="secondary" onClick={() => changeStatus.mutate("em_andamento")}>Iniciar</Button>
            )}
            {isClosed ? (
              <Button variant="default" onClick={() => changeStatus.mutate("em_andamento")}>Reabrir OS</Button>
            ) : (
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={fecharOS}>Fechar OS</Button>
            )}
            <Select value={os.status} onValueChange={(v) => changeStatus.mutate(v)}>
              <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{safeLabel(OS_STATUS, s)}</SelectItem>)}</SelectContent>
            </Select>
          </>
        }
      />

      {isClosed && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          OS {os.status === "concluida" ? "concluída" : "cancelada"}. Você ainda pode editar dados, adicionar itens ou pagamentos — a OS volta a ficar em andamento automaticamente.
        </div>
      )}


      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border bg-card p-4">
          <div className="text-xs text-muted-foreground">Cliente</div>
          <div className="font-medium">{os.customers?.nome ?? "—"}</div>
          <div className="text-xs text-muted-foreground">{os.customers?.telefone ?? ""}</div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="text-xs text-muted-foreground">Veículo</div>
          <div className="font-medium">{[os.vehicles?.marca, os.vehicles?.modelo].filter(Boolean).join(" ") || "—"}</div>
          <div className="text-xs text-muted-foreground">{os.vehicles?.placa ?? ""} {os.vehicles?.ano ? `· ${os.vehicles.ano}` : ""}</div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="text-xs text-muted-foreground">Aberta em</div>
          <div className="font-medium">{fmtDateTime(os.data_abertura)}</div>
          <Badge className="mt-1" variant="secondary">{safeLabel(OS_STATUS, os.status)}</Badge>
        </div>
      </div>

      <OsEditableFields
        osId={id}
        mecanicoId={os.mecanico_id}
        kmEntrada={os.km_entrada}
        diagnostico={os.diagnostico}
        observacoesCliente={os.observacoes_cliente}
        observacoesInternas={os.observacoes_internas}
        mecanicos={mecanicos}
      />

      <div className="mt-6 rounded-xl border bg-card">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="font-medium">Itens da OS</div>
          <Button size="sm" onClick={() => { setEditingItem(null); setItemOpen(true); }}><Plus className="mr-1 h-4 w-4" />Adicionar item</Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="text-right">Qtd</TableHead>
              <TableHead className="text-right">Preço</TableHead>
              <TableHead className="text-right">Desconto</TableHead>
              <TableHead className="text-right">Subtotal</TableHead>
              <TableHead className="w-24 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">{COMMON.empty}</TableCell></TableRow>}
            {items.map((i) => (
              <TableRow key={i.id}>
                <TableCell><Badge variant="outline">{safeLabel(OS_ITEM_TYPE, i.tipo)}</Badge></TableCell>
                <TableCell>{i.descricao}</TableCell>
                <TableCell className="text-right">{i.quantidade}</TableCell>
                <TableCell className="text-right">{brl(i.preco_unitario)}</TableCell>
                <TableCell className="text-right">{brl(i.desconto)}</TableCell>
                <TableCell className="text-right font-medium">{brl(i.subtotal)}</TableCell>
                <TableCell className="flex justify-end gap-1">
                  <Button size="icon" variant="ghost" title="Editar item" onClick={() => { setEditingItem(i); setItemOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" title="Excluir item" onClick={() => confirm("Excluir este item da OS?") && removeItem.mutate(i.id)}><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border bg-card p-4"><div className="text-xs text-muted-foreground">Total</div><div className="text-2xl font-semibold">{brl(total)}</div></div>
        <div className="rounded-xl border bg-card p-4"><div className="text-xs text-muted-foreground">Pago</div><div className="text-2xl font-semibold text-emerald-600">{brl(paid)}</div></div>
        <div className="rounded-xl border bg-card p-4"><div className="text-xs text-muted-foreground">Saldo</div><div className={`text-2xl font-semibold ${balance > 0 ? "text-amber-600" : ""}`}>{brl(balance)}</div></div>
      </div>

      <div className="mt-6 rounded-xl border bg-card">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="font-medium">Pagamentos</div>
          <Button size="sm" onClick={() => { setEditingPayment(null); setPayOpen(true); }}><Plus className="mr-1 h-4 w-4" />Registrar pagamento</Button>
        </div>
        <Table>
          <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Método</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Observação</TableHead><TableHead className="w-24 text-right">Ações</TableHead></TableRow></TableHeader>
          <TableBody>
            {payments.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">{COMMON.empty}</TableCell></TableRow>}
            {payments.map((p) => (
              <TableRow key={p.id}>
                <TableCell>{fmtDateTime(p.pago_em)}</TableCell>
                <TableCell>{safeLabel(PAYMENT_METHOD, p.metodo)}</TableCell>
                <TableCell className="text-right font-medium">{brl(p.valor)}</TableCell>
                <TableCell>{p.observacao ?? ""}</TableCell>
                <TableCell className="flex justify-end gap-1">
                  <Button size="icon" variant="ghost" title="Editar pagamento" onClick={() => { setEditingPayment(p); setPayOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" title="Excluir pagamento" onClick={() => confirm("Excluir este pagamento da OS?") && removePayment.mutate(p.id)}><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {itemOpen && <ItemDialog osId={id} unitId={os.unit_id} osStatus={os.status} item={editingItem} onClose={() => { setItemOpen(false); setEditingItem(null); }} />}
      {payOpen && <PaymentDialog osId={id} unitId={os.unit_id} osStatus={os.status} payment={editingPayment} onClose={() => { setPayOpen(false); setEditingPayment(null); }} suggested={balance > 0 ? balance : total} />}
    </div>
  );
}

function OsEditableFields({
  osId, mecanicoId, kmEntrada, diagnostico, observacoesCliente, observacoesInternas, mecanicos,
}: {
  osId: string;
  mecanicoId: string | null;
  kmEntrada: number | null;
  diagnostico: string | null;
  observacoesCliente: string | null;
  observacoesInternas: string | null;
  mecanicos: Array<{ user_id: string; role: string; profiles: { full_name: string | null; username: string | null } }>;
}) {
  const qc = useQueryClient();
  const [mec, setMec] = useState(mecanicoId ?? "");
  const [km, setKm] = useState(kmEntrada != null ? String(kmEntrada) : "");
  const [diag, setDiag] = useState(diagnostico ?? "");
  const [obsC, setObsC] = useState(observacoesCliente ?? "");
  const [obsI, setObsI] = useState(observacoesInternas ?? "");

  useEffect(() => {
    setMec(mecanicoId ?? ""); setKm(kmEntrada != null ? String(kmEntrada) : "");
    setDiag(diagnostico ?? ""); setObsC(observacoesCliente ?? ""); setObsI(observacoesInternas ?? "");
  }, [mecanicoId, kmEntrada, diagnostico, observacoesCliente, observacoesInternas]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("service_orders").update({
        mecanico_id: mec || null,
        km_entrada: km ? Number(km) : null,
        diagnostico: diag || null,
        observacoes_cliente: obsC || null,
        observacoes_internas: obsI || null,
      }).eq("id", osId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Atualizado"); qc.invalidateQueries({ queryKey: ["os", osId] }); },
    onError: (e) => toast.error(traduzirErro(e)),
  });

  return (
    <div className="mt-6 rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="font-medium">Dados da OS</div>
        <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
          <Save className="mr-1 h-4 w-4" />Salvar alterações
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label>Mecânico responsável</Label>
          <Select value={mec || "none"} onValueChange={(v) => setMec(v === "none" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— Nenhum —</SelectItem>
              {mecanicos.map((m) => (
                <SelectItem key={m.user_id} value={m.user_id}>
                  {m.profiles.full_name || m.profiles.username || "—"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>KM na entrada</Label>
          <Input type="number" value={km} onChange={(e) => setKm(e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <Label>Diagnóstico</Label>
          <Textarea rows={3} value={diag} onChange={(e) => setDiag(e.target.value)} />
        </div>
        <div>
          <Label>Observações ao cliente</Label>
          <Textarea rows={4} value={obsC} onChange={(e) => setObsC(e.target.value)} />
        </div>
        <div>
          <Label>Observações internas</Label>
          <Textarea rows={4} value={obsI} onChange={(e) => setObsI(e.target.value)} />
        </div>
      </div>
    </div>
  );
}

function ItemDialog({ osId, unitId, osStatus, onClose }: { osId: string; unitId: string; osStatus: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [tipo, setTipo] = useState<ItemType>("servico");
  const [descricao, setDescricao] = useState("");
  const [quantidade, setQuantidade] = useState("1");
  const [preco, setPreco] = useState("");
  const [desconto, setDesconto] = useState("0");
  const [refId, setRefId] = useState<string>("");

  const { data: services = [] } = useQuery({
    queryKey: ["services-select", unitId],
    enabled: tipo === "servico",
    queryFn: async () => {
      const { data } = await supabase.from("services_catalog").select("id,nome,preco_padrao").eq("unit_id", unitId).order("nome");
      return data ?? [];
    },
  });
  const { data: parts = [] } = useQuery({
    queryKey: ["parts-select", unitId],
    enabled: tipo === "peca",
    queryFn: async () => {
      const { data } = await supabase.from("parts").select("id,nome,preco_venda_padrao").eq("unit_id", unitId).order("nome");
      return data ?? [];
    },
  });

  function pickCatalog(id: string) {
    setRefId(id);
    if (tipo === "servico") {
      const s = services.find((x: { id: string }) => x.id === id) as { nome: string; preco_padrao: number | null } | undefined;
      if (s) { setDescricao(s.nome); if (s.preco_padrao != null) setPreco(String(s.preco_padrao)); }
    } else if (tipo === "peca") {
      const p = parts.find((x: { id: string }) => x.id === id) as { nome: string; preco_venda_padrao: number | null } | undefined;
      if (p) { setDescricao(p.nome); if (p.preco_venda_padrao != null) setPreco(String(p.preco_venda_padrao)); }
    }
  }

  const save = useMutation({
    mutationFn: async () => {
      const q = Number(quantidade || 0), pu = Number(preco || 0), d = Number(desconto || 0);
      const subtotal = Math.max(0, q * pu - d);
      const { error } = await supabase.from("os_items").insert({
        os_id: osId, unit_id: unitId, tipo, descricao,
        referencia_id: refId || null, quantidade: q, preco_unitario: pu, desconto: d, subtotal,
      });
      if (error) throw error;
      if (osStatus === "concluida" || osStatus === "cancelada") {
        await supabase.from("service_orders").update({ status: "em_andamento", data_conclusao: null, fechada_por: null, fechada_com_saldo: false } as never).eq("id", osId);
      }
    },
    onSuccess: () => {
      toast.success(osStatus === "concluida" || osStatus === "cancelada" ? "Item adicionado — OS reaberta" : COMMON.saved);
      onClose();
      qc.invalidateQueries({ queryKey: ["os-items", osId] });
      qc.invalidateQueries({ queryKey: ["os", osId] });
    },
    onError: (e) => toast.error(traduzirErro(e)),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Adicionar item</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={(v) => { setTipo(v as ItemType); setRefId(""); setDescricao(""); setPreco(""); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="servico">Serviço</SelectItem>
                <SelectItem value="peca">Peça</SelectItem>
                <SelectItem value="descricao_livre">Descrição livre</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {tipo === "servico" && (
            <div>
              <Label>Referência do catálogo</Label>
              <Select value={refId} onValueChange={pickCatalog}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{services.map((s: { id: string; nome: string }) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          {tipo === "peca" && (
            <div>
              <Label>Referência do catálogo</Label>
              <Select value={refId} onValueChange={pickCatalog}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{parts.map((p: { id: string; nome: string }) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div><Label>Descrição *</Label><Input value={descricao} onChange={(e) => setDescricao(e.target.value)} /></div>
          <div className="grid grid-cols-3 gap-2">
            <div><Label>Qtd</Label><Input type="number" step="0.01" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} /></div>
            <div><Label>Preço</Label><Input type="number" step="0.01" value={preco} onChange={(e) => setPreco(e.target.value)} /></div>
            <div><Label>Desconto</Label><Input type="number" step="0.01" value={desconto} onChange={(e) => setDesconto(e.target.value)} /></div>
          </div>
        </div>
        <DialogFooter><Button disabled={!descricao || save.isPending} onClick={() => save.mutate()}>Adicionar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PaymentDialog({ osId, unitId, osStatus, onClose, suggested }: { osId: string; unitId: string; osStatus: string; onClose: () => void; suggested: number }) {
  const qc = useQueryClient();
  const [metodo, setMetodo] = useState<Method>("pix");
  const [valor, setValor] = useState(String(suggested || ""));
  const [obs, setObs] = useState("");

  const save = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("os_payments").insert({
        os_id: osId, unit_id: unitId, metodo, valor: Number(valor || 0),
        observacao: obs || null, created_by: u.user?.id,
      });
      if (error) throw error;
      if (osStatus === "concluida" || osStatus === "cancelada") {
        await supabase.from("service_orders").update({ status: "em_andamento", data_conclusao: null, fechada_por: null, fechada_com_saldo: false } as never).eq("id", osId);
      }
    },
    onSuccess: () => {
      toast.success(osStatus === "concluida" || osStatus === "cancelada" ? "Pagamento adicionado — OS reaberta" : COMMON.saved);
      onClose();
      qc.invalidateQueries({ queryKey: ["os-payments", osId] });
      qc.invalidateQueries({ queryKey: ["os", osId] });
    },
    onError: (e) => toast.error(traduzirErro(e)),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Registrar pagamento</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>Método</Label>
            <Select value={metodo} onValueChange={(v) => setMetodo(v as Method)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{METHODS.map((m) => <SelectItem key={m} value={m}>{safeLabel(PAYMENT_METHOD, m)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Valor *</Label><Input type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} /></div>
          <div><Label>Observação</Label><Textarea value={obs} onChange={(e) => setObs(e.target.value)} /></div>
        </div>
        <DialogFooter><Button disabled={!valor || save.isPending} onClick={() => save.mutate()}>Salvar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
