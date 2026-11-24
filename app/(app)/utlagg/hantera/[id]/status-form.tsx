"use client";

import { useActionState, useState } from "react";
import { Button, Field, Select } from "@/components/ui";
import { updateExpenseStatus } from "@/lib/actions/expenses";
import { expenseStatuses, type ExpenseStatus } from "@/lib/expenses";

export function ExpenseStatusForm({ id, status }: { id: string; status: ExpenseStatus }) {
  const [nextStatus, setNextStatus] = useState<string>(status);
  const [error, action, pending] = useActionState(updateExpenseStatus.bind(null, id, status), null);

  return (
    <form action={action} className="space-y-3">
      <Field label="Status" htmlFor="expense-status">
        <Select id="expense-status" name="status" value={nextStatus} disabled={pending} onChange={(event) => setNextStatus(event.target.value)}>
          {Object.entries(expenseStatuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </Select>
      </Field>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <Button type="submit" variant="primary" disabled={pending || nextStatus === status}>
        {pending ? "Sparar…" : "Spara status"}
      </Button>
    </form>
  );
}
