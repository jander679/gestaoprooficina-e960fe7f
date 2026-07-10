import { ShieldAlert } from "lucide-react";

export function NoAccess({ message }: { message?: string }) {
  return (
    <div className="mx-auto max-w-md rounded-xl border bg-card p-8 text-center">
      <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
      <div className="text-lg font-semibold">Sem permissão</div>
      <p className="mt-2 text-sm text-muted-foreground">
        {message ?? "Seu perfil não tem acesso a este módulo. Fale com o administrador da oficina."}
      </p>
    </div>
  );
}
