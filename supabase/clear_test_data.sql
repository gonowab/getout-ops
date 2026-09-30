-- ============================================================
-- Rensa ALL testdata inför skarp start.
-- Tar bort ordrar, kunder och lagerrörelser. Produkter och användare behålls.
-- Ordernumren börjar om på GO-1001.
-- ============================================================
begin;
truncate order_events, order_lines, inventory_movements, orders, customers restart identity cascade;
alter table orders alter column order_number restart with 1001;
commit;
