import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useActiveUnit } from "@/hooks/use-active-unit";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, loading } = useAuth();
  const { isSuperAdmin } = useActiveUnit();
  const nav = useNavigate();

  const { data: access, isLoading: accessLoading } = useQuery({
    queryKey: ["access", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("account_access").select("*").eq("user_id", user!.id).maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (loading) return;
    if (!user) { nav({ to: "/auth" }); return; }
    if (accessLoading) return;
    if (isSuperAdmin) return; // super admin bypass
    if (!access || access.status === "pending" || access.status === "rejected") {
      nav({ to: "/pendente" });
    } else if (access.status === "paused" || access.status === "expired" ||
               (access.valid_until && new Date(access.valid_until) < new Date(new Date().toDateString()))) {
      nav({ to: "/bloqueado" });
    }
  }, [loading, user, access, accessLoading, isSuperAdmin, nav]);

  if (loading || !user) return null;

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
