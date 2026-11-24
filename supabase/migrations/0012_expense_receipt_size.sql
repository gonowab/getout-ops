begin;

alter table public.expenses
  drop constraint expenses_receipt_check,
  add constraint expenses_receipt_check
    check (octet_length(receipt) between 4 and 4000000);

commit;
