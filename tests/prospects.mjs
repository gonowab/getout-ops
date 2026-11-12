const { PGlite } = await import(process.env.PGLITE_MODULE || "@electric-sql/pglite");
import {readFile,readdir} from "node:fs/promises";
import assert from "node:assert/strict";
const root = process.argv[2] || process.cwd();
const db = new PGlite();
await db.exec(await readFile(root+"/scripts/dev-stubs.sql","utf8"));
for(const file of (await readdir(root+"/supabase/migrations")).sort()) await db.exec(await readFile(root+"/supabase/migrations/"+file,"utf8"));
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

const actions = load("@/lib/actions/prospects");
const ok=r=>{assert.equal(r.ok,true,r.error);return r;};
const blank=ok(await actions.saveProspect(null,{}));
const saved=ok(await actions.saveProspect(null,{name:"Testbutik",email:"kontakt@example.com",contact_name:"Anna",notes:"Ring igen nästa vecka"}));
for(const status of ["red","yellow","green",null]) {
 ok(await actions.updateProspectStatus(saved.id,status));
 const row=(await db.query("select * from reseller_prospects where id=$1",[saved.id])).rows[0];
 assert.equal(row.status,status);assert.equal(row.notes,"Ring igen nästa vecka");assert.equal(row.contacted,false);
}
ok(await actions.updateProspectContacted(saved.id,true));
assert.equal((await db.query("select contacted from reseller_prospects where id=$1",[saved.id])).rows[0].contacted,true);
ok(await actions.saveProspect(saved.id,{name:"Uppdaterad",notes:"Ny anteckning",contacted:true,status:"green"}));
const row=(await db.query("select * from reseller_prospects where id=$1",[saved.id])).rows[0];
assert.equal(row.name,"Uppdaterad");assert.equal(row.notes,"Ny anteckning");assert.equal(row.status,"green");
assert.equal((await actions.updateProspectStatus(saved.id,"blue")).ok,false);
assert.equal((await actions.updateProspectContacted(saved.id,"yes")).ok,false);
assert.equal((await actions.saveProspect("not-an-id",{})).ok,false);
assert.equal((await actions.updateProspectStatus("00000000-0000-0000-0000-000000000002","green")).ok,false);
assert.equal((await db.query("select count(*)::int as n from customers")).rows[0].n,0);
assert.equal((await db.query("select count(*)::int as n from orders")).rows[0].n,0);
assert.equal((await db.query("select relrowsecurity from pg_class where relname='reseller_prospects'")).rows[0].relrowsecurity,true);
assert.equal((await db.query("select status from reseller_prospects where id=$1",[blank.id])).rows[0].status,null);
process.env.DATABASE_URL=previousDatabaseUrl;
await db.close();
console.log("PASS: migrations, empty prospect, all colors, contacted flag, notes/editing, invalid status/ID, isolated register and RLS.");
