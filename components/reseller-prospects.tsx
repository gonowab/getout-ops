"use client";

import { Fragment, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  Button,
  Field,
  Input,
  Select,
  Textarea,
  PageHeader,
  cn,
} from "@/components/ui";
import { Sheet } from "@/components/sheet";
import { useToast } from "@/components/toast";
import {
  saveProspect,
  updateProspectStatus,
  updateProspectContacted,
} from "@/lib/actions/prospects";
import {
  prospectStatusLabels,
  prospectStatusStyles,
  type Prospect,
} from "@/lib/prospects";
import type { ActionResult } from "@/lib/types";

type Status = Prospect["status"];
function StatusSelect({
  value,
  onChange,
  disabled,
  label,
}: {
  value: Status;
  onChange: (v: Status) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <Select
      aria-label={label}
      value={value ?? ""}
      disabled={disabled}
      onChange={(e) => onChange((e.target.value || null) as Status)}
      className={cn(
        "min-w-36",
        value ? prospectStatusStyles[value] : "text-muted",
      )}
    >
      <option value="">Ingen bedömning</option>
      {Object.entries(prospectStatusLabels).map(([key, label]) => (
        <option key={key} value={key}>
          {key === "red" ? "🔴" : key === "yellow" ? "🟡" : "🟢"} {label}
        </option>
      ))}
    </Select>
  );
}
function useSave() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();
  function run(work: () => Promise<ActionResult>, done?: () => void) {
    setError(null);
    start(async () => {
      try {
        const result = await work();
        if (!result.ok) {
          setError(result.error);
          return;
        }
        done?.();
        toast({ kind: "ok", text: result.message ?? "Sparat" });
        router.refresh();
      } catch {
        setError("Kunde inte spara. Försök igen.");
      }
    });
  }
  return { pending, error, run };
}
function ProspectForm({
  prospect,
  onSaved,
}: {
  prospect?: Prospect;
  onSaved?: () => void;
}) {
  const save = useSave();
  const [status, setStatus] = useState<Status>(prospect?.status ?? null);
  const [contacted, setContacted] = useState(prospect?.contacted ?? false);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        save.run(
          () =>
            saveProspect(prospect?.id ?? null, {
              name: String(fd.get("name") ?? ""),
              email: String(fd.get("email") ?? ""),
              contact_name: String(fd.get("contact_name") ?? ""),
              notes: String(fd.get("notes") ?? ""),
              status,
              contacted,
            }),
          onSaved,
        );
      }}
      className="grid gap-3 sm:grid-cols-2"
    >
      <Field label="Namn">
        <Input
          aria-label="Prospektets namn"
          name="name"
          defaultValue={prospect?.name ?? ""}
        />
      </Field>
      <Field label="Mejl">
        <Input
          aria-label="Prospektets mejl"
          name="email"
          inputMode="email"
          defaultValue={prospect?.email ?? ""}
        />
      </Field>
      <Field label="Kontaktperson">
        <Input
          aria-label="Prospektets kontaktperson"
          name="contact_name"
          defaultValue={prospect?.contact_name ?? ""}
        />
      </Field>
      <Field label="Bedömning">
        <StatusSelect
          label="Prospektets bedömning"
          value={status}
          onChange={setStatus}
        />
      </Field>
      <label className="col-span-full flex items-center gap-2">
        <input
          type="checkbox"
          checked={contacted}
          onChange={(e) => setContacted(e.target.checked)}
        />{" "}
        Kontaktad
      </label>
      <Field label="Anteckningar" className="col-span-full">
        <Textarea
          aria-label="Prospektets anteckningar"
          name="notes"
          defaultValue={prospect?.notes ?? ""}
          rows={4}
        />
      </Field>
      <div className="col-span-full flex flex-wrap items-center gap-3">
        <Button type="submit" variant="primary" disabled={save.pending}>
          {save.pending ? "Sparar…" : "Spara prospekt"}
        </Button>
        {save.error ? (
          <p role="alert" className="text-danger">
            {save.error}
          </p>
        ) : null}
      </div>
    </form>
  );
}
function ProspectRow({ prospect }: { prospect: Prospect }) {
  const [expanded, setExpanded] = useState(false);
  const save = useSave();
  return (
    <Fragment>
      <tr className="border-t border-line align-top hover:bg-canvas">
        <td className="px-4 py-3">
          <button
            aria-expanded={expanded}
            aria-controls={`prospect-${prospect.id}`}
            className="flex items-center gap-2 text-left font-medium"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <ChevronDown className="size-4 shrink-0" />
            ) : (
              <ChevronRight className="size-4 shrink-0" />
            )}
            {prospect.name || "Namnlöst prospekt"}
          </button>
        </td>
        <td className="px-4 py-3 text-muted">{prospect.email || "–"}</td>
        <td className="px-4 py-3 text-muted">{prospect.contact_name || "–"}</td>
        <td className="px-4 py-3">
          <label className="flex items-center gap-2 whitespace-nowrap">
            <input
              aria-label={`Kontaktad: ${prospect.name || "Namnlöst prospekt"}`}
              type="checkbox"
              checked={prospect.contacted}
              disabled={save.pending || expanded}
              onChange={(e) => {
                const checked = e.target.checked;
                save.run(() => updateProspectContacted(prospect.id, checked));
              }}
            />
            {prospect.contacted ? "Kontaktad" : "Ej kontaktad"}
          </label>
        </td>
        <td className="px-4 py-2">
          <StatusSelect
            label={`Bedömning: ${prospect.name || "Namnlöst prospekt"}`}
            value={prospect.status}
            disabled={save.pending || expanded}
            onChange={(status) =>
              save.run(() => updateProspectStatus(prospect.id, status))
            }
          />
        </td>
        <td className="max-w-72 px-4 py-3 text-muted">
          <span className="line-clamp-2 whitespace-pre-line">
            {prospect.notes || "–"}
          </span>
        </td>
      </tr>
      {save.error ? (
        <tr>
          <td colSpan={6} className="px-4 pb-2 text-danger" role="alert">
            {save.error}
          </td>
        </tr>
      ) : null}
      {expanded ? (
        <tr id={`prospect-${prospect.id}`}>
          <td colSpan={6} className="border-t border-line bg-canvas/50 p-4">
            <ProspectForm
              prospect={prospect}
            />
          </td>
        </tr>
      ) : null}
    </Fragment>
  );
}
function ProspectList({ prospects }: { prospects: Prospect[] }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [contact, setContact] = useState("all");
  const visible = prospects.filter(
    (p) =>
      [p.name, p.email, p.contact_name, p.notes]
        .join(" ")
        .toLocaleLowerCase("sv")
        .includes(search.trim().toLocaleLowerCase("sv")) &&
      (status === "all" ||
        (status === "none" ? p.status === null : p.status === status)) &&
      (contact === "all" || p.contacted === (contact === "yes")),
  );
  return (
    <>
      <PageHeader
        title="Prospekt och kontaktade"
        description={`${prospects.length} prospekt · ${prospects.filter((p) => p.contacted).length} kontaktade`}
        actions={
          <Button variant="primary" onClick={() => setOpen(true)}>
            + Nytt prospekt
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input
          aria-label="Sök prospekt"
          placeholder="Sök namn, mejl, kontakt eller anteckning"
          className="max-w-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select
          aria-label="Filtrera prospekt efter bedömning"
          className="w-auto"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">Alla bedömningar</option>
          <option value="none">Ingen bedömning</option>
          {Object.entries(prospectStatusLabels).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Filtrera prospekt efter kontakt"
          className="w-auto"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
        >
          <option value="all">Alla kontakter</option>
          <option value="yes">Kontaktade</option>
          <option value="no">Ej kontaktade</option>
        </Select>
        <span className="text-[12px] text-muted">
          Röd: tackat nej · Gul: tveksam · Grön: positiv
        </span>
      </div>
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[850px] text-[13px]">
          <thead className="bg-canvas text-left text-[12px] text-muted">
            <tr>
              {[
                "Namn",
                "Mejl",
                "Kontaktperson",
                "Kontakt",
                "Bedömning",
                "Anteckningar",
              ].map((h) => (
                <th key={h} className="px-4 py-2 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((p) => (
              <ProspectRow key={p.id} prospect={p} />
            ))}
            {!visible.length ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted">
                  {prospects.length
                    ? "Inga prospekt matchar dina filter."
                    : "Inga prospekt ännu. Lägg till ett prospekt för att börja hålla koll på kontakterna."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title="Nytt prospekt"
        description="Alla fält är frivilliga. Färg visar bedömning; Kontaktad visar om ni har hört av er."
      >
        <ProspectForm onSaved={() => setOpen(false)} />
      </Sheet>
    </>
  );
}
export function ResellerTabs({
  children,
  prospects,
  resellerCount,
}: {
  children: ReactNode;
  prospects: Prospect[];
  resellerCount: number;
}) {
  const [tab, setTab] = useState("resellers");
  return (
    <>
      <div
        role="tablist"
        aria-label="Återförsäljarregister"
        className="mb-6 flex flex-wrap gap-2 border-b border-line pb-3"
      >
        {[
          ["resellers", `Återförsäljare ${resellerCount}`],
          ["prospects", `Prospekt / kontaktade ${prospects.length}`],
        ].map(([id, label]) => (
          <Button
            key={id}
            role="tab"
            id={`tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`panel-${id}`}
            variant={tab === id ? "secondary" : "ghost"}
            onClick={() => setTab(id)}
            onKeyDown={(e) => {
              if (
                e.key === "ArrowLeft" ||
                e.key === "ArrowRight" ||
                e.key === "Home" ||
                e.key === "End"
              ) {
                e.preventDefault();
                const next =
                  e.key === "Home"
                    ? "resellers"
                    : e.key === "End"
                      ? "prospects"
                      : id === "resellers"
                        ? "prospects"
                        : "resellers";
                setTab(next);
                document.getElementById(`tab-${next}`)?.focus();
              }
            }}
            tabIndex={tab === id ? 0 : -1}
          >
            {label}
          </Button>
        ))}
      </div>
      <div
        role="tabpanel"
        id="panel-resellers"
        aria-labelledby="tab-resellers"
        hidden={tab !== "resellers"}
      >
        {children}
      </div>
      <div
        role="tabpanel"
        id="panel-prospects"
        aria-labelledby="tab-prospects"
        hidden={tab !== "prospects"}
      >
        <ProspectList prospects={prospects} />
      </div>
    </>
  );
}
