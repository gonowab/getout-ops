import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Appens riktiga adress. Vercel ger varje version en egen permanent adress
// (getout-xxxx-getout1.vercel.app); de skickas hit så att ingen hamnar i en gammal version.
const CANONICAL_HOST = process.env.VERCEL_PROJECT_PRODUCTION_URL || "getout-ops.vercel.app";

// Håller Supabase-sessionen färsk och skickar utloggade till /login.
export async function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  if (
    process.env.VERCEL_ENV === "production" &&
    request.method === "GET" &&
    host.endsWith(".vercel.app") &&
    host !== CANONICAL_HOST
  ) {
    const to = new URL(request.nextUrl.pathname + request.nextUrl.search, `https://${CANONICAL_HOST}`);
    return NextResponse.redirect(to, 308);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const devAuth = process.env.DEV_AUTH === "true" && !process.env.VERCEL;
  if (devAuth || !url || !key) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // getClaims förnyar sessionen vid behov och verifierar lokalt när det går
  const { data } = await supabase.auth.getClaims();
  const loggedIn = Boolean(data?.claims?.sub);
  const isLogin = request.nextUrl.pathname.startsWith("/login");

  if (!loggedIn && !isLogin) {
    const to = request.nextUrl.clone();
    to.pathname = "/login";
    to.search = "";
    return NextResponse.redirect(to);
  }
  if (loggedIn && isLogin) {
    const to = request.nextUrl.clone();
    to.pathname = "/";
    return NextResponse.redirect(to);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|api/webhooks|.*\\.(?:png|jpg|svg|ico)$).*)"],
};
