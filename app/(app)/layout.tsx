import { requireUser } from "@/lib/auth";
import { getCustomerOptions, getProducts, getStock } from "@/lib/queries";
import { sql } from "@/lib/db";
import { checkDatabase } from "@/lib/db-check";
import { isDevAuth } from "@/lib/supabase/server";
import { OrderPanelProvider } from "@/components/order-panel";
import { Sidebar } from "@/components/sidebar";
import { ToastProvider } from "@/components/toast";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  // Hit kommer bara inloggade (proxy.ts skickar övriga till /login)
  const dbProblem = await checkDatabase();
  if (dbProblem) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
        <div className="w-full max-w-[480px] rounded-xl border border-line bg-surface p-6">
          <h1 className="text-[16px] font-semibold text-danger">{dbProblem.title}</h1>
          <p className="mt-2 text-[13px] text-ink">{dbProblem.hint}</p>
          {dbProblem.detail ? (
            <p className="mt-4 rounded-md bg-canvas px-3 py-2 font-mono text-[12px] text-muted">{dbProblem.detail}</p>
          ) : null}
        </div>
      </div>
    );
  }

  const user = await requireUser();
  const [products, stock, customers, [{ n }]] = await Promise.all([
    getProducts(),
    getStock(),
    getCustomerOptions(),
    sql<{ n: number }[]>`select count(*)::int as n from orders where status in ('ny','bekraftad','ska_packas')`,
  ]);

  return (
    <ToastProvider>
      <OrderPanelProvider products={products} stock={stock} customers={customers}>
        <div className="flex min-h-screen flex-col md:flex-row">
          <div className="shrink-0 border-b border-line bg-canvas md:w-[228px] md:border-b-0 md:border-r">
            <Sidebar userName={user.name} counts={{ hantera: n }} devMode={isDevAuth()} />
          </div>
          <main className="min-w-0 flex-1">
            <div className="mx-auto w-full max-w-[1120px] px-4 py-6 sm:px-8 sm:py-8">{children}</div>
          </main>
        </div>
      </OrderPanelProvider>
    </ToastProvider>
  );
}
