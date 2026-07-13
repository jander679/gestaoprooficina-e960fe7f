## Objetivo

Tornar a Ordem de Serviço mais completa, profissional e imprimível/PDF, ampliar permissões de edição/reabertura para todos os perfis da oficina, e garantir que a interface esteja sempre em português (pt-BR).

## 1. Idioma pt-BR travado

- Forçar `<html lang="pt-BR">` (já ok) e definir também no `i18n` `lng: "pt-BR"` sem detecção — atualmente já está, mas o navegador ainda pode sobrescrever via cache. Vou:
  - Limpar qualquer `localStorage` de idioma (`i18nextLng`) na inicialização do i18n.
  - Adicionar `Intl`/`toLocaleString` sempre com `"pt-BR"` (já feito em `format.ts`).
  - Definir `document.documentElement.lang = "pt-BR"` no boot do app para casos de hidratação.

## 2. Nova Ordem de Serviço (criação)

Ampliar o diálogo de "Nova OS" em `src/routes/app.ordens.tsx` para já capturar:

- Cliente (obrigatório) — seleção do catálogo **ou** botão "Cadastro rápido" (nome + telefone).
- Veículo (opcional) — seleção **ou** cadastro rápido (placa/marca/modelo).
- Mecânico responsável (opcional, lista de colaboradores da unidade).
- Serviço inicial (opcional) — pode escolher do catálogo **ou** digitar descrição livre + valor.
- Campo "Observações" (livre, editável depois).
- KM de entrada (opcional).

Ao confirmar: cria a OS + insere o primeiro item (catálogo ou descrição livre) automaticamente, se preenchido.

## 3. Edição/visualização da OS

Em `src/routes/app.ordens.$id.tsx`:

- Todos os campos passam a ser editáveis inline por qualquer perfil da oficina (admin, mecânico, recepcionista, financeiro):
  - Cliente, veículo, mecânico responsável, KM entrada/saída, diagnóstico, observações internas, observações ao cliente.
- Itens: adicionar/editar/remover (serviço do catálogo, peça, ou descrição livre com preço).
- Pagamentos: adicionar/remover.
- Botões de status: **Abrir · Em andamento · Aguardando peça · Aguardando aprovação · Concluir · Cancelar · Reabrir** — disponíveis para qualquer perfil da oficina.
- Novo campo "Observações gerais" (append-only com autor + data) exibido em ordem cronológica.

## 4. Permissões

Atualizar `src/lib/permissions.ts` para que **todos** os perfis (`oficina_admin`, `mecanico`, `recepcionista`, `financeiro`) tenham as ações: `os.create`, `os.edit`, `os.reopen`, `os.close`, `os.cancel`, `os.addNote`. Ajustar policies RLS de `service_orders`, `os_items`, `os_payments` se necessário para permitir UPDATE por qualquer membro ativo da unidade (já é o caso hoje, apenas confirmar).

## 5. Impressão e PDF profissional

Nova view de impressão dedicada `/app/ordens/$id/imprimir` com layout A4:

- Cabeçalho: logo/nome fantasia da unidade, CNPJ, endereço, telefone.
- Dados da OS: número, data abertura/fechamento, status.
- Cliente (nome, CPF/CNPJ, telefone, endereço).
- Veículo (placa, marca/modelo, ano, cor, KM entrada/saída, chassi).
- Mecânico responsável.
- Tabela de itens (tipo · descrição · qtd · unit. · subtotal).
- Diagnóstico + observações ao cliente + observações internas (opcional, escondida no modo cliente).
- Tabela de pagamentos + total, pago, saldo.
- Assinaturas: cliente e responsável.
- Rodapé com data/hora e nº da OS.

Dois botões no cabeçalho da OS:

- **Imprimir** — abre a rota de impressão e dispara `window.print()` (CSS `@media print` limpo, sem sidebar).
- **Baixar PDF** — usa `html2pdf.js` (bundle-friendly) para gerar o PDF da mesma view.

## Detalhes técnicos

- Instalar `html2pdf.js` (bundler-friendly, funciona no browser sem canvas nativo).
- Adicionar `src/routes/app.ordens.$id.imprimir.tsx` como rota filho (layout sem sidebar via `<Outlet />` condicional ou rota fora de `app.tsx` reautenticada).
- CSS de impressão em `src/styles.css` (`@media print { .no-print { display:none } }`).
- Refatorar `resource-dialog` não é necessário; usar diálogo próprio para "cadastro rápido" cliente/veículo dentro do fluxo de Nova OS.
- Sem mudanças de schema; usar coluna `observacoes_internas` existente para o histórico de notas (append com timestamp + autor).

## Fora do escopo

- Envio da OS por e-mail/WhatsApp.
- Templates de OS customizáveis pelo admin.
- Assinatura digital.
