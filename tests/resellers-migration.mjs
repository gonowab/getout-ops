const { PGlite } = await import(
  process.env.PGLITE_MODULE || "@electric-sql/pglite"
);
import { readFile, readdir } from "node:fs/promises";
import assert from "node:assert/strict";
const root = process.argv[2] || process.cwd();
const db = new PGlite();
await db.exec(await readFile(root + "/scripts/dev-stubs.sql", "utf8"));
for (const name of (await readdir(root + "/supabase/migrations")).sort()) {
  if (name.startsWith("0008")) break;
  await db.exec(await readFile(root + "/supabase/migrations/" + name, "utf8"));
}
const [{ id: cid }] = (
  await db.query(
    "insert into customers(name,type,contact_name,email,notes) values('Testbutiken','aterforsaljare','Anna','anna@example.com','Äldre kundanteckning') returning id",
  )
).rows;
await db.query(
  "insert into reseller_deliveries(name,quantity,delivered_on,follow_up_on,note) values('Testbutiken',10,'2026-10-01','2026-12-15','Kommission')",
);
await db.query(
  "insert into orders(customer_id,source) values($1,'aterforsaljare')",
  [cid],
);
await db.exec(
  await readFile(
    root + "/supabase/migrations/0008_reseller_register.sql",
    "utf8",
  ),
);
assert.equal(
  (await db.query("select * from customers where type='aterforsaljare'")).rows
    .length,
  1,
);
assert.equal(
  (await db.query("select contacts from customers")).rows[0].contacts[0].email,
  "anna@example.com",
);
assert.equal(
  (await db.query("select body from reseller_notes")).rows[0].body,
  "Äldre kundanteckning",
);
let rows = (await db.query("select * from reseller_deliveries")).rows;
assert.equal(rows.length, 2);
const legacy = rows.find((r) => !r.order_id);
assert.equal(legacy.customer_id, cid);
assert.equal(legacy.note, "Kommission");
assert.equal(legacy.follow_up_manual, true);
assert.equal(legacy.follow_up_on.toISOString().slice(0, 10), "2026-12-15");
// Blank återförsäljare och order utan produkter ska kunna sparas.
const blank = (
  await db.query(
    "insert into customers(name,type) values('','aterforsaljare') returning id",
  )
).rows[0];
const order = (
  await db.query(
    "insert into orders(customer_id,source) values($1,'aterforsaljare') returning id",
    [blank.id],
  )
).rows[0];
assert.equal(
  (
    await db.query("select * from reseller_deliveries where order_id=$1", [
      order.id,
    ])
  ).rows.length,
  1,
);
await db.query("update orders set customer_id=customer_id where id=$1", [
  order.id,
]);
assert.equal(
  (
    await db.query("select * from reseller_deliveries where order_id=$1", [
      order.id,
    ])
  ).rows.length,
  1,
);
const product = (await db.query("select id from products limit 1")).rows[0];
await db.query(
  "insert into order_lines(order_id,product_id,quantity,unit_price) values($1,$2,10,100)",
  [order.id, product.id],
);
assert.equal(
  (
    await db.query("select total_qty from orders_overview where id=$1", [
      order.id,
    ])
  ).rows[0].total_qty,
  10,
);
await db.query("select set_order_status($1,'skickad')", [order.id]);
assert.equal(
  (
    await db.query(
      "select sum(quantity)::int as qty from inventory_movements where order_id=$1",
      [order.id],
    )
  ).rows[0].qty,
  -10,
);
await db.query("select set_order_status($1,'levererad')", [order.id]);
assert.equal(
  (
    await db.query(
      "select sum(quantity)::int as qty from inventory_movements where order_id=$1",
      [order.id],
    )
  ).rows[0].qty,
  -10,
);
await db.query("update orders set invoice_status='fakturerad' where id=$1", [
  order.id,
]);
// Daterad anteckning med tomt datum fungerar.
await db.query("insert into reseller_notes(customer_id,body) values($1,'')", [
  blank.id,
]);
assert.equal(
  (
    await db.query("select noted_on from reseller_notes where customer_id=$1", [
      blank.id,
    ])
  ).rows[0].noted_on,
  null,
);
console.log(
  "PASS: migration, bevarad historik/kontakter, frivilliga fält, orderkoppling utan dubbletter, produktantal, fakturastatus och en enda lagerdragning.",
);
// Kör de riktiga serverfunktionerna mot den isolerade databasen. Endast auth,
// cache, lagring och pg-transport ersätts; SQL-kompilatorn/transaktionerna är appens.
const { createRequire } = await import("node:module");
const { readFileSync } = await import("node:fs");
const { resolve } = await import("node:path");
const requireFromProject = createRequire(root + "/package.json");
const ts = requireFromProject("typescript");
const loaded = new Map();
const user = { id: "00000000-0000-0000-0000-000000000001" };
await db.query(
  "insert into profiles(id,full_name) values($1,'Test') on conflict do nothing",
  [user.id],
);
const previousDatabaseUrl = process.env.DATABASE_URL;
process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test";
class TestPool {
  on() {}
  async query(text, params) {
    return db.query(text, params);
  }
  async connect() {
    return { query: (text, params) => db.query(text, params), release() {} };
  }
}
function load(name) {
  if (name === "server-only") return {};
  if (name === "pg") return { Pool: TestPool, types: { setTypeParser() {} } };
  if (name === "@vercel/functions") return { attachDatabasePool() {} };
  if (name === "next/cache") return { revalidatePath() {} };
  if (name === "@/lib/auth") return { requireUser: async () => user };
  if (name === "@/lib/storage")
    return {
      uploadInvoicePdf: async () => {},
      removeInvoicePdf: async () => {},
    };
  if (!name.startsWith("@/")) return requireFromProject(name);
  const path = resolve(root, name.slice(2) + ".ts");
  if (loaded.has(path)) return loaded.get(path).exports;
  const mod = { exports: {} };
  loaded.set(path, mod);
  const js = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  new Function("require", "module", "exports", js)(load, mod, mod.exports);
  return mod.exports;
}
const actions = load("@/lib/actions/resellers");
const ordersActions = load("@/lib/actions/orders");
const assertOK = (r) => {
  assert.equal(r.ok, true, r.error);
  return r;
};
const saved = assertOK(
  await actions.saveReseller(null, {
    name: "Integration",
    contacts: [
      { name: "A", email: "a@example.com" },
      { name: "B", email: "b@example.com" },
    ],
  }),
);
const newDelivery = assertOK(
  await actions.saveDelivery({
    customerId: saved.id,
    deliveredOn: "2026-11-12",
    lines: [{ productId: product.id, quantity: 10 }],
    unitPrice: 100,
    shipAddress: "Testgatan 1",
    note: "Kommission",
  }),
);
const delivery = (
  await db.query("select * from reseller_deliveries where order_id=$1", [
    newDelivery.id,
  ])
).rows[0];
assert.equal(delivery.follow_up_on.toISOString().slice(0, 10), "2026-12-12");
assert.equal(
  (
    await db.query("select weight_grams from orders where id=$1", [
      newDelivery.id,
    ])
  ).rows[0].weight_grams,
  1900,
);
assertOK(
  await actions.saveDelivery({
    id: delivery.id,
    deliveredOn: "2026-11-15",
    followUpManual: true,
    followUpOn: "2027-01-10",
    lines: [{ productId: product.id, quantity: 10 }],
    unitPrice: 100,
  }),
);
assert.equal(
  (
    await db.query("select follow_up_on from reseller_deliveries where id=$1", [
      delivery.id,
    ])
  ).rows[0].follow_up_on
    .toISOString()
    .slice(0, 10),
  "2027-01-10",
);
assertOK(
  await ordersActions.updateInvoice(
    newDelivery.id,
    new Map([["invoiceStatus", "fakturerad"]]),
  ),
);
assert.equal(
  (
    await db.query("select invoice_status from orders where id=$1", [
      newDelivery.id,
    ])
  ).rows[0].invoice_status,
  "fakturerad",
);
assertOK(await ordersActions.changeOrderStatus(newDelivery.id, "skickad"));
const rejected = await actions.saveDelivery({
  id: delivery.id,
  lines: [{ productId: product.id, quantity: 11 }],
});
assert.equal(rejected.ok, false);
assert.equal(
  (
    await db.query("select quantity from order_lines where order_id=$1", [
      newDelivery.id,
    ])
  ).rows[0].quantity,
  10,
);
assertOK(
  await actions.saveResellerNote(
    saved.id,
    null,
    new Map([
      ["body", "Ny anteckning"],
      ["noted_on", ""],
    ]),
  ),
);
assertOK(await actions.saveDelivery({}));
assertOK(await actions.setResellerFollowedUp(delivery.id, true));
assert.equal(
  (
    await db.query("select followed_up from reseller_deliveries where id=$1", [
      delivery.id,
    ])
  ).rows[0].followed_up,
  true,
);
// Koppling av äldre leverans bevarar datum och anteckning utan extra order.
const oldOrder = (
  await db.query("select id from orders where customer_id=$1", [cid])
).rows[0];
assertOK(await actions.linkLegacyDelivery(legacy.id, oldOrder.id));
assert.equal(
  (
    await db.query(
      "select count(*)::int as n from reseller_deliveries where customer_id=$1",
      [cid],
    )
  ).rows[0].n,
  1,
);
assert.equal(
  (await db.query("select comment from orders where id=$1", [oldOrder.id]))
    .rows[0].comment,
  "Kommission",
);
process.env.DATABASE_URL = previousDatabaseUrl;
console.log(
  "PASS: verkliga serverfunktioner för återförsäljare, leveranser, vikt, manuella datum, fakturering utan obligatoriskt datum, anteckningar, tom leverans, uppföljning och koppling av äldre historik. Skickade antal skyddas och transaktionen återställs vid fel.",
);

await db.close();
