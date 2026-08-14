import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import {
  Wrench, LayoutDashboard, Users, Car, Package, ClipboardList,
  UserCog, Wallet, Settings, ShieldCheck, Building2, DollarSign,
  LogOut, Moon, Sun, Receipt, Calendar, Menu,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useActiveUnit } from "@/hooks/use-active-unit";
import { useTheme } from "@/hooks/use-theme";
import { can, type Role } from "@/lib/permissions";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { OrionIA } from "@/components/orion-ia";

export function AppShell({ children }: { children: ReactNode }) {
  const nav = useNavigate();
  const { user } = useAuth();
  const { memberships, activeUnitId, setActiveUnitId, activeMembership, isSuperAdmin } = useActiveUnit();
  const { theme, toggle } = useTheme();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);

  const role = (activeMembership?.role as Role) ?? null;
  const roleLabel: Record<string, string> = {
    oficina_admin: "Administrador da Oficina",
    mecanico: "Mecânico",
    recepcionista: "Recepcionista",
    financeiro: "Financeiro",
  };

  const allItems = [
    { to: "/app/dashboard", icon: LayoutDashboard, label: "Painel", action: "nav.dashboard" as const },
    { to: "/app/agenda", icon: Calendar, label: "Agenda", action: "nav.agenda" as const },
    { to: "/app/ordens", icon: ClipboardList, label: "Ordens de Serviço", action: "nav.orders" as const },
    { to: "/app/clientes", icon: Users, label: "Clientes", action: "nav.customers" as const },
    { to: "/app/veiculos", icon: Car, label: "Veículos", action: "nav.vehicles" as const },
    { to: "/app/servicos", icon: Wrench, label: "Serviços", action: "nav.services" as const },
    { to: "/app/pecas", icon: Package, label: "Peças", action: "nav.parts" as const },
    { to: "/app/colaboradores", icon: UserCog, label: "Colaboradores", action: "nav.staff" as const },
    { to: "/app/financeiro", icon: Wallet, label: "Financeiro", action: "nav.finance" as const },
    { to: "/app/financeiro/contas-pagar", icon: Receipt, label: "Contas a Pagar", action: "nav.finance" as const },
    { to: "/app/configuracoes", icon: Settings, label: "Configurações", action: "nav.settings" as const },
  ];
  const onboarding = !isSuperAdmin && memberships.length === 0;
  const items = isSuperAdmin
    ? []
    : onboarding
      ? allItems.filter((i) => i.to === "/app/configuracoes")
      : allItems.filter((i) => can(role, i.action, false));

  const superItems = isSuperAdmin ? [
    { to: "/app/admin/contas", icon: ShieldCheck, label: "Contas de usuários" },
    { to: "/app/admin/oficinas", icon: Building2, label: "Oficinas e Colaboradores" },
    { to: "/app/admin/financeiro", icon: DollarSign, label: "Financeiro do Sistema" },
  ] : [];

  async function signOut() {
    await supabase.auth.signOut();
    nav({ to: "/auth" });
  }

  const NavContent = (
    <>
      <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
        <div className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground">
          <Wrench className="h-4 w-4" />
        </div>
        <span className="font-display text-base font-semibold">OficinaPro</span>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2 text-sm">
        {items.map((i) => {
          const active = pathname === i.to || (i.to !== "/app/financeiro" && pathname.startsWith(i.to));
          return (
            <Link key={i.to} to={i.to} onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-2 rounded-md px-3 py-2 transition-colors ${
                active ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "hover:bg-sidebar-accent/50"
              }`}>
              <i.icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{i.label}</span>
            </Link>
          );
        })}
        {isSuperAdmin && (
          <>
            <div className="mt-4 px-3 pt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              ADMINISTRADOR GERAL
            </div>
            {superItems.map((i) => {
              const active = pathname.startsWith(i.to);
              return (
                <Link key={i.to} to={i.to} onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-2 rounded-md px-3 py-2 transition-colors ${
                    active ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "hover:bg-sidebar-accent/50"
                  }`}>
                  <i.icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{i.label}</span>
                </Link>
              );
            })}
          </>
        )}
      </nav>
    </>
  );

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground md:flex">
        {NavContent}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center justify-between gap-2 border-b bg-background/80 px-3 backdrop-blur md:px-4">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden shrink-0" aria-label="Abrir menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0 bg-sidebar text-sidebar-foreground">
                <SheetTitle className="sr-only">Menu</SheetTitle>
                <div className="flex h-full flex-col">{NavContent}</div>
              </SheetContent>
            </Sheet>

            {!isSuperAdmin && memberships.length > 0 ? (
              <Select value={activeUnitId ?? undefined} onValueChange={setActiveUnitId}>
                <SelectTrigger className="h-9 w-full min-w-0 max-w-[240px] md:w-[240px]">
                  <SelectValue placeholder="Selecionar unidade" />
                </SelectTrigger>
                <SelectContent>
                  {memberships.map((m) => (
                    <SelectItem key={m.unit_id} value={m.unit_id}>
                      <span className="flex flex-col">
                        <span className="text-sm">{m.units?.nome}</span>
                        <span className="text-xs text-muted-foreground">
                          {m.units?.companies?.nome_fantasia || m.units?.companies?.razao_social}
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <span className="truncate text-xs text-muted-foreground md:text-sm">
                {isSuperAdmin
                  ? "Modo Administrador Geral"
                  : "Cadastre sua primeira oficina"}
              </span>
            )}
            {activeMembership && !isSuperAdmin && (
              <span className="hidden rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground lg:inline">
                {roleLabel[activeMembership.role] ?? activeMembership.role}
              </span>
            )}
            {memberships.length > 1 && !isSuperAdmin && (
              <Button variant="ghost" size="sm" onClick={() => nav({ to: "/app/selecionar-unidade" })} className="hidden lg:inline-flex">
                Trocar oficina
              </Button>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <Button variant="ghost" size="icon" onClick={toggle} title="Tema">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2 px-2">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-xs text-primary-foreground">
                    {(user?.email?.[0] ?? "?").toUpperCase()}
                  </span>
                  <span className="hidden max-w-[160px] truncate text-sm lg:inline">{user?.email}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel className="max-w-[220px] truncate">{user?.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {memberships.length > 1 && !isSuperAdmin && (
                  <DropdownMenuItem onClick={() => nav({ to: "/app/selecionar-unidade" })}>
                    <Building2 className="mr-2 h-4 w-4" />
                    Trocar oficina
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={signOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden overflow-y-auto p-3 sm:p-4 md:p-6">{children}</main>
      </div>
      <OrionIA />
    </div>
  );
}
