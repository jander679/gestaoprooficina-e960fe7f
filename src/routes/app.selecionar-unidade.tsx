import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useActiveUnit } from "@/hooks/use-active-unit";
import { PageHeader } from "@/components/page-header";
import { Building2, MapPin, ChevronRight } from "lucide-react";
import { ROLE_LABEL, type Role } from "@/lib/permissions";

export const Route = createFileRoute("/app/selecionar-unidade")({
  head: () => ({ meta: [{ title: "Selecionar oficina — OficinaPro" }] }),
  component: SelectUnitPage,
});

function SelectUnitPage() {
  const { memberships, setActiveUnitId } = useActiveUnit();
  const nav = useNavigate();

  function pick(unitId: string) {
    setActiveUnitId(unitId);
    nav({ to: "/app/dashboard" });
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Selecione a oficina"
        subtitle="Você tem acesso a mais de uma oficina. Escolha em qual deseja trabalhar agora."
      />
      <div className="grid gap-3">
        {memberships.map((m) => (
          <button
            key={m.id}
            onClick={() => pick(m.unit_id)}
            className="group flex items-center justify-between gap-4 rounded-xl border bg-card p-4 text-left transition hover:border-primary hover:bg-accent"
          >
            <div className="flex items-start gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-md bg-primary/10 text-primary">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <div className="font-medium">{m.units?.nome}</div>
                <div className="text-xs text-muted-foreground">
                  {m.units?.companies?.nome_fantasia || m.units?.companies?.razao_social}
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {m.units?.cidade}{m.units?.uf ? ` — ${m.units?.uf}` : ""}
                  <span className="mx-1">·</span>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-secondary-foreground">
                    {ROLE_LABEL[m.role as Role] ?? m.role}
                  </span>
                </div>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground transition group-hover:text-primary" />
          </button>
        ))}
        {memberships.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma oficina vinculada ao seu usuário.</p>
        )}
      </div>
    </div>
  );
}
