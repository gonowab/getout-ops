import { AlertTriangle } from "lucide-react";
import { EmptyState, PageHeader, cn } from "@/components/ui";
import { ResellerFormButton } from "@/components/reseller-form";
import { FollowedUpButton } from "@/components/reseller-followed-up-button";
import { getResellerDeliveries, getResellerNameSuggestions } from "@/lib/queries";
import { num, relativeDays, shortDate, todayISO } from "@/lib/format";
import type { ResellerDelivery } from "@/lib/types";

export const metadata = { title: "Återförsäljare" };

type Tone = "due" | "upcoming" | "done";

function DeliveryTable({
  rows,
  tone,
  suggestions,
  today,
}: {
  rows: ResellerDelivery[];
  tone: Tone;
  suggestions: string[];
  today: string;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full min-w-[760px] text-[13px]">
        <thead className="bg-canvas text-left text-[12px] text-muted">
          <tr>
            <th className="px-4 py-2 font-medium">Återförsäljare</th>
            <th className="px-4 py-2 text-right font-medium">Antal</th>
            <th className="px-4 py-2 font-medium">Fick kortlekarna</th>
            <th className="px-4 py-2 font-medium">Följ upp</th>
            <th className="px-4 py-2 font-medium">Anteckning</th>
            <th className="w-[1%] px-4 py-2" />
          </tr>
        </thead>
        <tbody>
          {rows.map((d) => (
            <tr key={d.id} className="border-t border-line align-top hover:bg-canvas">
              <td className="px-4 py-2.5 font-medium text-ink">{d.name}</td>
              <td className="px-4 py-2.5 text-right tabular">{num(d.quantity)}</td>
              <td className="whitespace-nowrap px-4 py-2.5 text-muted tabular">{shortDate(d.delivered_on)}</td>
              <td
                className={cn(
                  "whitespace-nowrap px-4 py-2.5 tabular",
                  tone === "due" ? "font-medium text-danger" : "text-muted",
                )}
              >
                {shortDate(d.follow_up_on)}
                {tone !== "done" ? (
                  <span className="ml-1.5 text-[12px] font-normal">({relativeDays(d.follow_up_on)})</span>
                ) : null}
              </td>
              <td className="max-w-[340px] px-4 py-2.5 text-muted">
                {d.note ? (
                  <span className="line-clamp-2 whitespace-pre-line" title={d.note}>
                    {d.note}
                  </span>
                ) : (
                  <span className="text-subtle">–</span>
                )}
              </td>
              <td className="px-4 py-2">
                <div className="flex items-center justify-end gap-1">
                  <FollowedUpButton id={d.id} name={d.name} done={tone === "done"} />
                  <ResellerFormButton delivery={d} suggestions={suggestions} today={today} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function AterforsaljarePage() {
  const today = todayISO();
  const [deliveries, suggestions] = await Promise.all([getResellerDeliveries(), getResellerNameSuggestions()]);

  const open = deliveries.filter((d) => !d.followed_up);
  const due = open.filter((d) => d.follow_up_on <= today);
  const upcoming = open.filter((d) => d.follow_up_on > today);
  const done = deliveries.filter((d) => d.followed_up);

  const totalQty = deliveries.reduce((s, d) => s + d.quantity, 0);
  const resellers = new Set(deliveries.map((d) => d.name.trim().toLowerCase())).size;

  return (
    <>
      <PageHeader
        title="Återförsäljare"
        description={
          deliveries.length === 0
            ? "Håll koll på vilka som fått kortlekar och när det är dags att höra av sig."
            : `${num(totalQty)} kortlekar levererade till ${num(resellers)} återförsäljare`
        }
        actions={<ResellerFormButton suggestions={suggestions} today={today} />}
      />

      {deliveries.length === 0 ? (
        <EmptyState title="Inga leveranser än">
          Tryck på Ny leverans när en återförsäljare fått kortlekar. Uppföljningen sätts till en månad senare.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-10">
          <section>
            <div className="mb-3 flex items-baseline justify-between gap-4">
              <h2 className="flex items-center gap-1.5 text-[15px] font-semibold">
                {due.length > 0 ? <AlertTriangle className="size-4 text-danger" aria-hidden /> : null}
                Dags att följa upp <span className="font-normal text-subtle tabular">{due.length}</span>
              </h2>
            </div>
            {due.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line px-4 py-4 text-[13px] text-muted">
                Ingen uppföljning är försenad just nu.
              </p>
            ) : (
              <DeliveryTable rows={due} tone="due" suggestions={suggestions} today={today} />
            )}
          </section>

          {upcoming.length > 0 ? (
            <section>
              <h2 className="mb-3 text-[15px] font-semibold">
                Kommande <span className="font-normal text-subtle tabular">{upcoming.length}</span>
              </h2>
              <DeliveryTable rows={upcoming} tone="upcoming" suggestions={suggestions} today={today} />
            </section>
          ) : null}

          {done.length > 0 ? (
            <section>
              <details>
                <summary className="mb-3 cursor-pointer text-[15px] font-semibold text-ink">
                  Uppföljda <span className="font-normal text-subtle tabular">{done.length}</span>
                </summary>
                <DeliveryTable rows={done} tone="done" suggestions={suggestions} today={today} />
              </details>
            </section>
          ) : null}
        </div>
      )}
    </>
  );
}
