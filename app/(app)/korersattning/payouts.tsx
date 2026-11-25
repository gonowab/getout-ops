import { formatExpenseAmount } from "@/lib/expenses";
import type { mileageAmounts } from "@/lib/mileage";

export function MileagePayouts({ amounts }: { amounts: ReturnType<typeof mileageAmounts> }) {
  return (
    <div className="space-y-3 text-sm">
      <dl className="space-y-1">
        <div className="flex justify-between gap-2"><dt>Milersättning · 25 kr/mil</dt><dd>{formatExpenseAmount(amounts.mileageOre)}</dd></div>
        <div className="flex justify-between gap-2"><dt>Återstår att dela</dt><dd>{formatExpenseAmount(amounts.remainingOre)}</dd></div>
        <div className="flex justify-between gap-2 font-semibold"><dt>Totalt att betala ut</dt><dd>{formatExpenseAmount(amounts.totalOre)}</dd></div>
      </dl>
      <ul className="divide-y divide-line border-t border-line">
        {amounts.payouts.map(({ person, fuel, shared, total }) => (
          <li key={person} className="flex justify-between gap-3 py-2">
            <div>
              <p className="font-medium">{person}</p>
              {fuel > 0 && <p className="text-xs text-muted">{formatExpenseAmount(fuel)} bensin + {formatExpenseAmount(shared)} delad ersättning</p>}
            </div>
            <strong className="shrink-0">{formatExpenseAmount(total)}</strong>
          </li>
        ))}
      </ul>
      {amounts.totalOre > amounts.mileageOre && <p className="text-warn">Bensinen kostade mer än milersättningen. Hela bensinkostnaden ersätts och inget belopp delas.</p>}
    </div>
  );
}
