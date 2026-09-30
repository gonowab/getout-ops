import { PageHeader } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { getProducts } from "@/lib/queries";
import { isDevAuth } from "@/lib/supabase/server";
import { PasswordForm, ThresholdForm } from "./forms";

export const metadata = { title: "Inställningar" };

export default async function SettingsPage() {
  const [user, products] = await Promise.all([getCurrentUser(), getProducts()]);

  return (
    <>
      <PageHeader title="Inställningar" />

      <section className="mb-12 max-w-[640px]">
        <h2 className="mb-1 text-[15px] font-semibold">Varning för lågt lager</h2>
        <p className="mb-4 text-[13px] text-muted">
          Översikten varnar när tillgängligt lager går under gränsen. Sätt 0 för att stänga av varningen, som för
          gamla askar som ska säljas slut.
        </p>
        <ThresholdForm products={products} />
      </section>

      <section className="max-w-[420px]">
        <h2 className="mb-1 text-[15px] font-semibold">Ditt konto</h2>
        <p className="mb-4 text-[13px] text-muted">
          Inloggad som {user?.name}
          {user?.email ? ` (${user.email})` : ""}.
        </p>
        {isDevAuth() ? (
          <p className="text-[13px] text-muted">Lösenord kan inte bytas i testläget.</p>
        ) : (
          <PasswordForm />
        )}
      </section>
    </>
  );
}
