"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Boxes, LayoutGrid, LogOut, Package, Plus, Settings, Users, Wallet } from "lucide-react";
import { cn, Kbd } from "@/components/ui";
import { useOrderPanel } from "@/components/order-panel";
import { signOut } from "@/lib/actions/auth";

const NAV = [
  { href: "/", label: "Översikt", icon: LayoutGrid },
  { href: "/ordrar", label: "Ordrar", icon: Package },
  { href: "/lager", label: "Lager", icon: Boxes },
  { href: "/kunder", label: "Kunder", icon: Users },
  { href: "/ekonomi", label: "Ekonomi", icon: Wallet },
];

export function Sidebar({
  userName,
  counts,
  devMode,
}: {
  userName: string;
  counts: { hantera: number };
  devMode: boolean;
}) {
  const pathname = usePathname();
  const { openNew } = useOrderPanel();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <aside className="flex w-full flex-col md:sticky md:top-0 md:h-screen">
      <div className="flex items-center justify-between px-4 pb-2 pt-4 md:block">
        <Link href="/" className="flex items-baseline gap-1.5 px-1">
          <span className="text-[17px] font-bold tracking-[-0.02em]">
            <span className="text-black">Get</span>
            <span className="text-brand">Out</span>
          </span>
          <span className="text-[13px] text-muted">Operations</span>
        </Link>
        <button
          type="button"
          onClick={() => openNew()}
          className="flex h-8 items-center justify-center gap-1.5 rounded-md bg-ink px-3 text-[13px] font-medium text-white hover:bg-black md:mt-4 md:w-full md:justify-between"
        >
          <span className="flex items-center gap-1.5">
            <Plus className="size-4" /> Ny order
          </span>
          <span className="hidden md:inline">
            <Kbd>N</Kbd>
          </span>
        </button>
      </div>

      <nav className="flex gap-0.5 overflow-x-auto px-3 pb-2 md:mt-3 md:flex-col md:overflow-visible">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex h-8 shrink-0 items-center gap-2.5 rounded-md px-2.5 text-[13px] transition-colors",
              isActive(href)
                ? "bg-surface font-medium text-ink shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                : "text-muted hover:bg-hover hover:text-ink",
            )}
          >
            <Icon className="size-4" strokeWidth={1.75} />
            <span className="flex-1">{label}</span>
            {href === "/ordrar" && counts.hantera > 0 ? (
              <span className="hidden text-[12px] tabular text-subtle md:inline">{counts.hantera}</span>
            ) : null}
          </Link>
        ))}
      </nav>

      <div className="mt-auto hidden flex-col gap-0.5 px-3 pb-4 md:flex">
        {devMode ? (
          <div className="mb-2 rounded-md border border-dashed border-warn/40 bg-warn-soft px-2.5 py-2 text-[12px] text-warn">
            Testläge – ingen riktig inloggning
          </div>
        ) : null}
        <Link
          href="/installningar"
          className={cn(
            "flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] transition-colors",
            pathname.startsWith("/installningar")
              ? "bg-surface font-medium text-ink"
              : "text-muted hover:bg-hover hover:text-ink",
          )}
        >
          <Settings className="size-4" strokeWidth={1.75} />
          Inställningar
        </Link>
        <form action={signOut}>
          <button
            type="submit"
            className="flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-[13px] text-muted hover:bg-hover hover:text-ink"
          >
            <LogOut className="size-4" strokeWidth={1.75} />
            <span className="flex-1 truncate">Logga ut {userName}</span>
          </button>
        </form>
      </div>
    </aside>
  );
}
