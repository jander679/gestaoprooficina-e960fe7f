import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";

export const Route = createFileRoute("/bloqueado")({
  component: Blocked,
});

function Blocked() {
  const nav = useNavigate();
  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-destructive/15 text-destructive">
          <Lock className="h-7 w-7" />
        </div>
        <h1 className="mt-6 font-display text-2xl font-semibold">Acesso bloqueado</h1>
        <p className="mt-3 text-sm text-muted-foreground">Seu acesso está pausado, expirado ou foi revogado. Entre em contato com o Administrador Geral do Sistema.</p>
        <Button className="mt-8" variant="outline" onClick={() => supabase.auth.signOut().then(() => nav({ to: "/auth" }))}>
          Sair
        </Button>
      </div>
    </div>
  );
}
