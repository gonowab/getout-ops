"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button, ButtonLink, Field, Input, Textarea, buttonClass, cn } from "@/components/ui";
import { expensePeople, formatExpenseAmount, isPdfReceipt, parseExpenseAmount, pdfReceiptType, receiptMaxBytes } from "@/lib/expenses";
import { submitExpense } from "@/lib/actions/expenses";

const steps = ["Vem gjorde utlägget?", "Vad gällde köpet?", "Vad var totalsumman?", "Lägg till kvittot", "Granska utlägget"];

async function prepareReceiptImage(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();

    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 2400 / Math.max(image.naturalWidth, image.naturalHeight));
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Bildbehandling saknas.");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    for (const quality of [0.9, 0.8, 0.65, 0.5]) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      if (blob && blob.size <= receiptMaxBytes) return new File([blob], "kvitto.jpg", { type: "image/jpeg" });
    }
    throw new Error("Bilden är för stor.");
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function ExpenseWizard() {
  const [step, setStep] = useState(0);
  const [person, setPerson] = useState("");
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState("");
  const [receipt, setReceipt] = useState<{ file: File; url: string } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const id = useRef<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const ore = parseExpenseAmount(amount);
  const receiptUrl = receipt?.url;

  useEffect(() => {
    if (step > 0 || done) heading.current?.focus();
  }, [step, done]);

  useEffect(() => () => {
    if (receiptUrl) URL.revokeObjectURL(receiptUrl);
  }, [receiptUrl]);

  async function chooseReceipt(kind: "image" | "pdf", file?: File) {
    if (!file || busy) return;
    setError("");
    setBusy(true);
    try {
      let attachment: File;
      if (kind === "pdf") {
        if (file.size > receiptMaxBytes) {
          setError("PDF-filen är för stor. Välj en PDF på högst 900 kB.");
          return;
        }
        if (!isPdfReceipt(new Uint8Array(await file.arrayBuffer()))) {
          setError("PDF-filen kunde inte läsas. Välj en annan PDF.");
          return;
        }
        attachment = new File([file], file.name, { type: pdfReceiptType });
      } else {
        attachment = await prepareReceiptImage(file);
      }
      setReceipt({ file: attachment, url: URL.createObjectURL(attachment) });
    } catch {
      setError(kind === "pdf" ? "PDF-filen kunde inte läsas." : "Bilden kunde inte läsas. Försök med ett nytt foto i JPG eller PNG.");
    } finally {
      setBusy(false);
    }
  }

  async function advance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const validation = [
      person ? "" : "Välj en person.",
      reason.trim() ? "" : "Skriv en kort anledning.",
      ore ? "" : "Ange ett belopp över 0 kr med högst två decimaler.",
      receipt ? "" : "Lägg till kvittot som bild eller PDF.",
    ];
    setError(validation[step] ?? "");
    if (validation[step]) return;
    if (step < steps.length - 1) {
      setStep(step + 1);
      return;
    }
    if (!receipt) return;

    setBusy(true);
    try {
      id.current ??= crypto.randomUUID();
      const form = new FormData();
      form.set("id", id.current);
      form.set("person", person);
      form.set("reason", reason);
      form.set("amount", amount);
      form.set("receipt", receipt.file);
      const message = await submitExpense(form);
      if (message) setError(message);
      else setDone(true);
    } catch {
      setError("Det gick inte att skicka utlägget. Försök igen.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <section className="max-w-lg rounded-xl border border-line bg-surface p-5 sm:p-7">
        <h2 ref={heading} tabIndex={-1} className="text-lg font-semibold">Utlägget är inskickat</h2>
        <p className="mb-5 mt-2 text-sm text-muted">{person} · {formatExpenseAmount(ore ?? 0)}</p>
        <ButtonLink href="/utlagg">Tillbaka till Utlägg</ButtonLink>
      </section>
    );
  }

  return (
    <form onSubmit={advance} className="max-w-lg rounded-xl border border-line bg-surface p-5 sm:p-7">
      <p className="text-sm text-muted">Steg {step + 1} av {steps.length}</p>
      <progress aria-label="Steg i registreringen" max={steps.length} value={step + 1} className="mt-2 h-1.5 w-full accent-brand" />
      <h2 ref={heading} tabIndex={-1} className="mb-5 mt-4 text-xl font-semibold">{steps[step]}</h2>

      {step === 0 && (
        <div role="group" aria-label="Person" className="grid grid-cols-2 gap-2">
          {expensePeople.map((name) => (
            <Button key={name} variant={person === name ? "primary" : "secondary"} aria-pressed={person === name}
              className="h-12 justify-start px-4" onClick={() => { setPerson(name); setError(""); }}>
              {name}
            </Button>
          ))}
        </div>
      )}
      {step === 1 && (
        <Field label="Kort anledning" htmlFor="expense-reason">
          <Textarea id="expense-reason" maxLength={160} placeholder="Till exempel fika till kundmöte" value={reason}
            onChange={(event) => setReason(event.target.value)} />
        </Field>
      )}
      {step === 2 && (
        <Field label="Totalt belopp i kronor inklusive moms" htmlFor="expense-amount">
          <Input id="expense-amount" inputMode="decimal" maxLength={10} placeholder="0,00" value={amount}
            onChange={(event) => setAmount(event.target.value)} className="h-11" />
        </Field>
      )}
      {step === 3 && (
        <div className="space-y-4">
          <Field label="Ta ett foto eller välj en bild" htmlFor="expense-receipt"
            hint="Se till att hela kvittot och totalsumman går att läsa.">
            <Input id="expense-receipt" type="file" accept="image/*" className="h-auto py-2" disabled={busy}
              onChange={(event) => { void chooseReceipt("image", event.target.files?.[0]); event.target.value = ""; }} />
          </Field>
          <Field label="Eller välj en PDF" htmlFor="expense-receipt-pdf" hint="Högst 900 kB.">
            <Input id="expense-receipt-pdf" type="file" accept=".pdf,application/pdf" className="h-auto py-2" disabled={busy}
              onChange={(event) => { void chooseReceipt("pdf", event.target.files?.[0]); event.target.value = ""; }} />
          </Field>
        </div>
      )}
      {step === 4 && (
        <dl className="space-y-2 text-sm">
          <div><dt className="text-muted">Person</dt><dd>{person}</dd></div>
          <div><dt className="text-muted">Anledning</dt><dd className="break-words">{reason.trim()}</dd></div>
          <div><dt className="text-muted">Totalt</dt><dd className="font-semibold">{formatExpenseAmount(ore ?? 0)}</dd></div>
        </dl>
      )}
      {step >= 3 && receipt && (receipt.file.type === pdfReceiptType ? (
        <div className="mt-4 space-y-2 text-sm">
          <p className="break-words">Valt kvitto: {receipt.file.name}</p>
          <a href={receipt.url} target="_blank" rel="noreferrer" className={buttonClass()}>Öppna vald PDF</a>
        </div>
      ) : (
        <a href={receipt.url} target="_blank" rel="noreferrer" className="mt-4 block w-fit">
          {/* eslint-disable-next-line @next/next/no-img-element -- Lokal förhandsvisning via blob-URL. */}
          <img src={receipt.url} alt="Öppna kvittobilden i full storlek" className="max-h-56 max-w-full rounded-md border border-line object-contain" />
        </a>
      ))}
      {error && <p role="alert" className="mt-4 text-sm text-danger">{error}</p>}

      <div className={cn("mt-6 flex items-center gap-2", step > 0 ? "justify-between" : "justify-end")}>
        {step > 0 && <Button className="h-10" disabled={busy} onClick={() => { setStep(step - 1); setError(""); }}>Tillbaka</Button>}
        <Button type="submit" variant="primary" className="h-10" disabled={busy}>
          {busy ? (step === 3 ? "Läser kvittot…" : "Skickar…") : step === 4 ? "Skicka in utlägg" : "Nästa"}
        </Button>
      </div>
    </form>
  );
}
