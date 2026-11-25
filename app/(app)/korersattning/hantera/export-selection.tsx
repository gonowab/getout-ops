"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui";

export function MileageExportSelection({ children }: { children: ReactNode }) {
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function download(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !count) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/korersattning/underlag", {
        method: "POST",
        body: new FormData(event.currentTarget),
      });
      if (!response.ok) {
        setError(await response.text());
        return;
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = response.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ?? "milersattningsunderlag.pdf";
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch {
      setError("Det gick inte att ladda ner underlaget. Försök igen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={download} onChange={(event) => setCount(new FormData(event.currentTarget).getAll("resor").length)}>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Button type="submit" variant="primary" disabled={busy || count === 0} className="max-md:min-h-11">
          {busy ? "Genererar…" : "Ladda ner PDF-underlag"}
        </Button>
        <span className="text-sm text-muted" aria-live="polite">{count ? `${count} valda resor` : "Markera resorna som ska ingå."}</span>
        {error && <p role="alert" className="w-full text-sm text-danger">{error}</p>}
      </div>
      {children}
    </form>
  );
}
