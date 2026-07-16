Vou corrigir a área de Ordens de Serviço de forma objetiva e validável.

## O que será corrigido

1. **Todos os perfis da oficina poderão operar OS**
   - Administrador da oficina
   - Recepcionista
   - Mecânico
   - Financeiro

   Todos terão acesso para:
   - criar OS;
   - editar dados da OS;
   - adicionar/alterar/remover itens;
   - adicionar/remover pagamentos;
   - iniciar OS;
   - fechar OS;
   - reabrir OS;
   - imprimir/baixar em PDF.

2. **A tela de detalhe da OS será completada**
   - Hoje ela já tem parte dos botões, mas ainda falta edição real de itens e pagamentos.
   - Vou adicionar ações claras por linha:
     - editar item;
     - excluir item;
     - editar pagamento;
     - excluir pagamento.
   - Ao editar/adicionar dados em OS fechada/cancelada, ela voltará automaticamente para “Em andamento”.

3. **A criação de OS será reforçada**
   - Cliente obrigatório.
   - Veículo opcional, mas selecionável quando existir.
   - Serviço do catálogo opcional.
   - Descrição livre sempre disponível para quando o serviço não estiver cadastrado.
   - Funcionário responsável selecionável.
   - Observações editáveis.

4. **Permissões do backend serão alinhadas**
   - Vou revisar e ajustar as regras da base para que os perfis da oficina possam escrever em:
     - ordens de serviço;
     - itens da OS;
     - pagamentos da OS.
   - O objetivo é remover qualquer bloqueio de permissão que impeça mecânico, recepcionista ou financeiro de criar/editar/reabrir/fechar OS.

5. **Erro de linguagem nunca mais nas telas principais**
   - Vou remover dependência de tradução nas telas que ainda usam `useTranslation` e podem exibir chaves como `os.title`, `common.all`, etc.
   - Vou padronizar em português fixo nas áreas operacionais restantes:
     - Painel;
     - Configurações;
     - Pendente;
     - Bloqueado;
     - qualquer ponto encontrado com `t("...")` em rotas/componentes.

6. **Validação após implementar**
   - Vou checar no código que não restam chamadas de tradução capazes de mostrar chaves cruas.
   - Vou validar que a tela de OS lista, abre detalhe e contém os botões/ações esperados em português.

## Resultado esperado

A área de OS ficará funcional para qualquer perfil da oficina, com ciclo completo:

```text
Criar OS → Editar dados → Adicionar itens/pagamentos → Fechar → Reabrir → Alterar novamente → Imprimir/PDF
```

E o sistema deixará de mostrar textos como:

```text
os.title
common.all
os.number
os.openedAt
os.customer
os.vehicle
common.status
common.total
```