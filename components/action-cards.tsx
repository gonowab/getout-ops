import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export function ActionCards({ options }: {
  options: { href: string; label: string; description: string; icon: LucideIcon }[];
}) {
  return (
    <div className="grid max-w-2xl gap-3 sm:grid-cols-2">
      {options.map(({ href, label, description, icon: Icon }) => (
        <Link key={href} href={href} className="rounded-xl border border-line bg-surface p-5 hover:border-line-strong hover:bg-hover">
          <Icon className="mb-3 size-5 text-muted" aria-hidden />
          <h2 className="font-semibold">{label}</h2>
          <p className="mt-1 text-sm text-muted">{description}</p>
        </Link>
      ))}
    </div>
  );
}
