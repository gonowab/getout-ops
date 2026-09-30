import { requireUser } from "@/lib/auth";
import { getCustomerOptions, getProducts, getStock } from "@/lib/queries";
import { sql } from "@/lib/db";
import { isDevAuth } from "@/lib/supabase/server";
import { OrderPanelProvider } from "@/components/order-panel";
import { Sidebar } from "@/components/sidebar";
import { ToastProvider } from "@/components/toast";

export default async function AppLayout({ children }: LayoutProps<"/">) {
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
