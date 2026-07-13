import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Wrench, Building2, Package, Users } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

const APP_NAME = "OficinaPro";

const FEATURES = [
  {
    icon: Building2,
    title: "Multi-oficina",
    desc: "Uma conta gerencia várias unidades sob o mesmo CNPJ, com dados totalmente separados.",
  },
  {
    icon: Wrench,
    title: "Ordem de Serviço completa",
    desc: "Serviços, peças, descrições livres, múltiplos pagamentos e histórico do veículo.",
  },
  {
    icon: Package,
    title: "Peças e lotes",
    desc: "Cadastre peças; lote, custo e preço são opcionais para não travar sua rotina.",
  },
  {
    icon: Users,
    title: "Equipe organizada",
    desc: "Convide mecânicos, recepcionistas e financeiro com permissões próprias.",
  },
] as const;

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground">
              <Wrench className="h-4 w-4" />
            </div>
            <span className="font-display text-lg font-semibold">{APP_NAME}</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/auth"><Button variant="ghost">Entrar</Button></Link>
            <Link to="/auth" search={{ mode: "signup" } as never}><Button>Criar conta</Button></Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-24 text-center">
        <h1 className="font-display text-5xl font-bold tracking-tight md:text-6xl">
          Sua oficina no controle, em um só sistema
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          Ordens de serviço, cadastro de peças com lotes, clientes, veículos e financeiro —
          tudo integrado, para uma ou várias oficinas.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link to="/auth" search={{ mode: "signup" } as never}>
            <Button size="lg">Começar agora</Button>
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-6 pb-24 md:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="rounded-xl border bg-card p-6">
            <div className="mb-4 grid h-10 w-10 place-items-center rounded-lg bg-accent/20 text-accent-foreground">
              <Icon className="h-5 w-5" />
            </div>
            <h3 className="font-display text-lg font-semibold">{title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
          </div>
        ))}
      </section>

      <footer className="border-t py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} {APP_NAME}
      </footer>
    </div>
  );
}
