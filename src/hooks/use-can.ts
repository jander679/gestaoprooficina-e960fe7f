import { useActiveUnit } from "./use-active-unit";
import { can, type Action, type Role } from "@/lib/permissions";

export function useCan(action: Action): boolean {
  const { activeMembership, isSuperAdmin } = useActiveUnit();
  return can((activeMembership?.role as Role) ?? null, action, isSuperAdmin);
}

export function useRole(): Role | null {
  const { activeMembership } = useActiveUnit();
  return (activeMembership?.role as Role) ?? null;
}
