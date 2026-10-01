import "server-only";
import { Pool, types, type PoolClient } from "pg";
import { attachDatabasePool } from "@vercel/functions";
import { parseDatabaseUrl } from "@/lib/db-url";

/*
 * Databasanslutning via `pg` (node-postgres).
 *
 * Varför pg och inte postgres.js: Vercel pausar servern mellan förfrågningar.
 * attachDatabasePool (Vercels egen lösning) stänger vilande anslutningar innan
 * pausen, så att en väckt server aldrig försöker använda en död anslutning och
 * hänger. Det stöds för pg.
 *
 * Ovanpå pg finns ett litet lager som ger samma skrivsätt som tidigare:
 *   sql<Rad[]>`select … where id = ${id}`        – parametriserad fråga
 *   sql`and x = ${y}`                             – fragment som bäddas in i en annan fråga
 *   … in ${sql(lista)}                            – lista till in (…)
 *   insert into t ${sql(objekt eller lista)}      – kolumner + values
 *   update t set ${sql(objekt)}                   – kolumn = värde, …
 *   sql.begin(async (tx) => { … })                – transaktion
 */

// Datum som "YYYY-MM-DD" i stället för Date (undviker tidszonsfel)
types.setTypeParser(1082, (v) => v);

type Executor = { query: PoolClient["query"] };

class Helper {
  constructor(readonly value: unknown) {}
}

class Query<T> implements PromiseLike<T> {
  constructor(
    readonly strings: TemplateStringsArray,
    readonly values: unknown[],
    private readonly exec: () => Executor,
  ) {}

  then<A = T, B = never>(
    onfulfilled?: ((value: T) => A | PromiseLike<A>) | null,
    onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return this.run().then(onfulfilled, onrejected);
  }

  private async run(): Promise<T> {
    const params: unknown[] = [];
    const text = compile(this, params);
    const res = await this.exec().query(text, params);
    return res.rows as T;
  }
}

const IDENT = /^[a-z_][a-z0-9_]*$/;
function ident(name: string) {
  if (!IDENT.test(name)) throw new Error(`Ogiltigt kolumnnamn: ${name}`);
  return `"${name}"`;
}

function compile(q: Query<unknown>, params: unknown[]): string {
  let text = "";
  q.strings.forEach((s, i) => {
    text += s;
    if (i >= q.values.length) return;
    const v = q.values[i];
    if (v instanceof Query) {
      text += compile(v, params);
    } else if (v instanceof Helper) {
      text += compileHelper(v.value, text, params);
    } else {
      params.push(v === undefined ? null : v);
      text += `$${params.length}`;
    }
  });
  return text;
}

function compileHelper(value: unknown, before: string, params: unknown[]): string {
  const ph = (x: unknown) => {
    params.push(x === undefined ? null : x);
    return `$${params.length}`;
  };
  const tail = before.trimEnd().toLowerCase();

  // … in ${sql([1, 2, 3])}
  if (/\bin$/.test(tail)) {
    const list = value as unknown[];
    if (!Array.isArray(list) || list.length === 0) return "(null)";
    return `(${list.map(ph).join(", ")})`;
  }

  // update … set ${sql({ a: 1, b: 2 })}
  if (/\bset$/.test(tail)) {
    const obj = value as Record<string, unknown>;
    return Object.keys(obj)
      .map((k) => `${ident(k)} = ${ph(obj[k])}`)
      .join(", ");
  }

  // insert into t ${sql(objekt)} eller ${sql([objekt, objekt])}
  const rows = (Array.isArray(value) ? value : [value]) as Record<string, unknown>[];
  if (rows.length === 0) throw new Error("Inga rader att lägga in");
  const cols = Object.keys(rows[0]);
  const valuesSql = rows.map((r) => `(${cols.map((c) => ph(r[c])).join(", ")})`).join(", ");
  return `(${cols.map(ident).join(", ")}) values ${valuesSql}`;
}

export type Sql = {
  <T = Record<string, unknown>[]>(strings: TemplateStringsArray, ...values: unknown[]): Query<T>;
  (value: unknown): Helper;
  begin<R>(fn: (tx: Sql) => Promise<R>): Promise<R>;
};

function makeSql(exec: () => Executor): Sql {
  const fn = (first: unknown, ...rest: unknown[]) => {
    if (Array.isArray(first) && "raw" in (first as object)) {
      return new Query(first as unknown as TemplateStringsArray, rest, exec);
    }
    return new Helper(first);
  };
  const s = fn as unknown as Sql;
  s.begin = async <R>(work: (tx: Sql) => Promise<R>) => {
    const client = await getPool().connect();
    try {
      await client.query("begin");
      const result = await work(makeSql(() => client));
      await client.query("commit");
      return result;
    } catch (e) {
      await client.query("rollback").catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  };
  return s;
}

const globalForDb = globalThis as unknown as { pgPool?: Pool };

function getPool(): Pool {
  if (globalForDb.pgPool) return globalForDb.pgPool;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL saknas. Se SETUP.md.");
  const cfg = parseDatabaseUrl(url);
  const isLocal = ["localhost", "127.0.0.1"].includes(cfg.host);

  const pool = new Pool({
    ...cfg,
    ssl: isLocal ? false : { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 10_000,
    // Ingen fråga får hänga: efter 15 s avbryts den med ett fel i stället
    query_timeout: 15_000,
    keepAlive: true,
  });
  // En anslutning som dör ska inte krascha servern – den tas bort ur poolen
  pool.on("error", (err) => console.error("[db] anslutningsfel", err.message));
  attachDatabasePool(pool);
  globalForDb.pgPool = pool;
  return pool;
}

// Poolen skapas först vid första frågan, så att bygget inte kräver DATABASE_URL.
export const sql: Sql = makeSql(() => getPool());
