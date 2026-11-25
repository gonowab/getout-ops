import { expensePeople, parseExpenseAmount } from "./expenses";

export type MileagePerson = (typeof expensePeople)[number];
export const mileageRateOrePerKm = 250;
export const mileageMaxTenths = 100_000;

export function parseMileageDistance(input: string) {
  const match = /^(\d{1,5})(?:[,.](\d))?$/.exec(input.trim());
  if (!match) return null;
  const tenths = Number(match[1]) * 10 + Number(match[2] ?? 0);
  return tenths > 0 && tenths <= mileageMaxTenths ? tenths : null;
}

export function parseFuelAmount(value: string) {
  const fuel = value.trim();
  return !fuel || /^0+(?:[,.]0{1,2})?$/.test(fuel) ? 0 : parseExpenseAmount(fuel);
}

export function mileageAmounts(distanceTenths: number, fuelOre: number, payer: MileagePerson | null, recipients: readonly MileagePerson[]) {
  const mileageOre = distanceTenths * (mileageRateOrePerKm / 10);
  const remainingOre = Math.max(0, mileageOre - fuelOre);
  const share = Math.floor(remainingOre / recipients.length);
  const extra = remainingOre % recipients.length;
  const payouts = expensePeople.flatMap((person) => {
    const index = recipients.indexOf(person);
    if (index < 0 && person !== payer) return [];
    const fuel = person === payer ? fuelOre : 0;
    const shared = index < 0 ? 0 : share + Number(index < extra);
    return [{ person, fuel, shared, total: fuel + shared }];
  });
  return { mileageOre, remainingOre, totalOre: fuelOre + remainingOre, payouts };
}

export function mileagePerson(input: string) {
  return expensePeople.find((person) => person === input);
}

export function validMileageDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000")) return false;
  const parsed = new Date(value + "T00:00:00Z");
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

export type MileageAddress = { id: string; name: string; address: string };

export const mileageTripKinds = { "one-way": "Enkel väg", return: "Tur och retur" } as const;
export type MileageTripKind = keyof typeof mileageTripKinds;
