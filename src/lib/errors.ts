// Traduz erros do Supabase/PostgREST para mensagens amigáveis em pt-BR.
export function traduzirErro(err: unknown): string {
  const anyErr = err as { code?: string; message?: string; details?: string } | null;
  const msg = (anyErr?.message ?? "").toLowerCase();
  const code = anyErr?.code ?? "";

  if (code === "23505" || msg.includes("duplicate key") || msg.includes("unique constraint")) {
    if (msg.includes("cnpj")) return "Já existe uma empresa cadastrada com este CNPJ.";
    if (msg.includes("email")) return "Este e-mail já está cadastrado.";
    if (msg.includes("placa")) return "Já existe um veículo cadastrado com esta placa.";
    return "Já existe um registro com estes dados.";
  }
  if (code === "23503" || msg.includes("foreign key")) {
    return "Não é possível concluir: o registro está vinculado a outros dados.";
  }
  if (code === "23502" || msg.includes("not-null")) {
    return "Preencha todos os campos obrigatórios.";
  }
  if (code === "42501" || msg.includes("permission denied") || msg.includes("row-level security") || msg.includes("row level security") || msg.includes("violates row-level")) {
    return "Você não tem permissão para realizar esta ação.";
  }
  if (code === "PGRST116" || msg.includes("no rows")) {
    return "Nenhum registro encontrado.";
  }
  if (msg.includes("jwt") || msg.includes("unauthorized") || msg.includes("not authenticated")) {
    return "Sessão expirada. Faça login novamente.";
  }
  if (msg.includes("network") || msg.includes("failed to fetch")) {
    return "Falha de conexão. Verifique sua internet e tente novamente.";
  }
  if (msg.includes("invalid login") || msg.includes("invalid credentials")) {
    return "E-mail ou senha inválidos.";
  }
  if (msg.includes("email not confirmed")) {
    return "Confirme seu e-mail para continuar.";
  }
  if (msg.includes("user already registered")) {
    return "Este e-mail já está cadastrado.";
  }
  if (msg.includes("password should be at least")) {
    return "A senha deve ter pelo menos 6 caracteres.";
  }
  return anyErr?.message || "Ocorreu um erro inesperado. Tente novamente.";
}
