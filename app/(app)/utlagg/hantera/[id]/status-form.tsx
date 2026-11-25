"use client";

import { useActionState, useState } from "react";
import { Button, Field, Select } from "@/components/ui";
import { updateExpenseStatus } from "@/lib/actions/expenses";
import { expenseStatuses, type ExpenseStatus } from "@/lib/expenses";

export function ExpenseStatusForm({
  id, status, saveStatusAction = updateExpenseStatus,
}: {
  id: string;
  status: ExpenseStatus;
  saveStatusAction?: (id: string, previous: string, error: string | null, form: FormData) => Promise<string | null>;
}) {
  const [nextStatus, setNextStatus] = useState<string>(status);
  const [error, action, pending] = useActionState(saveStatusAction.bind(null, id, status), null);

  return (
    <form action={action} className="space-y-3">
      <Field label="Status" htmlFor="expense-status">
        <Select id="expense-status" name="status" value={nextStatus} disabled={pending} className="max-md:h-11 max-md:text-base" onChange={(event) => setNextStatus(event.target.value)}>
          {Object.entries(expenseStatuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </Select>
      </Field>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <Button type="submit" variant="primary" className="max-md:min-h-11" disabled={pending || nextStatus === status}>
        {pending ? "Sparar…" : "Spara status"}
      </Button>
    </form>
  );
}
