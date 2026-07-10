import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
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
import { UserPlus, Trash2, Copy, Power } from "lucide-react";
import { traduzirErro } from "@/lib/errors";

export const Route = createFileRoute("/app/colaboradores")({
  head: () => ({ meta: [{ title: "Colaboradores — OficinaPro" }] }),
  component: StaffPage,
});

type Role = "oficina_admin" | "mecanico" | "recepcionista" | "financeiro";

interface Membership {
  id: string; user_id: string; role: Role; ativo: boolean;
  profiles: { full_name: string | null; email: string | null } | null;
}
interface Invitation {
  id: string; email: string; role: Role; token: string;
  expires_at: string; accepted_at: string | null; created_at: string;
}

function StaffPage() {
  const { t } = useTranslation();
  const { activeUnitId, activeMembership } = useActiveUnit();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [invEmail, setInvEmail] = useState("");
  const [invRole, setInvRole] = useState<Role>("mecanico");
  const canManage = activeMembership?.role === "oficina_admin";

  const { data: members = [] } = useQuery({
    queryKey: ["memberships-list", activeUnitId],
    enabled: !!activeUnitId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("memberships")
        .select("id,user_id,role,ativo,profiles(full_name,email)")
        .eq("unit_id", activeUnitId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Membership[];
    },
  });

  const { data: invites = [] } = useQuery({
    queryKey: ["invitations", activeUnitId],
    enabled: !!activeUnitId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invitations")
        .select("*")
        .eq("unit_id", activeUnitId!)
        .is("accepted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Invitation[];
    },
  });

  const invite = useMutation({
    mutationFn: async () => {
      const token = crypto.randomUUID().replace(/-/g, "");
      const expires = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("invitations").insert({
        unit_id: activeUnitId!, email: invEmail, role: invRole,
        token, expires_at: expires, invited_by: u.user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("staff.inviteSent"));
      setOpen(false); setInvEmail(""); setInvRole("mecanico");
      qc.invalidateQueries({ queryKey: ["invitations"] });
    },
    onError: (e) => toast.error(traduzirErro(e)),
  });

  const toggleActive = useMutation({
    mutationFn: async (m: Membership) => {
      const { error } = await supabase.from("memberships").update({ ativo: !m.ativo }).eq("id", m.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success(t("common.updated")); qc.invalidateQueries({ queryKey: ["memberships-list"] }); },
    onError: (e) => toast.error(traduzirErro(e)),
  });

  const changeRole = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: Role }) => {
      const { error } = await supabase.from("memberships").update({ role }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success(t("common.updated")); qc.invalidateQueries({ queryKey: ["memberships-list"] }); },
    onError: (e) => toast.error(traduzirErro(e)),
  });

  const removeMember = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("memberships").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success(t("common.deleted")); qc.invalidateQueries({ queryKey: ["memberships-list"] }); },
    onError: (e) => toast.error(traduzirErro(e)),
  });

  const cancelInvite = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("invitations").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success(t("common.deleted")); qc.invalidateQueries({ queryKey: ["invitations"] }); },
    onError: (e) => toast.error(traduzirErro(e)),
  });

  function copyInviteLink(inv: Invitation) {
    const url = `${window.location.origin}/auth?invite=${inv.token}`;
    void navigator.clipboard.writeText(url);
    toast.success(t("staff.inviteLinkCopied"));
  }

  if (!activeUnitId) return <EmptyState title={t("common.selectUnit")} />;

  return (
    <div>
      <PageHeader
        title={t("staff.title")}
        actions={canManage ? <Button onClick={() => setOpen(true)}><UserPlus className="mr-2 h-4 w-4" />{t("staff.invite")}</Button> : undefined}
      />

      <div className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("staff.active")}</div>
      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("common.name")}</TableHead>
              <TableHead>{t("common.email")}</TableHead>
              <TableHead>{t("staff.role")}</TableHead>
              <TableHead>{t("common.status")}</TableHead>
              <TableHead className="w-32 text-right">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">{t("staff.empty")}</TableCell></TableRow>}
            {members.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">{m.profiles?.full_name ?? "—"}</TableCell>
                <TableCell>{m.profiles?.email ?? "—"}</TableCell>
                <TableCell>
                  {canManage ? (
                    <Select value={m.role} onValueChange={(v) => changeRole.mutate({ id: m.id, role: v as Role })}>
                      <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(["oficina_admin","mecanico","recepcionista","financeiro"] as Role[]).map((r) => (
                          <SelectItem key={r} value={r}>{t(`staff.roles.${r}`)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : t(`staff.roles.${m.role}`)}
                </TableCell>
                <TableCell><Badge variant={m.ativo ? "default" : "secondary"}>{m.ativo ? t("common.yes") : t("common.no")}</Badge></TableCell>
                <TableCell className="flex justify-end gap-1">
                  {canManage && (
                    <>
                      <Button size="icon" variant="ghost" title={m.ativo ? t("staff.deactivate") : t("staff.activate")} onClick={() => toggleActive.mutate(m)}>
                        <Power className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => { if (confirm(t("common.confirmDelete"))) removeMember.mutate(m.id); }}>
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

      {invites.length > 0 && (
        <>
          <div className="mb-4 mt-8 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("staff.pendingInvites")}</div>
          <div className="rounded-xl border bg-card">
            <Table>
              <TableHeader><TableRow><TableHead>{t("common.email")}</TableHead><TableHead>{t("staff.role")}</TableHead><TableHead className="w-40 text-right">{t("common.actions")}</TableHead></TableRow></TableHeader>
              <TableBody>
                {invites.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell>{i.email}</TableCell>
                    <TableCell>{t(`staff.roles.${i.role}`)}</TableCell>
                    <TableCell className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" title={t("staff.copyLink")} onClick={() => copyInviteLink(i)}><Copy className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => { if (confirm(t("common.confirmDelete"))) cancelInvite.mutate(i.id); }}><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("staff.invite")}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>{t("staff.inviteEmail")} *</Label><Input type="email" value={invEmail} onChange={(e) => setInvEmail(e.target.value)} /></div>
            <div>
              <Label>{t("staff.role")} *</Label>
              <Select value={invRole} onValueChange={(v) => setInvRole(v as Role)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["oficina_admin","mecanico","recepcionista","financeiro"] as Role[]).map((r) => (
                    <SelectItem key={r} value={r}>{t(`staff.roles.${r}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button disabled={!invEmail || invite.isPending} onClick={() => invite.mutate()}>{t("staff.invite")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
