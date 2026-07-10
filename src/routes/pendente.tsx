import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";

export const Route = createFileRoute("/pendente")({
  component: Pending,
});

function Pending() {
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  const nav = useNavigate();

  const { data: access } = useQuery({
    queryKey: ["access", user?.id],
    enabled: !!user,
    refetchInterval: 10_000,
    queryFn: async () => {
      const { data } = await supabase.from("account_access").select("*").eq("user_id", user!.id).maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (!loading && !user) nav({ to: "/auth" });
    if (access?.status === "approved") nav({ to: "/app/dashboard" });
  }, [loading, user, access, nav]);

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-accent/20 text-accent-foreground">
          <Clock className="h-7 w-7" />
        </div>
        <h1 className="mt-6 font-display text-2xl font-semibold">Cadastro em análise</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Sua conta foi criada com sucesso e aguarda aprovação do Administrador Geral do Sistema.
          Assim que for liberada, você poderá acessar normalmente — não é necessário confirmar e-mail.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">Esta página atualiza automaticamente a cada 10 segundos.</p>
        <Button className="mt-8" variant="outline" onClick={() => supabase.auth.signOut().then(() => nav({ to: "/auth" }))}>
          {t("auth.signOut")}
        </Button>
      </div>
    </div>
  );
}
