-- Tillbehör har ingen askversion. Kortlekarnas gamla/nya askar behålls.
-- Skapar endast artikeln och Shopify-kopplingen; befintliga ordrar ändras inte.
begin;

alter table products alter column edition drop not null;

insert into products (sku, name, region, edition, sort_order, low_stock_threshold)
values ('GO-PRESENTPASE', 'Presentpåse till kortlek', 'Presentpåse', null, 7, 0)
on conflict (sku) do nothing;

-- Verifierad i Shopify: produkt 16189372203338, variant 64311209886026.
insert into shopify_variants (shopify_variant_id, product_id, title)
select '64311209886026', id, 'Presentpåse till kortlek'
from products where sku = 'GO-PRESENTPASE'
on conflict (shopify_variant_id) do update
set product_id = excluded.product_id, title = excluded.title;

commit;
