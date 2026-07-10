import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useActiveUnit } from "@/hooks/use-active-unit";
import { PageHeader } from "@/components/page-header";
import {
  listAccounts, setAccountStatus, setAccountValidity,
  updateUserProfile, resetUserPassword, revokeUserAccess,
} from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Play, Pause, Check, X, Calendar, KeyRound, Pencil, Ban, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/app/admin/contas")({
  head: () => ({ meta: [{ title: "Admin Geral — Contas" }] }),
  component: AdminAccountsPage,
});

type Account = {
  user_id: string;
  status: string;
  valid_until: string | null;
  paused_at: string | null;
  reason: string | null;
  updated_at: string;
  profile: { id: string; email: string; full_name: string | null; phone: string | null } | null;
  roles: string[];
  memberships: Array<{ role: string; ativo: boolean; units: { nome: string; companies: { razao_social: string; nome_fantasia: string | null; cnpj: string } | null } | null }>;
};

const statusStyle: Record<string, string> = {
  approved: "bg-green-500/15 text-green-700 dark:text-green-400",
  pending: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  paused: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
  expired: "bg-red-500/15 text-red-700 dark:text-red-400",
  rejected: "bg-red-500/15 text-red-700 dark:text-red-400",
};

function AdminAccountsPage() {
  const { isSuperAdmin } = useActiveUnit();
  const nav = useNavigate();
  useEffect(() => { if (!isSuperAdmin) nav({ to: "/app/dashboard" }); }, [isSuperAdmin, nav]);

  const qc = useQueryClient();
  const list = useServerFn(listAccounts);
  const setStatus = useServerFn(setAccountStatus);
  const setValidity = useServerFn(setAccountValidity);
  const revoke = useServerFn(revokeUserAccess);

  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [editing, setEditing] = useState<Account | null>(null);
  const [pwdFor, setPwdFor] = useState<Account | null>(null);
  const [dateFor, setDateFor] = useState<Account | null>(null);

  const { data = [], isLoading } = useQuery({
    queryKey: ["admin-accounts"],
    queryFn: () => list() as Promise<Account[]>,
    enabled: isSuperAdmin,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-accounts"] });

  const mStatus = useMutation({
    mutationFn: (v: { userId: string; status: "approved" | "rejected" | "paused"; reason?: string }) =>
      setStatus({ data: v }),
    onSuccess: () => { toast.success("Status atualizado"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const mValidity = useMutation({
    mutationFn: (v: { userId: string; validUntil: string | null }) => setValidity({ data: v }),
    onSuccess: () => { toast.success("Validade atualizada"); invalidate(); setDateFor(null); },
    onError: (e: Error) => toast.error(e.message),
  });
  const mRevoke = useMutation({
    mutationFn: (userId: string) => revoke({ data: { userId } }),
    onSuccess: () => { toast.success("Acesso revogado"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = data.filter((a) => {
    if (filter !== "all" && a.status !== filter) return false;
    if (!q) return true;
    const s = q.toLowerCase();
    return (a.profile?.email ?? "").toLowerCase().includes(s)
        || (a.profile?.full_name ?? "").toLowerCase().includes(s);
  });

  if (!isSuperAdmin) return null;

  return (
    <div>
      <PageHeader title="Administração Geral" subtitle="Aprove, pause, defina validade e gerencie contas de clientes do sistema." />

      <div className="mb-4 flex flex-wrap gap-3">
        <Input placeholder="Buscar por nome ou e-mail…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Pendentes</SelectItem>
            <SelectItem value="approved">Aprovados</SelectItem>
            <SelectItem value="paused">Pausados</SelectItem>
            <SelectItem value="expired">Expirados</SelectItem>
            <SelectItem value="rejected">Rejeitados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma conta encontrada.</p>
      ) : (
        <div className="grid gap-3">
          {filtered.map((a) => {
            const expired = a.valid_until && new Date(a.valid_until) < new Date(new Date().toDateString());
            const effectiveStatus = expired ? "expired" : a.status;
            const isSuper = a.roles.includes("super_admin");
            const paused = a.status === "paused";
            return (
              <div key={a.user_id} className="rounded-xl border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-medium">{a.profile?.full_name || "—"}</div>
                      <Badge variant="outline" className={statusStyle[effectiveStatus] ?? ""}>{effectiveStatus}</Badge>
                      {isSuper && (
                        <Badge className="bg-primary/15 text-primary">
                          <ShieldAlert className="mr-1 h-3 w-3" />Super Admin
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">{a.profile?.email}</div>
                    {a.memberships.length > 0 && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        {a.memberships.map((m, i) => (
                          <span key={i}>
                            {m.units?.companies?.nome_fantasia || m.units?.companies?.razao_social}
                            {" · "}{m.units?.nome} ({m.role})
                            {i < a.memberships.length - 1 ? " | " : ""}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="mt-1 text-xs text-muted-foreground">
                      Liberado até: {a.valid_until ? new Date(a.valid_until).toLocaleDateString("pt-BR") : "indefinido"}
                      {a.reason ? ` · Motivo: ${a.reason}` : ""}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {a.status === "pending" && (
                      <>
                        <Button size="sm" onClick={() => mStatus.mutate({ userId: a.user_id, status: "approved" })}>
                          <Check className="mr-1 h-4 w-4" />Aprovar
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => mStatus.mutate({ userId: a.user_id, status: "rejected" })}>
                          <X className="mr-1 h-4 w-4" />Rejeitar
                        </Button>
                      </>
                    )}
                    {(a.status === "approved" || a.status === "paused") && !isSuper && (
                      <Button size="sm" variant={paused ? "default" : "outline"}
                        onClick={() => mStatus.mutate({ userId: a.user_id, status: paused ? "approved" : "paused" })}>
                        {paused ? <><Play className="mr-1 h-4 w-4" />Retomar</> : <><Pause className="mr-1 h-4 w-4" />Pausar</>}
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => setDateFor(a)}>
                      <Calendar className="mr-1 h-4 w-4" />Validade
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditing(a)}>
                      <Pencil className="mr-1 h-4 w-4" />Editar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setPwdFor(a)}>
                      <KeyRound className="mr-1 h-4 w-4" />Senha
                    </Button>
                    {!isSuper && (
                      <Button size="sm" variant="destructive" onClick={() => {
                        if (confirm("Revogar todo o acesso deste usuário?")) mRevoke.mutate(a.user_id);
                      }}>
                        <Ban className="mr-1 h-4 w-4" />Revogar
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && <EditProfileDialog account={editing} onClose={() => setEditing(null)} onSaved={invalidate} />}
      {pwdFor && <ResetPasswordDialog account={pwdFor} onClose={() => setPwdFor(null)} />}
      {dateFor && (
        <ValidityDialog
          account={dateFor}
          onClose={() => setDateFor(null)}
          onSave={(v) => mValidity.mutate({ userId: dateFor.user_id, validUntil: v })}
        />
      )}
    </div>
  );
}

function EditProfileDialog({ account, onClose, onSaved }: { account: Account; onClose: () => void; onSaved: () => void }) {
  const update = useServerFn(updateUserProfile);
  const [full, setFull] = useState(account.profile?.full_name ?? "");
  const [email, setEmail] = useState(account.profile?.email ?? "");
  const [phone, setPhone] = useState(account.profile?.phone ?? "");
  const m = useMutation({
    mutationFn: () => update({ data: { userId: account.user_id, fullName: full, email, phone } }),
    onSuccess: () => { toast.success("Dados atualizados"); onSaved(); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Editar dados do usuário</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Nome completo</Label><Input value={full} onChange={(e) => setFull(e.target.value)} /></div>
          <div><Label>E-mail</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div><Label>Telefone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
        </div>
        <DialogFooter><Button onClick={() => m.mutate()} disabled={m.isPending}>Salvar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({ account, onClose }: { account: Account; onClose: () => void }) {
  const reset = useServerFn(resetUserPassword);
  const [pwd, setPwd] = useState("");
  const m = useMutation({
    mutationFn: () => reset({ data: { userId: account.user_id, newPassword: pwd } }),
    onSuccess: () => { toast.success("Senha redefinida"); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Redefinir senha — {account.profile?.email}</DialogTitle></DialogHeader>
        <div>
          <Label>Nova senha (mínimo 8 caracteres)</Label>
          <Input type="text" value={pwd} onChange={(e) => setPwd(e.target.value)} />
        </div>
        <DialogFooter>
          <Button onClick={() => m.mutate()} disabled={pwd.length < 8 || m.isPending}>Redefinir</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ValidityDialog({ account, onClose, onSave }: { account: Account; onClose: () => void; onSave: (v: string | null) => void }) {
  const [d, setD] = useState(account.valid_until ?? "");
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Liberado até…</DialogTitle></DialogHeader>
        <div>
          <Label>Data limite de acesso</Label>
          <Input type="date" value={d} onChange={(e) => setD(e.target.value)} />
          <p className="mt-2 text-xs text-muted-foreground">Deixe em branco para acesso indefinido. Após a data, o acesso é bloqueado automaticamente.</p>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onSave(null)}>Remover validade</Button>
          <Button onClick={() => onSave(d || null)}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
