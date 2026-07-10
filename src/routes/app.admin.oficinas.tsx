import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useActiveUnit } from "@/hooks/use-active-unit";
import { PageHeader } from "@/components/page-header";
import { listAllUnits, listUnitStaff, updateMembership, updateUserProfile, resetUserPassword } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Building2, Users, KeyRound, Pencil, Power } from "lucide-react";
import { traduzirErro } from "@/lib/errors";

export const Route = createFileRoute("/app/admin/oficinas")({
  head: () => ({ meta: [{ title: "Admin Geral — Oficinas" }] }),
  component: AdminOficinasPage,
});

type Unit = {
  id: string; nome: string; cidade: string | null; uf: string | null;
  companies: { id: string; razao_social: string; nome_fantasia: string | null; cnpj: string } | null;
};

type StaffRow = {
  id: string; user_id: string; role: string; ativo: boolean;
  profiles: { id: string; email: string; full_name: string | null; phone: string | null } | null;
};

const ROLES = ["oficina_admin", "mecanico", "recepcionista", "financeiro"] as const;

function AdminOficinasPage() {
  const { isSuperAdmin } = useActiveUnit();
  const nav = useNavigate();
  useEffect(() => { if (!isSuperAdmin) nav({ to: "/app/dashboard" }); }, [isSuperAdmin, nav]);

  const list = useServerFn(listAllUnits);
  const [selected, setSelected] = useState<Unit | null>(null);
  const [q, setQ] = useState("");

  const { data: units = [], isLoading } = useQuery({
    queryKey: ["admin-units"],
    queryFn: () => list() as Promise<Unit[]>,
    enabled: isSuperAdmin,
  });

  const filtered = units.filter((u) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return u.nome.toLowerCase().includes(s)
      || (u.companies?.razao_social ?? "").toLowerCase().includes(s)
      || (u.companies?.cnpj ?? "").includes(s);
  });

  if (!isSuperAdmin) return null;

  return (
    <div>
      <PageHeader title="Administração Geral — Oficinas" subtitle="Acesso total às unidades e colaboradores de todas as oficinas do sistema." />
      <div className="mb-4">
        <Input placeholder="Buscar por unidade, razão social ou CNPJ…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-md" />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : (
        <div className="grid gap-3">
          {filtered.map((u) => (
            <div key={u.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-medium">{u.nome}</div>
                  <div className="text-xs text-muted-foreground">
                    {u.companies?.nome_fantasia || u.companies?.razao_social} · CNPJ {u.companies?.cnpj}
                  </div>
                  <div className="text-xs text-muted-foreground">{u.cidade}{u.uf ? ` — ${u.uf}` : ""}</div>
                </div>
              </div>
              <Button variant="outline" onClick={() => setSelected(u)}>
                <Users className="mr-2 h-4 w-4" />Colaboradores
              </Button>
            </div>
          ))}
          {filtered.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma unidade encontrada.</p>}
        </div>
      )}

      {selected && <StaffDialog unit={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function StaffDialog({ unit, onClose }: { unit: Unit; onClose: () => void }) {
  const qc = useQueryClient();
  const list = useServerFn(listUnitStaff);
  const upd = useServerFn(updateMembership);
  const [editing, setEditing] = useState<StaffRow | null>(null);
  const [pwdFor, setPwdFor] = useState<StaffRow | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["unit-staff", unit.id],
    queryFn: () => list({ data: { unitId: unit.id } }) as Promise<StaffRow[]>,
  });

  const mUpd = useMutation({
    mutationFn: (v: { membershipId: string; role?: string; ativo?: boolean }) => upd({ data: v }),
    onSuccess: () => { toast.success("Atualizado"); qc.invalidateQueries({ queryKey: ["unit-staff", unit.id] }); },
    onError: (e) => toast.error(traduzirErro(e)),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{unit.nome} — Colaboradores</DialogTitle>
        </DialogHeader>
        {isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : (
          <div className="space-y-2">
            {rows.length === 0 && <p className="text-sm text-muted-foreground">Sem colaboradores nesta unidade.</p>}
            {rows.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                <div className="min-w-0">
                  <div className="font-medium">{r.profiles?.full_name || r.profiles?.email}</div>
                  <div className="text-xs text-muted-foreground">{r.profiles?.email} · {r.profiles?.phone || "sem telefone"}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={r.role} onValueChange={(v) => mUpd.mutate({ membershipId: r.id, role: v })}>
                    <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                    <SelectContent>{ROLES.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
                  </Select>
                  <Badge variant={r.ativo ? "default" : "outline"}>{r.ativo ? "Ativo" : "Inativo"}</Badge>
                  <Button size="sm" variant="outline" onClick={() => mUpd.mutate({ membershipId: r.id, ativo: !r.ativo })}>
                    <Power className="mr-1 h-4 w-4" />{r.ativo ? "Desativar" : "Ativar"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditing(r)}><Pencil className="mr-1 h-4 w-4" />Editar</Button>
                  <Button size="sm" variant="outline" onClick={() => setPwdFor(r)}><KeyRound className="mr-1 h-4 w-4" />Senha</Button>
                </div>
              </div>
            ))}
          </div>
        )}
        {editing && <EditStaffDialog row={editing} onClose={() => setEditing(null)} onSaved={() => qc.invalidateQueries({ queryKey: ["unit-staff", unit.id] })} />}
        {pwdFor && <ResetPwdDialog row={pwdFor} onClose={() => setPwdFor(null)} />}
      </DialogContent>
    </Dialog>
  );
}

function EditStaffDialog({ row, onClose, onSaved }: { row: StaffRow; onClose: () => void; onSaved: () => void }) {
  const update = useServerFn(updateUserProfile);
  const [full, setFull] = useState(row.profiles?.full_name ?? "");
  const [email, setEmail] = useState(row.profiles?.email ?? "");
  const [phone, setPhone] = useState(row.profiles?.phone ?? "");
  const m = useMutation({
    mutationFn: () => update({ data: { userId: row.user_id, fullName: full, email, phone } }),
    onSuccess: () => { toast.success("Dados atualizados"); onSaved(); onClose(); },
    onError: (e) => toast.error(traduzirErro(e)),
  });
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Editar colaborador</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Nome</Label><Input value={full} onChange={(e) => setFull(e.target.value)} /></div>
          <div><Label>E-mail</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div><Label>Telefone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
        </div>
        <DialogFooter><Button onClick={() => m.mutate()} disabled={m.isPending}>Salvar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResetPwdDialog({ row, onClose }: { row: StaffRow; onClose: () => void }) {
  const reset = useServerFn(resetUserPassword);
  const [pwd, setPwd] = useState("");
  const m = useMutation({
    mutationFn: () => reset({ data: { userId: row.user_id, newPassword: pwd } }),
    onSuccess: () => { toast.success("Senha redefinida"); onClose(); },
    onError: (e) => toast.error(traduzirErro(e)),
  });
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Redefinir senha — {row.profiles?.email}</DialogTitle></DialogHeader>
        <div><Label>Nova senha (mín. 8)</Label><Input value={pwd} onChange={(e) => setPwd(e.target.value)} /></div>
        <DialogFooter><Button disabled={pwd.length < 8 || m.isPending} onClick={() => m.mutate()}>Redefinir</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
