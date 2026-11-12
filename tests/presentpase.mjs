// Isolerad Postgres; testar appens riktiga importer och SQL utan externa tjänster.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const root = process.cwd();
const require = createRequire(root + '/package.json');
const ts = require('typescript');
const db = new PGlite();
await db.exec(readFileSync('scripts/dev-stubs.sql', 'utf8'));
for (const name of readdirSync('supabase/migrations').sort()) {
  if (name.endsWith('.sql')) await db.exec(readFileSync('supabase/migrations/' + name, 'utf8'));
}
// Migrationen får köras igen utan att skapa fler produkter eller kopplingar.
await db.exec(readFileSync('supabase/migrations/0009_presentpase.sql', 'utf8'));
const loaded = new Map();
class Pool {
  on() {}
  query(text, params) { return db.query(text, params); }
  async connect() { return { query: (text, params) => db.query(text, params), release() {} }; }
}
process.env.DATABASE_URL = 'postgres://test@localhost/test';
function load(name) {
  if (name === 'server-only') return {};
  if (name === '@/components/order-actions' || name === '@/components/bulk-select') return {};
  if (name === 'next/link') return () => null;
  if (name === 'pg') return { Pool, types: { setTypeParser() {} } };
  if (name === '@vercel/functions') return { attachDatabasePool() {} };
  if (!name.startsWith('@/')) return require(name);
  let path = resolve(root, name.slice(2) + '.ts');
  if (!existsSync(path)) path += 'x';
  if (loaded.has(path)) return loaded.get(path).exports;
  const mod = { exports: {} };
  loaded.set(path, mod);
  const js = ts.transpileModule(readFileSync(path, 'utf8'), {
    fileName: path,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  new Function('require', 'module', 'exports', js)(load, mod, mod.exports);
  return mod.exports;
}
const { processShopifyOrder } = load('@/lib/shopify');
const queries = load('@/lib/queries');
const products = await queries.getProducts();
const bag = products.find((p) => p.sku === 'GO-PRESENTPASE');
assert.equal(products.filter((p) => p.sku === 'GO-PRESENTPASE').length, 1);
assert.equal(bag.edition, null);
const card = products.find((p) => p.sku === 'GO-SKANE-NY');
await db.query('update products set shopify_variant_id=$1 where id=$2', ['111111111111', card.id]);
const payload = (id, lines) => ({ id, name: '#' + id,
  created_at: new Date().toISOString(), financial_status: 'paid', taxes_included: true,
  line_items: lines, shipping_address: { name: 'Testkund' } });
const cardLine = { variant_id: '111111111111', title: 'Kortlek', quantity: 1, price: '279.00', tax_lines: [{ price: '55.80' }] };
const bagLine = { variant_id: '64311209886026', title: 'Presentpåse till kortlek', quantity: 2, price: '49.00', tax_lines: [{ price: '19.60' }] };
const mixed = payload('9001', [cardLine, bagLine]);
assert.equal((await processShopifyOrder('orders/create', mixed, 'test-mixed')).outcome, 'importerad');
const imported = await queries.getOrderByNumber(1001);
assert.equal(imported.lines.length, 2);
assert.equal(imported.lines.find((l) => l.product_id === bag.id).quantity, 2);
assert.equal(Number(imported.lines.find((l) => l.product_id === bag.id).unit_price), 39.2);
assert.equal(Number(imported.lines.find((l) => l.product_id === card.id).unit_price), 223.2);
assert.equal((await processShopifyOrder('orders/create', mixed, 'test-mixed')).outcome, 'dubblett');
await processShopifyOrder('orders/create', payload('9002', [cardLine]), 'test-card');
assert.equal((await queries.getOrderByNumber(1002)).lines.length, 1);
await processShopifyOrder('orders/create', payload('9003', [bagLine]), 'test-bag');
assert.equal((await queries.getOrderByNumber(1003)).lines[0].product_id, bag.id);
const summary = await queries.getOrderSummary('packa');
assert.equal(summary.total_qty, 2); // bara kortlekar
assert.equal(summary.accessories, 4);
assert.equal(summary.single_count, 2); // påsarna gör inte en kortlek till flera
assert.equal(summary.multiple_count, 0);
assert.equal((await queries.getStock()).find((s) => s.product_id === bag.id).reserverat, 4);
// Befintlig order kompletteras inte när en senare Shopify-webhook innehåller påse.
await processShopifyOrder('orders/updated', payload('9002', [cardLine, bagLine]), 'test-update');
assert.equal((await queries.getOrderByNumber(1002)).lines.length, 1);
// Lagerdragning sker fortfarande exakt en gång via den befintliga SQL-funktionen.
await db.query("select set_order_status($1, 'skickad')", [imported.order.id]);
await db.query("select set_order_status($1, 'skickad')", [imported.order.id]);
const movement = (await db.query("select sum(quantity)::int as n from inventory_movements where order_id=$1 and product_id=$2", [imported.order.id, bag.id])).rows[0];
assert.equal(movement.n, -2);
await db.query("select set_order_status($1, 'makulerad')", [imported.order.id]);
assert.equal((await db.query('select * from inventory_movements where order_id=$1', [imported.order.id])).rows.length, 0);
assert.equal(load('@/lib/labels').productLabel(bag), 'Presentpåse');
// Verifiera den synliga packsummeringen med den riktiga komponenten.
const { renderToStaticMarkup } = require('react-dom/server');
const { OrderSummary } = load('@/components/order-summary');
const html = renderToStaticMarkup(require('react').createElement(OrderSummary, { summary, view: 'packa' }));
assert.match(html, /Tillbehör/);
assert.match(html, /4 st/);
assert.match(html, /Totalt kortlekar/);
const { ProductChips } = load('@/components/order-table');
const chips = renderToStaticMarkup(require('react').createElement(ProductChips, { lines: imported.lines, products }));
assert.match(chips, /Presentpåse till kortlek/);
assert.match(chips, />2<\/span>/);
assert.match(chips, /Skåne/);
assert.equal(renderToStaticMarkup(require('react').createElement(load('@/components/ui').EditionTag, { edition: null })), '');

console.log('PASS: migration, kortlek + påse, bara kortlek, bara påse, rätt antal/pris, dubbletter, oförändrade äldre ordrar, separat packsummering och en enda lagerdragning.');
await db.close();
