"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Boxes, CarFront, LayoutGrid, LogOut, Menu, Package, Plus, Receipt, Settings, Store, Users, Wallet, X } from "lucide-react";
import { cn, Kbd } from "@/components/ui";
import { useOrderPanel } from "@/components/order-panel";
import { signOut } from "@/lib/actions/auth";

const NAV = [
  { href: "/", label: "Översikt", icon: LayoutGrid },
  { href: "/ordrar", label: "Ordrar", icon: Package },
  { href: "/lager", label: "Lager", icon: Boxes },
  { href: "/kunder", label: "Kunder", icon: Users },
  { href: "/aterforsaljare", label: "Återförsäljare", icon: Store },
  { href: "/ekonomi", label: "Ekonomi", icon: Wallet },
  { href: "/utlagg", label: "Utlägg", icon: Receipt },
  { href: "/korersattning", label: "Körersättning", icon: CarFront },
];

export function Sidebar({
  userName,
  counts,
  devMode,
}: {
  userName: string;
  counts: { hantera: number; uppfoljning: number };
  devMode: boolean;
}) {
  const pathname = usePathname();
  const { openNew } = useOrderPanel();
  const [menuOpen, setMenuOpen] = useState(false);
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <aside className="flex w-full flex-col md:sticky md:top-0 md:h-screen"
      onKeyDown={(event) => {
        if (event.key === "Escape" && menuOpen) {
          setMenuOpen(false);
          event.currentTarget.querySelector<HTMLButtonElement>("#mobile-menu-toggle")?.focus();
        }
      }}>
      <div className="flex items-center justify-between px-4 pb-2 pt-4 max-md:gap-2 max-md:px-3 max-md:py-2 md:block">
        <Link href="/" aria-label="GetOut Operations" onClick={() => setMenuOpen(false)} className="flex items-baseline gap-1.5 px-1 max-md:min-h-11 max-md:items-center">
          <span className="text-[17px] font-bold tracking-[-0.02em]">
            <span className="text-black">Get</span>
            <span className="text-brand">Out</span>
          </span>
          <span className="text-[13px] text-muted max-[400px]:hidden">Operations</span>
        </Link>
        <button
          type="button"
          onClick={() => {
            setMenuOpen(false);
            openNew();
          }}
          className="flex h-8 items-center justify-center gap-1.5 rounded-md bg-ink px-3 text-[13px] font-medium text-white hover:bg-black max-md:ml-auto max-md:h-11 max-md:shrink-0 md:mt-4 md:w-full md:justify-between"
        >
          <span className="flex items-center gap-1.5">
            <Plus className="size-4" /> Ny order
          </span>
          <span className="hidden md:inline">
            <Kbd>N</Kbd>
          </span>
        </button>
        <button id="mobile-menu-toggle" type="button" aria-expanded={menuOpen} aria-controls="operations-navigation operations-account"
          onClick={() => setMenuOpen((open) => !open)}
          className="flex h-11 items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 text-[13px] font-medium md:hidden">
          {menuOpen ? <X className="size-4" aria-hidden /> : <Menu className="size-4" aria-hidden />}
          Meny
        </button>
      </div>

      <nav id="operations-navigation" aria-label="Huvudmeny" className={cn(
        "gap-0.5 px-3 pb-2 md:mt-3 md:flex md:flex-col",
        menuOpen ? "grid grid-cols-2" : "hidden",
      )}>
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={isActive(href) ? "page" : undefined}
            onClick={() => setMenuOpen(false)}
            className={cn(
              "flex h-8 shrink-0 items-center gap-2.5 rounded-md px-2.5 text-[13px] transition-colors max-md:h-11 max-md:gap-1.5 max-md:px-2",
              isActive(href)
                ? "bg-surface font-medium text-ink shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                : "text-muted hover:bg-hover hover:text-ink",
            )}
          >
            <Icon className="size-4 max-md:shrink-0" strokeWidth={1.75} aria-hidden />
            <span className="flex-1">{label}</span>
            {href === "/ordrar" && counts.hantera > 0 ? (
              <span className="hidden text-[12px] tabular text-subtle md:inline">{counts.hantera}</span>
            ) : null}
            {href === "/aterforsaljare" && counts.uppfoljning > 0 ? (
              <span className="hidden text-[12px] font-medium tabular text-danger md:inline">{counts.uppfoljning}</span>
            ) : null}
          </Link>
        ))}
      </nav>

      <div id="operations-account" className={cn("mt-auto flex-col gap-0.5 px-3 pb-4 md:flex", menuOpen ? "flex" : "hidden")}>
        {devMode ? (
          <div className="mb-2 rounded-md border border-dashed border-warn/40 bg-warn-soft px-2.5 py-2 text-[12px] text-warn">
            Testläge – ingen riktig inloggning
          </div>
        ) : null}
        <Link
          href="/installningar"
          onClick={() => setMenuOpen(false)}
          className={cn(
            "flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] transition-colors max-md:h-11",
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
            className="flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-[13px] text-muted hover:bg-hover hover:text-ink max-md:h-11"
          >
            <LogOut className="size-4" strokeWidth={1.75} />
            <span className="flex-1 truncate">Logga ut {userName}</span>
          </button>
        </form>
      </div>
    </aside>
  );
}
