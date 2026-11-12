import { ResellerRegister } from "@/components/reseller-register";
import { getProducts, getResellerRegister } from "@/lib/queries";
import { todayISO } from "@/lib/format";

export const metadata = { title: "Återförsäljare" };

export default async function AterforsaljarePage() {
  const [register, products] = await Promise.all([
    getResellerRegister(),
    getProducts(),
  ]);
  return (
    <ResellerRegister {...register} products={products} today={todayISO()} />
  );
}
