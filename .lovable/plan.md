## Plano de correção urgente

1. **Remover a recursão nas regras de acesso**
   - Substituir as policies de `companies`, `units` e `memberships` que hoje consultam tabelas ligadas entre si de forma circular.
   - Criar/ajustar funções seguras no banco para validar:
     - se o usuário é administrador geral do sistema;
     - se é dono da empresa;
     - se é administrador da oficina dentro daquela empresa;
     - se pertence à unidade.

2. **Corrigir o cadastro de empresa pelo cliente aprovado**
   - Garantir que o cliente aprovado consiga criar a empresa pelo CNPJ.
   - Garantir que, ao criar a primeira unidade, ele receba automaticamente o perfil **Administrador da Oficina** naquela unidade.

3. **Garantir múltiplas unidades sem conflito de dados**
   - Manter cada unidade separada por `unit_id`.
   - Permitir que o Administrador da Oficina crie, edite e exclua unidades da própria empresa.
   - Evitar que dados de clientes, veículos, OS, peças, serviços e financeiro de uma unidade apareçam indevidamente em outra.

4. **Revisar permissões principais do Administrador da Oficina**
   - Confirmar acesso para cadastrar/excluir:
     - clientes;
     - colaboradores;
     - veículos;
     - serviços;
     - peças;
     - unidades;
     - ordens e financeiro conforme já definido.
   - Permitir alteração dos perfis criados por ele, sem permitir alteração do Administrador Geral do Sistema.

5. **Melhorar mensagem de erro**
   - Se ainda houver erro de permissão, mostrar mensagem clara em pt-BR, em vez de erro técnico do banco.

6. **Validação após aplicar**
   - Testar o fluxo: cliente aprovado → Configurações → cadastrar empresa → cadastrar primeira unidade → liberar menu lateral completo do Administrador da Oficina.
   - Verificar que o erro `infinite recursion detected in policy for relation "companies"` desapareceu.