"use client";

import { useState } from "react";
import { cn } from "@/components/ui";

export type ColumnDatum = { key: string; label: string; tickLabel: string; value: number; detail?: string };

const nf = new Intl.NumberFormat("sv-SE");
const kr = (n: number) => `${nf.format(Math.round(n))} kr`;
const compact = (n: number) =>
  n >= 1_000_000 ? `${nf.format(Math.round(n / 100_000) / 10)} mkr` : n >= 10_000 ? `${nf.format(Math.round(n / 1000))} tkr` : nf.format(Math.round(n));

/** Ren skala: 0, 1 000, 2 000 … */
function niceMax(max: number) {
  if (max <= 0) return 1000;
  const pow = Math.pow(10, Math.floor(Math.log10(max)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * pow >= max) return m * pow;
  return 10 * pow;
}

/**
 * Stapeldiagram för en serie (ordervärde per dag/månad).
 * Staplar ≤ 24 px, 4 px rundad topp, rak bas, hårfina stödlinjer,
 * egen tooltip per stapel (mus och tangentbord), bara högsta stapeln etiketteras.
 */
export function ColumnChart({ data, height = 200 }: { data: ColumnDatum[]; height?: number }) {
  const [active, setActive] = useState<number | null>(null);
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)));
  const ticks = [0, 0.5, 1].map((f) => f * max);
  const maxIndex = data.reduce((best, d, i) => (d.value > (data[best]?.value ?? -1) ? i : best), 0);
  const hasValues = data.some((d) => d.value > 0);
  // Högst ~6 x-etiketter så att de inte krockar, även på mobil
  const every = Math.max(1, Math.ceil(data.length / 6));
  const showTick = (i: number) => {
    const last = data.length - 1;
    if (i === last) return true;
    return i % every === 0 && last - i >= every; // hoppa över en etikett som skulle krocka med den sista
  };

  return (
    <div className="relative select-none" style={{ paddingLeft: 52 }}>
      {/* Stödlinjer + y-axel */}
      <div className="relative" style={{ height }}>
        {ticks.map((t) => (
          <div
            key={t}
            className="absolute inset-x-0 border-t border-line"
            style={{ bottom: `${(t / max) * 100}%` }}
          >
            <span className="absolute -left-[52px] -translate-y-1/2 w-[44px] text-right text-[11px] tabular text-subtle">
              {compact(t)}
            </span>
          </div>
        ))}

        {/* Staplar */}
        <div className="absolute inset-0 flex items-end">
          {data.map((d, i) => {
            const h = (d.value / max) * 100;
            const isActive = active === i;
            return (
              <div
                key={d.key}
                className="relative flex h-full flex-1 cursor-default items-end justify-center outline-none"
                tabIndex={0}
                aria-label={`${d.label}: ${kr(d.value)}${d.detail ? `, ${d.detail}` : ""}`}
                onPointerEnter={() => setActive(i)}
                onPointerLeave={() => setActive((a) => (a === i ? null : a))}
                onFocus={() => setActive(i)}
                onBlur={() => setActive((a) => (a === i ? null : a))}
              >
                {d.value > 0 ? (
                  <div
                    className={cn(
                      "w-full max-w-[24px] rounded-t-[4px] bg-brand transition-opacity",
                      active !== null && !isActive && "opacity-55",
                    )}
                    style={{ height: `max(${h}%, 2px)`, marginInline: 1 }}
                  />
                ) : null}

                {/* Etikett på högsta stapeln */}
                {hasValues && i === maxIndex && active === null ? (
                  <span
                    className="pointer-events-none absolute whitespace-nowrap text-[11px] font-medium tabular text-ink"
                    style={{ bottom: `calc(${h}% + 4px)` }}
                  >
                    {compact(d.value)}
                  </span>
                ) : null}

                {isActive ? (
                  <div
                    role="tooltip"
                    className={cn(
                      "pointer-events-none absolute z-10 whitespace-nowrap rounded-md border border-line bg-surface px-2.5 py-1.5 text-[12px] shadow-md",
                      i > data.length * 0.7 ? "right-1/2" : i < data.length * 0.3 ? "left-1/2" : "left-1/2 -translate-x-1/2",
                    )}
                    style={{ bottom: `calc(${Math.min(h, 80)}% + 10px)` }}
                  >
                    <div className="text-muted">{d.label}</div>
                    <div className="font-semibold tabular text-ink">{kr(d.value)}</div>
                    {d.detail ? <div className="text-muted">{d.detail}</div> : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* X-axel */}
      <div className="mt-2 flex">
        {data.map((d, i) => (
          <div key={d.key} className="relative h-4 flex-1 text-[11px] text-subtle">
            {showTick(i) ? (
              <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap">{d.tickLabel}</span>
            ) : null}
          </div>
        ))}
      </div>

      {!hasValues ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center pl-[52px] text-[13px] text-muted">
          Inget ordervärde i perioden
        </div>
      ) : null}
    </div>
  );
}
