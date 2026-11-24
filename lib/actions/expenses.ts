"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { requireExpenseManager } from "@/lib/expense-access";
import { expenseIdPattern, expensePeople, expenseStatuses, imageReceiptMaxBytes, isPdfReceipt, parseExpenseAmount, pdfReceiptMaxBytes, pdfReceiptType } from "@/lib/expenses";

export async function submitExpense(form: FormData) {
  const user = await requireUser();
  const id = form.get("id");
  const person = form.get("person");
  const reason = String(form.get("reason") ?? "").trim();
  const amount = parseExpenseAmount(String(form.get("amount") ?? ""));
  const file = form.get("receipt");

  if (typeof id !== "string" || !expenseIdPattern.test(id)) return "Formuläret kunde inte läsas. Öppna Nytt utlägg igen.";
  if (!expensePeople.some((name) => name === person)) return "Välj vem som gjorde utlägget.";
  if (!reason || reason.length > 160) return "Ange en anledning på högst 160 tecken.";
  if (amount === null) return "Ange ett giltigt belopp i kronor.";
  if (!(file instanceof File) || file.size < 4) {
    return "Lägg till kvittot som bild eller PDF.";
  }
  const isPdf = file.type === pdfReceiptType;
  if (isPdf && file.size > pdfReceiptMaxBytes) return "PDF-kvittot får vara högst 4 MB.";
  if (!isPdf && file.size > imageReceiptMaxBytes) return "Kvittobilden är för stor. Välj bilden igen.";

  const receipt = Buffer.from(await file.arrayBuffer());
  const validImage = file.type === "image/jpeg"
    && receipt[0] === 0xff && receipt[1] === 0xd8 && receipt.at(-2) === 0xff && receipt.at(-1) === 0xd9;
  if (!validImage && !(isPdf && isPdfReceipt(receipt))) {
    return "Kvittot kunde inte läsas. Välj en annan bild eller PDF.";
  }

  let saved;
  try {
    [saved] = await sql<{ expense_number: string }[]>`
      insert into public.expenses (id, person, reason, amount_ore, receipt, submitted_by)
      values (${id}, ${person}, ${reason}, ${amount}, ${receipt}, ${user.id})
      on conflict (id) do update set id = excluded.id
      where expenses.submitted_by = excluded.submitted_by
      returning expense_number`;
    if (!saved) return "Utlägget kunde inte sparas. Öppna Nytt utlägg igen.";
  } catch (error) {
    console.error("[expenses] Kunde inte spara utlägg", error instanceof Error ? error.message : "");
    return "Det gick inte att spara utlägget. Dina uppgifter finns kvar så att du kan försöka igen.";
  }
  revalidatePath("/utlagg/hantera");
  return { expenseNumber: saved.expense_number };
}

export async function updateExpenseStatus(id: string, previous: string, _: string | null, form: FormData) {
  await requireExpenseManager();
  const status = form.get("status");
  if (!expenseIdPattern.test(id) || typeof status !== "string" || !Object.hasOwn(expenseStatuses, status)) {
    return "Välj en giltig status.";
  }
  try {
    const [updated] = await sql<{ id: string }[]>`
      update public.expenses set status = ${status}, status_updated_at = now()
      where id = ${id} and status = ${previous} and status <> ${status}
      returning id`;
    if (!updated) {
      revalidatePath(`/utlagg/hantera/${id}`);
      return "Statusen kunde inte ändras. Kontrollera den aktuella statusen.";
    }
  } catch {
    return "Statusen kunde inte sparas. Försök igen.";
  }
  revalidatePath("/utlagg/hantera");
  revalidatePath(`/utlagg/hantera/${id}`);
  return null;
}
