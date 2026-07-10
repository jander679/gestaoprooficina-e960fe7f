import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useActiveUnit } from "@/hooks/use-active-unit";
import { PageHeader, EmptyState } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { UserPlus, Trash2, Power, KeyRound, Pencil } from "lucide-react";
import { traduzirErro } from "@/lib/errors";
import { createStaffAccount, updateStaffCredentials, addStaffToUnit } from "@/lib/admin.functions";
import { ROLE_LABEL } from "@/lib/permissions";

export const Route = createFileRoute("/app/colaboradores")({
  head: () => ({ meta: [{ title: "Colaboradores — OficinaPro" }] }),
  component: StaffPage,
});

type Role = "oficina_admin" | "mecanico" | "recepcionista" | "financeiro";
const ROLES: Role[] = ["oficina_admin", "mecanico", "recepcionista", "financeiro"];

interface Membership {
  id: string; user_id: string; role: Role; ativo: boolean;
  profiles: { full_name: string | null; email: string | null; username: string | null; phone: string | null } | null;
}

function StaffPage() {
  const { activeUnitId, activeMembership } = useActiveUnit();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Membership | null>(null);
  const canManage = activeMembership?.role === "oficina_admin";

  const { data: members = [] } = useQuery({
    queryKey: ["memberships-list", activeUnitId],
    enabled: !!activeUnitId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("memberships")
        .select("id,user_id,role,ativo,profiles(full_name,email,username,phone)")
        .eq("unit_id", activeUnitId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Membership[];
    },
  });

  const toggleActive = useMutation({
    mutationFn: async (m: Membership) => {
      const { error } = await supabase.from("memberships").update({ ativo: !m.ativo }).eq("id", m.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Atualizado"); qc.invalidateQueries({ queryKey: ["memberships-list"] }); },
    onError: (e) => toast.error(traduzirErro(e)),
  });

  const changeRole = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: Role }) => {
      const { error } = await supabase.from("memberships").update({ role }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Perfil atualizado"); qc.invalidateQueries({ queryKey: ["memberships-list"] }); },
    onError: (e) => toast.error(traduzirErro(e)),
  });

  const removeMember = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("memberships").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Removido desta unidade"); qc.invalidateQueries({ queryKey: ["memberships-list"] }); },
    onError: (e) => toast.error(traduzirErro(e)),
  });

  if (!activeUnitId) return <EmptyState title="Selecione uma unidade" />;

  return (
    <div>
      <PageHeader
        title="Colaboradores"
        subtitle="Cadastre colaboradores com nome de usuário e senha para acesso ao sistema."
        actions={canManage ? <Button onClick={() => setOpen(true)}><UserPlus className="mr-2 h-4 w-4" />Novo colaborador</Button> : undefined}
      />

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Usuário (login)</TableHead>
              <TableHead>Perfil</TableHead>
              <TableHead>Ativo</TableHead>
              <TableHead className="w-40 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhum colaborador nesta unidade.</TableCell></TableRow>}
            {members.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">{m.profiles?.full_name ?? "—"}</TableCell>
                <TableCell className="font-mono text-xs">{m.profiles?.username ?? "—"}</TableCell>
                <TableCell>
                  {canManage ? (
                    <Select value={m.role} onValueChange={(v) => changeRole.mutate({ id: m.id, role: v as Role })}>
                      <SelectTrigger className="h-8 w-52"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : ROLE_LABEL[m.role]}
                </TableCell>
                <TableCell><Badge variant={m.ativo ? "default" : "secondary"}>{m.ativo ? "Sim" : "Não"}</Badge></TableCell>
                <TableCell className="flex justify-end gap-1">
                  {canManage && (
                    <>
                      <Button size="icon" variant="ghost" title="Editar login / senha" onClick={() => setEditing(m)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" title={m.ativo ? "Desativar" : "Ativar"} onClick={() => toggleActive.mutate(m)}>
                        <Power className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => { if (confirm("Remover deste local?")) removeMember.mutate(m.id); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {open && <NewStaffDialog unitId={activeUnitId} onClose={() => setOpen(false)} onCreated={() => qc.invalidateQueries({ queryKey: ["memberships-list"] })} />}
      {editing && <EditStaffDialog row={editing} unitId={activeUnitId} onClose={() => setEditing(null)} onSaved={() => qc.invalidateQueries({ queryKey: ["memberships-list"] })} />}
    </div>
  );
}

function NewStaffDialog({ unitId, onClose, onCreated }: { unitId: string; onClose: () => void; onCreated: () => void }) {
  const create = useServerFn(createStaffAccount);
  const link = useServerFn(addStaffToUnit);
  const [tab, setTab] = useState<"new" | "existing">("new");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<Role>("mecanico");

  const mCreate = useMutation({
    mutationFn: () => create({ data: { unitId, fullName, username, password, role, phone: phone || undefined } }),
    onSuccess: () => { toast.success(`Colaborador ${username} criado. Compartilhe usuário e senha.`); onCreated(); onClose(); },
    onError: (e) => toast.error(traduzirErro(e)),
  });
  const mLink = useMutation({
    mutationFn: () => link({ data: { unitId, username, role } }),
    onSuccess: () => { toast.success("Colaborador vinculado à unidade."); onCreated(); onClose(); },
    onError: (e) => toast.error(traduzirErro(e)),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Cadastrar colaborador</DialogTitle></DialogHeader>

        <div className="mb-3 flex gap-2 rounded-md bg-muted p-1 text-sm">
          <button type="button" onClick={() => setTab("new")} className={`flex-1 rounded px-3 py-1.5 ${tab === "new" ? "bg-background shadow-sm" : ""}`}>Novo colaborador</button>
          <button type="button" onClick={() => setTab("existing")} className={`flex-1 rounded px-3 py-1.5 ${tab === "existing" ? "bg-background shadow-sm" : ""}`}>Vincular existente</button>
        </div>

        {tab === "new" ? (
          <div className="grid gap-3">
            <div><Label>Nome completo *</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
            <div>
              <Label>Nome de usuário (login) *</Label>
              <Input value={username} onChange={(e) => setUsername(e.target.value.replace(/\s+/g, "").toLowerCase())} placeholder="ex.: joao.mecanico" />
              <p className="mt-1 text-xs text-muted-foreground">Letras, números, ponto, hífen ou sublinhado. Sem espaços.</p>
            </div>
            <div><Label>Senha *</Label><Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="mín. 6 caracteres" /></div>
            <div><Label>Telefone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            <div>
              <Label>Perfil *</Label>
              <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button disabled={!fullName || username.length < 3 || password.length < 6 || mCreate.isPending} onClick={() => mCreate.mutate()}>
                Cadastrar
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="grid gap-3">
            <p className="text-xs text-muted-foreground">Vincule um colaborador já cadastrado em outra unidade da sua empresa.</p>
            <div><Label>Nome de usuário *</Label><Input value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} /></div>
            <div>
              <Label>Perfil nesta unidade *</Label>
              <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button disabled={username.length < 3 || mLink.isPending} onClick={() => mLink.mutate()}>Vincular</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditStaffDialog({ row, unitId, onClose, onSaved }: { row: Membership; unitId: string; onClose: () => void; onSaved: () => void }) {
  const update = useServerFn(updateStaffCredentials);
  const [fullName, setFullName] = useState(row.profiles?.full_name ?? "");
  const [username, setUsername] = useState(row.profiles?.username ?? "");
  const [phone, setPhone] = useState(row.profiles?.phone ?? "");
  const [password, setPassword] = useState("");
  const m = useMutation({
    mutationFn: () => update({ data: {
      userId: row.user_id, unitId,
      fullName, phone,
      username: username !== (row.profiles?.username ?? "") ? username : undefined,
      password: password || undefined,
    } }),
    onSuccess: () => { toast.success("Colaborador atualizado"); onSaved(); onClose(); },
    onError: (e) => toast.error(traduzirErro(e)),
  });
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Editar colaborador</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div><Label>Nome completo</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
          <div><Label>Nome de usuário</Label><Input value={username} onChange={(e) => setUsername(e.target.value.replace(/\s+/g, "").toLowerCase())} /></div>
          <div><Label>Telefone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          <div>
            <Label>Nova senha</Label>
            <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Deixe em branco para não alterar" />
            <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1"><KeyRound className="h-3 w-3" />Compartilhe a nova senha em canal seguro.</p>
          </div>
        </div>
        <DialogFooter><Button onClick={() => m.mutate()} disabled={m.isPending}>Salvar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
