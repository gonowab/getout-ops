"use client";

import { startTransition, useEffect, useRef, useState, type FormEvent } from "react";
import { Button, ButtonLink, Field, Input, Select, Textarea } from "@/components/ui";
import { estimateMileage, submitMileage } from "@/lib/actions/mileage";
import { expensePeople, formatExpenseAmount } from "@/lib/expenses";
import { mileageAmounts, mileagePerson, mileageRateOrePerKm, parseFuelAmount, parseMileageDistance, validMileageDate } from "@/lib/mileage";
import { MileagePayouts } from "../payouts";

const steps = ["Vem körde och när?", "Vart körde ni?", "Hur ska ersättningen delas?", "Granska resan"];
const inputClass = "max-md:h-11 max-md:text-base";
const officeAddress = "Ladugårdsvägen 1, 234 35 Lomma";

export function MileageWizard({ today, routeEnabled }: { today: string; routeEnabled: boolean }) {
  const [step, setStep] = useState(0);
  const [driver, setDriver] = useState("");
  const [date, setDate] = useState(today);
  const [origin, setOrigin] = useState(officeAddress);
  const [destination, setDestination] = useState("");
  const [roundTrip, setRoundTrip] = useState(false);
  const [autoEstimate, setAutoEstimate] = useState(true);
  const [distance, setDistance] = useState("");
  const [purpose, setPurpose] = useState("");
  const [fuel, setFuel] = useState("");
  const [fuelPayer, setFuelPayer] = useState("");
  const [recipients, setRecipients] = useState([...expensePeople]);
  const [error, setError] = useState("");
  const [routeMessage, setRouteMessage] = useState("");
  const [estimated, setEstimated] = useState(false);
  const [estimating, setEstimating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const id = useRef<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const manualDistance = useRef(false);
  const tenths = parseMileageDistance(distance);
  const fuelOre = parseFuelAmount(fuel);
  const payer = fuelOre ? mileagePerson(fuelPayer) : undefined;
  const amounts = tenths && fuelOre !== null && recipients.length
    ? mileageAmounts(tenths, fuelOre, payer ?? null, recipients) : null;

  useEffect(() => {
    if (step > 0 || done) heading.current?.focus();
  }, [step, done]);

  useEffect(() => {
    const from = origin.trim();
    const to = destination.trim();
    if (step !== 1 || !routeEnabled || !autoEstimate || !from || !to || manualDistance.current) return;

    let current = true;
    const timer = window.setTimeout(() => {
      if (manualDistance.current) return;
      setEstimating(true);
      startTransition(async () => {
        try {
          const result = await estimateMileage(from, to, roundTrip);
          if (!current || manualDistance.current) return;
          if (result.kilometers) {
            setDistance(result.kilometers);
            setEstimated(true);
            setError("");
            setRouteMessage("Uppskattad körsträcka. Justera den om du körde en annan väg.");
          } else {
            setRouteMessage(result.error ?? "Ange körda kilometer manuellt.");
          }
        } catch {
          if (current && !manualDistance.current) {
            setRouteMessage("Kunde inte uppskatta avståndet. Ange körda kilometer manuellt.");
          }
        } finally {
          if (current && !manualDistance.current) setEstimating(false);
        }
      });
    }, 1200);

    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, [step, routeEnabled, autoEstimate, origin, destination, roundTrip]);

  function clearEstimate() {
    if (estimated || (autoEstimate && routeEnabled && manualDistance.current)) setDistance("");
    manualDistance.current = false;
    setEstimating(false);
    setEstimated(false);
    setRouteMessage("");
  }

  async function advance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || estimating) return;
    const validations = [
      !driver || !validMileageDate(date) || date > today ? "Välj förare och ett giltigt resedatum." : "",
      !origin.trim() || !destination.trim() || !tenths || !purpose.trim() ? "Fyll i start, mål, körsträcka och syfte." : "",
      fuelOre === null || (fuelOre > 0 && !payer)
        ? "Ange ett giltigt bensinbelopp och vem som betalade."
        : recipients.length === 0 ? "Välj minst en person som ska dela på återstoden." : "",
    ];
    const validation = validations[step] ?? validations.find(Boolean) ?? "";
    setError(validation);
    if (validation) return;
    if (step < steps.length - 1) {
      setStep(step + 1);
      return;
    }
    id.current ??= crypto.randomUUID();
    const form = new FormData();
    for (const [name, value] of Object.entries({ id: id.current, driver, date, origin, destination, distance, purpose, fuel, fuelPayer })) {
      form.set(name, value);
    }
    recipients.forEach((person) => form.append("recipient", person));
    setSaving(true);
    try {
      const message = await submitMileage(form);
      if (message) setError(message);
      else setDone(true);
    } catch {
      setError("Resan kunde inte skickas. Försök igen.");
    } finally {
      setSaving(false);
    }
  }

  if (done) return (
    <section className="max-w-lg rounded-xl border border-line bg-surface p-5">
      <h2 ref={heading} tabIndex={-1} className="text-lg font-semibold">Resan är inskickad</h2>
      <p className="mb-4 mt-2 text-muted">Den finns nu under Att ersätta.</p>
      <ButtonLink href="/korersattning">Tillbaka till Körersättning</ButtonLink>
    </section>
  );

  return (
    <form onSubmit={advance} className="max-w-lg rounded-xl border border-line bg-surface p-5 sm:p-7">
      <p className="text-sm text-muted">Steg {step + 1} av {steps.length}</p>
      <progress aria-label="Steg i registreringen" max={steps.length} value={step + 1} className="mt-2 h-1.5 w-full accent-brand" />
      <h2 ref={heading} tabIndex={-1} className="mb-5 mt-4 text-xl font-semibold">{steps[step]}</h2>
      <div className="space-y-4">
        {step === 0 && <>
          <Field label="Förare" htmlFor="mileage-driver">
            <Select id="mileage-driver" className={inputClass} value={driver} onChange={(event) => setDriver(event.target.value)}>
              <option value="">Välj förare</option>
              {expensePeople.map((person) => <option key={person}>{person}</option>)}
            </Select>
          </Field>
          <Field label="Resedatum" htmlFor="mileage-date">
            <Input id="mileage-date" type="date" max={today} value={date} className={inputClass} onChange={(event) => setDate(event.target.value)} />
          </Field>
        </>}
        {step === 1 && <>
          {routeEnabled && (
            <label className="block space-y-1 text-sm">
              <span className="flex min-h-9 items-center gap-2">
                <input type="checkbox" checked={autoEstimate}
                  onChange={(event) => { setAutoEstimate(event.target.checked); clearEstimate(); }} />
                Beräkna körsträckan automatiskt
              </span>
              <span className="block text-xs text-muted">När valet är på skickas start och mål till Google Maps för att beräkna sträckan.</span>
            </label>
          )}
          <Field label="Från (adress eller ort)" htmlFor="mileage-origin">
            <Input id="mileage-origin" maxLength={180} value={origin} className={inputClass}
              onChange={(event) => { setOrigin(event.target.value); clearEstimate(); }} />
          </Field>
          <Field label="Till (adress eller ort)" htmlFor="mileage-destination">
            <Input id="mileage-destination" maxLength={180} value={destination} className={inputClass}
              onChange={(event) => { setDestination(event.target.value); clearEstimate(); }} />
            <Button variant="ghost" className="self-start max-md:min-h-11"
              disabled={destination === officeAddress}
              onClick={() => { setDestination(officeAddress); clearEstimate(); }}>
              Sätt kontoret som mål
            </Button>
          </Field>
          {routeEnabled && autoEstimate && (
            <Field label="Typ av resa" htmlFor="mileage-trip">
              <Select id="mileage-trip" value={roundTrip ? "return" : "one-way"} className={inputClass}
                onChange={(event) => { setRoundTrip(event.target.value === "return"); clearEstimate(); }}>
                <option value="one-way">Enkel väg</option>
                <option value="return">Tur och retur</option>
              </Select>
            </Field>
          )}
          <Field label="Totalt körda kilometer" htmlFor="mileage-distance" hint="25 kr per mil. Räkna med hela sträckan du körde.">
            <Input id="mileage-distance" inputMode="decimal" maxLength={7} value={distance} className={inputClass}
              onChange={(event) => {
                manualDistance.current = true;
                setDistance(event.target.value);
                setEstimated(false);
                setEstimating(false);
                setRouteMessage("");
              }} />
          </Field>
          {(estimating || routeMessage) && <p role="status" className="text-sm text-muted">{estimating ? "Beräknar körsträckan…" : routeMessage}</p>}
          {tenths !== null && <p className="text-sm font-medium">{formatExpenseAmount(tenths * mileageRateOrePerKm / 10)} i milersättning</p>}
          <Field label="Syfte med resan" htmlFor="mileage-purpose">
            <Textarea id="mileage-purpose" maxLength={160} value={purpose} className="max-md:text-base" onChange={(event) => setPurpose(event.target.value)} />
          </Field>
        </>}
        {step === 2 && <>
          <Field label="Betald bensin för resan (kr)" htmlFor="mileage-fuel" hint="Lämna tomt om ingen betalade bensin.">
            <Input id="mileage-fuel" inputMode="decimal" maxLength={9} value={fuel} className={inputClass} onChange={(event) => setFuel(event.target.value)} />
          </Field>
          {fuelOre !== null && fuelOre > 0 && <Field label="Vem betalade bensinen?" htmlFor="mileage-payer">
            <Select id="mileage-payer" className={inputClass} value={fuelPayer} onChange={(event) => setFuelPayer(event.target.value)}>
              <option value="">Välj person</option>
              {expensePeople.map((person) => <option key={person}>{person}</option>)}
            </Select>
          </Field>}
          <fieldset>
            <legend className="text-sm font-medium">Vilka ska dela på resten?</legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {expensePeople.map((person) => <label key={person} className="flex min-h-11 items-center gap-2 rounded-md border border-line px-2">
                <input type="checkbox" checked={recipients.includes(person)}
                  onChange={(event) => setRecipients(expensePeople.filter((candidate) => candidate === person ? event.target.checked : recipients.includes(candidate)))} />
                {person}
              </label>)}
            </div>
          </fieldset>
        </>}
        {step === 3 && amounts && <>
          <p className="break-words text-sm"><strong>{origin.trim()} → {destination.trim()}</strong><br />{driver} · {date} · {distance} km<br />{purpose.trim()}</p>
          <MileagePayouts amounts={amounts} />
        </>}
      </div>
      {error && <p role="alert" className="mt-4 text-sm text-danger">{error}</p>}
      <div className="mt-6 flex justify-end gap-2">
        {step > 0 && <Button className="max-md:h-11" disabled={saving || estimating} onClick={() => { setStep(step - 1); setError(""); }}>Tillbaka</Button>}
        <Button type="submit" variant="primary" className="max-md:h-11 max-md:flex-1" disabled={saving || estimating}>
          {saving ? "Skickar…" : step === steps.length - 1 ? "Skicka in resa" : "Nästa"}
        </Button>
      </div>
    </form>
  );
}
