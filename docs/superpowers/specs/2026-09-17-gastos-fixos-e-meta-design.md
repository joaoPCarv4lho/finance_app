# Gastos Fixos Mensais + Cálculo Automático de Meta

**Data:** 2026-09-17
**Status:** Aprovado

## Contexto

O app ("Meu Bolso") já permite cadastro de usuário com renda mensal, um modo
de orçamento (regra 50/30/20 ou orçamento livre) e metas de economia
(`Goal`: nome, valor-alvo, valor acumulado, data-alvo opcional). Não existe
hoje nenhum conceito de "gastos fixos mensais" (aluguel, internet, streaming
etc.), nem cálculo de quanto o usuário precisa guardar por mês para bater
uma meta até a data-alvo.

## Objetivo

1. Permitir que o usuário cadastre seus gastos fixos mensais como uma lista
   de itens nomeados (nome + valor), editável a qualquer momento.
2. Ao criar (e a cada vez que visualizar) uma meta com data-alvo, o app
   calcula e exibe quanto o usuário precisa guardar por mês até a data
   limite, e informa se isso é viável dada a renda menos os gastos fixos
   (renda disponível).

Fora de escopo: alterar a regra 50/30/20 ou o "teto de gastos" existente
(`budget_service.py`) — gastos fixos alimentam apenas o cálculo de metas,
não substituem nem se misturam com esse recurso.

## Modelo de dados (backend)

Nova tabela `fixed_expenses`, uma linha por item de gasto fixo:

- `id: UUID` (PK)
- `user_id: UUID` (FK `users.id`, `ondelete=CASCADE`, indexado)
- `name: str` (1–100 chars)
- `amount: Decimal(12,2)` (> 0)
- `created_at: datetime`

Tabela nova e aditiva — criada automaticamente pelo `Base.metadata.create_all`
existente no startup (não requer Alembic nem apagar o `finance_app.db`
atual). Adicionar relationship `fixed_expenses` em `User` (cascade delete) e
registrar o modelo em `app/models/__init__.py`.

## API (backend)

Novo router `fixed_expenses` (prefixo `/fixed-expenses`), seguindo
exatamente o padrão de `goals.py` / `goal_service.py`:

- `POST /fixed-expenses` — cria um item (`FixedExpenseCreate{name, amount}`).
- `GET /fixed-expenses` — lista os itens do usuário autenticado, ordenados
  por `created_at`.
- `PATCH /fixed-expenses/{id}` — atualiza nome/valor (`FixedExpenseUpdate`,
  todos os campos opcionais).
- `DELETE /fixed-expenses/{id}` — remove um item (204).

`FixedExpenseService` (em `app/services/fixed_expense_service.py`) espelha
`GoalService`: `create`, `get`, `list`, `update`, `delete`, mais um helper
estático `total_for_user(db, user_id) -> Decimal` (soma dos `amount`, `0` se
não houver itens) usado pelo cálculo de metas.

## Cálculo do plano de economia da meta

Função pura `compute_savings_plan(goal, disposable_income, today=None) ->
SavingsPlan` (novo módulo `app/services/goal_planning.py`), sem I/O, fácil de
testar isoladamente:

Entradas: `target_amount`, `current_amount`, `target_date` (todos do
`Goal`), `disposable_income` (Decimal, calculado pelo chamador como
`user.monthly_income - FixedExpenseService.total_for_user(...)`, mínimo 0).

Regras:
- Se `is_completed` (current >= target) ou `target_date` é `None`: todos os
  campos do plano ficam `None`/vazios (não há necessidade de guardar mais
  nada, ou não há prazo definido).
- `remaining_amount = max(target_amount - current_amount, 0)`.
- `months_remaining`: número de meses inteiros entre hoje e `target_date`,
  arredondado **para cima**, mínimo `1` (mesmo se `target_date` for hoje ou
  já tiver passado — nesse caso vira "1 mês", ou seja, "precisa guardar tudo
  agora").
- `monthly_amount_needed = remaining_amount / months_remaining`, arredondado
  para 2 casas decimais.
- `is_feasible = disposable_income >= monthly_amount_needed`.
- `savings_shortfall = max(monthly_amount_needed - disposable_income, 0)`.

`GoalOut` (schema) ganha os campos `monthly_amount_needed: Decimal | None`,
`months_remaining: int | None`, `disposable_income: Decimal`,
`is_feasible: bool | None`, `savings_shortfall: Decimal | None`. Como esses
campos dependem do `User` (renda + gastos fixos), não podem ser
`computed_field` puros do Pydantic sobre `Goal` — adicionar um classmethod
`GoalOut.from_goal(goal, disposable_income)` usado pelos endpoints de
`goals.py` no lugar de `GoalOut.model_validate(goal)`. Os endpoints buscam
`disposable_income` uma vez por request (renda do `current_user` menos
`FixedExpenseService.total_for_user`).

Isso garante que o valor exibido está sempre atualizado (se o usuário editar
os gastos fixos ou a renda depois, o card da meta reflete o novo cálculo na
próxima vez que a lista for buscada), não apenas congelado no momento da
criação — que é o que o pedido original describe ("assim que o usuário criar
a meta, o app já deve calcular"), mas mantendo o valor correto depois também.

## Frontend

**Nova página `FixedExpenses.jsx`** (rota `/gastos-fixos`, dentro do
`Layout` autenticado): lista de cards nome+valor (padrão visual de
`Goals.jsx`), total no topo, modal de criar/editar (reaproveita
`Modal.jsx`), botão excluir com confirmação. Novos métodos em
`api/client.js`: `getFixedExpenses`, `createFixedExpense`,
`updateFixedExpense`, `deleteFixedExpense`.

**Onboarding pós-cadastro:** em `Register.jsx`, após `await register(...)`
suceder, navegar (`useNavigate`) para `/gastos-fixos?onboarding=1` em vez de
deixar o redirect padrão levar ao Dashboard. Quando a query string
`onboarding=1` estiver presente, `FixedExpenses.jsx` mostra um banner
("Antes de começar, quais são seus gastos fixos mensais?") e troca o botão
de navegação por "Pular por agora" / "Concluir e ir para o Dashboard" —
ambos navegam para `/`. O usuário continua podendo acessar `/gastos-fixos`
depois normalmente (sem o banner) a partir de um link em `Settings.jsx`
("Gerenciar gastos fixos").

**Exibição do cálculo em `Goals.jsx`:** cada card de meta com
`target_date` e não concluída mostra uma linha adicional: "Guarde
{formatCurrency(monthly_amount_needed)}/mês até {formatDate(target_date)}".
Se `is_feasible === false`, exibir um aviso (estilo `alert`) com
`savings_shortfall` — algo como "Faltam {formatCurrency(savings_shortfall)}
por mês para isso ser viável com sua renda disponível atual — considere
ajustar o prazo ou reduzir gastos fixos.". Esses campos já vêm prontos em
cada `Goal` retornado por `GET /goals` e `POST /goals`, sem chamada extra no
frontend.

## Testes

Projeto não tem suíte automatizada hoje (sem pytest configurado no backend,
sem vitest/playwright no frontend).

- **Backend:** adicionar `pytest` + `pytest-asyncio` + `httpx` (ASGI
  transport) a `requirements.txt`. Testes de unidade para
  `compute_savings_plan` (casos: sem data, já concluída, data futura normal,
  data no mês corrente, data já vencida, renda disponível suficiente vs.
  insuficiente) e testes de integração (SQLite em memória) para o CRUD de
  `fixed_expenses` e para `GET/POST /goals` retornando os novos campos
  corretamente.
- **Frontend:** validação manual end-to-end via automação de navegador
  (skill `claude-in-chrome`): cadastro → tela de gastos fixos (pular e,
  numa segunda conta, preencher) → criar meta com data-alvo → conferir o
  valor calculado e o aviso de viabilidade no card da meta → editar gastos
  fixos e confirmar que o valor no card da meta é atualizado ao recarregar.
