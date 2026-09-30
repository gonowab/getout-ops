import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-2 text-center">
      <h1 className="text-[18px] font-semibold">Sidan finns inte</h1>
      <p className="text-[13px] text-muted">Ordern eller kunden kan ha tagits bort, eller så är länken fel.</p>
      <Link href="/" className="mt-2 text-[13px] font-medium text-brand-strong hover:underline">
        Till översikten
      </Link>
    </div>
  );
}
