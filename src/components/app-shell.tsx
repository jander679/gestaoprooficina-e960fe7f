import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";
import {
  Wrench, LayoutDashboard, Users, Car, Package, ClipboardList,
  UserCog, Wallet, Settings, ShieldCheck, LogOut, Moon, Sun,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useActiveUnit } from "@/hooks/use-active-unit";
import { useTheme } from "@/hooks/use-theme";
import i18n from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const nav = useNavigate();
  const { user } = useAuth();
  const { memberships, activeUnitId, setActiveUnitId, activeMembership, isSuperAdmin } = useActiveUnit();
  const { theme, toggle } = useTheme();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const items = [
    { to: "/app/dashboard", icon: LayoutDashboard, label: t("nav.dashboard") },
    { to: "/app/ordens", icon: ClipboardList, label: t("nav.orders") },
    { to: "/app/clientes", icon: Users, label: t("nav.customers") },
    { to: "/app/veiculos", icon: Car, label: t("nav.vehicles") },
    { to: "/app/servicos", icon: Wrench, label: t("nav.services") },
    { to: "/app/pecas", icon: Package, label: t("nav.parts") },
    { to: "/app/colaboradores", icon: UserCog, label: t("nav.staff") },
    { to: "/app/financeiro", icon: Wallet, label: t("nav.finance") },
    { to: "/app/configuracoes", icon: Settings, label: t("nav.settings") },
  ];

  const superItems = [
    { to: "/app/admin/contas", icon: ShieldCheck, label: t("nav.accounts") },
  ];

  async function signOut() {
    await supabase.auth.signOut();
    nav({ to: "/auth" });
  }


  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground">
            <Wrench className="h-4 w-4" />
          </div>
          <span className="font-display text-base font-semibold">{t("app.name")}</span>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-2 text-sm">
          {items.map((i) => {
            const active = pathname.startsWith(i.to);
            return (
              <Link
                key={i.to}
                to={i.to}
                className={`flex items-center gap-2 rounded-md px-3 py-2 transition-colors ${
                  active ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "hover:bg-sidebar-accent/50"
                }`}
              >
                <i.icon className="h-4 w-4" />
                {i.label}
              </Link>
            );
          })}
          {isSuperAdmin && (
            <>
              <div className="mt-4 px-3 pt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("nav.superAdmin")}
              </div>
              {superItems.map((i) => {
                const active = pathname.startsWith(i.to);
                return (
                  <Link key={i.to} to={i.to}
                    className={`flex items-center gap-2 rounded-md px-3 py-2 transition-colors ${
                      active ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "hover:bg-sidebar-accent/50"
                    }`}>
                    <i.icon className="h-4 w-4" />
                    {i.label}
                  </Link>
                );
              })}
            </>
          )}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center justify-between border-b bg-background/80 px-4 backdrop-blur">
          <div className="flex items-center gap-3">
            {memberships.length > 0 ? (
              <Select value={activeUnitId ?? undefined} onValueChange={setActiveUnitId}>
                <SelectTrigger className="h-9 w-[240px]">
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
              <span className="text-sm text-muted-foreground">
                {isSuperAdmin ? "Modo Admin Geral" : "Configure sua empresa"}
              </span>
            )}
            {activeMembership && (
              <span className="hidden rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground md:inline">
                {t(`staff.roles.${activeMembership.role}`, activeMembership.role)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={toggle} title="Tema">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-xs text-primary-foreground">
                    {(user?.email?.[0] ?? "?").toUpperCase()}
                  </span>
                  <span className="hidden text-sm md:inline">{user?.email}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{user?.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  {t("auth.signOut")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
