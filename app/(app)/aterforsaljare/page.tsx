import { ResellerTabs } from "@/components/reseller-prospects";
import { getProspects } from "@/lib/prospect-queries";
import { ResellerRegister } from "@/components/reseller-register";
import { getProducts, getResellerRegister } from "@/lib/queries";
import { todayISO } from "@/lib/format";

export const metadata = { title: "Återförsäljare" };

export default async function AterforsaljarePage() {
  const [register, products, prospects] = await Promise.all([
    getResellerRegister(),
    getProducts(),
    getProspects(),
  ]);
  return (
    <ResellerTabs
      prospects={prospects}
      resellerCount={register.resellers.length}
    >
      <ResellerRegister {...register} products={products} today={todayISO()} />
    </ResellerTabs>
  );
}
