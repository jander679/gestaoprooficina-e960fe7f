// Central permission matrix. Keep in sync with RLS policies.
export type Role =
  | "super_admin"
  | "oficina_admin"
  | "mecanico"
  | "recepcionista"
  | "financeiro";

export type Action =
  // Módulos (mostra o item na sidebar / abre a página)
  | "nav.dashboard"
  | "nav.orders"
  | "nav.customers"
  | "nav.vehicles"
  | "nav.services"
  | "nav.parts"
  | "nav.staff"
  | "nav.finance"
  | "nav.settings"
  | "nav.accounts"
  // Escrita
  | "customers:write"
  | "vehicles:write"
  | "services:write"
  | "parts:write"
  | "staff:write"
  | "staff:invite"
  | "orders:write"
  | "orders:delete"
  | "payments:write"
  | "settings:write"
  | "fipe:sync";

const MATRIX: Record<Action, Role[]> = {
  "nav.dashboard": ["oficina_admin", "mecanico", "recepcionista", "financeiro"],
  "nav.orders": ["oficina_admin", "mecanico", "recepcionista", "financeiro"],
  "nav.customers": ["oficina_admin", "mecanico", "recepcionista", "financeiro"],
  "nav.vehicles": ["oficina_admin", "mecanico", "recepcionista", "financeiro"],
  "nav.services": ["oficina_admin", "mecanico", "recepcionista", "financeiro"],
  "nav.parts": ["oficina_admin", "mecanico", "recepcionista", "financeiro"],
  "nav.staff": ["oficina_admin", "recepcionista"],
  "nav.finance": ["oficina_admin", "financeiro"],
  "nav.settings": ["oficina_admin"],
  "nav.accounts": ["super_admin"],

  "customers:write": ["oficina_admin", "mecanico", "recepcionista"],
  "vehicles:write": ["oficina_admin", "mecanico", "recepcionista"],
  "services:write": ["oficina_admin"],
  "parts:write": ["oficina_admin", "mecanico"],
  "staff:write": ["oficina_admin"],
  "staff:invite": ["oficina_admin", "recepcionista"],
  "orders:write": ["oficina_admin", "mecanico", "recepcionista"],
  "orders:delete": ["oficina_admin"],
  "payments:write": ["oficina_admin", "financeiro", "recepcionista"],
  "settings:write": ["oficina_admin"],
  "fipe:sync": ["oficina_admin", "super_admin"],
};

export function can(role: Role | null | undefined, action: Action, isSuperAdmin = false): boolean {
  if (isSuperAdmin && MATRIX[action].includes("super_admin")) return true;
  if (!role) return false;
  return MATRIX[action].includes(role);
}

export const ROLE_LABEL: Record<Role, string> = {
  super_admin: "Administrador Geral do Sistema",
  oficina_admin: "Administrador da Oficina",
  mecanico: "Mecânico",
  recepcionista: "Recepcionista",
  financeiro: "Financeiro",
};
