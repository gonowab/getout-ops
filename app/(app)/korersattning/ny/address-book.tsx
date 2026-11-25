"use client";

import { useState, type KeyboardEvent } from "react";
import { Button, Field, Input } from "@/components/ui";
import { saveMileageAddress } from "@/lib/actions/mileage";
import type { MileageAddress } from "@/lib/mileage";

export function MileageAddressBook({ addresses, onAdd, onUse }: {
  addresses: MileageAddress[];
  onAdd: (entry: MileageAddress) => void;
  onUse: (field: "start" | "destination", address: string) => void;
}) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const entries = [...addresses].sort((a, b) => a.name.localeCompare(b.name, "sv"));

  async function save() {
    if (saving || !name.trim() || !address.trim()) return;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const result = await saveMileageAddress(name, address);
      if (result.entry) {
        onAdd(result.entry);
        setName("");
        setAddress("");
        setMessage(`${result.entry.name} sparades i adressboken.`);
      } else {
        setError(result.error ?? "Adressen kunde inte sparas.");
      }
    } catch {
      setError("Adressen kunde inte sparas. Försök igen.");
    } finally {
      setSaving(false);
    }
  }

  function saveOnEnter(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    event.preventDefault();
    void save();
  }

  return (
    <details className="rounded-md border border-line bg-canvas px-3">
      <summary className="cursor-pointer py-3 text-sm font-medium">Adressbok · {entries.length} sparade adresser</summary>
      <div className="space-y-3 pb-3">
        {entries.length > 0 && (
          <ul className="divide-y divide-line">
            {entries.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2">
                <div className="min-w-0">
                  <p className="break-words text-sm font-medium">{entry.name}</p>
                  <p className="break-words text-xs text-muted">{entry.address}</p>
                </div>
                <div className="flex gap-1">
                  <Button aria-label={`Sätt ${entry.name} som start`} className="max-md:min-h-11"
                    onClick={() => { onUse("start", entry.address); setMessage(`Startpunkt: ${entry.name}`); }}>Som start</Button>
                  <Button aria-label={`Sätt ${entry.name} som mål`} className="max-md:min-h-11"
                    onClick={() => { onUse("destination", entry.address); setMessage(`Mål: ${entry.name}`); }}>Som mål</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <fieldset className="space-y-2 border-t border-line pt-3">
          <legend className="sr-only">Lägg till i adressboken</legend>
          <p className="text-xs text-muted">Sparade adresser är gemensamma för teamet.</p>
          <Field label="Platsens namn" htmlFor="mileage-address-name">
            <Input id="mileage-address-name" className="max-md:h-11 max-md:text-base" maxLength={60} value={name}
              disabled={saving} onKeyDown={saveOnEnter} onChange={(event) => setName(event.target.value)} />
          </Field>
          <Field label="Adress" htmlFor="mileage-address-value">
            <Input id="mileage-address-value" className="max-md:h-11 max-md:text-base" maxLength={180} value={address}
              disabled={saving} onKeyDown={saveOnEnter} onChange={(event) => setAddress(event.target.value)} />
          </Field>
          <Button className="max-md:min-h-11" disabled={saving || !name.trim() || !address.trim()} onClick={() => void save()}>
            {saving ? "Sparar…" : "Spara adress"}
          </Button>
        </fieldset>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        {message && <p role="status" className="text-sm text-muted">{message}</p>}
      </div>
    </details>
  );
}
