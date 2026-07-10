import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function ensureSuperAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "super_admin" });
  if (!data) throw new Error("Forbidden");
}

async function logAudit(actorId: string, acao: string, entidade: string, entidadeId: string, payload: unknown) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("audit_log").insert({
    actor_id: actorId, acao, entidade, entidade_id: entidadeId, payload: payload as any,
  });
}

export const listAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: access, error } = await supabaseAdmin.from("account_access").select("*").order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    const ids = access?.map((a) => a.user_id) ?? [];
    if (ids.length === 0) return [];
    const { data: profiles } = await supabaseAdmin.from("profiles").select("id,email,full_name,phone").in("id", ids);
    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id,role").in("user_id", ids);
    const { data: memberships } = await supabaseAdmin
      .from("memberships")
      .select("user_id,role,ativo,unit_id,units(nome,companies(razao_social,nome_fantasia,cnpj))")
      .in("user_id", ids);
    return access.map((a) => ({
      ...a,
      profile: profiles?.find((p) => p.id === a.user_id) ?? null,
      roles: roles?.filter((r) => r.user_id === a.user_id).map((r) => r.role) ?? [],
      memberships: memberships?.filter((m) => m.user_id === a.user_id) ?? [],
    }));
  });

export const setAccountStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; status: "approved" | "rejected" | "paused" | "revoked"; reason?: string }) =>
    z.object({
      userId: z.string().uuid(),
      status: z.enum(["approved", "rejected", "paused", "revoked"]),
      reason: z.string().max(500).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: any = { status: data.status, updated_by: context.userId, reason: data.reason ?? null };
    if (data.status === "paused") patch.paused_at = new Date().toISOString();
    if (data.status === "approved") patch.paused_at = null;
    const { error } = await supabaseAdmin.from("account_access").update(patch).eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    // Se reintegrar (approved), reativa memberships
    if (data.status === "approved") {
      await supabaseAdmin.from("memberships").update({ ativo: true }).eq("user_id", data.userId);
    }
    await logAudit(context.userId, "account.status", "account_access", data.userId, patch);
    return { ok: true };
  });

export const setAccountValidity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; validUntil: string | null }) =>
    z.object({ userId: z.string().uuid(), validUntil: z.string().nullable() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("account_access")
      .update({ valid_until: data.validUntil, updated_by: context.userId })
      .eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    await logAudit(context.userId, "account.validity", "account_access", data.userId, { valid_until: data.validUntil });
    return { ok: true };
  });

export const updateUserProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; fullName?: string; email?: string; phone?: string }) =>
    z.object({
      userId: z.string().uuid(),
      fullName: z.string().trim().max(200).optional(),
      email: z.string().trim().email().max(255).optional(),
      phone: z.string().trim().max(30).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: any = {};
    if (data.fullName !== undefined) patch.full_name = data.fullName;
    if (data.email !== undefined) patch.email = data.email;
    if (data.phone !== undefined) patch.phone = data.phone;
    if (Object.keys(patch).length) {
      const { error } = await supabaseAdmin.from("profiles").update(patch).eq("id", data.userId);
      if (error) throw new Error(error.message);
    }
    if (data.email) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, { email: data.email, email_confirm: true });
      if (error) throw new Error(error.message);
    }
    await logAudit(context.userId, "account.profile", "profiles", data.userId, patch);
    return { ok: true };
  });

export const resetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; newPassword: string }) =>
    z.object({ userId: z.string().uuid(), newPassword: z.string().min(8).max(72) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, { password: data.newPassword });
    if (error) throw new Error(error.message);
    await logAudit(context.userId, "account.password_reset", "auth.users", data.userId, {});
    return { ok: true };
  });

export const revokeUserAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("account_access")
      .update({ status: "revoked", updated_by: context.userId }).eq("user_id", data.userId);
    await supabaseAdmin.from("memberships").update({ ativo: false }).eq("user_id", data.userId);
    await logAudit(context.userId, "account.revoke", "account_access", data.userId, {});
    return { ok: true };
  });

export const deleteUserAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context.supabase, context.userId);
    if (data.userId === context.userId) throw new Error("Não é possível excluir a si mesmo.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Snapshot para auditoria antes de apagar
    const { data: profile } = await supabaseAdmin.from("profiles").select("*").eq("id", data.userId).maybeSingle();
    await logAudit(context.userId, "account.delete", "auth.users", data.userId, { snapshot: profile ?? {} });
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ Super admin: gestão total de oficinas ============

export const listAllUnits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("units")
      .select("id,nome,cidade,uf,companies(id,razao_social,nome_fantasia,cnpj)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listUnitStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { unitId: string }) => z.object({ unitId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("memberships").select("id,user_id,role,ativo").eq("unit_id", data.unitId);
    if (error) throw new Error(error.message);
    const ids = (rows ?? []).map((r) => r.user_id);
    const { data: profiles } = ids.length
      ? await supabaseAdmin.from("profiles").select("id,email,full_name,phone").in("id", ids)
      : { data: [] as any[] };
    return (rows ?? []).map((r) => ({ ...r, profiles: profiles?.find((p: any) => p.id === r.user_id) ?? null }));
  });

export const updateMembership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { membershipId: string; role?: string; ativo?: boolean }) =>
    z.object({
      membershipId: z.string().uuid(),
      role: z.enum(["oficina_admin", "mecanico", "recepcionista", "financeiro"]).optional(),
      ativo: z.boolean().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: any = {};
    if (data.role) patch.role = data.role;
    if (data.ativo !== undefined) patch.ativo = data.ativo;
    const { error } = await supabaseAdmin.from("memberships").update(patch).eq("id", data.membershipId);
    if (error) throw new Error(error.message);
    await logAudit(context.userId, "membership.update", "memberships", data.membershipId, patch);
    return { ok: true };
  });

// ============ Financeiro do SaaS ============

export const listSaasFinance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [subs, invs] = await Promise.all([
      supabaseAdmin.from("saas_subscriptions").select("*, units(nome, companies(razao_social,nome_fantasia,cnpj))").order("created_at", { ascending: false }),
      supabaseAdmin.from("saas_invoices").select("*, units(nome, companies(razao_social,nome_fantasia))").order("vencimento", { ascending: false }).limit(500),
    ]);
    if (subs.error) throw new Error(subs.error.message);
    if (invs.error) throw new Error(invs.error.message);
    return { subscriptions: subs.data ?? [], invoices: invs.data ?? [] };
  });

export const updateSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; valor_mensal?: number; dia_vencimento?: number; status?: string; plano?: string }) =>
    z.object({
      id: z.string().uuid(),
      valor_mensal: z.number().nonnegative().optional(),
      dia_vencimento: z.number().int().min(1).max(28).optional(),
      status: z.enum(["ativa", "suspensa", "cancelada"]).optional(),
      plano: z.string().max(50).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { id, ...patch } = data;
    const { error } = await supabaseAdmin.from("saas_subscriptions").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    await logAudit(context.userId, "sub.update", "saas_subscriptions", id, patch);
    return { ok: true };
  });

export const updateSaasInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; status?: string; pago_em?: string | null; metodo?: string | null }) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["aberta", "paga", "atrasada", "cancelada"]).optional(),
      pago_em: z.string().nullable().optional(),
      metodo: z.string().max(50).nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { id, ...patch } = data;
    if (patch.status === "paga" && !patch.pago_em) (patch as any).pago_em = new Date().toISOString();
    const { error } = await supabaseAdmin.from("saas_invoices").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    await logAudit(context.userId, "invoice.update", "saas_invoices", id, patch);
    return { ok: true };
  });

export const generateMonthlyInvoices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date();
    const competencia = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const { data: subs } = await supabaseAdmin.from("saas_subscriptions").select("*").eq("status", "ativa");
    let created = 0;
    for (const s of subs ?? []) {
      const venc = new Date(now.getFullYear(), now.getMonth(), (s as any).dia_vencimento).toISOString().slice(0, 10);
      const { error } = await supabaseAdmin.from("saas_invoices").insert({
        unit_id: (s as any).unit_id, competencia, valor: (s as any).valor_mensal, vencimento: venc, status: "aberta",
      });
      if (!error) created++;
    }
    return { ok: true, created, competencia };
  });

// ============ Cadastro de colaborador (login por username) ============

async function ensureUnitAdmin(supabase: any, userId: string, unitId: string) {
  const { data: isSuper } = await supabase.rpc("has_role", { _user_id: userId, _role: "super_admin" });
  if (isSuper) return;
  const { data } = await supabase.rpc("is_unit_admin", { _user_id: userId, _unit_id: unitId });
  if (!data) throw new Error("Você não é administrador desta oficina.");
}

function pseudoEmailFor(username: string) {
  return `usuario+${username.toLowerCase()}@oficina.local`;
}

export const createStaffAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { unitId: string; fullName: string; username: string; password: string; role: string; phone?: string }) =>
    z.object({
      unitId: z.string().uuid(),
      fullName: z.string().trim().min(2).max(200),
      username: z.string().trim().min(3).max(50).regex(/^[a-zA-Z0-9._-]+$/, "Use apenas letras, números, ponto, hífen ou sublinhado."),
      password: z.string().min(6).max(72),
      role: z.enum(["oficina_admin", "mecanico", "recepcionista", "financeiro"]),
      phone: z.string().trim().max(30).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureUnitAdmin(context.supabase, context.userId, data.unitId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Username único?
    const { data: exists } = await supabaseAdmin
      .from("profiles").select("id").eq("username", data.username).maybeSingle();
    if (exists) throw new Error("Este nome de usuário já está em uso.");

    const email = pseudoEmailFor(data.username);
    const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        full_name: data.fullName,
        username: data.username,
        created_by_admin: true,
      },
    });
    if (cErr) throw new Error(cErr.message);
    const newUserId = created.user!.id;

    // Trigger handle_new_user cria profile + account_access(approved). Garantir username/phone.
    await supabaseAdmin.from("profiles").update({
      full_name: data.fullName,
      username: data.username,
      phone: data.phone ?? null,
    }).eq("id", newUserId);

    await supabaseAdmin.from("account_access").update({ status: "approved" }).eq("user_id", newUserId);

    const { error: mErr } = await supabaseAdmin.from("memberships").insert({
      user_id: newUserId, unit_id: data.unitId, role: data.role, ativo: true,
    });
    if (mErr) throw new Error(mErr.message);

    await logAudit(context.userId, "staff.create", "memberships", newUserId, { unitId: data.unitId, role: data.role, username: data.username });
    return { ok: true, userId: newUserId };
  });

export const addStaffToUnit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { unitId: string; username: string; role: string }) =>
    z.object({
      unitId: z.string().uuid(),
      username: z.string().trim().min(3).max(50),
      role: z.enum(["oficina_admin", "mecanico", "recepcionista", "financeiro"]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureUnitAdmin(context.supabase, context.userId, data.unitId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prof } = await supabaseAdmin.from("profiles").select("id").eq("username", data.username).maybeSingle();
    if (!prof) throw new Error("Usuário não encontrado.");
    const { error } = await supabaseAdmin.from("memberships").insert({
      user_id: prof.id, unit_id: data.unitId, role: data.role, ativo: true,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateStaffCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; unitId: string; username?: string; password?: string; fullName?: string; phone?: string }) =>
    z.object({
      userId: z.string().uuid(),
      unitId: z.string().uuid(),
      username: z.string().trim().min(3).max(50).regex(/^[a-zA-Z0-9._-]+$/).optional(),
      password: z.string().min(6).max(72).optional(),
      fullName: z.string().trim().max(200).optional(),
      phone: z.string().trim().max(30).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureUnitAdmin(context.supabase, context.userId, data.unitId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.username) {
      const { data: exists } = await supabaseAdmin
        .from("profiles").select("id").eq("username", data.username).neq("id", data.userId).maybeSingle();
      if (exists) throw new Error("Este nome de usuário já está em uso.");
      const newEmail = pseudoEmailFor(data.username);
      const { error: aErr } = await supabaseAdmin.auth.admin.updateUserById(data.userId, { email: newEmail, email_confirm: true });
      if (aErr) throw new Error(aErr.message);
      await supabaseAdmin.from("profiles").update({ username: data.username, email: newEmail }).eq("id", data.userId);
    }

    if (data.password) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, { password: data.password });
      if (error) throw new Error(error.message);
    }

    const patch: any = {};
    if (data.fullName !== undefined) patch.full_name = data.fullName;
    if (data.phone !== undefined) patch.phone = data.phone;
    if (Object.keys(patch).length) {
      await supabaseAdmin.from("profiles").update(patch).eq("id", data.userId);
    }

    await logAudit(context.userId, "staff.update", "profiles", data.userId, { hasPassword: !!data.password, username: data.username ?? null });
    return { ok: true };
  });
