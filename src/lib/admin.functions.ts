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

    const { data: access, error } = await supabaseAdmin
      .from("account_access")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);

    const ids = access?.map((a) => a.user_id) ?? [];
    if (ids.length === 0) return [];

    const { data: profiles } = await supabaseAdmin
      .from("profiles").select("id,email,full_name,phone").in("id", ids);
    const { data: roles } = await supabaseAdmin
      .from("user_roles").select("user_id,role").in("user_id", ids);
    const { data: memberships } = await supabaseAdmin
      .from("memberships")
      .select("user_id,role,ativo,units(nome,companies(razao_social,nome_fantasia,cnpj))")
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
  .inputValidator((d: { userId: string; status: "approved" | "rejected" | "paused"; reason?: string }) =>
    z.object({
      userId: z.string().uuid(),
      status: z.enum(["approved", "rejected", "paused"]),
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
      .update({ status: "rejected", updated_by: context.userId }).eq("user_id", data.userId);
    await supabaseAdmin.from("memberships").update({ ativo: false }).eq("user_id", data.userId);
    await logAudit(context.userId, "account.revoke", "account_access", data.userId, {});
    return { ok: true };
  });
