import "server-only";
import postgres from "postgres";
import { parseDatabaseUrl } from "@/lib/db-url";

// En anslutning per serverinstans. På Vercel används Supabase "transaction pooler"
// (port 6543), som inte stödjer prepared statements – därav prepare: false.
const globalForDb = globalThis as unknown as { sql?: postgres.Sql };

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL saknas. Se SETUP.md.");
  const cfg = parseDatabaseUrl(url);
  const isLocal = ["localhost", "127.0.0.1"].includes(cfg.host);
  return postgres({
    ...cfg,
    prepare: false,
    max: 5,
    idle_timeout: 20,
    ssl: isLocal ? false : "require",
    types: {
      // Behåll datum som "YYYY-MM-DD" i stället för att göra om till Date (undviker tidszonsfel)
      date: {
        to: 1082,
        from: [1082],
        serialize: (x: string) => x,
        parse: (x: string) => x,
      },
    },
  });
}

function getClient(): postgres.Sql {
  if (!globalForDb.sql) globalForDb.sql = createClient();
  return globalForDb.sql;
}

// Skapas först vid första anropet, så att bygget inte kräver DATABASE_URL.
export const sql = new Proxy(function () {} as unknown as postgres.Sql, {
  apply: (_t, _this, args) => (getClient() as unknown as (...a: unknown[]) => unknown)(...args),
  get: (_t, prop) => Reflect.get(getClient(), prop),
});
