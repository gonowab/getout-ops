/**
 * Tolkar DATABASE_URL utan att kräva att lösenordet är URL-kodat.
 *
 * Standardtolkningen går sönder om lösenordet innehåller t.ex. @ # / ? eller om
 * värdet klistrats in med mellanslag, citattecken eller "DATABASE_URL=" framför.
 * Här delas strängen upp för hand: användaren slutar vid första ":" och
 * lösenordet sträcker sig fram till SISTA "@" före adressen.
 */
export type DbConfig = {
  host: string;
  port: number;
  user: string;
  password: string | undefined;
  database: string;
};

export class DatabaseUrlError extends Error {}

export function parseDatabaseUrl(raw: string): DbConfig {
  let s = raw.trim();
  s = s.replace(/^DATABASE_URL\s*=\s*/i, "").trim();
  s = s.replace(/^["']|["']$/g, "").trim();

  const scheme = s.match(/^(postgres(?:ql)?):\/\//i);
  if (!scheme) throw new DatabaseUrlError("Strängen ska börja med postgresql://");
  const rest = s.slice(scheme[0].length);

  const at = rest.lastIndexOf("@");
  if (at === -1) throw new DatabaseUrlError("Strängen saknar @ mellan lösenord och adress.");
  const userinfo = rest.slice(0, at);
  const hostpart = rest.slice(at + 1);

  const colon = userinfo.indexOf(":");
  const user = safeDecode(colon === -1 ? userinfo : userinfo.slice(0, colon));
  let password = colon === -1 ? "" : userinfo.slice(colon + 1);

  if (/^\[?YOUR-PASSWORD\]?$/i.test(password))
    throw new DatabaseUrlError("[YOUR-PASSWORD] har inte bytts ut mot det riktiga lösenordet.");
  // Hakparenteserna från Supabases mall ska bort – ta dem om de blivit kvar runt lösenordet
  if (password.startsWith("[") && password.endsWith("]")) password = password.slice(1, -1);
  password = safeDecode(password);

  const m = hostpart.match(/^([^:/?#\s]+)(?::(\d+))?(?:\/([^?#\s]*))?/);
  if (!m) throw new DatabaseUrlError("Adressen efter @ går inte att läsa.");
  const host = m[1];
  const port = m[2] ? Number(m[2]) : 5432;
  const database = m[3] ? safeDecode(m[3]) : "postgres";

  return { host, port, user, password: password || undefined, database };
}

function safeDecode(v: string) {
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}
