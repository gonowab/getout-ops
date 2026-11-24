begin;
set local lock_timeout = '3s';

alter table public.expenses add column expense_number bigint;

with numbered as (
  select id, row_number() over (order by created_at, id) as expense_number
  from public.expenses
)
update public.expenses as expense
set expense_number = numbered.expense_number
from numbered
where expense.id = numbered.id;

alter table public.expenses alter column expense_number set not null;

alter table public.expenses
  alter column expense_number add generated always as identity,
  add constraint expenses_expense_number_key unique (expense_number);

select setval(
  pg_get_serial_sequence('public.expenses', 'expense_number'),
  coalesce(max(expense_number), 0) + 1,
  false
)
from public.expenses;

commit;
