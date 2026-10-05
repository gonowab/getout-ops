import { unstable_rethrow } from "next/navigation";
import { requireUser } from "@/lib/auth";
import {
  getCustomerOptions,
  getProducts,
  getStock,
  getOpenOrderCount,
  getDueFollowUpCount,
} from "@/lib/queries";
import { checkDatabase } from "@/lib/db-check";
import { isDevAuth } from "@/lib/supabase/server";
import { OrderPanelProvider } from "@/components/order-panel";
import { Sidebar } from "@/components/sidebar";
import { ToastProvider } from "@/components/toast";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  let data;
  try {
    const user = await requireUser();
    const [products, stock, customers, openCount, followUpCount] = await Promise.all([
      getProducts(),
      getStock(),
      getCustomerOptions(),
      getOpenOrderCount(),
      getDueFollowUpCount(),
    ]);
    data = { user, products, stock, customers, openCount, followUpCount };
  } catch (e) {
    unstable_rethrow(e); // låt omdirigering till /login gå igenom
    // Bara när något gått fel: ta reda på om det är databasen och visa ett begripligt fel
    const problem = await checkDatabase();
    if (!problem) throw e;
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
        <div className="w-full max-w-[480px] rounded-xl border border-line bg-surface p-6">
          <h1 className="text-[16px] font-semibold text-danger">{problem.title}</h1>
          <p className="mt-2 text-[13px] text-ink">{problem.hint}</p>
          {problem.detail ? (
            <p className="mt-4 rounded-md bg-canvas px-3 py-2 font-mono text-[12px] text-muted">{problem.detail}</p>
          ) : null}
        </div>
      </div>
    );
  }

  const { user, products, stock, customers, openCount, followUpCount } = data;
  return (
    <ToastProvider>
      <OrderPanelProvider products={products} stock={stock} customers={customers}>
        <div className="flex min-h-screen flex-col md:flex-row">
          <div className="shrink-0 border-b border-line bg-canvas md:w-[228px] md:border-b-0 md:border-r">
            <Sidebar userName={user.name} counts={{ hantera: openCount, uppfoljning: followUpCount }} devMode={isDevAuth()} />
          </div>
          <main className="min-w-0 flex-1">
            <div className="mx-auto w-full max-w-[1120px] px-4 py-6 sm:px-8 sm:py-8">{children}</div>
          </main>
        </div>
      </OrderPanelProvider>
    </ToastProvider>
  );
}
