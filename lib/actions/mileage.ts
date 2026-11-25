"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { requireExpenseManager } from "@/lib/expense-access";
import { expenseIdPattern, expensePeople, expenseStatuses } from "@/lib/expenses";
import { mileageAmounts, mileagePerson, parseFuelAmount, parseMileageDistance, validMileageDate } from "@/lib/mileage";
import { sql } from "@/lib/db";
import { todayISO } from "@/lib/format";

export async function estimateMileage(origin: string, destination: string, roundTrip: boolean) {
  await requireUser();
  const key = process.env.GOOGLE_ROUTES_API_KEY;
  if (!key) return { error: "Avståndssökning är inte aktiverad. Ange körda kilometer manuellt." };
  if (typeof origin !== "string" || typeof destination !== "string") return { error: "Ange start och slutpunkt." };
  const from = origin.trim();
  const to = destination.trim();
  if (!from || !to || from.length > 180 || to.length > 180 || from === to) {
    return { error: "Ange två olika adresser eller orter för att uppskatta avståndet." };
  }
  try {
    const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": "routes.distanceMeters" },
      body: JSON.stringify({
        origin: { address: from },
        destination: { address: roundTrip ? from : to },
        ...(roundTrip ? { intermediates: [{ address: to }] } : {}),
        travelMode: "DRIVE",
        regionCode: "SE",
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    if (response.ok) {
      const result = await response.json() as { routes?: { distanceMeters: number }[] };
      const meters = result.routes?.[0]?.distanceMeters;
      if (typeof meters === "number" && Number.isFinite(meters) && meters > 0) {
        const kilometers = (Math.max(1, Math.round(meters / 100)) / 10).toFixed(1).replace(".", ",");
        if (parseMileageDistance(kilometers)) return { kilometers };
      }
    }
  } catch {
    // Manuell inmatning fungerar även när karttjänsten är otillgänglig.
  }
  return { error: "Kunde inte hitta körsträckan. Kontrollera adresserna eller ange körda kilometer manuellt." };
}

export async function submitMileage(form: FormData) {
  const user = await requireUser();
  const field = (name: string) => String(form.get(name) ?? "").trim();
  const id = field("id");
  const driver = mileagePerson(field("driver"));
  const date = field("date");
  const origin = field("origin");
  const destination = field("destination");
  const distance = parseMileageDistance(field("distance"));
  const purpose = field("purpose");
  const fuelOre = parseFuelAmount(field("fuel"));
  const fuelPayer = fuelOre ? mileagePerson(field("fuelPayer")) : null;
  const recipients = expensePeople.filter((person) => form.getAll("recipient").includes(person));

  if (!expenseIdPattern.test(id)) return "Öppna Ny resa igen och försök på nytt.";
  if (!driver || !validMileageDate(date) || date > todayISO()) return "Välj förare och ett giltigt resedatum.";
  if (!origin || !destination || origin.length > 180 || destination.length > 180 || !distance) {
    return "Ange start, mål och en körsträcka mellan 0,1 och 10 000 km.";
  }
  if (!purpose || purpose.length > 160) return "Ange ett syfte på högst 160 tecken.";
  if (fuelOre === null || (fuelOre > 0 && !fuelPayer)) return "Ange bensinkostnad och vem som betalade.";
  if (!recipients.length) return "Välj minst en person som ska dela på återstoden.";

  const amounts = mileageAmounts(distance, fuelOre, fuelPayer ?? null, recipients);
  try {
    const [saved] = await sql<{ id: string }[]>`
      insert into public.mileage_claims
        (id, driver, travel_date, origin, destination, distance_tenths, purpose, fuel_ore, fuel_payer, recipients, amounts, submitted_by)
      values (${id}, ${driver}, ${date}, ${origin}, ${destination}, ${distance}, ${purpose}, ${fuelOre}, ${fuelPayer},
        ${recipients}, ${JSON.stringify(amounts)}::jsonb, ${user.id})
      on conflict (id) do update set id = excluded.id
      where mileage_claims.submitted_by = excluded.submitted_by
      returning id`;
    if (!saved) return "Resan kunde inte sparas. Öppna Ny resa igen.";
  } catch (error) {
    console.error("[mileage] Kunde inte spara resa", error instanceof Error ? error.message : "");
    return "Resan kunde inte sparas. Uppgifterna finns kvar så att du kan försöka igen.";
  }
  revalidatePath("/korersattning/hantera");
  return null;
}

export async function updateMileageStatus(id: string, previous: string, _: string | null, form: FormData) {
  await requireExpenseManager();
  const status = form.get("status");
  if (!expenseIdPattern.test(id) || typeof status !== "string" || !Object.hasOwn(expenseStatuses, status)) {
    return "Välj en giltig status.";
  }
  try {
    const [updated] = await sql<{ id: string }[]>`
      update public.mileage_claims set status = ${status}, status_updated_at = now()
      where id = ${id} and status = ${previous} and status <> ${status}
      returning id`;
    revalidatePath("/korersattning/hantera");
    revalidatePath(`/korersattning/hantera/${id}`);
    return updated ? null : "Statusen har ändrats. Kontrollera den aktuella statusen.";
  } catch {
    return "Statusen kunde inte sparas. Försök igen.";
  }
}
