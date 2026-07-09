import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";

export interface Membership {
  id: string;
  unit_id: string;
  role: string;
  ativo: boolean;
  units: {
    id: string;
    nome: string;
    cidade: string | null;
    uf: string | null;
    company_id: string;
    companies: { id: string; razao_social: string; nome_fantasia: string | null; cnpj: string } | null;
  } | null;
}

interface Ctx {
  memberships: Membership[];
  activeUnitId: string | null;
  setActiveUnitId: (id: string) => void;
  activeMembership: Membership | null;
  isLoading: boolean;
  refetch: () => void;
  isSuperAdmin: boolean;
}

const C = createContext<Ctx>({
  memberships: [], activeUnitId: null, setActiveUnitId: () => {},
  activeMembership: null, isLoading: false, refetch: () => {}, isSuperAdmin: false,
});

const KEY = "oficinapro:activeUnit";

export function ActiveUnitProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [activeUnitId, setActive] = useState<string | null>(
    typeof window !== "undefined" ? localStorage.getItem(KEY) : null,
  );

  const { data: memberships = [], isLoading, refetch } = useQuery({
    queryKey: ["memberships", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("memberships")
        .select("id,unit_id,role,ativo,units(id,nome,cidade,uf,company_id,companies(id,razao_social,nome_fantasia,cnpj))")
        .eq("user_id", user!.id)
        .eq("ativo", true);
      if (error) throw error;
      return (data ?? []) as unknown as Membership[];
    },
  });

  const { data: isSuperAdmin = false } = useQuery({
    queryKey: ["isSuperAdmin", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user!.id).eq("role", "super_admin").maybeSingle();
      return !!data;
    },
  });

  useEffect(() => {
    if (!memberships.length) return;
    if (!activeUnitId || !memberships.find((m) => m.unit_id === activeUnitId)) {
      const first = memberships[0].unit_id;
      setActive(first);
      localStorage.setItem(KEY, first);
    }
  }, [memberships, activeUnitId]);

  const setActiveUnitId = (id: string) => {
    setActive(id);
    localStorage.setItem(KEY, id);
  };

  const activeMembership = useMemo(
    () => memberships.find((m) => m.unit_id === activeUnitId) ?? null,
    [memberships, activeUnitId],
  );

  return (
    <C.Provider value={{ memberships, activeUnitId, setActiveUnitId, activeMembership, isLoading, refetch, isSuperAdmin }}>
      {children}
    </C.Provider>
  );
}

export function useActiveUnit() {
  return useContext(C);
}
